const assert=require('node:assert/strict');
const test=require('node:test');
const vm=require('node:vm');
const fs=require('node:fs');
const ts=require('typescript');
function harness({workerDenied=false}={}) {
  const states=[],timers=new Map(),workers=[];let effect,cleanup,nextId=0;
  class Worker {
    constructor() {if(workerDenied)throw new Error('Worker denied');workers.push(this);}
    postMessage(data) {this.data=data;}
    terminate() {this.terminated=true;}
  }
  const react={useState:()=>[null,value=>states.push(value)],useEffect:fn=>{effect=fn;}};
  const source=fs.readFileSync('src/components/print-request/useStlAnalysis.ts','utf8').replace('import.meta.url',JSON.stringify('file:///useStlAnalysis.ts'));
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  const module={exports:{}};
  vm.runInNewContext(code,{module,exports:module.exports,require:name=>{assert.equal(name,'react');return react;},URL,Worker,
    setTimeout:(fn,ms)=>{assert.equal(ms,20000);timers.set(++nextId,fn);return nextId;},clearTimeout:id=>timers.delete(id),queueMicrotask});
  return {states,timers,workers,start(file){module.exports.useStlAnalysis(file);cleanup=effect();},cancel(){cleanup();},timeout(){for(const fn of [...timers.values()])fn();}};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('analysis success clears the deadline and transfers file data',async()=>{
  const h=harness(),file={arrayBuffer:async()=>new ArrayBuffer(12)};h.start(file);await flush();
  assert.equal(h.workers[0].data.byteLength,12);
  const features={bboxMm:{w:1,d:2,h:3}};h.workers[0].onmessage({data:{status:'success',features}});
  assert.equal(h.states.length,1);assert.equal(h.states[0].features,features);assert.equal(h.timers.size,0);assert.ok(h.workers[0].terminated);
});
test('a stalled worker ends in manual review and cannot overwrite the timeout result',async()=>{
  const h=harness();h.start({arrayBuffer:async()=>new ArrayBuffer(1)});await flush();h.timeout();
  assert.match(h.states[0].error,/quá thời gian/);assert.equal(h.timers.size,0);assert.ok(h.workers[0].terminated);
  h.workers[0].onmessage({data:{status:'success',features:{}}});assert.equal(h.states.length,1);
});
test('a cancelled file read cannot post to an old worker or update a replacement file',async()=>{
  const h=harness();let resolve;h.start({arrayBuffer:()=>new Promise(r=>{resolve=r;})});const old=h.workers[0];h.cancel();
  const current={arrayBuffer:async()=>new ArrayBuffer(2)};h.start(current);resolve(new ArrayBuffer(4));await flush();
  old.onmessage({data:{status:'success',features:{old:true}}});assert.equal(old.data,undefined);assert.equal(h.states.length,0);
  h.workers[1].onmessage({data:{status:'success',features:{current:true}}});assert.equal(h.states[0].file,current);h.cancel();assert.equal(h.timers.size,0);
});
test('a late file read cannot restart work after its deadline',async()=>{
  const h=harness();let resolve;h.start({arrayBuffer:()=>new Promise(r=>{resolve=r;})});h.timeout();resolve(new ArrayBuffer(4));await flush();
  assert.equal(h.workers[0].data,undefined);assert.equal(h.states.length,1);
});
test('unavailable workers and failed reads release resources and expose manual fallback',async()=>{
  const denied=harness({workerDenied:true});denied.start({arrayBuffer:async()=>new ArrayBuffer(1)});await flush();
  assert.match(denied.states[0].error,/Trình duyệt/);assert.equal(denied.timers.size,0);
  const failed=harness();failed.start({arrayBuffer:async()=>{throw new Error('read failed');}});await flush();
  assert.match(failed.states[0].error,/Không thể đọc/);assert.equal(failed.timers.size,0);assert.ok(failed.workers[0].terminated);
});
