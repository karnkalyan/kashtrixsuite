"""APScheduler service for video playout and CG event scheduling (Asia/Kathmandu)."""
import logging
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.date import DateTrigger
from apscheduler.triggers.interval import IntervalTrigger
from db import SessionLocal, Schedule, utcnow, object_dict
from engine import schedule_is_active, TZ

log = logging.getLogger('kashtrix.scheduler')


def _compute_window_end(sched, now: datetime, tz: ZoneInfo = TZ) -> datetime:
    dt = datetime.fromisoformat(sched.starts_at.replace('Z', '+00:00'))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=tz)
    dt = dt.astimezone(tz)
    dur = int(sched.duration_sec or 3600)
    if sched.repeat in ('daily', 'weekly'):
        target = now.replace(hour=dt.hour, minute=dt.minute, second=dt.second, microsecond=0)
        if sched.repeat == 'weekly':
            target -= timedelta(days=(target.weekday() - dt.weekday()) % 7)
        if target > now:
            target -= timedelta(days=7 if sched.repeat == 'weekly' else 1)
        dt = target
    end_dt = dt + timedelta(seconds=dur)
    if end_dt <= now:
        end_dt = now + timedelta(seconds=dur)
    return end_dt


class BroadcastSchedulerService:
    """Dedicated single APScheduler instance managing MySQL schedules for video playout and CG overlays."""

    def __init__(self, engine, event_callback=None):
        self.engine = engine
        self.event_callback = event_callback
        self.engine.event_callback = self.emit
        self.scheduler = BackgroundScheduler(
            timezone=TZ,
            job_defaults={
                'coalesce': True,
                'max_instances': 1,
                'misfire_grace_time': 3600,
            },
        )
        self._started = False

    def emit(self, event_type: str, payload: dict):
        if self.event_callback:
            try:
                self.event_callback(event_type, payload)
            except Exception:
                log.exception('Failed emitting scheduler event %s', event_type)

    def start(self):
        if not self._started:
            self.scheduler.start()
            self._started = True
            self.scheduler.add_job(
                self._heartbeat_job,
                trigger=IntervalTrigger(seconds=1, timezone=TZ),
                id='engine_supervisor_heartbeat',
                replace_existing=True,
            )
            self.restore_schedules()
            log.info('APScheduler started with timezone %s', TZ)

    def shutdown(self):
        if self._started:
            try:
                self.scheduler.shutdown(wait=False)
            except Exception:
                pass
            self._started = False

    def _heartbeat_job(self):
        try:
            prev_state = self.engine.status.get('state')
            prev_media = self.engine.status.get('media_id')
            prev_outputs = dict(self.engine.status.get('outputs') or {})
            self.engine.tick()
            if self.engine.status.get('state') != prev_state or self.engine.status.get('media_id') != prev_media:
                self.emit('playout.status', self.engine.status.copy())
            if self.engine.status.get('outputs') != prev_outputs:
                self.emit('stream.status', {'outputs': self.engine.status.get('outputs', {})})
            self.emit('system.health', {'engine': self.engine.status.copy(), 'server_time': datetime.now(TZ).isoformat()})
        except Exception:
            log.exception('APScheduler heartbeat failed')

    def restore_schedules(self):
        with SessionLocal() as db:
            tz = self.engine.get_tz(db)
            now = datetime.now(tz)
            schedules = db.schedule.find_many(
                where={'tenant_id': self.engine.tenant_id, 'channel_id': self.engine.channel_id}
            )
            for s in schedules:
                self._register_schedule_jobs(s, now, db=db)

    def sync_schedule(self, schedule_id: int):
        with SessionLocal() as db:
            tz = self.engine.get_tz(db)
            now = datetime.now(tz)
            s = db.schedule.find_unique(where={'id': int(schedule_id)})
            if not s:
                self.remove_schedule(schedule_id)
                return
            self._register_schedule_jobs(s, now, db=db)

    def remove_schedule(self, schedule_id: int):
        sid = int(schedule_id)
        for prefix in ('sched_start_', 'sched_end_'):
            job_id = f'{prefix}{sid}'
            if self.scheduler.get_job(job_id):
                try:
                    self.scheduler.remove_job(job_id)
                except Exception:
                    pass
        was_active = sid in self.engine.triggered_schedules
        self.engine.triggered_schedules.discard(sid)
        if was_active:
            self.engine.tick()

    def pause_schedule(self, schedule_id: int) -> dict:
        sid = int(schedule_id)
        with SessionLocal() as db:
            s = db.schedule.update(
                where={'id': sid},
                data={'enabled': False, 'status': 'paused'},
            )
            self.remove_schedule(sid)
            data = object_dict(s)
        self.emit('schedule.updated', data)
        return data

    def resume_schedule(self, schedule_id: int) -> dict:
        sid = int(schedule_id)
        with SessionLocal() as db:
            s = db.schedule.update(
                where={'id': sid},
                data={'enabled': True, 'status': 'scheduled'},
            )
            self._register_schedule_jobs(s, datetime.now(TZ), db=db)
            data = object_dict(s)
        self.emit('schedule.updated', data)
        return data

    def schedule_cg_auto_cut(self, cg_id: int, duration_sec: int):
        job_id = f'cg_autocut_{cg_id}'
        if duration_sec and duration_sec > 0:
            run_at = datetime.now(TZ) + timedelta(seconds=int(duration_sec))
            self.scheduler.add_job(
                self._on_cg_auto_cut,
                trigger=DateTrigger(run_date=run_at, timezone=TZ),
                args=[int(cg_id)],
                id=job_id,
                replace_existing=True,
            )
        elif self.scheduler.get_job(job_id):
            self.scheduler.remove_job(job_id)

    def _on_cg_auto_cut(self, cg_id: int):
        with SessionLocal() as db:
            layer = db.cg.find_unique(where={'id': int(cg_id)})
            if layer and layer.active:
                updated = db.cg.update(where={'id': int(cg_id)}, data={'active': False, 'updated_at': utcnow()})
                self.engine.sync_cg(db)
                self.emit('cg.deactivated', object_dict(updated))

    def _register_schedule_jobs(self, s: Schedule, now: datetime, db=None):
        sid = s.id
        start_job_id = f'sched_start_{sid}'
        end_job_id = f'sched_end_{sid}'

        if not s.enabled or s.status in ('paused', 'cancelled'):
            self.remove_schedule(sid)
            return

        tz = self.engine.get_tz(db)
        try:
            dt = datetime.fromisoformat(s.starts_at.replace('Z', '+00:00'))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=tz)
            dt = dt.astimezone(tz)
        except (ValueError, TypeError):
            return

        if s.repeat == 'daily':
            trigger = CronTrigger(hour=dt.hour, minute=dt.minute, second=dt.second, timezone=tz)
            self.scheduler.add_job(
                self._on_schedule_start,
                trigger=trigger,
                args=[sid],
                id=start_job_id,
                replace_existing=True,
            )
        elif s.repeat == 'weekly':
            trigger = CronTrigger(
                day_of_week=dt.weekday(),
                hour=dt.hour,
                minute=dt.minute,
                second=dt.second,
                timezone=tz,
            )
            self.scheduler.add_job(
                self._on_schedule_start,
                trigger=trigger,
                args=[sid],
                id=start_job_id,
                replace_existing=True,
            )
        else:
            if dt > now:
                self.scheduler.add_job(
                    self._on_schedule_start,
                    trigger=DateTrigger(run_date=dt, timezone=tz),
                    args=[sid],
                    id=start_job_id,
                    replace_existing=True,
                )
            elif self.scheduler.get_job(start_job_id):
                self.scheduler.remove_job(start_job_id)

        # If currently within the active window (including after a server restart), activate immediately and schedule end
        if schedule_is_active(s, now, tz):
            self.engine.triggered_schedules.add(sid)
            end_dt = _compute_window_end(s, now, tz)
            self.scheduler.add_job(
                self._on_schedule_end,
                trigger=DateTrigger(run_date=end_dt, timezone=tz),
                args=[sid],
                id=end_job_id,
                replace_existing=True,
            )
            if db is not None and s.status != 'active':
                db.schedule.update(where={'id': sid}, data={'status': 'active', 'last_run_at': utcnow()})

    def _on_schedule_start(self, schedule_id: int):
        sid = int(schedule_id)
        now = datetime.now(TZ)
        with SessionLocal() as db:
            s = db.schedule.find_unique(where={'id': sid})
            if not s or not s.enabled:
                return
            s = db.schedule.update(
                where={'id': sid},
                data={'status': 'active', 'last_run_at': utcnow()},
            )
            self.engine.triggered_schedules.add(sid)
            end_dt = now + timedelta(seconds=int(s.duration_sec or 3600))
            self.scheduler.add_job(
                self._on_schedule_end,
                trigger=DateTrigger(run_date=end_dt, timezone=TZ),
                args=[sid],
                id=f'sched_end_{sid}',
                replace_existing=True,
            )
            sched_dict = object_dict(s)
            if s.kind in ('cg', 'cg_content'):
                # Activate CG overlay without interrupting video playout
                self.engine.sync_cg(db)
                self.emit('schedule.triggered', sched_dict)
                self.emit('cg.activated', {'schedule_id': sid, 'kind': s.kind, 'target_id': s.target_id, 'name': s.name})
            else:
                self.engine.tick()
                self.emit('schedule.triggered', sched_dict)
                self.emit('playout.status', self.engine.status.copy())

    def _on_schedule_end(self, schedule_id: int):
        sid = int(schedule_id)
        self.engine.triggered_schedules.discard(sid)
        with SessionLocal() as db:
            s = db.schedule.find_unique(where={'id': sid})
            if not s:
                return
            next_status = 'completed' if s.repeat == 'none' else 'scheduled'
            updated = db.schedule.update(where={'id': sid}, data={'status': next_status})
            sched_dict = object_dict(updated)
            if s.kind in ('cg', 'cg_content'):
                # Deactivate CG overlay without interrupting video playout
                self.engine.sync_cg(db)
                self.emit('cg.deactivated', {'schedule_id': sid, 'kind': s.kind, 'target_id': s.target_id, 'name': s.name})
                self.emit('schedule.updated', sched_dict)
            else:
                self.engine.tick()
                self.emit('schedule.updated', sched_dict)
                self.emit('playout.status', self.engine.status.copy())

