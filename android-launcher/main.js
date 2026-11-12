const URL='https://brunopdiogo-a11y.github.io/Eu-serei-BIOLOGO/';
const button=document.getElementById('open');
const message=document.getElementById('message');
async function open(){
 button.disabled=true;
 try{
  if(window.Capacitor?.Plugins?.Browser?.open){
   await window.Capacitor.Plugins.Browser.open({url:URL,toolbarColor:'#25764a'});
  }else{
   window.location.href=URL;
  }
 }catch(err){
  message.textContent='Não foi possível abrir a página: '+(err?.message||'verifique a conexão.');
  window.open(URL,'_blank');
 }finally{button.disabled=false;}
}
button.addEventListener('click',open);
document.getElementById('help').addEventListener('click',()=>{
 message.textContent='No site, abra Configurações → Google Drive. Conecte a mesma conta do notebook e toque em Sincronizar agora. Os materiais privados de Ecologia Vegetal devem ser importados em cada aparelho. Antes de remover o APK antigo, exporte um backup.';
});
