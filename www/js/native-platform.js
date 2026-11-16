/* Recursos Android aparecem em Configurações; computador mantém o HTML. */
export function initNativePlatform(){
  const native=Boolean(window.Capacitor?.isNativePlatform?.()&&window.Capacitor?.getPlatform?.()==='android');
  const button=document.getElementById('native-reminders-open');
  const note=document.getElementById('native-reminders-note');
  if(!native||!button)return;
  button.hidden=false;
  if(note)note.hidden=true;
  button.addEventListener('click',()=>{window.location.href='./reminders.html';});
}
initNativePlatform();
