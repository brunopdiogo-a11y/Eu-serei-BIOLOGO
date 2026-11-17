import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

const env={OPENAI_API_KEY:'test-openai-key',STUDY_ACCESS_TOKEN:'x'.repeat(32)};
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
  assert.ok(!JSON.stringify(json).includes(env.OPENAI_API_KEY));
});
test('invalid token is rejected before contacting OpenAI',async()=>{
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
test('proxies a safe response and never returns the API key',async()=>{
  const nativeFetch=globalThis.fetch;
  let sent;
  try{
    globalThis.fetch=async(_url,options)=>{
      sent=JSON.parse(options.body);
      assert.equal(options.headers.Authorization,'Bearer test-openai-key');
      return Response.json({model:'gpt-4.1-mini',output:[{content:[{type:'output_text',text:'A luz influencia a fotossíntese.'}]}]});
    };
    const res=await worker.fetch(chat({question:'Como funciona a luz?',excerpt:'Luz e fotossíntese.'}),env);
    assert.equal(res.status,200);
    assert.equal((await res.json()).answer,'A luz influencia a fotossíntese.');
    assert.equal(sent.store,false);
    assert.equal(sent.max_output_tokens,800);
  }finally{globalThis.fetch=nativeFetch;}
});
