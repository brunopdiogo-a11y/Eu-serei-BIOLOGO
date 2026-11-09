import {courses,sampleQuestions} from './data.js';
import {readState,writeState,exportState,importState} from './storage.js';
let state=readState(), activeQuiz=0;
const $=id=>document.getElementById(id);
function save(){state=writeState(state);render();}
function render(){
 $('s-courses').textContent=courses.length;
 $('s-done').textContent=Object.values(state.completed).filter(Boolean).length;
 $('s-answers').textContent=state.answers.length;
 $('course-list').replaceChildren(...courses.map(c=>{
   const done=Array.from({length:c.lessons},(_,i)=>!!state.completed[`${c.id}:${i+1}`]).filter(Boolean).length;
   const button=document.createElement('button');button.className='course';
   button.innerHTML=`<span class="course-icon" style="background:${c.color}">${c.icon}</span><strong>${c.title}</strong><p>${c.subtitle}</p><div class="progress"><span style="width:${100*done/c.lessons}%"></span></div><small>${done} de ${c.lessons} aulas concluídas</small>`;
   button.addEventListener('click',()=>showCourse(c));return button;
 }));
}
function showCourse(c){
 const detail=$('detail');detail.classList.remove('hidden');detail.replaceChildren();
 const title=document.createElement('h2');title.textContent=`${c.icon} ${c.title}`;detail.append(title);
 const desc=document.createElement('p');desc.textContent='Estrutura de seis aulas preparada para receber os conteúdos reais. Marque seu progresso de demonstração abaixo.';detail.append(desc);
 for(let i=1;i<=c.lessons;i++){
   const row=document.createElement('div');row.className='lesson';
   const label=document.createElement('label');const chk=document.createElement('input');chk.type='checkbox';chk.checked=!!state.completed[`${c.id}:${i}`];
   chk.addEventListener('change',()=>{state.completed[`${c.id}:${i}`]=chk.checked;save();});
   label.append(chk,document.createTextNode(`Aula ${i} · conteúdo a inserir`));row.append(label);detail.append(row);
 }
 detail.scrollIntoView({behavior:'smooth',block:'start'});
}
function drawQuiz(){
 const q=sampleQuestions[activeQuiz];const root=$('quiz');root.replaceChildren();
 const text=document.createElement('p');text.style.fontWeight='700';text.textContent=q.question;root.append(text);
 const choices=document.createElement('div');choices.className='choices';root.append(choices);
 const feedback=document.createElement('p');feedback.className='quiz-feedback';root.append(feedback);
 const next=document.createElement('button');next.className='secondary';next.textContent='Próxima questão →';next.hidden=true;root.append(next);
 q.choices.forEach((choice,index)=>{const b=document.createElement('button');b.textContent=choice;b.addEventListener('click',()=>{
   [...choices.children].forEach(x=>x.disabled=true);const correct=index===q.answer;
   feedback.textContent=`${correct?'✓ Correto!':'✗ Resposta incorreta.'} ${q.explanation}`;
   feedback.style.color=correct?'#28785e':'#b04f42';
   state.answers.push({questionId:q.id,choice:index,correct,at:new Date().toISOString()});save();next.hidden=false;
 });choices.append(b);});
 next.addEventListener('click',()=>{activeQuiz=(activeQuiz+1)%sampleQuestions.length;drawQuiz();});
}
$('go-courses').addEventListener('click',()=>$('courses').scrollIntoView({behavior:'smooth'}));
$('start').value=state.startDate||'';$('duration').value=state.durationDays||30;
$('save-plan').addEventListener('click',()=>{
 const duration=Number($('duration').value);const start=$('start').value;
 if(!start||!Number.isInteger(duration)||duration<1||duration>365){$('plan-status').textContent='Informe uma data e de 1 a 365 dias.';return;}
 state.startDate=start;state.durationDays=duration;save();
 const end=new Date(`${start}T12:00:00`);end.setDate(end.getDate()+duration-1);
 $('plan-status').textContent=`Planejamento salvo. Último dia: ${end.toLocaleDateString('pt-BR')}.`;
});
$('export').addEventListener('click',()=>{
 const blob=new Blob([exportState()],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='backup-meu-ambiente-estudos.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 $('backup-status').textContent='Backup preparado para download.';
});
$('import').addEventListener('change',async event=>{
 const file=event.target.files?.[0];if(!file)return;
 try{state=importState(await file.text());$('start').value=state.startDate||'';$('duration').value=state.durationDays||30;render();$('detail').classList.add('hidden');$('backup-status').textContent='Backup importado com sucesso.';}
 catch(e){$('backup-status').textContent=`Não foi possível importar: ${e.message}`;}finally{event.target.value='';}
});
render();drawQuiz();
