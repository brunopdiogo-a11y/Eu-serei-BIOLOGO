/**
 * EU SEREI BIOLOGO · Tutor em interface de chat.
 * O acesso ao Workers AI é protegido por um código próprio, NÃO é uma chave Cloudflare.
 * O código fica no armazenamento local do aplicativo para evitar digitação repetida.
 * Quem tiver acesso ao dispositivo desbloqueado pode usá-lo: não compartilhar o APK/token.
 */
export function initStudyQuestions(frame){
  const $=id=>document.getElementById(id);
  const trigger=$('study-question-trigger'),panel=$('study-question-panel');
  const close=$('study-question-close'),input=$('study-question-message');
  const send=$('study-question-send'),status=$('study-question-status');
  const thread=$('study-question-thread'),quoted=$('study-ai-quoted');
  const quotedText=$('study-ai-quoted-text'),removeQuote=$('study-ai-remove-quote');
  const configToggle=$('study-ai-config-toggle'),configPanel=$('study-ai-config');
  const configClose=$('study-ai-config-close'),endpointInput=$('study-ai-endpoint');
  const tokenInput=$('study-ai-token'),connect=$('study-ai-connect');
  const connectionStatus=$('study-ai-connection-status'),connectionChip=$('study-ai-connection-chip');
  const reset=$('study-question-clear'),mic=$('study-ai-microphone');
  const EMPTY=$('study-ai-empty');
  const STORAGE_ENDPOINT='eusereibiologo-ai-endpoint-v1';
  const STORAGE_TOKEN='eusereibiologo-ai-token-persistent-v1';
  const LEGACY_TOKEN='eusereibiologo-ai-token-session-v1';
  const STORAGE_CONVERSATION='eusereibiologo-ai-conversation-v1';
  const DEFAULT_ENDPOINT='https://eu-serei-biologo-tutor.brunopdiogo.workers.dev';
  let remembered='',selectedExcerpt='',messages=[],busy=false;
  let recognized=null,recognitionActive=false,selectionWatch=null;
  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  const android=window.Capacitor?.isNativePlatform?.()&&window.Capacitor?.getPlatform?.()==='android';
  const androidDictation=android&&window.Capacitor?.isPluginAvailable?.('StudyDictation');
  async function nativeDictation(){
    const cap=window.Capacitor;
    if(cap.Plugins?.StudyDictation?.recognize)return cap.Plugins.StudyDictation.recognize();
    if(typeof cap.nativePromise==='function')return cap.nativePromise('StudyDictation','recognize',{});
    throw Error('Ditado Android indisponível neste APK.');
  }

  function retrieve(key,area=localStorage){try{return area.getItem(key)||''}catch{return ''}}
  function remember(key,val,area=localStorage){try{area.setItem(key,val)}catch{}}
  endpointInput.value=retrieve(STORAGE_ENDPOINT)||DEFAULT_ENDPOINT;
  tokenInput.value=retrieve(STORAGE_TOKEN)||retrieve(LEGACY_TOKEN,sessionStorage);
  if(tokenInput.value&&!retrieve(STORAGE_TOKEN))remember(STORAGE_TOKEN,tokenInput.value);
  try{
    const history=JSON.parse(retrieve(STORAGE_CONVERSATION,sessionStorage)||'[]');
    if(Array.isArray(history))messages=history.filter(m=>m&&['user','assistant'].includes(m.role)&&typeof m.content==='string').slice(-16);
  }catch{}
  function hasConnection(){return !!(endpointInput.value.trim()&&tokenInput.value.trim().length>=24)}
  function updateConnectionUI(){
    const connected=hasConnection();
    connectionChip.textContent=connected?'● IA conectada':'○ Conectar IA';
    connectionChip.classList.toggle('is-connected',connected);
    configToggle.textContent=connected?'⚙ Ajustes da conexão':'⚙ Configurar conexão com a IA';
    return connected;
  }
  function showConfig(show){
    configPanel.hidden=!show;
    configToggle.setAttribute('aria-expanded',String(show));
    configToggle.hidden=show;
  }
  function notice(text,error=false){
    status.textContent=text;
    status.dataset.error=error?'true':'false';
  }
  function stage(){
    try{
      return frame.contentDocument?.getElementById('articleReader')
        ?.querySelector('h1,h2,.stage-title')?.textContent?.replace(/\s+/g,' ').trim()||'Ecologia Vegetal';
    }catch{return 'Ecologia Vegetal'}
  }
  function getSelection(){
    try{
      const inside=frame.contentWindow?.getSelection()?.toString()?.trim();
      if(inside)return inside.slice(0,2500);
      const outer=window.getSelection()?.toString()?.trim();
      if(outer)return outer.slice(0,2500);
    }catch{}
    return remembered;
  }
  function applyQuote(text){
    selectedExcerpt=String(text||'').trim().slice(0,2500);
    quoted.hidden=!selectedExcerpt;
    quotedText.textContent=selectedExcerpt;
  }
  function appendFormattedText(parent,text){
    // Renderização controlada de **negrito**, sem interpretar HTML vindo da IA.
    const pieces=String(text||'').split(/(\*\*[^*\n]{1,120}\*\*)/g);
    for(const part of pieces){
      if(part.startsWith('**')&&part.endsWith('**')&&part.length>4){
        const strong=document.createElement('strong');
        strong.textContent=part.slice(2,-2);
        parent.append(strong);
      }else parent.append(document.createTextNode(part));
    }
  }
  function renderImages(bubble,msg){
    if(!Array.isArray(msg.images)||!msg.images.length){
      if(msg.imageLoading){
        const loading=document.createElement('small');
        loading.className='study-ai-image-status';
        loading.textContent='Pesquisando fotografias, ilustrações e diagramas no Wikimedia Commons…';
        bubble.append(loading);
      }else if(msg.imagesLoaded){
        const empty=document.createElement('small');
        empty.className='study-ai-image-status';
        empty.textContent='O Wikimedia Commons não retornou resultados para esta pesquisa. Isso não significa que não existam imagens na internet.';
        bubble.append(empty);
      }
      return;
    }
    const wrap=document.createElement('div');
    wrap.className='study-ai-image-gallery';
    for(const item of msg.images){
      try{
        const imageUrl=new URL(item.thumbnail),sourceUrl=new URL(item.source);
        const allowedThumbnail=imageUrl.hostname==='upload.wikimedia.org'||
          (imageUrl.hostname==='commons.wikimedia.org'&&
            imageUrl.pathname.startsWith('/wiki/Special:FilePath/'));
        if(imageUrl.protocol!=='https:'||!allowedThumbnail||
           sourceUrl.protocol!=='https:'||sourceUrl.hostname!=='commons.wikimedia.org')continue;
        const a=document.createElement('a');
        a.href=sourceUrl.href;a.target='_blank';a.rel='noopener noreferrer';
        a.className='study-ai-image-card';
        const img=document.createElement('img');img.src=imageUrl.href;
        img.alt='Imagem do acervo Wikimedia: '+(item.title||'');
        img.loading='lazy';img.decoding='async';
        const title=document.createElement('strong');
        title.textContent=String(item.title||'Imagem científica').slice(0,150);
        const credit=document.createElement('small');
        credit.textContent=(item.credit||'Wikimedia Commons')+' · '+(item.license||'Consulte a licença');
        a.append(img,title,credit);wrap.append(a);
      }catch{}
    }
    if(wrap.childElementCount)bubble.append(wrap);
  }
  async function requestImages(msg){
    if(msg.imageLoading)return;
    let cfg;
    try{cfg=saveConnection()}catch(e){showConfig(true);notice(e.message,true);return}
    msg.imageLoading=true;renderMessages();
    try{
      const index=messages.indexOf(msg);
      const preceding=[...messages.slice(0,Math.max(0,index))].reverse().find(m=>m.role==='user');
      const fallback=preceding?.content||'folhas ecologia vegetal';
      const query=msg.imageQuery||(/criptas? estom[aá]tic|est[oô]mat/i.test(msg.content+' '+fallback)
        ?'stomatal crypt Nerium oleander':fallback.slice(0,180));
      const res=await fetchWithTimeout(cfg.endpoint+'/images',{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+cfg.token},
        body:JSON.stringify({query})
      },16000);
      const response=await res.json().catch(()=>({}));
      if(!res.ok)throw Error(response.error||'Não foi possível buscar ilustrações.');
      msg.images=Array.isArray(response.images)?response.images:[];
      msg.imagesLoaded=true;persistConversation();
      notice(msg.images.length?'Encontradas '+msg.images.length+' imagens no Wikimedia Commons, com links para a origem.':'O Wikimedia Commons não retornou imagens nesta busca. Use “Buscar na internet” para ampliar a pesquisa.',!msg.images.length);
    }catch(e){notice('⚠️ '+(e.message||e),true)}
    finally{msg.imageLoading=false;renderMessages()}
  }
  async function generateIllustration(msg){
    if(msg.generating)return;
    let cfg;
    try{cfg=saveConnection()}catch(error){showConfig(true);notice(error.message,true);return}
    const idx=messages.indexOf(msg);
    const preceding=messages.slice(0,idx).reverse().find(x=>x.role==='user');
    const topic=(msg.imageTopic||preceding?.content||stage()).slice(0,500);
    msg.generating=true;renderMessages();
    notice('🎨 Gerando ilustração didática com IA…');
    try{
      const response=await fetchWithTimeout(cfg.endpoint+'/generate-image',{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+cfg.token},
        body:JSON.stringify({topic,excerpt:preceding?.excerpt||'',stage:stage()})
      },90000);
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw Error(result.error||'Falha ao gerar imagem.');
      if(typeof result.image!=='string'||!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(result.image)||result.image.length>12000000)throw Error('Imagem retornada em formato inesperado.');
      msg.generatedIllustration=result.image;
      msg.generatedTopic=topic;
      notice('✅ Ilustração gerada. Confira os detalhes científicos antes de usá-la como referência.');
    }catch(error){notice('⚠️ '+(error?.message||String(error)),true)}
    finally{msg.generating=false;renderMessages()}
  }
  function renderGeneratedIllustration(bubble,msg){
    if(!msg.generatedIllustration&&!msg.generating)return;
    const section=document.createElement('div');section.className='study-ai-generated';
    if(msg.generating){
      section.textContent='🎨 Criando uma ilustração didática…';
    }else{
      const image=document.createElement('img');
      image.src=msg.generatedIllustration;image.alt='Ilustração didática gerada por IA: '+(msg.generatedTopic||'Biologia');
      image.loading='lazy';image.decoding='async';
      const label=document.createElement('small');
      label.textContent='Imagem gerada por IA · representação didática, não fotografia científica. Verifique os detalhes anatômicos.';
      const save=document.createElement('a');
      save.href=msg.generatedIllustration;save.download='EU_SEREI_BIOLOGO_ilustracao.jpg';
      save.textContent='⬇ Salvar ilustração';save.className='study-ai-download';
      section.append(image,label,save);
    }
    bubble.append(section);
  }
  function renderMessages(){
    thread.replaceChildren();
    EMPTY.hidden=messages.length>0;
    for(const msg of messages){
      const bubble=document.createElement('article');
      bubble.className='study-ai-bubble '+(msg.role==='assistant'?'study-ai-assistant':'study-ai-user');
      const label=document.createElement('small');
      label.textContent=msg.role==='assistant'?'✦ Tutor de Biologia':'Você';
      bubble.append(label);
      if(msg.role==='user'&&msg.excerpt){
        const excerpt=document.createElement('blockquote');
        excerpt.className='study-ai-excerpt';excerpt.textContent=msg.excerpt;
        bubble.append(excerpt);
      }
      const body=document.createElement('p');
      if(msg.role==='assistant')appendFormattedText(body,msg.content);
      else body.textContent=msg.content;
      bubble.append(body);
      if(msg.role==='assistant'){
        renderImages(bubble,msg);
        renderGeneratedIllustration(bubble,msg);
        const visualActions=document.createElement('div');
        visualActions.className='study-ai-visual-actions';
        const generateButton=document.createElement('button');
        generateButton.type='button';generateButton.className='study-ai-image-button';
        generateButton.textContent=msg.generating?'🎨 Gerando…':msg.generatedIllustration?'🎨 Gerar outra ilustração':'🎨 Gerar ilustração';
        generateButton.disabled=!!msg.generating;
        generateButton.addEventListener('click',()=>void generateIllustration(msg));
        visualActions.append(generateButton);
        const imageButton=document.createElement('button');
        imageButton.type='button';imageButton.className='study-ai-image-button';
        imageButton.textContent=msg.imageLoading?'⌛ Buscando imagens…':msg.imagesLoaded?'🖼 Atualizar imagens reais':'🖼 Ver imagens reais';
        imageButton.disabled=!!msg.imageLoading;
        imageButton.addEventListener('click',()=>void requestImages(msg));
        visualActions.append(imageButton);
        const webSearch=document.createElement('a');
        webSearch.className='study-ai-image-button study-ai-external-image-link';
        webSearch.href='https://www.google.com/search?tbm=isch&q='+encodeURIComponent((msg.imageQuery||msg.imageTopic||'ecologia vegetal').slice(0,180));
        webSearch.target='_blank';webSearch.rel='noopener noreferrer';
        webSearch.textContent='🌐 Buscar na internet';
        webSearch.title='Abre pesquisa de imagens na web; confira a fonte e a licença.';
        visualActions.append(webSearch);
        bubble.append(visualActions);
      }
      thread.append(bubble);
    }
    requestAnimationFrame(()=>{thread.scrollTop=thread.scrollHeight});
  }
  function persistConversation(){
    remember(STORAGE_CONVERSATION,JSON.stringify(messages.slice(-16).map(({generatedIllustration,generatedTopic,generating,...rest})=>rest)),sessionStorage);
  }
  function open(){
    const excerpt=getSelection();
    if(excerpt)applyQuote(excerpt);
    panel.hidden=false;
    document.body.classList.add('study-question-open');
    renderMessages();
    updateConnectionUI();
    // Conexão cadastrada nunca precisa ocupar a tela por padrão.
    showConfig(!hasConnection());
    notice(hasConnection()?'':'Configure o acesso à IA uma única vez.');
  }
  function hide(){
    panel.hidden=true;document.body.classList.remove('study-question-open');
    try{recognized?.stop()}catch{}
  }
  function attachSelection(){
    try{
      selectionWatch=frame.contentDocument;
      selectionWatch?.addEventListener('selectionchange',()=>{
        const text=frame.contentWindow?.getSelection()?.toString()?.trim();
        if(text&&text.length>=3)remembered=text.slice(0,2500);
      });
    }catch{}
  }
  frame.addEventListener('load',attachSelection);
  trigger.addEventListener('click',open);
  close.addEventListener('click',hide);
  removeQuote.addEventListener('click',()=>{applyQuote('');remembered=''});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)hide()});
  configToggle.addEventListener('click',()=>showConfig(true));
  configClose.addEventListener('click',()=>showConfig(false));
  reset.addEventListener('click',()=>{
    if(busy)return;
    messages=[];persistConversation();applyQuote('');
    input.value='';remembered='';renderMessages();
    notice('Nova conversa iniciada.');
  });

  function validEndpoint(value){
    try{
      const parsed=new URL(String(value||'').trim());
      if(parsed.protocol!=='https:'||parsed.username||parsed.password||
         parsed.search||parsed.hash||parsed.pathname!=='/')throw Error();
      return parsed.origin;
    }catch{throw Error('Informe a URL HTTPS principal do seu Worker, sem /chat.')}
  }
  function saveConnection(){
    const endpoint=validEndpoint(endpointInput.value);
    const token=tokenInput.value.trim();
    if(token.length<24)throw Error('Digite o código de acesso completo (mínimo 24 caracteres).');
    endpointInput.value=endpoint;
    remember(STORAGE_ENDPOINT,endpoint);
    remember(STORAGE_TOKEN,token);
    updateConnectionUI();
    return {endpoint,token};
  }
  async function fetchWithTimeout(url,opts={},ms=30000){
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),ms);
    try{return await fetch(url,{...opts,signal:controller.signal,cache:'no-store'})}
    finally{clearTimeout(timeout)}
  }
  connect.addEventListener('click',async()=>{
    connect.disabled=true;
    try{
      const cfg=saveConnection();
      const res=await fetchWithTimeout(cfg.endpoint+'/health',{},9000);
      if(!res.ok)throw Error('O serviço não respondeu corretamente.');
      const body=await res.json();
      if(!body.configured)throw Error('O Worker ainda não está configurado.');
      connectionStatus.textContent='Conexão disponível. O código será verificado na próxima pergunta.';
      notice('Conexão configurada.');
      showConfig(false);
    }catch(e){connectionStatus.textContent='⚠️ '+(e?.message||e)}
    finally{connect.disabled=false}
  });
  function buildHistory(){
    return messages.slice(-8).map(m=>({
      role:m.role,content:m.context||m.content
    }));
  }
  function prepareInput(){
    const text=input.value.trim();
    const excerpt=selectedExcerpt;
    if(!text&&!excerpt)return null;
    return {
      text:text||'Explique esse trecho com precisão científica, em linguagem clara e com exemplos.',
      excerpt
    };
  }
  function setBusy(yes){
    busy=yes;send.disabled=yes;input.disabled=yes;
    mic.disabled=yes||!(SpeechRecognition||androidDictation);
    send.setAttribute('aria-label',yes?'Aguardando resposta':'Enviar pergunta');
  }
  async function sendQuestion(){
    if(busy)return;
    const next=prepareInput();
    if(!next){notice('Escreva sua dúvida ou selecione um trecho.',true);return}
    let cfg;
    try{cfg=saveConnection()}catch(e){showConfig(true);notice(e.message,true);return}
    const history=buildHistory();
    const previousInput=input.value;
    const preview={role:'user',content:next.text,excerpt:next.excerpt,
      context:next.excerpt?'Trecho do estudo:\n'+next.excerpt+'\nPergunta: '+next.text:next.text};
    messages.push(preview);renderMessages();
    setBusy(true);
    notice('A IA está preparando a resposta…');
    try{
      const res=await fetchWithTimeout(cfg.endpoint+'/chat',{
        method:'POST',headers:{
          'Content-Type':'application/json',
          'Authorization':'Bearer '+cfg.token
        },
        body:JSON.stringify({
          question:next.text,excerpt:next.excerpt,stage:stage(),history
        })
      },35000);
      const body=await res.json().catch(()=>({}));
      if(!res.ok)throw Error(body.error||'Não foi possível consultar o tutor.');
      if(typeof body.answer!=='string'||!body.answer.trim())throw Error('Resposta vazia da IA.');
      const imageIntent=/imagem|imagens|ilustra|figura|foto|micrografia|mostr[ea]/i.test(next.text);
      const imageTopic=/criptas?\s+estom[aá]tic|est[oô]mato/i.test(next.text+' '+next.excerpt)
        ?'stomatal crypt Nerium oleander':next.text.slice(0,160);
      const answerMessage={role:'assistant',content:body.answer.trim(),imageQuery:imageTopic,imageTopic:next.text.slice(0,500)};
      messages.push(answerMessage);
      messages=messages.slice(-16);
      persistConversation();renderMessages();
      if(imageIntent)void requestImages(answerMessage);
      input.value='';applyQuote('');remembered='';
      notice('');
    }catch(e){
      // Remove mensagem provisória para que o estudante possa corrigir e reenviar.
      messages.pop();renderMessages();input.value=previousInput;
      notice(e?.name==='AbortError'?'Tempo de resposta esgotado. Tente novamente.':
        '⚠️ '+(e?.message||'Erro de conexão'),true);
      if(/código de acesso|inválido|401/i.test(String(e?.message||'')))showConfig(true);
    }finally{setBusy(false)}
  }
  send.addEventListener('click',sendQuestion);
  input.addEventListener('keydown',e=>{
    if(e.key==='Enter'&&!e.shiftKey){
      e.preventDefault();void sendQuestion();
    }
  });

  if(androidDictation){
    mic.hidden=false;
    mic.addEventListener('click',async()=>{
      if(busy)return;
      mic.disabled=true;
      notice('🎤 Abra o reconhecimento de voz e fale sua pergunta.');
      try{
        const result=await nativeDictation();
        const speech=String(result?.text||'').trim();
        if(speech){
          input.value=[input.value.trim(),speech].filter(Boolean).join(' ');
          input.focus();
          notice('Texto reconhecido. Confira antes de enviar.');
        }else notice('Nenhuma fala reconhecida. Use o microfone novamente.',true);
      }catch(e){
        const explanation=String(e?.message||e);
        if(/cancelad/i.test(explanation))notice('');
        else notice('⚠️ '+explanation,true);
      }finally{mic.disabled=false}
    });
  }else if(SpeechRecognition){
    mic.hidden=false;
    mic.addEventListener('click',()=>{
      if(recognitionActive){
        try{recognized?.stop()}catch{}
        return;
      }
      try{
        recognized=new SpeechRecognition();
        recognized.lang='pt-BR';
        recognized.interimResults=false;
        recognized.continuous=false;
        recognized.onstart=()=>{
          recognitionActive=true;
          mic.classList.add('is-listening');
          mic.setAttribute('aria-label','Parar de ouvir');
          notice('🎤 Ouvindo... fale sua pergunta.');
        };
        recognized.onresult=event=>{
          const recognizedText=[...event.results].map(result=>result[0]?.transcript||'').join(' ').trim();
          input.value=[input.value.trim(),recognizedText].filter(Boolean).join(' ');
          input.focus();notice('Texto reconhecido. Confira antes de enviar.');
        };
        recognized.onerror=event=>{
          notice('Microfone indisponível: '+(event.error||'verifique permissão de áudio')+'. Você pode digitar ou usar o microfone do teclado.',true);
        };
        recognized.onend=()=>{
          recognitionActive=false;
          mic.classList.remove('is-listening');
          mic.setAttribute('aria-label','Ditar pergunta');
        };
        recognized.start();
      }catch(e){notice('Reconhecimento de voz não disponível neste dispositivo. Use o microfone do teclado.',true)}
    });
  }else{
    mic.hidden=true;
    mic.title='Use o microfone do teclado Android para ditar sua pergunta.';
  }
  updateConnectionUI();
  showConfig(false);
}
