import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { ShowState, TheaterConfiguration } from '../../types/cinema';
import { createScreenXSideStandbyTexture } from '../materials/proceduralTextures';

interface ScreenXSideWallsProps {
  config: TheaterConfiguration;
  activeTexRef: React.MutableRefObject<THREE.Texture>;
  standbyTexture: THREE.Texture;
  isVideoRef: React.MutableRefObject<boolean>;
  screenBrightnessRef: React.MutableRefObject<number>;
  uvRepeatRef: React.MutableRefObject<{ x: number; y: number }>;
  uvOffsetRef: React.MutableRefObject<{ x: number; y: number }>;
  scaleYRef: React.MutableRefObject<number>;
  wingStartMetersRef: React.MutableRefObject<number>;
  frontWidthRef: React.MutableRefObject<number>;
  fitRatioRef: React.MutableRefObject<number>;
  lightFactor: number;
  showState: ShowState;
}

interface SpinePoint {
  x: number;
  z: number;
  nx: number;
  nz: number;
  s: number;
}

function buildScreenXWallSpine(
  side: -1 | 1,
  flatHalfW: number,
  cornerRadius: number,
  frontSurfaceZ: number,
  sideEndZ: number,
  curveSegs = 24,
  straightSegs = 28,
): { points: SpinePoint[]; totalArcLen: number } {
  const points: SpinePoint[] = [];
  const halfSpanX = flatHalfW + cornerRadius;
  const cornerArcLen = cornerRadius * (Math.PI * 0.5);
  const straightStartZ = frontSurfaceZ + cornerRadius;
  const straightLen = Math.max(4, sideEndZ - straightStartZ);

  for (let i = 0; i <= curveSegs; i++) {
    const t = i / curveSegs;
    const theta = t * (Math.PI * 0.5);
    points.push({
      x: side * (flatHalfW + cornerRadius * Math.sin(theta)),
      z: frontSurfaceZ + cornerRadius * (1 - Math.cos(theta)),
      nx: -side * Math.sin(theta),
      nz: Math.cos(theta),
      s: cornerRadius * theta,
    });
  }

  for (let j = 1; j <= straightSegs; j++) {
    const frac = j / straightSegs;
    points.push({
      x: side * halfSpanX,
      z: straightStartZ + straightLen * frac,
      nx: -side,
      nz: 0,
      s: cornerArcLen + straightLen * frac,
    });
  }

  return {
    points,
    totalArcLen: cornerArcLen + straightLen,
  };
}

function buildCurvedWallSurfaceGeometry(
  spine: SpinePoint[],
  totalArcLen: number,
  side: -1 | 1,
  bottomY: number,
  topY: number,
  normalOffset = 0,
  segmentsY = 10,
): THREE.BufferGeometry {
  const geom = new THREE.BufferGeometry();
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const segS = spine.length - 1;
  const rowStride = spine.length;

  for (let iy = 0; iy <= segmentsY; iy++) {
    const v = iy / segmentsY;
    const y = THREE.MathUtils.lerp(bottomY, topY, v);
    for (let is = 0; is <= segS; is++) {
      const pt = spine[is];
      positions.push(pt.x + pt.nx * normalOffset, y, pt.z + pt.nz * normalOffset);
      normals.push(pt.nx, 0, pt.nz);
      uvs.push(pt.s / Math.max(totalArcLen, 1e-4), v);
    }
  }

  for (let iy = 0; iy < segmentsY; iy++) {
    for (let is = 0; is < segS; is++) {
      const a = iy * rowStride + is;
      const b = a + 1;
      const c = (iy + 1) * rowStride + is;
      const d = c + 1;
      if (side === -1) {
        indices.push(a, c, d);
        indices.push(a, d, b);
      } else {
        indices.push(a, b, d);
        indices.push(a, d, c);
      }
    }
  }

  geom.setIndex(indices);
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  return geom;
}

/**
 * Sweeps a closed 4-corner profile [inwardNormalOffset, worldY] along a ScreenX spine
 * with crisp per-face normals and a closed rear end cap.
 */
function buildSweptProfileRailGeometry(
  spine: SpinePoint[],
  side: -1 | 1,
  corners: [
    [number, number],
    [number, number],
    [number, number],
    [number, number],
  ],
): THREE.BufferGeometry {
  const geom = new THREE.BufferGeometry();
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const nPts = spine.length;
  const totalLen = Math.max(spine[nPts - 1]?.s ?? 1, 1e-4);

  const faceNormalDirs: Array<(pt: SpinePoint) => [number, number, number]> = [
    (pt) => [pt.nx, 0, pt.nz],
    () => [0, 1, 0],
    (pt) => [-pt.nx, 0, -pt.nz],
    () => [0, -1, 0],
  ];

  for (let f = 0; f < 4; f++) {
    const c0 = corners[f];
    const c1 = corners[(f + 1) % 4];
    const getNorm = faceNormalDirs[f];
    const baseVertex = positions.length / 3;

    for (let k = 0; k < 2; k++) {
      const [nOff, y] = k === 0 ? c0 : c1;
      for (let is = 0; is < nPts; is++) {
        const pt = spine[is];
        const [nx, ny, nz] = getNorm(pt);
        positions.push(pt.x + pt.nx * nOff, y, pt.z + pt.nz * nOff);
        normals.push(nx, ny, nz);
        uvs.push(pt.s / totalLen, k);
      }
    }

    for (let is = 0; is < nPts - 1; is++) {
      const a = baseVertex + is;
      const b = a + 1;
      const c = baseVertex + nPts + is;
      const d = c + 1;
      if (side === -1) {
        indices.push(a, c, d);
        indices.push(a, d, b);
      } else {
        indices.push(a, b, d);
        indices.push(a, d, c);
      }
    }
  }

  // Watertight rear end cap at spine tail (facing +Z)
  const tail = spine[nPts - 1];
  const capBase = positions.length / 3;
  for (let c = 0; c < 4; c++) {
    const [nOff, y] = corners[c];
    positions.push(tail.x + tail.nx * nOff, y, tail.z + tail.nz * nOff);
    normals.push(0, 0, 1);
    uvs.push(c === 0 || c === 1 ? 0 : 1, c === 1 || c === 2 ? 1 : 0);
  }
  if (side === -1) {
    indices.push(capBase, capBase + 1, capBase + 2);
    indices.push(capBase, capBase + 2, capBase + 3);
  } else {
    indices.push(capBase, capBase + 2, capBase + 1);
    indices.push(capBase, capBase + 3, capBase + 2);
  }

  geom.setIndex(indices);
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  return geom;
}

export const ScreenXSideWalls: React.FC<ScreenXSideWallsProps> = ({
  config,
  activeTexRef,
  standbyTexture,
  isVideoRef,
  screenBrightnessRef,
  uvRepeatRef,
  uvOffsetRef,
  scaleYRef,
  wingStartMetersRef,
  frontWidthRef,
  fitRatioRef,
  lightFactor,
  showState,
}) => {
  const {
    screenWidth,
    screenHeight,
    screenPosition,
    auditoriumLength,
    auditoriumHeight,
  } = config;

  const isSilverBaffles = config.sideLightStyle === 'screenx_silver_baffles';
  const frontSurfaceZ = screenPosition[2] + 0.028;
  const sideEndZ = isSilverBaffles
    ? frontSurfaceZ + (auditoriumLength - 0.6) * (2 / 3)
    : auditoriumLength / 2 - 2.65;
  const halfSpanX = screenWidth * 0.5;
  const cornerRadius = isSilverBaffles
    ? Math.min(0.42, screenWidth * 0.018)
    : Math.min(1.15, screenWidth * 0.06);
  const flatHalfW = halfSpanX - cornerRadius;
  const frontFlatWidth = flatHalfW * 2;
  const centerY = screenPosition[1];
  const screenBotY = centerY - screenHeight * 0.5;
  const screenTopY = centerY + screenHeight * 0.5;
  const borderHeight = 0.11;
  const lowerDadoTopY = Math.max(0.18, screenBotY - borderHeight);
  const upperFriezeBotY = screenTopY + borderHeight;
  const upperFriezeTopY = Math.max(upperFriezeBotY + 0.15, auditoriumHeight - 0.18);

  const leftMatRef = useRef<THREE.ShaderMaterial | null>(null);
  const rightMatRef = useRef<THREE.ShaderMaterial | null>(null);
  const showActiveBlendRef = useRef(0);

  const leftSideStandbyTexture = useMemo(
    () => createScreenXSideStandbyTexture(-1, isSilverBaffles),
    [isSilverBaffles],
  );
  const rightSideStandbyTexture = useMemo(
    () => createScreenXSideStandbyTexture(1, isSilverBaffles),
    [isSilverBaffles],
  );

  useEffect(() => {
    return () => {
      leftSideStandbyTexture.dispose();
      rightSideStandbyTexture.dispose();
    };
  }, [leftSideStandbyTexture, rightSideStandbyTexture]);

  const geometries = useMemo(() => {
    const leftSpine = buildScreenXWallSpine(-1, flatHalfW, cornerRadius, frontSurfaceZ, sideEndZ);
    const rightSpine = buildScreenXWallSpine(1, flatHalfW, cornerRadius, frontSurfaceZ, sideEndZ);

    const leftWallGeo = buildCurvedWallSurfaceGeometry(
      leftSpine.points,
      leftSpine.totalArcLen,
      -1,
      screenBotY,
      screenTopY,
      0,
      10,
    );
    const rightWallGeo = buildCurvedWallSurfaceGeometry(
      rightSpine.points,
      rightSpine.totalArcLen,
      1,
      screenBotY,
      screenTopY,
      0,
      10,
    );

    const leftBackingGeo = buildCurvedWallSurfaceGeometry(
      leftSpine.points,
      leftSpine.totalArcLen,
      -1,
      screenBotY - 0.05,
      screenTopY + 0.05,
      -0.022,
      2,
    );
    const rightBackingGeo = buildCurvedWallSurfaceGeometry(
      rightSpine.points,
      rightSpine.totalArcLen,
      1,
      screenBotY - 0.05,
      screenTopY + 0.05,
      -0.022,
      2,
    );

    const topProfile: [[number, number], [number, number], [number, number], [number, number]] = [
      [0.04, screenTopY],
      [0.04, screenTopY + borderHeight],
      [-0.04, screenTopY + borderHeight],
      [-0.04, screenTopY],
    ];
    const botProfile: [[number, number], [number, number], [number, number], [number, number]] = [
      [0.04, screenBotY - borderHeight],
      [0.04, screenBotY],
      [-0.04, screenBotY],
      [-0.04, screenBotY - borderHeight],
    ];
    const dadoProfile: [[number, number], [number, number], [number, number], [number, number]] = [
      [0.032, 0],
      [0.032, lowerDadoTopY],
      [-0.14, lowerDadoTopY],
      [-0.14, 0],
    ];
    const upperFriezeProfile: [[number, number], [number, number], [number, number], [number, number]] = [
      [0.032, upperFriezeBotY],
      [0.032, upperFriezeTopY],
      [-0.14, upperFriezeTopY],
      [-0.14, upperFriezeBotY],
    ];

    const leftTopTrimGeo = buildSweptProfileRailGeometry(leftSpine.points, -1, topProfile);
    const rightTopTrimGeo = buildSweptProfileRailGeometry(rightSpine.points, 1, topProfile);
    const leftBotTrimGeo = buildSweptProfileRailGeometry(leftSpine.points, -1, botProfile);
    const rightBotTrimGeo = buildSweptProfileRailGeometry(rightSpine.points, 1, botProfile);
    const leftDadoGeo = buildSweptProfileRailGeometry(leftSpine.points, -1, dadoProfile);
    const rightDadoGeo = buildSweptProfileRailGeometry(rightSpine.points, 1, dadoProfile);
    const leftUpperFriezeGeo = buildSweptProfileRailGeometry(leftSpine.points, -1, upperFriezeProfile);
    const rightUpperFriezeGeo = buildSweptProfileRailGeometry(rightSpine.points, 1, upperFriezeProfile);

    const rearEndCapGeo = new THREE.BoxGeometry(0.11, screenHeight + borderHeight * 2, 0.09);

    return {
      totalArcLen: leftSpine.totalArcLen,
      leftWallGeo,
      rightWallGeo,
      leftBackingGeo,
      rightBackingGeo,
      leftTopTrimGeo,
      rightTopTrimGeo,
      leftBotTrimGeo,
      rightBotTrimGeo,
      leftDadoGeo,
      rightDadoGeo,
      leftUpperFriezeGeo,
      rightUpperFriezeGeo,
      rearEndCapGeo,
    };
  }, [
    flatHalfW,
    cornerRadius,
    frontSurfaceZ,
    sideEndZ,
    screenBotY,
    screenTopY,
    borderHeight,
    lowerDadoTopY,
    upperFriezeBotY,
    upperFriezeTopY,
    screenHeight,
  ]);

  const trimMaterials = useMemo(() => {
    const titaniumBorderMat = new THREE.MeshStandardMaterial({
      color: '#0b0d12',
      roughness: 0.28,
      metalness: 0.86,
    });
    const darkBackingMat = new THREE.MeshBasicMaterial({
      color: '#020203',
    });
    const matteDadoMat = new THREE.MeshStandardMaterial({
      color: '#090b10',
      roughness: 0.9,
      metalness: 0.06,
    });
    return { titaniumBorderMat, darkBackingMat, matteDadoMat };
  }, []);

  const createSideShaderMaterial = (side: -1 | 1) =>
    new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: standbyTexture },
        uSideStandbyMap: { value: side === -1 ? leftSideStandbyTexture : rightSideStandbyTexture },
        uBrightness: { value: 0.34 },
        uRepeat: { value: new THREE.Vector2(1, 1) },
        uOffset: { value: new THREE.Vector2(0, 0) },
        uScaleY: { value: 1.0 },
        uIsVideo: { value: 0 },
        uSide: { value: side },
        uLightFactor: { value: 1.0 },
        uShowActive: { value: 0 },
        uTotalArcLen: { value: geometries.totalArcLen },
        uFrontWidth: { value: frontFlatWidth },
        uWingStartMeters: { value: 0 },
        uFitRatio: { value: 1.0 },
        uTime: { value: 0 },
        uIsSilverMatte: { value: isSilverBaffles ? 1 : 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D uMap;
        uniform sampler2D uSideStandbyMap;
        uniform float uBrightness;
        uniform vec2 uRepeat;
        uniform vec2 uOffset;
        uniform float uScaleY;
        uniform float uIsVideo;
        uniform float uSide;
        uniform float uLightFactor;
        uniform float uShowActive;
        uniform float uTotalArcLen;
        uniform float uFrontWidth;
        uniform float uWingStartMeters;
        uniform float uFitRatio;
        uniform float uTime;
        uniform float uIsSilverMatte;

        vec3 srgbToLinear(vec3 c) {
          vec3 lo = c / 12.92;
          vec3 hi = pow((max(c, vec3(1e-4)) + 0.055) / 1.055, vec3(2.4));
          return mix(lo, hi, step(vec3(0.04045), c));
        }

        vec3 linearToSrgb(vec3 c) {
          vec3 clamped = max(c, vec3(0.0));
          vec3 lo = clamped * 12.92;
          vec3 hi = 1.055 * pow(clamped, vec3(1.0 / 2.4)) - 0.055;
          return mix(lo, hi, step(vec3(0.0031308), clamped));
        }

        float mirrorCoord(float x) {
          float m = mod(x, 2.0);
          return m <= 1.0 ? m : 2.0 - m;
        }

        vec3 sampleRawVideo(vec2 uvCoord) {
          vec2 safeUv = vec2(
            clamp(mirrorCoord(uvCoord.x), 0.001, 0.999),
            clamp(uvCoord.y, 0.001, 0.999)
          );
          vec3 col = texture2D(uMap, safeUv).rgb;
          return uIsVideo > 0.5 ? srgbToLinear(col) : col;
        }

        vec3 sampleCrispWing(vec2 baseRawUv, float subtleRearFeather) {
          vec3 centerCol = sampleRawVideo(baseRawUv);
          if (subtleRearFeather <= 0.001) {
            return centerCol;
          }
          // Ultra-subtle optical edge anti-aliasing only on the far rear section (never blurry mud)
          float rx = subtleRearFeather * 0.0055;
          float ry = subtleRearFeather * 0.0025;
          vec3 tapH = sampleRawVideo(baseRawUv + vec2(-rx, 0.0)) + sampleRawVideo(baseRawUv + vec2(rx, 0.0));
          vec3 tapV = sampleRawVideo(baseRawUv + vec2(0.0, -ry)) + sampleRawVideo(baseRawUv + vec2(0.0, ry));
          return centerCol * 0.56 + (tapH + tapV) * 0.11;
        }

        void main() {
          // vUv.x = 0.0 at exact curved front seam -> 1.0 at rear end on BOTH walls
          float tFromFront = clamp(vUv.x, 0.0, 1.0);
          float sMeters = tFromFront * uTotalArcLen;

          // Subtle micro-perforated acoustically transparent canvas weave
          float microGridX = step(0.24, fract(sMeters * 26.0));
          float microGridY = step(0.24, fract(vUv.y * 190.0));
          float perforation = mix(0.978, 1.0, microGridX * microGridY);

          float verticalCentered = vUv.y - 0.5;
          float verticalMatch = 1.0 - (verticalCentered * verticalCentered) * 0.025;
          float cornerGain = 0.99375 * verticalMatch;

          // ------------------------------------------------------------------
          // 1. LIVE VIDEO 270-DEGREE PANORAMIC WING PROJECTION
          // ------------------------------------------------------------------
          float wingMeters = sMeters + uWingStartMeters;
          float nativeWidth = max(uFrontWidth * uFitRatio, 1.0);
          float wingNorm = wingMeters / nativeWidth;

          // C1 scale-matched rational perspective unwrap:
          // exact 1:1 du/ds across the curved corner, smoothly converging within outer <24.6% peripheral band
          float wingMax = 0.30;
          float panDist = (wingNorm * wingMax) / (wingMax + wingNorm);

          float rawU = uSide < 0.0
            ? (uOffset.x - panDist * uRepeat.x)
            : (uOffset.x + uRepeat.x + panDist * uRepeat.x);

          // Exact vertical letterbox alignment when uScaleY < 1.0
          float mappedY = (vUv.y - 0.5) / max(uScaleY, 0.1) + 0.5;
          float inFrameY = step(0.0, mappedY) * step(mappedY, 1.0);
          float rawV = clamp(mappedY, 0.0, 1.0) * uRepeat.y + uOffset.y;

          float subtleRearFeather = smoothstep(0.45, 1.0, tFromFront);
          vec3 wingVideoCol = sampleCrispWing(vec2(rawU, rawV), subtleRearFeather);

          // Bright, vivid cinema wing luminance matching the front screen cleanly
          float taperFloor = mix(0.62, 0.78, uIsSilverMatte);
          float fadeAmt = mix(0.34, 0.16, uIsSilverMatte);
          float rearLuminanceTaper = mix(cornerGain, taperFloor * verticalMatch, pow(tFromFront, 0.96));
          float rearEdgeFade = 1.0 - smoothstep(0.88, 1.0, tFromFront) * fadeAmt;
          vec3 blackLetterbox = vec3(0.0008);
          vec3 activeCol = mix(blackLetterbox, wingVideoCol, inFrameY);
          vec3 activeLinear = activeCol * rearLuminanceTaper * rearEdgeFade * uBrightness * perforation;

          // ------------------------------------------------------------------
          // 2. PRE-SHOW / STANDBY SIDE WALL PROJECTION OR MATTE SILVER-GREY FABRIC
          // ------------------------------------------------------------------
          vec3 sideTexLinear = texture2D(uSideStandbyMap, vec2(tFromFront, vUv.y)).rgb;
          float pulse = 0.94 + 0.06 * sin(uTime * 1.15 - sMeters * 0.25);
          float horizonBand = exp(-pow(abs(vUv.y - 0.5) / 0.12, 2.0));
          vec3 dynamicCyanShimmer = vec3(0.004, 0.036, 0.055) * horizonBand * (1.0 - tFromFront * 0.72) * pulse;
          vec3 standbyLinear = mix(
            (sideTexLinear + dynamicCyanShimmer) * uBrightness * cornerGain * perforation,
            sideTexLinear * mix(0.68, 1.0, uBrightness) * cornerGain * perforation,
            uIsSilverMatte
          );

          vec3 finalLinear = mix(standbyLinear, activeLinear, uShowActive);
          gl_FragColor = vec4(linearToSrgb(finalLinear), 1.0);
        }
      `,
      toneMapped: false,
    });

  const sideMaterials = useMemo(() => {
    const leftMat = createSideShaderMaterial(-1);
    const rightMat = createSideShaderMaterial(1);
    leftMatRef.current = leftMat;
    rightMatRef.current = rightMat;
    return { leftMat, rightMat };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [standbyTexture, leftSideStandbyTexture, rightSideStandbyTexture, geometries.totalArcLen, frontFlatWidth, isSilverBaffles]);

  useEffect(() => {
    return () => {
      geometries.leftWallGeo.dispose();
      geometries.rightWallGeo.dispose();
      geometries.leftBackingGeo.dispose();
      geometries.rightBackingGeo.dispose();
      geometries.leftTopTrimGeo.dispose();
      geometries.rightTopTrimGeo.dispose();
      geometries.leftBotTrimGeo.dispose();
      geometries.rightBotTrimGeo.dispose();
      geometries.leftDadoGeo.dispose();
      geometries.rightDadoGeo.dispose();
      geometries.leftUpperFriezeGeo.dispose();
      geometries.rightUpperFriezeGeo.dispose();
      geometries.rearEndCapGeo.dispose();
      Object.values(trimMaterials).forEach((m) => m.dispose());
      sideMaterials.leftMat.dispose();
      sideMaterials.rightMat.dispose();
      leftMatRef.current = null;
      rightMatRef.current = null;
    };
  }, [geometries, trimMaterials, sideMaterials]);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.25);
    const isVideo = isVideoRef.current;
    const tex = activeTexRef.current || standbyTexture;
    const targetShowActive = showState === 'SHOW_PLAYING' && isVideo ? 1.0 : 0.0;
    showActiveBlendRef.current = THREE.MathUtils.damp(
      showActiveBlendRef.current,
      targetShowActive,
      5.2,
      dt,
    );

    const rep = uvRepeatRef.current;
    const off = uvOffsetRef.current;
    const sy = isVideo ? scaleYRef.current : 1.0;
    const elapsed = clock.getElapsedTime();

    if (leftMatRef.current) {
      leftMatRef.current.uniforms.uSideStandbyMap.value = leftSideStandbyTexture;
    }
    if (rightMatRef.current) {
      rightMatRef.current.uniforms.uSideStandbyMap.value = rightSideStandbyTexture;
    }

    [leftMatRef.current, rightMatRef.current].forEach((mat) => {
      if (!mat) return;
      mat.uniforms.uMap.value = tex;
      mat.uniforms.uBrightness.value = screenBrightnessRef.current;
      mat.uniforms.uIsVideo.value = isVideo ? 1.0 : 0.0;
      mat.uniforms.uScaleY.value = sy;
      mat.uniforms.uLightFactor.value = lightFactor;
      mat.uniforms.uShowActive.value = showActiveBlendRef.current;
      mat.uniforms.uRepeat.value.set(isVideo ? rep.x : 1, isVideo ? rep.y : 1);
      mat.uniforms.uOffset.value.set(isVideo ? off.x : 0, isVideo ? off.y : 0);
      mat.uniforms.uWingStartMeters.value = isVideo ? wingStartMetersRef.current : 0;
      mat.uniforms.uFrontWidth.value = frontWidthRef.current;
      mat.uniforms.uFitRatio.value = isVideo ? fitRatioRef.current : 1.0;
      mat.uniforms.uTime.value = elapsed;
      mat.uniforms.uIsSilverMatte.value = isSilverBaffles ? 1.0 : 0.0;
    });
  });

  return (
    <group>
      {/* Curved-to-Straight Pure Black Lightproof Backing */}
      <mesh geometry={geometries.leftBackingGeo} material={trimMaterials.darkBackingMat} />
      <mesh geometry={geometries.rightBackingGeo} material={trimMaterials.darkBackingMat} />

      {/* Seamless Curved-Corner 270-Degree Projection Surfaces */}
      <mesh geometry={geometries.leftWallGeo} material={sideMaterials.leftMat} />
      <mesh geometry={geometries.rightWallGeo} material={sideMaterials.rightMat} />

      {/* Precision-Engineered Matte-Black Titanium Borders, Dados & End-Caps (Obsidian Panorama Only) */}
      {!isSilverBaffles && (
        <group>
          <mesh geometry={geometries.leftTopTrimGeo} material={trimMaterials.titaniumBorderMat} />
          <mesh geometry={geometries.rightTopTrimGeo} material={trimMaterials.titaniumBorderMat} />
          <mesh geometry={geometries.leftBotTrimGeo} material={trimMaterials.titaniumBorderMat} />
          <mesh geometry={geometries.rightBotTrimGeo} material={trimMaterials.titaniumBorderMat} />

          <mesh
            geometry={geometries.leftDadoGeo}
            material={trimMaterials.matteDadoMat}
            receiveShadow
          />
          <mesh
            geometry={geometries.rightDadoGeo}
            material={trimMaterials.matteDadoMat}
            receiveShadow
          />
          <mesh
            geometry={geometries.leftUpperFriezeGeo}
            material={trimMaterials.matteDadoMat}
            receiveShadow
          />
          <mesh
            geometry={geometries.rightUpperFriezeGeo}
            material={trimMaterials.matteDadoMat}
            receiveShadow
          />

          <mesh
            position={[-halfSpanX, centerY, sideEndZ + 0.035]}
            geometry={geometries.rearEndCapGeo}
            material={trimMaterials.titaniumBorderMat}
          />
          <mesh
            position={[halfSpanX, centerY, sideEndZ + 0.035]}
            geometry={geometries.rearEndCapGeo}
            material={trimMaterials.titaniumBorderMat}
          />
        </group>
      )}

      {/* Clean Razor-Thin Shadow Reveal Cap Separating Front 2/3 Silver Screen From Rear 1/3 Indigo Baffles */}
      {isSilverBaffles && (
        <group>
          <mesh
            position={[-halfSpanX - 0.015, centerY, sideEndZ + 0.035]}
            geometry={geometries.rearEndCapGeo}
            material={trimMaterials.darkBackingMat}
          />
          <mesh
            position={[halfSpanX + 0.015, centerY, sideEndZ + 0.035]}
            geometry={geometries.rearEndCapGeo}
            material={trimMaterials.darkBackingMat}
          />
        </group>
      )}
    </group>
  );
};
