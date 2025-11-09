/* nightowl.js */
(function(){
  const MINUTES_IN_DAY = 1440;
  const STORAGE_KEY = 'nightowl.plan.v1';

  // ---------- helpers ----------
  const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
  const pad=(n)=>String(n).padStart(2,'0');
  const todayAsYYYYMMDD=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`};
  const toMinutes=(t)=>{const [h,m]=String(t).split(':').map(Number);return (((h||0)*60+(m||0))%MINUTES_IN_DAY+MINUTES_IN_DAY)%MINUTES_IN_DAY};
  const minutesToTimeString=(mins)=>{const m=((mins%MINUTES_IN_DAY)+MINUTES_IN_DAY)%MINUTES_IN_DAY;return `${pad(Math.floor(m/60))}:${pad(m%60)}`};
  const format12h=(mins)=>{const m=((mins%MINUTES_IN_DAY)+MINUTES_IN_DAY)%MINUTES_IN_DAY;let h=Math.floor(m/60);const mm=pad(m%60);const ap=h>=12?'PM':'AM';h%=12;if(h===0)h=12;return `${h}:${mm} ${ap}`};
  const formatCompactDate=(d)=>d.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});
  const modDay=(n)=>((n%MINUTES_IN_DAY)+MINUTES_IN_DAY)%MINUTES_IN_DAY;

  function wallMinutesAt(date,tz){
    const fmt={hour12:false,hour:'2-digit',minute:'2-digit'};
    const parts=new Intl.DateTimeFormat('en-GB', tz==='local'?fmt:{...fmt,timeZone:tz}).formatToParts(date);
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
  const tzLabel=$('tzLabel');
  const targetTime=$('targetTime');
  const dailyStep=$('dailyStep');
  const dailyStepLabel=$('dailyStepLabel');
  const planBody=$('planBody');
  const analogClock=$('analogClock');
  const exportBtn=$('exportBtn');
  const importBtn=$('importBtn');
  const panel=$('dataPanel');
  const panelTitle=$('panelTitle');
  const panelMessage=$('panelMessage');
  const panelText=$('panelText');
  const panelPrimary=$('panelPrimary');
  const panelCancel=$('panelCancel');

  // ---------- persistence ----------
  const buildSaveObject=(startDate)=>({
    version:1,
    savedAt:new Date().toISOString(),
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
  function save(){
    const payload=buildSaveObject(state.startDate);
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(payload));}catch{}
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
      state.wake=data.model?.wake||'10:00';
      state.startDate=data.calendar?.startDate||todayAsYYYYMMDD();
      // Optional roll only if stored startDate is in the past
      const today=todayAsYYYYMMDD();
      if (new Date(state.startDate) < new Date(today)) {
        rollForwardToToday({
          planner:{plannerMode:state.plannerMode,direction:state.direction,dailyStep:state.dailyStep,target:{time:state.targetTime,zone:state.timeZone},targetDate:state.targetDate},
          model:{wake:state.wake,wakeDuration:state.wakeDuration},
          calendar:{startDate:state.startDate}
        });
      }
    }catch(e){console.warn('load failed',e)}
  }

  // ---------- logic ----------
  function rollForwardToToday(data){
    try{
      const sd=data.calendar?.startDate||todayAsYYYYMMDD();
      state.startDate=sd;
      const start=new Date(sd); const today=new Date();
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
        state.wake=minutesToTimeString(todaysMinutes);
      } else {
        const w=modDay(todaysMinutes+sdur); state.wake=minutesToTimeString(w);
      }
    }catch(e){console.warn('rollForwardToToday failed',e)}
  }

  // ---------- render ----------
  function render(){
    // inputs
    wakeInput.value=state.wake;
    wakeDuration.value=String(state.wakeDuration);
    targetDate.value=state.targetDate;
    plannerMode.value=state.plannerMode;
    plannerModeLabel.textContent=state.plannerMode;
    timeZone.value=state.timeZone; tzLabel.textContent=state.timeZone==='local'?'Local':state.timeZone;
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

// --- Your Day panel ---
const yourDayDiv = document.getElementById('yourDay');
const e = computeDayEvents(wakeM, sleepDuration);
yourDayDiv.innerHTML = `
  <div class="dayrow"><span class="label">Wake</span><span class="strong">${format12h(e.wake)}</span></div>
  <div class="dayrow"><span class="label">Lunch</span><span class="strong">${format12h(e.lunch)}</span></div>
  <div class="dayrow"><span class="label">Dinner</span><span class="strong">${format12h(e.dinner)}</span></div>
  <div class="dayrow"><span class="label">Sleep</span><span class="strong">${format12h(e.sleep)}</span></div>
`;


    // feels-like clock
    const now=new Date(); const nowM=now.getHours()*60+now.getMinutes();
    const normalWake=7*60; const bioOffset=modDay(wakeM-normalWake);
    const bioMinutes=modDay(nowM-bioOffset);
    $('feelsLike').textContent=state.show12h?format12h(bioMinutes):`${pad(Math.floor(bioMinutes/60))}:${pad(bioMinutes%60)}`;
    toggleFormat.textContent=state.show12h?'12-hour':'24-hour';
    drawClock(analogClock,bioMinutes);

    // plan
    const targetLocal=convertMinutesBetweenTZ(state.timeZone,'local',state.targetDate,toMinutes(state.targetTime));
    const nDays=(()=>{const p=state.targetDate.split('-').map(Number); if(p.length!==3||p.some(isNaN)) return 1; const end=new Date(p[0],p[1]-1,p[2]); const today=new Date(); const startOf=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime(); const diff=Math.round((startOf(end)-startOf(today))/(24*60*60*1000)); return Math.max(1,diff);})();
    const rows=computePlanSchedule({wakeM,sleepM,plannerMode:state.plannerMode,targetTimeM:targetLocal,dailyStep:state.dailyStep,direction:state.direction,nDays,fromDate:new Date()});
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
  wakeInput.addEventListener('input',e=>{state.wake=e.target.value;state.startDate=todayAsYYYYMMDD();save();render()});
  wakeDuration.addEventListener('input',e=>{state.wakeDuration=clamp(Number(e.target.value),720,1200);state.startDate=todayAsYYYYMMDD();save();render()});
  toggleFormat.addEventListener('click',()=>{state.show12h=!state.show12h;render()});
  targetDate.addEventListener('input',e=>{state.targetDate=e.target.value;state.startDate=todayAsYYYYMMDD();save();render()});
  plannerMode.addEventListener('change',e=>{state.plannerMode=e.target.value;$('plannerModeLabel').textContent=state.plannerMode;state.startDate=todayAsYYYYMMDD();save();render()});
  timeZone.addEventListener('change',e=>{state.timeZone=e.target.value;tzLabel.textContent=state.timeZone==='local'?'Local':state.timeZone;state.startDate=todayAsYYYYMMDD();save();render()});
  targetTime.addEventListener('input',e=>{state.targetTime=e.target.value;state.startDate=todayAsYYYYMMDD();save();render()});
  dailyStep.addEventListener('input',e=>{state.dailyStep=clamp(Number(e.target.value),5,240);dailyStepLabel.textContent=String(state.dailyStep);state.startDate=todayAsYYYYMMDD();save();render()});
  document.querySelectorAll('[data-dir]').forEach(btn=>btn.addEventListener('click',()=>{state.direction=btn.getAttribute('data-dir');state.startDate=todayAsYYYYMMDD();save();render()}));

  exportBtn.addEventListener('click',()=>{
    const data=buildSaveObject(state.startDate);
    panel.classList.remove('hidden');
    panelTitle.textContent='Export plan';
    panelMessage.textContent='Copy the JSON below to save your plan.';
    panelText.value=JSON.stringify(data,null,2);
    panelPrimary.textContent='Copy hint';
    panelPrimary.onclick=()=>{panelMessage.textContent='Select all and copy (Ctrl/Cmd+A, then Ctrl/Cmd+C).'};
  });
  importBtn.addEventListener('click',()=>{
    panel.classList.remove('hidden');
    panelTitle.textContent='Import plan';
    panelMessage.textContent='Paste a NightOwl plan JSON below, then click Load.';
    panelText.value='';
    panelPrimary.textContent='Load';
    panelPrimary.onclick=()=>{
      try{
        const data=JSON.parse(panelText.value);
        if(data?.version===1){
          state.plannerMode=data.planner?.plannerMode||'wake';
          state.direction=data.planner?.direction||'auto';
          state.dailyStep=data.planner?.dailyStep??30;
          state.timeZone=data.planner?.target?.zone||'local';
          state.targetTime=data.planner?.target?.time||'07:00';
          state.targetDate=data.planner?.targetDate||todayAsYYYYMMDD();
          state.wakeDuration=data.model?.wakeDuration??(15*60);
          state.wake=minutesToTimeString(toMinutes(data.model?.wake||state.wake));
          // reset plan start to today (no roll to avoid overwrite race)
          state.startDate=todayAsYYYYMMDD();
          const saved={...data,calendar:{...(data.calendar||{}),startDate:state.startDate}};
          try{localStorage.setItem(STORAGE_KEY,JSON.stringify(saved));}catch{}
          panelMessage.textContent='Plan imported successfully. You can close this panel.';
          render();
        } else {
          panelMessage.textContent='Invalid plan JSON: missing version 1.';
        }
      }catch(err){ panelMessage.textContent='Import failed: '+(err?.message||'Parse error'); }
    };
  });
  panelCancel.addEventListener('click',()=>{panel.classList.add('hidden')});

  // clock tick
  setInterval(()=>render(),30000);

  // init
  (function init(){
    // defaults
    wakeInput.value=state.wake; wakeDuration.value=String(state.wakeDuration);
    targetDate.value=state.targetDate; plannerMode.value=state.plannerMode; timeZone.value=state.timeZone; targetTime.value=state.targetTime; dailyStep.value=String(state.dailyStep);
    load(); save(); render();
  })();
})();
