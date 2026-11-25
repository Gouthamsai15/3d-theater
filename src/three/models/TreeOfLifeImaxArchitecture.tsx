import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { TheaterConfiguration } from '../../types/cinema';
import {
  createBronzePatinaLeafTextures,
  createDarkSlateStoneStageTextures,
  createTaupeEarthPlasterTextures,
  createTreeOfLifeAmberWashTexture,
  createWalnutAcousticSlatTextures,
  createWalnutWoodTextures,
} from '../materials/proceduralTextures';
import {
  applyScreenBounceToMaterial,
  ScreenBounceUniforms,
} from '../lighting/screenBounceShader';

interface TreeOfLifeProps {
  config: TheaterConfiguration;
  lightFactor: number;
  screenBounceUniforms?: ScreenBounceUniforms;
  exitSignMap?: THREE.Texture;
}

/**
 * Builds a custom radially-tapered TubeGeometry along any 3D CatmullRomCurve3
 * so trunks, flared roots, primary canopy boughs, and delicate twigs taper organically.
 */
function buildTaperedSplineTubeGeometry(
  curve: THREE.Curve<THREE.Vector3>,
  tubularSegments: number,
  radialSegments: number,
  radiusAtT: (t: number) => number,
): THREE.BufferGeometry {
  const frames = curve.computeFrenetFrames(tubularSegments, false);
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const P = new THREE.Vector3();
  const N = new THREE.Vector3();
  const B = new THREE.Vector3();
  const v = new THREE.Vector3();
  const normal = new THREE.Vector3();

  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments;
    curve.getPointAt(t, P);
    const radius = Math.max(0.004, radiusAtT(t));
    N.copy(frames.normals[i]);
    B.copy(frames.binormals[i]);

    for (let j = 0; j <= radialSegments; j++) {
      const u = (j / radialSegments) * Math.PI * 2;
      const sin = Math.sin(u);
      const cos = -Math.cos(u);

      normal.set(
        cos * N.x + sin * B.x,
        cos * N.y + sin * B.y,
        cos * N.z + sin * B.z,
      ).normalize();

      v.copy(P).addScaledVector(normal, radius);
      positions.push(v.x, v.y, v.z);
      normals.push(normal.x, normal.y, normal.z);
      uvs.push(t * 4, j / radialSegments);
    }
  }

  for (let i = 0; i < tubularSegments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = (radialSegments + 1) * i + j;
      const b = (radialSegments + 1) * (i + 1) + j;
      const c = (radialSegments + 1) * (i + 1) + (j + 1);
      const d = (radialSegments + 1) * i + (j + 1);
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

/**
 * Builds a gracefully cambered, sculpted 3D botanical leaf geometry (pointed almond silhouette with midrib crease)
 * used for InstancedMesh aged-bronze patina leaves across wall twigs and ceiling boughs.
 */
function buildSculptedBronzeLeafGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(0.14, 0.09, 0.22, 0.26, 0.14, 0.48);
  shape.bezierCurveTo(0.09, 0.62, 0.03, 0.72, 0, 0.8);
  shape.bezierCurveTo(-0.03, 0.72, -0.09, 0.62, -0.14, 0.48);
  shape.bezierCurveTo(-0.22, 0.26, -0.14, 0.09, 0, 0);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.022,
    bevelEnabled: true,
    bevelThickness: 0.009,
    bevelSize: 0.008,
    bevelSegments: 2,
    curveSegments: 10,
  });

  // Apply gentle organic longitudinal curl + cupped center vein crease
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i);
    const ly = pos.getY(i);
    const lz = pos.getZ(i);
    const cup = Math.abs(lx) * 0.14;
    const arch = Math.sin((ly / 0.8) * Math.PI) * 0.045;
    pos.setZ(i, lz + cup + arch);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Computes consistent Tree of Life bay layout metrics shared between wall relief, ceiling ribs, and speaker placement.
 */
export function getTreeOfLifeBayLayout(config: TheaterConfiguration) {
  const W = config.auditoriumWidth;
  const L = config.auditoriumLength;
  const H = config.auditoriumHeight;
  const bayCount = Math.max(3, Math.min(5, config.wallBayCount || 4));
  const zFront = Math.max(-L / 2 + 3.0, config.screenPosition[2] + 2.25);
  const zRear = L / 2 - 2.2;
  const span = (zRear - zFront) / bayCount;
  const wallFaceX = W / 2 - 0.2;

  const getDadoY = (z: number) => {
    const t = THREE.MathUtils.clamp(
      (z - config.firstRowZ) / Math.max(1, (config.seatingRows - 1) * config.rowSpacing),
      0,
      1,
    );
    const seatBaseY = t * Math.max(0, config.seatingRows - 1) * config.rowElevationStep;
    return THREE.MathUtils.clamp(seatBaseY + 1.02, 1.02, H - 5.2);
  };

  const bays = Array.from({ length: bayCount }, (_, idx) => {
    const bz = zFront + (idx + 0.5) * span;
    const dadoY = getDadoY(bz);
    const availableH = H - 0.55 - dadoY;
    const ovalH = THREE.MathUtils.clamp(availableH * 0.44, 2.35, 4.45);
    const ovalW = Math.min(span * 0.66, 4.15);
    const ovalCenterY = dadoY + ovalH * 0.54;
    const crownY = ovalCenterY + ovalH * 0.52;
    return {
      idx,
      bz,
      span,
      dadoY,
      ovalW,
      ovalH,
      ovalCenterY,
      crownY,
    };
  });

  return { W, L, H, bayCount, zFront, zRear, span, wallFaceX, getDadoY, bays };
}

/**
 * Returns matte-black surround speaker placements centered inside the smooth taupe earth-plaster oval bays.
 */
export function getTreeOfLifeSideSpeakerPositions(config: TheaterConfiguration) {
  const { wallFaceX, bays } = getTreeOfLifeBayLayout(config);
  const list: { x: number; y: number; z: number; side: -1 | 1; bayIdx: number }[] = [];

  bays.forEach((bay) => {
    const spkY = bay.ovalCenterY + bay.ovalH * 0.14;
    ([-1, 1] as const).forEach((side) => {
      list.push({
        x: side * (wallFaceX - 0.16),
        y: spkY,
        z: bay.bz,
        side,
        bayIdx: bay.idx,
      });
    });
  });

  return list;
}

/**
 * Returns flush overhead Atmos speaker placements centered neatly inside the outer ceiling wood-slat canopy bays.
 */
export function getTreeOfLifeCeilingSpeakerPositions(config: TheaterConfiguration) {
  const { W, H, bays } = getTreeOfLifeBayLayout(config);
  const pts: { x: number; y: number; z: number; side: -1 | 1 }[] = [];
  const xs = [-W * 0.31, W * 0.31];
  bays.forEach((bay) => {
    xs.forEach((x, xi) => {
      pts.push({
        x,
        y: H - 0.16,
        z: bay.bz,
        side: xi === 0 ? -1 : 1,
      });
    });
  });
  return pts;
}

/**
 * Builds the four floor-to-ceiling organic dark-walnut Tree of Life relief walls:
 *  - Continuous curved dado handrail matching the stadium rake
 *  - Taupe earth-plaster oval lower speaker alcoves framed by flared roots & warm amber cove halos
 *  - Recessed vertical walnut acoustic slats behind sinuous upper branches & fine twigs
 *  - 3D sculpted aged-bronze leaf clusters + bioluminescent warm-white frosted orb nodes
 */
export const TreeOfLifeImaxWalls: React.FC<TreeOfLifeProps> = ({
  config,
  lightFactor,
  screenBounceUniforms,
}) => {
  const layout = useMemo(() => getTreeOfLifeBayLayout(config), [config]);
  const { W, L, H, wallFaceX, bays, getDadoY } = layout;

  const texSets = useMemo(() => {
    const walnut = createWalnutWoodTextures();
    const plaster = createTaupeEarthPlasterTextures();
    const slats = createWalnutAcousticSlatTextures();
    const leaf = createBronzePatinaLeafTextures();
    const amberWash = createTreeOfLifeAmberWashTexture();
    return { walnut, plaster, slats, leaf, amberWash };
  }, []);

  useEffect(() => {
    return () => {
      texSets.walnut.dispose();
      texSets.plaster.dispose();
      texSets.slats.dispose();
      texSets.leaf.dispose();
      texSets.amberWash.dispose();
    };
  }, [texSets]);

  const mats = useMemo(() => {
    const walnutMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        map: texSets.walnut.map,
        bumpMap: texSets.walnut.bumpMap,
        bumpScale: 0.022,
        color: '#8f5f42',
        roughness: 0.44,
        metalness: 0.06,
      }),
      screenBounceUniforms,
    );

    const earthPlasterMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        map: texSets.plaster.map,
        bumpMap: texSets.plaster.bumpMap,
        bumpScale: 0.028,
        color: '#cbb49c',
        roughness: 0.94,
        metalness: 0.01,
      }),
      screenBounceUniforms,
    );

    const slatBackingMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        map: texSets.slats.map,
        bumpMap: texSets.slats.bumpMap,
        bumpScale: 0.036,
        color: '#a87d60',
        roughness: 0.72,
        metalness: 0.04,
      }),
      screenBounceUniforms,
    );

    const darkFeltVoidMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#120d0a',
        roughness: 0.96,
        metalness: 0.01,
      }),
      screenBounceUniforms,
    );

    const bronzeLeafMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        map: texSets.leaf.map,
        bumpMap: texSets.leaf.bumpMap,
        bumpScale: 0.022,
        color: '#b8a974',
        roughness: 0.38,
        metalness: 0.56,
      }),
      screenBounceUniforms,
    );

    const amberCoveMat = new THREE.MeshStandardMaterial({
      color: '#ffdf9e',
      emissive: '#ffaa44',
      emissiveIntensity: 0.25 + lightFactor * 2.1,
      roughness: 0.2,
      toneMapped: false,
    });

    const amberWashMat = new THREE.MeshBasicMaterial({
      map: texSets.amberWash,
      color: '#ffba5c',
      transparent: true,
      opacity: 0.08 + lightFactor * 0.48,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });

    const bioOrbMat = new THREE.MeshStandardMaterial({
      color: '#fff9eb',
      emissive: '#ffd58e',
      emissiveIntensity: 0.3 + lightFactor * 2.4,
      roughness: 0.16,
      metalness: 0.04,
      toneMapped: false,
    });

    return {
      walnutMat,
      earthPlasterMat,
      slatBackingMat,
      darkFeltVoidMat,
      bronzeLeafMat,
      amberCoveMat,
      amberWashMat,
      bioOrbMat,
    };
  }, [texSets, screenBounceUniforms, lightFactor]);

  useEffect(() => {
    mats.amberCoveMat.emissiveIntensity = 0.25 + lightFactor * 2.1;
    mats.amberWashMat.opacity = 0.08 + lightFactor * 0.48;
    mats.bioOrbMat.emissiveIntensity = 0.3 + lightFactor * 2.4;
  }, [mats, lightFactor]);

  useEffect(() => {
    return () => {
      Object.values(mats).forEach((m) => m.dispose());
    };
  }, [mats]);

  // Build organic Tree of Life geometries in local wall space (x = inward depth from wall face, y = vertical height, z = longitudinal hall Z)
  const wallGeos = useMemo(() => {
    const walnutBranchGeos: THREE.BufferGeometry[] = [];
    const coveTubeGeos: THREE.BufferGeometry[] = [];
    const ovalBayGeos: { geo: THREE.BufferGeometry; x: number; y: number; z: number }[] = [];
    const washRingGeos: THREE.BufferGeometry[] = [];
    const leafPlacements: { pos: THREE.Vector3; rot: THREE.Euler; scale: number }[] = [];
    const orbPlacements: { pos: THREE.Vector3; scale: number; isBright: boolean }[] = [];

    // 1. Sloped continuous walnut lower dado handrail spanning from front wing to back wall
    const dadoPts: THREE.Vector3[] = [];
    const dadoSteps = 22;
    for (let i = 0; i <= dadoSteps; i++) {
      const z = THREE.MathUtils.lerp(-L / 2 + 1.4, L / 2 - 0.8, i / dadoSteps);
      dadoPts.push(new THREE.Vector3(0.18, getDadoY(z) + 0.06, z));
    }
    const dadoCurve = new THREE.CatmullRomCurve3(dadoPts);
    walnutBranchGeos.push(
      buildTaperedSplineTubeGeometry(dadoCurve, 44, 10, () => 0.075),
    );

    // 2. Sculpt each of the 4 Tree of Life bays + shared sweeping trunks between bays
    bays.forEach((bay) => {
      const { bz, span, dadoY, ovalW, ovalH, ovalCenterY, crownY } = bay;
      const rx = ovalW * 0.46;
      const ry = ovalH * 0.48;

      // Smooth oval earth-plaster backing disc set slightly proud of dark backing cavity
      const ovalShape = new THREE.Shape();
      ovalShape.absellipse(0, 0, rx, ry, 0, Math.PI * 2, false, 0);
      const ovalGeo = new THREE.ExtrudeGeometry(ovalShape, {
        depth: 0.09,
        bevelEnabled: true,
        bevelThickness: 0.03,
        bevelSize: 0.03,
        bevelSegments: 2,
        curveSegments: 28,
      });
      // Rotate so local ellipse lies on YZ plane facing +X inward
      ovalGeo.rotateY(Math.PI / 2);
      ovalBayGeos.push({ geo: ovalGeo, x: 0.03, y: ovalCenterY, z: bz });

      // Warm backlit amber cove tube tracing inner rim of oval bay
      const covePts: THREE.Vector3[] = [];
      const coveSegs = 32;
      for (let k = 0; k <= coveSegs; k++) {
        const a = (k / coveSegs) * Math.PI * 2;
        const py = ovalCenterY + Math.sin(a) * (ry - 0.02);
        const pz = bz + Math.cos(a) * (rx - 0.02);
        covePts.push(new THREE.Vector3(0.135, py, pz));
      }
      const coveCurve = new THREE.CatmullRomCurve3(covePts, true);
      coveTubeGeos.push(
        buildTaperedSplineTubeGeometry(coveCurve, 40, 6, () => 0.024),
      );

      // Soft additive amber perimeter aura ring around the oval bay
      const washRingGeo = new THREE.RingGeometry(0.84, 1.08, 36);
      washRingGeo.scale(rx * 1.02, ry * 1.02, 1);
      washRingGeo.rotateY(Math.PI / 2);
      washRingGeo.translate(0.125, ovalCenterY, bz);
      washRingGeos.push(washRingGeo);

      // Flared tree roots curving around left & right sides of each oval bay and anchoring below the dado rail
      ([-1, 1] as const).forEach((dir) => {
        // Outer main trunk rising beside the bay all the way up to ceiling springline
        const trunkPts = [
          new THREE.Vector3(0.32, Math.max(0.1, dadoY - 0.95), bz + dir * (rx + 0.56)),
          new THREE.Vector3(0.28, dadoY + 0.15, bz + dir * (rx + 0.34)),
          new THREE.Vector3(0.26, ovalCenterY, bz + dir * (rx + 0.16)),
          new THREE.Vector3(0.28, crownY + 0.45, bz + dir * (rx * 0.72)),
          new THREE.Vector3(0.32, Math.min(H - 0.55, crownY + (H - crownY) * 0.62), bz + dir * (span * 0.34)),
          new THREE.Vector3(0.36, H - 0.28, bz + dir * (span * 0.42)),
        ];
        const trunkCurve = new THREE.CatmullRomCurve3(trunkPts);
        walnutBranchGeos.push(
          buildTaperedSplineTubeGeometry(
            trunkCurve,
            28,
            10,
            (t) => 0.22 - Math.sin(t * Math.PI * 0.75) * 0.05,
          ),
        );

        // Sweeping lower root tendril cradling bottom arc of oval bay
        const rootPts = [
          new THREE.Vector3(0.24, Math.max(0.05, dadoY - 0.7), bz + dir * (rx + 0.78)),
          new THREE.Vector3(0.22, dadoY + 0.12, bz + dir * (rx * 0.72)),
          new THREE.Vector3(0.2, dadoY + 0.08, bz + dir * (rx * 0.12)),
          new THREE.Vector3(0.18, dadoY + 0.14, bz - dir * (rx * 0.08)),
        ];
        const rootCurve = new THREE.CatmullRomCurve3(rootPts);
        walnutBranchGeos.push(
          buildTaperedSplineTubeGeometry(rootCurve, 18, 8, (t) => THREE.MathUtils.lerp(0.16, 0.075, t)),
        );

        // Sweeping upper arch branch curving cleanly over the oval bay & crossing toward bay crown
        const archPts = [
          new THREE.Vector3(0.25, crownY - 0.35, bz + dir * (rx + 0.18)),
          new THREE.Vector3(0.23, crownY + 0.42, bz + dir * (rx * 0.45)),
          new THREE.Vector3(0.22, Math.min(H - 0.65, crownY + 1.25), bz + dir * 0.15),
          new THREE.Vector3(0.26, H - 0.32, bz - dir * (span * 0.14)),
        ];
        const archCurve = new THREE.CatmullRomCurve3(archPts);
        walnutBranchGeos.push(
          buildTaperedSplineTubeGeometry(archCurve, 24, 9, (t) => THREE.MathUtils.lerp(0.15, 0.085, t)),
        );

        // Glowing amber cove tracing inner edge of the upper arch branch
        const archCovePts = archPts.map((p) => new THREE.Vector3(0.15, p.y - 0.04, p.z));
        const archCoveCurve = new THREE.CatmullRomCurve3(archCovePts);
        coveTubeGeos.push(
          buildTaperedSplineTubeGeometry(archCoveCurve, 22, 6, () => 0.02),
        );

        // Secondary sinuous canopy sub-branches + twigs inside upper wood-slat field
        const branchPairs = [
          {
            pts: [
              new THREE.Vector3(0.22, crownY + 0.18, bz + dir * (rx * 0.76)),
              new THREE.Vector3(0.21, Math.min(H - 1.1, crownY + 1.05), bz + dir * (span * 0.18)),
              new THREE.Vector3(0.2, Math.min(H - 0.6, crownY + 1.95), bz + dir * (span * 0.34)),
            ],
            r0: 0.1,
            r1: 0.04,
            hasOrb: bay.idx <= 2,
          },
          {
            pts: [
              new THREE.Vector3(0.21, crownY + 0.55, bz + dir * (span * 0.25)),
              new THREE.Vector3(0.2, Math.min(H - 1.0, crownY + 1.45), bz + dir * (span * 0.04)),
              new THREE.Vector3(0.2, Math.min(H - 0.55, crownY + 2.25), bz - dir * (span * 0.12)),
            ],
            r0: 0.085,
            r1: 0.032,
            hasOrb: bay.idx <= 1,
          },
        ];

        branchPairs.forEach((bp, bi) => {
          const bCurve = new THREE.CatmullRomCurve3(bp.pts);
          walnutBranchGeos.push(
            buildTaperedSplineTubeGeometry(bCurve, 16, 7, (t) => THREE.MathUtils.lerp(bp.r0, bp.r1, t)),
          );
          const coveBranchPts = bp.pts.map((p) => new THREE.Vector3(0.145, p.y - 0.03, p.z));
          coveTubeGeos.push(
            buildTaperedSplineTubeGeometry(new THREE.CatmullRomCurve3(coveBranchPts), 14, 5, () => 0.016),
          );

          // Place 2 sculpted aged-bronze leaves along each canopy twig
          [0.42, 0.78].forEach((lt, li) => {
            const p = bCurve.getPointAt(lt);
            leafPlacements.push({
              pos: new THREE.Vector3(p.x + 0.02, p.y, p.z),
              rot: new THREE.Euler(
                dir * (0.45 + li * 0.35),
                Math.PI / 2,
                dir * (0.28 + bi * 0.22),
              ),
              scale: 0.65 + ((bay.idx + bi + li) % 3) * 0.14,
            });
          });

          // Place glowing warm-white bioluminescent orb nodes in twig forks (brightest on mid/front bays)
          if (bp.hasOrb) {
            const orbPt = bCurve.getPointAt(0.56 + bi * 0.18);
            orbPlacements.push({
              pos: new THREE.Vector3(orbPt.x + 0.06, orbPt.y, orbPt.z),
              scale: 0.085 + bi * 0.015,
              isBright: bay.idx === 0 || bay.idx === 1,
            });
          }
        });
      });

      // Lower mid-bay twigs rising gently around the upper half of each oval bay
      ([-1, 1] as const).forEach((sideTwig) => {
        const twigPts = [
          new THREE.Vector3(0.22, crownY - 0.45, bz + sideTwig * (rx * 0.85)),
          new THREE.Vector3(0.21, crownY + 0.35, bz + sideTwig * (rx * 0.56)),
          new THREE.Vector3(0.2, Math.min(H - 1.2, crownY + 1.15), bz + sideTwig * (rx * 0.28)),
        ];
        const twigCurve = new THREE.CatmullRomCurve3(twigPts);
        walnutBranchGeos.push(
          buildTaperedSplineTubeGeometry(twigCurve, 14, 6, (t) => THREE.MathUtils.lerp(0.075, 0.028, t)),
        );
        const leafPt = twigCurve.getPointAt(0.72);
        leafPlacements.push({
          pos: new THREE.Vector3(leafPt.x + 0.02, leafPt.y, leafPt.z),
          rot: new THREE.Euler(-sideTwig * 0.52, Math.PI / 2, sideTwig * 0.22),
          scale: 0.62,
        });
        if (bay.idx <= 2) {
          const orbPt = twigCurve.getPointAt(0.88);
          orbPlacements.push({
            pos: new THREE.Vector3(orbPt.x + 0.055, orbPt.y, orbPt.z),
            scale: 0.078,
            isBright: bay.idx <= 1,
          });
        }
      });
    });

    const leafGeo = buildSculptedBronzeLeafGeometry();
    const orbGeo = new THREE.SphereGeometry(1, 14, 12);

    return {
      walnutBranchGeos,
      coveTubeGeos,
      ovalBayGeos,
      washRingGeos,
      leafGeo,
      orbGeo,
      leafPlacements,
      orbPlacements,
    };
  }, [L, H, bays, getDadoY]);

  useEffect(() => {
    return () => {
      wallGeos.walnutBranchGeos.forEach((g) => g.dispose());
      wallGeos.coveTubeGeos.forEach((g) => g.dispose());
      wallGeos.ovalBayGeos.forEach((o) => o.geo.dispose());
      wallGeos.washRingGeos.forEach((g) => g.dispose());
      wallGeos.leafGeo.dispose();
      wallGeos.orbGeo.dispose();
    };
  }, [wallGeos]);

  // Subtle low-intensity warm PointLights along front/mid tree bays (keeps IMAX screen contrast crisp during playback)
  const accentLights = useMemo(
    () =>
      bays.slice(0, 3).flatMap((bay) =>
        ([-1, 1] as const).map((side) => ({
          key: `tree-pt-${bay.idx}-${side}`,
          x: side * (wallFaceX - 1.05),
          y: bay.crownY + 0.55,
          z: bay.bz,
        })),
      ),
    [bays, wallFaceX],
  );

  return (
    <group>
      {/* Left & Right Tree of Life Sculpted Relief Walls */}
      {([-1, 1] as const).map((side) => {
        const wallX = side * wallFaceX;
        const inScale = -side; // local +X maps inward toward center of auditorium
        return (
          <group key={`tree-wall-${side}`} position={[wallX, 0, 0]} scale={[inScale, 1, 1]}>
            {/* Deep acoustic felt recess behind entire wall relief */}
            <mesh position={[0.015, H / 2, 0]} material={mats.darkFeltVoidMat} receiveShadow>
              <boxGeometry args={[0.03, H - 0.1, L - 0.6]} />
            </mesh>

            {/* Recessed dark vertical walnut acoustic wood slats across upper wall canopy field */}
            <mesh position={[0.04, H * 0.64, 0]} material={mats.slatBackingMat} receiveShadow>
              <boxGeometry args={[0.04, H * 0.72, L - 1.2]} />
            </mesh>

            {/* Smooth taupe earth-plaster oval lower bays */}
            {wallGeos.ovalBayGeos.map((ob, oi) => (
              <mesh
                key={`oval-bay-${side}-${oi}`}
                position={[ob.x, ob.y, ob.z]}
                geometry={ob.geo}
                material={mats.earthPlasterMat}
                receiveShadow
              />
            ))}

            {/* Sculpted dark walnut trunks, roots, dado rail, canopy arches & twigs */}
            {wallGeos.walnutBranchGeos.map((geo, bi) => (
              <mesh
                key={`walnut-branch-${side}-${bi}`}
                geometry={geo}
                material={mats.walnutMat}
                castShadow
                receiveShadow
              />
            ))}

            {/* Warm amber/gold recessed cove tubes tracing oval bays & upper boughs */}
            {wallGeos.coveTubeGeos.map((geo, ci) => (
              <mesh key={`amber-cove-${side}-${ci}`} geometry={geo} material={mats.amberCoveMat} />
            ))}

            {/* Soft additive amber perimeter washes inside oval bays */}
            {wallGeos.washRingGeos.map((geo, wi) => (
              <mesh
                key={`amber-wash-${side}-${wi}`}
                geometry={geo}
                material={mats.amberWashMat}
                renderOrder={2}
              />
            ))}

            {/* Sculpted 3D aged-bronze / olive patina leaves along upper tree boughs */}
            {wallGeos.leafPlacements.map((lp, li) => (
              <mesh
                key={`wall-leaf-${side}-${li}`}
                position={lp.pos}
                rotation={lp.rot}
                scale={lp.scale}
                geometry={wallGeos.leafGeo}
                material={mats.bronzeLeafMat}
                castShadow
              />
            ))}

            {/* Bioluminescent frosted warm-white orb nodes in twig forks */}
            {wallGeos.orbPlacements.map((op, oi) => (
              <mesh
                key={`wall-orb-${side}-${oi}`}
                position={op.pos}
                scale={op.scale}
                geometry={wallGeos.orbGeo}
                material={mats.bioOrbMat}
              />
            ))}
          </group>
        );
      })}

      {/* Low-intensity warm amber wall accents (modulated cleanly by lightFactor for high playback contrast) */}
      {accentLights.map((pl) => (
        <pointLight
          key={pl.key}
          position={[pl.x, pl.y, pl.z]}
          color="#ffb85c"
          intensity={lightFactor * 1.45}
          distance={7.5}
          decay={2}
        />
      ))}
    </group>
  );
};

/**
 * Builds the continuous overhead Tree of Life "Up Design" Ceiling Canopy + Curved Velvet Proscenium + Semi-Circular Honed Stone Stage:
 *  - Sweeping sculpted dark-walnut ceiling bough ribs curving from side wall tree crowns inward toward the central spine
 *  - Textured matte taupe earth-plaster central ceiling spine & recessed dark walnut acoustic wood-slat coffers
 *  - Continuous warm amber ceiling cove lighting, 3D bronze leaves & dim recessed pinpoint downlights
 *  - Curved matte-black velvet arched proscenium, slim side wing curtains, walnut exit doors, & 2-step semi-circular dark stone stage
 */
export const TreeOfLifeImaxCeilingAndStage: React.FC<TreeOfLifeProps> = ({
  config,
  lightFactor,
  screenBounceUniforms,
  exitSignMap,
}) => {
  const layout = useMemo(() => getTreeOfLifeBayLayout(config), [config]);
  const { W, L, H, bays, zFront, zRear } = layout;
  const { screenPosition, screenWidth, screenHeight, screenCurvature } = config;

  const texSets = useMemo(() => {
    const walnut = createWalnutWoodTextures();
    const plaster = createTaupeEarthPlasterTextures();
    const slats = createWalnutAcousticSlatTextures();
    const stone = createDarkSlateStoneStageTextures();
    const leaf = createBronzePatinaLeafTextures();
    const amberWash = createTreeOfLifeAmberWashTexture();
    return { walnut, plaster, slats, stone, leaf, amberWash };
  }, []);

  useEffect(() => {
    return () => {
      texSets.walnut.dispose();
      texSets.plaster.dispose();
      texSets.slats.dispose();
      texSets.stone.dispose();
      texSets.leaf.dispose();
      texSets.amberWash.dispose();
    };
  }, [texSets]);

  const mats = useMemo(() => {
    const walnutMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        map: texSets.walnut.map,
        bumpMap: texSets.walnut.bumpMap,
        bumpScale: 0.022,
        color: '#8f5f42',
        roughness: 0.44,
        metalness: 0.06,
      }),
      screenBounceUniforms,
    );

    const earthPlasterSpineMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        map: texSets.plaster.map,
        bumpMap: texSets.plaster.bumpMap,
        bumpScale: 0.025,
        color: '#b89f86',
        roughness: 0.94,
        metalness: 0.01,
      }),
      screenBounceUniforms,
    );

    const ceilingSlatCofferMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        map: texSets.slats.map,
        bumpMap: texSets.slats.bumpMap,
        bumpScale: 0.032,
        color: '#9b7256',
        roughness: 0.72,
        metalness: 0.04,
      }),
      screenBounceUniforms,
    );

    const darkVelvetProsceniumMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#060709',
        roughness: 0.98,
        metalness: 0.0,
      }),
      screenBounceUniforms,
    );

    const darkStoneStageMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        map: texSets.stone.map,
        bumpMap: texSets.stone.bumpMap,
        bumpScale: 0.016,
        color: '#888a90',
        roughness: 0.78,
        metalness: 0.05,
      }),
      screenBounceUniforms,
    );

    const bronzeLeafMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        map: texSets.leaf.map,
        bumpMap: texSets.leaf.bumpMap,
        bumpScale: 0.02,
        color: '#b8a974',
        roughness: 0.38,
        metalness: 0.56,
      }),
      screenBounceUniforms,
    );

    const ceilingAmberCoveMat = new THREE.MeshStandardMaterial({
      color: '#ffe0a3',
      emissive: '#ffaa44',
      emissiveIntensity: 0.14 + lightFactor * 1.9,
      roughness: 0.2,
      toneMapped: false,
    });

    const stageStepGlowMat = new THREE.MeshStandardMaterial({
      color: '#ffd28a',
      emissive: '#ffaa44',
      emissiveIntensity: 0.12 + lightFactor * 0.95,
      roughness: 0.35,
    });

    const pinpointMat = new THREE.MeshStandardMaterial({
      color: '#1b140d',
      emissive: '#ffecd1',
      emissiveIntensity: 0.08 + lightFactor * 2.2,
      roughness: 0.15,
      toneMapped: false,
    });

    const pinpointBezelMat = new THREE.MeshStandardMaterial({
      color: '#2c221b',
      roughness: 0.45,
      metalness: 0.4,
    });

    const walnutDoorMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        map: texSets.walnut.map,
        color: '#6b422a',
        roughness: 0.52,
        metalness: 0.05,
      }),
      screenBounceUniforms,
    );

    return {
      walnutMat,
      earthPlasterSpineMat,
      ceilingSlatCofferMat,
      darkVelvetProsceniumMat,
      darkStoneStageMat,
      bronzeLeafMat,
      ceilingAmberCoveMat,
      stageStepGlowMat,
      pinpointMat,
      pinpointBezelMat,
      walnutDoorMat,
    };
  }, [texSets, screenBounceUniforms, lightFactor]);

  useEffect(() => {
    mats.ceilingAmberCoveMat.emissiveIntensity = 0.14 + lightFactor * 1.9;
    mats.stageStepGlowMat.emissiveIntensity = 0.12 + lightFactor * 0.95;
    mats.pinpointMat.emissiveIntensity = 0.08 + lightFactor * 2.2;
  }, [mats, lightFactor]);

  useEffect(() => {
    return () => {
      Object.values(mats).forEach((m) => m.dispose());
    };
  }, [mats]);

  // Build sweeping symmetrical overhead walnut boughs, central earth-plaster spine, slat coffers, and curved proscenium + stone stage
  const ceilingStageGeos = useMemo(() => {
    const ribGeos: THREE.BufferGeometry[] = [];
    const coveGeos: THREE.BufferGeometry[] = [];
    const ceilingLeafPlacements: { pos: THREE.Vector3; rot: THREE.Euler; scale: number }[] = [];

    const halfW = W / 2 - 0.2;
    const ribCeilingY = H - 0.34;

    // 1. Sculpted central longitudinal spine of matte taupe earth-plaster + inner walnut border rails
    const spineGeo = new THREE.BoxGeometry(5.5, 0.14, L - 2.6);

    // Organic curved walnut canopy bough ribs springing symmetrically from every tree bay toward the central spine
    bays.forEach((bay) => {
      ([-1, 1] as const).forEach((side) => {
        const inSign = -side; // points toward x = 0

        // Primary main bough arching forward-inward across ceiling
        const mainPts = [
          new THREE.Vector3(side * (halfW - 0.12), H - 0.95, bay.bz),
          new THREE.Vector3(side * (halfW * 0.72), ribCeilingY - 0.08, bay.bz - 0.75),
          new THREE.Vector3(side * (halfW * 0.44), ribCeilingY, bay.bz - 1.35),
          new THREE.Vector3(side * 2.55, ribCeilingY + 0.04, bay.bz - 0.85),
          new THREE.Vector3(side * 1.95, ribCeilingY + 0.06, bay.bz - 0.1),
        ];
        const mainCurve = new THREE.CatmullRomCurve3(mainPts);
        ribGeos.push(
          buildTaperedSplineTubeGeometry(mainCurve, 28, 10, (t) => THREE.MathUtils.lerp(0.24, 0.09, t)),
        );
        const mainCovePts = mainPts.map(
          (p) => new THREE.Vector3(p.x + inSign * 0.06, p.y + 0.1, p.z + 0.06),
        );
        coveGeos.push(
          buildTaperedSplineTubeGeometry(new THREE.CatmullRomCurve3(mainCovePts), 24, 6, () => 0.025),
        );

        // Secondary sweeping bough arching rearward-inward to enclose sculpted leaf-petal ceiling coffers
        const rearPts = [
          new THREE.Vector3(side * (halfW - 0.12), H - 0.92, bay.bz),
          new THREE.Vector3(side * (halfW * 0.74), ribCeilingY - 0.06, bay.bz + 0.92),
          new THREE.Vector3(side * (halfW * 0.46), ribCeilingY + 0.02, bay.bz + 1.55),
          new THREE.Vector3(side * 2.65, ribCeilingY + 0.05, bay.bz + 1.1),
        ];
        const rearCurve = new THREE.CatmullRomCurve3(rearPts);
        ribGeos.push(
          buildTaperedSplineTubeGeometry(rearCurve, 24, 9, (t) => THREE.MathUtils.lerp(0.2, 0.075, t)),
        );
        const rearCovePts = rearPts.map(
          (p) => new THREE.Vector3(p.x + inSign * 0.06, p.y + 0.1, p.z - 0.06),
        );
        coveGeos.push(
          buildTaperedSplineTubeGeometry(new THREE.CatmullRomCurve3(rearCovePts), 22, 6, () => 0.022),
        );

        // Delicate cross-tendril linking mid-ceiling ribs
        const tendrilPts = [
          new THREE.Vector3(side * (halfW * 0.56), ribCeilingY, bay.bz - 0.9),
          new THREE.Vector3(side * (halfW * 0.42), ribCeilingY + 0.04, bay.bz),
          new THREE.Vector3(side * (halfW * 0.52), ribCeilingY, bay.bz + 0.95),
        ];
        const tendrilCurve = new THREE.CatmullRomCurve3(tendrilPts);
        ribGeos.push(
          buildTaperedSplineTubeGeometry(tendrilCurve, 16, 7, (t) => 0.085 - Math.sin(t * Math.PI) * 0.025),
        );

        // Place sculpted bronze ceiling leaves along ceiling ribs
        [0.42, 0.72].forEach((lt, li) => {
          const p = mainCurve.getPointAt(lt);
          ceilingLeafPlacements.push({
            pos: new THREE.Vector3(p.x, p.y - 0.05, p.z),
            rot: new THREE.Euler(Math.PI / 2 - 0.18, side * (0.4 + li * 0.3), side * 0.65),
            scale: 0.75 + li * 0.15,
          });
        });
      });
    });

    // Longitudinal outer ceiling edge walnut bough border framing side walls & ceiling transition
    ([-1, 1] as const).forEach((side) => {
      const borderCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * (halfW - 0.16), H - 0.82, zFront - 1.4),
        new THREE.Vector3(side * (halfW - 0.16), H - 0.82, 0),
        new THREE.Vector3(side * (halfW - 0.16), H - 0.82, zRear + 1.2),
      ]);
      ribGeos.push(
        buildTaperedSplineTubeGeometry(borderCurve, 28, 9, () => 0.19),
      );
      const borderCove = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * (halfW - 0.34), H - 0.74, zFront - 1.4),
        new THREE.Vector3(side * (halfW - 0.34), H - 0.74, 0),
        new THREE.Vector3(side * (halfW - 0.34), H - 0.74, zRear + 1.2),
      ]);
      coveGeos.push(
        buildTaperedSplineTubeGeometry(borderCove, 24, 6, () => 0.024),
      );
    });

    // Front arched walnut canopy arch framing the matte-black screen proscenium
    const prosceniumArchPts = [
      new THREE.Vector3(-(halfW - 0.15), 8.2, screenPosition[2] + 1.15),
      new THREE.Vector3(-(halfW * 0.82), H - 1.1, screenPosition[2] + 1.15),
      new THREE.Vector3(-(halfW * 0.38), H - 0.42, screenPosition[2] + 1.15),
      new THREE.Vector3(0, H - 0.34, screenPosition[2] + 1.15),
      new THREE.Vector3(halfW * 0.38, H - 0.42, screenPosition[2] + 1.15),
      new THREE.Vector3(halfW * 0.82, H - 1.1, screenPosition[2] + 1.15),
      new THREE.Vector3(halfW - 0.15, 8.2, screenPosition[2] + 1.15),
    ];
    const prosceniumArchCurve = new THREE.CatmullRomCurve3(prosceniumArchPts);
    ribGeos.push(
      buildTaperedSplineTubeGeometry(prosceniumArchCurve, 32, 10, () => 0.24),
    );
    const prosceniumCovePts = prosceniumArchPts.map((p) => new THREE.Vector3(p.x, p.y - 0.12, p.z + 0.12));
    coveGeos.push(
      buildTaperedSplineTubeGeometry(new THREE.CatmullRomCurve3(prosceniumCovePts), 28, 6, () => 0.024),
    );

    // 2. Semi-circular 2-step dark honed stone front stage riser (directly centered below the screen)
    const lowerStageGeo = new THREE.CylinderGeometry(1, 1, 0.17, 48, 1, false, 0, Math.PI);
    lowerStageGeo.rotateY(-Math.PI / 2);
    lowerStageGeo.scale(7.6, 1, 2.75);

    const upperStageGeo = new THREE.CylinderGeometry(1, 1, 0.18, 48, 1, false, 0, Math.PI);
    upperStageGeo.rotateY(-Math.PI / 2);
    upperStageGeo.scale(6.8, 1, 2.22);

    // Subtle warm amber under-tread arc strip along both semi-circular stage risers
    const lowerStepArc = new THREE.TorusGeometry(1, 0.015, 8, 48, Math.PI);
    lowerStepArc.rotateX(Math.PI / 2);
    lowerStepArc.scale(7.58, 1, 2.74);

    const upperStepArc = new THREE.TorusGeometry(1, 0.015, 8, 48, Math.PI);
    upperStepArc.rotateX(Math.PI / 2);
    upperStepArc.scale(6.78, 1, 2.21);

    // 3. Curved matte-black velvet wing curtains & valance framing the giant 1.90:1 IMAX screen
    const r = screenWidth / Math.max(0.05, screenCurvature);
    const screenEdgeZ = screenPosition[2] + r * (1 - Math.cos(screenCurvature / 2));
    const sideWingW = Math.max(1.2, (W - screenWidth) / 2 + 0.35);

    const leafGeo = buildSculptedBronzeLeafGeometry();

    return {
      spineGeo,
      ribGeos,
      coveGeos,
      ceilingLeafPlacements,
      leafGeo,
      lowerStageGeo,
      upperStageGeo,
      lowerStepArc,
      upperStepArc,
      screenEdgeZ,
      sideWingW,
    };
  }, [W, L, H, bays, zFront, zRear, screenPosition, screenWidth, screenCurvature]);

  useEffect(() => {
    return () => {
      ceilingStageGeos.spineGeo.dispose();
      ceilingStageGeos.ribGeos.forEach((g) => g.dispose());
      ceilingStageGeos.coveGeos.forEach((g) => g.dispose());
      ceilingStageGeos.leafGeo.dispose();
      ceilingStageGeos.lowerStageGeo.dispose();
      ceilingStageGeos.upperStageGeo.dispose();
      ceilingStageGeos.lowerStepArc.dispose();
      ceilingStageGeos.upperStepArc.dispose();
    };
  }, [ceilingStageGeos]);

  // Pinpoint ceiling downlight positions neatly aligned along outer margin of central earth-plaster spine
  const pinspotPositions = useMemo(() => {
    const pts: [number, number, number][] = [];
    const zCount = 5;
    for (let i = 0; i < zCount; i++) {
      const t = i / (zCount - 1);
      const pz = THREE.MathUtils.lerp(zFront + 1.2, zRear - 1.2, t);
      pts.push([-2.15, H - 0.29, pz]);
      pts.push([2.15, H - 0.29, pz]);
    }
    return pts;
  }, [H, zFront, zRear]);

  return (
    <group>
      {/* Recessed Dark Walnut Acoustic Wood-Slat Ceiling Coffers (Upper Ceiling Field Flanking Central Spine) */}
      {([-1, 1] as const).map((side) => (
        <mesh
          key={`ceil-slats-${side}`}
          position={[side * (W * 0.31), H - 0.2, 0]}
          material={mats.ceilingSlatCofferMat}
          receiveShadow
        >
          <boxGeometry args={[W * 0.38, 0.06, L - 1.8]} />
        </mesh>
      ))}

      {/* Central Longitudinal Matte Taupe Earth-Plaster Ceiling Spine */}
      <mesh
        position={[0, H - 0.22, 0]}
        geometry={ceilingStageGeos.spineGeo}
        material={mats.earthPlasterSpineMat}
        receiveShadow
      />

      {/* Sweeping Dark-Walnut Organic Canopy Ribs Arching Overhead */}
      {ceilingStageGeos.ribGeos.map((geo, ri) => (
        <mesh
          key={`ceil-rib-${ri}`}
          geometry={geo}
          material={mats.walnutMat}
          castShadow
          receiveShadow
        />
      ))}

      {/* Warm Amber-Gold Ceiling Backlit Cove Tubes Tracing Ceiling Ribs */}
      {ceilingStageGeos.coveGeos.map((geo, ci) => (
        <mesh key={`ceil-cove-${ci}`} geometry={geo} material={mats.ceilingAmberCoveMat} />
      ))}

      {/* Sculpted 3D Aged-Bronze Patina Leaves Along Ceiling Boughs */}
      {ceilingStageGeos.ceilingLeafPlacements.map((lp, li) => (
        <mesh
          key={`ceil-leaf-${li}`}
          position={lp.pos}
          rotation={lp.rot}
          scale={lp.scale}
          geometry={ceilingStageGeos.leafGeo}
          material={mats.bronzeLeafMat}
        />
      ))}

      {/* Dim Recessed Warm-White Pinpoint Ceiling Downlights (scaled cleanly with lightFactor) */}
      {pinspotPositions.map((pt, pi) => (
        <group key={`pinspot-${pi}`} position={pt}>
          <mesh rotation={[Math.PI / 2, 0, 0]} material={mats.pinpointBezelMat}>
            <ringGeometry args={[0.042, 0.082, 16]} />
          </mesh>
          <mesh position={[0, -0.004, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.pinpointMat}>
            <circleGeometry args={[0.042, 16]} />
          </mesh>
        </group>
      ))}

      {/* Matte-Black Velvet Screen Proscenium Frame, Wing Curtains & Sub-Screen Fascia */}
      <group>
        {/* Behind-screen dark acoustic baffle */}
        <mesh position={[0, H / 2, screenPosition[2] - 0.28]} material={mats.darkVelvetProsceniumMat}>
          <boxGeometry args={[W - 0.4, H - 0.2, 0.24]} />
        </mesh>

        {/* Left & Right Velvet Wing Masking Framing Curved Screen Edges */}
        {([-1, 1] as const).map((side) => (
          <mesh
            key={`tree-wing-${side}`}
            position={[
              side * (W / 2 - ceilingStageGeos.sideWingW * 0.5 - 0.12),
              H / 2,
              ceilingStageGeos.screenEdgeZ - 0.05,
            ]}
            material={mats.darkVelvetProsceniumMat}
            receiveShadow
          >
            <boxGeometry args={[ceilingStageGeos.sideWingW, H - 0.2, 0.42]} />
          </mesh>
        ))}

        {/* Upper Velvet Proscenium Header Valance Above Curved 1.90:1 Screen */}
        <mesh
          position={[
            0,
            H - Math.max(0.45, (H - (screenPosition[1] + screenHeight / 2)) * 0.5),
            ceilingStageGeos.screenEdgeZ - 0.02,
          ]}
          material={mats.darkVelvetProsceniumMat}
        >
          <boxGeometry
            args={[W - 0.4, Math.max(0.95, H - (screenPosition[1] + screenHeight / 2) + 0.18), 0.35]}
          />
        </mesh>

        {/* Lower Velvet Fascia Skirt Beneath Screen */}
        <mesh
          position={[0, Math.max(0.55, (screenPosition[1] - screenHeight / 2) * 0.5), screenPosition[2] + 0.22]}
          material={mats.darkVelvetProsceniumMat}
        >
          <boxGeometry args={[W - 0.4, Math.max(1.1, screenPosition[1] - screenHeight / 2 + 0.08), 0.3]} />
        </mesh>

        {/* Front Left & Right Walnut Acoustic Exit Doors with Glowing Green EXIT Signs */}
        {([-1, 1] as const).map((side) => (
          <group
            key={`tree-front-exit-${side}`}
            position={[side * (W / 2 - 0.92), 1.18, ceilingStageGeos.screenEdgeZ + 0.25]}
          >
            <mesh material={mats.walnutDoorMat}>
              <boxGeometry args={[0.98, 2.3, 0.08]} />
            </mesh>
            <mesh position={[side * -0.32, -0.06, 0.05]} material={mats.bronzeLeafMat}>
              <boxGeometry args={[0.14, 0.035, 0.03]} />
            </mesh>
            {exitSignMap && (
              <mesh position={[0, 1.34, 0.045]} material={undefined}>
                <planeGeometry args={[0.42, 0.16]} />
                <meshBasicMaterial map={exitSignMap} />
              </mesh>
            )}
          </group>
        ))}
      </group>

      {/* Semi-Circular 2-Step Dark Honed-Stone Front Stage Riser Centered Under Screen */}
      <group position={[0, 0, screenPosition[2] + 0.65]}>
        <mesh
          position={[0, 0.085, 0]}
          geometry={ceilingStageGeos.lowerStageGeo}
          material={mats.darkStoneStageMat}
          receiveShadow
        />
        <mesh
          position={[0, 0.26, 0]}
          geometry={ceilingStageGeos.upperStageGeo}
          material={mats.darkStoneStageMat}
          receiveShadow
        />
        <mesh
          position={[0, 0.172, 0]}
          geometry={ceilingStageGeos.lowerStepArc}
          material={mats.stageStepGlowMat}
        />
        <mesh
          position={[0, 0.352, 0]}
          geometry={ceilingStageGeos.upperStepArc}
          material={mats.stageStepGlowMat}
        />
      </group>
    </group>
  );
};
