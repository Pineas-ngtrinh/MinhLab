import * as THREE from 'three';

/** Apply to a cloned scene only: the authored GLB stays available unchanged. */
export function removeMascotHandheld(scene: THREE.Object3D) {
  const handheld = scene.getObjectByName('Mascot_HandheldNozzle');
  if (handheld) handheld.visible = false;
}

function createResinPrinter() {
  const printer = new THREE.Group();
  printer.name = 'Printer_Resin';
  printer.userData.technology = 'RESIN';

  const body = new THREE.MeshStandardMaterial({ color: '#30343a', roughness: 0.55, metalness: 0.45 });
  const dark = new THREE.MeshStandardMaterial({ color: '#111418', roughness: 0.7, metalness: 0.15 });
  const aluminium = new THREE.MeshStandardMaterial({ color: '#9ca4aa', roughness: 0.35, metalness: 0.8 });
  const resin = new THREE.MeshStandardMaterial({ color: '#8a9693', roughness: 0.38 });
  const liquid = new THREE.MeshStandardMaterial({ color: '#515956', roughness: 0.18, metalness: 0.1 });
  const screen = new THREE.MeshStandardMaterial({ color: '#b0c1b6', roughness: 0.35 });
  const red = new THREE.MeshStandardMaterial({ color: '#eb4037', roughness: 0.5 });
  const amber = new THREE.MeshStandardMaterial({
    color: '#bc6929', transparent: true, opacity: 0.34, roughness: 0.2,
    metalness: 0.05, depthWrite: false, side: THREE.DoubleSide,
  });
  const amberEdge = new THREE.MeshStandardMaterial({ color: '#985625', roughness: 0.35, metalness: 0.05 });

  const box = (name: string, size: [number, number, number], position: [number, number, number],
    material: THREE.Material, parent: THREE.Object3D = printer) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.castShadow = material !== amber;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const cylinder = (name: string, radius: number, height: number, position: [number, number, number],
    material: THREE.Material, parent: THREE.Object3D = printer) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 12), material);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };

  // Low electronics chassis, front touchscreen, cooling vents and levelling feet.
  box('Resin_Chassis', [1.58, 0.36, 1.24], [0, 0.23, 0], body);
  box('Resin_Deck', [1.6, 0.065, 1.26], [0, 0.44, 0], dark);
  for (const x of [-0.59, 0.59]) for (const z of [-0.43, 0.43]) {
    cylinder('Resin_LevellingFoot', 0.095, 0.055, [x, 0.0275, z], dark);
  }
  box('Resin_ScreenBezel', [0.53, 0.23, 0.022], [0.29, 0.23, 0.63], dark);
  box('Resin_Touchscreen', [0.45, 0.155, 0.012], [0.29, 0.245, 0.647], screen);
  box('Resin_ScreenProgress', [0.28, 0.015, 0.005], [0.25, 0.215, 0.655], body);
  box('Resin_BrandBadge', [0.28, 0.055, 0.015], [-0.45, 0.25, 0.638], red);
  for (let i = 0; i < 5; i++) {
    box('Resin_CoolingVent', [0.3, 0.017, 0.012], [-0.45, 0.16 - i * 0.026, 0.628], dark);
  }

  // Vat and two clamping knobs: visibly different from an FDM heated bed.
  box('Resin_Vat', [1.13, 0.11, 0.86], [0, 0.505, 0.06], aluminium);
  box('Resin_LiquidSurface', [0.99, 0.012, 0.72], [0, 0.566, 0.06], liquid);
  for (const x of [-0.65, 0.65]) cylinder('Resin_VatClamp', 0.055, 0.08, [x, 0.53, 0.16], dark);

  // Rear Z-axis column, twin linear rails and lead screw lift the hanging print.
  box('Resin_ZColumn', [0.39, 1.24, 0.15], [0, 1.1, -0.47], body);
  for (const x of [-0.12, 0.12]) cylinder('Resin_LinearRail', 0.018, 1.12, [x, 1.1, -0.371], aluminium);
  cylinder('Resin_LeadScrew', 0.029, 1.13, [0, 1.1, -0.345], aluminium);
  const lift = new THREE.Group();
  lift.name = 'Resin_LiftCarriage';
  lift.position.y = 1.38;
  printer.add(lift);
  box('Resin_Carriage', [0.37, 0.2, 0.16], [0, 0, -0.335], dark, lift);
  box('Resin_Cantilever', [0.24, 0.09, 0.61], [0, -0.04, -0.02], aluminium, lift);
  cylinder('Resin_PlatformJoint', 0.064, 0.18, [0, -0.14, 0.1], dark, lift);
  box('Resin_BuildPlatform', [0.94, 0.065, 0.64], [0, -0.255, 0.1], aluminium, lift);
  box('Resin_PrintRaft', [0.42, 0.026, 0.31], [0, -0.301, 0.1], resin, lift);
  for (const x of [-0.13, 0, 0.13]) for (const z of [0.025, 0.175]) {
    cylinder('Resin_PrintSupport', 0.014, 0.16, [x, -0.391, z], resin, lift);
  }
  box('Resin_HangingPrint', [0.3, 0.19, 0.22], [0, -0.505, 0.1], resin, lift);
  box('Resin_HangingPrintDetail', [0.18, 0.09, 0.17], [0, -0.645, 0.1], resin, lift);

  // Separate smoked-amber hood panels keep the vat, rails and upside-down print readable.
  box('Resin_UVHoodFront', [1.51, 1.41, 0.018], [0, 1.18, 0.592], amber);
  box('Resin_UVHoodBack', [1.51, 1.41, 0.018], [0, 1.18, -0.592], amber);
  box('Resin_UVHoodLeft', [0.018, 1.41, 1.19], [-0.746, 1.18, 0], amber);
  box('Resin_UVHoodRight', [0.018, 1.41, 1.19], [0.746, 1.18, 0], amber);
  box('Resin_UVHoodTop', [1.51, 0.026, 1.2], [0, 1.897, 0], amber);
  for (const x of [-0.752, 0.752]) for (const z of [-0.592, 0.592]) {
    box('Resin_UVHoodEdge', [0.022, 1.43, 0.022], [x, 1.185, z], amberEdge);
  }
  box('Resin_HoodGrip', [0.34, 0.045, 0.04], [0, 0.525, 0.619], amberEdge);

  return { printer, lift };
}

/** Clone only what changes; never recolor the shared white mascot/robot materials. */
export function createCustomizedLabScene(source: THREE.Object3D) {
  const instance = source.clone(true);
  removeMascotHandheld(instance);
  const ownedMaterials = new Set<THREE.Material>();
  const ownedGeometry = new Set<THREE.BufferGeometry>();

  const room = instance.getObjectByName('Room_Static');
  room?.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const recolor = (material: THREE.Material) => {
      // The GLB's sole white Room_Static primitive is the raised MinhLab wall sign.
      if (!(material instanceof THREE.MeshStandardMaterial) || material.name !== 'white') return material;
      const replacement = material.clone();
      replacement.name = 'MinhLab_WallSign_Red';
      replacement.color.set('#eb4037');
      ownedMaterials.add(replacement);
      return replacement;
    };
    object.material = Array.isArray(object.material) ? object.material.map(recolor) : recolor(object.material);
  });

  const fdm = instance.getObjectByName('Printer_A');
  if (fdm) fdm.userData.technology = 'FDM';
  const replaced = instance.getObjectByName('Printer_B');
  let resinLift: THREE.Group | null = null;
  if (replaced?.parent) {
    replaced.visible = false;
    const { printer, lift } = createResinPrinter();
    printer.position.copy(replaced.position);
    printer.quaternion.copy(replaced.quaternion);
    printer.scale.copy(replaced.scale);
    replaced.parent.add(printer);
    resinLift = lift;
    printer.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      ownedGeometry.add(object.geometry);
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(material => ownedMaterials.add(material));
    });
  }
  instance.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    if (!(object.material instanceof THREE.Material && object.material.transparent)) object.castShadow = true;
    object.receiveShadow = true;
  });

  return {
    instance,
    resinLift,
    dispose: () => {
      ownedGeometry.forEach(geometry => geometry.dispose());
      ownedMaterials.forEach(material => material.dispose());
    },
  };
}
