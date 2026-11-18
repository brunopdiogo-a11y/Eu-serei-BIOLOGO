/* Cards gráficos de estudo baseados somente em registros reais. */
export function renderStudyDashboard(root,dots,info){
 const {courses,plans,sessions,completedStages,completedLessons,today}=info;
 const previous=root.scrollLeft;
 const make=(tag,cls,value)=>{
  const el=document.createElement(tag);if(cls)el.className=cls;
  if(value!==undefined)el.textContent=String(value);
  return el;
 };
 const clamp=(n)=>Math.max(0,Math.min(100,Number(n)||0));
 const primary=courses.find(c=>plans[c.id])||courses[0];
 const isStage=!!primary.stagesPerLesson;
 const total=isStage?primary.stagesPerLesson.reduce((a,b)=>a+b,0):primary.lessons;
 const done=isStage?completedStages(primary):completedLessons(primary);
 const percent=total?Math.round(done/total*100):0;
 const plan=plans[primary.id];
 const cards=[];
 function card(title,sub,extra){
   const el=make('article','home-slide '+(extra||''));
   const top=make('div','home-slide-heading');
   top.append(make('strong','',title),make('span','home-slide-tag',sub));
   el.append(top);cards.push(el);return el;
 }
 const a=card('🌿 Progresso',primary.title,'home-slide-primary');
 const wrap=make('div','home-ring-layout'),ring=make('div','home-progress-ring');
 ring.style.setProperty('--progress',clamp(percent)+'%');
 ring.setAttribute('role','img');
 ring.setAttribute('aria-label',percent+'% concluído: '+done+' de '+total+' '+(isStage?'etapas':'aulas'));
 const center=make('div','home-ring-core');
 center.append(make('strong','',percent+'%'),make('small','','concluído'));ring.append(center);
 const copy=make('div','home-progress-copy');
 copy.append(make('strong','',done+' de '+total),make('span','',isStage?'etapas concluídas':'aulas concluídas'),
   make('p','',Math.max(0,total-done)+' restantes para completar a matéria.'));
 wrap.append(ring,copy);a.append(wrap);
 const b=card('🎯 Meta do plano',plan?'Planejamento ativo':'Sem meta definida');
 if(plan&&plan.start&&plan.end){
   const start=new Date(plan.start+'T12:00:00'),end=new Date(plan.end+'T12:00:00'),now=new Date(today+'T12:00:00');
   if(Number.isFinite(start.getTime())&&Number.isFinite(end.getTime())&&end>=start){
     const span=Math.max(1,Math.round((end-start)/86400000)+1);
     const elapsed=Math.max(0,Math.min(span,Math.round((now-start)/86400000)+1));
     const goalLessons=Math.max(1,Math.min(primary.lessons,Number(plan.lessonGoal)||primary.lessons));
     const goal=isStage?primary.stagesPerLesson.slice(0,goalLessons).reduce((x,y)=>x+y,0):goalLessons;
     const achieved=Math.min(done,goal),ideal=Math.floor(goal*elapsed/span);
     b.append(make('div','home-emphasis',achieved+' / '+goal+' '+(isStage?'etapas':'aulas')));
     const track=make('div','home-target-track'),fill=make('i');
     fill.style.width=clamp(achieved/goal*100)+'%';track.append(fill);
     track.setAttribute('role','progressbar');track.setAttribute('aria-label','Progresso da meta planejada');
     track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax','100');
     track.setAttribute('aria-valuenow',String(Math.round(achieved/goal*100)));
     b.append(track,make('p','home-slide-note',achieved>=goal?'Meta concluída!':now>end?'Prazo encerrado; ajuste o plano.':achieved>=ideal?'Seu ritmo está acompanhando a meta.':'Ritmo previsto até hoje: '+ideal+' '+(isStage?'etapas':'aulas')+'.'));
   }else b.append(make('p','home-slide-note','Confira as datas da meta.'));
 }else b.append(make('p','home-slide-note','Defina um prazo na aba Planejar para acompanhar o andamento da matéria.'));
 const c=card('📅 Frequência','Últimos 7 dias');
 const valid=(sessions||[]).filter(s=>s&&s.courseId===primary.id&&typeof s.date==='string');
 const dates=Array.from({length:7},(_,i)=>{
   const d=new Date(today+'T12:00:00');d.setDate(d.getDate()-(6-i));
   const date=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
   return {date,label:d.toLocaleDateString('pt-BR',{weekday:'short'}).replace('.','').slice(0,3),
     minutes:valid.filter(s=>s.date===date).reduce((n,s)=>n+Math.max(0,Number(s.minutes)||0),0)};
 });
 const max=Math.max(1,...dates.map(d=>d.minutes)),chart=make('div','home-week-chart');
 for(const day of dates){
   const col=make('div','home-week-day'),bar=make('div','home-week-bar');
   bar.style.height=(day.minutes?Math.max(10,Math.round(day.minutes/max*100)):3)+'%';
   bar.title=day.date+': '+Math.round(day.minutes)+' minuto(s)';
   col.append(bar,make('small','',day.label));chart.append(col);
 }
 const studied=dates.filter(d=>d.minutes>0).length;
 c.append(chart,make('p','home-slide-note',studied+' de 7 dias com estudo registrado · '+Math.round(dates.reduce((n,d)=>n+d.minutes,0))+' minutos.'));
 const d=card('📅 Prazo restante',plan?'Meta da disciplina':'Planeje seus estudos');
 if(plan?.end){
  const day=iso=>new Date(iso+'T12:00:00');
  const n=Math.round((Date.UTC(day(plan.end).getFullYear(),day(plan.end).getMonth(),day(plan.end).getDate())-Date.UTC(day(today).getFullYear(),day(today).getMonth(),day(today).getDate()))/86400000);
  const left=Math.max(0,total-done);
  const available=Math.max(0,n+1);
  d.append(make('div','home-emphasis',n<0?'Prazo vencido':n===0?'Último dia':n+' dia(s)'));
  d.append(make('p','home-slide-note',available?left+' '+(isStage?'etapas':'aulas')+' pendentes · cerca de '+Math.ceil(left/available)+' por dia, incluindo hoje.':'Atualize a data para continuar o planejamento.'));
 }else d.append(make('p','home-slide-note','Defina uma data de conclusão para visualizar quantos dias faltam.'));

 root.replaceChildren(...cards);
 dots.replaceChildren(...cards.map((_,index)=>{
   const button=make('button','home-carousel-dot');button.type='button';
   button.setAttribute('aria-label','Ver card '+(index+1));
   button.addEventListener('click',()=>cards[index].scrollIntoView({behavior:'smooth',block:'nearest',inline:'start'}));
   return button;
 }));
 const update=()=>{
   const width=(cards[0]?.getBoundingClientRect().width||1)+12;
   const current=Math.min(cards.length-1,Math.round(root.scrollLeft/width));
   [...dots.children].forEach((btn,index)=>btn.setAttribute('aria-current',index===current?'true':'false'));
 };
 root.onscroll=update;
 root.scrollLeft=Math.max(0,Math.min(previous,root.scrollWidth-root.clientWidth));
 update();
}
