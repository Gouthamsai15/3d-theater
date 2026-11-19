import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { ThreeEvent } from '@react-three/fiber';
import { CameraViewMode, SeatData, TheaterConfiguration } from '../../types/cinema';
import {
  applyScreenBounceToMaterial,
  ScreenBounceUniforms,
} from '../lighting/screenBounceShader';
import {
  BIOLUMINESCENT_PIT_CENTERS,
  BeachTerrainVariant,
  beachHeightAt,
  createBeachStripedCanvasTexture,
  createMatteLeatherTextures,
  createWovenBlanketTexture,
} from './beachTerrain';
import { ReservedSeatMarker } from './ReservedSeatMarker';

interface BeachSeatsProps {
  config: TheaterConfiguration;
  seats: SeatData[];
  selectedSeatId: string | null;
  hoveredSeatId?: string | null;
  isPlaying: boolean;
  lightFactor?: number;
  viewMode?: CameraViewMode;
  interactive?: boolean;
  enableHover?: boolean;
  screenBounceUniforms?: ScreenBounceUniforms;
  onSelectSeat?: (seatId: string) => void;
  onHoverSeat?: (seatId: string | null) => void;
}

const BEANBAG_PALETTE = ['#1e3f5c', '#a64d32', '#265c5a', '#a8782e'];

/**
 * Teardrop sculpted oversized bean bag geometry (LatheGeometry with organic slump).
 */
function buildBeanBagGeometry(): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.44, 0.01),
    new THREE.Vector2(0.56, 0.14),
    new THREE.Vector2(0.52, 0.34),
    new THREE.Vector2(0.38, 0.52),
    new THREE.Vector2(0.18, 0.64),
    new THREE.Vector2(0.0, 0.67),
  ];
  const geo = new THREE.LatheGeometry(pts, 20);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const isBack = z > 0 ? z : 0;
    const extraBack = isBack * 0.28 * THREE.MathUtils.clamp(y / 0.5, 0, 1);
    const seatScoop = z < 0.05 && y > 0.25 && y < 0.56 ? -0.07 : 0;
    pos.setX(i, x * 1.04);
    pos.setY(i, Math.max(0.01, y + extraBack + seatScoop));
    pos.setZ(i, z * 1.08);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Sculpted quilted ergonomic matte leather lounge pod seat cushion (for Bioluminescent Cove).
 */
function buildQuiltedPodCushionGeo(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  // Side profile: -X is front (-Z once rotated), +X is rear (+Z)
  shape.moveTo(-0.46, 0.04);
  shape.lineTo(0.44, 0.04);
  shape.quadraticCurveTo(0.49, 0.16, 0.45, 0.26);
  shape.quadraticCurveTo(0.02, 0.29, -0.42, 0.27);
  shape.quadraticCurveTo(-0.49, 0.16, -0.46, 0.04);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.72,
    bevelEnabled: true,
    bevelThickness: 0.045,
    bevelSize: 0.035,
    bevelSegments: 3,
    curveSegments: 8,
  });
  geo.translate(0, 0, -0.36);
  geo.rotateY(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Contoured reclined backrest for Bioluminescent Cove quilted lounge pod & curved pit sectional.
 */
function buildQuiltedPodBackGeo(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-0.1, 0.0);
  shape.lineTo(0.11, 0.0);
  shape.quadraticCurveTo(0.15, 0.34, 0.08, 0.64);
  shape.quadraticCurveTo(0.0, 0.7, -0.09, 0.63);
  shape.quadraticCurveTo(-0.14, 0.28, -0.1, 0.0);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.7,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.032,
    bevelSegments: 3,
    curveSegments: 8,
  });
  geo.translate(0, 0, -0.35);
  geo.rotateY(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Catenary woven hammock sling spanning between two A-frame / angled steel posts.
 */
function buildHammockSlingGeo(span = 2.35, width = 0.88): THREE.BufferGeometry {
  const segU = 22;
  const segV = 8;
  const geo = new THREE.BufferGeometry();
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let iu = 0; iu <= segU; iu++) {
    const u = iu / segU;
    const t = u - 0.5;
    const z = t * span;
    const sag = (1 - 4 * t * t) * 0.42;
    const edgeTaper = 0.28 + 0.72 * Math.sin(u * Math.PI);
    for (let iv = 0; iv <= segV; iv++) {
      const v = iv / segV;
      const wOff = (v - 0.5) * width * edgeTaper;
      const cradleDip = (1 - Math.pow((v - 0.5) * 2, 2)) * 0.09 * Math.sin(u * Math.PI);
      positions.push(wOff, 0.78 - sag - cradleDip, z);
      uvs.push(u, v);
    }
  }

  const stride = segV + 1;
  for (let iu = 0; iu < segU; iu++) {
    for (let iv = 0; iv < segV; iv++) {
      const a = iu * stride + iv;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, c, d, a, d, b);
    }
  }

  geo.setIndex(indices);
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return geo;
}

/**
 * Anatomically contoured striped canvas sling cushion for Sunset Cove wooden beach loungers.
 * Spine runs from front knee lip (-Z) back across seat pan and reclines cleanly backward (+Z) up the backrest.
 */
function buildDeckLoungerSlingGeo(width = 0.6, halfThick = 0.018): THREE.BufferGeometry {
  const spine: [number, number][] = [
    [-0.365, 0.27],
    [-0.33, 0.302],
    [-0.18, 0.282],
    [0.06, 0.248],
    [0.14, 0.262],
    [0.195, 0.315],
    [0.275, 0.47],
    [0.365, 0.665],
    [0.45, 0.865],
  ];
  const nS = spine.length;
  const segW = 6;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  // Compute 2D tangent & upward normal at each spine node
  const normals2d: [number, number][] = spine.map((_, i) => {
    const p0 = spine[Math.max(0, i - 1)];
    const p1 = spine[Math.min(nS - 1, i + 1)];
    const dz = p1[0] - p0[0];
    const dy = p1[1] - p0[1];
    // Rotate tangent (dz, dy) 90° CCW in (Z, Y) to get upward/forward surface normal (-dy, dz)
    const nz = -dy;
    const ny = dz;
    const len = Math.hypot(nz, ny) || 1;
    return [nz / len, ny / len];
  });

  const emitGrid = (offset: number, flipWinding: boolean) => {
    const base = positions.length / 3;
    for (let is = 0; is < nS; is++) {
      const [sz, sy] = spine[is];
      const [nz, ny] = normals2d[is];
      const vCoord = is / (nS - 1);
      for (let iw = 0; iw <= segW; iw++) {
        const uCoord = iw / segW;
        const x = (uCoord - 0.5) * width;
        positions.push(x, sy + ny * offset, sz + nz * offset);
        uvs.push(uCoord, vCoord);
      }
    }
    const stride = segW + 1;
    for (let is = 0; is < nS - 1; is++) {
      for (let iw = 0; iw < segW; iw++) {
        const a = base + is * stride + iw;
        const b = a + 1;
        const c = a + stride;
        const d = c + 1;
        if (flipWinding) {
          indices.push(a, d, b, a, c, d);
        } else {
          indices.push(a, b, d, a, d, c);
        }
      }
    }
    return { base, stride };
  };

  // Top & Bottom faces (top points outward +Y/-Z, bottom points outward -Y/+Z)
  const top = emitGrid(halfThick, true);
  const bot = emitGrid(-halfThick, false);

  // Stitch left (-X) & right (+X) side thickness walls outward
  for (let is = 0; is < nS - 1; is++) {
    const lt0 = top.base + is * top.stride;
    const lt1 = lt0 + top.stride;
    const lb0 = bot.base + is * bot.stride;
    const lb1 = lb0 + bot.stride;
    indices.push(lt0, lb1, lt1, lt0, lb0, lb1);

    const rt0 = top.base + is * top.stride + segW;
    const rt1 = rt0 + top.stride;
    const rb0 = bot.base + is * bot.stride + segW;
    const rb1 = rb0 + bot.stride;
    indices.push(rt0, rt1, rb1, rt0, rb1, rb0);
  }

  // Front (-Z) & Top (+Z) end caps outward
  for (let iw = 0; iw < segW; iw++) {
    const ft0 = top.base + iw;
    const ft1 = ft0 + 1;
    const fb0 = bot.base + iw;
    const fb1 = fb0 + 1;
    indices.push(ft0, ft1, fb1, ft0, fb1, fb0);

    const lastRow = (nS - 1) * top.stride;
    const bt0 = top.base + lastRow + iw;
    const bt1 = bt0 + 1;
    const bb0 = bot.base + lastRow + iw;
    const bb1 = bb0 + 1;
    indices.push(bt0, bb1, bt1, bt0, bb0, bb1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setIndex(indices);
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return geo;
}

const OUTER_HAMMOCK_SPOTS: readonly {
  x: number;
  z: number;
  yaw: number;
}[] = [
  { x: -11.8, z: 2.2, yaw: 0.34 },
  { x: -11.4, z: 5.8, yaw: 0.28 },
  { x: 11.8, z: 2.2, yaw: -0.34 },
  { x: 11.4, z: 5.8, yaw: -0.28 },
];

export const BeachSeats: React.FC<BeachSeatsProps> = ({
  config,
  seats,
  selectedSeatId,
  hoveredSeatId = null,
  isPlaying,
  lightFactor = 1,
  viewMode = 'seat',
  interactive = false,
  enableHover = false,
  screenBounceUniforms,
  onSelectSeat,
  onHoverSeat,
}) => {
  const isBioluminescent = config.seatModel === 'beach_bioluminescent_lounge';
  const variant: BeachTerrainVariant = isBioluminescent ? 'bioluminescent' : 'sunset';

  const textures = useMemo(() => {
    const stripedCanvas = createBeachStripedCanvasTexture();
    const blanketTex = createWovenBlanketTexture();
    const leather = isBioluminescent ? createMatteLeatherTextures(256) : null;
    return { stripedCanvas, blanketTex, leather };
  }, [isBioluminescent]);

  useEffect(() => {
    return () => {
      textures.stripedCanvas.dispose();
      textures.blanketTex.dispose();
      textures.leather?.dispose();
    };
  }, [textures]);

  const geometries = useMemo(() => {
    const beanBagGeo = buildBeanBagGeometry();
    const loungerSlingGeo = !isBioluminescent ? buildDeckLoungerSlingGeo() : null;
    const podCushionGeo = isBioluminescent ? buildQuiltedPodCushionGeo() : null;
    const podBackGeo = isBioluminescent ? buildQuiltedPodBackGeo() : null;
    const hammockSlingGeo = isBioluminescent ? buildHammockSlingGeo() : null;
    return { beanBagGeo, loungerSlingGeo, podCushionGeo, podBackGeo, hammockSlingGeo };
  }, [isBioluminescent]);

  useEffect(() => {
    return () => {
      geometries.beanBagGeo.dispose();
      geometries.loungerSlingGeo?.dispose();
      geometries.podCushionGeo?.dispose();
      geometries.podBackGeo?.dispose();
      geometries.hammockSlingGeo?.dispose();
    };
  }, [geometries]);

  const materials = useMemo(() => {
    const woodMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#7c5636',
        roughness: 0.84,
        metalness: 0.04,
      }),
      screenBounceUniforms,
    );
    const crateWoodMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#63442a',
        roughness: 0.9,
        metalness: 0.03,
      }),
      screenBounceUniforms,
    );
    const canvasSlingMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        map: textures.stripedCanvas,
        roughness: 0.92,
        metalness: 0.0,
        side: THREE.DoubleSide,
      }),
      screenBounceUniforms,
    );
    const selectedSlingMat = new THREE.MeshStandardMaterial({
      map: textures.stripedCanvas,
      color: '#f2d98d',
      emissive: '#a17a18',
      emissiveIntensity: 0.25,
      roughness: 0.85,
      side: THREE.DoubleSide,
    });
    const hoveredSlingMat = new THREE.MeshStandardMaterial({
      map: textures.stripedCanvas,
      color: '#bae6fd',
      emissive: '#0284c7',
      emissiveIntensity: 0.25,
      roughness: 0.85,
      side: THREE.DoubleSide,
    });
    const blanketMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        map: textures.blanketTex,
        roughness: 0.96,
        metalness: 0.0,
      }),
      screenBounceUniforms,
    );
    const beanBagMats = BEANBAG_PALETTE.map((col) =>
      applyScreenBounceToMaterial(
        new THREE.MeshStandardMaterial({
          color: col,
          roughness: 0.92,
          metalness: 0.01,
        }),
        screenBounceUniforms,
      ),
    );
    const selectedBeanBagMat = new THREE.MeshStandardMaterial({
      color: '#d4af37',
      emissive: '#8f6c11',
      emissiveIntensity: 0.28,
      roughness: 0.85,
    });
    const hoveredBeanBagMat = new THREE.MeshStandardMaterial({
      color: '#38bdf8',
      emissive: '#0284c7',
      emissiveIntensity: 0.28,
      roughness: 0.85,
    });
    const cushionMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#dfd0b4',
        roughness: 0.94,
        metalness: 0.0,
      }),
      screenBounceUniforms,
    );
    const lanternMetalMat = new THREE.MeshStandardMaterial({
      color: '#1b1d22',
      roughness: 0.42,
      metalness: 0.72,
    });
    const lanternGlowMat = new THREE.MeshStandardMaterial({
      color: '#ffe5a8',
      emissive: '#ff9933',
      emissiveIntensity: 2.1,
      toneMapped: false,
      roughness: 0.2,
    });
    const popcornCupMat = new THREE.MeshStandardMaterial({
      color: '#b91c1c',
      roughness: 0.65,
    });
    const popcornFillMat = new THREE.MeshStandardMaterial({
      color: '#f5e4aa',
      roughness: 0.9,
    });
    const drinkCanMat = new THREE.MeshStandardMaterial({
      color: '#cbd5e1',
      roughness: 0.22,
      metalness: 0.88,
    });

    // Bioluminescent Cove strictly matte pebbled/quilted leather materials (ZERO clearcoat)
    const leatherTex = textures.leather;
    const makeMatteLeather = (hex: string, roughness = 0.84) =>
      applyScreenBounceToMaterial(
        new THREE.MeshStandardMaterial({
          color: hex,
          roughness,
          metalness: 0.01,
          normalMap: leatherTex?.normalMap ?? null,
          normalScale: leatherTex ? new THREE.Vector2(0.55, 0.55) : undefined,
          roughnessMap: leatherTex?.roughnessMap ?? null,
          bumpMap: leatherTex?.bumpMap ?? null,
          bumpScale: 0.008,
        }),
        screenBounceUniforms,
      );

    const pitLeatherMat = makeMatteLeather('#222731', 0.85);
    const pitPillowMat = makeMatteLeather('#193842', 0.86);
    const podTealLeatherMat = makeMatteLeather('#134e4a', 0.83);
    const podPlumLeatherMat = makeMatteLeather('#4a1d48', 0.84);
    const leatherStitchSeamMat = new THREE.MeshStandardMaterial({
      color: '#14171f',
      roughness: 0.86,
      metalness: 0.02,
    });
    const selectedLeatherMat = new THREE.MeshStandardMaterial({
      color: '#c9a63c',
      emissive: '#8f6c11',
      emissiveIntensity: 0.26,
      roughness: 0.82,
      metalness: 0.01,
      normalMap: leatherTex?.normalMap ?? null,
    });
    const hoveredLeatherMat = new THREE.MeshStandardMaterial({
      color: '#2563eb',
      emissive: '#0284c7',
      emissiveIntensity: 0.26,
      roughness: 0.82,
      metalness: 0.01,
      normalMap: leatherTex?.normalMap ?? null,
    });

    const acrylicGlowCubeMat = new THREE.MeshStandardMaterial({
      color: '#93e9f9',
      emissive: '#00bbf9',
      emissiveIntensity: 2.0,
      toneMapped: false,
      roughness: 0.35,
      metalness: 0.05,
    });
    const pitTableGlowMat = new THREE.MeshStandardMaterial({
      color: '#9ceef2',
      emissive: '#00f5d4',
      emissiveIntensity: 1.9,
      toneMapped: false,
      roughness: 0.32,
      metalness: 0.05,
    });
    const underSeatCyanMat = new THREE.MeshStandardMaterial({
      color: '#063d3f',
      emissive: '#00f5d4',
      emissiveIntensity: 1.35,
      toneMapped: false,
      roughness: 0.3,
    });
    const underSeatMagentaMat = new THREE.MeshStandardMaterial({
      color: '#3f1232',
      emissive: '#f15bb5',
      emissiveIntensity: 1.35,
      toneMapped: false,
      roughness: 0.3,
    });
    const brushedSteelMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#64748b',
        roughness: 0.38,
        metalness: 0.82,
      }),
      screenBounceUniforms,
    );
    const wovenRopeMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#b8a88a',
        roughness: 0.94,
        metalness: 0.0,
        side: THREE.DoubleSide,
      }),
      screenBounceUniforms,
    );

    return {
      woodMat,
      crateWoodMat,
      canvasSlingMat,
      selectedSlingMat,
      hoveredSlingMat,
      blanketMat,
      beanBagMats,
      selectedBeanBagMat,
      hoveredBeanBagMat,
      cushionMat,
      lanternMetalMat,
      lanternGlowMat,
      popcornCupMat,
      popcornFillMat,
      drinkCanMat,
      pitLeatherMat,
      pitPillowMat,
      podTealLeatherMat,
      podPlumLeatherMat,
      leatherStitchSeamMat,
      selectedLeatherMat,
      hoveredLeatherMat,
      acrylicGlowCubeMat,
      pitTableGlowMat,
      underSeatCyanMat,
      underSeatMagentaMat,
      brushedSteelMat,
      wovenRopeMat,
    };
  }, [textures, screenBounceUniforms]);

  // Smoothly fade OFF all decorative seating & table lights when movie starts (lightFactor -> 0)
  useEffect(() => {
    materials.lanternGlowMat.emissiveIntensity = lightFactor * 2.1;
    materials.acrylicGlowCubeMat.emissiveIntensity = lightFactor * 2.0;
    materials.pitTableGlowMat.emissiveIntensity = lightFactor * 1.9;
    materials.underSeatCyanMat.emissiveIntensity = lightFactor * 1.35;
    materials.underSeatMagentaMat.emissiveIntensity = lightFactor * 1.35;
  }, [lightFactor, materials]);

  useEffect(() => {
    return () => {
      materials.beanBagMats.forEach((m) => m.dispose());
      Object.entries(materials).forEach(([k, v]) => {
        if (k !== 'beanBagMats' && v instanceof THREE.Material) {
          v.dispose();
        }
      });
    };
  }, [materials]);

  // Compute side tables (crates on Sunset Cove; frosted-acrylic glowing cube tables on Bioluminescent Cove)
  // & beach blankets between rear seat pairs on Sunset Cove
  const { cratePairs, blanketPairs } = useMemo(() => {
    const crates: { key: string; x: number; y: number; z: number; yaw: number }[] = [];
    const blankets: { key: string; x: number; y: number; z: number; yaw: number; idx: number }[] = [];

    for (let i = 0; i < seats.length - 1; i++) {
      const a = seats[i];
      const b = seats[i + 1];
      if (a.rowIndex !== b.rowIndex) continue;
      if (b.seatNumber - a.seatNumber !== 1) continue;
      // Only pair (1,2), (3,4), (5,6), (7,8), (9,10), (11,12)
      if (a.seatNumber % 2 !== 1) continue;

      const mx = (a.worldPosition[0] + b.worldPosition[0]) * 0.5;
      const mz = (a.worldPosition[2] + b.worldPosition[2]) * 0.5;
      const my = beachHeightAt(mx, mz, variant);
      const yaw = ((a.yaw ?? 0) + (b.yaw ?? 0)) * 0.5;

      // On Bioluminescent Cove, rows 0-1 use central pit coffee tables; rows 2-5 use cube side tables
      if (!isBioluminescent || a.rowIndex >= 2) {
        crates.push({
          key: `table-${a.id}-${b.id}`,
          x: mx,
          y: my,
          z: mz + (isBioluminescent ? 0.02 : 0.04),
          yaw,
        });
      }

      if (!isBioluminescent && a.rowIndex >= 2) {
        blankets.push({
          key: `blanket-${a.id}-${b.id}`,
          x: mx,
          y: my + 0.018,
          z: mz - 0.06,
          yaw,
          idx: i,
        });
      }
    }

    return { cratePairs: crates, blanketPairs: blankets };
  }, [seats, variant, isBioluminescent]);

  const pitCoffeeTables = useMemo(() => {
    if (!isBioluminescent) return [];
    return BIOLUMINESCENT_PIT_CENTERS.map((pit) => ({
      side: pit.side,
      x: pit.cx,
      y: beachHeightAt(pit.cx, pit.cz, 'bioluminescent'),
      z: pit.cz,
      yaw: pit.yaw,
    }));
  }, [isBioluminescent]);

  const hammockProps = useMemo(() => {
    if (!isBioluminescent) return [];
    return OUTER_HAMMOCK_SPOTS.map((spot) => ({
      ...spot,
      y: beachHeightAt(spot.x, spot.z, 'bioluminescent'),
    }));
  }, [isBioluminescent]);

  useEffect(() => {
    return () => {
      document.body.style.cursor = 'auto';
    };
  }, []);

  const handleOver = (seat: SeatData) => (e: ThreeEvent<PointerEvent>) => {
    if (!interactive || !enableHover) return;
    if (e.nativeEvent.pointerType === 'touch') return;
    e.stopPropagation();
    if (seat.status === 'unavailable') {
      document.body.style.cursor = 'not-allowed';
      onHoverSeat?.(null);
      return;
    }
    document.body.style.cursor = 'pointer';
    onHoverSeat?.(seat.id);
  };

  const handleOut = () => {
    if (!interactive || !enableHover) return;
    document.body.style.cursor = 'auto';
    onHoverSeat?.(null);
  };

  const handleClick = (seat: SeatData) => (e: ThreeEvent<MouseEvent>) => {
    if (!interactive || e.delta > 8) return;
    e.stopPropagation();
    if (seat.status === 'unavailable') return;
    onSelectSeat?.(seat.id);
  };

  const selectedSeat = useMemo(
    () => seats.find((s) => s.id === selectedSeatId) || null,
    [seats, selectedSeatId],
  );
  const hoveredSeat = useMemo(
    () => (hoveredSeatId ? seats.find((s) => s.id === hoveredSeatId) || null : null),
    [seats, hoveredSeatId],
  );

  return (
    <group>
      {/* Sunset Cove: Woven Beach Blankets under rear curved bean bag rows */}
      {!isBioluminescent &&
        blanketPairs.map((bl) => (
          <mesh
            key={bl.key}
            position={[bl.x, bl.y, bl.z]}
            rotation={[0, bl.yaw, 0]}
            material={materials.blanketMat}
            receiveShadow
          >
            <boxGeometry args={[2.35, 0.024, 1.55]} />
          </mesh>
        ))}

      {/* Sunset Cove: Wooden Crate Side Tables + Warm Lanterns, Popcorn & Drinks */}
      {!isBioluminescent &&
        cratePairs.map((cr, idx) => (
          <group
            key={cr.key}
            position={[cr.x, cr.y, cr.z]}
            rotation={[0, cr.yaw, 0]}
          >
            <mesh position={[0, 0.19, 0]} material={materials.crateWoodMat} castShadow receiveShadow>
              <boxGeometry args={[0.42, 0.36, 0.42]} />
            </mesh>
            <mesh position={[0, 0.38, 0]} material={materials.woodMat} castShadow receiveShadow>
              <boxGeometry args={[0.46, 0.032, 0.46]} />
            </mesh>

            {/* Warm Glowing Table Lantern (fades cleanly off when movie starts) */}
            <group position={[-0.1, 0.4, -0.06]}>
              <mesh position={[0, 0.015, 0]} material={materials.lanternMetalMat}>
                <cylinderGeometry args={[0.065, 0.072, 0.024, 10]} />
              </mesh>
              <mesh position={[0, 0.09, 0]} material={materials.lanternGlowMat}>
                <cylinderGeometry args={[0.048, 0.048, 0.13, 10]} />
              </mesh>
              <mesh position={[0, 0.17, 0]} material={materials.lanternMetalMat}>
                <coneGeometry args={[0.075, 0.045, 10]} />
              </mesh>
            </group>

            <group position={[0.11, 0.4, 0.04]}>
              <mesh position={[0, 0.075, 0]} material={materials.popcornCupMat} castShadow>
                <cylinderGeometry args={[0.064, 0.048, 0.15, 12]} />
              </mesh>
              <mesh position={[0, 0.15, 0]} material={materials.popcornFillMat}>
                <sphereGeometry args={[0.06, 10, 8]} />
              </mesh>
            </group>

            <mesh
              position={[idx % 2 === 0 ? -0.04 : 0.06, 0.45, 0.13]}
              material={materials.drinkCanMat}
              castShadow
            >
              <cylinderGeometry args={[0.028, 0.028, 0.105, 10]} />
            </mesh>
          </group>
        ))}

      {/* Bioluminescent Cove: Frosted-Acrylic Glowing Cube Side Tables Between Rows 2-5 Pairs */}
      {isBioluminescent &&
        cratePairs.map((cr, idx) => (
          <group
            key={cr.key}
            position={[cr.x, cr.y, cr.z]}
            rotation={[0, cr.yaw, 0]}
          >
            <mesh position={[0, 0.025, 0]} material={materials.brushedSteelMat}>
              <boxGeometry args={[0.42, 0.045, 0.42]} />
            </mesh>
            <mesh position={[0, 0.23, 0]} material={materials.acrylicGlowCubeMat} castShadow>
              <boxGeometry args={[0.38, 0.37, 0.38]} />
            </mesh>
            <mesh position={[0, 0.42, 0]} material={materials.leatherStitchSeamMat}>
              <boxGeometry args={[0.41, 0.022, 0.41]} />
            </mesh>
            {/* Chilled Drink Tumblers */}
            <mesh
              position={[idx % 2 === 0 ? -0.08 : 0.08, 0.475, 0.04]}
              material={materials.drinkCanMat}
            >
              <cylinderGeometry args={[0.032, 0.026, 0.095, 10]} />
            </mesh>
          </group>
        ))}

      {/* Bioluminescent Cove: Two Sunken Pit Central Frosted-Acrylic Coffee Tables */}
      {isBioluminescent &&
        pitCoffeeTables.map((tb) => (
          <group
            key={`pit-coffee-${tb.side}`}
            position={[tb.x, tb.y, tb.z]}
            rotation={[0, tb.yaw, 0]}
          >
            <mesh position={[0, 0.03, 0]} material={materials.brushedSteelMat}>
              <boxGeometry args={[1.95, 0.05, 0.62]} />
            </mesh>
            <mesh position={[0, 0.19, 0]} material={materials.pitTableGlowMat} castShadow>
              <boxGeometry args={[1.88, 0.28, 0.58]} />
            </mesh>
            <mesh position={[0, 0.34, 0]} material={materials.leatherStitchSeamMat}>
              <boxGeometry args={[1.96, 0.03, 0.64]} />
            </mesh>
            {/* Brushed Steel Ice Bucket + Pair of Glasses */}
            <mesh position={[0, 0.44, 0]} material={materials.brushedSteelMat} castShadow>
              <cylinderGeometry args={[0.11, 0.085, 0.17, 14]} />
            </mesh>
            {[-0.42, 0.42].map((gx, gi) => (
              <mesh
                key={`pit-glass-${gi}`}
                position={[gx, 0.41, 0.06]}
                material={materials.drinkCanMat}
              >
                <cylinderGeometry args={[0.032, 0.025, 0.11, 10]} />
              </mesh>
            ))}
          </group>
        ))}

      {/* Bioluminescent Cove: 4 Outer Woven Rope Hammocks on Steel Frames */}
      {isBioluminescent &&
        geometries.hammockSlingGeo &&
        hammockProps.map((hm, idx) => (
          <group
            key={`hammock-${idx}`}
            position={[hm.x, hm.y, hm.z]}
            rotation={[0, hm.yaw, 0]}
          >
            {/* Front & Rear Angled Steel Frame Uprights */}
            {[-1.28, 1.28].map((pz, pi) => (
              <group key={`h-post-${pi}`} position={[0, 0, pz]}>
                <mesh
                  position={[0, 0.48, pi === 0 ? -0.14 : 0.14]}
                  rotation={[pi === 0 ? -0.26 : 0.26, 0, 0]}
                  material={materials.brushedSteelMat}
                  castShadow
                >
                  <cylinderGeometry args={[0.036, 0.044, 1.05, 10]} />
                </mesh>
                <mesh position={[0, 0.03, 0]} material={materials.leatherStitchSeamMat}>
                  <cylinderGeometry args={[0.13, 0.15, 0.06, 10]} />
                </mesh>
              </group>
            ))}
            {/* Longitudinal Steel Under-Spine */}
            <mesh
              position={[0, 0.07, 0]}
              rotation={[Math.PI / 2, 0, 0]}
              material={materials.brushedSteelMat}
            >
              <cylinderGeometry args={[0.032, 0.032, 2.55, 8]} />
            </mesh>
            {/* Spreader Wooden Bars at Ends */}
            {[-1.08, 1.08].map((sz, si) => (
              <mesh
                key={`h-bar-${si}`}
                position={[0, 0.78, sz]}
                rotation={[0, 0, Math.PI / 2]}
                material={materials.woodMat}
              >
                <cylinderGeometry args={[0.02, 0.02, 0.56, 8]} />
              </mesh>
            ))}
            {/* Woven Rope Catenary Sling */}
            <mesh
              geometry={geometries.hammockSlingGeo!}
              material={materials.wovenRopeMat}
              castShadow
              receiveShadow
            />
          </group>
        ))}

      {/* Individual Seats */}
      {seats.map((seat) => {
        const isSelected = seat.id === selectedSeatId;
        const isHovered = seat.id === hoveredSeatId;
        const seatYaw = seat.yaw ?? 0;

        if (isBioluminescent && geometries.podCushionGeo && geometries.podBackGeo) {
          const isPitSectional = seat.rowIndex <= 1;
          const baseMat = isSelected
            ? materials.selectedLeatherMat
            : isHovered
              ? materials.hoveredLeatherMat
              : isPitSectional
                ? materials.pitLeatherMat
                : (seat.rowIndex + seat.seatNumber) % 2 === 0
                  ? materials.podTealLeatherMat
                  : materials.podPlumLeatherMat;

          if (isPitSectional) {
            return (
              <group
                key={seat.id}
                position={seat.worldPosition}
                rotation={[0, seatYaw, 0]}
                onClick={interactive ? handleClick(seat) : undefined}
                onPointerMove={enableHover ? handleOver(seat) : undefined}
                onPointerOut={enableHover ? handleOut : undefined}
              >
                {/* Matte Dark Pebbled Leather Modular Sunken Pit Sectional */}
                <mesh
                  geometry={geometries.podCushionGeo}
                  material={baseMat}
                  castShadow
                  receiveShadow
                />
                {/* Contoured Reclined Backrest */}
                <mesh
                  position={[0, 0.24, 0.34]}
                  rotation={[0.16, 0, 0]}
                  geometry={geometries.podBackGeo}
                  material={baseMat}
                  castShadow
                />
                {/* Subtle Stitched Piping Seam */}
                <mesh position={[0, 0.295, 0.02]} material={materials.leatherStitchSeamMat}>
                  <boxGeometry args={[0.72, 0.014, 0.018]} />
                </mesh>
                {/* Soft Throw Cushion */}
                <mesh
                  position={[seat.seatNumber % 2 === 0 ? -0.14 : 0.14, 0.38, 0.16]}
                  rotation={[-0.25, 0.18, 0.08]}
                  material={materials.pitPillowMat}
                  castShadow
                >
                  <boxGeometry args={[0.3, 0.24, 0.1]} />
                </mesh>
                {/* Under-seat Cyan Ground Strip (fades off completely when movie starts) */}
                <mesh position={[0, 0.02, 0.04]} material={materials.underSeatCyanMat}>
                  <boxGeometry args={[0.66, 0.022, 0.72]} />
                </mesh>
              </group>
            );
          }

          // Rows 2-5: Quilted Matte Leather Inflatable Lounge Pods
          return (
            <group
              key={seat.id}
              position={seat.worldPosition}
              rotation={[0, seatYaw, 0]}
              onClick={interactive ? handleClick(seat) : undefined}
              onPointerMove={enableHover ? handleOver(seat) : undefined}
              onPointerOut={enableHover ? handleOut : undefined}
            >
              {/* Quilted Seat Cushion Base */}
              <mesh
                geometry={geometries.podCushionGeo}
                material={baseMat}
                castShadow
                receiveShadow
              />
              {/* Reclined Quilted Backrest */}
              <mesh
                position={[0, 0.24, 0.34]}
                rotation={[0.2, 0, 0]}
                geometry={geometries.podBackGeo}
                material={baseMat}
                castShadow
              />
              {/* Dual Side Bolster Arm Ribs (matte stitched leather) */}
              {[-0.38, 0.38].map((bx, bi) => (
                <mesh
                  key={`pod-bolster-${bi}`}
                  position={[bx, 0.26, 0.02]}
                  material={baseMat}
                  castShadow
                >
                  <boxGeometry args={[0.11, 0.24, 0.82]} />
                </mesh>
              ))}
              {/* Horizontal Quilted Tuft Seam Lines */}
              {[-0.14, 0.12].map((sz, si) => (
                <mesh
                  key={`pod-seam-${si}`}
                  position={[0, 0.295, sz]}
                  material={materials.leatherStitchSeamMat}
                >
                  <boxGeometry args={[0.68, 0.012, 0.016]} />
                </mesh>
              ))}
              {/* Under-Pod Ambient LED Ring (fades cleanly to 0 during playback) */}
              <mesh
                position={[0, 0.02, 0.04]}
                material={
                  (seat.rowIndex + seat.seatNumber) % 2 === 0
                    ? materials.underSeatCyanMat
                    : materials.underSeatMagentaMat
                }
              >
                <boxGeometry args={[0.72, 0.022, 0.78]} />
              </mesh>
            </group>
          );
        }

        // Sunset Cove Beach Cinema Seating (Front Wooden Deck Loungers rows 0-1, Rear Bean Bags rows 2+)
        const isLounger = seat.rowIndex <= 1;

        if (isLounger && geometries.loungerSlingGeo) {
          const slingMat = isSelected
            ? materials.selectedSlingMat
            : isHovered
              ? materials.hoveredSlingMat
              : materials.canvasSlingMat;

          return (
            <group
              key={seat.id}
              position={seat.worldPosition}
              rotation={[0, seatYaw, 0]}
              onClick={interactive ? handleClick(seat) : undefined}
              onPointerMove={enableHover ? handleOver(seat) : undefined}
              onPointerOut={enableHover ? handleOut : undefined}
            >
              {/* Left & Right Solid Teak Frame Assemblies */}
              {[-0.34, 0.34].map((rx, ri) => (
                <group key={`rail-${ri}`} position={[rx, 0, 0]}>
                  {/* Front Vertical-Splayed Leg (Sand to Armrest) */}
                  <mesh
                    position={[0, 0.25, -0.335]}
                    rotation={[0.06, 0, 0]}
                    material={materials.woodMat}
                    castShadow
                    receiveShadow
                  >
                    <boxGeometry args={[0.05, 0.505, 0.055]} />
                  </mesh>
                  {/* Rear Support Leg (Sand to Armrest/Backrest Junction) */}
                  <mesh
                    position={[0, 0.255, 0.345]}
                    rotation={[-0.175, 0, 0]}
                    material={materials.woodMat}
                    castShadow
                    receiveShadow
                  >
                    <boxGeometry args={[0.05, 0.52, 0.055]} />
                  </mesh>
                  {/* Reclined Backrest Side Stile (tilts cleanly BACKWARD toward +Z) */}
                  <mesh
                    position={[0, 0.555, 0.31]}
                    rotation={[0.421, 0, 0]}
                    material={materials.woodMat}
                    castShadow
                  >
                    <boxGeometry args={[0.05, 0.74, 0.055]} />
                  </mesh>
                  {/* Lower Seat Side Rail */}
                  <mesh
                    position={[0, 0.25, -0.08]}
                    rotation={[0.115, 0, 0]}
                    material={materials.woodMat}
                    castShadow
                  >
                    <boxGeometry args={[0.048, 0.052, 0.53]} />
                  </mesh>
                  {/* Wide Flat Teak Armrest */}
                  <mesh
                    position={[0, 0.515, -0.01]}
                    material={materials.woodMat}
                    castShadow
                    receiveShadow
                  >
                    <boxGeometry args={[0.095, 0.032, 0.69]} />
                  </mesh>
                </group>
              ))}

              {/* 3 Horizontal Teak Crossbars Connecting Both Side Frames */}
              <mesh
                position={[0, 0.875, 0.45]}
                rotation={[0, 0, Math.PI / 2]}
                material={materials.woodMat}
                castShadow
              >
                <cylinderGeometry args={[0.024, 0.024, 0.73, 10]} />
              </mesh>
              <mesh
                position={[0, 0.285, -0.34]}
                rotation={[0, 0, Math.PI / 2]}
                material={materials.woodMat}
              >
                <cylinderGeometry args={[0.022, 0.022, 0.72, 10]} />
              </mesh>
              <mesh
                position={[0, 0.14, 0.365]}
                rotation={[0, 0, Math.PI / 2]}
                material={materials.woodMat}
              >
                <cylinderGeometry args={[0.022, 0.022, 0.72, 10]} />
              </mesh>

              {/* Continuous Contoured Striped Canvas Sling Cushion */}
              <mesh
                geometry={geometries.loungerSlingGeo}
                material={slingMat}
                castShadow
                receiveShadow
              />

              {/* Plush Cream Headrest Bolster Pillow */}
              <mesh
                position={[0, 0.75, 0.365]}
                rotation={[0.421, 0, 0]}
                material={materials.cushionMat}
                castShadow
              >
                <boxGeometry args={[0.42, 0.14, 0.085]} />
              </mesh>
            </group>
          );
        }

        const bagMat = isSelected
          ? materials.selectedBeanBagMat
          : isHovered
            ? materials.hoveredBeanBagMat
            : materials.beanBagMats[(seat.rowIndex + seat.seatNumber) % materials.beanBagMats.length];

        return (
          <group
            key={seat.id}
            position={seat.worldPosition}
            rotation={[0, seatYaw, 0]}
            onClick={interactive ? handleClick(seat) : undefined}
            onPointerMove={enableHover ? handleOver(seat) : undefined}
            onPointerOut={enableHover ? handleOut : undefined}
          >
            <mesh geometry={geometries.beanBagGeo} material={bagMat} castShadow receiveShadow />
            <mesh
              position={[0.14, 0.38, 0.14]}
              rotation={[-0.38, 0.22, 0.15]}
              material={materials.cushionMat}
              castShadow
            >
              <boxGeometry args={[0.32, 0.26, 0.1]} />
            </mesh>
          </group>
        );
      })}

      {/* Grounded 3D Reserved plaque & folded screening program on selected beach seat */}
      {selectedSeat && (
        <ReservedSeatMarker
          position={selectedSeat.worldPosition}
          yaw={selectedSeat.yaw ?? 0}
          plaqueLocalPos={
            isBioluminescent
              ? [0.14, 0.302, -0.18]
              : selectedSeat.rowIndex <= 1
                ? [0.14, 0.302, -0.18]
                : [-0.14, 0.355, -0.16]
          }
          seatLabel={selectedSeat.id}
          accentHex={isBioluminescent ? '#22d3ee' : '#d4af37'}
          lightFactor={lightFactor}
          isPlaying={isPlaying}
          viewMode={viewMode}
          floorRingYOffset={0.045}
          floorRingRadius={[0.48, 0.54]}
        />
      )}

      {/* Cyan hover ring in Hall View */}
      {hoveredSeat && hoveredSeat.id !== selectedSeatId && (
        <mesh
          position={[
            hoveredSeat.worldPosition[0],
            hoveredSeat.worldPosition[1] + 0.74,
            hoveredSeat.worldPosition[2],
          ]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.2, 0.27, 32]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.95} />
        </mesh>
      )}
    </group>
  );
};
