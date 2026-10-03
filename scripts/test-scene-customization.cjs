const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');

async function main() {
  const THREE = await import('three');
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const source = fs.readFileSync('src/lib/scene-customization.ts', 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
  const scope = { exports: {}, require: name => {
    assert.equal(name, 'three');
    return THREE;
  } };
  vm.runInNewContext(compiled.outputText, scope);
  const { removeMascotHandheld, createCustomizedLabScene } = scope.exports;
  let checks = 0;
  const check = (value, message) => { assert.ok(value, message); checks++; };
  const load = async file => {
    const bytes = fs.readFileSync(file);
    return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  };

  const mascot = await load('public/models/minhlab-mascot-v1.glb');
  const mascotCopy = mascot.scene.clone(true);
  removeMascotHandheld(mascotCopy);
  check(mascotCopy.getObjectByName('Mascot_HandheldNozzle').visible === false, 'Standalone mascot has no handheld prop');
  check(mascot.scene.getObjectByName('Mascot_HandheldNozzle').visible, 'Cached source mascot is untouched');
  check(mascotCopy.getObjectByName('Mascot_RightArm').visible, 'Hand/arm remains visible');

  const lab = await load('public/models/minhlab-lab-v1.glb');
  const original = lab.scene;
  const originalWhite = new Set();
  original.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (material.name === 'white') originalWhite.add(material);
    }
  });
  const whiteColors = [...originalWhite].map(material => material.color.getHex());
  const { instance, resinLift, dispose } = createCustomizedLabScene(original);
  check(instance !== original, 'Lab is a private scene clone');
  check(!instance.getObjectByName('Mascot_HandheldNozzle').visible, 'Lab mascot has no handheld prop');
  check(instance.getObjectByName('Printer_A').visible, 'Original FDM printer remains');
  check(!instance.getObjectByName('Printer_B').visible, 'Second FDM printer is hidden with all children');
  check(original.getObjectByName('Printer_B').visible, 'Cached source FDM printer is untouched');
  const visiblePrinters = [];
  instance.traverseVisible(object => { if (object.userData.technology) visiblePrinters.push(object); });
  check(visiblePrinters.length === 2, 'Exactly two printers are visible');
  check(visiblePrinters.filter(object => object.userData.technology === 'FDM').length === 1, 'Exactly one FDM printer');
  check(visiblePrinters.filter(object => object.userData.technology === 'RESIN').length === 1, 'Exactly one resin printer');
  const resin = instance.getObjectByName('Printer_Resin');
  const previous = original.getObjectByName('Printer_B');
  check(resin.position.equals(previous.position), 'Resin printer retains original workbench placement');
  check(resin.scale.equals(previous.scale), 'Resin printer retains original machine scale');
  check(Boolean(resin.getObjectByName('Resin_Vat') && resin.getObjectByName('Resin_UVHoodFront')
    && resin.getObjectByName('Resin_LeadScrew') && resin.getObjectByName('Resin_HangingPrint')), 'Resin-specific mechanical details exist');
  check(resinLift?.name === 'Resin_LiftCarriage', 'Resin lift is separately animatable');
  const bounds = new THREE.Box3().setFromObject(resin);
  check(Math.abs(bounds.min.y - previous.position.y) < 0.0001, 'Resin feet sit on the same workbench, not below it');

  const signMaterials = [];
  instance.getObjectByName('Room_Static').traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (material.name === 'MinhLab_WallSign_Red') signMaterials.push(material);
    }
  });
  check(signMaterials.length === 1 && signMaterials[0].color.getHexString() === 'eb4037', 'Only raised MinhLab wall lettering turns brand red');
  check([...originalWhite].every((material, i) => material.color.getHex() === whiteColors[i]), 'All source white materials are unchanged');
  const body = instance.getObjectByName('Mascot_Body');
  let coatWhite = false;
  body.traverse(object => {
    if (object instanceof THREE.Mesh) {
      coatWhite ||= (Array.isArray(object.material) ? object.material : [object.material]).some(material => originalWhite.has(material));
    }
  });
  check(coatWhite, 'Mascot white lab coat is preserved');
  let sourceDisposed = false;
  originalWhite.forEach(material => material.addEventListener('dispose', () => { sourceDisposed = true; }));
  let signDisposed = false;
  signMaterials[0].addEventListener('dispose', () => { signDisposed = true; });
  dispose();
  check(signDisposed, 'Cloned sign material is disposed');
  check(!sourceDisposed, 'Disposal never touches cached source materials');
  console.log(`Scene customization: ${checks} checks passed.`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
