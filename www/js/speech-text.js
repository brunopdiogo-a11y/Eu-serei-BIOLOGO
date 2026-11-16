/**
 * Versão para narração de textos científicos. O HTML e as citações permanecem
 * intactos na tela: esta função só prepara uma cópia da frase para o TTS.
 */
export function prepareScientificSpeech(value, options={}){
  const settings={skipReferences:true,smoothPunctuation:true,expandAcronyms:true,...options};
  let text=String(value??'').replace(/\s+/gu,' ').trim();
  if(!text)return '';
  if(settings.skipReferences){
    // Só remove citações autor-data: não remove explicações, siglas ou nomes científicos.
    // Ex.: (Souza, 2020, p. 1), (Gurevich; Scheider; Gordonet, 2009, p. 36).
    text=text.replace(/\s*\((?=[^()]{3,180}\b(?:18|19|20)\d{2}\b)(?=[^()]*[A-Za-zÀ-ÿ])[^()]*\)/gu,'');
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
  return text.replace(/\s{2,}/gu,' ').trim();
}
export function splitScientificSentences(source){
  const clean=String(source??'').replace(/\s+/gu,' ').trim();
  if(!clean)return [];
  const segments=[];
  // Abreviações científicas comuns são protegidas contra cisão de frases.
  const safe=clean.replace(/\b(p|pp|fig|prof|dr|dra|et al)\./giu,match=>match.replace('.','\u2024'));
  const chunks=safe.match(/.*?(?:[!?;]+(?:["”’)]*)|(?<!\d)\.(?!\d)(?:["”’)]*)|$)(?=\s|$)/gu)?.filter(x=>x.trim())||[safe];
  for(const chunk of chunks){
    let restored=chunk.replace(/\u2024/gu,'.').trim();
    if(!restored)continue;
    if(restored.length<=320){segments.push(restored);continue;}
    // Cortes longos somente em limites de palavras; preferir ponto-e-vírgula/vírgula.
    let buffer='';
    for(const token of restored.split(/(?<=,)\s+|\s+/gu)){
      if(buffer && (buffer+' '+token).length>320){
        segments.push(buffer);
        buffer='';
      }
      buffer+=(buffer?' ':'')+token;
    }
    if(buffer)segments.push(buffer);
  }
  return segments;
}
