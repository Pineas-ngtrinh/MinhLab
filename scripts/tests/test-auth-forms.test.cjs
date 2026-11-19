const {test}=require('node:test');
const assert=require('node:assert/strict');
const Module=require('node:module');
require('../lib/register-typescript.cjs');require.extensions['.tsx']=require.extensions['.ts'];
const React=require('react');
let registerCall;
const load=Module._load;
Module._load=function(name,parent,...args){
  if(name==='next/navigation')return {useRouter:()=>({push(){},replace(){}})};
  if(name.endsWith('/context/AuthContext'))return {useAuth:()=>({register:input=>registerCall(input)})};
  return load.call(this,name,parent,...args);
};
let Register,Verification;
try {
  Register=require('../../app/dang-ky/page.tsx').default;
  Verification=require('../../src/components/auth/EmailCodeVerification.tsx').EmailCodeVerification;
} finally {Module._load=load;}

// Exercise the real handlers across renders while keeping network and account storage isolated.
function withHooks(Component,props,action){
  const original={useState:React.useState,useRef:React.useRef};
  let cursor=0;const slots=[];
  React.useState=initial=>{const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];};
  React.useRef=initial=>{const i=cursor++;return slots[i]??(slots[i]={current:initial});};
  const render=()=>{cursor=0;return Component(props);};
  return Promise.resolve().then(()=>action(render)).finally(()=>Object.assign(React,original));
}
function elements(tree){
  if(!React.isValidElement(tree))return [];
  return [tree,...React.Children.toArray(tree.props.children).flatMap(elements)];
}
const find=(tree,predicate)=>elements(tree).find(predicate);
const form=tree=>find(tree,x=>x.type==='form');
const input=(tree,id)=>find(tree,x=>x.type==='input'&&x.props.id===id);
const submit=tree=>form(tree).props.onSubmit({preventDefault(){}});
const messages=tree=>elements(tree).filter(x=>x.props.role==='alert').map(x=>React.Children.toArray(x.props.children).join('')).join(' ');

test('registration can be corrected after invalid input, blocks concurrent sends and opens email verification',async()=>{
  let calls=0,resolve;
  registerCall=()=>{calls++;return new Promise(r=>{resolve=r;});};
  await withHooks(Register,{},async render=>{
    let tree=render();assert.equal(form(tree).props.noValidate,true);
    for(const [id,value] of [['register-name','Fixture'],['register-email','fixture@example.test'],['register-password','short'],['register-password-confirm','short']]){
      const field=input(tree,id);assert(field,`missing ${id}`);field.props.onChange({target:{value}});
    }
    tree=render();await submit(tree);assert.equal(calls,0);
    tree=render();assert(elements(tree).some(x=>typeof x.props.children==='string'&&x.props.children.includes('tối thiểu')));
    input(tree,'register-password').props.onChange({target:{value:'Fixture-password-2026'}});
    input(tree,'register-password-confirm').props.onChange({target:{value:'Fixture-password-2026'}});
    tree=render();const pending=submit(tree);await submit(tree);assert.equal(calls,1);
    resolve({requiresEmailVerification:true});await pending;
    assert(find(render(),x=>x.type===Verification));
  });
});

test('verification reports Vietnamese errors and resend requires an email but no code',async()=>{
  const originalFetch=global.fetch;const requests=[];
  global.fetch=async(url,options)=>{requests.push({url,body:JSON.parse(options.body)});return new Response(JSON.stringify({success:true}),{headers:{'Content-Type':'application/json'}});};
  try {
    await withHooks(Verification,{initialEmail:'fixture@example.test'},async render=>{
      let tree=render();assert.equal(form(tree).props.noValidate,true);
      await submit(tree);tree=render();assert.match(messages(tree),/Vui lòng nhập mã xác minh gồm 8 chữ số/);assert.equal(requests.length,0);
      const code=find(tree,x=>x.type==='input'&&x.props.autoComplete==='one-time-code');
      code.props.onChange({target:{value:'123'}});tree=render();await submit(tree);assert.equal(requests.length,0);
      await find(render(),x=>x.type==='button'&&x.props.type==='button').props.onClick();
      // The click handler schedules send; allow its response promise to settle.
      await new Promise(resolve=>setImmediate(resolve));
      assert.equal(requests.length,1);assert.equal(requests[0].url,'/api/auth/verification');assert.deepEqual(requests[0].body,{email:'fixture@example.test'});
    });
    await withHooks(Verification,{},async render=>{
      await submit(render());assert.match(messages(render()),/Vui lòng nhập địa chỉ email hợp lệ/);assert.equal(requests.length,1);
    });
  }finally{global.fetch=originalFetch;}
});
