/* Leitor de voz local: SpeechSynthesis / Web Speech API.
 * Apenas o texto de desenvolvimento das etapas de Ecologia Vegetal.
 * Nunca envia o conteúdo a servidores do EU SEREI BIOLOGO.
 * O motor de voz do sistema pode operar online conforme a voz escolhida.
 */
export function initStageSpeech(frame, root) {
  const synth = window.speechSynthesis;
  const $ = id => root.querySelector('#'+id);
  const status = $('voice-status');
  const start = $('voice-start'), stopButton = $('voice-stop');
  const select = $('voice-selection'), rate = $('voice-rate');
  const label = $('voice-stage'), paragraphLabel = $('voice-paragraph');
  let stages = [], stageIndex = -1, parts = [], partIndex = 0;
  let active = false, paused = false, token = 0, utterance = null, betweenPhrasesTimer = null;
  let observer = null, viewObserver = null;
  const preferences = (()=>{try{return JSON.parse(localStorage.getItem('eusereibiologo-speech-v1')||'{}');}catch{return {};}})();
  if (preferences.rate >= .7 && preferences.rate <= 1.5) rate.value = String(preferences.rate);
  $('voice-rate-value').textContent = Number(rate.value).toFixed(1)+'×';

  function setStatus(t) { status.textContent=t; }
  function resetButtons(){
    start.textContent = active ? (paused?'▶ Continuar':'⏸ Pausar') : '▶ Ouvir etapa';
    stopButton.disabled = !active && partIndex===0;
    $('voice-prev').disabled = !parts.length || partIndex===0;
    $('voice-next').disabled = !parts.length || partIndex>=parts.length-1;
    paragraphLabel.textContent = parts.length ? 'Trecho '+Math.min(parts.length,partIndex+1)+' de '+parts.length : 'Selecione uma etapa';
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
    if(!keepPosition)partIndex=0;
    resetButtons();
  }
  function updateStage(){
    const next=frameStage();
    if(next===stageIndex)return;
    stopSpeech();
    stageIndex=next;
    const stage=stages[next];
    if(!stage){parts=[];root.hidden=true;resetButtons();return;}
    root.hidden=false;
    parts=(stage.paragraphs||[]).flatMap(splitText);
    partIndex=0;
    label.textContent = 'Aula '+stage.a+' · Etapa '+(next+1)+' · '+stage.title;
    setStatus('Pronto para ouvir o conteúdo desta etapa.');
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
    setStatus('Lendo trecho '+(partIndex+1)+' de '+parts.length+'.');
    resetButtons();
    try{synth.speak(utterance);}catch(e){stopSpeech(true);setStatus('Falha ao iniciar a voz: '+e.message);}
  }
  function begin(){
    if(!synth){setStatus('Este navegador não suporta leitura de voz.');return;}
    updateStage();
    if(!parts.length){setStatus('Abra uma etapa de leitura para ouvir o conteúdo.');return;}
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
    stopSpeech(true);token++;active=true;paused=false;speakCurrent();
  }
  function voices(){
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
    if(preferred){select.value=preferred.voiceURI;select.disabled=false;start.disabled=false;}
    else{
      select.disabled=true;start.disabled=true;
      setStatus('Nenhuma voz pt-BR encontrada. Verifique as vozes instaladas nas configurações de síntese de voz do Android.');
    }
  }
  start.addEventListener('click',begin);
  stopButton.addEventListener('click',()=>{stopSpeech();setStatus('Leitura interrompida.');});
  $('voice-prev').addEventListener('click',()=>move(-1));
  $('voice-next').addEventListener('click',()=>move(1));
  select.addEventListener('change',()=>{preferences.voice=select.value;try{localStorage.setItem('eusereibiologo-speech-v1',JSON.stringify(preferences));}catch{}if(active){stopSpeech(true);setStatus('Voz alterada. Clique para continuar.');}});
  rate.addEventListener('input',()=>{$('voice-rate-value').textContent=Number(rate.value).toFixed(1)+'×';preferences.rate=Number(rate.value);try{localStorage.setItem('eusereibiologo-speech-v1',JSON.stringify(preferences));}catch{}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){stopSpeech(true);setStatus('Leitura interrompida ao sair da página.');}});
  window.addEventListener('pagehide',()=>stopSpeech(true));
  if(!synth){start.disabled=true;setStatus('Recurso de leitura não disponível neste navegador.');return;}
  voices();
  if('onvoiceschanged' in synth)synth.addEventListener('voiceschanged',voices);
  frame.addEventListener('load',()=>{
    try{
      const doc=frame.contentDocument;
      const data=JSON.parse(doc.getElementById('course-data').textContent);
      stages=data.stages||[];
      const view=doc.getElementById('view-study');
      if(!view)throw Error('Seção de leitura indisponível');
      observer?.disconnect();viewObserver?.disconnect();
      observer=new MutationObserver(updateStage);
      observer.observe(view,{childList:true,subtree:true});
      viewObserver=new MutationObserver(updateStage);
      viewObserver.observe(view,{attributes:true,attributeFilter:['class']});
      updateStage();
    }catch(e){root.hidden=true;setStatus('Não foi possível preparar a leitura: '+e.message);}
  });
  resetButtons();
}
