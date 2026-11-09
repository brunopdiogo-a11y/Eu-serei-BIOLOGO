const KEY = 'estudos:v1';
const empty = () => ({schemaVersion:1,deviceId:null,updatedAt:null,startDate:'',durationDays:30,completed:{},answers:[],reviewQueue:[],sync:{lastSyncedAt:null}});
export function readState(){
  try {const raw=JSON.parse(localStorage.getItem(KEY)||'null');return raw && raw.schemaVersion===1 ? {...empty(),...raw}:empty();}
  catch {return empty();}
}
export function writeState(next){
  const value={...next,updatedAt:new Date().toISOString()};
  localStorage.setItem(KEY,JSON.stringify(value));
  return value;
}
export function exportState(){return JSON.stringify(readState(),null,2);}
export function importState(text){
  const data=JSON.parse(text);
  if(data.schemaVersion!==1 || typeof data.completed!=='object' || !Array.isArray(data.answers)) throw new Error('Backup incompatível');
  return writeState(data);
}
