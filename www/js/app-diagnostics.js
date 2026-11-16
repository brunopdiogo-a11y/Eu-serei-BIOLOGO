/* Diagnóstico Android: status real quando disponível, sem inferir leitura. */
const $=id=>document.getElementById(id);
const parse=k=>{try{return JSON.parse(localStorage.getItem(k)||'null')}catch{return null}};
function statusRow(icon,title,detail,kind='neutral'){
 const el=document.createElement('article');el.className='notice '+kind;
 const ico=document.createElement('span');ico.className='notice-icon';ico.textContent=icon;
 const text=document.createElement('div'),a=document.createElement('strong'),b=document.createElement('p');
 a.textContent=title;b.textContent=detail;text.append(a,b);el.append(ico,text);return el;
}
export async function initDiagnostics(){
 if(!window.Capacitor?.isNativePlatform?.()||window.Capacitor.getPlatform?.()!=='android')return;
 const panel=$('app-diagnostics'),output=$('app-health-status'),check=$('app-health-check');
 if(!panel)return;
 panel.hidden=false;
 let runtime=null;
 async function api(){return runtime||(runtime=await import('./native-diagnostic-runtime.js'))}
 async function refresh(){
  check.disabled=true;output.textContent='Verificando o Android…';
  try{
   const {AppHealth,Notifications,StudyAlarm}=await api();
   const settled=await Promise.allSettled([AppHealth.inspect(),Notifications.checkPermissions(),Notifications.checkExactNotificationSetting(),Notifications.getPending(),Notifications.getDeliveredNotifications(),StudyAlarm.status()]);
   const get=i=>settled[i].status==='fulfilled'?settled[i].value:null;
   const sys=get(0),p=get(1),exact=get(2),pending=get(3),delivered=get(4),rows=[];
   if(sys){
    const optimized=!sys.batteryOptimizationExempt;
    rows.push(statusRow(optimized?'⚠️':'✅',optimized?'Otimização de bateria: verificar':'Exceção de bateria habilitada',optimized?'O Android pode restringir o aplicativo. Confira as opções de bateria.':'O aparelho informa uma exceção de otimização, sem garantia de execução contínua.',optimized?'attention':'good'));
    if(sys.batterySaverOn)rows.push(statusRow('⚠️','Economia de bateria ativa','Pode limitar tarefas em segundo plano e atrasar alertas.','attention'));
    const allowed=sys.notificationsEnabled&&p?.display==='granted';
    rows.push(statusRow(allowed?'✅':'🔴',allowed?'Notificações habilitadas':'Notificações desativadas ou não verificadas',allowed?'O aplicativo está autorizado a mostrar notificações.':'Revise as permissões de notificações do Android.',allowed?'good':'urgent'));
   }else rows.push(statusRow('⚠️','Permissões e bateria: status indisponível','O Android não forneceu esses dados.','attention'));
   if(exact){
    const allowed=exact.exact_alarm==='granted';
    rows.push(statusRow(allowed?'✅':'⚠️',allowed?'Alarmes exatos permitidos':'Alarmes exatos não permitidos',allowed?'O aplicativo tem autorização para horários exatos.':'O Android pode atrasar avisos; confira a permissão de alarmes.',allowed?'good':'attention'));
   }
   const nativeAlarm=get(5);
   if(nativeAlarm){
    const full=nativeAlarm.fullScreenAllowed;
    rows.push(statusRow(full?'✅':'⚠️',full?'Alertas em tela cheia permitidos':'Alerta em tela cheia não autorizado',
      full?'O Android permite solicitar a abertura da tela de alarme.':'Com o celular desbloqueado, o alarme ainda poderá tocar e mostrar um aviso destacado.',full?'good':'attention'));
   }
   const task=parse('eu-serei-biologo-reminders-v1');
   const action=parse('eu-serei-biologo-reminder-last-action-v1');
   if(task){
    if(nativeAlarm&&nativeAlarm.base===task.base){
      rows.push(statusRow('⏰','Alarme nativo configurado','O agendamento foi registrado pelo Android. O som e a tela de alarme dependem das permissões do aparelho.','good'));
      if(nativeAlarm.lastAction)rows.push(statusRow('ℹ️','Última ação do alarme',nativeAlarm.lastAction+' · aviso '+nativeAlarm.lastActionSeq));
    }else{
    const belongs=n=>Number(n?.extra?.series)===Number(task.base);
    const future=pending?.notifications?.filter(belongs)||[];
    const visible=delivered?.notifications?.filter(belongs)||[];
    const last=action?.series===task.base?' Última ação: '+new Date(action.at).toLocaleString('pt-BR')+'.':'';
    if(visible.length)rows.push(statusRow('🔔',visible.length+' aviso(s) visível(is)','Estão na central de notificações, mas não podemos confirmar se foram lidos.'+last,'attention'));
    else if(future.length)rows.push(statusRow('📅',future.length+' aviso(s) agendado(s)','O Android informa esses avisos como pendentes.'+last,'good'));
    else if(pending&&delivered)rows.push(statusRow('⚠️','Nenhum aviso pendente ou visível','Há um compromisso salvo, mas não foram encontrados avisos correspondentes. Revise o agendamento.','attention'));
    else rows.push(statusRow('ℹ️','Compromisso salvo','Não foi possível consultar o agendamento no sistema.'));
    if(!action||action.series!==task.base)rows.push(statusRow('ℹ️','Sem resposta registrada','Ainda não há uma ação registrada neste compromisso. Isso não comprova que você ignorou o aviso.'));
    }
   }else rows.push(statusRow('ℹ️','Nenhum compromisso ativo','Agende um lembrete em Notificações inteligentes.'));
   output.replaceChildren(...rows);
  }catch(err){output.replaceChildren(statusRow('⚠️','Não foi possível verificar',String(err?.message||err),'attention'))}
  finally{check.disabled=false;}
 }
 check.addEventListener('click',refresh);
 $('app-health-battery').addEventListener('click',async()=>{try{await (await api()).AppHealth.openBatterySettings()}catch(err){output.prepend(statusRow('⚠️','Configurações indisponíveis',String(err),'attention'))}});
 $('app-health-permissions').addEventListener('click',async()=>{try{await (await api()).AppHealth.openAppSettings()}catch(err){output.prepend(statusRow('⚠️','Configurações indisponíveis',String(err),'attention'))}});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!panel.hidden)refresh()});
 await refresh();
}
