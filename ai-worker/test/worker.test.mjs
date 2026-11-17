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
