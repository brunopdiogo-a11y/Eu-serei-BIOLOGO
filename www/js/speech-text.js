/**
 * Versão para narração de textos científicos. O HTML e as citações permanecem
 * intactos na tela: esta função só prepara uma cópia da frase para o TTS.
 */
export function prepareScientificSpeech(value, options={}){
  const settings={skipReferences:true,smoothPunctuation:true,expandAcronyms:true,shortCommaPauses:true,...options};
  let text=String(value??'').replace(/\s+/gu,' ').trim();
  if(!text)return '';
  if(settings.skipReferences){
    // Só remove citações autor-data: não remove explicações, siglas ou nomes científicos.
    // Ex.: (Souza, 2020, p. 1), (Gurevich; Scheider; Gordonet, 2009, p. 36).
    text=text.replace(/\s*\((?=[^()]{3,180}\b(?:18|19|20)\d{2}\b)(?=[^()]*[A-Za-zÀ-ÿ])[^()]*\)/gu,'');
    // Autor (2020) também é uma citação, não uma explicação científica.
    text=text.replace(/([A-ZÀ-Ý][\p{L}-]+(?:\s+et al\.)?)\s*\(((?:18|19|20)\d{2}[a-z]?)\)/gu,'$1');
  }
  if(settings.expandAcronyms){
    text=text.replace(/\bC3\b/gu,'C três').replace(/\bC4\b/gu,'C quatro');
    text=text.replace(/\bCAM\b/gu,'C A M');
    text=text.replace(/\bAPP\b/gu,'A P P');
  }
  if(settings.smoothPunctuation){
    // Não elimina as vírgulas com função semântica: remove apenas redundâncias
    // (duplicadas, antes de "e" em enumeração simples, ou acumuladas com pontuação).
    text=text.replace(/,\s*,+/gu,', ').replace(/,\s*(?=[.!?;])/gu,'');
    text=text.replace(/(\b[\p{L}\p{N}]+),\s+e\s+(?=[\p{L}])/gu,'$1 e ');
    text=text.replace(/;\s*;/gu,';');
  }
  // Mantemos as vírgulas de oração: o mecanismo pt-BR decide a inflexão.
  // Remover todas as vírgulas fazia o leitor ignorar pausas importantes;
  // cortar por tamanho criava respirações em lugares sem pontuação.
  // Em enumerações simples, a opção de vírgulas curtas suaviza separações.
  if(settings.shortCommaPauses){
    text=text.replace(/(\\b[\\p{L}]{2,12}),\\s+(?=[\\p{L}]{2,12},)/gu,'$1 ');
  }
  return text.replace(/\s{2,}/gu,' ').trim();
}
/**
 * Fraciona a narração em unidades menores para TTS (web e Android).
 * Mantém palavras intactas e preserva pontuação. No texto já preparado,
 * algumas vírgulas podem ter sido suavizadas pelas preferências do usuário.
 */
/**
 * Divisão prosódica: cada frase completa deve ser enviada junta ao TTS.
 * Somente períodos excepcionalmente longos são partidos em pausas naturais
 * (vírgula, dois-pontos ou travessão). Não separar a cada N caracteres.
 */
export function splitScientificSentences(source,{maxChars=480}={}){
  const clean=String(source??'').replace(/\\s+/gu,' ').trim();
  if(!clean)return [];
  const limit=Math.max(250,Math.min(1000,Number(maxChars)||480));
  const safe=clean.replace(/\\b(p|pp|fig|prof|dr|dra|et al)\\./giu,m=>m.replace('.','\\u2024'));
  const chunks=safe.match(/.*?(?:[!?;]+(?:["”’)]*)|(?<!\\d)\\.(?!\\d)(?:["”’)]*)|$)(?=\\s|$)/gu)?.filter(x=>x.trim())||[safe];
  const segments=[];
  for(const chunk of chunks){
    const sentence=chunk.replace(/\\u2024/gu,'.').trim();
    if(sentence.length<=limit){segments.push(sentence);continue;}
    // Primeiro, tentar respeitar pausas de oração explícitas.
    const phrases=sentence.split(/(?<=[,:—–])\\s+/u);
    let current='';
    for(const phrase of phrases){
      if(!current){current=phrase;continue;}
      if((current+' '+phrase).length<=limit){current+=' '+phrase;continue;}
      segments.push(current);current=phrase;
    }
    if(current)segments.push(current);
    // Sem pontuação interna, manter a oração completa: um corte forçado
    // faria o Android respirar em locais gramaticalmente inadequados.
  }
  return segments;
}
