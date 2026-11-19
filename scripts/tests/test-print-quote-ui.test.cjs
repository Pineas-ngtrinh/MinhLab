const {test}=require('node:test');
const assert=require('node:assert/strict');
const Module=require('node:module');
require('../lib/register-typescript.cjs');require.extensions['.tsx']=require.extensions['.ts'];
const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');
const original=Module._load;let preset;
Module._load=function(name,parent,...rest){
  if(name==='./usePrintRequest')return {usePrintRequest:()=>({handleValidate(){},rawFile:null,quantity:'3',material:'PLA Basic',color:'Đen',purpose:'Mô hình',scalePercent:'75',infillPercent:'80',layerHeight:'0.20mm',notes:'',fullName:'Khách',phone:'0900000000',confirmedRights:true,hasValidScale:true,hasValidQuantity:true})};
  if(['./PrintFilePanel','./PrintConfigurationPanel','./PrintSummaryModal'].includes(name))return {[name.slice(2)]:()=>null};
  if(name==='../print-requests/RequestSubmissionForm')return {RequestSubmissionForm:props=>{preset=props.preset;return null;}};
  if(name==='../common/ModalDialog')return {ModalDialog:({children})=>children};
  return original.call(this,name,parent,...rest);
};
let PrintRequestForm,PrintSummaryModal;
try {
  ({PrintRequestForm}=require('../../src/components/print-request/PrintRequestForm.tsx'));
  ({PrintSummaryModal}=require('../../src/components/print-request/PrintSummaryModal.tsx'));
}finally{Module._load=original;}
test('the actual page passes all selected print settings to the official submission',()=>{
  renderToStaticMarkup(React.createElement(PrintRequestForm));
  assert.equal(preset.quantity,3);assert.match(preset.purpose,/Tỷ lệ mong muốn: 75%/);assert.match(preset.purpose,/Mật độ ruột: 80%/);assert.match(preset.purpose,/Chiều cao lớp: 0.20mm/);assert.equal(preset.validationError,null);
});
const model={showSummary:true,setShowSummary(){},selectedFile:{name:'box.stl',size:'1 MB'},fullName:'Khách',phone:'0900000000',detectedDims:null,formatDimension:String,scaleValue:100,scaledDimensionsCm:null,material:'PLA',color:'Đen',layerHeight:'.2 mm',infillPercent:'15',quantity:'1',purpose:'Mô hình',notes:'',quantityEstimate:null,handleCopy(){},copied:false,copyError:'',handleSendZalo(){},handleSendEmail(){}};
test('summary displays resources separately and never treats the reference as an accepted quote',()=>{
  const html=renderToStaticMarkup(React.createElement(PrintSummaryModal,{model:{...model,referenceQuote:{status:'ready',referencePriceVnd:50000,lowPriceVnd:40000,highPriceVnd:60000,massG:12.34,modelTimeHours:1.5}}}));
  assert.match(html,/12.34 g/);assert.match(html,/1 giờ 30 phút/);assert.match(html,/Đây là giá tham khảo/);
  assert.match(html,/Sao chép và mở Zalo/);assert.match(html,/dán nội dung/);assert.doesNotMatch(html,/Liên kết chỉ điền nội dung/);
});
test('manual-review summaries do not display quantities or numeric reference quotes',()=>{
  const html=renderToStaticMarkup(React.createElement(PrintSummaryModal,{model:{...model,referenceQuote:{status:'review',message:'Cần kiểm tra'}}}));
  assert.doesNotMatch(html,/Nhựa ước tính|Thời gian in \/ sản phẩm|Khoảng dự kiến/);assert.match(html,/Chưa xác định/);
});
