import * as THREE from 'three';
import type { CollectibleKind } from './types';

export interface SleighRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  santaGroup: THREE.Group;
  reindeerGroup: THREE.Group;
  legs: THREE.Mesh[];
  rudolphNose: THREE.Mesh;
  shieldDome: THREE.Mesh;
  turboHalo: THREE.Mesh;
  headlampLight: THREE.PointLight;
  shadowPlane: THREE.Mesh;
}

export interface SharedAssets {
  candyMat: THREE.MeshStandardMaterial;
  woodMat: THREE.MeshStandardMaterial;
  snowMat: THREE.MeshStandardMaterial;
  iceMat: THREE.MeshPhysicalMaterial;
  goldMat: THREE.MeshStandardMaterial;
  crimsonMat: THREE.MeshPhysicalMaterial;
  emeraldMat: THREE.MeshStandardMaterial;
  darkSteelMat: THREE.MeshStandardMaterial;
  pineWoodMat: THREE.MeshStandardMaterial;
  pineNeedleMat: THREE.MeshStandardMaterial;
  shadowMat: THREE.MeshBasicMaterial;
  dispose: () => void;
}

export function createSharedAssets(
  candyTex: THREE.CanvasTexture,
  woodTex: THREE.CanvasTexture,
  shadowTex: THREE.CanvasTexture,
  isSoftwareGl: boolean,
): SharedAssets {
  const candyMat = new THREE.MeshStandardMaterial({
    map: candyTex,
    roughness: 0.32,
    metalness: 0.05,
  });

  const woodMat = new THREE.MeshStandardMaterial({
    map: woodTex,
    roughness: 0.78,
    metalness: 0.05,
  });

  const snowMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    roughness: 0.85,
    metalness: 0.02,
  });

  const iceMat = new THREE.MeshPhysicalMaterial({
    color: 0xbae6fd,
    roughness: 0.14,
    metalness: 0.08,
    clearcoat: 0.85,
    transparent: true,
    opacity: isSoftwareGl ? 0.78 : 0.86,
  });

  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.22,
    metalness: 0.88,
  });

  const crimsonMat = new THREE.MeshPhysicalMaterial({
    color: 0xb91c1c,
    roughness: 0.24,
    metalness: 0.12,
    clearcoat: 0.85,
    clearcoatRoughness: 0.15,
  });

  const emeraldMat = new THREE.MeshStandardMaterial({
    color: 0x059669,
    roughness: 0.34,
    metalness: 0.15,
  });

  const darkSteelMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.35,
    metalness: 0.82,
  });

  const pineWoodMat = new THREE.MeshStandardMaterial({
    color: 0x5c3a21,
    roughness: 0.9,
    metalness: 0.02,
  });

  const pineNeedleMat = new THREE.MeshStandardMaterial({
    color: 0x165b33,
    roughness: 0.8,
    metalness: 0.02,
  });

  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.55,
  });

  return {
    candyMat,
    woodMat,
    snowMat,
    iceMat,
    goldMat,
    crimsonMat,
    emeraldMat,
    darkSteelMat,
    pineWoodMat,
    pineNeedleMat,
    shadowMat,
    dispose: () => {
      candyMat.dispose();
      woodMat.dispose();
      snowMat.dispose();
      iceMat.dispose();
      goldMat.dispose();
      crimsonMat.dispose();
      emeraldMat.dispose();
      darkSteelMat.dispose();
      pineWoodMat.dispose();
      pineNeedleMat.dispose();
      shadowMat.dispose();
    },
  };
}

export function createSleighAndReindeer(assets: SharedAssets): SleighRig {
  const root = new THREE.Group();

  // Contact shadow grounded at y = 0.02
  const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 5.2), assets.shadowMat);
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.set(0, 0.025, -0.5);
  root.add(shadowPlane);

  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  // Sleigh hull profile extruded along X, then centered
  const hullShape = new THREE.Shape();
  hullShape.moveTo(-1.15, 0.28);
  hullShape.lineTo(0.85, 0.28);
  hullShape.quadraticCurveTo(1.22, 0.34, 1.3, 0.78);
  hullShape.lineTo(0.92, 0.82);
  hullShape.quadraticCurveTo(0.74, 0.58, 0.38, 0.58);
  hullShape.lineTo(-0.78, 0.58);
  hullShape.quadraticCurveTo(-1.08, 0.62, -1.2, 1.06);
  hullShape.lineTo(-1.35, 1.02);
  hullShape.quadraticCurveTo(-1.32, 0.38, -1.15, 0.28);

  const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
    depth: 1.12,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.05,
    bevelSegments: 2,
  });
  hullGeo.center();
  // Rotate so length is along -Z (forward) and height along +Y
  hullGeo.rotateY(Math.PI / 2);

  const hullMesh = new THREE.Mesh(hullGeo, assets.crimsonMat);
  hullMesh.position.set(0, 0.68, 0.55);
  hullMesh.castShadow = true;
  hullMesh.receiveShadow = true;
  bodyGroup.add(hullMesh);

  // Brushed gold runners (left & right), bottom grounded at y = 0
  const runnerShape = new THREE.Shape();
  runnerShape.moveTo(-1.3, 0.0);
  runnerShape.lineTo(1.15, 0.0);
  runnerShape.quadraticCurveTo(1.52, 0.03, 1.62, 0.36);
  runnerShape.lineTo(1.5, 0.41);
  runnerShape.quadraticCurveTo(1.38, 0.14, 1.1, 0.1);
  runnerShape.lineTo(-1.3, 0.1);
  runnerShape.closePath();

  const runnerGeo = new THREE.ExtrudeGeometry(runnerShape, {
    depth: 0.07,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.015,
    bevelSegments: 2,
  });
  runnerGeo.rotateY(Math.PI / 2);

  for (const side of [-0.52, 0.52]) {
    const runner = new THREE.Mesh(runnerGeo, assets.goldMat);
    runner.position.set(side - 0.035, 0.0, 0.6);
    runner.castShadow = true;
    bodyGroup.add(runner);

    // Struts connecting runners to hull
    for (const sz of [0.0, 1.0]) {
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.34, 8), assets.darkSteelMat);
      strut.position.set(side, 0.22, sz);
      strut.castShadow = true;
      bodyGroup.add(strut);
    }
  }

  // Gold side trim rails
  for (const side of [-0.61, 0.61]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 2.2), assets.goldMat);
    rail.position.set(side, 0.92, 0.55);
    bodyGroup.add(rail);
  }

  // Overflowing velvet gift sack & mini presents in rear
  const sackMat = new THREE.MeshStandardMaterial({ color: 0x065f46, roughness: 0.82, metalness: 0.04 });
  const sack = new THREE.Mesh(new THREE.DodecahedronGeometry(0.46, 1), sackMat);
  sack.scale.set(1.05, 0.95, 1.15);
  sack.position.set(0, 1.05, 1.08);
  sack.castShadow = true;
  bodyGroup.add(sack);

  const miniBox = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.32), assets.goldMat);
  miniBox.position.set(0.22, 1.24, 0.92);
  miniBox.rotation.set(0.2, 0.4, -0.15);
  bodyGroup.add(miniBox);

  // Brass front headlamp
  const lampHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.18, 12), assets.goldMat);
  lampHousing.rotation.x = Math.PI / 2;
  lampHousing.position.set(0, 0.78, -0.78);
  bodyGroup.add(lampHousing);

  const lampBulbMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xfbbf24,
    emissiveIntensity: 2.2,
    roughness: 0.2,
  });
  const lampLens = new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 12), lampBulbMat);
  lampLens.position.set(0, 0.78, -0.87);
  bodyGroup.add(lampLens);

  const headlampLight = new THREE.PointLight(0xfde68a, 1.6, 11, 2);
  headlampLight.position.set(0, 0.95, -1.2);
  bodyGroup.add(headlampLight);

  // Santa driver figure (can duck down during slide!)
  const santaGroup = new THREE.Group();
  santaGroup.position.set(0, 0.95, 0.32);
  bodyGroup.add(santaGroup);

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.56, 12), assets.crimsonMat);
  torso.position.y = 0.26;
  torso.castShadow = true;
  santaGroup.add(torso);

  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.275, 0.285, 0.09, 12), assets.darkSteelMat);
  belt.position.y = 0.16;
  santaGroup.add(belt);

  const furTrim = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.055, 8, 16), assets.snowMat);
  furTrim.rotation.x = Math.PI / 2;
  furTrim.position.y = 0.52;
  santaGroup.add(furTrim);

  const faceMat = new THREE.MeshStandardMaterial({ color: 0xfecdd3, roughness: 0.65 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 14), faceMat);
  head.position.y = 0.68;
  head.castShadow = true;
  santaGroup.add(head);

  const beard = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.24, 10), assets.snowMat);
  beard.rotation.x = Math.PI;
  beard.position.set(0, 0.57, -0.1);
  santaGroup.add(beard);

  const hatCone = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.38, 12), assets.crimsonMat);
  hatCone.position.set(0, 0.9, 0.04);
  hatCone.rotation.x = 0.22;
  santaGroup.add(hatCone);

  const pom = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), assets.snowMat);
  pom.position.set(0, 1.07, 0.1);
  santaGroup.add(pom);

  // Lead Reindeer upfront (z around -1.9)
  const reindeerGroup = new THREE.Group();
  reindeerGroup.position.set(0, 0, -1.95);
  bodyGroup.add(reindeerGroup);

  const coatMat = new THREE.MeshStandardMaterial({ color: 0x854d27, roughness: 0.78, metalness: 0.04 });
  const antlerMat = new THREE.MeshStandardMaterial({ color: 0xd6b48a, roughness: 0.65 });
  const noseMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xef4444,
    emissiveIntensity: 2.0,
    roughness: 0.25,
  });

  const deerBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.66, 8, 12), coatMat);
  deerBody.rotation.x = Math.PI / 2;
  deerBody.position.set(0, 0.66, 0);
  deerBody.castShadow = true;
  reindeerGroup.add(deerBody);

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.045, 8, 14), assets.crimsonMat);
  collar.rotation.x = Math.PI / 6;
  collar.position.set(0, 0.78, -0.34);
  reindeerGroup.add(collar);

  const bell = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 10), assets.goldMat);
  bell.position.set(0, 0.64, -0.5);
  reindeerGroup.add(bell);

  const deerNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 0.42, 10), coatMat);
  deerNeck.position.set(0, 0.94, -0.38);
  deerNeck.rotation.x = -0.35;
  deerNeck.castShadow = true;
  reindeerGroup.add(deerNeck);

  const deerHead = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.36), coatMat);
  deerHead.position.set(0, 1.12, -0.54);
  deerHead.castShadow = true;
  reindeerGroup.add(deerHead);

  const rudolphNose = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 12), noseMat);
  rudolphNose.position.set(0, 1.12, -0.75);
  reindeerGroup.add(rudolphNose);

  for (const side of [-0.09, 0.09]) {
    const antlerMain = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.025, 0.42, 6), antlerMat);
    antlerMain.position.set(side * 1.4, 1.38, -0.46);
    antlerMain.rotation.z = side > 0 ? -0.35 : 0.35;
    antlerMain.rotation.x = 0.15;
    reindeerGroup.add(antlerMain);

    const tine = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.2, 6), antlerMat);
    tine.position.set(side * 1.9, 1.46, -0.52);
    tine.rotation.z = side > 0 ? 0.45 : -0.45;
    reindeerGroup.add(tine);
  }

  const legs: THREE.Mesh[] = [];
  const legPositions: [number, number][] = [
    [-0.14, -0.28],
    [0.14, -0.28],
    [-0.14, 0.3],
    [0.14, 0.3],
  ];
  const legGeo = new THREE.CylinderGeometry(0.055, 0.04, 0.56, 8);
  legGeo.translate(0, -0.28, 0);
  for (const [lx, lz] of legPositions) {
    const leg = new THREE.Mesh(legGeo, coatMat);
    leg.position.set(lx, 0.56, lz);
    leg.castShadow = true;
    reindeerGroup.add(leg);
    legs.push(leg);
  }

  // Reins linking sleigh front to reindeer collar
  for (const side of [-0.26, 0.26]) {
    const reinCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.7, 0.88, -0.65),
      new THREE.Vector3(side * 0.8, 0.68, -1.35),
      new THREE.Vector3(side * 0.65, 0.78, -2.25),
    ]);
    const rein = new THREE.Mesh(new THREE.TubeGeometry(reinCurve, 10, 0.016, 6, false), assets.goldMat);
    bodyGroup.add(rein);
  }

  // Frost Shield protective halo dome (hidden until collected)
  const shieldMat = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.45,
    roughness: 0.12,
    metalness: 0.1,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  });
  const shieldDome = new THREE.Mesh(new THREE.SphereGeometry(1.9, 24, 18), shieldMat);
  shieldDome.scale.set(0.85, 0.78, 1.48);
  shieldDome.position.set(0, 0.9, -0.45);
  shieldDome.visible = false;
  bodyGroup.add(shieldDome);

  // Golden Turbo Halo Ring
  const turboMat = new THREE.MeshBasicMaterial({
    color: 0xfbbf24,
    transparent: true,
    opacity: 0.75,
    side: THREE.DoubleSide,
  });
  const turboHalo = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.045, 8, 32), turboMat);
  turboHalo.position.set(0, 0.75, -0.6);
  turboHalo.visible = false;
  bodyGroup.add(turboHalo);

  return {
    root,
    bodyGroup,
    santaGroup,
    reindeerGroup,
    legs,
    rudolphNose,
    shieldDome,
    turboHalo,
    headlampLight,
    shadowPlane,
  };
}

export function createPineObstacle(assets: SharedAssets): THREE.Group {
  const g = new THREE.Group();

  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), assets.shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.025;
  g.add(shadow);

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.8, 8), assets.pineWoodMat);
  trunk.position.y = 0.4;
  trunk.castShadow = true;
  g.add(trunk);

  const tiers = [
    { r: 1.05, h: 1.4, y: 1.3 },
    { r: 0.82, h: 1.25, y: 2.1 },
    { r: 0.56, h: 1.05, y: 2.85 },
  ];
  for (const t of tiers) {
    const bough = new THREE.Mesh(new THREE.ConeGeometry(t.r, t.h, 10), assets.pineNeedleMat);
    bough.position.y = t.y;
    bough.castShadow = true;
    bough.receiveShadow = true;
    g.add(bough);

    const snowCap = new THREE.Mesh(
      new THREE.ConeGeometry(t.r * 0.76, t.h * 0.45, 10),
      assets.snowMat,
    );
    snowCap.position.y = t.y + t.h * 0.3;
    g.add(snowCap);
  }

  return g;
}

export function createHurdleObstacle(assets: SharedAssets): THREE.Group {
  const g = new THREE.Group();

  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1.1), assets.shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.025;
  g.add(shadow);

  // Two striped candy-cane posts
  for (const sx of [-1.05, 1.05]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 1.05, 10), assets.candyMat);
    post.position.set(sx, 0.525, 0);
    post.castShadow = true;
    g.add(post);

    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), assets.goldMat);
    finial.position.set(sx, 1.08, 0);
    g.add(finial);
  }

  // Crossbar + snow cap (jumpable!)
  const bar = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.34, 0.24), assets.candyMat);
  bar.position.set(0, 0.72, 0);
  bar.castShadow = true;
  g.add(bar);

  const snowTop = new THREE.Mesh(new THREE.BoxGeometry(2.34, 0.09, 0.28), assets.snowMat);
  snowTop.position.set(0, 0.92, 0);
  g.add(snowTop);

  return g;
}

export function createArchObstacle(assets: SharedAssets): THREE.Group {
  const g = new THREE.Group();

  // Left & right pillars framing the lane
  for (const sx of [-1.18, 1.18]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.28, 2.85, 0.34), assets.woodMat);
    pillar.position.set(sx, 1.425, 0);
    pillar.castShadow = true;
    g.add(pillar);

    const baseSnow = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, 0.22, 8), assets.snowMat);
    baseSnow.position.set(sx, 0.11, 0);
    g.add(baseSnow);
  }

  // Overhead ice-and-timber crossbeam (high at y=2.05 so sleigh MUST duck under y<1.25)
  const beam = new THREE.Mesh(new THREE.BoxGeometry(2.75, 0.72, 0.42), assets.woodMat);
  beam.position.set(0, 2.28, 0);
  beam.castShadow = true;
  g.add(beam);

  const snowRoof = new THREE.Mesh(new THREE.BoxGeometry(2.86, 0.18, 0.5), assets.snowMat);
  snowRoof.position.set(0, 2.71, 0);
  g.add(snowRoof);

  // Dangling icicles warning player to duck!
  for (let i = -3; i <= 3; i++) {
    const icicle = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.56, 6), assets.iceMat);
    icicle.rotation.x = Math.PI;
    icicle.position.set(i * 0.31, 1.66, 0);
    g.add(icicle);
  }

  // Warm warning lanterns on side posts
  const amberBulb = new THREE.MeshStandardMaterial({
    color: 0xfde047,
    emissive: 0xf59e0b,
    emissiveIntensity: 1.8,
  });
  for (const sx of [-1.18, 1.18]) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), amberBulb);
    lamp.position.set(sx, 1.75, 0.22);
    g.add(lamp);
  }

  return g;
}

export function createSnowballObstacle(assets: SharedAssets): THREE.Group {
  const g = new THREE.Group();

  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.3), assets.shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.025;
  g.add(shadow);

  const spinner = new THREE.Group();
  spinner.position.y = 0.92;
  spinner.name = 'spinner';
  g.add(spinner);

  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.92, 1), assets.snowMat);
  core.castShadow = true;
  core.receiveShadow = true;
  spinner.add(core);

  const crust = new THREE.Mesh(new THREE.DodecahedronGeometry(0.84, 0), assets.iceMat);
  crust.rotation.set(0.4, 0.7, 0.2);
  spinner.add(crust);

  return g;
}

export function createCollectibleMesh(kind: CollectibleKind, assets: SharedAssets): THREE.Group {
  const g = new THREE.Group();

  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.15), assets.shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.025;
  g.add(shadow);

  const item = new THREE.Group();
  item.name = 'item';
  item.position.y = 0.75;
  g.add(item);

  if (kind === 'present_red' || kind === 'present_gold' || kind === 'present_emerald') {
    const boxMat =
      kind === 'present_red'
        ? assets.crimsonMat
        : kind === 'present_gold'
          ? assets.goldMat
          : assets.emeraldMat;
    const ribbonMat = kind === 'present_gold' ? assets.crimsonMat : assets.goldMat;

    const box = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.62, 0.68), boxMat);
    box.castShadow = true;
    item.add(box);

    const bandX = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.65, 0.14), ribbonMat);
    item.add(bandX);

    const bandZ = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.65, 0.72), ribbonMat);
    item.add(bandZ);

    const bowL = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.04, 6, 12), ribbonMat);
    bowL.position.set(-0.1, 0.38, 0);
    bowL.rotation.y = Math.PI / 4;
    item.add(bowL);

    const bowR = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.04, 6, 12), ribbonMat);
    bowR.position.set(0.1, 0.38, 0);
    bowR.rotation.y = -Math.PI / 4;
    item.add(bowR);
  } else if (kind === 'cookie_turbo') {
    // Golden star badge
    const starShape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const rad = i % 2 === 0 ? 0.46 : 0.21;
      const x = Math.cos(angle) * rad;
      const y = Math.sin(angle) * rad;
      if (i === 0) starShape.moveTo(x, y);
      else starShape.lineTo(x, y);
    }
    starShape.closePath();

    const starGeo = new THREE.ExtrudeGeometry(starShape, {
      depth: 0.14,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.03,
      bevelSegments: 2,
    });
    starGeo.center();

    const starMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xd97706,
      emissiveIntensity: 0.75,
      roughness: 0.22,
      metalness: 0.85,
    });
    const star = new THREE.Mesh(starGeo, starMat);
    star.castShadow = true;
    item.add(star);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.56, 0.035, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0xfef08a }),
    );
    item.add(ring);
  } else if (kind === 'aurora_magnet') {
    const magMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x0891b2,
      emissiveIntensity: 0.7,
      roughness: 0.25,
      metalness: 0.75,
    });
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.1, 10, 18, Math.PI), magMat);
    arc.rotation.z = Math.PI;
    item.add(arc);

    for (const sx of [-0.32, 0.32]) {
      const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.22, 10), assets.snowMat);
      tip.position.set(sx, 0.11, 0);
      item.add(tip);
    }
  } else {
    // frost_shield
    const crystalMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.65,
      roughness: 0.12,
      metalness: 0.2,
      clearcoat: 1,
    });
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.4, 0), crystalMat);
    core.castShadow = true;
    item.add(core);

    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.55, 0.04, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0x7dd3fc }),
    );
    halo.rotation.x = Math.PI / 3;
    item.add(halo);
  }

  return g;
}

export function createCozyCabin(assets: SharedAssets): THREE.Group {
  const g = new THREE.Group();

  const walls = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.2, 3.0), assets.woodMat);
  walls.position.y = 1.1;
  walls.castShadow = true;
  walls.receiveShadow = true;
  g.add(walls);

  const roofMat = new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.75 });
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.75, 1.65, 4), roofMat);
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 2.98;
  roof.castShadow = true;
  g.add(roof);

  const roofSnow = new THREE.Mesh(new THREE.ConeGeometry(2.6, 0.9, 4), assets.snowMat);
  roofSnow.rotation.y = Math.PI / 4;
  roofSnow.position.y = 3.42;
  g.add(roofSnow);

  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.52, 1.35, 0.52), assets.darkSteelMat);
  chimney.position.set(0.85, 3.35, -0.45);
  g.add(chimney);

  const windowMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xf59e0b,
    emissiveIntensity: 1.9,
    roughness: 0.2,
  });
  for (const wx of [-0.85, 0.85]) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.08), windowMat);
    win.position.set(wx, 1.2, 1.51);
    g.add(win);

    const winSide = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.62, 0.62), windowMat);
    winSide.position.set(-1.71, 1.2, wx * 0.7);
    g.add(winSide);
  }

  return g;
}
