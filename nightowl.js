/* nightowl.js */
(() => {
  const MINUTES_IN_DAY = 24 * 60;
  const STORAGE_KEY = 'nightowl.events.v2';
  const PREFS_KEY = 'nightowl.prefs.v2';
  const PROFILES_KEY = 'nightowl.profiles.v1';
  const OVERRIDE_KEY = 'nightowl.override.v1';
  const SNAP_DEFAULT = 5;
  const SNAP_ALT = 1;
  const SNAP_SHIFT = 15;
  const MIN_EXPORT_DURATION = 1;
  const TEXT_SCALE_STEP = 0.1;
  const SHARE_PARAM = 'planner';
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
  const profileSelect = $('profileSelect');
  const saveProfileBtn = $('saveProfileBtn');
  const resetPresetsBtn = $('resetPresetsBtn');
  const realDayList = $('realDayList');
  const yourDayWakeInput = $('yourDayWakeInput');
  const tabButtons = Array.from(document.querySelectorAll('[data-tab]'));
  const yourDayTabPanel = $('yourDayTab');
  const standardDayTabPanel = $('standardDayTab');
  const plannerTabPanel = $('plannerTab');
  const ringTooltip = $('clockTooltip');
  const yourRingTooltip = $('yourClockTooltip');
  let shareKeyListenerAttached = false;

  const timeZoneCountries = (window.timeZoneData && window.timeZoneData.countries) || [];
  const timeZoneIndex = (window.timeZoneData && window.timeZoneData.zoneIndex) || new Map();

  const eventTypes = {
    sleep: { icon: '🌙', label: 'Sleep', colorKey: 'sleep' },
    wake: { icon: '☀️', label: 'Wake', colorKey: 'wake' },
    meal: { icon: '🍽️', label: 'Meal', colorKey: 'meal' },
    exercise: { icon: '🧘‍♀️', label: 'Exercise', colorKey: 'exercise' },
    work: { icon: '💼', label: 'Work', colorKey: 'work' },
    light: { icon: '💡', label: 'Bright light', colorKey: 'light' },
    custom: { icon: '⭐', label: 'Custom', colorKey: 'wake' }
  };

  const quickAddTemplates = [
    { type: 'wake', title: 'Wake' },
    { type: 'meal', title: 'Breakfast' },
    { type: 'work', title: 'Work' },
    { type: 'meal', title: 'Lunch' },
    { type: 'exercise', title: 'Exercise' },
    { type: 'meal', title: 'Dinner' },
    { type: 'custom', title: 'Note' },
    { type: 'sleep', title: 'Sleep' }
  ];

  const defaultWeekdayEvents = () => [
    createEvent('wake', 'Wake', toMinutes('07:00')),
    createEvent('meal', 'Breakfast', toMinutes('08:00')),
    createEvent('work', 'Work', toMinutes('09:00')),
    createEvent('meal', 'Lunch', toMinutes('12:00')),
    createEvent('exercise', 'Exercise', toMinutes('18:00')),
    createEvent('meal', 'Dinner', toMinutes('19:00')),
    createEvent('sleep', 'Sleep', toMinutes('22:00'))
  ];

  const defaultWeekendEvents = () => [
    createEvent('wake', 'Wake', toMinutes('09:00')),
    createEvent('meal', 'Breakfast', toMinutes('10:00')),
    createEvent('meal', 'Lunch', toMinutes('14:00')),
    createEvent('exercise', 'Exercise', toMinutes('20:00')),
    createEvent('meal', 'Dinner', toMinutes('21:00')),
    createEvent('sleep', 'Sleep', toMinutes('00:00'))
  ];

  const defaultEvents = () => defaultWeekdayEvents();

  function getWakeFromEvents(events) {
    const wake = (events || []).find((evt) => evt.type === 'wake');
    return typeof wake?.startMin === 'number' ? wake.startMin : toMinutes('07:00');
  }

  function createProfile(id, name, events, type = 'custom', wakeMinutes) {
    const normalizedEvents = (events || []).map((evt) => normalizeEvent(evt)).filter(Boolean);
    const standardWakeMinutes = normalizeDayMinutes(
      typeof wakeMinutes === 'number' ? wakeMinutes : getWakeFromEvents(normalizedEvents)
    );
    return {
      id,
      name,
      events: normalizedEvents,
      type,
      standardWakeMinutes
    };
  }

  function cloneProfile(profile) {
    if (!profile) return null;
    return createProfile(profile.id, profile.name, profile.events, profile.type, profile.standardWakeMinutes);
  }

  function getDefaultProfiles() {
    return {
      weekday: createProfile('weekday', 'Weekday', defaultWeekdayEvents(), 'preset', toMinutes('07:00')),
      weekend: createProfile('weekend', 'Weekend', defaultWeekendEvents(), 'preset', toMinutes('09:00'))
    };
  }

  function countEventsByType(type) {
    return state.events.filter((evt) => evt.type === type).length;
  }

  function ensureAnchorEvents() {
    let added = false;
    if (!state.events.some((evt) => evt.type === 'wake')) {
      state.events.push(createEvent('wake', 'Wake', toMinutes('07:00')));
      added = true;
    }
    if (!state.events.some((evt) => evt.type === 'sleep')) {
      const start = toMinutes('23:00');
      const end = toMinutes('07:00');
      state.events.push(createEvent('sleep', 'Sleep', start));
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
    exportAllEvents: false,
    autoProfileSelection: true,
    profiles: {},
    activeProfileId: 'weekday'
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

  function slugifyName(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'profile';
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

  function createEvent(type, title, startMin) {
    const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `evt-${Math.random().toString(36).slice(2, 10)}`;
    const start = ((startMin % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
    return { id, type, title, startMin: start };
  }

  function normalizeEvent(evt) {
    if (!evt) return null;
    const type = eventTypes[evt.type] ? evt.type : 'custom';
    const title = evt.title || eventTypes[type]?.label || 'Event';
    const start = typeof evt.startMin === 'number' ? ((evt.startMin % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY : 0;
    return { ...evt, type, title, startMin: start };
  }

  function persistProfiles() {
    localStorage.setItem(
      PROFILES_KEY,
      JSON.stringify({ profiles: state.profiles, activeProfileId: state.activeProfileId })
    );
  }

  function ensurePresetProfiles(baseProfiles = {}) {
    const defaults = getDefaultProfiles();
    return {
      ...defaults,
      ...baseProfiles,
      weekday: baseProfiles.weekday || defaults.weekday,
      weekend: baseProfiles.weekend || defaults.weekend
    };
  }

  function loadProfiles() {
    let storedProfiles = null;
    try {
      storedProfiles = JSON.parse(localStorage.getItem(PROFILES_KEY) || 'null');
    } catch (err) {
      console.warn('Failed to load profiles', err);
    }

    let profiles = ensurePresetProfiles();
    let activeProfileId = state.activeProfileId || 'weekday';

    if (storedProfiles && typeof storedProfiles === 'object') {
      profiles = Object.entries(storedProfiles.profiles || {}).reduce((acc, [id, profile]) => {
        const normalized = createProfile(
          id,
          profile?.name || id,
          profile?.events || [],
          profile?.type || 'custom',
          profile?.standardWakeMinutes
        );
        acc[id] = normalized;
        return acc;
      }, {});
      profiles = ensurePresetProfiles(profiles);
      activeProfileId = storedProfiles.activeProfileId && profiles[storedProfiles.activeProfileId]
        ? storedProfiles.activeProfileId
        : 'weekday';
    } else {
      profiles = ensurePresetProfiles();
      if (state.events?.length) {
        const imported = createProfile('custom-1', 'Custom', state.events, 'custom', state.standardWakeMinutes);
        profiles[imported.id] = imported;
        activeProfileId = imported.id;
      } else {
        const feelsWeekend = isFeelsLikeWeekend();
        activeProfileId = feelsWeekend ? 'weekend' : 'weekday';
      }
    }

    state.profiles = profiles;
    state.activeProfileId = profiles[activeProfileId] ? activeProfileId : 'weekday';
    applyProfile(state.activeProfileId, { skipPersist: true, skipRender: true });
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
        state.activeTab = ['standard', 'planner'].includes(prefs.activeTab) ? prefs.activeTab : 'your';
        state.activeProfileId = prefs.activeProfileId || state.activeProfileId;
        if (typeof prefs.autoProfileSelection === 'boolean') {
          state.autoProfileSelection = prefs.autoProfileSelection;
        }
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

    loadProfiles();

    if (ensureAnchorEvents()) {
      const updated = createProfile(
        state.activeProfileId,
        state.profiles[state.activeProfileId]?.name || 'Custom',
        state.events,
        state.profiles[state.activeProfileId]?.type || 'custom',
        state.standardWakeMinutes
      );
      state.profiles[state.activeProfileId] = updated;
      persistProfiles();
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
        activeTab: state.activeTab,
        activeProfileId: state.activeProfileId,
        autoProfileSelection: state.autoProfileSelection
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
    return ((mins % (MINUTES_IN_DAY / 2)) / (MINUTES_IN_DAY / 2)) * 360;
  }

  function formatHourTick(hour) {
    const hours24 = ((hour % 24) + 24) % 24;
    return hours24 === 0 || hours24 === 12 || hours24 === 24 ? '12' : String(hours24 % 12);
  }

  function formatHourTick24(hour) {
    const val = ((hour % 24) + 24) % 24;
    return pad(val);
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

  const INNER_RING_OFFSET = 40;
  const INNER_RING_SCALE = 0.85;

  function getInnerRadius(outerRadius) {
    return (outerRadius - INNER_RING_OFFSET) * INNER_RING_SCALE;
  }

  function getRadiusForTime(mins, maxRadius) {
    const isPm = (mins % MINUTES_IN_DAY) >= (MINUTES_IN_DAY / 2);
    // AM = outer, PM = inner
    // Let's define the rings relative to maxRadius (which is ~150)
    // Outer ring ~150, Inner ring scaled down for emphasis
    return isPm ? getInnerRadius(maxRadius) : maxRadius;
  }

  function rotatePoint(mins, radius, center, offset = 0) {
    const effRadius = getRadiusForTime(mins, radius);
    const angle = angleFromMinutes(mins) - 90 + offset;
    return polarToCartesian(center, center, effRadius, angle + 90);
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
    if (wake) return normalizeDayMinutes(wake.startMin - (9 * 60));
    return toMinutes('22:00');
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
      return 9 * 60;
    }
    let duration = Math.abs(sleepStart - wakeStart);
    if (duration > MINUTES_IN_DAY / 2) {
      duration = MINUTES_IN_DAY - duration;
    }
    return duration || (9 * 60);
  }

  function feelsLikeMinutes(nowMinutes) {
    const standardWake = getStandardWakeMinutes();
    const wakeStart = getYourDayWakeMinutes();
    return normalizeDayMinutes(nowMinutes + standardWake - wakeStart);
  }

  function getFeelsLikeDate() {
    const now = getNowInZone(state.displayTimeZone);
    const deltaMinutes = getStandardWakeMinutes() - getYourDayWakeMinutes();
    return new Date(now.getTime() + deltaMinutes * 60 * 1000);
  }

  function isFeelsLikeWeekend() {
    const feelsDate = getFeelsLikeDate();
    const day = feelsDate.getDay();
    return day === 0 || day === 6;
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

  function applyProfile(profileId, options = {}) {
    const profile = cloneProfile(state.profiles[profileId]);
    if (!profile) return;

    state.activeProfileId = profile.id;
    state.events = profile.events.map((evt) => ({ ...evt }));
    state.standardWakeMinutes = profile.standardWakeMinutes;
    state.yourDayWakeMinutes = profile.standardWakeMinutes;
    state.selectedId = null;
    state.openEditorId = null;
    refreshProfileSelect();

    if (!options.skipPersist) {
      persistProfiles();
      persistState();
    }

    if (!options.skipRender) {
      render();
    }
  }

  function isCustomProfileActive() {
    const active = state.profiles[state.activeProfileId];
    return active?.type === 'custom';
  }

  function maybeAutoSelectPresetProfile() {
    if (!state.profiles || !Object.keys(state.profiles).length) return;
    if (!state.autoProfileSelection) return;
    if (isCustomProfileActive()) return;
    const desired = isFeelsLikeWeekend() ? 'weekend' : 'weekday';
    if (state.activeProfileId !== desired && state.profiles[desired]) {
      applyProfile(desired, { skipRender: true });
    }
  }

  function render() {
    maybeAutoSelectPresetProfile();
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

    // Outer AM ring
    const backdrop = createSVG('circle', { cx: center, cy: center, r: radius, class: 'clock-backdrop' });
    ring.appendChild(backdrop);

    // Inner PM ring (thin line)
    const innerRadius = getInnerRadius(radius);
    const innerRing = createSVG('circle', { cx: center, cy: center, r: innerRadius, class: 'clock-backdrop-inner' });
    ring.appendChild(innerRing);

    return { center, radius };
  }

  function drawSegmentedArc(ring, center, outerRadius, startMin, endMin, className) {
    const start = ((startMin % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
    const end = ((endMin % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
    const duration = start <= end ? end - start : (MINUTES_IN_DAY - start) + end;

    // We break the duration into AM (0-720) and PM (720-1440) chunks
    const innerRadius = getInnerRadius(outerRadius);

    // Simplest way: iterate through duration in chunks
    // But specific AM/PM boundaries (720 and 0/1440) are important

    let current = start;
    let remaining = duration;

    // Maximum 2 loops (24 hours)
    let iter = 0;
    while (remaining > 0 && iter < 4) {
      iter++;
      const currentRef = current % MINUTES_IN_DAY;
      const isPm = currentRef >= 720;
      const bound = isPm ? 1440 : 720;
      const distToBound = bound - currentRef;
      const step = Math.min(remaining, distToBound);

      if (step <= 0) { // Should not happen if logic matches
        current += 1; // force advance to avoid infinite
        continue;
      }

      const segStartAngle = angleFromMinutes(currentRef);
      const segEndAngle = angleFromMinutes(currentRef + step);

      // If full circle (step = 720), angles might be same, need large arc
      // handle full ring case if step == 720?
      // angleFromMinutes returns 0-360

      // Note: angleFromMinutes(x) and angleFromMinutes(x+720) are same.
      // We just draw from segStartAngle to segEndAngle?
      // Be careful with wrap around 360 in the visual 12-hour dial.
      // e.g. 11:00 (330 deg) to 1:00 (30 deg).
      // describeArc handles this IF endAngle > startAngle logic is correct or consistent.
      // describeArc expects degrees.
      // If step is small, endAngle > startAngle (modulo 360 logic needed?)

      // Actually describeArc logic:
      // const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
      // It assumes straight mapping.

      // Let's rely on angleFromMinutes returning linear degrees 0..360?
      // No, modulo.
      // We should calculate rotation amount.

      const rotation = (step / 720) * 360;
      const drawStart = segStartAngle;
      const drawEnd = drawStart + rotation;

      const r = isPm ? innerRadius : outerRadius;

      // Adjust for "thickness" if needed, but for now single lines/arcs
      if (Math.abs(drawEnd - drawStart) > 0.01) {
        const arcPath = createSVG('path', {
          d: describeArc(center, center, r, drawStart, drawEnd),
          class: className
        });
        ring.appendChild(arcPath);
      }

      current += step;
      remaining -= step;
    }
  }



  function drawSleepWindowArc(ring, center, radius, window) {
    if (!window || !ring) return;
    const { start, duration } = window;
    // sleep window is often slightly smaller radius or stroke
    // modifying drawSegmentedArc to accept radius offset would be cleaner
    // but here we can just pass r - 10 manually if we inline logic or adapt helper

    // Let's duplicate logic for now or make helper better?
    // Reuse drawSegmentedArc but with custom class which might handle stroke style
    // But we need radius-10.

    const startMin = start;
    const endMin = start + duration;

    let current = startMin;
    let remaining = duration;
    let iter = 0;
    const outerRadius = radius;
    const innerRadius = getInnerRadius(radius);

    while (remaining > 0 && iter < 4) {
      iter++;
      const currentRef = current % MINUTES_IN_DAY;
      const isPm = currentRef >= 720;
      const bound = isPm ? 1440 : 720;
      const distToBound = bound - currentRef;
      const step = Math.min(remaining, distToBound);

      if (step <= 0) { current += 1; continue; }

      const segStartAngle = angleFromMinutes(currentRef);
      const rotation = (step / 720) * 360;
      const drawStart = segStartAngle;
      const drawEnd = drawStart + rotation;

      const r = (isPm ? innerRadius : outerRadius) - 10;

      if (Math.abs(drawEnd - drawStart) > 0.01) {
        const sleepArc = createSVG('path', {
          d: describeArc(center, center, r, drawStart, drawEnd),
          class: 'clock-sleep-window'
        });
        ring.appendChild(sleepArc);
      }

      current += step;
      remaining -= step;
    }
  }

  function drawHourTicks(ring, center, radius) {
    if (!ring) return;
    const innerRadius = getInnerRadius(radius);

    // Draw 1-12 on outer ring
    for (let h = 1; h <= 12; h++) {
      const angle = (h / 12) * 360;
      const cos = Math.cos(((angle - 90) * Math.PI) / 180);
      const sin = Math.sin(((angle - 90) * Math.PI) / 180);
      const line = createSVG('line', {
        x1: center + cos * (radius - 8),
        y1: center + sin * (radius - 8),
        x2: center + cos * radius,
        y2: center + sin * radius,
        class: 'clock-hour-tick'
      });
      ring.appendChild(line);
      const label = createSVG('text', {
        x: center + cos * (radius + 24),
        y: center + sin * (radius + 24) + 4,
        class: 'clock-hour-number'
      });
      label.textContent = String(h);
      ring.appendChild(label);
    }

    // If 24h mode, draw 13-24 (00) on inner ring
    if (state.timeFormat === '24h') {
      for (let h = 13; h <= 24; h++) {
        const angle = (h / 12) * 360;
        const cos = Math.cos(((angle - 90) * Math.PI) / 180);
        const sin = Math.sin(((angle - 90) * Math.PI) / 180);

        // Ticks for inner ring? Maybe small dots or just numbers
        const line = createSVG('line', {
          x1: center + cos * (innerRadius - 4),
          y1: center + sin * (innerRadius - 4),
          x2: center + cos * (innerRadius + 4),
          y2: center + sin * (innerRadius + 4),
          class: 'clock-hour-tick',
          style: 'opacity: 0.5'
        });
        ring.appendChild(line);

        const label = createSVG('text', {
          x: center + cos * (innerRadius + 16),
          y: center + sin * (innerRadius + 16) + 4,
          class: 'clock-hour-number',
          style: 'font-size: 0.675rem; fill: var(--text-3);'
        });
        // 24 maps to 00 sometimes, but user request "13-23" (and probably 0/24 implied)
        // simplified: 13, 14, ... 23, 00
        label.textContent = formatHourTick24(h);
        ring.appendChild(label);
      }
    }
  }

  function renderStandardClock() {
    hideEventTooltip(ringTooltip);
    const frame = prepareClock(dayRing);
    if (!frame) return;
    const { center, radius } = frame;
    // drawSleepWindowArc(dayRing, center, radius, getSleepWindow());
    drawHourTicks(dayRing, center, radius);

    const now = getNowInZone(state.displayTimeZone);
    const nowMinutes = minutesInZone(now, state.displayTimeZone);
    const feelsMinutes = feelsLikeMinutes(nowMinutes);
    const nowRadius = getRadiusForTime(nowMinutes, radius);
    const feelsRadius = getRadiusForTime(feelsMinutes, radius);
    drawClockHands(dayRing, center, nowMinutes, nowRadius, 'clock-now-hand');
    drawClockHands(dayRing, center, feelsMinutes, feelsRadius, 'clock-feels-hand');

    const centerDot = createSVG('circle', { cx: center, cy: center, r: 5.1, class: 'clock-center' });
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
    hideEventTooltip(yourRingTooltip);
    const frame = prepareClock(yourDayRing);
    if (!frame) return;
    const { center, radius } = frame;
    const sleepWindow = getSleepWindow();
    /*
    if (sleepWindow) {
      const shiftedStart = mapStandardToRealMinutes(sleepWindow.start);
      drawSleepWindowArc(yourDayRing, center, radius, {
        start: shiftedStart,
        duration: sleepWindow.duration
      });
    }
    */
    drawHourTicks(yourDayRing, center, radius);

    const now = getNowInZone(state.displayTimeZone);
    const nowMinutes = minutesInZone(now, state.displayTimeZone);
    const feelsMinutes = feelsLikeMinutes(nowMinutes);
    const nowRadius = getRadiusForTime(nowMinutes, radius);
    const feelsRadius = getRadiusForTime(feelsMinutes, radius);
    drawClockHands(yourDayRing, center, nowMinutes, nowRadius, 'clock-now-hand');
    drawClockHands(yourDayRing, center, feelsMinutes, feelsRadius, 'clock-feels-hand');

    const centerDot = createSVG('circle', { cx: center, cy: center, r: 5.1, class: 'clock-center' });
    yourDayRing.appendChild(centerDot);

    renderYourDayMarkers(getYourDayEvents(), center, radius);
    updateClockLabels(nowMinutes, feelsMinutes, yourNowLabel, yourFeelsLikeLabel);
  }

  function updateClockLabels(nowMinutes, feelsMinutes, nowEl, feelsEl) {
    if (feelsEl) feelsEl.innerHTML = `<span class="feels-like-text">Feels like</span> · <span class="feels-like-time">${formatMinutes(feelsMinutes)}</span>`;
    if (nowEl) nowEl.textContent = `Real time · ${formatMinutes(nowMinutes)}`;
  }

  function drawClockHands(ring, center, minutes, radius, toneClass) {
    const totalMinutes = ((minutes % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
    const hours = Math.floor(totalMinutes / 60) % 12;
    const mins = totalMinutes % 60;
    const hourAngle = ((hours + mins / 60) / 12) * 360;
    const minuteAngle = (mins / 60) * 360;
    const hourLength = Math.max(radius - 54, 28);
    const minuteLength = Math.max(radius - 26, 40);

    const hourHand = createSVG('line', {
      x1: center,
      y1: center,
      x2: center + Math.cos(((hourAngle - 90) * Math.PI) / 180) * hourLength,
      y2: center + Math.sin(((hourAngle - 90) * Math.PI) / 180) * hourLength,
      class: `clock-hand clock-hand-hour ${toneClass}`
    });
    ring.appendChild(hourHand);

    const minuteHand = createSVG('line', {
      x1: center,
      y1: center,
      x2: center + Math.cos(((minuteAngle - 90) * Math.PI) / 180) * minuteLength,
      y2: center + Math.sin(((minuteAngle - 90) * Math.PI) / 180) * minuteLength,
      class: `clock-hand clock-hand-minute ${toneClass}`
    });
    ring.appendChild(minuteHand);
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
      startMin: (evt.startMin + shift + MINUTES_IN_DAY) % MINUTES_IN_DAY
    };
  }

  function drawEventDot(evt, center, radius) {
    const { x, y } = rotatePoint(evt.startMin, radius, center);
    const meta = eventTypes[evt.type] || eventTypes.custom;

    // Create a group to hold the hit target (invisible circle) and the visible icon
    const group = createSVG('g', {
      class: 'event-dot-group',
      'data-type': evt.type,
      'data-event-id': evt.id,
      'data-selected': state.selectedId === evt.id ? 'true' : 'false',
      transform: `translate(${x}, ${y})`,
      style: 'cursor: grab;'
    });

    // Hit target
    const hitTarget = createSVG('circle', {
      cx: 0,
      cy: 0,
      r: 16,
      fill: 'transparent',
      class: 'event-hit-target',
      tabindex: 0
    });

    // Icon
    const icon = createSVG('text', {
      x: 0,
      y: 0,
      'dominant-baseline': 'central',
      'text-anchor': 'middle',
      'font-size': '1.35rem',
      'pointer-events': 'none' // Let events pass to group/hitTarget
    });
    icon.textContent = meta.icon;

    group.appendChild(hitTarget);
    group.appendChild(icon);

    hitTarget.addEventListener('pointerenter', () => {
      handleArcHover(evt.id);
      showEventTooltip(evt, ringTooltip, dayRing);
    });
    hitTarget.addEventListener('pointerleave', () => {
      handleArcHover(null);
      hideEventTooltip(ringTooltip);
    });
    hitTarget.addEventListener('click', (event) => {
      event.stopPropagation();
      selectEvent(evt.id);
    });
    hitTarget.addEventListener('pointerdown', (e) => {
      showEventTooltip(evt, ringTooltip, dayRing);
      handlePointerStart(e);
    });
    hitTarget.addEventListener('keydown', handleKeyboardNudge);

    dayRing.appendChild(group);
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
      // Draw icon for each event
      group.forEach((evt) => {
        const { x, y } = rotatePoint(evt.startMin, radius, center);
        const meta = eventTypes[evt.type] || eventTypes.custom;

        const wrapper = createSVG('g', {
          transform: `translate(${x}, ${y})`,
          class: 'your-day-marker'
        });

        const hitTarget = createSVG('circle', { cx: 0, cy: 0, r: 16, fill: 'transparent', class: 'event-hit-target' });
        hitTarget.addEventListener('pointerenter', () => showEventTooltip(evt, yourRingTooltip, yourDayRing));
        hitTarget.addEventListener('pointerleave', () => hideEventTooltip(yourRingTooltip));
        hitTarget.addEventListener('click', () => showEventTooltip(evt, yourRingTooltip, yourDayRing));

        const icon = createSVG('text', {
          x: 0,
          y: 0,
          'dominant-baseline': 'central',
          'text-anchor': 'middle',
          'font-size': '1.25rem',
          class: 'your-day-marker-icon'
        });
        icon.textContent = meta.icon;

        wrapper.appendChild(hitTarget);
        wrapper.appendChild(icon);
        yourDayRing.appendChild(wrapper);
      });
    });

    if (wake) {
      const { x, y } = rotatePoint(wake.startMin, radius, center);
      const meta = eventTypes.wake;

      const group = createSVG('g', {
        class: 'your-day-wake-group',
        transform: `translate(${x}, ${y})`,
        style: 'cursor: grab;'
      });

      const hitTarget = createSVG('circle', {
        cx: 0,
        cy: 0,
        r: 16,
        fill: 'transparent',
        class: 'your-day-wake-hit',
        tabindex: 0,
        'aria-label': 'Adjust wake time'
      });

      const icon = createSVG('text', {
        x: 0,
        y: 0,
        'dominant-baseline': 'central',
        'text-anchor': 'middle',
        'font-size': '1.4rem',
        'pointer-events': 'none'
      });
      icon.textContent = meta.icon;

        group.appendChild(hitTarget);
        group.appendChild(icon);

        hitTarget.addEventListener('pointerenter', () => showEventTooltip(wake, yourRingTooltip, yourDayRing));
        hitTarget.addEventListener('pointerleave', () => hideEventTooltip(yourRingTooltip));
        hitTarget.addEventListener('click', () => showEventTooltip(wake, yourRingTooltip, yourDayRing));
        hitTarget.addEventListener('pointerdown', handleYourDayPointerStart);
        hitTarget.addEventListener('keydown', handleYourDayKeyboardNudge);
        yourDayRing.appendChild(group);
      }
  }

  function signedDelta(from, to) {
    const raw = ((to - from) % MINUTES_IN_DAY + MINUTES_IN_DAY) % MINUTES_IN_DAY;
    return raw > MINUTES_IN_DAY / 2 ? raw - MINUTES_IN_DAY : raw;
  }

  function updateEventTiming(evt, newStart) {
    const start = ((newStart % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
    evt.startMin = start;
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

    // Updated: find ID from the group (parent) since target is the hit-circle
    const id = target.closest('.event-dot-group')?.getAttribute('data-event-id') || target.getAttribute('data-event-id');
    const startMinutes = state.events.find((e) => e.id === id)?.startMin ?? 0;
    const pointerMinutes = getMinutesFromPointer(evt);
    const offset = signedDelta(startMinutes, pointerMinutes);

    state.pointerDrag = {
      id,
      lastStart: startMinutes,
      offset: offset
    };
    selectEvent(id);
    document.addEventListener('pointermove', handlePointerMove, { passive: false });
    document.addEventListener('pointerup', handlePointerEnd);
    document.addEventListener('pointercancel', handlePointerEnd);
    document.addEventListener('touchmove', preventDefaultTouch, { passive: false });
  }

  function handlePointerMove(evt) {
    if (!state.pointerDrag) return;
    evt.preventDefault();
    const { id, offset } = state.pointerDrag;
    const event = state.events.find((e) => e.id === id);
    if (!event) return;

    const rawMinutes = getMinutesFromPointer(evt);
    // Remove offset to get "intended" event start
    // pointer = eventStart + offset  => eventStart = pointer - offset
    // Using signed arithmetic with modulo
    // target = (raw - offset)

    // Actually, signedDelta(start, pointer) = offset
    // so pointer - start = offset  => start = pointer - offset.
    // We need standard modulo subtraction.

    // But verify: offset was calculated as signedDelta(start, pointer).
    // so if start=100, pointer=105, offset=5.
    // Now user moves to pointer=110. target should be 105.
    // 110 - 5 = 105. Correct.

    let targetMin = (rawMinutes - (offset || 0) + MINUTES_IN_DAY) % MINUTES_IN_DAY;

    const minutes = snapMinutes(targetMin, getSnapStep(evt));
    const delta = signedDelta(state.pointerDrag.lastStart ?? event.startMin, minutes);

    if (delta !== 0) {
      applyStartChange(event, minutes, delta);
      state.pointerDrag.lastStart = event.startMin;
    }

    // Show feedback
    const feedbackEl = $('dragFeedback');
    if (feedbackEl) {
      feedbackEl.hidden = false;
      feedbackEl.textContent = formatMinutes(minutes);
      positionDragLabel(feedbackEl, evt, dayRing);
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
    document.removeEventListener('touchmove', preventDefaultTouch);

    const feedbackEl = $('dragFeedback');
    if (feedbackEl) feedbackEl.hidden = true;
    hideEventTooltip(ringTooltip);

    render();
  }

  function preventDefaultTouch(evt) {
    evt.preventDefault();
  }

  function handleYourDayPointerStart(evt) {
    evt.preventDefault();
    const target = evt.currentTarget;
    if (target?.setPointerCapture) {
      target.setPointerCapture(evt.pointerId);
    }
    yourDayPointerDrag = { active: true };

    if (document.documentElement) {
      document.documentElement.classList.add('no-scroll');
      document.body?.classList.add('no-scroll');
    }

    // Calculate initial offset: pointer - currentWake
    const pointerMinutes = getMinutesFromPointer(evt, yourDayRing);
    if (typeof pointerMinutes === 'number') {
      const currentWake = getYourDayWakeMinutes();
      yourDayPointerDrag.offset = signedDelta(currentWake, pointerMinutes);
    }

    document.addEventListener('pointermove', handleYourDayPointerMove, { passive: false });
    document.addEventListener('pointerup', handleYourDayPointerEnd);
    document.addEventListener('pointercancel', handleYourDayPointerEnd);
    document.addEventListener('touchmove', preventDefaultTouch, { passive: false });
  }

  function handleYourDayPointerMove(evt) {
    if (!yourDayPointerDrag) return;
    evt.preventDefault();
    const rawMinutes = getMinutesFromPointer(evt, yourDayRing);
    if (typeof rawMinutes !== 'number') return;

    // Apply offset
    const offset = yourDayPointerDrag.offset || 0;
    const minutes = (rawMinutes - offset + MINUTES_IN_DAY) % MINUTES_IN_DAY;

    state.yourDayWakeMinutes = minutes;

    // Show feedback
    const feedbackEl = $('yourDragFeedback');
    if (feedbackEl) {
      feedbackEl.hidden = false;
      feedbackEl.textContent = formatMinutes(minutes);
      positionDragLabel(feedbackEl, evt, yourDayRing);
    }

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
    if (document.documentElement) {
      document.documentElement.classList.remove('no-scroll');
      document.body?.classList.remove('no-scroll');
    }
    yourDayPointerDrag = null;
    document.removeEventListener('pointermove', handleYourDayPointerMove);
    document.removeEventListener('pointerup', handleYourDayPointerEnd);
    document.removeEventListener('pointercancel', handleYourDayPointerEnd);
    document.removeEventListener('touchmove', preventDefaultTouch);

    const feedbackEl = $('yourDragFeedback');
    if (feedbackEl) feedbackEl.hidden = true;
    hideEventTooltip(yourRingTooltip);
  }

  function positionDragLabel(element, evt, ring) {
    const rect = ring?.getBoundingClientRect();
    if (!rect) return;

    // Position near the cursor, but constrained within ring?
    // Actually, just follow cursor with offset
    const overlayRect = element.offsetParent?.getBoundingClientRect() || rect;

    // We want it slightly above the finger/cursor
    const x = evt.clientX;
    const y = evt.clientY - 40;

    element.style.left = `${x - overlayRect.left}px`;
    element.style.top = `${y - overlayRect.top}px`;
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

      const timeInputWrap = document.createElement('div');
      timeInputWrap.className = 'day-item__time-wrap';
      const timeInput = document.createElement('input');
      timeInput.type = 'time';
      timeInput.className = 'day-item__time-input';
      timeInput.value = minutesToTime(evt.startMin);
      timeInput.step = SNAP_DEFAULT * 60;
      timeInput.setAttribute('aria-label', `Edit time for ${evt.title}`);
      timeInput.addEventListener('change', () => {
        const start = toMinutes(timeInput.value);
        const delta = signedDelta(evt.startMin, start);
        applyStartChange(evt, start, delta, { notifyLockShift: evt.type === 'wake' });
        persistState();
        render();
      });
      timeInputWrap.appendChild(timeInput);

      const actions = document.createElement('div');
      actions.className = 'day-item__actions';

      let deleteBtn = null;
      if (evt.type !== 'wake' && evt.type !== 'sleep') {
        deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-ghost';
        deleteBtn.type = 'button';
        deleteBtn.setAttribute('aria-label', 'Delete event');
        deleteBtn.textContent = '✕';
        deleteBtn.addEventListener('click', () => removeEvent(evt.id));
        actions.appendChild(deleteBtn);
      }

      li.appendChild(icon);
      li.appendChild(titleWrap);
      li.appendChild(timeInputWrap);
      li.appendChild(actions);

      li.addEventListener('click', (event) => {
        const target = event.target;
        if (
          target === deleteBtn ||
          target === titleInput ||
          target === timeInput ||
          target.closest?.('input') ||
          target.closest?.('button')
        ) {
          return;
        }
        selectEvent(evt.id);
      });

      dayList.appendChild(li);
    });
  }

  function getSortedProfiles() {
    const presets = ['weekday', 'weekend'];
    const presetProfiles = presets
      .map((id) => state.profiles[id])
      .filter(Boolean);
    const customProfiles = Object.values(state.profiles)
      .filter((p) => !presets.includes(p.id))
      .sort((a, b) => a.name.localeCompare(b.name));
    return [...presetProfiles, ...customProfiles];
  }

  function refreshProfileSelect() {
    if (!profileSelect) return;
    profileSelect.innerHTML = '';
    const profiles = getSortedProfiles();
    profiles.forEach((profile) => {
      const option = document.createElement('option');
      option.value = profile.id;
      option.textContent = profile.name;
      option.dataset.type = profile.type;
      profileSelect.appendChild(option);
    });
    const newOption = document.createElement('option');
    newOption.value = '__new__';
    newOption.textContent = 'Create new profile…';
    profileSelect.appendChild(newOption);
    profileSelect.value = state.activeProfileId;
    if (profileSelect.value !== state.activeProfileId && profiles.length) {
      profileSelect.value = profiles[0].id;
    }
  }

  function saveActiveProfile(nameOverride) {
    const current = state.profiles[state.activeProfileId] || createProfile(state.activeProfileId, 'Custom', [], 'custom');
    const name = (nameOverride || current.name || 'Custom').trim();
    if (!name) return;
    const id = current.id || slugifyName(name);
    const updated = createProfile(id, name, state.events, current.type || 'custom', state.standardWakeMinutes);
    state.profiles[id] = updated;
    state.activeProfileId = id;
    persistProfiles();
    persistState();
    refreshProfileSelect();
    showToast(`Saved ${name} profile`, 'success');
  }

  function handleCreateProfile() {
    const name = prompt('Name this profile');
    if (!name) {
      refreshProfileSelect();
      return;
    }
    const idBase = slugifyName(name);
    let uniqueId = idBase;
    let suffix = 2;
    while (state.profiles[uniqueId]) {
      uniqueId = `${idBase}-${suffix}`;
      suffix += 1;
    }
    state.profiles[uniqueId] = createProfile(uniqueId, name, state.events, 'custom', state.standardWakeMinutes);
    state.activeProfileId = uniqueId;
    persistProfiles();
    persistState();
    refreshProfileSelect();
    showToast(`Created ${name}`, 'success');
  }

  function resetPresetProfiles() {
    const defaults = getDefaultProfiles();
    state.profiles.weekday = defaults.weekday;
    state.profiles.weekend = defaults.weekend;
    persistProfiles();
    if (['weekday', 'weekend'].includes(state.activeProfileId)) {
      applyProfile(state.activeProfileId, { skipRender: false });
    } else {
      refreshProfileSelect();
      showToast('Weekday and Weekend reset to defaults', 'info');
    }
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
    const event = createEvent(template.type, template.title, eventStart);
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
    const duration = 60;
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
    const point = rotatePoint(evt.startMin, 150, 200);
    const normX = (point.x / 400) * rect.width;
    const normY = (point.y / 400) * rect.height;
    const posX = rect.left + normX;
    const posY = rect.top + normY;
    element.style.left = `${posX - overlayRect.left}px`;
    element.style.top = `${posY - overlayRect.top - 12}px`;
  }

  function showEventTooltip(evt, tooltipEl, ringEl) {
    if (!tooltipEl || !ringEl) return;
    tooltipEl.hidden = false;
    tooltipEl.textContent = evt.title;
    positionLabelForEvent(evt, tooltipEl, ringEl);
  }

  function hideEventTooltip(tooltipEl) {
    if (tooltipEl) tooltipEl.hidden = true;
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
    const { allowLocal = true, value = 'local', onChange = () => { }, labels = {}, labelClass = '' } = options;
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

      // 3. Center: Feels Like
      const feelsWrapper = document.createElement('div');
      feelsWrapper.className = 'day-item__feels-center';
      const feelsStart = typeof evt.baseStart === 'number' ? evt.baseStart : evt.startMin;
      feelsWrapper.innerHTML = `<span class="feels-like-text">Feels like</span> <span class="feels-like-time">${minutesToLabel(feelsStart)}</span>${wakeHint}`;

      // 4. Right: Real Time
      const realWrapper = document.createElement('div');
      realWrapper.className = 'day-item__real-right';
      realWrapper.textContent = minutesToLabel(evt.startMin);

      li.appendChild(icon);
      li.appendChild(titleWrap);
      li.appendChild(feelsWrapper);
      li.appendChild(realWrapper);

      realDayList.appendChild(li);
    });
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
      if (template.type === 'wake' || template.type === 'sleep') return;
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
    return typeof duration === 'number' ? duration : (9 * 60);
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

  const SHORT_TYPE_MAP = ['sleep', 'wake', 'meal', 'exercise', 'work', 'light', 'custom'];

  function minifySnapshot(snapshot) {
    const p = snapshot.planner || snapshot;
    let flags = 0;
    if (p.startSlow) flags |= 1;
    if (p.endSlow) flags |= 2;
    // p.lockToWake is meant to be here if we decide to sync it, but currently not synced.
    // We reserve bit 4 (value 4) for lockToWake in future
    if (p.timeFormat === '12h') flags |= 8;

    const mode = p.plannerMode === 'sleep' ? 1 : 0;
    const dirMap = { auto: 0, earlier: 1, later: 2 };
    const direction = dirMap[p.plannerDirection] || 0;
    const targetTimeMin = toMinutes(p.targetTime);

    // Header: [v=2, flags, mode, direction, targetTimeMin, targetDate, dailyStep, plannerTZ, displayTZ]
    const header = [
      2,
      flags,
      mode,
      direction,
      targetTimeMin,
      p.targetDate,
      p.dailyStep,
      p.timeZone || 'local',
      p.displayTimeZone || 'local'
    ];

    let events = [];
    if (Array.isArray(snapshot.events)) {
      events = snapshot.events.map((evt) => {
        // [typeIndex, startMin, title]
        let typeIdx = SHORT_TYPE_MAP.indexOf(evt.type);
        if (typeIdx === -1) typeIdx = 6; // custom

        const defaultLabel = eventTypes[evt.type]?.label;
        const isDefault = !evt.title || evt.title === defaultLabel;

        // Use 0 for default title to save space (0 is falsy, unminify converts to undefined)
        return [typeIdx, evt.startMin, isDefault ? 0 : evt.title];
      });
    }

    return [header, events];
  }

  function unminifySnapshot(minified) {
    if (!Array.isArray(minified) || minified.length < 2) return null;
    const [header, minEvents] = minified;
    const [version, flags, mode, direction, targetTimeMin, targetDate, dailyStep, plannerTZ, displayTZ] = header;

    if (version !== 2) return null;

    const planner = {
      startSlow: !!(flags & 1),
      endSlow: !!(flags & 2),
      timeFormat: flags & 8 ? '12h' : '24h',
      plannerMode: mode === 1 ? 'sleep' : 'wake',
      plannerDirection: ['auto', 'earlier', 'later'][direction] || 'auto',
      targetTime: minutesToTime(targetTimeMin),
      targetDate: targetDate,
      dailyStep: dailyStep,
      timeZone: plannerTZ,
      displayTimeZone: displayTZ
    };

    const events = [];
    if (Array.isArray(minEvents)) {
      minEvents.forEach((m) => {
        const [typeIdx, startMin, title] = m;
        const type = SHORT_TYPE_MAP[typeIdx] || 'custom';
        events.push({
          type,
          startMin,
          title: title || undefined
        });
      });
    }

    return { planner, events };
  }

  function encodeSharePayload(includeEvents) {
    try {
      const snapshot = buildPlannerSnapshot(includeEvents);
      const minified = minifySnapshot(snapshot);
      const json = JSON.stringify(minified);
      return btoa(encodeURIComponent(json));
    } catch (err) {
      console.warn('Failed to encode share payload', err);
      return '';
    }
  }

  function decodeSharePayload(payload) {
    if (!payload) return null;
    try {
      const json = decodeURIComponent(atob(payload));
      const parsed = JSON.parse(json);
      // We only support the new array format (v2)
      if (Array.isArray(parsed) && Array.isArray(parsed[0]) && parsed[0][0] === 2) {
        return unminifySnapshot(parsed);
      }
      return null;
    } catch (err) {
      console.warn('Failed to decode shared planner', err);
      return null;
    }
  }

  function extractShareCode(input) {
    const trimmed = (input || '').trim();
    if (!trimmed) return null;
    try {
      const maybeUrl = new URL(trimmed);
      return maybeUrl.searchParams.get(SHARE_PARAM) || trimmed;
    } catch (err) {
      return trimmed;
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

  function generateShareLink(includeEvents) {
    const code = encodeSharePayload(includeEvents);
    if (!code) return { code: '', url: '' };
    const url = new URL(window.location.href);
    url.searchParams.set(SHARE_PARAM, code);
    return { code, url: url.toString() };
  }

  function formatShareCodePreview(code) {
    if (!code) return '';
    if (code.length <= 120) return code;
    return `${code.slice(0, 60)}…${code.slice(-16)}`;
  }

  function updateShareDialog() {
    if (!shareLayer) return;
    state.shareIncludeEvents = Boolean(shareIncludeEventsToggle?.checked);
    const { code, url } = generateShareLink(state.shareIncludeEvents);
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

  function handleLoadPlanner() {
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
    const snapshot = decodeSharePayload(code);
    if (!snapshot) {
      showToast('Unable to load planner', 'error');
      return;
    }
    applySharedPlanner(snapshot);
    showToast('Shared planner loaded', 'success');
  }

  function loadSharedPlannerFromURL() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get(SHARE_PARAM);
    if (!code) return;
    const snapshot = decodeSharePayload(code);
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
    dayRing.addEventListener('pointerleave', () => hideEventTooltip(ringTooltip));
    yourDayRing?.addEventListener('pointerleave', () => hideEventTooltip(yourRingTooltip));
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
    state.activeTab = ['standard', 'planner'].includes(tab) ? tab : 'your';
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
    if (plannerTabPanel) plannerTabPanel.hidden = state.activeTab !== 'planner';
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
    const defaults = getDefaultProfiles();
    const targetProfile =
      ['weekday', 'weekend'].includes(state.activeProfileId) && defaults[state.activeProfileId]
        ? defaults[state.activeProfileId]
        : defaults.weekday;
    state.events = targetProfile.events.map((evt) => ({ ...evt }));
    state.standardWakeMinutes = targetProfile.standardWakeMinutes;
    state.yourDayWakeMinutes = state.standardWakeMinutes;
    state.selectedId = null;
    state.openEditorId = null;
    refreshProfileSelect();
    persistState();
    render();
    showToast('Standard Day reset to defaults', 'success');
  }

  function initStandardDayControls() {
    if (resetStandardDayBtn) {
      resetStandardDayBtn.addEventListener('click', resetStandardDay);
    }

    if (profileSelect) {
      refreshProfileSelect();
      profileSelect.addEventListener('change', (evt) => {
        if (evt.target.value === '__new__') {
          handleCreateProfile();
          return;
        }
        state.autoProfileSelection = false;
        applyProfile(evt.target.value);
      });
    }

    if (saveProfileBtn) {
      saveProfileBtn.addEventListener('click', () => saveActiveProfile());
    }

    if (resetPresetsBtn) {
      resetPresetsBtn.addEventListener('click', () => resetPresetProfiles());
    }
  }

  function init() {
    // Settings Menu
    const settingsBtn = $('settingsBtn');
    const settingsMenu = $('settingsMenu');
    if (settingsBtn && settingsMenu) {
      let closedByOutsideClick = false;

      settingsBtn.addEventListener('click', (e) => {
        if (closedByOutsideClick) {
          closedByOutsideClick = false;
          return;
        }

        const isHidden = settingsMenu.hidden;
        settingsMenu.hidden = !isHidden;
        settingsBtn.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
      });

      // Close menu when clicking/tapping outside
      const closeSettingsOnOutsideClick = (e) => {
        // Don't interfere if we're currently dragging
        if (state.pointerDrag || yourDayPointerDrag) return;

        if (!settingsMenu.hidden &&
          !settingsMenu.contains(e.target) &&
          !settingsBtn.contains(e.target)) {
          settingsMenu.hidden = true;
          settingsBtn.setAttribute('aria-expanded', 'false');
          closedByOutsideClick = true;
          setTimeout(() => { closedByOutsideClick = false; }, 200);
        }
      };

      document.addEventListener('pointerdown', closeSettingsOnOutsideClick);
      document.addEventListener('touchstart', closeSettingsOnOutsideClick, { passive: true });
    }

    loadState();
    loadSharedPlannerFromURL();
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
