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
  if(settings.shortCommaPauses){
    // TTS Android impõe pausas próprias nas vírgulas e pode alongá-las.
    // Apenas na cópia falada, removemos as vírgulas; ponto e ponto-e-vírgula
    // continuam sendo delimitadores de frase, portanto mais longos.
    text=text.replace(/,\s*/gu,' ');
  }
  return text.replace(/\s{2,}/gu,' ').trim();
}
/**
 * Fraciona a narração em unidades menores para TTS (web e Android).
 * Mantém palavras intactas e preserva pontuação. No texto já preparado,
 * algumas vírgulas podem ter sido suavizadas pelas preferências do usuário.
 */
export function splitScientificSentences(source,{maxChars=145}={}){
  const clean=String(source??'').replace(/\s+/gu,' ').trim();
  if(!clean)return [];
  const limit=Math.max(70,Math.min(260,Number(maxChars)||145));
  const segments=[];
  // Evita tratar abreviações e números decimais como fim de frase.
  const safe=clean.replace(/\b(p|pp|fig|prof|dr|dra|et al)\./giu,m=>m.replace('.','\u2024'));
  const chunks=safe.match(/.*?(?:[!?;]+(?:["”’)]*)|(?<!\d)\.(?!\d)(?:["”’)]*)|$)(?=\s|$)/gu)?.filter(x=>x.trim())||[safe];

  function splitLong(sentence){
    const result=[],words=sentence.trim().split(/\s+/u);
    let remaining=words;
    while(remaining.length){
      let length=0,last=0,best=0,bestScore=-1;
      for(let n=0;n<remaining.length;n++){
        const candidate=remaining[n];
        const nextLength=length+(n?1:0)+candidate.length;
        if(n>0&&nextLength>limit)break;
        length=nextLength;last=n+1;
        if(n===remaining.length-1)break;
        const endsComma=/[,;:]$/.test(candidate);
        const endsDash=/[–—]$/.test(candidate);
        const target=limit*.76;
        const score=(endsComma?80:endsDash?30:0)-Math.abs(length-target)/4;
        if(length>=limit*.42&&score>bestScore){
          best=n+1;bestScore=score;
        }
      }
      const count=last===remaining.length?last:(best||last);
      result.push(remaining.slice(0,count).join(' '));
      remaining=remaining.slice(count);
    }
    return result;
  }
  for(const chunk of chunks){
    const sentence=chunk.replace(/\u2024/gu,'.').trim();
    if(!sentence)continue;
    if(sentence.length<=limit){segments.push(sentence);continue;}
    segments.push(...splitLong(sentence));
  }
  return segments;
}
