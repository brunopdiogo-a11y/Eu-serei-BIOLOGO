/* Caderno geral. Reúne somente notas dos registros locais de cada disciplina.
   Sincronização e backup existentes já incluem esses registros. */
export function initNotesHub({courses,onChanged}){
 const $=id=>document.getElementById(id);
 const filter=$('notes-course-filter'),search=$('notes-search'),collection=$('notes-collection');
 const summary=$('notes-summary'),feedback=$('notes-feedback'),editor=$('notes-editor');
 const textarea=$('notes-editor-text'),origin=$('notes-editor-origin'),excerpt=$('notes-editor-excerpt');
 const PREFIX='eu-serei-biologo-course-progress:';
 let editing=null;
 for(const course of courses){
  const option=document.createElement('option');option.value=course.id;option.textContent=course.title;
  filter.append(option);
 }
 const isRecord=x=>x&&typeof x==='object'&&!Array.isArray(x);
 function read(id){
  const stored=localStorage.getItem(PREFIX+id);
  if(!stored)return {version:1,notes:[]};
  const value=JSON.parse(stored);
  if(!isRecord(value))throw Error('Dados inválidos para '+id);
  return value;
 }
 function write(id,record,notes){
  localStorage.setItem(PREFIX+id,JSON.stringify({...record,notes,updatedAt:new Date().toISOString()}));
  window.dispatchEvent(new CustomEvent('eusereibiologo:notes-changed',{detail:{courseId:id}}));
  onChanged?.();
 }
 function allNotes(){
  const rows=[];
  const ids=new Set(courses.map(c=>c.id));
  for(let i=0;i<localStorage.length;i++){
   const key=localStorage.key(i);
   if(key?.startsWith(PREFIX))ids.add(key.slice(PREFIX.length));
  }
  for(const id of ids){
   const info=read(id),name=courses.find(c=>c.id===id)?.title||id;
   for(const note of Array.isArray(info.notes)?info.notes:[]){
    if(isRecord(note)&&!note.deletedAt)rows.push({note,courseId:id,courseName:name});
   }
  }
  return rows.sort((a,b)=>String(b.note.updatedAt||b.note.createdAt||'')
    .localeCompare(String(a.note.updatedAt||a.note.createdAt||'')));
 }
 function contentTarget(entry){
  const {courseId,note}=entry;
  if(courseId!=='ecologia-vegetal'){
   feedback.textContent='A disciplina '+entry.courseName+' ainda não possui um leitor integrado. Você pode consultar a nota aqui.';
   return;
  }
  // Apenas contexto e identificadores de notas. Não envia o HTML acadêmico privado.
  const context={courseId,stageId:String(note.stageId||''),
    stage:String(note.stage||''),excerpt:String(note.excerpt||'').slice(0,1800)};
  sessionStorage.setItem('eusereibiologo-open-note-v1',JSON.stringify(context));
  location.href='./ecologia-privada.html?from=notes';
 }
 function startEdit(entry){
  editing={courseId:entry.courseId,id:entry.note.id};
  origin.textContent=entry.courseName+' · '+(entry.note.stage||'Etapa não identificada');
  excerpt.textContent=entry.note.excerpt||'';
  textarea.value=entry.note.text||'';
  editor.hidden=false;
  editor.scrollIntoView({behavior:'smooth',block:'nearest'});
  textarea.focus();
 }
 function closeEdit(){editing=null;editor.hidden=true;textarea.value='';}
 $('notes-editor-cancel').addEventListener('click',closeEdit);
 $('notes-editor-save').addEventListener('click',()=>{
  if(!editing)return;
  const text=textarea.value.trim();
  // Trechos destacados permanecem válidos mesmo sem comentário.
  try{
   const data=read(editing.courseId),notes=Array.isArray(data.notes)?data.notes.slice():[];
   const i=notes.findIndex(x=>x.id===editing.id&&!x.deletedAt);
   if(i<0)throw Error('A anotação não foi encontrada.');
   notes[i]={...notes[i],text,updatedAt:new Date().toISOString()};
   write(editing.courseId,data,notes);
   closeEdit();feedback.textContent=text?'✅ Anotação atualizada.':'✅ Trecho mantido sem comentário.';render();
  }catch(error){feedback.textContent='⚠️ '+error.message}
 });
 function render(){
  collection.replaceChildren();
  let all;
  try{all=allNotes()}catch(error){feedback.textContent='⚠️ '+error.message;return;}
  const q=search.value.trim().toLocaleLowerCase('pt-BR');
  const selected=filter.value;
  const rows=all.filter(e=>(!selected||e.courseId===selected)&&
    (!q||[e.courseName,e.note.stage,e.note.excerpt,e.note.text].some(t=>
      String(t||'').toLocaleLowerCase('pt-BR').includes(q))));
  summary.textContent=rows.length+' de '+all.length+' anotações · '+new Set(all.map(e=>e.courseId)).size+' disciplina(s)';
  if(!rows.length){
   const empty=document.createElement('p');empty.className='muted';
   empty.textContent=all.length?'Nenhuma anotação corresponde à pesquisa.':
     'Suas anotações aparecerão aqui. Durante a leitura, selecione um trecho e toque em “Anotar seleção”.';
   collection.append(empty);return;
  }
  for(const entry of rows){
   const {note}=entry;
   const card=document.createElement('article');card.className='notes-hub-item';
   card.tabIndex=0;card.setAttribute('role','link');
   card.setAttribute('aria-label','Abrir conteúdo: '+entry.courseName+' — '+(note.stage||'Anotação'));
   card.addEventListener('click',event=>{if(!event.target.closest('button,a,input'))contentTarget(entry)});
   card.addEventListener('keydown',event=>{if((event.key==='Enter'||event.key===' ')&&event.target===card){event.preventDefault();contentTarget(entry)}});
   const label=document.createElement('div');label.className='notes-hub-label';
   label.textContent=entry.courseName+' · '+(note.stage||'Etapa não identificada');
   const quoted=document.createElement('blockquote');quoted.className='notes-excerpt';
   quoted.textContent=note.excerpt||'Trecho não registrado';
   const body=document.createElement('p');body.textContent=note.text||'';
   const actions=document.createElement('div');actions.className='button-row';
   const open=document.createElement('button');open.className='btn primary';open.type='button';
   open.textContent='📖 Abrir conteúdo';open.addEventListener('click',event=>{event.stopPropagation();contentTarget(entry)});
   const edit=document.createElement('button');edit.className='btn secondary';edit.type='button';
   edit.textContent='✎ Editar';edit.addEventListener('click',event=>{event.stopPropagation();startEdit(entry)});
   const remove=document.createElement('button');remove.className='btn ghost';remove.type='button';
   remove.textContent='Excluir';remove.addEventListener('click',event=>{
    event.stopPropagation();
    if(!confirm('Excluir esta anotação?'))return;
    try{
     const data=read(entry.courseId),when=new Date().toISOString();
     const notes=data.notes.map(item=>item.id===note.id?{...item,deletedAt:when,updatedAt:when}:item);
     write(entry.courseId,data,notes);
     if(editing?.id===note.id)closeEdit();render();
     feedback.textContent='Anotação excluída.';
    }catch(error){feedback.textContent='⚠️ '+error.message}
   });
   actions.append(open,edit,remove);
   card.append(label,quoted,body,actions);collection.append(card);
  }
 }
 filter.addEventListener('change',render);search.addEventListener('input',render);
 window.addEventListener('storage',event=>{
  if(event.key?.startsWith(PREFIX))render();
 });
 window.addEventListener('eusereibiologo:notes-changed',render);
 return {render};
}
