(() => {
'use strict';

const SEED = window.ALERA_SEED;
const STORE_KEY = 'alera_pwa_v1';
const DEVICE_ACCESS_KEY = 'alera_device_access_v1';
const FIRST_ACCESS_PIN = '2917';
const PLAN_START = new Date(2026, 8, 21, 0, 0, 0, 0);
const REVIEW_OFFSETS = [7, 14, 28, 42, 70, 112, 168]; // siempre desde learnedAt
const DAY = 86400000;
const skillNames = {speaking:'Speaking', writing:'Writing', reading:'Reading', listening:'Listening', pronunciation:'Pronunciation'};
const categoryNames = {Grammar:'Grammar', Vocabulary:'Vocabulary', Pronunciation:'Pronunciation'};
const tileIcon = {
  Grammar:'assets/icons/tiles/grammar.svg', Vocabulary:'assets/icons/tiles/vocabulary.svg', Pronunciation:'assets/icons/tiles/practice.svg'
};
const skillIcon = {
  speaking:'assets/icons/ui/speaking-mic.svg', writing:'assets/icons/ui/writing-pencil.svg', reading:'assets/icons/ui/reading-book.svg', listening:'assets/icons/ui/comprehension-headphones.svg', pronunciation:'assets/icons/ui/pronunciation-sound.svg'
};
const skillTileIcon = {
  speaking:'assets/icons/tiles/speaking.svg',
  writing:'assets/icons/tiles/writing.svg',
  reading:'assets/icons/tiles/reading.svg',
  listening:'assets/icons/ui/comprehension-headphones.svg',
  pronunciation:'assets/icons/ui/pronunciation-sound.svg'
};
const navIcon = {
  week:'assets/icons/ui/home.svg', reviews:'assets/icons/ui/reviews.svg', practice:'assets/icons/ui/practice-bars.svg', knowledge:'assets/icons/ui/reading-book.svg', progress:'assets/icons/ui/progress-bars.svg'
};
const knowledgeById = Object.fromEntries(SEED.knowledge.map(k => [k.id, k]));
let installPrompt = null;
let store = loadStore();
let ui = {
  view:'week',
  week: currentPlanWeek(),
  reviewFilter:'all',
  knowledgeFilter:'all',
  knowledgeQuery:'',
  progressRange:'4w',
  modal:null,
  practiceDraft:null
};

function freshStore(){
  return {version:1, profile:null, knowledge:{}, sessions:[], reviewEvents:[], reinforcements:[], createdAt:isoNow()};
}
function loadStore(){
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return freshStore();
    return {...freshStore(), ...JSON.parse(raw)};
  } catch(e){ return freshStore(); }
}
function saveStore(){ localStorage.setItem(STORE_KEY, JSON.stringify(store)); }
function isoNow(){ return new Date().toISOString(); }
function uid(prefix='id'){ return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`; }
function clamp(v,min,max){ return Math.max(min,Math.min(max,v)); }
function escapeHTML(v=''){ return String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function parseISO(s){ return s ? new Date(s) : null; }
function addDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
function startOfDay(d=new Date()){ return new Date(d.getFullYear(),d.getMonth(),d.getDate()); }
function startOfWeek(d=new Date()){
  const x=startOfDay(d), day=(x.getDay()+6)%7; x.setDate(x.getDate()-day); return x;
}
function endOfWeek(d=new Date()){ const x=startOfWeek(d); x.setDate(x.getDate()+6); x.setHours(23,59,59,999); return x; }
function formatDate(d, opts={day:'numeric',month:'short'}){ return new Intl.DateTimeFormat('es-ES',opts).format(d); }
function formatDateLong(d){ return new Intl.DateTimeFormat('es-ES',{day:'numeric',month:'short',year:'numeric'}).format(d); }
function daysBetween(a,b){ return Math.floor((startOfDay(b)-startOfDay(a))/DAY); }
function currentPlanWeek(){ return clamp(Math.floor((startOfDay(new Date())-PLAN_START)/(7*DAY))+1,1,19); }
function getWeekDates(n){ const s=addDays(PLAN_START,(n-1)*7), e=addDays(s,6); return {start:s,end:e}; }
function weekForDate(d){ return clamp(Math.floor((startOfDay(d)-PLAN_START)/(7*DAY))+1,1,19); }
function initials(name='A'){ return name.trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase() || 'A'; }
function prettyAgo(date){
  const n=daysBetween(date,new Date()); if(n<=0)return 'hoy'; if(n===1)return 'ayer'; if(n<7)return `hace ${n} días`; const w=Math.floor(n/7); if(w===1)return 'hace 1 semana'; if(w<5)return `hace ${w} semanas`; const m=Math.floor(n/30); return m<=1?'hace 1 mes':`hace ${m} meses`;
}
function icon(src, cls=''){ return `<img class="${cls}" src="${src}" alt="" aria-hidden="true">`; }
function getKState(id){
  if(!store.knowledge[id]) store.knowledge[id]={learnedAt:null};
  return store.knowledge[id];
}
function isLearned(id){ return !!getKState(id).learnedAt; }
function allSessionsFor(skill){ return store.sessions.filter(s=>!skill||s.skill===skill).sort((a,b)=>new Date(b.date)-new Date(a.date)); }
function sessionsForWeek(week,skill){ return store.sessions.filter(s=>s.week===week && (!skill||s.skill===skill)); }
function plannedItems(week){ return SEED.knowledge.filter(k=>k.week===week); }
function plannedPractice(week){ const w=SEED.weeks.find(x=>x.number===week); return w ? Object.entries(w.practice||{}).map(([skill,desc])=>({skill,desc})) : []; }

function coveredSlots(id){
  const set = new Set();
  store.reviewEvents.filter(e=>e.knowledgeId===id && e.kind==='scheduled').forEach(e=>(e.coveredSlots||[]).forEach(s=>set.add(s)));
  return set;
}
function nextScheduledReview(id){
  const st=getKState(id); if(!st.learnedAt)return null;
  const learned=parseISO(st.learnedAt), covered=coveredSlots(id);
  for(let i=0;i<REVIEW_OFFSETS.length;i++) if(!covered.has(i)) return {slot:i,due:addDays(learned,REVIEW_OFFSETS[i]),offset:REVIEW_OFFSETS[i]};
  return null;
}
function scheduledDueThisWeek(id, ref=new Date()){
  const next=nextScheduledReview(id); if(!next)return null;
  return next.due<=endOfWeek(ref) ? next : null;
}
function pendingReinforcement(id, ref=new Date()){
  return store.reinforcements.find(r=>r.knowledgeId===id && !r.completedAt && parseISO(r.dueDate)<=endOfWeek(ref)) || null;
}
function resultInitial(result){ return ({forgot:70,hard:82,good:94,easy:99})[result] || 92; }
function retentionAt(id, atDate=new Date()){
  const st=getKState(id); if(!st.learnedAt)return null;
  const at=new Date(atDate), learned=parseISO(st.learnedAt); if(at<learned)return null;
  const revs=store.reviewEvents.filter(e=>e.knowledgeId===id && parseISO(e.date)<=at).sort((a,b)=>new Date(a.date)-new Date(b.date));
  const last=revs[revs.length-1];
  const anchor=last?parseISO(last.date):learned;
  const initial=last?resultInitial(last.result):90;
  const next=nextScheduledForHistorical(id, at);
  let interval=7;
  if(next) interval=Math.max(7,daysBetween(anchor,next.due));
  else interval=168;
  const elapsed=Math.max(0,(at-anchor)/DAY);
  const value=initial*Math.exp(-0.24*(elapsed/interval));
  return Math.round(clamp(value,25,99));
}
function nextScheduledForHistorical(id, at){
  const st=getKState(id); if(!st.learnedAt)return null;
  const learned=parseISO(st.learnedAt);
  // Slots covered by reviews that already happened by `at`.
  const set=new Set();
  store.reviewEvents.filter(e=>e.knowledgeId===id && e.kind==='scheduled' && parseISO(e.date)<=at).forEach(e=>(e.coveredSlots||[]).forEach(s=>set.add(s)));
  for(let i=0;i<REVIEW_OFFSETS.length;i++) if(!set.has(i))return {slot:i,due:addDays(learned,REVIEW_OFFSETS[i])};
  return null;
}
function difficultyWeight(d, skill){
  const base={small:1,moderate:2,important:3}[d.severity]||1;
  return base * ((skill==='speaking'||skill==='writing')?1.2:1);
}
function difficultyEvents(id, days=45){
  const cutoff=addDays(new Date(),-days);
  const out=[];
  store.sessions.forEach(s=>{
    if(parseISO(s.date)<cutoff)return;
    (s.difficulties||[]).forEach(d=>{ if(d.knowledgeId===id) out.push({...d,session:s}); });
  });
  return out;
}
function difficultyScore(id,days=21){ return difficultyEvents(id,days).reduce((sum,d)=>sum+difficultyWeight(d,d.session.skill),0); }
function allDifficultyCount(id){ let n=0; store.sessions.forEach(s=>(s.difficulties||[]).forEach(d=>{if(d.knowledgeId===id)n++;})); return n; }
function statusFor(id){
  if(!isLearned(id))return 'upcoming';
  if(difficultyScore(id)>=3 || pendingReinforcement(id))return 'attention';
  const slots=coveredSlots(id).size;
  if(slots>=5)return 'consolidated';
  if(slots===0)return 'learning';
  return 'maintaining';
}
function statusLabel(s){ return ({upcoming:'Upcoming',learning:'Learning',maintaining:'Maintaining',attention:'Needs attention',consolidated:'Consolidated'})[s]||s; }
function ensureReinforcement(id, reason, dueDate=new Date()){
  if(!isLearned(id))return;
  const existing=store.reinforcements.find(r=>r.knowledgeId===id&&!r.completedAt);
  if(existing){
    const d=parseISO(existing.dueDate); if(dueDate<d) existing.dueDate=new Date(dueDate).toISOString();
    if(reason&&!existing.reason.includes(reason)) existing.reason += ` · ${reason}`;
    return;
  }
  store.reinforcements.push({id:uid('reinforce'),knowledgeId:id,createdAt:isoNow(),dueDate:new Date(dueDate).toISOString(),reason,completedAt:null});
}

function hasDeviceAccess(){ return localStorage.getItem(DEVICE_ACCESS_KEY)==='granted'; }
function grantDeviceAccess(){ localStorage.setItem(DEVICE_ACCESS_KEY,'granted'); }
function render(){
  const root=document.getElementById('app');
  if(!hasDeviceAccess()){ root.innerHTML=renderAccessGate(); bindAccessGate(); return; }
  if(!store.profile){ root.innerHTML=renderOnboarding(); bindOnboarding(); return; }
  root.innerHTML=renderShell();
  renderModal();
}
function renderAccessGate(){
  return `<div class="access-gate"><div class="access-card">
    <div class="access-logo">${icon('assets/icons/ui/alera-logo-mark.svg')}<span>Alera</span></div>
    <div class="access-icon" aria-hidden="true"><span></span></div>
    <h1>Acceso a Alera</h1>
    <p>Introduce la contraseña de este dispositivo. Solo te la pediremos esta primera vez.</p>
    <form id="access-form" novalidate>
      <label class="sr-only" for="access-pin">Contraseña</label>
      <input id="access-pin" class="pin-input" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" aria-describedby="access-error" placeholder="••••" />
      <div id="access-error" class="access-error" role="alert"></div>
      <button class="primary-btn access-submit" type="submit">Entrar</button>
    </form>
    <p class="access-note">Este dispositivo quedará recordado mientras no borres los datos del navegador o de la app.</p>
  </div></div>`;
}
function bindAccessGate(){
  const form=document.getElementById('access-form');
  const input=document.getElementById('access-pin');
  const error=document.getElementById('access-error');
  const submit=()=>{
    const value=(input?.value||'').replace(/\D/g,'');
    if(value===FIRST_ACCESS_PIN){
      grantDeviceAccess();
      render();
      setTimeout(()=>toast('Dispositivo recordado'),40);
      return;
    }
    if(error) error.textContent='Contraseña incorrecta';
    input?.classList.remove('is-error');
    void input?.offsetWidth;
    input?.classList.add('is-error');
    if(input){ input.value=''; input.focus(); }
  };
  input?.addEventListener('input',()=>{
    input.value=input.value.replace(/\D/g,'').slice(0,4);
    if(error) error.textContent='';
    if(input.value.length===4) submit();
  });
  form?.addEventListener('submit',e=>{e.preventDefault(); submit();});
  setTimeout(()=>input?.focus(),80);
}
function renderOnboarding(){
  return `<div class="onboarding"><div class="card onboard-card">
    <div class="onboard-logo">${icon('assets/icons/ui/alera-logo-mark.svg')}<strong>Alera</strong></div>
    <h1>Tu inglés, organizado por semanas.</h1>
    <p>Todo se guarda únicamente en este dispositivo. No hay cuenta, correo ni inicio de sesión.</p>
    <form id="onboard-form">
      <div class="photo-picker">
        <div class="profile-photo" id="onboard-photo-preview">A</div>
        <label for="onboard-photo">Añadir foto (opcional)</label><input id="onboard-photo" type="file" accept="image/*">
      </div>
      <div class="field"><label>Tu nombre</label><input id="onboard-name" required maxlength="40" placeholder="Alex" autocomplete="name"></div>
      <div class="field"><label>Idioma</label><select disabled><option>English</option></select></div>
      <div class="field"><label>Nivel actual</label><select id="onboard-level"><option selected>B2</option><option>B1</option><option>C1</option></select></div>
      <button class="primary-btn" type="submit">Empezar con Alera</button>
      <p class="fineprint" style="margin-top:14px">Plan cargado: 19 semanas · 21 septiembre 2026 – 31 enero 2027. Puedes usar la app sin conexión después de la primera carga.</p>
    </form>
  </div></div>`;
}
function bindOnboarding(){
  let photo=null;
  const input=document.getElementById('onboard-photo');
  input?.addEventListener('change',e=>{
    const f=e.target.files?.[0]; if(!f)return;
    const r=new FileReader(); r.onload=()=>{photo=r.result; document.getElementById('onboard-photo-preview').innerHTML=`<img src="${photo}" alt="Foto de perfil">`;}; r.readAsDataURL(f);
  });
  document.getElementById('onboard-name')?.addEventListener('input',e=>{if(!photo)document.getElementById('onboard-photo-preview').textContent=initials(e.target.value||'A');});
  document.getElementById('onboard-form')?.addEventListener('submit',e=>{
    e.preventDefault(); const name=document.getElementById('onboard-name').value.trim(); if(!name)return;
    store.profile={name,photo,language:'English',level:document.getElementById('onboard-level').value,createdAt:isoNow()}; saveStore(); render(); toast('Perfil local creado');
  });
}
function renderShell(){
  return `<div class="app-shell"><main class="main">${renderTopbar()}${renderView()}</main>${renderBottomNav()}</div>`;
}
function renderTopbar(){
  const p=store.profile;
  return `<header class="topbar"><div class="brand">Alera</div>
    <button class="language-pill" onclick="openLanguageInfo()">${escapeHTML(p.language)} · ${escapeHTML(p.level)} ${icon('assets/icons/ui/chevron-down.svg')}</button>
    <button class="avatar" onclick="openProfile()">${p.photo?`<img src="${p.photo}" alt="Perfil">`:escapeHTML(initials(p.name))}</button></header>`;
}
function renderBottomNav(){
  const items=[['week','Esta semana'],['reviews','Revisiones'],['practice','Práctica'],['knowledge','Biblioteca'],['progress','Progreso']];
  return `<nav class="bottom-nav"><div class="bottom-nav-inner">${items.map(([v,l])=>`<button class="nav-btn ${ui.view===v?'active':''}" onclick="setView('${v}')">${icon(navIcon[v])}<span>${l}</span></button>`).join('')}</div></nav>`;
}
function renderView(){
  if(ui.view==='week')return renderWeek();
  if(ui.view==='reviews')return renderReviews();
  if(ui.view==='practice')return renderPractice();
  if(ui.view==='knowledge')return renderKnowledge();
  return renderProgress();
}
function pageHead(title,subtitle){ return `<div class="page-head"><h1>${title}</h1><p>${subtitle}</p>${icon('assets/icons/ui/decorative-leaves.svg','decor-leaves')}</div>`; }

function renderWeek(){
  const week=SEED.weeks.find(w=>w.number===ui.week), items=plannedItems(ui.week), practice=plannedPractice(ui.week);
  const total=items.length+practice.length, doneK=items.filter(k=>isLearned(k.id)).length, doneP=practice.filter(p=>sessionsForWeek(ui.week,p.skill).length).length, done=doneK+doneP, pct=total?Math.round(done/total*100):0;
  const today=new Date(); const dates=getWeekDates(ui.week); const before=today<PLAN_START && ui.week===1;
  const grouped={Grammar:items.filter(i=>i.category==='Grammar'),Vocabulary:items.filter(i=>i.category==='Vocabulary'),Pronunciation:items.filter(i=>i.category==='Pronunciation')};
  return `${pageHead(`Buenos días, ${escapeHTML(store.profile.name.split(' ')[0])}`,before?'Tu plan empieza el lunes. Puedes explorarlo desde ahora.':'Esto es lo importante de esta semana.')}
  <div class="week-switch"><button onclick="setWeek(${ui.week-1})" ${ui.week<=1?'disabled':''}>‹</button><div class="week-label"><strong>Semana ${ui.week}</strong><span>${escapeHTML(week.dateLabel)}</span></div><button onclick="setWeek(${ui.week+1})" ${ui.week>=19?'disabled':''}>›</button></div>
  <section class="hero-card"><div class="hero-row"><div><div class="hero-title">Semana ${ui.week} · ${escapeHTML(week.dateLabel)}</div><div class="hero-stats"><div class="hero-stat"><span class="dot-icon">◉</span>${total} objetivos en total</div><div class="hero-stat"><span class="dot-icon">✓</span>${done} completados</div><div class="hero-stat"><span class="dot-icon"></span>${total-done} pendientes</div></div></div><div><div class="ring" style="--p:${pct}"><span>${pct}%</span></div><div class="hero-note">Avanza a tu ritmo durante la semana.</div></div></div></section>
  <div class="section-title"><h2>Tus temas de esta semana</h2><button class="link-btn" onclick="setView('knowledge')">Ver todos →</button></div>
  <div class="topic-grid-desktop">${['Grammar','Vocabulary','Pronunciation'].map(c=>grouped[c].length?renderWeekKnowledgeCard(c,grouped[c]):'').join('')}</div>
  ${renderWeekSkillCards(practice)}
  <div class="quote-card">${icon('assets/icons/ui/alera-logo-mark.svg')}“Pequeños pasos, grandes cambios.”</div>
  ${week.reason?`<div class="week-reason"><strong>Por qué esta semana:</strong> ${escapeHTML(week.reason)}</div>`:''}`;
}
function renderWeekKnowledgeCard(category,items){
  const done=items.filter(x=>isLearned(x.id)).length;
  return `<section class="card topic-card"><img class="tile-icon" src="${tileIcon[category]}" alt=""><div><h3>${category}<span class="topic-meta">${done}/${items.length}</span></h3><div class="mini-list">${items.map(k=>{
    const prevDifficulty=!isLearned(k.id)&&allDifficultyCount(k.id)>0;
    return `<div class="mini-row"><button class="check ${isLearned(k.id)?'done':''}" aria-label="${isLearned(k.id)?'Desmarcar como aprendido':'Marcar aprendido'}" title="${isLearned(k.id)?'Desmarcar como aprendido':'Marcar como aprendido'}" onclick="event.stopPropagation();markKnowledge('${k.id}')"></button><button class="link-btn mini-topic-link" onclick="openKnowledge('${k.id}')">${escapeHTML(k.name)}${prevDifficulty?' <span class="badge">dificultad previa</span>':''}</button></div>`;
  }).join('')}</div></div><button class="card-chevron" aria-label="Ver ${category} de la semana" onclick="openWeekCategory('${category}',${ui.week})">${icon('assets/icons/ui/chevron-right.svg','chevron')}</button></section>`;
}
function renderWeekSkillCards(practice){
  if(!practice.length)return '';
  return `<div class="week-practice-heading"><h2>Práctica de esta semana</h2><span>${practice.filter(p=>sessionsForWeek(ui.week,p.skill).length).length}/${practice.length}</span></div><div class="topic-grid-desktop week-practice-grid">${practice.map(p=>renderWeekSkillCard(p)).join('')}</div>`;
}
function renderWeekSkillCard(p){
  const done=sessionsForWeek(ui.week,p.skill).length>0;
  const tile=skillTileIcon[p.skill]||skillIcon[p.skill]||'assets/icons/tiles/practice.svg';
  const uiOnly=p.skill==='listening'||p.skill==='pronunciation';
  return `<section class="card topic-card week-skill-card"><div class="week-skill-tile ${uiOnly?'ui-icon-tile':''} ${p.skill}"><img src="${tile}" alt=""></div><div><h3>${skillNames[p.skill]}<span class="topic-meta">${done?'1/1':'0/1'}</span></h3><div class="mini-list"><div class="mini-row practice-objective"><span class="check ${done?'done':''}" aria-hidden="true"></span><button class="link-btn mini-topic-link" onclick="openPractice('${p.skill}',${ui.week})">${escapeHTML(p.desc)}</button></div></div></div><button class="card-chevron" aria-label="Registrar sesión de ${skillNames[p.skill]}" onclick="openPractice('${p.skill}',${ui.week})">${icon('assets/icons/ui/chevron-right.svg','chevron')}</button></section>`;
}

function getReviewCards(){
  const cards=[];
  SEED.knowledge.forEach(k=>{
    if(!isLearned(k.id))return;
    const due=scheduledDueThisWeek(k.id); const rein=pendingReinforcement(k.id);
    if(due||rein){
      const score=difficultyScore(k.id); let priority=score>=4|| (due&&due.due<startOfWeek(new Date()))?'high':score>=2||rein?'med':'normal';
      cards.push({item:k,due,rein,priority,score});
    }
  });
  const rank={high:0,med:1,normal:2};
  return cards.sort((a,b)=>{
    const r=rank[a.priority]-rank[b.priority]; if(r) return r;
    const ad=a.due?.due||parseISO(a.rein?.dueDate); const bd=b.due?.due||parseISO(b.rein?.dueDate);
    return ad-bd;
  });
}
function renderReviews(){
  const cards=getReviewCards();
  const shown=cards.filter(c=>ui.reviewFilter==='all'||(ui.reviewFilter==='priority'&&c.priority!=='normal'));
  const completedThisWeek=store.reviewEvents.filter(e=>parseISO(e.date)>=startOfWeek(new Date())).length;
  return `${pageHead('Revisiones',`${cards.length} repaso${cards.length===1?'':'s'} esta semana · ${cards.filter(c=>c.priority!=='normal').length} prioritarios`)}
  <div class="segmented"><button class="segment ${ui.reviewFilter==='all'?'active':''}" onclick="setReviewFilter('all')">Todos (${cards.length})</button><button class="segment ${ui.reviewFilter==='priority'?'active':''}" onclick="setReviewFilter('priority')">Prioritarios (${cards.filter(c=>c.priority!=='normal').length})</button><button class="segment" disabled>Hechos (${completedThisWeek})</button></div>
  ${shown.length?shown.map(renderReviewCard).join(''):`<div class="card empty">${icon('assets/icons/ui/reviews.svg')}<h3>Todo al día</h3><p>No hay revisiones pendientes para esta semana. Las próximas aparecerán aquí según la fecha original en la que aprendiste cada tema.</p></div>`}`;
}
function renderReviewCard(c){
  const k=c.item, st=getKState(k.id), ret=retentionAt(k.id); const last=store.reviewEvents.filter(e=>e.knowledgeId===k.id).sort((a,b)=>new Date(b.date)-new Date(a.date))[0];
  const insight=c.score>=3?`Dificultades recientes detectadas en práctica.`:c.rein?escapeHTML(c.rein.reason):c.due&&c.due.due<startOfWeek(new Date())?'Esta revisión está pendiente de una semana anterior.':'Toca según su calendario base.';
  return `<section class="card review-card"><div class="review-top"><img class="tile-icon" src="${tileIcon[k.category]}" alt=""><div><h3>${escapeHTML(k.name)}</h3><div class="subtitle">${k.category} · Retención estimada ${ret}%</div><div class="review-insight">${icon('assets/icons/ui/clock.svg')}${last?`Última revisión: ${prettyAgo(parseISO(last.date))}`:`Aprendido: ${formatDateLong(parseISO(st.learnedAt))}`}</div><div class="review-insight">${icon('assets/icons/ui/progress-bars.svg')}${insight}</div></div><div class="attention-dots ${c.priority==='high'?'high':c.priority==='med'?'med':''}"><i></i><i></i><i></i></div></div><button class="primary-btn" onclick="openReview('${k.id}','${c.due?'scheduled':'reinforcement'}')">Revisar</button></section>`;
}

function renderPractice(){
  const recent=store.sessions.slice().sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,6);
  return `${pageHead('Práctica','Habla, escribe, lee y escucha. Tus sesiones alimentan el progreso y las revisiones.')}
  <div class="practice-grid">${['speaking','writing','reading','listening'].map(skill=>renderPracticeCard(skill)).join('')}</div>
  ${recent.length?`<div class="section-title"><h2>Sesiones recientes</h2></div><section class="card" style="padding:0 16px"><div class="session-list">${recent.map(s=>`<div class="session-row"><div class="practice-icon ${s.skill}" style="width:38px;height:38px;border-radius:12px">${icon(skillIcon[s.skill])}</div><div><strong>${skillNames[s.skill]}${s.topic?` · ${escapeHTML(s.topic)}`:''}</strong><span>${formatDateLong(parseISO(s.date))} · Semana ${s.week}</span></div><div class="session-score">${s.general}/10</div></div>`).join('')}</div></section>`:''}`;
}
function renderPracticeCard(skill){
  const sessions=allSessionsFor(skill), last=sessions[0], avg=sessions.length?Math.round(sessions.slice(0,8).reduce((a,s)=>a+Number(s.general||0),0)/Math.min(8,sessions.length)*10)/10:null;
  return `<section class="card practice-card" onclick="openPractice('${skill}',${currentPlanWeek()})"><div class="practice-icon ${skill}">${icon(skillIcon[skill])}</div><div><h3>${skillNames[skill]}</h3><p>${sessions.length} sesiones${last?` · última ${prettyAgo(parseISO(last.date))}`:''}</p></div><div class="score-badge">${avg?avg.toFixed(1):'＋'}</div></section>`;
}

function renderKnowledge(){
  const q=ui.knowledgeQuery.toLowerCase();
  const filtered=SEED.knowledge.filter(k=>(ui.knowledgeFilter==='all'||k.category.toLowerCase()===ui.knowledgeFilter) && (!q||`${k.name} ${k.description} ${k.id}`.toLowerCase().includes(q)));
  return `${pageHead('Biblioteca','Todo tu conocimiento, separado del calendario semanal.')}
  <div class="card searchbox">${icon('assets/icons/ui/search.svg')}<input placeholder="Buscar tema…" value="${escapeHTML(ui.knowledgeQuery)}" oninput="setKnowledgeQuery(this.value)"></div>
  <div class="filter-row"><button class="chip ${ui.knowledgeFilter==='all'?'active':''}" onclick="setKnowledgeFilter('all')">Todo</button><button class="chip ${ui.knowledgeFilter==='grammar'?'active':''}" onclick="setKnowledgeFilter('grammar')">Grammar</button><button class="chip ${ui.knowledgeFilter==='vocabulary'?'active':''}" onclick="setKnowledgeFilter('vocabulary')">Vocabulary</button><button class="chip ${ui.knowledgeFilter==='pronunciation'?'active':''}" onclick="setKnowledgeFilter('pronunciation')">Pronunciation</button></div>
  <div>${filtered.map(k=>renderKnowledgeRow(k)).join('')}</div>`;
}
function renderKnowledgeRow(k){
  const st=statusFor(k.id), ret=retentionAt(k.id), next=nextScheduledReview(k.id);
  return `<button class="card knowledge-row" style="width:100%;text-align:left;border-color:rgba(114,135,154,.16)" onclick="openKnowledge('${k.id}')"><img class="small-tile" src="${tileIcon[k.category]}" alt=""><div><h3>${escapeHTML(k.name)}</h3><span class="status-pill ${st}">${statusLabel(st)}</span> <span class="muted-small">· W${k.week}</span><div class="muted-small" style="margin-top:4px">${ret===null?`Programado para semana ${k.week}`:next?`Próxima base: ${formatDate(next.due,{day:'numeric',month:'short'})}`:'Ciclo base completado'}</div></div><div class="retention">${ret===null?'—':ret+'%'}</div></button>`;
}

function renderProgress(){
  const days=ui.progressRange==='4w'?28:ui.progressRange==='3m'?90:9999;
  const cutoff=addDays(new Date(),-days);
  const sessions=store.sessions.filter(s=>parseISO(s.date)>=cutoff);
  const learned=SEED.knowledge.filter(k=>isLearned(k.id));
  const skillStats=['speaking','writing','reading','listening'].map(skill=>{
    const ss=sessions.filter(s=>s.skill===skill); return {skill,count:ss.length,avg:ss.length?Math.round(ss.reduce((a,s)=>a+Number(s.general||0),0)/ss.length*10)/10:null};
  });
  const retAvg=learned.length?Math.round(learned.reduce((a,k)=>a+(retentionAt(k.id)||0),0)/learned.length):null;
  return `${pageHead('Progreso','Tu constancia se convierte en datos útiles, sin mezclar habilidades con conocimiento.')}
  <div class="segmented"><button class="segment ${ui.progressRange==='4w'?'active':''}" onclick="setProgressRange('4w')">4 semanas</button><button class="segment ${ui.progressRange==='3m'?'active':''}" onclick="setProgressRange('3m')">3 meses</button><button class="segment ${ui.progressRange==='all'?'active':''}" onclick="setProgressRange('all')">Todo</button></div>
  <div class="skill-summary">${skillStats.map(s=>`<div class="card summary-card"><strong>${s.avg?s.avg.toFixed(1):'—'}</strong><span>${skillNames[s.skill]} · ${s.count} sesiones</span></div>`).join('')}</div>
  <section class="card progress-card"><div class="progress-card-head"><h3>Habilidades</h3><span class="muted-small">Puntuación de sesiones · /10</span></div>${renderSkillsChart(days)}<div class="legend">${[['speaking','var(--coral)'],['writing','var(--petrol-soft)'],['reading','var(--lavender)'],['listening','var(--sage)']].map(([s,c])=>`<span><i style="background:${c}"></i>${skillNames[s]}</span>`).join('')}</div></section>
  <section class="card progress-card"><div class="progress-card-head"><div><h3>Retención de conocimiento</h3><div class="muted-small">Grammar, Vocabulary y Pronunciation aprendidos</div></div><div class="big-stat">${retAvg===null?'—':retAvg+'%'}</div></div>${renderRetentionChart(days)}</section>
  <div class="quote-card">${icon('assets/icons/ui/alera-logo-mark.svg')}La práctica de hoy construye el idioma de mañana.</div>`;
}
function chartPoints(daysCount, count=8){
  const end=startOfDay(new Date()); let start=daysCount>3650?new Date(Math.min(PLAN_START.getTime(),end.getTime())):addDays(end,-daysCount);
  const total=Math.max(1,daysBetween(start,end));
  return Array.from({length:count},(_,i)=>addDays(start,Math.round(total*i/(count-1))));
}
function renderSkillsChart(days){
  if(!store.sessions.length)return `<div class="empty" style="padding:24px 8px">Registra sesiones para ver la evolución.</div>`;
  const pts=chartPoints(days,8), series={speaking:[],writing:[],reading:[],listening:[]};
  pts.forEach((p,i)=>{
    const windowStart=i===0?addDays(p,-7):pts[i-1];
    Object.keys(series).forEach(skill=>{
      const ss=store.sessions.filter(s=>s.skill===skill && parseISO(s.date)>windowStart && parseISO(s.date)<=p);
      const prev=series[skill].length?series[skill][series[skill].length-1].v:null;
      const v=ss.length?ss.reduce((a,s)=>a+Number(s.general),0)/ss.length:prev;
      series[skill].push({d:p,v});
    });
  });
  return svgLineChart(series,0,10,v=>v?.toFixed(1),'score');
}
function renderRetentionChart(days){
  const learned=SEED.knowledge.filter(k=>isLearned(k.id));
  if(!learned.length)return `<div class="empty" style="padding:24px 8px">Marca temas como aprendidos para empezar su curva de retención.</div>`;
  const pts=chartPoints(days,8), vals=pts.map(d=>{
    const active=learned.filter(k=>parseISO(getKState(k.id).learnedAt)<=d); if(!active.length)return null;
    return active.reduce((a,k)=>a+(retentionAt(k.id,d)||0),0)/active.length;
  });
  return svgLineChart({retention:pts.map((d,i)=>({d,v:vals[i]}))},0,100,v=>Math.round(v)+'%','retention');
}
function svgLineChart(series,min,max,fmt,kind){
  const width=640,height=190,padL=34,padR=12,padT=14,padB=30,plotW=width-padL-padR,plotH=height-padT-padB;
  const colors={speaking:'#E08A73',writing:'#A9C2D4',reading:'#9A90B5',listening:'#6F97B3',retention:'#9A90B5'};
  const all=Object.values(series)[0]||[]; const n=Math.max(2,all.length); const x=i=>padL+(i/(n-1))*plotW, y=v=>padT+(max-v)/(max-min)*plotH;
  const grids=[0,.25,.5,.75,1].map(t=>{const yy=padT+plotH*(1-t);return `<line x1="${padL}" y1="${yy}" x2="${width-padR}" y2="${yy}"/><text x="2" y="${yy+4}">${fmt(min+(max-min)*t)}</text>`}).join('');
  const paths=Object.entries(series).map(([name,arr])=>{
    let d='',started=false; arr.forEach((p,i)=>{if(p.v==null)return; d+=`${started?' L':'M'} ${x(i).toFixed(1)} ${y(p.v).toFixed(1)}`;started=true;}); return d?`<path class="chart-line" d="${d}" stroke="${colors[name]||'#4D7898'}"/>`:'';
  }).join('');
  const labels=all.map((p,i)=>(i===0||i===all.length-1||i===Math.floor((all.length-1)/2))?`<text x="${x(i)}" y="${height-7}" text-anchor="middle">${formatDate(p.d,{day:'numeric',month:'short'})}</text>`:'').join('');
  return `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Gráfica de ${kind}"><g class="chart-grid">${grids}</g><g class="chart-axis">${labels}</g>${paths}</svg>`;
}

function renderModal(){
  const root=document.getElementById('modal-root');
  if(!ui.modal){root.innerHTML='';return;}
  if(ui.modal.type==='practice')root.innerHTML=renderPracticeModal();
  else if(ui.modal.type==='review')root.innerHTML=renderReviewModal();
  else if(ui.modal.type==='knowledge')root.innerHTML=renderKnowledgeModal(ui.modal.id);
  else if(ui.modal.type==='weekCategory')root.innerHTML=renderWeekCategoryModal(ui.modal.category,ui.modal.week);
  else if(ui.modal.type==='profile')root.innerHTML=renderProfileModal();
  else if(ui.modal.type==='language')root.innerHTML=renderLanguageModal();
  bindModalSpecials();
}
function modalWrap(inner){ return `<div class="modal-backdrop" onclick="if(event.target===this)closeModal()"><div class="modal"><div class="modal-handle"></div>${inner}</div></div>`; }
function modalHead(title,sub){ return `<div class="modal-head"><div><h2>${title}</h2>${sub?`<p>${sub}</p>`:''}</div><button class="modal-close" onclick="closeModal()">×</button></div>`; }

const skillConfig={
  speaking:{metrics:[['fluency','Fluidez'],['grammar','Grammar'],['vocabulary','Vocabulary'],['pronunciation','Pronunciación'],['comprehension','Comprensión'],['confidence','Confianza']],diffs:[['grammar','Grammar'],['vocabulary','Vocabulary'],['pronunciation','Pronunciación'],['fluency','Fluidez'],['comprehension','Comprensión']]},
  writing:{metrics:[['ease','Facilidad'],['grammar','Grammar'],['vocabulary','Vocabulary'],['structure','Estructura'],['naturalness','Naturalidad'],['clarity','Claridad']],diffs:[['grammar','Grammar'],['vocabulary','Vocabulary'],['structure','Structure'],['findingwords','Finding words'],['naturalness','Naturalness']]},
  reading:{metrics:[['comprehension','Comprensión'],['fluency','Fluidez'],['vocabulary','Vocabulary'],['grammar','Grammar recognition']],diffs:[['vocabulary','Vocabulary'],['grammar','Grammar'],['pronunciation','Pronunciación'],['comprehension','Comprensión']]},
  listening:{metrics:[['comprehension','Comprensión general'],['details','Comprensión de detalles'],['vocabulary','Vocabulary recognition'],['grammar','Grammar recognition'],['speed','Velocidad'],['sounds','Reconocimiento de sonidos']],diffs:[['vocabulary','Vocabulary'],['grammar','Grammar'],['speed','Speed'],['sounds','Sounds'],['accent','Accent'],['details','Details']]},
  pronunciation:{metrics:[['pronunciation','Pronunciación'],['recognition','Reconocimiento']],diffs:[['pronunciation','Pronunciación']]}
};
function renderPracticeModal(){
  const m=ui.modal, skill=m.skill, cfg=skillConfig[skill]||skillConfig.speaking;
  if(m.step===2)return renderPracticeRelations();
  const planned=SEED.weeks.find(w=>w.number===m.week)?.practice?.[skill]||'';
  return modalWrap(`${modalHead(`Sesión de ${skillNames[skill]}`,`Semana ${m.week}${planned?` · ${escapeHTML(planned)}`:''}`)}
    <div class="form-section"><h3>Contexto</h3>
      <div class="field"><label>Tema (opcional)</label><input id="ps-topic" placeholder="Ej. Technology and AI"></div>
      ${skill==='speaking'?`<div class="field"><label>Tipo</label><select id="ps-type"><option>Conversación</option><option>Monólogo</option><option>Clase</option><option>Intercambio</option><option>Examen</option><option>Otro</option></select></div>`:''}
      ${skill==='writing'?`<div class="field"><label>Tipo de texto</label><select id="ps-type"><option>Essay</option><option>Article</option><option>Email</option><option>Review</option><option>Report</option><option>Diary</option><option>Other</option></select></div><div class="field"><label>Número de palabras (opcional)</label><input id="ps-amount" type="number" min="0" inputmode="numeric"></div>`:''}
      ${skill==='reading'?`<div class="field"><label>Modo de lectura</label><select id="ps-mode" onchange="toggleReadingMode(this.value)"><option value="silent">En silencio</option><option value="aloud">En voz alta</option></select></div><div class="field"><label>Tipo</label><select id="ps-type"><option>Book</option><option>Article</option><option>News</option><option>Exam</option><option>Study material</option><option>Other</option></select></div><div class="field"><label>Comprensión sin ayuda</label><select id="ps-understanding"><option value="lt50">Menos del 50%</option><option value="50-70">50–70%</option><option value="70-90" selected>70–90%</option><option value="gt90">Más del 90%</option></select></div><div class="field"><label>Ayuda utilizada</label><select id="ps-support"><option>Nada</option><option>Diccionario</option><option>Traductor</option><option>Notas</option><option>Varias cosas</option></select></div>`:''}
      ${skill==='listening'?`<div class="field"><label>Tipo de contenido</label><select id="ps-type"><option>Podcast</option><option>Series / film</option><option>YouTube</option><option>Course audio</option><option>Conversation</option><option>Exam</option><option>Other</option></select></div><div class="field"><label>Apoyo utilizado</label><select id="ps-support"><option value="none">Sin apoyo</option><option value="english">Subtítulos en inglés</option><option value="transcript">Transcript</option><option value="translation">Subtítulos en mi idioma</option></select></div><div class="field"><label>Dificultad del contenido</label><select id="ps-content-difficulty"><option>Fácil</option><option selected>Adecuada</option><option>Difícil</option></select></div>`:''}
      <div class="field"><label>Duración (minutos, opcional)</label><input id="ps-duration" type="number" min="0" inputmode="numeric" placeholder="20"></div>
    </div>
    <div class="form-section"><h3>Valoración general · <span id="general-out">7/10</span></h3><input id="ps-general" type="range" min="1" max="10" value="7" style="width:100%;accent-color:var(--petrol)" oninput="document.getElementById('general-out').textContent=this.value+'/10'"></div>
    <div class="form-section"><h3>Tu rendimiento</h3>${cfg.metrics.map(([key,label])=>metricInput(key,label,7)).join('')}<div id="reading-pronunciation-slot"></div></div>
    <div class="form-section"><h3>¿Qué te ha costado?</h3><div class="difficulty-chips">${cfg.diffs.map(([k,l])=>`<button class="difficulty-chip ${skill==='reading'&&k==='pronunciation'?'reading-pron-diff':''}" ${skill==='reading'&&k==='pronunciation'?'style="display:none"':''} data-diff="${k}" onclick="toggleDifficulty(this)">${l}</button>`).join('')}<button class="difficulty-chip none" data-diff="none" onclick="toggleDifficulty(this)">Ninguno</button></div></div>
    <div class="form-actions"><button class="secondary-btn" onclick="closeModal()">Cancelar</button><button class="primary-btn" onclick="practiceNext()">Guardar sesión</button></div>`);
}
function metricInput(key,label,v){ return `<div class="metric-row" data-metric-row="${key}"><label>${label}</label><input id="metric-${key}" type="range" min="1" max="10" value="${v}" oninput="document.getElementById('out-${key}').textContent=this.value+'/10'"><span class="metric-score" id="out-${key}">${v}/10</span></div>`; }
function toggleReadingMode(value){ const slot=document.getElementById('reading-pronunciation-slot'); if(slot)slot.innerHTML=value==='aloud'?metricInput('pronunciation','Pronunciación',7):''; const chip=document.querySelector('.reading-pron-diff'); if(chip){chip.style.display=value==='aloud'?'':'none'; if(value!=='aloud')chip.classList.remove('selected');} }
function toggleDifficulty(btn){
  const all=[...document.querySelectorAll('.difficulty-chip')];
  if(btn.dataset.diff==='none'){ all.forEach(x=>x.classList.remove('selected')); btn.classList.add('selected'); return; }
  document.querySelector('.difficulty-chip.none')?.classList.remove('selected'); btn.classList.toggle('selected');
}
function collectPracticeStep1(){
  const skill=ui.modal.skill,cfg=skillConfig[skill];
  const metrics={}; cfg.metrics.forEach(([k])=>{const e=document.getElementById(`metric-${k}`);if(e)metrics[k]=Number(e.value);});
  const p=document.getElementById('metric-pronunciation'); if(p)metrics.pronunciation=Number(p.value);
  const diffs=[...document.querySelectorAll('.difficulty-chip.selected')].map(b=>b.dataset.diff).filter(x=>x!=='none');
  return {skill,week:ui.modal.week,topic:document.getElementById('ps-topic')?.value.trim()||'',type:document.getElementById('ps-type')?.value||'',duration:Number(document.getElementById('ps-duration')?.value||0)||null,amount:Number(document.getElementById('ps-amount')?.value||0)||null,mode:document.getElementById('ps-mode')?.value||null,understanding:document.getElementById('ps-understanding')?.value||null,support:document.getElementById('ps-support')?.value||null,contentDifficulty:document.getElementById('ps-content-difficulty')?.value||null,general:Number(document.getElementById('ps-general').value),metrics,diffKeys:diffs};
}
function renderPracticeRelations(){
  const d=ui.practiceDraft;
  return modalWrap(`${modalHead('Relacionar dificultades','Esto ayuda a Alera a priorizar revisiones sin alterar el calendario base.')}
  ${d.diffKeys.map(k=>renderRelationCard(k)).join('')}
  <div class="form-section"><div class="field"><label>Nota de la sesión (opcional)</label><textarea id="ps-notes" placeholder="Algo que quieras recordar…"></textarea></div></div>
  <div class="form-actions"><button class="secondary-btn" onclick="practiceBack()">Atrás</button><button class="primary-btn" onclick="savePractice()">Guardar</button></div>`);
}
function relationCategory(diff){ if(diff==='grammar')return 'Grammar'; if(diff==='vocabulary'||diff==='findingwords')return 'Vocabulary'; if(diff==='pronunciation'||diff==='sounds')return 'Pronunciation'; return null; }
function renderRelationCard(diff){
  const cat=relationCategory(diff), options=cat?SEED.knowledge.filter(k=>k.category===cat):[];
  return `<section class="card relation-card"><h4>${escapeHTML(diffLabel(diff))}</h4>${cat?`<div class="field"><label>Knowledge relacionado (opcional)</label><select id="rel-${diff}"><option value="">No estoy seguro</option>${options.map(k=>`<option value="${k.id}">${isLearned(k.id)?'✓':'W'+k.week} · ${escapeHTML(k.name)}</option>`).join('')}</select></div>`:''}<div class="severity" data-severity-group="${diff}"><button onclick="setSeverity('${diff}','small',this)">Pequeño</button><button class="active" onclick="setSeverity('${diff}','moderate',this)">Moderado</button><button onclick="setSeverity('${diff}','important',this)">Importante</button></div><div class="field" style="margin-top:9px"><label>Detalle (opcional)</label><input id="note-${diff}" placeholder="Ej. would have / mixed conditionals"></div></section>`;
}
function diffLabel(k){ return ({grammar:'Grammar',vocabulary:'Vocabulary',pronunciation:'Pronunciación',fluency:'Fluidez',comprehension:'Comprensión',structure:'Estructura',findingwords:'Encontrar palabras',naturalness:'Naturalidad',speed:'Velocidad',sounds:'Reconocimiento de sonidos',accent:'Acento',details:'Detalles'})[k]||k; }
function setSeverity(diff,val,btn){ const g=document.querySelector(`[data-severity-group="${diff}"]`);g?.querySelectorAll('button').forEach(b=>b.classList.remove('active'));btn.classList.add('active');g.dataset.value=val; }
function practiceNext(){
  ui.practiceDraft=collectPracticeStep1();
  if(!ui.practiceDraft.diffKeys.length){ savePractice(true); return; }
  ui.modal.step=2; renderModal();
}
function practiceBack(){ ui.modal.step=1; renderModal(); }
function savePractice(noDiff=false){
  const d=ui.practiceDraft||collectPracticeStep1();
  const difficulties=[];
  if(!noDiff) d.diffKeys.forEach(diff=>{
    const group=document.querySelector(`[data-severity-group="${diff}"]`); const activeText=group?.querySelector('.active')?.textContent?.toLowerCase()||''; const severity=group?.dataset.value || (activeText==='importante'?'important':activeText==='pequeño'?'small':'moderate');
    difficulties.push({category:diff,severity,knowledgeId:document.getElementById(`rel-${diff}`)?.value||null,note:document.getElementById(`note-${diff}`)?.value.trim()||''});
  });
  const session={id:uid('session'),date:isoNow(),...d,difficulties,notes:document.getElementById('ps-notes')?.value.trim()||''}; delete session.diffKeys;
  store.sessions.push(session);
  saveStore();
  difficulties.filter(x=>x.knowledgeId).forEach(x=>{ if(isLearned(x.knowledgeId)&&difficultyScore(x.knowledgeId)>=3) ensureReinforcement(x.knowledgeId,`Dificultades recientes en ${skillNames[d.skill]}`,new Date()); });
  saveStore(); ui.modal=null; ui.practiceDraft=null; render(); toast(`Sesión de ${skillNames[d.skill]} guardada`);
}

function renderReviewModal(){
  const k=knowledgeById[ui.modal.id], kind=ui.modal.kind, next=nextScheduledReview(k.id), rein=pendingReinforcement(k.id);
  return modalWrap(`${modalHead(`Revisar · ${escapeHTML(k.name)}`,kind==='reinforcement'?'Refuerzo por dificultades recientes':`Calendario base${next?` · +${next.offset} días desde que lo aprendiste`:''}`)}
    <section class="card detail-hero"><div class="detail-title"><img class="tile-icon" src="${tileIcon[k.category]}" alt=""><div><h2>${escapeHTML(k.name)}</h2><div class="subtitle">${escapeHTML(k.description)}</div></div></div></section>
    <div class="form-section"><h3>Cuando termines, ¿cómo ha ido?</h3><div class="review-rating">
      <button onclick="completeReview('${k.id}','${kind}','forgot')"><strong>No lo recordaba</strong><span>Se añadirá un refuerzo; las fechas base no cambian.</span></button>
      <button onclick="completeReview('${k.id}','${kind}','hard')"><strong>Me ha costado</strong><span>Se añadirá un refuerzo; las fechas base no cambian.</span></button>
      <button onclick="completeReview('${k.id}','${kind}','good')"><strong>Bien</strong><span>La próxima revisión seguirá anclada a la fecha original.</span></button>
      <button onclick="completeReview('${k.id}','${kind}','easy')"><strong>Muy fácil</strong><span>Queda registrado como una revisión muy sólida.</span></button>
    </div></div>
    ${rein&&kind==='reinforcement'?`<p class="fineprint">Motivo del refuerzo: ${escapeHTML(rein.reason)}</p>`:''}`);
}
function completeReview(id,kind,result){
  const now=new Date(), event={id:uid('review'),knowledgeId:id,date:isoNow(),kind,result,coveredSlots:[]};
  if(kind==='scheduled'){
    const learned=parseISO(getKState(id).learnedAt), covered=coveredSlots(id), cutoff=endOfWeek(now);
    REVIEW_OFFSETS.forEach((off,i)=>{if(!covered.has(i)&&addDays(learned,off)<=cutoff)event.coveredSlots.push(i);});
    if(!event.coveredSlots.length){const n=nextScheduledReview(id);if(n)event.coveredSlots=[n.slot];}
    store.reinforcements.filter(r=>r.knowledgeId===id&&!r.completedAt).forEach(r=>r.completedAt=isoNow());
  } else {
    const r=pendingReinforcement(id); if(r)r.completedAt=isoNow();
  }
  store.reviewEvents.push(event);
  if(result==='forgot'||result==='hard')ensureReinforcement(id,result==='forgot'?'No lo recordabas en la revisión':'La revisión costó más de lo esperado',addDays(now,7));
  saveStore(); ui.modal=null; render(); toast('Revisión guardada · el calendario base no se ha movido');
}

function renderKnowledgeModal(id){
  const k=knowledgeById[id], st=getKState(id), learned=isLearned(id), ret=retentionAt(id), next=nextScheduledReview(id), status=statusFor(id);
  const histories=[];
  if(learned) histories.push({date:st.learnedAt,text:'Aprendido por primera vez',score:''});
  store.reviewEvents.filter(e=>e.knowledgeId===id).forEach(e=>histories.push({date:e.date,text:`Review · ${reviewResultLabel(e.result)}${e.kind==='reinforcement'?' · refuerzo':''}`,score:e.result==='easy'?'Muy fácil':e.result==='good'?'Bien':''}));
  store.sessions.forEach(s=>(s.difficulties||[]).filter(d=>d.knowledgeId===id).forEach(d=>histories.push({date:s.date,text:`${skillNames[s.skill]} · dificultad ${severityLabel(d.severity)}`,score:d.note||''})));
  histories.sort((a,b)=>new Date(b.date)-new Date(a.date));
  return modalWrap(`${modalHead(escapeHTML(k.name),`${k.id} · ${k.category} · Semana ${k.week}`)}
    <section class="card detail-hero"><div class="detail-title"><img class="tile-icon" src="${tileIcon[k.category]}" alt=""><div><h2>${escapeHTML(k.name)}</h2><div class="subtitle">${escapeHTML(k.description)}</div></div></div>
      <div class="detail-grid"><div class="detail-stat"><span>Estado</span><strong>${statusLabel(status)}</strong></div><div class="detail-stat"><span>Primera vez</span><strong>${learned?formatDateLong(parseISO(st.learnedAt)):`Semana ${k.week}`}</strong></div><div class="detail-stat"><span>Próxima base</span><strong>${next?formatDateLong(next.due):learned?'Ciclo completado':'—'}</strong></div><div class="detail-stat"><span>Uso práctico</span><strong>${allDifficultyCount(id)} dificultades</strong></div></div>
    </section>
    ${learned?`<section class="card progress-card" style="margin-top:12px"><div class="progress-card-head"><h3>Tu retención</h3><div class="big-stat">${ret}%</div></div>${renderSingleRetentionChart(id)}</section>`:`<button class="primary-btn" style="margin-top:12px" onclick="markKnowledge('${id}')">Marcar como aprendido</button>`}
    <section class="card" style="padding:14px;margin-top:12px"><h3 style="margin:0 0 8px">Por qué está aquí</h3><p class="subtitle" style="line-height:1.5">${escapeHTML(k.reason)}</p>${k.prerequisites.length?`<p class="fineprint"><strong>Previos:</strong> ${k.prerequisites.map(p=>escapeHTML(knowledgeById[p]?.name||p)).join(' · ')}</p>`:''}</section>
    ${histories.length?`<section class="card" style="padding:14px;margin-top:12px"><h3 style="margin:0 0 8px">Historial</h3><div class="history-list">${histories.slice(0,12).map(h=>`<div class="history-row"><time>${formatDate(parseISO(h.date),{day:'numeric',month:'short',year:'2-digit'})}</time><span>${escapeHTML(h.text)}</span><span>${escapeHTML(h.score)}</span></div>`).join('')}</div></section>`:''}`);
}
function renderSingleRetentionChart(id){
  const learned=parseISO(getKState(id).learnedAt), end=new Date(), days=Math.max(7,daysBetween(learned,end));
  const pts=Array.from({length:8},(_,i)=>addDays(learned,Math.round(days*i/7))), vals=pts.map(d=>retentionAt(id,d));
  return svgLineChart({retention:pts.map((d,i)=>({d,v:vals[i]}))},0,100,v=>Math.round(v)+'%','retention');
}
function reviewResultLabel(r){return ({forgot:'No lo recordaba',hard:'Me ha costado',good:'Bien',easy:'Muy fácil'})[r]||r;}
function severityLabel(s){return ({small:'pequeña',moderate:'moderada',important:'importante'})[s]||s;}

function renderWeekCategoryModal(category,week){
  const items=plannedItems(week).filter(k=>k.category===category);
  const label=category==='Pronunciation'?'Pronunciación':category;
  return modalWrap(`${modalHead(`${label} · Semana ${week}`,`${items.filter(k=>isLearned(k.id)).length}/${items.length} completados`)}
    <div class="week-category-list">${items.map(k=>`<section class="card week-category-item"><div class="week-category-top"><button class="check ${isLearned(k.id)?'done':''}" aria-label="${isLearned(k.id)?'Desmarcar como aprendido':'Marcar como aprendido'}" onclick="markKnowledge('${k.id}',true)"></button><div><h3>${escapeHTML(k.name)}</h3><p>${escapeHTML(k.description)}</p></div></div><div class="week-category-actions"><span class="muted-small">${escapeHTML(k.reason)}</span><button class="link-btn" onclick="openKnowledge('${k.id}')">Ver detalle →</button></div></section>`).join('')}</div>`);
}

function renderProfileModal(){
  const p=store.profile;
  return modalWrap(`<div class="profile-sheet">${modalHead('Perfil local','Tus datos no salen de este dispositivo.')}
    <div class="profile-photo" id="profile-preview">${p.photo?`<img src="${p.photo}" alt="Foto de perfil">`:escapeHTML(initials(p.name))}</div>
    <div class="field" style="text-align:left"><label>Nombre</label><input id="profile-name" value="${escapeHTML(p.name)}"></div>
    <div class="field" style="text-align:left"><label>Foto</label><input id="profile-photo-input" type="file" accept="image/*"></div>
    <div class="field" style="text-align:left"><label>Idioma y nivel</label><input value="English · ${escapeHTML(p.level)}" disabled></div>
    <button class="primary-btn" onclick="saveProfile()">Guardar perfil</button>
    <div class="section-title"><h2>Datos</h2></div><div class="settings-list">
      ${installPrompt?`<button class="settings-action" onclick="installApp()"><span>Instalar Alera como app</span><span>＋</span></button>`:''}
      <button class="settings-action" onclick="exportData()"><span>Exportar copia de seguridad</span><span>↓</span></button>
      <button class="settings-action" onclick="document.getElementById('import-data').click()"><span>Importar copia de seguridad</span><span>↑</span></button><input id="import-data" type="file" accept="application/json" style="display:none">
      <button class="settings-action danger" onclick="resetAlera()"><span>Borrar todos los datos locales</span><span>×</span></button>
    </div><p class="fineprint" style="margin-top:14px;text-align:left">Alera usa localStorage. Si borras los datos del navegador sin exportar una copia, el progreso no se puede recuperar.</p>
  </div>`);
}
function renderLanguageModal(){ return modalWrap(`${modalHead('English · '+escapeHTML(store.profile.level),'Perfil de idioma actual')}<section class="card" style="padding:16px"><p style="margin-top:0">Esta versión está configurada únicamente para <strong>English</strong>. La estructura interna ya separa el perfil de idioma para poder añadir otros más adelante.</p><p class="fineprint">Plan actual: B2 · 21/09/2026–31/01/2027 · 19 semanas.</p></section>`); }
function bindModalSpecials(){
  const pInput=document.getElementById('profile-photo-input'); if(pInput&&!pInput.dataset.bound){pInput.dataset.bound='1';pInput.addEventListener('change',e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=()=>{pInput.dataset.photo=r.result;document.getElementById('profile-preview').innerHTML=`<img src="${r.result}" alt="Foto de perfil">`;};r.readAsDataURL(f);});}
  const imp=document.getElementById('import-data'); if(imp&&!imp.dataset.bound){imp.dataset.bound='1';imp.addEventListener('change',importDataFile);}
}
function saveProfile(){ const name=document.getElementById('profile-name').value.trim();if(!name)return;const input=document.getElementById('profile-photo-input');store.profile.name=name;if(input?.dataset.photo)store.profile.photo=input.dataset.photo;saveStore();closeModal();render();toast('Perfil guardado'); }
function exportData(){ const blob=new Blob([JSON.stringify(store,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`alera-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000); }
function importDataFile(e){ const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const data=JSON.parse(r.result);if(!data.profile||!Array.isArray(data.sessions))throw new Error('Formato no válido');store={...freshStore(),...data};saveStore();ui.modal=null;render();toast('Copia importada');}catch(err){alert('No se ha podido importar esta copia.');}};r.readAsText(f); }
function resetAlera(){ if(!confirm('¿Borrar perfil, progreso, sesiones y revisiones de este dispositivo?'))return;localStorage.removeItem(STORE_KEY);store=freshStore();ui.modal=null;render(); }

function toast(msg){ const root=document.getElementById('toast-root');root.innerHTML=`<div class="toast">${escapeHTML(msg)}</div>`;setTimeout(()=>{root.innerHTML='';},2800); }

// Global UI actions
window.setView=v=>{ui.view=v;ui.modal=null;render();window.scrollTo(0,0);};
window.setWeek=n=>{ui.week=clamp(Number(n),1,19);render();window.scrollTo(0,0);};
window.setReviewFilter=f=>{ui.reviewFilter=f;render();};
window.setKnowledgeFilter=f=>{ui.knowledgeFilter=f;render();};
window.setKnowledgeQuery=v=>{ui.knowledgeQuery=v; const pos=document.activeElement?.selectionStart; render(); const inp=document.querySelector('.searchbox input');if(inp){inp.focus();try{inp.setSelectionRange(pos,pos);}catch(e){}}};
window.setProgressRange=r=>{ui.progressRange=r;render();};
window.openPractice=(skill,week)=>{ui.modal={type:'practice',skill,week:Number(week)||currentPlanWeek(),step:1};ui.practiceDraft=null;renderModal();};
window.openReview=(id,kind)=>{ui.modal={type:'review',id,kind};renderModal();};
window.openKnowledge=id=>{ui.modal={type:'knowledge',id};renderModal();};
window.openWeekCategory=(category,week)=>{ui.modal={type:'weekCategory',category,week:Number(week)};renderModal();};
window.openProfile=()=>{ui.modal={type:'profile'};renderModal();};
window.openLanguageInfo=()=>{ui.modal={type:'language'};renderModal();};
window.closeModal=()=>{ui.modal=null;ui.practiceDraft=null;renderModal();};
window.markKnowledge=(id,keepModal=false)=>{
  if(isLearned(id)){
    getKState(id).learnedAt=null;
    store.reviewEvents=store.reviewEvents.filter(e=>e.knowledgeId!==id);
    store.reinforcements=store.reinforcements.filter(r=>r.knowledgeId!==id);
    saveStore();
    render();
    toast(`${knowledgeById[id].name} · vuelve a pendiente`);
    return;
  }
  getKState(id).learnedAt=isoNow();
  saveStore();
  render();
  toast(`${knowledgeById[id].name} · empieza su curva de revisión`);
};
window.toggleReadingMode=toggleReadingMode;window.toggleDifficulty=toggleDifficulty;window.practiceNext=practiceNext;window.practiceBack=practiceBack;window.savePractice=savePractice;window.setSeverity=setSeverity;window.completeReview=completeReview;window.saveProfile=saveProfile;window.exportData=exportData;window.resetAlera=resetAlera;
window.installApp=async()=>{if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;ui.modal=null;render();};

window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;});
window.addEventListener('appinstalled',()=>{installPrompt=null;toast('Alera instalada');});
if('serviceWorker' in navigator && location.protocol!=='file:') window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
render();
})();
