const test=require('node:test');
const assert=require('node:assert/strict');
require('../lib/register-typescript.cjs');
require.extensions['.tsx']=require.extensions['.ts'];
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {RequestRetention}=require('../../src/components/print-requests/RequestRetention.tsx');
const base={id:'request',revision:1,status:'SUBMITTED',quotes:[],retainedFiles:[],fileHolds:[]};
const render=(request,role='CUSTOMER')=>renderToStaticMarkup(React.createElement(RequestRetention,{request,role,busy:false,send:async()=>{}}));
test('a converted order cannot be closed or reopened through request controls',()=>{
  const html=render({...base,status:'CLOSED',closedReason:'CONVERTED',quotes:[{orderNumber:'ML-TEST'}]});
  assert.match(html,/7 ngày sau khi hoàn tất/);
  assert(!html.includes('value="CLOSE"'));assert(!html.includes('value="REOPEN"'));
});
test('purged files show reupload instructions and never offer reopening',()=>{
  const html=render({...base,status:'CLOSED',closedReason:'CUSTOMER_CLOSED',retainedFiles:[{id:'file',availability:'PURGED',scheduledDeletionAt:null}]});
  assert.match(html,/Vui lòng gửi lại file/);assert(!html.includes('value="REOPEN"'));
});
test('admins can see overdue holds; customers and retired staff cannot see internal reasons',()=>{
  const request={...base,fileHolds:[{id:'hold',reason:'INTERNAL-INCIDENT',reviewAt:'2026-11-10T00:00:00Z',overdue:true}]};
  assert.match(render(request,'ADMIN'),/INTERNAL-INCIDENT/);
  assert.match(render(request,'ADMIN'),/Đã đến hạn rà soát/);
  assert(!render(request,'STAFF').includes('INTERNAL-INCIDENT'));
  assert(!render(request).includes('INTERNAL-INCIDENT'));assert(!render(request).includes('Đã xử lý xong'));
});
