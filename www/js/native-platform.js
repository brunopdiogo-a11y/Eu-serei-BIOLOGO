/* Controles adicionais disponíveis somente no APK Capacitor.
   O computador continua usando o mesmo HTML, sem botões Android. */
function onNativeAndroid(){
  return Boolean(window.Capacitor?.isNativePlatform?.() && window.Capacitor?.getPlatform?.()==='android');
}
export function initNativePlatform(){
  if(!onNativeAndroid())return;
  const hero=document.querySelector('#view-home .hero');
  if(!hero)return;
  const btn=document.createElement('button');
  btn.type='button';btn.className='btn ghost';
  btn.textContent='🔔 Cobrança inteligente';
  btn.setAttribute('aria-label','Abrir lembretes nativos do Android');
  btn.addEventListener('click',()=>{window.location.href='./reminders.html';});
  hero.append(btn);
}
initNativePlatform();
