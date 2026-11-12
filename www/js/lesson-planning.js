/* Planejamento único: a disciplina consulta estudos:v1, mas nunca modifica metas.
   Os controles legados de calendário da página importada são substituídos
   por um resumo e link ao Planejamento geral. */
export function bindLessonPlanning(frame) {
  const panel=document.getElementById('lesson-plan-panel');
  const open=document.getElementById('lesson-plan-toggle');
  const summary=document.getElementById('lesson-plan-summary');
  const redirectURL='./index.html#planning';
  const stageCounts=[9,14,12,8,8,8];
  let stageList=[],observer=null;
  const today=()=>{
    const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  };
  const date=iso=>iso?new Date(iso+'T12:00:00'):null;
  const diffDays=(a,b)=>Math.round((Date.UTC(b.getFullYear(),b.getMonth(),b.getDate())-Date.UTC(a.getFullYear(),a.getMonth(),a.getDate()))/86400000);
  const dateFmt=iso=>date(iso)?.toLocaleDateString('pt-BR')||'—';
  const pTag=(text)=>{const p=document.createElement('p');p.textContent=text;return p;};
  function getData(){
    let platform={},legacy={};
    try{platform=JSON.parse(localStorage.getItem('estudos:v1')||'{}')}catch{}
    try{legacy=JSON.parse(localStorage.getItem('ecologia-vegetal-estudos-v1')||'{}')}catch{}
    return {plan:platform.plans?.['ecologia-vegetal'],complete:legacy.complete||{}};
  }
  function report(target){
    const {plan,complete}=getData();
    target.replaceChildren();
    const title=document.createElement('strong');title.textContent='📅 Cronograma de Ecologia Vegetal';target.append(title);
    if(!plan){
      target.append(pTag('Nenhuma meta foi cadastrada. Configure datas e dias de estudo no Planejamento geral.'));
    }else{
      const count=Math.min(6,Math.max(1,Number(plan.lessonGoal)||6));
      const targetStages=stageCounts.slice(0,count).reduce((a,b)=>a+b,0);
      const done=stageList.length?stageList.filter(x=>Number(x.a)<=count&&complete[x.id]).length:0;
      const pending=Math.max(0,targetStages-done);
      const remainingCalendar=Math.max(0,diffDays(date(today()),date(plan.end))+1);
      const studyDays=remainingCalendar?Math.max(1,Math.ceil(remainingCalendar*Math.max(1,Math.min(7,Number(plan.daysPerWeek)||4))/7)):0;
      const targetPerDay=studyDays?Math.ceil(pending/studyDays):pending;
      target.append(pTag('Início: '+dateFmt(plan.start)+' · Prazo: '+dateFmt(plan.end)));
      target.append(pTag('Concluídas: '+done+' de '+targetStages+' etapas · Restantes: '+pending));
      if(!pending)target.append(pTag('✅ Meta de etapas concluída!'));
      else if(!remainingCalendar)target.append(pTag('⚠️ Prazo encerrado. Ajuste a meta ou a data no Planejamento geral.'));
      else target.append(pTag('🎯 Referência: '+targetPerDay+' etapa(s) por dia de estudo · '+studyDays+' dia(s) de estudo estimados restantes.'));
      const foot=document.createElement('small');foot.textContent='A estimativa considera '+(plan.daysPerWeek||4)+' dias de estudo por semana. Os dias exatos ainda não são selecionáveis.';target.append(foot);
    }
    const link=document.createElement('a');link.href=redirectURL;link.className='lesson-plan-edit';link.textContent='✎ Alterar planejamento geral';target.append(link);
  }
  open.addEventListener('click',()=>{
    panel.hidden=!panel.hidden;
    open.setAttribute('aria-expanded',String(!panel.hidden));
    if(!panel.hidden)report(summary);
  });
  function replaceLegacyPlanner(){
    let doc;
    try{doc=frame.contentDocument}catch{return;}
    const view=doc?.getElementById('view-plan');
    if(!view)return;
    const oldForm=view.querySelector('#planStart,#planDays');
    if(!oldForm)return;
    // Replaces only legacy form; the imported HTML and its study content remain intact.
    const block=doc.createElement('div');block.id='central-plan-notice';
    block.style.cssText='max-width:760px;margin:25px auto;padding:23px;border:1px solid #cbdccd;border-radius:14px;background:#f5faf5;color:#244a32;font:14px/1.6 system-ui';
    const temp=doc.createElement('div');report(temp);
    // Recreate links/buttons in the iframe's document, where relative URLs resolve
    // to the parent GitHub Pages location, not the source document name.
    const heading=doc.createElement('h2');heading.textContent='📅 Seu planejamento único';block.append(heading);
    for(const child of [...temp.children]){
      const copy=doc.createElement(child.tagName.toLowerCase());
      copy.textContent=child.textContent;
      if(child.tagName==='A'){copy.href=redirectURL;copy.style.cssText='display:inline-block;margin-top:12px;color:#20704b;font-weight:700';}
      if(child.tagName==='SMALL')copy.style.cssText='display:block;color:#718477;font-size:11px;margin-top:8px';
      block.append(copy);
    }
    view.replaceChildren(block);
  }
  frame.addEventListener('load',()=>{
    try{stageList=JSON.parse(frame.contentDocument.getElementById('course-data').textContent).stages||[];}catch{stageList=[];}
    const doc=frame.contentDocument;const view=doc?.getElementById('view-plan');
    observer?.disconnect();
    if(view){
      observer=new MutationObserver(()=>replaceLegacyPlanner());
      observer.observe(view,{childList:true,subtree:false});
      replaceLegacyPlanner();
    }
  });
  window.addEventListener('storage',e=>{
    if(e.key==='estudos:v1'||e.key==='ecologia-vegetal-estudos-v1'){
      if(!panel.hidden)report(summary);
      replaceLegacyPlanner();
    }
  });
}
