/* Planejamento único: a disciplina consulta estudos:v1, mas nunca modifica metas.
   Os controles legados de calendário da página importada são substituídos
   por um resumo e link ao Planejamento geral. */
export function bindLessonPlanning(frame) {
  const panel=document.getElementById('lesson-plan-panel');
  const open=document.getElementById('lesson-plan-toggle');
  const summary=document.getElementById('lesson-plan-summary');
  const redirectURL='./index.html#planning';
  const stageCounts=[9,14,12,8,8,8];
  let stageList=[],observer=null,previousSignature='';
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
  // O gráfico utiliza apenas os registros reais das etapas concluídas.
  function getProgress(complete){
    const counts=stageCounts.map((total,i)=>({label:'Aula '+(i+1),total,done:0}));
    if(stageList.length){
      counts.forEach(c=>{c.total=0;c.done=0;});
      for(const st of stageList){
        const i=Number(st.a)-1;
        if(i<0||i>5)continue;
        counts[i].total++;
        if(complete[st.id])counts[i].done++;
      }
    }else{
      for(const [key,value] of Object.entries(complete)){
        const m=/^e([1-6])_(\d+)$/.exec(key);
        if(value&&m&&Number(m[2])<=counts[Number(m[1])-1].total)counts[Number(m[1])-1].done++;
      }
    }
    const total=counts.reduce((n,c)=>n+c.total,0);
    const done=counts.reduce((n,c)=>n+c.done,0);
    return {counts,total,done,percent:total?Math.round(done/total*100):0};
  }
  function report(target){
    const {plan,complete}=getData(),p=getProgress(complete),doc=target.ownerDocument;
    const create=(tag,className,text)=>{
      const el=doc.createElement(tag);if(className)el.className=className;
      if(text!==undefined)el.textContent=text;
      return el;
    };
    target.replaceChildren();
    target.append(create('strong','study-graphs-heading','📊 Seu progresso'));
    const summaryLine=create('div','study-graphs-overview');
    const ring=create('div','study-graphs-ring');
    ring.style.background='conic-gradient(#34865a '+p.percent+'%,#e7eee9 '+p.percent+'% 100%)';
    ring.setAttribute('role','img');ring.setAttribute('aria-label',p.percent+'% do curso concluído');
    const core=create('div','study-graphs-ring-core');
    core.append(create('strong','',p.percent+'%'),create('small','','concluído'));ring.append(core);
    const note=create('div','study-graphs-note');
    note.append(create('strong','','Ecologia Vegetal'),create('span','',p.done+' de '+p.total+' etapas concluídas'),create('span','',(p.total-p.done)+' etapas restantes'));
    summaryLine.append(ring,note);target.append(summaryLine);
    const lessons=create('div','study-graphs-lessons');
    for(const c of p.counts){
      const percent=c.total?Math.round(c.done/c.total*100):0;
      const line=create('div','study-graphs-lesson');
      const heading=create('div','study-graphs-lesson-heading');
      heading.append(create('strong','',c.label),create('span','',c.done+'/'+c.total+' · '+percent+'%'));
      const track=create('div','study-graphs-track');
      track.setAttribute('role','progressbar');track.setAttribute('aria-label',c.label);
      track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax','100');track.setAttribute('aria-valuenow',String(percent));
      const fill=create('div','study-graphs-fill');fill.style.width=percent+'%';track.append(fill);
      line.append(heading,track);lessons.append(line);
    }
    target.append(lessons);
    const planArea=create('div','study-graphs-plan');
    planArea.append(create('strong','','📅 Meu cronograma'));
    if(!plan){
      planArea.append(pTag('Nenhuma meta foi cadastrada. Configure datas e dias de estudo no Planejamento geral.'));
    }else{
      const count=Math.min(6,Math.max(1,Number(plan.lessonGoal)||6));
      const targetStages=p.counts.slice(0,count).reduce((n,c)=>n+c.total,0);
      const completed=p.counts.slice(0,count).reduce((n,c)=>n+c.done,0);
      const pending=Math.max(0,targetStages-completed);
      const end=date(plan.end);
      const remainingCalendar=end?Math.max(0,diffDays(date(today()),end)+1):0;
      const studyDays=remainingCalendar?Math.max(1,Math.ceil(remainingCalendar*Math.max(1,Math.min(7,Number(plan.daysPerWeek)||4))/7)):0;
      planArea.append(pTag('Início: '+dateFmt(plan.start)+' · Prazo: '+dateFmt(plan.end)));
      if(!pending)planArea.append(pTag('✅ Meta de etapas concluída!'));
      else if(!studyDays)planArea.append(pTag('⚠️ Prazo encerrado. Ajuste a meta ou a data no Planejamento geral.'));
      else planArea.append(pTag('🎯 Meta diária: cerca de '+Math.ceil(pending/studyDays)+' etapa(s) · '+studyDays+' dia(s) de estudo restantes'));
      planArea.append(create('small','','Estimativa baseada em '+(plan.daysPerWeek||4)+' dias de estudo por semana.'));
    }
    target.append(planArea);
    const link=create('a','lesson-plan-edit','✎ Alterar planejamento geral');
    link.href=redirectURL;target.append(link);
  }
  function graphStyles(doc){
    if(doc.getElementById('study-graphs-css'))return;
    const style=doc.createElement('style');style.id='study-graphs-css';
    style.textContent='.study-graphs-heading{display:block;font-size:14px;margin-bottom:12px;color:#2b5940}.study-graphs-overview{display:flex;gap:15px;align-items:center;margin-bottom:18px}.study-graphs-ring{height:90px;width:90px;flex:none;border-radius:50%;display:grid;place-items:center}.study-graphs-ring-core{height:70px;width:70px;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#fff}.study-graphs-ring-core strong{font-size:21px;line-height:1.1;color:#26734a}.study-graphs-ring-core small{font-size:10px;color:#839a8a}.study-graphs-note{display:grid;gap:3px}.study-graphs-note strong{font-size:13px}.study-graphs-note span{font-size:11px;color:#6a8070}.study-graphs-lessons{display:grid;gap:12px}.study-graphs-lesson-heading{display:flex;justify-content:space-between;gap:12px;margin-bottom:5px;font-size:12px;color:#456b50}.study-graphs-lesson-heading span{white-space:nowrap;color:#788c7d;font-variant-numeric:tabular-nums}.study-graphs-track{height:7px;overflow:hidden;border-radius:10px;background:#e7efe9}.study-graphs-fill{height:100%;border-radius:10px;background:#34865a;transition:width .2s ease}.study-graphs-plan{margin-top:20px;padding-top:14px;border-top:1px solid #e2eae4}.study-graphs-plan strong{font-size:13px}.study-graphs-plan p{font-size:12px;margin:7px 0}.study-graphs-plan small{font-size:11px;color:#829485}';
    doc.head.append(style);
  }
  graphStyles(document);
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
    graphStyles(doc);
    report(block);
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
      const doc=frame.contentDocument;
      const block=doc?.getElementById('central-plan-notice');
      if(block)report(block);
    }
  });
  // Mantém os números atualizados enquanto o painel está aberto,
  // inclusive quando a etapa é marcada dentro do iframe.
  setInterval(()=>{
    if(panel.hidden)return;
    const data=getData();
    const signature=JSON.stringify({plan:data.plan,complete:data.complete});
    if(signature!==previousSignature){previousSignature=signature;report(summary);}
  },1500);

}
