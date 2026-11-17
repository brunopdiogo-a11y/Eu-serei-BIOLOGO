/**
 * Tutor de Ecologia Vegetal: conversa dentro do APK com Worker próprio.
 * OPENAI_API_KEY nunca chega ao dispositivo. O usuário configura somente
 * URL pública do Worker e token de acesso individual ao serviço.
 */
export function initStudyQuestions(frame){
 const $=id=>document.getElementById(id);
 const trigger=$('study-question-trigger'),panel=$('study-question-panel');
 const close=$('study-question-close'),quote=$('study-question-quote');
 const question=$('study-question-message'),send=$('study-question-send');
 const status=$('study-question-status'),thread=$('study-question-thread');
 const configToggle=$('study-ai-config-toggle'),configPanel=$('study-ai-config');
 const endpointInput=$('study-ai-endpoint'),tokenInput=$('study-ai-token');
 const connect=$('study-ai-connect'),connectionStatus=$('study-ai-connection-status');
 const clear=$('study-question-clear');
 const STORAGE_ENDPOINT='eusereibiologo-ai-endpoint-v1';
 const STORAGE_TOKEN='eusereibiologo-ai-token-session-v1';
 const STORAGE_CONVERSATION='eusereibiologo-ai-conversation-v1';
 let remembered='',messages=[],busy=false,controller=null;
 try{endpointInput.value=localStorage.getItem(STORAGE_ENDPOINT)||''}catch{}
 try{tokenInput.value=sessionStorage.getItem(STORAGE_TOKEN)||''}catch{}
 const stage=()=>{
   try{return frame.contentDocument?.getElementById('articleReader')?.querySelector('h1,h2,.stage-title')
     ?.textContent?.replace(/\s+/g,' ').trim()||'Ecologia Vegetal';}catch{return 'Ecologia Vegetal';}
 };
 function selected(){
   try{
     const inside=frame.contentWindow?.getSelection()?.toString()?.trim();
     if(inside){remembered=inside.slice(0,2500);return remembered}
     const outer=window.getSelection()?.toString()?.trim();
     if(outer){remembered=outer.slice(0,2500);return remembered}
   }catch{}
   return remembered;
 }
 function validEndpoint(value){
   const normalized=String(value||'').trim().replace(/\/+$/,'');
   try{
     const parsed=new URL(normalized);
     if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.search||parsed.hash||parsed.pathname!=='/'){
       throw Error('Informe apenas o endereço HTTPS principal do Worker, sem /chat.');
     }
     return normalized;
   }catch{throw Error('Informe o endereço HTTPS do seu Cloudflare Worker.');}
 }
 function getConfig(){
   return {endpoint:validEndpoint(endpointInput.value),token:tokenInput.value.trim()};
 }
 function showConfig(show){
   configPanel.hidden=!show;
   configToggle.setAttribute('aria-expanded',String(show));
 }
 function updateStatus(text){status.textContent=text}
 function addBubble(role,text){
   const bubble=document.createElement('article');
   bubble.className='study-ai-bubble '+(role==='assistant'?'study-ai-assistant':'study-ai-user');
   const label=document.createElement('strong');label.textContent=role==='assistant'?'✦ Tutor de Biologia':'Você';
   const body=document.createElement('p');body.textContent=text;
   bubble.append(label,body);thread.append(bubble);
   thread.scrollTop=thread.scrollHeight;
 }
 function renderThread(){
   thread.replaceChildren();
   messages.forEach(msg=>addBubble(msg.role,msg.content));
 }
 function persist(){
   // Somente histórico textual limitado; não armazenamos chave OpenAI.
   try{sessionStorage.setItem(STORAGE_CONVERSATION,JSON.stringify(messages.slice(-12)))}catch{}
 }
 function open(){
   const text=selected();
   if(text)quote.value=text;
   panel.hidden=false;document.body.classList.add('study-question-open');
   if(!messages.length){
     try{
       const saved=JSON.parse(sessionStorage.getItem(STORAGE_CONVERSATION)||'[]');
       if(Array.isArray(saved))messages=saved.filter(x=>x&&['user','assistant'].includes(x.role)&&typeof x.content==='string').slice(-12);
     }catch{}
   }
   renderThread();
   showConfig(!endpointInput.value||!tokenInput.value);
   updateStatus(endpointInput.value&&tokenInput.value?'Pronto para perguntar.':'Configure o endereço da API e o código de acesso antes de perguntar.');
   question.focus();
 }
 function hide(){panel.hidden=true;document.body.classList.remove('study-question-open')}
 function watchSelection(){
   try{
     const doc=frame.contentDocument;
     doc?.addEventListener('selectionchange',()=>{
       const text=frame.contentWindow?.getSelection()?.toString()?.trim();
       if(text&&text.length>=3)remembered=text.slice(0,2500);
     });
   }catch{}
 }
 frame.addEventListener('load',watchSelection);
 trigger.addEventListener('click',open);
 close.addEventListener('click',hide);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)hide()});
 configToggle.addEventListener('click',()=>showConfig(configPanel.hidden));
 clear.addEventListener('click',()=>{
   if(busy)return;
   messages=[];persist();thread.replaceChildren();
   quote.value='';question.value='';remembered='';
   updateStatus('Nova conversa iniciada. Selecione um trecho ou faça uma pergunta.');
 });
 function saveConnection(){
   const cfg=getConfig();
   if(cfg.token.length<24)throw Error('O código de acesso precisa ter pelo menos 24 caracteres.');
   localStorage.setItem(STORAGE_ENDPOINT,cfg.endpoint);
   sessionStorage.setItem(STORAGE_TOKEN,cfg.token);
   return cfg;
 }
 function withLimit(url,options,ms=30000){
   const ac=new AbortController();
   controller=ac;
   const timer=setTimeout(()=>ac.abort(),ms);
   return fetch(url,{...options,signal:ac.signal}).finally(()=>{clearTimeout(timer);if(controller===ac)controller=null});
 }
 connect.addEventListener('click',async()=>{
   connect.disabled=true;
   try{
     const cfg=saveConnection();
     const response=await withLimit(cfg.endpoint+'/health',{method:'GET',cache:'no-store'},8000);
     if(!response.ok)throw Error('O servidor de IA não respondeu corretamente.');
     const data=await response.json();
     connectionStatus.textContent=data.configured?
       '✅ Serviço ativo e configurado. Faça uma pergunta para validar o código de acesso.':
       '⚠️ Worker acessível, mas ainda faltam os Secrets no Cloudflare.';
   }catch(e){connectionStatus.textContent='⚠️ '+e.message}
   finally{connect.disabled=false;}
 });
 send.addEventListener('click',async()=>{
   if(busy)return;
   const prompt=question.value.trim(),excerpt=quote.value.trim();
   if(!prompt&&!excerpt){updateStatus('Selecione um trecho ou escreva uma pergunta.');return}
   let cfg;
   try{cfg=saveConnection()}catch(e){showConfig(true);updateStatus(e.message);return}
   busy=true;send.disabled=true;
   const text=prompt||'Explique o trecho selecionado em linguagem clara, com precisão científica e um exemplo.';
   const history=messages.slice(-8).map(item=>({role:item.role,content:item.context||item.content}));
   updateStatus('Consultando a IA…');
   try{
     const response=await withLimit(cfg.endpoint+'/chat',{
       method:'POST',
       headers:{'Content-Type':'application/json','Authorization':'Bearer '+cfg.token},
       cache:'no-store',
       body:JSON.stringify({question:text,excerpt:excerpt.slice(0,2500),stage:stage(),history})
     });
     const data=await response.json().catch(()=>({}));
     if(!response.ok)throw Error(data.error||'Não foi possível obter a resposta da IA.');
     if(typeof data.answer!=='string'||!data.answer.trim())throw Error('A IA retornou uma resposta vazia.');
     messages.push({role:'user',content:text,context:excerpt?'Trecho estudado: '+excerpt.slice(0,1800)+'\nPergunta: '+text:text},{role:'assistant',content:data.answer});
     messages=messages.slice(-12);persist();renderThread();
     question.value='';
     // A referência é enviada somente na primeira pergunta; seguimento
     // continua pela conversa, sem repetir um trecho grande a cada turno.
     quote.value='';
     updateStatus('Resposta recebida. Você pode continuar perguntando nesta janela.');
   }catch(err){
     updateStatus(err.name==='AbortError'?'A consulta ultrapassou 30 segundos. Tente novamente.':'⚠️ '+(err.message||err));
   }finally{busy=false;send.disabled=false;}
 });
}
