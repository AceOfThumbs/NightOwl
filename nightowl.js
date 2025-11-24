/* nightowl.js */
(function(){
  const MINUTES_IN_DAY = 1440;
  const STORAGE_KEY = 'nightowl.plan.v1';
  const TRANSFER_KEY = 'nightowl.plan.transfer';
  const OVERRIDE_KEY = 'nightowl.override.now';
  const PREFS_KEY = 'nightowl.prefs.v1';
  const SCHEDULES_KEY = 'nightowl.day.v1';
  const DEFAULT_SCHEDULE_ID = 'default';
  const MIN_TEXT_SCALE = 0.85;
  const MAX_TEXT_SCALE = 1.35;
  const TEXT_SCALE_STEP = 0.1;
  const noop=()=>{};

  let overrideNowDate=null;
  const pad=(n)=>String(n).padStart(2,'0');
  const getNow=()=>overrideNowDate?new Date(overrideNowDate.getTime()):new Date();
  const formatDatetimeLocal=(date)=>{
    const d=new Date(date.getTime());
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  function parseDatetimeLocal(value){
    if(!value) return null;
    const [datePart,timePart=''] = value.split('T');
    const [y,m,d]=datePart.split('-').map(Number);
    const [hh='0',mm='0']=timePart.split(':');
    const h=Number(hh),min=Number(mm);
    if([y,m,d,h,min].some(n=>Number.isNaN(n))) return null;
    if(m<1||m>12||d<1||d>31||h<0||h>23||min<0||min>59) return null;
    return new Date(y,m-1,d,h,min);
  }

  // ---------- helpers ----------
  const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
  const escapeHtml=(str)=>String(str??'').replace(/[&<>"']/g,c=>({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  })[c]);
  const todayAsYYYYMMDD=()=>{const d=getNow();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;};
  const toMinutes=(t)=>{const [h,m]=String(t).split(':').map(Number);return (((h||0)*60+(m||0))%MINUTES_IN_DAY+MINUTES_IN_DAY)%MINUTES_IN_DAY};
  const minutesToTimeString=(mins)=>{const m=((mins%MINUTES_IN_DAY)+MINUTES_IN_DAY)%MINUTES_IN_DAY;return `${pad(Math.floor(m/60))}:${pad(m%60)}`};
  const format12h=(mins)=>{const m=((mins%MINUTES_IN_DAY)+MINUTES_IN_DAY)%MINUTES_IN_DAY;let h=Math.floor(m/60);const mm=pad(m%60);const ap=h>=12?'PM':'AM';h%=12;if(h===0)h=12;return `${h}:${mm} ${ap}`};
  const formatCompactDate=(d)=>d.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});
  const modDay=(n)=>((n%MINUTES_IN_DAY)+MINUTES_IN_DAY)%MINUTES_IN_DAY;

  const FORMATTER_BASE_OPTIONS=Object.freeze({hour12:false,hour:'2-digit',minute:'2-digit'});
  const formatterCache=new Map();
  function getFormatterForTZ(tz){
    const key=tz||'local';
    if(!formatterCache.has(key)){
      const options=key==='local'?{...FORMATTER_BASE_OPTIONS}:{...FORMATTER_BASE_OPTIONS,timeZone:key};
      formatterCache.set(key,new Intl.DateTimeFormat('en-GB',options));
    }
    return formatterCache.get(key);
  }
  function wallMinutesAt(date,tz){
    const formatter=getFormatterForTZ(tz);
    const parts=formatter.formatToParts(date);
    const h=Number(parts.find(p=>p.type==='hour')?.value||'0');
    const m=Number(parts.find(p=>p.type==='minute')?.value||'0');
    return modDay(h*60+m);
  }
  function convertMinutesBetweenTZ(fromTZ,toTZ,ymd,minutes){
    const base=new Date(ymd+'T00:00:00Z');
    let ts=base;let cur=wallMinutesAt(ts,fromTZ);let d=((minutes-cur+MINUTES_IN_DAY)%MINUTES_IN_DAY);if(d>720)d-=MINUTES_IN_DAY;ts=new Date(ts.getTime()+d*60000);
    cur=wallMinutesAt(ts,fromTZ);d=((minutes-cur+MINUTES_IN_DAY)%MINUTES_IN_DAY);if(d>720)d-=MINUTES_IN_DAY;ts=new Date(ts.getTime()+d*60000);
    return wallMinutesAt(ts,toTZ);
  }
  function computeDayEvents(wakeMin,sleepDurationMin){
    return {wake:modDay(wakeMin),lunch:modDay(wakeMin+5*60),dinner:modDay(wakeMin+11*60),sleep:modDay(wakeMin-sleepDurationMin)};
  }
  function computePlanSchedule({wakeM,sleepM,plannerMode,targetTimeM,dailyStep,direction,nDays,fromDate}){
    const startTime=plannerMode==='wake'?wakeM:sleepM;
    const target=modDay(targetTimeM);
    let delta=((target-startTime)%MINUTES_IN_DAY+MINUTES_IN_DAY)%MINUTES_IN_DAY;if(delta>720)delta-=MINUTES_IN_DAY;
    if(direction==='earlier'&&delta>0)delta-=MINUTES_IN_DAY; if(direction==='later'&&delta<0)delta+=MINUTES_IN_DAY;
    const step=Math.min(240,Math.max(5,dailyStep));
    const days=Math.max(1,Math.floor(nDays));
    const perDay=Math.max(-step,Math.min(step,Math.round(delta/days)));
    const rows=[]; let t=startTime;
    for(let i=1;i<=days;i++){
      const d=new Date(fromDate.getFullYear(),fromDate.getMonth(),fromDate.getDate()+i);
      t=modDay(t+perDay); rows.push({day:i,date:d.toDateString(),time:t});
    }
    if(rows.length>0) rows[rows.length-1].time=target;
    return rows;
  }

  // ---------- state ----------
  const state={
    wake:'10:00',
    wakeDuration:15*60,
    show12h:true,
    timeZone:'local',
    plannerMode:'wake',
    targetTime:'07:00',
    targetDate:todayAsYYYYMMDD(),
    dailyStep:30,
    direction:'auto',
    startDate:todayAsYYYYMMDD(),
    textScale:1,
    theme:'dark',
    day:{
      scheduleId:DEFAULT_SCHEDULE_ID,
      dirty:false,
      items:[],
    },
    savedSchedules:{},
  };

  // ---------- DOM ----------
  const $=id=>document.getElementById(id);
  const wakeInput=$('wakeInput');
  const wakeDuration=$('wakeDuration');
  const sleepFrom=$('sleepFrom');
  const sleepTo=$('sleepTo');
  const sleepHours=$('sleepHours');
  const sleepHours2=$('sleepHours2');
  const feelsLike=$('feelsLike');
  const toggleFormat=$('toggleFormat');
  const targetDate=$('targetDate');
  const plannerMode=$('plannerMode');
  const plannerModeLabel=$('plannerModeLabel');
  const timeZone=$('timeZone');
  const targetTime=$('targetTime');
  const dailyStep=$('dailyStep');
  const dailyStepLabel=$('dailyStepLabel');
  const planBody=$('planBody');
  const dirButtons=Array.from(document.querySelectorAll('[data-dir]'));
  const yourDayList=$('yourDayList');
  const addDayItem=$('addDayItem');
  const yourDayName=$('yourDayName');
  const yourDaySelect=$('yourDaySelect');
  const yourDayRemove=$('yourDayRemove');
  const yourDaySave=$('yourDaySave');
  const yourDayReset=$('yourDayReset');
  const textScaleDown=$('textScaleDown');
  const textScaleUp=$('textScaleUp');
  const themeButtons=Array.from(document.querySelectorAll('[data-theme-choice]'));
  const analogClock=$('analogClock');
  const clockDate=$('clockDate');
  const saveBtn=$('saveBtn');
  const loadBtn=$('loadBtn');
  const shareBtn=$('shareBtn');
  const toastContainer=$('toastContainer');
  const shareLayer=$('shareLayer');
  const shareLinkInput=$('shareLinkInput');
  const shareCodeEl=$('shareCode');
  const shareCopyLink=$('shareCopyLink');
  const shareCopyCode=$('shareCopyCode');
  const overrideInput=$('overrideInput');
  const applyOverride=$('applyOverride');
  const clearOverride=$('clearOverride');
  const overrideStatus=$('overrideStatus');
  function updateOverrideUI(customMessage){
    if(overrideStatus){
      if(customMessage){
        overrideStatus.textContent=customMessage;
      } else if(overrideNowDate){
        overrideStatus.textContent=`Overriding current time: ${overrideNowDate.toLocaleString()}`;
      } else {
        overrideStatus.textContent='Using real current time.';
      }
    }
    if(overrideInput&&document.activeElement!==overrideInput){
      overrideInput.value=overrideNowDate?formatDatetimeLocal(overrideNowDate):'';
    }
  }

  function applyTextScale(){
    if(typeof document==='undefined'||!document.documentElement) return;
    document.documentElement.style.setProperty('--font-scale',String(state.textScale||1));
    updateDisplayControls();
  }
  function applyTheme(theme){
    if(typeof document==='undefined'||!document.documentElement) return;
    const next=theme==='light'?'light':'dark';
    document.documentElement.setAttribute('data-theme',next);
    state.theme=next;
    updateThemeButtons();
  }
  function updateDisplayControls(){
    if(textScaleDown) textScaleDown.disabled=(state.textScale||1)<=MIN_TEXT_SCALE+0.001;
    if(textScaleUp) textScaleUp.disabled=(state.textScale||1)>=MAX_TEXT_SCALE-0.001;
  }
  function updateThemeButtons(){
    themeButtons.forEach(btn=>{
      const value=btn.getAttribute('data-theme-choice');
      const active=value===state.theme;
      btn.setAttribute('aria-pressed',active?'true':'false');
      if(active) btn.classList.add('btn--active'); else btn.classList.remove('btn--active');
    });
  }

  function showToast(message,variant='info',duration=3400){
    if(!toastContainer){
      if(typeof window!=='undefined'&&typeof window.alert==='function'){
        window.alert(message);
      }
      return;
    }
    const toast=document.createElement('div');
    const variantClass=`toast--${variant||'info'}`;
    toast.classList.add('toast',variantClass);
    toast.textContent=message;
    toastContainer.appendChild(toast);
    requestAnimationFrame(()=>{
      requestAnimationFrame(()=>toast.classList.add('toast--visible'));
    });
    const remove=()=>{
      toast.classList.remove('toast--visible');
      setTimeout(()=>toast.remove(),250);
    };
    const timeout=setTimeout(remove,duration);
    toast.addEventListener('click',()=>{
      clearTimeout(timeout);
      remove();
    });
  }

  async function copyTextToClipboard(text){
    if(!text) return false;
    try{
      if(typeof navigator!=='undefined'&&navigator.clipboard?.writeText){
        await navigator.clipboard.writeText(text);
        return true;
      }
    }catch(err){/* ignore */}
    if(typeof document==='undefined'||!document.body) return false;
    try{
      const textarea=document.createElement('textarea');
      textarea.value=text;
      textarea.setAttribute('readonly','');
      textarea.style.position='fixed';
      textarea.style.opacity='0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const result=document.execCommand('copy');
      document.body.removeChild(textarea);
      return result;
    }catch(err){
      return false;
    }
  }

  function savePreferences(){
    try{
      const payload={version:1,textScale:state.textScale,theme:state.theme};
      localStorage.setItem(PREFS_KEY,JSON.stringify(payload));
    }catch(err){/* ignore */}
  }
  function loadPreferences(){
    try{
      const raw=localStorage.getItem(PREFS_KEY); if(!raw) return;
      const data=JSON.parse(raw);
      if(data?.version!==1) return;
      if(typeof data.textScale==='number') state.textScale=clamp(data.textScale,MIN_TEXT_SCALE,MAX_TEXT_SCALE);
      if(data.theme==='dark'||data.theme==='light') state.theme=data.theme;
    }catch(err){console.warn('prefs load failed',err);}
  }
  function persistSchedules(){
    try{
      const payload={
        version:1,
        schedules:Object.values(state.savedSchedules).map(item=>({
          id:item.id,
          name:item.name,
          items:cloneDayItems(item.items),
        })),
      };
      localStorage.setItem(SCHEDULES_KEY,JSON.stringify(payload));
    }catch(err){console.warn('schedule save failed',err);}
  }
  function loadSchedules(){
    try{
      const raw=localStorage.getItem(SCHEDULES_KEY); if(!raw) return;
      const data=JSON.parse(raw);
      if(data?.version!==1||!Array.isArray(data.schedules)) return;
      const next={};
      data.schedules.forEach(item=>{
        if(!item) return;
        const id=item.id||slugifyScheduleName(item.name);
        if(!id) return;
        next[id]={
          id,
          name:item.name||'Schedule',
          items:cloneDayItems(item.items),
        };
      });
      state.savedSchedules=next;
    }catch(err){console.warn('schedule load failed',err);}
  }
  function slugifyScheduleName(name){
    if(!name) return '';
    const base=String(name).toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
    if(base) return base;
    return `schedule-${Date.now()}`;
  }
  function cloneDayItems(items){
    if(!Array.isArray(items)) return [];
    return items.map(item=>({
      time:normalizeTimeString(item?.time||'00:00','00:00'),
      label:String(item?.label??'').trim(),
    }));
  }
  function sortDayItemsInPlace(items){
    if(!Array.isArray(items)) return;
    items.sort((a,b)=>toMinutes(a?.time||'00:00')-toMinutes(b?.time||'00:00'));
  }
  function getDefaultDayItems(wakeM,sleepDuration){
    const events=computeDayEvents(wakeM,sleepDuration);
    return [
      {time:minutesToTimeString(events.wake),label:'Wake'},
      {time:minutesToTimeString(events.lunch),label:'Lunch'},
      {time:minutesToTimeString(events.dinner),label:'Dinner'},
      {time:minutesToTimeString(events.sleep),label:'Sleep'},
    ];
  }
  function ensureDefaultDaySnapshot(){
    if(state.day.scheduleId===DEFAULT_SCHEDULE_ID&&!state.day.dirty){
      const wakeM=toMinutes(state.wake);
      const sleepDuration=MINUTES_IN_DAY-state.wakeDuration;
      state.day.items=cloneDayItems(getDefaultDayItems(wakeM,sleepDuration));
    }
  }
  function updateScheduleSelect(){
    if(!yourDaySelect) return;
    const currentValue=state.day.scheduleId;
    const options=[{value:DEFAULT_SCHEDULE_ID,label:'Default'}];
    const entries=Object.values(state.savedSchedules||{}).sort((a,b)=>a.name.localeCompare(b.name));
    entries.forEach(item=>options.push({value:item.id,label:item.name||'Schedule'}));
    yourDaySelect.innerHTML='';
    options.forEach(opt=>{
      const option=document.createElement('option');
      option.value=opt.value;
      option.textContent=opt.label;
      yourDaySelect.appendChild(option);
    });
    if(options.some(opt=>opt.value===currentValue)){
      yourDaySelect.value=currentValue;
    }else{
      yourDaySelect.value=DEFAULT_SCHEDULE_ID;
    }
  }
  function renderYourDaySection(wakeM,sleepDuration){
    if(!yourDayList) return;
    if(state.day.scheduleId===DEFAULT_SCHEDULE_ID&&!state.day.dirty){
      state.day.items=cloneDayItems(getDefaultDayItems(wakeM,sleepDuration));
    }
    yourDayList.innerHTML='';
    if(!Array.isArray(state.day.items)||state.day.items.length===0){
      const empty=document.createElement('div');
      empty.className='yourday-empty';
      empty.textContent='No items yet. Add your first entry.';
      yourDayList.appendChild(empty);
    }else{
      sortDayItemsInPlace(state.day.items);
      state.day.items.forEach((item,index)=>{
        const row=document.createElement('div');
        row.className='yourday-row';
        row.dataset.index=String(index);
        const labelText=(item.label||'').trim();
        const fallback=`item ${index+1}`;
        const ariaLabel=escapeHtml(labelText||fallback);
        const timeValue=escapeHtml(item.time||'00:00');
        row.innerHTML=
          `<input type="time" value="${timeValue}" data-field="time" aria-label="Time for ${ariaLabel}">`+
          `<input type="text" value="${escapeHtml(labelText)}" placeholder="Label" data-field="label" aria-label="Label for ${ariaLabel}">`+
          `<button type="button" class="yourday-remove" data-remove aria-label="Remove ${ariaLabel}">×</button>`;
        yourDayList.appendChild(row);
      });
    }
    updateScheduleSelect();
    if(yourDayRemove){
      yourDayRemove.disabled=state.day.scheduleId===DEFAULT_SCHEDULE_ID;
    }
    if(yourDayName&&document.activeElement!==yourDayName){
      if(state.day.scheduleId===DEFAULT_SCHEDULE_ID){
        yourDayName.value='';
      }else{
        yourDayName.value=state.savedSchedules?.[state.day.scheduleId]?.name||'';
      }
    }
  }
  function loadScheduleById(id){
    if(id===DEFAULT_SCHEDULE_ID){
      state.day.scheduleId=DEFAULT_SCHEDULE_ID;
      state.day.dirty=false;
      const wakeM=toMinutes(state.wake);
      const sleepDuration=MINUTES_IN_DAY-state.wakeDuration;
      state.day.items=cloneDayItems(getDefaultDayItems(wakeM,sleepDuration));
      return true;
    }
    const schedule=state.savedSchedules?.[id];
    if(!schedule) return false;
    state.day.scheduleId=id;
    state.day.dirty=true;
    state.day.items=cloneDayItems(schedule.items);
    return true;
  }

  let lastFocusedBeforeShare=null;
  function isShareOpen(){
    return !!(shareLayer&&!shareLayer.hasAttribute('hidden'));
  }
  function openShareDialog(link,code){
    if(!shareLayer) return;
    lastFocusedBeforeShare=document.activeElement instanceof HTMLElement?document.activeElement:null;
    shareLayer.hidden=false;
    if(shareLinkInput){
      shareLinkInput.value=link||'';
      try{shareLinkInput.focus({preventScroll:true});}
      catch(e){shareLinkInput.focus();}
      shareLinkInput.select();
    }
    if(shareCodeEl){
      shareCodeEl.textContent=code||'';
    }
  }
  function closeShareDialog(){
    if(!shareLayer) return;
    shareLayer.hidden=true;
    if(lastFocusedBeforeShare&&typeof lastFocusedBeforeShare.focus==='function'){
      lastFocusedBeforeShare.focus();
    }
  }
  function applyOverrideValue(value){
    if(!value){
      overrideNowDate=null;
      try{localStorage.removeItem(OVERRIDE_KEY);}catch{}
      updateOverrideUI();
      render();
      return true;
    }
    const parsed=parseDatetimeLocal(value);
    if(!parsed||Number.isNaN(parsed.getTime())){
      updateOverrideUI('Invalid date/time. Please choose a valid value.');
      return false;
    }
    overrideNowDate=parsed;
    try{localStorage.setItem(OVERRIDE_KEY,parsed.toISOString());}catch{}
    updateOverrideUI();
    render();
    return true;
  }

  function updateDirectionButtons(){
    if(dirButtons.length===0) return;
    dirButtons.forEach(btn=>{
      const value=btn.getAttribute('data-dir');
      const isActive=value===state.direction;
      btn.classList.toggle('btn--active',isActive);
      btn.setAttribute('aria-pressed',String(isActive));
    });
  }

  let wakeReminderMessage=null;
  function queueWakeReminder(wakeValue){
    const wake24=minutesToTimeString(toMinutes(wakeValue));
    const wake12=format12h(toMinutes(wake24));
    wakeReminderMessage=`Today's planned wake time (${wake12} / ${wake24}) has been copied into the Wake field. Please update it if your actual wake time for today is different.`;
  }
  function maybeShowWakeReminder(){
    if(!wakeReminderMessage) return;
    if(typeof window!=='undefined'&&typeof window.alert==='function'){
      window.alert(wakeReminderMessage);
    } else {
      console.info(wakeReminderMessage);
    }
    wakeReminderMessage=null;
  }

  // ---------- persistence ----------
  const buildSaveObject=(startDate)=>({
    version:1,
    savedAt:getNow().toISOString(),
    planner:{
      plannerMode:state.plannerMode,
      direction:state.direction,
      dailyStep:state.dailyStep,
      target:{time:state.targetTime,zone:state.timeZone},
      targetDate:state.targetDate
    },
    model:{wake:state.wake,wakeDuration:state.wakeDuration},
    calendar:{startDate,lastAdvancedDate:todayAsYYYYMMDD()}
  });
  const SHARE_PREFIX='NO1';
  function normalizeTimeString(value,defaultValue){
    return minutesToTimeString(toMinutes(value||defaultValue));
  }
  function encodePlanToShareText(data){
    const entries=[
      ['mode',data.planner?.plannerMode||'wake'],
      ['dir',data.planner?.direction||'auto'],
      ['step',clamp(Number(data.planner?.dailyStep??30),5,240)],
      ['tz',data.planner?.target?.zone||'local'],
      ['target',normalizeTimeString(data.planner?.target?.time||'07:00','07:00')],
      ['date',data.planner?.targetDate||todayAsYYYYMMDD()],
      ['wake',normalizeTimeString(data.model?.wake||'10:00','10:00')],
      ['dur',clamp(Number(data.model?.wakeDuration??(15*60)),720,1200)],
      ['start',data.calendar?.startDate||todayAsYYYYMMDD()]
    ];
    return `${SHARE_PREFIX};`+entries.map(([k,v])=>`${k}=${v}`).join(';');
  }
  function decodeSharedPlan(text){
    if(!text||!text.trim()) return {ok:false,message:'Please paste a shared plan code.'};
    const normalized=text.trim().replace(/\r?\n/g,';');
    const parts=normalized.split(';').map(p=>p.trim()).filter(Boolean);
    if(parts.length===0) return {ok:false,message:'Shared code is empty.'};
    if(parts[0]!==SHARE_PREFIX) return {ok:false,message:'Unrecognized shared code. It should start with "NO1".'};
    const map={};
    for(let i=1;i<parts.length;i++){
      const part=parts[i];
      const eq=part.indexOf('=');
      if(eq===-1) continue;
      const key=part.slice(0,eq).trim();
      const value=part.slice(eq+1).trim();
      if(key) map[key]=value;
    }
    const dailyStep=clamp(Number.parseInt(map.step,10)||30,5,240);
    const wakeDuration=clamp(Number.parseInt(map.dur,10)||state.wakeDuration||15*60,720,1200);
    const plannerMode=map.mode==='sleep'?'sleep':'wake';
    const direction=map.dir||'auto';
    const targetZone=map.tz||'local';
    const targetTime=normalizeTimeString(map.target||'07:00','07:00');
    const targetDate=map.date||todayAsYYYYMMDD();
    const wake=normalizeTimeString(map.wake||state.wake||'10:00','10:00');
    const startDate=map.start||todayAsYYYYMMDD();
    return {
      ok:true,
      data:{
        version:1,
        planner:{
          plannerMode,
          direction,
          dailyStep,
          target:{time:targetTime,zone:targetZone},
          targetDate
        },
        model:{wake,wakeDuration},
        calendar:{startDate}
      }
    };
  }
  function save(){
    const payload=buildSaveObject(state.startDate);
    let ok=true;
    let error=null;
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(payload));}
    catch(err){ok=false; error=err?.message||'storage error';}
    try{localStorage.setItem(TRANSFER_KEY,JSON.stringify(payload));}
    catch(err){ok=false; if(!error) error=err?.message||'storage error';}
    return {ok,error};
  }
  function applyImportedPlan(data){
    if(data?.version!==1) return {ok:false,message:'Invalid plan data: missing version 1.'};
    state.plannerMode=data.planner?.plannerMode||'wake';
    state.direction=data.planner?.direction||'auto';
    state.dailyStep=data.planner?.dailyStep??30;
    state.timeZone=data.planner?.target?.zone||'local';
    state.targetTime=data.planner?.target?.time||'07:00';
    state.targetDate=data.planner?.targetDate||todayAsYYYYMMDD();
    state.wakeDuration=data.model?.wakeDuration??(15*60);
    state.wake=minutesToTimeString(toMinutes(data.model?.wake||state.wake));
    const startCandidate=data.calendar?.startDate;
    const parsedStart=startCandidate?new Date(startCandidate):null;
    state.startDate=parsedStart&& !Number.isNaN(parsedStart.getTime())?startCandidate:todayAsYYYYMMDD();
    const today=todayAsYYYYMMDD();
    if(new Date(state.startDate)<new Date(today)){
      const planForToday={
        planner:{
          plannerMode:state.plannerMode,
          direction:state.direction,
          dailyStep:state.dailyStep,
          target:{time:state.targetTime,zone:state.timeZone},
          targetDate:state.targetDate
        },
        model:{wake:state.wake,wakeDuration:state.wakeDuration},
        calendar:{startDate:state.startDate}
      };
      const result=rollForwardToToday(planForToday);
      if(result?.changedWake){
        queueWakeReminder(result.plannedWake);
      }
    }
    return {ok:true};
  }
  function load(){
    try{
      const raw=localStorage.getItem(STORAGE_KEY); if(!raw) return;
      const data=JSON.parse(raw); if(data?.version!==1) return;
      state.plannerMode=data.planner?.plannerMode||'wake';
      state.direction=data.planner?.direction||'auto';
      state.dailyStep=data.planner?.dailyStep??30;
      state.timeZone=data.planner?.target?.zone||'local';
      state.targetTime=data.planner?.target?.time||'07:00';
      state.targetDate=data.planner?.targetDate||todayAsYYYYMMDD();
      state.wakeDuration=data.model?.wakeDuration??(15*60);
      state.wake=minutesToTimeString(toMinutes(data.model?.wake||'10:00'));
      state.startDate=data.calendar?.startDate||todayAsYYYYMMDD();
      // Optional roll only if stored startDate is in the past
      const today=todayAsYYYYMMDD();
      if (new Date(state.startDate) < new Date(today)) {
        const result=rollForwardToToday({
          planner:{plannerMode:state.plannerMode,direction:state.direction,dailyStep:state.dailyStep,target:{time:state.targetTime,zone:state.timeZone},targetDate:state.targetDate},
          model:{wake:state.wake,wakeDuration:state.wakeDuration},
          calendar:{startDate:state.startDate}
        });
        if(result?.changedWake){
          queueWakeReminder(result.plannedWake);
        }
      }
    }catch(e){console.warn('load failed',e)}
  }
  function loadSharedPlanFromURL(){
    if(typeof window==='undefined'||!window.location) return false;
    let params;
    try{
      params=new URLSearchParams(window.location.search);
    }catch(err){
      return false;
    }
    const code=params.get('plan');
    if(!code) return false;
    const parsed=decodeSharedPlan(code);
    if(!parsed.ok){
      showToast(parsed.message||'Unable to load shared plan from link.','error');
      return false;
    }
    const result=applyImportedPlan(parsed.data);
    if(result.ok){
      if(typeof window!=='undefined'&&window.history?.replaceState){
        params.delete('plan');
        const query=params.toString();
        const newUrl=`${window.location.pathname}${query?`?${query}`:''}${window.location.hash||''}`;
        window.history.replaceState(null,'',newUrl);
      }
      showToast('Shared plan loaded from link.','success');
      return true;
    }
    showToast(result.message||'Unable to load shared plan from link.','error');
    return false;
  }

  // ---------- logic ----------
  function rollForwardToToday(data){
    let changedWake=false;
    let plannedWake=state.wake;
    try{
      const sd=data.calendar?.startDate||todayAsYYYYMMDD();
      state.startDate=sd;
      const start=new Date(sd); const today=getNow();
      const daysSince=Math.floor((new Date(today.getFullYear(),today.getMonth(),today.getDate())-new Date(start.getFullYear(),start.getMonth(),start.getDate()))/(24*60*60*1000));
      const localTargetM=convertMinutesBetweenTZ(data.planner?.target?.zone||'local','local',data.planner?.targetDate||todayAsYYYYMMDD(),toMinutes(data.planner?.target?.time||'07:00'));
      const wm=toMinutes(data.model?.wake||state.wake);
      const sdur=data.model?.wakeDuration??state.wakeDuration;
      const rows=computePlanSchedule({
        wakeM:wm,
        sleepM:modDay(wm-(MINUTES_IN_DAY-sdur)),
        plannerMode:data.planner?.plannerMode||state.plannerMode,
        targetTimeM:localTargetM,
        dailyStep:data.planner?.dailyStep??state.dailyStep,
        direction:data.planner?.direction||state.direction,
        nDays:Math.max(1,Math.floor((new Date(data.planner?.targetDate||todayAsYYYYMMDD())-new Date(sd))/(24*60*60*1000))),
        fromDate:new Date(sd)
      });
      let todaysMinutes;
      if(daysSince<=0) todaysMinutes=wm; else if(daysSince>=rows.length) todaysMinutes=localTargetM; else todaysMinutes=rows[daysSince]?.time||localTargetM;
      if((data.planner?.plannerMode||state.plannerMode)==='wake'){
        plannedWake=minutesToTimeString(todaysMinutes);
      } else {
        const w=modDay(todaysMinutes+sdur); plannedWake=minutesToTimeString(w);
      }
      if(plannedWake!==state.wake){
        state.wake=plannedWake;
        changedWake=true;
      }
    }catch(e){console.warn('rollForwardToToday failed',e)}
    return {changedWake,plannedWake};
  }

  // ---------- render ----------
  function render(){
    applyTextScale();
    applyTheme(state.theme);
    // inputs
    wakeInput.value=state.wake;
    wakeDuration.value=String(state.wakeDuration);
    targetDate.value=state.targetDate;
    plannerMode.value=state.plannerMode;
    plannerModeLabel.textContent=state.plannerMode;
    timeZone.value=state.timeZone;
    targetTime.value=state.targetTime;
    dailyStep.value=String(state.dailyStep); dailyStepLabel.textContent=String(state.dailyStep);

    // derived
    const wakeM=toMinutes(state.wake);
    const sleepDuration=MINUTES_IN_DAY-state.wakeDuration;
    const sleepM=modDay(wakeM-sleepDuration);

    sleepFrom.textContent=format12h(sleepM);
    sleepTo.textContent=format12h(wakeM);
    const hours=Math.round(sleepDuration/60);
    sleepHours.textContent=String(hours);
    sleepHours2.textContent=String(hours);

    renderYourDaySection(wakeM,sleepDuration);


    // feels-like clock
    const now=getNow(); const nowM=now.getHours()*60+now.getMinutes();
    const normalWake=7*60; const bioOffset=modDay(wakeM-normalWake);
    const bioMinutes=modDay(nowM-bioOffset);
    if(feelsLike) feelsLike.textContent=state.show12h?format12h(bioMinutes):`${pad(Math.floor(bioMinutes/60))}:${pad(bioMinutes%60)}`;
    if(clockDate) clockDate.textContent=now.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});
    if(toggleFormat) toggleFormat.textContent=state.show12h?'12-hour':'24-hour';
    if(analogClock) drawClock(analogClock,bioMinutes);

    // plan
    const targetLocal=convertMinutesBetweenTZ(state.timeZone,'local',state.targetDate,toMinutes(state.targetTime));
    const nDays=(()=>{const p=state.targetDate.split('-').map(Number); if(p.length!==3||p.some(isNaN)) return 1; const end=new Date(p[0],p[1]-1,p[2]); const today=getNow(); const startOf=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime(); const diff=Math.round((startOf(end)-startOf(today))/(24*60*60*1000)); return Math.max(1,diff);})();
    const rows=computePlanSchedule({wakeM,sleepM,plannerMode:state.plannerMode,targetTimeM:targetLocal,dailyStep:state.dailyStep,direction:state.direction,nDays,fromDate:getNow()});
    if(planBody){
      planBody.innerHTML='';
      rows.forEach(row=>{
        const d=new Date(row.date);
        const wakeTimeM=state.plannerMode==='wake'?row.time:modDay(row.time+sleepDuration);
        const sleepTimeM=state.plannerMode==='sleep'?row.time:modDay(row.time-sleepDuration);
        const tr=document.createElement('tr');
        tr.innerHTML=`<td>${formatCompactDate(d)}</td><td>${format12h(wakeTimeM)}</td><td>${format12h(sleepTimeM)}</td>`;
        planBody.appendChild(tr);
      });
    }

    updateDirectionButtons();
  }

  function adjustTextScale(delta){
    const next=Math.round((state.textScale+delta)*100)/100;
    state.textScale=clamp(next,MIN_TEXT_SCALE,MAX_TEXT_SCALE);
    applyTextScale();
    savePreferences();
  }
  function setThemePreference(theme){
    applyTheme(theme);
    savePreferences();
  }

  function drawClock(svgEl,minutes){
    const cx=100,cy=100,r=84; const color=bioColor(minutes);
    const hAng=((minutes%720)/720)*360-90; const mAng=((minutes%60)/60)*360-90;
    svgEl.innerHTML='';
    const circle=document.createElementNS('http://www.w3.org/2000/svg','circle');
    circle.setAttribute('cx',cx);circle.setAttribute('cy',cy);circle.setAttribute('r',r);circle.setAttribute('fill','#0f1424');circle.setAttribute('stroke',color);circle.setAttribute('stroke-width','8');
    svgEl.appendChild(circle);
    // hour marks
    for(let i=0;i<12;i++){
      const a=(i*30-90)*Math.PI/180; const x1=cx+Math.cos(a)*r*0.88, y1=cy+Math.sin(a)*r*0.88; const x2=cx+Math.cos(a)*r, y2=cy+Math.sin(a)*r;
      const line=document.createElementNS('http://www.w3.org/2000/svg','line');
      line.setAttribute('x1',x1);line.setAttribute('y1',y1);line.setAttribute('x2',x2);line.setAttribute('y2',y2);line.setAttribute('stroke','#CFE2FF');line.setAttribute('stroke-width',i%3===0?'3':'1');line.setAttribute('stroke-opacity','0.55'); svgEl.appendChild(line);
    }
    const toXY=(ang,len)=>{const rad=ang*Math.PI/180;return {x:cx+Math.cos(rad)*len,y:cy+Math.sin(rad)*len}};
    const h=toXY(hAng,r*0.6), m=toXY(mAng,r*0.82);
    const hl=document.createElementNS('http://www.w3.org/2000/svg','line'); hl.setAttribute('x1',cx);hl.setAttribute('y1',cy);hl.setAttribute('x2',h.x);hl.setAttribute('y2',h.y);hl.setAttribute('stroke',color);hl.setAttribute('stroke-width','5');hl.setAttribute('stroke-linecap','round'); svgEl.appendChild(hl);
    const ml=document.createElementNS('http://www.w3.org/2000/svg','line'); ml.setAttribute('x1',cx);ml.setAttribute('y1',cy);ml.setAttribute('x2',m.x);ml.setAttribute('y2',m.y);ml.setAttribute('stroke',color);ml.setAttribute('stroke-opacity','0.7');ml.setAttribute('stroke-width','3');ml.setAttribute('stroke-linecap','round'); svgEl.appendChild(ml);
    const dot=document.createElementNS('http://www.w3.org/2000/svg','circle'); dot.setAttribute('cx',cx);dot.setAttribute('cy',cy);dot.setAttribute('r',4);dot.setAttribute('fill',color); svgEl.appendChild(dot);
  }
  function bioColor(mins){
    const m=modDay(mins);
    const PINK='#FF8FB3',YELLOW='#FFD64D',ORANGE='#FF7A3C',MOON='#8EC5FF';
    if(m>=21*60||m<5*60) return MOON;
    if(m<7*60) return lerp(PINK,YELLOW,(m-5*60)/(2*60));
    if(m<18*60) return YELLOW;
    if(m<20*60) return lerp(YELLOW,ORANGE,(m-18*60)/(2*60));
    if(m<21*60) return lerp(ORANGE,MOON,(m-20*60)/(1*60));
    return MOON;
  }
  function hexToRgb(hex){const h=hex.replace('#','');const n=parseInt(h,16);const r=(h.length===3?((n>>8)&0xf)*17:(n>>16)&0xff);const g=(h.length===3?((n>>4)&0xf)*17:(n>>8)&0xff);const b=(h.length===3?((n    )&0xf)*17:(n     )&0xff);return {r,g,b};}
  function rgbToHex(r,g,b){const f=(x)=>x.toString(16).padStart(2,'0');return `#${f(Math.round(r))}${f(Math.round(g))}${f(Math.round(b))}`}
  function lerp(a,b,t){const A=hexToRgb(a),B=hexToRgb(b);const u=Math.max(0,Math.min(1,t));return rgbToHex(A.r+(B.r-A.r)*u,A.g+(B.g-A.g)*u,A.b+(B.b-A.b)*u)}

  // ---------- events ----------
  if(textScaleDown) textScaleDown.addEventListener('click',()=>adjustTextScale(-TEXT_SCALE_STEP));
  if(textScaleUp) textScaleUp.addEventListener('click',()=>adjustTextScale(TEXT_SCALE_STEP));
  themeButtons.forEach(btn=>{
    btn.setAttribute('type','button');
    btn.addEventListener('click',()=>{
      const value=btn.getAttribute('data-theme-choice');
      if(!value) return;
      setThemePreference(value);
      render();
    });
  });
  if(yourDayList){
    yourDayList.addEventListener('input',e=>{
      ensureDefaultDaySnapshot();
      const target=e.target;
      if(!(target instanceof Element)||target.tagName!=='INPUT') return;
      const row=target.closest('[data-index]');
      if(!row) return;
      const index=Number(row.dataset.index);
      if(Number.isNaN(index)||!state.day.items[index]) return;
      const field=target.getAttribute('data-field');
      if(field==='time'){
        const nextValue=normalizeTimeString(target.value,state.day.items[index].time||'00:00');
        state.day.items[index].time=nextValue;
        target.value=nextValue;
      } else if(field==='label'){
        state.day.items[index].label=target.value;
      }
      state.day.dirty=true;
    });
    yourDayList.addEventListener('click',e=>{
      const btn=e.target instanceof Element?e.target.closest('[data-remove]'):null;
      if(!btn) return;
      ensureDefaultDaySnapshot();
      const row=btn.closest('[data-index]');
      if(!row) return;
      const index=Number(row.dataset.index);
      if(Number.isNaN(index)) return;
      state.day.items.splice(index,1);
      state.day.dirty=true;
      render();
    });
  }
  if(addDayItem){
    addDayItem.addEventListener('click',()=>{
      ensureDefaultDaySnapshot();
      const fallback=state.day.items.length?state.day.items[state.day.items.length-1].time:'08:00';
      state.day.items.push({time:normalizeTimeString(fallback,'08:00'),label:''});
      sortDayItemsInPlace(state.day.items);
      state.day.dirty=true;
      render();
    });
  }
  if(yourDaySave){
    yourDaySave.addEventListener('click',()=>{
      ensureDefaultDaySnapshot();
      const name=(yourDayName?.value||'').trim();
      if(!name){
        showToast('Enter a schedule name before saving.','error');
        return;
      }
      const id=slugifyScheduleName(name);
      if(!id){
        showToast('Unable to save schedule.','error');
        return;
      }
      sortDayItemsInPlace(state.day.items);
      const previousId=state.day.scheduleId;
      const existed=Boolean(state.savedSchedules[id]);
      state.savedSchedules[id]={id,name,items:cloneDayItems(state.day.items)};
      if(previousId&&previousId!==id&&previousId!==DEFAULT_SCHEDULE_ID){
        delete state.savedSchedules[previousId];
      }
      state.day.scheduleId=id;
      state.day.dirty=false;
      persistSchedules();
      render();
      showToast(existed?'Schedule updated.':'Schedule saved.','success');
    });
  }
  if(yourDayRemove){
    yourDayRemove.addEventListener('click',()=>{
      const currentId=state.day.scheduleId;
      if(currentId===DEFAULT_SCHEDULE_ID) return;
      if(state.savedSchedules[currentId]){
        delete state.savedSchedules[currentId];
        persistSchedules();
      }
      state.day.scheduleId=DEFAULT_SCHEDULE_ID;
      state.day.dirty=false;
      render();
      showToast('Schedule removed.','info');
    });
  }
  if(yourDayReset){
    yourDayReset.addEventListener('click',()=>{
      state.day.scheduleId=DEFAULT_SCHEDULE_ID;
      state.day.dirty=false;
      render();
      showToast('Reverted to default schedule.','info');
    });
  }
  if(yourDaySelect){
    yourDaySelect.addEventListener('change',()=>{
      const selected=yourDaySelect.value;
      const ok=loadScheduleById(selected);
      if(!ok){
        showToast('Schedule not found.','error');
        render();
        return;
      }
      render();
      showToast(selected===DEFAULT_SCHEDULE_ID?'Default schedule loaded.':'Schedule loaded.','success');
    });
  }
  if(wakeInput) wakeInput.addEventListener('input',e=>{state.wake=e.target.value;state.startDate=todayAsYYYYMMDD();render()});
  if(wakeDuration) wakeDuration.addEventListener('input',e=>{state.wakeDuration=clamp(Number(e.target.value),720,1200);state.startDate=todayAsYYYYMMDD();render()});
  if(toggleFormat) toggleFormat.addEventListener('click',()=>{state.show12h=!state.show12h;render()});
  if(targetDate) targetDate.addEventListener('input',e=>{state.targetDate=e.target.value;state.startDate=todayAsYYYYMMDD();render()});
  if(plannerMode) plannerMode.addEventListener('change',e=>{state.plannerMode=e.target.value;if(plannerModeLabel) plannerModeLabel.textContent=state.plannerMode;state.startDate=todayAsYYYYMMDD();render()});
  if(timeZone) timeZone.addEventListener('change',e=>{state.timeZone=e.target.value;state.startDate=todayAsYYYYMMDD();render()});
  if(targetTime) targetTime.addEventListener('input',e=>{state.targetTime=e.target.value;state.startDate=todayAsYYYYMMDD();render()});
  if(dailyStep) dailyStep.addEventListener('input',e=>{state.dailyStep=clamp(Number(e.target.value),5,240);dailyStepLabel.textContent=String(state.dailyStep);state.startDate=todayAsYYYYMMDD();render()});
  dirButtons.forEach(btn=>{
    btn.setAttribute('aria-pressed','false');
    btn.setAttribute('type','button');
    btn.addEventListener('click',()=>{
      const value=btn.getAttribute('data-dir');
      if(!value) return;
      state.direction=value;
      state.startDate=todayAsYYYYMMDD();
      render();
    });
  });

  if(saveBtn){
    saveBtn.addEventListener('click',()=>{
      const result=save();
      if(result?.ok!==false){
        showToast('Saved','success');
      } else {
        showToast(`Save failed: ${result?.error||'storage error'}`,'error');
      }
    });
  }
  if(loadBtn){
    loadBtn.addEventListener('click',()=>{
      try{
        const raw=localStorage.getItem(TRANSFER_KEY)||localStorage.getItem(STORAGE_KEY);
        if(!raw){
          showToast('No saved plan found in this browser.','error');
          return;
        }
        let data;
        try{data=JSON.parse(raw);}catch(err){
          showToast('Saved plan is corrupted: '+(err?.message||'Parse error'),'error');
          return;
        }
        const result=applyImportedPlan(data);
        if(result.ok){
          render();
          maybeShowWakeReminder();
          showToast('Loaded','success');
        } else {
          showToast(result.message||'Load failed.','error');
        }
      }catch(err){
        showToast('Unable to access browser storage: '+(err?.message||'storage error'),'error');
      }
    });
  }
  if(shareBtn){
    shareBtn.addEventListener('click',async()=>{
      const data=buildSaveObject(state.startDate);
      const shareCode=encodePlanToShareText(data);
      let linkText=shareCode;
      if(typeof window!=='undefined'&&window.location){
        try{
          const url=new URL(window.location.href);
          url.searchParams.set('plan',shareCode);
          linkText=url.toString();
        }catch(err){
          const origin=window.location.origin||'';
          const path=window.location.pathname||'';
          linkText=`${origin}${path}?plan=${encodeURIComponent(shareCode)}`;
        }
      }
      const shareData={title:'NightOwl plan',url:linkText};
      if(typeof navigator!=='undefined'&&navigator.share){
        try{
          if(!navigator.canShare||navigator.canShare(shareData)){
            await navigator.share(shareData);
            return;
          }
        }catch(err){
          if(err?.name==='AbortError') return;
          showToast('Unable to open share sheet. Copy the link manually.','error');
        }
      }
      openShareDialog(linkText,shareCode);
    });
  }
  if(applyOverride){
    applyOverride.addEventListener('click',()=>{
      if(!overrideInput) return;
      applyOverrideValue(overrideInput.value);
    });
  }
  if(clearOverride){
    clearOverride.addEventListener('click',()=>{
      if(overrideInput) overrideInput.value='';
      applyOverrideValue('');
    });
  }

  if(shareLayer){
    shareLayer.addEventListener('click',e=>{
      const target=e.target;
      if(typeof Element!=='undefined'&&target instanceof Element&&target.hasAttribute('data-share-close')){
        closeShareDialog();
      }
    });
  }
  if(shareCopyLink){
    shareCopyLink.addEventListener('click',async()=>{
      const text=shareLinkInput?.value||'';
      const ok=await copyTextToClipboard(text);
      if(ok){
        showToast('Link copied to clipboard.','success');
      }else{
        showToast('Unable to copy link. Please copy manually.','error');
      }
    });
  }
  if(shareCopyCode){
    shareCopyCode.addEventListener('click',async()=>{
      const text=shareCodeEl?.textContent||'';
      const ok=await copyTextToClipboard(text);
      if(ok){
        showToast('Code copied to clipboard.','success');
      }else{
        showToast('Unable to copy code. Please copy manually.','error');
      }
    });
  }
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&isShareOpen()){
      e.preventDefault();
      closeShareDialog();
    }
  });

  // clock tick
  setInterval(()=>render(),30000);

  // init
  (function init(){
    // defaults
    loadPreferences();
    loadSchedules();
    applyTextScale();
    applyTheme(state.theme);
    updateScheduleSelect();
    wakeInput.value=state.wake; wakeDuration.value=String(state.wakeDuration);
    targetDate.value=state.targetDate; plannerMode.value=state.plannerMode; timeZone.value=state.timeZone; targetTime.value=state.targetTime; dailyStep.value=String(state.dailyStep);
    try{
      const stored=localStorage.getItem(OVERRIDE_KEY);
      if(stored){
        const parsed=new Date(stored);
        if(!Number.isNaN(parsed.getTime())){
          overrideNowDate=parsed;
        }
      }
    }catch{}
    updateOverrideUI();
    load();
    loadSharedPlanFromURL();
    render();
    maybeShowWakeReminder();
  })();
})();
