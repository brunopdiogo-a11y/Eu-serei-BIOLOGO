/* Anotações privadas por disciplina. Compartilha o mesmo formato genérico
   de progresso do backup/Google Drive; nunca modifica o HTML das aulas. */
export function initStudyNotes(frame,{courseId='ecologia-vegetal',courseTitle='Ecologia Vegetal'}={}){
 const key='eu-serei-biologo-course-progress:'+courseId;
 const $=id=>document.getElementById(id);
 const action=$('study-note-selection'),listButton=$('study-note-list');
 const panel=$('study-notes-panel'),close=$('study-notes-close');
 const minimize=$('study-notes-minimize'),drag=$('study-notes-drag');
 const newButton=$('study-note-new'),showList=$('study-note-show-list');
 const quote=$('study-note-excerpt'),textarea=$('study-note-body');
 const save=$('study-note-save'),cancel=$('study-note-cancel');
 const editor=$('study-note-editor'),list=$('study-notes-list');
 const status=$('study-notes-status'),count=$('study-notes-count');
 let selection='',selectionStage='',selectionStageId='',editingId=null,freeNote=false;
 let dragPointer=null;
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
 const stageId=()=>{
  try{
   const saved=JSON.parse(localStorage.getItem('ecologia-vegetal-estudos-v1')||'{}');
   const id=String(saved.lastStage||'');
   return /^e[1-6]_\\d+$/.test(id)?id:'';
  }catch{return ''}
 };
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
    selection=chosen;selectionStage=stageName();selectionStageId=stageId();
    action.hidden=false;
   }else if(!chosen){
    action.hidden=true;
   }
  }catch{}
 }
 function resetEditor(){
  editingId=null;selection='';selectionStage='';selectionStageId='';freeNote=false;
  editor.hidden=true;textarea.value='';quote.textContent='';
  action.hidden=true;
 }
 function openPanel(){
  panel.hidden=false;
  panel.classList.remove('is-minimized');minimize.textContent='−';
  panel.setAttribute('aria-hidden','false');
  renderList();
 }
 function closePanel(){
  panel.hidden=true;panel.setAttribute('aria-hidden','true');
  // Rascunhos permanecem no editor enquanto a página estiver aberta.
 }
 function startNew(){
  if(!selection)return;
  editingId=null;freeNote=false;
  quote.textContent=selection;
  textarea.value='';
  editor.hidden=false;list.hidden=true;openPanel();
  // O campo é opcional: o usuário pode salvar o trecho imediatamente.
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
    editingId=note.id;selection=note.excerpt||'';selectionStage=note.stage||courseTitle;freeNote=!selection;
    quote.textContent=selection;textarea.value=note.text||'';
    editor.hidden=false;list.hidden=true;openPanel();textarea.focus();
   });
   const remove=document.createElement('button');remove.type='button';remove.textContent='Excluir';
   remove.addEventListener('click',()=>{
    if(!window.confirm('Excluir esta anotação?'))return;
    const when=new Date().toISOString();
    const updated=getNotes().map(n=>n.id===note.id?{...n,deletedAt:when,updatedAt:when}:n);
    writeNotes(updated);if(editingId===note.id)resetEditor();renderList();scheduleHighlights();
    status.textContent='Anotação excluída neste dispositivo.';
   });
   const central=document.createElement('button');central.type='button';
   central.textContent='📝 Ver no caderno geral';
   central.addEventListener('click',()=>{location.href='./index.html#notes'});
   actions.append(central,edit,remove);card.append(head,cited,body,actions);list.append(card);
  }
 }

 // Destaques não invasivos usando a API CSS Highlight: não modificam os parágrafos
 // nem o HTML acadêmico, e são refeitos quando a etapa é trocada.
 let highlighted=[],highlightObserver=null,highlightTimer=null,highlightDoc=null;
 const HIGHLIGHT_NAME='study-saved-annotations';
 const normalizeExcerpt=text=>String(text||'').replace(/\\s+/g,' ').trim().toLocaleLowerCase('pt-BR');
 function matchRanges(root,excerpt,doc){
  const needle=normalizeExcerpt(excerpt);
  if(!needle||needle.length<2)return [];
  const iterator=doc.createTreeWalker(root,NodeFilter.SHOW_TEXT,{
   acceptNode(node){
    if(!node.nodeValue?.trim()||node.parentElement?.closest('script,style,noscript,button,textarea,input,select,[hidden],[contenteditable="true"]'))return NodeFilter.FILTER_REJECT;
    return NodeFilter.FILTER_ACCEPT;
   }
  });
  const nodes=[];while(iterator.nextNode())nodes.push(iterator.currentNode);
  let normalized='',positions=[];
  for(const node of nodes){
   const raw=node.nodeValue;
   for(let i=0;i<raw.length;i++){
    const char=raw[i];
    if(/\\s/.test(char)){
     if(normalized.endsWith(' '))continue;
     normalized+=' ';positions.push({node,offset:i});
    }else{
     normalized+=char.toLocaleLowerCase('pt-BR');
     positions.push({node,offset:i});
    }
   }
  }
  const found=[];let cursor=0;
  while(found.length<8){
   const at=normalized.indexOf(needle,cursor);
   if(at<0)break;
   const begin=positions[at],end=positions[at+needle.length-1];
   if(begin&&end){
    const range=doc.createRange();
    range.setStart(begin.node,begin.offset);
    range.setEnd(end.node,end.offset+1);
    found.push(range);
   }
   cursor=at+needle.length;
  }
  return found;
 }
 function editHighlighted(note){
  editingId=note.id;selection=note.excerpt||'';selectionStage=note.stage||courseTitle;freeNote=!selection;
  quote.textContent=selection||'Anotação livre';
  textarea.value=note.text||'';
  editor.hidden=false;list.hidden=true;openPanel();
  status.textContent='🟨 Anotação vinculada ao trecho destacado.';
 }
 function renderHighlights(){
  const doc=frame.contentDocument,article=doc?.getElementById('articleReader');
  if(!article||!doc.defaultView?.CSS?.highlights||!doc.defaultView.Highlight)return;
  doc.defaultView.CSS.highlights.delete(HIGHLIGHT_NAME);
  highlighted=[];
  if(!doc.getElementById('study-saved-highlight-style')){
   const style=doc.createElement('style');style.id='study-saved-highlight-style';
   style.textContent='::highlight(study-saved-annotations){background-color:#ffe99b;color:inherit;text-decoration:underline;text-decoration-color:#dba83d;text-decoration-thickness:2px;text-underline-offset:3px}';
   doc.head.append(style);
  }
  const currentStage=stageId(),name=stageName();
  const candidates=getNotes().filter(note=>isRecord(note)&&!note.deletedAt&&note.excerpt?.trim()&&
   (note.stageId?note.stageId===currentStage:!!note.stage&&name.includes(String(note.stage).split(' — ').at(-1).trim())));
  const ranges=[];
  for(const note of candidates){
   for(const range of matchRanges(article,note.excerpt,doc)){
    ranges.push(range);highlighted.push({range,note});
   }
  }
  if(ranges.length)doc.defaultView.CSS.highlights.set(HIGHLIGHT_NAME,new doc.defaultView.Highlight(...ranges));
 }
 function scheduleHighlights(){
  if(highlightTimer!==null)clearTimeout(highlightTimer);
  highlightTimer=setTimeout(()=>{
   highlightTimer=null;
   try{renderHighlights()}catch(error){console.warn('Destaques de anotações indisponíveis',error)}
  },100);
 }
 function openHighlightAtPointer(event){
  if(event.button!==0||frame.contentWindow?.getSelection()?.toString())return;
  const match=highlighted.find(({range})=>[...range.getClientRects()].some(rect=>
   event.clientX>=rect.left&&event.clientX<=rect.right&&event.clientY>=rect.top&&event.clientY<=rect.bottom));
  if(match)editHighlighted(match.note);
 }
 function attachHighlights(){
  const doc=frame.contentDocument;
  if(!doc||doc===highlightDoc)return;
  highlightObserver?.disconnect();highlightDoc=doc;
  doc.addEventListener('click',openHighlightAtPointer);
  highlightObserver=new MutationObserver(mutations=>{
   if(mutations.some(change=>change.target.id!=='study-saved-highlight-style'))scheduleHighlights();
  });
  // A aula substitui o conteúdo de articleReader ao passar para outra etapa.
  highlightObserver.observe(doc.getElementById('articleReader')||doc.body,{childList:true,subtree:true,characterData:true});
  scheduleHighlights();
 }
 window.addEventListener('eusereibiologo:notes-changed',event=>{
  if(event.detail?.courseId===courseId)scheduleHighlights();
 });
 save.addEventListener('click',()=>{
  const text=textarea.value.trim();
  if(freeNote&&!editingId&&!text){status.textContent='Escreva algo antes de salvar uma anotação livre.';return;}
  // A seleção por si só já é uma anotação válida; comentário é opcional.
  if(text.length>5000){status.textContent='Limite de 5.000 caracteres por anotação.';return}
  try{
   const when=new Date().toISOString(),notes=getNotes().slice();
   if(editingId){
    const ix=notes.findIndex(n=>n.id===editingId&&!n.deletedAt);
    if(ix<0)throw Error('A anotação selecionada não está disponível.');
    notes[ix]={...notes[ix],text,updatedAt:when};
   }else{
    if(!selection&&!freeNote)throw Error('Selecione um trecho da aula ou crie uma anotação livre.');
    const id=globalThis.crypto?.randomUUID?.()||'note-'+Date.now()+'-'+Math.random().toString(36).slice(2);
    notes.push({id,courseId,stageId:selectionStageId,stage:selectionStage||courseTitle,excerpt:selection||'',text,createdAt:when,updatedAt:when});
   }
   writeNotes(notes);resetEditor();renderList();scheduleHighlights();
   status.textContent=text?'✅ Trecho e comentário salvos. Disponíveis para sincronização.':'✅ Trecho destacado salvo sem comentário. Disponível no caderno e na sincronização.';
  }catch(error){status.textContent='⚠️ '+error.message}
 });
 cancel.addEventListener('click',resetEditor);
 action.addEventListener('pointerdown',event=>event.preventDefault());
 action.addEventListener('click',startNew);
 function createFreeNote(){
  if(!editor.hidden&&textarea.value.trim()&&!window.confirm('Substituir o rascunho ainda não salvo?'))return;
  editingId=null;freeNote=true;selection='';selectionStage=stageName();selectionStageId=stageId();
  quote.textContent='Anotação livre sobre a etapa atual';textarea.value='';
  editor.hidden=false;list.hidden=true;openPanel();textarea.focus();
 }
 function showNotebookList(){
  // Abrir sempre a lista no próprio leitor: nenhuma navegação para index.html.
  openPanel();
  editor.hidden=true;
  list.hidden=false;
  renderList();
 }
 function toggleNotebookList(){
  if(panel.hidden||list.hidden){showNotebookList();return}
  list.hidden=true;
 }
 listButton.addEventListener('click',showNotebookList);
 newButton.addEventListener('click',createFreeNote);
 showList.addEventListener('click',toggleNotebookList);
 minimize.addEventListener('click',()=>{
  const minimized=panel.classList.toggle('is-minimized');
  minimize.textContent=minimized?'▢':'−';
  minimize.setAttribute('aria-label',minimized?'Expandir caderno':'Recolher caderno');
 });
 // Arrastar pela barra superior, sem interferir no editor nem na rolagem da aula.
 drag.addEventListener('pointerdown',event=>{
  if(event.button!==0||event.target.closest('button,a,input'))return;
  const rect=panel.getBoundingClientRect();
  dragPointer={id:event.pointerId,dx:event.clientX-rect.left,dy:event.clientY-rect.top};
  drag.setPointerCapture(event.pointerId);event.preventDefault();
 });
 drag.addEventListener('pointermove',event=>{
  if(!dragPointer||event.pointerId!==dragPointer.id)return;
  const x=Math.max(0,Math.min(innerWidth-panel.offsetWidth,event.clientX-dragPointer.dx));
  const y=Math.max(0,Math.min(innerHeight-Math.min(panel.offsetHeight,54),event.clientY-dragPointer.dy));
  panel.style.left=x+'px';panel.style.top=y+'px';panel.style.right='auto';panel.style.bottom='auto';
 });
 const stopDrag=()=>{dragPointer=null};
 drag.addEventListener('pointerup',stopDrag);drag.addEventListener('pointercancel',stopDrag);
 window.addEventListener('resize',()=>{
  if(panel.hidden)return;
  const rect=panel.getBoundingClientRect();
  if(rect.right>innerWidth)panel.style.left=Math.max(0,innerWidth-rect.width)+'px';
  if(rect.top>innerHeight-54)panel.style.top=Math.max(0,innerHeight-54)+'px';
 });
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
 window.addEventListener('storage',event=>{if(event.key===key){if(!panel.hidden)renderList();scheduleHighlights();}});
}
