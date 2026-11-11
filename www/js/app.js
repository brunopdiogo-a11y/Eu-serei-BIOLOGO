import {courses} from './data.js';
import {readState,writeState,exportState,importState} from './storage.js';
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
function save(){state=writeState(state);render();}
function navigate(view){if(!$( 'view-'+view))view='home';current=view;document.querySelectorAll('.view').forEach(x=>x.classList.toggle('visible',x.id==='view-'+view));document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('selected',b.dataset.view===view));window.scrollTo({top:0,behavior:'instant'});if(view==='planning')fillPlan();render();}
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
 if(!end||!start||end<start)return {...rem,availableDays:0,lessonsPerDay:0,stagesPerDay:0,late:true};
 const remainingCalendar=Math.max(0,daysBetween(current,end)+1);
 const daysPerWeek=Math.max(1,Math.min(7,Number(p.daysPerWeek)||4));
 /* Estimativa proporcional; futuramente configuraremos os dias exatos da semana. */
 const availableDays=remainingCalendar?Math.max(1,Math.ceil(remainingCalendar*daysPerWeek/7)):0;
 return {...rem,availableDays,lessonsPerDay:availableDays?Math.ceil(rem.remainingLessons/availableDays):rem.remainingLessons,stagesPerDay:rem.remainingStages===null?null:availableDays?Math.ceil(rem.remainingStages/availableDays):rem.remainingStages,late:remainingCalendar===0};
}

function planSummary(c){
 const p=state.plans[c.id];if(!p)return {label:'Sem planejamento',kind:'neutral',expected:0,actual:completedLessonsFor(c),remaining:null};
 const start=toDate(p.start),end=toDate(p.end),date=toDate(today());
 if(!start||!end||end<start)return {label:'Verifique as datas',kind:'attention',expected:0,actual:completedLessonsFor(c),remaining:null};
 const total=Math.max(1,daysBetween(start,end)+1),elapsed=Math.max(0,Math.min(total,daysBetween(start,date)+1));
 const expected=Math.min(p.lessonGoal||c.lessons,Math.floor((p.lessonGoal||c.lessons)*elapsed/total));
 const actual=completedLessonsFor(c);
 const left=daysBetween(date,end);
 let label='Em dia',kind='good';
 if(left<0&&actual<(p.lessonGoal||c.lessons)){label='Prazo encerrado';kind='urgent';}
 else if(left<=2&&actual<(p.lessonGoal||c.lessons)){label='Prazo próximo';kind='urgent';}
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
 const ecology=courses.find(c=>c.id==='ecologia-vegetal');const ep=state.plans['ecologia-vegetal'];if(ep&&ecology){const d=dailyTarget(ecology,ep);if(!d.late&&d.remainingStages>0)alerts.push({kind:'neutral',icon:'📖',title:'Meta diária · Ecologia Vegetal',desc:'Estude aproximadamente '+d.stagesPerDay+' etapa(s) hoje para acompanhar seu prazo.'});}
 if(!Object.keys(state.plans).length)alerts.push({kind:'neutral',icon:'🌱',title:'Vamos organizar sua primeira matéria?',desc:'Defina as datas de Ecologia Vegetal em Meu Planejamento.'});
 return alerts.sort((a,b)=>({urgent:0,attention:1,neutral:2,good:3}[a.kind]-{urgent:0,attention:1,neutral:2,good:3}[b.kind]));
}
function renderHome(){const box=$('home-alerts');box.replaceChildren();if(!state.preferences.inAppAlerts){box.textContent='Os avisos estão desativados nas preferências de planejamento.';return;}
 getAlerts().slice(0,3).forEach(a=>{const item=document.createElement('article');item.className='notice '+a.kind;const ico=document.createElement('span');ico.className='notice-icon';ico.textContent=a.icon;const info=document.createElement('div');const strong=document.createElement('strong');strong.textContent=a.title;const p=document.createElement('p');p.textContent=a.desc;info.append(strong,p);item.append(ico,info);box.append(item);});}
function renderCourses(){
 const root=$('course-cards');root.replaceChildren();
 courses.forEach(c=>{const count=completedLessonsFor(c),card=document.createElement('button');card.className='course-card';const icon=document.createElement('span');icon.className='emoji';icon.textContent=c.icon;const name=document.createElement('strong');name.textContent=c.title;const subtitle=document.createElement('small');subtitle.textContent=c.subtitle;const meter=document.createElement('div');meter.className='meter';const progress=document.createElement('i');progress.style.width=(count/c.lessons*100)+'%';meter.append(progress);const number=document.createElement('small');number.textContent=count+' de '+c.lessons+' aulas concluídas';card.append(icon,name,subtitle,meter,number);card.addEventListener('click',()=>showCourse(c));root.append(card);});
}
function showCourse(c){
 if(c.id==='ecologia-vegetal'){
   fetch('./ecologia-vegetal.html',{method:'HEAD'}).then(r=>{
     if(r.ok){window.location.href='./ecologia-vegetal.html';}
     else {notify('O material completo ainda não foi publicado neste site.');}
   }).catch(()=>notify('O material completo ainda não está disponível nesta instalação.'));
   return;
 }
 selectedCourse=c.id;const detail=$('course-detail');detail.classList.remove('hidden');detail.replaceChildren();const title=document.createElement('h2');title.textContent=c.icon+' '+c.title;detail.append(title);
 const desc=document.createElement('p');desc.className='muted';desc.textContent='Estrutura inicial. O conteúdo de cada aula será importado e revisado em uma próxima etapa. Por enquanto, não há aulas disponíveis para marcar como concluídas.';detail.append(desc);
 const go=document.createElement('button');go.className='btn secondary';go.textContent='📅 Planejar esta disciplina';go.addEventListener('click',()=>{navigate('planning');$('plan-course').value=c.id;fillPlan();});detail.append(go);
 detail.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function fillSelectors(){['plan-course','session-course'].forEach(id=>{const select=$(id);select.replaceChildren();courses.forEach(c=>{const op=document.createElement('option');op.value=c.id;op.textContent=c.icon+' '+c.title;select.append(op);});});}
function fillPlan(){
 const id=$('plan-course').value||courses[0].id,p=state.plans[id];
 $('plan-start').value=p?.start||today();
 const defaultEnd=new Date();defaultEnd.setDate(defaultEnd.getDate()+29);
 $('plan-end').value=p?.end||localDate(defaultEnd);
 $('plan-days').value=String(p?.daysPerWeek||4);
 $('plan-minutes').value=p?.minutesPerSession||30;
 $('plan-lessons').value=p?.lessonGoal||course(id).lessons;
 $('plan-remind').checked=!!p?.remind;
 $('plan-time').value=p?.remindTime||'19:00';
 $('remind-time-wrap').classList.toggle('hidden',!$('plan-remind').checked);
}
$('plan-course').addEventListener('change',fillPlan);
$('plan-remind').addEventListener('change',()=>$('remind-time-wrap').classList.toggle('hidden',!$('plan-remind').checked));
$('plan-form').addEventListener('submit',e=>{
 e.preventDefault();const id=$('plan-course').value,start=$('plan-start').value,end=$('plan-end').value,days=Number($('plan-days').value),minutes=Number($('plan-minutes').value),goal=Number($('plan-lessons').value);
 if(!start||!end||end<start||days<1||days>7||!Number.isInteger(minutes)||minutes<5||minutes>240||!Number.isInteger(goal)||goal<1||goal>course(id).lessons){$('plan-feedback').textContent='Verifique as datas, minutos e meta (até '+course(id).lessons+' aulas).';return;}
 state.plans[id]={start,end,daysPerWeek:days,minutesPerSession:minutes,lessonGoal:goal,remind:$('plan-remind').checked,remindTime:$('plan-time').value||'19:00',updatedAt:new Date().toISOString()};
 save();$('plan-feedback').textContent='✅ Planejamento salvo para '+course(id).title+'.';notify('Planejamento salvo!');
});
function currentWeekStart(){const d=now();d.setDate(d.getDate()-((d.getDay()+6)%7));return localDate(d);}
function renderPlan(){
 const plans=Object.keys(state.plans).length,week=studiedMinutes(null,currentWeekStart());
 const target=Object.values(state.plans).reduce((sum,p)=>sum+p.daysPerWeek*p.minutesPerSession,0);
 $('plan-summary').innerHTML='';
 [['📚 Disciplinas planejadas',String(plans)],['⏱️ Tempo nesta semana',fmtMin(week)],['🎯 Meta semanal',target?fmtMin(target):'—']].forEach(([name,val])=>{const el=document.createElement('div');el.className='metric';const s=document.createElement('small');s.textContent=name;const n=document.createElement('strong');n.textContent=val;el.append(s,n);$('plan-summary').append(el);});
 const list=$('plan-list');list.replaceChildren();
 courses.forEach(c=>{const p=state.plans[c.id],s=planSummary(c),row=document.createElement('div');row.className='plan-row';const top=document.createElement('div'),title=document.createElement('strong'),pill=document.createElement('span');title.textContent=c.icon+' '+c.title;pill.className='status-pill'+(s.kind==='urgent'?' danger':s.kind==='attention'?' warning':'');pill.textContent=s.label;top.append(title,pill);const para=document.createElement('p');para.textContent=p?'De '+formatDate(p.start)+' até '+formatDate(p.end)+' · '+p.daysPerWeek+' dias/semana · '+p.minutesPerSession+' min/sessão · '+fmtMin(studiedMinutes(c.id))+' registrados':'Sem meta definida. Selecione esta matéria no formulário acima.';row.append(top,para);if(p){const meter=document.createElement('div');meter.className='meter';const bar=document.createElement('i');bar.style.width=Math.min(100,completedLessonsFor(c)/p.lessonGoal*100)+'%';meter.append(bar);row.append(meter);const daily=dailyTarget(c,p),dailyRow=document.createElement('p');dailyRow.style.fontWeight='700';dailyRow.style.color='#286d47';dailyRow.textContent=daily.late?(daily.remainingLessons||daily.remainingStages?'Prazo encerrado: revise a meta ou o prazo.':'Meta concluída!'):(daily.remainingStages!==null?'📖 Meta diária: '+daily.stagesPerDay+' etapa(s) ou aproximadamente '+daily.lessonsPerDay+' aula(s) em '+daily.availableDays+' dia(s) de estudo restantes.':'📖 Meta diária: aproximadamente '+daily.lessonsPerDay+' aula(s) em '+daily.availableDays+' dia(s) de estudo restantes.');row.append(dailyRow);}list.append(row);});
 const sess=$('sessions-list');sess.replaceChildren();if(!state.sessions.length){const p=document.createElement('p');p.className='muted';p.textContent='Nenhuma sessão registrada ainda.';sess.append(p);}
 state.sessions.slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,10).forEach(s=>{const row=document.createElement('div');row.className='session-row';const left=document.createElement('span');left.textContent=course(s.courseId).title+' · '+({reading:'Leitura',questions:'Questões',review:'Revisão'}[s.type]||'Estudo');const right=document.createElement('small');right.textContent=fmtMin(s.minutes)+' · '+formatDate(s.date);row.append(left,right);sess.append(row);});
 $('inapp-alerts').checked=state.preferences.inAppAlerts;
 $('browser-alerts').checked=state.preferences.browserAlerts;
}
function renderProgress(){
 const root=$('progress-metrics');root.replaceChildren();[['⏱️ Tempo registrado',fmtMin(studiedMinutes())],['📚 Aulas concluídas',String(Object.values(state.completed).filter(Boolean).length)],['🧠 Questões respondidas',String(state.answers.length)]].forEach(([name,val])=>{const el=document.createElement('div');el.className='metric';const small=document.createElement('small');small.textContent=name;const strong=document.createElement('strong');strong.textContent=val;el.append(small,strong);root.append(el);});
 const list=$('progress-courses');list.replaceChildren();courses.forEach(c=>{const row=document.createElement('div');row.className='plan-row';const title=document.createElement('strong');title.textContent=c.icon+' '+c.title;const para=document.createElement('p');para.textContent=completedLessonsFor(c)+' de '+c.lessons+' aulas · '+fmtMin(studiedMinutes(c.id))+' estudados';const meter=document.createElement('div');meter.className='meter';const bar=document.createElement('i');bar.style.width=(completedLessonsFor(c)/c.lessons*100)+'%';meter.append(bar);row.append(title,para,meter);list.append(row);});}
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
$('browser-alerts').addEventListener('change',async e=>{
 if(e.target.checked){if(!('Notification' in window)||!window.isSecureContext){e.target.checked=false;$('notice-permission').textContent='Este navegador não oferece notificações neste contexto.';return;}
 try{const perm=await Notification.requestPermission();if(perm!=='granted'){e.target.checked=false;$('notice-permission').textContent='Permissão não concedida.';return;}}catch{e.target.checked=false;$('notice-permission').textContent='Não foi possível solicitar permissão.';return;}}
 state.preferences.browserAlerts=e.target.checked;save();$('notice-permission').textContent='Preferência salva. Os avisos externos dependem de a página permanecer aberta.';
});
let notifiedToday={};
function checkReminders(){
 if(!state.preferences.browserAlerts||!('Notification' in window)||Notification.permission!=='granted')return;
 const d=now(),hhmm=String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
 Object.entries(state.plans).forEach(([id,p])=>{const day=today(),key=id+':'+day;if(!p.remind||p.remindTime!==hhmm||notifiedToday[key]||day<p.start||day>p.end)return;notifiedToday[key]=true;new Notification('📚 Hora de estudar!',{body:'Sua sessão de '+course(id).title+' está programada para agora.'});});
}
setInterval(checkReminders,30000);
$('export').addEventListener('click',()=>{const blob=new Blob([exportState()],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='EU_SEREI_BIOLOGO_backup_'+today()+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),2000);$('backup-status').textContent='Arquivo preparado para download.';});
$('import').addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{const text=await f.text();state=importState(text);render();fillPlan();$('backup-status').textContent='Backup restaurado com sucesso.';}catch(err){$('backup-status').textContent='Erro no backup: '+err.message;}e.target.value='';});
fillSelectors();fillPlan();paintTimer();render();
