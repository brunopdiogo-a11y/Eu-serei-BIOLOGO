import { Browser } from '@capacitor/browser';
import { LocalNotifications } from '@capacitor/local-notifications';
const WEB='https://brunopdiogo-a11y.github.io/Eu-serei-BIOLOGO/';
const KEY='eu-serei-biologo-reminders-v1', INTERVAL=15*60*1000, MAX=4;
const $=id=>document.getElementById(id);
const courses={'ecologia-vegetal':'Ecologia Vegetal','sensoriamento':'Sensoriamento Remoto','inventariamento':'Inventariamento de Flora'};
let current=null, actionBusy=false;
const store=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'null');}catch{return null;}};
function save(x){current=x;if(x)localStorage.setItem(KEY,JSON.stringify(x));else localStorage.removeItem(KEY);render();}
function report(message){$('reminder-status').textContent=message;}
const dt=d=>d.toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});
function quietAdjust(input){
 const d=new Date(input);const h=d.getHours();
 if(h>=22){d.setDate(d.getDate()+1);d.setHours(7,0,0,0);}
 else if(h<7)d.setHours(7,0,0,0);
 return d;
}
function nextTime(d){return quietAdjust(new Date(d.getTime()+INTERVAL));}
function uniqueBase(){return 100000+Math.floor(Math.random()*1900000000);}
function notificationId(base,seq){return base+seq;}
function futureNotifications(base,course,first,fromSeq){
 const events=[];let when=quietAdjust(first);
 for(let seq=fromSeq;seq<=MAX;seq++){
  events.push({
    id:notificationId(base,seq),
    title:'🌿 Hora de estudar!',
    body:courses[course]+': vamos começar? Aviso '+seq+' de '+MAX+'.',
    actionTypeId:'study_reminder_actions',
    extra:{series:base,sequence:seq,course},
    schedule:{at:when,allowWhileIdle:true},
    autoCancel:true,
    iconColor:'#25764a'
  });
  when=nextTime(when);
 }
 return events;
}
async function checkPermission(){
 const p=await LocalNotifications.checkPermissions();
 if(p.display==='granted')return true;
 const requested=await LocalNotifications.requestPermissions();
 if(requested.display!=='granted')throw Error('Permissão de notificações negada. Ative nas configurações do Android.');
 return true;
}
async function cancelScheduled(x=current){
 if(!x)return;
 await LocalNotifications.cancel({notifications:Array.from({length:MAX},(_,i)=>({id:notificationId(x.base,i+1)}))});
}
async function clearDelivered(x=current){
 if(!x)return;
 try{
  const delivered=await LocalNotifications.getDeliveredNotifications();
  const ours=(delivered.notifications||[]).filter(n=>n.extra?.series===x.base).map(n=>({id:n.id}));
  if(ours.length)await LocalNotifications.removeDeliveredNotifications({notifications:ours});
 }catch{}
}
async function arm(course,when,fromSeq=1,base=uniqueBase()){
 await checkPermission();
 const now=new Date();
 const first=quietAdjust(when);
 if(first<=now)throw Error('Selecione uma data e um horário futuros.');
 const entries=futureNotifications(base,course,first,fromSeq);
 const result=await LocalNotifications.schedule({notifications:entries});
 const next={base,course,nextAt:entries[0].schedule.at.toISOString(),fromSeq,enabled:true,createdAt:new Date().toISOString()};
 save(next);
 report('✅ '+entries.length+' aviso(s) programados para '+courses[course]+'. Primeiro: '+dt(first)+(result.warning?' — O Android pode atrasar horários sem a permissão de alarmes exatos.':''));
}
async function snooze(seq){
 const x=current;if(!x)return;
 const nextSeq=Math.max(x.fromSeq,seq+1);
 if(nextSeq>MAX){await cancelScheduled(x);await clearDelivered(x);save(null);report('Os quatro avisos foram utilizados. Crie um novo compromisso se desejar continuar.');return;}
 await cancelScheduled(x);await clearDelivered(x);
 await arm(x.course,new Date(Date.now()+INTERVAL),nextSeq,x.base);
}
function render(){
 const x=current;
 $('active-reminder').classList.toggle('hidden',!x);
 if(x){
  $('reminder-course').value=x.course;
  report('🔔 Cobrança ativa · '+courses[x.course]+' · próximo aviso previsto: '+dt(new Date(x.nextAt))+'. Limite de '+MAX+' avisos.');
 }
}
async function openWeb(){
 $('open').disabled=true;
 try{await Browser.open({url:WEB,toolbarColor:'#25764a'});}
 catch(err){
  $('message').textContent='A aba integrada não abriu. Tente pelo Chrome: '+WEB+' ('+(err?.message||'erro')+')';
  // An ordinary browser anchor remains usable if native Browser plugin fails.
  if(!$('fallback')){const a=document.createElement('a');a.id='fallback';a.href=WEB;a.target='_blank';a.rel='noopener';a.textContent='Abrir no navegador';$('message').append(document.createElement('br'),a);}
 }finally{$('open').disabled=false;}
}
$('open').addEventListener('click',openWeb);
$('help').addEventListener('click',()=>$('message').textContent='O Drive sincroniza o progresso na plataforma Web. Os alarmes são configurados neste APK e armazenados somente neste celular. A sincronização automática dos alarmes com as metas Web virá numa próxima etapa.');
$('study-now').addEventListener('click',openWeb);
$('done').addEventListener('click',async()=>{try{await cancelScheduled();await clearDelivered();save(null);report('✅ Cobrança encerrada por sua confirmação de início do estudo.');}catch(err){report('⚠️ '+err.message);}});
$('cancel').addEventListener('click',async()=>{try{await cancelScheduled();await clearDelivered();save(null);report('Cobrança cancelada.');}catch(err){report('⚠️ '+err.message);}});
$('snooze').addEventListener('click',async()=>{try{await snooze(current?.fromSeq||1);}catch(err){report('⚠️ '+err.message);}});
$('enabled').addEventListener('change',async e=>{
 if(e.target.checked){report('Cobrança ativada. Programe um horário.');return;}
 try{await cancelScheduled();await clearDelivered();save(null);report('Cobrança desativada.');}catch(err){report('⚠️ '+err.message);}
});
$('permission').addEventListener('click',async()=>{
 try{
  await checkPermission();
  const exact=await LocalNotifications.checkExactNotificationSetting();
  if(exact?.exact_alarm!=='granted'){
   report('Notificações autorizadas. Para receber nos horários mais precisos, habilite também Alarmes e lembretes.');
   await LocalNotifications.changeExactNotificationSetting();
  }else report('✅ Notificações e alarmes exatos autorizados.');
 }catch(err){report('⚠️ '+err.message);}
});
$('schedule').addEventListener('click',async()=>{
 if(actionBusy)return;
 if(!$('enabled').checked){report('Ative a cobrança antes de agendar.');return;}
 const val=$('reminder-time').value;
 const first=new Date(val);
 if(!val||!Number.isFinite(first.getTime())||first<=new Date()){report('Informe data e horário futuros.');return;}
 actionBusy=true;$('schedule').disabled=true;
 try{
  if(current){await cancelScheduled();await clearDelivered();}
  await arm($('reminder-course').value,first);
 }catch(err){report('⚠️ '+err.message);}
 finally{actionBusy=false;$('schedule').disabled=false;}
});
async function processAction(action){
 const x=current,extra=action.notification?.extra||{};
 if(!x||extra.series!==x.base)return;
 const seq=Number(extra.sequence||x.fromSeq);
 if(action.actionId==='study_now'){
  report('A disciplina será aberta. Para encerrar as cobranças, volte ao APK e confirme que iniciou o cronômetro.');
  await openWeb();
 }else if(action.actionId==='snooze_15'){
  await snooze(seq);
 }else if(action.actionId==='snooze_30'){
  const n=Math.max(x.fromSeq,seq+1);
  if(n>MAX){await cancelScheduled();save(null);report('Limite de quatro avisos alcançado.');return;}
  await cancelScheduled(x);await clearDelivered(x);await arm(x.course,new Date(Date.now()+30*60000),n,x.base);
 }else{
  report('Lembrete aberto. Inicie o estudo no ambiente Web ou adie pelo painel.');
 }
}
async function setup(){
 const d=new Date();d.setMinutes(d.getMinutes()+2);d.setSeconds(0,0);
 const pad=x=>String(x).padStart(2,'0');
 $('reminder-time').value=d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'T'+pad(d.getHours())+':'+pad(d.getMinutes());
 current=store();render();
 try{
  await LocalNotifications.registerActionTypes({types:[{
   id:'study_reminder_actions',
   actions:[
    {id:'study_now',title:'Estudar agora',foreground:true},
    {id:'snooze_15',title:'Daqui 15 min',foreground:true},
    {id:'snooze_30',title:'Daqui 30 min',foreground:true}
   ]
  }]});
  await LocalNotifications.addListener('localNotificationActionPerformed',e=>{processAction(e).catch(err=>report('⚠️ '+err.message));});
  // Existing scheduled notifications are held by Android even if this screen is closed.
 }catch(err){report('Não foi possível ativar lembretes Android: '+err.message);}
}
setup();
