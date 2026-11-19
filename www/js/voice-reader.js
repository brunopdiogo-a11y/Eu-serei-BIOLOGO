import {prepareScientificSpeech,splitScientificSentences} from './speech-text.js';
/* Leitor de voz local: SpeechSynthesis / Web Speech API.
 * Apenas o texto de desenvolvimento das etapas de Ecologia Vegetal.
 * Nunca envia o conteúdo a servidores do EU SEREI BIOLOGO.
 * O motor de voz do sistema pode operar online conforme a voz escolhida.
 */
export function initStageSpeech(frame, root) {
  const synth = window.speechSynthesis;
  const $ = id => root.querySelector('#'+id);
  const status = $('voice-status');
  const select = $('voice-selection'), rate = $('voice-rate');
  const headerListen=document.getElementById('voice-toggle');
  const previousButton=document.getElementById('voice-previous-paragraph');
  const nextButton=document.getElementById('voice-next-paragraph');
  const playPauseButton=document.getElementById('voice-play-pause');
  const playerPosition=document.getElementById('voice-player-position');
  const playerBar=document.getElementById('voice-player');
  let stages = [], stageIndex = -1, parts = [], partIndex = 0, paragraphs = [], previousParagraph = -1, selectedParagraph = -1;
  let active = false, paused = false, token = 0, utterance = null, betweenPhrasesTimer = null;
  let observer = null, viewObserver = null;
  const nativeMode=Boolean(window.Capacitor?.isNativePlatform?.() && window.Capacitor?.getPlatform?.()==='android');
  let nativeSpeech=null,nativeSpeechPromise=null,nativeOffset=0,nativeSession=0;
  function withTimeout(promise,ms,phase){
    let timer;
    return Promise.race([
      Promise.resolve(promise),
      new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(phase+' sem resposta do Android ('+Math.round(ms/1000)+' s).')),ms)})
    ]).finally(()=>clearTimeout(timer));
  }
  async function getNativeSpeech(){
    if(!nativeMode)return null;
    if(!nativeSpeechPromise){
      nativeSpeechPromise=import('./native-speech-runtime.js').then(async module=>{
        nativeSpeech=module.StudySpeech;
        nativeSpeech.addListener('progress',event=>{
          if(!active||paused||nativeSession!==token)return;
          const next=nativeOffset+Number(event.index||0);
          if(next>=0&&next<parts.length){
            partIndex=next;
            resetButtons();
            setStatus('Lendo parágrafo '+(paragraphIndex()+1)+' de '+paragraphs.length+'.');
          }
        });
        nativeSpeech.addListener('paused',()=>{
          if(!active)return;paused=true;resetButtons();
          setStatus('Leitura pausada pelo Android.');
        });
        nativeSpeech.addListener('resumed',()=>{
          if(!active)return;paused=false;resetButtons();
          setStatus('Leitura retomada pelo Android.');
        });
        nativeSpeech.addListener('finished',()=>{
          if(!active)return;
          stopSpeech();
          setStatus('Leitura concluída.');
        });
        nativeSpeech.addListener('error',()=>{
          if(!active)return;
          stopSpeech(true);
          setStatus('A voz Android não conseguiu continuar. Verifique se há voz pt-BR instalada.');
        });
        return nativeSpeech;
      }).catch(err=>{nativeSpeechPromise=null;throw err;});
    }
    return nativeSpeechPromise;
  }

  // Plugin de narração comunitário Capacitor 8. Diferente da ponte experimental,
  // sua chamada speak() resolve quando o motor termina de pronunciar uma frase.
  let pendingSpeechStop=Promise.resolve();
  let communitySpeech=null;
  async function getCommunitySpeech(){
    if(!nativeMode)throw new Error('A voz nativa exige o APK Android.');
    if(communitySpeech)return communitySpeech;
    const capacitor=window.Capacitor;
    if(!capacitor)throw new Error('A ponte do Capacitor não está disponível.');

    // O Android já registra o plugin em capacitor.plugins.json.
    // Acessar o proxy diretamente evita carregar um segundo runtime
    // por import() (que estava ficando pendente no WebView Motorola).
    const direct=capacitor.Plugins?.TextToSpeech;
    if(direct&&typeof direct.speak==='function'){
      communitySpeech=direct;
      return communitySpeech;
    }
    if(typeof capacitor.nativePromise==='function' &&
       capacitor.isPluginAvailable?.('TextToSpeech')){
      communitySpeech={
        speak:options=>capacitor.nativePromise('TextToSpeech','speak',options),
        stop:()=>capacitor.nativePromise('TextToSpeech','stop',{}),
        getSupportedVoices:()=>capacitor.nativePromise('TextToSpeech','getSupportedVoices',{}),
        isLanguageSupported:options=>capacitor.nativePromise('TextToSpeech','isLanguageSupported',options)
      };
      return communitySpeech;
    }
    throw new Error('Ponte nativa TextToSpeech indisponível. Capacitor='+String(Boolean(capacitor))+
      ', plugin='+String(capacitor.isPluginAvailable?.('TextToSpeech'))+
      ', nativePromise='+String(typeof capacitor.nativePromise));
  }
  async function speakCommunityQueue(session){
    try{
      setStatus('Conectando ao motor de voz Android…');
      const engine=await withTimeout(getCommunitySpeech(),3000,'Conectar à ponte Capacitor');
      while(active&&!paused&&session===token&&partIndex<parts.length){
        const item=parts[partIndex];
        setStatus('Lendo parágrafo '+(item.paragraph+1)+' de '+paragraphs.length+'.');
        resetButtons();
        // Motor comunitário usa a fila nativa e confirma a conclusão da frase.
        await withTimeout(engine.speak({
          text:item.text,lang:'pt-BR',rate:Number(rate.value),pitch:1,volume:1,queueStrategy:0
        }),45000,'Reprodução da frase');
        if(session!==token||!active||paused)return;
        // Na tela ativa, as pausas entre frases seguem a hierarquia:
        // cortes de oração sem atraso artificial; ponto-e-vírgula < ponto final.
        // Não atrasamos com temporizadores em segundo plano para evitar
        // bloqueio pelos limites de execução do WebView Android.
        if(!document.hidden&&item.pause>0){
          await new Promise(resolve=>setTimeout(resolve,item.pause));
          if(session!==token||!active||paused)return;
        }
        partIndex++;
        resetButtons();
      }
      if(session===token&&active&&!paused){
        stopSpeech();setStatus('Leitura concluída.');
      }
    }catch(err){
      if(session!==token)return;
      stopSpeech(true);
      setStatus('Motor de voz comunitário: '+(err?.message||err)+'. Confira a voz pt-BR e o volume de mídia.');
    }
  }
  const preferences = (()=>{try{return JSON.parse(localStorage.getItem('eusereibiologo-speech-v1')||'{}');}catch{return {};}})();
  const prefSwitches=[
    ['voice-skip-references','skipReferences',true],
    ['voice-smooth-punctuation','smoothPunctuation',true],
    ['voice-short-commas','shortCommaPauses',true],
    ['voice-expand-acronyms','expandAcronyms',true],
    ['voice-auto-scroll','autoScroll',true]
  ];
  const speechOptions=()=>({
    skipReferences:preferences.skipReferences!==false,
    smoothPunctuation:preferences.smoothPunctuation!==false,
    shortCommaPauses:preferences.shortCommaPauses!==false,
    expandAcronyms:preferences.expandAcronyms!==false
  });
  function persistPreferences(){
    try{localStorage.setItem('eusereibiologo-speech-v1',JSON.stringify(preferences));}catch{}
  }
  for(const [id,key,initial] of prefSwitches){
    const control=$(id);
    control.checked=preferences[key]===undefined?initial:!!preferences[key];
    control.addEventListener('change',()=>{
      preferences[key]=control.checked;persistPreferences();
      if(key==='autoScroll')return;
      const current=Math.max(0,paragraphIndex());
      const shouldResume=active&&!paused;
      const wasPaused=active&&paused;
      stopSpeech(true);
      parts=paragraphs.flatMap((p,paragraph)=>splitText(p).map(segment=>({...segment,paragraph})));
      partIndex=Math.max(0,parts.findIndex(item=>item.paragraph===current));
      selectedParagraph=current;
      resetButtons();
      if(shouldResume)void begin();
      else if(wasPaused){active=true;paused=true;resetButtons();}
      else setStatus('Preferências de leitura científica salvas.');
    });
  }
  if (preferences.rate >= .7 && preferences.rate <= 1.5) rate.value = String(preferences.rate);
  $('voice-rate-value').textContent = Number(rate.value).toFixed(1)+'×';

  function setStatus(t) { status.textContent=t; }
  let mediaControls=null,mediaListenerAttached=false,lastMediaSignature='';
  let preserveMediaOnJump=false;
  function mediaBridge(){
    if(!nativeMode)return null;
    const capacitor=window.Capacitor;
    if(!capacitor)return null;
    if(capacitor.isPluginAvailable&&!capacitor.isPluginAvailable('StudyControls'))return null;
    if(mediaControls)return mediaControls;
    if(capacitor.Plugins?.StudyControls){
      mediaControls=capacitor.Plugins.StudyControls;
    }else if(typeof capacitor.nativePromise==='function'){
      mediaControls={
        show:options=>capacitor.nativePromise('StudyControls','show',options),
        hide:()=>capacitor.nativePromise('StudyControls','hide',{})
      };
    }
    if(mediaControls&&!mediaListenerAttached){
      mediaListenerAttached=true;
      const handle=event=>{
        const action=event?.action;
        if(action==='toggle')void begin();
        else if(action==='next')moveParagraph(1);
        else if(action==='previous')moveParagraph(-1);
        else if(action==='stop'){stopSpeech();setStatus('Narração interrompida pelo Android.');}
      };
      try{
        if(typeof capacitor.Plugins?.StudyControls?.addListener==='function'){
          void capacitor.Plugins.StudyControls.addListener('mediaAction',handle).catch(()=>{});
        }else if(typeof capacitor.nativeCallback==='function'){
          capacitor.nativeCallback('StudyControls','addListener',{eventName:'mediaAction'},handle);
        }
      }catch(err){console.warn('Controles de mídia indisponíveis',err);}
    }
    return mediaControls;
  }
  function syncMedia(){
    if(!nativeMode||preserveMediaOnJump)return;
    const bridge=mediaBridge();
    if(!bridge)return;
    const current=paragraphIndex();
    const shouldShow=active&&parts.length>0;
    const signature=shouldShow?('on/'+paused+'/'+current+'/'+paragraphs.length):'off';
    if(signature===lastMediaSignature)return;
    lastMediaSignature=signature;
    try{
      const result=shouldShow?
        bridge.show({title:'Ecologia Vegetal',paused,paragraph:current+1,total:paragraphs.length}):bridge.hide();
      Promise.resolve(result).catch(err=>console.warn('Painel de áudio não disponível',err));
    }catch(err){console.warn('Painel de áudio indisponível',err);}
  }
  let lastNarrationState=null;
  function emitNarrationState(){
    const playing=active&&!paused;
    const state=playing?'playing':active&&paused?'paused':'stopped';
    if(state===lastNarrationState)return;
    lastNarrationState=state;
    document.dispatchEvent(new CustomEvent('study:narration-state',{detail:{state,playing}}));
  }
  function resetButtons(){
    headerListen.textContent=active?(paused?'▶ Continuar':'⏸ Pausar'):'🔊 Ouvir';
    headerListen.setAttribute('aria-label',active?(paused?'Continuar a narração':'Pausar a narração'):'Ouvir a partir do parágrafo selecionado');
    playerBar.hidden=!parts.length;
    previousButton.disabled=!parts.length||paragraphIndex()<=0;
    nextButton.disabled=!parts.length||paragraphIndex()>=paragraphs.length-1;
    playPauseButton.textContent=active&&!paused?'⏸':'▶';
    playPauseButton.classList.toggle('primary',active&&!paused);
    playPauseButton.setAttribute('aria-label',active&&!paused?'Pausar a narração':'Ouvir ou continuar');
    playerPosition.textContent=parts.length?(Math.max(0,paragraphIndex())+1)+'/'+paragraphs.length:'0/0';
    updateParagraphDisplay();
    syncMedia();
    emitNarrationState();
  }
  function normalized(text){
    return String(text||'').replace(/\s+/g,' ').trim().toLocaleLowerCase('pt-BR');
  }
  function paragraphIndex(){
    return parts[Math.min(parts.length-1,partIndex)]?.paragraph??-1;
  }
  function updateParagraphDisplay(){
    const index=paragraphIndex();
    if(index!==previousParagraph){
      previousParagraph=index;
      highlightParagraph(index);
    }
  }
  // Ao tocar no texto original, escolhemos o parágrafo correspondente.
  // Nada começa a tocar até o usuário pressionar "Ouvir".
  function chooseParagraph(index){
    const first=parts.findIndex(item=>item.paragraph===index);
    if(first<0)return false;
    stopSpeech(true);
    partIndex=first;
    selectedParagraph=index;
    previousParagraph=-1;
    resetButtons();
    setStatus('Parágrafo '+(index+1)+' selecionado. Toque em Ouvir para começar daqui.');
    return true;
  }
  function selectFromArticle(event){
    if(!parts.length||stageIndex<0)return;
    const doc=frame.contentDocument;
    const reader=doc?.getElementById('articleReader');
    const original=event.target;
    const el=original?.nodeType===1?original:original?.parentElement;
    if(!reader||!el||!reader.contains(el))return;
    if(el.closest('button,a,select,input,textarea,[contenteditable="true"]'))return;
    const node=el.closest('.studybody p');
    if(!node||!reader.contains(node))return;
    const content=normalized(node.textContent);
    if(content.length<15)return;
    const index=paragraphs.findIndex(p=>{
      const saved=normalized(p);
      return saved===content || (Math.min(content.length,saved.length)>=30 && saved.slice(0,Math.min(100,content.length,saved.length))===content.slice(0,Math.min(100,content.length,saved.length)));
    });
    if(index<0)return;
    chooseParagraph(index);
  }
  function highlightParagraph(index){
    try{
      const doc=frame.contentDocument;
      const reader=doc?.getElementById('articleReader');
      if(!reader)return;
      const old=reader.querySelectorAll('[data-speech-current-paragraph]');
      old.forEach(n=>n.removeAttribute('data-speech-current-paragraph'));
      if(index<0)return;
      const target=normalized(paragraphs[index]);
      if(!target)return;
      // Não modificamos textos nem a estrutura da aula importada.
      const candidates=[...reader.querySelectorAll('p, li, blockquote')];
      const found=candidates.find(node=>{
        const body=normalized(node.textContent);
        return body===target || (target.length>35&&(body.includes(target.slice(0,65))||target.includes(body.slice(0,65))));
      });
      if(!found)return;
      if(!doc.getElementById('speech-follow-style')){
        const style=doc.createElement('style');style.id='speech-follow-style';
        style.textContent='[data-speech-current-paragraph]{background:rgba(255,207,48,.42)!important;outline:2px solid rgba(238,174,15,.9)!important;outline-offset:4px;border-radius:6px;scroll-margin-block:100px;box-decoration-break:clone;-webkit-box-decoration-break:clone}@media(prefers-color-scheme:dark){[data-speech-current-paragraph]{background:rgba(255,205,40,.48)!important;outline-color:#ffcf54!important}}';
        doc.head.append(style);
      }
      found.setAttribute('data-speech-current-paragraph','');
      // Rolagem automática só acompanha a leitura enquanto está ativa.
      if(active && !paused && preferences.autoScroll!==false)found.scrollIntoView({behavior:'smooth',block:'center'});
    }catch{}
  }
  // SpeechSynthesizer on Android may not reliably handle lengthy paragraphs.
  // Frases completas: preservam pontuação original para a prosódia do motor.
  // Evitamos cortes arbitrários em 190 caracteres, que interrompiam a leitura.
  function splitText(text){
    // Preparação pode levar alguns instantes em etapas longas, mas é feita antes
    // de enviar o texto ao motor. O conteúdo acadêmico original não é alterado.
    const spoken=prepareScientificSpeech(text,speechOptions());
    return splitScientificSentences(spoken).filter(Boolean).map(phrase=>({
      text:phrase,pause:/[.!?]$/.test(phrase)?90:/;$/.test(phrase)?65:0
    }));
  }
  function frameStage(){
    try{
      const doc=frame.contentDocument;
      if(!doc?.getElementById('view-study')?.classList.contains('on'))return -1;
      const eyebrow=doc.getElementById('articleReader')?.querySelector('.eyebrow')?.textContent||'';
      const m=eyebrow.match(/Etapa\s+(\d+)\s+de\s+\d+/i);
      return m?Number(m[1])-1:-1;
    }catch{return -1;}
  }
  function stopSpeech(keepPosition=false,keepNotification=false){
    preserveMediaOnJump=keepNotification;
    token++;active=false;paused=false;utterance=null;
    clearTimeout(betweenPhrasesTimer);betweenPhrasesTimer=null;
    try{synth?.cancel();}catch{}
    if(nativeMode&&nativeSpeech)nativeSpeech.stop().catch(()=>{});
    if(nativeMode&&communitySpeech){
      pendingSpeechStop=Promise.resolve(communitySpeech.stop()).catch(err=>console.warn('Falha ao parar voz',err));
    }
    if(!keepPosition)partIndex=0;
    previousParagraph=-1;
    resetButtons();
    preserveMediaOnJump=false;
  }
  function updateStage(){
    const next=frameStage();
    if(next===stageIndex)return;
    stopSpeech();
    stageIndex=next;
    const stage=stages[next];
    if(!stage){parts=[];paragraphs=[];resetButtons();setStatus('Abra uma etapa em Estudos para iniciar a leitura.');return;}
    paragraphs=(stage.paragraphs||[]).map(p=>String(p||'').replace(/\s+/g,' ').trim()).filter(Boolean);
    parts=paragraphs.flatMap((p,paragraph)=>splitText(p).map(chunk=>({...chunk,paragraph})));
    partIndex=0;
    selectedParagraph=-1;
    setStatus('Sem seleção, 🔊 Ouvir começa no primeiro parágrafo. Toque em outro parágrafo para começar nele.');
    resetButtons();
  }
  function speakCurrent(){
    if(!active||partIndex>=parts.length){stopSpeech();setStatus('Leitura concluída.');return;}
    const thisToken=token;
    utterance=new SpeechSynthesisUtterance(parts[partIndex].text);
    const voice=select.options[select.selectedIndex];
    const voiceId=voice?.value;
    const chosen=synth.getVoices().find(v=>v.voiceURI===voiceId);
    if(!chosen || String(chosen.lang||'').replace(/_/g,'-').toLowerCase()!=='pt-br'){
      stopSpeech(true);setStatus('Escolha uma voz em português do Brasil.');return;
    }
    utterance.voice=chosen;
    utterance.lang='pt-BR';
    utterance.rate=Number(rate.value);
    utterance.pitch=1;
    utterance.onend=()=>{
      if(!active||token!==thisToken)return;
      const delay=parts[partIndex]?.pause??250;
      partIndex++;resetButtons();
      betweenPhrasesTimer=setTimeout(()=>{
        betweenPhrasesTimer=null;
        if(!active||token!==thisToken)return;
        if(paused)return;
        speakCurrent();
      },delay);
    };
    utterance.onerror=e=>{
      if(token!==thisToken||!active)return;
      stopSpeech(true);
      setStatus('Reprodução interrompida ('+(e.error||'erro do motor de voz')+'). Toque em Ouvir etapa para tentar novamente.');
    };
    setStatus('Lendo parágrafo '+(paragraphIndex()+1)+' de '+paragraphs.length+'.');
    resetButtons();
    try{synth.speak(utterance);}catch(e){stopSpeech(true);setStatus('Falha ao iniciar a voz: '+e.message);}
  }
  async function begin(){
    // Regra de início: nenhuma seleção explícita = primeiro parágrafo da etapa.
    // Pausa/retomada não reinicia a leitura.
    if(!active && selectedParagraph<0)partIndex=0;
    if(nativeMode){
      updateStage();
      if(!parts.length){
        setStatus('Abra uma etapa de leitura antes de usar Ouvir.');return;
      }
      if(active&&!paused){
        token++;paused=true;
        if(communitySpeech)pendingSpeechStop=Promise.resolve(communitySpeech.stop()).catch(()=>{});
        resetButtons();setStatus('Leitura pausada. Continuar repetirá a frase atual.');return;
      }
      if(active&&paused){paused=false;}
      try{
        await getCommunitySpeech();
        // Aguarda o cancelamento da frase anterior para não silenciar o novo trecho.
        await withTimeout(pendingSpeechStop,3000,'Finalizar frase anterior');
        token++;active=true;paused=false;nativeSession=token;
        resetButtons();
        void speakCommunityQueue(token);
      }catch(err){
        stopSpeech(true);
        setStatus('Motor comunitário não inicializou: '+(err?.message||err)+'. Confirme que instalou o APK atualizado.');
      }
      return;
    }
    if(!synth){setStatus('Este navegador não suporta leitura de voz.');return;}
    updateStage();
    if(!parts.length){setStatus('Abra uma etapa de leitura em Estudos antes de iniciar a narração.');return;}
    if(!select.value){setStatus('Nenhuma voz em português do Brasil disponível neste aparelho. Instale ou ative uma voz pt-BR no mecanismo de fala do Android.');return;}
    if(active && !paused){
      // Em certos Androids SpeechSynthesis.pause() não permite retomar.
      // Cancelamos o trecho atual e preservamos o índice para retomá-lo.
      token++;paused=true;
      clearTimeout(betweenPhrasesTimer);betweenPhrasesTimer=null;
      try{synth.cancel();}catch{}
      utterance=null;
      setStatus('Leitura pausada. Continuar retomará o trecho atual.');
      resetButtons();return;
    }
    // Tanto ao iniciar quanto ao continuar criamos uma nova utterance:
    // evita o travamento de resume() em alguns motores Android.
    token++;active=true;paused=false;
    clearTimeout(betweenPhrasesTimer);betweenPhrasesTimer=null;
    try{synth.cancel();}catch{}
    speakCurrent();
  }
  function moveParagraph(delta){
    if(!parts.length)return;
    const current=Math.max(0,paragraphIndex());
    const target=Math.max(0,Math.min(paragraphs.length-1,current+delta));
    const first=parts.findIndex(item=>item.paragraph===target);
    if(first<0)return;
    const wasPlaying=active&&!paused,wasPaused=active&&paused;
    stopSpeech(true,true);
    partIndex=first;selectedParagraph=target;previousParagraph=-1;
    resetButtons();
    setStatus('Parágrafo '+(target+1)+' de '+paragraphs.length+'.');
    if(wasPlaying)void begin();
    else if(wasPaused){active=true;paused=true;resetButtons();}
  }
  previousButton.addEventListener('click',()=>moveParagraph(-1));
  nextButton.addEventListener('click',()=>moveParagraph(1));
  playPauseButton.addEventListener('click',()=>void begin());
  function voices(){
    if(nativeMode){
      select.replaceChildren();
      const option=document.createElement('option');
      option.value='native-pt-BR';
      option.textContent='Português do Brasil · voz Android';
      select.append(option);select.disabled=true;
      return;
    }
    if(!synth)return;
    const pool=synth.getVoices().filter(v=>String(v.lang||'').replace(/_/g,'-').toLowerCase()==='pt-br');
    const before=select.value;
    select.replaceChildren();
    for(const v of pool){
      const option=document.createElement('option');option.value=v.voiceURI;
      option.textContent=v.name+' (Português do Brasil)'+(v.localService?' · dispositivo':'');
      select.append(option);
    }
    const preferred=pool.find(v=>v.voiceURI===before)||pool.find(v=>v.voiceURI===preferences.voice)||pool[0];
    if(preferred){select.value=preferred.voiceURI;select.disabled=false;}
    else{
      select.disabled=true;
      setStatus('Nenhuma voz pt-BR encontrada. Verifique as vozes instaladas nas configurações de síntese de voz do Android.');
    }
  }
  const testButton=$('voice-test');
  testButton.addEventListener('click',async()=>{
    testButton.disabled=true;
    setStatus('Verificando a saída de áudio…');
    try{
      if(nativeMode){
        setStatus('Etapa 1/3: verificando se o Android reconhece o plugin de voz…');
        if(window.Capacitor?.isPluginAvailable && !window.Capacitor.isPluginAvailable('TextToSpeech')){
          throw new Error('O plugin TextToSpeech não está registrado neste APK. Atualize o aplicativo.');
        }
        setStatus('Etapa 2/3: acessando diretamente a ponte Capacitor…');
        const engine=await withTimeout(getCommunitySpeech(),3000,'Conexão Capacitor');
        setStatus('Etapa 3/3: enviando uma frase de teste ao Android…');
        // Não bloqueamos o teste aguardando isLanguageSupported: o objetivo é
        // saber primeiro se o próprio mecanismo consegue reproduzir alguma voz.
        await withTimeout(engine.speak({
          text:'Olá. Teste de voz do Eu Serei Biólogo.',
          lang:'pt-BR',rate:0.9,pitch:1,volume:1,queueStrategy:0
        }),12000,'Reprodução da voz');
        setStatus('O motor terminou a frase de teste. Se não ouviu som, verifique volume de mídia, Bluetooth e voz pt-BR do Android.');
      }else if(synth){
        const voice=new SpeechSynthesisUtterance('Olá. Este é um teste de voz do Eu Serei Biólogo.');
        voice.lang='pt-BR';voice.rate=Number(rate.value);
        const preferred=[...synth.getVoices()].find(v=>String(v.lang||'').replace(/_/g,'-').toLowerCase()==='pt-br');
        if(preferred)voice.voice=preferred;
        voice.onstart=()=>setStatus('Teste de voz iniciado. Se não ouvir, confira o volume de mídia.');
        voice.onerror=e=>setStatus('Teste de voz falhou: '+(e.error||'motor de fala indisponível'));
        synth.cancel();synth.speak(voice);
      }else setStatus('Este aparelho não disponibilizou um mecanismo de voz.');
    }catch(err){
      setStatus('Falha no teste de voz: '+(err?.message||err));
    }finally{testButton.disabled=false;}
  });
  headerListen.addEventListener('click',begin);
  select.addEventListener('change',()=>{preferences.voice=select.value;try{localStorage.setItem('eusereibiologo-speech-v1',JSON.stringify(preferences));}catch{}if(active){stopSpeech(true);setStatus('Voz alterada. Clique para continuar.');}});
  rate.addEventListener('input',()=>{$('voice-rate-value').textContent=Number(rate.value).toFixed(1)+'×';preferences.rate=Number(rate.value);try{localStorage.setItem('eusereibiologo-speech-v1',JSON.stringify(preferences));}catch{}});
  // Não cancelamos a narração apenas porque o Chrome ficou em segundo plano.
  // Isso permite continuidade onde o navegador suportar TTS em segundo plano.
  // O Android pode suspender a Web Speech API; áudio nativo exige serviço Android.
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden && active && !paused){
      setStatus('Narração em segundo plano (a continuidade depende do Android/Chrome).');
    }else if(!document.hidden && active && !paused){
      setStatus('Narração ativa · parágrafo '+(paragraphIndex()+1)+' de '+paragraphs.length+'.');
    }
  });
  window.addEventListener('pagehide',()=>stopSpeech(true));
  if(!synth&&!nativeMode){headerListen.disabled=true;setStatus('Recurso de leitura não disponível neste navegador.');return;}
  root.hidden=false;
  voices();
  if(synth&&'onvoiceschanged' in synth)synth.addEventListener('voiceschanged',voices);
  frame.addEventListener('load',()=>{
    try{
      const doc=frame.contentDocument;
      const data=JSON.parse(doc.getElementById('course-data').textContent);
      stages=data.stages||[];
      const view=doc.getElementById('view-study');
      if(!view)throw Error('Seção de leitura indisponível');
      doc.getElementById('articleReader')?.addEventListener('click',selectFromArticle);
      observer?.disconnect();viewObserver?.disconnect();
      observer=new MutationObserver(updateStage);
      observer.observe(view,{childList:true,subtree:true});
      viewObserver=new MutationObserver(updateStage);
      viewObserver.observe(view,{attributes:true,attributeFilter:['class']});
      updateStage();
    }catch(e){setStatus('Não foi possível preparar a leitura: '+e.message);}
  });
  resetButtons();
}
