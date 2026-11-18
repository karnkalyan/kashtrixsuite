import React, { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Dynamically computes the 16:9 scale factor relative to a virtual 1920x1080 (16:9) coordinate plane
 * so that overlays render with identical proportions at any 16:9 resolution (360p, 480p, 720p, 1080p, 4K)
 * or inside any preview monitor without forcing 1080p.
 */
export function use16x9Scale(containerRef) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth || 1920;
      setScale(Math.max(0.12, w / 1920));
    };
    update();
    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(update);
      ro.observe(el);
    } else {
      window.addEventListener('resize', update);
    }
    return () => {
      if (ro) ro.disconnect();
      else window.removeEventListener('resize', update);
    };
  }, [containerRef]);

  return scale;
}

/**
 * Splits Devanagari or Latin text into true grapheme clusters (aksharas).
 * Prevents Devanagari combining vowel signs (matras), viramas, and anusvara
 * from splitting away from base consonants during character-by-character animations.
 */
export function getGraphemeClusters(text) {
  if (!text) return [];
  const str = String(text);
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    try {
      const segmenter = new Intl.Segmenter(['ne', 'hi', 'en'], { granularity: 'grapheme' });
      return Array.from(segmenter.segment(str), s => s.segment);
    } catch {}
  }
  // Fallback regex that groups Devanagari base consonants with following matras/viramas/anusvara
  const devanagariGraphemeRegex = /[\u0900-\u097F][\u0901-\u0903\u093C\u093E-\u094F\u0951-\u0957\u0962-\u0963]*|./gu;
  const matches = str.match(devanagariGraphemeRegex);
  return matches || str.split('');
}

/**
 * AnimatedBroadcastText Component:
 * Broadcast graphics text renderer supporting character-based, word-based,
 * typewriter, devanagari-wave, flip-3d, glow-pulse, and slide-in-out animations.
 */
export function AnimatedBroadcastText({
  text = '',
  animation = 'none',
  speed = 1,
  className = '',
  style = {},
  tag = 'span',
  cursor = false
}) {
  const graphemes = useMemo(() => getGraphemeClusters(text), [text]);
  const words = useMemo(() => (text ? String(text).split(/\s+/) : []), [text]);

  const Tag = tag;

  if (!animation || animation === 'none') {
    return <Tag className={`anim-broadcast-text anim-none ${className}`} style={style}>{text}</Tag>;
  }

  if (animation === 'char-scale-in-out') {
    return (
      <Tag className={`anim-broadcast-text anim-char-scale-in-out ${className}`} style={style}>
        {graphemes.map((char, i) => (
          <span
            key={i}
            className="cg-anim-scale-char"
            style={{ animationDelay: `${(i * 0.016) / Math.max(0.5, speed)}s` }}
          >
            {char === ' ' ? '\u00A0' : char}
          </span>
        ))}
      </Tag>
    );
  }

  if (animation === 'word-kinetic') {
    return (
      <Tag className={`anim-broadcast-text anim-word-kinetic ${className}`} style={style}>
        {words.map((word, i) => (
          <span
            key={i}
            className="cg-anim-kinetic-word"
            style={{ animationDelay: `${(i * 0.036) / Math.max(0.5, speed)}s` }}
          >
            {word}{i < words.length - 1 ? '\u00A0' : ''}
          </span>
        ))}
      </Tag>
    );
  }

  if (animation === 'blur-slide-up') {
    return (
      <Tag className={`anim-broadcast-text anim-blur-slide-up ${className}`} style={style}>
        {text}
      </Tag>
    );
  }

  if (animation === 'char-reveal') {
    return (
      <Tag className={`anim-broadcast-text anim-char-reveal ${className}`} style={style}>
        {graphemes.map((char, i) => (
          <span
            key={i}
            className="cg-anim-char"
            style={{ animationDelay: `${(i * 0.038) / Math.max(0.5, speed)}s` }}
          >
            {char === ' ' ? '\u00A0' : char}
          </span>
        ))}
      </Tag>
    );
  }

  if (animation === 'devanagari-wave') {
    return (
      <Tag className={`anim-broadcast-text anim-devanagari-wave ${className}`} style={style}>
        {graphemes.map((char, i) => (
          <span
            key={i}
            className="cg-anim-wave-char"
            style={{ animationDelay: `${(i * 0.045) / Math.max(0.5, speed)}s` }}
          >
            {char === ' ' ? '\u00A0' : char}
          </span>
        ))}
      </Tag>
    );
  }

  if (animation === 'typewriter') {
    return (
      <Tag className={`anim-broadcast-text anim-typewriter ${className}`} style={style}>
        {graphemes.map((char, i) => (
          <span
            key={i}
            className="cg-anim-type-char"
            style={{ animationDelay: `${(i * 0.052) / Math.max(0.5, speed)}s` }}
          >
            {char === ' ' ? '\u00A0' : char}
          </span>
        ))}
        {cursor && <span className="cg-anim-cursor">|</span>}
      </Tag>
    );
  }

  if (animation === 'word-reveal') {
    return (
      <Tag className={`anim-broadcast-text anim-word-reveal ${className}`} style={style}>
        {words.map((word, i) => (
          <span
            key={i}
            className="cg-anim-word"
            style={{ animationDelay: `${(i * 0.055) / Math.max(0.5, speed)}s` }}
          >
            {word}&nbsp;
          </span>
        ))}
      </Tag>
    );
  }

  if (animation === 'flip-3d') {
    return (
      <Tag className={`anim-broadcast-text anim-flip-3d ${className}`} style={style}>
        {words.map((word, i) => (
          <span
            key={i}
            className="cg-anim-flip-word"
            style={{ animationDelay: `${(i * 0.048) / Math.max(0.5, speed)}s` }}
          >
            {word}&nbsp;
          </span>
        ))}
      </Tag>
    );
  }

  if (animation === 'glow-pulse') {
    return (
      <Tag className={`anim-broadcast-text anim-glow-pulse ${className}`} style={style}>
        {text}
      </Tag>
    );
  }

  if (animation === 'slide-in-out') {
    return (
      <Tag className={`anim-broadcast-text anim-slide-in-out ${className}`} style={style}>
        {text}
      </Tag>
    );
  }

  return <Tag className={`anim-broadcast-text anim-${animation} ${className}`} style={style}>{text}</Tag>;
}

/**
 * Splits a layer's text into an array of headlines for cycling,
 * with real-time binding to the Newsroom Editorial CMS API (`/api/cg_content`).
 */
export function extractHeadlines(layer, fallbackList = [], cgContentList = []) {
  // 1. Direct CMS Content Binding by ID
  if (layer?.content_id && Array.isArray(cgContentList)) {
    const bound = cgContentList.find(c => c.id === layer.content_id);
    if (bound && bound.text) {
      const parts = bound.text.split(/[|\n]+/).map(s => s.trim()).filter(Boolean);
      if (parts.length) return parts;
    }
  }

  // 2. Dynamic Category CMS Binding for Published / Approved Stories
  if (layer?.category && Array.isArray(cgContentList) && cgContentList.length > 0 && !layer?.text_locked) {
    const catMap = {
      flash_premium: ['flash', 'breaking', 'ticker'],
      breaking: ['breaking', 'flash'],
      breaking_full: ['breaking'],
      breaking_split: ['breaking'],
      breaking_3win: ['breaking'],
      flash: ['flash', 'breaking'],
      ticker: ['ticker', 'flash'],
      crawl: ['crawl', 'ticker']
    };
    const targetCats = catMap[layer.category] || [layer.category];
    const published = cgContentList.filter(c =>
      targetCats.includes(c.category) && ['published', 'approved', 'live'].includes(c.status)
    );
    if (published.length > 0 && (!layer?.text || layer.text.includes('काष्ट्रिक्स') || layer.text.includes('अपडेट:'))) {
      const cmsHeadlines = published.flatMap(c => {
        const textParts = (c.text || '').split(/[|\n]+/).map(s => s.trim()).filter(Boolean);
        return textParts.length ? textParts : [c.title];
      }).filter(Boolean);
      if (cmsHeadlines.length > 0) return cmsHeadlines;
    }
  }

  // 3. Fallback to layer.text
  const raw = (layer?.text || '').trim();
  if (!raw) return fallbackList.length ? fallbackList : ['काष्ट्रिक्स ब्रोडकास्ट सुइट — प्रत्यक्ष प्रसारण'];
  const parts = raw
    .split(/[|\n]+/)
    .map(s => s.trim())
    .filter(Boolean);
  if (parts.length === 1 && layer?.subtext && !['FLASH NEWS', 'BREAKING NEWS', 'HEADLINES', 'CRAWL', 'ताजा समाचार', 'ब्रेकिङ्ग न्युज'].includes(layer.subtext.trim().toUpperCase())) {
    return [parts[0], layer.subtext.trim()];
  }
  return parts.length ? parts : fallbackList;
}

function toNepaliDigits(input) {
  const map = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
  return String(input).replace(/\d/g, d => map[Number(d)]);
}

/* ============================================================================
 * 1. FLASH NEWS PREMIUM OVERLAY (Extracted from C:\Users\karnk\Downloads\election\index.html)
 *    Bottom `.footer-flash` bar with `--gx-blue-dark`, `--gx-blue-bright`,
 *    authentic Devanagari typography ("ताजा समाचार" with >>> chevrons)
 *    and `.flipper-stack` 3-layer 3D rotateX flip.
 * ============================================================================ */
export function FlashNewsPremiumOverlay({ layer, extraProps = {} }) {
  const wrapRef = useRef(null);
  const scale = use16x9Scale(wrapRef);

  const headlines = useMemo(
    () =>
      extractHeadlines(
        layer,
        [
          'देशभरका प्रमुख सहरहरूमा विशेष सुरक्षा सतर्कता',
          'मतगणनाको ताजा परिणाम सार्वजनिक, मुख्य प्रतिस्पर्धीबीच कडा टक्कर',
          'संसदीय समितिको बैठकद्वारा विशेष आर्थिक प्रस्ताव पारित'
        ],
        extraProps.cgContent
      ),
    [layer?.text, layer?.subtext, layer?.content_id, extraProps.cgContent]
  );

  const [idx, setIdx] = useState(0);
  const [flipPhase, setFlipPhase] = useState('idle'); // 'idle' | 'out' | 'in'

  useEffect(() => {
    setIdx(0);
  }, [headlines.length]);

  useEffect(() => {
    if (headlines.length <= 1) return;
    let t1, t2;
    const interval = setInterval(() => {
      setFlipPhase('out');
      t1 = setTimeout(() => {
        setIdx(prev => (prev + 1) % headlines.length);
        setFlipPhase('in');
      }, 520);
      t2 = setTimeout(() => {
        setFlipPhase('idle');
      }, 1250);
    }, 6000);

    return () => {
      clearInterval(interval);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [headlines]);

  // Authentic Nepali badge title matching user broadcast screenshot
  const titleLabel = useMemo(() => {
    if (layer?.subtext && layer.subtext.trim().length > 0 && !['FLASH NEWS', 'FLASH'].includes(layer.subtext.trim().toUpperCase())) {
      return layer.subtext.trim();
    }
    return 'ताजा समाचार';
  }, [layer?.subtext]);

  const ry = Number(layer?.position_y ?? layer?.ref_y ?? 939);
  const topPct = Math.max(0, Math.min(92.13, (ry / 1080) * 100));

  return (
    <div
      ref={wrapRef}
      className={`cgdemo-16x9-slot flash-news-premium-slot ${extraProps.className || ''}`}
      onMouseDown={extraProps.onMouseDown}
      style={{
        position: 'absolute',
        left: 0,
        top: `${topPct}%`,
        width: '100%',
        height: `${(85 / 1080) * 100}%`,
        zIndex: Number(layer?.z_index || 65) + (extraProps.zBoost || 0),
        opacity: layer?.opacity ?? 1,
        ...extraProps.style
      }}
    >
      {extraProps.headerBadge}
      <div
        className="election-footer-flash"
        style={{
          width: '1920px',
          height: '85px',
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          fontFamily: "'Noto Sans Devanagari', 'Inter', 'Mukta', 'Nirmala UI', sans-serif"
        }}
      >
        <div className="election-flash-title-part">
          <h2 style={{ fontFamily: "'Noto Sans Devanagari', 'Inter', 'Mukta', 'Nirmala UI', sans-serif", letterSpacing: '0.5px' }}>
            {titleLabel}
          </h2>
          <div className="election-arrow-container">
            {[0, 1, 2].map(i => (
              <svg
                key={i}
                className="election-arrow-svg"
                style={{ animationDelay: `${i * 0.15}s` }}
                viewBox="0 0 24 24"
              >
                <path d="M5 5l10 10-10 10" />
              </svg>
            ))}
          </div>
        </div>

        <div className="election-flipper-stack">
          {[0, 1, 2].map(layerIdx => {
            const delayOut = `${layerIdx * 0.1}s`;
            const delayIn = `${(2 - layerIdx) * 0.1}s`;
            return (
              <div
                key={layerIdx}
                className={`election-flip-layer flip-${flipPhase}`}
                style={{
                  transitionDelay: flipPhase === 'out' ? delayOut : flipPhase === 'in' ? delayIn : '0s'
                }}
              >
                {layerIdx === 2 && (
                  <div
                    id="headlineText"
                    className={`election-headline-text text-${flipPhase}`}
                    style={{
                      fontFamily: "'Noto Sans Devanagari', 'Inter', 'Mukta', 'Nirmala UI', sans-serif",
                      fontWeight: 800,
                      fontSize: '32px'
                    }}
                  >
                    <AnimatedBroadcastText
                      text={headlines[idx % headlines.length]}
                      animation={layer?.animation || 'char-reveal'}
                      speed={layer?.speed ? layer.speed / 50 : 1}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {extraProps.resizeHandle}
    </div>
  );
}

/* ============================================================================
 * 2. BREAKING NEWS LOWER-THIRD BAR (cgdemo/breakingnews/index.html)
 *    Diagonal slash intro overlay ("ब्रेकिङ्ग न्युज") -> shrinks to 400px left badge
 *    with pulsing alert dot + character scale wave + blur/clip-path headline transitions.
 * ============================================================================ */
export function CgDemoBreakingBarOverlay({ layer, extraProps = {} }) {
  const wrapRef = useRef(null);
  const scale = use16x9Scale(wrapRef);

  const headlines = useMemo(
    () =>
      extractHeadlines(
        layer,
        [
          'विशेष समाचार अपडेट: काठमाडौँबाट प्रत्यक्ष प्रसारण',
          'संसद बैठकको विशेष निर्णय सार्वजनिक',
          'आर्थिक तथा पूर्वाधार विकाससम्बन्धी उच्चस्तरीय बैठक सम्पन्न'
        ],
        extraProps.cgContent
      ),
    [layer?.text, layer?.subtext, layer?.content_id, extraProps.cgContent]
  );

  const [introState, setIntroState] = useState('enter'); // 'enter' | 'shrink' | 'done'
  const [idx, setIdx] = useState(0);
  const [hlState, setHlState] = useState('active'); // 'active' | 'exit'

  useEffect(() => {
    setIntroState('enter');
    const tShrink = setTimeout(() => setIntroState('shrink'), 1500);
    const tDone = setTimeout(() => setIntroState('done'), 2350);
    return () => {
      clearTimeout(tShrink);
      clearTimeout(tDone);
    };
  }, [layer?.id]);

  useEffect(() => {
    if (headlines.length <= 1) return;
    let tSwap;
    const timer = setInterval(() => {
      setHlState('exit');
      tSwap = setTimeout(() => {
        setIdx(prev => (prev + 1) % headlines.length);
        setHlState('active');
      }, 650);
    }, 5200);
    return () => {
      clearInterval(timer);
      clearTimeout(tSwap);
    };
  }, [headlines]);

  const ry = Number(layer?.position_y ?? layer?.ref_y ?? 938);
  const topPct = Math.max(0, Math.min(92, (ry / 1080) * 100));

  const badgeTitle = useMemo(() => {
    if (layer?.subtext && layer.subtext.trim() && !['BREAKING NEWS', 'BREAKING'].includes(layer.subtext.trim().toUpperCase())) {
      return layer.subtext.trim();
    }
    return 'ब्रेकिङ्ग न्युज';
  }, [layer?.subtext]);

  const titleChars = useMemo(() => getGraphemeClusters(badgeTitle), [badgeTitle]);

  return (
    <div
      ref={wrapRef}
      className={`cgdemo-16x9-slot cgdemo-breaking-bar-slot ${extraProps.className || ''}`}
      onMouseDown={extraProps.onMouseDown}
      style={{
        position: 'absolute',
        left: 0,
        top: `${topPct}%`,
        width: '100%',
        height: `${(86 / 1080) * 100}%`,
        zIndex: Number(layer?.z_index || 55) + (extraProps.zBoost || 0),
        opacity: layer?.opacity ?? 1,
        ...extraProps.style
      }}
    >
      {extraProps.headerBadge}
      <div
        className="cgdemo-bn-bar"
        style={{
          width: '1920px',
          height: '86px',
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          fontFamily: "'Noto Sans Devanagari', 'Inter', 'Mukta', 'Nirmala UI', sans-serif"
        }}
      >
        {introState !== 'done' && (
          <div className={`cgdemo-bn-intro state-${introState}`}>
            <div className="cgdemo-bn-intro-text" style={{ fontFamily: "'Noto Sans Devanagari', 'Inter', 'Mukta', 'Nirmala UI', sans-serif" }}>
              {badgeTitle}
            </div>
          </div>
        )}

        <div className={`cgdemo-bn-compact ${introState === 'done' ? 'show' : ''}`}>
          <span className="cgdemo-bn-alert-dot" />
          <div className="cgdemo-bn-wave-text" style={{ fontFamily: "'Noto Sans Devanagari', 'Inter', 'Mukta', 'Nirmala UI', sans-serif" }}>
            {titleChars.map((ch, i) => (
              <span
                key={i}
                className="cgdemo-bn-char"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                {ch === ' ' ? '\u00A0' : ch}
              </span>
            ))}
          </div>
        </div>

        <div className={`cgdemo-bn-headline-wrap ${introState !== 'enter' ? 'show' : ''}`}>
          <div
            className={`cgdemo-bn-headline ${hlState}`}
            style={{ fontFamily: "'Noto Sans Devanagari', 'Inter', 'Mukta', 'Nirmala UI', sans-serif" }}
          >
            <AnimatedBroadcastText
              text={headlines[idx % headlines.length]}
              animation={layer?.animation || 'char-reveal'}
              speed={layer?.speed ? layer.speed / 50 : 1}
            />
          </div>
        </div>
      </div>
      {extraProps.resizeHandle}
    </div>
  );
}

/* ============================================================================
 * 3. FLASH NEWS BAR (cgdemo/flashnews/index.html)
 *    Purple/Violet 4-panel scaleY intro & repeat overlay, rotating diamond `.spark`,
 *    and left-to-center-to-right headline transition in Nepali Devanagari.
 * ============================================================================ */
export function CgDemoFlashBarOverlay({ layer, extraProps = {} }) {
  const wrapRef = useRef(null);
  const scale = use16x9Scale(wrapRef);

  const headlines = useMemo(
    () =>
      extractHeadlines(
        layer,
        [
          'संसद बैठकको विशेष निर्णय सार्वजनिक',
          'देशभरका प्रमुख सहरहरूको ताजा अपडेट',
          'विशेष बुलेटिन प्रत्यक्ष प्रसारण हुँदै'
        ],
        extraProps.cgContent
      ),
    [layer?.text, layer?.subtext, layer?.content_id, extraProps.cgContent]
  );

  const [introState, setIntroState] = useState('panels'); // 'panels' | 'shrink' | 'done'
  const [idx, setIdx] = useState(0);
  const [hlState, setHlState] = useState('in-center'); // 'from-left' | 'in-center' | 'to-right'

  useEffect(() => {
    setIntroState('panels');
    const t1 = setTimeout(() => setIntroState('shrink'), 1600);
    const t2 = setTimeout(() => setIntroState('done'), 2350);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [layer?.id]);

  useEffect(() => {
    if (headlines.length <= 1) return;
    let t1, t2;
    const timer = setInterval(() => {
      setHlState('to-right');
      t1 = setTimeout(() => {
        setIdx(prev => (prev + 1) % headlines.length);
        setHlState('from-left');
      }, 500);
      t2 = setTimeout(() => {
        setHlState('in-center');
      }, 580);
    }, 5000);
    return () => {
      clearInterval(timer);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [headlines]);

  const ry = Number(layer?.position_y ?? layer?.ref_y ?? 938);
  const topPct = Math.max(0, Math.min(92, (ry / 1080) * 100));

  const badgeTitle = useMemo(() => {
    if (layer?.subtext && layer.subtext.trim() && !['FLASH NEWS', 'FLASH'].includes(layer.subtext.trim().toUpperCase())) {
      return layer.subtext.trim();
    }
    return 'ताजा समाचार';
  }, [layer?.subtext]);

  const flashChars = useMemo(() => getGraphemeClusters(badgeTitle), [badgeTitle]);

  return (
    <div
      ref={wrapRef}
      className={`cgdemo-16x9-slot cgdemo-flash-bar-slot ${extraProps.className || ''}`}
      onMouseDown={extraProps.onMouseDown}
      style={{
        position: 'absolute',
        left: 0,
        top: `${topPct}%`,
        width: '100%',
        height: `${(86 / 1080) * 100}%`,
        zIndex: Number(layer?.z_index || 54) + (extraProps.zBoost || 0),
        opacity: layer?.opacity ?? 1,
        ...extraProps.style
      }}
    >
      {extraProps.headerBadge}
      <div
        className="cgdemo-fn-bar"
        style={{
          width: '1920px',
          height: '86px',
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          fontFamily: "'Noto Sans Devanagari', 'Inter', 'Mukta', 'Nirmala UI', sans-serif"
        }}
      >
        {introState !== 'done' && (
          <div className={`cgdemo-fn-intro state-${introState}`}>
            <div className="cgdemo-fn-panels">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="cgdemo-fn-panel" style={{ animationDelay: `${i * 70}ms` }} />
              ))}
            </div>
            <div className="cgdemo-fn-intro-text" style={{ fontFamily: "'Noto Sans Devanagari', 'Inter', 'Mukta', 'Nirmala UI', sans-serif" }}>
              {badgeTitle}
            </div>
          </div>
        )}

        <div className={`cgdemo-fn-compact ${introState === 'done' ? 'show' : ''}`}>
          <span className="cgdemo-fn-spark" />
          <div className="cgdemo-fn-wave-text" style={{ fontFamily: "'Noto Sans Devanagari', 'Inter', 'Mukta', 'Nirmala UI', sans-serif" }}>
            {flashChars.map((ch, i) => (
              <span key={i} className="cgdemo-bn-char" style={{ animationDelay: `${i * 0.05}s` }}>
                {ch === ' ' ? '\u00A0' : ch}
              </span>
            ))}
          </div>
        </div>

        <div className={`cgdemo-fn-headline-wrap ${introState !== 'panels' ? 'show' : ''}`}>
          <div
            className={`cgdemo-fn-headline ${hlState}`}
            style={{ fontFamily: "'Noto Sans Devanagari', 'Inter', 'Mukta', 'Nirmala UI', sans-serif" }}
          >
            <AnimatedBroadcastText
              text={headlines[idx % headlines.length]}
              animation={layer?.animation || 'word-reveal'}
              speed={layer?.speed ? layer.speed / 50 : 1}
            />
          </div>
        </div>
      </div>
      {extraProps.resizeHandle}
    </div>
  );
}

/* ============================================================================
 * 4. FULL-SCREEN BREAKING NEWS (cgdemo/fullBreaking/index.html)
 *    Full 16:9 stage with big "ताजा अपडेट / ब्रेकिङ्ग न्युज" intro stage
 *    that transitions to `.top-breaking` header + `.story-card` with character/word reveal.
 * ============================================================================ */
export function CgDemoFullBreakingOverlay({ layer, extraProps = {} }) {
  const wrapRef = useRef(null);
  const scale = use16x9Scale(wrapRef);

  const headlines = useMemo(
    () =>
      extractHeadlines(
        layer,
        [
          'राष्ट्रिय सभाको विशेष अधिवेशन आज दिउँसो १ बजे बस्ने, प्रमुख विधेयकहरू प्रस्तुत गरिने',
          'देशभरका प्रमुख राजमार्गहरूमा यातायात सहज बनाउन विशेष कार्यदल परिचालन'
        ],
        extraProps.cgContent
      ),
    [layer?.text, layer?.subtext, layer?.content_id, extraProps.cgContent]
  );

  const [stageMode, setStageMode] = useState('intro'); // 'intro' | 'story'
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setStageMode('intro');
    const t = setTimeout(() => setStageMode('story'), 1800);
    return () => clearTimeout(t);
  }, [layer?.id]);

  useEffect(() => {
    if (headlines.length <= 1) return;
    const timer = setInterval(() => {
      setIdx(prev => (prev + 1) % headlines.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [headlines]);

  const currentStory = headlines[idx % headlines.length] || '';
  const topTitleChars = useMemo(() => getGraphemeClusters('ब्रेकिङ्ग न्युज'), []);

  return (
    <div
      ref={wrapRef}
      className={`cgdemo-16x9-slot cgdemo-full-breaking-slot ${extraProps.className || ''}`}
      onMouseDown={extraProps.onMouseDown}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: Number(layer?.z_index || 75) + (extraProps.zBoost || 0),
        opacity: layer?.opacity ?? 0.98,
        ...extraProps.style
      }}
    >
      {extraProps.headerBadge}
      <div
        className="cgdemo-fb-stage"
        style={{
          width: '1920px',
          height: '1080px',
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          fontFamily: "'Noto Sans Devanagari', 'Inter', 'Mukta', 'Nirmala UI', sans-serif"
        }}
      >
        <div className="cgdemo-fb-bg" />
        <div className="cgdemo-fb-grid" />
        <div className="cgdemo-fb-beam" />
        <div className="cgdemo-fb-beam b2" />

        {stageMode === 'intro' && (
          <div className="cgdemo-fb-intro-stage">
            <div className="cgdemo-fb-kicker">विशेष समाचार अपडेट</div>
            <div className="cgdemo-fb-big-breaking" style={{ fontFamily: "'Noto Sans Devanagari', 'Inter', 'Mukta', 'Nirmala UI', sans-serif" }}>
              <span>ब्रेकिङ्ग</span>
              <span>न्युज</span>
            </div>
          </div>
        )}

        <div className={`cgdemo-fb-top-breaking ${stageMode === 'story' ? 'show' : ''}`}>
          <div className="cgdemo-fb-top-bar">
            <span className="cgdemo-fb-top-text" style={{ fontFamily: "'Noto Sans Devanagari', 'Inter', 'Mukta', 'Nirmala UI', sans-serif" }}>
              {topTitleChars.map((ch, i) => (
                <span key={i} className="cgdemo-fb-top-char" style={{ animationDelay: `${i * 0.04}s` }}>
                  {ch === ' ' ? '\u00A0' : ch}
                </span>
              ))}
            </span>
          </div>
        </div>

        <div className={`cgdemo-fb-story-wrap ${stageMode === 'story' ? 'show' : ''}`}>
          <div className="cgdemo-fb-story-card">
            <div className="cgdemo-fb-story-card-header" />
            <div
              key={idx}
              className="cgdemo-fb-story-text"
              style={{ fontFamily: "'Noto Sans Devanagari', 'Inter', 'Mukta', 'Nirmala UI', sans-serif" }}
            >
              <AnimatedBroadcastText
                text={currentStory}
                animation={layer?.animation || 'word-reveal'}
                speed={layer?.speed ? layer.speed / 50 : 1}
              />
            </div>
          </div>
        </div>
      </div>
      {extraProps.resizeHandle}
    </div>
  );
}

/* ============================================================================
 * 5. SPLIT 2-WINDOW BREAKING NEWS (cgdemo/fullBreakingDouble/index.html)
 *    Left `.story-card` + Right transparent `.anchor-frame` window showing live video
 *    underneath with animated SVG gradient dashed border `#anchorStroke`.
 * ============================================================================ */
export function CgDemoSplitBreakingOverlay({ layer, extraProps = {} }) {
  const wrapRef = useRef(null);
  const scale = use16x9Scale(wrapRef);

  const headlines = useMemo(
    () =>
      extractHeadlines(
        layer,
        [
          'मन्त्रिपरिषद् बैठकका निर्णयहरू सार्वजनिक: पूर्वाधार र ऊर्जा क्षेत्रमा विशेष प्राथमिकता',
          'काठमाडौँ उपत्यकामा स्मार्ट ट्राफिक प्रणाली विस्तार गरिने'
        ],
        extraProps.cgContent
      ),
    [layer?.text, layer?.subtext, layer?.content_id, extraProps.cgContent]
  );

  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (headlines.length <= 1) return;
    const timer = setInterval(() => {
      setIdx(prev => (prev + 1) % headlines.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [headlines]);

  const currentStory = headlines[idx % headlines.length] || '';
  const topTitleChars = useMemo(() => getGraphemeClusters('ब्रेकिङ्ग न्युज • प्रत्यक्ष'), []);

  return (
    <div
      ref={wrapRef}
      className={`cgdemo-16x9-slot cgdemo-split-breaking-slot ${extraProps.className || ''}`}
      onMouseDown={extraProps.onMouseDown}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: Number(layer?.z_index || 76) + (extraProps.zBoost || 0),
        opacity: layer?.opacity ?? 0.98,
        ...extraProps.style
      }}
    >
      {extraProps.headerBadge}
      <div
        className="cgdemo-split-stage"
        style={{
          width: '1920px',
          height: '1080px',
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          fontFamily: "'Noto Sans Devanagari', 'Inter', 'Mukta', 'Nirmala UI', sans-serif"
        }}
      >
        <div className="cgdemo-fb-top-breaking show">
          <div className="cgdemo-fb-top-bar">
            <span className="cgdemo-fb-top-text" style={{ fontFamily: "'Noto Sans Devanagari', 'Inter', 'Mukta', 'Nirmala UI', sans-serif" }}>
              {topTitleChars.map((ch, i) => (
                <span key={i} className="cgdemo-fb-top-char" style={{ animationDelay: `${i * 0.04}s` }}>
                  {ch === ' ' ? '\u00A0' : ch}
                </span>
              ))}
            </span>
          </div>
        </div>

        <div className="cgdemo-split-content">
          {/* Left Story Card */}
          <div className="cgdemo-split-story-card">
            <div className="cgdemo-fb-story-card-header" />
            <div
              key={idx}
              className="cgdemo-split-story-text"
              style={{ fontFamily: "'Noto Sans Devanagari', 'Inter', 'Mukta', 'Nirmala UI', sans-serif" }}
            >
              <AnimatedBroadcastText
                text={currentStory}
                animation={layer?.animation || 'word-reveal'}
                speed={layer?.speed ? layer.speed / 50 : 1}
              />
            </div>
          </div>

          {/* Right Live Anchor Window (Transparent center so live video shows through) */}
          <div className="cgdemo-anchor-frame">
            <div className="cgdemo-window-badge">
              <i /> {layer?.subtext || 'प्रत्यक्ष स्टुडियो • LIVE'}
            </div>
            <svg className="cgdemo-anchor-svg" viewBox="0 0 800 500" preserveAspectRatio="none">
              <defs>
                <linearGradient id="kxStrokeGradSplit" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ff0000" />
                  <stop offset="50%" stopColor="#ffdd00" />
                  <stop offset="100%" stopColor="#ff0000" />
                </linearGradient>
              </defs>
              <rect
                x="4"
                y="4"
                width="792"
                height="492"
                rx="22"
                ry="22"
                fill="none"
                stroke="url(#kxStrokeGradSplit)"
                strokeWidth="8"
                strokeDasharray="1200 1400"
                className="cgdemo-stroke-anim"
              />
            </svg>
          </div>
        </div>
      </div>
      {extraProps.resizeHandle}
    </div>
  );
}

/* ============================================================================
 * 6. 3-WINDOW BREAKING NEWS (cgdemo/3WindowsBreaking/index.html)
 *    Left `.footage-frame` cutout + Center `.story-card` + Right `.anchor-frame` cutout
 * ============================================================================ */
export function CgDemoThreeWindowBreakingOverlay({ layer, extraProps = {} }) {
  const wrapRef = useRef(null);
  const scale = use16x9Scale(wrapRef);

  const headlines = useMemo(
    () =>
      extractHeadlines(
        layer,
        [
          'प्रत्यक्ष रिपोर्टिङ: देशका विभिन्न स्थानबाट विशेष संवाददाताहरूको प्रत्यक्ष अपडेट',
          'मौसम पूर्वानुमान तथा विपद् व्यवस्थापनको ताजा अवस्था'
        ],
        extraProps.cgContent
      ),
    [layer?.text, layer?.subtext, layer?.content_id, extraProps.cgContent]
  );

  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (headlines.length <= 1) return;
    const timer = setInterval(() => {
      setIdx(prev => (prev + 1) % headlines.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [headlines]);

  const currentStory = headlines[idx % headlines.length] || '';
  const topTitleChars = useMemo(() => getGraphemeClusters('ब्रेकिङ्ग न्युज • ३ विन्डो'), []);

  return (
    <div
      ref={wrapRef}
      className={`cgdemo-16x9-slot cgdemo-3win-breaking-slot ${extraProps.className || ''}`}
      onMouseDown={extraProps.onMouseDown}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: Number(layer?.z_index || 77) + (extraProps.zBoost || 0),
        opacity: layer?.opacity ?? 0.98,
        ...extraProps.style
      }}
    >
      {extraProps.headerBadge}
      <div
        className="cgdemo-3win-stage"
        style={{
          width: '1920px',
          height: '1080px',
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          fontFamily: "'Noto Sans Devanagari', 'Inter', 'Mukta', 'Nirmala UI', sans-serif"
        }}
      >
        <div className="cgdemo-fb-top-breaking show">
          <div className="cgdemo-fb-top-bar">
            <span className="cgdemo-fb-top-text" style={{ fontFamily: "'Noto Sans Devanagari', 'Inter', 'Mukta', 'Nirmala UI', sans-serif" }}>
              {topTitleChars.map((ch, i) => (
                <span key={i} className="cgdemo-fb-top-char" style={{ animationDelay: `${i * 0.04}s` }}>
                  {ch === ' ' ? '\u00A0' : ch}
                </span>
              ))}
            </span>
          </div>
        </div>

        <div className="cgdemo-3win-content">
          {/* Window 1: Left Footage Frame */}
          <div className="cgdemo-3win-frame">
            <div className="cgdemo-window-badge"><i /> प्रत्यक्ष दृश्य • LIVE</div>
            <svg className="cgdemo-anchor-svg" viewBox="0 0 560 480" preserveAspectRatio="none">
              <defs>
                <linearGradient id="kxStrokeGrad3W1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ff0000" />
                  <stop offset="50%" stopColor="#ffdd00" />
                  <stop offset="100%" stopColor="#ff0000" />
                </linearGradient>
              </defs>
              <rect
                x="4"
                y="4"
                width="552"
                height="472"
                rx="22"
                ry="22"
                fill="none"
                stroke="url(#kxStrokeGrad3W1)"
                strokeWidth="8"
                strokeDasharray="900 1200"
                className="cgdemo-stroke-anim"
              />
            </svg>
          </div>

          {/* Window 2: Center Story Card */}
          <div className="cgdemo-3win-story-card">
            <div className="cgdemo-fb-story-card-header" />
            <div
              key={idx}
              className="cgdemo-3win-story-text"
              style={{ fontFamily: "'Noto Sans Devanagari', 'Inter', 'Mukta', 'Nirmala UI', sans-serif" }}
            >
              <AnimatedBroadcastText
                text={currentStory}
                animation={layer?.animation || 'word-reveal'}
                speed={layer?.speed ? layer.speed / 50 : 1}
              />
            </div>
          </div>

          {/* Window 3: Right Anchor Frame */}
          <div className="cgdemo-3win-frame">
            <div className="cgdemo-window-badge"><i /> समाचार कक्ष • ANCHOR</div>
            <svg className="cgdemo-anchor-svg" viewBox="0 0 560 480" preserveAspectRatio="none">
              <rect
                x="4"
                y="4"
                width="552"
                height="472"
                rx="22"
                ry="22"
                fill="none"
                stroke="url(#kxStrokeGrad3W1)"
                strokeWidth="8"
                strokeDasharray="900 1200"
                className="cgdemo-stroke-anim"
              />
            </svg>
          </div>
        </div>
      </div>
      {extraProps.resizeHandle}
    </div>
  );
}

/* ============================================================================
 * 7. NEWS TICKER BAR (cgdemo/newsticker/index.html)
 *    Purple-violet-blue gradient bar with character-by-character / word blur-in.
 * ============================================================================ */
export function CgDemoNewsTickerBarOverlay({ layer, extraProps = {} }) {
  const wrapRef = useRef(null);
  const scale = use16x9Scale(wrapRef);

  const headlines = useMemo(
    () =>
      extractHeadlines(
        layer,
        [
          'काष्ट्रिक्स ब्रोडकास्ट सुइट २४/७ अन-एयर प्लेआउट र सीजी स्टुडियो सञ्चालनमा',
          'देशभरका प्रमुख समाचार र ताजा अपडेटहरूको निरन्तर प्रसारण'
        ],
        extraProps.cgContent
      ),
    [layer?.text, layer?.subtext, layer?.content_id, extraProps.cgContent]
  );

  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState('enter'); // 'enter' | 'exit'

  useEffect(() => {
    if (headlines.length <= 1) return;
    let tSwap;
    const timer = setInterval(() => {
      setPhase('exit');
      tSwap = setTimeout(() => {
        setIdx(prev => (prev + 1) % headlines.length);
        setPhase('enter');
      }, 650);
    }, 5200);
    return () => {
      clearInterval(timer);
      clearTimeout(tSwap);
    };
  }, [headlines]);

  const ry = Number(layer?.position_y ?? layer?.ref_y ?? 968);
  const topPct = Math.max(0, Math.min(95, (ry / 1080) * 100));
  const currentText = headlines[idx % headlines.length] || '';

  const tickerBadge = useMemo(() => {
    if (layer?.subtext && layer.subtext.trim() && !['HEADLINES', 'TICKER'].includes(layer.subtext.trim().toUpperCase())) {
      return layer.subtext.trim();
    }
    return 'ताजा हेडलाइन्स';
  }, [layer?.subtext]);

  return (
    <div
      ref={wrapRef}
      className={`cgdemo-16x9-slot cgdemo-newsticker-slot ${extraProps.className || ''}`}
      onMouseDown={extraProps.onMouseDown}
      style={{
        position: 'absolute',
        left: 0,
        top: `${topPct}%`,
        width: '100%',
        height: `${(52 / 1080) * 100}%`,
        zIndex: Number(layer?.z_index || 50) + (extraProps.zBoost || 0),
        opacity: layer?.opacity ?? 0.98,
        ...extraProps.style
      }}
    >
      {extraProps.headerBadge}
      <div
        className="cgdemo-nt-bar"
        style={{
          width: '1920px',
          height: '52px',
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          fontFamily: "'Noto Sans Devanagari', 'Inter', 'Mukta', 'Nirmala UI', sans-serif"
        }}
      >
        <div className="cgdemo-nt-title">
          <span style={{ fontFamily: "'Noto Sans Devanagari', 'Inter', 'Mukta', 'Nirmala UI', sans-serif" }}>{tickerBadge}</span>
          <i className="cgdemo-nt-dot" />
        </div>
        <div className="cgdemo-nt-ticker-container">
          <div
            key={idx}
            className={`cgdemo-nt-headline ${phase}`}
            style={{ fontFamily: "'Noto Sans Devanagari', 'Inter', 'Mukta', 'Nirmala UI', sans-serif" }}
          >
            <AnimatedBroadcastText
              text={currentText}
              animation={layer?.animation || 'char-reveal'}
              speed={layer?.speed ? layer.speed / 50 : 1}
            />
          </div>
        </div>
      </div>
      {extraProps.resizeHandle}
    </div>
  );
}

/* ============================================================================
 * 8. SCROLLING CRAWL BAR WITH NEPALI DATE/TIME SLIDER (cgdemo/scrolling/index.html)
 *    Uses `/cgdemo/scrolling/bg.png` + `/cgdemo/scrolling/logo.png` separator +
 *    left white box with 3-slide Nepali Time / BS Date / Day + smooth rAF crawl.
 * ============================================================================ */
export function CgDemoScrollingCrawlOverlay({ layer, serverTime, extraProps = {} }) {
  const wrapRef = useRef(null);
  const scale = use16x9Scale(wrapRef);
  const [slideIdx, setSlideIdx] = useState(0);
  const [nptTimeStr, setNptTimeStr] = useState('');

  const headlines = useMemo(
    () =>
      extractHeadlines(
        layer,
        [
          'ताजा अपडेट: देशभरका प्रमुख घटनाक्रम, मौसम विवरण र साङ्गीतिक कार्यक्रमहरूको निरन्तर प्रसारण',
          'काठमाडौँ उपत्यकासहित देशका प्रमुख सहरहरूमा विशेष प्रसारण सेवा सञ्चालनमा'
        ],
        extraProps.cgContent
      ),
    [layer?.text, layer?.subtext, layer?.content_id, extraProps.cgContent]
  );

  useEffect(() => {
    const updateClock = () => {
      try {
        const now = new Date();
        const t = now.toLocaleTimeString('en-US', {
          timeZone: 'Asia/Kathmandu',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        });
        setNptTimeStr(toNepaliDigits(t));
      } catch {
        setNptTimeStr('१०:४५:००');
      }
    };
    updateClock();
    const t = setInterval(updateClock, 1000);
    return () => clearInterval(t);
  }, [serverTime]);

  useEffect(() => {
    const t = setInterval(() => {
      setSlideIdx(prev => (prev + 1) % 3);
    }, 3500);
    return () => clearInterval(t);
  }, []);

  const nepaliDays = ['आइतबार', 'सोमबार', 'मंगलबार', 'बुधबार', 'बिहीबार', 'शुक्रबार', 'शनिबार'];
  const dayName = nepaliDays[new Date().getDay()] || 'शुक्रबार';

  const ry = Number(layer?.position_y ?? layer?.ref_y ?? 1020);
  const topPct = Math.max(0, Math.min(94.8, (ry / 1080) * 100));
  const speedSec = Math.max(12, Math.min(60, Math.round(2800 / Math.max(25, Number(layer?.speed || 85)))));

  const repeatedItems = [...headlines, ...headlines, ...headlines];

  return (
    <div
      ref={wrapRef}
      className={`cgdemo-16x9-slot cgdemo-scrolling-slot ${extraProps.className || ''}`}
      onMouseDown={extraProps.onMouseDown}
      style={{
        position: 'absolute',
        left: 0,
        top: `${topPct}%`,
        width: '100%',
        height: `${(56 / 1080) * 100}%`,
        zIndex: Number(layer?.z_index || 52) + (extraProps.zBoost || 0),
        opacity: layer?.opacity ?? 0.99,
        ...extraProps.style
      }}
    >
      {extraProps.headerBadge}
      <div
        className="cgdemo-sc-bar"
        style={{
          width: '1920px',
          height: '56px',
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          backgroundImage: 'url(/cgdemo/scrolling/bg.png)'
        }}
      >
        <div className="cgdemo-sc-left-box">
          <div
            className="cgdemo-sc-slider"
            style={{ transform: `translateY(-${slideIdx * 56}px)` }}
          >
            <div className="cgdemo-sc-slide">
              <div className="cgdemo-sc-title">नेपाली समय</div>
              <div className="cgdemo-sc-sub">{nptTimeStr}</div>
            </div>
            <div className="cgdemo-sc-slide">
              <div className="cgdemo-sc-title">२०८३ कार्तिक</div>
              <div className="cgdemo-sc-sub">नेपाल संवत् ११४७</div>
            </div>
            <div className="cgdemo-sc-slide">
              <div className="cgdemo-sc-day">{dayName}</div>
            </div>
          </div>
        </div>

        <div className="cgdemo-sc-viewport">
          <div
            className="cgdemo-sc-track"
            style={{ animationDuration: `${speedSec}s` }}
          >
            {repeatedItems.map((item, i) => (
              <span key={i} className="cgdemo-sc-item">
                <img
                  src="/cgdemo/scrolling/logo.png"
                  alt=""
                  className="cgdemo-sc-sep-logo"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
                <span>{item}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
      {extraProps.resizeHandle}
    </div>
  );
}

/* ============================================================================
 * 9. PNG SEQUENCE CANVAS PLAYER FOR ANIMATED LOGO (cgdemo/Logo.html)
 *    & ANIMATED LIVE BUG (cgdemo/Live.html)
 * ============================================================================ */
function PngSequenceOverlay({
  layer,
  extraProps = {},
  basePath,
  prefix,
  padDigits,
  totalFrames,
  defaultX,
  defaultY,
  defaultW,
  defaultH,
  fallbackBadgeText
}) {
  const canvasRef = useRef(null);
  const [seqError, setSeqError] = useState(false);

  useEffect(() => {
    let active = true;
    let rafId = null;
    let frameIndex = 0;
    let lastTime = 0;
    const fps = Math.max(12, Math.min(60, Number(layer?.speed || 25)));
    const interval = 1000 / fps;
    const cache = new Map();

    const getFrameSrc = (idx) => {
      const padded = String(idx).padStart(padDigits, '0');
      return `${basePath}/${prefix}${padded}.png`;
    };

    // Preload a stride of frames progressively so playback starts immediately without waiting for all 200+ PNGs
    const preloadFrame = (idx) => {
      if (cache.has(idx)) return cache.get(idx);
      const img = new Image();
      img.src = getFrameSrc(idx);
      cache.set(idx, img);
      return img;
    };

    const firstImg = preloadFrame(0);
    firstImg.onerror = () => {
      if (active) setSeqError(true);
    };

    for (let i = 0; i < Math.min(25, totalFrames); i++) {
      preloadFrame(i);
    }

    const renderLoop = (timestamp) => {
      if (!active) return;
      if (timestamp - lastTime >= interval) {
        lastTime = timestamp;
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          const img = preloadFrame(frameIndex);
          // Preload ahead
          preloadFrame((frameIndex + 10) % totalFrames);
          if (img && img.complete && img.naturalWidth > 0) {
            if (canvas.width !== img.naturalWidth || canvas.height !== img.naturalHeight) {
              canvas.width = img.naturalWidth;
              canvas.height = img.naturalHeight;
            }
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
          }
        }
        frameIndex = (frameIndex + 1) % totalFrames;
      }
      rafId = requestAnimationFrame(renderLoop);
    };

    rafId = requestAnimationFrame(renderLoop);
    return () => {
      active = false;
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [basePath, prefix, padDigits, totalFrames, layer?.speed]);

  const rx = Number(layer?.position_x ?? layer?.ref_x ?? defaultX);
  const ry = Number(layer?.position_y ?? layer?.ref_y ?? defaultY);
  const rw = Number(layer?.width ?? layer?.ref_w ?? defaultW);
  const rh = Number(layer?.height ?? layer?.ref_h ?? defaultH);

  const leftPct = Math.max(0, Math.min(96, (rx / 1920) * 100));
  const topPct = Math.max(0, Math.min(94, (ry / 1080) * 100));
  const widthPct = Math.max(4, Math.min(100 - leftPct, (rw / 1920) * 100));
  const heightPct = Math.max(4, Math.min(100 - topPct, (rh / 1080) * 100));

  return (
    <div
      className={`cgdemo-16x9-slot cgdemo-png-seq-slot ${extraProps.className || ''}`}
      onMouseDown={extraProps.onMouseDown}
      style={{
        position: 'absolute',
        left: `${leftPct}%`,
        top: `${topPct}%`,
        width: `${widthPct}%`,
        height: `${heightPct}%`,
        zIndex: Number(layer?.z_index || 68) + (extraProps.zBoost || 0),
        opacity: layer?.opacity ?? 1,
        ...extraProps.style
      }}
    >
      {extraProps.headerBadge}
      {!seqError ? (
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        />
      ) : (
        <div className="cgdemo-seq-fallback">
          <span>{layer?.text || fallbackBadgeText}</span>
        </div>
      )}
      {extraProps.resizeHandle}
    </div>
  );
}

export function CgDemoAnimatedLogoOverlay({ layer, extraProps = {} }) {
  return (
    <PngSequenceOverlay
      layer={layer}
      extraProps={extraProps}
      basePath="/cgdemo/assets/logo"
      prefix="LOGO ID"
      padDigits={3}
      totalFrames={194}
      defaultX={1615}
      defaultY={10}
      defaultW={255}
      defaultH={170}
      fallbackBadgeText="KASHTRIX HD"
    />
  );
}

export function CgDemoAnimatedLiveBugOverlay({ layer, extraProps = {} }) {
  return (
    <PngSequenceOverlay
      layer={layer}
      extraProps={extraProps}
      basePath="/cgdemo/assets/Live"
      prefix="Comp 1_"
      padDigits={5}
      totalFrames={305}
      defaultX={1665}
      defaultY={142}
      defaultW={200}
      defaultH={133}
      fallbackBadgeText="● LIVE"
    />
  );
}

/* ============================================================================
 * 10. NEPAL WEATHER BROADCAST CAMERA FLYOVER (cgdemo/weather/index.html)
 *     16:9 camera flyover across 11 Nepali cities with animated pan/zoom,
 *     pulsing city pins, weather icons (sunny/cloudy/rain), and temperature cards.
 * ============================================================================ */
const NEPAL_WEATHER_CITIES = [
  { name: 'Dhangadhi', np: 'धनगढी', x: 260, y: 420, temp: '31°C', type: 'sunny', desc: 'सफा मौसम' },
  { name: 'Surkhet', np: 'सुर्खेत', x: 420, y: 460, temp: '27°C', type: 'cloudy', desc: 'आंशिक बदली' },
  { name: 'Jumla', np: 'जुम्ला', x: 520, y: 340, temp: '16°C', type: 'cloudy', desc: 'चिसो हावा' },
  { name: 'Dang', np: 'दाङ', x: 590, y: 540, temp: '29°C', type: 'sunny', desc: 'घमाइलो' },
  { name: 'Pokhara', np: 'पोखरा', x: 860, y: 520, temp: '24°C', type: 'rain', desc: 'हल्का वर्षा' },
  { name: 'Kathmandu', np: 'काठमाडौँ', x: 1120, y: 590, temp: '25°C', type: 'cloudy', desc: 'आंशिक बदली' },
  { name: 'Hetauda', np: 'हेटौँडा', x: 1110, y: 690, temp: '28°C', type: 'sunny', desc: 'सफा मौसम' },
  { name: 'Janakpur', np: 'जनकपुर', x: 1290, y: 790, temp: '32°C', type: 'sunny', desc: 'न्यानो घाम' },
  { name: 'Dharan', np: 'धरान', x: 1510, y: 740, temp: '28°C', type: 'cloudy', desc: 'बदली' },
  { name: 'Birtamod', np: 'बिर्तामोड', x: 1640, y: 790, temp: '30°C', type: 'sunny', desc: 'घमाइलो' },
  { name: 'Kakarbhitta', np: 'काँकरभिट्टा', x: 1710, y: 780, temp: '30°C', type: 'rain', desc: 'छिटपुट वर्षा' }
];

export function CgDemoWeatherCameraOverlay({ layer, extraProps = {} }) {
  const wrapRef = useRef(null);
  const scale = use16x9Scale(wrapRef);
  const [focusIdx, setFocusIdx] = useState(-1); // -1 = full Nepal overview, 0..10 = city zoom

  useEffect(() => {
    const timer = setInterval(() => {
      setFocusIdx(prev => (prev + 2 > NEPAL_WEATHER_CITIES.length ? -1 : prev + 1));
    }, 3200);
    return () => clearInterval(timer);
  }, []);

  const activeCity = focusIdx >= 0 && focusIdx < NEPAL_WEATHER_CITIES.length ? NEPAL_WEATHER_CITIES[focusIdx] : null;

  const worldTransform = useMemo(() => {
    if (!activeCity) {
      return 'translate3d(0px, 0px, 0px) scale(1)';
    }
    const z = 1.65;
    const tx = 960 - activeCity.x * z;
    const ty = 540 - activeCity.y * z;
    return `translate3d(${tx}px, ${ty}px, 0px) scale(${z})`;
  }, [activeCity]);

  return (
    <div
      ref={wrapRef}
      className={`cgdemo-16x9-slot cgdemo-weather-slot ${extraProps.className || ''}`}
      onMouseDown={extraProps.onMouseDown}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: Number(layer?.z_index || 74) + (extraProps.zBoost || 0),
        opacity: layer?.opacity ?? 0.98,
        ...extraProps.style
      }}
    >
      {extraProps.headerBadge}
      <div
        className="cgdemo-wx-viewport"
        style={{
          width: '1920px',
          height: '1080px',
          transform: `scale(${scale})`,
          transformOrigin: 'top left'
        }}
      >
        {/* Top Broadcast Weather Header */}
        <div className="cgdemo-wx-header">
          <div className="cgdemo-wx-badge">NEPAL METEOROLOGICAL BROADCAST</div>
          <h2>{layer?.text || 'नेपाल मौसम विवरण • NEPAL WEATHER CAMERA'}</h2>
          <div className="cgdemo-wx-focus-pill">
            {activeCity ? `${activeCity.np} (${activeCity.name}) — ${activeCity.temp} • ${activeCity.desc}` : 'देशभरको समग्र मौसम अवस्था (All 11 Stations)'}
          </div>
        </div>

        {/* Camera World */}
        <div className="cgdemo-wx-world" style={{ transform: worldTransform }}>
          {/* Stylized Nepal Contour SVG Silhouette */}
          <svg className="cgdemo-wx-nepal-svg" viewBox="0 0 1920 1080">
            <defs>
              <linearGradient id="kxNepalMapGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(14, 116, 144, 0.55)" />
                <stop offset="50%" stopColor="rgba(30, 58, 138, 0.65)" />
                <stop offset="100%" stopColor="rgba(88, 28, 135, 0.55)" />
              </linearGradient>
            </defs>
            <path
              d="M170,360 L340,260 L580,250 L820,350 L1100,430 L1380,530 L1660,620 L1770,750 L1690,850 L1350,860 L1020,760 L720,670 L420,580 L190,480 Z"
              fill="url(#kxNepalMapGrad)"
              stroke="#38bdf8"
              strokeWidth="4"
            />
          </svg>

          {NEPAL_WEATHER_CITIES.map((c, i) => {
            const isFocused = i === focusIdx;
            return (
              <div
                key={c.name}
                className={`cgdemo-wx-node ${isFocused ? 'focused' : ''}`}
                style={{ left: `${c.x}px`, top: `${c.y}px` }}
              >
                <div className="cgdemo-wx-pin" />
                <div className="cgdemo-wx-card">
                  <div className={`cgdemo-wx-icon ${c.type}`}>
                    {c.type === 'sunny' ? '☀' : c.type === 'rain' ? '🌧' : '⛅'}
                  </div>
                  <div className="cgdemo-wx-info">
                    <span className="cgdemo-wx-cname">{c.np}</span>
                    <span className="cgdemo-wx-temp">{c.temp}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {extraProps.resizeHandle}
    </div>
  );
}

/* ============================================================================
 * 11. HEBRON TV COMPLETE CHANNEL BRANDING DEMO PACK
 *     Uses /cgdemo/hebron/Liquid-glass HEBRON TV logo.png across:
 *     - HebronLogoBugOverlay (Liquid-Glass Top-Right Channel Bug)
 *     - HebronBreakingBarOverlay (Hebron Breaking News Lower Third)
 *     - HebronFlashBarOverlay (Hebron Flash News 3D Flip Bar)
 *     - HebronCrawlBarOverlay (Hebron Continuous Bottom News Crawl)
 *     - HebronTickerBarOverlay (Hebron Headline Ticker)
 * ============================================================================ */
const HEBRON_LOGO_SRC = '/cgdemo/hebron/Liquid-glass%20HEBRON%20TV%20logo.png';

export function HebronLogoBugOverlay({ layer, extraProps = {} }) {
  const rx = Number(layer?.position_x ?? layer?.ref_x ?? 1620);
  const ry = Number(layer?.position_y ?? layer?.ref_y ?? 26);
  const rw = Number(layer?.width ?? layer?.ref_w ?? 220);
  const rh = Number(layer?.height ?? layer?.ref_h ?? 110);

  const leftPct = Math.max(0, Math.min(92, (rx / 1920) * 100));
  const topPct = Math.max(0, Math.min(92, (ry / 1080) * 100));
  const widthPct = Math.max(4, Math.min(100 - leftPct, (rw / 1920) * 100));
  const heightPct = Math.max(4, Math.min(100 - topPct, (rh / 1080) * 100));

  return (
    <div
      className={`cgdemo-16x9-slot hebron-logo-slot ${extraProps.className || ''}`}
      onMouseDown={extraProps.onMouseDown}
      style={{
        position: 'absolute',
        left: `${leftPct}%`,
        top: `${topPct}%`,
        width: `${widthPct}%`,
        height: `${heightPct}%`,
        zIndex: Number(layer?.z_index || 72) + (extraProps.zBoost || 0),
        opacity: layer?.opacity ?? 1,
        background: 'transparent',
        border: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...extraProps.style
      }}
    >
      {extraProps.headerBadge}
      <img
        src={HEBRON_LOGO_SRC}
        alt="Hebron TV"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          display: 'block',
          filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.5))',
          pointerEvents: 'none'
        }}
      />
      {extraProps.resizeHandle}
    </div>
  );
}

export function HebronBreakingBarOverlay({ layer, extraProps = {} }) {
  const wrapRef = useRef(null);
  const scale = use16x9Scale(wrapRef);

  const headlines = useMemo(
    () =>
      extractHeadlines(
        layer,
        [
          'HEBRON TV SPECIAL REPORT: Live Global & National Coverage From Our Studio Desk',
          'Parliament Session Convenes With Key Economic & Infrastructure Bills',
          'Hebron Exclusive: Regional Summit Announces Clean Energy & Connectivity Pact'
        ],
        extraProps.cgContent
      ),
    [layer?.text, layer?.subtext, layer?.content_id, extraProps.cgContent]
  );

  const [idx, setIdx] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [phase, setPhase] = useState('in');

  useEffect(() => {
    setIdx(0);
  }, [headlines.length]);

  useEffect(() => {
    let tSwap;
    const interval = setInterval(() => {
      setPhase('out');
      tSwap = setTimeout(() => {
        setIdx(prev => (headlines.length > 1 ? (prev + 1) % headlines.length : 0));
        setCycle(c => c + 1);
        setPhase('in');
      }, 360);
    }, 4800);
    return () => {
      clearInterval(interval);
      clearTimeout(tSwap);
    };
  }, [headlines]);

  const ry = Number(layer?.position_y ?? layer?.ref_y ?? 912);
  const topPct = Math.max(0, Math.min(92, (ry / 1080) * 100));

  return (
    <div
      ref={wrapRef}
      className={`cgdemo-16x9-slot hebron-breaking-slot ${extraProps.className || ''}`}
      onMouseDown={extraProps.onMouseDown}
      style={{
        position: 'absolute',
        left: 0,
        top: `${topPct}%`,
        width: '100%',
        height: `${(92 / 1080) * 100}%`,
        zIndex: Number(layer?.z_index || 66) + (extraProps.zBoost || 0),
        opacity: layer?.opacity ?? 0.98,
        ...extraProps.style
      }}
    >
      {extraProps.headerBadge}
      <div
        className="hebron-breaking-bar modern-kinetic"
        style={{
          width: '1920px',
          height: '92px',
          transform: `scale(${scale})`,
          transformOrigin: 'top left'
        }}
      >
        <div className="hebron-breaking-badge">
          <span className="hebron-pulse-dot" />
          <span>{layer?.subtext || 'BREAKING NEWS'}</span>
        </div>
        <div className={`hebron-breaking-headline phase-${phase}`}>
          <AnimatedBroadcastText
            key={`${idx}-${cycle}`}
            text={headlines[idx % headlines.length]}
            animation={layer?.animation && layer.animation !== 'slide' ? layer.animation : 'char-scale-in-out'}
            speed={layer?.speed ? Math.max(1.2, layer.speed / 45) : 1.35}
          />
        </div>
        <div className="hebron-desk-tag">NEWS DESK</div>
      </div>
      {extraProps.resizeHandle}
    </div>
  );
}

export function HebronFlashBarOverlay({ layer, extraProps = {} }) {
  const wrapRef = useRef(null);
  const scale = use16x9Scale(wrapRef);

  const headlines = useMemo(
    () =>
      extractHeadlines(
        layer,
        [
          'HEBRON FLASH: High-Level Summit Announces Regional Connectivity & Clean Energy Pact',
          'Major Markets Rally Ahead of Quarterly Policy Review',
          'National Innovation & Broadcast Forum Opens Live Coverage on Hebron TV'
        ],
        extraProps.cgContent
      ),
    [layer?.text, layer?.subtext, layer?.content_id, extraProps.cgContent]
  );

  const [idx, setIdx] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [flipPhase, setFlipPhase] = useState('idle');

  useEffect(() => {
    setIdx(0);
  }, [headlines.length]);

  useEffect(() => {
    let t1, t2;
    const interval = setInterval(() => {
      setFlipPhase('out');
      t1 = setTimeout(() => {
        setIdx(prev => (headlines.length > 1 ? (prev + 1) % headlines.length : 0));
        setCycle(c => c + 1);
        setFlipPhase('in');
      }, 380);
      t2 = setTimeout(() => setFlipPhase('idle'), 950);
    }, 5200);
    return () => {
      clearInterval(interval);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [headlines]);

  const ry = Number(layer?.position_y ?? layer?.ref_y ?? 916);
  const topPct = Math.max(0, Math.min(92, (ry / 1080) * 100));

  return (
    <div
      ref={wrapRef}
      className={`cgdemo-16x9-slot hebron-flash-slot ${extraProps.className || ''}`}
      onMouseDown={extraProps.onMouseDown}
      style={{
        position: 'absolute',
        left: 0,
        top: `${topPct}%`,
        width: '100%',
        height: `${(86 / 1080) * 100}%`,
        zIndex: Number(layer?.z_index || 65) + (extraProps.zBoost || 0),
        opacity: layer?.opacity ?? 0.98,
        ...extraProps.style
      }}
    >
      {extraProps.headerBadge}
      <div
        className="hebron-flash-bar modern-flash"
        style={{
          width: '1920px',
          height: '86px',
          transform: `scale(${scale})`,
          transformOrigin: 'top left'
        }}
      >
        <div className="hebron-flash-brand no-logo">
          <div className="hebron-flash-label">
            <span>⚡ {layer?.subtext || 'FLASH NEWS'}</span>
            <div className="hebron-chevrons">
              <i>›</i><i>›</i><i>›</i>
            </div>
          </div>
        </div>
        <div className={`hebron-flash-stage flip-${flipPhase}`}>
          <AnimatedBroadcastText
            key={`${idx}-${cycle}`}
            text={headlines[idx % headlines.length]}
            animation={layer?.animation && layer.animation !== 'slide' ? layer.animation : 'char-scale-in-out'}
            speed={layer?.speed ? Math.max(1.2, layer.speed / 45) : 1.35}
          />
        </div>
      </div>
      {extraProps.resizeHandle}
    </div>
  );
}

export function HebronCrawlBarOverlay({ layer, serverTime, extraProps = {} }) {
  const wrapRef = useRef(null);
  const scale = use16x9Scale(wrapRef);

  const headlines = useMemo(
    () =>
      extractHeadlines(
        layer,
        [
          'WELCOME TO HEBRON TV HD',
          '24/7 NEWS, FAITH, CULTURE & LIVE STUDIO PROGRAMMING',
          'STAY TUNED FOR EVENING PRIME BULLETIN AT 8:00 PM',
          'WATCH LIVE ON CABLE, SATELLITE & DIGITAL PLATFORMS'
        ],
        extraProps.cgContent
      ),
    [layer?.text, layer?.subtext, layer?.content_id, extraProps.cgContent]
  );

  const joinedText = headlines.join('   ◆   ');
  const speedSec = Math.max(12, Math.min(48, Math.round(32 - ((Number(layer?.speed || 95) - 50) * 0.22))));
  const timeStr = useMemo(() => {
    try {
      const dt = serverTime ? new Date(serverTime) : new Date();
      return dt.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kathmandu', hour: '2-digit', minute: '2-digit', hour12: false });
    } catch {
      return '21:50';
    }
  }, [serverTime]);

  const ry = Number(layer?.position_y ?? layer?.ref_y ?? 1026);
  const topPct = Math.max(0, Math.min(95.5, (ry / 1080) * 100));

  return (
    <div
      ref={wrapRef}
      className={`cgdemo-16x9-slot hebron-crawl-slot ${extraProps.className || ''}`}
      onMouseDown={extraProps.onMouseDown}
      style={{
        position: 'absolute',
        left: 0,
        top: `${topPct}%`,
        width: '100%',
        height: `${(48 / 1080) * 100}%`,
        zIndex: Number(layer?.z_index || 70) + (extraProps.zBoost || 0),
        opacity: layer?.opacity ?? 0.98,
        ...extraProps.style
      }}
    >
      {extraProps.headerBadge}
      <div
        className="hebron-crawl-bar"
        style={{
          width: '1920px',
          height: '48px',
          transform: `scale(${scale})`,
          transformOrigin: 'top left'
        }}
      >
        <div className="hebron-crawl-brand-pill">
          <span>{layer?.subtext || 'HEBRON TV'}</span>
        </div>
        <div className="hebron-crawl-track">
          <div className="hebron-crawl-marquee" style={{ animationDuration: `${speedSec}s` }}>
            <span>{joinedText}   ◆   {joinedText}   ◆   </span>
          </div>
        </div>
        <div className="hebron-crawl-clock">
          <span>LIVE</span>
          <strong>{timeStr}</strong>
        </div>
      </div>
      {extraProps.resizeHandle}
    </div>
  );
}

export function HebronTickerBarOverlay({ layer, extraProps = {} }) {
  const wrapRef = useRef(null);
  const scale = use16x9Scale(wrapRef);

  const headlines = useMemo(
    () =>
      extractHeadlines(
        layer,
        [
          'HEBRON NEWS DESK: National Infrastructure Corridor Enters Final Phase',
          'Tech & Innovation Forum Opens Tomorrow With International Delegates',
          'Weather Forecast: Clear Skies Across Major Valleys & Foothills'
        ],
        extraProps.cgContent
      ),
    [layer?.text, layer?.subtext, layer?.content_id, extraProps.cgContent]
  );

  const [idx, setIdx] = useState(0);
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    const t = setInterval(() => {
      setIdx(p => (headlines.length > 1 ? (p + 1) % headlines.length : 0));
      setCycle(c => c + 1);
    }, 4400);
    return () => clearInterval(t);
  }, [headlines.length]);

  const ry = Number(layer?.position_y ?? layer?.ref_y ?? 972);
  const topPct = Math.max(0, Math.min(94, (ry / 1080) * 100));

  return (
    <div
      ref={wrapRef}
      className={`cgdemo-16x9-slot hebron-ticker-slot ${extraProps.className || ''}`}
      onMouseDown={extraProps.onMouseDown}
      style={{
        position: 'absolute',
        left: 0,
        top: `${topPct}%`,
        width: '100%',
        height: `${(52 / 1080) * 100}%`,
        zIndex: Number(layer?.z_index || 69) + (extraProps.zBoost || 0),
        opacity: layer?.opacity ?? 0.97,
        ...extraProps.style
      }}
    >
      {extraProps.headerBadge}
      <div
        className="hebron-ticker-bar modern-ticker"
        style={{
          width: '1920px',
          height: '52px',
          transform: `scale(${scale})`,
          transformOrigin: 'top left'
        }}
      >
        <div className="hebron-ticker-badge no-logo">
          <span className="hebron-pulse-dot" />
          <span>{layer?.subtext || 'HEADLINES'}</span>
        </div>
        <div className="hebron-ticker-text">
          <AnimatedBroadcastText
            key={`${idx}-${cycle}`}
            text={headlines[idx % headlines.length]}
            animation={layer?.animation && layer.animation !== 'slide' ? layer.animation : 'blur-slide-up'}
            speed={1.2}
          />
        </div>
      </div>
      {extraProps.resizeHandle}
    </div>
  );
}

/**
 * Dispatcher that returns the specialized React CG Overlay component when a layer
 * matches one of the CG Demo / Flash News Premium / Hebron TV categories, or null if it should
 * use the standard customizable CG box renderer.
 */
export function renderSpecializedCgDemoComponent(layer, serverTime, extraProps = {}) {
  if (!layer || layer.animation === 'custom-box') return null;

  switch (layer.category) {
    case 'flash_premium':
      return <FlashNewsPremiumOverlay key={layer.id || 'flash_premium'} layer={layer} extraProps={extraProps} />;
    case 'breaking':
      return <CgDemoBreakingBarOverlay key={layer.id || 'breaking'} layer={layer} extraProps={extraProps} />;
    case 'flash':
      return <CgDemoFlashBarOverlay key={layer.id || 'flash'} layer={layer} extraProps={extraProps} />;
    case 'breaking_full':
      return <CgDemoFullBreakingOverlay key={layer.id || 'breaking_full'} layer={layer} extraProps={extraProps} />;
    case 'breaking_split':
      return <CgDemoSplitBreakingOverlay key={layer.id || 'breaking_split'} layer={layer} extraProps={extraProps} />;
    case 'breaking_3win':
      return <CgDemoThreeWindowBreakingOverlay key={layer.id || 'breaking_3win'} layer={layer} extraProps={extraProps} />;
    case 'ticker':
      return <CgDemoNewsTickerBarOverlay key={layer.id || 'ticker'} layer={layer} extraProps={extraProps} />;
    case 'crawl':
      return <CgDemoScrollingCrawlOverlay key={layer.id || 'crawl'} layer={layer} serverTime={serverTime} extraProps={extraProps} />;
    case 'logo_anim':
      return <CgDemoAnimatedLogoOverlay key={layer.id || 'logo_anim'} layer={layer} extraProps={extraProps} />;
    case 'live_anim':
      return <CgDemoAnimatedLiveBugOverlay key={layer.id || 'live_anim'} layer={layer} extraProps={extraProps} />;
    case 'weather_map':
      return <CgDemoWeatherCameraOverlay key={layer.id || 'weather_map'} layer={layer} extraProps={extraProps} />;
    case 'hebron_logo':
      return <HebronLogoBugOverlay key={layer.id || 'hebron_logo'} layer={layer} extraProps={extraProps} />;
    case 'hebron_breaking':
      return <HebronBreakingBarOverlay key={layer.id || 'hebron_breaking'} layer={layer} extraProps={extraProps} />;
    case 'hebron_flash':
      return <HebronFlashBarOverlay key={layer.id || 'hebron_flash'} layer={layer} extraProps={extraProps} />;
    case 'hebron_crawl':
      return <HebronCrawlBarOverlay key={layer.id || 'hebron_crawl'} layer={layer} serverTime={serverTime} extraProps={extraProps} />;
    case 'hebron_ticker':
      return <HebronTickerBarOverlay key={layer.id || 'hebron_ticker'} layer={layer} extraProps={extraProps} />;
    default:
      return null;
  }
}

