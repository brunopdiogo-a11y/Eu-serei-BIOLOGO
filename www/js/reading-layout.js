/* Modo de leitura sem distrações.
 * O HTML original de Ecologia Vegetal continua privado e íntegro no iframe.
 * Só recolhemos a navegação quando uma etapa de leitura está aberta.
 */
export function initReadingLayout(frame){
 const $=id=>document.getElementById(id);
 const voice=$('voice-panel'), voiceToggle=$('voice-toggle'), voiceClose=$('voice-close');
 const chapters=$('reading-chapters'), clock=$('clock');
 let focus=false,manualNavigation=false,lastStage='',observer=null;
 const currentDoc=()=>{try{return frame.contentDocument}catch{return null}};
 function setVoice(open){
   if(voice.hidden)open=false;
   voice.classList.toggle('is-open',open);
   voiceToggle.setAttribute('aria-expanded',String(open));
 }
 voiceToggle.addEventListener('click',()=>setVoice(!voice.classList.contains('is-open')));
 voiceClose.addEventListener('click',()=>setVoice(false));
 document.addEventListener('keydown',e=>{if(e.key==='Escape')setVoice(false)});
 // Aulas no modo de leitura só mostram o conteúdo; "Estudos" volta à navegação.
 function focusStyles(doc){
   if(doc.getElementById('study-focus-style'))return;
   const style=doc.createElement('style');style.id='study-focus-style';
   style.textContent='.study-focus-hidden{display:none!important}.study-focus-reader{margin-top:0!important;padding-top:0!important;scroll-margin-top:12px!important}';
   doc.head.append(style);
 }
 function clearFocus(){
   const doc=currentDoc();if(!doc)return;
   doc.querySelectorAll('.study-focus-hidden').forEach(el=>el.classList.remove('study-focus-hidden'));
   doc.querySelectorAll('.study-focus-reader').forEach(el=>el.classList.remove('study-focus-reader'));
   focus=false;frame.classList.remove('reader-focus');
 }
 function hideFocus(){
   const doc=currentDoc();
   const article=doc?.getElementById('articleReader');
   const view=doc?.getElementById('view-study');
   if(!article||!view)return;
   clearFocus();focusStyles(doc);
   // Oculta os controles do template que ficam acima do conteúdo.
   const all=doc.querySelectorAll('header,nav,.topbar,.top-nav,.course-header,.main-header,.tabs,.tab-bar,.tabbar,.app-header,.site-header');
   for(const el of all){
     if(!el.contains(article)&&!article.contains(el)&&!el.contains(view)&&!view.contains(el)){
       el.classList.add('study-focus-hidden');
     }
   }
   // O seletor de aulas/etapas fica na tela anterior, não junto ao texto.
   // Preservamos elementos depois do leitor: podem incluir ações de conclusão.
   let current=article;
   while(current && current!==view){
     const parent=current.parentElement;
     if(!parent)break;
     for(const sibling of parent.children){
       if(sibling===current)break;
       if(sibling.contains(article))continue;
       if(sibling.tagName==='SCRIPT'||sibling.tagName==='STYLE')continue;
       sibling.classList.add('study-focus-hidden');
     }
     current=parent;
   }
   article.classList.add('study-focus-reader');
   frame.classList.add('reader-focus');focus=true;
   // Scroll contextual: leitura ocupa a área útil sem os cabeçalhos.
   requestAnimationFrame(()=>{try{article.scrollIntoView({block:'start',behavior:'instant'})}catch{}});
 }
 function stageSignature(){
   const doc=currentDoc(),view=doc?.getElementById('view-study');
   if(!view?.classList.contains('on'))return '';
   const eyebrow=doc.getElementById('articleReader')?.querySelector('.eyebrow')?.textContent||'';
   const m=eyebrow.match(/Etapa\s+(\d+)\s+de\s+\d+/i);
   return m?m[0]:'';
 }
 function sync(){
   const next=stageSignature();
   if(next!==lastStage){
     lastStage=next;
     manualNavigation=false;
     if(next)hideFocus();
     else clearFocus();
   }else if(next && !manualNavigation && !focus){
     hideFocus();
   }
   // Sem etapa ativa, o botão ouvir não deve ficar aberto.
   if(!next)setVoice(false);
 }
 chapters.addEventListener('click',()=>{
   manualNavigation=true;clearFocus();setVoice(false);
   const doc=currentDoc();if(!doc)return;
   // Retorna à listagem/menu existente no material privado.
   // Nenhuma etapa é marcada como concluída ao navegar.
   try{frame.contentWindow.scrollTo({top:0,behavior:'instant'})}catch{}
   const nav=[...doc.querySelectorAll('button,a,[role="tab"]')].find(el=>{
     const t=el.textContent?.replace(/\s+/g,' ').trim();
     return t && /^(?:📖\s*)?Estudos$/i.test(t) && !el.closest('#articleReader');
   });
   if(nav)try{nav.click()}catch{}
 });
 frame.addEventListener('load',()=>{
   observer?.disconnect();focus=false;lastStage='';manualNavigation=false;
   const doc=currentDoc(),view=doc?.getElementById('view-study');
   if(!view)return;
   let scheduled=false;
   const update=()=>{
     if(scheduled)return;scheduled=true;
     requestAnimationFrame(()=>{scheduled=false;sync()});
   };
   observer=new MutationObserver(update);
   observer.observe(view,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class']});
   update();
 });
 // Painéis externos podem encobrir a leitura apenas quando solicitados.
 document.addEventListener('pointerdown',e=>{
   if(voice.classList.contains('is-open') && !voice.contains(e.target) && !voiceToggle.contains(e.target))setVoice(false);
 },{passive:true});
}
