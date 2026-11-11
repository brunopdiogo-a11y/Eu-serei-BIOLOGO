const KEY='estudos:v1';
const empty=()=>({schemaVersion:1,deviceId:null,updatedAt:null,startDate:'',durationDays:30,completed:{},answers:[],reviewQueue:[],sync:{lastSyncedAt:null},plans:{},sessions:[],preferences:{inAppAlerts:true,browserAlerts:false}});
function normalized(x){return {...empty(),...x,plans:x.plans&&typeof x.plans==='object'&&!Array.isArray(x.plans)?x.plans:{},sessions:Array.isArray(x.sessions)?x.sessions:[],preferences:{inAppAlerts:true,browserAlerts:false,...(x.preferences||{})},completed:x.completed||{},answers:x.answers||[]};}
export function readState(){try{const x=JSON.parse(localStorage.getItem(KEY)||'null');return x&&x.schemaVersion===1?normalized(x):empty();}catch{return empty();}}
export function writeState(state){const next=normalized({...state,updatedAt:new Date().toISOString()});localStorage.setItem(KEY,JSON.stringify(next));return next;}
export function exportState(){return JSON.stringify(readState(),null,2);}
export function importState(text){const x=JSON.parse(text);if(x.schemaVersion!==1||!x.completed||typeof x.completed!=='object'||!Array.isArray(x.answers))throw Error('Formato de backup incompatível');return writeState(normalized(x));}
