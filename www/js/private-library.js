const DB_NAME='eu-serei-biologo-private-v1', STORE='documents', NAME='ecologia-vegetal';
function db(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE);};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function transaction(kind,fn){const d=await db();return await new Promise((resolve,reject)=>{const t=d.transaction(STORE,kind),s=t.objectStore(STORE),req=fn(s);req.onerror=()=>reject(req.error);t.oncomplete=()=>{const result=req.result;d.close();resolve(result);};t.onerror=()=>{d.close();reject(t.error);};t.onabort=()=>{d.close();reject(t.error||Error('Importação interrompida.'));};});}
import {courses} from './data.js';
export function progressKey(id){return id===NAME?'ecologia-vegetal-estudos-v1':'eu-serei-biologo-course-progress:'+id;}
function known(id){const c=courses.find(x=>x.id===id);if(!c)throw Error('Disciplina desconhecida.');return c;}
const norm=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export async function readCourse(id){known(id);return transaction('readonly',s=>s.get(id));}
export async function removeCourse(id){known(id);return transaction('readwrite',s=>s.delete(id));}
export async function saveCourse(id,file){
 const c=known(id);
 const estimate=await navigator.storage?.estimate?.().catch(()=>null);
 if(estimate?.quota && Number.isFinite(estimate.usage) && file.size>estimate.quota-estimate.usage)throw Error('Espaço de armazenamento insuficiente.');
 const html=await file.text();
 const title=html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'';
 if(!norm(title).includes(norm(c.title)) && !(id==='inventariamento'&&norm(title).includes('inventariamento')) && !(id==='sensoriamento'&&norm(title).includes('sensoriamento')))throw Error('O título do HTML não corresponde à disciplina selecionada.');
 let format='standard';
 if(id===NAME){
  if(!/id=["']course-data["']/.test(html)||!html.includes(progressKey(id)))throw Error('Selecione o HTML interativo original de Ecologia Vegetal.');
 }else if(id==='propagacao-vegetativa'&&html.includes('pv-proto-done')&&html.includes('id="sel"')&&html.includes('id="main"')){
  format='propagation-prototype';
 }else if(!/id=["']course-data["']/.test(html)||!html.includes(progressKey(id))){
  throw Error('HTML ainda não preparado para integração: precisa de course-data e chave de progresso própria da disciplina.');
 }
 return transaction('readwrite',s=>s.put({html,name:file.name,savedAt:new Date().toISOString(),courseId:id,format},id));
}
export const readEcologia=()=>readCourse(NAME);
export const removeEcologia=()=>removeCourse(NAME);
export const saveEcologia=file=>saveCourse(NAME,file);
export function prepareReader(entry,id){
 if(entry.format!=='propagation-prototype')return entry.html;
 // Preserve the original HTML and adapt only the prototype progress script at runtime.
 const key=JSON.stringify(progressKey(id));
 const original='let done=JSON.parse(localStorage.getItem("pv-proto-done")||"[]");';
 const replacement='const key='+key+';function readProgress(){return JSON.parse(localStorage.getItem(key)||"{}")}let done=Object.keys(readProgress().complete||{}).filter(k=>/^s\\d+$/.test(k)).map(k=>Number(k.slice(1)));function persist(){const p=readProgress();p.complete={...(p.complete||{})};done.forEach(n=>{p.complete["s"+n]=p.complete["s"+n]||new Date().toISOString()});p.lastStage="s"+i;p.updatedAt=new Date().toISOString();localStorage.setItem(key,JSON.stringify(p));}';
 if(!entry.html.includes(original))throw Error('Versão do protótipo incompatível.');
 return entry.html.replace(original,replacement).replace('localStorage.setItem("pv-proto-done",JSON.stringify(done));','persist();').replace('s.value=i;document.querySelector','s.value=i;persist();document.querySelector').replace('};show(0)</script>','};show(Number(String(readProgress().lastStage||"s0").slice(1))||0)</script>');
}
