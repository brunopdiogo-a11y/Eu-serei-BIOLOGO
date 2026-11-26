import {courses} from './data.js';
import {readState,writeState,exportState,importState} from './storage.js';
import {renderStudyDashboard} from './home-dashboard.js';
import {initNotesHub} from './notes-hub.js';
let state=readState(),current='home',selectedCourse=courses[0].id;
const $=id=>document.getElementById(id);
const now=()=>new Date();
const today=()=>localDate(now());
const dayMS=86400000;
function localDate(d){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
function toDate(s){if(!s)return null;const x=new Date(s+'T12:00:00');return Number.isNaN(x.getTime())?null:x;}
function daysBetween(a,b){return Math.round((Date.UTC(b.getFullYear(),b.getMonth(),b.getDate())-Date.UTC(a.getFullYear(),a.getMonth(),a.getDate()))/dayMS);}
function formatDate(s){const d=toDate(s);return d?d.toLocaleDateString('pt-BR'):'—';}
function fmtMin(n){n=Math.max(0,Math.round(n));return Math.floor(n/60)+'h '+String(n%60).padStart(2,'0')+'min';}
function formatClock(sec){const h=Math.floor(sec/3600),m=Math.floor(sec%3600/60),s=sec%60;return [h,m,s].map(x=>String(x).padStart(2,'0')).join(':');}
function course(id){return courses.find(c=>c.id===id)||courses[0];}
function sessionsFor(id){return state.sessions.filter(x=>!id||x.courseId===id);}
function studiedMinutes(id,start){return sessionsFor(id).filter(s=>!start||s.date>=start).reduce((sum,s)=>sum+Number(s.minutes||0),0);}
function countDone(id){const c=course(id);let count=0;for(let i=1;i<=c.lessons;i++)if(state.completed[id+':'+i])count++;return count;}
function notify(text){const t=$('toast');t.textContent=text;t.style.display='block';clearTimeout(notify.timeout);notify.timeout=setTimeout(()=>t.style.display='none',3000);}
function save(){state=writeState(state);render();scheduleCloudSync();}
let notesHub=null;
const floatingNotes=$('view-notes'),notesHandle=$('notes-float-handle');
const notesMinimize=$('notes-float-minimize'),notesClose=$('notes-float-close');
let notesDrag=null;
function openFloatingNotes(){
 floatingNotes.classList.add('notes-float-open');
 floatingNotes.classList.remove('notes-float-minimized');
 notesMinimize.textContent='−';
 notesHub?.render();
}
function closeFloatingNotes(){
 // Ocultar não apaga o rascunho nem força mudança de tela.
 floatingNotes.classList.remove('notes-float-open','notes-float-minimized');
}
notesClose.addEventListener('click',closeFloatingNotes);
notesMinimize.addEventListener('click',()=>{
 const minimized=floatingNotes.classList.toggle('notes-float-minimized');
 notesMinimize.textContent=minimized?'▢':'−';
 notesMinimize.setAttribute('aria-label',minimized?'Expandir caderno':'Recolher caderno');
});
notesHandle.addEventListener('pointerdown',event=>{
 if(event.button!==0||event.target.closest('button'))return;
 const rect=floatingNotes.getBoundingClientRect();
 notesDrag={id:event.pointerId,dx:event.clientX-rect.left,dy:event.clientY-rect.top};
 notesHandle.setPointerCapture(event.pointerId);
 event.preventDefault();
});
notesHandle.addEventListener('pointermove',event=>{
 if(!notesDrag||event.pointerId!==notesDrag.id)return;
 const x=Math.max(0,Math.min(innerWidth-floatingNotes.offsetWidth,event.clientX-notesDrag.dx));
 const y=Math.max(0,Math.min(innerHeight-Math.min(floatingNotes.offsetHeight,50),event.clientY-notesDrag.dy));
 floatingNotes.style.left=x+'px';floatingNotes.style.top=y+'px';
 floatingNotes.style.right='auto';floatingNotes.style.bottom='auto';
});
const stopNotesDrag=()=>{notesDrag=null};
notesHandle.addEventListener('pointerup',stopNotesDrag);
notesHandle.addEventListener('pointercancel',stopNotesDrag);
window.addEventListener('resize',()=>{
 if(!floatingNotes.classList.contains('notes-float-open'))return;
 const rect=floatingNotes.getBoundingClientRect();
 if(rect.right>innerWidth)floatingNotes.style.left=Math.max(0,innerWidth-rect.width)+'px';
 if(rect.top>innerHeight-50)floatingNotes.style.top=Math.max(0,innerHeight-50)+'px';
});
function navigate(view){
 if(view==='notes'){openFloatingNotes();return}
 if(!$('view-'+view))view='home';
 current=view;
 document.querySelectorAll('.view').forEach(x=>x.classList.toggle('visible',x.id==='view-'+view));
 document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('selected',b.dataset.view===view));
 window.scrollTo({top:0,behavior:'instant'});
 if(view==='planning')fillPlan();
 render();
}
document.querySelectorAll('[data-view]').forEach(el=>el.addEventListener('click',()=>navigate(el.dataset.view)));
$('settings-button').addEventListener('click',()=>navigate('settings'));

/* O material completo fica fora do repositório público. Este painel lê apenas o progresso
   do estudo quando a página da disciplina roda na MESMA origem. */
function ecologyCompletedStages(){
 try{const saved=JSON.parse(localStorage.getItem('ecologia-vegetal-estudos-v1')||'null');return saved?.complete&&typeof saved.complete==='object'?saved.complete:{};}catch{return {};}
}
function ecologyStageProgress(){
 const done=ecologyCompletedStages(),out=[0,0,0,0,0,0];
 for(const [key,val] of Object.entries(done)){
  const match=/^e([1-6])_\d+$/.exec(key);
  if(match&&val)out[Number(match[1])-1]++;
 }
 return out;
}
function completedStagesFor(c){return c.id==='ecologia-vegetal'?ecologyStageProgress().reduce((a,b)=>a+b,0):0;}
function completedLessonsFor(c){
 if(c.id!=='ecologia-vegetal'||!c.stagesPerLesson)return countDone(c.id);
 const byLesson=ecologyStageProgress();
 return byLesson.filter((n,i)=>n>=c.stagesPerLesson[i]).length;
}
function remainingGoals(c,p){
 const goal=Math.min(c.lessons,Number(p.lessonGoal)||c.lessons),doneLessons=completedLessonsFor(c);
 const remainingLessons=Math.max(0,goal-doneLessons);
 if(!c.stagesPerLesson)return {remainingLessons,remainingStages:null,doneStages:null,totalStages:null};
 const completed=ecologyStageProgress();let stagesRemaining=0,goalStages=0;
 for(let i=0;i<goal;i++){goalStages+=c.stagesPerLesson[i];stagesRemaining+=Math.max(0,c.stagesPerLesson[i]-completed[i]);}
 return {remainingLessons,remainingStages:stagesRemaining,doneStages:goalStages-stagesRemaining,totalStages:goalStages};
}
function dailyTarget(c,p){
 const rem=remainingGoals(c,p),end=toDate(p.end),start=toDate(p.start),current=toDate(today());
 if(!end||!start||end<start)return {...rem,availableDays:0,daysLeft:0,lessonsPerDay:0,stagesPerDay:0,late:true};
 // Hoje conta como dia disponível; dias corridos sem ajuste por frequência semanal.
 const availableDays=Math.max(0,daysBetween(current,end)+1);
 return {...rem,availableDays,daysLeft:Math.max(0,daysBetween(current,end)),
  lessonsPerDay:availableDays?Math.ceil(rem.remainingLessons/availableDays):rem.remainingLessons,
  stagesPerDay:rem.remainingStages===null?null:availableDays?Math.ceil(rem.remainingStages/availableDays):rem.remainingStages,
  late:availableDays===0};
}

function planSummary(c){
 const isStages=!!c.stagesPerLesson;
 const actualProgress=isStages?completedStagesFor(c):completedLessonsFor(c);
 const p=state.plans[c.id];if(!p)return {label:'Sem planejamento',kind:'neutral',expected:0,actual:actualProgress,remaining:null};
 const start=toDate(p.start),end=toDate(p.end),date=toDate(today());
 if(!start||!end||end<start)return {label:'Verifique as datas',kind:'attention',expected:0,actual:actualProgress,remaining:null};
 const total=Math.max(1,daysBetween(start,end)+1),elapsed=Math.max(0,Math.min(total,daysBetween(start,date)+1));
 const goalLessons=Math.max(1,Math.min(c.lessons,Number(p.lessonGoal)||c.lessons));
 const goal=isStages?c.stagesPerLesson.slice(0,goalLessons).reduce((a,b)=>a+b,0):goalLessons;
 const expected=Math.min(goal,Math.floor(goal*elapsed/total));
 const actual=actualProgress;
 const left=daysBetween(date,end);
 let label='Em dia',kind='good';
 if(left<0&&actual<goal){label='Prazo encerrado';kind='urgent';}
 else if(left<=2&&actual<goal){label='Prazo próximo';kind='urgent';}
 else if(actual<expected){label='Abaixo do ritmo';kind='attention';}
 else if(elapsed===0){label='Ainda não iniciado';kind='neutral';}
 return {label,kind,expected,actual,remaining:left};
}
function getAlerts(){
 const alerts=[];
 Object.keys(state.plans).forEach(id=>{
 const c=courses.find(x=>x.id===id);if(!c)return;
 const p=state.plans[id],s=planSummary(c);
 if(s.kind==='urgent')alerts.push({kind:'urgent',icon:'🔴',title:c.title+': '+s.label,desc:'Prazo: '+formatDate(p.end)+'. Abra o planejamento para ajustar suas metas.'});
 else if(s.kind==='attention')alerts.push({kind:'attention',icon:'🟡',title:c.title+': ritmo de estudo',desc:'Você concluiu '+s.actual+' etapa(s); o ritmo estimado até hoje seria '+s.expected+'.'});
 else if(s.kind==='good')alerts.push({kind:'good',icon:'✅',title:c.title+': planejamento em dia',desc:'Seu ritmo está adequado ao planejamento atual.'});
 });
 for(const c of courses){
  const plan=state.plans[c.id];if(!plan)continue;
  const daily=dailyTarget(c,plan);
  if(daily.late||!daily.remainingLessons&&!daily.remainingStages)continue;
  const amount=daily.remainingStages===null?daily.lessonsPerDay+' aula(s)':daily.stagesPerDay+' etapa(s)';
  alerts.push({kind:'neutral',icon:'📖',title:'Meta diária · '+c.title,desc:daily.availableDays+' dia(s) até o prazo, incluindo hoje · aproximadamente '+amount+' por dia.'});
 }
 if(!Object.keys(state.plans).length)alerts.push({kind:'neutral',icon:'🌱',title:'Vamos organizar sua primeira matéria?',desc:'Defina as datas de Ecologia Vegetal em Meu Planejamento.'});
 return alerts.sort((a,b)=>({urgent:0,attention:1,neutral:2,good:3}[a.kind]-{urgent:0,attention:1,neutral:2,good:3}[b.kind]));
}
function renderHome(){
 renderStudyDashboard($('home-dashboard'),$('home-dashboard-dots'),{courses,plans:state.plans,sessions:state.sessions,completedStages:completedStagesFor,completedLessons:completedLessonsFor,today:today()});
 const box=$('home-alerts');box.replaceChildren();if(!state.preferences.inAppAlerts){box.textContent='Os avisos estão desativados em Configurações.';return;}
 getAlerts().slice(0,3).forEach(a=>{const item=document.createElement('article');item.className='notice '+a.kind;const ico=document.createElement('span');ico.className='notice-icon';ico.textContent=a.icon;const info=document.createElement('div');const strong=document.createElement('strong');strong.textContent=a.title;const p=document.createElement('p');p.textContent=a.desc;info.append(strong,p);item.append(ico,info);box.append(item);});}
function renderCourses(){
 const root=$('course-cards');root.replaceChildren();
 courses.forEach(c=>{const count=c.stagesPerLesson?completedStagesFor(c):completedLessonsFor(c),total=c.stagesPerLesson?c.stagesPerLesson.reduce((a,b)=>a+b,0):c.lessons,card=document.createElement('button');card.className='course-card';const icon=document.createElement('span');icon.className='emoji';icon.textContent=c.icon;const name=document.createElement('strong');name.textContent=c.title;const subtitle=document.createElement('small');subtitle.textContent=c.subtitle;const meter=document.createElement('div');meter.className='meter';const progress=document.createElement('i');progress.style.width=(count/total*100)+'%';meter.append(progress);const number=document.createElement('small');number.textContent=count+' de '+total+' '+(c.stagesPerLesson?'etapas':'aulas')+' concluídas';card.append(icon,name,subtitle,meter,number);card.addEventListener('click',()=>showCourse(c));root.append(card);});
}
function showCourse(c){
 selectedCourse=c.id;
 const detail=$('course-detail');detail.classList.remove('hidden');detail.replaceChildren();
 const title=document.createElement('h2');title.textContent=c.icon+' '+c.title;detail.append(title);
 const intro=document.createElement('p');intro.className='muted';
 intro.textContent='Importe o HTML completo uma vez. Com o Google Drive conectado, o material será sincronizado entre seus dispositivos. O progresso permanece separado.';detail.append(intro);
 const status=document.createElement('p');status.className='feedback';status.textContent='Verificando biblioteca privada…';detail.append(status);
 const box=document.createElement('div');box.className='button-row';
 const open=document.createElement('button');open.className='btn primary';open.textContent='📖 Abrir '+c.title;open.disabled=true;
 open.addEventListener('click',()=>location.href='./ecologia-privada.html?course='+encodeURIComponent(c.id));
 const label=document.createElement('label');label.className='btn secondary file-label';label.textContent='⬆ Importar HTML completo';
 const input=document.createElement('input');input.type='file';input.accept='.html,text/html';input.hidden=true;label.append(input);
 input.addEventListener('change',async()=>{
  const file=input.files?.[0];if(!file)return;input.disabled=true;
  status.textContent='Importando material…';
  try{const mod=await import('./private-library.js');await mod.saveMaterial(c.id,file,c.title);open.disabled=false;status.textContent='✅ Material salvo neste dispositivo. Aguardando sincronização com o Drive.';scheduleCloudSync(500);}
  catch(err){status.textContent='⚠️ '+err.message;}
  finally{input.value='';input.disabled=false;}
 });
 const plan=document.createElement('button');plan.className='btn ghost';plan.textContent='📅 Ver metas diárias';plan.addEventListener('click',()=>{navigate('planning');$('plan-course').value=c.id;fillPlan();});
 box.append(open,label,plan);detail.append(box);
 import('./private-library.js').then(m=>m.readMaterial(c.id)).then(entry=>{if(input.disabled)return;open.disabled=!entry;status.textContent=entry?'✅ '+entry.name+(entry.pending?' · aguardando Drive':' · disponível neste dispositivo'):'Importe o HTML ou conecte o Google Drive para recuperar o material.';}).catch(err=>{status.textContent='Biblioteca local indisponível: '+err.message;});
 detail.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function fillSelectors(){['plan-course','session-course'].forEach(id=>{const select=$(id);select.replaceChildren();courses.forEach(c=>{const op=document.createElement('option');op.value=c.id;op.textContent=c.icon+' '+c.title;select.append(op);});});}
function fillPlan(){
 const id=$('plan-course').value||courses[0].id,p=state.plans[id];
 $('plan-start').value=p?.start||today();
 const defaultEnd=new Date();defaultEnd.setDate(defaultEnd.getDate()+29);
 $('plan-end').value=p?.end||localDate(defaultEnd);
 $('plan-minutes').value=p?.minutesPerSession||30;
 $('plan-lessons').value=p?.lessonGoal||course(id).lessons;
}
$('plan-course').addEventListener('change',fillPlan);
$('plan-form').addEventListener('submit',e=>{
 e.preventDefault();const id=$('plan-course').value,start=$('plan-start').value,end=$('plan-end').value,minutes=Number($('plan-minutes').value),goal=Number($('plan-lessons').value);
 if(!start||!end||end<start||!Number.isInteger(minutes)||minutes<5||minutes>240||!Number.isInteger(goal)||goal<1||goal>course(id).lessons){$('plan-feedback').textContent='Verifique as datas, minutos e meta (até '+course(id).lessons+' aulas).';return;}
 state.plans[id]={start,end,minutesPerSession:minutes,lessonGoal:goal,updatedAt:new Date().toISOString()};
 save();$('plan-feedback').textContent='✅ Planejamento salvo para '+course(id).title+'.';notify('Planejamento salvo!');
});
function currentWeekStart(){const d=now();d.setDate(d.getDate()-((d.getDay()+6)%7));return localDate(d);}
function renderPlan(){
 const plans=Object.keys(state.plans).length,week=studiedMinutes(null,currentWeekStart());
 const target=Object.values(state.plans).length;
 $('plan-summary').innerHTML='';
 [['📚 Disciplinas planejadas',String(plans)],['⏱️ Tempo nesta semana',fmtMin(week)],['📅 Planos com prazo definido',String(target)]].forEach(([name,val])=>{const el=document.createElement('div');el.className='metric';const s=document.createElement('small');s.textContent=name;const n=document.createElement('strong');n.textContent=val;el.append(s,n);$('plan-summary').append(el);});
 const list=$('plan-list');list.replaceChildren();
 courses.forEach(c=>{const p=state.plans[c.id],s=planSummary(c),row=document.createElement('div');row.className='plan-row';const top=document.createElement('div'),title=document.createElement('strong'),pill=document.createElement('span');title.textContent=c.icon+' '+c.title;pill.className='status-pill'+(s.kind==='urgent'?' danger':s.kind==='attention'?' warning':'');pill.textContent=s.label;top.append(title,pill);const para=document.createElement('p');para.textContent=p?'De '+formatDate(p.start)+' até '+formatDate(p.end)+' · '+p.minutesPerSession+' min/sessão · '+fmtMin(studiedMinutes(c.id))+' registrados':'Sem meta definida. Selecione esta matéria no formulário acima.';row.append(top,para);if(p){const remaining=daysBetween(toDate(today()),toDate(p.end));const deadline=document.createElement('p');deadline.className='deadline-count';deadline.textContent=remaining<0?'⏰ Prazo vencido há '+Math.abs(remaining)+' dia(s)':remaining===0?'⏰ Último dia do prazo: hoje':'📅 Faltam '+remaining+' dia(s) para concluir';row.append(deadline);const meter=document.createElement('div');meter.className='meter';const bar=document.createElement('i');bar.style.width=Math.min(100,(c.stagesPerLesson?remainingGoals(c,p).doneStages:completedLessonsFor(c))/(c.stagesPerLesson?remainingGoals(c,p).totalStages:p.lessonGoal)*100)+'%';meter.append(bar);row.append(meter);const daily=dailyTarget(c,p),dailyRow=document.createElement('p');dailyRow.style.fontWeight='700';dailyRow.style.color='#286d47';dailyRow.textContent=daily.late?(daily.remainingLessons||daily.remainingStages?'Prazo encerrado: revise a meta ou o prazo.':'Meta concluída!'):(daily.remainingStages!==null?'📖 '+daily.availableDays+' dia(s) disponíveis (incluindo hoje) · meta: '+daily.stagesPerDay+' etapa(s)/dia, aproximadamente '+daily.lessonsPerDay+' aula(s)/dia.':'📖 '+daily.availableDays+' dia(s) disponíveis (incluindo hoje) · meta: '+daily.lessonsPerDay+' aula(s)/dia.');row.append(dailyRow);}list.append(row);});
 const sess=$('sessions-list');sess.replaceChildren();if(!state.sessions.length){const p=document.createElement('p');p.className='muted';p.textContent='Nenhuma sessão registrada ainda.';sess.append(p);}
 state.sessions.slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,10).forEach(s=>{const row=document.createElement('div');row.className='session-row';const left=document.createElement('span');left.textContent=course(s.courseId).title+' · '+({reading:'Leitura',questions:'Questões',review:'Revisão'}[s.type]||'Estudo');const right=document.createElement('small');right.textContent=fmtMin(s.minutes)+' · '+formatDate(s.date);row.append(left,right);sess.append(row);});
 $('inapp-alerts').checked=state.preferences.inAppAlerts;
}
function renderProgress(){
 const root=$('progress-metrics');root.replaceChildren();[['⏱️ Tempo registrado',fmtMin(studiedMinutes())],['📚 Etapas concluídas',String(completedStagesFor(course('ecologia-vegetal')))],['🧠 Questões respondidas',String(state.answers.length)]].forEach(([name,val])=>{const el=document.createElement('div');el.className='metric';const small=document.createElement('small');small.textContent=name;const strong=document.createElement('strong');strong.textContent=val;el.append(small,strong);root.append(el);});
 const list=$('progress-courses');list.replaceChildren();courses.forEach(c=>{const row=document.createElement('div');row.className='plan-row';const title=document.createElement('strong');title.textContent=c.icon+' '+c.title;const para=document.createElement('p');para.textContent=(c.stagesPerLesson?completedStagesFor(c):completedLessonsFor(c))+' de '+(c.stagesPerLesson?c.stagesPerLesson.reduce((a,b)=>a+b,0):c.lessons)+' '+(c.stagesPerLesson?'etapas':'aulas')+' · '+fmtMin(studiedMinutes(c.id))+' estudados';const meter=document.createElement('div');meter.className='meter';const bar=document.createElement('i');bar.style.width=((c.stagesPerLesson?completedStagesFor(c):completedLessonsFor(c))/(c.stagesPerLesson?c.stagesPerLesson.reduce((a,b)=>a+b,0):c.lessons)*100)+'%';meter.append(bar);row.append(title,para,meter);list.append(row);});}
function render(){renderHome();renderCourses();renderPlan();renderProgress();}
function addSession(id,type,minutes,date){
 if(!Number.isFinite(minutes)||minutes<=0||minutes>720)throw Error('Tempo inválido');
 state.sessions.push({id:(globalThis.crypto?.randomUUID?.()||'s-'+Date.now()+'-'+Math.random().toString(36).slice(2)),courseId:id,type,minutes:Math.round(minutes*100)/100,date,createdAt:new Date().toISOString()});save();
}
let timerInterval=null,timerStart=null,accumulated=0,timerRunning=false;
function timerSec(){return Math.max(0,Math.floor(accumulated+(timerRunning?(Date.now()-timerStart)/1000:0)));}
function paintTimer(){$('timer').textContent=formatClock(timerSec());$('timer-toggle').textContent=timerRunning?'⏸ Pausar':'▶ '+(timerSec()?'Continuar':'Iniciar');$('timer-reset').disabled=timerRunning||timerSec()===0;}
function stopTimer(){if(timerRunning){accumulated+=(Date.now()-timerStart)/1000;timerRunning=false;timerStart=null;clearInterval(timerInterval);}paintTimer();}
$('timer-toggle').addEventListener('click',()=>{if(timerRunning){stopTimer();$('timer-feedback').textContent='Sessão pausada. Zere para registrar o tempo ou continue estudando.';}else{timerRunning=true;timerStart=Date.now();timerInterval=setInterval(paintTimer,1000);$('timer-feedback').textContent='Sessão em andamento.';paintTimer();}});
$('timer-reset').addEventListener('click',()=>{stopTimer();const seconds=Math.floor(accumulated);if(seconds>=60){addSession($('session-course').value,$('session-type').value,Math.round(seconds/60*100)/100,today());notify('Tempo de estudo registrado!');$('timer-feedback').textContent=fmtMin(seconds/60)+' adicionados ao histórico.';}else{$('timer-feedback').textContent='Sessão inferior a 1 minuto descartada.';}accumulated=0;paintTimer();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&timerRunning){stopTimer();$('timer-feedback').textContent='Pausado automaticamente ao sair da página.';}});
$('manual-date').value=today();
$('manual-form').addEventListener('submit',e=>{e.preventDefault();const m=Number($('manual-minutes').value),d=$('manual-date').value;if(!d||!Number.isInteger(m)||m<1||m>720){notify('Informe data e tempo válidos.');return;}addSession($('session-course').value,$('session-type').value,m,d);$('manual-minutes').value='';notify('Sessão adicionada ao histórico.');});
$('inapp-alerts').addEventListener('change',e=>{state.preferences.inAppAlerts=e.target.checked;save();});
// As cobranças são globais e não fazem parte dos planos por disciplina.
// Exportação: no APK, o seletor nativo confirma que o arquivo foi realmente salvo.
const courseProgressPrefix='eu-serei-biologo-course-progress:';
function localCourseProgress(){
 const result={};
 for(let i=0;i<localStorage.length;i++){
  const key=localStorage.key(i);
  if(!key?.startsWith(courseProgressPrefix))continue;
  const id=key.slice(courseProgressPrefix.length);
  if(!/^[a-z0-9][a-z0-9-]{0,79}$/.test(id))continue;
  const parsed=JSON.parse(localStorage.getItem(key));
  if(!isRecord(parsed))throw Error('Progresso inválido: '+id);
  result[id]=parsed;
 }
 return result;
}
function fullBackup(){
 const ecologyKey='ecologia-vegetal-estudos-v1';
 const ecologyRaw=localStorage.getItem(ecologyKey);
 let ecology=null;
 if(ecologyRaw!==null){try{ecology=JSON.parse(ecologyRaw);}catch{throw Error('Dados de Ecologia Vegetal inválidos; exportação interrompida para evitar backup incompleto.');}}
 return JSON.stringify({backupFormat:'eu-serei-biologo-completo-v2',createdAt:new Date().toISOString(),state:readState(),ecologyProgress:ecology,ecologyPresent:ecologyRaw!==null,courseProgress:localCourseProgress()},null,2);
}
$('export').addEventListener('click',async()=>{
 const status=$('backup-status'),button=$('export');
 button.disabled=true;
 try{
  const content=fullBackup(),filename='EU_SEREI_BIOLOGO_backup_'+today()+'.json';
  const native=!!(window.Capacitor?.isNativePlatform?.()&&window.Capacitor.getPlatform?.()==='android');
  if(native){
   const backupPlugin=window.Capacitor.registerPlugin('BackupExport');
   const result=await backupPlugin.save({filename,content});
   if(!result?.saved)throw Error('O Android não confirmou o salvamento.');
   status.textContent='✅ Backup salvo no local escolhido. Agora envie o arquivo JSON aqui na conversa.';
  }else{
   const blob=new Blob([content],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
   link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();
   setTimeout(()=>URL.revokeObjectURL(url),30000);
   status.textContent='Download solicitado ao navegador. Confira a pasta Downloads.';
  }
 }catch(err){
  status.textContent=err?.message==='cancelled'?'Salvamento cancelado; nenhum dado foi apagado.':'⚠️ Backup não salvo: '+(err?.message||String(err))+'. Seus dados continuam no aplicativo.';
 }finally{button.disabled=false;}
});
// Importação segura do backup completo, sem sobrescrever avanços mais recentes do computador.
const importDate=value=>Date.parse(value||'')||0;
const isRecord=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
function mergeUniqueEntries(existing,incoming){
 const map=new Map();
 for(const item of [...existing,...incoming]){
  if(!isRecord(item))continue;
  const id=typeof item.id==='string'&&item.id?item.id:JSON.stringify(item);
  if(!map.has(id))map.set(id,item);
 }
 return [...map.values()];
}
function mergeStudyState(existing,incoming){
 const plans={...(existing.plans||{})};
 for(const [id,plan] of Object.entries(incoming.plans||{})){
  if(!isRecord(plan))continue;
  if(!plans[id]||importDate(plan.updatedAt)>=importDate(plans[id].updatedAt))plans[id]=plan;
 }
 const completed={...(existing.completed||{})};
 for(const [id,done] of Object.entries(incoming.completed||{}))completed[id]=Boolean(completed[id])||Boolean(done);
 const useIncoming=importDate(incoming.updatedAt)>importDate(existing.updatedAt);
 return {
  ...existing,
  startDate:useIncoming?(incoming.startDate||existing.startDate):existing.startDate,
  durationDays:useIncoming?incoming.durationDays:existing.durationDays,
  preferences:useIncoming?{...existing.preferences,...incoming.preferences}:existing.preferences,
  plans,completed,
  sessions:mergeUniqueEntries(existing.sessions||[],incoming.sessions||[]),
  answers:mergeUniqueEntries(existing.answers||[],incoming.answers||[]),
  reviewQueue:mergeUniqueEntries(existing.reviewQueue||[],incoming.reviewQueue||[]),
  // A sincronização é por dispositivo, não deve marcar importações como enviadas ao Drive.
  sync:existing.sync
 };
}
function mergeEcology(existing,incoming){
 if(!isRecord(incoming))return existing;
 const output={...existing};
 for(const [key,val] of Object.entries(incoming)){
  if(key==='complete'){
   const merged={...(isRecord(existing.complete)?existing.complete:{})};
   for(const [stage,when] of Object.entries(isRecord(val)?val:{})){
    if(!merged[stage]||importDate(when)>importDate(merged[stage]))merged[stage]=when;
   }
   output.complete=merged;
  }else if(['checks','errors','review'].includes(key)&&isRecord(val)){
   output[key]={...(isRecord(existing[key])?existing[key]:{}),...val};
  }else if(key==='examHistory'&&Array.isArray(val)){
   const seen=new Set(),merged=[];
   for(const item of [...(Array.isArray(existing.examHistory)?existing.examHistory:[]),...val]){
    const signature=JSON.stringify(item);
    if(!seen.has(signature)){seen.add(signature);merged.push(item);}
   }
   output.examHistory=merged;
  }else if(key==='lastStage'){
   if(!output.lastStage)output.lastStage=val;
  }else if(!(key in output))output[key]=val;
 }
 return output;
}
$('import').addEventListener('change',async e=>{
 const file=e.target.files?.[0];if(!file)return;
 try{
  const raw=JSON.parse(await file.text());
  const complete=raw?.backupFormat==='eu-serei-biologo-completo-v2';
  const incoming=complete?raw.state:raw;
  if(!isRecord(incoming)||incoming.schemaVersion!==1||!isRecord(incoming.completed)||!Array.isArray(incoming.sessions)||!Array.isArray(incoming.answers)||!isRecord(incoming.plans))throw Error('Formato de backup incompatível.');
  if(complete&&raw.ecologyPresent&&(!isRecord(raw.ecologyProgress)||!isRecord(raw.ecologyProgress.complete)))throw Error('Progresso de Ecologia Vegetal inválido.');
  if(complete&&raw.courseProgress!==undefined&&!isRecord(raw.courseProgress))throw Error('Progresso de novas disciplinas inválido.');
  const ecologyKey='ecologia-vegetal-estudos-v1';
  const ecologyRaw=localStorage.getItem(ecologyKey);
  let previousEcology={};
  if(ecologyRaw!==null){
   previousEcology=JSON.parse(ecologyRaw);
   if(!isRecord(previousEcology))throw Error('Dados locais de Ecologia inválidos; nada foi importado.');
  }
  const mergeImportedNotes=(oldNotes,newNotes)=>{
   const entries=new Map();
   for(const item of [...(Array.isArray(oldNotes)?oldNotes:[]),...(Array.isArray(newNotes)?newNotes:[])]){
    if(!isRecord(item)||!item.id)continue;
    const current=entries.get(item.id);
    if(!current||importDate(item.updatedAt||item.deletedAt||item.createdAt)>=importDate(current.updatedAt||current.deletedAt||current.createdAt))entries.set(item.id,item);
   }
   return [...entries.values()];
  };
  const previousCourses=localCourseProgress();
  const combinedCourses={...previousCourses};
  if(complete){
   for(const [id,value] of Object.entries(raw.courseProgress||{})){
    if(!/^[a-z0-9][a-z0-9-]{0,79}$/.test(id)||!isRecord(value))throw Error('Progresso inválido da disciplina '+id);
    const old=previousCourses[id]||{};
    const mergedCourse={...old,...value};
    if(Array.isArray(old.notes)||Array.isArray(value.notes))mergedCourse.notes=mergeImportedNotes(old.notes,value.notes);
    for(const field of ['complete','completed']){
     if(isRecord(old[field])||isRecord(value[field]))mergedCourse[field]={...(isRecord(old[field])?old[field]:{}),...(isRecord(value[field])?value[field]:{})};
    }
    combinedCourses[id]=mergedCourse;
   }
  }
  const previous=readState();
  const merged=mergeStudyState(previous,incoming);
  const ecology=complete&&raw.ecologyPresent?mergeEcology(previousEcology,raw.ecologyProgress):null;
  // Preservar retrato integral antes de escrever; não apagar a fonte em caso de falha.
  const safetyKey='eu-serei-biologo-before-import-'+Date.now();
  localStorage.setItem(safetyKey,JSON.stringify({state:previous,ecologyProgress:previousEcology,ecologyPresent:ecologyRaw!==null,courseProgress:previousCourses}));
  if(ecology!==null)localStorage.setItem(ecologyKey,JSON.stringify(ecology));
  for(const [id,progress] of Object.entries(combinedCourses))localStorage.setItem(courseProgressPrefix+id,JSON.stringify(progress));
  try{state=writeState(merged);}catch(error){
   if(ecologyRaw===null)localStorage.removeItem(ecologyKey);else localStorage.setItem(ecologyKey,ecologyRaw);
   for(const id of Object.keys(combinedCourses))if(!Object.hasOwn(previousCourses,id))localStorage.removeItem(courseProgressPrefix+id);else localStorage.setItem(courseProgressPrefix+id,JSON.stringify(previousCourses[id]));
   throw error;
  }
  render();fillPlan();
  $('backup-status').textContent='✅ Backup mesclado: '+incoming.sessions.length+' registros recebidos'+(complete&&raw.ecologyPresent?', com progresso de Ecologia Vegetal':'')+'. Dados anteriores preservados.';
  scheduleCloudSync(2000);
 }catch(error){$('backup-status').textContent='⚠️ Importação não concluída: '+(error?.message||String(error));}
 e.target.value='';
});

/* Google Drive: autenticação explícita e sincronização automática somente na sessão autorizada. */
const gdInput=$('google-client-id'),gdConnect=$('google-connect'),gdSync=$('google-sync'),gdDisconnect=$('google-disconnect'),gdStatus=$('google-sync-status');
gdInput.value=localStorage.getItem('eu-serei-biologo-google-client-id')||'';
const nativeGoogleDrive=!!(window.Capacitor?.isNativePlatform?.()&&window.Capacitor?.getPlatform?.()==='android');
if(nativeGoogleDrive){
 const panel=$('google-android-diagnostics'),sha1=$('google-android-sha1');
 if(panel)panel.hidden=false;
 const diagnostics=async()=>{
  try{
   if(!window.Capacitor?.isPluginAvailable?.('NativeDriveAuth'))throw Error('Plugin nativo indisponível. Instale o APK atualizado.');
   const plugin=window.Capacitor.Plugins?.NativeDriveAuth||window.Capacitor.registerPlugin('NativeDriveAuth');
   if(typeof plugin.diagnostics!=='function')throw Error('Esta versão do APK ainda não possui o diagnóstico da assinatura.');
   const data=await plugin.diagnostics();
   $('google-android-package').textContent=data.packageName||'Não identificado';
   sha1.textContent=data.sha1||'Não identificado';
   $('google-android-play-services').textContent=data.playServicesAvailable
    ?'✅ Google Play Services disponível.'
    :'⚠️ Google Play Services indisponível ou desatualizado (código '+data.playServicesStatus+').';
  }catch(error){
   sha1.textContent='⚠️ '+(error?.message||String(error));
  }
 };
 void diagnostics();
 $('google-android-copy-sha1')?.addEventListener('click',async()=>{
  const sha=sha1?.textContent||'';
  if(!/^(?:[A-F0-9]{2}:){19}[A-F0-9]{2}$/.test(sha)){
   syncStatus('⚠️ SHA-1 ainda indisponível. Confira se o APK está atualizado.');return;
  }
  try{await navigator.clipboard.writeText(sha);syncStatus('✅ SHA-1 copiado. Cole no cliente OAuth Android do Google Cloud.');}
  catch{syncStatus('Não foi possível copiar automaticamente; selecione o SHA-1 na tela.');}
 });
}
if(nativeGoogleDrive){
 const label=gdInput.closest('label');
 if(label)label.hidden=true;
 const info=document.getElementById('google-oauth-web-help');
 if(info)info.hidden=true;
 const nativeInfo=document.getElementById('google-oauth-android-help');
 if(nativeInfo)nativeInfo.hidden=false;
 gdConnect.textContent='🔐 Conectar Google no Android';
 gdStatus.textContent='No Android, o Google Play Services autoriza o acesso ao Drive. Não é necessário informar o ID OAuth Web.';
}

let driveModule=null,autoSyncEnabled=false,autoTimer=null,autoInProgress=false,queuedChanges=false;
/* Entrada inteligente: verificação silenciosa no Android; escolha explícita
   entre sincronizar e estudar offline. Nunca bloqueia acesso por falta de rede. */
const gate=$('entry-gate'),gateConnect=$('entry-connect'),gateOffline=$('entry-offline');
const gateTitle=$('entry-status-title'),gateMessage=$('entry-status-message'),gateIcon=$('entry-status-icon'),gateFeedback=$('entry-feedback');
let gateFinished=false;
function gateStatus(icon,title,message){gateIcon.textContent=icon;gateTitle.textContent=title;gateMessage.textContent=message;}
function enterApp(){
 if(gateFinished)return;
 gateFinished=true;document.body.classList.remove('entry-pending');
 gate.hidden=true;
 state=readState();render();fillPlan();
}
function gateError(error){
 const message=String(error?.message||error||'Falha na conexão.');
 gateFeedback.textContent='⚠️ '+message+' Você pode continuar offline sem perder seus dados.';
 gateStatus('⚠️','Conexão não concluída','Seus estudos permanecem disponíveis neste dispositivo.');
 gateConnect.disabled=!navigator.onLine;
}
async function authorizeAndEnter({silent=false}={}){
 if(!navigator.onLine){gateStatus('📴','Sem internet','Continue offline. Seu progresso ficará salvo no dispositivo.');gateConnect.disabled=true;return false;}
 try{
  gateConnect.disabled=true;gateFeedback.textContent='';
  gateStatus('☁️','Conectando ao Google Drive…','Verificando a autorização e buscando seu progresso.');
  driveModule=await import('./google-drive-sync.js');
  await driveModule.connectDrive(gdInput.value.trim(),{silent});
  if(!nativeGoogleDrive)localStorage.setItem('eu-serei-biologo-google-client-id',gdInput.value.trim());
  gdSync.disabled=false;gdDisconnect.disabled=false;
  autoSyncEnabled=true;
  // Antes de liberar o painel, trazer o progresso mais recente da nuvem.
  const synced=await runCloudSync(false);
  if(!synced)throw Error(gdStatus.textContent);
  enterApp();return true;
 }catch(error){
  if(silent&&String(error?.message||'').includes('GOOGLE_INTERACTION_REQUIRED')){
   gateStatus('🔐','Sua conta precisa de confirmação','Conecte ao Google para sincronizar ou continue offline.');
   gateConnect.disabled=false;return false;
  }
  gateError(error);return false;
 }
}
gateOffline.addEventListener('click',()=>{
 autoSyncEnabled=false;clearTimeout(autoTimer);
 enterApp();
});
gateConnect.addEventListener('click',()=>{void authorizeAndEnter();});
window.addEventListener('online',()=>{
 if(!gateFinished){gateConnect.disabled=false;gateStatus('☁️','Internet disponível','Conecte ao Google Drive ou continue offline.');}
});
window.addEventListener('offline',()=>{
 if(!gateFinished){gateConnect.disabled=true;gateStatus('📴','Sem internet','Continue offline. Seus dados permanecem salvos neste dispositivo.');}
});
async function initializeEntry(){
 if(!navigator.onLine){
  gateStatus('📴','Sem internet','Continue offline. Ao reconectar, use a sincronização em Configurações.');
  gateConnect.disabled=true;return;
 }
 gateConnect.disabled=false;
 if(nativeGoogleDrive){
  // Google Play Services não apresenta consentimento no modo silencioso.
  await authorizeAndEnter({silent:true});
 }else{
  gateStatus('☁️','Internet disponível','Conecte sua conta para recuperar o progresso ou continue offline.');
 }
}

function syncStatus(message){gdStatus.textContent=message;}
function scheduleCloudSync(delay=2500){
 if(!autoSyncEnabled||!driveModule?.connected()||!navigator.onLine)return;
 queuedChanges=true;
 clearTimeout(autoTimer);
 autoTimer=setTimeout(()=>{runCloudSync(true);},delay);
}
async function runCloudSync(automatic=false){
 if(autoInProgress){queuedChanges=true;return;}
 if(!driveModule?.connected()){
  autoSyncEnabled=false;gdSync.disabled=true;
  syncStatus('⚠️ Conexão Google expirada. Reconecte para continuar a sincronização.');
  return;
 }
 if(!navigator.onLine){
  syncStatus('📴 Sem internet. Seus dados continuam locais; sincronize ao reconectar.');
  return;
 }
 autoInProgress=true;queuedChanges=false;gdSync.disabled=true;
 if(!automatic)syncStatus('Consultando Google Drive e preservando cópia local…');
 try{
  const result=await driveModule.syncDrive();
  state=readState();render();fillPlan();
  let materialStatus='';
  try{const library=await driveModule.syncMaterials(courses);materialStatus=' · Biblioteca: '+library.uploaded+' enviado(s), '+library.downloaded+' recebido(s).';}catch(e){materialStatus=' · Biblioteca pendente: '+(e?.message||String(e));}
  if(current==='courses'&&!$('course-detail').classList.contains('hidden')&&!$('course-detail').querySelector('input:disabled'))showCourse(course(selectedCourse));
  syncStatus('✅ Google Drive: '+new Date(result.at).toLocaleString('pt-BR')+' · '+result.plans+' plano(s), '+result.sessions+' sessões, '+result.stages+' etapas concluídas. Sincronização automática ativa nesta sessão.'+materialStatus);
  autoSyncEnabled=true;
  return true;
 }catch(err){
  syncStatus('⚠️ Não sincronizado: '+(err?.message||String(err))+' Dados locais preservados.');
  if(!driveModule.connected())autoSyncEnabled=false;
  return false;
 }finally{
  autoInProgress=false;
  gdSync.disabled=!driveModule?.connected();
  if(queuedChanges&&autoSyncEnabled)scheduleCloudSync(6000);
 }
}
gdConnect.addEventListener('click',async()=>{
 gdConnect.disabled=true;syncStatus('Abrindo autorização do Google…');
 try{
  const clientId=gdInput.value.trim();
  driveModule=await import('./google-drive-sync.js');
  await driveModule.connectDrive(clientId);
  if(!nativeGoogleDrive)localStorage.setItem('eu-serei-biologo-google-client-id',clientId);
  gdSync.disabled=false;gdDisconnect.disabled=false;
  syncStatus('✅ Conta autorizada. Clique em Sincronizar agora para iniciar a sincronização automática desta sessão.');
 }catch(err){
  syncStatus('⚠️ '+(err?.message||String(err))+(nativeGoogleDrive?' Compare o pacote e SHA-1 exibidos acima com o cliente OAuth Android, confira o usuário de teste e o Google Play Services.':' Verifique as origens do cliente OAuth Web.'));
  gdSync.disabled=true;gdDisconnect.disabled=true;
 }finally{gdConnect.disabled=false;}
});
gdSync.addEventListener('click',()=>runCloudSync(false));
gdDisconnect.addEventListener('click',()=>{
 clearTimeout(autoTimer);autoSyncEnabled=false;queuedChanges=false;
 driveModule?.disconnectDrive();gdSync.disabled=true;gdDisconnect.disabled=true;
 syncStatus('Google desconectado. Seus dados continuam salvos neste dispositivo.');
});
window.addEventListener('online',()=>scheduleCloudSync(1200));
window.addEventListener('focus',()=>scheduleCloudSync(1200));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)scheduleCloudSync(1200);});
window.addEventListener('storage',event=>{
 if(event.key==='estudos:v1'||event.key==='ecologia-vegetal-estudos-v1'||event.key?.startsWith(courseProgressPrefix))scheduleCloudSync(2500);
});
// Verificação periódica ajuda a captar gravações feitas na página de leitura.
setInterval(()=>{if(!document.hidden)scheduleCloudSync(60000);},90000);

notesHub=initNotesHub({courses,onChanged:()=>scheduleCloudSync(2000)});
fillSelectors();fillPlan();paintTimer();render();
window.addEventListener('pageshow',()=>{state=readState();render();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){state=readState();render();}});
window.addEventListener('storage',e=>{if(e.key==='ecologia-vegetal-estudos-v1'||e.key==='estudos:v1'){state=readState();render();}});
function openDeepLink(){
 const view=location.hash.replace(/^#/,'').split('?')[0];
 if(['home','courses','planning','questions','progress','notes','settings'].includes(view)){
  navigate(view);
  if(view==='planning'){$('plan-course').value='ecologia-vegetal';fillPlan();}
 }
}
window.addEventListener('hashchange',openDeepLink);
openDeepLink();
void initializeEntry();
