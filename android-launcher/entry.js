import { LocalNotifications } from '@capacitor/local-notifications';
import { registerPlugin } from '@capacitor/core';
const StudyAlarm=registerPlugin('StudyAlarm');
const WEB='./index.html';
const KEY='eu-serei-biologo-reminders-v1', ENABLED_KEY='eu-serei-biologo-reminders-enabled-v1', ALERT_KEY='eu-serei-biologo-alert-mode-v1', ALARM_CHANNEL='study_alarm_high_v1', INTERVAL=15*60*1000, MAX=4;
const $=id=>document.getElementById(id);
const courses={'ecologia-vegetal':'Ecologia Vegetal','sensoriamento':'Sensoriamento Remoto','inventariamento':'Inventariamento de Flora'};
let current=null, actionBusy=false;
const alarmEnabled=()=>localStorage.getItem(ALERT_KEY)!=='standard';
async function initAlarmChannel(){
 await LocalNotifications.createChannel({id:ALARM_CHANNEL,name:'Alarme de estudo',description:'Cobrança de estudo com sinal e destaque na tela',importance:5,visibility:1,vibration:true,lights:true,lightColor:'#2D8B59',sound:'study_alarm.wav'});
}
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
    ...(alarmEnabled()?{channelId:ALARM_CHANNEL}:{}),
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
 await StudyAlarm.cancel();
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
 if(alarmEnabled())await initAlarmChannel();
 const now=new Date();
 const first=quietAdjust(when);
 if(first<=now)throw Error('Selecione uma data e um horário futuros.');
 const entries=futureNotifications(base,course,first,fromSeq);
 let result={};
 if(alarmEnabled()){
   result=await StudyAlarm.schedule({
     base,course:courses[course],fromSeq,
     times:entries.map(n=>n.schedule.at.getTime())
   });
 }else{
   await StudyAlarm.cancel();
   result=await LocalNotifications.schedule({notifications:entries});
 }
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
function openWeb(){window.location.href='./index.html';}
$('study-now').addEventListener('click',openWeb);
$('done').addEventListener('click',async()=>{try{await cancelScheduled();await clearDelivered();save(null);report('✅ Cobrança encerrada por sua confirmação de início do estudo.');}catch(err){report('⚠️ '+err.message);}});
$('cancel').addEventListener('click',async()=>{try{await cancelScheduled();await clearDelivered();save(null);report('Cobrança cancelada.');}catch(err){report('⚠️ '+err.message);}});
$('snooze').addEventListener('click',async()=>{try{await snooze(current?.fromSeq||1);}catch(err){report('⚠️ '+err.message);}});
$('enabled').addEventListener('change',async e=>{
 if(e.target.checked){localStorage.setItem(ENABLED_KEY,'true');report('Cobrança ativada. Programe um horário.');return;}
 localStorage.setItem(ENABLED_KEY,'false');
 try{await cancelScheduled();await clearDelivered();save(null);report('Cobrança desativada.');}catch(err){report('⚠️ '+err.message);}
});
$('alert-mode').addEventListener('change',()=>{
 localStorage.setItem(ALERT_KEY,$('alert-mode').value==='alarm'?'alarm':'standard');
 report('Modo de alerta salvo. Para aplicar aos lembretes já programados, agende novamente o compromisso.');
});
$('test-alarm').addEventListener('click',async()=>{
 const button=$('test-alarm');button.disabled=true;
 try{
  await checkPermission();
  if(alarmEnabled()){
    await StudyAlarm.test();
    report('Teste do alarme nativo iniciado: toque repetido por até 45 segundos. Use Silenciar na tela de alarme.');
  }else{
    await LocalNotifications.schedule({notifications:[{
      id:194716,title:'🌿 Teste de notificação comum',
      body:'Este é um aviso discreto.',schedule:{at:new Date(Date.now()+3500)},autoCancel:true
    }]});
    report('Teste de notificação comum programado para daqui a alguns segundos.');
  }
 }catch(err){report('⚠️ '+(err?.message||err));}
 finally{button.disabled=false;}
});
$('full-screen-permission').addEventListener('click',async()=>{
 try{await StudyAlarm.openFullScreenSettings();}catch(err){report('⚠️ '+(err?.message||err));}
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
 localStorage.setItem('eu-serei-biologo-reminder-last-action-v1',JSON.stringify({series:x.base,sequence:seq,action:action.actionId||'opened',at:new Date().toISOString()}));
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
 $('enabled').checked=localStorage.getItem(ENABLED_KEY)!=='false';
 $('alert-mode').value=alarmEnabled()?'alarm':'standard';
 current=store();render();
 try{
  const status=await StudyAlarm.status();
  const line=$('full-screen-status');
  line.textContent=status.fullScreenAllowed?'✅ Tela cheia permitida pelo Android.':'⚠️ Tela cheia não autorizada. O som e a vibração ainda podem funcionar; toque em Autorizar tela cheia.';
 }catch(err){$('full-screen-status').textContent='Não foi possível consultar a permissão de tela cheia.';}

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
