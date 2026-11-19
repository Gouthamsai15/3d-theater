import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { TheaterConfiguration } from '../../types/cinema';
import {
  applyScreenBounceToMaterial,
  ScreenBounceUniforms,
} from '../lighting/screenBounceShader';
import {
  createAmberCoveWashTexture,
  createAmberVioletGradientTexture,
  createCarbonFiberTexture,
  createCrimsonStormGradientTexture,
  createImaxCyanChannelWashTexture,
  createImaxWithLaserSignTexture,
  createJaliLatticeTexture,
  createMossFoliageTextures,
  createVioletChannelGlowTexture,
  createVioletCoveWashTexture,
} from '../materials/proceduralTextures';
import { getIceTheaterLayout } from './iceLayoutUtils';

/**
 * Shared wave elevation profile for Dolby Cobalt Veil 250 sweeping molten-amber
 * and dual celestial-violet architectural wall coves (u in [0..1] front-to-back).
 */
export function getDolbyVeilWaveHeights(u: number, H: number, topTierY: number) {
  const s = THREE.MathUtils.smoothstep(u, 0.05, 0.92);
  const sFull = THREE.MathUtils.smoothstep(u, 0.0, 1.0);
  const amberTargetRear = Math.min(H - 4.4, Math.max(4.4, topTierY + 1.55));
  const amberBotY =
    2.05 + (amberTargetRear - 2.05) * s - 0.42 * Math.sin(u * Math.PI * 2.15);
  const amberHeight = 0.72;
  const amberTopY = amberBotY + amberHeight;

  const violet1Start = Math.max(5.1, H * 0.39);
  const violet1End = Math.min(H - 3.3, Math.max(7.6, topTierY + 4.1));
  const violet1BotY =
    violet1Start +
    (violet1End - violet1Start) * sFull -
    0.55 * Math.sin(u * Math.PI * 2.05 + 0.35);
  const violetHeight = 0.38;
  const violet1TopY = violet1BotY + violetHeight;

  const violet2Start = Math.max(violet1Start + 2.1, H * 0.54);
  const violet2End = Math.min(H - 2.1, Math.max(9.2, topTierY + 5.75));
  const violet2BotY =
    violet2Start +
    (violet2End - violet2Start) * sFull +
    0.38 * Math.cos(u * Math.PI * 1.9);
  const violet2TopY = violet2BotY + violetHeight;

  return {
    amberBotY,
    amberTopY,
    violet1BotY,
    violet1TopY,
    violet2BotY,
    violet2TopY,
  };
}

/**
 * Shared side & rear surround speaker niche coordinates for Sylva Moss 250
 * so recessed wood alcoves and angled speaker cabinets remain locked together.
 */
export function getBiophilicSpeakerPositions(config: TheaterConfiguration, topTierY: number) {
  const { auditoriumWidth: W, auditoriumLength: L, auditoriumHeight: H } = config;
  const fZ = -L / 2;
  const bZ = L / 2;

  const countPerSide = 5;
  const zStart = Math.max(fZ + 5.2, config.firstRowZ - 0.9);
  const zEnd = Math.min(bZ - 2.6, config.firstRowZ + (config.seatingRows - 1) * config.rowSpacing + 0.3);
  const yLow = Math.max(3.65, H * 0.25);
  const yHigh = Math.min(H - 2.2, topTierY + 2.15);

  const sideSpeakers = Array.from({ length: countPerSide }, (_, i) => {
    const t = countPerSide > 1 ? i / (countPerSide - 1) : 0.5;
    return {
      z: THREE.MathUtils.lerp(zStart, zEnd, t),
      y: THREE.MathUtils.lerp(yLow, yHigh, t),
    };
  });

  const bY = Math.min(H - 1.4, topTierY + 3.25);
  const bWinW = Math.min(4.8, W * 0.42);
  const bWinH = Math.min(1.42, H * 0.24);
  const wTop = Math.min(H - 0.28, bY + bWinH / 2);
  const wBot = Math.max(0.25, bY - bWinH / 2);
  const wMidY = (wTop + wBot) / 2;
  const boothSideX = Math.min(W / 2 - 0.68, bWinW / 2 + 0.78);
  const cornerX = Math.max(boothSideX + 1.45, Math.min(W * 0.38, W / 2 - 1.05));
  const cornerY = Math.min(H - 1.2, Math.max(2.35, wMidY - 0.12));

  const rearSpeakers = [
    { x: -boothSideX, y: wMidY },
    { x: boothSideX, y: wMidY },
    { x: -cornerX, y: cornerY },
    { x: cornerX, y: cornerY },
  ];

  return {
    sideSpeakers,
    rearSpeakers,
    bWinW,
    wTop,
    wBot,
  };
}

/**
 * Shared side & rear surround speaker coordinates for 4DX Exo-Skeleton 550
 * so dedicated architectural steel cages and angled speaker cabinets remain locked together.
 */
export function getExoskeletonSpeakerPositions(config: TheaterConfiguration, topTierY: number) {
  const { auditoriumWidth: W, auditoriumLength: L, auditoriumHeight: H } = config;
  const fZ = -L / 2;
  const bZ = L / 2;

  const countPerSide = 6;
  const zStart = Math.max(fZ + 5.8, config.firstRowZ - 0.6);
  const zEnd = Math.min(bZ - 2.6, config.firstRowZ + (config.seatingRows - 1) * config.rowSpacing + 0.3);
  const yLow = Math.max(4.4, H * 0.28);
  const yHigh = Math.min(H - 2.4, topTierY + 2.2);

  const sideSpeakers = Array.from({ length: countPerSide }, (_, i) => {
    const t = countPerSide > 1 ? i / (countPerSide - 1) : 0.5;
    return {
      z: THREE.MathUtils.lerp(zStart, zEnd, t),
      y: THREE.MathUtils.lerp(yLow, yHigh, t),
    };
  });

  const bY = Math.min(H - 1.4, topTierY + 3.25);
  const bWinW = Math.min(4.8, W * 0.42);
  const bWinH = Math.min(1.42, H * 0.24);
  const wTop = Math.min(H - 0.28, bY + bWinH / 2);
  const wBot = Math.max(0.25, bY - bWinH / 2);
  const wMidY = (wTop + wBot) / 2;
  const boothSideX = Math.min(W / 2 - 0.85, bWinW / 2 + 1.35);
  const cornerX = Math.max(boothSideX + 2.8, Math.min(W * 0.36, W / 2 - 1.45));
  const cornerY = Math.min(H - 1.25, Math.max(3.6, wMidY - 0.18));

  const rearSpeakers = [
    { x: -boothSideX, y: wMidY },
    { x: boothSideX, y: wMidY },
    { x: -cornerX, y: cornerY },
    { x: cornerX, y: cornerY },
  ];

  return {
    sideSpeakers,
    rearSpeakers,
    bWinW,
    wTop,
    wBot,
  };
}

interface SideWallLightingProps {
  config: TheaterConfiguration;
  wallBayZs: number[];
  topTierY: number;
  lightFactor: number;
  trimMetalMat: THREE.Material;
  acousticPanelMat: THREE.Material;
  wallMat?: THREE.Material;
  screenBounceUniforms?: ScreenBounceUniforms;
}

interface DiagonalSegmentProps {
  start: [number, number, number];
  end: [number, number, number];
  thickness: number;
  depth: number;
  material: THREE.Material;
  housingMaterial?: THREE.Material;
  interiorFocusY?: number;
}

/**
 * Renders an exact architectural linear LED channel bar from 3D point A to point B
 * with its recessed anodized aluminum housing sitting behind the interior-facing diffuser.
 */
const ArchitecturalChannelBar: React.FC<DiagonalSegmentProps> = ({
  start,
  end,
  thickness,
  depth,
  material,
  housingMaterial,
  interiorFocusY = 3.5,
}) => {
  const { mid, length, quaternion } = useMemo(() => {
    const a = new THREE.Vector3(...start);
    const b = new THREE.Vector3(...end);
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const m = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    const yAxis = len > 1e-4 ? dir.clone().normalize() : new THREE.Vector3(0, 1, 0);

    // Compute vector pointing cleanly into the auditorium interior orthogonal to yAxis
    const toInterior = new THREE.Vector3(0, interiorFocusY, m.z).sub(m);
    toInterior.sub(yAxis.clone().multiplyScalar(toInterior.dot(yAxis)));
    if (toInterior.lengthSq() < 1e-5) {
      toInterior.set(0, 1, 0).sub(yAxis.clone().multiplyScalar(yAxis.y));
    }
    if (toInterior.lengthSq() < 1e-5) {
      toInterior.set(1, 0, 0);
    }
    const xAxis = toInterior.normalize();
    const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis).normalize();
    xAxis.crossVectors(yAxis, zAxis).normalize();

    const basis = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
    const q = new THREE.Quaternion().setFromRotationMatrix(basis);
    return { mid: m, length: Math.max(0.05, len), quaternion: q };
  }, [start, end, interiorFocusY]);

  return (
    <group position={[mid.x, mid.y, mid.z]} quaternion={quaternion}>
      {housingMaterial && (
        <mesh position={[-depth * 0.22, 0, 0]} material={housingMaterial}>
          <boxGeometry args={[depth * 0.9, length + thickness * 0.4, thickness * 1.65]} />
        </mesh>
      )}
      <mesh position={[depth * 0.35, 0, 0]} material={material}>
        <boxGeometry args={[depth * 0.85, length + 0.01, thickness]} />
      </mesh>
    </group>
  );
};

/**
 * Builds a crisp beveled 3D polygonal acoustic wall panel in world (Z, Y) coordinates extruded along X.
 */
function buildWallPolygonGeo(
  ptsZY: [number, number][],
  thickness: number,
  bevel = 0.012,
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-ptsZY[0][0], ptsZY[0][1]);
  for (let i = 1; i < ptsZY.length; i++) {
    shape.lineTo(-ptsZY[i][0], ptsZY[i][1]);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.02, thickness - bevel * 2),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
  });
  geo.translate(0, 0, -thickness * 0.5);
  geo.rotateY(Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Clips a 2D convex polygon against half-plane a*x + b*y >= c (Sutherland-Hodgman).
 */
function clipPolyHalfPlane(
  poly: [number, number][],
  a: number,
  b: number,
  c: number,
): [number, number][] {
  if (poly.length < 3) return [];
  const out: [number, number][] = [];
  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i];
    const nxt = poly[(i + 1) % poly.length];
    const dCur = a * cur[0] + b * cur[1] - c;
    const dNxt = a * nxt[0] + b * nxt[1] - c;
    const inCur = dCur >= -1e-6;
    const inNxt = dNxt >= -1e-6;
    if (inCur && inNxt) {
      out.push(nxt);
    } else if (inCur && !inNxt) {
      const t = dCur / (dCur - dNxt);
      out.push([cur[0] + t * (nxt[0] - cur[0]), cur[1] + t * (nxt[1] - cur[1])]);
    } else if (!inCur && inNxt) {
      const t = dCur / (dCur - dNxt);
      out.push([cur[0] + t * (nxt[0] - cur[0]), cur[1] + t * (nxt[1] - cur[1])]);
      out.push(nxt);
    }
  }
  return out;
}

/**
 * Computes clipped line segment of a*x + b*y = c inside a 2D polygon (returns null if outside).
 */
function clipLineInPolygon(
  poly: [number, number][],
  a: number,
  b: number,
  c: number,
): [[number, number], [number, number]] | null {
  const hits: [number, number][] = [];
  for (let i = 0; i < poly.length; i++) {
    const p1 = poly[i];
    const p2 = poly[(i + 1) % poly.length];
    const d1 = a * p1[0] + b * p1[1] - c;
    const d2 = a * p2[0] + b * p2[1] - c;
    if ((d1 >= 0 && d2 <= 0) || (d1 <= 0 && d2 >= 0)) {
      const denom = d1 - d2;
      if (Math.abs(denom) > 1e-6) {
        const t = d1 / denom;
        if (t >= -1e-5 && t <= 1 + 1e-5) {
          hits.push([p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1])]);
        }
      }
    }
  }
  if (hits.length < 2) return null;
  let bestA = hits[0];
  let bestB = hits[1];
  let maxDistSq = -1;
  for (let i = 0; i < hits.length; i++) {
    for (let j = i + 1; j < hits.length; j++) {
      const dx = hits[j][0] - hits[i][0];
      const dy = hits[j][1] - hits[i][1];
      const d2 = dx * dx + dy * dy;
      if (d2 > maxDistSq) {
        maxDistSq = d2;
        bestA = hits[i];
        bestB = hits[j];
      }
    }
  }
  return maxDistSq > 0.04 ? [bestA, bestB] : null;
}

/**
 * Builds a smooth horizontal wave-contoured architectural wall band extruded along Y.
 * Local +X projects into the auditorium when placed cleanly on the left wall (or rotated Math.PI around Y on the right wall).
 */
function buildHorizontalWaveBandGeo(
  zStart: number,
  zEnd: number,
  bandHeight: number,
  baseThickness: number,
  waveAmp: number,
  waveCycles: number,
  phase: number,
  segments = 64,
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, -zStart);
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const z = THREE.MathUtils.lerp(zStart, zEnd, t);
    const waveX =
      baseThickness +
      waveAmp * (0.5 + 0.5 * Math.sin(t * Math.PI * 2 * waveCycles + phase));
    shape.lineTo(waveX, -z);
  }
  shape.lineTo(0, -zEnd);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.04, bandHeight - 0.016),
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 2,
    curveSegments: 12,
  });
  geo.translate(0, 0, -(bandHeight - 0.016) * 0.5);
  geo.rotateX(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds a subtle 3D origami-folded triangular or trapezoidal acoustic fabric panel in local wall coordinates.
 * Each vertex has [z, y, depthX] where depthX >= 0.02 projects into the auditorium along +X,
 * creating crisp, flat-shaded origami creases separated by clean shadow gaps.
 */
function buildOrigamiFacetGeo(ptsZYX: [number, number, number][]): THREE.BufferGeometry {
  const n = ptsZYX.length;
  const positions: number[] = [];

  // Triangulate front folded face (facing +X interior) from vertex 0 fan
  for (let i = 1; i < n - 1; i++) {
    const [z0, y0, x0] = ptsZYX[0];
    const [z1, y1, x1] = ptsZYX[i];
    const [z2, y2, x2] = ptsZYX[i + 1];
    positions.push(x0, y0, z0, x1, y1, z1, x2, y2, z2);
  }

  // Side bevel walls back to x = 0 mounting plane for solid 3D origami thickness
  for (let i = 0; i < n; i++) {
    const [zA, yA, xA] = ptsZYX[i];
    const [zB, yB, xB] = ptsZYX[(i + 1) % n];
    positions.push(xA, yA, zA, 0, yA, zA, 0, yB, zB);
    positions.push(xA, yA, zA, 0, yB, zB, xB, yB, zB);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds a beveled 3D polygonal acoustic wall panel in rear-wall (X, Y) coordinates extruded along Z.
 */
function buildRearWallPolygonGeo(
  ptsXY: [number, number][],
  thickness: number,
  bevel = 0.014,
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(ptsXY[0][0], ptsXY[0][1]);
  for (let i = 1; i < ptsXY.length; i++) {
    shape.lineTo(ptsXY[i][0], ptsXY[i][1]);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.02, thickness - bevel * 2),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
  });
  geo.translate(0, 0, -thickness * 0.5);
  geo.computeVertexNormals();
  return geo;
}

export const SideWallLighting: React.FC<SideWallLightingProps> = ({
  config,
  wallBayZs,
  topTierY,
  lightFactor,
  trimMetalMat,
  acousticPanelMat,
  wallMat,
  screenBounceUniforms,
}) => {
  const {
    auditoriumWidth: W,
    auditoriumLength: L,
    auditoriumHeight: H,
    firstRowZ,
    rowSpacing,
    rowElevationStep,
    seatingRows,
    sideLightStyle,
    lightingProfile,
    environmentProfile,
  } = config;

  const isPrivate = environmentProfile.architectureStyle === 'private';
  const isIce = environmentProfile.architectureStyle === 'ice';
  const iceLayout = useMemo(() => (isIce ? getIceTheaterLayout(config) : null), [isIce, config]);

  // Shared realistic architectural fixture materials (wired to live screen-bounce shader so walls reflect movie light)
  const mats = useMemo(() => {
    const channelMetalMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#181b22',
        roughness: 0.34,
        metalness: 0.82,
      }),
      screenBounceUniforms,
    );
    const brassHardwareMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#d4af37',
        roughness: 0.24,
        metalness: 0.88,
      }),
      screenBounceUniforms,
    );
    const warmBronzeMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#9c6b3b',
        roughness: 0.28,
        metalness: 0.84,
      }),
      screenBounceUniforms,
    );
    const walnutWoodMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#422718',
        roughness: 0.52,
        metalness: 0.08,
      }),
      screenBounceUniforms,
    );
    const primaryEmitterMat = new THREE.MeshStandardMaterial({
      color: '#101218',
      emissive: lightingProfile.wallColor,
      emissiveIntensity: 1.5,
      roughness: 0.18,
      metalness: 0.05,
    });
    const secondaryEmitterMat = new THREE.MeshStandardMaterial({
      color: '#101218',
      emissive: lightingProfile.accentColor,
      emissiveIntensity: 1.3,
      roughness: 0.2,
      metalness: 0.05,
    });
    const alabasterGlassMat = new THREE.MeshStandardMaterial({
      color: '#f2e4cb',
      emissive: lightingProfile.wallColor,
      emissiveIntensity: 1.2,
      roughness: 0.42,
      metalness: 0.02,
    });
    const charcoalAcousticMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#282d38',
        roughness: 0.88,
        metalness: 0.03,
      }),
      screenBounceUniforms,
    );
    const midnightBlueAcousticMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#16294f',
        roughness: 0.88,
        metalness: 0.03,
      }),
      screenBounceUniforms,
    );
    const imaxObsidianMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#0e1118',
        roughness: 0.9,
        metalness: 0.02,
      }),
      screenBounceUniforms,
    );
    const imaxCharcoalMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#171c27',
        roughness: 0.88,
        metalness: 0.03,
      }),
      screenBounceUniforms,
    );
    const carbonBlackAcousticMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#111319',
        roughness: 0.9,
        metalness: 0.04,
      }),
      screenBounceUniforms,
    );
    const gunmetalAcousticMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#252a34',
        roughness: 0.72,
        metalness: 0.22,
      }),
      screenBounceUniforms,
    );
    const nozzleBrassMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#94a3b8',
        roughness: 0.28,
        metalness: 0.88,
      }),
      screenBounceUniforms,
    );
    const slateAcousticMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#384152',
        roughness: 0.86,
        metalness: 0.06,
      }),
      screenBounceUniforms,
    );
    const indigoAcousticMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#1e1b4b',
        roughness: 0.88,
        metalness: 0.05,
      }),
      screenBounceUniforms,
    );
    const pitchBlackAcousticMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#0b0d12',
        roughness: 0.92,
        metalness: 0.04,
      }),
      screenBounceUniforms,
    );
    const titaniumGreyAcousticMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#2a303a',
        roughness: 0.84,
        metalness: 0.12,
      }),
      screenBounceUniforms,
    );
    const burntOrangeAcousticMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#c2410c',
        roughness: 0.82,
        metalness: 0.04,
      }),
      screenBounceUniforms,
    );
    const jetBlackAcousticMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#0d0f13',
        roughness: 0.92,
        metalness: 0.04,
      }),
      screenBounceUniforms,
    );
    const deepNavyAcousticMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#132347',
        roughness: 0.88,
        metalness: 0.04,
      }),
      screenBounceUniforms,
    );
    const darkGunmetalAcousticMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#2c3342',
        roughness: 0.86,
        metalness: 0.08,
      }),
      screenBounceUniforms,
    );
    const obsidianGeoMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#0b0d12',
        roughness: 0.92,
        metalness: 0.03,
      }),
      screenBounceUniforms,
    );
    const charcoalSlateAcousticMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#272d3a',
        roughness: 0.86,
        metalness: 0.06,
      }),
      screenBounceUniforms,
    );
    const deepRoyalBlueAcousticMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#16357d',
        roughness: 0.86,
        metalness: 0.05,
      }),
      screenBounceUniforms,
    );
    const titaniumFinMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#525864',
        roughness: 0.82,
        metalness: 0.16,
      }),
      screenBounceUniforms,
    );
    const espressoBronzeFinMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#432e23',
        roughness: 0.8,
        metalness: 0.12,
      }),
      screenBounceUniforms,
    );
    const auroraCharcoalPanelMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#14171f',
        roughness: 0.9,
        metalness: 0.03,
      }),
      screenBounceUniforms,
    );
    const auroraCharcoalAltMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#191d27',
        roughness: 0.9,
        metalness: 0.03,
      }),
      screenBounceUniforms,
    );
    const deepNavySlateMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#162238',
        roughness: 0.88,
        metalness: 0.04,
      }),
      screenBounceUniforms,
    );
    const darkWalnutCharcoalMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#2a211d',
        roughness: 0.86,
        metalness: 0.04,
      }),
      screenBounceUniforms,
    );
    const obsidianFabricMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#181b22',
        roughness: 0.9,
        metalness: 0.03,
      }),
      screenBounceUniforms,
    );
    const midnightSlateFabricMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#17233b',
        roughness: 0.88,
        metalness: 0.04,
      }),
      screenBounceUniforms,
    );
    const brushedGunmetalMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#525a68',
        roughness: 0.28,
        metalness: 0.86,
      }),
      screenBounceUniforms,
    );
    const charcoalSlatePanelMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#222731',
        roughness: 0.88,
        metalness: 0.03,
      }),
      screenBounceUniforms,
    );
    const walnutBronzeWoodMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#4a2e1f',
        roughness: 0.56,
        metalness: 0.1,
      }),
      screenBounceUniforms,
    );
    const satinBlackTrimMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#101217',
        roughness: 0.44,
        metalness: 0.45,
      }),
      screenBounceUniforms,
    );
    const auroraSlateGreyMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#384152',
        roughness: 0.86,
        metalness: 0.04,
      }),
      screenBounceUniforms,
    );
    const auroraIndigoCharcoalMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#1b2136',
        roughness: 0.88,
        metalness: 0.04,
      }),
      screenBounceUniforms,
    );
    const brushedDarkAluminumMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#404856',
        roughness: 0.3,
        metalness: 0.84,
      }),
      screenBounceUniforms,
    );
    const graphiteBlackFabricMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#171a21',
        roughness: 0.9,
        metalness: 0.03,
        flatShading: true,
        side: THREE.DoubleSide,
      }),
      screenBounceUniforms,
    );
    const oceanTealFabricMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#113f4b',
        roughness: 0.86,
        metalness: 0.05,
        flatShading: true,
        side: THREE.DoubleSide,
      }),
      screenBounceUniforms,
    );
    const satinBlackShadowMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#080a0e',
        roughness: 0.52,
        metalness: 0.36,
      }),
      screenBounceUniforms,
    );
    const volcanicBasaltMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#262a33',
        roughness: 0.88,
        metalness: 0.03,
      }),
      screenBounceUniforms,
    );
    const terracottaCopperMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#9a533e',
        roughness: 0.84,
        metalness: 0.05,
      }),
      screenBounceUniforms,
    );
    const darkBronzeRevealMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#2d2118',
        roughness: 0.44,
        metalness: 0.48,
      }),
      screenBounceUniforms,
    );
    const terracottaCopperSuedeMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#9a533e',
        roughness: 0.92,
        metalness: 0.02,
      }),
      screenBounceUniforms,
    );
    const smokedOakMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#3a291e',
        roughness: 0.56,
        metalness: 0.07,
      }),
      screenBounceUniforms,
    );
    const warmAlabasterPlasterMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#d8cfbe',
        roughness: 0.84,
        metalness: 0.02,
      }),
      screenBounceUniforms,
    );
    const sageSlateFabricMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#4c5e58',
        roughness: 0.9,
        metalness: 0.03,
      }),
      screenBounceUniforms,
    );
    const champagneGoldInlayMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#d9bf86',
        roughness: 0.24,
        metalness: 0.88,
      }),
      screenBounceUniforms,
    );
    const concealedGrilleMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#1e222a',
        roughness: 0.94,
        metalness: 0.02,
      }),
      screenBounceUniforms,
    );
    const iceBrushedAlumMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#8e98a8',
        roughness: 0.25,
        metalness: 0.88,
      }),
      screenBounceUniforms,
    );
    const iceTaupePlasterMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#6e6155',
        roughness: 0.9,
        metalness: 0.02,
      }),
      screenBounceUniforms,
    );
    const iceRibbedBronzeMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#6c4e36',
        roughness: 0.34,
        metalness: 0.74,
      }),
      screenBounceUniforms,
    );
    const iceShouSugiBanMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#151110',
        roughness: 0.84,
        metalness: 0.04,
      }),
      screenBounceUniforms,
    );
    const iceBasaltFabricMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#1a1e25',
        roughness: 0.92,
        metalness: 0.02,
      }),
      screenBounceUniforms,
    );
    const americanWalnutMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#5a3620',
        roughness: 0.46,
        metalness: 0.06,
      }),
      screenBounceUniforms,
    );
    const oatmealBoucleMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#d8ccba',
        roughness: 0.92,
        metalness: 0.01,
      }),
      screenBounceUniforms,
    );
    const saddleCognacSuedeMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#9d522b',
        roughness: 0.9,
        metalness: 0.02,
      }),
      screenBounceUniforms,
    );
    const champagneBrassInlayMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#d6bd7d',
        roughness: 0.24,
        metalness: 0.88,
      }),
      screenBounceUniforms,
    );
    const espressoFeltBackingMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#17110e',
        roughness: 0.96,
        metalness: 0.01,
      }),
      screenBounceUniforms,
    );
    const alabasterShadeMat = new THREE.MeshStandardMaterial({
      color: '#f6eedc',
      emissive: '#f5b041',
      emissiveIntensity: 0.85,
      roughness: 0.36,
      metalness: 0.02,
    });
    const mandapTerracottaFabricMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#843623',
        roughness: 0.96,
        metalness: 0.0,
      }),
      screenBounceUniforms,
    );
    const mandapCrimsonFabricMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#63111c',
        roughness: 0.96,
        metalness: 0.0,
      }),
      screenBounceUniforms,
    );
    const mandapArchSandstoneMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#6d4129',
        roughness: 0.9,
        metalness: 0.02,
      }),
      screenBounceUniforms,
    );
    const mandapEspressoBackingMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#150d0a',
        roughness: 0.97,
        metalness: 0.0,
      }),
      screenBounceUniforms,
    );
    const mandapAntiquedGoldMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#94743b',
        roughness: 0.88,
        metalness: 0.12,
      }),
      screenBounceUniforms,
    );
    const obsidianParametricMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#0c0e13',
        roughness: 0.92,
        metalness: 0.03,
      }),
      screenBounceUniforms,
    );
    const carbonGreyParametricMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#282d38',
        roughness: 0.88,
        metalness: 0.04,
      }),
      screenBounceUniforms,
    );
    const sandBeigeMossMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#b8a484',
        roughness: 0.95,
        metalness: 0.0,
      }),
      screenBounceUniforms,
    );
    const sageGreenMossMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#5a7252',
        roughness: 0.96,
        metalness: 0.0,
      }),
      screenBounceUniforms,
    );
    const softMossMidMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#41553c',
        roughness: 0.96,
        metalness: 0.0,
      }),
      screenBounceUniforms,
    );
    const deepCharcoalMossMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#232726',
        roughness: 0.95,
        metalness: 0.01,
      }),
      screenBounceUniforms,
    );
    const biophilicRecessBoxMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#151819',
        roughness: 0.93,
        metalness: 0.03,
      }),
      screenBounceUniforms,
    );
    const warmGoldHaloMat = new THREE.MeshStandardMaterial({
      color: '#d97706',
      emissive: '#fbbf24',
      emissiveIntensity: 1.2,
      toneMapped: false,
      roughness: 0.34,
      metalness: 0.04,
    });
    const matteBlackVeilMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#07090e',
        roughness: 0.94,
        metalness: 0.01,
        side: THREE.DoubleSide,
      }),
      screenBounceUniforms,
    );
    const deepCobaltVeilMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#0e1f4a',
        roughness: 0.93,
        metalness: 0.02,
        side: THREE.DoubleSide,
      }),
      screenBounceUniforms,
    );
    const cobaltVeilShadowMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#030407',
        roughness: 0.97,
        metalness: 0.0,
      }),
      screenBounceUniforms,
    );

    return {
      channelMetalMat,
      brassHardwareMat,
      warmBronzeMat,
      walnutWoodMat,
      primaryEmitterMat,
      secondaryEmitterMat,
      alabasterGlassMat,
      charcoalAcousticMat,
      midnightBlueAcousticMat,
      imaxObsidianMat,
      imaxCharcoalMat,
      carbonBlackAcousticMat,
      gunmetalAcousticMat,
      nozzleBrassMat,
      slateAcousticMat,
      indigoAcousticMat,
      pitchBlackAcousticMat,
      titaniumGreyAcousticMat,
      burntOrangeAcousticMat,
      jetBlackAcousticMat,
      deepNavyAcousticMat,
      darkGunmetalAcousticMat,
      obsidianGeoMat,
      charcoalSlateAcousticMat,
      deepRoyalBlueAcousticMat,
      titaniumFinMat,
      espressoBronzeFinMat,
      auroraCharcoalPanelMat,
      auroraCharcoalAltMat,
      deepNavySlateMat,
      darkWalnutCharcoalMat,
      obsidianFabricMat,
      midnightSlateFabricMat,
      brushedGunmetalMat,
      charcoalSlatePanelMat,
      walnutBronzeWoodMat,
      satinBlackTrimMat,
      auroraSlateGreyMat,
      auroraIndigoCharcoalMat,
      brushedDarkAluminumMat,
      graphiteBlackFabricMat,
      oceanTealFabricMat,
      satinBlackShadowMat,
      volcanicBasaltMat,
      terracottaCopperMat,
      darkBronzeRevealMat,
      terracottaCopperSuedeMat,
      smokedOakMat,
      warmAlabasterPlasterMat,
      sageSlateFabricMat,
      champagneGoldInlayMat,
      concealedGrilleMat,
      iceBrushedAlumMat,
      iceTaupePlasterMat,
      iceRibbedBronzeMat,
      iceShouSugiBanMat,
      iceBasaltFabricMat,
      americanWalnutMat,
      oatmealBoucleMat,
      saddleCognacSuedeMat,
      champagneBrassInlayMat,
      espressoFeltBackingMat,
      alabasterShadeMat,
      mandapTerracottaFabricMat,
      mandapCrimsonFabricMat,
      mandapArchSandstoneMat,
      mandapEspressoBackingMat,
      mandapAntiquedGoldMat,
      obsidianParametricMat,
      carbonGreyParametricMat,
      sandBeigeMossMat,
      sageGreenMossMat,
      softMossMidMat,
      deepCharcoalMossMat,
      biophilicRecessBoxMat,
      warmGoldHaloMat,
      matteBlackVeilMat,
      deepCobaltVeilMat,
      cobaltVeilShadowMat,
    };
  }, [lightingProfile.wallColor, lightingProfile.accentColor, screenBounceUniforms]);

  useEffect(() => {
    return () => {
      Object.values(mats).forEach((m) => m.dispose());
    };
  }, [mats]);

  // Dedicated non-reflective matte antiqued-gold pierced Jali lattice texture & material
  const jaliResources = useMemo(() => {
    if (sideLightStyle !== 'indian_mandap_jali') return null;
    const jaliTex = createJaliLatticeTexture();
    const jaliMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        map: jaliTex.map,
        alphaMap: jaliTex.alphaMap,
        alphaTest: 0.45,
        roughness: 0.89,
        metalness: 0.12,
        side: THREE.DoubleSide,
      }),
      screenBounceUniforms,
    );
    return { jaliTex, jaliMat };
  }, [sideLightStyle, screenBounceUniforms]);

  useEffect(() => {
    return () => {
      jaliResources?.jaliMat.dispose();
      jaliResources?.jaliTex.dispose();
    };
  }, [jaliResources]);

  // Dedicated Dolby Cobalt Veil 250 resources: matte carbon-fiber, porous charcoal suede, dark slate & smooth indirect amber/violet cove wash materials
  const eclipseResources = useMemo(() => {
    if (sideLightStyle !== 'cobalt_veil_laser_recess') return null;
    const carbonTex = createCarbonFiberTexture();
    const gradTexA = createAmberVioletGradientTexture(false);
    const gradTexB = createAmberVioletGradientTexture(true);
    const amberWashTex = createAmberCoveWashTexture();
    const violetWashTex = createVioletCoveWashTexture();

    const carbonFiberScaleMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        map: carbonTex,
        bumpMap: carbonTex,
        bumpScale: 0.014,
        color: '#a8b0be',
        roughness: 0.56,
        metalness: 0.16,
      }),
      screenBounceUniforms,
    );
    const charcoalSuedeScaleMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#1f222a',
        roughness: 0.92,
        metalness: 0.02,
      }),
      screenBounceUniforms,
    );
    const charcoalSlateFacetMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#292d36',
        roughness: 0.84,
        metalness: 0.06,
      }),
      screenBounceUniforms,
    );
    const amberCoveWashMat = new THREE.MeshStandardMaterial({
      map: amberWashTex,
      emissive: '#ffffff',
      emissiveMap: amberWashTex,
      emissiveIntensity: 1.35,
      roughness: 0.55,
      metalness: 0.04,
    });
    const violetCoveWashMat = new THREE.MeshStandardMaterial({
      map: violetWashTex,
      emissive: '#ffffff',
      emissiveMap: violetWashTex,
      emissiveIntensity: 1.35,
      roughness: 0.52,
      metalness: 0.04,
    });
    const amberLipEmitterMat = new THREE.MeshStandardMaterial({
      color: '#ffcf70',
      emissive: '#ff9e24',
      emissiveIntensity: 2.1,
      toneMapped: false,
      roughness: 0.2,
    });
    const violetLipEmitterMat = new THREE.MeshStandardMaterial({
      color: '#e9d5ff',
      emissive: '#a855f7',
      emissiveIntensity: 1.95,
      toneMapped: false,
      roughness: 0.2,
    });
    const eclipseGlowMatA = new THREE.MeshStandardMaterial({
      map: gradTexA,
      emissive: '#ffffff',
      emissiveMap: gradTexA,
      emissiveIntensity: 1.45,
      toneMapped: false,
      roughness: 0.28,
      metalness: 0.02,
    });
    const eclipseGlowMatB = new THREE.MeshStandardMaterial({
      map: gradTexB,
      emissive: '#ffffff',
      emissiveMap: gradTexB,
      emissiveIntensity: 1.45,
      toneMapped: false,
      roughness: 0.28,
      metalness: 0.02,
    });

    return {
      carbonTex,
      gradTexA,
      gradTexB,
      amberWashTex,
      violetWashTex,
      carbonFiberScaleMat,
      charcoalSuedeScaleMat,
      charcoalSlateFacetMat,
      amberCoveWashMat,
      violetCoveWashMat,
      amberLipEmitterMat,
      violetLipEmitterMat,
      eclipseGlowMatA,
      eclipseGlowMatB,
    };
  }, [sideLightStyle, screenBounceUniforms]);

  useEffect(() => {
    return () => {
      eclipseResources?.carbonFiberScaleMat.dispose();
      eclipseResources?.charcoalSuedeScaleMat.dispose();
      eclipseResources?.charcoalSlateFacetMat.dispose();
      eclipseResources?.amberCoveWashMat.dispose();
      eclipseResources?.violetCoveWashMat.dispose();
      eclipseResources?.amberLipEmitterMat.dispose();
      eclipseResources?.violetLipEmitterMat.dispose();
      eclipseResources?.eclipseGlowMatA.dispose();
      eclipseResources?.eclipseGlowMatB.dispose();
      eclipseResources?.carbonTex.dispose();
      eclipseResources?.gradTexA.dispose();
      eclipseResources?.gradTexB.dispose();
      eclipseResources?.amberWashTex.dispose();
      eclipseResources?.violetWashTex.dispose();
    };
  }, [eclipseResources]);

  // Dedicated Obsidian Wave 550 materials: 3 tonal matte acoustic wave finishes + soft neon-purple canyon wash & bright core spline
  const obsidianWaveResources = useMemo(() => {
    if (sideLightStyle !== 'parametric_obsidian_waves') return null;
    const violetGlowTex = createVioletChannelGlowTexture();

    const lightSlateWaveMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#4e5360',
        roughness: 0.87,
        metalness: 0.04,
      }),
      screenBounceUniforms,
    );
    const midCharcoalWaveMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#2c303b',
        roughness: 0.9,
        metalness: 0.04,
      }),
      screenBounceUniforms,
    );
    const obsidianWaveMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#13151c',
        roughness: 0.93,
        metalness: 0.03,
      }),
      screenBounceUniforms,
    );
    const violetCanyonWashMat = new THREE.MeshStandardMaterial({
      map: violetGlowTex,
      emissive: '#c084fc',
      emissiveMap: violetGlowTex,
      emissiveIntensity: 1.55,
      roughness: 0.48,
      metalness: 0.02,
      toneMapped: false,
    });
    const violetCoreSplineMat = new THREE.MeshStandardMaterial({
      color: '#f5e8ff',
      emissive: '#d8b4fe',
      emissiveIntensity: 2.35,
      roughness: 0.18,
      toneMapped: false,
    });

    return {
      violetGlowTex,
      lightSlateWaveMat,
      midCharcoalWaveMat,
      obsidianWaveMat,
      violetCanyonWashMat,
      violetCoreSplineMat,
    };
  }, [sideLightStyle, screenBounceUniforms]);

  useEffect(() => {
    return () => {
      obsidianWaveResources?.lightSlateWaveMat.dispose();
      obsidianWaveResources?.midCharcoalWaveMat.dispose();
      obsidianWaveResources?.obsidianWaveMat.dispose();
      obsidianWaveResources?.violetCanyonWashMat.dispose();
      obsidianWaveResources?.violetCoreSplineMat.dispose();
      obsidianWaveResources?.violetGlowTex.dispose();
    };
  }, [obsidianWaveResources]);

  // Dedicated Sylva Moss 250 resources: rough coral-tuft preserved moss textures, warm bronze-wood alcove frames & golden crevice LED emitters
  const biophilicMossResources = useMemo(() => {
    if (sideLightStyle !== 'biophilic_crystalline_moss') return null;
    const mossTex = createMossFoliageTextures();

    const sandBeigeMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        map: mossTex.map,
        bumpMap: mossTex.bumpMap,
        bumpScale: 0.068,
        color: '#dac19c',
        roughness: 0.96,
        metalness: 0.0,
      }),
      screenBounceUniforms,
    );
    const sageGreenMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        map: mossTex.map,
        bumpMap: mossTex.bumpMap,
        bumpScale: 0.068,
        color: '#80985c',
        roughness: 0.96,
        metalness: 0.0,
      }),
      screenBounceUniforms,
    );
    const oliveMossMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        map: mossTex.map,
        bumpMap: mossTex.bumpMap,
        bumpScale: 0.068,
        color: '#586d3e',
        roughness: 0.96,
        metalness: 0.0,
      }),
      screenBounceUniforms,
    );
    const charcoalFeltMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        map: mossTex.map,
        bumpMap: mossTex.bumpMap,
        bumpScale: 0.052,
        color: '#31343a',
        roughness: 0.95,
        metalness: 0.01,
      }),
      screenBounceUniforms,
    );
    const woodRecessMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#6b5139',
        roughness: 0.64,
        metalness: 0.08,
      }),
      screenBounceUniforms,
    );
    const woodAlcoveBackMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#171513',
        roughness: 0.94,
        metalness: 0.02,
      }),
      screenBounceUniforms,
    );
    const seamGlowMat = new THREE.MeshStandardMaterial({
      color: '#fef3c7',
      emissive: '#fbbf24',
      emissiveIntensity: 1.95,
      roughness: 0.22,
      toneMapped: false,
    });

    return {
      mossTex,
      sandBeigeMat,
      sageGreenMat,
      oliveMossMat,
      charcoalFeltMat,
      woodRecessMat,
      woodAlcoveBackMat,
      seamGlowMat,
    };
  }, [sideLightStyle, screenBounceUniforms]);

  useEffect(() => {
    return () => {
      biophilicMossResources?.sandBeigeMat.dispose();
      biophilicMossResources?.sageGreenMat.dispose();
      biophilicMossResources?.oliveMossMat.dispose();
      biophilicMossResources?.charcoalFeltMat.dispose();
      biophilicMossResources?.woodRecessMat.dispose();
      biophilicMossResources?.woodAlcoveBackMat.dispose();
      biophilicMossResources?.seamGlowMat.dispose();
      biophilicMossResources?.mossTex.dispose();
    };
  }, [biophilicMossResources]);

  // Dedicated IMAX Cobalt Horizon resources: matte obsidian/charcoal/slate wave-rib finishes, cyan slot wash, bright cyan core LEDs & backlit IMAX with Laser plaque
  const imaxCobaltResources = useMemo(() => {
    if (sideLightStyle !== 'imax_cobalt_wave') return null;
    const cyanWashTex = createImaxCyanChannelWashTexture();
    const plaqueTex = createImaxWithLaserSignTexture();

    const obsidianRibMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#0c0f16',
        roughness: 0.91,
        metalness: 0.04,
      }),
      screenBounceUniforms,
    );
    const charcoalRibMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#171d2a',
        roughness: 0.88,
        metalness: 0.05,
      }),
      screenBounceUniforms,
    );
    const slateRibMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#202838',
        roughness: 0.84,
        metalness: 0.06,
      }),
      screenBounceUniforms,
    );
    const plaqueFrameMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#0d1017',
        roughness: 0.58,
        metalness: 0.34,
      }),
      screenBounceUniforms,
    );
    const cyanWashMat = new THREE.MeshStandardMaterial({
      map: cyanWashTex,
      emissive: '#38bdf8',
      emissiveMap: cyanWashTex,
      emissiveIntensity: 1.42,
      roughness: 0.48,
      metalness: 0.02,
      toneMapped: false,
    });
    const cyanCoreLedMat = new THREE.MeshStandardMaterial({
      color: '#e0f7ff',
      emissive: '#22d3ee',
      emissiveIntensity: 2.45,
      roughness: 0.18,
      toneMapped: false,
    });
    const imaxPlaqueMat = new THREE.MeshStandardMaterial({
      map: plaqueTex,
      emissive: '#ffffff',
      emissiveMap: plaqueTex,
      emissiveIntensity: 0.96,
      roughness: 0.34,
      metalness: 0.1,
      toneMapped: false,
    });

    return {
      cyanWashTex,
      plaqueTex,
      obsidianRibMat,
      charcoalRibMat,
      slateRibMat,
      plaqueFrameMat,
      cyanWashMat,
      cyanCoreLedMat,
      imaxPlaqueMat,
    };
  }, [sideLightStyle, screenBounceUniforms]);

  useEffect(() => {
    return () => {
      imaxCobaltResources?.obsidianRibMat.dispose();
      imaxCobaltResources?.charcoalRibMat.dispose();
      imaxCobaltResources?.slateRibMat.dispose();
      imaxCobaltResources?.plaqueFrameMat.dispose();
      imaxCobaltResources?.cyanWashMat.dispose();
      imaxCobaltResources?.cyanCoreLedMat.dispose();
      imaxCobaltResources?.imaxPlaqueMat.dispose();
      imaxCobaltResources?.cyanWashTex.dispose();
      imaxCobaltResources?.plaqueTex.dispose();
    };
  }, [imaxCobaltResources]);

  // Dedicated 4DX Exo-Skeleton 550 resources: woven carbon-fiber exo-skeleton ribs, deep-charcoal porous mesh, forged steel cages & recessed crimson/storm-grey vertical LED bars
  const exoskeletonResources = useMemo(() => {
    if (sideLightStyle !== 'exoskeleton_crimson_matrix_4dx') return null;
    const carbonTex = createCarbonFiberTexture();
    carbonTex.repeat.set(3, 8);
    const crimsonStormTex = createCrimsonStormGradientTexture();

    const exoCarbonMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        map: carbonTex,
        bumpMap: carbonTex,
        bumpScale: 0.016,
        color: '#9ca3af',
        roughness: 0.44,
        metalness: 0.28,
      }),
      screenBounceUniforms,
    );
    const porousMeshMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#171b22',
        roughness: 0.9,
        metalness: 0.08,
      }),
      screenBounceUniforms,
    );
    const darkSteelCageMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#202530',
        roughness: 0.34,
        metalness: 0.78,
      }),
      screenBounceUniforms,
    );
    const crimsonStormLedMat = new THREE.MeshStandardMaterial({
      map: crimsonStormTex,
      emissive: '#ffffff',
      emissiveMap: crimsonStormTex,
      emissiveIntensity: 1.95,
      roughness: 0.2,
      toneMapped: false,
    });

    return {
      carbonTex,
      crimsonStormTex,
      exoCarbonMat,
      porousMeshMat,
      darkSteelCageMat,
      crimsonStormLedMat,
    };
  }, [sideLightStyle, screenBounceUniforms]);

  useEffect(() => {
    return () => {
      exoskeletonResources?.exoCarbonMat.dispose();
      exoskeletonResources?.porousMeshMat.dispose();
      exoskeletonResources?.darkSteelCageMat.dispose();
      exoskeletonResources?.crimsonStormLedMat.dispose();
      exoskeletonResources?.carbonTex.dispose();
      exoskeletonResources?.crimsonStormTex.dispose();
    };
  }, [exoskeletonResources]);

  // Dedicated 4DX Arctic Storm resources: frost-grey, slate-blue, deep cobalt & charcoal-navy acoustic fabric finishes + razor-thin violet & ice-cyan LED strips
  const arcticResources = useMemo(() => {
    if (sideLightStyle !== 'arctic_parametric_fins') return null;

    const frostGreyMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#93a2b8',
        roughness: 0.9,
        metalness: 0.02,
      }),
      screenBounceUniforms,
    );
    const slateBlueMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#4e6483',
        roughness: 0.9,
        metalness: 0.02,
      }),
      screenBounceUniforms,
    );
    const cobaltBlueMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#1e3c78',
        roughness: 0.9,
        metalness: 0.02,
      }),
      screenBounceUniforms,
    );
    const charcoalNavyMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#181e2c',
        roughness: 0.92,
        metalness: 0.02,
      }),
      screenBounceUniforms,
    );
    const dadoMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#121722',
        roughness: 0.94,
        metalness: 0.03,
      }),
      screenBounceUniforms,
    );
    const seamBackingMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#07090e',
        roughness: 0.96,
        metalness: 0.02,
      }),
      screenBounceUniforms,
    );
    const violetStripMat = new THREE.MeshStandardMaterial({
      color: '#f3e8ff',
      emissive: '#a855f7',
      emissiveIntensity: 1.9,
      roughness: 0.18,
      toneMapped: false,
    });
    const cyanStripMat = new THREE.MeshStandardMaterial({
      color: '#e0faff',
      emissive: '#22d3ee',
      emissiveIntensity: 1.85,
      roughness: 0.18,
      toneMapped: false,
    });

    return {
      frostGreyMat,
      slateBlueMat,
      cobaltBlueMat,
      charcoalNavyMat,
      dadoMat,
      seamBackingMat,
      violetStripMat,
      cyanStripMat,
    };
  }, [sideLightStyle, screenBounceUniforms]);

  useEffect(() => {
    return () => {
      arcticResources?.frostGreyMat.dispose();
      arcticResources?.slateBlueMat.dispose();
      arcticResources?.cobaltBlueMat.dispose();
      arcticResources?.charcoalNavyMat.dispose();
      arcticResources?.dadoMat.dispose();
      arcticResources?.seamBackingMat.dispose();
      arcticResources?.violetStripMat.dispose();
      arcticResources?.cyanStripMat.dispose();
    };
  }, [arcticResources]);

  // Smooth dim control (house lighting off cleanly while movie plays)
  const wallAccentIntensity = lightFactor * 1.65;
  mats.primaryEmitterMat.emissiveIntensity = wallAccentIntensity;
  mats.secondaryEmitterMat.emissiveIntensity = wallAccentIntensity * 0.9;
  mats.alabasterGlassMat.emissiveIntensity = wallAccentIntensity * 0.95;
  mats.alabasterShadeMat.emissiveIntensity = wallAccentIntensity * 0.88;
  mats.warmGoldHaloMat.emissiveIntensity = 0.16 + lightFactor * 1.35;
  if (eclipseResources) {
    eclipseResources.eclipseGlowMatA.emissiveIntensity = lightFactor * 1.52;
    eclipseResources.eclipseGlowMatB.emissiveIntensity = lightFactor * 1.44;
    eclipseResources.amberCoveWashMat.emissiveIntensity = lightFactor * 1.38;
    eclipseResources.violetCoveWashMat.emissiveIntensity = lightFactor * 1.32;
    eclipseResources.amberLipEmitterMat.emissiveIntensity = lightFactor * 2.15;
    eclipseResources.violetLipEmitterMat.emissiveIntensity = lightFactor * 1.95;
  }
  if (obsidianWaveResources) {
    obsidianWaveResources.violetCanyonWashMat.emissiveIntensity = lightFactor * 1.55;
    obsidianWaveResources.violetCoreSplineMat.emissiveIntensity = lightFactor * 2.35;
  }
  if (biophilicMossResources) {
    biophilicMossResources.seamGlowMat.emissiveIntensity = lightFactor * 1.95;
  }
  if (imaxCobaltResources) {
    imaxCobaltResources.cyanWashMat.emissiveIntensity = lightFactor * 1.42;
    imaxCobaltResources.cyanCoreLedMat.emissiveIntensity = lightFactor * 2.45;
    imaxCobaltResources.imaxPlaqueMat.emissiveIntensity = 0.06 + lightFactor * 0.9;
  }
  if (exoskeletonResources) {
    exoskeletonResources.crimsonStormLedMat.emissiveIntensity = lightFactor * 1.95;
  }
  if (arcticResources) {
    arcticResources.violetStripMat.emissiveIntensity = lightFactor * 1.95;
    arcticResources.cyanStripMat.emissiveIntensity = lightFactor * 1.88;
  }

  const sconceY = isPrivate ? Math.min(H * 0.58, 2.55) : Math.min(H * 0.56, topTierY + 2.05);
  const wallInnerX = W / 2 - 0.22;
  const frontZ = -L / 2;
  const backZ = L / 2;

  // Continuous crisscross geometric LED lattice coordinates inspired by architectural cinema halls
  const crisscrossSegments = useMemo(() => {
    if (sideLightStyle !== 'crisscross_geometric') return [];
    const wx = W / 2 - 0.26;
    const ceilY = H - 0.235;
    const frontFloorY = 0.04;
    const tierEdgeZ = firstRowZ - rowSpacing * 0.5;
    const skirtYAt = (z: number) => {
      if (z <= tierEdgeZ) return frontFloorY;
      const tierFrac = Math.min(seatingRows - 1, Math.max(0, (z - tierEdgeZ) / rowSpacing));
      return Math.min(topTierY, tierFrac * rowElevationStep) + 0.08;
    };

    const zFront = -L * 0.42;
    const zMid1 = -L * 0.15;
    const zMid2 = L * 0.14;
    const zBack = L * 0.41;

    const segs: { start: [number, number, number]; end: [number, number, number]; accent?: boolean }[] = [];

    [-1, 1].forEach((side) => {
      const sx = side * wx;
      const ceilInX = side * (W * 0.16);
      const floorInX = side * (W * 0.34);

      // Front flat apron + sloped skirting perimeter channels tracking cleanly above seating risers
      segs.push({ start: [sx, frontFloorY, zFront], end: [sx, frontFloorY, tierEdgeZ] });
      segs.push({ start: [sx, frontFloorY, tierEdgeZ], end: [sx, skirtYAt(zBack), zBack] });
      segs.push({ start: [floorInX, frontFloorY, zFront], end: [floorInX, frontFloorY, tierEdgeZ], accent: true });
      segs.push({ start: [sx, frontFloorY, zFront], end: [floorInX, frontFloorY, zFront + 1.4] });
      segs.push({ start: [sx, frontFloorY, tierEdgeZ], end: [floorInX, frontFloorY, tierEdgeZ] });

      // Bold crisscrossing wall-to-ceiling diagonal channels starting cleanly above skirting tiers
      segs.push({ start: [sx, skirtYAt(zBack), zBack], end: [sx, ceilY, zMid2] });
      segs.push({ start: [sx, skirtYAt(zMid2 - 0.4), zMid2 - 0.4], end: [sx, ceilY, zBack - 0.6] });

      segs.push({ start: [sx, skirtYAt(zMid2 + 1.1), zMid2 + 1.1], end: [sx, ceilY, zMid1 - 0.6] });
      segs.push({ start: [sx, skirtYAt(zMid1 - 1.2), zMid1 - 1.2], end: [sx, ceilY, zMid2 + 0.5] });

      segs.push({ start: [sx, skirtYAt(zMid1 + 0.4), zMid1 + 0.4], end: [sx, ceilY, zFront + 0.9] });
      segs.push({ start: [sx, skirtYAt(zFront), zFront], end: [sx, ceilY, zMid1 + 0.2] });

      // Ceiling continuation lines tying left & right wall diagonals across the dark ceiling plane
      segs.push({ start: [sx, ceilY, zBack - 0.6], end: [ceilInX, ceilY, zMid1], accent: true });
      segs.push({ start: [sx, ceilY, zMid2], end: [-side * W * 0.12, ceilY, zMid1 - 1.2] });
      segs.push({ start: [sx, ceilY, zFront + 0.9], end: [ceilInX, ceilY, zMid1 - 1.4] });
    });

    // Cross-hall ceiling connector ribs bridging left/right architectural channels
    segs.push({ start: [-wx, ceilY, zFront + 0.9], end: [wx, ceilY, zMid1 - 1.4] });
    segs.push({ start: [wx, ceilY, zFront + 0.9], end: [-wx, ceilY, zMid1 - 1.4] });

    return segs;
  }, [sideLightStyle, W, L, H, firstRowZ, rowSpacing, rowElevationStep, seatingRows, topTierY]);

  // Contemporary commercial multiplex angled charcoal grey & deep midnight blue acoustic wall polygons + linear LED seams
  const modernDiagonalWall = useMemo(() => {
    if (sideLightStyle !== 'modern_charcoal_navy_diagonal') return null;
    const zMin = -L * 0.43;
    const zMax = L * 0.43;
    const yBot = 0.28;
    const yTop = H - 0.34;
    const totalLen = zMax - zMin;
    const bayCount = 5;
    const bayLen = totalLen / bayCount;
    const gap = 0.055;

    const panels: { geo: THREE.BufferGeometry; tone: 'charcoal' | 'navy'; depthOffset: number }[] = [];
    const ledSeamSegments: {
      startZY: [number, number];
      endZY: [number, number];
      isAmber: boolean;
    }[] = [];

    for (let i = 0; i < bayCount; i++) {
      const z0 = zMin + i * bayLen + gap * 0.5;
      const z1 = zMin + (i + 1) * bayLen - gap * 0.5;
      const zMidA = THREE.MathUtils.lerp(z0, z1, i % 2 === 0 ? 0.36 : 0.64);
      const zMidB = THREE.MathUtils.lerp(z0, z1, i % 2 === 0 ? 0.68 : 0.32);
      const yLowerBreak = THREE.MathUtils.lerp(yBot, yTop, i % 2 === 0 ? 0.38 : 0.48);
      const yUpperBreak = THREE.MathUtils.lerp(yBot, yTop, i % 2 === 0 ? 0.72 : 0.62);

      // Upper-front trapezoid panel
      panels.push({
        geo: buildWallPolygonGeo(
          [
            [z0, yLowerBreak + 0.03],
            [zMidB, yUpperBreak + 0.03],
            [zMidA, yTop],
            [z0, yTop],
          ],
          i % 2 === 0 ? 0.075 : 0.055,
        ),
        tone: i % 2 === 0 ? 'navy' : 'charcoal',
        depthOffset: i % 2 === 0 ? 0.055 : 0.04,
      });

      // Upper-rear triangle/wedge panel
      panels.push({
        geo: buildWallPolygonGeo(
          [
            [zMidA + 0.04, yTop],
            [zMidB + 0.03, yUpperBreak + 0.03],
            [z1, yUpperBreak - 0.65],
            [z1, yTop],
          ],
          i % 2 === 0 ? 0.055 : 0.075,
        ),
        tone: i % 2 === 0 ? 'charcoal' : 'navy',
        depthOffset: i % 2 === 0 ? 0.04 : 0.055,
      });

      // Lower angled geometric polygon panel
      panels.push({
        geo: buildWallPolygonGeo(
          [
            [z0, yBot],
            [z1, yBot],
            [z1, yUpperBreak - 0.71],
            [zMidB, yUpperBreak - 0.03],
            [z0, yLowerBreak - 0.03],
          ],
          i % 2 === 0 ? 0.068 : 0.052,
        ),
        tone: i % 2 === 0 ? 'charcoal' : 'navy',
        depthOffset: i % 2 === 0 ? 0.05 : 0.038,
      });

      // Clean minimal linear diagonal LED light strips tucked into key architectural seams
      ledSeamSegments.push({
        startZY: [z0 + 0.06, yLowerBreak],
        endZY: [zMidB, yUpperBreak],
        isAmber: i % 2 === 1,
      });
      ledSeamSegments.push({
        startZY: [zMidB, yUpperBreak],
        endZY: [zMidA + 0.02, yTop - 0.08],
        isAmber: false,
      });
      if (i < bayCount - 1) {
        ledSeamSegments.push({
          startZY: [zMidB, yUpperBreak],
          endZY: [z1 - 0.04, yUpperBreak - 0.68],
          isAmber: i % 2 === 0,
        });
      }
    }

    return { panels, ledSeamSegments };
  }, [sideLightStyle, L, H]);

  useEffect(() => {
    return () => {
      modernDiagonalWall?.panels.forEach((p) => p.geo.dispose());
    };
  }, [modernDiagonalWall]);

  // Grand Crimson Palace (2D Multiplex): Broad Gently Angled Interlocking Ribbon Bands of Volcanic-Basalt Fabric & Muted Terracotta-Copper Panels + Dark-Bronze Shadow Reveals + Warm-Gold & Soft Ivory LED Seams
  const volcanicRibbonsWall = useMemo(() => {
    if (sideLightStyle !== 'volcanic_copper_ribbons') return null;
    const zMin = -L * 0.44;
    const zMax = L * 0.44;
    const yBot = 0.22;
    const yTop = H - 1.32; // Clean horizontal upper wall band for symmetrical black surround speakers
    const segCount = 6;
    const segLen = (zMax - zMin) / segCount;
    const seamGap = 0.055; // Dark-bronze shadow reveal gap between interlocking ribbon bands

    // Continuous gently angled ribbon seam profile rising smoothly across the auditorium
    const upperSeamKnots = [0.64, 0.72, 0.62, 0.74, 0.65, 0.76, 0.68];
    const lowerSeamKnots = [0.32, 0.42, 0.34, 0.46, 0.38, 0.48, 0.41];

    const panels: { geo: THREE.BufferGeometry; tone: 'basalt' | 'terracotta'; depthOffset: number }[] = [];
    const bronzeReveals: { startZY: [number, number]; endZY: [number, number] }[] = [];
    const ledSeams: { startZY: [number, number]; endZY: [number, number]; isIvory: boolean }[] = [];

    for (let i = 0; i < segCount; i++) {
      const z0 = zMin + i * segLen + 0.018;
      const z1 = zMin + (i + 1) * segLen - 0.018;
      const yU0 = THREE.MathUtils.lerp(yBot, yTop, upperSeamKnots[i]);
      const yU1 = THREE.MathUtils.lerp(yBot, yTop, upperSeamKnots[i + 1]);
      const yL0 = THREE.MathUtils.lerp(yBot, yTop, lowerSeamKnots[i]);
      const yL1 = THREE.MathUtils.lerp(yBot, yTop, lowerSeamKnots[i + 1]);

      // Upper Matte Volcanic-Basalt Ribbon Band
      panels.push({
        geo: buildWallPolygonGeo(
          [
            [z0, yU0 + seamGap * 0.65],
            [z1, yU1 + seamGap * 0.65],
            [z1, yTop],
            [z0, yTop],
          ],
          0.056,
          0.011,
        ),
        tone: 'basalt',
        depthOffset: 0.044,
      });

      // Center Sweeping Interlocking Terracotta-Copper Ribbon Band (projects slightly forward for crisp relief)
      panels.push({
        geo: buildWallPolygonGeo(
          [
            [z0, yL0 + seamGap * 0.65],
            [z1, yL1 + seamGap * 0.65],
            [z1, yU1 - seamGap * 0.65],
            [z0, yU0 - seamGap * 0.65],
          ],
          0.072,
          0.012,
        ),
        tone: i % 3 === 1 ? 'basalt' : 'terracotta',
        depthOffset: 0.058,
      });

      // Lower Interlocking Ribbon Band (alternates basalt & warm terracotta-copper for balanced rhythm)
      panels.push({
        geo: buildWallPolygonGeo(
          [
            [z0, yBot],
            [z1, yBot],
            [z1, yL1 - seamGap * 0.65],
            [z0, yL0 - seamGap * 0.65],
          ],
          0.054,
          0.01,
        ),
        tone: i % 3 === 1 ? 'terracotta' : 'basalt',
        depthOffset: 0.042,
      });

      // Dark-Bronze Shadow-Reveal Trim Lines Along Interlocking Ribbon Joints
      bronzeReveals.push(
        { startZY: [z0, yU0], endZY: [z1, yU1] },
        { startZY: [z0, yL0], endZY: [z1, yL1] },
      );

      // Sleek Recessed Warm-Gold & Soft Ivory-White Linear LED Strips Tracing Ribbon Seams
      ledSeams.push({
        startZY: [z0 + 0.04, yU0],
        endZY: [z1 - 0.04, yU1],
        isIvory: i % 2 === 1,
      });
      if (i % 2 === 0) {
        ledSeams.push({
          startZY: [z0 + 0.08, yL0],
          endZY: [z1 - 0.08, yL1],
          isIvory: true,
        });
      }
    }

    // Top & Bottom Dark-Bronze Dado/Soffit Reveal Rails
    bronzeReveals.push(
      { startZY: [zMin, yBot], endZY: [zMax, yBot] },
      { startZY: [zMin, yTop], endZY: [zMax, yTop] },
    );

    return { panels, bronzeReveals, ledSeams };
  }, [sideLightStyle, L, H]);

  useEffect(() => {
    return () => {
      volcanicRibbonsWall?.panels.forEach((p) => p.geo.dispose());
    };
  }, [volcanicRibbonsWall]);

  // Mandap Heritage 2D: Deeply recessed matte terracotta & deep crimson acoustic fabric bays framed by intricate matte antiqued-gold Jali lattice screens & softly curved monolithic Mandap structural arches concealing all surround speakers
  const mandapJaliWall = useMemo(() => {
    if (sideLightStyle !== 'indian_mandap_jali') return null;
    const bayCount = 5;
    const zMin = -L * 0.415;
    const zMax = L * 0.415;
    const baySpan = (zMax - zMin) / bayCount;
    const archWallH = H - 0.56;
    const archDepthX = 0.62; // Deeply recessed acoustic bays + speaker-concealing monolithic arch piers

    // Outer boundary rect minus softly curved Mandap cusped-arch void
    const halfBay = baySpan * 0.5;
    const pillarW = 0.86;
    const innerHalf = Math.max(1.2, halfBay - pillarW);
    const springY = archWallH * 0.62;
    const crownY = archWallH - 0.48;

    const archShape = new THREE.Shape();
    archShape.moveTo(-halfBay, 0);
    archShape.lineTo(halfBay, 0);
    archShape.lineTo(halfBay, archWallH);
    archShape.lineTo(-halfBay, archWallH);
    archShape.closePath();

    const voidHole = new THREE.Path();
    voidHole.moveTo(-innerHalf, 0);
    voidHole.lineTo(innerHalf, 0);
    voidHole.lineTo(innerHalf, springY);
    voidHole.quadraticCurveTo(innerHalf * 0.88, crownY * 0.94, innerHalf * 0.34, crownY * 0.96);
    voidHole.quadraticCurveTo(0, crownY + 0.16, -innerHalf * 0.34, crownY * 0.96);
    voidHole.quadraticCurveTo(-innerHalf * 0.88, crownY * 0.94, -innerHalf, springY);
    voidHole.closePath();
    archShape.holes.push(voidHole);

    const archBayGeo = new THREE.ExtrudeGeometry(archShape, {
      depth: archDepthX,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.025,
      bevelSegments: 2,
      curveSegments: 20,
    });
    // Rotate so width runs along Z and extrusion thickness projects inward along +X
    archBayGeo.rotateY(Math.PI / 2);
    archBayGeo.computeVertexNormals();

    // Inner bevel molding rim hugging the softly curved Mandap arch curve
    const rimShape = new THREE.Shape();
    rimShape.moveTo(-innerHalf - 0.11, 0);
    rimShape.lineTo(innerHalf + 0.11, 0);
    rimShape.lineTo(innerHalf + 0.11, springY);
    rimShape.quadraticCurveTo((innerHalf + 0.11) * 0.88, (crownY + 0.11) * 0.94, (innerHalf + 0.11) * 0.34, (crownY + 0.11) * 0.96);
    rimShape.quadraticCurveTo(0, crownY + 0.27, -(innerHalf + 0.11) * 0.34, (crownY + 0.11) * 0.96);
    rimShape.quadraticCurveTo(-(innerHalf + 0.11) * 0.88, (crownY + 0.11) * 0.94, -innerHalf - 0.11, springY);
    rimShape.closePath();
    rimShape.holes.push(voidHole);

    const archTrimGeo = new THREE.ExtrudeGeometry(rimShape, {
      depth: archDepthX + 0.08,
      bevelEnabled: true,
      bevelThickness: 0.018,
      bevelSize: 0.016,
      bevelSegments: 2,
      curveSegments: 20,
    });
    archTrimGeo.rotateY(Math.PI / 2);
    archTrimGeo.computeVertexNormals();

    const bays = Array.from({ length: bayCount }, (_, i) => ({
      zMid: zMin + (i + 0.5) * baySpan,
      isTerracottaPrimary: i % 2 === 0,
    }));

    return {
      archBayGeo,
      archTrimGeo,
      bays,
      baySpan,
      archWallH,
      archDepthX,
      innerHalf,
      springY,
      crownY,
    };
  }, [sideLightStyle, L, H]);

  useEffect(() => {
    return () => {
      mandapJaliWall?.archBayGeo.dispose();
      mandapJaliWall?.archTrimGeo.dispose();
    };
  }, [mandapJaliWall]);

  // Walnut Reserve Salon (Private Luxury): Vertical fluted American walnut acoustic panels alternating with softly curved upholstered bays in warm oatmeal bouclé & rich saddle-cognac suede, precision champagne-brass inlays, concealed warm-amber vertical cove grazers, minimalist alabaster wall sconces, and concealed flush surrounds behind acoustically transparent bays
  const privateVolcanicWall = useMemo(() => {
    if (sideLightStyle !== 'private_volcanic_copper_ribbons') return null;
    const zMin = -L * 0.41;
    const zMax = L * 0.41;
    const span = zMax - zMin;
    const bayCount = 3; // 3 softly curved upholstered bays flanked by 4 vertical fluted American walnut acoustic piers
    const baySpan = span / bayCount;
    const pierW = 0.92;
    const bayW = Math.max(1.25, baySpan - pierW - 0.16);
    const yBot = 0.28;
    const yTop = H - 0.34;
    const bayH = yTop - yBot - 0.26;
    const bayCenterY = (yBot + yTop) * 0.5;

    const buildCurvedUpholsteryGeo = (width: number, height: number, maxBulge: number) => {
      const hw = width * 0.5;
      const shape = new THREE.Shape();
      shape.moveTo(0, hw);
      const segs = 28;
      for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        const z = THREE.MathUtils.lerp(-hw, hw, t);
        const bulge = 0.016 + maxBulge * Math.sin(t * Math.PI);
        shape.lineTo(bulge, -z);
      }
      shape.lineTo(0, -hw);
      shape.closePath();

      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: Math.max(0.2, height - 0.02),
        bevelEnabled: true,
        bevelThickness: 0.01,
        bevelSize: 0.01,
        bevelSegments: 2,
        curveSegments: 10,
      });
      geo.translate(0, 0, -(height - 0.02) * 0.5);
      geo.rotateX(-Math.PI / 2);
      geo.computeVertexNormals();
      return geo;
    };

    const mainBayH = bayH * 0.68;
    const lowerBandH = bayH * 0.24;
    const curvedMainGeo = buildCurvedUpholsteryGeo(bayW - 0.12, mainBayH, 0.072);
    const curvedLowerBandGeo = buildCurvedUpholsteryGeo(bayW - 0.12, lowerBandH, 0.062);

    const pierZs = Array.from({ length: bayCount + 1 }, (_, i) => zMin + i * baySpan);
    const bayZs = Array.from({ length: bayCount }, (_, i) => zMin + (i + 0.5) * baySpan);

    return {
      pierZs,
      bayZs,
      pierW,
      bayW,
      bayH,
      mainBayH,
      lowerBandH,
      bayCenterY,
      yBot,
      yTop,
      curvedMainGeo,
      curvedLowerBandGeo,
    };
  }, [sideLightStyle, L, H]);

  useEffect(() => {
    return () => {
      privateVolcanicWall?.curvedMainGeo.dispose();
      privateVolcanicWall?.curvedLowerBandGeo.dispose();
    };
  }, [privateVolcanicWall]);

  // Champagne Ivory Lounge: Rhythmic vertical fluted smoked-oak acoustic slats alternating with gently curved warm alabaster plaster niches & muted sage-slate fabric panels + hairline champagne-gold metallic inlays + indirect warm-amber cove uplighting + slim vertical brass wall sconces
  const champagneFlutedWall = useMemo(() => {
    if (sideLightStyle !== 'champagne_fluted_oak_alcoves') return null;
    const zMin = -L * 0.41;
    const zMax = L * 0.41;
    const span = zMax - zMin;
    const bayCount = 3; // 3 curved plaster niches flanked by 4 fluted smoked-oak piers
    const baySpan = span / bayCount;
    const pierW = 0.96;
    const nicheW = Math.max(1.2, baySpan - pierW - 0.14);
    const yBot = 0.28;
    const yTop = H - 0.36;
    const nicheH = yTop - yBot - 0.34;
    const nicheCenterY = (yBot + yTop) * 0.5;

    // Gently curved concave alabaster plaster surround frame geometry
    const curvedFrameGeo = (() => {
      const outer = new THREE.Shape();
      const hw = nicheW / 2;
      const hh = nicheH / 2;
      const r = Math.min(0.42, hw * 0.45);
      outer.moveTo(-hw, -hh);
      outer.lineTo(hw, -hh);
      outer.lineTo(hw, hh - r);
      outer.quadraticCurveTo(hw, hh, hw - r, hh);
      outer.lineTo(-hw + r, hh);
      outer.quadraticCurveTo(-hw, hh, -hw, hh - r);
      outer.closePath();

      const inner = new THREE.Path();
      const ihw = hw - 0.18;
      const ihh = hh - 0.16;
      const ir = Math.max(0.14, r - 0.14);
      inner.moveTo(-ihw, -ihh);
      inner.lineTo(-ihw, ihh - ir);
      inner.quadraticCurveTo(-ihw, ihh, -ihw + ir, ihh);
      inner.lineTo(ihw - ir, ihh);
      inner.quadraticCurveTo(ihw, ihh, ihw, ihh - ir);
      inner.lineTo(ihw, -ihh);
      inner.closePath();
      outer.holes.push(inner);

      const geo = new THREE.ExtrudeGeometry(outer, {
        depth: 0.085,
        bevelEnabled: true,
        bevelThickness: 0.015,
        bevelSize: 0.012,
        bevelSegments: 2,
        curveSegments: 14,
      });
      geo.rotateY(Math.PI / 2);
      geo.computeVertexNormals();
      return geo;
    })();

    const curvedFabricGeo = (() => {
      const shape = new THREE.Shape();
      const ihw = nicheW / 2 - 0.19;
      const ihh = nicheH / 2 - 0.17;
      const ir = Math.min(0.28, ihw * 0.35);
      shape.moveTo(-ihw, -ihh);
      shape.lineTo(ihw, -ihh);
      shape.lineTo(ihw, ihh - ir);
      shape.quadraticCurveTo(ihw, ihh, ihw - ir, ihh);
      shape.lineTo(-ihw + ir, ihh);
      shape.quadraticCurveTo(-ihw, ihh, -ihw, ihh - ir);
      shape.closePath();

      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: 0.04,
        bevelEnabled: true,
        bevelThickness: 0.008,
        bevelSize: 0.008,
        bevelSegments: 2,
        curveSegments: 14,
      });
      geo.rotateY(Math.PI / 2);
      geo.computeVertexNormals();
      return geo;
    })();

    const pierZs = Array.from({ length: bayCount + 1 }, (_, i) => zMin + i * baySpan);
    const nicheZs = Array.from({ length: bayCount }, (_, i) => zMin + (i + 0.5) * baySpan);

    return {
      pierZs,
      nicheZs,
      pierW,
      nicheW,
      nicheH,
      nicheCenterY,
      yBot,
      yTop,
      curvedFrameGeo,
      curvedFabricGeo,
    };
  }, [sideLightStyle, L, H]);

  useEffect(() => {
    return () => {
      champagneFlutedWall?.curvedFrameGeo.dispose();
      champagneFlutedWall?.curvedFabricGeo.dispose();
    };
  }, [champagneFlutedWall]);

  // IMAX Cobalt Horizon: Slanted Sculpted Matte-Obsidian & Deep-Charcoal Acoustic Wave Bays + Razor-Sharp Diagonal Cyan-Blue LED Slots + Clean Front Margin with "IMAX with Laser" Plaque
  const imaxWaveWall = useMemo(() => {
    if (sideLightStyle !== 'imax_cobalt_wave') return null;

    type Vec3 = [number, number, number];
    type Vec2 = [number, number];

    const pushTri = (
      pos: number[],
      norm: number[],
      uv: number[],
      a: Vec3,
      b: Vec3,
      c: Vec3,
      uvA: Vec2,
      uvB: Vec2,
      uvC: Vec2,
      desiredNormal: Vec3,
    ) => {
      const abx = b[0] - a[0], aby = b[1] - a[1], abz = b[2] - a[2];
      const acx = c[0] - a[0], acy = c[1] - a[1], acz = c[2] - a[2];
      let nx = aby * acz - abz * acy;
      let ny = abz * acx - abx * acz;
      let nz = abx * acy - aby * acx;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;
      const dot = nx * desiredNormal[0] + ny * desiredNormal[1] + nz * desiredNormal[2];
      if (dot >= 0) {
        pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
        norm.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
        uv.push(uvA[0], uvA[1], uvB[0], uvB[1], uvC[0], uvC[1]);
      } else {
        pos.push(a[0], a[1], a[2], c[0], c[1], c[2], b[0], b[1], b[2]);
        norm.push(-nx, -ny, -nz, -nx, -ny, -nz, -nx, -ny, -nz);
        uv.push(uvA[0], uvA[1], uvC[0], uvC[1], uvB[0], uvB[1]);
      }
    };

    const makeGeo = (pos: number[], norm: number[], uv: number[]) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      return geo;
    };

    const buildSlantedWaveField = (
      hMin: number,
      hMax: number,
      yBot: number,
      yTop: number,
      bayCount: number,
      subRibsPerBay: number,
      slantOffset: number,
      axis: 'side' | 'rear',
      dirSign: number,
      seedOffset: number,
    ) => {
      const vSteps = 34;
      const totalRibs = bayCount * subRibsPerBay;
      const toneBuckets = [
        { pos: [] as number[], norm: [] as number[], uv: [] as number[] }, // 0: matte obsidian
        { pos: [] as number[], norm: [] as number[], uv: [] as number[] }, // 1: deep charcoal
        { pos: [] as number[], norm: [] as number[], uv: [] as number[] }, // 2: muted slate
      ];
      const washBucket = { pos: [] as number[], norm: [] as number[], uv: [] as number[] };
      const coreBucket = { pos: [] as number[], norm: [] as number[], uv: [] as number[] };

      const span = hMax - hMin;
      const hGrid: number[][] = [];

      for (let r = 0; r <= vSteps; r++) {
        const v = r / vSteps;
        const row: number[] = new Array(totalRibs + 1);
        for (let k = 0; k <= totalRibs; k++) {
          const bayIdx = Math.floor(k / subRibsPerBay);
          const isBaySeam = k % subRibsPerBay === 0;
          const u = k / totalRibs;
          const baseH = THREE.MathUtils.lerp(hMin, hMax, u);
          // Major bay seams lean sharply backward-upward (+slantOffset) without curving into each other;
          // internal sub-rib seams undulate organically between the bay boundaries
          const slant = v * slantOffset * Math.sin(THREE.MathUtils.clamp(u, 0.08, 0.92) * Math.PI * 0.85 + 0.15);
          const subCurve = isBaySeam
            ? 0
            : (0.28 * Math.sin(v * Math.PI * 1.9 + bayIdx * 1.3 + k * 0.7 + seedOffset) +
                0.14 * Math.cos(v * Math.PI * 3.1 - k * 0.9)) *
              Math.min(1, span / 14);
          row[k] = THREE.MathUtils.clamp(baseH + slant + subCurve, hMin - 0.1, hMax + slantOffset + 0.1);
        }
        // Maintain strictly monotonic non-crossing spacing across ribs
        const minRibW = Math.max(0.22, (span / totalRibs) * 0.45);
        for (let k = 1; k <= totalRibs; k++) {
          row[k] = Math.max(row[k], row[k - 1] + minRibW);
        }
        hGrid.push(row);
      }

      const to3D = (h: number, y: number, d: number): Vec3 =>
        axis === 'side' ? [dirSign * d, y, h] : [h, y, dirSign * d];
      const inwardNorm: Vec3 = axis === 'side' ? [dirSign, 0, 0] : [0, 0, dirSign];
      const sideHNorm = (hDir: number): Vec3 =>
        axis === 'side' ? [dirSign * 0.35, 0, hDir] : [hDir, 0, dirSign * 0.35];

      const toneCadence = [0, 1, 2, 1, 0, 2, 1, 0];

      for (let k = 0; k < totalRibs; k++) {
        const bayIdx = Math.floor(k / subRibsPerBay);
        const subIdx = k % subRibsPerBay;
        const toneIdx = toneCadence[(k + bayIdx + seedOffset) % toneCadence.length];
        const b = toneBuckets[toneIdx];

        const isLeftSlot = subIdx === 0 && k > 0;
        const isRightSlot = subIdx === subRibsPerBay - 1 && k < totalRibs - 1;
        const gapLeft = isLeftSlot ? 0.068 : 0.012;
        const gapRight = isRightSlot ? 0.068 : 0.012;
        const baseDepth = 0.11 + ((k * 3 + bayIdx) % 3) * 0.048;

        for (let r = 0; r < vSteps; r++) {
          const v0 = r / vSteps;
          const v1 = (r + 1) / vSteps;
          const y0 = THREE.MathUtils.lerp(yBot, yTop, v0);
          const y1 = THREE.MathUtils.lerp(yBot, yTop, v1);

          const h0L = hGrid[r][k] + gapLeft;
          const h0R = Math.max(h0L + 0.07, hGrid[r][k + 1] - gapRight);
          const h1L = hGrid[r + 1][k] + gapLeft;
          const h1R = Math.max(h1L + 0.07, hGrid[r + 1][k + 1] - gapRight);

          const h0M = (h0L + h0R) * 0.5;
          const h1M = (h1L + h1R) * 0.5;
          const bevel0 = Math.min(0.04, (h0R - h0L) * 0.15);
          const bevel1 = Math.min(0.04, (h1R - h1L) * 0.15);

          const waveD0 =
            baseDepth +
            0.055 * Math.sin(v0 * Math.PI * 2.1 + k * 0.75 + seedOffset) +
            0.025 * Math.cos(v0 * Math.PI * 3.8 - bayIdx * 0.9);
          const waveD1 =
            baseDepth +
            0.055 * Math.sin(v1 * Math.PI * 2.1 + k * 0.75 + seedOffset) +
            0.025 * Math.cos(v1 * Math.PI * 3.8 - bayIdx * 0.9);

          const d0Edge = Math.max(0.08, waveD0 - 0.02);
          const d1Edge = Math.max(0.08, waveD1 - 0.02);
          const d0Crown = waveD0 + 0.026;
          const d1Crown = waveD1 + 0.026;
          const dBack = 0.008;

          // Left reveal return
          pushTri(
            b.pos, b.norm, b.uv,
            to3D(h0L, y0, dBack), to3D(h0L + bevel0, y0, d0Edge), to3D(h1L + bevel1, y1, d1Edge),
            [0, v0], [0.2, v0], [0.2, v1], sideHNorm(-1),
          );
          pushTri(
            b.pos, b.norm, b.uv,
            to3D(h0L, y0, dBack), to3D(h1L + bevel1, y1, d1Edge), to3D(h1L, y1, dBack),
            [0, v0], [0.2, v1], [0, v1], sideHNorm(-1),
          );

          // Left sculpted rib face
          pushTri(
            b.pos, b.norm, b.uv,
            to3D(h0L + bevel0, y0, d0Edge), to3D(h0M, y0, d0Crown), to3D(h1M, y1, d1Crown),
            [0.2, v0], [0.5, v0], [0.5, v1], inwardNorm,
          );
          pushTri(
            b.pos, b.norm, b.uv,
            to3D(h0L + bevel0, y0, d0Edge), to3D(h1M, y1, d1Crown), to3D(h1L + bevel1, y1, d1Edge),
            [0.2, v0], [0.5, v1], [0.2, v1], inwardNorm,
          );

          // Right sculpted rib face
          pushTri(
            b.pos, b.norm, b.uv,
            to3D(h0M, y0, d0Crown), to3D(h0R - bevel0, y0, d0Edge), to3D(h1R - bevel1, y1, d1Edge),
            [0.5, v0], [0.8, v0], [0.8, v1], inwardNorm,
          );
          pushTri(
            b.pos, b.norm, b.uv,
            to3D(h0M, y0, d0Crown), to3D(h1R - bevel1, y1, d1Edge), to3D(h1M, y1, d1Crown),
            [0.5, v0], [0.8, v1], [0.5, v1], inwardNorm,
          );

          // Right reveal return
          pushTri(
            b.pos, b.norm, b.uv,
            to3D(h0R - bevel0, y0, d0Edge), to3D(h0R, y0, dBack), to3D(h1R, y1, dBack),
            [0.8, v0], [1, v0], [1, v1], sideHNorm(1),
          );
          pushTri(
            b.pos, b.norm, b.uv,
            to3D(h0R - bevel0, y0, d0Edge), to3D(h1R, y1, dBack), to3D(h1R - bevel1, y1, d1Edge),
            [0.8, v0], [1, v1], [0.8, v1], sideHNorm(1),
          );
        }
      }

      // Recessed razor-sharp diagonal cyan-blue LED slots + smooth Gaussian cyan channel wash along every bay boundary
      for (let bIdx = 0; bIdx <= bayCount; bIdx++) {
        if (bIdx === bayCount && axis === 'rear') continue;
        const seamIdx = bIdx * subRibsPerBay;
        if (seamIdx >= totalRibs && axis === 'rear') continue;
        const washHalfW = 0.125;
        const coreHalfW = 0.019;

        for (let r = 0; r < vSteps; r++) {
          const v0 = r / vSteps;
          const v1 = (r + 1) / vSteps;
          const y0 = THREE.MathUtils.lerp(yBot, yTop, v0);
          const y1 = THREE.MathUtils.lerp(yBot, yTop, v1);
          const h0 = hGrid[r][seamIdx];
          const h1 = hGrid[r + 1][seamIdx];

          pushTri(
            washBucket.pos, washBucket.norm, washBucket.uv,
            to3D(h0 - washHalfW, y0, 0.068), to3D(h0 + washHalfW, y0, 0.068), to3D(h1 + washHalfW, y1, 0.068),
            [0, v0 * 3], [1, v0 * 3], [1, v1 * 3], inwardNorm,
          );
          pushTri(
            washBucket.pos, washBucket.norm, washBucket.uv,
            to3D(h0 - washHalfW, y0, 0.068), to3D(h1 + washHalfW, y1, 0.068), to3D(h1 - washHalfW, y1, 0.068),
            [0, v0 * 3], [1, v1 * 3], [0, v1 * 3], inwardNorm,
          );

          pushTri(
            coreBucket.pos, coreBucket.norm, coreBucket.uv,
            to3D(h0 - coreHalfW, y0, 0.095), to3D(h0 + coreHalfW, y0, 0.095), to3D(h1 + coreHalfW, y1, 0.095),
            [0, v0], [1, v0], [1, v1], inwardNorm,
          );
          pushTri(
            coreBucket.pos, coreBucket.norm, coreBucket.uv,
            to3D(h0 - coreHalfW, y0, 0.095), to3D(h1 + coreHalfW, y1, 0.095), to3D(h1 - coreHalfW, y1, 0.095),
            [0, v0], [1, v1], [0, v1], inwardNorm,
          );
        }
      }

      return {
        obsidianGeo: makeGeo(toneBuckets[0].pos, toneBuckets[0].norm, toneBuckets[0].uv),
        charcoalGeo: makeGeo(toneBuckets[1].pos, toneBuckets[1].norm, toneBuckets[1].uv),
        slateGeo: makeGeo(toneBuckets[2].pos, toneBuckets[2].norm, toneBuckets[2].uv),
        cyanWashGeo: makeGeo(washBucket.pos, washBucket.norm, washBucket.uv),
        cyanCoreGeo: makeGeo(coreBucket.pos, coreBucket.norm, coreBucket.uv),
      };
    };

    const fZ = -L / 2;
    const bZ = L / 2;
    const frontMarginLen = 3.15;
    const zMin = fZ + frontMarginLen;
    const zMax = bZ - 2.35; // leaves slantOffset room so top stays cleanly inside back wall
    const yBot = 0.12;
    const yTop = H - 0.18;
    const slantOffset = 2.05;

    const leftWall = buildSlantedWaveField(zMin, zMax, yBot, yTop, 7, 3, slantOffset, 'side', 1, 0);
    const rightWall = buildSlantedWaveField(zMin, zMax, yBot, yTop, 7, 3, slantOffset, 'side', -1, 2);

    // Rear wall acoustic wave continuations clear of projection booth window & rear double doors
    const boothY = Math.min(H - 1.4, topTierY + 3.25);
    const boothWinW = Math.min(4.8, W * 0.42);
    const boothWinH = Math.min(1.42, H * 0.24);
    const winTop = Math.min(H - 0.28, boothY + boothWinH / 2);
    const wingMinAbsX = boothWinW * 0.5 + 0.34;
    const wingMaxAbsX = W * 0.5 - 0.34;
    const backYBot = Math.max(0.25, topTierY - 0.16);

    const rearLeft = buildSlantedWaveField(-wingMaxAbsX, -wingMinAbsX, backYBot, yTop, 2, 3, 0.45, 'rear', -1, 1);
    const rearRight = buildSlantedWaveField(wingMinAbsX, wingMaxAbsX, backYBot, yTop, 2, 3, -0.45, 'rear', -1, 3);
    const rearSpandrel =
      yTop - (winTop + 0.16) > 0.35
        ? buildSlantedWaveField(-wingMinAbsX, wingMinAbsX, winTop + 0.16, yTop, 1, 4, 0, 'rear', -1, 2)
        : null;

    return {
      leftWall,
      rightWall,
      rearLeft,
      rearRight,
      rearSpandrel,
      frontMarginLen,
      wingMinAbsX,
      wingMaxAbsX,
    };
  }, [sideLightStyle, W, L, H, topTierY]);

  useEffect(() => {
    return () => {
      if (!imaxWaveWall) return;
      [
        imaxWaveWall.leftWall,
        imaxWaveWall.rightWall,
        imaxWaveWall.rearLeft,
        imaxWaveWall.rearRight,
        imaxWaveWall.rearSpandrel,
      ].forEach((part) => {
        if (!part) return;
        part.obsidianGeo.dispose();
        part.charcoalGeo.dispose();
        part.slateGeo.dispose();
        part.cyanWashGeo.dispose();
        part.cyanCoreGeo.dispose();
      });
    };
  }, [imaxWaveWall]);

  // 4DX Crimson Velocity: Matte Carbon-Black & Dark Gunmetal-Grey Angular Acoustic Panels + Recessed Crimson-Red & Electric-Blue Linear LED Strips
  const crimson4dxWall = useMemo(() => {
    if (sideLightStyle !== 'crimson_velocity_4dx') return null;
    const zMin = -L * 0.445;
    const zMax = L * 0.445;
    const yBot = 0.25;
    const yTop = H - 0.34;
    const bayCount = 6;
    const bayLen = (zMax - zMin) / bayCount;
    const gap = 0.055;

    const panels: {
      geo: THREE.BufferGeometry;
      tone: 'carbon' | 'gunmetal';
      depthOffset: number;
    }[] = [];
    const ledSeamSegments: {
      startZY: [number, number];
      endZY: [number, number];
      isBlue: boolean;
    }[] = [];

    for (let i = 0; i < bayCount; i++) {
      const z0 = zMin + i * bayLen + gap * 0.5;
      const z1 = zMin + (i + 1) * bayLen - gap * 0.5;
      const zMidA = THREE.MathUtils.lerp(z0, z1, i % 2 === 0 ? 0.38 : 0.62);
      const zMidB = THREE.MathUtils.lerp(z0, z1, i % 2 === 0 ? 0.68 : 0.32);
      const yLowerBreak = THREE.MathUtils.lerp(yBot, yTop, i % 2 === 0 ? 0.36 : 0.46);
      const yUpperBreak = THREE.MathUtils.lerp(yBot, yTop, i % 2 === 0 ? 0.72 : 0.62);

      // Upper-front angular gunmetal/carbon acoustic polygon
      panels.push({
        geo: buildWallPolygonGeo(
          [
            [z0, yLowerBreak + 0.03],
            [zMidB, yUpperBreak + 0.03],
            [zMidA, yTop],
            [z0, yTop],
          ],
          i % 2 === 0 ? 0.08 : 0.058,
          0.014,
        ),
        tone: i % 2 === 0 ? 'gunmetal' : 'carbon',
        depthOffset: i % 2 === 0 ? 0.06 : 0.042,
      });

      // Upper-rear sharp wedge panel
      panels.push({
        geo: buildWallPolygonGeo(
          [
            [zMidA + 0.04, yTop],
            [zMidB + 0.03, yUpperBreak + 0.03],
            [z1, yUpperBreak - 0.62],
            [z1, yTop],
          ],
          i % 2 === 0 ? 0.058 : 0.08,
          0.014,
        ),
        tone: i % 2 === 0 ? 'carbon' : 'gunmetal',
        depthOffset: i % 2 === 0 ? 0.042 : 0.06,
      });

      // Lower angular carbon-black & gunmetal acoustic polygon
      panels.push({
        geo: buildWallPolygonGeo(
          [
            [z0, yBot],
            [z1, yBot],
            [z1, yUpperBreak - 0.68],
            [zMidB, yUpperBreak - 0.03],
            [z0, yLowerBreak - 0.03],
          ],
          i % 2 === 0 ? 0.072 : 0.056,
          0.014,
        ),
        tone: i % 2 === 0 ? 'carbon' : 'gunmetal',
        depthOffset: i % 2 === 0 ? 0.052 : 0.04,
      });

      // Recessed crimson-red & electric-blue linear LED light strips tracing the angular panel channels
      ledSeamSegments.push({
        startZY: [z0 + 0.06, yLowerBreak],
        endZY: [zMidB, yUpperBreak],
        isBlue: false,
      });
      ledSeamSegments.push({
        startZY: [zMidB, yUpperBreak],
        endZY: [zMidA + 0.02, yTop - 0.08],
        isBlue: i % 2 === 0,
      });
      ledSeamSegments.push({
        startZY: [zMidB, yUpperBreak],
        endZY: [z1 - 0.05, yUpperBreak - 0.65],
        isBlue: i % 2 === 1,
      });
      // Vertical recessed seam LED bar at bay boundary
      ledSeamSegments.push({
        startZY: [z0 - gap * 0.45, yBot + 0.14],
        endZY: [z0 - gap * 0.45, yTop - 0.14],
        isBlue: i % 2 === 1,
      });
    }

    // Closing vertical recessed LED strip at rear wall boundary
    ledSeamSegments.push({
      startZY: [zMax, yBot + 0.14],
      endZY: [zMax, yTop - 0.14],
      isBlue: true,
    });

    return { panels, ledSeamSegments };
  }, [sideLightStyle, L, H]);

  useEffect(() => {
    return () => {
      crimson4dxWall?.panels.forEach((p) => p.geo.dispose());
    };
  }, [crimson4dxWall]);

  // 4DX Arctic Storm: High-Contrast Diagonal Geometric Acoustic Panels (Frost Grey, Slate Blue, Cobalt Blue, Charcoal-Navy) + Nested Upper V-Chevron + Sloping Dado + Rear Wings + Razor-Thin Violet/Cyan LEDs
  const arctic4dxWall = useMemo(() => {
    if (sideLightStyle !== 'arctic_parametric_fins') return null;

    type ArcticTone = 'frost' | 'slate' | 'cobalt' | 'charcoal';
    const fZ = -L * 0.5;
    const bZ = L * 0.5;
    const zFrontPanel = fZ + 1.15;
    const zExitEnd = fZ + 3.18;
    const zMax = bZ - 0.24;
    const yTop = H - 0.22;
    const yExitClear = 2.78;
    const yDadoRear = Math.min(H - 2.6, topTierY + 0.96);
    const yDadoFront = 1.05;
    const yDadoAt = (z: number) => {
      if (z <= zExitEnd) return yDadoFront;
      return THREE.MathUtils.lerp(yDadoFront, yDadoRear, (z - zExitEnd) / Math.max(1, zMax - zExitEnd));
    };

    const panels: {
      geo: THREE.BufferGeometry;
      tone: ArcticTone;
      depthOffset: number;
    }[] = [];
    const ledSeamSegments: {
      startZY: [number, number];
      endZY: [number, number];
      isCyan: boolean;
    }[] = [];

    // Convex wall zones clipped cleanly above sloping dado & exit door
    const frontUpperPoly: [number, number][] = [
      [zFrontPanel, yExitClear],
      [zExitEnd, yExitClear],
      [zExitEnd, yTop],
      [zFrontPanel, yTop],
    ];
    const mainWallPoly: [number, number][] = [
      [zExitEnd, yDadoFront],
      [zMax, yDadoRear],
      [zMax, yTop],
      [zExitEnd, yTop],
    ];

    const clipToWallZone = (cellPoly: [number, number][], zone: [number, number][]) => {
      let cur = cellPoly;
      for (let i = 0; i < zone.length; i++) {
        const p1 = zone[i];
        const p2 = zone[(i + 1) % zone.length];
        // Zone vertices are CCW in (z, y); inward normal is (-(p2[1]-p1[1]), p2[0]-p1[0])
        const a = -(p2[1] - p1[1]);
        const b = p2[0] - p1[0];
        const c = a * p1[0] + b * p1[1];
        cur = clipPolyHalfPlane(cur, a, b, c);
        if (cur.length < 3) return [];
      }
      return cur;
    };

    // Sloping dark charcoal-navy lower dado wall along seating tiers
    const dadoGeo = buildWallPolygonGeo(
      [
        [zExitEnd, 0],
        [zMax, 0],
        [zMax, yDadoRear],
        [zExitEnd, yDadoFront],
      ],
      0.072,
      0.01,
    );

    const cosA = Math.cos(Math.PI * 0.242);
    const sinA = Math.sin(Math.PI * 0.242);
    const du = 2.45;
    const dv = 2.65;
    const halfGap = 0.022;
    const toneOrder: ArcticTone[] = ['frost', 'slate', 'cobalt', 'charcoal'];
    const depthByTone: Record<ArcticTone, number> = {
      frost: 0.062,
      slate: 0.056,
      cobalt: 0.052,
      charcoal: 0.046,
    };

    const cornersZY: [number, number][] = [
      [zFrontPanel, 0.5],
      [zMax, 0.5],
      [zMax, yTop],
      [zFrontPanel, yTop],
    ];
    let uMin = Infinity;
    let uMax = -Infinity;
    let vMin = Infinity;
    let vMax = -Infinity;
    cornersZY.forEach(([z, y]) => {
      const u = z * cosA + y * sinA;
      const v = z * cosA - y * sinA;
      uMin = Math.min(uMin, u);
      uMax = Math.max(uMax, u);
      vMin = Math.min(vMin, v);
      vMax = Math.max(vMax, v);
    });

    const iuStart = Math.floor(uMin / du) - 1;
    const iuEnd = Math.ceil(uMax / du) + 1;
    const ivStart = Math.floor(vMin / dv) - 1;
    const ivEnd = Math.ceil(vMax / dv) + 1;

    // Nested V-Chevron focal zone centered on upper center-rear side wall (matching reference photo)
    const zV = L * 0.06;
    const chevronHeight = Math.min(4.45, (yTop - yDadoAt(zV)) * 0.68);
    const chevronHalfW = chevronHeight * 0.96;
    const yVApex = yTop - chevronHeight;
    const isInsideChevronCone = (z: number, y: number) => {
      if (y > yTop || y < yVApex) return false;
      const frac = (yTop - y) / chevronHeight;
      const hw = chevronHalfW * (1 - frac);
      return Math.abs(z - zV) < hw - 0.12;
    };

    for (let iu = iuStart; iu < iuEnd; iu++) {
      for (let iv = ivStart; iv < ivEnd; iv++) {
        const u0 = iu * du + halfGap;
        const u1 = (iu + 1) * du - halfGap;
        const v0 = iv * dv + halfGap;
        const v1 = (iv + 1) * dv - halfGap;

        // Solve diamond corner vertices from (u, v) = (z*cosA + y*sinA, z*cosA - y*sinA)
        const solveZY = (u: number, v: number): [number, number] => [
          (u + v) / (2 * cosA),
          (u - v) / (2 * sinA),
        ];
        // Ensure CCW orientation in (z, y)
        const rawDiamond: [number, number][] = [
          solveZY(u0, v1),
          solveZY(u1, v1),
          solveZY(u1, v0),
          solveZY(u0, v0),
        ];
        const toneIdx = (((iu * 3 + iv * 5) % 4) + 4) % 4;
        const tone = toneOrder[toneIdx];

        [frontUpperPoly, mainWallPoly].forEach((zone) => {
          const clipped = clipToWallZone(rawDiamond, zone);
          if (clipped.length >= 3) {
            panels.push({
              geo: buildWallPolygonGeo(clipped, depthByTone[tone] + 0.016, 0.01),
              tone,
              depthOffset: depthByTone[tone],
            });
          }
        });
      }
    }

    // Crisscrossing diagonal LED lines along grid seams (skipping inside nested V-chevron focal zone)
    for (let iu = iuStart + 1; iu <= iuEnd; iu++) {
      const c = iu * du;
      const segMain = clipLineInPolygon(mainWallPoly, cosA, sinA, c);
      if (segMain) {
        const midZ = (segMain[0][0] + segMain[1][0]) * 0.5;
        const midY = (segMain[0][1] + segMain[1][1]) * 0.5;
        if (!isInsideChevronCone(midZ, midY)) {
          ledSeamSegments.push({
            startZY: segMain[0],
            endZY: segMain[1],
            isCyan: ((iu % 3) + 3) % 3 === 1,
          });
        }
      }
      const segFront = clipLineInPolygon(frontUpperPoly, cosA, sinA, c);
      if (segFront) {
        ledSeamSegments.push({
          startZY: segFront[0],
          endZY: segFront[1],
          isCyan: ((iu % 2) + 2) % 2 === 0,
        });
      }
    }
    for (let iv = ivStart + 1; iv <= ivEnd; iv++) {
      const c = iv * dv;
      const segMain = clipLineInPolygon(mainWallPoly, cosA, -sinA, c);
      if (segMain) {
        const midZ = (segMain[0][0] + segMain[1][0]) * 0.5;
        const midY = (segMain[0][1] + segMain[1][1]) * 0.5;
        if (!isInsideChevronCone(midZ, midY)) {
          ledSeamSegments.push({
            startZY: segMain[0],
            endZY: segMain[1],
            isCyan: ((iv % 3) + 3) % 3 === 0,
          });
        }
      }
    }

    // Nested concentric V-chevron focal motif at upper center-rear (5 nested bands)
    const chevTones: ArcticTone[] = ['charcoal', 'cobalt', 'frost', 'slate', 'charcoal'];
    const bandStep = chevronHeight / 5;
    for (let k = 0; k < 5; k++) {
      const hOut = chevronHeight - k * bandStep;
      const hwOut = chevronHalfW * (hOut / chevronHeight);
      const yApexOut = yTop - hOut;
      const tone = chevTones[k];
      if (k === 4) {
        panels.push({
          geo: buildWallPolygonGeo(
            [
              [zV - hwOut + 0.03, yTop],
              [zV, yApexOut + 0.03],
              [zV + hwOut - 0.03, yTop],
            ],
            0.095,
            0.01,
          ),
          tone,
          depthOffset: 0.088,
        });
      } else {
        const hIn = chevronHeight - (k + 1) * bandStep + 0.032;
        const hwIn = chevronHalfW * (hIn / chevronHeight);
        const yApexIn = yTop - hIn;
        // Front (screen-side) chevron arm
        panels.push({
          geo: buildWallPolygonGeo(
            [
              [zV - hwOut + 0.025, yTop],
              [zV, yApexOut],
              [zV, yApexIn],
              [zV - hwIn - 0.025, yTop],
            ],
            0.092,
            0.01,
          ),
          tone,
          depthOffset: 0.086,
        });
        // Rear chevron arm
        panels.push({
          geo: buildWallPolygonGeo(
            [
              [zV, yApexOut],
              [zV + hwOut - 0.025, yTop],
              [zV + hwIn + 0.025, yTop],
              [zV, yApexIn],
            ],
            0.092,
            0.01,
          ),
          tone,
          depthOffset: 0.086,
        });
      }
      if (k < 4) {
        ledSeamSegments.push({
          startZY: [zV - hwOut + 0.04, yTop],
          endZY: [zV, yApexOut],
          isCyan: k % 2 === 1,
        });
        ledSeamSegments.push({
          startZY: [zV, yApexOut],
          endZY: [zV + hwOut - 0.04, yTop],
          isCyan: k % 2 === 0,
        });
      }
    }

    // Rear wall flanking wings (left & right of booth window and double entrance doors)
    const rearPanels: { geo: THREE.BufferGeometry; tone: ArcticTone; depthOffset: number }[] = [];
    const rearLeds: { startXY: [number, number]; endXY: [number, number]; isCyan: boolean }[] = [];
    const boothWinW = Math.min(4.8, W * 0.42);
    const doorClearHalfX = Math.max(1.65, boothWinW * 0.5 + 0.25);
    const rearWingLeft: [number, number][] = [
      [-W * 0.5 + 0.24, yDadoRear],
      [-doorClearHalfX, yDadoRear],
      [-doorClearHalfX, yTop],
      [-W * 0.5 + 0.24, yTop],
    ];
    const rearWingRight: [number, number][] = [
      [doorClearHalfX, yDadoRear],
      [W * 0.5 - 0.24, yDadoRear],
      [W * 0.5 - 0.24, yTop],
      [doorClearHalfX, yTop],
    ];
    [rearWingLeft, rearWingRight].forEach((wingPoly, wi) => {
      const xMinW = wingPoly[0][0];
      const xMaxW = wingPoly[1][0];
      const iuR0 = Math.floor((xMinW * cosA) / du) - 2;
      const iuR1 = Math.ceil((xMaxW * cosA + yTop * sinA) / du) + 2;
      const ivR0 = Math.floor((xMinW * cosA - yTop * sinA) / dv) - 2;
      const ivR1 = Math.ceil((xMaxW * cosA) / dv) + 2;
      for (let iu = iuR0; iu < iuR1; iu++) {
        for (let iv = ivR0; iv < ivR1; iv++) {
          const u0 = iu * du + halfGap;
          const u1 = (iu + 1) * du - halfGap;
          const v0 = iv * dv + halfGap;
          const v1 = (iv + 1) * dv - halfGap;
          const solveXY = (u: number, v: number): [number, number] => [
            (u + v) / (2 * cosA),
            (u - v) / (2 * sinA),
          ];
          const rawRear: [number, number][] = [
            solveXY(u0, v0),
            solveXY(u1, v0),
            solveXY(u1, v1),
            solveXY(u0, v1),
          ];
          const clipped = clipToWallZone(rawRear, wingPoly);
          if (clipped.length >= 3) {
            const tIdx = (((iu * 3 + iv * 5 + wi) % 4) + 4) % 4;
            const t = toneOrder[tIdx];
            rearPanels.push({
              geo: buildRearWallPolygonGeo(clipped, depthByTone[t] + 0.015, 0.01),
              tone: t,
              depthOffset: depthByTone[t],
            });
          }
        }
      }
      for (let iu = iuR0 + 1; iu <= iuR1; iu++) {
        const seg = clipLineInPolygon(wingPoly, cosA, sinA, iu * du);
        if (seg) rearLeds.push({ startXY: seg[0], endXY: seg[1], isCyan: ((iu + wi) % 2) === 0 });
      }
      for (let iv = ivR0 + 1; iv <= ivR1; iv++) {
        const seg = clipLineInPolygon(wingPoly, cosA, -sinA, iv * dv);
        if (seg) rearLeds.push({ startXY: seg[0], endXY: seg[1], isCyan: ((iv + wi) % 2) === 1 });
      }
    });

    const rearDadoGeo = buildRearWallPolygonGeo(
      [
        [-W * 0.5 + 0.24, 0],
        [-doorClearHalfX, 0],
        [-doorClearHalfX, yDadoRear],
        [-W * 0.5 + 0.24, yDadoRear],
      ],
      0.068,
      0.008,
    );
    const rearDadoRightGeo = buildRearWallPolygonGeo(
      [
        [doorClearHalfX, 0],
        [W * 0.5 - 0.24, 0],
        [W * 0.5 - 0.24, yDadoRear],
        [doorClearHalfX, yDadoRear],
      ],
      0.068,
      0.008,
    );

    return {
      panels,
      ledSeamSegments,
      dadoGeo,
      rearPanels,
      rearLeds,
      rearDadoGeo,
      rearDadoRightGeo,
      zExitEnd,
      zMax,
      yDadoFront,
      yDadoRear,
    };
  }, [sideLightStyle, L, H, W, topTierY]);

  useEffect(() => {
    return () => {
      arctic4dxWall?.panels.forEach((p) => p.geo.dispose());
      arctic4dxWall?.dadoGeo.dispose();
      arctic4dxWall?.rearPanels.forEach((p) => p.geo.dispose());
      arctic4dxWall?.rearDadoGeo.dispose();
      arctic4dxWall?.rearDadoRightGeo.dispose();
    };
  }, [arctic4dxWall]);

  // 4DX Thunder Arena: 3D Parametric Ribbed Acoustic Fins in Matte Titanium Grey & Deep Espresso-Bronze + Warm Golden-Amber & Crisp Ice-White Inner LEDs
  const thunderWaveWall = useMemo(() => {
    if (sideLightStyle !== 'thunder_emerald_waves') return null;
    const zMin = -L * 0.445;
    const zMax = L * 0.445;
    const yBot = 0.22;
    const yTop = H - 0.34;
    const finCount = 28;
    const pitch = (zMax - zMin) / finCount;
    const finThickZ = pitch * 0.36;
    const ySteps = 22;

    const fins: {
      geo: THREE.BufferGeometry;
      z: number;
      tone: 'titanium' | 'bronze';
    }[] = [];
    const ledStrips: {
      z: number;
      isWhite: boolean;
      yStart: number;
      yEnd: number;
    }[] = [];

    for (let i = 0; i < finCount; i++) {
      const t = i / Math.max(1, finCount - 1);
      const z = zMin + (i + 0.5) * pitch;
      const phase = t * Math.PI * 3.2;

      // Sculpted parametric acoustic fin cross-section in (depth, Y)
      const shape = new THREE.Shape();
      shape.moveTo(0, yBot);
      for (let iy = 0; iy <= ySteps; iy++) {
        const yf = iy / ySteps;
        const y = THREE.MathUtils.lerp(yBot, yTop, yf);
        const envelope = Math.sin(yf * Math.PI);
        const wave =
          0.11 +
          envelope *
            (0.14 +
              0.11 * Math.sin(phase + yf * Math.PI * 1.45) +
              0.04 * Math.cos(phase * 1.7 - yf * Math.PI * 2.1));
        shape.lineTo(Math.max(0.08, wave), y);
      }
      shape.lineTo(0, yTop);
      shape.closePath();

      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: finThickZ,
        bevelEnabled: true,
        bevelThickness: 0.012,
        bevelSize: 0.01,
        bevelSegments: 2,
        curveSegments: 8,
      });
      geo.translate(0, 0, -finThickZ * 0.5);
      geo.computeVertexNormals();

      fins.push({
        geo,
        z,
        tone: i % 2 === 0 ? 'titanium' : 'bronze',
      });

      if (i % 2 === 0 && i < finCount - 1) {
        ledStrips.push({
          z: z + pitch * 0.5,
          isWhite: (i / 2) % 3 === 1,
          yStart: yBot + 0.14,
          yEnd: yTop - 0.14,
        });
      }
    }

    return { fins, ledStrips };
  }, [sideLightStyle, L, H]);

  useEffect(() => {
    return () => {
      thunderWaveWall?.fins.forEach((f) => f.geo.dispose());
    };
  }, [thunderWaveWall]);

  // IMAX Polar Aurora: Slate-Grey & Deep Indigo-Charcoal Hexagonal & Angled Polygon Acoustic Fabric Panels with Brushed Dark-Aluminum Trims + Ice-White & Subtle Cobalt-Blue LEDs
  const polarAuroraWall = useMemo(() => {
    if (sideLightStyle !== 'aurora_ribbon_waves') return null;
    const zMin = -L * 0.36; // Keep front wall bay clear for illuminated blue IMAX emblem
    const zMax = L * 0.455;
    const yBot = 0.24;
    const yTop = H - 1.25; // Leave clean horizontal upper band for symmetrical black IMAX surrounds
    const bayCount = 5;
    const bayLen = (zMax - zMin) / bayCount;
    const seam = 0.055;

    const panels: {
      geo: THREE.BufferGeometry;
      depthOffset: number;
      isSlateGrey: boolean;
    }[] = [];
    const trimBars: { startZY: [number, number]; endZY: [number, number] }[] = [];
    const ledStrips: { startZY: [number, number]; endZY: [number, number]; isBlue: boolean }[] = [];

    for (let i = 0; i < bayCount; i++) {
      const z0 = zMin + i * bayLen + seam;
      const z1 = zMin + (i + 1) * bayLen - seam;
      const zMid = (z0 + z1) * 0.5;
      const wZ = z1 - z0;
      const panelH = yTop - yBot;
      const yMid = THREE.MathUtils.lerp(yBot, yTop, 0.48 + (i % 2 === 0 ? 0.03 : -0.02));

      // Central Large Beveled Hexagonal Acoustic Fabric Panel
      const hexR = wZ * 0.36;
      const hexRy = panelH * 0.27;
      const hexPts: [number, number][] = [
        [zMid - hexR, yMid],
        [zMid - hexR * 0.5, yMid + hexRy],
        [zMid + hexR * 0.5, yMid + hexRy],
        [zMid + hexR, yMid],
        [zMid + hexR * 0.5, yMid - hexRy],
        [zMid - hexR * 0.5, yMid - hexRy],
      ];
      panels.push({
        geo: buildWallPolygonGeo(hexPts, 0.068, 0.012),
        depthOffset: 0.058,
        isSlateGrey: i % 2 === 0,
      });

      // Surrounding Angled Polygon Sections (4 interlocking trapezoids/pentagons framing the central hexagon)
      const g = 0.065;
      panels.push({
        geo: buildWallPolygonGeo(
          [
            [z0, yMid + g * 0.6],
            [zMid - hexR - g, yMid + g * 0.6],
            [zMid - hexR * 0.5 - g * 0.5, yMid + hexRy + g],
            [zMid - g * 0.4, yMid + hexRy + g],
            [zMid - g * 0.4, yTop],
            [z0, yTop],
          ],
          0.052,
          0.01,
        ),
        depthOffset: 0.04,
        isSlateGrey: i % 2 === 1,
      });

      panels.push({
        geo: buildWallPolygonGeo(
          [
            [zMid + g * 0.4, yMid + hexRy + g],
            [zMid + hexR * 0.5 + g * 0.5, yMid + hexRy + g],
            [zMid + hexR + g, yMid + g * 0.6],
            [z1, yMid + g * 0.6],
            [z1, yTop],
            [zMid + g * 0.4, yTop],
          ],
          0.052,
          0.01,
        ),
        depthOffset: 0.04,
        isSlateGrey: i % 2 === 0,
      });

      panels.push({
        geo: buildWallPolygonGeo(
          [
            [z0, yBot],
            [zMid - g * 0.4, yBot],
            [zMid - g * 0.4, yMid - hexRy - g],
            [zMid - hexR * 0.5 - g * 0.5, yMid - hexRy - g],
            [zMid - hexR - g, yMid - g * 0.6],
            [z0, yMid - g * 0.6],
          ],
          0.052,
          0.01,
        ),
        depthOffset: 0.04,
        isSlateGrey: i % 2 === 0,
      });

      panels.push({
        geo: buildWallPolygonGeo(
          [
            [zMid + g * 0.4, yBot],
            [z1, yBot],
            [z1, yMid - g * 0.6],
            [zMid + hexR + g, yMid - g * 0.6],
            [zMid + hexR * 0.5 + g * 0.5, yMid - hexRy - g],
            [zMid + g * 0.4, yMid - hexRy - g],
          ],
          0.052,
          0.01,
        ),
        depthOffset: 0.04,
        isSlateGrey: i % 2 === 1,
      });

      // Brushed Dark-Aluminum Trims Along Bay Dividers & Upper/Lower Hexagon Angled Ribs
      if (i > 0) {
        const zDiv = zMin + i * bayLen;
        trimBars.push({ startZY: [zDiv, yBot], endZY: [zDiv, yTop] });
        // Crisp Recessed Ice-White Vertical LED Strip Beside Bay Trim
        ledStrips.push({
          startZY: [zDiv - 0.05, yBot + 0.35],
          endZY: [zDiv - 0.05, yTop - 0.25],
          isBlue: false,
        });
      }

      // Brushed Dark-Aluminum Perimeter Bars Framing the Hexagon Angles
      trimBars.push(
        { startZY: hexPts[0], endZY: hexPts[1] },
        { startZY: hexPts[1], endZY: hexPts[2] },
        { startZY: hexPts[2], endZY: hexPts[3] },
        { startZY: hexPts[3], endZY: hexPts[4] },
        { startZY: hexPts[4], endZY: hexPts[5] },
        { startZY: hexPts[5], endZY: hexPts[0] },
      );

      // Crisp Recessed Ice-White & Subtle Cobalt-Blue LED Strips Along Select Angled Hexagon Edges
      ledStrips.push(
        { startZY: hexPts[0], endZY: hexPts[1], isBlue: i % 2 === 1 },
        { startZY: hexPts[2], endZY: hexPts[3], isBlue: i % 2 === 0 },
      );
      if (i % 2 === 0) {
        ledStrips.push({ startZY: hexPts[4], endZY: hexPts[5], isBlue: true });
      }
    }

    // Continuous Brushed Dark-Aluminum Upper & Lower Horizontal Datum Trims
    trimBars.push(
      { startZY: [zMin, yBot], endZY: [zMax, yBot] },
      { startZY: [zMin, yTop], endZY: [zMax, yTop] },
    );

    return { panels, trimBars, ledStrips, zMin, zMax };
  }, [sideLightStyle, L, H]);

  useEffect(() => {
    return () => {
      polarAuroraWall?.panels.forEach((p) => p.geo.dispose());
    };
  }, [polarAuroraWall]);

  // IMAX Obsidian Amber: Subtle 3D Origami-Folded Triangular & Trapezoidal Acoustic Fabric Panels (Graphite-Black & Deep Ocean-Teal) with Satin-Black Shadow Gaps + Warm-Tungsten & Soft Cyan Crease LEDs
  const obsidianAmberWall = useMemo(() => {
    if (sideLightStyle !== 'horizon_tier_strips') return null;
    const zMin = -L * 0.36; // Keep front wall bay clean for illuminated blue IMAX emblem
    const zMax = L * 0.455;
    const yBot = 0.24;
    const yTop = H - 1.3; // Leave upper wall band clear for symmetrical black IMAX surrounds
    const bayCount = 5;
    const bayLen = (zMax - zMin) / bayCount;
    const gap = 0.055; // Satin-black shadow gap between bays & panels

    const facets: {
      geo: THREE.BufferGeometry;
      tone: 'graphite' | 'teal';
    }[] = [];
    const shadowGaps: { startZY: [number, number]; endZY: [number, number] }[] = [];
    const creaseLeds: { startZY: [number, number]; endZY: [number, number]; isCyan: boolean }[] = [];

    for (let i = 0; i < bayCount; i++) {
      const z0 = zMin + i * bayLen + gap;
      const z1 = zMin + (i + 1) * bayLen - gap;
      const zMid = THREE.MathUtils.lerp(z0, z1, i % 2 === 0 ? 0.56 : 0.44);
      const yMidL = THREE.MathUtils.lerp(yBot, yTop, i % 2 === 0 ? 0.42 : 0.58);
      const yMidR = THREE.MathUtils.lerp(yBot, yTop, i % 2 === 0 ? 0.62 : 0.38);
      const yPeak = THREE.MathUtils.lerp(yMidL, yMidR, 0.5) + (i % 2 === 0 ? 0.35 : -0.35);

      const dLow = 0.03;
      const dMid = 0.095;
      const dPeak = 0.145;

      // Upper-Left Folded Trapezoidal Acoustic Panel
      facets.push({
        geo: buildOrigamiFacetGeo([
          [z0, yMidL + 0.03, dMid],
          [zMid - 0.025, yPeak + 0.03, dPeak],
          [zMid - 0.025, yTop, dLow],
          [z0, yTop, dLow],
        ]),
        tone: i % 2 === 0 ? 'graphite' : 'teal',
      });

      // Upper-Right Folded Triangular Acoustic Panel
      facets.push({
        geo: buildOrigamiFacetGeo([
          [zMid + 0.025, yPeak + 0.03, dPeak],
          [z1, yMidR + 0.03, dMid],
          [z1, yTop, dLow],
          [zMid + 0.025, yTop, dLow],
        ]),
        tone: i % 2 === 0 ? 'teal' : 'graphite',
      });

      // Center Folded Triangular Origami Crest (connecting mid ridge)
      facets.push({
        geo: buildOrigamiFacetGeo([
          [z0 + 0.04, yMidL - 0.01, dLow],
          [zMid, yPeak, dPeak],
          [z1 - 0.04, yMidR - 0.01, dLow],
        ]),
        tone: i % 2 === 0 ? 'teal' : 'graphite',
      });

      // Lower-Left Folded Trapezoidal Acoustic Panel
      facets.push({
        geo: buildOrigamiFacetGeo([
          [z0, yBot, dLow],
          [zMid - 0.025, yBot, dLow],
          [zMid - 0.025, yPeak - 0.04, dPeak * 0.88],
          [z0, yMidL - 0.04, dMid],
        ]),
        tone: i % 2 === 0 ? 'graphite' : 'teal',
      });

      // Lower-Right Folded Trapezoidal Acoustic Panel
      facets.push({
        geo: buildOrigamiFacetGeo([
          [zMid + 0.025, yBot, dLow],
          [z1, yBot, dLow],
          [z1, yMidR - 0.04, dMid],
          [zMid + 0.025, yPeak - 0.04, dPeak * 0.88],
        ]),
        tone: 'graphite',
      });

      // Clean Satin-Black Shadow-Gap Bars Separating Bays
      if (i > 0) {
        const zDiv = zMin + i * bayLen;
        shadowGaps.push({ startZY: [zDiv, yBot], endZY: [zDiv, yTop] });
      }

      // Warm-Tungsten & Soft Cyan Linear LED Strips Tucked Cleanly Along Select Origami Panel Creases
      creaseLeds.push({
        startZY: [z0 + 0.08, yMidL + 0.02],
        endZY: [zMid, yPeak + 0.01],
        isCyan: false,
      });
      if (i % 2 === 1 || i === 0) {
        creaseLeds.push({
          startZY: [zMid, yPeak + 0.01],
          endZY: [z1 - 0.08, yMidR + 0.02],
          isCyan: true,
        });
      }
    }

    return { facets, shadowGaps, creaseLeds, zMin, zMax };
  }, [sideLightStyle, L, H]);

  useEffect(() => {
    return () => {
      obsidianAmberWall?.facets.forEach((f) => f.geo.dispose());
    };
  }, [obsidianAmberWall]);

  // Dolby Obsidian Reference: Charcoal-Black & Midnight-Slate Acoustic Panels Divided by Brushed Gunmetal Trims + Dolby-Blue & Soft Warm-White LED Strips
  const dolbyObsidianWall = useMemo(() => {
    if (sideLightStyle !== 'obsidian_slat_grazers') return null;
    const zMin = -L * 0.455;
    const zMax = L * 0.455;
    const yBot = 0.24;
    const yTop = H - 0.3;
    const bayCount = 5;
    const bayLen = (zMax - zMin) / bayCount;
    const seam = 0.028;

    const panels: { geo: THREE.BufferGeometry; depthOffset: number; isMidnightSlate: boolean }[] = [];
    const trimBars: { startZY: [number, number]; endZY: [number, number] }[] = [];
    const ledStrips: { startZY: [number, number]; endZY: [number, number]; isWarmWhite: boolean }[] = [];

    for (let i = 0; i < bayCount; i++) {
      const zFront = zMin + i * bayLen + seam * 0.5;
      const zBack = zMin + (i + 1) * bayLen - seam * 0.5;
      const zMid = (zFront + zBack) * 0.5;

      // Balanced diagonal architectural division rising toward rear stadium rows
      const yDiagFront = THREE.MathUtils.lerp(yBot, yTop, 0.34);
      const yDiagBack = THREE.MathUtils.lerp(yBot, yTop, 0.54);
      const yLowerBand = THREE.MathUtils.lerp(yBot, yTop, 0.24);

      // Upper acoustic fabric bay (split cleanly along crisp diagonal)
      panels.push({
        geo: buildWallPolygonGeo(
          [
            [zFront, yDiagFront + 0.025],
            [zBack, yDiagBack + 0.025],
            [zBack, yTop],
            [zFront, yTop],
          ],
          0.056,
          0.01,
        ),
        depthOffset: 0.044,
        isMidnightSlate: i % 2 === 0,
      });

      // Mid acoustic fabric wedge
      panels.push({
        geo: buildWallPolygonGeo(
          [
            [zFront, yLowerBand + 0.02],
            [zBack, yLowerBand + 0.02],
            [zBack, yDiagBack - 0.025],
            [zFront, yDiagFront - 0.025],
          ],
          0.048,
          0.01,
        ),
        depthOffset: 0.038,
        isMidnightSlate: i % 2 === 1,
      });

      // Lower charcoal-black acoustic wainscot bay
      panels.push({
        geo: buildWallPolygonGeo(
          [
            [zFront, yBot],
            [zBack, yBot],
            [zBack, yLowerBand - 0.02],
            [zFront, yLowerBand - 0.02],
          ],
          0.052,
          0.01,
        ),
        depthOffset: 0.04,
        isMidnightSlate: false,
      });

      // Clean diagonal brushed gunmetal trim dividing the upper and mid bays
      trimBars.push({
        startZY: [zFront, yDiagFront],
        endZY: [zBack, yDiagBack],
      });

      // Clean horizontal brushed gunmetal trim along lower wainscot seam
      trimBars.push({
        startZY: [zFront, yLowerBand],
        endZY: [zBack, yLowerBand],
      });

      // Sleek recessed Dolby-blue linear LED light strip tracing the diagonal seam
      ledStrips.push({
        startZY: [zFront + 0.16, THREE.MathUtils.lerp(yDiagFront, yDiagBack, 0.06) + 0.06],
        endZY: [zBack - 0.16, THREE.MathUtils.lerp(yDiagFront, yDiagBack, 0.94) + 0.06],
        isWarmWhite: false,
      });

      // Soft warm-white recessed linear LED accent at top architectural reveal
      ledStrips.push({
        startZY: [zFront + 0.22, yTop - 0.06],
        endZY: [zBack - 0.22, yTop - 0.06],
        isWarmWhite: true,
      });

      // Vertical brushed gunmetal divider trim between architectural bays
      if (i < bayCount - 1) {
        const zDivider = zBack + seam * 0.5;
        trimBars.push({
          startZY: [zDivider, yBot],
          endZY: [zDivider, yTop],
        });
        // Crisp recessed vertical Dolby-blue or warm-white light strip beside divider
        ledStrips.push({
          startZY: [zDivider - 0.055, yLowerBand + 0.15],
          endZY: [zDivider - 0.055, yTop - 0.25],
          isWarmWhite: i % 2 === 1,
        });
      }

      // Subtle mid-bay brushed gunmetal accent bar on alternating bays
      if (i % 2 === 0) {
        trimBars.push({
          startZY: [zMid, yLowerBand + 0.02],
          endZY: [zMid, yTop - 0.02],
        });
      }
    }

    return { panels, trimBars, ledStrips, yBot, yTop, zMin, zMax };
  }, [sideLightStyle, L, H]);

  useEffect(() => {
    return () => {
      dolbyObsidianWall?.panels.forEach((p) => p.geo.dispose());
    };
  }, [dolbyObsidianWall]);

  // Dolby Cobalt Noir: Balanced Horizontal Charcoal-Slate Acoustic Panels & Warm Dark Walnut-Bronze Wood Slats Separated by Satin-Black Trims + Warm-Amber & Soft Cool-Blue LEDs
  const dolbyCobaltWall = useMemo(() => {
    if (sideLightStyle !== 'diagonal_parabolic_ribs') return null;
    const zMin = -L * 0.45;
    const zMax = L * 0.45;
    const yBot = 0.24;
    const yTop = H - 0.32;
    const yBand1Top = THREE.MathUtils.lerp(yBot, yTop, 0.24);
    const yBand2Bot = yBand1Top + 0.055;
    const yBand2Top = THREE.MathUtils.lerp(yBot, yTop, 0.62);
    const yBand3Bot = yBand2Top + 0.055;

    const bayCount = 5;
    const bayLen = (zMax - zMin) / bayCount;
    const seam = 0.05;

    const fabricPanels: { posZY: [number, number]; lengthZ: number; heightY: number; depth: number }[] = [];
    const woodSlats: { z: number; yMid: number; heightY: number }[] = [];
    const satinTrims: { posZY: [number, number]; lengthZ: number; heightY: number }[] = [];
    const ledStrips: { startZY: [number, number]; endZY: [number, number]; isCoolBlue: boolean }[] = [];

    // Continuous clean horizontal satin-black trim rails separating the 3 horizontal tiers
    satinTrims.push({
      posZY: [(zMin + zMax) * 0.5, (yBand1Top + yBand2Bot) * 0.5],
      lengthZ: zMax - zMin + 0.08,
      heightY: 0.065,
    });
    satinTrims.push({
      posZY: [(zMin + zMax) * 0.5, (yBand2Top + yBand3Bot) * 0.5],
      lengthZ: zMax - zMin + 0.08,
      heightY: 0.065,
    });
    satinTrims.push({
      posZY: [(zMin + zMax) * 0.5, yTop + 0.025],
      lengthZ: zMax - zMin + 0.08,
      heightY: 0.06,
    });

    // Sleek recessed warm-amber linear LED strips along the main horizontal seam lines
    ledStrips.push({
      startZY: [zMin + 0.2, yBand2Bot - 0.015],
      endZY: [zMax - 0.2, yBand2Bot - 0.015],
      isCoolBlue: false,
    });
    ledStrips.push({
      startZY: [zMin + 0.2, yBand2Top + 0.015],
      endZY: [zMax - 0.2, yBand2Top + 0.015],
      isCoolBlue: false,
    });
    // Soft cool-blue recessed linear LED accent along upper architectural cove reveal
    ledStrips.push({
      startZY: [zMin + 0.2, yTop - 0.02],
      endZY: [zMax - 0.2, yTop - 0.02],
      isCoolBlue: true,
    });

    for (let i = 0; i < bayCount; i++) {
      const zFront = zMin + i * bayLen + seam * 0.5;
      const zBack = zMin + (i + 1) * bayLen - seam * 0.5;
      const zMid = (zFront + zBack) * 0.5;
      const wZ = zBack - zFront;

      // Mid-upper horizontal charcoal-slate acoustic fabric frieze (framing symmetrical Dolby Atmos speakers cleanly)
      fabricPanels.push({
        posZY: [zMid, (yBand2Bot + yBand2Top) * 0.5],
        lengthZ: wZ,
        heightY: yBand2Top - yBand2Bot - 0.02,
        depth: 0.054,
      });

      // Alternate charcoal-slate fabric panels and warm dark walnut-bronze vertical slat bays in upper & lower horizontal bands
      if (i % 2 === 0) {
        // Upper bay: warm dark walnut-bronze vertical wood acoustic slats
        const slatCount = 11;
        const slatStep = (wZ - 0.16) / (slatCount - 1);
        for (let s = 0; s < slatCount; s++) {
          woodSlats.push({
            z: zFront + 0.08 + s * slatStep,
            yMid: (yBand3Bot + yTop) * 0.5,
            heightY: yTop - yBand3Bot - 0.04,
          });
        }
        // Lower bay: charcoal-slate acoustic fabric
        fabricPanels.push({
          posZY: [zMid, (yBot + yBand1Top) * 0.5],
          lengthZ: wZ,
          heightY: yBand1Top - yBot - 0.02,
          depth: 0.056,
        });
      } else {
        // Upper bay: charcoal-slate acoustic fabric
        fabricPanels.push({
          posZY: [zMid, (yBand3Bot + yTop) * 0.5],
          lengthZ: wZ,
          heightY: yTop - yBand3Bot - 0.03,
          depth: 0.056,
        });
        // Lower bay: warm dark walnut-bronze vertical wood acoustic slats
        const slatCount = 11;
        const slatStep = (wZ - 0.16) / (slatCount - 1);
        for (let s = 0; s < slatCount; s++) {
          woodSlats.push({
            z: zFront + 0.08 + s * slatStep,
            yMid: (yBot + yBand1Top) * 0.5,
            heightY: yBand1Top - yBot - 0.04,
          });
        }
      }

      // Vertical satin-black trim mullions between bays + recessed vertical accent LEDs
      if (i < bayCount - 1) {
        const zDiv = zBack + seam * 0.5;
        satinTrims.push({
          posZY: [zDiv, (yBot + yTop) * 0.5],
          lengthZ: 0.065,
          heightY: yTop - yBot + 0.04,
        });
        ledStrips.push({
          startZY: [zDiv, yBand3Bot + 0.08],
          endZY: [zDiv, yTop - 0.08],
          isCoolBlue: i % 2 === 0,
        });
      }
    }

    return { fabricPanels, woodSlats, satinTrims, ledStrips };
  }, [sideLightStyle, L, H]);

  // Dolby Cobalt Veil 250: Continuous Interlocked Faceted 3D Architectural Blocks + Sweeping Molten-Amber & Dual Celestial-Violet Indirect Cove Waves (with Open Rear Projection Window)
  const cobaltVeilWall = useMemo(() => {
    if (sideLightStyle !== 'cobalt_veil_laser_recess') return null;
    const zMin = -L * 0.482;
    const zMax = L * 0.482;
    const wallLen = zMax - zMin;
    const zCenter = (zMin + zMax) * 0.5;
    const yFloor = 0.14;
    const yCeil = H - 0.22;

    const boothY = Math.min(H - 1.4, topTierY + 3.25);
    const boothWinW = Math.min(4.8, W * 0.42);
    const boothWinH = Math.min(1.42, H * 0.24);
    const winTop = Math.min(H - 0.28, boothY + boothWinH / 2);
    const winBot = Math.max(0.25, boothY - boothWinH / 2);

    type Vec3 = [number, number, number];
    type Vec2 = [number, number];

    const pushOrientedTri = (
      pos: number[],
      norm: number[],
      uv: number[],
      a: Vec3,
      b: Vec3,
      c: Vec3,
      uvA: Vec2,
      uvB: Vec2,
      uvC: Vec2,
      desiredNormal: Vec3,
    ) => {
      const abx = b[0] - a[0], aby = b[1] - a[1], abz = b[2] - a[2];
      const acx = c[0] - a[0], acy = c[1] - a[1], acz = c[2] - a[2];
      let nx = aby * acz - abz * acy;
      let ny = abz * acx - abx * acz;
      let nz = abx * acy - aby * acx;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;
      const dot = nx * desiredNormal[0] + ny * desiredNormal[1] + nz * desiredNormal[2];
      if (dot >= 0) {
        pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
        norm.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
        uv.push(uvA[0], uvA[1], uvB[0], uvB[1], uvC[0], uvC[1]);
      } else {
        pos.push(a[0], a[1], a[2], c[0], c[1], c[2], b[0], b[1], b[2]);
        norm.push(-nx, -ny, -nz, -nx, -ny, -nz, -nx, -ny, -nz);
        uv.push(uvA[0], uvA[1], uvC[0], uvC[1], uvB[0], uvB[1]);
      }
    };

    const makeBufferGeo = (pos: number[], norm: number[], uv: number[]) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      return geo;
    };

    // Build faceted 3D angular block prism along side wall (axis = 'side', +xSign inward) or rear wall (axis = 'rear', -z inward)
    const appendFacetedBlock = (
      pos: number[],
      norm: number[],
      uv: number[],
      ptsUV: [number, number][], // 4 corners in (horiz, vert) plane
      depthBase: number,
      cornerTilts: [number, number, number, number],
      axis: 'side' | 'rear',
      dirSign: number, // +1 for left wall (+X), -1 for right wall (-X), -1 for rear wall (-Z)
    ) => {
      const cx = (ptsUV[0][0] + ptsUV[1][0] + ptsUV[2][0] + ptsUV[3][0]) * 0.25;
      const cy = (ptsUV[0][1] + ptsUV[1][1] + ptsUV[2][1] + ptsUV[3][1]) * 0.25;
      const insetScale = 0.978;
      const bevelScale = 0.945;

      const backPts: Vec2[] = ptsUV.map(([h, v]) => [
        cx + (h - cx) * insetScale,
        cy + (v - cy) * insetScale,
      ]);
      const frontPts: Vec2[] = ptsUV.map(([h, v]) => [
        cx + (h - cx) * bevelScale,
        cy + (v - cy) * bevelScale,
      ]);

      const to3D = (h: number, v: number, d: number): Vec3 =>
        axis === 'side' ? [dirSign * d, v, h] : [h, v, dirSign * d];

      const back3D = backPts.map(([h, v]) => to3D(h, v, 0.01));
      const front3D = frontPts.map(([h, v], idx) =>
        to3D(h, v, Math.max(0.055, depthBase + cornerTilts[idx])),
      );

      const frontNormal: Vec3 = axis === 'side' ? [dirSign, 0, 0] : [0, 0, dirSign];
      const fUV = frontPts.map(([h, v]): Vec2 => [h * 0.65, v * 0.65]);
      const bUV = backPts.map(([h, v]): Vec2 => [h * 0.65, v * 0.65]);

      // Front faceted face (split into 2 crisp triangles so tilted corner creates angular stone/carbon facet)
      pushOrientedTri(pos, norm, uv, front3D[0], front3D[1], front3D[2], fUV[0], fUV[1], fUV[2], frontNormal);
      pushOrientedTri(pos, norm, uv, front3D[0], front3D[2], front3D[3], fUV[0], fUV[2], fUV[3], frontNormal);

      // 4 Chamfered bevel side walls connecting back base to front face
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        const eh = (backPts[i][0] + backPts[j][0]) * 0.5 - cx;
        const ev = (backPts[i][1] + backPts[j][1]) * 0.5 - cy;
        const sideDesired: Vec3 =
          axis === 'side' ? [dirSign * 0.25, ev, eh] : [eh, ev, dirSign * 0.25];
        pushOrientedTri(pos, norm, uv, back3D[i], back3D[j], front3D[j], bUV[i], bUV[j], fUV[j], sideDesired);
        pushOrientedTri(pos, norm, uv, back3D[i], front3D[j], front3D[i], bUV[i], fUV[j], fUV[i], sideDesired);
      }
    };

    // Deterministic pseudo-random helper for organic angular facets
    const hash = (a: number, b: number, c: number) => {
      const s = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453;
      return s - Math.floor(s);
    };

    // Populate a continuous region bounded smoothly by [yBotFn(u), yTopFn(u)] with interlocked faceted blocks
    const populateFacetZone = (
      buckets: { pos: number[]; norm: number[]; uv: number[] }[],
      hStart: number,
      hEnd: number,
      yBotFn: (u: number) => number,
      yTopFn: (u: number) => number,
      numRows: number,
      colsCount: number,
      axis: 'side' | 'rear',
      dirSign: number,
      seedBase: number,
    ) => {
      const span = hEnd - hStart;
      if (span < 0.45) return;

      for (let r = 0; r < numRows; r++) {
        const r0 = r / numRows;
        const r1 = (r + 1) / numRows;
        const stagger = (r % 2) * 0.42;

        for (let c = 0; c < colsCount; c++) {
          const uA0 = THREE.MathUtils.clamp((c + (c > 0 ? stagger * 0.35 : 0)) / colsCount, 0, 1);
          const uB0 = THREE.MathUtils.clamp((c + 1 + (c + 1 < colsCount ? stagger * 0.35 : 0)) / colsCount, 0, 1);
          // Slanted diagonal end-cuts for authentic architectural polygonal facets
          const shear0 = c > 0 ? (hash(r, c, seedBase + 1) - 0.5) * (0.42 / colsCount) : 0;
          const shear1 = c + 1 < colsCount ? (hash(r, c + 1, seedBase + 2) - 0.5) * (0.42 / colsCount) : 0;

          const uBotL = THREE.MathUtils.clamp(uA0 - shear0, 0, 1);
          const uBotR = THREE.MathUtils.clamp(uB0 - shear1, 0, 1);
          const uTopR = THREE.MathUtils.clamp(uB0 + shear1, 0, 1);
          const uTopL = THREE.MathUtils.clamp(uA0 + shear0, 0, 1);

          if (uBotR - uBotL < 0.012 || uTopR - uTopL < 0.012) continue;

          const hBotL = THREE.MathUtils.lerp(hStart, hEnd, uBotL);
          const hBotR = THREE.MathUtils.lerp(hStart, hEnd, uBotR);
          const hTopR = THREE.MathUtils.lerp(hStart, hEnd, uTopR);
          const hTopL = THREE.MathUtils.lerp(hStart, hEnd, uTopL);

          const yBotL = THREE.MathUtils.lerp(yBotFn(uBotL), yTopFn(uBotL), r0);
          const yBotR = THREE.MathUtils.lerp(yBotFn(uBotR), yTopFn(uBotR), r0);
          const yTopR = THREE.MathUtils.lerp(yBotFn(uTopR), yTopFn(uTopR), r1);
          const yTopL = THREE.MathUtils.lerp(yBotFn(uTopL), yTopFn(uTopL), r1);

          if (yTopL - yBotL < 0.16 || yTopR - yBotR < 0.16) continue;

          const rndMat = hash(r, c, seedBase + 5);
          const bucketIdx = rndMat < 0.36 ? 0 : rndMat < 0.72 ? 1 : 2;
          const depthBase = 0.095 + hash(r, c, seedBase + 9) * 0.135;
          const t0 = (hash(r, c, seedBase + 11) - 0.5) * 0.055;
          const t1 = (hash(r, c, seedBase + 13) - 0.5) * 0.055;
          const t2 = (hash(r, c, seedBase + 17) - 0.5) * 0.055;
          const t3 = (hash(r, c, seedBase + 19) - 0.5) * 0.055;

          appendFacetedBlock(
            buckets[bucketIdx].pos,
            buckets[bucketIdx].norm,
            buckets[bucketIdx].uv,
            [
              [hBotL, yBotL],
              [hBotR, yBotR],
              [hTopR, yTopR],
              [hTopL, yTopL],
            ],
            depthBase,
            [t0, t1, t2, t3],
            axis,
            dirSign,
          );
        }
      }
    };

    // Build curved concave indirect architectural cove wash mesh (v=0 at recessed LED lip, v=1 at outer protruding ridge)
    const buildCoveWashRibbon = (
      hStart: number,
      hEnd: number,
      yBotFn: (u: number) => number,
      height: number,
      axis: 'side' | 'rear',
      dirSign: number,
      uSegs = 64,
      vSegs = 7,
    ) => {
      const pos: number[] = [];
      const norm: number[] = [];
      const uv: number[] = [];
      const desiredN: Vec3 = axis === 'side' ? [dirSign, 0, 0] : [0, 0, dirSign];

      const ptAt = (u: number, v: number): Vec3 => {
        const h = THREE.MathUtils.lerp(hStart, hEnd, u);
        const y = yBotFn(u) + v * height;
        const d = 0.032 + 0.145 * Math.sin(v * Math.PI * 0.52);
        return axis === 'side' ? [dirSign * d, y, h] : [h, y, dirSign * d];
      };

      for (let i = 0; i < uSegs; i++) {
        const u0 = i / uSegs;
        const u1 = (i + 1) / uSegs;
        for (let j = 0; j < vSegs; j++) {
          const v0 = j / vSegs;
          const v1 = (j + 1) / vSegs;
          const a = ptAt(u0, v0);
          const b = ptAt(u1, v0);
          const c = ptAt(u1, v1);
          const d = ptAt(u0, v1);
          pushOrientedTri(pos, norm, uv, a, b, c, [u0, v0], [u1, v0], [u1, v1], desiredN);
          pushOrientedTri(pos, norm, uv, a, c, d, [u0, v0], [u1, v1], [u0, v1], desiredN);
        }
      }
      return makeBufferGeo(pos, norm, uv);
    };

    // Thin indirect LED lip tucked inside the bottom cove crease
    const buildCoveEmitterStrip = (
      hStart: number,
      hEnd: number,
      yFn: (u: number) => number,
      axis: 'side' | 'rear',
      dirSign: number,
      radius = 0.022,
      segs = 64,
    ) => {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= segs; i++) {
        const u = i / segs;
        const h = THREE.MathUtils.lerp(hStart, hEnd, u);
        const y = yFn(u) + 0.024;
        const d = dirSign * 0.046;
        pts.push(axis === 'side' ? new THREE.Vector3(d, y, h) : new THREE.Vector3(h, y, d));
      }
      return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), segs, radius, 6, false);
    };

    const waveAt = (u: number) => getDolbyVeilWaveHeights(u, H, topTierY);
    const colsSide = Math.max(12, Math.round(wallLen / 1.85));

    // Build Left (dirSign = +1) & Right (dirSign = -1) side walls independently with exact outward normals
    const buildSideWallGeos = (dirSign: 1 | -1) => {
      const buckets = [
        { pos: [] as number[], norm: [] as number[], uv: [] as number[] }, // 0: carbonFiber
        { pos: [] as number[], norm: [] as number[], uv: [] as number[] }, // 1: charcoalSuede
        { pos: [] as number[], norm: [] as number[], uv: [] as number[] }, // 2: charcoalSlate
      ];

      // Zone 1: Below Amber Cove
      populateFacetZone(buckets, zMin, zMax, () => yFloor, (u) => waveAt(u).amberBotY - 0.015, 3, colsSide, 'side', dirSign, 11);
      // Zone 2: Between Amber Ridge & Lower Violet Cove (Surround Speakers sit here)
      populateFacetZone(buckets, zMin, zMax, (u) => waveAt(u).amberTopY + 0.015, (u) => waveAt(u).violet1BotY - 0.015, 3, colsSide, 'side', dirSign, 23);
      // Zone 3: Between Lower Violet & Upper Violet Coves
      populateFacetZone(buckets, zMin, zMax, (u) => waveAt(u).violet1TopY + 0.015, (u) => waveAt(u).violet2BotY - 0.015, 2, colsSide, 'side', dirSign, 37);
      // Zone 4: Upper Wall Above Upper Violet Cove to Ceiling
      populateFacetZone(buckets, zMin, zMax, (u) => waveAt(u).violet2TopY + 0.015, () => yCeil, 3, colsSide, 'side', dirSign, 53);

      return {
        carbonGeo: makeBufferGeo(buckets[0].pos, buckets[0].norm, buckets[0].uv),
        suedeGeo: makeBufferGeo(buckets[1].pos, buckets[1].norm, buckets[1].uv),
        slateGeo: makeBufferGeo(buckets[2].pos, buckets[2].norm, buckets[2].uv),
        amberCoveGeo: buildCoveWashRibbon(zMin, zMax, (u) => waveAt(u).amberBotY, 0.72, 'side', dirSign),
        violet1CoveGeo: buildCoveWashRibbon(zMin, zMax, (u) => waveAt(u).violet1BotY, 0.38, 'side', dirSign),
        violet2CoveGeo: buildCoveWashRibbon(zMin, zMax, (u) => waveAt(u).violet2BotY, 0.38, 'side', dirSign),
        amberLipGeo: buildCoveEmitterStrip(zMin, zMax, (u) => waveAt(u).amberBotY, 'side', dirSign, 0.024),
        violet1LipGeo: buildCoveEmitterStrip(zMin, zMax, (u) => waveAt(u).violet1BotY, 'side', dirSign, 0.02),
        violet2LipGeo: buildCoveEmitterStrip(zMin, zMax, (u) => waveAt(u).violet2BotY, 'side', dirSign, 0.02),
      };
    };

    const leftWall = buildSideWallGeos(1);
    const rightWall = buildSideWallGeos(-1);

    // Rear wall sculpted faceted blocks & cove continuations built strictly on LEFT & RIGHT wings around booth window & rear entrance doors
    const wingMinX = -W * 0.5 + 0.24;
    const wingMaxX = W * 0.5 - 0.24;
    const boothClearHalfW = boothWinW * 0.5 + 0.14;
    const doorClearHalfW = 1.38;
    const wingOuterLim = Math.max(boothClearHalfW + 0.5, wingMaxX);

    const rearBuckets = [
      { pos: [] as number[], norm: [] as number[], uv: [] as number[] },
      { pos: [] as number[], norm: [] as number[], uv: [] as number[] },
      { pos: [] as number[], norm: [] as number[], uv: [] as number[] },
    ];

    const rearEndWaves = waveAt(1.0);
    const buildRearWingCoves: THREE.BufferGeometry[] = [];
    const buildRearWingViolets: THREE.BufferGeometry[] = [];
    const buildRearWingAmberLips: THREE.BufferGeometry[] = [];
    const buildRearWingVioletLips: THREE.BufferGeometry[] = [];

    ([-1, 1] as const).forEach((wSide) => {
      const x0 = wSide === -1 ? wingMinX : boothClearHalfW;
      const x1 = wSide === -1 ? -boothClearHalfW : wingOuterLim;
      if (x1 - x0 < 0.8) return;
      const wingCols = Math.max(4, Math.round((x1 - x0) / 1.8));
      const yWingBot = Math.max(yFloor, topTierY - 0.15);

      const wingAmberBot = (u: number) => {
        const edgeFactor = wSide === -1 ? u : 1 - u;
        return rearEndWaves.amberBotY - edgeFactor * 0.25;
      };
      const wingViolet1Bot = (u: number) => {
        const edgeFactor = wSide === -1 ? u : 1 - u;
        return rearEndWaves.violet1BotY + edgeFactor * 0.18;
      };
      const wingViolet2Bot = (u: number) => {
        const edgeFactor = wSide === -1 ? u : 1 - u;
        return rearEndWaves.violet2BotY + edgeFactor * 0.16;
      };

      populateFacetZone(rearBuckets, x0, x1, () => yWingBot, (u) => wingAmberBot(u) - 0.015, 2, wingCols, 'rear', -1, 71 + wSide);
      populateFacetZone(rearBuckets, x0, x1, (u) => wingAmberBot(u) + 0.735, (u) => wingViolet1Bot(u) - 0.015, 2, wingCols, 'rear', -1, 83 + wSide);
      populateFacetZone(rearBuckets, x0, x1, (u) => wingViolet1Bot(u) + 0.395, (u) => wingViolet2Bot(u) - 0.015, 2, wingCols, 'rear', -1, 97 + wSide);
      populateFacetZone(rearBuckets, x0, x1, (u) => wingViolet2Bot(u) + 0.395, () => yCeil, 2, wingCols, 'rear', -1, 109 + wSide);

      buildRearWingCoves.push(buildCoveWashRibbon(x0, x1, wingAmberBot, 0.72, 'rear', -1, 20, 6));
      buildRearWingViolets.push(buildCoveWashRibbon(x0, x1, wingViolet1Bot, 0.38, 'rear', -1, 20, 6));
      buildRearWingViolets.push(buildCoveWashRibbon(x0, x1, wingViolet2Bot, 0.38, 'rear', -1, 20, 6));
      buildRearWingAmberLips.push(buildCoveEmitterStrip(x0, x1, wingAmberBot, 'rear', -1, 0.024, 20));
      buildRearWingVioletLips.push(buildCoveEmitterStrip(x0, x1, wingViolet1Bot, 'rear', -1, 0.02, 20));
      buildRearWingVioletLips.push(buildCoveEmitterStrip(x0, x1, wingViolet2Bot, 'rear', -1, 0.02, 20));
    });

    // Narrow lower cheeks between rear entrance doors and wing inner edge (never blocking doors or booth window)
    if (boothClearHalfW > doorClearHalfW + 0.35) {
      ([-1, 1] as const).forEach((wSide) => {
        const cx0 = wSide === -1 ? -boothClearHalfW : doorClearHalfW;
        const cx1 = wSide === -1 ? -doorClearHalfW : boothClearHalfW;
        populateFacetZone(
          rearBuckets,
          cx0,
          cx1,
          () => Math.max(yFloor, topTierY - 0.15),
          () => Math.max(yFloor + 1.2, winBot - 0.08),
          2,
          2,
          'rear',
          -1,
          131 + wSide,
        );
      });
    }

    // Upper rear spandrel strictly ABOVE the booth window (winTop + 0.14 .. yCeil)
    if (yCeil - (winTop + 0.16) > 0.4) {
      populateFacetZone(
        rearBuckets,
        -boothClearHalfW,
        boothClearHalfW,
        () => winTop + 0.14,
        () => yCeil,
        2,
        4,
        'rear',
        -1,
        151,
      );
    }

    return {
      zCenter,
      wallLen,
      boothClearHalfW,
      doorClearHalfW,
      winBot,
      winTop,
      yCeil,
      leftWall,
      rightWall,
      rearCarbonGeo: makeBufferGeo(rearBuckets[0].pos, rearBuckets[0].norm, rearBuckets[0].uv),
      rearSuedeGeo: makeBufferGeo(rearBuckets[1].pos, rearBuckets[1].norm, rearBuckets[1].uv),
      rearSlateGeo: makeBufferGeo(rearBuckets[2].pos, rearBuckets[2].norm, rearBuckets[2].uv),
      rearAmberCoves: buildRearWingCoves,
      rearVioletCoves: buildRearWingViolets,
      rearAmberLips: buildRearWingAmberLips,
      rearVioletLips: buildRearWingVioletLips,
    };
  }, [sideLightStyle, W, L, H, topTierY]);

  useEffect(() => {
    return () => {
      if (!cobaltVeilWall) return;
      [cobaltVeilWall.leftWall, cobaltVeilWall.rightWall].forEach((w) => {
        w.carbonGeo.dispose();
        w.suedeGeo.dispose();
        w.slateGeo.dispose();
        w.amberCoveGeo.dispose();
        w.violet1CoveGeo.dispose();
        w.violet2CoveGeo.dispose();
        w.amberLipGeo.dispose();
        w.violet1LipGeo.dispose();
        w.violet2LipGeo.dispose();
      });
      cobaltVeilWall.rearCarbonGeo.dispose();
      cobaltVeilWall.rearSuedeGeo.dispose();
      cobaltVeilWall.rearSlateGeo.dispose();
      cobaltVeilWall.rearAmberCoves.forEach((g) => g.dispose());
      cobaltVeilWall.rearVioletCoves.forEach((g) => g.dispose());
      cobaltVeilWall.rearAmberLips.forEach((g) => g.dispose());
      cobaltVeilWall.rearVioletLips.forEach((g) => g.dispose());
    };
  }, [cobaltVeilWall]);

  // Obsidian Wave 550: Vertical Flowing 3D Parametric S-Wave Acoustic Ribbons (Light Slate, Mid Charcoal & Deep Obsidian) + Curved Neon-Purple Valley Canyons
  const parametricObsidianWall = useMemo(() => {
    if (sideLightStyle !== 'parametric_obsidian_waves') return null;

    type Vec3 = [number, number, number];
    type Vec2 = [number, number];

    const pushTri = (
      pos: number[],
      norm: number[],
      uv: number[],
      a: Vec3,
      b: Vec3,
      c: Vec3,
      uvA: Vec2,
      uvB: Vec2,
      uvC: Vec2,
      desiredNormal: Vec3,
    ) => {
      const abx = b[0] - a[0], aby = b[1] - a[1], abz = b[2] - a[2];
      const acx = c[0] - a[0], acy = c[1] - a[1], acz = c[2] - a[2];
      let nx = aby * acz - abz * acy;
      let ny = abz * acx - abx * acz;
      let nz = abx * acy - aby * acx;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;
      const dot = nx * desiredNormal[0] + ny * desiredNormal[1] + nz * desiredNormal[2];
      if (dot >= 0) {
        pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
        norm.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
        uv.push(uvA[0], uvA[1], uvB[0], uvB[1], uvC[0], uvC[1]);
      } else {
        pos.push(a[0], a[1], a[2], c[0], c[1], c[2], b[0], b[1], b[2]);
        norm.push(-nx, -ny, -nz, -nx, -ny, -nz, -nx, -ny, -nz);
        uv.push(uvA[0], uvA[1], uvC[0], uvC[1], uvB[0], uvB[1]);
      }
    };

    const makeGeo = (pos: number[], norm: number[], uv: number[]) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      return geo;
    };

    // Build a continuous vertical flowing S-wave field along a wall span [hMin..hMax] from yBot..yTop
    // axis = 'side' -> curves in (Z, Y) extruded inward by +dirSign along X
    // axis = 'rear' -> curves in (X, Y) extruded inward by -1 along Z
    const buildVerticalSWaveField = (
      hMin: number,
      hMax: number,
      yBot: number,
      yTop: number,
      ribbonCount: number,
      fissureBoundaryIndices: number[],
      axis: 'side' | 'rear',
      dirSign: number,
      seedOffset: number,
    ) => {
      const vSteps = 44;
      const toneBuckets = [
        { pos: [] as number[], norm: [] as number[], uv: [] as number[] }, // 0: light slate
        { pos: [] as number[], norm: [] as number[], uv: [] as number[] }, // 1: mid charcoal
        { pos: [] as number[], norm: [] as number[], uv: [] as number[] }, // 2: deep obsidian
      ];
      const glowBucket = { pos: [] as number[], norm: [] as number[], uv: [] as number[] };
      const coreBucket = { pos: [] as number[], norm: [] as number[], uv: [] as number[] };

      const span = hMax - hMin;
      const minRibW = Math.max(0.28, (span / ribbonCount) * 0.42);

      // Evaluate monotonic, non-crossing undulating vertical S-wave boundary curves h[row][k]
      const hGrid: number[][] = [];
      for (let r = 0; r <= vSteps; r++) {
        const v = r / vSteps;
        const row: number[] = new Array(ribbonCount + 1);
        row[0] = hMin;
        row[ribbonCount] = hMax;

        for (let k = 1; k < ribbonCount; k++) {
          const u = k / ribbonCount;
          const env = Math.sin(u * Math.PI);
          // Harmonious flowing vertical-diagonal S-curves matching the grand parametric waves
          const sweep =
            (1.38 * Math.sin(v * Math.PI * 1.85 + u * 5.6 + seedOffset) +
              0.62 * Math.sin(v * Math.PI * 3.15 - u * 3.8 + seedOffset * 0.7) +
              1.18 * (v - 0.5) * Math.cos(u * Math.PI * 1.45)) *
            env;
          const target = THREE.MathUtils.lerp(hMin, hMax, u) + sweep * Math.min(1.0, span / 14);
          const minAllowed = row[k - 1] + minRibW;
          const maxAllowed = hMax - (ribbonCount - k) * minRibW;
          row[k] = THREE.MathUtils.clamp(target, minAllowed, maxAllowed);
        }
        // Second smoothing pass from right to left to maintain even minimum spacing
        for (let k = ribbonCount - 1; k >= 1; k--) {
          row[k] = Math.min(row[k], row[k + 1] - minRibW);
        }
        hGrid.push(row);
      }

      const to3D = (h: number, y: number, d: number): Vec3 =>
        axis === 'side' ? [dirSign * d, y, h] : [h, y, dirSign * d];
      const inwardNorm: Vec3 = axis === 'side' ? [dirSign, 0, 0] : [0, 0, dirSign];
      const sideHNorm = (hDir: number): Vec3 =>
        axis === 'side' ? [dirSign * 0.35, 0, hDir] : [hDir, 0, dirSign * 0.35];

      const fissureSet = new Set(fissureBoundaryIndices);
      // Alternating rhythm ensuring strong light/mid/dark tonal cadence across adjacent vertical ribbons
      const toneSequence = [0, 2, 1, 0, 1, 2, 0, 2, 1];

      for (let k = 0; k < ribbonCount; k++) {
        const toneIdx = toneSequence[(k + seedOffset) % toneSequence.length];
        const b = toneBuckets[toneIdx];
        const depthTier = ((k * 5 + seedOffset) % 3) * 0.075 + 0.16;
        const gapHalfLeft = fissureSet.has(k) ? 0.08 : 0.014;
        const gapHalfRight = fissureSet.has(k + 1) ? 0.08 : 0.014;

        for (let r = 0; r < vSteps; r++) {
          const v0 = r / vSteps;
          const v1 = (r + 1) / vSteps;
          const y0 = THREE.MathUtils.lerp(yBot, yTop, v0);
          const y1 = THREE.MathUtils.lerp(yBot, yTop, v1);

          const h0L = hGrid[r][k] + gapHalfLeft;
          const h0R = Math.max(h0L + 0.08, hGrid[r][k + 1] - gapHalfRight);
          const h1L = hGrid[r + 1][k] + gapHalfLeft;
          const h1R = Math.max(h1L + 0.08, hGrid[r + 1][k + 1] - gapHalfRight);

          const h0M = (h0L + h0R) * 0.5;
          const h1M = (h1L + h1R) * 0.5;
          const bevelFrac0 = Math.min(0.055, (h0R - h0L) * 0.16);
          const bevelFrac1 = Math.min(0.055, (h1R - h1L) * 0.16);

          const d0 =
            depthTier +
            0.11 * Math.sin(v0 * Math.PI * 2.25 + k * 0.85 + seedOffset) +
            0.04 * Math.cos(v0 * Math.PI * 4.1 - k * 0.5);
          const d1 =
            depthTier +
            0.11 * Math.sin(v1 * Math.PI * 2.25 + k * 0.85 + seedOffset) +
            0.04 * Math.cos(v1 * Math.PI * 4.1 - k * 0.5);

          // Gently rounded sculptural crest (+0.035m crown in middle vs edges)
          const d0Edge = Math.max(0.14, d0 - 0.026);
          const d1Edge = Math.max(0.14, d1 - 0.026);
          const d0Crown = d0 + 0.034;
          const d1Crown = d1 + 0.034;
          const dBack = 0.01;

          // Left shadow reveal return wall
          pushTri(
            b.pos, b.norm, b.uv,
            to3D(h0L, y0, dBack), to3D(h0L + bevelFrac0, y0, d0Edge), to3D(h1L + bevelFrac1, y1, d1Edge),
            [0, v0], [0.2, v0], [0.2, v1], sideHNorm(-1),
          );
          pushTri(
            b.pos, b.norm, b.uv,
            to3D(h0L, y0, dBack), to3D(h1L + bevelFrac1, y1, d1Edge), to3D(h1L, y1, dBack),
            [0, v0], [0.2, v1], [0, v1], sideHNorm(-1),
          );

          // Left-half sculpted curved front face
          pushTri(
            b.pos, b.norm, b.uv,
            to3D(h0L + bevelFrac0, y0, d0Edge), to3D(h0M, y0, d0Crown), to3D(h1M, y1, d1Crown),
            [0.2, v0], [0.5, v0], [0.5, v1], inwardNorm,
          );
          pushTri(
            b.pos, b.norm, b.uv,
            to3D(h0L + bevelFrac0, y0, d0Edge), to3D(h1M, y1, d1Crown), to3D(h1L + bevelFrac1, y1, d1Edge),
            [0.2, v0], [0.5, v1], [0.2, v1], inwardNorm,
          );

          // Right-half sculpted curved front face
          pushTri(
            b.pos, b.norm, b.uv,
            to3D(h0M, y0, d0Crown), to3D(h0R - bevelFrac0, y0, d0Edge), to3D(h1R - bevelFrac1, y1, d1Edge),
            [0.5, v0], [0.8, v0], [0.8, v1], inwardNorm,
          );
          pushTri(
            b.pos, b.norm, b.uv,
            to3D(h0M, y0, d0Crown), to3D(h1R - bevelFrac1, y1, d1Edge), to3D(h1M, y1, d1Crown),
            [0.5, v0], [0.8, v1], [0.5, v1], inwardNorm,
          );

          // Right shadow reveal return wall
          pushTri(
            b.pos, b.norm, b.uv,
            to3D(h0R - bevelFrac0, y0, d0Edge), to3D(h0R, y0, dBack), to3D(h1R, y1, dBack),
            [0.8, v0], [1, v0], [1, v1], sideHNorm(1),
          );
          pushTri(
            b.pos, b.norm, b.uv,
            to3D(h0R - bevelFrac0, y0, d0Edge), to3D(h1R, y1, dBack), to3D(h1R - bevelFrac1, y1, d1Edge),
            [0.8, v0], [1, v1], [0.8, v1], sideHNorm(1),
          );
        }
      }

      // Build sweeping recessed glowing neon-purple valley canyons + razor-thin bright core splines
      fissureBoundaryIndices.forEach((fIdx) => {
        if (fIdx <= 0 || fIdx >= ribbonCount) return;
        const canyonHalfW = 0.14;
        const coreHalfW = 0.022;

        for (let r = 0; r < vSteps; r++) {
          const v0 = r / vSteps;
          const v1 = (r + 1) / vSteps;
          const y0 = THREE.MathUtils.lerp(yBot, yTop, v0);
          const y1 = THREE.MathUtils.lerp(yBot, yTop, v1);
          const h0 = hGrid[r][fIdx];
          const h1 = hGrid[r + 1][fIdx];

          // Soft purple Gaussian valley trough wash
          pushTri(
            glowBucket.pos, glowBucket.norm, glowBucket.uv,
            to3D(h0 - canyonHalfW, y0, 0.115), to3D(h0 + canyonHalfW, y0, 0.115), to3D(h1 + canyonHalfW, y1, 0.115),
            [0, v0 * 4], [1, v0 * 4], [1, v1 * 4], inwardNorm,
          );
          pushTri(
            glowBucket.pos, glowBucket.norm, glowBucket.uv,
            to3D(h0 - canyonHalfW, y0, 0.115), to3D(h1 + canyonHalfW, y1, 0.115), to3D(h1 - canyonHalfW, y1, 0.115),
            [0, v0 * 4], [1, v1 * 4], [0, v1 * 4], inwardNorm,
          );

          // Crisp thin luminous violet-white LED core strip nestled at canyon floor
          pushTri(
            coreBucket.pos, coreBucket.norm, coreBucket.uv,
            to3D(h0 - coreHalfW, y0, 0.135), to3D(h0 + coreHalfW, y0, 0.135), to3D(h1 + coreHalfW, y1, 0.135),
            [0, v0], [1, v0], [1, v1], inwardNorm,
          );
          pushTri(
            coreBucket.pos, coreBucket.norm, coreBucket.uv,
            to3D(h0 - coreHalfW, y0, 0.135), to3D(h1 + coreHalfW, y1, 0.135), to3D(h1 - coreHalfW, y1, 0.135),
            [0, v0], [1, v1], [0, v1], inwardNorm,
          );
        }
      });

      return {
        lightSlateGeo: makeGeo(toneBuckets[0].pos, toneBuckets[0].norm, toneBuckets[0].uv),
        midCharcoalGeo: makeGeo(toneBuckets[1].pos, toneBuckets[1].norm, toneBuckets[1].uv),
        obsidianGeo: makeGeo(toneBuckets[2].pos, toneBuckets[2].norm, toneBuckets[2].uv),
        violetWashGeo: makeGeo(glowBucket.pos, glowBucket.norm, glowBucket.uv),
        violetCoreGeo: makeGeo(coreBucket.pos, coreBucket.norm, coreBucket.uv),
      };
    };

    const fZ = -L / 2;
    const bZ = L / 2;
    const zMin = fZ + 0.95;
    const zMax = bZ - 0.35;
    const yBot = 0.12;
    const yTop = H - 0.18;

    const leftWall = buildVerticalSWaveField(zMin, zMax, yBot, yTop, 36, [5, 13, 21, 29], 'side', 1, 0);
    const rightWall = buildVerticalSWaveField(zMin, zMax, yBot, yTop, 36, [5, 13, 21, 29], 'side', -1, 3);

    // Back-wall vertical S-wave wings flanking open projection booth & rear double doors
    const boothY = Math.min(H - 1.4, topTierY + 3.25);
    const boothWinW = Math.min(4.8, W * 0.42);
    const boothWinH = Math.min(1.42, H * 0.24);
    const winTop = Math.min(H - 0.28, boothY + boothWinH / 2);
    const wingMinAbsX = boothWinW * 0.5 + 0.26;
    const wingMaxAbsX = W * 0.5 - 0.36;
    const backYBot = Math.max(0.25, topTierY - 0.18);

    const rearLeft = buildVerticalSWaveField(-wingMaxAbsX, -wingMinAbsX, backYBot, yTop, 11, [3, 8], 'rear', -1, 1);
    const rearRight = buildVerticalSWaveField(wingMinAbsX, wingMaxAbsX, backYBot, yTop, 11, [3, 8], 'rear', -1, 4);
    const rearSpandrel =
      yTop - (winTop + 0.14) > 0.35
        ? buildVerticalSWaveField(-wingMinAbsX, wingMinAbsX, winTop + 0.14, yTop, 7, [], 'rear', -1, 2)
        : null;

    return {
      leftWall,
      rightWall,
      rearLeft,
      rearRight,
      rearSpandrel,
      wingMinAbsX,
      wingMaxAbsX,
      winTop,
    };
  }, [sideLightStyle, W, L, H, topTierY]);

  useEffect(() => {
    return () => {
      if (!parametricObsidianWall) return;
      [
        parametricObsidianWall.leftWall,
        parametricObsidianWall.rightWall,
        parametricObsidianWall.rearLeft,
        parametricObsidianWall.rearRight,
        parametricObsidianWall.rearSpandrel,
      ].forEach((part) => {
        if (!part) return;
        part.lightSlateGeo.dispose();
        part.midCharcoalGeo.dispose();
        part.obsidianGeo.dispose();
        part.violetWashGeo.dispose();
        part.violetCoreGeo.dispose();
      });
    };
  }, [parametricObsidianWall]);

  // Sylva Moss 250: Tight Voronoi-Style Preserved-Moss Polygon Mosaic (Sand-Beige, Sage-Green, Olive & Charcoal) + Recessed Warm-Gold Diagonal Seam LEDs & Wood Speaker Alcoves
  const biophilicCrystallineMossWall = useMemo(() => {
    if (sideLightStyle !== 'biophilic_crystalline_moss') return null;

    type Vec3 = [number, number, number];
    type Vec2 = [number, number];

    const pushTri = (
      pos: number[],
      norm: number[],
      uv: number[],
      a: Vec3,
      b: Vec3,
      c: Vec3,
      uvA: Vec2,
      uvB: Vec2,
      uvC: Vec2,
      desiredNormal: Vec3,
    ) => {
      const abx = b[0] - a[0], aby = b[1] - a[1], abz = b[2] - a[2];
      const acx = c[0] - a[0], acy = c[1] - a[1], acz = c[2] - a[2];
      let nx = aby * acz - abz * acy;
      let ny = abz * acx - abx * acz;
      let nz = abx * acy - aby * acx;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;
      const dot = nx * desiredNormal[0] + ny * desiredNormal[1] + nz * desiredNormal[2];
      if (dot >= 0) {
        pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
        norm.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
        uv.push(uvA[0], uvA[1], uvB[0], uvB[1], uvC[0], uvC[1]);
      } else {
        pos.push(a[0], a[1], a[2], c[0], c[1], c[2], b[0], b[1], b[2]);
        norm.push(-nx, -ny, -nz, -nx, -ny, -nz, -nx, -ny, -nz);
        uv.push(uvA[0], uvA[1], uvC[0], uvC[1], uvB[0], uvB[1]);
      }
    };

    const makeGeo = (pos: number[], norm: number[], uv: number[]) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      return geo;
    };

    const hash = (a: number, b: number, c: number) => {
      const s = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453;
      return s - Math.floor(s);
    };

    const { sideSpeakers, rearSpeakers, bWinW, wTop, wBot } = getBiophilicSpeakerPositions(config, topTierY);
    const rearDoorTopY = Math.min(wBot - 0.65, topTierY + 1.15) + 1.45;

    const buildMossVoronoiSurface = (
      hMin: number,
      hMax: number,
      yBot: number,
      yTop: number,
      cols: number,
      rows: number,
      axis: 'side' | 'rear',
      dirSign: number,
      seedBase: number,
      isBlocked: (ch: number, cy: number) => boolean,
    ) => {
      const buckets = [
        { pos: [] as number[], norm: [] as number[], uv: [] as number[] }, // 0: sand-beige
        { pos: [] as number[], norm: [] as number[], uv: [] as number[] }, // 1: sage-green
        { pos: [] as number[], norm: [] as number[], uv: [] as number[] }, // 2: olive-moss
        { pos: [] as number[], norm: [] as number[], uv: [] as number[] }, // 3: charcoal-felt
      ];
      const ledBucket = { pos: [] as number[], norm: [] as number[], uv: [] as number[] };

      const cellW = (hMax - hMin) / cols;
      const cellH = (yTop - yBot) / rows;

      // Jittered lattice nodes preserving edge-to-edge tight Voronoi triangulation/quads without overlap
      const nodes: Vec2[][] = [];
      for (let r = 0; r <= rows; r++) {
        const rowNodes: Vec2[] = [];
        for (let c = 0; c <= cols; c++) {
          const baseH = hMin + c * cellW;
          const baseY = yBot + r * cellH;
          const jH = c === 0 || c === cols ? 0 : (hash(c, r, seedBase + 1) - 0.5) * cellW * 0.68;
          const jY = r === 0 || r === rows ? 0 : (hash(c, r, seedBase + 2) - 0.5) * cellH * 0.68;
          rowNodes.push([baseH + jH, baseY + jY]);
        }
        nodes.push(rowNodes);
      }

      const to3D = (h: number, y: number, d: number): Vec3 =>
        axis === 'side' ? [dirSign * d, y, h] : [h, y, dirSign * d];
      const inwardNorm: Vec3 = axis === 'side' ? [dirSign, 0, 0] : [0, 0, dirSign];

      const tonePalette = [0, 1, 0, 3, 1, 2, 0, 1, 3, 0];

      const appendPolygonShard = (rawPts: Vec2[], shardSeed: number) => {
        const n = rawPts.length;
        let ch = 0;
        let cy = 0;
        rawPts.forEach(([h, y]) => {
          ch += h;
          cy += y;
        });
        ch /= n;
        cy /= n;

        const occluded =
          isBlocked(ch, cy) ||
          (axis === 'rear' &&
            rawPts.some(
              ([ph, py]) =>
                Math.abs(ph) < bWinW * 0.5 + 0.08 && py > wBot - 0.06 && py < wTop + 0.06,
            ));
        if (occluded) return;

        // Shrink vertices tightly inward toward centroid for razor-sharp dark seam grooves (~3.6cm gap)
        const baseInset = 0.018;
        const shrink = (pts: Vec2[], inset: number): Vec2[] =>
          pts.map(([h, y]) => {
            const dh = h - ch;
            const dy = y - cy;
            const dist = Math.hypot(dh, dy) || 1;
            const factor = Math.max(0.72, (dist - inset) / dist);
            return [ch + dh * factor, cy + dy * factor];
          });

        const basePts = shrink(rawPts, baseInset);
        const frontPts = shrink(rawPts, baseInset + 0.022);

        const toneBucketIdx = tonePalette[Math.floor(hash(shardSeed, 3, seedBase) * tonePalette.length)];
        const b = buckets[toneBucketIdx];

        const baseDepth = 0.075 + hash(shardSeed, 5, seedBase) * 0.072;
        const tiltH = (hash(shardSeed, 7, seedBase) - 0.5) * 0.045;
        const tiltY = (hash(shardSeed, 9, seedBase) - 0.5) * 0.045;

        const depthAt = (pt: Vec2) =>
          Math.max(0.055, baseDepth + (pt[0] - ch) * tiltH + (pt[1] - cy) * tiltY);

        const back3D = basePts.map((pt) => to3D(pt[0], pt[1], 0.012));
        const front3D = frontPts.map((pt) => to3D(pt[0], pt[1], depthAt(pt)));
        const fUV = frontPts.map(([h, y]): Vec2 => [h * 0.44, y * 0.44]);
        const bUV = basePts.map(([h, y]): Vec2 => [h * 0.44, y * 0.44]);

        // Front textured moss polygon face
        for (let i = 1; i < n - 1; i++) {
          pushTri(b.pos, b.norm, b.uv, front3D[0], front3D[i], front3D[i + 1], fUV[0], fUV[i], fUV[i + 1], inwardNorm);
        }

        // Chamfered perimeter bevels dropping cleanly to dark substrate
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n;
          const eh = (basePts[i][0] + basePts[j][0]) * 0.5 - ch;
          const ey = (basePts[i][1] + basePts[j][1]) * 0.5 - cy;
          const sideDes: Vec3 =
            axis === 'side' ? [dirSign * 0.25, ey, eh] : [eh, ey, dirSign * 0.25];
          pushTri(b.pos, b.norm, b.uv, back3D[i], back3D[j], front3D[j], bUV[i], bUV[j], fUV[j], sideDes);
          pushTri(b.pos, b.norm, b.uv, back3D[i], front3D[j], front3D[i], bUV[i], fUV[j], fUV[i], sideDes);

          // Recessed warm-gold LED strips along ~30% of protruding angled diagonal edges
          const edgeRand = hash(shardSeed, i + 17, seedBase);
          const edgeLen = Math.hypot(rawPts[j][0] - rawPts[i][0], rawPts[j][1] - rawPts[i][1]);
          const midEdgeH = (rawPts[i][0] + rawPts[j][0]) * 0.5;
          const midEdgeY = (rawPts[i][1] + rawPts[j][1]) * 0.5;
          if (
            baseDepth > 0.112 &&
            edgeRand < 0.36 &&
            edgeLen > 0.65 &&
            !isBlocked(midEdgeH, midEdgeY)
          ) {
            const pA = basePts[i];
            const pB = basePts[j];
            const dirH = (pB[0] - pA[0]) / (edgeLen || 1);
            const dirY = (pB[1] - pA[1]) / (edgeLen || 1);
            // Offset LED slightly outward into the gap seam and recessed just behind the protruding bevel lip
            const nH = (pA[0] + pB[0]) * 0.5 - ch;
            const nY = (pA[1] + pB[1]) * 0.5 - cy;
            const nLen = Math.hypot(nH, nY) || 1;
            const outH = (nH / nLen) * 0.012;
            const outY = (nY / nLen) * 0.012;
            const perpH = -dirY * 0.011;
            const perpY = dirH * 0.011;
            const trim = 0.08;
            const aH = pA[0] + dirH * trim + outH;
            const aY = pA[1] + dirY * trim + outY;
            const bH = pB[0] - dirH * trim + outH;
            const bY = pB[1] - dirY * trim + outY;
            const ledD = Math.max(0.048, baseDepth * 0.58);

            pushTri(
              ledBucket.pos,
              ledBucket.norm,
              ledBucket.uv,
              to3D(aH - perpH, aY - perpY, ledD),
              to3D(bH - perpH, bY - perpY, ledD),
              to3D(bH + perpH, bY + perpY, ledD),
              [0, 0],
              [1, 0],
              [1, 1],
              inwardNorm,
            );
            pushTri(
              ledBucket.pos,
              ledBucket.norm,
              ledBucket.uv,
              to3D(aH - perpH, aY - perpY, ledD),
              to3D(bH + perpH, bY + perpY, ledD),
              to3D(aH + perpH, aY + perpY, ledD),
              [0, 0],
              [1, 1],
              [0, 1],
              inwardNorm,
            );
          }
        }
      };

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const p00 = nodes[r][c];
          const p10 = nodes[r][c + 1];
          const p11 = nodes[r + 1][c + 1];
          const p01 = nodes[r + 1][c];
          const cellSeed = c * 31 + r * 17 + 7;
          const splitMode = hash(c, r, seedBase + 19);

          if (splitMode < 0.36) {
            // Irregular slanted quadrilateral moss tile
            appendPolygonShard([p00, p10, p11, p01], cellSeed);
          } else if (splitMode < 0.68) {
            // Split diagonally bottom-left to top-right into two irregular triangles
            appendPolygonShard([p00, p10, p11], cellSeed);
            appendPolygonShard([p00, p11, p01], cellSeed + 101);
          } else {
            // Split diagonally bottom-right to top-left into two irregular triangles
            appendPolygonShard([p00, p10, p01], cellSeed);
            appendPolygonShard([p10, p11, p01], cellSeed + 203);
          }
        }
      }

      return {
        sandGeo: makeGeo(buckets[0].pos, buckets[0].norm, buckets[0].uv),
        sageGeo: makeGeo(buckets[1].pos, buckets[1].norm, buckets[1].uv),
        oliveGeo: makeGeo(buckets[2].pos, buckets[2].norm, buckets[2].uv),
        charcoalGeo: makeGeo(buckets[3].pos, buckets[3].norm, buckets[3].uv),
        seamLedGeo: makeGeo(ledBucket.pos, ledBucket.norm, ledBucket.uv),
      };
    };

    const fZ = -L / 2;
    const bZ = L / 2;
    const zMin = fZ + 0.85;
    const zMax = bZ - 0.36;
    const yBot = 0.24;
    const yTop = H - 0.26;

    const isSideAlcove = (cz: number, cy: number) =>
      sideSpeakers.some((s) => Math.abs(cz - s.z) < 0.45 && Math.abs(cy - s.y) < 0.54);

    const leftWall = buildMossVoronoiSurface(zMin, zMax, yBot, yTop, 13, 6, 'side', 1, 11, isSideAlcove);
    const rightWall = buildMossVoronoiSurface(zMin, zMax, yBot, yTop, 13, 6, 'side', -1, 37, isSideAlcove);

    const isRearOpening = (cx: number, cy: number) => {
      if (Math.abs(cx) < bWinW * 0.5 + 0.26 && cy > wBot - 0.22 && cy < wTop + 0.22) return true;
      if (Math.abs(cx) < 1.48 && cy < rearDoorTopY) return true;
      if (rearSpeakers.some((s) => Math.abs(cx - s.x) < 0.45 && Math.abs(cy - s.y) < 0.54)) return true;
      return false;
    };

    const rYMin = Math.max(0.28, topTierY - 0.14);
    const rearWall = buildMossVoronoiSurface(-W * 0.5 + 0.32, W * 0.5 - 0.32, rYMin, yTop, 12, 5, 'rear', -1, 61, isRearOpening);

    return {
      leftWall,
      rightWall,
      rearWall,
      sideSpeakers,
      rearSpeakers,
      zMin,
      zMax,
      yBot,
      rYMin,
      bWinW,
      wTop,
      wBot,
    };
  }, [sideLightStyle, config, W, L, H, topTierY]);

  useEffect(() => {
    return () => {
      if (!biophilicCrystallineMossWall) return;
      [
        biophilicCrystallineMossWall.leftWall,
        biophilicCrystallineMossWall.rightWall,
        biophilicCrystallineMossWall.rearWall,
      ].forEach((part) => {
        part.sandGeo.dispose();
        part.sageGeo.dispose();
        part.oliveGeo.dispose();
        part.charcoalGeo.dispose();
        part.seamLedGeo.dispose();
      });
    };
  }, [biophilicCrystallineMossWall]);

  return (
    <group>
      {/* Standard Acoustic Pilasters & Framed Wall Panels (skipped for ICE, Art Deco Navy, Modern Multiplex, IMAX Wave/Aurora/Amber, 4DX bespoke walls, Dolby Obsidian/Cobalt & full-wall styles) */}
      {!isIce &&
        sideLightStyle !== 'art_deco_navy_sunburst' &&
        sideLightStyle !== 'modern_charcoal_navy_diagonal' &&
        sideLightStyle !== 'volcanic_copper_ribbons' &&
        sideLightStyle !== 'private_volcanic_copper_ribbons' &&
        sideLightStyle !== 'champagne_fluted_oak_alcoves' &&
        sideLightStyle !== 'imax_cobalt_wave' &&
        sideLightStyle !== 'aurora_ribbon_waves' &&
        sideLightStyle !== 'horizon_tier_strips' &&
        sideLightStyle !== 'crimson_velocity_4dx' &&
        sideLightStyle !== 'arctic_parametric_fins' &&
        sideLightStyle !== 'thunder_emerald_waves' &&
        sideLightStyle !== 'exoskeleton_crimson_matrix_4dx' &&
        sideLightStyle !== 'obsidian_slat_grazers' &&
        sideLightStyle !== 'diagonal_parabolic_ribs' &&
        sideLightStyle !== 'cobalt_veil_laser_recess' &&
        sideLightStyle !== 'crisscross_geometric' &&
        sideLightStyle !== 'screenx_panoramic_walls' &&
        sideLightStyle !== 'screenx_silver_baffles' &&
        sideLightStyle !== 'indian_mandap_jali' &&
        sideLightStyle !== 'parametric_obsidian_waves' &&
        sideLightStyle !== 'biophilic_crystalline_moss' &&
        wallBayZs.map((bz, idx) => {
          const nextBz = wallBayZs[idx + 1];
          const allowTile = idx < wallBayZs.length - 1;
          return [-1, 1].map((side) => (
            <group key={`wall-bay-${idx}-${side}`}>
              {/* Architectural Acoustic Pilaster */}
              <mesh
                position={[side * (W / 2 - 0.25), H * 0.49, bz]}
                material={trimMetalMat}
                castShadow
              >
                <boxGeometry args={[0.14, H * 0.88, 0.24]} />
              </mesh>

              {/* Framed Fabric Acoustic Wall Tile between Pilasters */}
              {allowTile && (
                <group
                  position={[
                    side * (W / 2 - 0.215),
                    H * 0.52,
                    (bz + nextBz) / 2,
                  ]}
                >
                  <mesh material={acousticPanelMat} receiveShadow>
                    <boxGeometry
                      args={[0.07, H * 0.68, Math.max(0.4, Math.abs(nextBz - bz) - 0.56)]}
                    />
                  </mesh>
                  {/* Beveled acoustic frame trim */}
                  <mesh position={[-side * 0.036, 0, 0]} material={mats.channelMetalMat}>
                    <boxGeometry
                      args={[0.014, H * 0.64, Math.max(0.32, Math.abs(nextBz - bz) - 0.68)]}
                    />
                  </mesh>
                </group>
              )}
            </group>
          ));
        })}

      {/* Art Deco Midnight Navy & Charcoal Slate Textured Bays + Metallic Gold/Bronze Chevrons/Sunbursts + Fluted Walnut Slats */}
      {sideLightStyle === 'art_deco_navy_sunburst' &&
        wallBayZs.map((bz, idx) => {
          const nextBz = wallBayZs[idx + 1];
          const allowTile = idx < wallBayZs.length - 1;
          const bayLen = allowTile ? Math.max(0.8, Math.abs(nextBz - bz)) : 0;
          const midZ = allowTile ? (bz + nextBz) * 0.5 : bz;
          const panelLen = Math.max(0.6, bayLen - 1.18);
          return [-1, 1].map((side) => {
            const wallX = side * (W / 2 - 0.21);
            const inDir = -side;
            return (
              <group key={`deco-navy-bay-${idx}-${side}`}>
                {/* Fluted Walnut Vertical Slats Flanking Every Patterned Wall Bay */}
                {[-0.44, -0.34, -0.24, 0.24, 0.34, 0.44].map((oz, oi) => (
                  <mesh
                    key={`walnut-slat-${oi}`}
                    position={[wallX + inDir * 0.04, H * 0.5, bz + oz]}
                    material={mats.walnutWoodMat}
                    castShadow
                    receiveShadow
                  >
                    <boxGeometry args={[0.08, H * 0.86, 0.055]} />
                  </mesh>
                ))}
                {/* Dark Charcoal Walnut Pilaster Backing Spine Between Bays */}
                <mesh position={[wallX + inDir * 0.015, H * 0.5, bz]} material={mats.channelMetalMat}>
                  <boxGeometry args={[0.05, H * 0.88, 1.04]} />
                </mesh>

                {/* Vertical Brushed Brass Wall Sconce Mounted Symmetrically Between Geometric Bays */}
                <group position={[wallX + inDir * 0.08, H * 0.47, bz]}>
                  <mesh material={mats.warmBronzeMat}>
                    <boxGeometry args={[0.04, 2.35, 0.28]} />
                  </mesh>
                  <mesh position={[inDir * 0.035, 0.48, 0]} material={mats.alabasterGlassMat}>
                    <cylinderGeometry args={[0.065, 0.065, 0.82, 14]} />
                  </mesh>
                  <mesh position={[inDir * 0.035, -0.48, 0]} material={mats.alabasterGlassMat}>
                    <cylinderGeometry args={[0.065, 0.065, 0.82, 14]} />
                  </mesh>
                  {/* Brass Sconce End & Center Collars */}
                  {[-0.95, 0, 0.95].map((cy, ci) => (
                    <mesh key={`collar-${ci}`} position={[inDir * 0.035, cy, 0]} material={mats.brassHardwareMat}>
                      <boxGeometry args={[0.14, 0.09, 0.18]} />
                    </mesh>
                  ))}
                </group>

                {/* Midnight Navy & Charcoal Slate Art Deco Chevron & Sunburst Acoustic Bay */}
                {allowTile && (
                  <group position={[wallX + inDir * 0.03, H * 0.5, midZ]}>
                    {/* Patterned Acoustic Fabric Panel */}
                    <mesh material={wallMat ?? acousticPanelMat} receiveShadow>
                      <boxGeometry args={[0.05, H * 0.78, panelLen]} />
                    </mesh>
                    {/* Stepped Warm Bronze Outer Picture Frame Trim */}
                    <mesh position={[inDir * 0.03, H * 0.39, 0]} material={mats.warmBronzeMat}>
                      <boxGeometry args={[0.025, 0.07, panelLen + 0.04]} />
                    </mesh>
                    <mesh position={[inDir * 0.03, -H * 0.39, 0]} material={mats.warmBronzeMat}>
                      <boxGeometry args={[0.025, 0.07, panelLen + 0.04]} />
                    </mesh>
                    {/* 3D Brushed Gold Upper Sunburst Fan Relief Rays */}
                    {[-0.52, -0.26, 0, 0.26, 0.52].map((ang, ai) => (
                      <mesh
                        key={`sun-ray-${ai}`}
                        position={[inDir * 0.036, H * 0.27, Math.sin(ang) * 0.45]}
                        rotation={[ang, 0, 0]}
                        material={ai % 2 === 0 ? mats.brassHardwareMat : mats.warmBronzeMat}
                      >
                        <boxGeometry args={[0.022, 1.35, 0.036]} />
                      </mesh>
                    ))}
                    {/* 3D Brushed Gold Geometric Chevron V-Ribs Above & Below Ear-Level Recessed Speaker */}
                    {[H * 0.13, -H * 0.21].map((cy, ci) => (
                      <group key={`chevron-set-${ci}`} position={[inDir * 0.036, cy, 0]}>
                        <mesh rotation={[0.58, 0, 0]} position={[0, 0, panelLen * 0.2]} material={mats.brassHardwareMat}>
                          <boxGeometry args={[0.022, 0.045, panelLen * 0.44]} />
                        </mesh>
                        <mesh rotation={[-0.58, 0, 0]} position={[0, 0, -panelLen * 0.2]} material={mats.brassHardwareMat}>
                          <boxGeometry args={[0.022, 0.045, panelLen * 0.44]} />
                        </mesh>
                      </group>
                    ))}
                  </group>
                )}
              </group>
            );
          });
        })}

      {/* Contemporary Commercial Multiplex: Matte Charcoal Grey & Deep Midnight Blue Angled Diagonal Panels + Linear LED Strips */}
      {sideLightStyle === 'modern_charcoal_navy_diagonal' &&
        modernDiagonalWall &&
        [-1, 1].map((side) => {
          const wallX = side * (W / 2 - 0.21);
          const inDir = -side;
          const ledX = wallX + inDir * 0.075;
          return (
            <group key={`modern-diagonal-wall-${side}`}>
              {/* Shadow-gap dark backing rail running full length of side wall */}
              <mesh position={[wallX + inDir * 0.012, H * 0.5, 0]} material={mats.channelMetalMat}>
                <boxGeometry args={[0.024, H * 0.92, L * 0.88]} />
              </mesh>

              {/* Beveled 3D Angled Charcoal & Midnight Blue Fabric-Wrapped Acoustic Polygons */}
              {modernDiagonalWall.panels.map((p, pi) => (
                <mesh
                  key={`diag-panel-${side}-${pi}`}
                  position={[wallX + inDir * p.depthOffset, 0, 0]}
                  geometry={p.geo}
                  material={p.tone === 'navy' ? mats.midnightBlueAcousticMat : mats.charcoalAcousticMat}
                  receiveShadow
                />
              ))}

              {/* Minimal Recessed Linear Warm-White & Subtle Amber LED Strips Tracing Angled Geometric Seams */}
              {modernDiagonalWall.ledSeamSegments.map((seg, si) => (
                <ArchitecturalChannelBar
                  key={`diag-led-${side}-${si}`}
                  start={[ledX, seg.startZY[1], seg.startZY[0]]}
                  end={[ledX, seg.endZY[1], seg.endZY[0]]}
                  thickness={0.032}
                  depth={0.032}
                  material={seg.isAmber ? mats.secondaryEmitterMat : mats.primaryEmitterMat}
                  housingMaterial={mats.channelMetalMat}
                  interiorFocusY={H * 0.45}
                />
              ))}
            </group>
          );
        })}

      {/* Grand Crimson Palace: Broad Gently Angled Interlocking Volcanic-Basalt & Muted Terracotta-Copper Ribbon Bands + Dark-Bronze Shadow Reveals + Warm-Gold & Soft Ivory LED Seams */}
      {sideLightStyle === 'volcanic_copper_ribbons' &&
        volcanicRibbonsWall &&
        [-1, 1].map((side) => {
          const wallX = side * (W / 2 - 0.21);
          const inDir = -side;
          const ledX = wallX + inDir * 0.082;
          const bronzeX = wallX + inDir * 0.036;
          return (
            <group key={`volcanic-ribbons-wall-${side}`}>
              {/* Clean Dark-Bronze Shadow-Reveal Acoustic Backing Plane */}
              <mesh position={[wallX + inDir * 0.012, H * 0.5, 0]} material={mats.darkBronzeRevealMat}>
                <boxGeometry args={[0.024, H * 0.94, L * 0.92]} />
              </mesh>

              {/* Broad Interlocking Volcanic-Basalt & Muted Terracotta-Copper Acoustic Ribbon Panels */}
              {volcanicRibbonsWall.panels.map((p, pi) => (
                <mesh
                  key={`volcanic-ribbon-panel-${side}-${pi}`}
                  position={[wallX + inDir * p.depthOffset, 0, 0]}
                  geometry={p.geo}
                  material={p.tone === 'terracotta' ? mats.terracottaCopperMat : mats.volcanicBasaltMat}
                  receiveShadow
                />
              ))}

              {/* Dark-Bronze Architectural Reveal Trim Bars */}
              {volcanicRibbonsWall.bronzeReveals.map((bar, bi) => (
                <ArchitecturalChannelBar
                  key={`volcanic-bronze-reveal-${side}-${bi}`}
                  start={[bronzeX, bar.startZY[1], bar.startZY[0]]}
                  end={[bronzeX, bar.endZY[1], bar.endZY[0]]}
                  thickness={0.042}
                  depth={0.036}
                  material={mats.darkBronzeRevealMat}
                  interiorFocusY={H * 0.48}
                />
              ))}

              {/* Sleek Recessed Warm-Gold & Soft Ivory-White Linear LED Strips Tracing Ribbon Seams */}
              {volcanicRibbonsWall.ledSeams.map((seg, si) => (
                <ArchitecturalChannelBar
                  key={`volcanic-led-${side}-${si}`}
                  start={[ledX, seg.startZY[1], seg.startZY[0]]}
                  end={[ledX, seg.endZY[1], seg.endZY[0]]}
                  thickness={seg.isIvory ? 0.026 : 0.03}
                  depth={0.03}
                  material={seg.isIvory ? mats.secondaryEmitterMat : mats.primaryEmitterMat}
                  housingMaterial={mats.darkBronzeRevealMat}
                  interiorFocusY={H * 0.48}
                />
              ))}
            </group>
          );
        })}

      {/* Walnut Reserve Salon: Symmetrical Vertical Fluted American Walnut Acoustic Panels + Softly Curved Oatmeal Bouclé & Saddle-Cognac Suede Bays + Champagne-Brass Inlays + Warm-Amber Vertical Cove Grazers + Minimalist Alabaster Sconces + Concealed Surrounds */}
      {sideLightStyle === 'private_volcanic_copper_ribbons' &&
        privateVolcanicWall &&
        [-1, 1].map((side) => {
          const wallX = side * (W / 2 - 0.21);
          const inDir = -side;
          const fluteCount = 10;
          const fluteStep = (privateVolcanicWall.pierW - 0.14) / (fluteCount - 1);
          const mainCenterY = privateVolcanicWall.bayCenterY + privateVolcanicWall.bayH * 0.14;
          const lowerCenterY = privateVolcanicWall.bayCenterY - privateVolcanicWall.bayH * 0.36;
          return (
            <group key={`private-walnut-salon-wall-${side}`}>
              {/* Dark Matte-Espresso Acoustic Felt Backing Wall */}
              <mesh position={[wallX + inDir * 0.012, H * 0.5, 0]} material={mats.espressoFeltBackingMat} receiveShadow>
                <boxGeometry args={[0.024, H * 0.94, L * 0.92]} />
              </mesh>

              {/* Continuous American Walnut Lower Dado Plinth & Upper Cornice Header */}
              <mesh position={[wallX + inDir * 0.055, 0.15, 0]} material={mats.americanWalnutMat}>
                <boxGeometry args={[0.095, 0.28, L * 0.91]} />
              </mesh>
              <mesh position={[wallX + inDir * 0.06, H - 0.2, 0]} material={mats.americanWalnutMat}>
                <boxGeometry args={[0.11, 0.28, L * 0.91]} />
              </mesh>

              {/* Precision Champagne-Brass Horizontal Dado & Cornice Inlays */}
              <mesh position={[wallX + inDir * 0.108, 0.285, 0]} material={mats.champagneBrassInlayMat}>
                <boxGeometry args={[0.016, 0.022, L * 0.89]} />
              </mesh>
              <mesh position={[wallX + inDir * 0.118, H - 0.34, 0]} material={mats.champagneBrassInlayMat}>
                <boxGeometry args={[0.016, 0.022, L * 0.89]} />
              </mesh>

              {/* 4 Vertical Fluted American Walnut Acoustic Piers + Minimalist Alabaster Wall Sconces */}
              {privateVolcanicWall.pierZs.map((pz, pi) => (
                <group key={`walnut-fluted-pier-${side}-${pi}`} position={[wallX, 0, pz]}>
                  {/* Dark Acoustic Felt Backing Strip Behind Walnut Flutes */}
                  <mesh position={[inDir * 0.032, privateVolcanicWall.bayCenterY, 0]} material={mats.espressoFeltBackingMat}>
                    <boxGeometry args={[0.024, privateVolcanicWall.bayH + 0.18, privateVolcanicWall.pierW]} />
                  </mesh>

                  {/* Vertical Fluted American Walnut Slats */}
                  {Array.from({ length: fluteCount }, (_, fi) => {
                    const sz = -privateVolcanicWall.pierW * 0.5 + 0.07 + fi * fluteStep;
                    return (
                      <mesh
                        key={`walnut-flute-${fi}`}
                        position={[inDir * 0.068, privateVolcanicWall.bayCenterY, sz]}
                        material={mats.americanWalnutMat}
                        castShadow
                        receiveShadow
                      >
                        <boxGeometry args={[0.068, privateVolcanicWall.bayH + 0.14, 0.052]} />
                      </mesh>
                    );
                  })}

                  {/* Precision Champagne-Brass Vertical Edge Inlays Framing Each Fluted Walnut Pier */}
                  {[-privateVolcanicWall.pierW * 0.5 - 0.018, privateVolcanicWall.pierW * 0.5 + 0.018].map((iz, ii) => (
                    <mesh
                      key={`walnut-brass-inlay-${ii}`}
                      position={[inDir * 0.078, privateVolcanicWall.bayCenterY, iz]}
                      material={mats.champagneBrassInlayMat}
                    >
                      <boxGeometry args={[0.016, privateVolcanicWall.bayH + 0.16, 0.018]} />
                    </mesh>
                  ))}

                  {/* Minimalist Alabaster Wall Sconce Mounted Symmetrically on Fluted Walnut Pier */}
                  <group position={[inDir * 0.114, privateVolcanicWall.bayCenterY + 0.06, 0]}>
                    {/* Slim Brushed Champagne-Brass Wall Backplate */}
                    <mesh material={mats.champagneBrassInlayMat}>
                      <boxGeometry args={[0.018, 0.92, 0.11]} />
                    </mesh>
                    {/* Glowing Translucent Alabaster Cylindrical Shade */}
                    <mesh position={[inDir * 0.034, 0, 0]} material={mats.alabasterShadeMat}>
                      <cylinderGeometry args={[0.042, 0.042, 0.72, 16]} />
                    </mesh>
                    {/* Minimalist Top & Bottom Brass Collar Caps */}
                    {[-0.37, 0.37].map((cy, ci) => (
                      <mesh key={`alabaster-cap-${ci}`} position={[inDir * 0.034, cy, 0]} material={mats.champagneBrassInlayMat}>
                        <cylinderGeometry args={[0.046, 0.046, 0.032, 16]} />
                      </mesh>
                    ))}
                  </group>
                </group>
              ))}

              {/* 3 Softly Curved Upholstered Acoustic Bays (Warm Oatmeal Bouclé & Rich Saddle-Cognac Suede) + Concealed Warm-Amber Vertical Cove Grazers + Concealed Flush Surrounds */}
              {privateVolcanicWall.bayZs.map((bz, bi) => {
                const isCenterBay = bi === 1;
                const upperMat = isCenterBay ? mats.saddleCognacSuedeMat : mats.oatmealBoucleMat;
                const lowerMat = isCenterBay ? mats.oatmealBoucleMat : mats.saddleCognacSuedeMat;
                return (
                  <group key={`walnut-curved-bay-${side}-${bi}`} position={[wallX, 0, bz]}>
                    {/* Concealed Flush-Mounted Acoustic Surround Cavity Integrated Seamlessly Behind Translucent Upholstered Bay */}
                    <mesh position={[inDir * 0.022, mainCenterY, 0]} material={mats.espressoFeltBackingMat}>
                      <boxGeometry args={[0.018, 0.76, 0.56]} />
                    </mesh>

                    {/* Softly Curved Main Upholstered Bay */}
                    <mesh
                      position={[inDir * 0.024, mainCenterY, 0]}
                      rotation={[0, side === 1 ? Math.PI : 0, 0]}
                      geometry={privateVolcanicWall.curvedMainGeo}
                      material={upperMat}
                      receiveShadow
                      castShadow
                    />

                    {/* Precision Horizontal Champagne-Brass Reveal Dividing Upper & Lower Upholstery */}
                    <mesh
                      position={[inDir * 0.056, privateVolcanicWall.bayCenterY - privateVolcanicWall.bayH * 0.22, 0]}
                      material={mats.champagneBrassInlayMat}
                    >
                      <boxGeometry args={[0.055, 0.02, privateVolcanicWall.bayW - 0.1]} />
                    </mesh>

                    {/* Softly Curved Lower Dado Upholstered Bay */}
                    <mesh
                      position={[inDir * 0.024, lowerCenterY, 0]}
                      rotation={[0, side === 1 ? Math.PI : 0, 0]}
                      geometry={privateVolcanicWall.curvedLowerBandGeo}
                      material={lowerMat}
                      receiveShadow
                    />

                    {/* Concealed Warm-Amber Vertical Cove Grazers Tucked Along Left & Right Bay Reveals */}
                    {[-privateVolcanicWall.bayW * 0.5 + 0.035, privateVolcanicWall.bayW * 0.5 - 0.035].map((gz, gi) => (
                      <group key={`amber-cove-grazer-${gi}`} position={[inDir * 0.044, privateVolcanicWall.bayCenterY, gz]}>
                        <mesh material={mats.espressoFeltBackingMat}>
                          <boxGeometry args={[0.022, privateVolcanicWall.bayH + 0.04, 0.034]} />
                        </mesh>
                        <mesh position={[inDir * 0.008, 0, 0]} material={mats.primaryEmitterMat}>
                          <boxGeometry args={[0.016, privateVolcanicWall.bayH - 0.04, 0.018]} />
                        </mesh>
                      </group>
                    ))}
                  </group>
                );
              })}
            </group>
          );
        })}

      {/* Champagne Ivory Lounge: Vertical Fluted Smoked-Oak Acoustic Slats + Gently Curved Warm Alabaster Plaster Niches & Muted Sage-Slate Fabric Panels + Hairline Champagne-Gold Inlays + Indirect Cove Uplights & Slim Vertical Brass Sconces */}
      {sideLightStyle === 'champagne_fluted_oak_alcoves' &&
        champagneFlutedWall &&
        [-1, 1].map((side) => {
          const wallX = side * (W / 2 - 0.21);
          const inDir = -side;
          const fluteCount = 9;
          const fluteStep = (champagneFlutedWall.pierW - 0.14) / (fluteCount - 1);
          return (
            <group key={`champagne-fluted-wall-${side}`}>
              {/* Warm Alabaster & Acoustic Felt Wall Backing */}
              <mesh position={[wallX + inDir * 0.012, H * 0.5, 0]} material={mats.warmAlabasterPlasterMat} receiveShadow>
                <boxGeometry args={[0.024, H * 0.92, L * 0.9]} />
              </mesh>

              {/* Continuous Lower Base Dado Plinth & Upper Cove Cornice */}
              <mesh position={[wallX + inDir * 0.06, 0.16, 0]} material={mats.smokedOakMat}>
                <boxGeometry args={[0.1, 0.28, L * 0.9]} />
              </mesh>
              <mesh position={[wallX + inDir * 0.065, H - 0.2, 0]} material={mats.smokedOakMat}>
                <boxGeometry args={[0.12, 0.28, L * 0.9]} />
              </mesh>
              {/* Hairline Champagne-Gold Metallic Dado & Cornice Inlays */}
              <mesh position={[wallX + inDir * 0.115, 0.29, 0]} material={mats.champagneGoldInlayMat}>
                <boxGeometry args={[0.014, 0.022, L * 0.88]} />
              </mesh>
              <mesh position={[wallX + inDir * 0.125, H - 0.34, 0]} material={mats.champagneGoldInlayMat}>
                <boxGeometry args={[0.014, 0.022, L * 0.88]} />
              </mesh>

              {/* Vertical Fluted Smoked-Oak Acoustic Slat Piers + Slim Vertical Brass Wall Sconces */}
              {champagneFlutedWall.pierZs.map((pz, pi) => (
                <group key={`champagne-pier-${side}-${pi}`} position={[wallX, 0, pz]}>
                  {/* Dark Felt Acoustic Backing Strip Behind Smoked-Oak Flutes */}
                  <mesh position={[inDir * 0.032, champagneFlutedWall.nicheCenterY, 0]} material={mats.pitchBlackAcousticMat}>
                    <boxGeometry args={[0.024, champagneFlutedWall.nicheH + 0.12, champagneFlutedWall.pierW]} />
                  </mesh>
                  {/* Individual Fluted Smoked-Oak Acoustic Slats */}
                  {Array.from({ length: fluteCount }, (_, fi) => {
                    const sz = -champagneFlutedWall.pierW * 0.5 + 0.07 + fi * fluteStep;
                    return (
                      <mesh
                        key={`oak-flute-${fi}`}
                        position={[inDir * 0.068, champagneFlutedWall.nicheCenterY, sz]}
                        material={mats.smokedOakMat}
                        castShadow
                        receiveShadow
                      >
                        <boxGeometry args={[0.065, champagneFlutedWall.nicheH + 0.08, 0.056]} />
                      </mesh>
                    );
                  })}
                  {/* Hairline Champagne-Gold Vertical Edge Inlays Flanking Each Pier */}
                  {[-champagneFlutedWall.pierW * 0.5 - 0.015, champagneFlutedWall.pierW * 0.5 + 0.015].map((iz, ii) => (
                    <mesh
                      key={`pier-gold-${ii}`}
                      position={[inDir * 0.075, champagneFlutedWall.nicheCenterY, iz]}
                      material={mats.champagneGoldInlayMat}
                    >
                      <boxGeometry args={[0.018, champagneFlutedWall.nicheH + 0.1, 0.016]} />
                    </mesh>
                  ))}

                  {/* Slim Vertical Brushed-Brass Wall Sconce Mounted on Smoked-Oak Pier */}
                  <group position={[inDir * 0.115, champagneFlutedWall.nicheCenterY + 0.05, 0]}>
                    <mesh material={mats.champagneGoldInlayMat}>
                      <boxGeometry args={[0.018, 1.38, 0.085]} />
                    </mesh>
                    <mesh position={[inDir * 0.025, 0, 0]} material={mats.alabasterGlassMat}>
                      <cylinderGeometry args={[0.022, 0.022, 1.18, 12]} />
                    </mesh>
                    {[-0.6, 0, 0.6].map((cy, ci) => (
                      <mesh key={`sconce-collar-${ci}`} position={[inDir * 0.024, cy, 0]} material={mats.brassHardwareMat}>
                        <boxGeometry args={[0.048, 0.036, 0.065]} />
                      </mesh>
                    ))}
                  </group>
                </group>
              ))}

              {/* Gently Curved Alabaster Plaster Niches & Muted Sage-Slate Acoustic Fabric Panels + Indirect Warm-Amber Uplighting */}
              {champagneFlutedWall.nicheZs.map((nz, ni) => (
                <group key={`champagne-niche-${side}-${ni}`} position={[wallX, champagneFlutedWall.nicheCenterY, nz]}>
                  {/* Curved Warm Alabaster Plaster Niche Frame */}
                  <mesh
                    position={[inDir * (side === -1 ? 0.024 : 0.109), 0, 0]}
                    geometry={champagneFlutedWall.curvedFrameGeo}
                    material={mats.warmAlabasterPlasterMat}
                    receiveShadow
                    castShadow
                  />
                  {/* Muted Sage-Slate Acoustic Fabric Inset Panel */}
                  <mesh
                    position={[inDir * (side === -1 ? 0.028 : 0.068), 0, 0]}
                    geometry={champagneFlutedWall.curvedFabricGeo}
                    material={mats.sageSlateFabricMat}
                    receiveShadow
                  />
                  {/* Hairline Champagne-Gold Metallic Trim Framing Inner Sage-Slate Panel */}
                  {[-champagneFlutedWall.nicheW * 0.5 + 0.18, champagneFlutedWall.nicheW * 0.5 - 0.18].map((gz, gi) => (
                    <mesh
                      key={`niche-gold-v-${gi}`}
                      position={[inDir * 0.084, -0.04, gz]}
                      material={mats.champagneGoldInlayMat}
                    >
                      <boxGeometry args={[0.014, champagneFlutedWall.nicheH - 0.42, 0.014]} />
                    </mesh>
                  ))}
                  {/* Concealed Warm-Amber Indirect Cove Uplight & Downlight Tucked Inside Niche Header/Base */}
                  <mesh position={[inDir * 0.098, champagneFlutedWall.nicheH * 0.5 - 0.11, 0]} material={mats.primaryEmitterMat}>
                    <boxGeometry args={[0.026, 0.028, champagneFlutedWall.nicheW - 0.58]} />
                  </mesh>
                  <mesh position={[inDir * 0.092, -champagneFlutedWall.nicheH * 0.5 + 0.06, 0]} material={mats.secondaryEmitterMat}>
                    <boxGeometry args={[0.022, 0.024, champagneFlutedWall.nicheW - 0.42]} />
                  </mesh>
                </group>
              ))}
            </group>
          );
        })}

      {/* IMAX Cobalt Horizon: Clean Matte-Obsidian Front Margins with Backlit "IMAX with Laser" Plaque + Slanted Sculpted Wave-Rib Bays + Razor-Sharp Diagonal Cyan-Blue LED Slots */}
      {sideLightStyle === 'imax_cobalt_wave' &&
        imaxWaveWall &&
        imaxCobaltResources && (
          <group>
            {([-1, 1] as const).map((side) => {
              const wallX = side * (W / 2 - 0.21);
              const inDir = -side;
              const wall = side === -1 ? imaxWaveWall.leftWall : imaxWaveWall.rightWall;
              return (
                <group key={`imax-cobalt-wave-wall-${side}`} position={[wallX, 0, 0]}>
                  {/* Continuous Matte-Obsidian Acoustic Wall Backing (Includes Clean Front Screen Corners) */}
                  <mesh position={[inDir * 0.015, H * 0.5, 0]} material={imaxCobaltResources.obsidianRibMat} receiveShadow>
                    <boxGeometry args={[0.04, H * 0.96, L * 0.96]} />
                  </mesh>

                  {/* Clean Flat Matte-Obsidian Front Acoustic Margin Panel Framing the Screen Corners */}
                  <mesh
                    position={[inDir * 0.06, H * 0.5, frontZ + imaxWaveWall.frontMarginLen * 0.5 + 0.15]}
                    material={imaxCobaltResources.obsidianRibMat}
                    receiveShadow
                  >
                    <boxGeometry args={[0.09, H * 0.94, imaxWaveWall.frontMarginLen - 0.12]} />
                  </mesh>

                  {/* Illuminated Backlit "IMAX with Laser" Wall Plaque Mounted Cleanly on Left Front Acoustic Margin */}
                  {side === -1 && (
                    <group
                      position={[inDir * 0.115, Math.min(H * 0.42, 4.7), frontZ + 2.08]}
                      rotation={[0, Math.PI / 2, 0]}
                    >
                      <mesh position={[0, 0, -0.025]} material={imaxCobaltResources.plaqueFrameMat}>
                        <boxGeometry args={[2.55, 0.98, 0.05]} />
                      </mesh>
                      <mesh position={[0, 0, 0.004]} material={imaxCobaltResources.imaxPlaqueMat}>
                        <planeGeometry args={[2.46, 0.9]} />
                      </mesh>
                    </group>
                  )}

                  {/* Sculpted Slanted Curved Acoustic Wave-Rib Bays */}
                  <mesh geometry={wall.obsidianGeo} material={imaxCobaltResources.obsidianRibMat} castShadow receiveShadow />
                  <mesh geometry={wall.charcoalGeo} material={imaxCobaltResources.charcoalRibMat} castShadow receiveShadow />
                  <mesh geometry={wall.slateGeo} material={imaxCobaltResources.slateRibMat} castShadow receiveShadow />

                  {/* Recessed Cyan-Blue Channel Wash & Razor-Sharp Diagonal Cyan Core LEDs */}
                  <mesh geometry={wall.cyanWashGeo} material={imaxCobaltResources.cyanWashMat} />
                  <mesh geometry={wall.cyanCoreGeo} material={imaxCobaltResources.cyanCoreLedMat} />
                </group>
              );
            })}

            {/* Rear Wall Matching Sculpted Wave-Rib Wings Flanking Projection Booth & Rear Double Doors */}
            <group position={[0, 0, backZ - 0.2]}>
              {([-1, 1] as const).map((wSide) => {
                const wingW = imaxWaveWall.wingMaxAbsX - imaxWaveWall.wingMinAbsX;
                const wingCx = wSide * (imaxWaveWall.wingMinAbsX + wingW * 0.5);
                return (
                  <mesh
                    key={`imax-rear-backing-${wSide}`}
                    position={[wingCx, H * 0.5, 0.015]}
                    material={imaxCobaltResources.obsidianRibMat}
                  >
                    <boxGeometry args={[wingW, H * 0.96, 0.03]} />
                  </mesh>
                );
              })}

              {[
                imaxWaveWall.rearLeft,
                imaxWaveWall.rearRight,
                imaxWaveWall.rearSpandrel,
              ].map((part, pi) =>
                part ? (
                  <group key={`imax-rear-part-${pi}`}>
                    <mesh geometry={part.obsidianGeo} material={imaxCobaltResources.obsidianRibMat} castShadow receiveShadow />
                    <mesh geometry={part.charcoalGeo} material={imaxCobaltResources.charcoalRibMat} castShadow receiveShadow />
                    <mesh geometry={part.slateGeo} material={imaxCobaltResources.slateRibMat} castShadow receiveShadow />
                    <mesh geometry={part.cyanWashGeo} material={imaxCobaltResources.cyanWashMat} />
                    <mesh geometry={part.cyanCoreGeo} material={imaxCobaltResources.cyanCoreLedMat} />
                  </group>
                ) : null,
              )}
            </group>
          </group>
        )}

      {/* IMAX Polar Aurora: Matte Slate-Grey & Deep Indigo-Charcoal Hexagonal & Angled Polygon Panels with Brushed Dark-Aluminum Trims + Ice-White & Subtle Cobalt-Blue LEDs */}
      {sideLightStyle === 'aurora_ribbon_waves' &&
        polarAuroraWall &&
        [-1, 1].map((side) => {
          const wallX = side * (W / 2 - 0.21);
          const inDir = -side;
          const ledX = wallX + inDir * 0.086;
          const trimX = wallX + inDir * 0.072;
          return (
            <group key={`polar-aurora-wall-${side}`}>
              {/* Deep Indigo-Charcoal Recessed Backing Plane */}
              <mesh position={[wallX + inDir * 0.01, H * 0.5, 0]} material={mats.auroraIndigoCharcoalMat}>
                <boxGeometry args={[0.02, H * 0.94, L * 0.94]} />
              </mesh>

              {/* Hexagonal & Angled Polygon Acoustic Fabric Panels */}
              {polarAuroraWall.panels.map((p, pi) => (
                <mesh
                  key={`aurora-poly-panel-${side}-${pi}`}
                  position={[wallX + inDir * p.depthOffset, 0, 0]}
                  geometry={p.geo}
                  material={p.isSlateGrey ? mats.auroraSlateGreyMat : mats.auroraIndigoCharcoalMat}
                  receiveShadow
                />
              ))}

              {/* Brushed Dark-Aluminum Architectural Trims */}
              {polarAuroraWall.trimBars.map((bar, bi) => (
                <ArchitecturalChannelBar
                  key={`aurora-trim-${side}-${bi}`}
                  start={[trimX, bar.startZY[1], bar.startZY[0]]}
                  end={[trimX, bar.endZY[1], bar.endZY[0]]}
                  thickness={0.042}
                  depth={0.042}
                  material={mats.brushedDarkAluminumMat}
                  interiorFocusY={H * 0.48}
                />
              ))}

              {/* Recessed Ice-White & Subtle Cobalt-Blue Linear LED Strips */}
              {polarAuroraWall.ledStrips.map((seg, si) => (
                <ArchitecturalChannelBar
                  key={`aurora-led-${side}-${si}`}
                  start={[ledX, seg.startZY[1], seg.startZY[0]]}
                  end={[ledX, seg.endZY[1], seg.endZY[0]]}
                  thickness={seg.isBlue ? 0.026 : 0.03}
                  depth={0.032}
                  material={seg.isBlue ? mats.secondaryEmitterMat : mats.primaryEmitterMat}
                  housingMaterial={mats.channelMetalMat}
                  interiorFocusY={H * 0.48}
                />
              ))}
            </group>
          );
        })}

      {/* IMAX Obsidian Amber: 3D Origami-Folded Triangular & Trapezoidal Acoustic Fabric Panels (Graphite-Black & Ocean-Teal) with Satin-Black Shadow Gaps + Warm-Tungsten & Soft Cyan Crease LEDs */}
      {sideLightStyle === 'horizon_tier_strips' &&
        obsidianAmberWall &&
        [-1, 1].map((side) => {
          const wallX = side * (W / 2 - 0.21);
          const inDir = -side;
          const ledX = wallX + inDir * 0.12;
          const gapX = wallX + inDir * 0.035;
          return (
            <group key={`obsidian-amber-wall-${side}`}>
              {/* Satin-Black Shadow-Gap Acoustic Backing Plane */}
              <mesh position={[wallX + inDir * 0.01, H * 0.5, 0]} material={mats.satinBlackShadowMat}>
                <boxGeometry args={[0.02, H * 0.94, L * 0.94]} />
              </mesh>

              {/* 3D Origami-Folded Triangular & Trapezoidal Acoustic Fabric Panels */}
              <group position={[wallX, 0, 0]} scale={[inDir, 1, 1]}>
                {obsidianAmberWall.facets.map((f, fi) => (
                  <mesh
                    key={`amber-origami-facet-${side}-${fi}`}
                    geometry={f.geo}
                    material={f.tone === 'teal' ? mats.oceanTealFabricMat : mats.graphiteBlackFabricMat}
                    receiveShadow
                    castShadow
                  />
                ))}
              </group>

              {/* Clean Satin-Black Shadow-Gap Vertical Divider Strips */}
              {obsidianAmberWall.shadowGaps.map((g, gi) => (
                <ArchitecturalChannelBar
                  key={`amber-shadow-gap-${side}-${gi}`}
                  start={[gapX, g.startZY[1], g.startZY[0]]}
                  end={[gapX, g.endZY[1], g.endZY[0]]}
                  thickness={0.05}
                  depth={0.04}
                  material={mats.satinBlackShadowMat}
                  interiorFocusY={H * 0.48}
                />
              ))}

              {/* Recessed Warm-Tungsten & Soft Cyan Linear LED Strips Along Select Panel Creases */}
              {obsidianAmberWall.creaseLeds.map((seg, si) => (
                <ArchitecturalChannelBar
                  key={`amber-crease-led-${side}-${si}`}
                  start={[ledX, seg.startZY[1], seg.startZY[0]]}
                  end={[ledX, seg.endZY[1], seg.endZY[0]]}
                  thickness={seg.isCyan ? 0.024 : 0.03}
                  depth={0.028}
                  material={seg.isCyan ? mats.secondaryEmitterMat : mats.primaryEmitterMat}
                  housingMaterial={mats.satinBlackShadowMat}
                  interiorFocusY={H * 0.48}
                />
              ))}
            </group>
          );
        })}

      {/* 4DX Crimson Velocity: Matte Carbon-Black & Dark Gunmetal-Grey Angular Acoustic Panels + Recessed Crimson-Red & Electric-Blue Linear LEDs + Wind Blowers & SFX Nozzles */}
      {sideLightStyle === 'crimson_velocity_4dx' &&
        crimson4dxWall &&
        [-1, 1].map((side) => {
          const wallX = side * (W / 2 - 0.21);
          const inDir = -side;
          const ledX = wallX + inDir * 0.088;
          return (
            <group key={`crimson-4dx-wall-${side}`}>
              {/* Deep Matte Carbon Backing Plane */}
              <mesh position={[wallX + inDir * 0.012, H * 0.5, 0]} material={mats.carbonBlackAcousticMat}>
                <boxGeometry args={[0.024, H * 0.94, L * 0.92]} />
              </mesh>

              {/* Beveled Angular Carbon-Black & Dark Gunmetal-Grey Acoustic Polygons */}
              {crimson4dxWall.panels.map((p, pi) => (
                <mesh
                  key={`crimson-panel-${side}-${pi}`}
                  position={[wallX + inDir * p.depthOffset, 0, 0]}
                  geometry={p.geo}
                  material={p.tone === 'gunmetal' ? mats.gunmetalAcousticMat : mats.carbonBlackAcousticMat}
                  receiveShadow
                />
              ))}

              {/* Recessed Crimson-Red & Electric-Blue Linear LED Light Strips */}
              {crimson4dxWall.ledSeamSegments.map((seg, si) => (
                <ArchitecturalChannelBar
                  key={`crimson-led-${side}-${si}`}
                  start={[ledX, seg.startZY[1], seg.startZY[0]]}
                  end={[ledX, seg.endZY[1], seg.endZY[0]]}
                  thickness={0.038}
                  depth={0.034}
                  material={seg.isBlue ? mats.secondaryEmitterMat : mats.primaryEmitterMat}
                  housingMaterial={mats.channelMetalMat}
                  interiorFocusY={H * 0.45}
                />
              ))}

              {/* Wall-Mounted High-Power Wind Blowers & Special-Effects (SFX) Nozzles */}
              {wallBayZs.map((bz, bi) => {
                const rowFrac = THREE.MathUtils.clamp(
                  (bz - firstRowZ) / Math.max(0.5, rowSpacing),
                  0,
                  Math.max(0, seatingRows - 1),
                );
                const tierY = rowFrac * rowElevationStep;
                const blowerY = Math.min(H - 2.1, tierY + 2.55);
                const sfxY = Math.min(H - 2.8, tierY + 1.85);
                return (
                  <group key={`4dx-wall-rig-${side}-${bi}`}>
                    {/* High-Power Wind Blower Turbine Unit */}
                    <group
                      position={[wallX + inDir * 0.14, blowerY, bz]}
                      rotation={[0, inDir * (Math.PI / 2), 0]}
                    >
                      {/* Wall Anchor Plate & Gimbal Bracket */}
                      <mesh position={[0, 0, 0.02]} material={mats.channelMetalMat}>
                        <boxGeometry args={[0.38, 0.42, 0.04]} />
                      </mesh>
                      <mesh position={[0, 0, 0.14]} material={mats.gunmetalAcousticMat}>
                        <boxGeometry args={[0.46, 0.08, 0.28]} />
                      </mesh>
                      {/* Angled Turbine Cowling & Flared Exhaust Nozzle */}
                      <group position={[0, 0, 0.28]} rotation={[0.24, 0, 0]}>
                        <mesh rotation={[Math.PI / 2, 0, 0]} material={mats.gunmetalAcousticMat} castShadow>
                          <cylinderGeometry args={[0.21, 0.19, 0.44, 18]} />
                        </mesh>
                        <mesh position={[0, 0, 0.24]} rotation={[Math.PI / 2, 0, 0]} material={mats.channelMetalMat}>
                          <cylinderGeometry args={[0.235, 0.205, 0.08, 18]} />
                        </mesh>
                        {/* Internal Fan Hub & 4 Turbine Rotor Blades */}
                        <mesh position={[0, 0, 0.18]} rotation={[Math.PI / 2, 0, 0]} material={mats.nozzleBrassMat}>
                          <cylinderGeometry args={[0.055, 0.055, 0.08, 12]} />
                        </mesh>
                        {[0, 1, 2, 3].map((ri) => (
                          <mesh
                            key={`blade-${ri}`}
                            position={[0, 0, 0.18]}
                            rotation={[0, 0, (ri * Math.PI) / 4]}
                            material={mats.channelMetalMat}
                          >
                            <boxGeometry args={[0.35, 0.045, 0.02]} />
                          </mesh>
                        ))}
                        {/* Subtle Status Accent Ring */}
                        <mesh position={[0, 0, 0.27]} material={bi % 2 === 0 ? mats.primaryEmitterMat : mats.secondaryEmitterMat}>
                          <torusGeometry args={[0.22, 0.012, 8, 20]} />
                        </mesh>
                      </group>
                    </group>

                    {/* Special-Effects (SFX) Manifold & Dual Mist/Air/Scent Jet Nozzles */}
                    <group
                      position={[wallX + inDir * 0.12, sfxY, Math.min(L * 0.41, bz + 0.88)]}
                      rotation={[0, inDir * (Math.PI / 2), 0]}
                    >
                      {/* Vertical Conduit Pipe */}
                      <mesh position={[0, -0.35, 0.02]} material={mats.channelMetalMat}>
                        <cylinderGeometry args={[0.024, 0.024, 0.85, 10]} />
                      </mesh>
                      {/* Gunmetal Manifold Distribution Box */}
                      <mesh position={[0, 0, 0.06]} material={mats.gunmetalAcousticMat}>
                        <boxGeometry args={[0.24, 0.16, 0.12]} />
                      </mesh>
                      {/* Dual Brass/Steel Angled SFX Nozzles */}
                      {[-0.065, 0.065].map((nx, ni) => (
                        <group key={`sfx-jet-${ni}`} position={[nx, 0.01, 0.14]} rotation={[0.22, 0, 0]}>
                          <mesh rotation={[Math.PI / 2, 0, 0]} material={mats.nozzleBrassMat}>
                            <cylinderGeometry args={[0.024, 0.034, 0.12, 12]} />
                          </mesh>
                          <mesh position={[0, 0, 0.068]} rotation={[Math.PI / 2, 0, 0]} material={mats.channelMetalMat}>
                            <cylinderGeometry args={[0.014, 0.022, 0.04, 10]} />
                          </mesh>
                        </group>
                      ))}
                    </group>
                  </group>
                );
              })}
            </group>
          );
        })}

      {/* 4DX Exo-Skeleton 550: Interlocking 3D Matte-Black Carbon-Fiber Exo-Skeleton Matrix over Porous Acoustic Mesh, Vertical Crimson/Storm-Grey LEDs & Dedicated Speaker Cages */}
      {sideLightStyle === 'exoskeleton_crimson_matrix_4dx' &&
        exoskeletonResources &&
        (() => {
          const spkLayout = getExoskeletonSpeakerPositions(config, topTierY);
          const colCount = 11;
          const zStart = -L * 0.45;
          const zEnd = L * 0.46;
          const colZs = Array.from({ length: colCount }, (_, i) =>
            THREE.MathUtils.lerp(zStart, zEnd, i / (colCount - 1)),
          );
          const beltYs = [H * 0.24, H * 0.52, H * 0.79];
          const ribH = H - 0.5;
          const bayStepZ = (zEnd - zStart) / (colCount - 1);
          const diagLen = Math.hypot(bayStepZ, beltYs[1] - beltYs[0]);
          const diagAng = Math.atan2(beltYs[1] - beltYs[0], bayStepZ);

          return (
            <group>
              {/* Side Walls: Vertical Carbon-Fiber Split Columns + Recessed Vertical Crimson/Storm LEDs + Diagonal Braces + Speaker Cages */}
              {[-1, 1].map((side) => {
                const wallX = side * (W / 2 - 0.22);
                const inDir = -side;
                return (
                  <group key={`exo-side-wall-${side}`}>
                    {/* Deep-Charcoal Porous Acoustic Mesh Backing Shadow Frame */}
                    <mesh
                      position={[wallX + inDir * 0.025, H * 0.5, 0]}
                      material={exoskeletonResources.porousMeshMat}
                      receiveShadow
                    >
                      <boxGeometry args={[0.04, H - 0.2, L - 0.4]} />
                    </mesh>

                    {/* Vertical Interlocking Carbon-Fiber Split Columns with Deeply Recessed Vertical Linear LED Bars */}
                    {colZs.map((cz, ci) => (
                      <group key={`exo-col-${side}-${ci}`} position={[wallX + inDir * 0.16, H * 0.5, cz]}>
                        {/* Twin Flanking Carbon-Fiber Structural Ribs Creating Deep Recessed Channel */}
                        {[-0.11, 0.11].map((dz, fi) => (
                          <mesh
                            key={`rib-flange-${fi}`}
                            position={[inDir * 0.04, 0, dz]}
                            material={exoskeletonResources.exoCarbonMat}
                            castShadow
                            receiveShadow
                          >
                            <boxGeometry args={[0.26, ribH, 0.095]} />
                          </mesh>
                        ))}
                        {/* Deeply Recessed Vertical Electric-Crimson / Storm-Grey Linear LED Strip */}
                        <mesh
                          position={[inDir * 0.015, 0, 0]}
                          material={exoskeletonResources.crimsonStormLedMat}
                        >
                          <boxGeometry args={[0.04, ribH - 0.22, 0.075]} />
                        </mesh>
                        {/* Bolted Forged-Steel Gusset Plates at Column-Belt Intersections */}
                        {beltYs.map((by, bi) => (
                          <mesh
                            key={`gusset-${bi}`}
                            position={[inDir * 0.175, by - H * 0.5, 0]}
                            material={exoskeletonResources.darkSteelCageMat}
                          >
                            <boxGeometry args={[0.032, 0.36, 0.38]} />
                          </mesh>
                        ))}
                      </group>
                    ))}

                    {/* Horizontal Matte-Black Carbon-Fiber Exo-Skeleton Belt Beams */}
                    {beltYs.map((by, bi) => (
                      <mesh
                        key={`exo-belt-${side}-${bi}`}
                        position={[wallX + inDir * 0.14, by, 0]}
                        material={exoskeletonResources.exoCarbonMat}
                        castShadow
                        receiveShadow
                      >
                        <boxGeometry args={[0.2, 0.22, L * 0.93]} />
                      </mesh>
                    ))}

                    {/* Interlocking Diagonal Carbon-Fiber X-Truss Braces Across Structural Bays */}
                    {colZs.slice(0, -1).map((cz, bi) => {
                      const midZ = cz + bayStepZ * 0.5;
                      const tierMidY = (beltYs[0] + beltYs[1]) * 0.5;
                      const upperMidY = (beltYs[1] + beltYs[2]) * 0.5;
                      return (
                        <group key={`exo-diag-bay-${side}-${bi}`}>
                          {[tierMidY, upperMidY].map((my, mi) => (
                            <React.Fragment key={`diag-pair-${mi}`}>
                              <mesh
                                position={[wallX + inDir * 0.1, my, midZ]}
                                rotation={[(bi + mi) % 2 === 0 ? diagAng : -diagAng, 0, 0]}
                                material={exoskeletonResources.exoCarbonMat}
                              >
                                <boxGeometry args={[0.11, 0.11, diagLen * 0.94]} />
                              </mesh>
                              <mesh
                                position={[wallX + inDir * 0.09, my, midZ]}
                                rotation={[(bi + mi) % 2 === 0 ? -diagAng : diagAng, 0, 0]}
                                material={exoskeletonResources.darkSteelCageMat}
                              >
                                <boxGeometry args={[0.08, 0.085, diagLen * 0.94]} />
                              </mesh>
                            </React.Fragment>
                          ))}
                        </group>
                      );
                    })}

                    {/* Dedicated Architectural Speaker Cages Along Side Walls (Aligned With Side Surrounds) */}
                    {spkLayout.sideSpeakers.map((sp, si) => (
                      <group
                        key={`exo-side-cage-${side}-${si}`}
                        position={[wallX + inDir * 0.24, sp.y - 0.06, sp.z]}
                      >
                        {/* Back Structural Carbon-Fiber Collar */}
                        <mesh position={[-inDir * 0.14, 0, 0]} material={exoskeletonResources.exoCarbonMat}>
                          <boxGeometry args={[0.08, 1.18, 0.98]} />
                        </mesh>
                        {/* Top & Bottom Structural Cage Plates */}
                        {[-0.56, 0.56].map((cy, ci) => (
                          <mesh key={`cage-cap-${ci}`} position={[inDir * 0.12, cy, 0]} material={exoskeletonResources.exoCarbonMat}>
                            <boxGeometry args={[0.62, 0.07, 0.98]} />
                          </mesh>
                        ))}
                        {/* Four Forged-Steel Outer Cage Vertical Corner Struts */}
                        {[-0.45, 0.45].map((cz, czi) =>
                          [inDir * 0.4, -inDir * 0.12].map((cx, cxi) => (
                            <mesh
                              key={`cage-post-${czi}-${cxi}`}
                              position={[cx, 0, cz]}
                              material={exoskeletonResources.darkSteelCageMat}
                            >
                              <boxGeometry args={[0.055, 1.14, 0.055]} />
                            </mesh>
                          )),
                        )}
                        {/* Protective Architectural Horizontal & Side Cage Bars Framing Speaker */}
                        {[-0.42, 0.42].map((py, pyi) => (
                          <mesh
                            key={`cage-front-bar-${pyi}`}
                            position={[inDir * 0.41, py, 0]}
                            material={exoskeletonResources.darkSteelCageMat}
                          >
                            <boxGeometry args={[0.04, 0.04, 0.94]} />
                          </mesh>
                        ))}
                      </group>
                    ))}
                  </group>
                );
              })}

              {/* Rear Wall Exo-Skeleton Matrix (Clears Projection Booth Window & Rear Double Doors Cleanly) */}
              {(() => {
                const rearWallZ = backZ - 0.22;
                const doorTopY = Math.min(spkLayout.wBot - 1.35, topTierY + 1.15) + 1.32;
                const rearXs = [-W * 0.44, -W * 0.31, -W * 0.17, W * 0.17, W * 0.31, W * 0.44];
                return (
                  <group>
                    {/* Rear Wall Carbon-Fiber Vertical Split Columns & Recessed Crimson/Storm LEDs Flanking Booth & Doors */}
                    {rearXs.map((rx, ri) => (
                      <group key={`exo-rear-col-${ri}`} position={[rx, H * 0.5, rearWallZ - 0.1]}>
                        {[-0.11, 0.11].map((dx, fi) => (
                          <mesh
                            key={`rear-rib-flange-${fi}`}
                            position={[dx, 0, -0.04]}
                            material={exoskeletonResources.exoCarbonMat}
                            castShadow
                          >
                            <boxGeometry args={[0.095, ribH, 0.24]} />
                          </mesh>
                        ))}
                        <mesh position={[0, 0, -0.02]} material={exoskeletonResources.crimsonStormLedMat}>
                          <boxGeometry args={[0.075, ribH - 0.22, 0.04]} />
                        </mesh>
                      </group>
                    ))}

                    {/* Rear Horizontal Exo-Skeleton Beams Above & Below Booth/Door Apertures */}
                    {[H * 0.24, H * 0.5, Math.min(H - 0.65, spkLayout.wTop + 0.55)].map((by, bi) => {
                      const spans =
                        by < doorTopY
                          ? [
                              { x0: -W * 0.47, x1: -1.45 },
                              { x0: 1.45, x1: W * 0.47 },
                            ]
                          : [{ x0: -W * 0.47, x1: W * 0.47 }];
                      return spans.map((sp, si) => (
                        <mesh
                          key={`rear-belt-${bi}-${si}`}
                          position={[(sp.x0 + sp.x1) * 0.5, by, rearWallZ - 0.12]}
                          material={exoskeletonResources.exoCarbonMat}
                        >
                          <boxGeometry args={[sp.x1 - sp.x0, 0.22, 0.18]} />
                        </mesh>
                      ));
                    })}

                    {/* Dedicated Rear Wall Architectural Speaker Cages Framing Rear Surrounds */}
                    {spkLayout.rearSpeakers.map((rsp, ri) => (
                      <group
                        key={`exo-rear-cage-${ri}`}
                        position={[rsp.x, rsp.y - 0.06, rearWallZ - 0.24]}
                      >
                        <mesh position={[0, 0, 0.14]} material={exoskeletonResources.exoCarbonMat}>
                          <boxGeometry args={[0.98, 1.18, 0.08]} />
                        </mesh>
                        {[-0.56, 0.56].map((cy, ci) => (
                          <mesh key={`rear-cage-cap-${ci}`} position={[0, cy, -0.12]} material={exoskeletonResources.exoCarbonMat}>
                            <boxGeometry args={[0.98, 0.07, 0.62]} />
                          </mesh>
                        ))}
                        {[-0.45, 0.45].map((cx, cxi) =>
                          [-0.4, 0.12].map((cz, czi) => (
                            <mesh
                              key={`rear-cage-post-${cxi}-${czi}`}
                              position={[cx, 0, cz]}
                              material={exoskeletonResources.darkSteelCageMat}
                            >
                              <boxGeometry args={[0.055, 1.14, 0.055]} />
                            </mesh>
                          )),
                        )}
                        {[-0.42, 0.42].map((py, pyi) => (
                          <mesh
                            key={`rear-cage-bar-${pyi}`}
                            position={[0, py, -0.41]}
                            material={exoskeletonResources.darkSteelCageMat}
                          >
                            <boxGeometry args={[0.94, 0.04, 0.04]} />
                          </mesh>
                        ))}
                      </group>
                    ))}
                  </group>
                );
              })()}
            </group>
          );
        })()}

      {/* 4DX Arctic Storm: High-Contrast Diagonal Geometric & V-Chevron Acoustic Wall Panels (Frost Grey, Slate Blue, Cobalt Blue, Charcoal-Navy) + Razor-Thin Violet/Cyan LEDs */}
      {sideLightStyle === 'arctic_parametric_fins' &&
        arctic4dxWall &&
        arcticResources && (
          <group>
            {[-1, 1].map((side) => {
              const wallX = side * (W / 2 - 0.21);
              const inDir = -side;
              const ledX = wallX + inDir * 0.088;
              const toneMatMap = {
                frost: arcticResources.frostGreyMat,
                slate: arcticResources.slateBlueMat,
                cobalt: arcticResources.cobaltBlueMat,
                charcoal: arcticResources.charcoalNavyMat,
              } as const;
              return (
                <group key={`arctic-4dx-wall-${side}`}>
                  {/* Deep Matte-Black Recessed Seam Backing Plane */}
                  <mesh position={[wallX + inDir * 0.012, H * 0.5, 0]} material={arcticResources.seamBackingMat}>
                    <boxGeometry args={[0.024, H * 0.96, L * 0.94]} />
                  </mesh>

                  {/* Sloping Dark Charcoal-Navy Lower Dado Wall Along Seating Tiers */}
                  <mesh
                    position={[wallX + inDir * 0.046, 0, 0]}
                    geometry={arctic4dxWall.dadoGeo}
                    material={arcticResources.dadoMat}
                    receiveShadow
                  />
                  {/* Slim Architectural Dado Top Coping Trim */}
                  <ArchitecturalChannelBar
                    start={[wallX + inDir * 0.072, arctic4dxWall.yDadoFront, arctic4dxWall.zExitEnd]}
                    end={[wallX + inDir * 0.072, arctic4dxWall.yDadoRear, arctic4dxWall.zMax]}
                    thickness={0.04}
                    depth={0.05}
                    material={arcticResources.seamBackingMat}
                    interiorFocusY={H * 0.45}
                  />

                  {/* Crisp Diagonal Geometric & Nested V-Chevron Acoustic Fabric Polygons */}
                  {arctic4dxWall.panels.map((p, pi) => (
                    <mesh
                      key={`arctic-geo-panel-${side}-${pi}`}
                      position={[wallX + inDir * p.depthOffset, 0, 0]}
                      geometry={p.geo}
                      material={toneMatMap[p.tone]}
                      receiveShadow
                    />
                  ))}

                  {/* Razor-Thin Recessed Electric-Violet & Ice-Cyan Linear LED Channels Tracing Diagonal Seams & V-Chevrons */}
                  {arctic4dxWall.ledSeamSegments.map((seg, si) => (
                    <ArchitecturalChannelBar
                      key={`arctic-led-${side}-${si}`}
                      start={[ledX, seg.startZY[1], seg.startZY[0]]}
                      end={[ledX, seg.endZY[1], seg.endZY[0]]}
                      thickness={0.024}
                      depth={0.024}
                      material={seg.isCyan ? arcticResources.cyanStripMat : arcticResources.violetStripMat}
                      housingMaterial={arcticResources.seamBackingMat}
                      interiorFocusY={H * 0.45}
                    />
                  ))}
                </group>
              );
            })}

            {/* Rear Wall Flanking Geometric Wings & Diagonal Violet/Cyan LED Channels */}
            <group position={[0, 0, backZ - 0.21]}>
              <mesh position={[0, 0, -0.028]} geometry={arctic4dxWall.rearDadoGeo} material={arcticResources.dadoMat} receiveShadow />
              <mesh position={[0, 0, -0.028]} geometry={arctic4dxWall.rearDadoRightGeo} material={arcticResources.dadoMat} receiveShadow />
              {arctic4dxWall.rearPanels.map((rp, rpi) => (
                <mesh
                  key={`arctic-rear-panel-${rpi}`}
                  position={[0, 0, -rp.depthOffset]}
                  geometry={rp.geo}
                  material={
                    rp.tone === 'frost'
                      ? arcticResources.frostGreyMat
                      : rp.tone === 'slate'
                        ? arcticResources.slateBlueMat
                        : rp.tone === 'cobalt'
                          ? arcticResources.cobaltBlueMat
                          : arcticResources.charcoalNavyMat
                  }
                  receiveShadow
                />
              ))}
              {arctic4dxWall.rearLeds.map((rl, rli) => {
                const dx = rl.endXY[0] - rl.startXY[0];
                const dy = rl.endXY[1] - rl.startXY[1];
                const len = Math.hypot(dx, dy);
                const mx = (rl.startXY[0] + rl.endXY[0]) * 0.5;
                const my = (rl.startXY[1] + rl.endXY[1]) * 0.5;
                const ang = Math.atan2(dy, dx);
                return (
                  <mesh
                    key={`arctic-rear-led-${rli}`}
                    position={[mx, my, -0.088]}
                    rotation={[0, 0, ang]}
                    material={rl.isCyan ? arcticResources.cyanStripMat : arcticResources.violetStripMat}
                  >
                    <boxGeometry args={[len, 0.024, 0.02]} />
                  </mesh>
                );
              })}
            </group>
          </group>
        )}

      {/* 4DX Thunder Arena: Dramatic 3D Parametric Ribbed Acoustic Fins in Matte Titanium Grey & Deep Espresso-Bronze + Inner Golden-Amber & Ice-White LEDs + Sleek Recessed Air Turbines */}
      {sideLightStyle === 'thunder_emerald_waves' &&
        thunderWaveWall &&
        [-1, 1].map((side) => {
          const wallX = side * (W / 2 - 0.21);
          const inDir = -side;
          const ledX = wallX + inDir * 0.058;
          return (
            <group key={`thunder-4dx-wall-${side}`}>
              {/* Dark Acoustic Backing Cavity Behind Ribs */}
              <mesh position={[wallX + inDir * 0.012, H * 0.5, 0]} material={mats.pitchBlackAcousticMat}>
                <boxGeometry args={[0.024, H * 0.94, L * 0.92]} />
              </mesh>

              {/* 3D Parametric Ribbed Acoustic Fins (Titanium Grey & Deep Espresso-Bronze) */}
              {thunderWaveWall.fins.map((fin, fi) => (
                <mesh
                  key={`thunder-parametric-fin-${side}-${fi}`}
                  position={[wallX + inDir * 0.018, 0, fin.z]}
                  rotation={[0, side === 1 ? Math.PI : 0, 0]}
                  geometry={fin.geo}
                  material={fin.tone === 'titanium' ? mats.titaniumFinMat : mats.espressoBronzeFinMat}
                  castShadow
                  receiveShadow
                />
              ))}

              {/* Warm Golden-Amber & Crisp Ice-White Linear LED Strips Illuminated From Within Between Ribs */}
              {thunderWaveWall.ledStrips.map((strip, si) => (
                <ArchitecturalChannelBar
                  key={`thunder-inner-led-${side}-${si}`}
                  start={[ledX, strip.yStart, strip.z]}
                  end={[ledX, strip.yEnd, strip.z]}
                  thickness={0.034}
                  depth={0.03}
                  material={strip.isWhite ? mats.secondaryEmitterMat : mats.primaryEmitterMat}
                  housingMaterial={mats.channelMetalMat}
                  interiorFocusY={H * 0.48}
                />
              ))}

              {/* Sleek Recessed Circular High-Velocity Air Turbines Integrated Cleanly Between Wall Ribs */}
              {wallBayZs.map((bz, bi) => {
                const rowFrac = THREE.MathUtils.clamp(
                  (bz - firstRowZ) / Math.max(0.5, rowSpacing),
                  0,
                  Math.max(0, seatingRows - 1),
                );
                const tierY = rowFrac * rowElevationStep;
                const turbineY = Math.min(H - 2.0, tierY + 2.45);
                return (
                  <group
                    key={`thunder-recessed-turbine-${side}-${bi}`}
                    position={[wallX + inDir * 0.085, turbineY, bz]}
                    rotation={[0, inDir * (Math.PI / 2), 0]}
                  >
                    {/* Flush Brushed Titanium Recessed Bezel Ring */}
                    <mesh rotation={[Math.PI / 2, 0, 0]} material={mats.titaniumFinMat}>
                      <cylinderGeometry args={[0.27, 0.27, 0.05, 24]} />
                    </mesh>
                    {/* Deep Dark Acoustic Turbine Throat */}
                    <mesh position={[0, 0, 0.012]} rotation={[Math.PI / 2, 0, 0]} material={mats.pitchBlackAcousticMat}>
                      <cylinderGeometry args={[0.215, 0.215, 0.04, 22]} />
                    </mesh>
                    {/* Machined Aluminum Hub & 6 Recessed Turbine Blades */}
                    <mesh position={[0, 0, 0.02]} rotation={[Math.PI / 2, 0, 0]} material={mats.nozzleBrassMat}>
                      <cylinderGeometry args={[0.055, 0.055, 0.05, 14]} />
                    </mesh>
                    {[0, 1, 2].map((ri) => (
                      <mesh
                        key={`thunder-recessed-blade-${ri}`}
                        position={[0, 0, 0.018]}
                        rotation={[0, 0, (ri * Math.PI) / 3]}
                        material={mats.channelMetalMat}
                      >
                        <boxGeometry args={[0.38, 0.04, 0.018]} />
                      </mesh>
                    ))}
                    {/* Subtle Perimeter Ring Illumination */}
                    <mesh position={[0, 0, 0.032]} material={bi % 2 === 0 ? mats.primaryEmitterMat : mats.secondaryEmitterMat}>
                      <torusGeometry args={[0.23, 0.01, 8, 24]} />
                    </mesh>
                  </group>
                );
              })}
            </group>
          );
        })}

      {/* ICE Theater 1 (Flagship): Sculpted Matte-Black Carbon-Weave Acoustic Modules, Precision Brushed-Aluminum Reveals & Concealed Surrounds */}
      {isIce && iceLayout && sideLightStyle === 'ice_faceted_cyan' && (
        <group>
          {[-1, 1].map((side) => {
            const wallX = side * (W / 2 - 0.22);
            const inDir = -side;
            const carbonMat = wallMat ?? mats.carbonBlackAcousticMat;
            return (
              <group key={`ice-flagship-wall-${side}`}>
                {iceLayout.panelZs.map((pz, idx) => {
                  const py = iceLayout.panelYs[idx];
                  const nextZ = iceLayout.panelZs[idx + 1];
                  const prevZ = iceLayout.panelZs[idx - 1];
                  const baySpan = nextZ
                    ? Math.abs(nextZ - pz)
                    : prevZ
                      ? Math.abs(pz - prevZ)
                      : 3.4;
                  const t = idx / Math.max(1, iceLayout.panelZs.length - 1);
                  const moduleDepthX = wallX + inDir * (0.06 + t * 0.14);
                  const facetTilt = side * iceLayout.inwardAngle;
                  return (
                    <group key={`ice-flagship-bay-${side}-${idx}`}>
                      {/* Sculpted Matte-Black Carbon-Weave Acoustic Wall Module */}
                      <mesh
                        position={[moduleDepthX, H * 0.5, pz]}
                        rotation={[0, facetTilt, 0]}
                        material={carbonMat}
                        receiveShadow
                      >
                        <boxGeometry args={[0.14, H * 0.92, Math.max(2.9, baySpan * 0.91)]} />
                      </mesh>
                      {/* Precision Brushed-Aluminum Horizontal Mid-Tier Reveal Dividing Upper & Lower LED Tiers */}
                      <mesh
                        position={[moduleDepthX + inDir * 0.082, py, pz]}
                        rotation={[0, facetTilt, 0]}
                        material={mats.iceBrushedAlumMat}
                      >
                        <boxGeometry args={[0.028, 0.048, Math.max(2.9, baySpan * 0.93)]} />
                      </mesh>
                      {/* Precision Brushed-Aluminum Top & Bottom Module Shadow Reveals */}
                      <mesh
                        position={[moduleDepthX + inDir * 0.08, H * 0.91, pz]}
                        rotation={[0, facetTilt, 0]}
                        material={mats.iceBrushedAlumMat}
                      >
                        <boxGeometry args={[0.022, 0.032, Math.max(2.9, baySpan * 0.93)]} />
                      </mesh>
                      <mesh
                        position={[moduleDepthX + inDir * 0.08, Math.max(0.85, py - iceLayout.panelHeight - 0.56), pz]}
                        rotation={[0, facetTilt, 0]}
                        material={mats.iceBrushedAlumMat}
                      >
                        <boxGeometry args={[0.022, 0.032, Math.max(2.9, baySpan * 0.93)]} />
                      </mesh>
                    </group>
                  );
                })}
                {/* Vertical Precision Brushed-Aluminum Reveals & Concealed Flush Surround Grilles Between Bays */}
                {iceLayout.betweenPanelZs.map((bz, bi) => {
                  const midY = ((iceLayout.panelYs[bi] ?? 5.6) + (iceLayout.panelYs[bi + 1] ?? 5.8)) * 0.5;
                  const t = (bi + 0.5) / Math.max(1, iceLayout.panelZs.length - 1);
                  const seamX = wallX + inDir * (0.14 + t * 0.14);
                  return (
                    <group key={`ice-flagship-reveal-${side}-${bi}`} position={[seamX, H * 0.5, bz]}>
                      <mesh material={mats.iceBrushedAlumMat}>
                        <boxGeometry args={[0.04, H * 0.88, 0.055]} />
                      </mesh>
                      {/* Concealed Flush-Mounted Surround Speaker Integrated Seamlessly in Acoustic Reveal */}
                      <mesh position={[inDir * 0.015, midY - H * 0.5, 0]} material={mats.concealedGrilleMat}>
                        <boxGeometry args={[0.032, 0.68, 0.34]} />
                      </mesh>
                    </group>
                  );
                })}
              </group>
            );
          })}
        </group>
      )}

      {/* ICE Theater 2 (Cobalt Grand): Sweeping Curved Sandblasted-Taupe Acoustic Plaster Walls, Ribbed Bronze-Metal Ribs & Hidden Surrounds */}
      {isIce && iceLayout && sideLightStyle === 'ice_faceted_cobalt' && iceLayout.curvedWallPoints && (
        <group>
          {[-1, 1].map((side) => {
            const inDir = -side;
            const plasterMat = wallMat ?? mats.iceTaupePlasterMat;
            const pts = iceLayout.curvedWallPoints!;
            return (
              <group key={`ice-cobalt-curved-wall-${side}`}>
                {/* Sweeping Curved Sandblasted-Taupe Acoustic Plaster Wall Segments */}
                {pts.slice(0, -1).map((p0, idx) => {
                  const p1 = pts[idx + 1];
                  const midZ = (p0.z + p1.z) * 0.5;
                  const midX = side * ((p0.wallX + p1.wallX) * 0.5);
                  const dz = p1.z - p0.z;
                  const dx = (p1.wallX - p0.wallX) * side;
                  const segLen = Math.hypot(dz, dx) + 0.08;
                  const yaw = Math.atan2(dx, dz);
                  return (
                    <group key={`ice-cobalt-seg-${side}-${idx}`} position={[midX, H * 0.49, midZ]} rotation={[0, yaw, 0]}>
                      <mesh material={plasterMat} receiveShadow>
                        <boxGeometry args={[0.24, H * 0.94, segLen]} />
                      </mesh>
                      {/* Vertical Ribbed Bronze-Metal Architectural Wall Ribs */}
                      {[-segLen * 0.34, 0, segLen * 0.34].map((rz, ri) => (
                        <mesh
                          key={`bronze-rib-${ri}`}
                          position={[inDir * 0.122, 0, rz]}
                          material={mats.iceRibbedBronzeMat}
                        >
                          <boxGeometry args={[0.036, H * 0.92, 0.085]} />
                        </mesh>
                      ))}
                    </group>
                  );
                })}
                {/* Horizontal Ribbed Bronze-Metal Dado & Upper Datum Moldings Following Wall Curve */}
                {iceLayout.betweenPanelZs.map((bz, bi) => {
                  const u = THREE.MathUtils.clamp((bz - (frontZ + 1.2)) / (L - 2.4), 0.05, 0.95);
                  const bow = Math.sin(Math.PI * u) * 0.85;
                  const spkX = side * (W / 2 - 0.95 + bow) + inDir * 0.12;
                  const spkY = ((iceLayout.panelYs[bi] ?? 4.8) + (iceLayout.panelYs[bi + 1] ?? 5.2)) * 0.5;
                  return (
                    <group key={`ice-cobalt-spk-${side}-${bi}`} position={[spkX, spkY, bz]}>
                      <mesh material={mats.iceRibbedBronzeMat}>
                        <boxGeometry args={[0.05, 0.78, 0.42]} />
                      </mesh>
                      {/* Hidden Bronze-Black Surround Grille Recessed Flush Between Bronze Ribs */}
                      <mesh position={[inDir * 0.022, 0, 0]} material={mats.concealedGrilleMat}>
                        <boxGeometry args={[0.025, 0.68, 0.32]} />
                      </mesh>
                    </group>
                  );
                })}
              </group>
            );
          })}
        </group>
      )}

      {/* ICE Theater 3 (Obsidian Amber): Vertical Charred Shou Sugi Ban Timber Slats, Dark Basalt Acoustic Bays & Concealed Surrounds */}
      {isIce && iceLayout && sideLightStyle === 'ice_faceted_amber' && (
        <group>
          {[-1, 1].map((side) => {
            const wallX = side * (W / 2 - 0.22);
            const inDir = -side;
            const facetTilt = side * iceLayout.inwardAngle;
            const slatCount = 46;
            const zSpanStart = frontZ + 3.2;
            const zSpanEnd = backZ - 2.0;
            return (
              <group key={`ice-amber-shou-wall-${side}`}>
                {/* Angled Dark Basalt Acoustic Fabric Wall Bays */}
                {iceLayout.panelZs.map((pz, idx) => {
                  const t = idx / Math.max(1, iceLayout.panelZs.length - 1);
                  const bayX = wallX + inDir * (0.04 + t * 0.12);
                  return (
                    <mesh
                      key={`ice-amber-basalt-${side}-${idx}`}
                      position={[bayX, H * 0.5, pz]}
                      rotation={[0, facetTilt, 0]}
                      material={wallMat ?? mats.iceBasaltFabricMat}
                      receiveShadow
                    >
                      <boxGeometry args={[0.12, H * 0.92, 3.65]} />
                    </mesh>
                  );
                })}
                {/* Rhythmic Vertical Charred Shou Sugi Ban Timber Slats Flanking & Framing Floating Diagonal LED Panels */}
                {Array.from({ length: slatCount }, (_, si) => {
                  const u = si / (slatCount - 1);
                  const sz = THREE.MathUtils.lerp(zSpanStart, zSpanEnd, u);
                  const slatX = wallX + inDir * (0.11 + u * 0.12);
                  // Check proximity to diagonal panel center so slats wrap cleanly above/below active panel faces without clipping them
                  const nearPanelIdx = iceLayout.panelZs.findIndex(
                    (pz) => Math.abs(sz - pz) < iceLayout.panelWidth * 0.49,
                  );
                  if (nearPanelIdx >= 0) {
                    const py = iceLayout.panelYs[nearPanelIdx];
                    const halfH = iceLayout.panelHeight * 0.5 + 0.14;
                    const lowerH = Math.max(0.25, py - halfH - 0.15);
                    const upperH = Math.max(0.25, H - 0.35 - (py + halfH));
                    return (
                      <group key={`ice-amber-slat-split-${side}-${si}`}>
                        <mesh
                          position={[slatX, 0.15 + lowerH * 0.5, sz]}
                          rotation={[0, facetTilt, 0]}
                          material={mats.iceShouSugiBanMat}
                        >
                          <boxGeometry args={[0.07, lowerH, 0.075]} />
                        </mesh>
                        <mesh
                          position={[slatX, py + halfH + upperH * 0.5, sz]}
                          rotation={[0, facetTilt, 0]}
                          material={mats.iceShouSugiBanMat}
                        >
                          <boxGeometry args={[0.07, upperH, 0.075]} />
                        </mesh>
                      </group>
                    );
                  }
                  return (
                    <mesh
                      key={`ice-amber-slat-full-${side}-${si}`}
                      position={[slatX, H * 0.49, sz]}
                      rotation={[0, facetTilt, 0]}
                      material={mats.iceShouSugiBanMat}
                    >
                      <boxGeometry args={[0.075, H * 0.9, 0.08]} />
                    </mesh>
                  );
                })}
                {/* Concealed Flush Surround Grilles Tucked Cleanly Between Shou Sugi Ban Slats */}
                {iceLayout.betweenPanelZs.map((bz, bi) => {
                  const midY = ((iceLayout.panelYs[bi] ?? 4.4) + (iceLayout.panelYs[bi + 1] ?? 5.4)) * 0.5;
                  const t = (bi + 0.5) / Math.max(1, iceLayout.panelZs.length - 1);
                  const spkX = wallX + inDir * (0.12 + t * 0.12);
                  return (
                    <mesh
                      key={`ice-amber-spk-${side}-${bi}`}
                      position={[spkX, midY, bz]}
                      rotation={[0, facetTilt, 0]}
                      material={mats.concealedGrilleMat}
                    >
                      <boxGeometry args={[0.05, 0.72, 0.34]} />
                    </mesh>
                  );
                })}
              </group>
            );
          })}
        </group>
      )}

      {/* Sylva Moss 250: Tight Voronoi Preserved-Moss Mosaic Walls, Recessed Warm-Gold Diagonal Crevice LEDs, Wood Speaker Alcoves & Base LED Skirting */}
      {sideLightStyle === 'biophilic_crystalline_moss' &&
        biophilicCrystallineMossWall &&
        biophilicMossResources && (
          <group>
            {/* Left & Right Side Walls */}
            {([-1, 1] as const).map((side) => {
              const baseFaceX = side * (W / 2 - 0.21);
              const inDir = -side;
              const wall = side === -1 ? biophilicCrystallineMossWall.leftWall : biophilicCrystallineMossWall.rightWall;
              const wallLen = biophilicCrystallineMossWall.zMax - biophilicCrystallineMossWall.zMin;
              const wallMidZ = (biophilicCrystallineMossWall.zMin + biophilicCrystallineMossWall.zMax) * 0.5;
              return (
                <group key={`biophilic-side-${side}`} position={[baseFaceX, 0, 0]}>
                  {/* Deep Matte-Charcoal Acoustic Felt Wall Backing Substrate */}
                  <mesh position={[inDir * 0.01, H * 0.5, 0]} material={biophilicMossResources.woodAlcoveBackMat} receiveShadow>
                    <boxGeometry args={[0.025, H - 0.32, L - 0.45]} />
                  </mesh>

                  {/* Seam-to-Seam Voronoi Organic Preserved-Moss Polygon Panels */}
                  <mesh geometry={wall.sandGeo} material={biophilicMossResources.sandBeigeMat} receiveShadow castShadow />
                  <mesh geometry={wall.sageGeo} material={biophilicMossResources.sageGreenMat} receiveShadow castShadow />
                  <mesh geometry={wall.oliveGeo} material={biophilicMossResources.oliveMossMat} receiveShadow castShadow />
                  <mesh geometry={wall.charcoalGeo} material={biophilicMossResources.charcoalFeltMat} receiveShadow castShadow />

                  {/* Recessed Warm-Gold Diagonal Crevice LED Channels */}
                  <mesh geometry={wall.seamLedGeo} material={biophilicMossResources.seamGlowMat} />

                  {/* Continuous Warm-Gold Bottom Wall Skirting LED Channel */}
                  <mesh
                    position={[inDir * 0.055, biophilicCrystallineMossWall.yBot - 0.025, wallMidZ]}
                    material={biophilicMossResources.seamGlowMat}
                  >
                    <boxGeometry args={[0.028, 0.032, wallLen]} />
                  </mesh>

                  {/* Warm Wood-Framed Rectangular Inset Speaker Alcoves */}
                  {biophilicCrystallineMossWall.sideSpeakers.map((spk, ri) => (
                    <group
                      key={`biophilic-side-recess-${side}-${ri}`}
                      position={[inDir * 0.09, spk.y, spk.z]}
                    >
                      <mesh position={[-inDir * 0.07, 0, 0]} material={biophilicMossResources.woodAlcoveBackMat}>
                        <boxGeometry args={[0.03, 1.12, 0.92]} />
                      </mesh>
                      <mesh position={[0, 0.54, 0]} material={biophilicMossResources.woodRecessMat}>
                        <boxGeometry args={[0.2, 0.055, 0.94]} />
                      </mesh>
                      <mesh position={[0, -0.54, 0]} material={biophilicMossResources.woodRecessMat}>
                        <boxGeometry args={[0.2, 0.055, 0.94]} />
                      </mesh>
                      <mesh position={[0, 0, -0.45]} material={biophilicMossResources.woodRecessMat}>
                        <boxGeometry args={[0.2, 1.135, 0.055]} />
                      </mesh>
                      <mesh position={[0, 0, 0.45]} material={biophilicMossResources.woodRecessMat}>
                        <boxGeometry args={[0.2, 1.135, 0.055]} />
                      </mesh>
                    </group>
                  ))}
                </group>
              );
            })}

            {/* Rear Wall: Matching Voronoi Preserved-Moss Mosaic Around Open Projection Booth & Doors */}
            <group position={[0, 0, backZ - 0.21]}>
              {/* Left & Right Rear Wing Backing (keeps center projection booth window & glass 100% visible) */}
              {([-1, 1] as const).map((wSide) => {
                const clearHalfW = biophilicCrystallineMossWall.bWinW * 0.5 + 0.14;
                const wingW = Math.max(0.5, W * 0.5 - 0.22 - clearHalfW);
                const wingCx = wSide * (clearHalfW + wingW * 0.5);
                return (
                  <mesh
                    key={`biophilic-rear-wing-back-${wSide}`}
                    position={[wingCx, H * 0.54, 0.01]}
                    material={biophilicMossResources.woodAlcoveBackMat}
                    receiveShadow
                  >
                    <boxGeometry args={[wingW, H * 0.84, 0.025]} />
                  </mesh>
                );
              })}
              {/* Lower Spandrel Backing Below Booth Window & Header Above Booth Window */}
              {biophilicCrystallineMossWall.wBot - 0.14 > 0.4 && (
                <mesh
                  position={[0, (biophilicCrystallineMossWall.wBot - 0.14) * 0.5, 0.01]}
                  material={biophilicMossResources.woodAlcoveBackMat}
                  receiveShadow
                >
                  <boxGeometry
                    args={[
                      biophilicCrystallineMossWall.bWinW + 0.28,
                      biophilicCrystallineMossWall.wBot - 0.14,
                      0.025,
                    ]}
                  />
                </mesh>
              )}
              {H - 0.24 - (biophilicCrystallineMossWall.wTop + 0.14) > 0.2 && (
                <mesh
                  position={[
                    0,
                    (biophilicCrystallineMossWall.wTop + 0.14 + (H - 0.24)) * 0.5,
                    0.01,
                  ]}
                  material={biophilicMossResources.woodAlcoveBackMat}
                  receiveShadow
                >
                  <boxGeometry
                    args={[
                      biophilicCrystallineMossWall.bWinW + 0.28,
                      H - 0.24 - (biophilicCrystallineMossWall.wTop + 0.14),
                      0.025,
                    ]}
                  />
                </mesh>
              )}

              <mesh geometry={biophilicCrystallineMossWall.rearWall.sandGeo} material={biophilicMossResources.sandBeigeMat} receiveShadow castShadow />
              <mesh geometry={biophilicCrystallineMossWall.rearWall.sageGeo} material={biophilicMossResources.sageGreenMat} receiveShadow castShadow />
              <mesh geometry={biophilicCrystallineMossWall.rearWall.oliveGeo} material={biophilicMossResources.oliveMossMat} receiveShadow castShadow />
              <mesh geometry={biophilicCrystallineMossWall.rearWall.charcoalGeo} material={biophilicMossResources.charcoalFeltMat} receiveShadow castShadow />
              <mesh geometry={biophilicCrystallineMossWall.rearWall.seamLedGeo} material={biophilicMossResources.seamGlowMat} />

              {/* Rear Wall Base Warm-Gold Skirting Flanking Rear Doors */}
              {([-1, 1] as const).map((rSide) => {
                const segW = Math.max(1.0, W * 0.5 - 1.9);
                const segX = rSide * (1.58 + segW * 0.5);
                return (
                  <mesh
                    key={`biophilic-rear-skirt-${rSide}`}
                    position={[segX, biophilicCrystallineMossWall.rYMin - 0.02, -0.055]}
                    material={biophilicMossResources.seamGlowMat}
                  >
                    <boxGeometry args={[segW, 0.032, 0.028]} />
                  </mesh>
                );
              })}

              {/* Rear Wall Wood-Framed Architectural Speaker Inset Casings */}
              {biophilicCrystallineMossWall.rearSpeakers.map((spk, ri) => (
                <group key={`biophilic-rear-recess-${ri}`} position={[spk.x, spk.y, -0.09]}>
                  <mesh position={[0, 0, 0.07]} material={biophilicMossResources.woodAlcoveBackMat}>
                    <boxGeometry args={[0.92, 1.12, 0.03]} />
                  </mesh>
                  <mesh position={[0, 0.54, 0]} material={biophilicMossResources.woodRecessMat}>
                    <boxGeometry args={[0.94, 0.055, 0.2]} />
                  </mesh>
                  <mesh position={[0, -0.54, 0]} material={biophilicMossResources.woodRecessMat}>
                    <boxGeometry args={[0.94, 0.055, 0.2]} />
                  </mesh>
                  <mesh position={[-0.45, 0, 0]} material={biophilicMossResources.woodRecessMat}>
                    <boxGeometry args={[0.055, 1.135, 0.2]} />
                  </mesh>
                  <mesh position={[0.45, 0, 0]} material={biophilicMossResources.woodRecessMat}>
                    <boxGeometry args={[0.055, 1.135, 0.2]} />
                  </mesh>
                </group>
              ))}
            </group>
          </group>
        )}

      {/* Flush Matte Acoustic Bays + Crisscross Continuous Geometric LED Channels */}
      {sideLightStyle === 'crisscross_geometric' && (
        <group>
          {wallBayZs.slice(0, -1).map((bz, idx) =>
            [-1, 1].map((side) => (
              <mesh
                key={`mat-bay-${idx}-${side}`}
                position={[
                  side * (W / 2 - 0.21),
                  H * 0.5,
                  (bz + wallBayZs[idx + 1]) / 2,
                ]}
                material={acousticPanelMat}
                receiveShadow
              >
                <boxGeometry
                  args={[0.05, H * 0.84, Math.max(0.4, Math.abs(wallBayZs[idx + 1] - bz) - 0.14)]}
                />
              </mesh>
            )),
          )}
          {wallBayZs.slice(1, -1).map((bz, idx) =>
            [-1, 1].map((side) => (
              <group key={`crisscross-grille-${idx}-${side}`} position={[side * (W / 2 - 0.22), H * 0.72, bz]}>
                <mesh material={mats.channelMetalMat}>
                  <boxGeometry args={[0.04, 0.72, 0.72]} />
                </mesh>
                <mesh position={[-side * 0.022, 0, 0]} material={acousticPanelMat}>
                  <boxGeometry args={[0.02, 0.56, 0.56]} />
                </mesh>
              </group>
            )),
          )}
          {crisscrossSegments.map((seg, i) => (
            <ArchitecturalChannelBar
              key={`crisscross-${i}`}
              start={seg.start}
              end={seg.end}
              thickness={0.055}
              depth={0.042}
              material={seg.accent ? mats.secondaryEmitterMat : mats.primaryEmitterMat}
              housingMaterial={mats.channelMetalMat}
              interiorFocusY={H * 0.45}
            />
          ))}
        </group>
      )}

      {/* Dolby Obsidian Reference: Charcoal-Black & Midnight-Slate Acoustic Panels Divided by Brushed Gunmetal Trims + Recessed Dolby-Blue & Soft Warm-White LED Strips */}
      {sideLightStyle === 'obsidian_slat_grazers' &&
        dolbyObsidianWall &&
        [-1, 1].map((side) => {
          const wallX = side * (W / 2 - 0.21);
          const inDir = -side;
          const trimX = wallX + inDir * 0.072;
          const ledX = wallX + inDir * 0.078;
          return (
            <group key={`dolby-obsidian-wall-${side}`}>
              {/* Matte Obsidian-Black Backing Wall */}
              <mesh position={[wallX + inDir * 0.01, H * 0.5, 0]} material={mats.pitchBlackAcousticMat}>
                <boxGeometry args={[0.02, H * 0.96, L * 0.95]} />
              </mesh>

              {/* Matte Charcoal-Black & Deep Midnight-Slate Acoustic Fabric Panels */}
              {dolbyObsidianWall.panels.map((p, pi) => (
                <mesh
                  key={`obsidian-panel-${side}-${pi}`}
                  position={[wallX + inDir * p.depthOffset, 0, 0]}
                  geometry={p.geo}
                  material={p.isMidnightSlate ? mats.midnightSlateFabricMat : mats.obsidianFabricMat}
                  receiveShadow
                />
              ))}

              {/* Clean Diagonal & Vertical Brushed Gunmetal Trims Dividing the Acoustic Panels */}
              {dolbyObsidianWall.trimBars.map((bar, bi) => (
                <ArchitecturalChannelBar
                  key={`obsidian-trim-${side}-${bi}`}
                  start={[trimX, bar.startZY[1], bar.startZY[0]]}
                  end={[trimX, bar.endZY[1], bar.endZY[0]]}
                  thickness={0.042}
                  depth={0.028}
                  material={mats.brushedGunmetalMat}
                  interiorFocusY={H * 0.48}
                />
              ))}

              {/* Sleek Recessed Dolby-Blue & Soft Warm-White Linear LED Light Strips */}
              {dolbyObsidianWall.ledStrips.map((seg, si) => (
                <ArchitecturalChannelBar
                  key={`obsidian-led-${side}-${si}`}
                  start={[ledX, seg.startZY[1], seg.startZY[0]]}
                  end={[ledX, seg.endZY[1], seg.endZY[0]]}
                  thickness={0.028}
                  depth={0.024}
                  material={seg.isWarmWhite ? mats.secondaryEmitterMat : mats.primaryEmitterMat}
                  housingMaterial={mats.channelMetalMat}
                  interiorFocusY={H * 0.48}
                />
              ))}
            </group>
          );
        })}

      {/* Dolby Cobalt Noir: Horizontal Charcoal-Slate Acoustic Panels & Warm Dark Walnut-Bronze Wood Slats Separated by Satin-Black Trims + Warm-Amber & Soft Cool-Blue LEDs */}
      {sideLightStyle === 'diagonal_parabolic_ribs' &&
        dolbyCobaltWall &&
        [-1, 1].map((side) => {
          const wallX = side * (W / 2 - 0.21);
          const inDir = -side;
          const ledX = wallX + inDir * 0.078;
          return (
            <group key={`dolby-cobalt-horizontal-wall-${side}`}>
              {/* Deep Matte-Black Acoustic Wall Cavity Behind Slats & Panels */}
              <mesh position={[wallX + inDir * 0.012, H * 0.5, 0]} material={mats.pitchBlackAcousticMat}>
                <boxGeometry args={[0.024, H * 0.95, L * 0.94]} />
              </mesh>

              {/* Matte Charcoal-Slate Acoustic Fabric Panels */}
              {dolbyCobaltWall.fabricPanels.map((panel, pi) => (
                <mesh
                  key={`cobalt-fabric-${side}-${pi}`}
                  position={[wallX + inDir * (panel.depth * 0.5 + 0.016), panel.posZY[1], panel.posZY[0]]}
                  material={mats.charcoalSlatePanelMat}
                  receiveShadow
                >
                  <boxGeometry args={[panel.depth, panel.heightY, panel.lengthZ]} />
                </mesh>
              ))}

              {/* Warm Dark Walnut-Bronze Wood-Textured Vertical Acoustic Slats */}
              {dolbyCobaltWall.woodSlats.map((slat, si) => (
                <mesh
                  key={`cobalt-slat-${side}-${si}`}
                  position={[wallX + inDir * 0.048, slat.yMid, slat.z]}
                  material={mats.walnutBronzeWoodMat}
                  receiveShadow
                  castShadow
                >
                  <boxGeometry args={[0.064, slat.heightY, 0.056]} />
                </mesh>
              ))}

              {/* Clean Satin-Black Architectural Trims Separating Horizontal Bands & Bays */}
              {dolbyCobaltWall.satinTrims.map((trim, ti) => (
                <mesh
                  key={`cobalt-trim-${side}-${ti}`}
                  position={[wallX + inDir * 0.068, trim.posZY[1], trim.posZY[0]]}
                  material={mats.satinBlackTrimMat}
                >
                  <boxGeometry args={[0.042, trim.heightY, trim.lengthZ]} />
                </mesh>
              ))}

              {/* Sleek Recessed Warm-Amber & Soft Cool-Blue Linear LED Light Strips */}
              {dolbyCobaltWall.ledStrips.map((seg, li) => (
                <ArchitecturalChannelBar
                  key={`cobalt-led-${side}-${li}`}
                  start={[ledX, seg.startZY[1], seg.startZY[0]]}
                  end={[ledX, seg.endZY[1], seg.endZY[0]]}
                  thickness={0.026}
                  depth={0.024}
                  material={seg.isCoolBlue ? mats.secondaryEmitterMat : mats.primaryEmitterMat}
                  housingMaterial={mats.channelMetalMat}
                  interiorFocusY={H * 0.48}
                />
              ))}
            </group>
          );
        })}

      {/* Dolby Cobalt Veil 250: Continuous Interlocked Faceted 3D Acoustic Wall Blocks + Sweeping Molten-Amber & Dual Celestial-Violet Indirect Cove Channels */}
      {sideLightStyle === 'cobalt_veil_laser_recess' && cobaltVeilWall && eclipseResources && (
        <group>
          {([-1, 1] as const).map((side) => {
            const wallX = side * (W / 2 - 0.21);
            const inDir = -side;
            const wall = side === -1 ? cobaltVeilWall.leftWall : cobaltVeilWall.rightWall;
            return (
              <group key={`dolby-eclipse-side-${side}`} position={[wallX, 0, 0]}>
                {/* Deep Acoustic Suede Backing Behind Reveal Gaps */}
                <mesh
                  position={[inDir * 0.012, H * 0.5, cobaltVeilWall.zCenter]}
                  material={mats.cobaltVeilShadowMat}
                >
                  <boxGeometry args={[0.024, H * 0.96, cobaltVeilWall.wallLen]} />
                </mesh>

                {/* Faceted 3D Polygonal Architectural Blocks (Carbon Fiber, Charcoal Suede & Charcoal Slate) */}
                <mesh geometry={wall.carbonGeo} material={eclipseResources.carbonFiberScaleMat} castShadow receiveShadow />
                <mesh geometry={wall.suedeGeo} material={eclipseResources.charcoalSuedeScaleMat} castShadow receiveShadow />
                <mesh geometry={wall.slateGeo} material={eclipseResources.charcoalSlateFacetMat} castShadow receiveShadow />

                {/* Sweeping Lower Molten-Amber Architectural Cove & Recessed LED Crease */}
                <mesh geometry={wall.amberCoveGeo} material={eclipseResources.amberCoveWashMat} />
                <mesh geometry={wall.amberLipGeo} material={eclipseResources.amberLipEmitterMat} />

                {/* Dual Sweeping Upper Celestial-Violet Architectural Coves & Recessed LED Creases */}
                <mesh geometry={wall.violet1CoveGeo} material={eclipseResources.violetCoveWashMat} />
                <mesh geometry={wall.violet2CoveGeo} material={eclipseResources.violetCoveWashMat} />
                <mesh geometry={wall.violet1LipGeo} material={eclipseResources.violetLipEmitterMat} />
                <mesh geometry={wall.violet2LipGeo} material={eclipseResources.violetLipEmitterMat} />
              </group>
            );
          })}

          {/* Rear Wall Faceted 3D Blocks & Cove Wings Framed Strictly Around Open Projection Booth Window & Rear Doors */}
          <group position={[0, 0, backZ - 0.22]}>
            {/* Left & Right Rear Wing Shadow Backing (leaves center booth window & doors 100% open) */}
            {([-1, 1] as const).map((wSide) => {
              const wingW = Math.max(0.5, W * 0.5 - 0.18 - cobaltVeilWall.boothClearHalfW);
              const wingCx = wSide * (cobaltVeilWall.boothClearHalfW + wingW * 0.5);
              return (
                <mesh
                  key={`rear-wing-back-${wSide}`}
                  position={[wingCx, H * 0.5, 0.012]}
                  material={mats.cobaltVeilShadowMat}
                >
                  <boxGeometry args={[wingW, H * 0.96, 0.024]} />
                </mesh>
              );
            })}
            {cobaltVeilWall.yCeil - (cobaltVeilWall.winTop + 0.12) > 0.25 && (
              <mesh
                position={[0, (cobaltVeilWall.winTop + 0.12 + cobaltVeilWall.yCeil) * 0.5, 0.012]}
                material={mats.cobaltVeilShadowMat}
              >
                <boxGeometry
                  args={[
                    cobaltVeilWall.boothClearHalfW * 2,
                    cobaltVeilWall.yCeil - (cobaltVeilWall.winTop + 0.12),
                    0.024,
                  ]}
                />
              </mesh>
            )}

            <mesh geometry={cobaltVeilWall.rearCarbonGeo} material={eclipseResources.carbonFiberScaleMat} castShadow receiveShadow />
            <mesh geometry={cobaltVeilWall.rearSuedeGeo} material={eclipseResources.charcoalSuedeScaleMat} castShadow receiveShadow />
            <mesh geometry={cobaltVeilWall.rearSlateGeo} material={eclipseResources.charcoalSlateFacetMat} castShadow receiveShadow />

            {cobaltVeilWall.rearAmberCoves.map((g, gi) => (
              <mesh key={`rear-amber-cove-${gi}`} geometry={g} material={eclipseResources.amberCoveWashMat} />
            ))}
            {cobaltVeilWall.rearVioletCoves.map((g, gi) => (
              <mesh key={`rear-violet-cove-${gi}`} geometry={g} material={eclipseResources.violetCoveWashMat} />
            ))}
            {cobaltVeilWall.rearAmberLips.map((g, gi) => (
              <mesh key={`rear-amber-lip-${gi}`} geometry={g} material={eclipseResources.amberLipEmitterMat} />
            ))}
            {cobaltVeilWall.rearVioletLips.map((g, gi) => (
              <mesh key={`rear-violet-lip-${gi}`} geometry={g} material={eclipseResources.violetLipEmitterMat} />
            ))}
          </group>
        </group>
      )}

      {/* Mandap Heritage 2D: Deeply Recessed Matte Terracotta & Deep Crimson Acoustic Fabric Bays Framed by Matte Antiqued-Gold Jali Lattice Screens & Curved Monolithic Mandap Arches (Concealing All Surround Speakers) */}
      {sideLightStyle === 'indian_mandap_jali' &&
        mandapJaliWall &&
        jaliResources &&
        [-1, 1].map((side) => {
          const wallX = side * (W / 2 - 0.21);
          const inDir = -side;
          const archOffsetX = side === -1 ? wallX + 0.04 : wallX - 0.04;
          const archRotY = side === -1 ? 0 : Math.PI;
          const { archWallH, archDepthX, innerHalf, springY, crownY, baySpan } = mandapJaliWall;
          return (
            <group key={`mandap-heritage-wall-${side}`}>
              {/* Deep Matte-Espresso Acoustic Shadow Backing Behind Recessed Bays */}
              <mesh position={[wallX + inDir * 0.02, H * 0.5, 0]} material={mats.mandapEspressoBackingMat}>
                <boxGeometry args={[0.04, H * 0.96, L * 0.94]} />
              </mesh>

              {mandapJaliWall.bays.map((bay, bi) => {
                const lowerH = archWallH * 0.34;
                const upperH = archWallH * 0.64;
                const bayW = innerHalf * 1.96;
                const jaliSideW = Math.min(0.68, innerHalf * 0.34);
                return (
                  <group key={`mandap-bay-${side}-${bi}`} position={[0, 0, bay.zMid]}>
                    {/* Lower Deeply Recessed Acoustic Fabric Dado Bay (Alternating Deep Crimson & Matte Terracotta) */}
                    <mesh
                      position={[wallX + inDir * 0.08, lowerH * 0.5 + 0.08, 0]}
                      material={bay.isTerracottaPrimary ? mats.mandapCrimsonFabricMat : mats.mandapTerracottaFabricMat}
                      receiveShadow
                    >
                      <boxGeometry args={[0.07, lowerH, bayW]} />
                    </mesh>

                    {/* Upper Deeply Recessed Acoustic Fabric Bay (Alternating Matte Terracotta & Deep Crimson) */}
                    <mesh
                      position={[wallX + inDir * 0.08, lowerH + upperH * 0.5 + 0.14, 0]}
                      material={bay.isTerracottaPrimary ? mats.mandapTerracottaFabricMat : mats.mandapCrimsonFabricMat}
                      receiveShadow
                    >
                      <boxGeometry args={[0.07, upperH, bayW]} />
                    </mesh>

                    {/* Intricate Matte Antiqued-Gold Jali Lattice Screens Flanking & Framing Each Recessed Acoustic Bay */}
                    {[-1, 1].map((jSide) => (
                      <group key={`jali-flank-${jSide}`} position={[wallX + inDir * 0.24, springY * 0.52, jSide * (innerHalf - jaliSideW * 0.52)]}>
                        <mesh
                          rotation={[0, side === -1 ? Math.PI / 2 : -Math.PI / 2, 0]}
                          material={jaliResources.jaliMat}
                          receiveShadow
                        >
                          <planeGeometry args={[jaliSideW, springY * 0.94]} />
                        </mesh>
                        {/* Slim Matte Antiqued-Gold Frame Stile Holding Jali Screen */}
                        <mesh position={[inDir * 0.015, 0, -jSide * jaliSideW * 0.5]} material={mats.mandapAntiquedGoldMat}>
                          <boxGeometry args={[0.055, springY * 0.96, 0.055]} />
                        </mesh>
                      </group>
                    ))}

                    {/* Intricate Matte Antiqued-Gold Jali Lattice Spandrel Header Panel Framing the Arch Crown */}
                    <mesh
                      position={[wallX + inDir * 0.26, (springY + crownY) * 0.5 + 0.28, 0]}
                      rotation={[0, side === -1 ? Math.PI / 2 : -Math.PI / 2, 0]}
                      material={jaliResources.jaliMat}
                    >
                      <planeGeometry args={[bayW * 0.92, Math.max(0.85, crownY - springY)]} />
                    </mesh>

                    {/* Softly Curved Monolithic Mandap-Inspired Structural Arch Concealing Surround Speakers */}
                    <mesh
                      position={[archOffsetX, 0.14, 0]}
                      rotation={[0, archRotY, 0]}
                      geometry={mandapJaliWall.archBayGeo}
                      material={mats.mandapArchSandstoneMat}
                      castShadow
                      receiveShadow
                    />
                    <mesh
                      position={[archOffsetX, 0.14, 0]}
                      rotation={[0, archRotY, 0]}
                      geometry={mandapJaliWall.archTrimGeo}
                      material={mats.mandapAntiquedGoldMat}
                      receiveShadow
                    />

                    {/* Monolithic Stepped Mandap Pilaster Plinth Bases & Carved Pier Capitals */}
                    {[-1, 1].map((pSide) => {
                      const pz = pSide * (baySpan * 0.5 - 0.34);
                      return (
                        <group key={`mandap-pier-${pSide}`} position={[wallX + inDir * (archDepthX * 0.52), 0, pz]}>
                          <mesh position={[0, 0.24, 0]} material={mats.mandapArchSandstoneMat} receiveShadow>
                            <boxGeometry args={[archDepthX * 1.08, 0.48, 0.84]} />
                          </mesh>
                          <mesh position={[0, springY + 0.16, 0]} material={mats.mandapAntiquedGoldMat}>
                            <boxGeometry args={[archDepthX * 1.12, 0.16, 0.86]} />
                          </mesh>
                        </group>
                      );
                    })}

                    {/* Concealed Warm-Amber Architectural Wash Tucked Behind Mandap Arch Soffit */}
                    <mesh position={[wallX + inDir * 0.16, crownY - 0.18, 0]}>
                      <boxGeometry args={[0.036, 0.032, innerHalf * 1.32]} />
                      <meshStandardMaterial
                        color="#3b2108"
                        emissive={lightingProfile.wallColor}
                        emissiveIntensity={wallAccentIntensity * 0.85}
                        roughness={0.28}
                      />
                    </mesh>
                  </group>
                );
              })}

              {/* Continuous Carved Matte Espresso & Antiqued-Gold Upper Frieze Crown Above Mandap Arches */}
              <mesh position={[wallX + inDir * (archDepthX * 0.5), archWallH + 0.18, 0]} material={mats.mandapArchSandstoneMat}>
                <boxGeometry args={[archDepthX * 1.04, 0.34, L * 0.88]} />
              </mesh>
              <mesh position={[wallX + inDir * (archDepthX * 0.54), archWallH + 0.02, 0]} material={mats.mandapAntiquedGoldMat}>
                <boxGeometry args={[archDepthX * 1.08, 0.075, L * 0.88]} />
              </mesh>
            </group>
          );
        })}

      {/* Obsidian Wave 550: Vertical Sculpted S-Wave Acoustic Ribbons in Alternating Slate, Charcoal & Obsidian + Curved Neon-Purple Valley Canyons */}
      {sideLightStyle === 'parametric_obsidian_waves' &&
        parametricObsidianWall &&
        obsidianWaveResources && (
          <group>
            {([-1, 1] as const).map((side) => {
              const wallX = side * (W / 2 - 0.21);
              const inDir = -side;
              const wall = side === -1 ? parametricObsidianWall.leftWall : parametricObsidianWall.rightWall;
              return (
                <group key={`parametric-side-${side}`} position={[wallX, 0, 0]}>
                  {/* Deep Matte-Obsidian Acoustic Wall Backing Behind Wave Ribbons */}
                  <mesh position={[inDir * 0.015, H * 0.5, 0]} material={obsidianWaveResources.obsidianWaveMat} receiveShadow>
                    <boxGeometry args={[0.04, H * 0.96, L * 0.96]} />
                  </mesh>

                  <mesh geometry={wall.lightSlateGeo} material={obsidianWaveResources.lightSlateWaveMat} castShadow receiveShadow />
                  <mesh geometry={wall.midCharcoalGeo} material={obsidianWaveResources.midCharcoalWaveMat} castShadow receiveShadow />
                  <mesh geometry={wall.obsidianGeo} material={obsidianWaveResources.obsidianWaveMat} castShadow receiveShadow />
                  <mesh geometry={wall.violetWashGeo} material={obsidianWaveResources.violetCanyonWashMat} />
                  <mesh geometry={wall.violetCoreGeo} material={obsidianWaveResources.violetCoreSplineMat} />
                </group>
              );
            })}

            {/* Rear Wall Matching Vertical S-Wave Wings Flanking Open Projection Booth & Doors */}
            <group position={[0, 0, backZ - 0.2]}>
              {([-1, 1] as const).map((wSide) => {
                const wingW = parametricObsidianWall.wingMaxAbsX - parametricObsidianWall.wingMinAbsX;
                const wingCx = wSide * (parametricObsidianWall.wingMinAbsX + wingW * 0.5);
                return (
                  <mesh
                    key={`pwave-rear-backing-${wSide}`}
                    position={[wingCx, H * 0.5, 0.015]}
                    material={obsidianWaveResources.obsidianWaveMat}
                  >
                    <boxGeometry args={[wingW, H * 0.96, 0.03]} />
                  </mesh>
                );
              })}

              {[
                parametricObsidianWall.rearLeft,
                parametricObsidianWall.rearRight,
                parametricObsidianWall.rearSpandrel,
              ].map((part, pi) =>
                part ? (
                  <group key={`pwave-rear-part-${pi}`}>
                    <mesh geometry={part.lightSlateGeo} material={obsidianWaveResources.lightSlateWaveMat} castShadow receiveShadow />
                    <mesh geometry={part.midCharcoalGeo} material={obsidianWaveResources.midCharcoalWaveMat} castShadow receiveShadow />
                    <mesh geometry={part.obsidianGeo} material={obsidianWaveResources.obsidianWaveMat} castShadow receiveShadow />
                    <mesh geometry={part.violetWashGeo} material={obsidianWaveResources.violetCanyonWashMat} />
                    <mesh geometry={part.violetCoreGeo} material={obsidianWaveResources.violetCoreSplineMat} />
                  </group>
                ) : null,
              )}
            </group>
          </group>
        )}

      {/* ===================================================================== */}
      {/* BAY-MOUNTED BESPOKE ARCHITECTURAL SIDE LIGHT DESIGNS                  */}
      {/* ===================================================================== */}
      {!isIce &&
        sideLightStyle !== 'art_deco_navy_sunburst' &&
        sideLightStyle !== 'modern_charcoal_navy_diagonal' &&
        sideLightStyle !== 'volcanic_copper_ribbons' &&
        sideLightStyle !== 'indian_mandap_jali' &&
        sideLightStyle !== 'parametric_obsidian_waves' &&
        sideLightStyle !== 'biophilic_crystalline_moss' &&
        sideLightStyle !== 'private_volcanic_copper_ribbons' &&
        sideLightStyle !== 'champagne_fluted_oak_alcoves' &&
        sideLightStyle !== 'imax_cobalt_wave' &&
        sideLightStyle !== 'aurora_ribbon_waves' &&
        sideLightStyle !== 'horizon_tier_strips' &&
        sideLightStyle !== 'crimson_velocity_4dx' &&
        sideLightStyle !== 'arctic_parametric_fins' &&
        sideLightStyle !== 'thunder_emerald_waves' &&
        sideLightStyle !== 'exoskeleton_crimson_matrix_4dx' &&
        sideLightStyle !== 'obsidian_slat_grazers' &&
        sideLightStyle !== 'diagonal_parabolic_ribs' &&
        sideLightStyle !== 'cobalt_veil_laser_recess' &&
        sideLightStyle !== 'crisscross_geometric' &&
        sideLightStyle !== 'screenx_panoramic_walls' &&
        sideLightStyle !== 'screenx_silver_baffles' &&
        wallBayZs.map((bz, idx) => {
          return [-1, 1].map((side) => {
            const xBase = side * (wallInnerX - 0.08);
            const inDir = -side; // points inward into the auditorium

            return (
              <group key={`fixture-${idx}-${side}`}>
                {/* 1. Standard 2D — Grand Crimson Palace: Sculpted Twin-Arm Fluted Brass Torchiere Sconce */}
                {sideLightStyle === 'brass_torchieres' && (
                  <group position={[xBase, sconceY, bz]}>
                    {/* Ornate Stepped Brass Wall Backplate */}
                    <mesh material={mats.brassHardwareMat}>
                      <boxGeometry args={[0.05, 0.72, 0.26]} />
                    </mesh>
                    <mesh position={[inDir * 0.03, 0, 0]} material={mats.channelMetalMat}>
                      <boxGeometry args={[0.03, 0.56, 0.18]} />
                    </mesh>
                    {/* Twin Brass Sconce Arms + Frosted Alabaster Diffuser Bowls */}
                    {[-0.14, 0.14].map((az, ai) => (
                      <group key={`arm-${ai}`} position={[inDir * 0.11, -0.02, az]}>
                        <mesh material={mats.brassHardwareMat}>
                          <boxGeometry args={[0.16, 0.035, 0.035]} />
                        </mesh>
                        <mesh position={[inDir * 0.06, 0.08, 0]} material={mats.brassHardwareMat}>
                          <cylinderGeometry args={[0.075, 0.035, 0.11, 14]} />
                        </mesh>
                        <mesh position={[inDir * 0.06, 0.21, 0]} material={mats.alabasterGlassMat}>
                          <cylinderGeometry args={[0.085, 0.055, 0.2, 16]} />
                        </mesh>
                        <mesh
                          position={[inDir * 0.06, 0.31, 0]}
                          rotation={[-Math.PI / 2, 0, 0]}
                          material={mats.brassHardwareMat}
                        >
                          <ringGeometry args={[0.055, 0.088, 16]} />
                        </mesh>
                      </group>
                    ))}
                  </group>
                )}

                {/* 2. Standard 2D Emerald — Emerald Art Deco Hall: 3-Tier Stepped Ziggurat Art Deco Fin */}
                {sideLightStyle === 'art_deco_stepped_fins' && (
                  <group position={[xBase, H * 0.5, bz]}>
                    {/* Outer Stepped Brass & Charcoal Ziggurat Chassis */}
                    <mesh material={mats.channelMetalMat}>
                      <boxGeometry args={[0.08, H * 0.74, 0.52]} />
                    </mesh>
                    <mesh position={[inDir * 0.045, 0, 0]} material={mats.brassHardwareMat}>
                      <boxGeometry args={[0.05, H * 0.62, 0.36]} />
                    </mesh>
                    <mesh position={[inDir * 0.08, 0, 0]} material={mats.channelMetalMat}>
                      <boxGeometry args={[0.05, H * 0.5, 0.2]} />
                    </mesh>
                    {/* Three Tiered Indirect Side-Light Diffuser Channels */}
                    <mesh position={[inDir * 0.052, 0, 0.22]} material={mats.primaryEmitterMat}>
                      <boxGeometry args={[0.032, H * 0.7, 0.038]} />
                    </mesh>
                    <mesh position={[inDir * 0.052, 0, -0.22]} material={mats.primaryEmitterMat}>
                      <boxGeometry args={[0.032, H * 0.7, 0.038]} />
                    </mesh>
                    <mesh position={[inDir * 0.09, 0, 0.14]} material={mats.secondaryEmitterMat}>
                      <boxGeometry args={[0.03, H * 0.58, 0.034]} />
                    </mesh>
                    <mesh position={[inDir * 0.09, 0, -0.14]} material={mats.secondaryEmitterMat}>
                      <boxGeometry args={[0.03, H * 0.58, 0.034]} />
                    </mesh>
                    {/* Crown Sunburst Finials */}
                    <mesh position={[inDir * 0.05, H * 0.34, 0]} material={mats.brassHardwareMat}>
                      <boxGeometry args={[0.09, 0.08, 0.44]} />
                    </mesh>
                  </group>
                )}

                {/* 4. IMAX Cobalt — IMAX Cobalt Horizon: Monumental Twin-Slotted Anodized Steel Monolith Totem */}
                {sideLightStyle === 'monolith_totems' && (
                  <group position={[xBase, H * 0.49, bz]}>
                    {/* Broad Architectural Acoustic Baffle Wing */}
                    <mesh material={mats.channelMetalMat}>
                      <boxGeometry args={[0.14, H * 0.82, 0.68]} />
                    </mesh>
                    {/* Twin Slotted Recessed Knife-Edge Diffuser Reveals */}
                    {[-0.18, 0.18].map((tz, ti) => (
                      <group key={`slot-${ti}`} position={[inDir * 0.072, 0, tz]}>
                        <mesh material={mats.primaryEmitterMat}>
                          <boxGeometry args={[0.048, H * 0.76, 0.065]} />
                        </mesh>
                        <mesh position={[inDir * 0.032, 0, 0]} material={trimMetalMat}>
                          <boxGeometry args={[0.028, H * 0.78, 0.028]} />
                        </mesh>
                      </group>
                    ))}
                    {/* Central Horizontal Telemetry Cross-Braces */}
                    {[-H * 0.24, 0, H * 0.24].map((cy, ci) => (
                      <mesh key={`brace-${ci}`} position={[inDir * 0.075, cy, 0]} material={trimMetalMat}>
                        <boxGeometry args={[0.04, 0.09, 0.62]} />
                      </mesh>
                    ))}
                  </group>
                )}



                {/* 7. 4DX Thunder — Kinetic V-Chevron Dual-Color Aerodynamic Fin */}
                {sideLightStyle === 'kinetic_chevron_blades' && (
                  <group position={[xBase, sconceY + 0.15, bz]}>
                    {/* Upper Swept Blade Wing */}
                    <group position={[inDir * 0.04, 0.62, 0.18]} rotation={[0.56, 0, 0]}>
                      <mesh material={mats.channelMetalMat}>
                        <boxGeometry args={[0.15, 1.45, 0.22]} />
                      </mesh>
                      <mesh position={[inDir * 0.078, 0, 0.04]} material={mats.primaryEmitterMat}>
                        <boxGeometry args={[0.04, 1.32, 0.065]} />
                      </mesh>
                    </group>
                    {/* Lower Counter-Swept Blade Wing forming V-Chevron */}
                    <group position={[inDir * 0.04, -0.62, 0.18]} rotation={[-0.56, 0, 0]}>
                      <mesh material={mats.channelMetalMat}>
                        <boxGeometry args={[0.15, 1.45, 0.22]} />
                      </mesh>
                      <mesh position={[inDir * 0.078, 0, -0.04]} material={mats.secondaryEmitterMat}>
                        <boxGeometry args={[0.04, 1.32, 0.065]} />
                      </mesh>
                    </group>
                    {/* Center Machined Pivot Hub */}
                    <mesh position={[inDir * 0.09, 0, -0.25]} material={trimMetalMat}>
                      <boxGeometry args={[0.14, 0.28, 0.28]} />
                    </mesh>
                  </group>
                )}

                {/* 8. 4DX Crimson Velocity — Triple-Raked Motorsport Carbon Light Pod */}
                {sideLightStyle === 'velocity_racing_stripes' && (
                  <group position={[xBase, sconceY + 0.1, bz]} rotation={[0.32, 0, 0]}>
                    {/* Angled Carbon-Anodized Pod Chassis */}
                    <mesh material={mats.channelMetalMat}>
                      <boxGeometry args={[0.12, 2.25, 0.56]} />
                    </mesh>
                    {/* Three Parallel High-Speed Light Channels */}
                    {[-0.16, 0, 0.16].map((sz, si) => (
                      <mesh
                        key={`stripe-${si}`}
                        position={[inDir * 0.055, 0, sz]}
                        material={si === 1 ? mats.secondaryEmitterMat : mats.primaryEmitterMat}
                      >
                        <boxGeometry args={[0.04, 2.04 - Math.abs(si - 1) * 0.22, 0.055]} />
                      </mesh>
                    ))}
                  </group>
                )}

                {/* 9. 4DX Arctic Storm — Faceted Diamond-Hex Crystalline Frame */}
                {sideLightStyle === 'glacier_hex_matrix' && (
                  <group position={[xBase, sconceY + 0.1, bz]}>
                    {/* Backing Dark Acoustic Diamond Core */}
                    <mesh rotation={[Math.PI / 4, 0, 0]} material={mats.channelMetalMat}>
                      <boxGeometry args={[0.09, 1.28, 1.28]} />
                    </mesh>
                    {/* Glowing Edge-Lit Diamond Perimeter Frame */}
                    <mesh
                      position={[inDir * 0.045, 0, 0]}
                      rotation={[Math.PI / 4, 0, 0]}
                      material={mats.primaryEmitterMat}
                    >
                      <boxGeometry args={[0.035, 1.18, 1.18]} />
                    </mesh>
                    {/* Raised Dark Faceted Acoustic Inner Shield leaving Crisp Edge Halo */}
                    <mesh
                      position={[inDir * 0.065, 0, 0]}
                      rotation={[Math.PI / 4, 0, 0]}
                      material={acousticPanelMat}
                    >
                      <boxGeometry args={[0.04, 0.98, 0.98]} />
                    </mesh>
                    {/* Horizontal Central Glacier Crossbar */}
                    <mesh position={[inDir * 0.088, 0, 0]} material={mats.secondaryEmitterMat}>
                      <boxGeometry args={[0.025, 0.04, 0.85]} />
                    </mesh>
                  </group>
                )}

                {/* 12. Dolby Noir Bordeaux — Alternating Cantilevered Rose-Gold Shelf Coves */}
                {sideLightStyle === 'tiered_cantilever_shelves' && (
                  <group position={[xBase, sconceY + (idx % 2 === 0 ? 0.45 : -0.35), bz]}>
                    {/* Wide Architectural Acoustic Shelf Hood */}
                    <mesh material={mats.channelMetalMat}>
                      <boxGeometry args={[0.24, 0.14, 1.65]} />
                    </mesh>
                    {/* Brushed Metal Under-Trim */}
                    <mesh position={[inDir * 0.04, 0.075, 0]} material={trimMetalMat}>
                      <boxGeometry args={[0.26, 0.025, 1.68]} />
                    </mesh>
                    {/* Indirect Up-Wash + Down-Wash Diffuser Lenses */}
                    <mesh position={[inDir * 0.06, 0.095, 0]} material={mats.primaryEmitterMat}>
                      <boxGeometry args={[0.12, 0.03, 1.48]} />
                    </mesh>
                    <mesh position={[inDir * 0.06, -0.08, 0]} material={mats.secondaryEmitterMat}>
                      <boxGeometry args={[0.1, 0.025, 1.48]} />
                    </mesh>
                  </group>
                )}

                {/* 13. Private Walnut Reserve — Carved Walnut & Brushed-Brass Alabaster Lantern */}
                {sideLightStyle === 'walnut_alabaster_lanterns' && (
                  <group position={[xBase, sconceY, bz]}>
                    {/* Carved Walnut Architectural Backboard */}
                    <mesh material={mats.walnutWoodMat}>
                      <boxGeometry args={[0.06, 0.92, 0.44]} />
                    </mesh>
                    {/* Glowing Frosted Alabaster Cylinder Core */}
                    <mesh position={[inDir * 0.11, 0, 0]} material={mats.alabasterGlassMat}>
                      <cylinderGeometry args={[0.11, 0.11, 0.62, 18]} />
                    </mesh>
                    {/* Precision Brushed-Brass Lantern Cage Ribs & End Caps */}
                    <mesh position={[inDir * 0.11, 0.33, 0]} material={mats.brassHardwareMat}>
                      <boxGeometry args={[0.26, 0.05, 0.28]} />
                    </mesh>
                    <mesh position={[inDir * 0.11, -0.33, 0]} material={mats.brassHardwareMat}>
                      <boxGeometry args={[0.26, 0.05, 0.28]} />
                    </mesh>
                    {[-0.12, 0.12].map((rz, ri) => (
                      <mesh
                        key={`cage-${ri}`}
                        position={[inDir * 0.21, 0, rz]}
                        material={mats.brassHardwareMat}
                      >
                        <boxGeometry args={[0.025, 0.64, 0.025]} />
                      </mesh>
                    ))}
                  </group>
                )}

                {/* 14. Private Champagne Lounge — Backlit Circular Brass Halo Medallion Alcove */}
                {sideLightStyle === 'floating_halo_alcoves' && (
                  <group position={[xBase, sconceY, bz]}>
                    {/* Framed Smoked-Oak Wall Alcove Recess */}
                    <mesh material={mats.walnutWoodMat}>
                      <boxGeometry args={[0.06, 1.24, 1.24]} />
                    </mesh>
                    {/* Recessed Halo Emitter Ring */}
                    <mesh
                      position={[inDir * 0.045, 0, 0]}
                      rotation={[0, (inDir * Math.PI) / 2, 0]}
                      material={mats.primaryEmitterMat}
                    >
                      <torusGeometry args={[0.38, 0.042, 12, 32]} />
                    </mesh>
                    {/* Floating Outer Brushed-Brass Disc Shield */}
                    <mesh
                      position={[inDir * 0.085, 0, 0]}
                      rotation={[0, 0, Math.PI / 2]}
                      material={mats.brassHardwareMat}
                    >
                      <cylinderGeometry args={[0.33, 0.33, 0.04, 28]} />
                    </mesh>
                    {/* Dark Velvet Acoustic Center Inlay */}
                    <mesh
                      position={[inDir * 0.11, 0, 0]}
                      rotation={[0, 0, Math.PI / 2]}
                      material={acousticPanelMat}
                    >
                      <cylinderGeometry args={[0.26, 0.26, 0.02, 28]} />
                    </mesh>
                  </group>
                )}

                {/* 15. Private Midnight Suite — Herringbone Acoustic Louver Rose-Amber Column */}
                {sideLightStyle === 'chevron_louver_columns' && (
                  <group position={[xBase, sconceY + 0.05, bz]}>
                    <mesh material={mats.channelMetalMat}>
                      <boxGeometry args={[0.08, 2.35, 0.56]} />
                    </mesh>
                    {/* Concealed Warm Rose-Amber Indirect Spine */}
                    <mesh position={[inDir * 0.048, 0, 0]} material={mats.primaryEmitterMat}>
                      <boxGeometry args={[0.036, 2.18, 0.2]} />
                    </mesh>
                    {/* 6 Precision Angled Brass Chevron Louver Blades */}
                    {[-0.85, -0.51, -0.17, 0.17, 0.51, 0.85].map((ly, li) => (
                      <group key={`her-${li}`} position={[inDir * 0.088, ly, 0]}>
                        <mesh rotation={[0.38, 0, 0]} position={[0, 0, 0.12]} material={mats.brassHardwareMat}>
                          <boxGeometry args={[0.05, 0.04, 0.28]} />
                        </mesh>
                        <mesh rotation={[-0.38, 0, 0]} position={[0, 0, -0.12]} material={mats.brassHardwareMat}>
                          <boxGeometry args={[0.05, 0.04, 0.28]} />
                        </mesh>
                      </group>
                    ))}
                  </group>
                )}

              </group>
            );
          });
        })}

    </group>
  );
};
