const assert=require('node:assert/strict');
const {test,beforeEach,after}=require('node:test');
const Module=require('node:module');
require('../lib/register-typescript.cjs');
const {AppError}=require('../../src/lib/errors.ts');
const id='11111111-1111-4111-8111-111111111111';
const previousChat=process.env.TELEGRAM_CHAT_ID;process.env.TELEGRAM_CHAT_ID='-100123';
after(()=>{if(previousChat===undefined)delete process.env.TELEGRAM_CHAT_ID;else process.env.TELEGRAM_CHAT_ID=previousChat;});
let state;
beforeEach(()=>{state={queries:[],answers:[],keyboards:[],completed:[],verifications:[],rejections:[],role:true,error:null,
  row:{approver_id:id,order_number:'ML-TEST',body_text:'Fixture declaration',transaction_reference:null,transferred_at:new Date('2026-11-17T15:00:00Z'),verification_status:'PENDING'}};});
const original=Module._load;
Module._load=function(name,parent,...args){
  if(parent?.filename.endsWith('/src/server/telegram-payment-approval.ts')){
    if(name==='../lib/db')return {query:async(sql,values)=>{state.queries.push({sql,values});return {rows:state.role&&state.row&&values[2]==='99'?[state.row]:[]};}};
    if(name==='./orders')return {OrderService:{
      verifyPayment:async(...args)=>{state.verifications.push(args);if(state.error)throw state.error;return {alreadyVerified:false};},
      rejectPayment:async(...args)=>{state.rejections.push(args);if(state.error)throw state.error;return {alreadyRejected:false};},
    }};
    if(name==='../integrations/notifications/telegram-webhook')return {
      answerTelegramCallback:async(...args)=>{state.answers.push(args);},
      completeTelegramPaymentMessage:async(...args)=>{state.completed.push(args);},
      updateTelegramPaymentKeyboard:async(...args)=>{state.keyboards.push(args);},
    };
  }
  return original.call(this,name,parent,...args);
};
let handle;
try {handle=require('../../src/server/telegram-payment-approval.ts').handleTelegramPaymentCallback;}
finally {Module._load=original;}
const callback=(data,changes={})=>({callbackQueryId:'query',telegramUserId:'99',chatId:'-100123',messageId:'71',data,...changes});
test('wrong chat, unmapped users and malformed actions cannot reach order operations',async()=>{
  for(const c of [callback(`verify-payment:${id}`,{chatId:'wrong'}),callback(`verify-payment:${id}`,{telegramUserId:'77'}),callback(`reject-payment:unknown:${id}`)])await handle(c,'https://minhlab.test');
  assert.equal(state.queries.length,1);assert.equal(state.verifications.length,0);assert.equal(state.rejections.length,0);
});
test('the notification lookup binds the sent message, latest declaration and current ADMIN role',async()=>{
  state.role=false;await handle(callback(`verify-payment:${id}`),'https://minhlab.test');
  assert.equal(state.verifications.length,0);
  const {sql,values}=state.queries[0];assert.match(sql,/t\.status = 'SENT'/);assert.match(sql,/t\.provider_message_id = \$2/);
  assert.match(sql,/r\.code IN \('ADMIN'\)/);assert.match(sql,/u\.deleted_at IS NULL/);assert.match(sql,/t\.created_at = p\.transferred_at/);
  assert.deepEqual(values,[id,'71','99']);
});
test('opening rejection choices does not mutate the payment',async()=>{
  await handle(callback(`reject-payment:${id}`),'https://minhlab.test');
  assert.equal(state.rejections.length,0);assert.equal(state.verifications.length,0);assert.equal(state.keyboards[0][2].inline_keyboard.length,4);
});
test('rejection records a fixed reason against the exact current declaration, including a missing optional bank reference',async()=>{
  await handle(callback(`reject-payment:short:${id}`),'https://minhlab.test');
  assert.equal(state.verifications.length,0);assert.equal(state.rejections.length,1);
  const [number,actor,reason,declaration]=state.rejections[0];assert.equal(number,'ML-TEST');assert.equal(actor,id);assert.match(reason,/thiếu/);
  assert.deepEqual(declaration,{telegramUserId:'99',reference:null,transferredAt:'2026-11-17T15:00:00.000Z'});assert.match(state.completed[0][2],/vẫn chờ thanh toán/);
});
test('changed declarations or revoked roles cannot complete rejection',async()=>{
  for(const status of [403,409]){
    state.error=new AppError('Fixture',status);await handle(callback(`reject-payment:short:${id}`),'https://minhlab.test');
  }
  assert.equal(state.completed.length,0);assert.equal(state.answers.length,2);
});
test('verification remains available and optional bank references do not invalidate valid notifications',async()=>{
  await handle(callback(`verify-payment:${id}`),'https://minhlab.test');
  assert.equal(state.verifications.length,1);assert.equal(state.rejections.length,0);assert.equal(state.verifications[0][3].reference,null);
});
test('processed declarations cannot reopen the action menu',async()=>{
  state.row.verification_status='REJECTED';await handle(callback(`payment-actions:${id}`),'https://minhlab.test');
  assert.equal(state.keyboards.length,0);assert.equal(state.rejections.length,0);
});
