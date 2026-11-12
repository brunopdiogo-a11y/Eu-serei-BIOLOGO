import { Browser } from '@capacitor/browser';
const URL='https://brunopdiogo-a11y.github.io/Eu-serei-BIOLOGO/';
const button=document.getElementById('open');
const message=document.getElementById('message');
button.addEventListener('click',async()=>{
 button.disabled=true;
 try{await Browser.open({url:URL,toolbarColor:'#25764a'});}
 catch(err){message.textContent='Falha ao abrir: '+(err?.message||'verifique o navegador.');}
 finally{button.disabled=false;}
});
document.getElementById('help').addEventListener('click',()=>{
 message.textContent='Entre em Configurações → Google Drive usando a mesma conta do notebook e selecione Sincronizar agora. Os materiais privados devem ser importados individualmente. Exporte backup antes de remover o APK antigo.';
});
