import { Browser } from '@capacitor/browser';
const URL='https://brunopdiogo-a11y.github.io/Eu-serei-BIOLOGO/';
const button=document.getElementById('open');
const message=document.getElementById('message');
button.addEventListener('click',async()=>{
 button.disabled=true;
 try{await Browser.open({url:URL,toolbarColor:'#25764a'});}
 catch(err){message.textContent='Não foi possível abrir a aba integrada. Use o acesso direto abaixo.';const a=document.createElement('a');a.href=URL;a.target='_blank';a.rel='noopener noreferrer';a.textContent='🌐 Abrir no Chrome';a.style.cssText='display:block;margin-top:12px;color:#196a40;font-weight:700';message.append(a);}
 finally{button.disabled=false;}
});
document.getElementById('help').addEventListener('click',()=>{
 message.textContent='Entre em Configurações → Google Drive usando a mesma conta do notebook e selecione Sincronizar agora. Os materiais privados devem ser importados individualmente. Exporte backup antes de remover o APK antigo.';
});
