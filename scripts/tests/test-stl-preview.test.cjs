const {test}=require('node:test');
const assert=require('node:assert/strict');
require('../lib/register-typescript.cjs');
const THREE=require('three');
const {layoutPreviewParts}=require('../../src/components/print-request/stl-preview-layout.ts');
const {preparePreviewGeometry}=require('../../src/components/print-request/useStlPreview.ts');
const {createFdmPreviewMaterial}=require('../../src/components/print-request/fdm-preview-material.ts');

test('multi-file display preserves mm scale, grounds parts and leaves gaps without intersections',()=>{
  const dims=[{x:10,y:20,z:30},{x:90,y:5,z:2},{x:25,y:80,z:40},{x:3,y:4,z:5}];
  const result=layoutPreviewParts(dims,2);
  assert.equal(result.height,80);
  for(let i=0;i<dims.length;i++)for(let j=i+1;j<dims.length;j++){
    const separatedX=Math.abs(result.positions[i].x-result.positions[j].x)>=(dims[i].x+dims[j].x)+9.999;
    const separatedZ=Math.abs(result.positions[i].z-result.positions[j].z)>=(dims[i].y+dims[j].y)+9.999;
    assert(separatedX||separatedZ,`parts ${i},${j} overlap`);
  }
  assert.equal(layoutPreviewParts([],1).positions.length,0);
  assert.deepEqual(layoutPreviewParts([{x:10,y:20,z:30}],0.5),{width:5,depth:10,height:15,positions:[{x:0,z:0}]});
});
test('STL geometry keeps real dimensions and converts Z up to Y up without changing the quote source',()=>{
  const v=[[100,200,300],[110,200,300],[100,220,300],[100,200,330]];
  const faces=[[0,2,1],[0,1,3],[0,3,2],[1,2,3]],buffer=Buffer.alloc(84+faces.length*50);
  buffer.writeUInt32LE(faces.length,80);
  faces.forEach((face,i)=>face.forEach((vertex,j)=>v[vertex].forEach((number,k)=>buffer.writeFloatLE(number,84+i*50+12+j*12+k*4))));
  const input=buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength),before=Buffer.from(input).toString('hex');
  const model=preparePreviewGeometry(input);
  assert.deepEqual(model.dimensions,{x:10,y:20,z:30});
  const bounds=model.geometry.boundingBox;
  assert(Math.abs(bounds.min.y)<1e-6);assert(Math.abs(bounds.max.y-30)<1e-6);
  assert(Math.abs(bounds.max.x-5)<1e-6);assert(Math.abs(bounds.max.z-10)<1e-6);
  assert.equal(Buffer.from(input).toString('hex'),before);
  model.geometry.dispose();
});
test('FDM material attaches to the installed shader chunks, uses physical layer pitch and filters distant lines',()=>{
  const material=createFdmPreviewMaterial('#EB4037',2,0.2);
  const shader={vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader,uniforms:{}};
  material.onBeforeCompile(shader,{});
  assert.equal(shader.uniforms.fdmLayer.value,0.2);assert.equal(shader.uniforms.fdmScale.value,2);
  assert.match(shader.vertexShader,/vFdmPosition = position \* fdmScale/);
  assert.match(shader.fragmentShader,/float sideCoord = vFdmPosition.y \/ fdmLayer/);
  assert.match(shader.fragmentShader,/fwidth\(sideCoord\)/);assert.match(shader.fragmentShader,/float topCoord/);
  assert.match(shader.fragmentShader,/vec3 gradient/);assert.equal(material.metalness,0);
  material.dispose();
});
