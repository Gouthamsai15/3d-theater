import * as THREE from 'three';

function hash2D(ix: number, iz: number): number {
  const n = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function valueNoise2D(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);

  const a = hash2D(ix, iz);
  const b = hash2D(ix + 1, iz);
  const c = hash2D(ix, iz + 1);
  const d = hash2D(ix + 1, iz + 1);

  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

export function fbm2D(x: number, z: number, octaves = 4): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * (valueNoise2D(x * freq, z * freq) * 2 - 1);
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / Math.max(1e-5, norm);
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Water surface elevation (meters). Ocean sits just below the beach shoreline.
 */
export const BEACH_WATER_Y = -0.45;

/**
 * Curved cove shoreline Z coordinate as a function of X.
 * The water sits at z < shorelineZ(x) (behind and wrapping softly past the outdoor screen).
 */
export function beachShorelineZ(x: number): number {
  // Deepest cove curve behind screen center; sweeps gently closer along the outer flanks
  return -13.4 + Math.sin(x * 0.048) * 1.9 + smoothstep(14, 52, Math.abs(x)) * 7.5;
}

export type BeachTerrainVariant = 'sunset' | 'bioluminescent';

export const BIOLUMINESCENT_PIT_CENTERS: readonly {
  side: -1 | 1;
  cx: number;
  cz: number;
  yaw: number;
  ru: number;
  rv: number;
  depth: number;
}[] = [
  { side: -1, cx: -5.44, cz: -2.32, yaw: 0.2, ru: 4.72, rv: 1.74, depth: 0.42 },
  { side: 1, cx: 5.44, cz: -2.32, yaw: -0.2, ru: 4.72, rv: 1.74, depth: 0.42 },
];

/**
 * Evaluates normalized superellipse (p = 3) distance to the nearest Bioluminescent Cove
 * sunken conversation pit (< 0.95 is flat pit floor, 0.95..1.06 is crisp retaining bank).
 */
export function getBioluminescentPitNormDist(x: number, z: number): {
  normDist: number;
  depth: number;
} {
  let best = Infinity;
  let bestDepth = 0.42;
  for (const pit of BIOLUMINESCENT_PIT_CENTERS) {
    const dx = x - pit.cx;
    const dz = z - pit.cz;
    const c = Math.cos(pit.yaw);
    const s = Math.sin(pit.yaw);
    const u = dx * c + dz * s;
    const v = -dx * s + dz * c;
    const au = Math.abs(u / pit.ru);
    const av = Math.abs(v / pit.rv);
    const nd = Math.cbrt(au * au * au + av * av * av);
    if (nd < best) {
      best = nd;
      bestDepth = pit.depth;
    }
  }
  return { normDist: best, depth: bestDepth };
}

/**
 * Returns world (x, z) points along a pit's perimeter superellipse so stone retaining walls
 * and coping rims match the terrain carving 1:1.
 */
export function getBioluminescentPitPerimeterPoints(
  pit: (typeof BIOLUMINESCENT_PIT_CENTERS)[number],
  segments = 64,
  radialScale = 1.0,
): { x: number; z: number }[] {
  const c = Math.cos(pit.yaw);
  const s = Math.sin(pit.yaw);
  const pts: { x: number; z: number }[] = [];
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    const cosT = Math.cos(t);
    const sinT = Math.sin(t);
    const su = Math.sign(cosT) * Math.pow(Math.abs(cosT), 2 / 3) * pit.ru * radialScale;
    const sv = Math.sign(sinT) * Math.pow(Math.abs(sinT), 2 / 3) * pit.rv * radialScale;
    const wx = pit.cx + su * c - sv * s;
    const wz = pit.cz + su * s + sv * c;
    pts.push({ x: wx, z: wz });
  }
  return pts;
}

/**
 * Deterministic sand terrain height at world (x, z) so the sand mesh, seats,
 * wooden crates, tiki torches, campfire pit, palm trees, projector stand,
 * and PA speaker tripods all sit 100% flush with zero floating or clipping.
 */
export function beachHeightAt(
  x: number,
  z: number,
  variant: BeachTerrainVariant = 'sunset',
): number {
  const shoreZ = beachShorelineZ(x);

  // Drop gently underwater once past the shoreline toward the ocean (-Z)
  if (z < shoreZ + 1.8) {
    const seaDist = shoreZ + 1.8 - z;
    const dip = smoothstep(0, 7.5, seaDist) * 2.1;
    const ripple = fbm2D(x * 0.14 + 3.1, z * 0.14 - 2.4, 2) * 0.08;
    return -dip + ripple * (1 - smoothstep(4, 10, seaDist));
  }

  // Gentle natural amphitheater slope across the seating area (-4.8 .. +7.8)
  const seatT = smoothstep(-5.2, 8.2, z);
  const amphitheaterBase = seatT * 0.34;

  // Radial blend factor: 0 inside the flat/graded cinema seating + stage bowl, 1 in outer dunes
  const bowlDx = Math.max(0, Math.abs(x) - 10.6) / 10.0;
  const bowlDz = z < -11.4 ? (-11.4 - z) / 2.2 : z > 8.6 ? (z - 8.6) / 7.5 : 0;
  const outerFactor = smoothstep(0.05, 1.0, Math.hypot(bowlDx, bowlDz));

  // Rolling wind-swept sand dunes around perimeter
  const dunePrimary = (fbm2D(x * 0.042 + 7.2, z * 0.042 + 1.9, 4) * 0.5 + 0.5) * 3.8;
  const duneRidge = Math.sin(x * 0.065 + z * 0.045) * 0.65;
  const backBerm = smoothstep(10.0, 38.0, z) * 2.6;
  const sideHeadlands = smoothstep(18.0, 58.0, Math.abs(x)) * 2.4;
  const microSand = fbm2D(x * 0.32, z * 0.32, 2) * 0.035;

  const naturalDunes = dunePrimary + duneRidge + backBerm + sideHeadlands;
  let baseH = amphitheaterBase + microSand * (0.25 + 0.75 * outerFactor) + naturalDunes * outerFactor;

  if (variant === 'bioluminescent' && Math.abs(x) > 0.85) {
    const { normDist, depth } = getBioluminescentPitNormDist(x, z);
    // Flat pit interior out to 0.96, crisp retaining wall rise up to 1.04
    const pitMask = 1 - smoothstep(0.95, 1.06, normDist);
    baseH -= pitMask * depth;
  }

  return baseH;
}

/**
 * Generates seamless tileable wave normal map for Three.js Water shader.
 */
export function createWaterNormalsTexture(size = 256): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  const heights = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = (y / size) * Math.PI * 2;
    for (let x = 0; x < size; x++) {
      const u = (x / size) * Math.PI * 2;
      // Seamless periodic multi-directional ocean wave superposition
      const h =
        Math.sin(u * 2 + v * 1) * 0.34 +
        Math.sin(u * 3 - v * 2 + 1.1) * 0.24 +
        Math.cos(u * 5 + v * 4 + 2.3) * 0.14 +
        Math.sin(u * 7 - v * 6 + 0.6) * 0.09 +
        Math.cos(u * 11 + v * 9 + 1.7) * 0.05;
      heights[y * size + x] = h;
    }
  }

  const strength = 2.4;
  for (let y = 0; y < size; y++) {
    const ym = (y - 1 + size) % size;
    const yp = (y + 1) % size;
    for (let x = 0; x < size; x++) {
      const xm = (x - 1 + size) % size;
      const xp = (x + 1) % size;

      const dX = (heights[y * size + xp] - heights[y * size + xm]) * strength;
      const dY = (heights[yp * size + x] - heights[ym * size + x]) * strength;
      const invLen = 1 / Math.hypot(dX, dY, 1);

      const nx = (-dX * invLen * 0.5 + 0.5) * 255;
      const ny = (-dY * invLen * 0.5 + 0.5) * 255;
      const nz = (invLen * 0.5 + 0.5) * 255;

      const idx = (y * size + x) * 4;
      data[idx] = Math.max(0, Math.min(255, Math.round(nx)));
      data[idx + 1] = Math.max(0, Math.min(255, Math.round(ny)));
      data[idx + 2] = Math.max(0, Math.min(255, Math.round(nz)));
      data[idx + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates procedural fine-grain sand diffuse, tangent-space normal, and roughness maps.
 */
export function createSandTextures(size = 256): {
  map: THREE.CanvasTexture;
  normalMap: THREE.DataTexture;
  roughnessMap: THREE.DataTexture;
  dispose: () => void;
} {
  // 1. Fine-grain warm sand diffuse canvas
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const d = img.data;

  const grainField = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = y * size + x;
      const ripple = Math.sin((y / size) * Math.PI * 10 + Math.sin((x / size) * Math.PI * 4) * 1.4) * 0.5 + 0.5;
      const fine = hash2D(x * 1.37, y * 1.91);
      const spec = hash2D(x * 3.7, y * 2.9);
      const h = ripple * 0.42 + fine * 0.58;
      grainField[idx] = h;

      // Base warm coastal sand #c2b280 with subtle mineral speckles
      const shade = 0.88 + h * 0.22 + (spec > 0.96 ? 0.09 : spec < 0.04 ? -0.11 : 0);
      const p = idx * 4;
      d[p] = Math.max(0, Math.min(255, Math.round(196 * shade)));
      d[p + 1] = Math.max(0, Math.min(255, Math.round(176 * shade)));
      d[p + 2] = Math.max(0, Math.min(255, Math.round(130 * shade)));
      d[p + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(22, 22);
  map.colorSpace = THREE.SRGBColorSpace;
  map.needsUpdate = true;

  // 2. Normal & Roughness maps derived from grainField
  const normData = new Uint8Array(size * size * 4);
  const roughData = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    const ym = (y - 1 + size) % size;
    const yp = (y + 1) % size;
    for (let x = 0; x < size; x++) {
      const xm = (x - 1 + size) % size;
      const xp = (x + 1) % size;

      const dX = (grainField[y * size + xp] - grainField[y * size + xm]) * 1.9;
      const dY = (grainField[yp * size + x] - grainField[ym * size + x]) * 1.9;
      const invLen = 1 / Math.hypot(dX, dY, 1);

      const p = (y * size + x) * 4;
      normData[p] = Math.round((-dX * invLen * 0.5 + 0.5) * 255);
      normData[p + 1] = Math.round((-dY * invLen * 0.5 + 0.5) * 255);
      normData[p + 2] = Math.round((invLen * 0.5 + 0.5) * 255);
      normData[p + 3] = 255;

      const rVal = Math.round((0.84 + grainField[y * size + x] * 0.14) * 255);
      roughData[p] = rVal;
      roughData[p + 1] = rVal;
      roughData[p + 2] = rVal;
      roughData[p + 3] = 255;
    }
  }

  const normalMap = new THREE.DataTexture(normData, size, size, THREE.RGBAFormat);
  normalMap.wrapS = THREE.RepeatWrapping;
  normalMap.wrapT = THREE.RepeatWrapping;
  normalMap.repeat.set(22, 22);
  normalMap.colorSpace = THREE.NoColorSpace;
  normalMap.needsUpdate = true;

  const roughnessMap = new THREE.DataTexture(roughData, size, size, THREE.RGBAFormat);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(22, 22);
  roughnessMap.colorSpace = THREE.NoColorSpace;
  roughnessMap.needsUpdate = true;

  return {
    map,
    normalMap,
    roughnessMap,
    dispose: () => {
      map.dispose();
      normalMap.dispose();
      roughnessMap.dispose();
    },
  };
}

/**
 * Procedural striped coastal canvas sling texture for wooden deck chairs.
 */
export function createBeachStripedCanvasTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#efe5d0';
  ctx.fillRect(0, 0, 256, 256);

  // Classic coastal navy + terracotta + cream stripes
  const stripes = [
    { w: 42, color: '#efe5d0' },
    { w: 30, color: '#1f4068' },
    { w: 12, color: '#c86432' },
    { w: 30, color: '#1f4068' },
    { w: 14, color: '#efe5d0' },
  ];
  let x = 0;
  let i = 0;
  while (x < 256) {
    const s = stripes[i % stripes.length];
    ctx.fillStyle = s.color;
    ctx.fillRect(x, 0, s.w, 256);
    x += s.w;
    i++;
  }

  // Subtle woven canvas thread grain
  ctx.fillStyle = 'rgba(20, 16, 12, 0.06)';
  for (let y = 0; y < 256; y += 3) {
    ctx.fillRect(0, y, 256, 1);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Procedural woven beach blanket plaid texture.
 */
export function createWovenBlanketTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#d9cdb8';
  ctx.fillRect(0, 0, 256, 256);

  const bands = [
    { pos: 24, size: 18, color: 'rgba(27, 65, 92, 0.55)' },
    { pos: 64, size: 8, color: 'rgba(196, 86, 48, 0.55)' },
    { pos: 120, size: 22, color: 'rgba(27, 65, 92, 0.48)' },
    { pos: 188, size: 10, color: 'rgba(212, 160, 62, 0.55)' },
    { pos: 222, size: 16, color: 'rgba(27, 65, 92, 0.52)' },
  ];
  bands.forEach((b) => {
    ctx.fillStyle = b.color;
    ctx.fillRect(b.pos, 0, b.size, 256);
    ctx.fillRect(0, b.pos, 256, b.size);
  });

  // Woven fringes on top/bottom edges
  ctx.fillStyle = '#efe7d6';
  for (let fx = 0; fx < 256; fx += 6) {
    ctx.fillRect(fx, 0, 3, 10);
    ctx.fillRect(fx, 246, 3, 10);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Procedural soft glowing radial sprite texture for campfire embers & tiki flame sprites.
 */
export function createGlowParticleTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 1, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255, 255, 240, 1)');
  grad.addColorStop(0.28, 'rgba(255, 175, 65, 0.92)');
  grad.addColorStop(0.65, 'rgba(255, 90, 20, 0.36)');
  grad.addColorStop(1, 'rgba(255, 40, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates procedural matte pebbled grain leather normal + roughness + subtle diffuse textures
 * for Bioluminescent Cove seating (roughness: 0.82-0.86, metalness: 0.01, ZERO clearcoat).
 */
export function createMatteLeatherTextures(size = 256): {
  normalMap: THREE.DataTexture;
  roughnessMap: THREE.DataTexture;
  bumpMap: THREE.DataTexture;
  dispose: () => void;
} {
  const heightField = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Multi-scale organic pebbled hide cells (seamless periodic approximation + hash grain)
      const u = (x / size) * Math.PI * 2;
      const v = (y / size) * Math.PI * 2;
      const cellA = Math.sin(u * 14 + Math.cos(v * 14) * 1.4) * Math.cos(v * 14 + Math.sin(u * 12) * 1.2);
      const cellB = Math.sin(u * 23 - Math.sin(v * 21)) * Math.cos(v * 25 + Math.cos(u * 19));
      const grain = hash2D(x * 1.73, y * 2.11);
      const pebble = 0.5 + 0.28 * Math.abs(cellA) + 0.14 * cellB + 0.08 * grain;
      heightField[y * size + x] = Math.max(0, Math.min(1, pebble));
    }
  }

  const normData = new Uint8Array(size * size * 4);
  const roughData = new Uint8Array(size * size * 4);
  const bumpData = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y++) {
    const ym = (y - 1 + size) % size;
    const yp = (y + 1) % size;
    for (let x = 0; x < size; x++) {
      const xm = (x - 1 + size) % size;
      const xp = (x + 1) % size;
      const dX = (heightField[y * size + xp] - heightField[y * size + xm]) * 2.1;
      const dY = (heightField[yp * size + x] - heightField[ym * size + x]) * 2.1;
      const invLen = 1 / Math.hypot(dX, dY, 1);

      const p = (y * size + x) * 4;
      normData[p] = Math.round((-dX * invLen * 0.5 + 0.5) * 255);
      normData[p + 1] = Math.round((-dY * invLen * 0.5 + 0.5) * 255);
      normData[p + 2] = Math.round((invLen * 0.5 + 0.5) * 255);
      normData[p + 3] = 255;

      // High matte roughness centered cleanly around 0.82 - 0.86
      const h = heightField[y * size + x];
      const rVal = Math.round((0.80 + h * 0.08) * 255);
      roughData[p] = rVal;
      roughData[p + 1] = rVal;
      roughData[p + 2] = rVal;
      roughData[p + 3] = 255;

      const bVal = Math.round(h * 255);
      bumpData[p] = bVal;
      bumpData[p + 1] = bVal;
      bumpData[p + 2] = bVal;
      bumpData[p + 3] = 255;
    }
  }

  const configureDataTex = (buf: Uint8Array, repeat: number) => {
    const tex = new THREE.DataTexture(buf, size, size, THREE.RGBAFormat);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat, repeat);
    tex.colorSpace = THREE.NoColorSpace;
    tex.needsUpdate = true;
    return tex;
  };

  const normalMap = configureDataTex(normData, 4);
  const roughnessMap = configureDataTex(roughData, 4);
  const bumpMap = configureDataTex(bumpData, 4);

  return {
    normalMap,
    roughnessMap,
    bumpMap,
    dispose: () => {
      normalMap.dispose();
      roughnessMap.dispose();
      bumpMap.dispose();
    },
  };
}

/**
 * Generates dark charcoal coastal slate stone textures for Bioluminescent Cove retaining walls,
 * coping stones, and pathway stepping stones.
 */
export function createSlateStoneTextures(size = 256): {
  map: THREE.CanvasTexture;
  normalMap: THREE.DataTexture;
  dispose: () => void;
} {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const heights = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = y * size + x;
      const strata = fbm2D(x * 0.035 + 2.1, y * 0.11 + 5.7, 3) * 0.5 + 0.5;
      const fissure = Math.abs(fbm2D(x * 0.08, y * 0.08, 2));
      const speck = hash2D(x * 1.4, y * 1.8);
      const h = Math.max(0, Math.min(1, strata * 0.65 + fissure * 0.25 + speck * 0.1));
      heights[idx] = h;

      const base = 30 + Math.round(h * 28);
      const p = idx * 4;
      d[p] = base;
      d[p + 1] = base + 3;
      d[p + 2] = base + 8;
      d[p + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(3, 2);
  map.colorSpace = THREE.SRGBColorSpace;
  map.needsUpdate = true;

  const normData = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    const ym = (y - 1 + size) % size;
    const yp = (y + 1) % size;
    for (let x = 0; x < size; x++) {
      const xm = (x - 1 + size) % size;
      const xp = (x + 1) % size;
      const dX = (heights[y * size + xp] - heights[y * size + xm]) * 2.2;
      const dY = (heights[yp * size + x] - heights[ym * size + x]) * 2.2;
      const invLen = 1 / Math.hypot(dX, dY, 1);
      const p = (y * size + x) * 4;
      normData[p] = Math.round((-dX * invLen * 0.5 + 0.5) * 255);
      normData[p + 1] = Math.round((-dY * invLen * 0.5 + 0.5) * 255);
      normData[p + 2] = Math.round((invLen * 0.5 + 0.5) * 255);
      normData[p + 3] = 255;
    }
  }

  const normalMap = new THREE.DataTexture(normData, size, size, THREE.RGBAFormat);
  normalMap.wrapS = THREE.RepeatWrapping;
  normalMap.wrapT = THREE.RepeatWrapping;
  normalMap.repeat.set(3, 2);
  normalMap.colorSpace = THREE.NoColorSpace;
  normalMap.needsUpdate = true;

  return {
    map,
    normalMap,
    dispose: () => {
      map.dispose();
      normalMap.dispose();
    },
  };
}

