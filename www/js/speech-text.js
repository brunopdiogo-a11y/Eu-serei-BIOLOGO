/**
 * Preparação da cópia narrada do texto de Ciências Biológicas.
 * Não altera o HTML original nem suas citações visíveis.
 */
export function prepareScientificSpeech(value, options={}) {
  const settings={skipReferences:true,smoothPunctuation:true,expandAcronyms:true,shortCommaPauses:true,...options};
  let text=String(value??'').replace(/\s+/gu,' ').trim();
  if(!text)return '';
  if(settings.skipReferences){
    text=text.replace(/\s*\((?=[^()]{3,180}\b(?:18|19|20)\d{2}\b)(?=[^()]*[A-Za-zÀ-ÿ])[^()]*\)/gu,'');
    text=text.replace(/([A-ZÀ-Ý][\p{L}-]+(?:\s+et al\.)?)\s*\(((?:18|19|20)\d{2}[a-z]?)\)/gu,'$1');
  }
  if(settings.expandAcronyms){
    text=text.replace(/\bC3\b/gu,'C três').replace(/\bC4\b/gu,'C quatro');
    text=text.replace(/\bCAM\b/gu,'C A M').replace(/\bAPP\b/gu,'A P P');
  }
  if(settings.smoothPunctuation){
    text=text.replace(/,\s*,+/gu,', ').replace(/,\s*(?=[.!?;])/gu,'');
    // Vírgula imediatamente antes da conjunção em enumeração simples:
    text=text.replace(/(\b[\p{L}\p{N}]+),\s+e\s+(?=[\p{L}])/gu,'$1 e ');
    text=text.replace(/;\s*;/gu,';');
  }
  // Não removemos indiscriminadamente as vírgulas: elas fornecem à voz
  // neural pistas de sintaxe, enumeração e entonação. A opção de vírgulas
  // curtas fica reservada ao controle da prosódia, sem mutilar o texto.
  return text.replace(/\s{2,}/gu,' ').trim();
}

/**
 * Entrega orações completas ao TTS para que a voz resolva a prosódia.
 * Cortes apenas no final de frases ou, em frases excessivamente longas,
 * em fronteiras explícitas de oração (, : —). Nunca corta por contagem
 * de palavras/caracteres em um ponto sem pontuação.
 *
 * maxChars é um limite de preferência, não de truncamento: quando não
 * existe fronteira gramatical segura, a frase segue inteira.
 */
export function splitScientificSentences(source,{maxChars=480}={}){
  const clean=String(source??'').replace(/\s+/gu,' ').trim();
  if(!clean)return [];
  const limit=Math.max(240,Math.min(1000,Number(maxChars)||480));
  // Proteger abreviações e pontos decimais da identificação de frases.
  const protectedText=clean.replace(/\b(p|pp|fig|prof|dr|dra|et al)\./giu,m=>m.replace('.','\u2024'));
  const sentences=protectedText.match(/.*?(?:[!?;]+(?:["”’)]*)|(?<!\d)\.(?!\d)(?:["”’)]*)|$)(?=\s|$)/gu)?.filter(Boolean)||[protectedText];
  const result=[];
  for(const raw of sentences){
    const sentence=raw.replace(/\u2024/gu,'.').trim();
    if(!sentence)continue;
    if(sentence.length<=limit){result.push(sentence);continue;}
    const pieces=sentence.split(/(?<=[,:—–])\s+/u);
    let group='';
    for(const piece of pieces){
      if(!group){group=piece;continue;}
      if((group+' '+piece).length<=limit){group+=' '+piece;continue;}
      // Evitar um corte em vírgula quando o primeiro grupo tem
      // poucas palavras (vocativo, adjunto curto, enumeração).
      if(group.length>=Math.min(115,limit*.25)){
        result.push(group);
        group=piece;
      }else{
        group+=' '+piece;
      }
    }
    if(group)result.push(group);
  }
  // Juntar orações consecutivas em um único pedido ao motor neural diminui
  // os silêncios de reinicialização entre pontos finais. Preservamos a
  // pontuação: a própria voz continua responsável pela inflexão.
  // Não unir perguntas/exclamações, para não prejudicar a entonação.
  const combined=[];
  const playbackLimit=Math.min(limit,420);
  for(const segment of result){
    const last=combined.length-1;
    if(last>=0&&
       combined[last].length+1+segment.length<=playbackLimit&&
       !/[!?]$/.test(combined[last])&&
       /[.!?;]$/.test(combined[last])){
      combined[last]+=' '+segment;
    }else combined.push(segment);
  }
  return combined;
}
