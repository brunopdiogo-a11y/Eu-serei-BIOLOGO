const DB_NAME='eu-serei-biologo-private-v1', STORE='documents', NAME='ecologia-vegetal';
function db(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE);};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function transaction(kind,fn){const d=await db();return await new Promise((resolve,reject)=>{const t=d.transaction(STORE,kind),s=t.objectStore(STORE),req=fn(s);req.onerror=()=>reject(req.error);t.oncomplete=()=>{const result=req.result;d.close();resolve(result);};t.onerror=()=>{d.close();reject(t.error);};t.onabort=()=>{d.close();reject(t.error||Error('Importação interrompida.'));};});}
export async function readEcologia(){return transaction('readonly',s=>s.get(NAME));}
export async function saveEcologia(file){
 const estimate=await navigator.storage?.estimate?.().catch(()=>null);
 if(estimate?.quota && Number.isFinite(estimate.usage) && file.size>estimate.quota-estimate.usage)throw Error('Espaço de armazenamento insuficiente para importar este material.');
 const html=await file.text();
 if(!/id=["']course-data["']/.test(html)||!/Ecologia Vegetal/i.test(html)||!html.includes('ecologia-vegetal-estudos-v1'))throw Error('Selecione o HTML interativo original de Ecologia Vegetal.');
 return transaction('readwrite',s=>s.put({html,name:file.name,savedAt:new Date().toISOString()},NAME));
}
export async function removeEcologia(){return transaction('readwrite',s=>s.delete(NAME));}
