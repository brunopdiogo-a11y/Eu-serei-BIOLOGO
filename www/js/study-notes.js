/* Anotações privadas por disciplina. Compartilha o mesmo formato genérico
   de progresso do backup/Google Drive; nunca modifica o HTML das aulas. */
export function initStudyNotes(frame,{courseId='ecologia-vegetal',courseTitle='Ecologia Vegetal'}={}){
 const key='eu-serei-biologo-course-progress:'+courseId;
 const $=id=>document.getElementById(id);
 const action=$('study-note-selection'),listButton=$('study-note-list');
 const panel=$('study-notes-panel'),close=$('study-notes-close');
 const quote=$('study-note-excerpt'),textarea=$('study-note-body');
 const save=$('study-note-save'),cancel=$('study-note-cancel');
 const editor=$('study-note-editor'),list=$('study-notes-list');
 const status=$('study-notes-status'),count=$('study-notes-count');
 let selection='',selectionStage='',editingId=null;
 const isRecord=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
 function getData(){
  let parsed=null;
  try{parsed=JSON.parse(localStorage.getItem(key)||'null');}catch{throw Error('Arquivo local de notas inválido.')}
  if(parsed!==null&&!isRecord(parsed))throw Error('Estrutura de notas inválida.');
  return parsed||{version:1,updatedAt:null,notes:[]};
 }
 const getNotes=()=>Array.isArray(getData().notes)?getData().notes:[];
 function writeNotes(notes){
  const previous=getData();
  const next={...previous,version:1,notes,updatedAt:new Date().toISOString()};
  localStorage.setItem(key,JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('eusereibiologo:notes-changed',{detail:{courseId}}));
 }
 const stageName=()=>{
  try{
   const doc=frame.contentDocument;
   const article=doc?.getElementById('articleReader');
   if(!article)return courseTitle;
   const eyebrow=article.querySelector('.eyebrow')?.textContent?.replace(/\s+/g,' ').trim();
   const title=article.querySelector('h1,h2,.stage-title')?.textContent?.replace(/\s+/g,' ').trim();
   return [eyebrow,title].filter(Boolean).join(' — ').slice(0,230)||courseTitle;
  }catch{return courseTitle}
 };
 function refreshSelection(){
  try{
   const doc=frame.contentDocument;
   const picked=frame.contentWindow?.getSelection();
   const chosen=picked?.toString().replace(/\s+/g,' ').trim().slice(0,1800)||'';
   // Somente texto pertencente ao conteúdo da aula.
   if(chosen&&doc?.getElementById('view-study')?.contains(picked.anchorNode)&&doc.getElementById('view-study').contains(picked.focusNode)){
    selection=chosen;selectionStage=stageName();
    action.hidden=false;
   }else if(!chosen){
    action.hidden=true;
   }
  }catch{}
 }
 function resetEditor(){
  editingId=null;selection='';selectionStage='';
  editor.hidden=true;textarea.value='';quote.textContent='';
  action.hidden=true;
 }
 function openPanel(){
  panel.hidden=false;
  panel.setAttribute('aria-hidden','false');
  renderList();
 }
 function closePanel(){
  panel.hidden=true;panel.setAttribute('aria-hidden','true');
  resetEditor();
 }
 function startNew(){
  if(!selection)return;
  editingId=null;
  quote.textContent=selection;
  textarea.value='';
  editor.hidden=false;openPanel();
  textarea.focus();
 }
 function renderList(){
  let notes;
  try{notes=getNotes()}catch(error){status.textContent='⚠️ '+error.message;return}
  const active=notes.filter(n=>isRecord(n)&&!n.deletedAt).sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
  count.textContent=active.length?active.length+' anotação(ões)':'Nenhuma anotação';
  list.replaceChildren();
  if(!active.length){
   const empty=document.createElement('p');empty.className='study-note-empty';
   empty.textContent='Selecione uma palavra ou trecho da aula e toque em “Anotar seleção”.';
   list.append(empty);return;
  }
  for(const note of active){
   const card=document.createElement('article');card.className='study-note-item';
   const head=document.createElement('strong');head.textContent=note.stage||courseTitle;
   const cited=document.createElement('blockquote');cited.textContent=note.excerpt||'Trecho não informado';
   const body=document.createElement('p');body.textContent=note.text||'';
   const actions=document.createElement('div');actions.className='study-note-item-actions';
   const edit=document.createElement('button');edit.type='button';edit.textContent='✎ Editar';
   edit.addEventListener('click',()=>{
    editingId=note.id;selection=note.excerpt||'';selectionStage=note.stage||courseTitle;
    quote.textContent=selection;textarea.value=note.text||'';
    editor.hidden=false;textarea.focus();editor.scrollIntoView({block:'nearest'});
   });
   const remove=document.createElement('button');remove.type='button';remove.textContent='Excluir';
   remove.addEventListener('click',()=>{
    if(!window.confirm('Excluir esta anotação?'))return;
    const when=new Date().toISOString();
    const updated=getNotes().map(n=>n.id===note.id?{...n,deletedAt:when,updatedAt:when}:n);
    writeNotes(updated);if(editingId===note.id)resetEditor();renderList();
    status.textContent='Anotação excluída neste dispositivo.';
   });
   actions.append(edit,remove);card.append(head,cited,body,actions);list.append(card);
  }
 }
 save.addEventListener('click',()=>{
  const text=textarea.value.trim();
  if(!text){status.textContent='Escreva sua anotação antes de salvar.';textarea.focus();return}
  if(text.length>5000){status.textContent='Limite de 5.000 caracteres por anotação.';return}
  try{
   const when=new Date().toISOString(),notes=getNotes().slice();
   if(editingId){
    const ix=notes.findIndex(n=>n.id===editingId&&!n.deletedAt);
    if(ix<0)throw Error('A anotação selecionada não está disponível.');
    notes[ix]={...notes[ix],text,updatedAt:when};
   }else{
    if(!selection)throw Error('Selecione um trecho da aula primeiro.');
    const id=globalThis.crypto?.randomUUID?.()||'note-'+Date.now()+'-'+Math.random().toString(36).slice(2);
    notes.push({id,courseId,stage:selectionStage||courseTitle,excerpt:selection,text,createdAt:when,updatedAt:when});
   }
   writeNotes(notes);resetEditor();renderList();
   status.textContent='✅ Anotação salva neste dispositivo. Disponível para backup e sincronização.';
  }catch(error){status.textContent='⚠️ '+error.message}
 });
 cancel.addEventListener('click',resetEditor);
 action.addEventListener('pointerdown',event=>event.preventDefault());
 action.addEventListener('click',startNew);
 listButton.addEventListener('click',openPanel);
 close.addEventListener('click',closePanel);
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden)closePanel()});
 function attach(){
  try{
   const doc=frame.contentDocument;if(!doc)return;
   doc.addEventListener('selectionchange',refreshSelection);
   doc.addEventListener('mouseup',refreshSelection);
   doc.addEventListener('keyup',refreshSelection);
   doc.addEventListener('touchend',()=>setTimeout(refreshSelection,100),{passive:true});
   doc.addEventListener('click',()=>{
    setTimeout(()=>{
     const selected=frame.contentWindow?.getSelection()?.toString().trim();
     if(!selected&&panel.hidden)action.hidden=true;
    },150);
   },{passive:true});
  }catch{}
 }
 frame.addEventListener('load',attach);
 window.addEventListener('storage',event=>{if(event.key===key&&!panel.hidden)renderList()});
}
