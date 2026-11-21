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

 // Ao concluir uma etapa, confirmar o salvamento antes de avançar.
 // O HTML da disciplina é importado pelo usuário, portanto evitamos depender
 // de funções internas não documentadas do arquivo original.
 function bindAutoAdvance(doc){
   const key='ecologia-vegetal-estudos-v1';
   const normalized=text=>String(text||'').replace(/\s+/gu,' ').trim();
   const readProgress=()=>{try{return JSON.parse(localStorage.getItem(key)||'{}')||{}}catch{return {}}};
   const stages=(()=>{try{
     const data=JSON.parse(doc.getElementById('course-data')?.textContent||'{}');
     return Array.isArray(data.stages)?data.stages:[];
   }catch{return []}})();
   if(!stages.length)return;
   const stageId=stage=>String(stage?.id??'');
   const stageName=stage=>normalized(stage?.t||stage?.title||stage?.titulo||stage?.name);
   const visibleLabel=el=>normalized(el?.textContent||el?.getAttribute?.('aria-label'));
   const stageControls=()=>[...doc.querySelectorAll('button,a,[role="button"],[data-stage],[data-stage-id],[onclick]')];
   const isCompletion=el=>{
     const label=visibleLabel(el);
     return /(?:concluir|finalizar)\s+(?:esta\s+|a\s+)?etapa|marcar\s+(?:como\s+)?conclu[ií]d/i.test(label)&&
       !/desfazer|cancelar|reabrir/i.test(label);
   };
   function currentStage(){
     const view=doc.getElementById('view-study');
     if(!view?.classList.contains('on'))return null;
     const progress=readProgress(),id=String(progress.lastStage||'');
     const storedIndex=stages.findIndex(stage=>stageId(stage)===id);
     if(id&&storedIndex>=0)return {index:storedIndex,id};
     const article=doc.getElementById('articleReader');
     const heading=normalized(article?.querySelector('h1,h2,.stage-title')?.textContent);
     const index=stages.findIndex(stage=>{
       const title=stageName(stage);
       return heading.length>=6&&title&&(heading===title||heading.includes(title)||title.includes(heading));
     });
     return index>=0?{index,id:stageId(stages[index])}:null;
   }
   let navigating=false;
   function findStageControl(stage){
     const id=stageId(stage),name=stageName(stage);
     const matches=stageControls().filter(el=>{
       if(el.disabled||el.closest('#articleReader'))return false;
       if(id&&[el.dataset?.stage,el.dataset?.stageId,el.dataset?.id].map(String).includes(id))return true;
       const label=visibleLabel(el);
       return name.length>=6&&(label===name||label.startsWith(name+' '));
     });
     // Avoid clicking a random element when more than one match exists.
     return matches.length===1?matches[0]:null;
   }
   function openNext(index){
     const next=stages[index+1];
     if(!next)return;
     const previous=readProgress().lastStage;
     const candidates=stageControls().filter(el=>!el.disabled&&
       /pr[oó]xima\s+etapa|avan[cç]ar\s+(?:para\s+)?(?:a\s+)?pr[oó]xima/i.test(visibleLabel(el)));
     const action=candidates.find(el=>el.closest('#view-study'))||candidates[0];
     if(action){action.click();return;}
     const target=findStageControl(next);
     if(target){target.click();return;}
     // Some imported course templates render stage cards only after returning
     // to the chapters view. Navigate there and find the exact next card.
     const back=stageControls().find(el=>/^(?:📖\s*)?Estudos$/i.test(visibleLabel(el))&&!el.closest('#articleReader'));
     if(back){
       back.click();
       let checks=0;
       const attempt=()=>{
         const control=findStageControl(next);
         if(control){control.click();return;}
         if(++checks<8)setTimeout(attempt,120);
         else console.warn('Próxima etapa não encontrada no HTML importado',stageId(next),previous);
       };
       setTimeout(attempt,50);
     }else console.warn('Não foi possível localizar a navegação da etapa seguinte',stageId(next));
   }
   doc.addEventListener('click',event=>{
     const button=event.target?.closest?.('button,[role="button"],a');
     if(navigating||!button||!isCompletion(button))return;
     const current=currentStage();
     if(!current||!current.id||!stages[current.index+1])return;
     navigating=true;
     // O listener original da disciplina conclui a etapa. Só avançamos
     // quando a confirmação aparecer no estado salvo, nunca antes.
     let checks=0;
     const check=()=>{
       const progress=readProgress();
       if(progress.complete?.[current.id]){
         navigating=false;
         openNext(current.index);
       }else if(++checks<12)setTimeout(check,120);
       else{
         navigating=false;
         console.warn('Conclusão não confirmada no progresso salvo',current.id);
       }
     };
     setTimeout(check,60);
   });
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
