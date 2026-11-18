/* Sincronização Google Drive appDataFolder.
   OAuth via Google Identity Services: token somente em memória.
   Não colocar materiais acadêmicos privados nem chaves secretas no GitHub. */
import {readState,writeState} from './storage.js';
const FILE='EU_SEREI_BIOLOGO_state_v1.json';
const ECOLOGY_KEY='ecologia-vegetal-estudos-v1';
const SCOPES='https://www.googleapis.com/auth/drive.appdata';
const BASE='https://www.googleapis.com/drive/v3/files';
let token=null,tokenClient=null,syncBusy=false;
let expiry=0;
const isRecord=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const timestamp=x=>Date.parse(x||'')||0;
const validState=x=>isRecord(x)&&x.schemaVersion===1&&Array.isArray(x.sessions)&&Array.isArray(x.answers)&&isRecord(x.plans)&&isRecord(x.completed);
function readEcology(){
 const raw=localStorage.getItem(ECOLOGY_KEY);
 if(raw===null)return null;
 const result=JSON.parse(raw);
 if(!isRecord(result)||!isRecord(result.complete))throw Error('Progresso local de Ecologia inválido. Nada foi alterado.');
 return result;
}
function validEcology(x){return x===null||(isRecord(x)&&isRecord(x.complete));}
function mergeUnique(a,b){
 const map=new Map();
 for(const item of [...(Array.isArray(a)?a:[]),...(Array.isArray(b)?b:[])]){
  if(!isRecord(item))continue;
  const id=typeof item.id==='string'&&item.id?item.id:JSON.stringify(item);
  if(!map.has(id))map.set(id,item);
 }
 return [...map.values()];
}
function mergeStudy(local,remote){
 const newer=timestamp(local.updatedAt)>=timestamp(remote.updatedAt)?local:remote;
 const plans={...remote.plans};
 for(const [id,plan] of Object.entries(local.plans||{})){
  if(!plans[id]||timestamp(plan?.updatedAt)>=timestamp(plans[id]?.updatedAt))plans[id]=plan;
 }
 const completed={...remote.completed};
 for(const [key,val] of Object.entries(local.completed||{}))completed[key]=Boolean(completed[key])||Boolean(val);
 return {
  ...remote,...local,
  startDate:newer.startDate||local.startDate||remote.startDate||'',
  durationDays:newer.durationDays,
  preferences:{...remote.preferences,...newer.preferences},
  plans,completed,
  sessions:mergeUnique(remote.sessions,local.sessions),
  answers:mergeUnique(remote.answers,local.answers),
  reviewQueue:mergeUnique(remote.reviewQueue,local.reviewQueue),
  schemaVersion:1
 };
}
function mergeEcology(local,remote){
 if(!local)return remote;
 if(!remote)return local;
 const result={...remote,...local};
 const complete={...(remote.complete||{})};
 for(const [stage,when] of Object.entries(local.complete||{})){
  if(!complete[stage]||timestamp(when)>timestamp(complete[stage]))complete[stage]=when;
 }
 result.complete=complete;
 for(const key of ['checks','errors','review']){
  result[key]={...(isRecord(remote[key])?remote[key]:{}),...(isRecord(local[key])?local[key]:{})};
 }
 result.examHistory=mergeUnique(remote.examHistory,local.examHistory);
 // Não perder a posição mais avançada quando há progresso concluído no outro dispositivo.
 if(local.lastStage&&remote.lastStage){
  const rank=x=>{const m=/^e(\d+)_(\d+)$/.exec(x||'');return m?Number(m[1])*1000+Number(m[2]):0;};
  result.lastStage=rank(remote.lastStage)>rank(local.lastStage)?remote.lastStage:local.lastStage;
 }else result.lastStage=local.lastStage||remote.lastStage;
 return result;
}
function decodeRemote(raw){
 // Arquivo anterior era um estado simples; arquivos atuais incluem progresso de Ecologia.
 if(validState(raw))return {state:raw,ecology:null};
 if(!isRecord(raw)||!validState(raw.state)||!validEcology(raw.ecologyProgress))throw Error('Formato remoto desconhecido. Nenhum dado foi sobrescrito.');
 return {state:raw.state,ecology:raw.ecologyProgress||null};
}
function loadGIS(){
 if(window.google?.accounts?.oauth2)return Promise.resolve();
 return new Promise((resolve,reject)=>{
  const existing=document.querySelector('script[data-google-drive-gis]');
  if(existing){existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',()=>reject(Error('Falha na autenticação Google.')),{once:true});return;}
  const script=document.createElement('script');script.dataset.googleDriveGis='true';
  script.src='https://accounts.google.com/gsi/client';script.async=true;
  script.onload=resolve;script.onerror=()=>reject(Error('Falha ao carregar autenticação Google.'));
  document.head.append(script);
 });
}
export async function connectDrive(clientId){
 const id=String(clientId||'').trim();
 if(!/^[\w-]+\.apps\.googleusercontent\.com$/.test(id))throw Error('ID OAuth inválido. Use o Client ID Web (não o Client Secret).');
 await loadGIS();
 return new Promise((resolve,reject)=>{
  tokenClient=window.google.accounts.oauth2.initTokenClient({
   client_id:id,scope:SCOPES,
   callback:reply=>{
    if(reply.error||!reply.access_token){reject(Error(reply.error||'Autorização não concedida.'));return;}
    token=reply.access_token;
    expiry=Date.now()+Math.max(0,(Number(reply.expires_in)||3500)-60)*1000;
    resolve(true);
   },
   error_callback:()=>reject(Error('Autorização Google cancelada ou bloqueada.'))
  });
  tokenClient.requestAccessToken({prompt:'consent'});
 });
}
export function connected(){return Boolean(token&&Date.now()<expiry);}
async function request(url,options={}){
 if(!connected()){token=null;throw Error('Sessão Google expirada. Conecte novamente para retomar.');}
 const headers=new Headers(options.headers||{});headers.set('Authorization','Bearer '+token);
 const response=await fetch(url,{...options,headers});
 if(response.status===401||response.status===403&&response.headers.get('www-authenticate')?.includes('invalid_token')){
  token=null;throw Error('Sessão Google expirada. Conecte novamente.');
 }
 if(!response.ok)throw Error('Google Drive retornou HTTP '+response.status+': '+(await response.text()).slice(0,180));
 return response;
}
async function listFiles(){
 const files=[];let next='';
 do{
  const query=new URLSearchParams({spaces:'appDataFolder',fields:'nextPageToken,files(id,name,modifiedTime)',pageSize:'100'});
  if(next)query.set('pageToken',next);
  const response=await request(BASE+'?'+query);
  const data=await response.json();
  files.push(...(data.files||[]));next=data.nextPageToken||'';
 }while(next);
 return files.filter(f=>f.name===FILE);
}
async function download(id){
 const response=await request(BASE+'/'+encodeURIComponent(id)+'?alt=media');
 return response.json();
}
async function create(payload){
 const boundary='----eusereibiologo'+Math.random().toString(16).slice(2);
 const metadata=JSON.stringify({name:FILE,mimeType:'application/json',parents:['appDataFolder']});
 const body='--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+metadata+
 '\r\n--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify(payload)+'\r\n--'+boundary+'--';
 await request('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',{
  method:'POST',headers:{'Content-Type':'multipart/related; boundary='+boundary},body
 });
}
async function update(id,payload){
 await request('https://www.googleapis.com/upload/drive/v3/files/'+encodeURIComponent(id)+'?uploadType=media',{
  method:'PATCH',headers:{'Content-Type':'application/json; charset=UTF-8'},body:JSON.stringify(payload)
 });
}
export async function syncDrive(){
 if(syncBusy)throw Error('Sincronização já em andamento.');
 syncBusy=true;
 try{
  const local=readState(),localEcology=readEcology();
  if(!validState(local))throw Error('Formato local incompatível.');
  // Cópia de segurança antes de alterar qualquer registro ou arquivo remoto.
  localStorage.setItem('eu-serei-biologo-pre-sync-backup',JSON.stringify({
   backupFormat:'eu-serei-biologo-completo-v2',createdAt:new Date().toISOString(),
   state:local,ecologyProgress:localEcology,ecologyPresent:localEcology!==null
  }));
  const files=await listFiles();
  if(files.length>1)throw Error('Existem arquivos de sincronização duplicados no Drive.');
  const remoteFile=files[0];
  let remote={state:local,ecology:null};
  if(remoteFile)remote=decodeRemote(await download(remoteFile.id));
  const merged=mergeStudy(local,remote.state);
  const ecology=mergeEcology(localEcology,remote.ecology);
  const syncAt=new Date().toISOString();
  merged.sync={...(merged.sync||{}),provider:'google-drive',lastSyncedAt:syncAt};
  const payload={
   schemaVersion:2,updatedAt:syncAt,state:merged,ecologyProgress:ecology
  };
  // Detecta alterações durante a leitura; não é garantia de escrita transacional.
  const check=await listFiles();
  if(check.length!==files.length||check[0]?.id!==remoteFile?.id||check[0]?.modifiedTime!==remoteFile?.modifiedTime)throw Error('Os dados do Drive mudaram durante a sincronização. Tente novamente.');
  // Se algum registro local mudou durante a espera pela rede, não sobrescrevê-lo.
  if(JSON.stringify(readState())!==JSON.stringify(local)||JSON.stringify(readEcology())!==JSON.stringify(localEcology))throw Error('O estudo mudou durante a sincronização. Nova tentativa necessária.');
  if(remoteFile)await update(remoteFile.id,payload);else await create(payload);
  // Escreve primeiro o progresso de etapas e depois o estado geral.
  if(ecology!==null)localStorage.setItem(ECOLOGY_KEY,JSON.stringify(ecology));
  writeState(merged);
  return {at:syncAt,sessions:merged.sessions.length,plans:Object.keys(merged.plans).length,stages:Object.values(ecology?.complete||{}).filter(Boolean).length};
 }finally{syncBusy=false;}
}
export function disconnectDrive(){token=null;expiry=0;tokenClient=null;}
