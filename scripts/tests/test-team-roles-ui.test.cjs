const test=require('node:test');
const assert=require('node:assert/strict');
require('../lib/register-typescript.cjs');
require.extensions['.tsx']=require.extensions['.ts'];
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {AccountRoleDialog}=require('../../src/components/admin/team/TeamAccountsManager.tsx');
const account={id:'synthetic-account',email:'roles@example.test',fullName:'Tài khoản kiểm thử',status:'ACTIVE',emailVerified:true,roles:['CUSTOMER'],effectiveRole:'CUSTOMER'};
function render(value,requireVerifiedEmail=true){return renderToStaticMarkup(React.createElement(AccountRoleDialog,{account:value,requireVerifiedEmail,busy:false,error:'',onClose(){},onSave:async()=>{}}));}
test('role dialog exposes five roles, a reason and explicit confirmation, with save initially disabled',()=>{
  const html=render(account);
  for(const role of ['CUSTOMER','WORKSHOP_OPERATOR','FILE_REVIEWER','PRINT_OPERATOR','ADMIN'])assert(html.includes(`value="${role}"`));
  assert(!html.includes('value="STAFF"'));
  assert.match(html,/<textarea[^>]*required/);
  assert.match(html,/<input[^>]*type="checkbox"[^>]*required/);
  assert.match(html,/<button[^>]*type="submit"[^>]*disabled/);
  assert.match(html,/roles@example.test/);
});
test('locked and unverified accounts retain the CUSTOMER option while personnel grants are disabled',()=>{
  for(const value of [{...account,status:'LOCKED'},{...account,emailVerified:false}]){
    const html=render(value);
    for(const role of ['WORKSHOP_OPERATOR','FILE_REVIEWER','PRINT_OPERATOR','ADMIN'])assert.match(html,new RegExp(`<option value="${role}" disabled`));
    assert(!html.includes('<option value="CUSTOMER" disabled'));
  }
  assert(!render({...account,emailVerified:false},false).includes('<option value="ADMIN" disabled'));
});
