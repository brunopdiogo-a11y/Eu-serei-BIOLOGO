/* Ferramenta de dúvidas: seleção no HTML privado, preparação local e abertura
   explícita no ChatGPT. Não simula respostas nem coleta tokens do usuário. */
export function initStudyQuestions(frame){
 const get=id=>document.getElementById(id);
 const trigger=get('study-question-trigger'),panel=get('study-question-panel'),
   close=get('study-question-close'),quote=get('study-question-quote'),
   message=get('study-question-message'),send=get('study-question-send'),
   status=get('study-question-status'),history=get('study-question-history');
 let remembered='';
 const selections=()=>{
   try{
     const doc=frame.contentDocument;
     const selection=frame.contentWindow?.getSelection()?.toString()?.trim()||'';
     if(selection){remembered=selection.slice(0,2200);return remembered;}
     const external=window.getSelection()?.toString()?.trim();
     if(external){remembered=external.slice(0,2200);return remembered;}
     return remembered;
   }catch{return remembered;}
 };
 const readStage=()=>{
   try{
     const doc=frame.contentDocument;
     return doc?.getElementById('articleReader')?.querySelector('h1,h2,.stage-title')?.textContent?.replace(/\s+/g,' ').trim()||'Ecologia Vegetal';
   }catch{return 'Ecologia Vegetal';}
 };
 function renderHistory(){
   history.replaceChildren();
   const saved=JSON.parse(sessionStorage.getItem('eusereibiologo-study-questions-v1')||'[]');
   for(const item of saved.slice(-5)){
     const el=document.createElement('p');el.textContent='Pergunta enviada: '+item;
     history.append(el);
   }
 }
 function open(){
   const selected=selections();
   quote.value=selected||'';
   panel.hidden=false;
   document.body.classList.add('study-question-open');
   message.focus();
   status.textContent=selected?'Trecho selecionado carregado.':'Selecione uma frase do material ou escreva sua pergunta.';
   renderHistory();
 }
 function hide(){panel.hidden=true;document.body.classList.remove('study-question-open');}
 // Guardamos seleção mesmo quando o usuário solta o dedo e vai ao botão ?.
 function watch(){
   try{
     const doc=frame.contentDocument;
     doc?.addEventListener('selectionchange',()=>{
       const text=frame.contentWindow?.getSelection()?.toString()?.trim();
       if(text&&text.length>=3)remembered=text.slice(0,2200);
     });
   }catch{}
 }
 frame.addEventListener('load',watch);
 trigger.addEventListener('click',open);
 close.addEventListener('click',hide);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)hide()});
 async function copyPrompt(prompt){
   try{await navigator.clipboard.writeText(prompt);return true;}
   catch{
     const el=document.createElement('textarea');el.value=prompt;
     el.style.position='fixed';el.style.opacity='0';document.body.append(el);
     el.select();let ok=false;try{ok=document.execCommand('copy')}catch{}
     el.remove();return ok;
   }
 }
 async function openChatGPT(prompt){
   const url='https://chatgpt.com/?q='+encodeURIComponent(prompt);
   const cap=window.Capacitor;
   try{
     if(cap?.isNativePlatform?.()&&cap?.isPluginAvailable?.('Browser')&&typeof cap.nativePromise==='function'){
       await cap.nativePromise('Browser','open',{url});
       return;
     }
   }catch(err){console.warn('Navegador nativo indisponível',err)}
   const child=window.open(url,'_blank','noopener,noreferrer');
   if(!child)status.textContent='Não foi possível abrir outra aba. O pedido foi copiado: abra chatgpt.com e cole a mensagem.';
 }
 send.addEventListener('click',async()=>{
   const userQuestion=message.value.trim();
   const selected=quote.value.trim();
   if(!userQuestion&&!selected){status.textContent='Escreva uma pergunta ou selecione um trecho antes de enviar.';return;}
   const prompt=[
     'Estou estudando Ecologia Vegetal no aplicativo EU SEREI BIOLOGO.',
     'Assunto da etapa: '+readStage()+'.',
     selected?'Trecho selecionado do meu material (preserve seu contexto):\n"'+selected.slice(0,2200)+'"':'',
     'Minha dúvida: '+(userQuestion||'Explique este trecho em linguagem clara, com precisão científica e exemplos.'),
     'Explique de forma gradual, separando o que o texto afirma de conhecimentos complementares. Depois permita perguntas de acompanhamento.'
   ].filter(Boolean).join('\n\n');
   send.disabled=true;
   try{
     const copied=await copyPrompt(prompt);
     await openChatGPT(prompt);
     status.textContent=copied?
       'Pedido copiado e ChatGPT aberto. Continue as perguntas na conversa do ChatGPT.':
       'ChatGPT aberto. Caso a mensagem não apareça automaticamente, selecione e copie o texto do pedido.';
     try{
       const saved=JSON.parse(sessionStorage.getItem('eusereibiologo-study-questions-v1')||'[]');
       saved.push(userQuestion||'Explicar trecho selecionado');
       sessionStorage.setItem('eusereibiologo-study-questions-v1',JSON.stringify(saved.slice(-5)));
     }catch{}
     renderHistory();
   }catch(err){status.textContent='Falha ao abrir consulta: '+(err?.message||err)}
   finally{send.disabled=false;}
 });
}
