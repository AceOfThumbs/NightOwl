/* nightowl.js */
(() => {
  const MINUTES_IN_DAY = 24 * 60;
  const STORAGE_KEY = 'nightowl.events.v2';
  const PREFS_KEY = 'nightowl.prefs.v2';
  const OVERRIDE_KEY = 'nightowl.override.v1';
  const SNAP_DEFAULT = 5;
  const SNAP_ALT = 1;
  const SNAP_SHIFT = 15;
  const MIN_EXPORT_DURATION = 1;
  const TEXT_SCALE_STEP = 0.1;
  const SHARE_HASH_KEY = 'p';
  const SAVED_PLANNER_KEY = 'nightowl.savedPlanner.v1';

  const $ = (id) => document.getElementById(id);
  const dayRing = $('dayRing');
  const nextEventLabel = $('nextEventLabel');
  const yourDayRing = $('yourDayRing');
  const yourNextEventLabel = $('yourNextEventLabel');
  const dayList = $('dayList');
  const addDayItemBtn = $('addDayItem');
  const filterChips = Array.from(document.querySelectorAll('.chip'));
  const displayTimeZonePickerRoot = $('displayTimeZonePicker');
  const plannerTimeZonePickerRoot = $('plannerTimeZonePicker');
  const timeFormatToggle = $('timeFormatToggle');
  const targetDateInput = $('targetDate');
  const plannerModeSelect = $('plannerMode');
  const plannerModeLabel = $('plannerModeLabel');
  const targetTimeInput = $('targetTime');
  const dailyStepRange = $('dailyStep');
  const dailyStepLabel = $('dailyStepLabel');
  const nudgeCardsEl = $('nudgeCards');
  const startSlowToggle = $('startSlowToggle');
  const endSlowToggle = $('endSlowToggle');
  const segmentBtns = Array.from(document.querySelectorAll('.segment-btn'));
  const textScaleDown = $('textScaleDown');
  const textScaleUp = $('textScaleUp');
  const themeButtons = Array.from(document.querySelectorAll('[data-theme-choice]'));
  const nowLabel = $('nowLabel');
  const feelsLikeLabel = $('feelsLikeLabel');
  const yourNowLabel = $('yourNowLabel');
  const yourFeelsLikeLabel = $('yourFeelsLikeLabel');
  const advancedToggle = $('advancedToggle');
  const advancedBody = $('advancedBody');
  const overrideInput = $('overrideInput');
  const applyOverrideBtn = $('applyOverride');
  const clearOverrideBtn = $('clearOverride');
  const overrideStatus = $('overrideStatus');
  const toastContainer = $('toastContainer');
  const shareLayer = $('shareLayer');
  const shareLinkInput = $('shareLinkInput');
  const shareCopyLinkBtn = $('shareCopyLink');
  const shareCopyCodeBtn = $('shareCopyCode');
  const shareCode = $('shareCode');
  const shareIncludeEventsToggle = $('shareIncludeEvents');
  const lockWakeToggle = $('lockWakeToggle');
  const sharePlannerBtn = $('sharePlanner');
  const savePlannerBtn = $('savePlanner');
  const loadPlannerBtn = $('loadPlanner');
  const exportWakeSleepBtn = $('exportWakeSleep');
  const exportAllEventsBtn = $('exportAllEventsCalendar');
  const exportPeriodSelect = $('exportPeriod');
  const shareCloseEls = Array.from(document.querySelectorAll('[data-share-close]'));
  const resetStandardDayBtn = $('resetStandardDay');
  const realDayList = $('realDayList');
  const yourDayWakeInput = $('yourDayWakeInput');
  const tabButtons = Array.from(document.querySelectorAll('[data-tab]'));
  const yourDayTabPanel = $('yourDayTab');
  const standardDayTabPanel = $('standardDayTab');
  let shareKeyListenerAttached = false;

  const timeZoneCountries = (window.timeZoneData && window.timeZoneData.countries) || [];
  const timeZoneIndex = (window.timeZoneData && window.timeZoneData.zoneIndex) || new Map();

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
    { type: 'wake', title: 'Wake', duration: 30 },
    { type: 'meal', title: 'Breakfast', duration: 30 },
    { type: 'work', title: 'Work', duration: 8 * 60 },
    { type: 'meal', title: 'Lunch', duration: 60 },
    { type: 'exercise', title: 'Exercise', duration: 60 },
    { type: 'meal', title: 'Dinner', duration: 45 },
    { type: 'custom', title: 'Note', duration: 30 },
    { type: 'sleep', title: 'Sleep', duration: 8 * 60 }
  ];

  const defaultEvents = () => [
    createEvent('sleep', 'Sleep', toMinutes('23:00'), minutesDiff(toMinutes('23:00'), toMinutes('07:00'))),
    createEvent('wake', 'Wake up', toMinutes('07:00'), 30),
    createEvent('meal', 'Breakfast', toMinutes('08:00'), 30),
    createEvent('work', 'Work', toMinutes('09:00'), minutesDiff(toMinutes('09:00'), toMinutes('17:00'))),
    createEvent('meal', 'Lunch', toMinutes('12:00'), 45),
    createEvent('exercise', 'Exercise', toMinutes('18:00'), 60),
    createEvent('meal', 'Dinner', toMinutes('18:00'), 45)
  ];

  function countEventsByType(type) {
    return state.events.filter((evt) => evt.type === type).length;
  }

  function ensureAnchorEvents() {
    let added = false;
    if (!state.events.some((evt) => evt.type === 'wake')) {
      state.events.push(createEvent('wake', 'Wake', toMinutes('07:00'), eventTypes.wake.defaultDuration));
      added = true;
    }
    if (!state.events.some((evt) => evt.type === 'sleep')) {
      const start = toMinutes('23:00');
      const end = toMinutes('07:00');
      state.events.push(createEvent('sleep', 'Sleep', start, minutesDiff(start, end)));
      added = true;
    }
    return added;
  }

  const state = {
    events: [],
    selectedId: null,
    activeFilter: 'all',
    pointerDrag: null,
    openEditorId: null,
    displayTimeZone: 'local',
    plannerTimeZone: 'local',
    plannerMode: 'wake',
    plannerDirection: 'auto',
    targetTime: '07:30',
    targetDate: null,
    dailyStep: 30,
    startSlow: false,
    endSlow: false,
    nudgeDelta: 0,
    nudgePlan: [],
    textScale: 1,
    theme: document.documentElement.getAttribute('data-theme') || 'dark',
    timeFormat: '24h',
    overrideNow: null,
    shareIncludeEvents: false,
    lockToWake: true,
    standardWakeMinutes: toMinutes('07:00'),
    yourDayWakeMinutes: toMinutes('07:00'),
    activeTab: 'your',
    exportPeriod: 'full-schedule',
    exportAllEvents: false
  };

  let yourDayPointerDrag = null;
  let displayTimeZonePicker = null;
  let plannerTimeZonePicker = null;

  state.targetDate = todayISO();

  const formatterCache = new Map();

  function detectLocalTimeZoneId() {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return timeZoneIndex.has(tz) ? tz : null;
    } catch (err) {
      console.warn('Unable to detect local time zone', err);
      return null;
    }
  }

  function normalizeTimeZoneValue(tz) {
    if (tz === 'local') return 'local';
    return timeZoneIndex.has(tz) ? tz : 'local';
  }

  function getTimeZoneMeta(tz) {
    if (tz === 'local') {
      const detected = detectLocalTimeZoneId();
      if (detected) return timeZoneIndex.get(detected);
      return null;
    }
    return timeZoneIndex.get(tz) || null;
  }

  function getTimeZoneLabel(tz) {
    if (tz === 'local') return 'Local';
    return getTimeZoneMeta(tz)?.label || tz || 'Local';
  }

  function getTimeZoneLocation(tz) {
    const meta = getTimeZoneMeta(tz);
    if (meta && typeof meta.lat === 'number' && typeof meta.lon === 'number') return meta;
    return timeZoneIndex.get('UTC') || { lat: 0, lon: 0, label: 'UTC' };
  }

  function todayISO(timeZone = state.plannerTimeZone) {
    const now = getNowInZone(timeZone);
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }

  function startOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function startOfDayInZone(date, timeZone = state.plannerTimeZone) {
    const base = !timeZone || timeZone === 'local' ? new Date(date) : new Date(date.toLocaleString('en-US', { timeZone }));
    base.setHours(0, 0, 0, 0);
    return base;
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

  function getNowInZone(timeZone = state.displayTimeZone) {
    const now = getNow();
    if (!timeZone || timeZone === 'local') return now;
    return new Date(now.toLocaleString('en-US', { timeZone }));
  }

  function normalizeDayMinutes(value) {
    return ((Number(value) % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
  }

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function addMinutes(date, minutes) {
    const next = new Date(date);
    next.setMinutes(next.getMinutes() + minutes);
    return next;
  }

  function toMinutes(time) {
    const [h = 0, m = 0] = String(time).split(':').map((p) => Number(p));
    return normalizeDayMinutes(h * 60 + m);
  }

  function buildZonedDateTime(dayDate, minutes, timeZone = state.plannerTimeZone) {
    if (!dayDate || Number.isNaN(dayDate.getTime())) return null;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    let guess = new Date(Date.UTC(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), hours, mins));

    for (let i = 0; i < 3; i++) {
      const { hours: tzHours, minutes: tzMinutes } = toTimeInZone(guess, timeZone);
      const tzTotal = (tzHours * 60 + tzMinutes) % MINUTES_IN_DAY;
      const delta = minutes - tzTotal;
      if (delta === 0) break;
      guess = addMinutes(guess, delta);
    }

    return guess;
  }

  function minutesToTime(mins) {
    const m = ((mins % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
    return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  }

  function minutesToLabel(mins) {
    return formatMinutes(mins, { includePeriod: true });
  }

  function formatMinutes(mins, { includePeriod = true } = {}) {
    const m = ((mins % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
    const hours24 = Math.floor(m / 60);
    const minutes = pad(m % 60);
    if (state.timeFormat === '12h') {
      const hours12 = hours24 % 12 || 12;
      const period = hours24 < 12 ? 'AM' : 'PM';
      return includePeriod ? `${hours12}:${minutes} ${period}` : `${hours12}:${minutes}`;
    }
    return `${pad(hours24)}:${minutes}`;
  }

  function minutesDiff(start, end) {
    let diff = ((end - start) % MINUTES_IN_DAY + MINUTES_IN_DAY) % MINUTES_IN_DAY;
    if (diff === 0) diff = MINUTES_IN_DAY;
    return diff;
  }

  function createEvent(type, title, startMin, duration) {
    const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `evt-${Math.random().toString(36).slice(2, 10)}`;
    const eventDuration = typeof duration === 'number' ? duration : eventTypes[type]?.defaultDuration || 60;
    const start = ((startMin % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
    return { id, type, title, startMin: start, endMin: (start + eventDuration) % MINUTES_IN_DAY, duration: eventDuration, repeat: 'daily' };
  }

  function normalizeEvent(evt) {
    if (!evt) return null;
    const type = eventTypes[evt.type] ? evt.type : 'custom';
    const title = evt.title || eventTypes[type]?.label || 'Event';
    const start = typeof evt.startMin === 'number' ? ((evt.startMin % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY : 0;
    let duration = typeof evt.duration === 'number' ? evt.duration : null;
    if (duration === null && typeof evt.endMin === 'number') {
      duration = minutesDiff(start, evt.endMin);
    }
    if (duration === null) duration = eventTypes[type]?.defaultDuration || 60;
    return { ...evt, type, title, startMin: start, duration, endMin: (start + duration) % MINUTES_IN_DAY };
  }

  function loadState() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (stored && Array.isArray(stored.events)) {
        state.events = stored.events.map((evt) => normalizeEvent(evt)).filter(Boolean);
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
        state.textScale = Number.isFinite(prefs.textScale) ? prefs.textScale : state.textScale;
        state.theme = prefs.theme === 'light' ? 'light' : 'dark';
        state.displayTimeZone = normalizeTimeZoneValue(prefs.displayTimeZone || prefs.timeZone || state.displayTimeZone);
        state.plannerTimeZone = normalizeTimeZoneValue(prefs.plannerTimeZone || prefs.timeZone || state.plannerTimeZone);
        state.targetTime = prefs.targetTime || state.targetTime;
        state.dailyStep = clamp(Number(prefs.dailyStep) || state.dailyStep, 5, 120);
        state.plannerMode = prefs.plannerMode || state.plannerMode;
        state.plannerDirection = prefs.plannerDirection || state.plannerDirection;
        if (typeof prefs.startSlow === 'boolean' || typeof prefs.endSlow === 'boolean') {
          state.startSlow = !!prefs.startSlow;
          state.endSlow = !!prefs.endSlow;
        } else if (prefs.adjustmentCurve === 'curved') {
          state.startSlow = true;
          state.endSlow = true;
        } else {
          state.startSlow = false;
          state.endSlow = false;
        }
        state.timeFormat = prefs.timeFormat === '12h' ? '12h' : '24h';
        state.shareIncludeEvents = Boolean(prefs.shareIncludeEvents);
        state.exportAllEvents = prefs.exportAllEvents === true;
        if (['today', 'tomorrow', 'this-week', 'full-schedule'].includes(prefs.exportPeriod)) {
          state.exportPeriod = prefs.exportPeriod;
        }
        state.lockToWake = prefs.lockToWake !== false;
        state.standardWakeMinutes = normalizeDayMinutes(
          typeof prefs.standardWakeMinutes === 'number' ? prefs.standardWakeMinutes : state.standardWakeMinutes
        );
        state.yourDayWakeMinutes = normalizeDayMinutes(
          typeof prefs.yourDayWakeMinutes === 'number' ? prefs.yourDayWakeMinutes : state.yourDayWakeMinutes
        );
        state.activeTab = prefs.activeTab === 'standard' ? 'standard' : 'your';
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

    if (ensureAnchorEvents()) {
      persistState();
    }
  }

  function persistState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ events: state.events }));
    localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({
        textScale: state.textScale,
        theme: state.theme,
        displayTimeZone: state.displayTimeZone,
        plannerTimeZone: state.plannerTimeZone,
        targetTime: state.targetTime,
        dailyStep: state.dailyStep,
        plannerMode: state.plannerMode,
        plannerDirection: state.plannerDirection,
        startSlow: state.startSlow,
        endSlow: state.endSlow,
        timeFormat: state.timeFormat,
        shareIncludeEvents: state.shareIncludeEvents,
        exportAllEvents: state.exportAllEvents,
        exportPeriod: state.exportPeriod,
        lockToWake: state.lockToWake,
        standardWakeMinutes: state.standardWakeMinutes,
        yourDayWakeMinutes: state.yourDayWakeMinutes,
        activeTab: state.activeTab
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

  function formatHourTick(hour) {
    const hours24 = ((hour % 24) + 24) % 24;
    if (state.timeFormat === '12h') {
      const labelHour = hours24 % 12 || 12;
      const suffix = hours24 < 12 ? 'am' : 'pm';
      return `${labelHour}${suffix}`;
    }
    return pad(hours24);
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

  function zonedTimeToUtc(date, timeZone) {
    if (!timeZone || timeZone === 'local') return new Date(date);
    const zonedDate = new Date(date.toLocaleString('en-US', { timeZone }));
    const diff = date.getTime() - zonedDate.getTime();
    return new Date(date.getTime() - diff);
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
    state.textScale = Number.isFinite(scale) ? scale : state.textScale;
    document.documentElement.style.setProperty('--scale', state.textScale);
    persistState();
  }

  function setDisplayTimezone(tz) {
    state.displayTimeZone = normalizeTimeZoneValue(tz);
    if (displayTimeZonePicker) displayTimeZonePicker.setValue(state.displayTimeZone);
    persistState();
    render();
  }

  function setPlannerTimezone(tz) {
    state.plannerTimeZone = normalizeTimeZoneValue(tz);
    if (plannerTimeZonePicker) plannerTimeZonePicker.setValue(state.plannerTimeZone);
    persistState();
    renderNudgePlan();
  }

  function setTimeFormat(format) {
    state.timeFormat = format === '12h' ? '12h' : '24h';
    updateTimeFormatToggle();
    persistState();
    render();
  }

  function toggleTimeFormat() {
    setTimeFormat(state.timeFormat === '24h' ? '12h' : '24h');
  }

  function updateTimeFormatToggle() {
    if (!timeFormatToggle) return;
    const label = state.timeFormat === '24h' ? '24-hour' : '12-hour';
    timeFormatToggle.textContent = label;
    timeFormatToggle.setAttribute('aria-pressed', state.timeFormat === '12h' ? 'true' : 'false');
  }

  function getEventColor(type) {
    const key = eventTypes[type]?.colorKey || 'wake';
    return getComputedStyle(document.documentElement).getPropertyValue(`--${key}`).trim();
  }

  function getAnchorEvents() {
    const wake = state.events
      .filter((evt) => evt.type === 'wake')
      .slice()
      .sort((a, b) => a.startMin - b.startMin)[0];
    const sleep = state.events
      .filter((evt) => evt.type === 'sleep')
      .slice()
      .sort((a, b) => a.startMin - b.startMin)[0];
    return { wake, sleep };
  }

  function getStandardWakeMinutes() {
    const fallback = toMinutes('07:00');
    return normalizeDayMinutes(typeof state.standardWakeMinutes === 'number' ? state.standardWakeMinutes : fallback);
  }

  function getYourDayWakeMinutes() {
    const fallback = getStandardWakeMinutes();
    return normalizeDayMinutes(typeof state.yourDayWakeMinutes === 'number' ? state.yourDayWakeMinutes : fallback);
  }

  function getSleepAnchorStart() {
    const { wake, sleep } = getAnchorEvents();
    if (sleep) return sleep.startMin;
    if (wake) return normalizeDayMinutes(wake.startMin - eventTypes.sleep.defaultDuration);
    return toMinutes('23:00');
  }

  function getYourDaySleepMinutes() {
    const sleepStart = getSleepAnchorStart();
    const standardWake = getStandardWakeMinutes();
    const wakeStart = getYourDayWakeMinutes();
    return normalizeDayMinutes(sleepStart - standardWake + wakeStart);
  }

  function getSleepDuration() {
    const sleepStart = getYourDaySleepMinutes();
    const wakeStart = getYourDayWakeMinutes();
    if (typeof sleepStart !== 'number' || typeof wakeStart !== 'number') {
      return eventTypes.sleep.defaultDuration;
    }
    let duration = Math.abs(sleepStart - wakeStart);
    if (duration > MINUTES_IN_DAY / 2) {
      duration = MINUTES_IN_DAY - duration;
    }
    return duration || eventTypes.sleep.defaultDuration;
  }

  function feelsLikeMinutes(nowMinutes) {
    const standardWake = getStandardWakeMinutes();
    const wakeStart = getYourDayWakeMinutes();
    return normalizeDayMinutes(nowMinutes + standardWake - wakeStart);
  }

  function mapStandardToRealMinutes(mins) {
    const standardWake = getStandardWakeMinutes();
    const wakeStart = getYourDayWakeMinutes();
    return normalizeDayMinutes(mins - standardWake + wakeStart);
  }

  function getSleepWindow() {
    const { wake, sleep } = getAnchorEvents();
    const duration = getSleepDuration();
    const start = sleep ? sleep.startMin : wake ? (wake.startMin - duration + MINUTES_IN_DAY) % MINUTES_IN_DAY : toMinutes('23:00');
    const end = wake ? wake.startMin : (start + duration) % MINUTES_IN_DAY;
    return { start, end, duration };
  }

  function render() {
    renderStandardClock();
    renderYourDayClock();
    renderDayList();
    renderRealDayList();
    renderNudgePlan();
    renderNextEventLabels();
    syncYourDayWakeInput();
  }

  function prepareClock(ring) {
    if (!ring) return null;
    const size = 400;
    const center = size / 2;
    const radius = 150;
    ring.setAttribute('viewBox', `0 0 ${size} ${size}`);
    while (ring.firstChild) ring.removeChild(ring.firstChild);
    const backdrop = createSVG('circle', { cx: center, cy: center, r: radius, class: 'clock-backdrop' });
    ring.appendChild(backdrop);
    return { center, radius };
  }

  function drawDaylight(ring, center, radius) {
    const { sunrise, sunset } = calculateSunTimes(state.displayTimeZone);
    if (sunrise === null || sunset === null || !ring) return;
    const start = angleFromMinutes(sunrise);
    const end = angleFromMinutes(sunset);
    if (start === end) return;
    const daylightGroup = createSVG('g');
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
    ring.appendChild(daylightGroup);
  }

  function drawSleepWindowArc(ring, center, radius, window) {
    if (!window || !ring) return;
    const { start, duration } = window;
    const startAngle = angleFromMinutes(start);
    const endAngle = startAngle + (duration / MINUTES_IN_DAY) * 360;
    const sleepArc = createSVG('path', {
      d: describeArc(center, center, radius - 10, startAngle, endAngle),
      class: 'clock-sleep-window'
    });
    ring.appendChild(sleepArc);
  }

  function drawHourTicks(ring, center, radius) {
    if (!ring) return;
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
      ring.appendChild(line);
      const label = createSVG('text', {
        x: center + cos * (radius + 32),
        y: center + sin * (radius + 32) + 4,
        class: 'clock-hour-number'
      });
      label.textContent = formatHourTick(h);
      ring.appendChild(label);
    }
  }

  function renderStandardClock() {
    const frame = prepareClock(dayRing);
    if (!frame) return;
    const { center, radius } = frame;
    drawDaylight(dayRing, center, radius);
    drawSleepWindowArc(dayRing, center, radius, getSleepWindow());
    drawHourTicks(dayRing, center, radius);

    const now = getNowInZone(state.displayTimeZone);
    const nowMinutes = minutesInZone(now, state.displayTimeZone);
    const feelsMinutes = feelsLikeMinutes(nowMinutes);
    const feelsLikeHand = createSVG('line', {
      x1: center,
      y1: center,
      x2: center + Math.cos(((angleFromMinutes(feelsMinutes) - 90) * Math.PI) / 180) * (radius + 10),
      y2: center + Math.sin(((angleFromMinutes(feelsMinutes) - 90) * Math.PI) / 180) * (radius + 10),
      class: 'clock-feels-hand'
    });
    dayRing.appendChild(feelsLikeHand);

    const realTimeHand = createSVG('line', {
      x1: center,
      y1: center,
      x2: center + Math.cos(((angleFromMinutes(nowMinutes) - 90) * Math.PI) / 180) * (radius - 32),
      y2: center + Math.sin(((angleFromMinutes(nowMinutes) - 90) * Math.PI) / 180) * (radius - 32),
      class: 'clock-now-hand'
    });
    dayRing.appendChild(realTimeHand);

    const centerDot = createSVG('circle', { cx: center, cy: center, r: 6, class: 'clock-center' });
    dayRing.appendChild(centerDot);

    renderEventDots(center, radius);
    updateClockLabels(nowMinutes, feelsMinutes, nowLabel, feelsLikeLabel);
  }

  function getYourDayEvents() {
    const delta = signedDelta(getStandardWakeMinutes(), getYourDayWakeMinutes());
    return state.events.map((evt) => ({ ...shiftEvent(evt, delta), baseStart: evt.startMin }));
  }

  function compareYourDayEvents(a, b) {
    const wake = getYourDayWakeMinutes();
    const relA = normalizeDayMinutes(a.startMin - wake);
    const relB = normalizeDayMinutes(b.startMin - wake);
    if (relA !== relB) return relA - relB;
    return compareEvents(a, b);
  }

  function renderYourDayClock() {
    const frame = prepareClock(yourDayRing);
    if (!frame) return;
    const { center, radius } = frame;
    drawDaylight(yourDayRing, center, radius);
    const sleepWindow = getSleepWindow();
    if (sleepWindow) {
      const shiftedStart = mapStandardToRealMinutes(sleepWindow.start);
      drawSleepWindowArc(yourDayRing, center, radius, {
        start: shiftedStart,
        duration: sleepWindow.duration
      });
    }
    drawHourTicks(yourDayRing, center, radius);

    const now = getNowInZone(state.displayTimeZone);
    const nowMinutes = minutesInZone(now, state.displayTimeZone);
    const feelsMinutes = feelsLikeMinutes(nowMinutes);
    const feelsLikeHand = createSVG('line', {
      x1: center,
      y1: center,
      x2: center + Math.cos(((angleFromMinutes(feelsMinutes) - 90) * Math.PI) / 180) * (radius + 10),
      y2: center + Math.sin(((angleFromMinutes(feelsMinutes) - 90) * Math.PI) / 180) * (radius + 10),
      class: 'clock-feels-hand'
    });
    yourDayRing.appendChild(feelsLikeHand);

    const realTimeHand = createSVG('line', {
      x1: center,
      y1: center,
      x2: center + Math.cos(((angleFromMinutes(nowMinutes) - 90) * Math.PI) / 180) * (radius - 32),
      y2: center + Math.sin(((angleFromMinutes(nowMinutes) - 90) * Math.PI) / 180) * (radius - 32),
      class: 'clock-now-hand'
    });
    yourDayRing.appendChild(realTimeHand);

    const centerDot = createSVG('circle', { cx: center, cy: center, r: 6, class: 'clock-center' });
    yourDayRing.appendChild(centerDot);

    renderYourDayMarkers(getYourDayEvents(), center, radius);
    updateClockLabels(nowMinutes, feelsMinutes, yourNowLabel, yourFeelsLikeLabel);
  }

  function updateClockLabels(nowMinutes, feelsMinutes, nowEl, feelsEl) {
    if (feelsEl) feelsEl.textContent = `Feels like · ${formatMinutes(feelsMinutes)}`;
    if (nowEl) nowEl.textContent = `Real time · ${formatMinutes(nowMinutes)}`;
  }

  function renderEventDots(center, radius) {
    const filteredTypes = state.activeFilter === 'all' ? null : state.activeFilter;
    const events = state.events
      .filter((evt) => !filteredTypes || evt.type === filteredTypes)
      .slice()
      .sort(compareEvents);

    events.forEach((evt) => {
      drawEventDot(evt, center, radius);
    });
  }

  function shiftEvent(evt, delta) {
    const shift = ((delta % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
    return {
      ...evt,
      startMin: (evt.startMin + shift + MINUTES_IN_DAY) % MINUTES_IN_DAY,
      endMin: (evt.endMin + shift + MINUTES_IN_DAY) % MINUTES_IN_DAY
    };
  }

  function drawEventDot(evt, center, radius) {
    const { x, y } = rotatePoint(evt.startMin, radius, center);
    const dot = createSVG('circle', {
      cx: x,
      cy: y,
      r: 10,
      class: 'event-dot',
      'data-type': evt.type,
      'data-event-id': evt.id,
      'data-selected': state.selectedId === evt.id ? 'true' : 'false',
      tabindex: 0
    });
    dot.addEventListener('pointerenter', () => handleArcHover(evt.id));
    dot.addEventListener('pointerleave', () => handleArcHover(null));
    dot.addEventListener('click', (event) => {
      event.stopPropagation();
      selectEvent(evt.id);
    });
    dot.addEventListener('pointerdown', handlePointerStart);
    dot.addEventListener('keydown', handleKeyboardNudge);
    dayRing.appendChild(dot);
  }

  function renderYourDayMarkers(events, center, radius) {
    const wake = events.find((evt) => evt.type === 'wake');
    const markerStarts = new Map();
    events.forEach((evt) => {
      if (evt.type === 'wake') return;
      const key = evt.startMin;
      if (!markerStarts.has(key)) markerStarts.set(key, []);
      markerStarts.get(key).push(evt);
    });

    markerStarts.forEach((group) => {
      if (!group.length) return;
      const angle = (group[0].startMin / MINUTES_IN_DAY) * 2 * Math.PI;
      const cos = Math.cos(angle - Math.PI / 2);
      const sin = Math.sin(angle - Math.PI / 2);
      const startRadius = radius - 22;
      const endRadius = radius + 6;
      const segmentLength = (endRadius - startRadius) / group.length;

      group.forEach((evt, idx) => {
        const inner = startRadius + segmentLength * idx;
        const outer = idx === group.length - 1 ? endRadius : startRadius + segmentLength * (idx + 1);
        const marker = createSVG('line', {
          x1: center + cos * inner,
          y1: center + sin * inner,
          x2: center + cos * outer,
          y2: center + sin * outer,
          class: 'your-day-marker',
          'data-type': evt.type
        });
        yourDayRing.appendChild(marker);
      });
    });

    if (wake) {
      const { x, y } = rotatePoint(wake.startMin, radius, center);
      const dot = createSVG('circle', {
        cx: x,
        cy: y,
        r: 10,
        class: 'your-day-wake-dot',
        tabindex: 0,
        'aria-label': 'Adjust wake time'
      });
      dot.addEventListener('pointerdown', handleYourDayPointerStart);
      dot.addEventListener('keydown', handleYourDayKeyboardNudge);
      yourDayRing.appendChild(dot);
    }
  }

  function signedDelta(from, to) {
    const raw = ((to - from) % MINUTES_IN_DAY + MINUTES_IN_DAY) % MINUTES_IN_DAY;
    return raw > MINUTES_IN_DAY / 2 ? raw - MINUTES_IN_DAY : raw;
  }

  function updateEventTiming(evt, newStart) {
    const start = ((newStart % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
    const duration = typeof evt.duration === 'number' ? evt.duration : eventTypes[evt.type]?.defaultDuration || 60;
    evt.startMin = start;
    evt.duration = duration;
    evt.endMin = (start + duration) % MINUTES_IN_DAY;
  }

  function shiftLinkedEvents(delta, anchorId) {
    if (!delta) return;
    const shift = signedDelta(0, delta);
    state.events.forEach((evt) => {
      if (evt.id === anchorId) return;
      updateEventTiming(evt, (evt.startMin + shift + MINUTES_IN_DAY) % MINUTES_IN_DAY);
    });
  }

  function applyStartChange(evt, newStart, deltaOverride, options = {}) {
    const previousStart = evt.startMin;
    const delta = typeof deltaOverride === 'number' ? deltaOverride : signedDelta(previousStart, newStart);
    updateEventTiming(evt, newStart);
    if (evt.type === 'wake') {
      state.standardWakeMinutes = newStart;
    }
    if (evt.type === 'wake' && state.lockToWake && delta) {
      shiftLinkedEvents(delta, evt.id);
      if (options.notifyLockShift) {
        showToast(`${formatShiftMinutes(delta)} applied to linked events`, 'info');
      }
    }
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
    const target = evt.currentTarget;
    if (target?.setPointerCapture) {
      target.setPointerCapture(evt.pointerId);
    }

    if (dayRing) {
      dayRing.classList.add('is-dragging');
    }

    if (document.documentElement) {
      document.documentElement.classList.add('no-scroll');
      document.body?.classList.add('no-scroll');
    }
    const id = target.getAttribute('data-event-id');
    state.pointerDrag = { id, lastStart: state.events.find((e) => e.id === id)?.startMin ?? null };
    selectEvent(id);
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerEnd);
    document.addEventListener('pointercancel', handlePointerEnd);
  }

  function handlePointerMove(evt) {
    if (!state.pointerDrag) return;
    evt.preventDefault();
    const { id } = state.pointerDrag;
    const event = state.events.find((e) => e.id === id);
    if (!event) return;
    const minutes = snapMinutes(getMinutesFromPointer(evt), getSnapStep(evt));
    const delta = signedDelta(state.pointerDrag.lastStart ?? event.startMin, minutes);
    if (delta !== 0) {
      applyStartChange(event, minutes, delta);
      state.pointerDrag.lastStart = event.startMin;
    }
    persistState();
    render();
  }

  function handlePointerEnd(evt) {
    if (!state.pointerDrag) return;
    evt.preventDefault();
    const target = evt.target;
    if (target?.releasePointerCapture) {
      try {
        target.releasePointerCapture(evt.pointerId);
      } catch (err) {
        /* ignore */
      }
    }
    if (dayRing) {
      dayRing.classList.remove('is-dragging');
    }
    if (document.documentElement) {
      document.documentElement.classList.remove('no-scroll');
      document.body?.classList.remove('no-scroll');
    }
    state.pointerDrag = null;
    document.removeEventListener('pointermove', handlePointerMove);
    document.removeEventListener('pointerup', handlePointerEnd);
    document.removeEventListener('pointercancel', handlePointerEnd);
    render();
  }

  function handleYourDayPointerStart(evt) {
    evt.preventDefault();
    const target = evt.currentTarget;
    if (target?.setPointerCapture) {
      target.setPointerCapture(evt.pointerId);
    }
    yourDayPointerDrag = true;
    document.addEventListener('pointermove', handleYourDayPointerMove);
    document.addEventListener('pointerup', handleYourDayPointerEnd);
    document.addEventListener('pointercancel', handleYourDayPointerEnd);
  }

  function handleYourDayPointerMove(evt) {
    if (!yourDayPointerDrag) return;
    evt.preventDefault();
    const minutes = getMinutesFromPointer(evt, yourDayRing);
    if (typeof minutes !== 'number') return;
    state.yourDayWakeMinutes = minutes;
    persistState();
    render();
  }

  function handleYourDayPointerEnd(evt) {
    if (!yourDayPointerDrag) return;
    evt.preventDefault();
    const target = evt.target;
    if (target?.releasePointerCapture) {
      try {
        target.releasePointerCapture(evt.pointerId);
      } catch (err) {
        /* ignore */
      }
    }
    yourDayPointerDrag = null;
    document.removeEventListener('pointermove', handleYourDayPointerMove);
    document.removeEventListener('pointerup', handleYourDayPointerEnd);
    document.removeEventListener('pointercancel', handleYourDayPointerEnd);
  }

  function handleYourDayKeyboardNudge(evt) {
    const increment = evt.shiftKey ? SNAP_SHIFT : SNAP_DEFAULT;
    if (!['ArrowLeft', 'ArrowRight'].includes(evt.key)) return;
    evt.preventDefault();
    const delta = evt.key === 'ArrowRight' ? increment : -increment;
    state.yourDayWakeMinutes = normalizeDayMinutes(getYourDayWakeMinutes() + delta);
    persistState();
    render();
  }

  function handleKeyboardNudge(evt) {
    const increment = evt.shiftKey ? SNAP_SHIFT : SNAP_DEFAULT;
    if (!['ArrowLeft', 'ArrowRight'].includes(evt.key)) return;
    evt.preventDefault();
    const id = evt.currentTarget.getAttribute('data-event-id');
    const event = state.events.find((e) => e.id === id);
    if (!event) return;
    const delta = evt.key === 'ArrowRight' ? increment : -increment;
    const next = (event.startMin + delta + MINUTES_IN_DAY) % MINUTES_IN_DAY;
    applyStartChange(event, next, delta);
    persistState();
    render();
  }

  function getMinutesFromPointer(evt, ring = dayRing) {
    const rect = ring?.getBoundingClientRect();
    if (!rect) return null;
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
        titleWrap.appendChild(titleInput);

        const timeButton = document.createElement('button');
        timeButton.className = 'day-item__time';
        timeButton.type = 'button';
        timeButton.setAttribute('aria-label', `Edit time for ${evt.title}`);
        const timeRange = document.createElement('span');
        timeRange.className = 'day-item__time-range';
        timeRange.textContent = minutesToLabel(evt.startMin);
        const timeHint = document.createElement('span');
        timeHint.className = 'day-item__time-hint';
        timeHint.textContent = 'Edit start';
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

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-primary';
    saveBtn.type = 'button';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', () => {
      const start = toMinutes(startField.input.value);
      const delta = signedDelta(evt.startMin, start);
      applyStartChange(evt, start, delta, { notifyLockShift: evt.type === 'wake' });
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
    const event = createEvent(template.type, template.title, eventStart, template.duration);
    state.events.push(event);
    state.selectedId = event.id;
    persistState();
    render();
    showToast(`${template.title} added`, 'success');
  }

  function removeEvent(id) {
    const target = state.events.find((evt) => evt.id === id);
    if (!target) return;
    if ((target.type === 'wake' || target.type === 'sleep') && countEventsByType(target.type) <= 1) {
      showToast('Keep at least one Wake and one Sleep event in your day.', 'error');
      return;
    }

    state.events = state.events.filter((evt) => evt.id !== id);
    if (state.selectedId === id) state.selectedId = null;
    if (state.openEditorId === id) state.openEditorId = null;
    persistState();
    render();
  }

  function guessOpenMinute() {
    if (!state.events.length) return toMinutes('09:00');
    const sorted = state.events.slice().sort((a, b) => a.startMin - b.startMin);
    const last = sorted[sorted.length - 1];
    const duration = typeof last.duration === 'number' ? last.duration : eventTypes[last.type]?.defaultDuration || 60;
    return (last.startMin + duration + 30) % MINUTES_IN_DAY;
  }

  function renderNextEventLabels() {
    renderNextEventLabelFor(state.events, nextEventLabel, dayRing);
    renderNextEventLabelFor(getYourDayEvents(), yourNextEventLabel, yourDayRing);
  }

  function renderNextEventLabelFor(events, labelEl, ringEl) {
    if (!labelEl || !ringEl) return;
    const nowMinutes = minutesInZone(getNowInZone(state.displayTimeZone), state.displayTimeZone);
    const upcoming = events
      .map((evt) => ({ ...evt, minutesUntil: ((evt.startMin - nowMinutes + MINUTES_IN_DAY) % MINUTES_IN_DAY) }))
      .sort((a, b) => a.minutesUntil - b.minutesUntil)[0];
    if (!upcoming) {
      labelEl.hidden = true;
      return;
    }
    labelEl.hidden = false;
    labelEl.textContent = `${upcoming.title} in ${formatDuration(upcoming.minutesUntil)}`;
    positionLabelForEvent(upcoming, labelEl, ringEl);
  }

  function positionLabelForEvent(evt, element, ring = dayRing) {
    const rect = ring?.getBoundingClientRect();
    if (!rect) return;
    const overlayRect = element.offsetParent?.getBoundingClientRect() || rect;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    element.style.left = `${centerX - overlayRect.left}px`;
    element.style.top = `${centerY - overlayRect.top}px`;
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

  function createTimeZonePicker(rootEl, options = {}) {
    if (!rootEl) return null;
    const { allowLocal = true, value = 'local', onChange = () => {}, labels = {}, labelClass = '' } = options;
    const localLabel = labels.local || 'Use local time';
    const countryLabel = labels.country || 'Country or region';
    const zoneLabel = labels.zone || 'Time zone';
    const pickerId = rootEl.id || `tz-picker-${Math.floor(Math.random() * 10000)}`;
    const compact = rootEl.classList.contains('timezone-picker--compact');

    rootEl.classList.add('timezone-picker');
    rootEl.innerHTML = '';

    const controls = document.createElement('div');
    controls.className = 'timezone-picker__controls';

    const countryField = document.createElement('div');
    const countrySelectId = `${pickerId}-country`;
    const countryLabelEl = document.createElement('label');
    countryLabelEl.className = `timezone-picker__label ${labelClass}`.trim();
    countryLabelEl.setAttribute('for', countrySelectId);
    countryLabelEl.textContent = countryLabel;

    const countrySelect = document.createElement('select');
    countrySelect.id = countrySelectId;
    countrySelect.className = `timezone-picker__select${compact ? ' pill-select' : ''}`;

    const countryPlaceholder = document.createElement('option');
    countryPlaceholder.value = '';
    countryPlaceholder.textContent = 'Select a country';
    countryPlaceholder.disabled = true;
    countrySelect.appendChild(countryPlaceholder);

    timeZoneCountries.forEach((country) => {
      const option = document.createElement('option');
      option.value = country.code;
      option.textContent = country.name;
      countrySelect.appendChild(option);
    });

    countryField.appendChild(countryLabelEl);
    countryField.appendChild(countrySelect);

    const zoneField = document.createElement('div');
    const zoneSelectId = `${pickerId}-zone`;
    const zoneLabelEl = document.createElement('label');
    zoneLabelEl.className = `timezone-picker__label ${labelClass}`.trim();
    zoneLabelEl.setAttribute('for', zoneSelectId);
    zoneLabelEl.textContent = zoneLabel;

    const zoneSelect = document.createElement('select');
    zoneSelect.id = zoneSelectId;
    zoneSelect.className = `timezone-picker__select${compact ? ' pill-select' : ''}`;
    zoneSelect.disabled = true;

    zoneField.appendChild(zoneLabelEl);
    zoneField.appendChild(zoneSelect);

    controls.appendChild(countryField);
    controls.appendChild(zoneField);

    let suppressChange = false;

    function populateZones(countryCode, selectedZoneId = null) {
      zoneSelect.innerHTML = '';
      const country = timeZoneCountries.find((c) => c.code === countryCode);
      const zones = country
        ? country.zones
            .slice()
            .sort(
              (a, b) => (a.offset || '').localeCompare(b.offset || '') || a.label.localeCompare(b.label)
            )
        : [];
      zoneSelect.disabled = !zones.length;
      zones.forEach((zone) => {
        const option = document.createElement('option');
        option.value = zone.id;
        option.textContent = `${zone.label}${zone.offset ? ` (${zone.offset})` : ''}`;
        zoneSelect.appendChild(option);
      });

      if (!zones.length) return;

      const defaultZone = selectedZoneId
        ? zones.find((z) => z.id === selectedZoneId)
        : zones.find((z) => z.isPrimary) || zones[0];
      if (defaultZone) {
        zoneSelect.value = defaultZone.id;
      }
    }

    function selectCountry(code, zoneId = null) {
      countrySelect.value = code || '';
      populateZones(code, zoneId);
      if (zoneId) zoneSelect.value = zoneId;
    }

    function handleCountryChange() {
      if (suppressChange) return;
      const code = countrySelect.value;
      const country = timeZoneCountries.find((c) => c.code === code);
      const fallback = country ? country.zones.find((z) => z.isPrimary) || country.zones[0] : null;
      populateZones(code, fallback?.id);
      if (fallback) {
        if (allowLocal && localToggle) localToggle.checked = false;
        onChange(fallback.id);
      }
    }

    function handleZoneChange() {
      if (suppressChange) return;
      if (!zoneSelect.value) return;
      if (allowLocal && localToggle) localToggle.checked = false;
      onChange(zoneSelect.value);
    }

    let localToggle = null;
    if (allowLocal) {
      const localId = `${pickerId}-local`;
      const localWrap = document.createElement('label');
      localWrap.className = 'timezone-picker__local';
      localToggle = document.createElement('input');
      localToggle.type = 'checkbox';
      localToggle.id = localId;
      const localText = document.createElement('span');
      localText.textContent = localLabel;
      localWrap.appendChild(localToggle);
      localWrap.appendChild(localText);
      rootEl.appendChild(localWrap);

      localToggle.addEventListener('change', () => {
        if (suppressChange) return;
        if (localToggle.checked) {
          onChange('local');
        }
      });
    }

    countrySelect.addEventListener('change', handleCountryChange);
    zoneSelect.addEventListener('change', handleZoneChange);

    rootEl.appendChild(controls);

    function setValue(next) {
      suppressChange = true;
      const resolved = normalizeTimeZoneValue(next);
      if (localToggle) localToggle.checked = resolved === 'local';

      if (resolved === 'local') {
        const detected = detectLocalTimeZoneId();
        const meta = detected ? timeZoneIndex.get(detected) : null;
        if (meta) {
          selectCountry(meta.countryCode, meta.id);
        } else {
          selectCountry(null);
        }
      } else {
        const meta = timeZoneIndex.get(resolved);
        if (meta) {
          selectCountry(meta.countryCode, meta.id);
        } else {
          selectCountry(null);
        }
      }

      suppressChange = false;
    }

    setValue(value);

    return { setValue };
  }

  function renderRealDayList() {
    if (!realDayList) return;
    realDayList.innerHTML = '';

    if (!state.events.length) {
      const empty = document.createElement('li');
      empty.className = 'text-muted';
      empty.textContent = 'No events yet. Add Standard Day items to see them in real time.';
      realDayList.appendChild(empty);
      return;
    }

    const events = getYourDayEvents()
      .slice()
      .sort((a, b) => compareYourDayEvents(a, b));
    const hasWake = state.events.some((evt) => evt.type === 'wake');
    const wakeHint = hasWake ? '' : ' (using default wake)';

    events.forEach((evt) => {
      const li = document.createElement('li');
      li.className = 'day-item';
      const meta = eventTypes[evt.type] || eventTypes.custom;
      const icon = document.createElement('div');
      icon.className = 'day-item__icon';
      icon.textContent = meta.icon;

      const titleWrap = document.createElement('div');
      titleWrap.className = 'day-item__title';
      const title = document.createElement('div');
      title.textContent = evt.title;
      titleWrap.appendChild(title);

      const timeButton = document.createElement('div');
      timeButton.className = 'day-item__time';
      const timeRange = document.createElement('span');
      timeRange.className = 'day-item__time-range';
      const realMinutes = evt.startMin;
      timeRange.textContent = minutesToLabel(realMinutes);
      const timeHint = document.createElement('span');
      timeHint.className = 'day-item__time-hint';
      const feelsStart = typeof evt.baseStart === 'number' ? evt.baseStart : evt.startMin;
      timeHint.textContent = `Feels like ${minutesToLabel(feelsStart)}${wakeHint}`;
      timeButton.appendChild(timeRange);
      timeButton.appendChild(timeHint);

      li.appendChild(icon);
      li.appendChild(titleWrap);
      li.appendChild(timeButton);

      realDayList.appendChild(li);
    });
  }

  function calculateSunTimes(timeZone) {
    const loc = getTimeZoneLocation(timeZone);
    const now = getNowInZone(timeZone);
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
    const sunrise = minutesInZone(sunriseDate, state.displayTimeZone);
    const sunset = minutesInZone(sunsetDate, state.displayTimeZone);
    if (Number.isNaN(sunrise) || Number.isNaN(sunset)) return null;
    return { sunrise, sunset };
  }

  function easeLinear(t) {
    return t;
  }

  function easeInOut(t) {
    return 0.5 - 0.5 * Math.cos(Math.PI * t);
  }

  function easeIn(t) {
    return t * t;
  }

  function easeOut(t) {
    const inv = 1 - t;
    return 1 - inv * inv;
  }

  function getAdjustmentEase() {
    if (state.startSlow && state.endSlow) return easeInOut;
    if (state.startSlow) return easeIn;
    if (state.endSlow) return easeOut;
    return easeLinear;
  }

  function formatShiftMinutes(value) {
    const rounded = Math.round(value * 10) / 10;
    if (Math.abs(rounded) < 0.05) return 'Shift 0 min';
    const display = Number.isInteger(rounded) ? Math.round(rounded) : rounded.toFixed(1);
    return `Shift ${rounded > 0 ? '+' : ''}${display} min`;
  }

  function renderNudgePlan() {
    const { sleep: sleepEvent } = getAnchorEvents();
    if (!sleepEvent) {
      nudgeCardsEl.innerHTML = '<p class="text-muted">Add a sleep block to enable nudges.</p>';
      state.nudgePlan = [];
      state.nudgeDelta = 0;
      return;
    }

    const currentWake = getYourDayWakeMinutes();
    const currentSleep = getYourDaySleepMinutes();
    if (currentSleep === null) {
      nudgeCardsEl.innerHTML = '<p class="text-muted">Add a sleep block to enable nudges.</p>';
      state.nudgePlan = [];
      state.nudgeDelta = 0;
      return;
    }
    const step = clamp(Number(state.dailyStep) || 30, 5, 120);
    const today = startOfDayInZone(getNow(), state.displayTimeZone);
    const targetDate = startOfDayInZone(parseLocalDate(state.targetDate) || today, state.plannerTimeZone);

    const reference = state.plannerMode === 'wake' ? currentWake : currentSleep;
    const targetZonedDateTime = buildZonedDateTime(targetDate, toMinutes(state.targetTime), state.plannerTimeZone);
    const targetMinutes = targetZonedDateTime
      ? minutesInZone(targetZonedDateTime, state.displayTimeZone)
      : minutesInZone(addMinutes(new Date(targetDate), toMinutes(state.targetTime)), state.displayTimeZone);
    let diff = ((targetMinutes - reference + MINUTES_IN_DAY) % MINUTES_IN_DAY + MINUTES_IN_DAY) % MINUTES_IN_DAY;
    if (diff > MINUTES_IN_DAY / 2) diff -= MINUTES_IN_DAY;
    if (state.plannerDirection === 'earlier' && diff > 0) diff -= MINUTES_IN_DAY;
    if (state.plannerDirection === 'later' && diff < 0) diff += MINUTES_IN_DAY;

    const direction = targetDate >= today ? 1 : -1;
    const dayMs = 24 * 60 * 60 * 1000;
    const startDate = new Date(today);
    if (targetDate > today) startDate.setDate(startDate.getDate() + 1);
    else if (targetDate < today) startDate.setDate(startDate.getDate() - 1);
    const totalDays = Math.abs(Math.round((targetDate - startDate) / dayMs)) + 1;
    const easeFn = getAdjustmentEase();
    const shouldRoundEase = true; // Round to whole minutes for all adjustment curves
    const cumulativeTargets = [];

    for (let i = 0; i < totalDays; i++) {
      const progress = totalDays === 1 ? 1 : (i + 1) / totalDays;
      const value = diff * easeFn(progress);
      cumulativeTargets[i] = shouldRoundEase ? Math.round(value) : value;
    }

    let appliedShift = 0;
    const plan = [];

    for (let i = 0; i < totalDays; i++) {
      const dayDate = new Date(startDate);
      dayDate.setDate(startDate.getDate() + i * direction);
      let targetShift = cumulativeTargets[i] - appliedShift;
      if (shouldRoundEase) targetShift = Math.round(targetShift);
      let shift;

      if (i === totalDays - 1) {
        shift = diff - appliedShift;
      } else if (Math.abs(targetShift) > step) {
        shift = Math.sign(targetShift) * step;
        const overshoot = targetShift - shift;
        for (let j = i + 1; j < cumulativeTargets.length; j++) {
          cumulativeTargets[j] -= overshoot;
        }
      } else {
        shift = targetShift;
      }

      if (shouldRoundEase) shift = Math.round(shift);

      appliedShift += shift;

      const wake = normalizeDayMinutes(currentWake + appliedShift);
      const sleep = normalizeDayMinutes(currentSleep + appliedShift);
      dayDate.setHours(0, 0, 0, 0);
      const label = dayDate.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        timeZone: state.displayTimeZone === 'local' ? undefined : state.displayTimeZone
      });
      plan.push({ label, wake, sleep, shift, date: dayDate.toISOString() });
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
      card.appendChild(label);
      nudgeCardsEl.appendChild(card);
    });
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
    const targetMinutes = mode === 'wake' ? getYourDayWakeMinutes() : getYourDaySleepMinutes();
    if (typeof targetMinutes === 'number') {
      const targetTime = minutesToTime(targetMinutes);
      state.targetTime = targetTime;
      if (targetTimeInput) targetTimeInput.value = targetTime;
    }
    persistState();
    renderNudgePlan();
  }

  function updateCurveSetting(key, checked) {
    state[key] = checked;
    syncCurveControls();
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

  function syncCurveControls() {
    if (startSlowToggle) startSlowToggle.checked = !!state.startSlow;
    if (endSlowToggle) endSlowToggle.checked = !!state.endSlow;
  }

  function syncPlannerControls() {
    plannerModeSelect.value = state.plannerMode;
    plannerModeLabel.textContent = state.plannerMode === 'wake' ? 'wake' : 'sleep';
    targetTimeInput.value = state.targetTime;
    targetDateInput.value = state.targetDate;
    syncCurveControls();
    dailyStepRange.value = state.dailyStep;
    dailyStepLabel.textContent = `±${state.dailyStep} min`;
    segmentBtns.forEach((btn) => btn.setAttribute('aria-checked', btn.dataset.dir === state.plannerDirection ? 'true' : 'false'));
    if (shareIncludeEventsToggle) shareIncludeEventsToggle.checked = !!state.shareIncludeEvents;
    if (lockWakeToggle) lockWakeToggle.checked = !!state.lockToWake;
  }

  function setFilter(filter) {
    state.activeFilter = filter;
    filterChips.forEach((chip) => chip.classList.toggle('chip-active', chip.dataset.filter === filter));
    render();
  }

  function handleRingPointerDown(evt) {
    if (evt.target.closest('.event-dot')) return;
    state.selectedId = null;
    render();
  }

  function initQuickAddMenu() {
    if (!addDayItemBtn) return;
    const select = document.createElement('select');
    select.id = 'quickAddSelect';
    select.className = 'quick-add-select';
    select.setAttribute('aria-label', 'Event type');
    quickAddTemplates.forEach((template, index) => {
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = `${eventTypes[template.type]?.icon || '⭐'} ${template.title}`;
      select.appendChild(option);
    });
    addDayItemBtn.insertAdjacentElement('beforebegin', select);
    addDayItemBtn.addEventListener('click', () => {
      const selectedIndex = Number(select.value) || 0;
      const template = quickAddTemplates[selectedIndex] || quickAddTemplates[0];
      if (template) addEventFromTemplate(template);
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

  function copyText(value, message) {
    if (!navigator.clipboard) {
      showToast('Clipboard access unavailable', 'error');
      return;
    }
    navigator.clipboard
      .writeText(value)
      .then(() => showToast(message, 'success'))
      .catch(() => showToast('Unable to copy to clipboard', 'error'));
  }

  function escapeICSValue(value) {
    return String(value || '')
      .replace(/\\/g, '\\\\')
      .replace(/,/g, '\\,')
      .replace(/;/g, '\\;')
      .replace(/\n/g, '\\n');
  }

  function formatICSDateTime(date) {
    const d = new Date(date);
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
  }

  function downloadICS(content, filename) {
    const mimeType = 'text/calendar; charset=utf-8';
    const calendarFile = new File([content], filename, { type: mimeType });
    const url = URL.createObjectURL(calendarFile);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.type = mimeType;
    link.setAttribute('target', '_blank');
    link.setAttribute('data-content-disposition', `inline; filename="${filename}"`);
    link.click();
    URL.revokeObjectURL(url);
  }

  function normalizePlanDate(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    date.setHours(0, 0, 0, 0);
    return date;
  }

  function getPlanEntryForDate(date) {
    const target = normalizePlanDate(date);
    const entries = state.nudgePlan
      .map((entry) => ({ ...entry, day: normalizePlanDate(entry.date) }))
      .filter((entry) => entry.day)
      .sort((a, b) => a.day - b.day);
    if (!target || !entries.length) return null;

    const exact = entries.find((entry) => entry.day.getTime() === target.getTime());
    if (exact) return exact;

    if (target < entries[0].day) return null;

    const pastEntries = entries.filter((entry) => entry.day <= target);
    return pastEntries[pastEntries.length - 1] || null;
  }

  function getSleepDurationFromClock() {
    const duration = getSleepDuration();
    return typeof duration === 'number' ? duration : eventTypes.sleep.defaultDuration;
  }

  function getExportDuration(evt) {
    if (evt.type === 'sleep') return getSleepDurationFromClock();
    return MIN_EXPORT_DURATION;
  }

  function buildExportEventsForDate(date, includeAllEvents = state.exportAllEvents, useYourDayBaseline = false) {
    const planEntry = useYourDayBaseline ? null : getPlanEntryForDate(date);
    const wakeMinutes = typeof planEntry?.wake === 'number' ? planEntry.wake : getYourDayWakeMinutes();
    const delta = signedDelta(getStandardWakeMinutes(), wakeMinutes);
    const shiftedEvents = state.events.map((evt) => ({ ...shiftEvent(evt, delta), baseStart: evt.startMin }));
    const wakeSleepEvents = shiftedEvents.filter((evt) => evt.type === 'wake' || evt.type === 'sleep');
    const filteredEvents = includeAllEvents
      ? [...wakeSleepEvents, ...shiftedEvents.filter((evt) => evt.type !== 'wake' && evt.type !== 'sleep')]
      : wakeSleepEvents;
    const dayLabel =
      planEntry?.label ||
      date.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        timeZone: state.plannerTimeZone === 'local' ? undefined : state.plannerTimeZone
      });
    const shift =
      typeof planEntry?.shift === 'number'
        ? planEntry.shift
        : signedDelta(getYourDayWakeMinutes(), wakeMinutes);
    return { events: filteredEvents, planEntry, dayLabel, shift };
  }

  function buildICSContent(startDate, days, timeZone, includeAllEvents = state.exportAllEvents, options = {}) {
    const { forceYourDayForStart = false } = options;
    const tzid = timeZone === 'local' ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'local' : timeZone;
    const dtstamp = formatICSDateTime(new Date());
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//NightOwl//Nudge Planner//EN',
      'CALSCALE:GREGORIAN',
      'X-WR-CALNAME:NightOwl Your Day',
      `X-WR-TIMEZONE:${tzid}`
    ];

    const base = startOfDayInZone(startDate, timeZone);
    for (let day = 0; day < days; day++) {
      const dayDate = new Date(base);
      dayDate.setDate(base.getDate() + day);
      const { events: dayEvents, dayLabel, shift } = buildExportEventsForDate(
        dayDate,
        includeAllEvents,
        forceYourDayForStart && day === 0
      );
      const shiftText = formatShiftMinutes(shift || 0);
      dayEvents.forEach((evt, idx) => {
        const duration = getExportDuration(evt);
        const startLocal = new Date(dayDate);
        startLocal.setMinutes(evt.startMin);
        const startUtc = zonedTimeToUtc(startLocal, timeZone);
        const endUtc = zonedTimeToUtc(addMinutes(startLocal, duration), timeZone);
        const uid = `${evt.id || 'nightowl'}-${day}-${idx}@nightowl.app`;
        const summary = `${eventTypes[evt.type]?.icon || '⭐'} ${evt.title} · ${shiftText}`;
        const description = `Exported from NightOwl Nudge Planner · ${dayLabel} · ${shiftText} · ${eventTypes[evt.type]?.label || 'Event'}`;
        lines.push('BEGIN:VEVENT');
        lines.push(`UID:${uid}`);
        lines.push(`DTSTAMP:${dtstamp}`);
        lines.push(`DTSTART:${formatICSDateTime(startUtc)}`);
        lines.push(`DTEND:${formatICSDateTime(endUtc)}`);
        lines.push(`SUMMARY:${escapeICSValue(summary)}`);
        lines.push(`DESCRIPTION:${escapeICSValue(description)}`);
        lines.push('END:VEVENT');
      });
    }

    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }

  function getExportRange(period) {
    const today = startOfDayInZone(getNow(), state.plannerTimeZone);
    if (period === 'today') {
      return { start: today, days: 1 };
    }

    if (period === 'tomorrow') {
      const start = new Date(today);
      start.setDate(start.getDate() + 1);
      return { start, days: 1 };
    }

    if (period === 'full-schedule') {
      const targetDate = parseLocalDate(state.targetDate);
      const start = today;
      if (targetDate) {
        const targetDay = startOfDayInZone(targetDate, state.plannerTimeZone);
        const dayMs = 24 * 60 * 60 * 1000;
        const diffDays = Math.floor((targetDay - start) / dayMs);
        return { start, days: Math.max(1, diffDays + 1) };
      }

      return { start, days: Math.max(state.nudgePlan.length || 0, 14) };
    }

    if (period === 'this-week') {
      return { start: today, days: 7 };
    }

    return { start: today, days: 7 };
  }

  function getSelectedExportPeriod() {
    if (!exportPeriodSelect) return state.exportPeriod;
    const value = exportPeriodSelect.value?.trim().toLowerCase();
    const normalised = value?.replace(/\s+/g, '-');
    if (['today', 'tomorrow', 'this-week', 'full-schedule'].includes(normalised)) {
      state.exportPeriod = normalised;
      return normalised;
    }
    showToast('Choose an export period before exporting.', 'error');
    return null;
  }

  function handleExportCalendar(includeAllEvents) {
    state.exportAllEvents = !!includeAllEvents;
    persistState();
    if (!state.events.length) {
      showToast('Add events before exporting.', 'error');
      return;
    }
    const period = getSelectedExportPeriod();
    if (!period) return;
    const { start, days } = getExportRange(period);
    const forceYourDayForStart = period === 'today';
    const ics = buildICSContent(start, days, state.plannerTimeZone, includeAllEvents, { forceYourDayForStart });
    const filename = `nightowl-${period}.ics`;
    downloadICS(ics, filename);
    showToast('Calendar file created. Import into your calendar app.', 'success');
  }

  function buildPlannerSnapshot(includeEvents) {
    return {
      version: 1,
      planner: {
        plannerMode: state.plannerMode,
        plannerDirection: state.plannerDirection,
        targetTime: state.targetTime,
        targetDate: state.targetDate,
        dailyStep: state.dailyStep,
        startSlow: state.startSlow,
        endSlow: state.endSlow,
        timeZone: state.plannerTimeZone,
        displayTimeZone: state.displayTimeZone,
        timeFormat: state.timeFormat
      },
      events: includeEvents ? state.events.map((evt) => ({ ...evt })) : undefined
    };
  }

  const shareTextEncoder = new TextEncoder();
  const shareTextDecoder = new TextDecoder();

  function plannerSnapshotToWire(includeEvents) {
    const snapshot = buildPlannerSnapshot(includeEvents);
    const planner = snapshot.planner || {};

    const wire = {
      v: 1,
      // Planner packed into an array of short keys for a compact wire format
      p: [
        planner.plannerMode || '',
        planner.plannerDirection || '',
        planner.targetTime || '',
        planner.targetDate || '',
        Number(planner.dailyStep) || 0,
        planner.startSlow ? 1 : 0,
        planner.endSlow ? 1 : 0,
        planner.timeZone || '',
        planner.displayTimeZone || '',
        planner.timeFormat || ''
      ]
    };

    if (Array.isArray(snapshot.events)) {
      // Events also use arrays to avoid verbose object keys in the shared payload
      wire.e = snapshot.events.map((evt) => {
        const start = Number.isFinite(evt.startMin) ? evt.startMin : 0;
        const duration = Number.isFinite(evt.duration) ? evt.duration : 0;
        const end = Number.isFinite(evt.endMin)
          ? evt.endMin
          : Number.isFinite(start + duration)
          ? (start + duration) % MINUTES_IN_DAY
          : 0;
        return [
          evt.id || '',
          evt.type || 'custom',
          evt.title || '',
          start,
          duration,
          end,
          evt.repeat || 'daily'
        ];
      });
    }

    return wire;
  }

  function wireToPlannerSnapshot(wire) {
    if (!wire || typeof wire !== 'object') throw new Error('Invalid wire payload');
    const planner = Array.isArray(wire.p) ? wire.p : [];

    const snapshot = {
      version: 1,
      planner: {
        plannerMode: planner[0],
        plannerDirection: planner[1],
        targetTime: planner[2],
        targetDate: planner[3],
        dailyStep: planner[4],
        startSlow: Boolean(planner[5]),
        endSlow: Boolean(planner[6]),
        timeZone: planner[7],
        displayTimeZone: planner[8],
        timeFormat: planner[9]
      }
    };

    if (Array.isArray(wire.e)) {
      snapshot.events = wire.e.map((evt) => ({
        id: evt[0],
        type: evt[1],
        title: evt[2],
        startMin: evt[3],
        duration: evt[4],
        endMin: evt[5],
        repeat: evt[6]
      }));
    }

    return snapshot;
  }

  function toUrlSafeBase64(bytes) {
    let binary = '';
    bytes.forEach((b) => {
      binary += String.fromCharCode(b);
    });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function fromUrlSafeBase64(input) {
    const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  async function compressStringToBase64(input) {
    const encoded = shareTextEncoder.encode(input);
    if (typeof CompressionStream === 'function') {
      try {
        const cs = new CompressionStream('gzip');
        const writer = cs.writable.getWriter();
        await writer.write(encoded);
        await writer.close();
        const compressed = new Uint8Array(await new Response(cs.readable).arrayBuffer());
        return toUrlSafeBase64(compressed);
      } catch (err) {
        console.warn('Share compression failed; falling back to uncompressed payload', err);
      }
    }
    return toUrlSafeBase64(encoded);
  }

  async function decompressBase64String(input) {
    const encoded = fromUrlSafeBase64(input);
    if (typeof DecompressionStream === 'function') {
      try {
        const ds = new DecompressionStream('gzip');
        const writer = ds.writable.getWriter();
        await writer.write(encoded);
        await writer.close();
        const decompressed = await new Response(ds.readable).arrayBuffer();
        return shareTextDecoder.decode(decompressed);
      } catch (err) {
        console.warn('Share decompression failed; attempting raw decode', err);
      }
    }
    try {
      return shareTextDecoder.decode(encoded);
    } catch (err) {
      console.warn('Share payload decode failed', err);
      return '';
    }
  }

  async function encodeSharePayload(includeEvents) {
    try {
      const wire = plannerSnapshotToWire(includeEvents);
      const json = JSON.stringify(wire);
      return await compressStringToBase64(json);
    } catch (err) {
      console.warn('Failed to encode share payload', err);
      return '';
    }
  }

  async function decodeSharePayload(payload) {
    if (!payload) return null;
    try {
      const json = await decompressBase64String(payload);
      if (!json) return null;
      return wireToPlannerSnapshot(JSON.parse(json));
    } catch (err) {
      console.warn('Failed to decode shared planner', err);
    }
    return null;
  }

  function extractShareCode(input) {
    const trimmed = (input || '').trim();
    if (!trimmed) return null;
    const parseHash = (hash) => {
      const params = new URLSearchParams(hash.replace(/^#/, ''));
      return params.get(SHARE_HASH_KEY);
    };
    try {
      const maybeUrl = new URL(trimmed);
      return parseHash(maybeUrl.hash) || trimmed;
    } catch (err) {
      return parseHash(trimmed) || trimmed;
    }
  }

  function applySharedPlanner(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') throw new Error('Invalid snapshot');
    const planner = snapshot.planner || snapshot;
    state.plannerMode = planner.plannerMode || state.plannerMode;
    state.plannerDirection = planner.plannerDirection || state.plannerDirection;
    state.targetTime = planner.targetTime || state.targetTime;
    state.targetDate = planner.targetDate || state.targetDate;
    state.dailyStep = clamp(Number(planner.dailyStep) || state.dailyStep, 5, 120);
    if (typeof planner.startSlow === 'boolean' || typeof planner.endSlow === 'boolean') {
      state.startSlow = !!planner.startSlow;
      state.endSlow = !!planner.endSlow;
    } else if (planner.adjustmentCurve === 'curved') {
      state.startSlow = true;
      state.endSlow = true;
    } else {
      state.startSlow = false;
      state.endSlow = false;
    }
    state.plannerTimeZone = normalizeTimeZoneValue(planner.timeZone || state.plannerTimeZone);
    state.displayTimeZone = normalizeTimeZoneValue(planner.displayTimeZone || state.displayTimeZone);
    state.timeFormat = planner.timeFormat === '12h' ? '12h' : state.timeFormat;
    if (typeof planner.lockToWake === 'boolean') {
      state.lockToWake = planner.lockToWake;
    }
    const hasEvents = Array.isArray(snapshot.events);
    if (hasEvents) {
      state.events = snapshot.events.map((evt) => normalizeEvent(evt)).filter(Boolean);
    }
    ensureAnchorEvents();
    state.shareIncludeEvents = hasEvents;
    persistState();
    syncPlannerControls();
    setDisplayTimezone(state.displayTimeZone);
    updateTimeFormatToggle();
    render();
  }

  async function generateShareLink(includeEvents) {
    const code = await encodeSharePayload(includeEvents);
    const url = new URL(window.location.href);
    if (code) {
      url.hash = `${SHARE_HASH_KEY}=${code}`;
    } else {
      url.hash = '';
    }
    window.history.replaceState(null, '', url);
    return { code, url: url.toString() };
  }

  function formatShareCodePreview(code) {
    if (!code) return '';
    if (code.length <= 120) return code;
    return `${code.slice(0, 60)}…${code.slice(-16)}`;
  }

  async function updateShareDialog() {
    if (!shareLayer) return;
    state.shareIncludeEvents = Boolean(shareIncludeEventsToggle?.checked);
    const { code, url } = await generateShareLink(state.shareIncludeEvents);
    if (shareLinkInput) shareLinkInput.value = url;
    if (shareCode) {
      shareCode.textContent = formatShareCodePreview(code);
      shareCode.dataset.fullCode = code;
      shareCode.setAttribute('title', code);
    }
    persistState();
  }

  function openShareDialog() {
    if (!shareLayer) return;
    if (shareIncludeEventsToggle) shareIncludeEventsToggle.checked = !!state.shareIncludeEvents;
    updateShareDialog();
    shareLayer.hidden = false;
    if (shareLinkInput) shareLinkInput.focus();
    if (!shareKeyListenerAttached) {
      document.addEventListener('keydown', handleShareKeydown);
      shareKeyListenerAttached = true;
    }
  }

  function closeShareDialog() {
    if (shareLayer) shareLayer.hidden = true;
    if (shareKeyListenerAttached) {
      document.removeEventListener('keydown', handleShareKeydown);
      shareKeyListenerAttached = false;
    }
  }

  function handleShareCopyLink() {
    if (shareLinkInput && shareLinkInput.value) copyText(shareLinkInput.value, 'Link copied');
  }

  function handleShareCopyCode() {
    const code = shareCode?.dataset.fullCode || shareCode?.textContent;
    if (code) copyText(code, 'Code copied');
  }

  function handleSavePlanner() {
    const snapshot = buildPlannerSnapshot(true);
    localStorage.setItem(SAVED_PLANNER_KEY, JSON.stringify(snapshot));
    showToast('Planner saved in this browser', 'success');
  }

  async function handleLoadPlanner() {
    const saved = localStorage.getItem(SAVED_PLANNER_KEY);
    if (saved) {
      try {
        applySharedPlanner(JSON.parse(saved));
        showToast('Loaded saved planner', 'success');
        return;
      } catch (err) {
        console.warn('Failed to load saved planner', err);
      }
    }

    const input = window.prompt('Paste a shared NightOwl link or code to load a planner:');
    if (!input) return;
    const code = extractShareCode(input);
    const snapshot = await decodeSharePayload(code);
    if (!snapshot) {
      showToast('Unable to load planner', 'error');
      return;
    }
    applySharedPlanner(snapshot);
    showToast('Shared planner loaded', 'success');
  }

  async function loadSharedPlannerFromURL() {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const code = params.get(SHARE_HASH_KEY);
    if (!code) return;
    const snapshot = await decodeSharePayload(code);
    if (!snapshot) {
      showToast('Unable to load shared planner from link', 'error');
      return;
    }
    applySharedPlanner(snapshot);
    showToast('Loaded shared planner from link', 'success');
  }

  function initShareControls() {
    if (sharePlannerBtn) sharePlannerBtn.addEventListener('click', openShareDialog);
    if (savePlannerBtn) savePlannerBtn.addEventListener('click', handleSavePlanner);
    if (loadPlannerBtn) loadPlannerBtn.addEventListener('click', handleLoadPlanner);
    shareCloseEls.forEach((el) => el.addEventListener('click', closeShareDialog));
    if (shareIncludeEventsToggle) shareIncludeEventsToggle.addEventListener('change', updateShareDialog);
    if (shareCopyLinkBtn) shareCopyLinkBtn.addEventListener('click', handleShareCopyLink);
    if (shareCopyCodeBtn) shareCopyCodeBtn.addEventListener('click', handleShareCopyCode);
  }

  function handleShareKeydown(evt) {
    if (!shareLayer) return;
    if (evt.key === 'Escape' && !shareLayer.hidden) {
      closeShareDialog();
    }
  }

  function initExportControls() {
    if (exportPeriodSelect) {
      exportPeriodSelect.value = state.exportPeriod;
      exportPeriodSelect.addEventListener('change', () => {
        const selected = getSelectedExportPeriod();
        if (selected) {
          state.exportPeriod = selected;
          persistState();
        }
      });
    }
    if (exportWakeSleepBtn) exportWakeSleepBtn.addEventListener('click', () => handleExportCalendar(false));
    if (exportAllEventsBtn) exportAllEventsBtn.addEventListener('click', () => handleExportCalendar(true));
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
    const textScaleReset = $('textScaleReset');
    if (textScaleReset) textScaleReset.addEventListener('click', () => applyTextScale(1));
    applyTextScale(state.textScale);
  }

  function initPlannerControls() {
    if (plannerModeSelect) plannerModeSelect.addEventListener('change', (evt) => updatePlannerMode(evt.target.value));
    if (targetTimeInput) targetTimeInput.addEventListener('change', (evt) => updateTargetTime(evt.target.value));
    if (targetDateInput) targetDateInput.addEventListener('change', (evt) => updateTargetDate(evt.target.value));
    if (dailyStepRange) dailyStepRange.addEventListener('input', (evt) => updateDailyStep(evt.target.value));
    if (startSlowToggle) startSlowToggle.addEventListener('change', (evt) => updateCurveSetting('startSlow', evt.target.checked));
    if (endSlowToggle) endSlowToggle.addEventListener('change', (evt) => updateCurveSetting('endSlow', evt.target.checked));
    syncPlannerControls();
  }

  function initTimezoneControls() {
    displayTimeZonePicker = createTimeZonePicker(displayTimeZonePickerRoot, {
      value: state.displayTimeZone,
      allowLocal: true,
      onChange: setDisplayTimezone,
      labels: { country: 'Country or region', zone: 'Time zone', local: 'Use local time' },
      labelClass: 'sr-only'
    });

    plannerTimeZonePicker = createTimeZonePicker(plannerTimeZonePickerRoot, {
      value: state.plannerTimeZone,
      allowLocal: true,
      onChange: setPlannerTimezone,
      labels: { country: 'Country or region', zone: 'Time zone', local: 'Use local time' }
    });
  }

  function initTimeFormatControls() {
    updateTimeFormatToggle();
    if (timeFormatToggle) timeFormatToggle.addEventListener('click', toggleTimeFormat);
  }

  function initOverrideControls() {
    applyOverrideBtn.addEventListener('click', applyOverride);
    clearOverrideBtn.addEventListener('click', clearOverride);
    updateOverrideUI();
  }

  function initLockToggle() {
    if (!lockWakeToggle) return;
    lockWakeToggle.checked = !!state.lockToWake;
    lockWakeToggle.addEventListener('change', (evt) => {
      state.lockToWake = evt.target.checked;
      persistState();
    });
  }

  function setActiveTab(tab) {
    state.activeTab = tab === 'standard' ? 'standard' : 'your';
    tabButtons.forEach((btn) => {
      const isActive = btn.getAttribute('data-tab') === state.activeTab;
      btn.classList.toggle('tab-active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
      const panelId = btn.getAttribute('aria-controls');
      const panel = panelId ? document.getElementById(panelId) : null;
      if (panel) panel.hidden = !isActive;
    });
    if (yourDayTabPanel) yourDayTabPanel.hidden = state.activeTab !== 'your';
    if (standardDayTabPanel) standardDayTabPanel.hidden = state.activeTab !== 'standard';
    persistState();
  }

  function initTabs() {
    if (!tabButtons.length) return;
    tabButtons.forEach((btn) => {
      btn.addEventListener('click', () => setActiveTab(btn.getAttribute('data-tab')));
    });
    setActiveTab(state.activeTab);
  }

  function syncYourDayWakeInput() {
    if (!yourDayWakeInput) return;
    yourDayWakeInput.value = minutesToTime(getYourDayWakeMinutes());
  }

  function initYourDayWakeInput() {
    if (!yourDayWakeInput) return;
    yourDayWakeInput.addEventListener('change', (evt) => {
      const minutes = toMinutes(evt.target.value);
      state.yourDayWakeMinutes = minutes;
      persistState();
      render();
    });
    syncYourDayWakeInput();
  }

  function resetStandardDay() {
    state.events = defaultEvents();
    state.standardWakeMinutes = toMinutes('07:00');
    state.yourDayWakeMinutes = state.standardWakeMinutes;
    state.selectedId = null;
    state.openEditorId = null;
    persistState();
    render();
    showToast('Standard Day reset to defaults', 'success');
  }

  function initStandardDayControls() {
    if (resetStandardDayBtn) {
      resetStandardDayBtn.addEventListener('click', resetStandardDay);
    }
  }

  async function init() {
    loadState();
    await loadSharedPlannerFromURL();
    applyTheme(state.theme);
    initTextScaling();
    initThemeButtons();
    initTabs();
    initTimezoneControls();
    initTimeFormatControls();
    initPlannerControls();
    initFilterChips();
    initSegmentControl();
    initRingInteraction();
    initQuickAddMenu();
    initAdvancedAccordion();
    initOverrideControls();
    initLockToggle();
    initYourDayWakeInput();
    initShareControls();
    initExportControls();
    initStandardDayControls();
    render();
    setInterval(() => {
      renderStandardClock();
      renderYourDayClock();
      renderNextEventLabels();
    }, 60000);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
