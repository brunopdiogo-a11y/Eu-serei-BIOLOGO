/* Modo de leitura sem distrações.
 * O HTML original de Ecologia Vegetal continua privado e íntegro no iframe.
 * Só recolhemos a navegação quando uma etapa de leitura está aberta.
 */
export function initReadingLayout(frame){
 const $=id=>document.getElementById(id);
 const voice=$('voice-panel'), voiceSettings=$('voice-settings-toggle'), voiceClose=$('voice-close');
 const chapters=$('reading-chapters'), clock=$('clock');
 let focus=false,manualNavigation=false,lastStage='',observer=null;
 const currentDoc=()=>{try{return frame.contentDocument}catch{return null}};
 function setVoice(open){
   if(voice.hidden)open=false;
   voice.classList.toggle('is-open',open);
   voiceSettings.setAttribute('aria-expanded',String(open));
 }
 voiceSettings.addEventListener('click',()=>setVoice(!voice.classList.contains('is-open')));
 voiceClose.addEventListener('click',()=>setVoice(false));
 document.addEventListener('keydown',e=>{if(e.key==='Escape')setVoice(false)});
 // Aulas no modo de leitura só mostram o conteúdo; "Estudos" volta à navegação.
 function focusStyles(doc){
   if(doc.getElementById('study-focus-style'))return;
   const style=doc.createElement('style');style.id='study-focus-style';
   style.textContent=`.study-focus-hidden{display:none!important}.study-focus-reader{margin-top:0!important;padding-top:0!important;scroll-margin-top:12px!important}
@media(min-width:850px){
 html:has(body.study-focus-wide-layout),body.study-focus-wide-layout{width:100%!important;max-width:none!important;min-width:0!important;overflow-x:hidden!important}
 /* A etapa está aninhada em colunas antigas: só aumentar sua width não libera o grid pai. */
 body.study-focus-wide-layout .study-focus-wide-container{
  display:block!important;position:static!important;float:none!important;
  width:100%!important;max-width:none!important;min-width:0!important;
  flex:1 1 100%!important;grid-column:1/-1!important;grid-row:auto!important;
  grid-template-columns:minmax(0,1fr)!important;
  columns:auto!important;column-count:1!important;
  margin-left:auto!important;margin-right:auto!important;
  transform:none!important;box-sizing:border-box!important
 }
 body.study-focus-wide-layout #articleReader.study-focus-reader{
  display:block!important;float:none!important;position:relative!important;
  width:min(100%,960px)!important;max-width:960px!important;min-width:0!important;
  margin:0 auto!important;padding:12px clamp(20px,3.5vw,46px) 56px!important;
  grid-column:1/-1!important;grid-template-columns:1fr!important;
  columns:auto!important;column-count:1!important;
  box-sizing:border-box!important;transform:none!important
 }
 body.study-focus-wide-layout #articleReader.study-focus-reader > *{
  max-width:100%!important;box-sizing:border-box!important
 }
 body.study-focus-wide-layout #articleReader.study-focus-reader :is(img,figure,table,pre,video){max-width:100%!important}
}
`;
   doc.head.append(style);
 }
 function clearFocus(){
   const doc=currentDoc();if(!doc)return;
   doc.body.classList.remove('study-focus-wide-layout');
   doc.querySelectorAll('.study-focus-wide-container').forEach(el=>el.classList.remove('study-focus-wide-container'));
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
   // O conteúdo privado costuma vir com colunas estreitas próprias. Liberamos
   // os ancestrais da etapa apenas durante a leitura, somente no desktop.
   for(let ancestor=article.parentElement;ancestor&&ancestor!==doc.body;ancestor=ancestor.parentElement){
     ancestor.classList.add('study-focus-wide-container');
   }
   doc.body.classList.add('study-focus-wide-layout');
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

 // Conclusão e avanço automático: observa o botão original do material privado.
 // A navegação só acontece quando a marcação realmente foi salva no localStorage.
 function bindAutoAdvance(doc){
   const key='ecologia-vegetal-estudos-v1';
   const stages=(()=>{
     try{return JSON.parse(doc.getElementById('course-data')?.textContent||'{}').stages||[]}
     catch{return []}
   })();
   if(!stages.length)return;
   function currentStage(){
     const view=doc.getElementById('view-study');
     if(!view?.classList.contains('on'))return null;
     const eyebrow=doc.getElementById('articleReader')?.querySelector('.eyebrow')?.textContent||'';
     const m=eyebrow.match(/Etapa\\s+(\\d+)\\s+de\\s+\\d+/i);
     if(!m)return null;
     // Fallback para identificar a etapa na aula atualmente aberta.
     const number=Number(m[1]);
     const progress=readProgress();
     const id=progress.lastStage;
     if(id){
       const ix=stages.findIndex(stage=>stage.id===id);
       if(ix>=0&&Number(stages[ix].i||stages[ix].n||ix+1)===number)return {index:ix,id};
     }
     // Preferir correspondência pela aula e ordinal quando disponíveis.
     const article=doc.getElementById('articleReader');
     const title=article?.querySelector('h1,h2')?.textContent?.replace(/\\s+/g,' ').trim()||'';
     const index=stages.findIndex(stage=>{
       const name=String(stage.t||stage.title||stage.titulo||stage.name||'').replace(/\\s+/g,' ').trim();
       return title.length>6&&name&&(title===name||title.includes(name)||name.includes(title));
     });
     return index>=0?{index,id:stages[index].id}:null;
   }
   function readProgress(){
     try{return JSON.parse(localStorage.getItem(key)||'{}')||{}}
     catch{return {}}
   }
   const finishLabel=element=>{
     const text=(element.textContent||element.getAttribute('aria-label')||'').replace(/\\s+/g,' ').trim();
     return /(?:concluir|finalizar)\\s+(?:esta\\s+|a\\s+)?etapa|marcar\\s+(?:como\\s+)?conclu[ií]d/i.test(text)&&
       !/desfazer|cancelar|reabrir/i.test(text);
   };
   function openNext(currentIndex){
     const next=stages[currentIndex+1];
     if(!next)return; // Última etapa do curso: permanecer na conclusão.
     const controls=[...doc.querySelectorAll('button,a,[role="button"]')];
     // O botão de navegação original é sempre a primeira opção.
     const nextControl=controls.find(el=>
       !el.disabled&&/pr[oó]xima\\s+etapa|avan[cç]ar\\s+(?:para\\s+)?(?:a\\s+)?pr[oó]xima/i.test((el.textContent||'').replace(/\\s+/g,' ')));
     if(nextControl){nextControl.click();return;}
     // Alguns modelos retornam à grade de etapas após a conclusão.
     const id=String(next.id||'');
     const title=String(next.t||next.title||next.titulo||next.name||'').replace(/\\s+/g,' ').trim();
     const possible=controls.filter(el=>{
       if(el.disabled||el.closest('#articleReader'))return false;
       if(id&&[el.dataset.stage,el.dataset.stageId,el.dataset.id].includes(id))return true;
       const label=(el.textContent||'').replace(/\\s+/g,' ').trim();
       return title.length>=8&&(label===title||label.startsWith(title+' '));
     });
     if(possible.length===1)possible[0].click();
   }
   let advancing=false;
   doc.addEventListener('click',event=>{
     const button=event.target?.closest?.('button,[role="button"],a');
     if(advancing||!button||!finishLabel(button))return;
     const current=currentStage();
     if(!current||!current.id||!stages[current.index+1])return;
     const before=!!readProgress().complete?.[current.id];
     if(before)return;
     advancing=true;
     // O handler do documento original roda primeiro e persiste a conclusão.
     // Três verificações cobrem salvamento síncrono e eventual atualização da UI.
     let attempts=0;
     const check=()=>{
       if(readProgress().complete?.[current.id]){
         advancing=false;
         openNext(current.index);
       }else if(++attempts<6){
         setTimeout(check,150);
       }else advancing=false; // Não navegar se não houve confirmação de gravação.
     };
     setTimeout(check,80);
   },false);
 }
 frame.addEventListener('load',()=>{
   observer?.disconnect();focus=false;lastStage='';manualNavigation=false;
   const doc=currentDoc(),view=doc?.getElementById('view-study');
   if(!view)return;
   bindAutoAdvance(doc);
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
   if(voice.classList.contains('is-open') && !voice.contains(e.target) && !voiceSettings.contains(e.target))setVoice(false);
 },{passive:true});
}
