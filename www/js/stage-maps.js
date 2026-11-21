/* Mapas conceituais próprios de cada etapa.
 * O texto privado da disciplina só é enviado ao tutor após um clique explícito.
 * Os mapas gerados são guardados localmente por etapa e versão do conteúdo.
 */
export function initStageMaps(frame){
 const CACHE='eusereibiologo-stage-maps-v1';
 const TOKEN='eusereibiologo-ai-token-persistent-v1';
 const ENDPOINT='eusereibiologo-ai-endpoint-v1';
 const FALLBACK='https://eu-serei-biologo-tutor.brunopdiogo.workers.dev';
 let stages=[];
 const readCache=()=>{try{return JSON.parse(localStorage.getItem(CACHE)||'{}')||{}}catch{return {}}};
 const saveCache=cache=>{try{localStorage.setItem(CACHE,JSON.stringify(cache))}catch(error){console.warn('Não foi possível salvar o mapa',error)}};
 const norm=text=>String(text||'').replace(/\s+/gu,' ').trim();
 const hash=source=>{let value=2166136261;for(let i=0;i<source.length;i++){value^=source.charCodeAt(i);value=Math.imul(value,16777619)}return (value>>>0).toString(36)};
 function stageFor(article){
   const mark=norm(article.querySelector('.eyebrow')?.textContent);
   const m=mark.match(/Etapa\s+(\d+)\s+de\s+\d+/i);
   const index=m?Number(m[1])-1:-1;
   if(index>=0&&index<stages.length)return stages[index];
   const title=norm(article.querySelector('h2,h1')?.textContent);
   return stages.find(s=>norm(s.title||s.t)===title)||null;
 }
 function extractMap(answer){
   const lines=String(answer||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
   const points=lines.filter(x=>/^[-•*]\s+/.test(x))
     .map(x=>x.replace(/^[-•*]\s+/,'').replace(/^\d+[.)]\s+/,'')) .slice(0,7);
   const synthesis=lines.find(x=>/^s[ií]ntese\s*:/i.test(x))?.replace(/^s[ií]ntese\s*:\s*/i,'')||'';
   if(points.length<3||!points.every(x=>x.length>15))throw Error('O tutor não estruturou o mapa em ideias suficientes. Tente novamente.');
   return {points,synthesis};
 }
 function addRichPoint(li,raw){
   const text=raw.replace(/\*\*/g,'').trim();
   const label=raw.match(/^\*\*(.{3,100}?)\*\*\s*:?\s*(.*)$/);
   if(label){
     const strong=document.createElement('strong');strong.textContent=label[1].replace(/:$/,'')+': ';
     li.append(strong,document.createTextNode(label[2].replace(/\*\*/g,'')));
   }else li.textContent=text;
 }
 function drawMap(box,content,record){
   const old=content.querySelector('ul');
   if(old)old.style.display='none';
   const previous=box.querySelector('.stage-concept-results');
   previous?.remove();
   const output=content.ownerDocument.createElement('section');
   output.className='stage-concept-results';
   const ul=content.ownerDocument.createElement('ul');
   for(const point of record.points){
     const li=content.ownerDocument.createElement('li');
     addRichPoint(li,point);ul.append(li);
   }
   output.append(ul);
   if(record.synthesis){
     const p=content.ownerDocument.createElement('p');
     const b=content.ownerDocument.createElement('strong');b.textContent='Síntese da etapa: ';
     p.append(b,document.createTextNode(record.synthesis.replace(/\*\*/g,'')));
     output.append(p);
   }
   const note=content.ownerDocument.createElement('small');
   note.textContent='Mapa conceitual elaborado a partir do texto desta etapa; confira os conceitos no material original.';
   output.append(note);
   const controls=box.querySelector('.stage-concept-controls');
   controls.after(output);
   box.querySelector('.stage-concept-status').textContent='Mapa específico da etapa salvo neste dispositivo.';
   box.querySelector('.stage-concept-button').textContent='↻ Refazer mapa desta etapa';
 }
 function enhance(){
   const doc=frame.contentDocument,article=doc?.getElementById('articleReader');
   if(!article)return;
   const box=article.querySelector('details.summaryBox');
   const content=box?.querySelector('.content');
   if(!content||box.dataset.contextualMapBound==='yes')return;
   const stage=stageFor(article);
   if(!stage)return;
   const material=[norm(stage.lead),...(Array.isArray(stage.paragraphs)?stage.paragraphs:[]).map(norm)].filter(Boolean).join('\n\n');
   const id=String(stage.id||''),stageTitle=norm(stage.title||stage.t);
   if(!id||material.length<150)return;
   box.dataset.contextualMapBound='yes';
   const summary=box.querySelector('summary');
   if(summary)summary.textContent='🧠 Mapa de ideias e síntese desta etapa';
   const version=hash(stageTitle+'|'+material);
   const cache=readCache(),saved=cache[id];
   const controls=doc.createElement('div');controls.className='stage-concept-controls';
   const detail=doc.createElement('p');detail.textContent='O mapa anterior era geral e repetia ideias em várias etapas. Crie uma versão baseada exclusivamente nesta etapa.';
   const button=doc.createElement('button');button.type='button';
   button.className='stage-concept-button';button.textContent='🧠 Gerar mapa desta etapa';
   const status=doc.createElement('p');status.className='stage-concept-status';
   controls.append(detail,button,status);
   content.prepend(controls);
   const oldList=content.querySelector(':scope > ul');
   if(oldList)oldList.style.display='none';
   const oldHint=content.querySelector(':scope > p.muted');
   if(oldHint)oldHint.style.display='none';
   if(saved?.version===version&&Array.isArray(saved.points)&&saved.points.length>=3)drawMap(box,content,saved);
   button.addEventListener('click',async()=>{
     const token=localStorage.getItem(TOKEN)||sessionStorage.getItem('eusereibiologo-ai-token-session-v1')||'';
     const endpoint=(localStorage.getItem(ENDPOINT)||FALLBACK).replace(/\/+$/,'');
     if(token.trim().length<24){status.textContent='⚠️ Conecte o tutor de IA nas configurações antes de gerar o mapa.';return;}
     if(!/^https:\/\//.test(endpoint)){status.textContent='⚠️ Endereço do tutor inválido.';return;}
     button.disabled=true;status.textContent='Analisando os conceitos e as relações desta etapa…';
     try{
       const response=await fetch(endpoint+'/stage-map',{
         method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token.trim()},
         body:JSON.stringify({stage:stageTitle,content:material.slice(0,11400)})
       });
       const result=await response.json();
       if(!response.ok)throw Error(result.error||'O tutor não conseguiu gerar o mapa.');
       const map=extractMap(result.map);
       cache[id]={...map,version,updatedAt:new Date().toISOString()};
       saveCache(cache);drawMap(box,content,cache[id]);
     }catch(error){status.textContent='⚠️ '+(error?.message||'Falha ao elaborar o mapa.');}
     finally{button.disabled=false;}
   });
 }
 frame.addEventListener('load',()=>{
   const doc=frame.contentDocument;if(!doc)return;
   try{
     stages=JSON.parse(doc.getElementById('course-data')?.textContent||'{}').stages||[];
   }catch{stages=[]}
   if(!Array.isArray(stages)||!stages.length)return;
   const style=doc.createElement('style');
   style.textContent='.stage-concept-controls{padding:12px 0;border-bottom:1px solid #d5e4d9;margin-bottom:12px}.stage-concept-controls p{font-size:13px;line-height:1.5;margin:0 0 10px}.stage-concept-button{background:#23794b!important;color:white!important;border:0!important;border-radius:10px;padding:10px 14px;font-weight:700;cursor:pointer}.stage-concept-button:disabled{opacity:.55}.stage-concept-status{color:#38694d;font-size:12px;margin:9px 0 0!important}.stage-concept-results li{margin:0 0 11px;line-height:1.55}.stage-concept-results p{line-height:1.6}.stage-concept-results small{color:#6b836f;font-size:11px}';
   doc.head.append(style);
   const view=doc.getElementById('view-study');
   if(!view)return;
   let scheduled=false;
   const observer=new MutationObserver(()=>{
     if(scheduled)return;scheduled=true;
     requestAnimationFrame(()=>{scheduled=false;enhance()});
   });
   observer.observe(view,{subtree:true,childList:true});
   enhance();
 });
}
