/* Google Drive AppData sync, OAuth token client (Google Identity Services).
 * The OAuth Client ID is public configuration, NEVER a client secret.
 * We do not store access tokens or private study files in the repository. */
import {readState,writeState} from './storage.js';
const FILE='EU_SEREI_BIOLOGO_state_v1.json';
const SCOPES='https://www.googleapis.com/auth/drive.appdata';
const BASE='https://www.googleapis.com/drive/v3/files';
let token=null,tokenClient=null,clientId='',syncBusy=false;
function loadGIS(){
 if(window.google?.accounts?.oauth2)return Promise.resolve();
 return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.async=true;s.onload=resolve;s.onerror=()=>reject(Error('Falha ao carregar autenticação Google.'));document.head.append(s);});
}
export async function connectDrive(id){
 clientId=id.trim();
 if(!/^[\w-]+\.apps\.googleusercontent\.com$/.test(clientId))throw Error('ID OAuth inválido. Use o Client ID de aplicativo Web, nunca o Client Secret.');
 await loadGIS();
 return await new Promise((resolve,reject)=>{
  tokenClient=window.google.accounts.oauth2.initTokenClient({client_id:clientId,scope:SCOPES,callback:(r)=>{
   if(r.error||!r.access_token){reject(Error(r.error||'Autorização não concedida.'));return;}
   token=r.access_token;resolve(true);
  },error_callback:()=>reject(Error('Janela de autorização cancelada ou bloqueada.'))});
  tokenClient.requestAccessToken({prompt:'consent'});
 });
}
export function connected(){return !!token;}
async function request(url,options={}){
 if(!token)throw Error('Conecte sua conta Google novamente.');
 const headers=new Headers(options.headers||{});headers.set('Authorization','Bearer '+token);
 const r=await fetch(url,{...options,headers});
 if(r.status===401){token=null;throw Error('Sessão Google expirada. Conecte novamente.');}
 if(!r.ok)throw Error('Drive retornou HTTP '+r.status+': '+(await r.text()).slice(0,260));
 return r;
}
async function listFiles(){
 const q=new URLSearchParams({spaces:'appDataFolder',fields:'nextPageToken,files(id,name,modifiedTime)',page_size:'100',pageSize:'100'});
 const r=await request(BASE+'?'+q.toString());
 const all=(await r.json()).files||[];
 return all.filter(x=>x.name===FILE);
}
async function download(id){const r=await request(BASE+'/'+encodeURIComponent(id)+'?alt=media');return await r.json();}
async function create(payload){
 const boundary='----eusereibiologo'+Math.random().toString(16).slice(2);
 const metadata=JSON.stringify({name:FILE,mimeType:'application/json',parents:['appDataFolder']});
 const body='--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+metadata+'\r\n--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify(payload)+'\r\n--'+boundary+'--';
 const r=await request('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name',{method:'POST',headers:{'Content-Type':'multipart/related; boundary='+boundary},body});return r.json();
}
async function update(id,payload){
 const r=await request('https://www.googleapis.com/upload/drive/v3/files/'+encodeURIComponent(id)+'?uploadType=media&fields=id,modifiedTime',{method:'PATCH',headers:{'Content-Type':'application/json; charset=UTF-8'},body:JSON.stringify(payload)});return r.json();
}
const date=x=>Date.parse(x||'')||0;
function uniqBy(arr,keyfn){
 const m=new Map();for(const item of arr||[]){const key=keyfn(item);if(key)m.set(key,item);}
 return [...m.values()];
}
function merge(local,remote){
 const both={...remote,...local};
 const plans={...(remote.plans||{})};
 for(const [id,p] of Object.entries(local.plans||{})){if(!plans[id]||date(p.updatedAt)>=date(plans[id].updatedAt))plans[id]=p;}
 const completed={...(remote.completed||{})};for(const [k,v] of Object.entries(local.completed||{}))completed[k]=!!completed[k]||!!v;
 const sessions=uniqBy([...(remote.sessions||[]),...(local.sessions||[])],x=>x.id);
 const answers=uniqBy([...(remote.answers||[]),...(local.answers||[])],x=>x.id||JSON.stringify(x));
 const reviewQueue=uniqBy([...(remote.reviewQueue||[]),...(local.reviewQueue||[])],x=>x.id||JSON.stringify(x));
 const preferences=date(local.updatedAt)>=date(remote.updatedAt)?local.preferences:remote.preferences;
 return {...both,plans,completed,sessions,answers,reviewQueue,preferences,schemaVersion:1,sync:{...(local.sync||{}),lastSyncedAt:new Date().toISOString(),provider:'google-drive'}};
}
export async function syncDrive(){
 if(syncBusy)throw Error('Uma sincronização já está em andamento.');
 syncBusy=true;
 try{
  const local=readState();
  if(!local.schemaVersion||local.schemaVersion!==1)throw Error('Formato local incompatível.');
  // Backup before any merge. Never destroy the existing local snapshot.
  localStorage.setItem('eu-serei-biologo-pre-sync-backup',JSON.stringify(local));
  const files=await listFiles();
  if(files.length>1)throw Error('Há mais de um arquivo de sincronização no Drive. Resolva duplicatas antes de prosseguir.');
  let merged=local,remoteFile=files[0];
  if(remoteFile){
   const remote=await download(remoteFile.id);
   if(remote.schemaVersion!==1||!Array.isArray(remote.sessions)||!remote.plans)throw Error('Formato do arquivo remoto desconhecido. Nada foi sobrescrito.');
   merged=merge(local,remote);
  }else merged={...local,sync:{...(local.sync||{}),lastSyncedAt:new Date().toISOString(),provider:'google-drive'}};
  // Revalidate before writing to reduce collision risk, with no claim of full atomicity.
  const check=await listFiles();
  if(check.length!==files.length||check[0]?.modifiedTime!==remoteFile?.modifiedTime)throw Error('O Drive mudou durante a sincronização. Tente novamente.');
  if(remoteFile)await update(remoteFile.id,merged);else await create(merged);
  writeState(merged);
  return {at:merged.sync.lastSyncedAt,sessions:merged.sessions.length,plans:Object.keys(merged.plans).length};
 }finally{syncBusy=false;}
}
export function disconnectDrive(){token=null;tokenClient=null;}
