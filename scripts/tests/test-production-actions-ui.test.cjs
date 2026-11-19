const {test}=require('node:test');
const assert=require('node:assert/strict');
require('../lib/register-typescript.cjs');
require.extensions['.tsx']=require.extensions['.ts'];
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {PlanCard}=require('../../src/components/admin/production/ProductionPanels.tsx');
const {ProductionDecisionInbox}=require('../../src/components/admin/production/ProductionDecisionInbox.tsx');
const {ProductEditor}=require('../../src/components/admin/catalog/ProductEditor.tsx');
const {PublicationDialog}=require('../../src/components/admin/catalog/PublicationDialog.tsx');
const {OrdersPanel}=require('../../src/components/admin/OrdersPanel.tsx');
const render=(component,props)=>renderToStaticMarkup(React.createElement(component,props));

test('plan deletion is offered to admin only for undecided plans',()=>{
  const plan={id:'plan-123',revision:1,status:'PENDING_APPROVAL',decisionNote:null,body:{itemIds:[],jobs:[],stocks:[],blockers:[]}};
  const props={plan,data:{},send:async()=>true,busy:false,canApprove:false,onEdit(){}};
  assert.match(render(PlanCard,{...props,canDelete:true}),/Xóa kế hoạch/);
  assert.doesNotMatch(render(PlanCard,{...props,canDelete:false}),/Xóa kế hoạch/);
  assert.doesNotMatch(render(PlanCard,{...props,canDelete:true,plan:{...plan,status:'APPROVED'}}),/Xóa kế hoạch/);
});

test('print operators may decide a pending plan without being offered draft editing',()=>{
  const plan={id:'pending-plan',revision:1,status:'PENDING_APPROVAL',body:{itemIds:[],jobs:[],stocks:[],blockers:[]}};
  const html=render(PlanCard,{plan,data:{},send:async()=>true,busy:false,canApprove:false,canDecide:true,onEdit(){}});
  assert.match(html,/Duyệt và giữ chỗ nguồn lực/);
  assert.match(html,/Từ chối và nêu lý do/);
  assert.doesNotMatch(html,/Sửa và gửi phiên bản mới/);
});

test('paid confirmed orders expose production entry and shipping steps to the correct roles',()=>{
  const order={orderNumber:'ML-TEST',customerName:'Fixture',customerPhone:'',itemsCount:1,grandTotal:1000,paymentTiming:'VIETQR',paymentStatus:'PAID',orderStatus:'CONFIRMED'};
  const props={role:'ADMIN',list:{data:[order],pagination:{page:1,pageSize:25,total:1,totalPages:1},status:'ALL',isLoading:false,setFilter(){},setPage(){}},actions:{setSelectedOrderDetails(){},handleUpdateOrderStatus:async()=>true},onViewPayments(){},onViewProduction(){}};
  assert.match(render(OrdersPanel,props),/Đưa vào in<\/button>/);
  assert.doesNotMatch(render(OrdersPanel,{...props,role:'STAFF'}),/Đưa vào in<\/button>/);
  assert.doesNotMatch(render(OrdersPanel,{...props,role:'PRINT_OPERATOR'}),/Đưa vào in<\/button>/);
  const withOrder=o=>({...props,list:{...props.list,data:[{...order,...o}]}});
  assert.doesNotMatch(render(OrdersPanel,withOrder({paymentStatus:'UNPAID'})),/Đưa vào in<\/button>/);
  assert.match(render(OrdersPanel,withOrder({orderStatus:'READY_TO_SHIP'})),/Bàn giao đơn vị vận chuyển/);
  assert.match(render(OrdersPanel,withOrder({orderStatus:'SHIPPED'})),/Khách đã nhận hàng/);
});


test('the order planning inbox exposes the same admin deletion action for waiting plans',()=>{
  const plan={id:'plan-123',revision:1,status:'WAITING_DATA',body:{itemIds:[],jobs:[],stocks:[],blockers:['BOM_NOT_PUBLISHED'],warnings:[]}};
  const workspace={items:[],plans:[plan],jobs:[],revisions:[],variants:[],printers:[],checks:[],agent:{status:'DISABLED',message:'Fixture'}};
  const original=React.useState;
  function inbox(role,plans=workspace.plans) {
    React.useState=initial=>original(initial===null?{...workspace,plans}:initial);
    try {return render(ProductionDecisionInbox,{role});}
    finally {React.useState=original;}
  }
  assert.match(inbox('ADMIN'),/Xóa kế hoạch/);
  assert.match(inbox('ADMIN',[{...plan,status:'PENDING_APPROVAL'}]),/Xóa kế hoạch/);
  for(const role of ['STAFF','WORKSHOP_OPERATOR','PRINT_OPERATOR']) assert.doesNotMatch(inbox(role),/Xóa kế hoạch/);
  assert.doesNotMatch(inbox('ADMIN',[{...plan,status:'APPROVED'}]),/Xóa kế hoạch/);
  assert.match(inbox('ADMIN'),/Chưa có định mức linh kiện sản phẩm được công bố/);
});


test('admins can find order deletion and see why paid or shipped orders are locked',()=>{
  const order={orderNumber:'ML-DELETE-TEST',customerName:'Fixture',customerPhone:'',itemsCount:1,grandTotal:1000,paymentTiming:'VIETQR',paymentStatus:'UNPAID',orderStatus:'PENDING_PAYMENT'};
  const props={role:'ADMIN',list:{data:[order],pagination:{page:1,pageSize:25,total:1,totalPages:1},status:'ALL',isLoading:false,setFilter(){},setPage(){}},actions:{updatingOrderNumber:null,deletingOrderNumber:null,setSelectedOrderDetails(){},handleUpdateOrderStatus:async()=>true,handleDeleteOrder:async()=>true},onViewPayments(){},onViewProduction(){}};
  const markup=(changes={},role='ADMIN')=>render(OrdersPanel,{...props,role,list:{...props.list,data:[{...order,...changes}]}});
  const deletionButton=html=>html.match(/<button[^>]*aria-label="Xóa đơn [^"]*"[^>]*>/)?.[0];
  assert(deletionButton(markup()));
  assert.doesNotMatch(deletionButton(markup()),/\sdisabled(?:=|\s|>)/);
  assert.doesNotMatch(deletionButton(markup({orderStatus:'CANCELLED'})),/\sdisabled(?:=|\s|>)/);
  for(const paymentStatus of ['PAID','PARTIALLY_PAID','REFUNDED']) {
    assert.match(deletionButton(markup({paymentStatus})),/\sdisabled(?:=|\s|>)/);
    assert.match(markup({paymentStatus}),/Đơn đã có thanh toán; cần giữ lịch sử/);
  }
  for(const orderStatus of ['SHIPPED','COMPLETED']) {
    assert.match(deletionButton(markup({orderStatus})),/\sdisabled(?:=|\s|>)/);
    assert.match(markup({orderStatus}),/Đơn đã bàn giao hoặc hoàn tất; cần giữ lịch sử/);
  }
  for(const role of ['STAFF','WORKSHOP_OPERATOR','PRINT_OPERATOR']) assert.equal(deletionButton(markup({},role)),undefined);
});


test('product editing keeps draft saving separate from explicit publication review',()=>{
  const props={product:null,categories:[{id:'category-fixture',name:'Fixture',slug:'fixture'}],onSaved(){},onCancel(){}};
  const draft=render(ProductEditor,props);
  assert.match(draft,/Lưu bản nháp chưa đưa sản phẩm lên cửa hàng/);
  assert.doesNotMatch(draft,/Lưu &amp; duyệt xuất bản<\/button>/);
  const admin=render(ProductEditor,{...props,onRequestPublication(){}});
  assert.match(admin,/Lưu &amp; duyệt xuất bản<\/button>/);
  const review=render(PublicationDialog,{product:{code:'ML-P-TEST',name:'Fixture',revision:7},action:'PUBLISH',busy:false,error:'',onClose(){},onSubmit(){}});
  assert.match(review,/<input[^>]*type="checkbox"[^>]*required/);
  assert.match(review,/Ghi chú \/ lý do/);
  assert.match(review,/Tôi đã kiểm tra nguồn gốc/);
});
