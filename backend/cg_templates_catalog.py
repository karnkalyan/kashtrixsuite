"""20 Built-in Animated Broadcast CG Templates, Collision Prevention, and Music/Programme Auto-CG Engine."""
import json
from datetime import datetime, timedelta

BUILTIN_20_TEMPLATES = [
    {
        'template_key': 'music_now_playing_minimal',
        'name': '1. Music Now Playing — Minimal',
        'category': 'music_now',
        'animation': 'slide-up',
        'accent': '#e11d72',
        'bg_color': '#120924',
        'text_color': '#ffffff',
        'gradient': 'linear-gradient(90deg, rgba(18,9,36,0.94) 0%, rgba(42,16,68,0.88) 100%)',
        'font_family': 'Nirmala UI, Noto Sans Devanagari, Inter, sans-serif',
        'font_size': 30,
        'font_weight': '700',
        'text_align': 'left',
        'position_x': 56,
        'position_y': 815,
        'width': 680,
        'height': 132,
        'z_index': 25,
        'opacity': 0.94,
        'border_radius': 10,
        'border_width': 2,
        'border_color': '#e11d72',
        'shadow': '0 10px 28px rgba(0,0,0,0.55)',
        'zone': 'lower-left',
        'priority': 65,
        'speed': 90,
        'enter_transition': 'slide-up',
        'exit_transition': 'fade-out',
        'anim_duration_ms': 450,
        'sample_text': 'NOW PLAYING • सम्झनाको फूल',
        'sample_subtext': 'Artist: स्वरुप राज आचार्य  |  Album: आधुनिक संग्रह',
    },
    {
        'template_key': 'music_now_playing_gradient',
        'name': '2. Music Now Playing — Premium Gradient',
        'category': 'music_now',
        'animation': 'slide-left',
        'accent': '#ff2e93',
        'bg_color': '#1b0c38',
        'text_color': '#ffffff',
        'gradient': 'linear-gradient(135deg, #1b0c38 0%, #4a0e4e 55%, #e11d72 100%)',
        'font_family': 'Nirmala UI, Noto Sans Devanagari, Inter, sans-serif',
        'font_size': 32,
        'font_weight': '800',
        'text_align': 'left',
        'position_x': 60,
        'position_y': 805,
        'width': 760,
        'height': 155,
        'z_index': 26,
        'opacity': 0.96,
        'border_radius': 14,
        'border_width': 2,
        'border_color': '#ff6ec7',
        'shadow': '0 14px 36px rgba(225,29,114,0.42)',
        'zone': 'lower-left',
        'priority': 68,
        'speed': 95,
        'enter_transition': 'slide-left',
        'exit_transition': 'slide-down',
        'anim_duration_ms': 500,
        'sample_text': 'NOW PLAYING  •  सम्झनाको फूल (Samjhana Ko Phool)',
        'sample_subtext': 'Artist: Example Singer  •  Album: Example Album',
    },
    {
        'template_key': 'music_now_playing_album',
        'name': '3. Music Now Playing — Album Art',
        'category': 'music_now',
        'animation': 'zoom-in',
        'accent': '#a855f7',
        'bg_color': '#150d2a',
        'text_color': '#ffffff',
        'gradient': 'linear-gradient(135deg, #150d2a 0%, #2e1065 65%, #be185d 100%)',
        'font_family': 'Nirmala UI, Noto Sans Devanagari, Inter, sans-serif',
        'font_size': 30,
        'font_weight': '700',
        'text_align': 'left',
        'position_x': 60,
        'position_y': 785,
        'width': 800,
        'height': 170,
        'z_index': 27,
        'opacity': 0.96,
        'border_radius': 16,
        'border_width': 2,
        'border_color': '#a855f7',
        'shadow': '0 16px 40px rgba(88,28,135,0.55)',
        'zone': 'lower-left',
        'priority': 67,
        'speed': 90,
        'enter_transition': 'zoom-in',
        'exit_transition': 'fade-out',
        'anim_duration_ms': 480,
        'sample_text': '♫ सम्झनाको फूल — NOW PLAYING',
        'sample_subtext': 'Singer: Example Singer  |  Album: Example Album  |  Label: Kashtrix Music',
    },
    {
        'template_key': 'song_credits_details',
        'name': '4. Song Credits / Artist Details',
        'category': 'music_credits',
        'animation': 'slide-up',
        'accent': '#c084fc',
        'bg_color': '#140b29',
        'text_color': '#f8fafc',
        'gradient': 'linear-gradient(120deg, #140b29 0%, #3b0764 70%, #831843 100%)',
        'font_family': 'Nirmala UI, Noto Sans Devanagari, Inter, sans-serif',
        'font_size': 27,
        'font_weight': '600',
        'text_align': 'left',
        'position_x': 60,
        'position_y': 635,
        'width': 780,
        'height': 155,
        'z_index': 24,
        'opacity': 0.94,
        'border_radius': 12,
        'border_width': 2,
        'border_color': '#c084fc',
        'shadow': '0 12px 30px rgba(0,0,0,0.5)',
        'zone': 'lower-left',
        'priority': 62,
        'speed': 85,
        'enter_transition': 'slide-up',
        'exit_transition': 'fade-out',
        'anim_duration_ms': 450,
        'sample_text': 'SONG CREDITS • सम्झनाको फूल (२०८३)',
        'sample_subtext': 'Music: काली प्रसाद बास्कोटा  •  Lyrics: हर्क साउद  •  Label: Kashtrix Records',
    },
    {
        'template_key': 'programme_now_showing',
        'name': '5. Programme Now Showing',
        'category': 'program_info',
        'animation': 'slide-left',
        'accent': '#e11d72',
        'bg_color': '#180c2e',
        'text_color': '#ffffff',
        'gradient': 'linear-gradient(135deg, #180c2e 0%, #4c1d95 100%)',
        'font_family': 'Nirmala UI, Noto Sans Devanagari, Inter, sans-serif',
        'font_size': 28,
        'font_weight': '700',
        'text_align': 'left',
        'position_x': 1220,
        'position_y': 125,
        'width': 640,
        'height': 115,
        'z_index': 28,
        'opacity': 0.94,
        'border_radius': 12,
        'border_width': 2,
        'border_color': '#e11d72',
        'shadow': '0 10px 28px rgba(0,0,0,0.5)',
        'zone': 'top-right',
        'priority': 60,
        'speed': 90,
        'enter_transition': 'slide-left',
        'exit_transition': 'fade-out',
        'anim_duration_ms': 420,
        'sample_text': 'NOW SHOWING: साँझ समाचार',
        'sample_subtext': 'मुख्य समाचार बुलेटिन — प्रत्यक्ष प्रसारण',
    },
    {
        'template_key': 'programme_now_next',
        'name': '6. Programme Now / Next',
        'category': 'now_next',
        'animation': 'slide-left',
        'accent': '#f43f5e',
        'bg_color': '#170d2b',
        'text_color': '#ffffff',
        'gradient': 'linear-gradient(135deg, #170d2b 0%, #581c87 60%, #e11d72 100%)',
        'font_family': 'Nirmala UI, Noto Sans Devanagari, Inter, sans-serif',
        'font_size': 27,
        'font_weight': '700',
        'text_align': 'left',
        'position_x': 1180,
        'position_y': 250,
        'width': 680,
        'height': 135,
        'z_index': 29,
        'opacity': 0.95,
        'border_radius': 12,
        'border_width': 2,
        'border_color': '#f43f5e',
        'shadow': '0 12px 32px rgba(0,0,0,0.55)',
        'zone': 'middle-right',
        'priority': 64,
        'speed': 90,
        'enter_transition': 'slide-left',
        'exit_transition': 'fade-out',
        'anim_duration_ms': 450,
        'sample_text': 'NOW SHOWING: साँझ समाचार',
        'sample_subtext': 'NEXT: विशेष संवाद — ८:०० बजे',
    },
    {
        'template_key': 'breaking_news_strap',
        'name': '7. Breaking News',
        'category': 'breaking',
        'animation': 'pulse-slide',
        'accent': '#dc2626',
        'bg_color': '#7f1d1d',
        'text_color': '#ffffff',
        'gradient': 'linear-gradient(90deg, #dc2626 0%, #991b1b 60%, #1f0933 100%)',
        'font_family': 'Nirmala UI, Noto Sans Devanagari, Inter, sans-serif',
        'font_size': 42,
        'font_weight': '900',
        'text_align': 'left',
        'position_x': 40,
        'position_y': 760,
        'width': 1320,
        'height': 135,
        'z_index': 45,
        'opacity': 0.98,
        'border_radius': 10,
        'border_width': 3,
        'border_color': '#fca5a5',
        'shadow': '0 16px 42px rgba(220,38,38,0.55)',
        'zone': 'lower-third',
        'priority': 95,
        'speed': 115,
        'enter_transition': 'slide-left',
        'exit_transition': 'slide-down',
        'anim_duration_ms': 380,
        'sample_text': 'BREAKING NEWS • विशेष समाचार अपडेट',
        'sample_subtext': 'काठमाडौँबाट प्रत्यक्ष प्रसारण — विस्तृत विवरण आउँदै',
    },
    {
        'template_key': 'flash_news_alert',
        'name': '8. Flash News',
        'category': 'flash',
        'animation': 'flash-in',
        'accent': '#f97316',
        'bg_color': '#431407',
        'text_color': '#ffffff',
        'gradient': 'linear-gradient(90deg, #ea580c 0%, #be123c 100%)',
        'font_family': 'Nirmala UI, Noto Sans Devanagari, Inter, sans-serif',
        'font_size': 35,
        'font_weight': '800',
        'text_align': 'left',
        'position_x': 40,
        'position_y': 680,
        'width': 1050,
        'height': 110,
        'z_index': 40,
        'opacity': 0.96,
        'border_radius': 10,
        'border_width': 2,
        'border_color': '#fdba74',
        'shadow': '0 12px 30px rgba(234,88,12,0.45)',
        'zone': 'lower-third',
        'priority': 88,
        'speed': 105,
        'enter_transition': 'zoom-in',
        'exit_transition': 'fade-out',
        'anim_duration_ms': 350,
        'sample_text': 'FLASH NEWS • ताजा अपडेट',
        'sample_subtext': 'संसद बैठकको विशेष निर्णय सार्वजनिक',
    },
    {
        'template_key': 'news_updates_banner',
        'name': '9. News Updates',
        'category': 'update',
        'animation': 'slide-left',
        'accent': '#a855f7',
        'bg_color': '#1e1035',
        'text_color': '#ffffff',
        'gradient': 'linear-gradient(90deg, #3b0764 0%, #6b21a8 100%)',
        'font_family': 'Nirmala UI, Noto Sans Devanagari, Inter, sans-serif',
        'font_size': 31,
        'font_weight': '700',
        'text_align': 'left',
        'position_x': 40,
        'position_y': 610,
        'width': 960,
        'height': 105,
        'z_index': 32,
        'opacity': 0.94,
        'border_radius': 10,
        'border_width': 2,
        'border_color': '#a855f7',
        'shadow': '0 10px 26px rgba(0,0,0,0.48)',
        'zone': 'lower-third',
        'priority': 75,
        'speed': 95,
        'enter_transition': 'slide-left',
        'exit_transition': 'fade-out',
        'anim_duration_ms': 400,
        'sample_text': 'NEWS UPDATE • समाचार बुलेटिन',
        'sample_subtext': 'आर्थिक तथा पूर्वाधार विकाससम्बन्धी ताजा जानकारी',
    },
    {
        'template_key': 'news_ticker_bar',
        'name': '10. News Ticker',
        'category': 'ticker',
        'animation': 'scroll-left',
        'accent': '#e11d72',
        'bg_color': '#1c0d36',
        'text_color': '#ffffff',
        'gradient': 'linear-gradient(90deg, #9d174d 0%, #1c0d36 25%, #1c0d36 100%)',
        'font_family': 'Nirmala UI, Noto Sans Devanagari, Inter, sans-serif',
        'font_size': 28,
        'font_weight': '700',
        'text_align': 'left',
        'position_x': 0,
        'position_y': 968,
        'width': 1920,
        'height': 52,
        'z_index': 50,
        'opacity': 0.96,
        'border_radius': 0,
        'border_width': 1,
        'border_color': '#e11d72',
        'shadow': '0 -4px 16px rgba(0,0,0,0.45)',
        'zone': 'bottom-ticker',
        'priority': 90,
        'speed': 95,
        'enter_transition': 'slide-up',
        'exit_transition': 'slide-down',
        'anim_duration_ms': 300,
        'sample_text': 'मुख्य समाचार: काष्ट्रिक्स ब्रोडकास्ट सुइट २४/७ अन-एयर प्लेआउट र सीजी स्टुडियो सञ्चालनमा',
        'sample_subtext': 'HEADLINES',
    },
    {
        'template_key': 'scrolling_crawl_bar',
        'name': '11. Scrolling Crawl',
        'category': 'crawl',
        'animation': 'scroll-left',
        'accent': '#7c3aed',
        'bg_color': '#0f0720',
        'text_color': '#f8fafc',
        'gradient': 'linear-gradient(90deg, #4c1d95 0%, #0f0720 20%, #0f0720 100%)',
        'font_family': 'Nirmala UI, Noto Sans Devanagari, Inter, sans-serif',
        'font_size': 26,
        'font_weight': '600',
        'text_align': 'left',
        'position_x': 0,
        'position_y': 1024,
        'width': 1920,
        'height': 46,
        'z_index': 51,
        'opacity': 0.96,
        'border_radius': 0,
        'border_width': 1,
        'border_color': '#7c3aed',
        'shadow': '0 -2px 12px rgba(0,0,0,0.5)',
        'zone': 'bottom-crawl',
        'priority': 92,
        'speed': 110,
        'enter_transition': 'slide-up',
        'exit_transition': 'slide-down',
        'anim_duration_ms': 300,
        'sample_text': 'ताजा अपडेट: देशभरका प्रमुख घटनाक्रम, मौसम विवरण र साङ्गीतिक कार्यक्रमहरूको निरन्तर प्रसारण...',
        'sample_subtext': 'CRAWL',
    },
    {
        'template_key': 'lower_third_standard',
        'name': '12. Lower Third',
        'category': 'lower_third',
        'animation': 'slide-left',
        'accent': '#e11d72',
        'bg_color': '#160d2d',
        'text_color': '#ffffff',
        'gradient': 'linear-gradient(135deg, #160d2d 0%, #3b0764 70%, #be185d 100%)',
        'font_family': 'Nirmala UI, Noto Sans Devanagari, Inter, sans-serif',
        'font_size': 33,
        'font_weight': '700',
        'text_align': 'left',
        'position_x': 48,
        'position_y': 820,
        'width': 860,
        'height': 125,
        'z_index': 30,
        'opacity': 0.95,
        'border_radius': 12,
        'border_width': 2,
        'border_color': '#e11d72',
        'shadow': '0 12px 32px rgba(0,0,0,0.55)',
        'zone': 'lower-third',
        'priority': 70,
        'speed': 90,
        'enter_transition': 'slide-left',
        'exit_transition': 'fade-out',
        'anim_duration_ms': 420,
        'sample_text': 'विशेष संवाद र विश्लेषण',
        'sample_subtext': 'स्टुडियो १ बाट प्रत्यक्ष प्रसारण',
    },
    {
        'template_key': 'name_designation_strap',
        'name': '13. Name / Designation Strap',
        'category': 'name_strap',
        'animation': 'slide-left',
        'accent': '#ec4899',
        'bg_color': '#180e2f',
        'text_color': '#ffffff',
        'gradient': 'linear-gradient(90deg, #180e2f 0%, #500724 100%)',
        'font_family': 'Nirmala UI, Noto Sans Devanagari, Inter, sans-serif',
        'font_size': 30,
        'font_weight': '700',
        'text_align': 'left',
        'position_x': 48,
        'position_y': 855,
        'width': 640,
        'height': 105,
        'z_index': 31,
        'opacity': 0.94,
        'border_radius': 10,
        'border_width': 2,
        'border_color': '#ec4899',
        'shadow': '0 10px 24px rgba(0,0,0,0.5)',
        'zone': 'lower-left',
        'priority': 66,
        'speed': 85,
        'enter_transition': 'slide-left',
        'exit_transition': 'fade-out',
        'anim_duration_ms': 400,
        'sample_text': 'डा. प्रकाश शर्मा',
        'sample_subtext': 'वरिष्ठ राजनीतिक तथा आर्थिक विश्लेषक',
    },
    {
        'template_key': 'main_channel_logo_bug',
        'name': '14. Main Channel Logo',
        'category': 'logo',
        'animation': 'fade-in',
        'accent': '#e11d72',
        'bg_color': '#140b28',
        'text_color': '#ffffff',
        'gradient': 'linear-gradient(135deg, #1e1038 0%, #be185d 100%)',
        'font_family': 'Nirmala UI, Noto Sans Devanagari, Inter, sans-serif',
        'font_size': 30,
        'font_weight': '800',
        'text_align': 'center',
        'position_x': 1610,
        'position_y': 26,
        'width': 270,
        'height': 74,
        'z_index': 60,
        'opacity': 0.95,
        'border_radius': 10,
        'border_width': 2,
        'border_color': '#e11d72',
        'shadow': '0 8px 20px rgba(0,0,0,0.45)',
        'zone': 'top-right',
        'priority': 100,
        'speed': 80,
        'enter_transition': 'fade-in',
        'exit_transition': 'fade-out',
        'anim_duration_ms': 300,
        'sample_text': 'KASHTRIX HD',
        'sample_subtext': 'LIVE',
    },
    {
        'template_key': 'sponsor_logo_bug',
        'name': '15. Sponsor Logo',
        'category': 'sponsor',
        'animation': 'fade-in',
        'accent': '#a855f7',
        'bg_color': '#160d2c',
        'text_color': '#ffffff',
        'gradient': 'linear-gradient(135deg, #160d2c 0%, #4c1d95 100%)',
        'font_family': 'Nirmala UI, Noto Sans Devanagari, Inter, sans-serif',
        'font_size': 24,
        'font_weight': '700',
        'text_align': 'left',
        'position_x': 36,
        'position_y': 28,
        'width': 320,
        'height': 74,
        'z_index': 58,
        'opacity': 0.92,
        'border_radius': 10,
        'border_width': 1,
        'border_color': '#a855f7',
        'shadow': '0 8px 20px rgba(0,0,0,0.4)',
        'zone': 'top-left',
        'priority': 96,
        'speed': 80,
        'enter_transition': 'fade-in',
        'exit_transition': 'fade-out',
        'anim_duration_ms': 350,
        'sample_text': 'SPONSORED PARTNER',
        'sample_subtext': 'Powered by Kashtrix Cloud',
    },
    {
        'template_key': 'sponsored_by_badge',
        'name': '16. Sponsored By',
        'category': 'sponsored_by',
        'animation': 'slide-right',
        'accent': '#f59e0b',
        'bg_color': '#1c102b',
        'text_color': '#fef3c7',
        'gradient': 'linear-gradient(135deg, #1c102b 0%, #78350f 100%)',
        'font_family': 'Nirmala UI, Noto Sans Devanagari, Inter, sans-serif',
        'font_size': 25,
        'font_weight': '700',
        'text_align': 'left',
        'position_x': 36,
        'position_y': 115,
        'width': 420,
        'height': 86,
        'z_index': 55,
        'opacity': 0.93,
        'border_radius': 10,
        'border_width': 2,
        'border_color': '#f59e0b',
        'shadow': '0 8px 24px rgba(0,0,0,0.45)',
        'zone': 'top-left',
        'priority': 82,
        'speed': 85,
        'enter_transition': 'slide-right',
        'exit_transition': 'fade-out',
        'anim_duration_ms': 400,
        'sample_text': 'यस कार्यक्रमका प्रायोजक',
        'sample_subtext': 'Sponsored By: Himalayan Telecom',
    },
    {
        'template_key': 'live_location_tag',
        'name': '17. Live Location',
        'category': 'live_location',
        'animation': 'slide-right',
        'accent': '#10b981',
        'bg_color': '#0f172a',
        'text_color': '#ffffff',
        'gradient': 'linear-gradient(90deg, #be123c 0%, #1e1b4b 100%)',
        'font_family': 'Nirmala UI, Noto Sans Devanagari, Inter, sans-serif',
        'font_size': 25,
        'font_weight': '700',
        'text_align': 'left',
        'position_x': 36,
        'position_y': 215,
        'width': 380,
        'height': 76,
        'z_index': 54,
        'opacity': 0.94,
        'border_radius': 8,
        'border_width': 2,
        'border_color': '#f43f5e',
        'shadow': '0 8px 20px rgba(0,0,0,0.45)',
        'zone': 'top-left',
        'priority': 84,
        'speed': 85,
        'enter_transition': 'slide-right',
        'exit_transition': 'fade-out',
        'anim_duration_ms': 350,
        'sample_text': '● LIVE  |  काठमाडौँ, नेपाल',
        'sample_subtext': 'प्रत्यक्ष प्रसारण (Direct Feed)',
    },
    {
        'template_key': 'programme_promo_card',
        'name': '18. Programme Promo',
        'category': 'promo',
        'animation': 'zoom-in',
        'accent': '#e11d72',
        'bg_color': '#1b0c36',
        'text_color': '#ffffff',
        'gradient': 'linear-gradient(135deg, #1b0c36 0%, #6b21a8 50%, #e11d72 100%)',
        'font_family': 'Nirmala UI, Noto Sans Devanagari, Inter, sans-serif',
        'font_size': 32,
        'font_weight': '800',
        'text_align': 'left',
        'position_x': 1200,
        'position_y': 410,
        'width': 660,
        'height': 145,
        'z_index': 35,
        'opacity': 0.95,
        'border_radius': 14,
        'border_width': 2,
        'border_color': '#f472b6',
        'shadow': '0 14px 34px rgba(0,0,0,0.55)',
        'zone': 'middle-right',
        'priority': 58,
        'speed': 90,
        'enter_transition': 'zoom-in',
        'exit_transition': 'fade-out',
        'anim_duration_ms': 450,
        'sample_text': 'TONIGHT 8:00 PM • विशेष साङ्गीतिक साँझ',
        'sample_subtext': 'प्रत्यक्ष प्रस्तुति — नछुटाउनुहोला',
    },
    {
        'template_key': 'clock_date_bug',
        'name': '19. Clock / Date',
        'category': 'clock',
        'animation': 'fade-in',
        'accent': '#a855f7',
        'bg_color': '#130b24',
        'text_color': '#f8fafc',
        'gradient': 'linear-gradient(90deg, #130b24 0%, #2e1065 100%)',
        'font_family': 'Nirmala UI, Noto Sans Devanagari, Inter, sans-serif',
        'font_size': 23,
        'font_weight': '700',
        'text_align': 'right',
        'position_x': 1560,
        'position_y': 110,
        'width': 320,
        'height': 58,
        'z_index': 59,
        'opacity': 0.92,
        'border_radius': 8,
        'border_width': 1,
        'border_color': '#a855f7',
        'shadow': '0 6px 16px rgba(0,0,0,0.4)',
        'zone': 'top-right',
        'priority': 94,
        'speed': 80,
        'enter_transition': 'fade-in',
        'exit_transition': 'fade-out',
        'anim_duration_ms': 250,
        'sample_text': 'NPT CLOCK',
        'sample_subtext': 'काठमाडौँ समय',
    },
    {
        'template_key': 'fullscreen_announcement',
        'name': '20. Full-Screen Announcement',
        'category': 'fullscreen_alert',
        'animation': 'zoom-in',
        'accent': '#e11d72',
        'bg_color': '#110722',
        'text_color': '#ffffff',
        'gradient': 'linear-gradient(135deg, rgba(17,7,34,0.96) 0%, rgba(74,14,78,0.95) 60%, rgba(225,29,114,0.92) 100%)',
        'font_family': 'Nirmala UI, Noto Sans Devanagari, Inter, sans-serif',
        'font_size': 48,
        'font_weight': '900',
        'text_align': 'center',
        'position_x': 160,
        'position_y': 160,
        'width': 1600,
        'height': 680,
        'z_index': 80,
        'opacity': 0.97,
        'border_radius': 24,
        'border_width': 3,
        'border_color': '#f472b6',
        'shadow': '0 24px 64px rgba(0,0,0,0.75)',
        'zone': 'fullscreen',
        'priority': 99,
        'speed': 90,
        'enter_transition': 'zoom-in',
        'exit_transition': 'fade-out',
        'anim_duration_ms': 500,
        'sample_text': 'विशेष सूचना • SPECIAL BROADCAST ANNOUNCEMENT',
        'sample_subtext': 'हाम्रो विशेष प्रत्यक्ष प्रसारण केही बेरमा सुरु हुँदैछ। कृपया प्रतीक्षा गर्नुहोला।',
    },
    {
        'template_key': 'flash_news_premium_3d',
        'name': '21. Flash News Premium (3D Flipper)',
        'category': 'flash_premium',
        'animation': 'flash-in',
        'accent': '#004080',
        'bg_color': '#001a33',
        'text_color': '#001a33',
        'gradient': 'linear-gradient(90deg, #001a33, #004080)',
        'font_family': 'Inter, Nirmala UI, Noto Sans Devanagari, sans-serif',
        'font_size': 30,
        'font_weight': '800',
        'text_align': 'left',
        'position_x': 0,
        'position_y': 939,
        'width': 1920,
        'height': 85,
        'z_index': 65,
        'opacity': 0.99,
        'border_radius': 0,
        'border_width': 2,
        'border_color': '#004080',
        'shadow': '10px 0 30px rgba(0,0,0,0.5)',
        'zone': 'bottom-flash',
        'priority': 96,
        'speed': 95,
        'enter_transition': 'slide-up',
        'exit_transition': 'slide-down',
        'anim_duration_ms': 400,
        'sample_text': 'मतगणनाको ताजा परिणाम सार्वजनिक, मुख्य प्रतिस्पर्धीबीच कडा टक्कर | देशभरका प्रमुख सहरहरूमा विशेष सुरक्षा सतर्कता | संसदीय समितिको बैठकद्वारा विशेष आर्थिक प्रस्ताव पारित',
        'sample_subtext': 'FLASH NEWS',
    },
    {
        'template_key': 'cgdemo_breaking_fullscreen',
        'name': '22. Full-Screen Breaking News (Stage + Card)',
        'category': 'breaking_full',
        'animation': 'zoom-in',
        'accent': '#c90a14',
        'bg_color': '#520004',
        'text_color': '#5c050a',
        'gradient': 'linear-gradient(135deg, #c90a14 0%, #800005 50%, #3d0002 100%)',
        'font_family': 'Nirmala UI, Noto Sans Devanagari, Inter, sans-serif',
        'font_size': 52,
        'font_weight': '800',
        'text_align': 'center',
        'position_x': 0,
        'position_y': 0,
        'width': 1920,
        'height': 1080,
        'z_index': 75,
        'opacity': 0.98,
        'border_radius': 0,
        'border_width': 0,
        'border_color': '#c90a14',
        'shadow': '0 24px 60px rgba(0,0,0,0.65)',
        'zone': 'fullscreen',
        'priority': 98,
        'speed': 90,
        'enter_transition': 'zoom-in',
        'exit_transition': 'fade-out',
        'anim_duration_ms': 500,
        'sample_text': 'राष्ट्रिय सभाको विशेष अधिवेशन आज दिउँसो १ बजे बस्ने, प्रमुख विधेयकहरू प्रस्तुत गरिने | देशभरका प्रमुख राजमार्गहरूमा यातायात सहज बनाउन विशेष कार्यदल परिचालन',
        'sample_subtext': 'BREAKING NEWS',
    },
    {
        'template_key': 'cgdemo_breaking_split_2win',
        'name': '23. 2-Window Split Breaking News (Story + Live Anchor)',
        'category': 'breaking_split',
        'animation': 'slide-left',
        'accent': '#c90a14',
        'bg_color': '#520004',
        'text_color': '#5c050a',
        'gradient': 'linear-gradient(135deg, #c90a14 0%, #800005 50%, #3d0002 100%)',
        'font_family': 'Nirmala UI, Noto Sans Devanagari, Inter, sans-serif',
        'font_size': 48,
        'font_weight': '800',
        'text_align': 'center',
        'position_x': 0,
        'position_y': 0,
        'width': 1920,
        'height': 1080,
        'z_index': 76,
        'opacity': 0.98,
        'border_radius': 0,
        'border_width': 0,
        'border_color': '#ffdd00',
        'shadow': '0 24px 60px rgba(0,0,0,0.65)',
        'zone': 'fullscreen',
        'priority': 98,
        'speed': 90,
        'enter_transition': 'slide-left',
        'exit_transition': 'fade-out',
        'anim_duration_ms': 500,
        'sample_text': 'मन्त्रिपरिषद् बैठकका निर्णयहरू सार्वजनिक: पूर्वाधार र ऊर्जा क्षेत्रमा विशेष प्राथमिकता | काठमाडौँ उपत्यकामा स्मार्ट ट्राफिक प्रणाली विस्तार गरिने',
        'sample_subtext': 'LIVE STUDIO SPLIT',
    },
    {
        'template_key': 'cgdemo_breaking_3win',
        'name': '24. 3-Window Breaking News (Footage + Story + Anchor)',
        'category': 'breaking_3win',
        'animation': 'zoom-in',
        'accent': '#c90a14',
        'bg_color': '#520004',
        'text_color': '#5c050a',
        'gradient': 'linear-gradient(135deg, #c90a14 0%, #800005 50%, #3d0002 100%)',
        'font_family': 'Nirmala UI, Noto Sans Devanagari, Inter, sans-serif',
        'font_size': 42,
        'font_weight': '800',
        'text_align': 'center',
        'position_x': 0,
        'position_y': 0,
        'width': 1920,
        'height': 1080,
        'z_index': 77,
        'opacity': 0.98,
        'border_radius': 0,
        'border_width': 0,
        'border_color': '#ffdd00',
        'shadow': '0 24px 60px rgba(0,0,0,0.65)',
        'zone': 'fullscreen',
        'priority': 98,
        'speed': 90,
        'enter_transition': 'zoom-in',
        'exit_transition': 'fade-out',
        'anim_duration_ms': 500,
        'sample_text': 'प्रत्यक्ष रिपोर्टिङ: देशका विभिन्न स्थानबाट विशेष संवाददाताहरूको प्रत्यक्ष अपडेट | मौसम पूर्वानुमान तथा विपद् व्यवस्थापनको ताजा अवस्था',
        'sample_subtext': '3-WINDOW LIVE BREAKING',
    },
    {
        'template_key': 'cgdemo_weather_nepal_camera',
        'name': '25. Nepal Weather Broadcast Camera Flyover',
        'category': 'weather_map',
        'animation': 'zoom-in',
        'accent': '#38bdf8',
        'bg_color': '#0b192c',
        'text_color': '#ffffff',
        'gradient': 'linear-gradient(135deg, #0b192c 0%, #1e3a8a 100%)',
        'font_family': 'Poppins, Nirmala UI, sans-serif',
        'font_size': 30,
        'font_weight': '800',
        'text_align': 'center',
        'position_x': 0,
        'position_y': 0,
        'width': 1920,
        'height': 1080,
        'z_index': 74,
        'opacity': 0.98,
        'border_radius': 0,
        'border_width': 0,
        'border_color': '#38bdf8',
        'shadow': '0 20px 50px rgba(0,0,0,0.6)',
        'zone': 'fullscreen',
        'priority': 97,
        'speed': 90,
        'enter_transition': 'fade-in',
        'exit_transition': 'fade-out',
        'anim_duration_ms': 500,
        'sample_text': 'नेपाल मौसम विवरण • NEPAL WEATHER REPORT',
        'sample_subtext': 'धनगढी, सुर्खेत, जुम्ला, दाङ, पोखरा, काठमाडौँ, हेटौँडा, जनकपुर, धरान, बिर्तामोड, काँकरभिट्टा',
    },
    {
        'template_key': 'cgdemo_animated_logo_seq',
        'name': '26. Animated 3D Channel Logo Sequence',
        'category': 'logo_anim',
        'animation': 'fade-in',
        'accent': '#e11d72',
        'bg_color': 'transparent',
        'text_color': '#ffffff',
        'gradient': '',
        'font_family': 'Inter, sans-serif',
        'font_size': 24,
        'font_weight': '700',
        'text_align': 'right',
        'position_x': 1615,
        'position_y': 10,
        'width': 255,
        'height': 170,
        'z_index': 68,
        'opacity': 1.0,
        'border_radius': 0,
        'border_width': 0,
        'border_color': '#e11d72',
        'shadow': '',
        'zone': 'top-right',
        'priority': 99,
        'speed': 25,
        'enter_transition': 'fade-in',
        'exit_transition': 'fade-out',
        'anim_duration_ms': 300,
        'sample_text': 'ANIMATED CHANNEL LOGO',
        'sample_subtext': '25 FPS PNG Sequence',
    },
    {
        'template_key': 'cgdemo_animated_live_seq',
        'name': '27. Animated LIVE Broadcast Tag Sequence',
        'category': 'live_anim',
        'animation': 'fade-in',
        'accent': '#ef4444',
        'bg_color': 'transparent',
        'text_color': '#ffffff',
        'gradient': '',
        'font_family': 'Inter, sans-serif',
        'font_size': 22,
        'font_weight': '700',
        'text_align': 'right',
        'position_x': 1665,
        'position_y': 142,
        'width': 200,
        'height': 133,
        'z_index': 67,
        'opacity': 1.0,
        'border_radius': 0,
        'border_width': 0,
        'border_color': '#ef4444',
        'shadow': '',
        'zone': 'top-right',
        'priority': 98,
        'speed': 25,
        'enter_transition': 'fade-in',
        'exit_transition': 'fade-out',
        'anim_duration_ms': 300,
        'sample_text': 'LIVE BROADCAST BUG',
        'sample_subtext': '25 FPS PNG Sequence',
    },
    {
        'template_key': 'hebron_tv_liquid_logo',
        'name': '28. Hebron TV — Liquid-Glass Channel Bug',
        'category': 'hebron_logo',
        'animation': 'fade-in',
        'accent': '#38bdf8',
        'bg_color': '#0a1630',
        'text_color': '#ffffff',
        'gradient': 'linear-gradient(135deg, rgba(15, 23, 42, 0.72) 0%, rgba(30, 58, 138, 0.55) 100%)',
        'font_family': 'Inter, DM Sans, sans-serif',
        'font_size': 20,
        'font_weight': '800',
        'text_align': 'right',
        'position_x': 1620,
        'position_y': 26,
        'width': 260,
        'height': 96,
        'z_index': 72,
        'opacity': 0.98,
        'border_radius': 16,
        'border_width': 1,
        'border_color': '#bae6fd',
        'shadow': '0 10px 30px rgba(0,0,0,0.45)',
        'zone': 'top-right',
        'priority': 99,
        'speed': 85,
        'enter_transition': 'fade-in',
        'exit_transition': 'fade-out',
        'anim_duration_ms': 350,
        'sample_text': 'HEBRON TV',
        'sample_subtext': 'HD LIVE',
    },
    {
        'template_key': 'hebron_tv_breaking_bar',
        'name': '29. Hebron TV — Breaking News Lower Third',
        'category': 'hebron_breaking',
        'animation': 'char-reveal',
        'accent': '#dc2626',
        'bg_color': '#0b1630',
        'text_color': '#ffffff',
        'gradient': 'linear-gradient(100deg, #0b1630 0%, #172554 60%, #991b1b 100%)',
        'font_family': 'Inter, DM Sans, sans-serif',
        'font_size': 30,
        'font_weight': '800',
        'text_align': 'left',
        'position_x': 0,
        'position_y': 912,
        'width': 1920,
        'height': 92,
        'z_index': 66,
        'opacity': 0.98,
        'border_radius': 0,
        'border_width': 0,
        'border_color': '#f59e0b',
        'shadow': '0 12px 36px rgba(0,0,0,0.6)',
        'zone': 'bottom',
        'priority': 96,
        'speed': 90,
        'enter_transition': 'slide-up',
        'exit_transition': 'fade-out',
        'anim_duration_ms': 420,
        'sample_text': 'HEBRON TV SPECIAL REPORT: Live Global & National Coverage From Our Studio Desk | Parliament Session Convenes With Key Economic & Infrastructure Bills',
        'sample_subtext': 'BREAKING NEWS',
    },
    {
        'template_key': 'hebron_tv_flash_bar',
        'name': '30. Hebron TV — Flash News 3D Flip Bar',
        'category': 'hebron_flash',
        'animation': 'char-reveal',
        'accent': '#0284c7',
        'bg_color': '#081838',
        'text_color': '#0f172a',
        'gradient': 'linear-gradient(90deg, #081838 0%, #0369a1 55%, #0ea5e9 100%)',
        'font_family': 'Inter, DM Sans, sans-serif',
        'font_size': 30,
        'font_weight': '800',
        'text_align': 'left',
        'position_x': 0,
        'position_y': 916,
        'width': 1920,
        'height': 86,
        'z_index': 65,
        'opacity': 0.98,
        'border_radius': 0,
        'border_width': 0,
        'border_color': '#38bdf8',
        'shadow': '0 10px 30px rgba(0,0,0,0.55)',
        'zone': 'bottom',
        'priority': 95,
        'speed': 90,
        'enter_transition': 'slide-up',
        'exit_transition': 'fade-out',
        'anim_duration_ms': 400,
        'sample_text': 'HEBRON FLASH: High-Level Summit Announces Regional Connectivity & Clean Energy Pact | Major Markets Rally Ahead of Quarterly Policy Review',
        'sample_subtext': 'FLASH NEWS',
    },
    {
        'template_key': 'hebron_tv_news_crawl',
        'name': '31. Hebron TV — Liquid-Glass News Crawl',
        'category': 'hebron_crawl',
        'animation': 'scroll-left',
        'accent': '#0ea5e9',
        'bg_color': '#071024',
        'text_color': '#f8fafc',
        'gradient': 'linear-gradient(90deg, #071024 0%, #0f172a 50%, #1e293b 100%)',
        'font_family': 'Inter, DM Sans, sans-serif',
        'font_size': 24,
        'font_weight': '700',
        'text_align': 'left',
        'position_x': 0,
        'position_y': 1026,
        'width': 1920,
        'height': 48,
        'z_index': 70,
        'opacity': 0.98,
        'border_radius': 0,
        'border_width': 0,
        'border_color': '#38bdf8',
        'shadow': '0 -6px 24px rgba(0,0,0,0.55)',
        'zone': 'bottom-edge',
        'priority': 100,
        'speed': 95,
        'enter_transition': 'slide-up',
        'exit_transition': 'fade-out',
        'anim_duration_ms': 300,
        'sample_text': 'WELCOME TO HEBRON TV HD • 24/7 NEWS, FAITH, CULTURE & LIVE STUDIO PROGRAMMING • STAY TUNED FOR EVENING PRIME BULLETIN AT 8:00 PM • WATCH LIVE ON CABLE, SATELLITE & DIGITAL',
        'sample_subtext': 'HEBRON TV',
    },
    {
        'template_key': 'hebron_tv_headline_ticker',
        'name': '32. Hebron TV — Headline Ticker',
        'category': 'hebron_ticker',
        'animation': 'scroll-left',
        'accent': '#f59e0b',
        'bg_color': '#0d1b3e',
        'text_color': '#ffffff',
        'gradient': 'linear-gradient(90deg, #0d1b3e 0%, #1e3a8a 60%, #1d4ed8 100%)',
        'font_family': 'Inter, DM Sans, sans-serif',
        'font_size': 25,
        'font_weight': '700',
        'text_align': 'left',
        'position_x': 0,
        'position_y': 972,
        'width': 1920,
        'height': 52,
        'z_index': 69,
        'opacity': 0.97,
        'border_radius': 0,
        'border_width': 0,
        'border_color': '#f59e0b',
        'shadow': '0 6px 20px rgba(0,0,0,0.45)',
        'zone': 'bottom',
        'priority': 99,
        'speed': 88,
        'enter_transition': 'slide-up',
        'exit_transition': 'fade-out',
        'anim_duration_ms': 300,
        'sample_text': 'HEBRON NEWS DESK: National Infrastructure Corridor Enters Final Phase | Tech & Innovation Forum Opens Tomorrow | Weather Forecast: Clear Skies Across Major Valleys',
        'sample_subtext': 'HEADLINES',
    },
]

DEFAULT_20_CG_LAYERS = [
    ('Main channel logo', 'logo', 'KASHTRIX HD', 'LIVE', True, '#e11d72', 1610, 26, 270, 74, 100),
    ('Sponsor ident', 'sponsor', 'SPONSORED', 'Kashtrix Cloud', True, '#8b5cf6', 36, 28, 320, 74, 96),
    ('Headline ticker', 'ticker', 'काष्ट्रिक्स ब्रोडकास्ट सुइट २४/७ अन-एयर प्लेआउट र सीजी स्टुडियो सञ्चालनमा | देशभरका प्रमुख समाचार र ताजा अपडेटहरूको निरन्तर प्रसारण', 'HEADLINES', True, '#e11d72', 0, 968, 1920, 52, 90),
    ('News crawl', 'crawl', 'ताजा अपडेट: देशभरका प्रमुख घटनाक्रम, मौसम विवरण र साङ्गीतिक कार्यक्रमहरूको निरन्तर प्रसारण | काठमाडौँ उपत्यकासहित देशका प्रमुख सहरहरूमा विशेष प्रसारण सेवा', 'CRAWL', True, '#7c3aed', 0, 1024, 1920, 56, 92),
    ('Lower third', 'lower_third', 'PRIME TIME DIALOGUE & ANALYSIS', 'Live from Studio 1 • Kathmandu', True, '#e11d72', 48, 820, 860, 125, 70),
    ('Name and designation', 'name_strap', 'Dr. Prakash Sharma', 'Senior Political & Economic Analyst', False, '#ec4899', 48, 855, 640, 105, 66),
    ('Breaking news', 'breaking', 'विशेष समाचार अपडेट: काठमाडौँबाट प्रत्यक्ष प्रसारण | संसद बैठकको विशेष निर्णय सार्वजनिक | आर्थिक तथा पूर्वाधार विकाससम्बन्धी उच्चस्तरीय बैठक सम्पन्न', 'BREAKING NEWS', False, '#dc2626', 0, 938, 1920, 86, 95),
    ('Flash news', 'flash', 'संसद बैठकको विशेष निर्णय सार्वजनिक | देशभरका प्रमुख सहरहरूको ताजा अपडेट | विशेष बुलेटिन प्रत्यक्ष प्रसारण हुँदै', 'FLASH NEWS', False, '#7c3aed', 0, 938, 1920, 86, 88),
    ('Flash News Premium', 'flash_premium', 'मतगणनाको ताजा परिणाम सार्वजनिक, मुख्य प्रतिस्पर्धीबीच कडा टक्कर | देशभरका प्रमुख सहरहरूमा विशेष सुरक्षा सतर्कता | संसदीय समितिको बैठकद्वारा विशेष आर्थिक प्रस्ताव पारित', 'FLASH NEWS', False, '#004080', 0, 939, 1920, 85, 96),
    ('News update', 'update', 'NEWS UPDATE • SPECIAL BULLETIN', 'Infrastructure & Economic Development Update', False, '#a855f7', 40, 610, 960, 105, 75),
    ('Nepal date/time', 'clock', '', 'NPT', True, '#a855f7', 1560, 110, 320, 58, 94),
    ('Quote card', 'quote', '"Truth, accuracy, and impartial journalism is our commitment."', 'Editorial Desk', False, '#8b5cf6', 48, 520, 840, 120, 55),
    ('Now / Next strap', 'now_next', 'NOW SHOWING: Evening Prime Bulletin', 'COMING UP NEXT: Special Dialogue — 8:00 PM', False, '#f43f5e', 1180, 250, 680, 135, 64),
    ('Top headline', 'headline', 'TOP STORIES OF THE HOUR', 'Prime Time Broadcast Bulletin', False, '#e11d72', 48, 420, 920, 110, 72),
    ('Programme promo', 'promo', 'COMING UP TONIGHT 8:00 PM • Acoustic Music Sessions', 'Live Studio Performance', False, '#e11d72', 1200, 410, 660, 145, 58),
    ('Music Now Playing', 'music_now', 'NOW PLAYING • Saiyara - Arijit Singh', 'Artist: Arijit Singh  •  Album: Saiyara Original Soundtrack', False, '#ff2e93', 60, 805, 760, 155, 68),
    ('Song Credits / Details', 'music_credits', 'SONG CREDITS • Saiyara (Official Music Video)', 'Vocals: Arijit Singh  •  Label: Kashtrix Music HD', False, '#c084fc', 60, 635, 780, 155, 62),
    ('Programme Now Showing', 'program_info', 'NOW SHOWING: Prime Music & Chartbusters', '24/7 HD Broadcast Playout', False, '#e11d72', 1220, 125, 640, 115, 60),
    ('Sponsored By Badge', 'sponsored_by', 'OFFICIAL BROADCAST PARTNER', 'Sponsored By: Himalayan Telecom', False, '#f59e0b', 36, 115, 420, 86, 82),
    ('Live Location Tag', 'live_location', '● LIVE  |  KATHMANDU, NEPAL', 'Direct Satellite & Fiber Feed', False, '#10b981', 36, 215, 380, 76, 84),
    ('Full-Screen Announcement', 'fullscreen_alert', 'विशेष सूचना • SPECIAL ANNOUNCEMENT', 'हाम्रो विशेष प्रत्यक्ष प्रसारण केही बेरमा सुरु हुँदैछ।', False, '#e11d72', 160, 160, 1600, 680, 99),
    ('Full-Screen Breaking News', 'breaking_full', 'राष्ट्रिय सभाको विशेष अधिवेशन आज दिउँसो १ बजे बस्ने, प्रमुख विधेयकहरू प्रस्तुत गरिने | देशभरका प्रमुख राजमार्गहरूमा यातायात सहज बनाउन विशेष कार्यदल परिचालन', 'BREAKING NEWS', False, '#c90a14', 0, 0, 1920, 1080, 98),
    ('2-Window Split Breaking', 'breaking_split', 'मन्त्रिपरिषद् बैठकका निर्णयहरू सार्वजनिक: पूर्वाधार र ऊर्जा क्षेत्रमा विशेष प्राथमिकता | काठमाडौँ उपत्यकामा स्मार्ट ट्राफिक प्रणाली विस्तार गरिने', 'LIVE STUDIO SPLIT', False, '#c90a14', 0, 0, 1920, 1080, 98),
    ('3-Window Breaking News', 'breaking_3win', 'प्रत्यक्ष रिपोर्टिङ: देशका विभिन्न स्थानबाट विशेष संवाददाताहरूको प्रत्यक्ष अपडेट | मौसम पूर्वानुमान तथा विपद् व्यवस्थापनको ताजा अवस्था', '3-WINDOW BREAKING', False, '#c90a14', 0, 0, 1920, 1080, 98),
    ('Nepal Weather Camera Map', 'weather_map', 'नेपाल मौसम विवरण • NEPAL WEATHER REPORT', 'धनगढी, सुर्खेत, जुम्ला, दाङ, पोखरा, काठमाडौँ, हेटौँडा, जनकपुर, धरान, बिर्तामोड, काँकरभिट्टा', False, '#38bdf8', 0, 0, 1920, 1080, 97),
    ('Animated 3D Logo Bug', 'logo_anim', 'KASHTRIX 3D LOGO', 'LIVE SEQUENCE', False, '#e11d72', 1615, 10, 255, 170, 99),
    ('Animated LIVE Bug', 'live_anim', 'LIVE TAG', 'LIVE SEQUENCE', False, '#ef4444', 1665, 142, 200, 133, 98),
    ('Hebron TV Channel Bug', 'hebron_logo', 'HEBRON TV', 'HD LIVE', False, '#38bdf8', 1620, 26, 260, 96, 99),
    ('Hebron TV Breaking News', 'hebron_breaking', 'HEBRON TV SPECIAL REPORT: Live Global & National Coverage From Our Studio Desk | Parliament Session Convenes With Key Economic & Infrastructure Bills', 'BREAKING NEWS', False, '#dc2626', 0, 912, 1920, 92, 96),
    ('Hebron TV Flash News', 'hebron_flash', 'HEBRON FLASH: High-Level Summit Announces Regional Connectivity & Clean Energy Pact | Major Markets Rally Ahead of Quarterly Policy Review', 'FLASH NEWS', False, '#0284c7', 0, 916, 1920, 86, 95),
    ('Hebron TV News Crawl', 'hebron_crawl', 'WELCOME TO HEBRON TV HD • 24/7 NEWS, FAITH, CULTURE & LIVE STUDIO PROGRAMMING • STAY TUNED FOR EVENING PRIME BULLETIN AT 8:00 PM • WATCH LIVE ON CABLE, SATELLITE & DIGITAL', 'HEBRON TV', False, '#0ea5e9', 0, 1026, 1920, 48, 100),
    ('Hebron TV Headline Ticker', 'hebron_ticker', 'HEBRON NEWS DESK: National Infrastructure Corridor Enters Final Phase | Tech & Innovation Forum Opens Tomorrow | Weather Forecast: Clear Skies Across Major Valleys', 'HEADLINES', False, '#f59e0b', 0, 972, 1920, 52, 99),
]


def resolve_cg_collisions(layers: list[dict], target_w: int = 1920, target_h: int = 1080) -> list[dict]:
    """
    Adaptive collision-avoidance layout solver in 1920x1080 reference space, scaled to target_w x target_h.
    - When only crawl is active, it uses full lower height (y=996, h=58).
    - When ticker + crawl are both active, crawl shifts to y=1024, h=46 and ticker takes y=968, h=52.
    - When breaking news is active, lower-priority lower thirds shift upward or yield so they never overlap.
    - Any two active boxes whose horizontal & vertical ranges intersect are shifted vertically by priority.
    """
    scale_x = target_w / 1920.0
    scale_y = target_h / 1080.0

    active_cats = {l['category'] for l in layers if l.get('effective_active') and not l.get('hidden')}
    has_ticker = 'ticker' in active_cats
    has_crawl = 'crawl' in active_cats
    has_hebron_ticker = 'hebron_ticker' in active_cats
    has_hebron_crawl = 'hebron_crawl' in active_cats
    has_breaking = 'breaking' in active_cats or 'hebron_breaking' in active_cats

    default_by_cat = {
        cat: (px, py, w, h, prio)
        for (_, cat, _, _, _, _, px, py, w, h, prio) in DEFAULT_20_CG_LAYERS
    }

    working = []
    for item in layers:
        d = dict(item)
        cat = d.get('category', '')
        def_x, def_y, def_w, def_h, def_prio = default_by_cat.get(cat, (48, 800, 680, 120, 50))
        x = int(d.get('position_x') if (d.get('position_x') or 0) > 0 else def_x)
        y = int(d.get('position_y') if (d.get('position_y') or 0) > 0 else def_y)
        w = int(d.get('width') or def_w)
        h = int(d.get('height') or def_h)
        prio = int(d.get('priority') or def_prio)

        if cat == 'crawl':
            x = 0
            w = 1920
            if not has_ticker:
                y = 996
                h = 58
            else:
                y = 1024
                h = 46
        elif cat == 'ticker':
            x = 0
            w = 1920
            y = 968 if has_crawl else 992
            h = 52
        elif cat == 'hebron_crawl':
            x = 0
            w = 1920
            if not has_hebron_ticker:
                y = 1004
                h = 54
            else:
                y = 1026
                h = 48
        elif cat == 'hebron_ticker':
            x = 0
            w = 1920
            y = 972 if has_hebron_crawl else 996
            h = 52
        elif cat in ('hebron_breaking', 'hebron_flash'):
            x = 0
            w = 1920
            if has_hebron_crawl and has_hebron_ticker:
                y = 876
            elif has_hebron_crawl or has_hebron_ticker:
                y = 906
            else:
                y = 936
        elif cat == 'logo':
            if (d.get('position_x') or 0) <= 0:
                x = 1610
            if (d.get('position_y') or 0) <= 0:
                y = 26
        elif cat == 'sponsor':
            if (d.get('position_x') or 0) <= 0:
                x = 36
            if (d.get('position_y') or 0) <= 0:
                y = 28

        # If breaking news is active and this is a lower-priority lower-third in the same zone, shift it above breaking
        if has_breaking and cat in ('lower_third', 'name_strap', 'music_now') and prio < 95:
            if y >= 700:
                y = max(140, y - 150)

        d['ref_x'] = max(0, min(1920 - 80, x))
        d['ref_y'] = max(0, min(1080 - 40, y))
        d['ref_w'] = max(100, min(1920, w))
        d['ref_h'] = max(36, min(1080, h))
        d['priority'] = prio
        working.append(d)

    # Sort active layers by priority descending so high-priority layers claim their zone first
    placed_boxes: list[tuple[int, int, int, int, str]] = []
    active_sorted = sorted(
        [w for w in working if w.get('effective_active') and not w.get('hidden')],
        key=lambda z: (z.get('priority', 50), z.get('z_index', 10), z.get('id', 0)),
        reverse=True,
    )

    def overlaps(ax1, ay1, ax2, ay2, bx1, by1, bx2, by2) -> bool:
        return not (ax2 <= bx1 + 4 or ax1 >= bx2 - 4 or ay2 <= by1 + 4 or ay1 >= by2 - 4)

    FULLSCREEN_OR_FIXED_CATS = {'fullscreen_alert', 'breaking_full', 'breaking_split', 'breaking_3win', 'weather_map', 'logo_anim', 'live_anim'}
    for layer in active_sorted:
        cat = layer['category']
        if cat in FULLSCREEN_OR_FIXED_CATS:
            placed_boxes.append((layer['ref_x'], layer['ref_y'], layer['ref_x'] + layer['ref_w'], layer['ref_y'] + layer['ref_h'], cat))
            continue
        x1 = layer['ref_x']
        y1 = layer['ref_y']
        w = layer['ref_w']
        h = layer['ref_h']
        for _ in range(12):
            conflict = next(
                (b for b in placed_boxes if b[4] not in FULLSCREEN_OR_FIXED_CATS and overlaps(x1, y1, x1 + w, y1 + h, b[0], b[1], b[2], b[3])),
                None,
            )
            if not conflict:
                break
            # Shift upward if in lower half of canvas, or downward if in top half
            if y1 >= 420:
                y1 = max(24, conflict[1] - h - 10)
            else:
                y1 = min(940 - h, conflict[3] + 10)
        layer['ref_y'] = y1
        placed_boxes.append((x1, y1, x1 + w, y1 + h, cat))

    for d in working:
        d['scaled_x'] = round(d['ref_x'] * scale_x)
        d['scaled_y'] = round(d['ref_y'] * scale_y)
        d['scaled_w'] = round(d['ref_w'] * scale_x)
        d['scaled_h'] = round(d['ref_h'] * scale_y)

    return working


def format_music_now_playing(media, meta, settings) -> tuple[str, str]:
    """Build headline and subtext for automatic Music Now Playing lower-third."""
    try:
        visible = json.loads(getattr(settings, 'visible_fields_json', None) or '["song_title","artist","album"]')
        if not isinstance(visible, list):
            visible = ['song_title', 'artist', 'album']
    except Exception:
        visible = ['song_title', 'artist', 'album']

    song = (getattr(meta, 'song_title', None) if meta else None) or (getattr(media, 'title', None) if media else None) or 'Untitled Track'
    artist = (getattr(meta, 'artist', None) if meta else None) or ''
    album = (getattr(meta, 'album', None) if meta else None) or ''
    director = (getattr(meta, 'music_director', None) if meta else None) or ''
    composer = (getattr(meta, 'composer', None) if meta else None) or ''
    lyricist = (getattr(meta, 'lyricist', None) if meta else None) or ''
    label = (getattr(meta, 'record_label', None) if meta else None) or ''
    year = (getattr(meta, 'release_year', None) if meta else None) or ''

    headline = f"NOW PLAYING  •  Song: {song}" if 'song_title' in visible else 'NOW PLAYING'
    sub_parts = []
    if 'artist' in visible and artist:
        sub_parts.append(f"Artist: {artist}")
    if 'album' in visible and album:
        sub_parts.append(f"Album: {album}")
    if 'music_director' in visible and director:
        sub_parts.append(f"Music: {director}")
    if 'composer' in visible and composer:
        sub_parts.append(f"Composer: {composer}")
    if 'lyricist' in visible and lyricist:
        sub_parts.append(f"Lyrics: {lyricist}")
    if 'record_label' in visible and label:
        sub_parts.append(f"Label: {label}")
    if 'release_year' in visible and year:
        sub_parts.append(f"Year: {year}")

    subtext = '  •  '.join(sub_parts) if sub_parts else (f"Artist: {artist or 'Kashtrix Music'}" + (f"  •  Album: {album}" if album else ''))
    return headline, subtext


def compute_music_cg_window(duration: float, position_sec: float, settings, meta_override=None) -> dict:
    """
    Determine whether the automatic Music Now Playing graphic should be active at `position_sec`.
    Default start window: [20s, 30s) (20s delay, 10s duration)
    Default end window:   [duration - 30s, duration - 20s) (30s before end, 10s duration)
    Handles short videos, unknown durations, and overlaps safely.
    """
    enabled = bool(getattr(settings, 'enabled', True)) if settings else True
    if not enabled:
        return {'active': False, 'phase': None}

    use_override = bool(meta_override and getattr(meta_override, 'override_enabled', False))
    show_start = bool(getattr(settings, 'show_at_start', True)) if settings else True
    show_end = bool(getattr(settings, 'show_before_end', True)) if settings else True

    start_delay = int(
        (getattr(meta_override, 'start_delay_sec', None) if use_override and getattr(meta_override, 'start_delay_sec', None) is not None else None)
        if use_override else (getattr(settings, 'start_delay_sec', 20) if settings else 20)
    )
    if use_override and getattr(meta_override, 'start_delay_sec', None) is None:
        start_delay = int(getattr(settings, 'start_delay_sec', 20) if settings else 20)

    start_dur = int(
        (getattr(meta_override, 'start_duration_sec', None) if use_override and getattr(meta_override, 'start_duration_sec', None) is not None else None)
        or (getattr(settings, 'start_duration_sec', 10) if settings else 10)
    )
    end_lead = int(
        (getattr(meta_override, 'end_lead_sec', None) if use_override and getattr(meta_override, 'end_lead_sec', None) is not None else None)
        or (getattr(settings, 'end_lead_sec', 30) if settings else 30)
    )
    end_dur = int(
        (getattr(meta_override, 'end_duration_sec', None) if use_override and getattr(meta_override, 'end_duration_sec', None) is not None else None)
        or (getattr(settings, 'end_duration_sec', 10) if settings else 10)
    )

    pos = float(position_sec or 0.0)
    dur = float(duration or 0.0)

    start_w0 = float(max(0, start_delay))
    start_w1 = start_w0 + float(max(1, start_dur))

    # Check start-of-song window
    if show_start:
        # If duration is known and shorter than start_delay + 2s, skip so graphic doesn't flash past end of clip
        if dur <= 0 or dur >= start_w0 + 2.0:
            effective_start_w1 = min(start_w1, dur - 0.5) if dur > 0 else start_w1
            if start_w0 <= pos < effective_start_w1:
                return {
                    'active': True,
                    'phase': 'start',
                    'window_start': start_w0,
                    'window_end': effective_start_w1,
                }

    # Check end-of-song window (only when duration is known and long enough not to overlap start window)
    if show_end and dur > 0:
        end_w0 = dur - float(max(1, end_lead))
        end_w1 = min(dur - 0.5, end_w0 + float(max(1, end_dur)))
        min_safe_start = start_w1 + 1.0 if show_start else 1.0
        if end_w0 >= min_safe_start and end_w0 <= pos < end_w1:
            return {
                'active': True,
                'phase': 'end',
                'window_start': end_w0,
                'window_end': end_w1,
            }

    return {'active': False, 'phase': None}


def evaluate_programme_cg_state(
    schedules: list,
    active_events: list,
    now: datetime,
    prog_settings,
    tz,
    elapsed_override_sec: float | None = None,
) -> dict:
    """
    Evaluate whether automatic Programme Now / Next CG should be active right now.
    - Never triggers for default playlist rotation or unscheduled manual takes.
    - Only triggers when `prog_settings.enabled` is True AND an active scheduled programme
      matches `enable_programme_cg == True`, `id in eligible_schedule_ids`, or `programme_category in eligible_categories`.
    - Hides the NEXT field completely if there is no valid upcoming scheduled programme.
    """
    if not prog_settings or not getattr(prog_settings, 'enabled', False):
        return {'active': False, 'phase': None, 'text': '', 'subtext': '', 'schedule_id': None, 'next_schedule_id': None}

    try:
        eligible_cats = set(json.loads(getattr(prog_settings, 'eligible_categories_json', '[]') or '[]'))
    except Exception:
        eligible_cats = {'news', 'talk', 'special', 'music', 'live'}
    try:
        eligible_ids = {int(x) for x in json.loads(getattr(prog_settings, 'eligible_schedule_ids', '[]') or '[]')}
    except Exception:
        eligible_ids = set()

    prog_events = [e for e in active_events if getattr(e, 'kind', '') in ('media', 'playlist', 'programme')]
    if not prog_events:
        return {
            'active': False,
            'phase': None,
            'reason': 'not_scheduled_programme',
            'has_next': False,
            'text': '',
            'subtext': '',
            'schedule_id': None,
            'next_schedule_id': None,
        }

    current_prog = prog_events[0]
    cat = (getattr(current_prog, 'programme_category', None) or 'general').lower()
    explicitly_enabled = bool(getattr(current_prog, 'enable_programme_cg', False))
    is_eligible = explicitly_enabled or (current_prog.id in eligible_ids) or (cat != 'general' and cat in eligible_cats)
    if not is_eligible:
        return {'active': False, 'phase': None, 'text': '', 'subtext': '', 'schedule_id': None, 'next_schedule_id': None}

    # Compute elapsed seconds since current_prog started
    dur = float(getattr(current_prog, 'duration_sec', None) or 3600)
    if elapsed_override_sec is not None:
        elapsed = float(elapsed_override_sec)
    else:
        try:
            dt = datetime.fromisoformat(current_prog.starts_at.replace('Z', '+00:00'))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=tz)
            dt = dt.astimezone(tz)
            if getattr(current_prog, 'repeat', 'none') in ('daily', 'weekly'):
                target = now.replace(hour=dt.hour, minute=dt.minute, second=dt.second, microsecond=0)
                if current_prog.repeat == 'weekly':
                    target -= timedelta(days=(target.weekday() - dt.weekday()) % 7)
                if target > now:
                    target -= timedelta(days=7 if current_prog.repeat == 'weekly' else 1)
                dt = target
            elapsed = max(0.0, (now - dt).total_seconds())
        except Exception:
            elapsed = 0.0

    show_start = bool(getattr(prog_settings, 'show_at_start', True))
    start_delay = float(getattr(prog_settings, 'start_delay_sec', 10) or 10)
    start_dur = float(getattr(prog_settings, 'start_duration_sec', 12) or 12)
    show_end = bool(getattr(prog_settings, 'show_before_end', True))
    end_lead = float(getattr(prog_settings, 'end_lead_sec', 45) or 45)
    end_dur = float(getattr(prog_settings, 'end_duration_sec', 12) or 12)

    phase = None
    if show_start and start_delay <= elapsed < (start_delay + start_dur):
        phase = 'start'
    elif show_end and dur > (start_delay + start_dur + end_lead):
        end_w0 = dur - end_lead
        if end_w0 <= elapsed < (end_w0 + end_dur):
            phase = 'end'

    if not phase:
        return {'active': False, 'phase': None, 'text': '', 'subtext': '', 'schedule_id': current_prog.id, 'next_schedule_id': None}

    # Find next upcoming programme schedule (if any)
    upcoming_candidates = []
    for s in schedules:
        if not getattr(s, 'enabled', False) or getattr(s, 'status', 'scheduled') in ('paused', 'cancelled'):
            continue
        if s.id == current_prog.id or getattr(s, 'kind', '') not in ('media', 'playlist', 'programme'):
            continue
        try:
            sdt = datetime.fromisoformat(s.starts_at.replace('Z', '+00:00'))
            if sdt.tzinfo is None:
                sdt = sdt.replace(tzinfo=tz)
            sdt = sdt.astimezone(tz)
            if getattr(s, 'repeat', 'none') == 'daily':
                cand = now.replace(hour=sdt.hour, minute=sdt.minute, second=sdt.second, microsecond=0)
                if cand <= now:
                    cand += timedelta(days=1)
                sdt = cand
            elif getattr(s, 'repeat', 'none') == 'weekly':
                cand = now.replace(hour=sdt.hour, minute=sdt.minute, second=sdt.second, microsecond=0)
                days_ahead = (sdt.weekday() - cand.weekday()) % 7
                cand += timedelta(days=days_ahead)
                if cand <= now:
                    cand += timedelta(days=7)
                sdt = cand
            if sdt > now:
                upcoming_candidates.append((sdt, s))
        except Exception:
            continue

    upcoming_candidates.sort(key=lambda pair: pair[0])
    next_pair = upcoming_candidates[0] if upcoming_candidates else None

    tpl_key = getattr(prog_settings, 'template_key', 'programme_now_next') or 'programme_now_next'
    prefix_map = {
        'programme_now_showing': 'NOW SHOWING',
        'programme_now_next': 'NOW SHOWING',
        'next_programme': 'NEXT PROGRAMME',
        'upcoming': 'UPCOMING',
        'programme_starting_soon': 'PROGRAMME STARTING SOON',
        'current_programme_title': 'CURRENT PROGRAMME',
    }
    prefix = prefix_map.get(tpl_key, 'NOW SHOWING')

    parts = []
    if getattr(prog_settings, 'show_title', True):
        parts.append(f"{prefix}: {current_prog.name}")
    else:
        parts.append(prefix)
    if getattr(prog_settings, 'show_category', True) and cat and cat != 'general':
        parts.append(f"[{cat.upper()}]")
    headline = '  '.join(parts)

    sub_parts = []
    if getattr(prog_settings, 'show_next', True) and next_pair is not None:
        next_dt, next_sched = next_pair
        time_str = f" — {next_dt.strftime('%I:%M %p').lstrip('0')}" if getattr(prog_settings, 'show_time', True) else ''
        sub_parts.append(f"NEXT: {next_sched.name}{time_str}")
    elif getattr(prog_settings, 'show_time', True) and not next_pair:
        # When there is no valid next programme, DO NOT show a NEXT field
        sub_parts.append('')

    subtext = '  |  '.join([p for p in sub_parts if p])
    return {
        'active': True,
        'phase': phase,
        'has_next': next_pair is not None,
        'text': headline,
        'subtext': subtext,
        'schedule_id': current_prog.id,
        'next_schedule_id': next_pair[1].id if next_pair else None,
        'template_key': tpl_key,
    }
