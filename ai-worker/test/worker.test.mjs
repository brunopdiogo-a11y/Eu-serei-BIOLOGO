import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

const env={AI:{run:async()=>({response:'A luz influencia a fotossíntese.'})},STUDY_ACCESS_TOKEN:'x'.repeat(32)};
const origin='https://brunopdiogo-a11y.github.io';
function chat(body,token=env.STUDY_ACCESS_TOKEN,requestOrigin=origin){
  return new Request('https://tutor.example.workers.dev/chat',{
    method:'POST',headers:{Origin:requestOrigin,'Content-Type':'application/json',Authorization:'Bearer '+token},
    body:JSON.stringify(body)
  });
}
test('gera mapa conceitual por etapa somente com token válido e texto enviado',async()=>{
  let sent='';
  const e={...env,AI:{run:async(model,input)=>{
    sent=input.messages.at(-1).content;
    return {response:'IDEIAS:\\n- **Pólen:** participa da reprodução e também fornece alimento aos insetos.\\n- **Estames:** as anteras liberam os grãos de pólen.\\n- **Conflito:** o pólen consumido deixa de participar da fecundação.\\nSÍNTESE: a oferta de pólen envolve reprodução e visitantes florais.'};
  }}};
  const content='O grão de pólen é veículo para o gameta masculino e pode servir de alimento aos visitantes. '.repeat(6);
  const request=new Request('https://tutor.example.workers.dev/stage-map',{
    method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Authorization:'Bearer '+env.STUDY_ACCESS_TOKEN},
    body:JSON.stringify({stage:'Pólen',content})
  });
  const response=await worker.fetch(request,e);
  assert.equal(response.status,200);
  assert.ok((await response.json()).map.includes('Estames'));
  assert.ok(sent.includes(content.trim()));
  assert.ok(sent.includes('Pólen'));
});
test('rejeita mapa com material insuficiente',async()=>{
  const response=await worker.fetch(new Request('https://tutor.example.workers.dev/stage-map',{
    method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Authorization:'Bearer '+env.STUDY_ACCESS_TOKEN},
    body:JSON.stringify({stage:'Néctar',content:'curto'})
  }),env);
  assert.equal(response.status,400);
});
test('health does not expose secrets',async()=>{
  const res=await worker.fetch(new Request('https://tutor.example.workers.dev/health'),env);
  const json=await res.json();
  assert.equal(json.configured,true);
  assert.ok(!JSON.stringify(json).includes(env.STUDY_ACCESS_TOKEN));
});
test('invalid token is rejected before contacting Workers AI',async()=>{
  const res=await worker.fetch(chat({question:'Explique'},'invalid'),env);
  assert.equal(res.status,401);
});
test('rejects unexpected website origin',async()=>{
  const res=await worker.fetch(chat({question:'Explique'},env.STUDY_ACCESS_TOKEN,'https://evil.invalid'),env);
  assert.equal(res.status,403);
});
test('rejects empty questions',async()=>{
  const res=await worker.fetch(chat({}),env);
  assert.equal(res.status,400);
});
test('envia mensagens ao Workers AI sem usar chave externa',async()=>{
  let modelUsed,params;
  const e={...env,AI:{run:async(model,input)=>{
    modelUsed=model;params=input;
    return {response:'A luz influencia a fotossíntese.'};
  }}};
  const res=await worker.fetch(chat({question:'Como funciona a luz?',excerpt:'Luz e fotossíntese.'}),e);
  assert.equal(res.status,200);
  assert.equal((await res.json()).answer,'A luz influencia a fotossíntese.');
  assert.equal(modelUsed,'@cf/meta/llama-3.1-8b-instruct-fp8-fast');
  assert.equal(params.messages.at(-1).role,'user');
  assert.ok(params.messages.at(-1).content.includes('Luz e fotossíntese.'));
  assert.equal(params.max_tokens,700);
});
test('retorna erro de cota gratuita quando o modelo limitar',async()=>{
  const e={...env,AI:{run:async()=>{throw Error('quota exceeded 429')}}};
  const res=await worker.fetch(chat({question:'Como funciona a luz?'}),e);
  assert.equal(res.status,429);
});

test('busca imagens do Wikimedia Commons e devolve origem e licença',async()=>{
  const original=globalThis.fetch;
  const requested=[];
  try{
    globalThis.fetch=async(url)=>{
      requested.push(String(url));
      return Response.json({query:{pages:[{
        ns:6,title:'File:Stomatal crypt Nerium.jpg',
        imageinfo:[{mime:'image/jpeg',
          thumburl:'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/file.jpg',
          descriptionurl:'https://commons.wikimedia.org/wiki/File:Stomatal_crypt_Nerium.jpg',
          extmetadata:{LicenseShortName:{value:'CC BY-SA 4.0'},Artist:{value:'Pesquisador'}}
        }]
      }]}});
    };
    const res=await worker.fetch(new Request('https://tutor.example.workers.dev/images',{
      method:'POST',headers:{Origin:origin,'Content-Type':'application/json',
        Authorization:'Bearer '+env.STUDY_ACCESS_TOKEN},
      body:JSON.stringify({query:'criptas estomáticas'})
    }),env);
    assert.equal(res.status,200);
    const body=await res.json();
    assert.ok(body.images.length>=1);
    assert.ok(body.images.some(image=>image.license==='CC BY-SA 4.0'));
    assert.ok(body.images.some(image=>image.source.includes('Stomatal_crypt_Nerium')));
    assert.ok(requested.some(url=>url.includes('commons.wikimedia.org')));
    assert.ok(requested.some(url=>new URL(url).searchParams.get('gsrsearch')==='stomata leaf microscope'));
  }finally{globalThis.fetch=original}
});

test('retorna micrografias conhecidas quando Wikimedia não responde',async()=>{
  const original=globalThis.fetch;
  try{
    globalThis.fetch=async()=>{throw Error('Wikimedia unavailable')};
    const route=new Request('https://tutor.example.workers.dev/images',{
      method:'POST',
      headers:{Origin:origin,'Content-Type':'application/json','Authorization':'Bearer '+env.STUDY_ACCESS_TOKEN},
      body:JSON.stringify({query:'stomatal crypt Nerium oleander'})
    });
    const response=await worker.fetch(route,env);
    assert.equal(response.status,200);
    const body=await response.json();
    assert.ok(body.images.length>=2);
    assert.ok(body.images.every(x=>x.source.startsWith('https://commons.wikimedia.org/')));
  }finally{globalThis.fetch=original}
});

test('busca visual extrai termos do assunto e tenta sinônimos quando a primeira busca vem vazia',async()=>{
 const original=globalThis.fetch;const terms=[];
 try{
  globalThis.fetch=async url=>{
   const term=new URL(String(url)).searchParams.get('gsrsearch');terms.push(term);
   if(term!=='xerophyte adaptations')return Response.json({query:{pages:[]}});
   const page={
    ns:6,title:'File:Xerophyte plant.jpg',
    imageinfo:[{
      mime:'image/jpeg',
      thumburl:'https://upload.wikimedia.org/wikipedia/commons/thumb/a/aa/plant.jpg',
      descriptionurl:'https://commons.wikimedia.org/wiki/File:Xerophyte_plant.jpg',
      extmetadata:{LicenseShortName:{value:'CC BY-SA 4.0'}}
    }]
   };
   return Response.json({query:{pages:[page]}});
  };
  const response=await worker.fetch(new Request('https://tutor.example.workers.dev/images',{
   method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Authorization:'Bearer '+env.STUDY_ACCESS_TOKEN},
   body:JSON.stringify({query:'Mostre imagens e ilustrações das adaptações das plantas do Cerrado à seca'})
  }),env);
  assert.equal(response.status,200);
  const result=await response.json();
  assert.ok(terms.includes('xerophyte adaptations'));
  assert.ok(result.images.some(i=>i.source.includes('Xerophyte_plant')));
  assert.equal(result.scope,'commons-only');
 }finally{globalThis.fetch=original}
});

test('Gemini responde usando chave somente no servidor e contexto da disciplina',async()=>{
  const original=globalThis.fetch;
  let called='',body,usedKey='';
  try{
    globalThis.fetch=async(url,options)=>{
      called=String(url);usedKey=options.headers['x-goog-api-key'];
      body=JSON.parse(options.body);
      return Response.json({candidates:[{content:{parts:[{text:'Campo limpo e campo sujo são fitofisionomias do Cerrado.'}]}}]});
    };
    const configured={...env,GEMINI_API_KEY:'server-only-test-key'};
    const response=await worker.fetch(chat({question:'O que são campo limpo e campo sujo?'}),configured);
    assert.equal(response.status,200);
    const result=await response.json();
    assert.equal(result.provider,'gemini');
    assert.equal(result.model,'gemini-3.5-flash-lite');
    assert.ok(result.answer.includes('fitofisionomias'));
    assert.ok(called.includes('generativelanguage.googleapis.com'));
    assert.equal(usedKey,'server-only-test-key');
    assert.equal(body.contents.at(-1).role,'user');
    assert.ok(body.systemInstruction.parts[0].text.includes('Ciências Biológicas'));
    assert.ok(!JSON.stringify(result).includes(usedKey));
  }finally{globalThis.fetch=original}
});
test('Gemini sinaliza erro de autenticação sem chave exposta',async()=>{
  const original=globalThis.fetch;
  try{
    globalThis.fetch=async()=>new Response('Bad API key',{status:403});
    const response=await worker.fetch(chat({question:'Explique Ecologia Vegetal.'}),{...env,GEMINI_API_KEY:'invalid-secret'});
    assert.equal(response.status,502);
    const result=await response.json();
    assert.ok(result.error.includes('GEMINI_API_KEY'));
    assert.ok(!JSON.stringify(result).includes('invalid-secret'));
  }finally{globalThis.fetch=original}
});

test('Gemini com modelo indisponível informa causa sem expor chave',async()=>{
 const original=globalThis.fetch;
 try{
  globalThis.fetch=async()=>new Response(JSON.stringify({error:{code:404,status:'NOT_FOUND',message:'model not available'}}),{status:404});
  const response=await worker.fetch(chat({question:'O que é campo sujo?'}),{...env,GEMINI_API_KEY:'secret-only-test'});
  assert.equal(response.status,502);
  const body=await response.json();
  assert.ok(body.error.includes('modelo Google Gemini'));
  assert.ok(!JSON.stringify(body).includes('secret-only-test'));
 }finally{globalThis.fetch=original}
});

test('maracujá mantém busca por Passiflora e rejeita imagem de Salvia e outras espécies',async()=>{
  const original=globalThis.fetch;
  const searches=[];
  try{
    globalThis.fetch=async url=>{
      searches.push(new URL(String(url)).searchParams.get('gsrsearch'));
      const pages=['Salvia officinalis flower','Passiflora caerulea flower','Passiflora edulis flower'].map((name,index)=>({
        ns:6,title:'File:'+name+'.jpg',
        imageinfo:[{mime:'image/jpeg',
          thumburl:'https://upload.wikimedia.org/wikipedia/commons/thumb/'+index+'/f/file.jpg',
          descriptionurl:'https://commons.wikimedia.org/wiki/File:'+name.replaceAll(' ','_')+'.jpg',
          extmetadata:{LicenseShortName:{value:'CC BY-SA 4.0'}}
        }]
      }));
      return Response.json({query:{pages}});
    };
    const request=new Request('https://tutor.example.workers.dev/images',{
      method:'POST',headers:{Origin:origin,'Content-Type':'application/json',
        Authorization:'Bearer '+env.STUDY_ACCESS_TOKEN},
      body:JSON.stringify({query:'me mostre a anatomia e composição da flor do maracujá'})
    });
    const response=await worker.fetch(request,env);
    assert.equal(response.status,200);
    const body=await response.json();
    assert.equal(body.identification,'passiflora');
    assert.equal(body.images.length,1);
    assert.match(body.images[0].title,/Passiflora edulis/);
    assert.ok(searches.every(term=>/passiflora|passion fruit|maracuja/i.test(term)));
  }finally{globalThis.fetch=original}
});
