/* Biblioteca privada multidisciplinar. A chave legada de Ecologia permanece intacta. */
const DB_NAME='eu-serei-biologo-private-v1', STORE='documents';
function checkId(id){if(!/^[a-z0-9][a-z0-9-]{0,79}$/.test(id))throw Error('Identificador de disciplina inválido.');return id;}
function db(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE);};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function transaction(kind,fn){const d=await db();return new Promise((resolve,reject)=>{const t=d.transaction(STORE,kind);let req;try{req=fn(t.objectStore(STORE));}catch(e){d.close();reject(e);return;}t.oncomplete=()=>{d.close();resolve(req.result);};t.onabort=t.onerror=()=>{d.close();reject(t.error||req.error||Error('Falha ao armazenar material.'));};});}
export async function readMaterial(id){return transaction('readonly',s=>s.get(checkId(id)));}
export async function listMaterialIds(){return transaction('readonly',s=>s.getAllKeys());}
const normalize=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function validateMaterial(id,html,title=''){
 checkId(id);
 if(typeof html!=='string'||!/<html(?:\s|>)/i.test(html.slice(0,4096)))throw Error('Selecione um documento HTML completo.');
 if(id==='ecologia-vegetal'){
  if(!/id=["']course-data["']/.test(html)||!/Ecologia Vegetal/i.test(html)||!html.includes('ecologia-vegetal-estudos-v1'))throw Error('Selecione o HTML interativo original de Ecologia Vegetal.');
 }else if(title&&!normalize(html.slice(0,16000)).includes(normalize(title)))throw Error('O título do HTML não corresponde à disciplina selecionada.');
}
export async function saveMaterial(id,file,title=''){
 const estimate=await navigator.storage?.estimate?.().catch(()=>null);
 if(estimate?.quota&&file.size>estimate.quota-estimate.usage)throw Error('Espaço de armazenamento insuficiente. Libere espaço e tente novamente.');
 const html=await file.text();validateMaterial(id,html,title);
 const entry={html,name:file.name,savedAt:new Date().toISOString(),pending:true};
 try{await transaction('readwrite',s=>s.put(entry,checkId(id)));}catch(e){if(e?.name==='QuotaExceededError')throw Error('Espaço insuficiente para armazenar o material.');throw e;}
 return entry;
}
export async function putRemoteMaterial(id,entry,expected){
 validateMaterial(id,entry.html);
 const d=await db();
 return new Promise((resolve,reject)=>{
  const t=d.transaction(STORE,'readwrite'),s=t.objectStore(STORE),req=s.get(checkId(id));let changed=false;
  req.onsuccess=()=>{const current=req.result;if((current?.savedAt||null)===(expected?.savedAt||null)&&(current?.version||null)===(expected?.version||null)&&Boolean(current?.pending)===Boolean(expected?.pending)){s.put(entry,id);changed=true;}};
  t.oncomplete=()=>{d.close();resolve(changed);};t.onabort=t.onerror=()=>{d.close();reject(t.error||Error('Falha na biblioteca local.'));};
 });
}
export async function removeMaterial(id){return transaction('readwrite',s=>s.delete(checkId(id)));}
export const readEcologia=()=>readMaterial('ecologia-vegetal');
export const saveEcologia=file=>saveMaterial('ecologia-vegetal',file,'Ecologia Vegetal');
export const removeEcologia=()=>removeMaterial('ecologia-vegetal');
