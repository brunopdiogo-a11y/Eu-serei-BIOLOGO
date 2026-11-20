import {registerPlugin} from '@capacitor/core';
import {LocalNotifications} from '@capacitor/local-notifications';
const Weekly=registerPlugin('WeeklyStudyAlarm');
const $=id=>document.getElementById(id);
const names=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
let items=[],editing=0,busy=false;
const feedback=s=>{$('weekly-feedback').textContent=s;};
const pad=n=>String(n).padStart(2,'0');
const formatDays=mask=>[1,2,3,4,5,6,0].filter(n=>mask&(1<<n)).map(n=>names[n]).join(', ');
function setEditor(slot){
 editing=slot?.id||0;
 $('weekly-editor-title').textContent=editing?'✎ Editar horário':'➕ Novo horário';
 $('weekly-course').value=slot?.course||'Ecologia Vegetal';
 $('weekly-mode').value=slot?.mode||'alarm';
 $('weekly-time').value=slot?pad(slot.hour)+':'+pad(slot.minute):'08:30';
 for(const check of $('weekly-days').querySelectorAll('input[type=checkbox]')){
  const day=Number(check.value);
  check.checked=slot?Boolean(slot.days&(1<<day)):(day>=1&&day<=5);
 }
 $('weekly-save').textContent=editing?'Salvar alterações':'Adicionar lembrete';
 feedback('');
}
function render(){
 const area=$('weekly-items');area.replaceChildren();
 if(!items.length){
  const empty=document.createElement('p');empty.className='weekly-empty';
  empty.textContent='Nenhum horário cadastrado. Escolha os dias e toque em Adicionar lembrete.';
  area.append(empty);return;
 }
 const ordered=[...items].sort((a,b)=>a.hour*60+a.minute-b.hour*60-b.minute);
 for(const slot of ordered){
  const card=document.createElement('div');card.className='weekly-entry';
  const title=document.createElement('strong');
  title.textContent='⏰ '+pad(slot.hour)+':'+pad(slot.minute)+' · '+slot.course;
  card.append(title);
  const days=document.createElement('p');days.className='weekly-help';
  days.textContent='📅 '+formatDays(slot.days);card.append(days);
  const kind=document.createElement('p');kind.className='weekly-help';kind.textContent=slot.mode==='standard'?'🔔 Notificação discreta':'🔊 Alarme com som';card.append(kind);
  const next=document.createElement('p');next.className='weekly-help';
  next.textContent='Próxima cobrança: '+new Date(slot.nextAt).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});
  card.append(next);
  const actions=document.createElement('div');actions.className='weekly-actions';
  const edit=document.createElement('button');edit.className='alt';edit.textContent='✎ Editar';
  edit.onclick=()=>{setEditor(slot);$('weekly-editor').scrollIntoView({behavior:'smooth',block:'center'});};
  const done=document.createElement('button');done.className='alt';done.textContent='✅ Estudei hoje';
  done.onclick=()=>void perform(async()=>{
   const result=await Weekly.finish({id:slot.id});items=result.items||[];
   feedback('✅ Cobranças deste compromisso encerradas hoje. Os próximos dias continuam ativos.');
  });
  const remove=document.createElement('button');remove.className='warn';remove.textContent='Excluir';
  remove.onclick=()=>{if(!confirm('Excluir este horário e suas próximas cobranças?'))return;
   void perform(async()=>{const result=await Weekly.remove({id:slot.id});items=result.items||[];
    if(editing===slot.id)setEditor(null);
    feedback('Horário excluído. Outros lembretes continuam ativos.');
   });
  };
  actions.append(edit,done,remove);card.append(actions);area.append(card);
 }
}
async function perform(action){
 if(busy)return;
 busy=true;$('weekly-save').disabled=true;
 try{await action();render();}catch(err){feedback('⚠️ '+(err?.message||String(err)));}
 finally{busy=false;$('weekly-save').disabled=false;}
}
async function refresh(){
 const data=await Weekly.list();items=Array.isArray(data.items)?data.items:[];render();
}
export async function setupWeeklyReminders(){
 $('weekly-save').addEventListener('click',()=>void perform(async()=>{
  const time=$('weekly-time').value;
  if(!/^\d\d:\d\d$/.test(time))throw Error('Escolha um horário válido.');
  const [hour,minute]=time.split(':').map(Number);
  let days=0;for(const check of $('weekly-days').querySelectorAll('input:checked'))days|=1<<Number(check.value);
  if(!days)throw Error('Selecione pelo menos um dia da semana.');
  if(hour<7||hour>=22)throw Error('Escolha um horário entre 07h00 e 21h59.');
  if(!$('enabled').checked)throw Error('Ative a cobrança inteligente antes de salvar.');
  const current=await LocalNotifications.checkPermissions();
  if(current.display!=='granted'){
   const requested=await LocalNotifications.requestPermissions();
   if(requested.display!=='granted')throw Error('Autorize notificações nas configurações do Android.');
  }
  const payload={id:editing,days,hour,minute,course:$('weekly-course').value,mode:$('weekly-mode').value};
  const response=await Weekly.save(payload);
  items=response.items||[];setEditor(null);
  feedback('✅ Horário semanal salvo. Os demais lembretes foram preservados.');
 }));
 $('weekly-reset').addEventListener('click',()=>setEditor(null));
 $('weekly-permission').addEventListener('click',()=>document.getElementById('permission').click());
 $('enabled').addEventListener('change',event=>void perform(async()=>{
  const data=await Weekly.setAllEnabled({enabled:event.target.checked});
  items=data.items||[];
  feedback(event.target.checked?'✅ Agenda semanal reativada.':'⏸ Todos os horários semanais estão pausados.');
 }));
 setEditor(null);
 try{await refresh();}catch(err){feedback('⚠️ Agenda semanal indisponível. Instale o APK atualizado. '+(err?.message||''));}
}
