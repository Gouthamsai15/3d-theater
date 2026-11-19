import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { Water } from 'three/examples/jsm/objects/Water.js';
import { AudioSettings, ShowState, TheaterConfiguration } from '../../types/cinema';
import {
  applyScreenBounceToMaterial,
  ScreenBounceUniforms,
} from '../lighting/screenBounceShader';
import { ScreenBounceSample } from './CinemaScreen';
import {
  BEACH_WATER_Y,
  BeachTerrainVariant,
  BIOLUMINESCENT_PIT_CENTERS,
  beachHeightAt,
  beachShorelineZ,
  createGlowParticleTexture,
  createSandTextures,
  createSlateStoneTextures,
  createWaterNormalsTexture,
  getBioluminescentPitPerimeterPoints,
} from './beachTerrain';
import { cinemaAudioEngine } from '../../services/audio/cinemaAudioEngine';

export const BEACH_PROJECTOR_POS: [number, number, number] = [0, 0, 8.6];
export const BEACH_PROJECTOR_GROUND_Y = beachHeightAt(0, 8.6, 'sunset');
export const BEACH_PROJECTOR_LENS_Y = BEACH_PROJECTOR_GROUND_Y + 1.266;
export const BEACH_SUNSET_PROJECTOR_LENS: [number, number, number] = [
  0,
  BEACH_PROJECTOR_LENS_Y,
  8.062,
];

export const BEACH_BIO_PROJECTOR_POS: [number, number, number] = [0, 0, 9.0];
export const BEACH_BIO_PROJECTOR_GROUND_Y = beachHeightAt(0, 9.0, 'bioluminescent');
export const BEACH_BIO_PROJECTOR_LENSES: readonly [number, number, number][] = [
  [-0.26, BEACH_BIO_PROJECTOR_GROUND_Y + 1.797, 8.275],
  [0.26, BEACH_BIO_PROJECTOR_GROUND_Y + 1.797, 8.275],
];

export const BEACH_CAMPFIRE_POS: [number, number, number] = [
  -11.4,
  beachHeightAt(-11.4, 0.6, 'sunset'),
  0.6,
];

interface BeachEnvironmentProps {
  config: TheaterConfiguration;
  lightFactor: number;
  screenBounceUniforms?: ScreenBounceUniforms;
  screenBounceRef?: React.MutableRefObject<ScreenBounceSample>;
  isSoftwareGl?: boolean;
}

interface PalmSpec {
  x: number;
  z: number;
  scale: number;
  leanX: number;
  leanZ: number;
  rotY: number;
  phase: number;
}

interface TorchSpec {
  x: number;
  z: number;
  hasLight: boolean;
  phase: number;
}

const PALM_SPECS: PalmSpec[] = [
  { x: -13.8, z: -8.6, scale: 1.08, leanX: 0.14, leanZ: 0.08, rotY: 0.4, phase: 0.2 },
  { x: -15.4, z: -3.2, scale: 1.18, leanX: 0.18, leanZ: -0.05, rotY: 1.8, phase: 1.1 },
  { x: -14.8, z: 3.8, scale: 0.96, leanX: 0.12, leanZ: 0.06, rotY: 2.7, phase: 2.4 },
  { x: -12.6, z: 9.2, scale: 1.14, leanX: 0.1, leanZ: -0.09, rotY: 0.9, phase: 3.1 },
  { x: -19.2, z: -6.4, scale: 1.25, leanX: 0.16, leanZ: 0.04, rotY: 3.9, phase: 0.7 },
  { x: -18.5, z: 6.4, scale: 1.05, leanX: 0.09, leanZ: -0.06, rotY: 5.1, phase: 1.9 },
  { x: 13.8, z: -8.4, scale: 1.1, leanX: -0.15, leanZ: 0.07, rotY: 2.1, phase: 0.6 },
  { x: 15.6, z: -2.8, scale: 1.22, leanX: -0.17, leanZ: -0.04, rotY: 4.3, phase: 1.7 },
  { x: 14.5, z: 4.1, scale: 1.0, leanX: -0.13, leanZ: 0.05, rotY: 0.8, phase: 2.9 },
  { x: 12.8, z: 9.5, scale: 1.15, leanX: -0.11, leanZ: -0.08, rotY: 3.4, phase: 3.8 },
  { x: 19.0, z: -5.8, scale: 1.28, leanX: -0.14, leanZ: 0.05, rotY: 1.4, phase: 4.2 },
  { x: 18.2, z: 6.8, scale: 1.06, leanX: -0.1, leanZ: -0.07, rotY: 4.9, phase: 2.2 },
  { x: -6.4, z: 12.8, scale: 1.16, leanX: 0.04, leanZ: -0.12, rotY: 2.6, phase: 1.4 },
  { x: 6.8, z: 12.6, scale: 1.12, leanX: -0.05, leanZ: -0.11, rotY: 5.5, phase: 3.3 },
];

const TORCH_SPECS: TorchSpec[] = [
  { x: -9.8, z: -7.6, hasLight: true, phase: 0.0 },
  { x: 9.8, z: -7.6, hasLight: true, phase: 1.3 },
  { x: -10.8, z: -2.2, hasLight: false, phase: 2.1 },
  { x: 10.8, z: -2.2, hasLight: false, phase: 3.4 },
  { x: -10.6, z: 3.6, hasLight: true, phase: 0.9 },
  { x: 10.6, z: 3.6, hasLight: true, phase: 2.7 },
  { x: -8.6, z: 8.6, hasLight: false, phase: 4.1 },
  { x: 8.6, z: 8.6, hasLight: false, phase: 1.8 },
];

const FAIRY_POLES: [number, number][] = [
  [-11.2, -6.2],
  [-11.8, 0.2],
  [-10.4, 7.2],
  [11.2, -6.2],
  [11.8, 0.2],
  [10.4, 7.2],
];

const FAIRY_SPANS: [number, number][] = [
  [0, 1],
  [1, 2],
  [3, 4],
  [4, 5],
  [2, 5],
];

const BOLLARD_POSITIONS: [number, number][] = [
  [-1.08, -7.2],
  [1.08, -7.2],
  [-1.08, -4.8],
  [1.08, -4.8],
  [-1.08, -2.4],
  [1.08, -2.4],
  [-1.08, 0.0],
  [1.08, 0.0],
  [-1.08, 2.4],
  [1.08, 2.4],
  [-1.08, 4.8],
  [1.08, 4.8],
  [-1.08, 7.0],
  [1.08, 7.0],
];

const STEPPING_STONES: { x: number; z: number; rotY: number; w: number; d: number }[] = [
  { x: -0.18, z: -8.4, rotY: 0.14, w: 0.72, d: 0.56 },
  { x: 0.2, z: -6.9, rotY: -0.12, w: 0.76, d: 0.54 },
  { x: -0.16, z: -5.4, rotY: 0.08, w: 0.74, d: 0.58 },
  { x: 0.18, z: -3.9, rotY: -0.15, w: 0.72, d: 0.55 },
  { x: -0.14, z: -2.4, rotY: 0.11, w: 0.78, d: 0.56 },
  { x: 0.16, z: -0.9, rotY: -0.09, w: 0.74, d: 0.58 },
  { x: -0.18, z: 0.6, rotY: 0.16, w: 0.76, d: 0.55 },
  { x: 0.18, z: 2.1, rotY: -0.13, w: 0.74, d: 0.57 },
  { x: -0.15, z: 3.6, rotY: 0.07, w: 0.76, d: 0.54 },
  { x: 0.15, z: 5.1, rotY: -0.1, w: 0.72, d: 0.56 },
  { x: -0.12, z: 6.6, rotY: 0.12, w: 0.78, d: 0.58 },
];

function createSandGeometry(variant: BeachTerrainVariant): THREE.BufferGeometry {
  const segs = variant === 'bioluminescent' ? 168 : 136;
  const geo = new THREE.PlaneGeometry(240, 220, segs, segs);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const drySand = new THREE.Color(variant === 'bioluminescent' ? '#49566e' : '#c6b482');
  const wetSand = new THREE.Color(variant === 'bioluminescent' ? '#1c2a3e' : '#6f6045');
  const duneHighlight = new THREE.Color(variant === 'bioluminescent' ? '#586782' : '#d2c295');
  const pitSandTint = new THREE.Color('#273348');
  const tmpColor = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = beachHeightAt(x, z, variant);
    pos.setY(i, y);

    const wetness = THREE.MathUtils.smoothstep(y, BEACH_WATER_Y + 0.05, BEACH_WATER_Y + 0.58);
    tmpColor.copy(wetSand).lerp(drySand, wetness);
    if (y > 1.2) {
      const crestT = THREE.MathUtils.clamp((y - 1.2) / 3.5, 0, 1);
      tmpColor.lerp(duneHighlight, crestT * 0.45);
    }
    if (variant === 'bioluminescent' && y < -0.05 && z > -7.0) {
      tmpColor.lerp(pitSandTint, 0.35);
    }
    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

function createShoreFoamGeometry(): THREE.BufferGeometry {
  const segs = 84;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    const x = THREE.MathUtils.lerp(-58, 58, u);
    const sz = beachShorelineZ(x) + 0.3;
    const innerZ = sz - 0.62;
    const outerZ = sz + 0.68;
    positions.push(x, BEACH_WATER_Y + 0.035, innerZ);
    positions.push(x, BEACH_WATER_Y + 0.055, outerZ);
    uvs.push(u * 12, 0);
    uvs.push(u * 12, 1);
  }
  for (let i = 0; i < segs; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, c, b);
    indices.push(b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setIndex(indices);
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  return geo;
}

function createPalmFrondGeometry(): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(0.68, 2.35, 3, 9);
  geo.translate(0, 1.18, 0);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i);
    const py = pos.getY(i);
    const t = THREE.MathUtils.clamp(py / 2.35, 0, 1);
    const taper = Math.sin(Math.pow(t, 0.72) * Math.PI);
    const droop = -(t * t) * 0.92;
    const vFold = -Math.abs(px) * 0.24 * taper;
    pos.setX(i, px * (0.18 + taper * 0.92));
    pos.setZ(i, droop + vFold);
  }
  geo.computeVertexNormals();
  return geo;
}

function createHelicalPalmWrapGeometry(palm: PalmSpec): THREE.TubeGeometry {
  const pts: THREE.Vector3[] = [];
  const steps = 42;
  const turns = 2.6;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const cx = Math.pow(t, 1.35) * palm.leanX * 2.2;
    const cz = Math.pow(t, 1.35) * palm.leanZ * 2.2;
    const cy = 0.25 + t * 4.2;
    const radius = THREE.MathUtils.lerp(0.255, 0.142, t);
    const ang = t * Math.PI * 2 * turns + palm.phase;
    pts.push(new THREE.Vector3(cx + Math.cos(ang) * radius, cy, cz + Math.sin(ang) * radius));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  return new THREE.TubeGeometry(curve, 44, 0.024, 6, false);
}

/**
 * Builds dark slate retaining wall strip + beveled coping rim along each carved pit perimeter.
 */
function buildPitSlateStructures(): {
  wallGeo: THREE.BufferGeometry;
  copingGeo: THREE.BufferGeometry;
  underGlowGeo: THREE.BufferGeometry;
} {
  const wallPos: number[] = [];
  const wallUv: number[] = [];
  const wallIdx: number[] = [];

  const copePos: number[] = [];
  const copeUv: number[] = [];
  const copeIdx: number[] = [];

  const glowPos: number[] = [];
  const glowIdx: number[] = [];

  const segs = 68;
  for (const pit of BIOLUMINESCENT_PIT_CENTERS) {
    const innerPts = getBioluminescentPitPerimeterPoints(pit, segs, 0.96);
    const outerPts = getBioluminescentPitPerimeterPoints(pit, segs, 1.045);

    const wallBaseV = wallPos.length / 3;
    const copeBaseV = copePos.length / 3;
    const glowBaseV = glowPos.length / 3;

    for (let i = 0; i <= segs; i++) {
      const idx = i % segs;
      const ip = innerPts[idx];
      const op = outerPts[idx];
      const groundY = beachHeightAt(op.x, op.z, 'bioluminescent');
      const pitY = beachHeightAt(ip.x * 0.99 + pit.cx * 0.01, ip.z * 0.99 + pit.cz * 0.01, 'bioluminescent');
      const topY = Math.max(groundY + 0.035, pitY + 0.36);
      const botY = pitY - 0.14;
      const u = (i / segs) * 8;

      // Vertical inner slate wall ring
      wallPos.push(ip.x, botY, ip.z);
      wallPos.push(ip.x, topY, ip.z);
      wallUv.push(u, 0, u, 1);

      // Horizontal beveled coping cap spanning ip -> op
      copePos.push(ip.x - (op.x - ip.x) * 0.18, topY + 0.035, ip.z - (op.z - ip.z) * 0.18);
      copePos.push(op.x, topY + 0.02, op.z);
      copeUv.push(u, 0, u, 1);

      // Subtle glowing strip tucked directly beneath coping lip
      glowPos.push(ip.x - (op.x - ip.x) * 0.12, topY - 0.015, ip.z - (op.z - ip.z) * 0.12);
      glowPos.push(ip.x - (op.x - ip.x) * 0.03, topY - 0.04, ip.z - (op.z - ip.z) * 0.03);
    }

    for (let i = 0; i < segs; i++) {
      const a = wallBaseV + i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      wallIdx.push(a, c, b, b, c, d);

      const ca = copeBaseV + i * 2;
      const cb = ca + 1;
      const cc = ca + 2;
      const cd = ca + 3;
      copeIdx.push(ca, cc, cb, cb, cc, cd);

      const ga = glowBaseV + i * 2;
      const gb = ga + 1;
      const gc = ga + 2;
      const gd = ga + 3;
      glowIdx.push(ga, gc, gb, gb, gc, gd);
    }
  }

  const wallGeo = new THREE.BufferGeometry();
  wallGeo.setIndex(wallIdx);
  wallGeo.setAttribute('position', new THREE.Float32BufferAttribute(wallPos, 3));
  wallGeo.setAttribute('uv', new THREE.Float32BufferAttribute(wallUv, 2));
  wallGeo.computeVertexNormals();

  const copingGeo = new THREE.BufferGeometry();
  copingGeo.setIndex(copeIdx);
  copingGeo.setAttribute('position', new THREE.Float32BufferAttribute(copePos, 3));
  copingGeo.setAttribute('uv', new THREE.Float32BufferAttribute(copeUv, 2));
  copingGeo.computeVertexNormals();

  const underGlowGeo = new THREE.BufferGeometry();
  underGlowGeo.setIndex(glowIdx);
  underGlowGeo.setAttribute('position', new THREE.Float32BufferAttribute(glowPos, 3));
  underGlowGeo.computeVertexNormals();

  return { wallGeo, copingGeo, underGlowGeo };
}

/**
 * Builds thin curved matte acoustic backing arc behind curved tension screen.
 */
function buildCurvedBackingArc(width: number, height: number, arcAngle: number): THREE.BufferGeometry {
  if (arcAngle <= 0.01) {
    return new THREE.BoxGeometry(width + 0.24, height + 0.24, 0.08);
  }
  const radius = width / arcAngle;
  const segsX = 36;
  const pos: number[] = [];
  const idx: number[] = [];
  const halfH = (height + 0.24) * 0.5;
  const extAngle = arcAngle * ((width + 0.24) / width);
  for (let iy = 0; iy <= 1; iy++) {
    const y = iy === 0 ? -halfH : halfH;
    for (let ix = 0; ix <= segsX; ix++) {
      const u = ix / segsX;
      const theta = (u - 0.5) * extAngle;
      const x = Math.sin(theta) * radius;
      const z = radius - Math.cos(theta) * radius - 0.08;
      pos.push(x, y, z);
    }
  }
  const stride = segsX + 1;
  for (let ix = 0; ix < segsX; ix++) {
    const a = ix;
    const b = a + 1;
    const c = stride + ix;
    const d = c + 1;
    idx.push(a, b, d, a, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setIndex(idx);
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

export const BeachEnvironment: React.FC<BeachEnvironmentProps> = ({
  config,
  lightFactor,
  screenBounceUniforms,
  screenBounceRef,
  isSoftwareGl = false,
}) => {
  const { screenPosition, screenWidth, screenHeight, screenCurvature } = config;
  const isBioluminescent = config.theaterId === 'beach_bioluminescent';
  const variant: BeachTerrainVariant = isBioluminescent ? 'bioluminescent' : 'sunset';

  const torchLightRefs = useRef<(THREE.PointLight | null)[]>([]);
  const torchFlameRefs = useRef<(THREE.Mesh | null)[]>([]);
  const torchFlameMatRefs = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const fairyPointLightRefs = useRef<(THREE.PointLight | null)[]>([]);
  const palmCrownRefs = useRef<(THREE.Group | null)[]>([]);
  const campfireLightRef = useRef<THREE.PointLight>(null);
  const campfireFlameRefs = useRef<(THREE.Mesh | null)[]>([]);
  const campfireFlameMatRefs = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const emberMatRef = useRef<THREE.PointsMaterial>(null);
  const foamMatRef = useRef<THREE.MeshBasicMaterial>(null);

  const sunsetLensMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const bioLensLeftMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const bioLensRightMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const bioShoreGlowMatRef = useRef<THREE.MeshStandardMaterial>(null);

  // 1. Sky / Night Dome + Animated Water
  const {
    sunsetSkyObj,
    midnightSkyMat,
    waterObj,
    waterNormalsTex,
    bioWaterUniforms,
  } = useMemo(() => {
    const waterNormals = createWaterNormalsTexture(256);
    const waterGeo = new THREE.PlaneGeometry(640, 460);

    const sunVec = new THREE.Vector3();
    if (isBioluminescent) {
      // Cool silver moonlight reflecting across the lagoon
      sunVec.set(-46, 82, -260).normalize();
    } else {
      const phi = THREE.MathUtils.degToRad(90 - 2.6);
      const theta = THREE.MathUtils.degToRad(198);
      sunVec.setFromSphericalCoords(1, phi, theta);
    }

    const water = new Water(waterGeo, {
      textureWidth: isSoftwareGl ? 256 : 512,
      textureHeight: isSoftwareGl ? 256 : 512,
      waterNormals,
      sunDirection: sunVec.clone().normalize(),
      sunColor: isBioluminescent ? 0x9ad8ff : 0xff8c42,
      waterColor: isBioluminescent ? 0x020b1c : 0x0b1f33,
      distortionScale: isBioluminescent ? 2.4 : 2.1,
      fog: true,
    });
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, BEACH_WATER_Y, -195);

    const bioUniforms = {
      uBioTime: { value: 0 },
      uScreenTint: { value: new THREE.Color('#00f5d4') },
      uScreenLum: { value: 0.15 },
    };

    if (isBioluminescent) {
      water.material.onBeforeCompile = (shader) => {
        shader.uniforms.uBioTime = bioUniforms.uBioTime;
        shader.uniforms.uScreenTint = bioUniforms.uScreenTint;
        shader.uniforms.uScreenLum = bioUniforms.uScreenLum;

        shader.fragmentShader =
          `uniform float uBioTime;\nuniform vec3 uScreenTint;\nuniform float uScreenLum;\n` +
          shader.fragmentShader;

        shader.fragmentShader = shader.fragmentShader.replace(
          'vec3 outgoingLight = albedo;',
          `
          float crest = smoothstep(0.032, 0.16, 1.0 - max(0.0, surfaceNormal.y));
          float shimmer = 0.55 + 0.45 * sin(worldPosition.x * 0.48 + uBioTime * 1.65) * cos(worldPosition.z * 0.42 - uBioTime * 1.25);
          float shoreBand = exp(-max(0.0, (-12.5 - worldPosition.z)) * 0.042);
          float lagoonFade = exp(-length(worldPosition.xz - vec2(0.0, -34.0)) * 0.011);
          float bioMask = clamp(crest * shimmer * (0.45 + shoreBand * 0.95) * lagoonFade, 0.0, 1.0);
          vec3 bioCyan = vec3(0.0, 0.96, 0.83);
          vec3 bioBlue = vec3(0.0, 0.73, 0.98);
          vec3 bioGlow = mix(bioBlue, bioCyan, crest) * bioMask * 1.85;
          float scrWash = exp(-length(worldPosition.xz - vec2(0.0, -24.0)) * 0.045) * uScreenLum;
          vec3 outgoingLight = albedo + bioGlow + uScreenTint * scrWash * 0.16;
          `,
        );
      };
      water.material.needsUpdate = true;
    }

    let sky: Sky | null = null;
    let nightMat: THREE.ShaderMaterial | null = null;

    if (!isBioluminescent) {
      sky = new Sky();
      sky.scale.setScalar(1800);
      const skyUniforms = sky.material.uniforms;
      skyUniforms['turbidity'].value = 10;
      skyUniforms['rayleigh'].value = 2.0;
      skyUniforms['mieCoefficient'].value = 0.005;
      skyUniforms['mieDirectionalG'].value = 0.8;
      skyUniforms['sunPosition'].value.copy(sunVec);
    } else {
      nightMat = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        vertexShader: `
          varying vec3 vWorldPos;
          void main() {
            vWorldPos = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec3 vWorldPos;
          void main() {
            vec3 dir = normalize(vWorldPos);
            float h = clamp(dir.y, 0.0, 1.0);
            vec3 horizonCol = vec3(0.028, 0.086, 0.22);
            vec3 midCol = vec3(0.015, 0.042, 0.135);
            vec3 zenithCol = vec3(0.006, 0.012, 0.055);
            vec3 col = mix(horizonCol, midCol, smoothstep(0.0, 0.28, h));
            col = mix(col, zenithCol, smoothstep(0.24, 0.88, h));
            // Subtle nocturnal lagoon mist band near horizon
            float horizonBand = exp(-abs(dir.y) * 14.0);
            col += vec3(0.0, 0.06, 0.09) * horizonBand;
            gl_FragColor = vec4(col, 1.0);
          }
        `,
      });
    }

    return {
      sunsetSkyObj: sky,
      midnightSkyMat: nightMat,
      waterObj: water,
      waterNormalsTex: waterNormals,
      bioWaterUniforms: bioUniforms,
    };
  }, [isBioluminescent, isSoftwareGl]);

  useEffect(() => {
    return () => {
      if (sunsetSkyObj) {
        sunsetSkyObj.geometry.dispose();
        (sunsetSkyObj.material as THREE.Material).dispose();
      }
      midnightSkyMat?.dispose();
      waterObj.geometry.dispose();
      (waterObj.material as THREE.Material).dispose();
      waterNormalsTex.dispose();
    };
  }, [sunsetSkyObj, midnightSkyMat, waterObj, waterNormalsTex]);

  // 2. Stars Canopy: 340 sunset twilight stars OR 3,200 twinkling custom-shader stars for Bioluminescent Cove
  const { sunsetStarGeo, bioStarGeo, bioStarMat } = useMemo(() => {
    if (!isBioluminescent) {
      const count = 340;
      const positions = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const u = Math.sin(i * 12.9898 + 1.2) * 43758.5453;
        const v = Math.sin(i * 78.233 + 4.7) * 43758.5453;
        const fracU = u - Math.floor(u);
        const fracV = v - Math.floor(v);
        const az = fracU * Math.PI * 2;
        const el = THREE.MathUtils.lerp(0.18, 1.38, fracV);
        const r = 720;
        positions[i * 3] = Math.cos(az) * Math.cos(el) * r;
        positions[i * 3 + 1] = Math.sin(el) * r;
        positions[i * 3 + 2] = Math.sin(az) * Math.cos(el) * r;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      return { sunsetStarGeo: g, bioStarGeo: null, bioStarMat: null };
    }

    const count = 3200;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);

    const starPalette = [
      new THREE.Color('#eef6ff'),
      new THREE.Color('#bae6fd'),
      new THREE.Color('#c7d2fe'),
      new THREE.Color('#a5f3fc'),
    ];

    for (let i = 0; i < count; i++) {
      const h1 = Math.sin(i * 12.9898 + 1.7) * 43758.5453;
      const h2 = Math.sin(i * 78.233 + 3.9) * 43758.5453;
      const h3 = Math.sin(i * 39.425 + 8.1) * 43758.5453;
      const u1 = h1 - Math.floor(h1);
      const u2 = h2 - Math.floor(h2);
      const u3 = h3 - Math.floor(h3);

      const az = u1 * Math.PI * 2;
      const el = THREE.MathUtils.lerp(0.04, 1.52, Math.pow(u2, 0.85));
      const r = 860;
      positions[i * 3] = Math.cos(az) * Math.cos(el) * r;
      positions[i * 3 + 1] = Math.sin(el) * r;
      positions[i * 3 + 2] = Math.sin(az) * Math.cos(el) * r;

      const c = starPalette[i % starPalette.length];
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
      sizes[i] = 1.6 + Math.pow(u3, 2.2) * 4.4;
      phases[i] = u3 * Math.PI * 20;
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    g.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
      },
      vertexShader: `
        attribute float aSize;
        attribute float aPhase;
        attribute vec3 aColor;
        uniform float uTime;
        varying vec3 vColor;
        varying float vTwinkle;
        void main() {
          vColor = aColor;
          vTwinkle = 0.45 + 0.55 * sin(uTime * 1.9 + aPhase);
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * (0.75 + 0.35 * vTwinkle) * (320.0 / max(1.0, -mvPos.z));
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vTwinkle;
        void main() {
          float d = distance(gl_PointCoord, vec2(0.5)) * 2.0;
          if (d > 1.0) discard;
          float glow = pow(1.0 - d, 2.2);
          gl_FragColor = vec4(vColor * (0.85 + 0.55 * vTwinkle), glow);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    });

    return { sunsetStarGeo: null, bioStarGeo: g, bioStarMat: mat };
  }, [isBioluminescent]);

  useEffect(() => {
    return () => {
      sunsetStarGeo?.dispose();
      bioStarGeo?.dispose();
      bioStarMat?.dispose();
    };
  }, [sunsetStarGeo, bioStarGeo, bioStarMat]);

  // 3. Sand Terrain Geometry + Procedural Fine-Grain Textures + Slate + Pit Retaining Walls
  const sandTextures = useMemo(() => createSandTextures(256), []);
  const slateTextures = useMemo(
    () => (isBioluminescent ? createSlateStoneTextures(256) : null),
    [isBioluminescent],
  );
  const sandGeo = useMemo(() => createSandGeometry(variant), [variant]);
  const shoreFoamGeo = useMemo(() => createShoreFoamGeometry(), []);
  const palmFrondGeo = useMemo(() => createPalmFrondGeometry(), []);
  const glowSpriteTex = useMemo(() => createGlowParticleTexture(), []);

  const pitSlateGeos = useMemo(
    () => (isBioluminescent ? buildPitSlateStructures() : null),
    [isBioluminescent],
  );
  const curvedBackArcGeo = useMemo(
    () =>
      isBioluminescent
        ? buildCurvedBackingArc(screenWidth, screenHeight, screenCurvature)
        : null,
    [isBioluminescent, screenWidth, screenHeight, screenCurvature],
  );
  const palmWrapGeos = useMemo(
    () => (isBioluminescent ? PALM_SPECS.map((p) => createHelicalPalmWrapGeometry(p)) : []),
    [isBioluminescent],
  );

  useEffect(() => {
    return () => {
      sandTextures.dispose();
      slateTextures?.dispose();
      sandGeo.dispose();
      shoreFoamGeo.dispose();
      palmFrondGeo.dispose();
      glowSpriteTex.dispose();
      pitSlateGeos?.wallGeo.dispose();
      pitSlateGeos?.copingGeo.dispose();
      pitSlateGeos?.underGlowGeo.dispose();
      curvedBackArcGeo?.dispose();
      palmWrapGeos.forEach((g) => g.dispose());
    };
  }, [
    sandTextures,
    slateTextures,
    sandGeo,
    shoreFoamGeo,
    palmFrondGeo,
    glowSpriteTex,
    pitSlateGeos,
    curvedBackArcGeo,
    palmWrapGeos,
  ]);

  // 4. Fairy light catenary cables + bulb positions (Sunset Cove only)
  const { fairyCableGeos, fairyBulbPositions } = useMemo(() => {
    if (isBioluminescent) {
      return { fairyCableGeos: [] as THREE.TubeGeometry[], fairyBulbPositions: [] as [number, number, number][] };
    }
    const cables: THREE.TubeGeometry[] = [];
    const bulbs: [number, number, number][] = [];

    FAIRY_SPANS.forEach(([i0, i1]) => {
      const [x0, z0] = FAIRY_POLES[i0];
      const [x1, z1] = FAIRY_POLES[i1];
      const y0 = beachHeightAt(x0, z0, 'sunset') + 3.45;
      const y1 = beachHeightAt(x1, z1, 'sunset') + 3.45;
      const pts: THREE.Vector3[] = [];
      const steps = 14;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const px = THREE.MathUtils.lerp(x0, x1, t);
        const pz = THREE.MathUtils.lerp(z0, z1, t);
        const sag = Math.sin(t * Math.PI) * 0.58;
        const py = THREE.MathUtils.lerp(y0, y1, t) - sag;
        pts.push(new THREE.Vector3(px, py, pz));
        if (s > 0 && s < steps && s % 2 === 1) {
          bulbs.push([px, py - 0.045, pz]);
        }
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      cables.push(new THREE.TubeGeometry(curve, 18, 0.015, 6, false));
    });

    return { fairyCableGeos: cables, fairyBulbPositions: bulbs };
  }, [isBioluminescent]);

  useEffect(() => {
    return () => {
      fairyCableGeos.forEach((g) => g.dispose());
    };
  }, [fairyCableGeos]);

  // 5. Campfire rising ember particle buffer (Sunset Cove only)
  const emberParticleState = useMemo(() => {
    const count = 48;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const phases = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const angle = (i * 2.39996) % (Math.PI * 2);
      const rad = ((i % 7) / 7) * 0.34;
      positions[i * 3] = Math.cos(angle) * rad;
      positions[i * 3 + 1] = 0.08 + ((i * 0.13) % 1.45);
      positions[i * 3 + 2] = Math.sin(angle) * rad;
      velocities[i * 3] = Math.cos(angle) * 0.08;
      velocities[i * 3 + 1] = 0.48 + (i % 5) * 0.11;
      velocities[i * 3 + 2] = Math.sin(angle) * 0.08;
      phases[i] = i * 0.41;
    }

    const geo = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(positions, 3);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', posAttr);
    return { count, positions, velocities, phases, geo, posAttr };
  }, []);

  useEffect(() => () => emberParticleState.geo.dispose(), [emberParticleState]);

  // 6. Shared PBR Materials
  const materials = useMemo(() => {
    const sandMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        map: sandTextures.map,
        normalMap: sandTextures.normalMap,
        normalScale: new THREE.Vector2(0.85, 0.85),
        roughnessMap: sandTextures.roughnessMap,
        roughness: 0.9,
        metalness: 0.0,
        vertexColors: true,
      }),
      screenBounceUniforms,
    );

    const timberMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#5a3d28',
        roughness: 0.86,
        metalness: 0.04,
      }),
      screenBounceUniforms,
    );

    const driftwoodMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#765840',
        roughness: 0.88,
        metalness: 0.03,
      }),
      screenBounceUniforms,
    );

    const blackTrussMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: isBioluminescent ? '#12161f' : '#191c22',
        roughness: isBioluminescent ? 0.34 : 0.44,
        metalness: isBioluminescent ? 0.78 : 0.68,
      }),
      screenBounceUniforms,
    );

    const carbonTrussMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#10141c',
        roughness: 0.3,
        metalness: 0.55,
      }),
      screenBounceUniforms,
    );

    const tensionCableMat = new THREE.MeshStandardMaterial({
      color: '#64748b',
      roughness: 0.25,
      metalness: 0.92,
    });

    const palmTrunkMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: isBioluminescent ? '#382c26' : '#5c422c',
        roughness: 0.9,
        metalness: 0.02,
      }),
      screenBounceUniforms,
    );

    const palmFrondMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: isBioluminescent ? '#15322c' : '#254d2b',
        roughness: 0.78,
        metalness: 0.02,
        side: THREE.DoubleSide,
      }),
      screenBounceUniforms,
    );

    const stoneMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#4c4b47',
        roughness: 0.92,
        metalness: 0.04,
      }),
      screenBounceUniforms,
    );

    const slateMat = slateTextures
      ? applyScreenBounceToMaterial(
          new THREE.MeshStandardMaterial({
            map: slateTextures.map,
            normalMap: slateTextures.normalMap,
            normalScale: new THREE.Vector2(0.75, 0.75),
            color: '#6e7688',
            roughness: 0.86,
            metalness: 0.06,
            side: THREE.DoubleSide,
          }),
          screenBounceUniforms,
        )
      : null;

    const charredLogMat = new THREE.MeshStandardMaterial({
      color: '#2a1c14',
      emissive: '#7a2204',
      emissiveIntensity: 0.08,
      roughness: 0.95,
    });

    const fairyBulbMat = new THREE.MeshStandardMaterial({
      color: '#fff1d0',
      emissive: '#ff9933',
      emissiveIntensity: 2.2,
      toneMapped: false,
      roughness: 0.25,
    });

    const neonCyanMat = new THREE.MeshStandardMaterial({
      color: '#072a36',
      emissive: '#00bbf9',
      emissiveIntensity: 2.8,
      toneMapped: false,
      roughness: 0.22,
    });

    const neonPinkMat = new THREE.MeshStandardMaterial({
      color: '#340b24',
      emissive: '#f15bb5',
      emissiveIntensity: 2.7,
      toneMapped: false,
      roughness: 0.22,
    });

    const bollardGlassMat = new THREE.MeshStandardMaterial({
      color: '#0b2f3c',
      emissive: '#00f5d4',
      emissiveIntensity: 2.65,
      toneMapped: false,
      roughness: 0.35,
    });

    const pitEdgeGlowMat = new THREE.MeshStandardMaterial({
      color: '#072a36',
      emissive: '#00bbf9',
      emissiveIntensity: 1.8,
      toneMapped: false,
      roughness: 0.25,
      side: THREE.DoubleSide,
    });

    const screenTrimCyanMat = new THREE.MeshStandardMaterial({
      color: '#082c32',
      emissive: '#00f5d4',
      emissiveIntensity: 1.4,
      toneMapped: false,
      roughness: 0.25,
    });

    return {
      sandMat,
      timberMat,
      driftwoodMat,
      blackTrussMat,
      carbonTrussMat,
      tensionCableMat,
      palmTrunkMat,
      palmFrondMat,
      stoneMat,
      slateMat,
      charredLogMat,
      fairyBulbMat,
      neonCyanMat,
      neonPinkMat,
      bollardGlassMat,
      pitEdgeGlowMat,
      screenTrimCyanMat,
    };
  }, [sandTextures, slateTextures, screenBounceUniforms, isBioluminescent]);

  useEffect(() => {
    return () => {
      Object.values(materials).forEach((m) => m?.dispose());
    };
  }, [materials]);

  // Helper colors for live ocean & projector sync
  const baseSunColor = useMemo(
    () => new THREE.Color(isBioluminescent ? '#9ad8ff' : '#ff8c42'),
    [isBioluminescent],
  );
  const sunTintColor = useMemo(() => new THREE.Color(), []);
  const screenTintColor = useMemo(() => new THREE.Color('#7ca8ff'), []);

  // Animate Ocean Water, Bio Glow, Stars, House Light Fades, Campfire & Live Video Lens Color
  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.1);
    const t = clock.getElapsedTime();

    const waterUniforms = waterObj.material.uniforms;
    if (waterUniforms['time']) {
      waterUniforms['time'].value += dt * (isBioluminescent ? 0.36 : 0.42);
    }

    const bounce = screenBounceRef?.current;
    if (waterUniforms['sunColor'] && bounce) {
      sunTintColor.copy(baseSunColor);
      screenTintColor.setRGB(bounce.r, bounce.g, bounce.b);
      sunTintColor.lerp(screenTintColor, isBioluminescent ? 0.18 : 0.28);
      waterUniforms['sunColor'].value.copy(sunTintColor);
    }

    if (isBioluminescent) {
      bioWaterUniforms.uBioTime.value = t;
      if (bounce) {
        bioWaterUniforms.uScreenTint.value.setRGB(bounce.r, bounce.g, bounce.b);
        bioWaterUniforms.uScreenLum.value = bounce.luminance;
      }
      if (bioStarMat) {
        bioStarMat.uniforms.uTime.value = t;
      }
      if (bioShoreGlowMatRef.current) {
        const pulse = 0.65 + 0.35 * Math.sin(t * 1.35);
        bioShoreGlowMatRef.current.emissiveIntensity =
          (0.65 + lightFactor * 1.45) * pulse;
      }
    }

    if (foamMatRef.current) {
      foamMatRef.current.opacity =
        (isBioluminescent ? 0.26 : 0.22) + Math.sin(t * 1.1) * 0.08;
    }

    // Gentle palm crown breeze sway
    palmCrownRefs.current.forEach((crown, idx) => {
      if (!crown) return;
      const spec = PALM_SPECS[idx];
      if (!spec) return;
      crown.rotation.z = Math.sin(t * 0.85 + spec.phase) * 0.045;
      crown.rotation.x = Math.cos(t * 0.7 + spec.phase) * 0.032;
    });

    // Live Video-Synced Projector Lens Emissives
    const lensR = bounce ? bounce.r : 0.65;
    const lensG = bounce ? bounce.g : 0.82;
    const lensB = bounce ? bounce.b : 1.0;
    const lensGlow = bounce ? 0.04 + bounce.luminance * 1.85 : 0.08;

    if (sunsetLensMatRef.current) {
      sunsetLensMatRef.current.color.setRGB(lensR, lensG, lensB);
      sunsetLensMatRef.current.emissive.setRGB(lensR, lensG, lensB);
      sunsetLensMatRef.current.emissiveIntensity = lensGlow;
    }
    if (bioLensLeftMatRef.current) {
      bioLensLeftMatRef.current.color.setRGB(lensR, lensG, lensB);
      bioLensLeftMatRef.current.emissive.setRGB(lensR, lensG, lensB);
      bioLensLeftMatRef.current.emissiveIntensity = lensGlow;
    }
    if (bioLensRightMatRef.current) {
      bioLensRightMatRef.current.color.setRGB(lensR, lensG, lensB);
      bioLensRightMatRef.current.emissive.setRGB(lensR, lensG, lensB);
      bioLensRightMatRef.current.emissiveIntensity = lensGlow;
    }

    if (isBioluminescent) {
      // Smoothly fade OFF decorative palm neons, bollards, pit lip & screen trim when show starts
      materials.neonCyanMat.emissiveIntensity = lightFactor * 2.85;
      materials.neonPinkMat.emissiveIntensity = lightFactor * 2.75;
      materials.bollardGlassMat.emissiveIntensity = lightFactor * 2.7;
      materials.pitEdgeGlowMat.emissiveIntensity = lightFactor * 1.75;
      materials.screenTrimCyanMat.emissiveIntensity = 0.04 + lightFactor * 1.45;
      return;
    }

    // Sunset Cove: smoothly fade OFF all decorative environment lighting when show starts (lightFactor -> 0)
    materials.fairyBulbMat.emissiveIntensity = lightFactor * 2.3;
    materials.charredLogMat.emissiveIntensity = 0.04 + lightFactor * 0.25;
    fairyPointLightRefs.current.forEach((pl) => {
      if (pl) pl.intensity = lightFactor * 1.55;
    });

    TORCH_SPECS.forEach((spec, idx) => {
      const flicker =
        0.86 + Math.sin(t * 9.5 + spec.phase) * 0.09 + Math.cos(t * 15.2 + spec.phase) * 0.06;
      const flame = torchFlameRefs.current[idx];
      if (flame) {
        flame.visible = lightFactor > 0.015;
        flame.scale.set(0.95 + (flicker - 1) * 0.4, flicker * Math.max(0.05, lightFactor), 0.95 + (flicker - 1) * 0.4);
      }
      const flameMat = torchFlameMatRefs.current[idx];
      if (flameMat) {
        flameMat.emissiveIntensity = lightFactor * 2.6 * flicker;
      }
      const light = torchLightRefs.current[idx];
      if (light) {
        light.intensity = lightFactor * 2.0 * flicker;
      }
    });

    // Campfire flames, embers & warm PointLight fade cleanly OFF during movie playback
    const fireFlicker =
      0.88 + Math.sin(t * 11.4) * 0.08 + Math.sin(t * 19.7 + 1.1) * 0.05;
    if (campfireLightRef.current) {
      campfireLightRef.current.intensity = lightFactor * 3.0 * fireFlicker;
    }
    campfireFlameRefs.current.forEach((mesh, idx) => {
      if (!mesh) return;
      mesh.visible = lightFactor > 0.015;
      const phase = idx * 1.4;
      const f = 0.85 + Math.sin(t * 12.2 + phase) * 0.16;
      mesh.scale.set(0.95, f * Math.max(0.05, lightFactor), 0.95);
    });
    campfireFlameMatRefs.current.forEach((m) => {
      if (m) m.emissiveIntensity = lightFactor * 2.8 * fireFlicker;
    });
    if (emberMatRef.current) {
      emberMatRef.current.opacity = lightFactor * 0.9;
    }

    const { count, positions, velocities, phases, posAttr } = emberParticleState;
    for (let i = 0; i < count; i++) {
      const ix = i * 3;
      const iy = ix + 1;
      const iz = ix + 2;
      positions[iy] += velocities[iy] * dt;
      positions[ix] += (velocities[ix] + Math.sin(t * 2.4 + phases[i]) * 0.14) * dt;
      positions[iz] += (velocities[iz] + Math.cos(t * 2.1 + phases[i]) * 0.14) * dt;

      if (positions[iy] > 1.75) {
        const ang = (i * 2.39996 + t * 0.7) % (Math.PI * 2);
        const rad = ((i % 7) / 7) * 0.24;
        positions[ix] = Math.cos(ang) * rad;
        positions[iy] = 0.06;
        positions[iz] = Math.sin(ang) * rad;
      }
    }
    posAttr.needsUpdate = true;
  });

  // Ground coordinates for screen frame & projector
  const scrLeftX = -screenWidth / 2 - (isBioluminescent ? 0.88 : 0.36);
  const scrRightX = screenWidth / 2 + (isBioluminescent ? 0.88 : 0.36);
  const scrZ = screenPosition[2];
  const scrBotY = screenPosition[1] - screenHeight / 2;
  const scrTopY = screenPosition[1] + screenHeight / 2;
  const leftPostGroundY = beachHeightAt(scrLeftX, scrZ, variant);
  const rightPostGroundY = beachHeightAt(scrRightX, scrZ, variant);
  const projGroundY = beachHeightAt(
    isBioluminescent ? BEACH_BIO_PROJECTOR_POS[0] : BEACH_PROJECTOR_POS[0],
    isBioluminescent ? BEACH_BIO_PROJECTOR_POS[2] : BEACH_PROJECTOR_POS[2],
    variant,
  );

  const campfireRocks = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const ang = (i / 12) * Math.PI * 2;
      const r = 0.68 + Math.sin(i * 2.7) * 0.04;
      const sx = 0.2 + (i % 3) * 0.04;
      const sy = 0.14 + (i % 2) * 0.04;
      const sz = 0.18 + ((i + 1) % 3) * 0.03;
      return {
        x: Math.cos(ang) * r,
        y: sy * 0.42,
        z: Math.sin(ang) * r,
        rotY: ang + 0.3,
        scale: [sx, sy, sz] as [number, number, number],
      };
    });
  }, []);

  const bulbRef = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    if (!bulbRef.current || fairyBulbPositions.length === 0) return;
    const dummy = new THREE.Object3D();
    fairyBulbPositions.forEach(([bx, by, bz], idx) => {
      dummy.position.set(bx, by, bz);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      bulbRef.current!.setMatrixAt(idx, dummy.matrix);
    });
    bulbRef.current.instanceMatrix.needsUpdate = true;
    bulbRef.current.computeBoundingSphere();
  }, [fairyBulbPositions]);

  // Tension cable transforms for Bioluminescent Cove curved frameless tension screen
  const bioCablePlacements = useMemo(() => {
    if (!isBioluminescent) return [];
    const corners: [number, number, number, number][] = [
      [-screenWidth / 2, scrTopY, -screenWidth / 2 - 0.72, scrTopY + 0.45],
      [screenWidth / 2, scrTopY, screenWidth / 2 + 0.72, scrTopY + 0.45],
      [-screenWidth / 2, scrBotY, -screenWidth / 2 - 0.72, scrBotY - 0.35],
      [screenWidth / 2, scrBotY, screenWidth / 2 + 0.72, scrBotY - 0.35],
    ];
    return corners.map(([x0, y0, x1, y1]) => {
      const dx = x1 - x0;
      const dy = y1 - y0;
      const len = Math.hypot(dx, dy);
      const ang = Math.atan2(dy, dx);
      return {
        x: (x0 + x1) * 0.5,
        y: (y0 + y1) * 0.5,
        len,
        rotZ: ang,
      };
    });
  }, [isBioluminescent, screenWidth, scrTopY, scrBotY]);

  return (
    <group>
      {/* 1. Sky Dome + Star Canopy (+ Moon Orb on Bioluminescent Cove) */}
      {!isBioluminescent && sunsetSkyObj && <primitive object={sunsetSkyObj} />}
      {!isBioluminescent && sunsetStarGeo && (
        <points geometry={sunsetStarGeo}>
          <pointsMaterial
            color="#dce8ff"
            size={2.1}
            sizeAttenuation
            transparent
            opacity={0.78}
            depthWrite={false}
          />
        </points>
      )}

      {isBioluminescent && midnightSkyMat && (
        <>
          <mesh material={midnightSkyMat} frustumCulled={false}>
            <sphereGeometry args={[1150, 32, 20]} />
          </mesh>
          {bioStarGeo && bioStarMat && (
            <points geometry={bioStarGeo} material={bioStarMat} frustumCulled={false} />
          )}
          {/* Silver Moon Orb Over Ocean Horizon */}
          <group position={[-46, 82, -260]}>
            <mesh>
              <sphereGeometry args={[8.5, 24, 24]} />
              <meshStandardMaterial
                color="#e2efff"
                emissive="#cde2ff"
                emissiveIntensity={1.65}
                roughness={0.4}
                fog={false}
                toneMapped={false}
              />
            </mesh>
          </group>
        </>
      )}

      {/* 2. Animated Ocean Surf Water Plane */}
      <primitive object={waterObj} />

      {/* Shoreline Foam & Bioluminescent Cyan Shoreline Glow */}
      <mesh geometry={shoreFoamGeo}>
        <meshBasicMaterial
          ref={foamMatRef}
          color={isBioluminescent ? '#22f6dc' : '#d8e7f4'}
          transparent
          opacity={0.24}
          depthWrite={false}
        />
      </mesh>
      {isBioluminescent && (
        <mesh geometry={shoreFoamGeo} position={[0, 0.015, 0.12]}>
          <meshStandardMaterial
            ref={bioShoreGlowMatRef}
            color="#00353a"
            emissive="#00f5d4"
            emissiveIntensity={1.8}
            transparent
            opacity={0.48}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      )}

      {/* 3. Sculpted Fine-Grain Coastal Sand Dunes & Amphitheater Bowl */}
      <mesh geometry={sandGeo} material={materials.sandMat} receiveShadow />

      {/* Bioluminescent Cove: Dark Slate Pit Retaining Walls, Coping Rims & Central Stepping Stones */}
      {isBioluminescent && pitSlateGeos && materials.slateMat && (
        <group>
          <mesh
            geometry={pitSlateGeos.wallGeo}
            material={materials.slateMat}
            receiveShadow
            castShadow
          />
          <mesh
            geometry={pitSlateGeos.copingGeo}
            material={materials.slateMat}
            receiveShadow
            castShadow
          />
          <mesh geometry={pitSlateGeos.underGlowGeo} material={materials.pitEdgeGlowMat} />

          {/* Dark Slate Stepping Stones Along Central Walkway */}
          {materials.slateMat &&
            STEPPING_STONES.map((st, si) => {
              const sy = beachHeightAt(st.x, st.z, 'bioluminescent') + 0.022;
              return (
                <mesh
                  key={`step-stone-${si}`}
                  position={[st.x, sy, st.z]}
                  rotation={[0, st.rotY, 0]}
                  material={materials.slateMat!}
                  receiveShadow
                  castShadow
                >
                  <cylinderGeometry args={[st.w * 0.5, st.w * 0.54, 0.05, 7]} />
                </mesh>
              );
            })}
        </group>
      )}

      {/* 4A. Sunset Cove: Timber + Black Steel Screen Truss Structure */}
      {!isBioluminescent && (
        <group>
          {[
            { x: scrLeftX, groundY: leftPostGroundY },
            { x: scrRightX, groundY: rightPostGroundY },
          ].map((post, idx) => {
            const postTopY = scrTopY + 0.45;
            const postBotY = post.groundY - 0.35;
            const postH = postTopY - postBotY;
            const postMidY = (postTopY + postBotY) / 2;
            const braceLen = Math.hypot(postTopY - 1.5 - postBotY, 1.8);
            const braceAngle = Math.atan2(1.8, postTopY - 1.5 - postBotY);
            return (
              <group key={`screen-post-${idx}`} position={[post.x, 0, scrZ]}>
                <mesh
                  position={[0, postMidY, -0.14]}
                  material={materials.timberMat}
                  castShadow
                  receiveShadow
                >
                  <boxGeometry args={[0.38, postH, 0.38]} />
                </mesh>
                <mesh position={[0, postBotY + 0.45, -0.14]} material={materials.blackTrussMat}>
                  <boxGeometry args={[0.48, 0.42, 0.48]} />
                </mesh>
                <mesh
                  position={[0, (postBotY + postTopY - 1.5) * 0.5, -1.04]}
                  rotation={[braceAngle, 0, 0]}
                  material={materials.blackTrussMat}
                  castShadow
                >
                  <boxGeometry args={[0.2, braceLen, 0.2]} />
                </mesh>
              </group>
            );
          })}

          <mesh position={[0, scrTopY + 0.28, scrZ - 0.14]} material={materials.blackTrussMat} castShadow>
            <boxGeometry args={[screenWidth + 1.15, 0.34, 0.34]} />
          </mesh>
          <mesh position={[0, scrBotY - 0.24, scrZ - 0.14]} material={materials.timberMat} castShadow receiveShadow>
            <boxGeometry args={[screenWidth + 1.05, 0.36, 0.36]} />
          </mesh>
          <mesh position={[0, screenPosition[1], scrZ - 0.18]} material={materials.blackTrussMat}>
            <boxGeometry args={[screenWidth + 0.32, screenHeight + 0.32, 0.14]} />
          </mesh>
        </group>
      )}

      {/* 4B. Bioluminescent Cove: Carbon-Fiber 4-Chord Box Truss Towers + Tension Cables */}
      {isBioluminescent && (
        <group>
          {[
            { x: scrLeftX, groundY: leftPostGroundY },
            { x: scrRightX, groundY: rightPostGroundY },
          ].map((tower, idx) => {
            const topY = scrTopY + 0.92;
            const botY = tower.groundY - 0.32;
            const towerH = topY - botY;
            const midY = (topY + botY) * 0.5;
            return (
              <group key={`bio-truss-tower-${idx}`} position={[tower.x, 0, scrZ + 0.18]}>
                {[
                  [-0.22, -0.22],
                  [0.22, -0.22],
                  [-0.22, 0.22],
                  [0.22, 0.22],
                ].map(([cx, cz], ci) => (
                  <mesh key={`chord-${ci}`} position={[cx, midY, cz]} material={materials.carbonTrussMat} castShadow>
                    <cylinderGeometry args={[0.036, 0.036, towerH, 8]} />
                  </mesh>
                ))}
                {Array.from({ length: 10 }, (_, bi) => {
                  const by = THREE.MathUtils.lerp(botY + 0.5, topY - 0.35, bi / 9);
                  return (
                    <mesh key={`collar-${bi}`} position={[0, by, 0]} material={materials.blackTrussMat}>
                      <boxGeometry args={[0.5, 0.048, 0.5]} />
                    </mesh>
                  );
                })}
                {/* Heavy Ground Anchor Plinth */}
                <mesh position={[0, tower.groundY + 0.08, 0]} material={materials.slateMat ?? materials.stoneMat} receiveShadow>
                  <boxGeometry args={[0.92, 0.24, 0.92]} />
                </mesh>
              </group>
            );
          })}

          {/* Top Horizontal Carbon-Fiber Bridge Box Truss */}
          <group position={[0, scrTopY + 0.72, scrZ + 0.18]}>
            {[
              [-0.2, -0.2],
              [0.2, -0.2],
              [-0.2, 0.2],
              [0.2, 0.2],
            ].map(([cy, cz], ci) => (
              <mesh key={`top-chord-${ci}`} position={[0, cy, cz]} rotation={[0, 0, Math.PI / 2]} material={materials.carbonTrussMat}>
                <cylinderGeometry args={[0.034, 0.034, screenWidth + 2.2, 8]} />
              </mesh>
            ))}
            {Array.from({ length: 15 }, (_, wi) => {
              const wx = THREE.MathUtils.lerp(-screenWidth / 2 - 0.85, screenWidth / 2 + 0.85, wi / 14);
              return (
                <mesh key={`top-brace-${wi}`} position={[wx, 0, 0]} material={materials.blackTrussMat}>
                  <boxGeometry args={[0.045, 0.44, 0.44]} />
                </mesh>
              );
            })}
          </group>

          {/* Lower Slim Support Crossbar + Subtle Edge Trim */}
          <mesh position={[0, scrBotY - 0.18, scrZ + 0.14]} material={materials.carbonTrussMat}>
            <boxGeometry args={[screenWidth + 1.85, 0.14, 0.16]} />
          </mesh>
          <mesh position={[0, scrBotY - 0.09, scrZ + 0.22]} material={materials.screenTrimCyanMat}>
            <boxGeometry args={[screenWidth + 0.12, 0.025, 0.025]} />
          </mesh>

          {/* Steel Corner Tension Cables & Turnbuckles */}
          {bioCablePlacements.map((c, ci) => (
            <group key={`tension-cable-${ci}`} position={[c.x, c.y, scrZ + 0.18]} rotation={[0, 0, c.rotZ]}>
              <mesh material={materials.tensionCableMat}>
                <boxGeometry args={[c.len, 0.018, 0.018]} />
              </mesh>
              <mesh material={materials.blackTrussMat}>
                <cylinderGeometry args={[0.03, 0.03, 0.22, 8]} />
              </mesh>
            </group>
          ))}

          {/* Curved Matte Acoustic Backing Arc Behind Screen Canvas */}
          {curvedBackArcGeo && (
            <mesh
              position={[0, screenPosition[1], scrZ]}
              geometry={curvedBackArcGeo}
              material={materials.blackTrussMat}
            />
          )}
        </group>
      )}

      {/* 5A. Sunset Cove: Rear Wooden Crate & Tripod Cinema Projector Rig */}
      {!isBioluminescent && (
        <group position={[BEACH_PROJECTOR_POS[0], projGroundY, BEACH_PROJECTOR_POS[2]]}>
          <mesh position={[0, 0.26, 0]} material={materials.driftwoodMat} castShadow receiveShadow>
            <boxGeometry args={[1.18, 0.52, 0.96]} />
          </mesh>
          <mesh position={[-0.12, 0.62, 0.04]} material={materials.timberMat} castShadow receiveShadow>
            <boxGeometry args={[0.88, 0.22, 0.72]} />
          </mesh>
          <mesh position={[0, 0.84, 0]} material={materials.blackTrussMat} castShadow>
            <boxGeometry args={[0.72, 0.22, 0.78]} />
          </mesh>
          <group position={[0, 1.18, 0]} rotation={[0.14, 0, 0]}>
            <mesh material={materials.blackTrussMat} castShadow>
              <boxGeometry args={[0.62, 0.3, 0.82]} />
            </mesh>
            <mesh position={[0, 0.01, -0.46]} rotation={[Math.PI / 2, 0, 0]} material={materials.blackTrussMat}>
              <cylinderGeometry args={[0.11, 0.125, 0.18, 20]} />
            </mesh>
            <mesh position={[0, 0.01, -0.545]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.088, 0.088, 0.02, 20]} />
              <meshStandardMaterial
                ref={sunsetLensMatRef}
                color="#7dd3fc"
                emissive="#bae6fd"
                emissiveIntensity={0.45}
                roughness={0.12}
                metalness={0.35}
                toneMapped={false}
              />
            </mesh>
          </group>
        </group>
      )}

      {/* 5B. Bioluminescent Cove: Elevated Rear Metal Truss Scaffolding & Dual-Lens Laser Projector */}
      {isBioluminescent && (
        <group position={[BEACH_BIO_PROJECTOR_POS[0], projGroundY, BEACH_BIO_PROJECTOR_POS[2]]}>
          {/* 4 Vertical Steel Scaffolding Posts + Footpads */}
          {[
            [-0.75, -0.62],
            [0.75, -0.62],
            [-0.75, 0.62],
            [0.75, 0.62],
          ].map(([px, pz], pi) => (
            <group key={`scaff-post-${pi}`} position={[px, 0, pz]}>
              <mesh position={[0, 0.78, 0]} material={materials.carbonTrussMat} castShadow>
                <cylinderGeometry args={[0.042, 0.042, 1.56, 10]} />
              </mesh>
              <mesh position={[0, 0.03, 0]} material={materials.blackTrussMat}>
                <boxGeometry args={[0.22, 0.06, 0.22]} />
              </mesh>
            </group>
          ))}
          {/* Horizontal Steel Scaffolding Rails & Platform Deck */}
          {[0.48, 1.48].map((ry, ri) => (
            <group key={`scaff-tier-${ri}`} position={[0, ry, 0]}>
              <mesh position={[0, 0, -0.62]} material={materials.blackTrussMat}>
                <boxGeometry args={[1.56, 0.06, 0.06]} />
              </mesh>
              <mesh position={[0, 0, 0.62]} material={materials.blackTrussMat}>
                <boxGeometry args={[1.56, 0.06, 0.06]} />
              </mesh>
              <mesh position={[-0.75, 0, 0]} material={materials.blackTrussMat}>
                <boxGeometry args={[0.06, 0.06, 1.28]} />
              </mesh>
              <mesh position={[0.75, 0, 0]} material={materials.blackTrussMat}>
                <boxGeometry args={[0.06, 0.06, 1.28]} />
              </mesh>
            </group>
          ))}
          <mesh position={[0, 1.52, 0]} material={materials.blackTrussMat} castShadow receiveShadow>
            <boxGeometry args={[1.54, 0.07, 1.28]} />
          </mesh>
          {/* Dual-Lens 4K Laser Projector Head Aimed Slightly Upward Toward Curved Screen */}
          <group position={[0, 1.72, -0.18]} rotation={[0.14, 0, 0]}>
            <mesh material={materials.carbonTrussMat} castShadow>
              <boxGeometry args={[0.96, 0.32, 0.92]} />
            </mesh>
            {[-0.26, 0.26].map((lx, li) => (
              <group key={`bio-lens-${li}`} position={[lx, 0, -0.46]}>
                <mesh rotation={[Math.PI / 2, 0, 0]} material={materials.blackTrussMat}>
                  <cylinderGeometry args={[0.095, 0.11, 0.18, 20]} />
                </mesh>
                <mesh position={[0, 0, -0.09]} rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.078, 0.078, 0.02, 20]} />
                  <meshStandardMaterial
                    ref={li === 0 ? bioLensLeftMatRef : bioLensRightMatRef}
                    color="#7dd3fc"
                    emissive="#00f5d4"
                    emissiveIntensity={0.45}
                    roughness={0.12}
                    metalness={0.35}
                    toneMapped={false}
                  />
                </mesh>
              </group>
            ))}
          </group>
        </group>
      )}

      {/* 6. Perimeter Palm Trees (+ Helical Neon Wraps on Bioluminescent Cove) */}
      {PALM_SPECS.map((palm, idx) => {
        const py = beachHeightAt(palm.x, palm.z, variant) - 0.12;
        const trunkSegs = 7;
        const crownPos: [number, number, number] = [
          palm.leanX * 2.2,
          4.85,
          palm.leanZ * 2.2,
        ];
        return (
          <group
            key={`palm-${idx}`}
            position={[palm.x, py, palm.z]}
            rotation={[0, palm.rotY, 0]}
            scale={palm.scale}
          >
            {Array.from({ length: trunkSegs }, (_, si) => {
              const t0 = si / trunkSegs;
              const t1 = (si + 1) / trunkSegs;
              const tm = (t0 + t1) * 0.5;
              const sx = Math.pow(tm, 1.35) * palm.leanX * 2.2;
              const sz = Math.pow(tm, 1.35) * palm.leanZ * 2.2;
              const sy = tm * 4.9;
              const rBot = THREE.MathUtils.lerp(0.24, 0.12, t0);
              const rTop = THREE.MathUtils.lerp(0.24, 0.12, t1);
              return (
                <mesh
                  key={`seg-${si}`}
                  position={[sx, sy, sz]}
                  rotation={[palm.leanZ * 0.25, 0, -palm.leanX * 0.25]}
                  material={materials.palmTrunkMat}
                  castShadow
                  receiveShadow
                >
                  <cylinderGeometry args={[rTop, rBot, 0.78, 7]} />
                </mesh>
              );
            })}

            {isBioluminescent && palmWrapGeos[idx] && (
              <mesh
                geometry={palmWrapGeos[idx]}
                material={idx % 2 === 0 ? materials.neonCyanMat : materials.neonPinkMat}
              />
            )}

            <group
              ref={(el) => {
                palmCrownRefs.current[idx] = el;
              }}
              position={crownPos}
            >
              {[0, 1, 2].map((ci) => {
                const cAng = (ci / 3) * Math.PI * 2 + 0.4;
                return (
                  <mesh
                    key={`nut-${ci}`}
                    position={[Math.cos(cAng) * 0.18, -0.14, Math.sin(cAng) * 0.18]}
                    material={materials.timberMat}
                  >
                    <sphereGeometry args={[0.12, 8, 8]} />
                  </mesh>
                );
              })}

              {Array.from({ length: 9 }, (_, fi) => {
                const az = (fi / 9) * Math.PI * 2 + (fi % 2) * 0.18;
                const tilt = fi % 3 === 0 ? 0.55 : 0.88;
                return (
                  <mesh
                    key={`frond-${fi}`}
                    rotation={[tilt, az, 0]}
                    geometry={palmFrondGeo}
                    material={materials.palmFrondMat}
                    castShadow
                  />
                );
              })}
            </group>
          </group>
        );
      })}

      {/* 7B. Bioluminescent Cove: Frosted-Glass Walkway Bollards Along Slate Stepping-Stone Aisle */}
      {isBioluminescent &&
        BOLLARD_POSITIONS.map(([bx, bz], bi) => {
          const by = beachHeightAt(bx, bz, 'bioluminescent');
          return (
            <group key={`bio-bollard-${bi}`} position={[bx, by, bz]}>
              {/* Dark Anodized Base Anchor */}
              <mesh position={[0, 0.12, 0]} material={materials.blackTrussMat} castShadow>
                <cylinderGeometry args={[0.068, 0.08, 0.24, 12]} />
              </mesh>
              {/* Frosted Glowing Glass Cylinder */}
              <mesh position={[0, 0.34, 0]} material={materials.bollardGlassMat}>
                <cylinderGeometry args={[0.06, 0.06, 0.22, 12]} />
              </mesh>
              {/* Beveled Dark Cap */}
              <mesh position={[0, 0.47, 0]} material={materials.blackTrussMat}>
                <cylinderGeometry args={[0.072, 0.072, 0.045, 12]} />
              </mesh>
            </group>
          );
        })}

      {/* 7A. Sunset Cove: Warm Perimeter Tiki Torches */}
      {!isBioluminescent &&
        TORCH_SPECS.map((torch, idx) => {
          const ty = beachHeightAt(torch.x, torch.z, 'sunset');
          return (
            <group key={`torch-${idx}`} position={[torch.x, ty, torch.z]}>
              <mesh position={[0, 0.82, 0]} material={materials.driftwoodMat} castShadow>
                <cylinderGeometry args={[0.042, 0.054, 1.75, 8]} />
              </mesh>
              <mesh position={[0, 1.72, 0]} material={materials.timberMat} castShadow>
                <cylinderGeometry args={[0.11, 0.055, 0.26, 10]} />
              </mesh>
              <mesh
                ref={(el) => {
                  torchFlameRefs.current[idx] = el;
                }}
                position={[0, 1.94, 0]}
              >
                <coneGeometry args={[0.085, 0.24, 8]} />
                <meshStandardMaterial
                  ref={(el) => {
                    torchFlameMatRefs.current[idx] = el;
                  }}
                  color="#ffd28a"
                  emissive="#ff8822"
                  emissiveIntensity={2.6}
                  toneMapped={false}
                />
              </mesh>
              {torch.hasLight && (
                <pointLight
                  ref={(el) => {
                    torchLightRefs.current[idx] = el;
                  }}
                  position={[0, 2.05, 0]}
                  color="#ff9933"
                  intensity={1.9}
                  distance={10.5}
                  decay={2}
                />
              )}
            </group>
          );
        })}

      {/* 8A. Sunset Cove: Wooden Poles & Catenary String Fairy Lights */}
      {!isBioluminescent && (
        <>
          {FAIRY_POLES.map(([px, pz], idx) => {
            const py = beachHeightAt(px, pz, 'sunset');
            return (
              <group key={`fairy-pole-${idx}`} position={[px, py, pz]}>
                <mesh position={[0, 1.7, 0]} material={materials.timberMat} castShadow>
                  <cylinderGeometry args={[0.075, 0.095, 3.6, 8]} />
                </mesh>
                <mesh position={[0, 3.45, 0]} material={materials.blackTrussMat}>
                  <boxGeometry args={[0.24, 0.06, 0.06]} />
                </mesh>
              </group>
            );
          })}
          {fairyCableGeos.map((cableGeo, idx) => (
            <mesh key={`fairy-cable-${idx}`} geometry={cableGeo} material={materials.blackTrussMat} />
          ))}
          {fairyBulbPositions.length > 0 && (
            <instancedMesh
              ref={bulbRef}
              args={[undefined, undefined, fairyBulbPositions.length]}
              material={materials.fairyBulbMat}
            >
              <sphereGeometry args={[0.042, 8, 8]} />
            </instancedMesh>
          )}
          <pointLight
            ref={(el) => {
              fairyPointLightRefs.current[0] = el;
            }}
            position={[-11.0, beachHeightAt(-11.0, 0.5, 'sunset') + 3.2, 0.5]}
            color="#ff9933"
            intensity={1.55}
            distance={13}
            decay={2}
          />
          <pointLight
            ref={(el) => {
              fairyPointLightRefs.current[1] = el;
            }}
            position={[11.0, beachHeightAt(11.0, 0.5, 'sunset') + 3.2, 0.5]}
            color="#ff9933"
            intensity={1.55}
            distance={13}
            decay={2}
          />

          {/* 9A. Sunset Cove: Stone-Ringed Campfire Pit & Rising Ember Particles */}
          <group position={BEACH_CAMPFIRE_POS}>
            {campfireRocks.map((rk, idx) => (
              <mesh
                key={`fire-rock-${idx}`}
                position={[rk.x, rk.y, rk.z]}
                rotation={[0.2, rk.rotY, 0.1]}
                scale={rk.scale}
                material={materials.stoneMat}
                castShadow
                receiveShadow
              >
                <dodecahedronGeometry args={[1, 0]} />
              </mesh>
            ))}

            <mesh position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.56, 16]} />
              <meshStandardMaterial
                color="#261008"
                emissive="#ff5511"
                emissiveIntensity={0.14 + lightFactor * 1.45}
              />
            </mesh>

            {[0.25, 1.45, 2.55, 3.85, 5.1].map((ang, li) => (
              <mesh
                key={`fire-log-${li}`}
                position={[Math.cos(ang) * 0.14, 0.12, Math.sin(ang) * 0.14]}
                rotation={[0.38, ang, 0.25]}
                material={materials.charredLogMat}
                castShadow
              >
                <cylinderGeometry args={[0.055, 0.068, 0.76, 8]} />
              </mesh>
            ))}

            {[
              { x: 0, z: 0, r: 0.17, h: 0.56, col: '#ffaa33' },
              { x: -0.1, z: 0.08, r: 0.11, h: 0.42, col: '#ff6611' },
              { x: 0.11, z: -0.07, r: 0.12, h: 0.44, col: '#ff8822' },
            ].map((fl, fi) => (
              <mesh
                key={`fire-flame-${fi}`}
                ref={(el) => {
                  campfireFlameRefs.current[fi] = el;
                }}
                position={[fl.x, fl.h * 0.5 + 0.08, fl.z]}
              >
                <coneGeometry args={[fl.r, fl.h, 8]} />
                <meshStandardMaterial
                  ref={(el) => {
                    campfireFlameMatRefs.current[fi] = el;
                  }}
                  color="#ffe2a8"
                  emissive={fl.col}
                  emissiveIntensity={2.8}
                  toneMapped={false}
                />
              </mesh>
            ))}

            <points geometry={emberParticleState.geo}>
              <pointsMaterial
                ref={emberMatRef}
                map={glowSpriteTex}
                size={0.18}
                sizeAttenuation
                transparent
                opacity={0.9}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                toneMapped={false}
              />
            </points>

            <pointLight
              ref={campfireLightRef}
              position={[0, 0.65, 0]}
              color="#ff7e29"
              intensity={2.6}
              distance={12}
              decay={1.9}
            />
          </group>
        </>
      )}
    </group>
  );
};

function buildOceanSurfBuffer(ctx: AudioContext): AudioBuffer {
  const duration = 6.0;
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * duration);
  const buf = ctx.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);

  let lp1 = 0;
  let lp2 = 0;
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const waveCycle = Math.sin((t / duration) * Math.PI * 2) * 0.5 + 0.5;
    const swell = 0.25 + 0.75 * Math.pow(waveCycle, 1.6);
    const white = Math.random() * 2 - 1;
    const alpha = 0.02 + swell * 0.06;
    lp1 = lp1 + (white - lp1) * alpha;
    lp2 = lp2 + (lp1 - lp2) * (0.04 + swell * 0.08);
    data[i] = lp2 * swell * 0.55;
  }
  return buf;
}

function buildCampfireCrackleBuffer(ctx: AudioContext): AudioBuffer {
  const duration = 4.0;
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * duration);
  const buf = ctx.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);

  let rumble = 0;
  let popEnv = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    rumble = rumble * 0.94 + white * 0.06;
    if (Math.random() < 0.0018) {
      popEnv = 0.45 + Math.random() * 0.55;
    }
    const crack = popEnv * (Math.random() * 2 - 1);
    popEnv *= 0.986;
    data[i] = rumble * 0.25 + crack * 0.42;
  }
  return buf;
}

interface BeachPositionalAudioRigProps {
  audioSettings: AudioSettings;
  showState: ShowState;
  isPaused: boolean;
  hasCampfire?: boolean;
  isBioluminescent?: boolean;
}

export const BeachPositionalAudioRig: React.FC<BeachPositionalAudioRigProps> = ({
  audioSettings,
  showState,
  isPaused,
  hasCampfire = true,
  isBioluminescent = false,
}) => {
  const { camera, scene } = useThree();
  const [engineRunning, setEngineRunning] = React.useState(() => cinemaAudioEngine.isRunning);

  useEffect(() => {
    return cinemaAudioEngine.onStateChange((running) => {
      setEngineRunning(running);
    });
  }, []);

  const nodesRef = useRef<{
    listener: THREE.AudioListener;
    leftPa: THREE.PositionalAudio;
    rightPa: THREE.PositionalAudio;
    oceanSound: THREE.PositionalAudio;
    fireSound: THREE.PositionalAudio | null;
    leftAnchor: THREE.Object3D;
    rightAnchor: THREE.Object3D;
    oceanAnchor: THREE.Object3D;
    fireAnchor: THREE.Object3D | null;
  } | null>(null);

  useEffect(() => {
    const ctx = cinemaAudioEngine.getRawContext();
    const feeds = cinemaAudioEngine.getBeachSpeakerFeeds();
    if (!ctx || !feeds.left || !feeds.right) return;

    const variant: BeachTerrainVariant = isBioluminescent ? 'bioluminescent' : 'sunset';
    THREE.AudioContext.setContext(ctx);
    const listener = new THREE.AudioListener();
    camera.add(listener);

    const spkX = isBioluminescent ? 8.9 : 8.6;
    const spkZ = isBioluminescent ? -10.6 : -10.0;
    const spkYOff = isBioluminescent ? 4.2 : 2.4;

    const leftAnchor = new THREE.Object3D();
    leftAnchor.position.set(-spkX, beachHeightAt(-spkX, spkZ, variant) + spkYOff, spkZ);
    const rightAnchor = new THREE.Object3D();
    rightAnchor.position.set(spkX, beachHeightAt(spkX, spkZ, variant) + spkYOff, spkZ);
    const oceanAnchor = new THREE.Object3D();
    oceanAnchor.position.set(0, BEACH_WATER_Y + 0.4, -15.2);

    scene.add(leftAnchor, rightAnchor, oceanAnchor);

    const leftPa = new THREE.PositionalAudio(listener);
    leftPa.setRefDistance(12);
    leftPa.setRolloffFactor(0.65);
    leftPa.setMaxDistance(80);
    leftPa.setDirectionalCone(140, 260, 0.55);
    leftPa.setNodeSource(feeds.left as unknown as AudioNode);
    leftAnchor.add(leftPa);

    const rightPa = new THREE.PositionalAudio(listener);
    rightPa.setRefDistance(12);
    rightPa.setRolloffFactor(0.65);
    rightPa.setMaxDistance(80);
    rightPa.setDirectionalCone(140, 260, 0.55);
    rightPa.setNodeSource(feeds.right as unknown as AudioNode);
    rightAnchor.add(rightPa);

    const oceanSound = new THREE.PositionalAudio(listener);
    oceanSound.setRefDistance(7);
    oceanSound.setRolloffFactor(0.75);
    oceanSound.setMaxDistance(75);
    oceanSound.setBuffer(buildOceanSurfBuffer(ctx));
    oceanSound.setLoop(true);
    oceanSound.setVolume(0.24);
    oceanAnchor.add(oceanSound);

    let fireSound: THREE.PositionalAudio | null = null;
    let fireAnchor: THREE.Object3D | null = null;
    if (hasCampfire) {
      fireAnchor = new THREE.Object3D();
      fireAnchor.position.set(
        BEACH_CAMPFIRE_POS[0],
        BEACH_CAMPFIRE_POS[1] + 0.45,
        BEACH_CAMPFIRE_POS[2],
      );
      scene.add(fireAnchor);

      fireSound = new THREE.PositionalAudio(listener);
      fireSound.setRefDistance(3.5);
      fireSound.setRolloffFactor(1.15);
      fireSound.setMaxDistance(32);
      fireSound.setBuffer(buildCampfireCrackleBuffer(ctx));
      fireSound.setLoop(true);
      fireSound.setVolume(0.26);
      fireAnchor.add(fireSound);
    }

    if (ctx.state === 'running') {
      try {
        oceanSound.play();
        fireSound?.play();
      } catch {
        // Ignore if autoplay blocked
      }
    }

    nodesRef.current = {
      listener,
      leftPa,
      rightPa,
      oceanSound,
      fireSound,
      leftAnchor,
      rightAnchor,
      oceanAnchor,
      fireAnchor,
    };

    cinemaAudioEngine.setBeachPositionalActive(true);

    return () => {
      cinemaAudioEngine.setBeachPositionalActive(false);
      [leftPa, rightPa, oceanSound, fireSound].forEach((s) => {
        if (!s) return;
        try {
          if (s.isPlaying) s.stop();
          s.disconnect();
        } catch {
          // Ignore cleanup errors
        }
      });
      camera.remove(listener);
      scene.remove(leftAnchor, rightAnchor, oceanAnchor);
      if (fireAnchor) scene.remove(fireAnchor);
      nodesRef.current = null;
    };
  }, [camera, scene, engineRunning, hasCampfire, isBioluminescent]);

  useEffect(() => {
    const nodes = nodesRef.current;
    if (!nodes) return;

    const ctx = cinemaAudioEngine.getRawContext();
    if (ctx && ctx.state === 'running') {
      if (!nodes.oceanSound.isPlaying) {
        try {
          nodes.oceanSound.play();
        } catch {
          // Ignore
        }
      }
      if (nodes.fireSound && !nodes.fireSound.isPlaying) {
        try {
          nodes.fireSound.play();
        } catch {
          // Ignore
        }
      }
    }

    const master = audioSettings.muted ? 0 : audioSettings.masterVolume;
    const useSpatialPa = audioSettings.spatialSimulation && !cinemaAudioEngine.isVideoHijackDisabled;
    cinemaAudioEngine.setBeachPositionalActive(useSpatialPa);

    const showActive = showState === 'SHOW_PLAYING' && !isPaused;
    const paGain = useSpatialPa && showActive ? master * audioSettings.videoVolume * 1.15 : 0;
    nodes.leftPa.setVolume(paGain);
    nodes.rightPa.setVolume(paGain);

    const envDuck = showActive ? 0.52 : 1.0;
    nodes.oceanSound.setVolume(master * 0.24 * envDuck);
    nodes.fireSound?.setVolume(master * 0.26 * envDuck);
  }, [audioSettings, showState, isPaused, engineRunning]);

  return null;
};
