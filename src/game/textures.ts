import * as THREE from 'three';

function applyTextureDefaults(
  tex: THREE.CanvasTexture,
  anisotropy: number,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = Math.max(1, anisotropy);
  tex.needsUpdate = true;
  return tex;
}

export function createSnowTrackTexture(anisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Packed arctic snow base
  const grad = ctx.createLinearGradient(0, 0, 512, 0);
  grad.addColorStop(0, '#c7daf0');
  grad.addColorStop(0.08, '#eaf3fc');
  grad.addColorStop(0.5, '#f4f8ff');
  grad.addColorStop(0.92, '#eaf3fc');
  grad.addColorStop(1, '#c7daf0');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Subtle snow grain
  for (let i = 0; i < 2400; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const size = 1 + Math.random() * 2.2;
    ctx.fillStyle = i % 3 === 0 ? 'rgba(255,255,255,0.65)' : 'rgba(148,184,224,0.22)';
    ctx.fillRect(x, y, size, size);
  }

  // Three groomed sleigh lanes with dual runner tracks
  const laneCenters = [108, 256, 404];
  for (const cx of laneCenters) {
    // Soft lane depression
    const laneGrad = ctx.createLinearGradient(cx - 48, 0, cx + 48, 0);
    laneGrad.addColorStop(0, 'rgba(180,206,236,0)');
    laneGrad.addColorStop(0.5, 'rgba(180,206,236,0.28)');
    laneGrad.addColorStop(1, 'rgba(180,206,236,0)');
    ctx.fillStyle = laneGrad;
    ctx.fillRect(cx - 48, 0, 96, 512);

    // Runner grooves
    ctx.fillStyle = 'rgba(120, 162, 212, 0.45)';
    ctx.fillRect(cx - 22, 0, 5, 512);
    ctx.fillRect(cx + 17, 0, 5, 512);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillRect(cx - 17, 0, 2, 512);
    ctx.fillRect(cx + 22, 0, 2, 512);
  }

  // Edge snowbank trim lines
  ctx.fillStyle = 'rgba(100, 146, 200, 0.35)';
  ctx.fillRect(14, 0, 8, 512);
  ctx.fillRect(490, 0, 8, 512);

  const tex = new THREE.CanvasTexture(canvas);
  return applyTextureDefaults(tex, anisotropy, 1, 2);
}

export function createCandyCaneTexture(anisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 256, 256);

  ctx.fillStyle = '#dc2626';
  for (let i = -256; i < 512; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 32, 0);
    ctx.lineTo(i + 288, 256);
    ctx.lineTo(i + 256, 256);
    ctx.closePath();
    ctx.fill();
  }

  // Thin festive gold pin-stripe
  ctx.fillStyle = '#f59e0b';
  for (let i = -256; i < 512; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i + 32, 0);
    ctx.lineTo(i + 36, 0);
    ctx.lineTo(i + 292, 256);
    ctx.lineTo(i + 288, 256);
    ctx.closePath();
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  return applyTextureDefaults(tex, anisotropy, 2, 2);
}

export function createWoodTexture(anisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#6b4226';
  ctx.fillRect(0, 0, 256, 256);

  for (let y = 0; y < 256; y += 8) {
    const shade = 90 + Math.sin(y * 0.25) * 16 + (Math.random() - 0.5) * 14;
    ctx.fillStyle = `rgb(${Math.round(shade * 1.15)}, ${Math.round(shade * 0.72)}, ${Math.round(shade * 0.42)})`;
    ctx.fillRect(0, y, 256, 6);
  }

  ctx.fillStyle = 'rgba(38, 20, 8, 0.32)';
  for (let y = 0; y < 256; y += 32) {
    ctx.fillRect(0, y, 256, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  return applyTextureDefaults(tex, anisotropy, 1, 1);
}

export function createAuroraTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  const vert = ctx.createLinearGradient(0, 0, 0, 128);
  vert.addColorStop(0, 'rgba(16, 185, 129, 0)');
  vert.addColorStop(0.28, 'rgba(52, 211, 153, 0.55)');
  vert.addColorStop(0.58, 'rgba(56, 189, 248, 0.72)');
  vert.addColorStop(0.82, 'rgba(139, 92, 246, 0.28)');
  vert.addColorStop(1, 'rgba(15, 23, 42, 0)');
  ctx.fillStyle = vert;
  ctx.fillRect(0, 0, 512, 128);

  // Vertical curtain streaks
  for (let x = 0; x < 512; x += 6) {
    const alpha = 0.08 + 0.14 * Math.sin(x * 0.09);
    ctx.fillStyle = `rgba(167, 243, 208, ${Math.max(0.02, alpha)})`;
    ctx.fillRect(x, 12, 3, 102);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 60);
  grad.addColorStop(0, 'rgba(8, 19, 40, 0.55)');
  grad.addColorStop(0.55, 'rgba(12, 28, 56, 0.24)');
  grad.addColorStop(1, 'rgba(12, 28, 56, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}
