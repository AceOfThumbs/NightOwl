/* nightowl.js */
(() => {
  const MINUTES_IN_DAY = 24 * 60;
  const STORAGE_KEY = 'nightowl.events.v2';
  const PREFS_KEY = 'nightowl.prefs.v2';
  const OVERRIDE_KEY = 'nightowl.override.v1';
  const SNAP_DEFAULT = 5;
  const SNAP_ALT = 1;
  const SNAP_SHIFT = 15;
  const MIN_EVENT_DURATION = 10;
  const MAX_TEXT_SCALE = 1.35;
  const MIN_TEXT_SCALE = 0.85;
  const TEXT_SCALE_STEP = 0.1;

  const $ = (id) => document.getElementById(id);
  const dayRing = $('dayRing');
  const nextEventLabel = $('nextEventLabel');
  const dayList = $('dayList');
  const addDayItemBtn = $('addDayItem');
  const filterChips = Array.from(document.querySelectorAll('.chip'));
  const timezoneToggle = $('timezoneToggle');
  const timeZoneSelect = $('timeZone');
  const targetDateInput = $('targetDate');
  const plannerModeSelect = $('plannerMode');
  const plannerModeLabel = $('plannerModeLabel');
  const targetTimeInput = $('targetTime');
  const dailyStepRange = $('dailyStep');
  const dailyStepLabel = $('dailyStepLabel');
  const nudgeCardsEl = $('nudgeCards');
  const adjustmentCurveSelect = $('adjustmentCurve');
  const segmentBtns = Array.from(document.querySelectorAll('.segment-btn'));
  const textScaleDown = $('textScaleDown');
  const textScaleUp = $('textScaleUp');
  const themeButtons = Array.from(document.querySelectorAll('[data-theme-choice]'));
  const nowLabel = $('nowLabel');
  const feelsLikeLabel = $('feelsLikeLabel');
  const advancedToggle = $('advancedToggle');
  const advancedBody = $('advancedBody');
  const overrideInput = $('overrideInput');
  const applyOverrideBtn = $('applyOverride');
  const clearOverrideBtn = $('clearOverride');
  const overrideStatus = $('overrideStatus');
  const toastContainer = $('toastContainer');

  const timezoneLocations = {
    local: { label: 'Local', lat: 40.7128, lon: -74.006 },
    UTC: { label: 'UTC', lat: 0, lon: 0 },
    'America/Los_Angeles': { label: 'America/Los_Angeles', lat: 34.0522, lon: -118.2437 },
    'America/Denver': { label: 'America/Denver', lat: 39.7392, lon: -104.9903 },
    'America/Chicago': { label: 'America/Chicago', lat: 41.8781, lon: -87.6298 },
    'America/New_York': { label: 'America/New_York', lat: 40.7128, lon: -74.006 },
    'Europe/London': { label: 'Europe/London', lat: 51.5072, lon: -0.1276 },
    'Europe/Paris': { label: 'Europe/Paris', lat: 48.8566, lon: 2.3522 },
    'Europe/Berlin': { label: 'Europe/Berlin', lat: 52.52, lon: 13.405 },
    'Asia/Tokyo': { label: 'Asia/Tokyo', lat: 35.6762, lon: 139.6503 },
    'Asia/Singapore': { label: 'Asia/Singapore', lat: 1.3521, lon: 103.8198 },
    'Australia/Sydney': { label: 'Australia/Sydney', lat: -33.8688, lon: 151.2093 }
  };

  const eventTypes = {
    sleep: { icon: '🌙', label: 'Sleep', colorKey: 'sleep', defaultDuration: 8 * 60 },
    wake: { icon: '☀️', label: 'Wake', colorKey: 'wake', defaultDuration: 30 },
    meal: { icon: '🍽️', label: 'Meal', colorKey: 'meal', defaultDuration: 45 },
    exercise: { icon: '🧘‍♀️', label: 'Exercise', colorKey: 'exercise', defaultDuration: 60 },
    work: { icon: '💼', label: 'Work', colorKey: 'work', defaultDuration: 8 * 60 },
    light: { icon: '💡', label: 'Bright light', colorKey: 'light', defaultDuration: 30 },
    custom: { icon: '⭐', label: 'Custom', colorKey: 'wake', defaultDuration: 60 }
  };

  const quickAddTemplates = [
    { type: 'sleep', title: 'Sleep', duration: 8 * 60 },
    { type: 'meal', title: 'Breakfast', duration: 30 },
    { type: 'meal', title: 'Lunch', duration: 60 },
    { type: 'meal', title: 'Dinner', duration: 45 },
    { type: 'exercise', title: 'Exercise', duration: 60 },
    { type: 'light', title: 'Bright-light block', duration: 30 },
    { type: 'custom', title: 'Note', duration: 30 },
    { type: 'work', title: 'Work', duration: 8 * 60 }
  ];

  const defaultEvents = () => [
    createEvent('sleep', 'Sleep', toMinutes('23:00'), toMinutes('07:00')),
    createEvent('wake', 'Wake up', toMinutes('07:00'), toMinutes('07:30')),
    createEvent('meal', 'Breakfast', toMinutes('07:30'), toMinutes('08:00')),
    createEvent('work', 'Work', toMinutes('09:00'), toMinutes('17:00')),
    createEvent('meal', 'Lunch', toMinutes('12:30'), toMinutes('13:15')),
    createEvent('exercise', 'Exercise', toMinutes('18:00'), toMinutes('19:00')),
    createEvent('meal', 'Dinner', toMinutes('19:30'), toMinutes('20:15'))
  ];

  const state = {
    events: [],
    selectedId: null,
    activeFilter: 'all',
    pointerDrag: null,
    openEditorId: null,
    timeZone: 'local',
    plannerMode: 'wake',
    plannerDirection: 'auto',
    targetTime: '07:30',
    targetDate: null,
    dailyStep: 30,
    adjustmentCurve: 'linear',
    nudgeDelta: 0,
    nudgePlan: [],
    textScale: 1,
    theme: document.documentElement.getAttribute('data-theme') || 'dark',
    overrideNow: null
  };

  state.targetDate = todayISO();

  const formatterCache = new Map();

  function todayISO() {
    const now = getNow();
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }

  function startOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function parseLocalDate(value) {
    if (!value) return null;
    const [year, month, day] = String(value).split('-').map(Number);
    if ([year, month, day].some((part) => Number.isNaN(part))) return null;
    return new Date(year, month - 1, day);
  }

  function getNow() {
    return state.overrideNow ? new Date(state.overrideNow) : new Date();
  }

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function toMinutes(time) {
    const [h = 0, m = 0] = String(time).split(':').map((p) => Number(p));
    return ((h * 60 + m) % MINUTES_IN_DAY + MINUTES_IN_DAY) % MINUTES_IN_DAY;
  }

  function minutesToTime(mins) {
    const m = ((mins % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
    return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  }

  function minutesToLabel(mins) {
    const m = ((mins % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
    const hours = Math.floor(m / 60);
    const minutes = pad(m % 60);
    return `${hours === 0 ? 12 : hours > 12 ? hours - 12 : hours}:${minutes} ${hours < 12 ? 'AM' : 'PM'}`;
  }

  function minutesDiff(start, end) {
    let diff = ((end - start) % MINUTES_IN_DAY + MINUTES_IN_DAY) % MINUTES_IN_DAY;
    if (diff === 0) diff = MINUTES_IN_DAY;
    return diff;
  }

  function createEvent(type, title, startMin, endMin) {
    const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `evt-${Math.random().toString(36).slice(2, 10)}`;
    return { id, type, title, startMin, endMin, repeat: 'daily' };
  }

  function loadState() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (stored && Array.isArray(stored.events)) {
        state.events = stored.events.map((evt) => ({ ...evt }));
      } else {
        state.events = defaultEvents();
      }
    } catch (err) {
      console.warn('Failed to load events', err);
      state.events = defaultEvents();
    }
    try {
      const prefs = JSON.parse(localStorage.getItem(PREFS_KEY) || 'null');
      if (prefs) {
        state.textScale = clamp(prefs.textScale ?? state.textScale, MIN_TEXT_SCALE, MAX_TEXT_SCALE);
        state.theme = prefs.theme === 'light' ? 'light' : 'dark';
        state.timeZone = prefs.timeZone || state.timeZone;
        state.targetTime = prefs.targetTime || state.targetTime;
        state.dailyStep = clamp(Number(prefs.dailyStep) || state.dailyStep, 5, 120);
        state.plannerMode = prefs.plannerMode || state.plannerMode;
        state.plannerDirection = prefs.plannerDirection || state.plannerDirection;
        state.adjustmentCurve = prefs.adjustmentCurve === 'curved' ? 'curved' : 'linear';
      }
    } catch (err) {
      console.warn('Failed to load prefs', err);
    }
    try {
      const overrideVal = localStorage.getItem(OVERRIDE_KEY);
      if (overrideVal) {
        const parsed = new Date(overrideVal);
        if (!Number.isNaN(parsed.getTime())) {
          state.overrideNow = parsed.toISOString();
        }
      }
    } catch (err) {
      console.warn('Failed to load override', err);
    }
  }

  function persistState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ events: state.events }));
    localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({
        textScale: state.textScale,
        theme: state.theme,
        timeZone: state.timeZone,
        targetTime: state.targetTime,
        dailyStep: state.dailyStep,
        plannerMode: state.plannerMode,
        plannerDirection: state.plannerDirection,
        adjustmentCurve: state.adjustmentCurve
      })
    );
    if (state.overrideNow) {
      localStorage.setItem(OVERRIDE_KEY, state.overrideNow);
    } else {
      localStorage.removeItem(OVERRIDE_KEY);
    }
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function createSVG(tag, attrs = {}) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attrs).forEach(([key, value]) => {
      el.setAttribute(key, value);
    });
    return el;
  }

  function angleFromMinutes(mins) {
    return (mins / MINUTES_IN_DAY) * 360;
  }

  function describeArc(cx, cy, r, startAngle, endAngle) {
    const start = polarToCartesian(cx, cy, r, endAngle);
    const end = polarToCartesian(cx, cy, r, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
  }

  function polarToCartesian(cx, cy, r, angleInDegrees) {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: cx + r * Math.cos(angleInRadians),
      y: cy + r * Math.sin(angleInRadians)
    };
  }

  function normaliseAngle(angle) {
    return ((angle % 360) + 360) % 360;
  }

  function minuteFromAngle(angle) {
    const normalised = normaliseAngle(angle);
    return Math.round((normalised / 360) * MINUTES_IN_DAY) % MINUTES_IN_DAY;
  }

  function formatDuration(minutes) {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hrs && mins) return `${hrs}h ${mins}m`;
    if (hrs) return `${hrs}h`;
    return `${mins}m`;
  }

  function getSnapStep(evt) {
    if (evt.shiftKey) return SNAP_SHIFT;
    if (evt.altKey) return SNAP_ALT;
    return SNAP_DEFAULT;
  }

  function snapMinutes(mins, step) {
    return Math.round(mins / step) * step;
  }

  function getFormatter(tz) {
    const key = tz || 'local';
    if (!formatterCache.has(key)) {
      const opts = { hour: '2-digit', minute: '2-digit', hour12: false };
      const fmt = key === 'local' ? new Intl.DateTimeFormat(undefined, opts) : new Intl.DateTimeFormat(undefined, { ...opts, timeZone: key });
      formatterCache.set(key, fmt);
    }
    return formatterCache.get(key);
  }

  function toTimeInZone(date, tz) {
    const fmt = getFormatter(tz);
    const parts = fmt.formatToParts(date);
    const hours = Number(parts.find((p) => p.type === 'hour')?.value || '0');
    const minutes = Number(parts.find((p) => p.type === 'minute')?.value || '0');
    return { hours, minutes };
  }

  function minutesInZone(date, tz) {
    const { hours, minutes } = toTimeInZone(date, tz);
    return (hours * 60 + minutes) % MINUTES_IN_DAY;
  }

  function rotatePoint(mins, radius, center, offset = 0) {
    const angle = ((mins / MINUTES_IN_DAY) * 360) - 90 + offset;
    return polarToCartesian(center, center, radius, angle + 90);
  }

  function applyTheme(theme) {
    const next = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    state.theme = next;
    themeButtons.forEach((btn) => {
      const choice = btn.getAttribute('data-theme-choice');
      btn.setAttribute('aria-pressed', choice === next ? 'true' : 'false');
    });
    persistState();
  }

  function applyTextScale(scale) {
    state.textScale = clamp(scale, MIN_TEXT_SCALE, MAX_TEXT_SCALE);
    document.documentElement.style.setProperty('--scale', state.textScale);
    if (textScaleDown) textScaleDown.disabled = state.textScale <= MIN_TEXT_SCALE + 0.001;
    if (textScaleUp) textScaleUp.disabled = state.textScale >= MAX_TEXT_SCALE - 0.001;
    persistState();
  }

  function setTimezone(tz) {
    state.timeZone = timezoneLocations[tz] ? tz : 'local';
    if (timeZoneSelect) timeZoneSelect.value = state.timeZone;
    updateTimezoneToggle();
    persistState();
    render();
  }

  function updateTimezoneToggle() {
    const tzLabel = timezoneLocations[state.timeZone]?.label || 'Local';
    timezoneToggle.textContent = `${tzLabel} · 24h`;
  }

  function getEventColor(type) {
    const key = eventTypes[type]?.colorKey || 'wake';
    return getComputedStyle(document.documentElement).getPropertyValue(`--${key}`).trim();
  }

  function render() {
    renderClock();
    renderDayList();
    renderNudgePlan();
    renderNextEventLabel();
  }

  function renderClock() {
    if (!dayRing) return;
    const size = 400;
    const center = size / 2;
    const radius = 150;
    dayRing.setAttribute('viewBox', `0 0 ${size} ${size}`);
    while (dayRing.firstChild) dayRing.removeChild(dayRing.firstChild);

    const backdrop = createSVG('circle', { cx: center, cy: center, r: radius, class: 'clock-backdrop' });
    dayRing.appendChild(backdrop);

    const { sunrise, sunset } = calculateSunTimes(state.timeZone);
    if (sunrise !== null && sunset !== null) {
      const daylightGroup = createSVG('g');
      const start = angleFromMinutes(sunrise);
      const end = angleFromMinutes(sunset);
      if (start !== end) {
        const daylightArc = createSVG('path', {
          d: describeArc(center, center, radius, start, end),
          class: 'clock-daylight'
        });
        daylightGroup.appendChild(daylightArc);
        const nightArc1 = createSVG('path', {
          d: describeArc(center, center, radius, end, start + 360),
          class: 'clock-night'
        });
        daylightGroup.appendChild(nightArc1);
        dayRing.appendChild(daylightGroup);
      }
    }

    for (let h = 0; h < 24; h++) {
      const angle = (h / 24) * 360;
      const cos = Math.cos(((angle - 90) * Math.PI) / 180);
      const sin = Math.sin(((angle - 90) * Math.PI) / 180);
      const line = createSVG('line', {
        x1: center + cos * (radius - 24),
        y1: center + sin * (radius - 24),
        x2: center + cos * (radius + 8),
        y2: center + sin * (radius + 8),
        class: 'clock-hour-tick'
      });
      dayRing.appendChild(line);
      const label = createSVG('text', {
        x: center + cos * (radius + 32),
        y: center + sin * (radius + 32) + 4,
        class: 'clock-hour-number'
      });
      label.textContent = pad(h);
      dayRing.appendChild(label);
    }

    const now = getNow();
    const nowMinutes = minutesInZone(now, state.timeZone);
    const nowHand = createSVG('line', {
      x1: center,
      y1: center,
      x2: center + Math.cos(((angleFromMinutes(nowMinutes) - 90) * Math.PI) / 180) * (radius + 10),
      y2: center + Math.sin(((angleFromMinutes(nowMinutes) - 90) * Math.PI) / 180) * (radius + 10),
      class: 'clock-now-hand'
    });
    dayRing.appendChild(nowHand);

    const feelsLikeMinutes = (nowMinutes + 30) % MINUTES_IN_DAY;
    const feelsLikeHand = createSVG('line', {
      x1: center,
      y1: center,
      x2: center + Math.cos(((angleFromMinutes(feelsLikeMinutes) - 90) * Math.PI) / 180) * (radius - 32),
      y2: center + Math.sin(((angleFromMinutes(feelsLikeMinutes) - 90) * Math.PI) / 180) * (radius - 32),
      class: 'clock-feels-hand'
    });
    dayRing.appendChild(feelsLikeHand);

    const centerDot = createSVG('circle', { cx: center, cy: center, r: 6, class: 'clock-center' });
    dayRing.appendChild(centerDot);

    renderEventArcs(center, radius);
    updateClockLabels(nowMinutes, feelsLikeMinutes);
  }

  function updateClockLabels(nowMinutes, feelsMinutes) {
    nowLabel.textContent = `Now · ${minutesToTime(nowMinutes)}`;
    feelsLikeLabel.textContent = `Feels like ${minutesToTime(feelsMinutes)}`;
  }

  function renderEventArcs(center, radius) {
    const filteredTypes = state.activeFilter === 'all' ? null : state.activeFilter;
    const events = state.events
      .filter((evt) => !filteredTypes || evt.type === filteredTypes)
      .slice()
      .sort(compareEvents);

    events.forEach((evt) => {
      drawEventArc(evt, center, radius);
    });

    if (state.selectedId) {
      const selected = events.find((evt) => evt.id === state.selectedId);
      if (selected) {
        drawHandles(selected, center, radius);
      }
    }
  }

  function shiftEvent(evt, delta) {
    const shift = ((delta % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
    return {
      ...evt,
      startMin: (evt.startMin + shift + MINUTES_IN_DAY) % MINUTES_IN_DAY,
      endMin: (evt.endMin + shift + MINUTES_IN_DAY) % MINUTES_IN_DAY
    };
  }

  function drawEventArc(evt, center, radius) {
    const segments = splitEvent(evt.startMin, evt.endMin);
    segments.forEach(([start, end]) => {
      const startAngle = angleFromMinutes(start);
      const endAngle = angleFromMinutes(end);
      const path = createSVG('path', {
        d: describeArc(center, center, radius, startAngle, endAngle < startAngle ? endAngle + 360 : endAngle),
        class: 'arc-path',
        'data-type': evt.type,
        'data-event-id': evt.id,
        'data-selected': state.selectedId === evt.id ? 'true' : 'false',
        stroke: getEventColor(evt.type)
      });
      path.addEventListener('pointerenter', () => handleArcHover(evt.id));
      path.addEventListener('pointerleave', () => handleArcHover(null));
      path.addEventListener('click', (event) => {
        event.stopPropagation();
        selectEvent(evt.id);
      });
      dayRing.appendChild(path);
    });
  }

  function splitEvent(start, end) {
    if (start === end) return [[start, (end + MINUTES_IN_DAY - 1) % MINUTES_IN_DAY]];
    if (end > start) return [[start, end]];
    return [
      [start, MINUTES_IN_DAY],
      [0, end]
    ];
  }

  function drawHandles(evt, center, radius) {
    const startPoint = rotatePoint(evt.startMin, radius, center);
    const endPoint = rotatePoint(evt.endMin, radius, center);
    const startHandle = createSVG('circle', {
      cx: startPoint.x,
      cy: startPoint.y,
      r: 10,
      class: 'arc-handle',
      'data-handle': 'start',
      'data-event-id': evt.id
    });
    const endHandle = createSVG('circle', {
      cx: endPoint.x,
      cy: endPoint.y,
      r: 10,
      class: 'arc-handle',
      'data-handle': 'end',
      'data-event-id': evt.id
    });
    [startHandle, endHandle].forEach((handle) => {
      handle.addEventListener('pointerdown', handlePointerStart);
      handle.addEventListener('keydown', (evtKey) => handleKeyboardResize(evtKey, handle.dataset.handle));
    });
    dayRing.appendChild(startHandle);
    dayRing.appendChild(endHandle);
  }

  function compareEvents(a, b) {
    const aIsSleep = a.type === 'sleep';
    const bIsSleep = b.type === 'sleep';
    if (aIsSleep !== bIsSleep) {
      return aIsSleep ? 1 : -1;
    }
    if (a.startMin !== b.startMin) {
      return a.startMin - b.startMin;
    }
    const titleA = (a.title || '').toLowerCase();
    const titleB = (b.title || '').toLowerCase();
    if (titleA === titleB) return 0;
    return titleA > titleB ? 1 : -1;
  }

  function handleArcHover(id) {
    const items = dayList.querySelectorAll('.day-item');
    items.forEach((item) => {
      item.dataset.hover = item.dataset.id === id ? 'true' : 'false';
    });
  }

  function selectEvent(id) {
    state.selectedId = id;
    render();
  }

  function handlePointerStart(evt) {
    evt.preventDefault();
    const id = evt.currentTarget.getAttribute('data-event-id');
    const edge = evt.currentTarget.getAttribute('data-handle');
    state.pointerDrag = { id, edge };
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerEnd);
    document.addEventListener('pointercancel', handlePointerEnd);
  }

  function handlePointerMove(evt) {
    if (!state.pointerDrag) return;
    evt.preventDefault();
    const { id, edge } = state.pointerDrag;
    const event = state.events.find((e) => e.id === id);
    if (!event) return;
    const minutes = snapMinutes(getMinutesFromPointer(evt), getSnapStep(evt));
    if (edge === 'start') {
      const duration = minutesDiff(minutes, event.endMin);
      if (duration >= MIN_EVENT_DURATION) {
        event.startMin = minutes;
      }
    } else {
      const duration = minutesDiff(event.startMin, minutes);
      if (duration >= MIN_EVENT_DURATION) {
        event.endMin = minutes;
      }
    }
    persistState();
    render();
  }

  function handlePointerEnd(evt) {
    if (!state.pointerDrag) return;
    evt.preventDefault();
    state.pointerDrag = null;
    document.removeEventListener('pointermove', handlePointerMove);
    document.removeEventListener('pointerup', handlePointerEnd);
    document.removeEventListener('pointercancel', handlePointerEnd);
    render();
  }

  function handleKeyboardResize(evt, edge) {
    const increment = evt.shiftKey ? SNAP_SHIFT : SNAP_DEFAULT;
    if (!['ArrowLeft', 'ArrowRight'].includes(evt.key)) return;
    evt.preventDefault();
    const id = evt.target.getAttribute('data-event-id');
    const event = state.events.find((e) => e.id === id);
    if (!event) return;
    const delta = evt.key === 'ArrowRight' ? increment : -increment;
    if (edge === 'start') {
      const next = (event.startMin + delta + MINUTES_IN_DAY) % MINUTES_IN_DAY;
      const duration = minutesDiff(next, event.endMin);
      if (duration >= MIN_EVENT_DURATION) {
        event.startMin = next;
      }
    } else {
      const next = (event.endMin + delta + MINUTES_IN_DAY) % MINUTES_IN_DAY;
      const duration = minutesDiff(event.startMin, next);
      if (duration >= MIN_EVENT_DURATION) {
        event.endMin = next;
      }
    }
    persistState();
    render();
  }

  function getMinutesFromPointer(evt) {
    const rect = dayRing.getBoundingClientRect();
    const x = evt.clientX - rect.left;
    const y = evt.clientY - rect.top;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const angle = (Math.atan2(y - cy, x - cx) * 180) / Math.PI + 90;
    return minuteFromAngle(angle);
  }

  function renderDayList() {
    if (!dayList) return;
    dayList.innerHTML = '';
    if (!state.events.length) {
      const empty = document.createElement('li');
      empty.className = 'text-muted';
      empty.textContent = 'No events yet. Add items to build your day.';
      dayList.appendChild(empty);
      return;
    }
    const events = state.events
      .filter((evt) => state.activeFilter === 'all' || evt.type === state.activeFilter)
      .slice()
      .sort(compareEvents);
    if (!events.length) {
      const empty = document.createElement('li');
      empty.className = 'text-muted';
      empty.textContent = state.events.length
        ? 'No events match the current filter.'
        : 'No events yet. Add items to build your day.';
      dayList.appendChild(empty);
      return;
    }

    events.forEach((evt) => {
        const li = document.createElement('li');
        li.className = 'day-item';
        li.dataset.id = evt.id;
        if (evt.id === state.selectedId) {
          li.dataset.selected = 'true';
        }
        const meta = eventTypes[evt.type] || eventTypes.custom;
        const icon = document.createElement('div');
        icon.className = 'day-item__icon';
        icon.textContent = meta.icon;

        const titleWrap = document.createElement('div');
        titleWrap.className = 'day-item__title';
        const titleInput = document.createElement('input');
        titleInput.type = 'text';
        titleInput.value = evt.title;
        titleInput.setAttribute('aria-label', 'Event title');
        titleInput.addEventListener('change', () => {
          evt.title = titleInput.value.trim() || evt.title;
          persistState();
          renderNextEventLabel();
        });
        const durationLabel = document.createElement('span');
        durationLabel.className = 'text-muted';
        durationLabel.textContent = formatDuration(minutesDiff(evt.startMin, evt.endMin));
        titleWrap.appendChild(titleInput);
        titleWrap.appendChild(durationLabel);

        const timeButton = document.createElement('button');
        timeButton.className = 'day-item__time';
        timeButton.type = 'button';
        timeButton.setAttribute('aria-label', `Edit time for ${evt.title}`);
        const timeRange = document.createElement('span');
        timeRange.className = 'day-item__time-range';
        timeRange.textContent = `${minutesToLabel(evt.startMin)} – ${minutesToLabel(evt.endMin)}`;
        const timeHint = document.createElement('span');
        timeHint.className = 'day-item__time-hint';
        timeHint.textContent = 'Edit';
        timeButton.appendChild(timeRange);
        timeButton.appendChild(timeHint);
        const isEditing = state.openEditorId === evt.id;
        timeButton.setAttribute('aria-expanded', isEditing ? 'true' : 'false');
        timeButton.addEventListener('click', () => toggleTimeEditor(evt.id));

        const actions = document.createElement('div');
        actions.className = 'day-item__actions';
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-ghost';
        deleteBtn.type = 'button';
        deleteBtn.setAttribute('aria-label', 'Delete event');
        deleteBtn.textContent = '✕';
        deleteBtn.addEventListener('click', () => removeEvent(evt.id));
        actions.appendChild(deleteBtn);

        li.appendChild(icon);
        li.appendChild(titleWrap);
        li.appendChild(timeButton);
        li.appendChild(actions);

        if (isEditing) {
          li.appendChild(buildTimeEditor(evt));
        }

        li.addEventListener('click', (event) => {
          const target = event.target;
          if (
            target === deleteBtn ||
            target === titleInput ||
            target === timeButton ||
            target.closest?.('.time-editor')
          ) {
            return;
          }
          selectEvent(evt.id);
        });

        dayList.appendChild(li);
      });
  }

  function toggleTimeEditor(id) {
    state.openEditorId = state.openEditorId === id ? null : id;
    render();
  }

  function buildTimeEditor(evt) {
    const editor = document.createElement('div');
    editor.className = 'time-editor';
    editor.setAttribute('role', 'group');

    const startField = createTimeField('Start', minutesToTime(evt.startMin));
    const endField = createTimeField('End', minutesToTime(evt.endMin));

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-primary';
    saveBtn.type = 'button';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', () => {
      const start = toMinutes(startField.input.value);
      const end = toMinutes(endField.input.value);
      if (minutesDiff(start, end) < MIN_EVENT_DURATION) {
        showToast('Event must be at least 10 minutes long', 'error');
        return;
      }
      evt.startMin = start;
      evt.endMin = end;
      state.openEditorId = null;
      persistState();
      render();
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-ghost';
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => {
      state.openEditorId = null;
      render();
    });

    const actions = document.createElement('div');
    actions.className = 'time-editor__actions';
    actions.appendChild(saveBtn);
    actions.appendChild(cancelBtn);

    editor.appendChild(startField.field);
    editor.appendChild(endField.field);
    editor.appendChild(actions);

    requestAnimationFrame(() => startField.input.focus());

    return editor;
  }

  function createTimeField(labelText, value) {
    const field = document.createElement('label');
    field.className = 'time-editor__field';
    const label = document.createElement('span');
    label.className = 'time-editor__label';
    label.textContent = labelText;
    const input = document.createElement('input');
    input.type = 'time';
    input.value = value;
    input.step = SNAP_DEFAULT * 60;
    field.appendChild(label);
    field.appendChild(input);
    return { field, input };
  }

  function addEventFromTemplate(template, startMinutes) {
    const eventStart = typeof startMinutes === 'number' ? startMinutes : guessOpenMinute();
    const event = createEvent(template.type, template.title, eventStart, (eventStart + template.duration) % MINUTES_IN_DAY);
    state.events.push(event);
    state.selectedId = event.id;
    persistState();
    render();
    showToast(`${template.title} added`, 'success');
  }

  function removeEvent(id) {
    state.events = state.events.filter((evt) => evt.id !== id);
    if (state.selectedId === id) state.selectedId = null;
    if (state.openEditorId === id) state.openEditorId = null;
    persistState();
    render();
  }

  function guessOpenMinute() {
    if (!state.events.length) return toMinutes('09:00');
    const sorted = state.events.slice().sort((a, b) => a.startMin - b.startMin);
    return (sorted[sorted.length - 1].endMin + 30) % MINUTES_IN_DAY;
  }

  function renderNextEventLabel() {
    if (!nextEventLabel) return;
    const nowMinutes = minutesInZone(getNow(), state.timeZone);
    const upcoming = state.events
      .map((evt) => ({ ...evt, minutesUntil: ((evt.startMin - nowMinutes + MINUTES_IN_DAY) % MINUTES_IN_DAY) }))
      .sort((a, b) => a.minutesUntil - b.minutesUntil)[0];
    if (!upcoming) {
      nextEventLabel.hidden = true;
      return;
    }
    nextEventLabel.hidden = false;
    nextEventLabel.textContent = `${upcoming.title} in ${formatDuration(upcoming.minutesUntil)}`;
    positionLabelForEvent(upcoming, nextEventLabel);
  }

  function positionLabelForEvent(evt, element) {
    const rect = dayRing.getBoundingClientRect();
    const overlayRect = element.offsetParent?.getBoundingClientRect() || rect;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const angle = ((evt.startMin / MINUTES_IN_DAY) * 360) - 90;
    const radius = rect.width / 2 * 0.85;
    const x = centerX + Math.cos((angle * Math.PI) / 180) * radius - overlayRect.left;
    const y = centerY + Math.sin((angle * Math.PI) / 180) * radius - overlayRect.top;
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
  }

  function showToast(message, variant = 'info', duration = 2600) {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${variant}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('toast-visible'));
    setTimeout(() => {
      toast.classList.remove('toast-visible');
      setTimeout(() => toast.remove(), 180);
    }, duration);
  }

  function populateTimeZoneSelect() {
    const tzs = Object.keys(timezoneLocations);
    tzs.forEach((tz) => {
      const option = document.createElement('option');
      option.value = tz;
      option.textContent = timezoneLocations[tz].label;
      timeZoneSelect.appendChild(option);
    });
  }

  function calculateSunTimes(timeZone) {
    const loc = timezoneLocations[timeZone] || timezoneLocations.local;
    const now = getNow();
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sun = solarSunriseSunset(date, loc.lat, loc.lon);
    if (!sun) return { sunrise: null, sunset: null };
    return sun;
  }

  function solarSunriseSunset(date, latitude, longitude) {
    const rad = Math.PI / 180;
    const J1970 = 2440588;
    const J2000 = 2451545;
    const dayMs = 1000 * 60 * 60 * 24;
    const lw = -longitude * rad;
    const phi = latitude * rad;
    const toJulian = (date) => date.valueOf() / dayMs - 0.5 + J1970;
    const fromJulian = (j) => new Date((j + 0.5 - J1970) * dayMs);
    const solarMeanAnomaly = (d) => rad * (357.5291 + 0.98560028 * d);
    const eclipticLongitude = (M) => {
      const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
      const P = rad * 102.9372;
      return M + C + P + Math.PI;
    };
    const sunDeclination = (L) => Math.asin(Math.sin(L) * Math.sin(rad * 23.44));
    const hourAngle = (h, phi, d) => Math.acos((Math.sin(h) - Math.sin(phi) * Math.sin(d)) / (Math.cos(phi) * Math.cos(d)));
    const approxTransit = (ds, M, L) => J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);

    const d = toJulian(date) - J2000;
    const J0 = 0.0009;
    const n = Math.round(d - J0 - lw / (2 * Math.PI));
    const ds = n + J0 + lw / (2 * Math.PI);
    const M = solarMeanAnomaly(ds);
    const L = eclipticLongitude(M);
    const dec = sunDeclination(L);
    const h0 = -0.83 * rad;
    const w = hourAngle(h0, phi, dec);
    let Jrise = approxTransit(ds, M, L) - w / (2 * Math.PI);
    let Jset = approxTransit(ds, M, L) + w / (2 * Math.PI);
    if (Number.isNaN(Jrise) || Number.isNaN(Jset)) return null;
    // Ensure rise < set
    if (Jset < Jrise) Jset += 1;
    const sunriseDate = fromJulian(Jrise);
    const sunsetDate = fromJulian(Jset);
    const sunrise = minutesInZone(sunriseDate, state.timeZone);
    const sunset = minutesInZone(sunsetDate, state.timeZone);
    if (Number.isNaN(sunrise) || Number.isNaN(sunset)) return null;
    return { sunrise, sunset };
  }

  function easeLinear(t) {
    return t;
  }

  function easeInOut(t) {
    return 0.5 - 0.5 * Math.cos(Math.PI * t);
  }

  function formatShiftMinutes(value) {
    const rounded = Math.round(value * 10) / 10;
    if (Math.abs(rounded) < 0.05) return 'Shift 0 min';
    const display = Number.isInteger(rounded) ? Math.round(rounded) : rounded.toFixed(1);
    return `Shift ${rounded > 0 ? '+' : ''}${display} min`;
  }

  function renderNudgePlan() {
    const sleepEvent = state.events.find((evt) => evt.type === 'sleep');
    if (!sleepEvent) {
      nudgeCardsEl.innerHTML = '<p class="text-muted">Add a sleep block to enable nudges.</p>';
      state.nudgePlan = [];
      state.nudgeDelta = 0;
      return;
    }

    const currentStart = sleepEvent.startMin;
    const currentEnd = sleepEvent.endMin;
    const sleepDuration = minutesDiff(currentStart, currentEnd);
    const reference = state.plannerMode === 'wake' ? currentEnd : currentStart;
    const targetMinutes = toMinutes(state.targetTime);
    let diff = ((targetMinutes - reference + MINUTES_IN_DAY) % MINUTES_IN_DAY + MINUTES_IN_DAY) % MINUTES_IN_DAY;
    if (diff > MINUTES_IN_DAY / 2) diff -= MINUTES_IN_DAY;
    if (state.plannerDirection === 'earlier' && diff > 0) diff -= MINUTES_IN_DAY;
    if (state.plannerDirection === 'later' && diff < 0) diff += MINUTES_IN_DAY;

    const step = clamp(Number(state.dailyStep) || 30, 5, 120);
    const today = startOfDay(getNow());
    const targetDate = parseLocalDate(state.targetDate) || today;
    const direction = targetDate >= today ? 1 : -1;
    const dayMs = 24 * 60 * 60 * 1000;
    const totalDays = Math.abs(Math.round((targetDate - today) / dayMs)) + 1;
    const easeFn = state.adjustmentCurve === 'curved' ? easeInOut : easeLinear;
    const cumulativeTargets = [];

    for (let i = 0; i < totalDays; i++) {
      const progress = totalDays === 1 ? 1 : (i + 1) / totalDays;
      cumulativeTargets[i] = diff * easeFn(progress);
    }

    let appliedShift = 0;
    const plan = [];
    const startDate = new Date(today);

    for (let i = 0; i < totalDays; i++) {
      const dayDate = new Date(startDate);
      dayDate.setDate(startDate.getDate() + i * direction);
      let targetShift = cumulativeTargets[i] - appliedShift;
      let shift;

      if (i === totalDays - 1) {
        shift = diff - appliedShift;
        appliedShift = diff;
      } else if (Math.abs(targetShift) > step) {
        shift = Math.sign(targetShift) * step;
        appliedShift += shift;
        const overshoot = targetShift - shift;
        for (let j = i + 1; j < cumulativeTargets.length; j++) {
          cumulativeTargets[j] -= overshoot;
        }
      } else {
        shift = targetShift;
        appliedShift += shift;
      }

      const running = (reference + appliedShift + MINUTES_IN_DAY) % MINUTES_IN_DAY;
      const wake = state.plannerMode === 'wake' ? running : (running + sleepDuration) % MINUTES_IN_DAY;
      const sleep =
        state.plannerMode === 'wake'
          ? (running - sleepDuration + MINUTES_IN_DAY) % MINUTES_IN_DAY
          : running;
      const label = dayDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      plan.push({ label, wake, sleep, shift });
    }

    state.nudgePlan = plan;
    state.nudgeDelta = diff;

    nudgeCardsEl.innerHTML = '';
    plan.forEach((entry) => {
      const card = document.createElement('div');
      card.className = 'nudge-card';
      const label = document.createElement('div');
      label.className = 'nudge-card__label';
      const shiftText = formatShiftMinutes(entry.shift || 0);
      label.innerHTML = `<strong>${entry.label}</strong><span class="text-muted">${shiftText} · Wake ${minutesToLabel(entry.wake)} · Sleep ${minutesToLabel(entry.sleep)}</span>`;
      const mini = createMiniRing(entry);
      card.appendChild(label);
      card.appendChild(mini);
      nudgeCardsEl.appendChild(card);
    });
  }

  function createMiniRing(entry) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('class', 'nudge-card__mini');
    const center = 50;
    const radius = 32;
    const background = createSVG('circle', { cx: center, cy: center, r: radius, class: 'clock-backdrop' });
    svg.appendChild(background);
    const segments = splitEvent(entry.sleep, entry.wake);
    segments.forEach(([start, end]) => {
      const path = describeArc(
        center,
        center,
        radius,
        angleFromMinutes(start),
        angleFromMinutes(end < start ? end + MINUTES_IN_DAY : end)
      );
      const arc = createSVG('path', { d: path, class: 'arc-path', stroke: getEventColor('sleep') });
      svg.appendChild(arc);
    });
    return svg;
  }

  function setPlannerDirection(dir) {
    state.plannerDirection = dir;
    segmentBtns.forEach((btn) => btn.setAttribute('aria-checked', btn.dataset.dir === dir ? 'true' : 'false'));
    persistState();
    renderNudgePlan();
  }

  function updatePlannerMode(mode) {
    state.plannerMode = mode;
    plannerModeSelect.value = mode;
    plannerModeLabel.textContent = mode === 'wake' ? 'wake' : 'sleep';
    persistState();
    renderNudgePlan();
  }

  function updateAdjustmentCurve(value) {
    state.adjustmentCurve = value === 'curved' ? 'curved' : 'linear';
    if (adjustmentCurveSelect) adjustmentCurveSelect.value = state.adjustmentCurve;
    persistState();
    renderNudgePlan();
  }

  function updateDailyStep(value) {
    state.dailyStep = clamp(Number(value) || 30, 5, 120);
    dailyStepRange.value = state.dailyStep;
    dailyStepLabel.textContent = `±${state.dailyStep} min`;
    persistState();
    renderNudgePlan();
  }

  function updateTargetTime(value) {
    if (!value) return;
    state.targetTime = value;
    persistState();
    renderNudgePlan();
  }

  function updateTargetDate(value) {
    state.targetDate = value || todayISO();
    persistState();
    renderNudgePlan();
  }

  function setFilter(filter) {
    state.activeFilter = filter;
    filterChips.forEach((chip) => chip.classList.toggle('chip-active', chip.dataset.filter === filter));
    render();
  }

  function handleRingPointerDown(evt) {
    if (evt.target.closest('.arc-path') || evt.target.closest('.arc-handle')) return;
    state.selectedId = null;
    render();
  }

  function initQuickAddMenu() {
    if (!addDayItemBtn) return;
    const menu = document.createElement('div');
    menu.className = 'quick-add-menu';
    menu.style.display = 'none';
    quickAddTemplates.forEach((template) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-secondary';
      btn.textContent = `${eventTypes[template.type]?.icon || '⭐'} ${template.title}`;
      btn.addEventListener('click', () => {
        menu.style.display = 'none';
        addEventFromTemplate(template);
      });
      menu.appendChild(btn);
    });
    addDayItemBtn.insertAdjacentElement('afterend', menu);
    addDayItemBtn.addEventListener('click', () => {
      menu.style.display = menu.style.display === 'none' ? 'grid' : 'none';
    });
  }

  function updateOverrideUI() {
    if (state.overrideNow) {
      overrideStatus.textContent = `Overriding now: ${new Date(state.overrideNow).toLocaleString()}`;
      overrideInput.value = state.overrideNow.slice(0, 16);
    } else {
      overrideStatus.textContent = 'Using real current time.';
      overrideInput.value = '';
    }
  }

  function applyOverride() {
    const value = overrideInput.value;
    if (!value) return;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      showToast('Invalid override date', 'error');
      return;
    }
    state.overrideNow = parsed.toISOString();
    persistState();
    updateOverrideUI();
    render();
    showToast('Override applied', 'success');
  }

  function clearOverride() {
    state.overrideNow = null;
    persistState();
    updateOverrideUI();
    render();
    showToast('Override cleared', 'info');
  }

  function initAdvancedAccordion() {
    advancedToggle.addEventListener('click', () => {
      const expanded = advancedToggle.getAttribute('aria-expanded') === 'true';
      advancedToggle.setAttribute('aria-expanded', expanded ? 'false' : 'true');
      advancedBody.hidden = expanded;
    });
  }

  function initRingInteraction() {
    dayRing.addEventListener('pointerdown', handleRingPointerDown);
  }

  function initFilterChips() {
    filterChips.forEach((chip) => chip.addEventListener('click', () => setFilter(chip.dataset.filter)));
  }

  function initSegmentControl() {
    segmentBtns.forEach((btn) => btn.addEventListener('click', () => setPlannerDirection(btn.dataset.dir)));
  }

  function initThemeButtons() {
    themeButtons.forEach((btn) => {
      btn.addEventListener('click', () => applyTheme(btn.getAttribute('data-theme-choice')));
    });
  }

  function initTextScaling() {
    if (textScaleDown) textScaleDown.addEventListener('click', () => applyTextScale(state.textScale - TEXT_SCALE_STEP));
    if (textScaleUp) textScaleUp.addEventListener('click', () => applyTextScale(state.textScale + TEXT_SCALE_STEP));
    applyTextScale(state.textScale);
  }

  function initPlannerControls() {
    if (plannerModeSelect) plannerModeSelect.addEventListener('change', (evt) => updatePlannerMode(evt.target.value));
    if (targetTimeInput) targetTimeInput.addEventListener('change', (evt) => updateTargetTime(evt.target.value));
    if (targetDateInput) targetDateInput.addEventListener('change', (evt) => updateTargetDate(evt.target.value));
    if (dailyStepRange) dailyStepRange.addEventListener('input', (evt) => updateDailyStep(evt.target.value));
    if (adjustmentCurveSelect) adjustmentCurveSelect.addEventListener('change', (evt) => updateAdjustmentCurve(evt.target.value));
    plannerModeSelect.value = state.plannerMode;
    targetTimeInput.value = state.targetTime;
    targetDateInput.value = state.targetDate;
    dailyStepRange.value = state.dailyStep;
    dailyStepLabel.textContent = `±${state.dailyStep} min`;
    plannerModeLabel.textContent = state.plannerMode === 'wake' ? 'wake' : 'sleep';
    if (adjustmentCurveSelect) adjustmentCurveSelect.value = state.adjustmentCurve;
    segmentBtns.forEach((btn) => btn.setAttribute('aria-checked', btn.dataset.dir === state.plannerDirection ? 'true' : 'false'));
  }

  function initTimezoneControls() {
    populateTimeZoneSelect();
    setTimezone(state.timeZone);
    timeZoneSelect.addEventListener('change', (evt) => setTimezone(evt.target.value));
    timezoneToggle.addEventListener('click', () => {
      timeZoneSelect.focus();
      const options = Array.from(timeZoneSelect.options);
      const current = options.findIndex((opt) => opt.value === state.timeZone);
      const next = (current + 1) % options.length;
      setTimezone(options[next].value);
    });
  }

  function initOverrideControls() {
    applyOverrideBtn.addEventListener('click', applyOverride);
    clearOverrideBtn.addEventListener('click', clearOverride);
    updateOverrideUI();
  }

  function init() {
    loadState();
    applyTheme(state.theme);
    initTextScaling();
    initThemeButtons();
    initTimezoneControls();
    initPlannerControls();
    initFilterChips();
    initSegmentControl();
    initRingInteraction();
    initQuickAddMenu();
    initAdvancedAccordion();
    initOverrideControls();
    render();
    setInterval(() => {
      renderClock();
      renderNextEventLabel();
    }, 60000);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
