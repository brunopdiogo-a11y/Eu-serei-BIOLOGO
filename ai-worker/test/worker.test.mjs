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
    assert.ok(body.images.length>=2);
    assert.ok(body.images.some(image=>image.license==='CC BY-SA 4.0'));
    assert.ok(body.images.some(image=>image.source.includes('Stomatal_crypts')));
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
