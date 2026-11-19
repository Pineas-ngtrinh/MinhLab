import { test } from 'node:test';
import assert from 'node:assert/strict';
import { presentCatalogProduct } from '../../repositories/catalog/catalog-read.repository';
import { selectProductVariant } from '../catalog';
import { restoreCart, mergeCartItems, cartReferences } from '../cart';

function product() {
  return presentCatalogProduct({
    slug:'model-from-db',product_code:'ML-P-008',name:'Tên được sửa trong database',
    short_description:'Mô tả mới',description:'Nội dung chi tiết mới',
    category_name:'Phụ kiện',category_slug:'phu-kien',material_description:'PETG',
    lead_time_description:null,layer_height_description:null,production_mode:'MADE_TO_ORDER',
    is_featured:false,badge:null,images:[{url:'https://res.cloudinary.com/demo/image/upload/model.jpg'}],
    variants:[
      {id:'variant-red',sku:'ML-P-008-RED',variant_name:'Đỏ',color_name:'Đỏ',color_hex:'#EB4037',
        sale_price:'125000.00',compare_at_price:'150000.00',status:'ACTIVE',
        length_mm:'50.00',width_mm:'40.00',height_mm:'60.00',weight_grams:'23.00'},
      {id:'variant-blue',sku:'ML-P-008-BLUE',variant_name:'Xanh',color_name:'Xanh',color_hex:null,
        sale_price:'175000.00',compare_at_price:null,status:'ACTIVE',
        length_mm:null,width_mm:null,height_mm:null,weight_grams:null},
    ],
  });
}

test('database content and per-SKU prices form the public catalogue without invented specifications', () => {
  const item = product();
  assert.equal(item.title,'Tên được sửa trong database');
  assert.equal(item.longDescription,'Nội dung chi tiết mới');
  assert.equal(item.dimensions,'5 × 4 × 6 cm');
  assert.equal(item.weight,'23 gram');
  assert.equal(item.printTime,undefined);
  assert.equal(selectProductVariant(item,'Xanh')?.price,175000);
  assert.equal(selectProductVariant(item,'Xanh')?.dimensions,'');
  assert.equal(selectProductVariant(item,'Đỏ')?.dimensions,'5 × 4 × 6 cm');
  assert.equal(selectProductVariant(item,'Xanh')?.originalPrice,undefined);
  assert.equal(selectProductVariant(item,'Màu đã xóa'),null);
});

test('persisted prices, descriptions and SKU payloads are replaced by the current catalogue', () => {
  const item = product();
  const restored = restoreCart([{product:{id:item.id,price:1,title:'Forged',variants:[]},quantity:2,selectedColor:'Xanh'}],[item]);
  assert.equal(restored[0].product.price,175000);
  assert.equal(restored[0].product.title,item.title);
  assert.equal(restored[0].product.variants[1].sku,'ML-P-008-BLUE');
  assert.deepEqual(cartReferences(restored),[{product:{id:item.id},quantity:2,selectedColor:'Xanh',variantId:'variant-blue'}]);
});

test('removed products, removed colours, sold-out SKUs and malformed storage cannot re-enter the cart', () => {
  const item = product();
  item.variants[1].available = false;
  assert.deepEqual(restoreCart([{product:{id:item.id},quantity:1,selectedColor:'Xanh'}],[item]),[]);
  assert.deepEqual(restoreCart([{product:{id:'removed'},quantity:1}],[item]),[]);
  assert.deepEqual(restoreCart([{product:{id:item.id},quantity:-1}],[item]),[]);
  assert.deepEqual(restoreCart({bad:'input'},[item]),[]);
});

test('restoring a saved cart preserves newly added items and caps duplicate quantities', () => {
  const item = product();
  const stored = [{product:item,quantity:99,selectedColor:'Đỏ'}];
  assert.equal(mergeCartItems(stored,[{...stored[0],quantity:2}])[0].quantity,100);
  assert.equal(mergeCartItems(stored,[{...stored[0],selectedColor:'Xanh',quantity:1}]).length,2);
});

test('unconfigured image hosts and private metadata cannot leak into storefront props', () => {
  const source: Parameters<typeof presentCatalogProduct>[0] & {compliance_notes:string} = {
    slug:'empty',product_code:'ML-P-009',name:'Chưa có ảnh',short_description:null,description:null,
    category_name:'Mô hình',category_slug:'models',material_description:null,lead_time_description:null,
    layer_height_description:null,production_mode:'STOCK',is_featured:false,badge:null,variants:[],
    images:[{url:'https://private.example.test/private-key'},{url:'file:///private/file'},{url:'/images/../secret'}],
    compliance_notes:'Internal review',
  };
  const item = presentCatalogProduct(source);
  assert.equal(item.image,'/images/product-placeholder.svg');
  assert.equal(item.inStock,false);
  assert.equal('compliance_notes' in item,false);
  assert.equal(JSON.stringify(item).includes('private-key'),false);
});


test('renaming a SKU preserves its cart identity and a replacement with the same label cannot claim it',()=>{
  const item=product();
  item.variants[0].name='Đỏ mới';
  const saved=[{product:{id:item.id},quantity:1,selectedColor:'Đỏ',variantId:'variant-red'}];
  assert.equal(restoreCart(saved,[item])[0].selectedColor,'Đỏ mới');
  item.variants[0].id='replacement-red';item.variants[0].name='Đỏ';
  assert.deepEqual(restoreCart(saved,[item]),[]);
});
