/* Recursos Android aparecem em Configurações; computador mantém o HTML. */
export function initNativePlatform(){
  const native=Boolean(window.Capacitor?.isNativePlatform?.()&&window.Capacitor?.getPlatform?.()==='android');
  const button=document.getElementById('native-reminders-open');
  const note=document.getElementById('native-reminders-note');
  if(!native)return;
  document.body.classList.add('native-android');
  initApkUpdates();
  if(!button)return;
  button.hidden=false;
  if(note)note.hidden=true;
  button.addEventListener('click',()=>{window.location.href='./reminders.html';});
  import('./app-diagnostics.js').then(m=>m.initDiagnostics()).catch(err=>console.warn('Diagnóstico Android indisponível:',err));
}
initNativePlatform();

async function initApkUpdates(){
  const base='https://github.com/brunopdiogo-a11y/Eu-serei-BIOLOGO/releases/download/android-preview/';
  const api='https://api.github.com/repos/brunopdiogo-a11y/Eu-serei-BIOLOGO/releases/tags/android-preview';
  const panel=document.createElement('section');
  panel.style.cssText='padding:12px;margin:12px 0;border:1px solid #888;border-radius:12px;';
  const status=document.createElement('p');
  status.textContent='Atualizações do aplicativo';
  const check=document.createElement('button');
  check.type='button';check.textContent='Verificar atualização';
  const link=document.createElement('a');
  link.href=base+'EU_SEREI_BIOLOGO.apk';link.target='_blank';link.rel='noopener';link.textContent='Baixar APK assinado';link.hidden=true;link.style.cssText='display:none;margin:12px 0;';
  panel.append(status,check,link);
  const anchor=document.getElementById('native-reminders-open');
  if(anchor)anchor.after(panel);else document.body.append(panel);
  let checking=false;
  async function verify(manual=false){
    if(checking)return;
    checking=true;check.disabled=true;
    try{
      const {installedBuild}=await import('./installed-build.js');
      const res=await fetch(api,{cache:'no-store'});
      if(!res.ok)throw Error('GitHub indisponível');
      const release=await res.json();
      const meta=release.assets?.find(a=>a.name==='android-update.json');
      const apk=release.assets?.find(a=>a.name==='EU_SEREI_BIOLOGO.apk');
      if(!meta||!apk)throw Error('Versão ainda não publicada');
      const response=await fetch(meta.browser_download_url+'?v='+meta.id,{cache:'no-store'});
      if(!response.ok)throw Error('Manifesto indisponível');
      const info=await response.json();
      if(!Number.isSafeInteger(info.versionCode))throw Error('Versão inválida');
      const newer=info.versionCode>installedBuild;
      status.textContent=newer?'Nova versão disponível: '+info.versionName+' (build '+info.versionCode+')':'Aplicativo atualizado (build '+installedBuild+')';
      link.hidden=!newer;link.style.display=newer?'block':'none';
      if(newer&&(manual||localStorage.getItem('apk-update-notified')!==String(info.versionCode))){
        localStorage.setItem('apk-update-notified',String(info.versionCode));
        if(confirm('Nova versão do EU SEREI BIOLOGO disponível. Baixar o APK assinado? Instale por cima da versão atual, sem desinstalar.'))window.open(link.href,'_blank');
      }
    }catch(e){status.textContent='Não foi possível verificar agora. Tente novamente com internet.';if(manual){link.hidden=false;link.style.display='block';}}
    finally{checking=false;check.disabled=false;}
  }
  check.addEventListener('click',()=>verify(true));
  verify();
}
