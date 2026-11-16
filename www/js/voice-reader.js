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

  const preferences = (()=>{try{return JSON.parse(localStorage.getItem('eusereibiologo-speech-v1')||'{}');}catch{return {};}})();
  if (preferences.rate >= .7 && preferences.rate <= 1.5) rate.value = String(preferences.rate);
  $('voice-rate-value').textContent = Number(rate.value).toFixed(1)+'×';

  function setStatus(t) { status.textContent=t; }
  function resetButtons(){
    headerListen.textContent=active?(paused?'▶ Continuar':'⏸ Pausar'):'🔊 Ouvir';
    headerListen.setAttribute('aria-label',active?(paused?'Continuar a narração':'Pausar a narração'):'Ouvir a partir do parágrafo selecionado');
    updateParagraphDisplay();
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
        style.textContent='[data-speech-current-paragraph]{background:rgba(55,145,90,.10)!important;outline:2px solid rgba(55,145,90,.32);outline-offset:4px;border-radius:5px;scroll-margin-block:100px}';
        doc.head.append(style);
      }
      found.setAttribute('data-speech-current-paragraph','');
      // Rolagem automática só acompanha a leitura enquanto está ativa.
      if(active && !paused)found.scrollIntoView({behavior:'smooth',block:'center'});
    }catch{}
  }
  // SpeechSynthesizer on Android may not reliably handle lengthy paragraphs.
  // Frases completas: preservam pontuação original para a prosódia do motor.
  // Evitamos cortes arbitrários em 190 caracteres, que interrompiam a leitura.
  function splitText(text){
    const clean=String(text||'').replace(/\s+/g,' ').trim();
    if(!clean)return [];
    const output=[];
    // Fim de frase ou ponto-e-vírgula. Não separa números decimais como "3.5".
    const phrases=clean.match(/.*?(?:[!?;]+(?:["”’)]*)|(?<!\d)\.(?!\d)(?:["”’)]*)|$)(?=\s|$)/gu)?.filter(x=>x.trim())||[clean];
    for(const raw of phrases){
      const phrase=raw.trim();
      if(phrase.length<=260){output.push({text:phrase,pause:/[.!?]["”’)]*$/.test(phrase)?320:210});continue;}
      // Frases muito extensas: primeiro separar nas vírgulas, respeitando a oração.
      let buffer='';
      const clauses=phrase.split(/(?<=,)\s+/u);
      for(const clause of clauses){
        if((buffer+' '+clause).trim().length>260&&buffer){
          output.push({text:buffer,pause:180});buffer='';
        }
        if(clause.length>260){
          if(buffer){output.push({text:buffer,pause:180});buffer='';}
          // Último recurso: cortar apenas no espaço entre palavras.
          let segment='';
          for(const word of clause.split(/\s+/)){
            if(segment&&(segment+' '+word).length>260){output.push({text:segment,pause:90});segment='';}
            segment+=(segment?' ':'')+word;
          }
          buffer=segment;
        }else buffer+=(buffer?' ':'')+clause;
      }
      if(buffer)output.push({text:buffer,pause:/[.!?]["”’)]*$/.test(buffer)?320:210});
    }
    if(output.length)output[output.length-1].pause=480; // respirar entre parágrafos
    return output;
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
  function stopSpeech(keepPosition=false){
    token++;active=false;paused=false;utterance=null;
    clearTimeout(betweenPhrasesTimer);betweenPhrasesTimer=null;
    try{synth?.cancel();}catch{}
    if(nativeMode&&nativeSpeech)nativeSpeech.stop().catch(()=>{});
    if(!keepPosition)partIndex=0;
    previousParagraph=-1;
    resetButtons();
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
      if(!parts.length){setStatus('Abra uma etapa de leitura em Estudos antes de iniciar a narração.');return;}
      try{
        const player=await withTimeout(getNativeSpeech(),5000,'Carregamento da voz nativa');
        if(active&&!paused){
          await withTimeout(player.pause(),5000,'Pausar voz');
          paused=true;resetButtons();
          setStatus('Leitura pausada.');return;
        }
        if(active&&paused){
          await withTimeout(player.resume(),5000,'Retomar voz');
          paused=false;resetButtons();
          setStatus('Narração retomada.');return;
        }
        token++;active=true;paused=false;nativeSession=token;nativeOffset=partIndex;
        resetButtons();
        await withTimeout(player.speak({chunksJson:JSON.stringify(parts.slice(partIndex).map(p=>p.text)),rate:String(rate.value)}),5000,'Iniciar narração');
        setStatus('Inicializando a voz Android… Se não ouvir, confira o volume de mídia e a voz pt-BR nas configurações do celular.');
      }catch(err){
        stopSpeech(true);
        setStatus('Falha ao iniciar a narração nativa: '+(err?.message||err)+'. Verifique a voz em português no Android.');
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
  function move(delta){
    if(!parts.length)return;
    partIndex=Math.max(0,Math.min(parts.length-1,partIndex+delta));
    stopSpeech(true);if(nativeMode){begin();return;}token++;active=true;paused=false;speakCurrent();
  }
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
        const player=await getNativeSpeech();
        await withTimeout(player.testVoice(),5000,'Teste da voz');
        await new Promise(resolve=>setTimeout(resolve,1800));
        const info=await withTimeout(player.diagnostic(),5000,'Diagnóstico da voz');
        const volume=Number(info.mediaVolume||0),maximum=Number(info.mediaMaxVolume||0);
        const hint=volume===0?'Volume de mídia está zerado.':'Volume de mídia: '+volume+'/'+maximum+'.';
        setStatus('Teste Android: '+(info.detail||info.state||'Aguardando voz')+'. '+hint+(info.state==='speaking'?' Se não ouviu, confira a saída Bluetooth.':''));
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
