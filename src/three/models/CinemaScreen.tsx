import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import {
  ScreenFramingMode,
  ShowState,
  TheaterConfiguration,
} from '../../types/cinema';
import { createStandbyScreenTexture } from '../materials/proceduralTextures';
import { ScreenBounceUniforms } from '../lighting/screenBounceShader';
import { isMobileDevice } from '../../utils/formatters';
import { IceSidePanels } from './IceSidePanels';
import { ScreenXSideWalls } from './ScreenXSideWalls';
import {
  BEACH_BIO_PROJECTOR_LENSES,
  BEACH_SUNSET_PROJECTOR_LENS,
} from './BeachEnvironment';
import {
  analyzeVideoFrameOptical,
  createFourDxMotionSpring,
  FourDxAudioTelemetry,
  FourDxLiveTelemetry,
  OpticalFrameAnalysis,
  SAMPLE_H,
  SAMPLE_PIXELS,
  SAMPLE_W,
  stepFourDxSeatPhysics,
} from './fourDxTelemetry';
import { cinemaAudioEngine } from '../../services/audio/cinemaAudioEngine';

export interface ScreenBounceSample {
  r: number;
  g: number;
  b: number;
  luminance: number;
}

interface CinemaScreenProps {
  config: TheaterConfiguration;
  videoElementA: HTMLVideoElement | null;
  videoElementB: HTMLVideoElement | null;
  activeDeck: 'A' | 'B';
  videoAspectRatio: number;
  screenFraming: ScreenFramingMode;
  showState: ShowState;
  isPaused?: boolean;
  isFullscreen?: boolean;
  isSoftwareGl?: boolean;
  screenBrightnessRef: React.MutableRefObject<number>;
  screenBounceRef?: React.MutableRefObject<ScreenBounceSample>;
  screenBounceUniforms?: ScreenBounceUniforms;
  lightFactor?: number;
  screenReflectionBrightness?: number;
  fourDxTelemetryRef?: React.MutableRefObject<FourDxLiveTelemetry>;
  fourDxActive?: boolean;
}

/**
 * Builds a cylindrical arc screen geometry facing +Z (toward the audience).
 * UV coordinates run 0..1 left-to-right from the audience's perspective.
 */
function buildCurvedScreenGeometry(
  width: number,
  height: number,
  arcAngle: number,
  segmentsX = 48,
  segmentsY = 12,
): THREE.BufferGeometry {
  if (arcAngle <= 0.01) {
    return new THREE.PlaneGeometry(width, height, 4, 4);
  }

  const radius = width / arcAngle;
  const geom = new THREE.BufferGeometry();
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let iy = 0; iy <= segmentsY; iy++) {
    const v = iy / segmentsY;
    const y = (v - 0.5) * height;
    for (let ix = 0; ix <= segmentsX; ix++) {
      const u = ix / segmentsX;
      const theta = (u - 0.5) * arcAngle;
      const x = Math.sin(theta) * radius;
      const z = radius - Math.cos(theta) * radius;
      positions.push(x, y, z);
      normals.push(-Math.sin(theta), 0, Math.cos(theta));
      uvs.push(u, v);
    }
  }

  const rowStride = segmentsX + 1;
  for (let iy = 0; iy < segmentsY; iy++) {
    for (let ix = 0; ix < segmentsX; ix++) {
      const a = iy * rowStride + ix;
      const b = a + 1;
      const c = (iy + 1) * rowStride + ix;
      const d = c + 1;
      indices.push(a, b, d);
      indices.push(a, d, c);
    }
  }

  geom.setIndex(indices);
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  return geom;
}

/**
 * Builds a realistic 3D rectangular volumetric projector beam frustum from the
 * projection booth lens directly to the four edges of the cinema screen.
 * Each vertex carries the corresponding screen UV so the volumetric rays match
 * the exact real-time video frame with zero randomness.
 */
function buildProjectorFrustumGeometry(
  lensPos: [number, number, number],
  screenPos: [number, number, number],
  screenWidth: number,
  screenHeight: number,
  innerScale = 1.0,
  baseLensHalfW = 0.19,
  baseLensHalfH = 0.11,
): THREE.BufferGeometry {
  const geom = new THREE.BufferGeometry();
  const positions: number[] = [];
  const uvs: number[] = [];
  const beamTs: number[] = [];
  const indices: number[] = [];

  const lensHalfW = baseLensHalfW * innerScale;
  const lensHalfH = baseLensHalfH * innerScale;
  const scrHalfW = (screenWidth * 0.5) * innerScale;
  const scrHalfH = (screenHeight * 0.5) * innerScale;

  // 4 corners in CCW order looking from audience toward screen:
  // 0: Bottom-Left (u=0,v=0), 1: Bottom-Right (u=1,v=0), 2: Top-Right (u=1,v=1), 3: Top-Left (u=0,v=1)
  const cornerSigns: [number, number, number, number][] = [
    [-1, -1, 0, 0],
    [1, -1, 1, 0],
    [1, 1, 1, 1],
    [-1, 1, 0, 1],
  ];

  const lengthSegs = 8;
  const sideSubdivs = 4;

  // Build 4 smooth frustum side panels (Bottom, Right, Top, Left)
  for (let side = 0; side < 4; side++) {
    const c0 = cornerSigns[side];
    const c1 = cornerSigns[(side + 1) % 4];
    const baseVertex = positions.length / 3;

    for (let it = 0; it <= lengthSegs; it++) {
      const t = it / lengthSegs;
      for (let is = 0; is <= sideSubdivs; is++) {
        const s = is / sideSubdivs;
        const sxSign = THREE.MathUtils.lerp(c0[0], c1[0], s);
        const sySign = THREE.MathUtils.lerp(c0[1], c1[1], s);
        const u = THREE.MathUtils.lerp(c0[2], c1[2], s);
        const v = THREE.MathUtils.lerp(c0[3], c1[3], s);

        const lx = lensPos[0] + sxSign * lensHalfW;
        const ly = lensPos[1] + sySign * lensHalfH;
        const lz = lensPos[2];

        const fx = screenPos[0] + sxSign * scrHalfW;
        const fy = screenPos[1] + sySign * scrHalfH;
        const fz = screenPos[2] + 0.04;

        positions.push(
          THREE.MathUtils.lerp(lx, fx, t),
          THREE.MathUtils.lerp(ly, fy, t),
          THREE.MathUtils.lerp(lz, fz, t),
        );
        uvs.push(u, v);
        beamTs.push(t);
      }
    }

    const stride = sideSubdivs + 1;
    for (let it = 0; it < lengthSegs; it++) {
      for (let is = 0; is < sideSubdivs; is++) {
        const a = baseVertex + it * stride + is;
        const b = a + 1;
        const c = a + stride;
        const d = c + 1;
        indices.push(a, b, d);
        indices.push(a, d, c);
      }
    }
  }

  geom.setIndex(indices);
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setAttribute('aBeamT', new THREE.Float32BufferAttribute(beamTs, 1));
  geom.computeVertexNormals();
  return geom;
}

export const CinemaScreen: React.FC<CinemaScreenProps> = ({
  config,
  videoElementA,
  videoElementB,
  activeDeck,
  videoAspectRatio,
  screenFraming,
  showState,
  isPaused = false,
  isFullscreen = false,
  isSoftwareGl = false,
  screenBrightnessRef,
  screenBounceRef,
  screenBounceUniforms,
  lightFactor = 1,
  screenReflectionBrightness = 1,
  fourDxTelemetryRef,
  fourDxActive = false,
}) => {
  const {
    screenWidth,
    screenHeight,
    screenCurvature,
    screenPosition,
    theaterName,
    auditoriumLength,
    auditoriumHeight,
    seatingRows,
    rowElevationStep,
    lightingProfile,
    supportsIcePanels,
    sideLightStyle,
  } = config;
  const isZeroStageImax =
    sideLightStyle === 'imax_cobalt_wave' ||
    sideLightStyle === 'aurora_ribbon_waves' ||
    sideLightStyle === 'horizon_tier_strips';
  const isCrimson4dx = sideLightStyle === 'crimson_velocity_4dx';
  const isArctic4dx = sideLightStyle === 'arctic_parametric_fins';
  const isThunder4dx = sideLightStyle === 'thunder_emerald_waves';
  const isExoskeleton4dx = sideLightStyle === 'exoskeleton_crimson_matrix_4dx';
  const isDolbyVeil = sideLightStyle === 'cobalt_veil_laser_recess';
  const isKakatiyaDolby = sideLightStyle === 'telugu_kakatiya_dolby';
  const isDeccanDolby = sideLightStyle === 'deccan_basalt_monsoon';
  const isDolbyFloating =
    sideLightStyle === 'obsidian_slat_grazers' ||
    sideLightStyle === 'diagonal_parabolic_ribs' ||
    isDolbyVeil ||
    isKakatiyaDolby ||
    isDeccanDolby;
  const isVolcanicCopper2d = sideLightStyle === 'volcanic_copper_ribbons';
  const isPrivateVolcanic = sideLightStyle === 'private_volcanic_copper_ribbons';
  const isPrivateChampagne = sideLightStyle === 'champagne_fluted_oak_alcoves';
  const isIceFlagship = sideLightStyle === 'ice_faceted_cyan';
  const isIceCobalt = sideLightStyle === 'ice_faceted_cobalt';
  const isIceAmber = sideLightStyle === 'ice_faceted_amber';
  const isIce = isIceFlagship || isIceCobalt || isIceAmber;
  const isScreenX =
    Boolean(config.supportsScreenX) ||
    config.environmentProfile.architectureStyle === 'screenx';
  const isFloatingFramelessScreenX = sideLightStyle === 'screenx_silver_baffles';
  const screenXCornerRadius = isScreenX
    ? isFloatingFramelessScreenX
      ? Math.min(0.42, screenWidth * 0.018)
      : Math.min(1.15, screenWidth * 0.06)
    : 0;
  const effectiveScreenWidth = isScreenX ? screenWidth - screenXCornerRadius * 2 : screenWidth;

  const isBeach = config.environmentProfile.architectureStyle === 'beach';
  const isBioluminescentBeach = config.theaterId === 'beach_bioluminescent';
  const surfaceMeshRef = useRef<THREE.Mesh>(null);
  const shaderMatRef = useRef<THREE.ShaderMaterial | null>(null);
  const outerBeamMatRef = useRef<THREE.ShaderMaterial | null>(null);
  const innerBeamMatRef = useRef<THREE.ShaderMaterial | null>(null);
  const lensFlareMatRef = useRef<THREE.ShaderMaterial | null>(null);
  const beachOuterBeamMatRef = useRef<THREE.ShaderMaterial | null>(null);
  const beachInnerBeamMatRef = useRef<THREE.ShaderMaterial | null>(null);

  const texARef = useRef<THREE.VideoTexture | null>(null);
  const texBRef = useRef<THREE.VideoTexture | null>(null);

  const lastVideoTimeRef = useRef(-1);
  const lastDecodedFramesRef = useRef(-1);
  const lastActiveTexRef = useRef<THREE.Texture | null>(null);
  const lastUploadMsRef = useRef(0);
  const lastSamplerMsRef = useRef(0);
  const lastRgbReadMsRef = useRef(0);
  const lastSamplerTexRef = useRef<THREE.Texture | null>(null);
  const uploadedDeckRef = useRef<{ A: boolean; B: boolean }>({ A: false, B: false });
  const lastVideoSrcByDeckRef = useRef<{ A: string; B: string }>({ A: '', B: '' });
  const currentBounceGainRef = useRef(0);
  const isVideoActiveRef = useRef(false);
  const isMobile = useMemo(() => isMobileDevice(), []);

  // Tiny pre-allocated 16x9 offscreen canvas for zero-stall real-time video RGB, luminance & 4DX optical analysis
  const rgbSamplerCanvas = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = SAMPLE_W;
    canvas.height = SAMPLE_H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    return ctx ? { canvas, ctx } : null;
  }, []);

  const prevOpticalRgbRef = useRef(new Float32Array(SAMPLE_PIXELS * 3));
  const hasPrevOpticalRef = useRef(false);
  const prevMeanLumRef = useRef(0);
  const opticalOutRef = useRef<OpticalFrameAnalysis>({
    motionEnergy: 0,
    panBias: 0,
    pitchBias: 0,
    fireScore: 0,
    fireCenterX: 0,
    rainScore: 0,
    snowScore: 0,
    windScore: 0,
    flashSpike: 0,
    meanLuminance: 0,
  });
  const audioOutRef = useRef<FourDxAudioTelemetry>({
    active: false,
    subBass: 0,
    bass: 0,
    mid: 0,
    high: 0,
    transient: 0,
    rms: 0,
  });
  const fourDxSpringRef = useRef(createFourDxMotionSpring());

  const standbyTexture = useMemo(
    () =>
      createStandbyScreenTexture(
        theaterName,
        config.environmentProfile.architectureStyle,
        sideLightStyle,
      ),
    [theaterName, config.environmentProfile.architectureStyle, sideLightStyle],
  );
  const activeTexRef = useRef<THREE.Texture>(standbyTexture);
  const uvRepeatRef = useRef({ x: 1, y: 1 });
  const uvOffsetRef = useRef({ x: 0, y: 0 });
  const scaleYRef = useRef(1);
  const wingStartMetersRef = useRef(0);
  const frontWidthRef = useRef(effectiveScreenWidth);
  const fitRatioRef = useRef(1);

  useEffect(() => {
    activeTexRef.current = standbyTexture;
    return () => {
      standbyTexture.dispose();
    };
  }, [standbyTexture]);

  // Reset frame-upload cache on fullscreen/resize so the next render always uploads fresh video pixels
  useEffect(() => {
    const invalidateUpload = () => {
      lastVideoTimeRef.current = -1;
      lastDecodedFramesRef.current = -1;
      lastUploadMsRef.current = 0;
      lastSamplerMsRef.current = 0;
    };
    document.addEventListener('fullscreenchange', invalidateUpload);
    window.addEventListener('resize', invalidateUpload);
    return () => {
      document.removeEventListener('fullscreenchange', invalidateUpload);
      window.removeEventListener('resize', invalidateUpload);
    };
  }, []);

  // Tiny 32x18 GPU RenderTarget + 9-tap filtered downsample pass for zero-stall real-time video reflections
  const gpuLightSampler = useMemo(() => {
    const rt = new THREE.WebGLRenderTarget(32, 18, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      depthBuffer: false,
      stencilBuffer: false,
      generateMipmaps: false,
    });
    rt.texture.colorSpace = THREE.NoColorSpace;
    rt.texture.wrapS = THREE.ClampToEdgeWrapping;
    rt.texture.wrapT = THREE.ClampToEdgeWrapping;

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: standbyTexture },
        uRepeat: { value: new THREE.Vector2(1, 1) },
        uOffset: { value: new THREE.Vector2(0, 0) },
        uIsVideo: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D uMap;
        uniform vec2 uRepeat;
        uniform vec2 uOffset;
        uniform float uIsVideo;

        vec3 srgbToLinear(vec3 c) {
          vec3 safeC = max(c, vec3(1e-4));
          vec3 lo = c / 12.92;
          vec3 hi = pow((safeC + 0.055) / 1.055, vec3(2.4));
          return mix(lo, hi, step(vec3(0.04045), c));
        }

        vec3 sampleScreen(vec2 uvCoord) {
          vec2 mapped = clamp(uvCoord * uRepeat + uOffset, 0.002, 0.998);
          vec3 col = texture2D(uMap, mapped).rgb;
          return uIsVideo > 0.5 ? srgbToLinear(col) : col;
        }

        void main() {
          // 9-tap box blur across each screen cell for silky area-light irradiance
          vec2 stepUv = vec2(0.025, 0.042);
          vec3 acc = vec3(0.0);
          for (int y = -1; y <= 1; y++) {
            for (int x = -1; x <= 1; x++) {
              acc += sampleScreen(vUv + vec2(float(x), float(y)) * stepUv);
            }
          }
          vec3 linearAvg = acc / 9.0;
          // Encode gamma 2.2 into UnsignedByte RenderTarget to preserve dark-scene precision
          vec3 encoded = pow(clamp(linearAvg, vec3(1e-4), vec3(1.0)), vec3(1.0 / 2.2));
          gl_FragColor = vec4(encoded, 1.0);
        }
      `,
      toneMapped: false,
      depthTest: false,
      depthWrite: false,
    });

    const geo = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geo, mat);
    const scene = new THREE.Scene();
    scene.add(mesh);
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    return { rt, mat, geo, scene, camera };
  }, [standbyTexture]);

  useEffect(() => {
    if (screenBounceUniforms) {
      screenBounceUniforms.uScreenLightTex.value = gpuLightSampler.rt.texture;
    }
    return () => {
      gpuLightSampler.geo.dispose();
      gpuLightSampler.mat.dispose();
      gpuLightSampler.rt.dispose();
    };
  }, [gpuLightSampler, screenBounceUniforms]);

  useEffect(() => {
    if (!videoElementA) {
      texARef.current?.dispose();
      texARef.current = null;
      return;
    }
    const tex = new THREE.VideoTexture(videoElementA);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    texARef.current = tex;
    uploadedDeckRef.current.A = false;

    return () => {
      uploadedDeckRef.current.A = false;
      tex.dispose();
      if (texARef.current === tex) texARef.current = null;
    };
  }, [videoElementA]);

  useEffect(() => {
    if (!videoElementB) {
      texBRef.current?.dispose();
      texBRef.current = null;
      return;
    }
    const tex = new THREE.VideoTexture(videoElementB);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    texBRef.current = tex;
    uploadedDeckRef.current.B = false;

    return () => {
      uploadedDeckRef.current.B = false;
      tex.dispose();
      if (texBRef.current === tex) texBRef.current = null;
    };
  }, [videoElementB]);

  const outerFrameGeo = useMemo(
    () =>
      buildCurvedScreenGeometry(
        screenWidth +
          (isDolbyFloating
            ? 0.04
            : isIceFlagship
              ? 0.09
              : isZeroStageImax || isIceCobalt
                ? 0.14
                : isIceAmber
                  ? 0.16
                  : isVolcanicCopper2d
                    ? 0.36
                    : isPrivateChampagne || isPrivateVolcanic
                      ? 0.28
                      : 0.56),
        screenHeight +
          (isDolbyFloating
            ? 0.04
            : isIceFlagship
              ? 0.06
              : isZeroStageImax || isIceCobalt
                ? 0.1
                : isIceAmber
                  ? 0.12
                  : isVolcanicCopper2d
                    ? 0.32
                    : isPrivateChampagne || isPrivateVolcanic
                      ? 0.24
                      : 0.46),
        screenCurvature,
        48,
        4,
      ),
    [screenWidth, screenHeight, screenCurvature, isZeroStageImax, isDolbyFloating, isIceFlagship, isIceCobalt, isIceAmber, isVolcanicCopper2d, isPrivateVolcanic, isPrivateChampagne],
  );

  const velvetMaskGeo = useMemo(
    () =>
      buildCurvedScreenGeometry(
        screenWidth + (isDolbyFloating ? 0.02 : isIceFlagship ? 0.045 : isZeroStageImax || isIceCobalt ? 0.08 : isIceAmber ? 0.1 : isPrivateChampagne || isPrivateVolcanic ? 0.09 : 0.3),
        screenHeight + (isDolbyFloating ? 0.02 : isIceFlagship ? 0.035 : isZeroStageImax || isIceCobalt ? 0.06 : isIceAmber ? 0.08 : isPrivateChampagne || isPrivateVolcanic ? 0.07 : 0.24),
        screenCurvature,
        48,
        4,
      ),
    [screenWidth, screenHeight, screenCurvature, isZeroStageImax, isDolbyFloating, isIceFlagship, isIceCobalt, isIceAmber, isPrivateChampagne, isPrivateVolcanic],
  );

  const brassTrimGeo = useMemo(
    () =>
      isPrivateChampagne || isPrivateVolcanic
        ? buildCurvedScreenGeometry(screenWidth + 0.175, screenHeight + 0.175, screenCurvature, 48, 4)
        : null,
    [isPrivateChampagne, isPrivateVolcanic, screenWidth, screenHeight, screenCurvature],
  );

  const screenGeo = useMemo(
    () => buildCurvedScreenGeometry(effectiveScreenWidth, screenHeight, screenCurvature, 48, 12),
    [effectiveScreenWidth, screenHeight, screenCurvature],
  );

  const silverBezelGeo = useMemo(
    () =>
      isThunder4dx || isCrimson4dx
        ? buildCurvedScreenGeometry(screenWidth + 0.06, screenHeight + 0.06, screenCurvature, 48, 4)
        : null,
    [isThunder4dx, isCrimson4dx, screenWidth, screenHeight, screenCurvature],
  );

  useEffect(() => {
    return () => {
      outerFrameGeo.dispose();
      velvetMaskGeo.dispose();
      brassTrimGeo?.dispose();
      screenGeo.dispose();
      silverBezelGeo?.dispose();
    };
  }, [outerFrameGeo, velvetMaskGeo, brassTrimGeo, screenGeo, silverBezelGeo]);

  // Projector booth lens origin coordinates aligned directly with the 3D booth glass & projector lens
  const boothLensPos = useMemo<[number, number, number]>(() => {
    const topTierY = (seatingRows - 1) * rowElevationStep;
    const isIce = config.environmentProfile.architectureStyle === 'ice';
    const boothY = isIce
      ? Math.min(auditoriumHeight - 1.65, Math.max(10.35, topTierY + 5.6))
      : Math.min(auditoriumHeight - 1.4, topTierY + 3.25);
    const boothZ = auditoriumLength / 2 - 0.04;
    return [0, boothY, boothZ];
  }, [auditoriumHeight, auditoriumLength, seatingRows, rowElevationStep, config.environmentProfile.architectureStyle]);

  const screenAspect = effectiveScreenWidth / screenHeight;
  const safeVideoAspect = videoAspectRatio > 0.1 ? videoAspectRatio : screenAspect;

  const {
    scaleX,
    scaleY,
    uvRepeatX,
    uvRepeatY,
    uvOffsetX,
    uvOffsetY,
    screenXFitRatio,
    screenXWingStartMeters,
  } = useMemo(() => {
    if (screenFraming === 'fill') {
      if (Math.abs(safeVideoAspect - screenAspect) < 0.03) {
        return {
          scaleX: 1,
          scaleY: 1,
          uvRepeatX: 1,
          uvRepeatY: 1,
          uvOffsetX: 0,
          uvOffsetY: 0,
          screenXFitRatio: 1,
          screenXWingStartMeters: 0,
        };
      }
      if (safeVideoAspect > screenAspect) {
        const repX = screenAspect / safeVideoAspect;
        return {
          scaleX: 1,
          scaleY: 1,
          uvRepeatX: repX,
          uvRepeatY: 1,
          uvOffsetX: (1 - repX) / 2,
          uvOffsetY: 0,
          screenXFitRatio: 1,
          screenXWingStartMeters: 0,
        };
      } else {
        const repY = safeVideoAspect / screenAspect;
        return {
          scaleX: 1,
          scaleY: 1,
          uvRepeatX: 1,
          uvRepeatY: repY,
          uvOffsetX: 0,
          uvOffsetY: (1 - repY) / 2,
          screenXFitRatio: 1,
          screenXWingStartMeters: 0,
        };
      }
    }

    if (Math.abs(safeVideoAspect - screenAspect) < 0.02) {
      return {
        scaleX: 1,
        scaleY: 1,
        uvRepeatX: 1,
        uvRepeatY: 1,
        uvOffsetX: 0,
        uvOffsetY: 0,
        screenXFitRatio: 1,
        screenXWingStartMeters: 0,
      };
    }
    if (safeVideoAspect > screenAspect) {
      return {
        scaleX: 1,
        scaleY: screenAspect / safeVideoAspect,
        uvRepeatX: 1,
        uvRepeatY: 1,
        uvOffsetX: 0,
        uvOffsetY: 0,
        screenXFitRatio: 1,
        screenXWingStartMeters: 0,
      };
    }
    if (isScreenX) {
      const fitRatio = THREE.MathUtils.clamp(safeVideoAspect / screenAspect, 0.25, 1);
      return {
        scaleX: 1,
        scaleY: 1,
        uvRepeatX: 1,
        uvRepeatY: 1,
        uvOffsetX: 0,
        uvOffsetY: 0,
        screenXFitRatio: fitRatio,
        screenXWingStartMeters: 0.5 * (1 - fitRatio) * effectiveScreenWidth,
      };
    }
    return {
      scaleX: safeVideoAspect / screenAspect,
      scaleY: 1,
      uvRepeatX: 1,
      uvRepeatY: 1,
      uvOffsetX: 0,
      uvOffsetY: 0,
      screenXFitRatio: 1,
      screenXWingStartMeters: 0,
    };
  }, [screenFraming, safeVideoAspect, screenAspect, isScreenX, effectiveScreenWidth]);

  // Dual volumetric frustum geometries (outer atmospheric cone + inner concentrated ray core)
  const outerBeamGeo = useMemo(
    () =>
      buildProjectorFrustumGeometry(
        boothLensPos,
        screenPosition,
        effectiveScreenWidth * scaleX,
        screenHeight * scaleY,
        1.0,
      ),
    [boothLensPos, screenPosition, effectiveScreenWidth, screenHeight, scaleX, scaleY],
  );

  const innerBeamGeo = useMemo(
    () =>
      buildProjectorFrustumGeometry(
        boothLensPos,
        screenPosition,
        effectiveScreenWidth * scaleX,
        screenHeight * scaleY,
        0.62,
      ),
    [boothLensPos, screenPosition, effectiveScreenWidth, screenHeight, scaleX, scaleY],
  );

  const createBeamMaterial = (edgePow: number) =>
    new THREE.ShaderMaterial({
      uniforms: {
        uScreenLightTex: { value: gpuLightSampler.rt.texture },
        uOpacity: { value: 0 },
      },
      vertexShader: `
        attribute float aBeamT;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewPos;
        varying float vBeamT;
        void main() {
          vUv = uv;
          vBeamT = aBeamT;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vViewPos = -mvPos.xyz;
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewPos;
        varying float vBeamT;
        uniform sampler2D uScreenLightTex;
        uniform float uOpacity;
        void main() {
          // Sample live video light map directly at the ray's exact screen coordinate (no randomness)
          vec3 enc = texture2D(uScreenLightTex, clamp(vUv, 0.02, 0.98)).rgb;
          vec3 beamCol = pow(max(enc, vec3(1e-4)), vec3(2.2));
          float lum = dot(beamCol, vec3(0.2126, 0.7152, 0.0722));
          if (lum < 0.002) discard;

          vec3 viewDir = normalize(vViewPos);
          float fresnel = pow(abs(dot(normalize(vNormal), viewDir)), ${edgePow.toFixed(2)});
          // Calibrated atmospheric dusty beam exiting booth lens, tapering softly toward screen
          float distFade = smoothstep(0.0, 0.08, vBeamT) * mix(0.92, 0.18, pow(vBeamT, 0.62));
          float alpha = fresnel * distFade * uOpacity * (0.24 + min(lum * 0.85, 0.68));
          gl_FragColor = vec4(beamCol * 1.15, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });

  const outerBeamMaterial = useMemo(() => {
    const mat = createBeamMaterial(1.55);
    outerBeamMatRef.current = mat;
    return mat;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gpuLightSampler]);

  const innerBeamMaterial = useMemo(() => {
    const mat = createBeamMaterial(1.3);
    innerBeamMatRef.current = mat;
    return mat;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gpuLightSampler]);

  const lensFlareMaterial = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uScreenLightTex: { value: gpuLightSampler.rt.texture },
        uOpacity: { value: 0 },
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
        uniform sampler2D uScreenLightTex;
        uniform float uOpacity;
        void main() {
          vec3 c1 = pow(max(texture2D(uScreenLightTex, vec2(0.35, 0.5)).rgb, vec3(1e-4)), vec3(2.2));
          vec3 c2 = pow(max(texture2D(uScreenLightTex, vec2(0.65, 0.5)).rgb, vec3(1e-4)), vec3(2.2));
          vec3 col = (c1 + c2) * 0.5;
          float d = distance(vUv, vec2(0.5)) * 2.0;
          float glow = pow(max(0.0, 1.0 - d), 3.0);
          gl_FragColor = vec4(col * 0.95, glow * uOpacity);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    lensFlareMatRef.current = mat;
    return mat;
  }, [gpuLightSampler]);

  useEffect(() => {
    return () => {
      outerBeamGeo.dispose();
      innerBeamGeo.dispose();
      outerBeamMaterial.dispose();
      innerBeamMaterial.dispose();
      lensFlareMaterial.dispose();
    };
  }, [outerBeamGeo, innerBeamGeo, outerBeamMaterial, innerBeamMaterial, lensFlareMaterial]);

  // Outdoor Beach Theater real-time video-mapped rectangular projector frustums (per-pixel synced to playing movie)
  const beachLensOrigins = useMemo<[number, number, number][]>(() => {
    if (!isBeach) return [];
    if (isBioluminescentBeach) {
      return [
        [...BEACH_BIO_PROJECTOR_LENSES[0]],
        [...BEACH_BIO_PROJECTOR_LENSES[1]],
      ];
    }
    return [[...BEACH_SUNSET_PROJECTOR_LENS]];
  }, [isBeach, isBioluminescentBeach]);

  const beachBeamAssets = useMemo(() => {
    if (!isBeach || beachLensOrigins.length === 0) return null;

    const frustums = beachLensOrigins.map((origin) => ({
      origin,
      outerGeo: buildProjectorFrustumGeometry(
        origin,
        screenPosition,
        effectiveScreenWidth * scaleX,
        screenHeight * scaleY,
        1.0,
        0.072,
        0.05,
      ),
      innerGeo: buildProjectorFrustumGeometry(
        origin,
        screenPosition,
        effectiveScreenWidth * scaleX,
        screenHeight * scaleY,
        0.64,
        0.072,
        0.05,
      ),
    }));

    return { frustums };
  }, [
    isBeach,
    beachLensOrigins,
    screenPosition,
    effectiveScreenWidth,
    screenHeight,
    scaleX,
    scaleY,
  ]);

  const beachOuterBeamMaterial = useMemo(() => {
    const mat = createBeamMaterial(1.55);
    beachOuterBeamMatRef.current = mat;
    return mat;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gpuLightSampler]);

  const beachInnerBeamMaterial = useMemo(() => {
    const mat = createBeamMaterial(1.3);
    beachInnerBeamMatRef.current = mat;
    return mat;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gpuLightSampler]);

  useEffect(() => {
    return () => {
      if (beachBeamAssets) {
        beachBeamAssets.frustums.forEach((f) => {
          f.outerGeo.dispose();
          f.innerGeo.dispose();
        });
      }
    };
  }, [beachBeamAssets]);

  useEffect(() => {
    return () => {
      beachOuterBeamMaterial.dispose();
      beachInnerBeamMaterial.dispose();
    };
  }, [beachOuterBeamMaterial, beachInnerBeamMaterial]);

  // Unified cinema projection shader (exact sRGB decode + optical lens uniformity + optional inverse-ACES HDR calibration)
  const screenShaderMaterial = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: standbyTexture },
        uBrightness: { value: 0.34 },
        uRepeat: { value: new THREE.Vector2(1, 1) },
        uOffset: { value: new THREE.Vector2(0, 0) },
        uIsVideo: { value: 0 },
        uScreenXFitRatio: { value: 1.0 },
        uScreenXFrontWidth: { value: effectiveScreenWidth },
        uHdrBloomMode: { value: isBioluminescentBeach && !isSoftwareGl ? 1.0 : 0.0 },
        uToneMappingExposure: { value: 1.05 },
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
        uniform float uBrightness;
        uniform vec2 uRepeat;
        uniform vec2 uOffset;
        uniform float uIsVideo;
        uniform float uScreenXFitRatio;
        uniform float uScreenXFrontWidth;
        uniform float uHdrBloomMode;
        uniform float uToneMappingExposure;

        vec3 srgbToLinear(vec3 c) {
          vec3 lo = c / 12.92;
          vec3 hi = pow((c + 0.055) / 1.055, vec3(2.4));
          return mix(lo, hi, step(vec3(0.04045), c));
        }

        vec3 linearToSrgb(vec3 c) {
          vec3 clamped = max(c, vec3(0.0));
          vec3 lo = clamped * 12.92;
          vec3 hi = 1.055 * pow(clamped, vec3(1.0 / 2.4)) - 0.055;
          return mix(lo, hi, step(vec3(0.0031308), clamped));
        }

        // Analytic inverse of Three.js ACESFilmicToneMapping RRT+ODT curve, capped strictly below UnrealBloom threshold (2.18)
        vec3 inverseACESFilmic(vec3 y) {
          vec3 yc = clamp(y, vec3(0.0), vec3(0.965));
          vec3 A = vec3(2.51);
          vec3 B = vec3(0.03);
          vec3 C = vec3(2.43);
          vec3 D = vec3(0.59);
          vec3 E = vec3(0.14);
          vec3 a = C * yc - A;
          vec3 b = D * yc - B;
          vec3 c = E * yc;
          vec3 disc = max(b * b - 4.0 * a * c, vec3(0.0));
          vec3 x = (-b - sqrt(disc)) / min(2.0 * a, vec3(-1e-4));
          // Undo Three.js pre-curve 0.6 scale + renderer exposure
          vec3 lin = max(x / (0.6 * max(uToneMappingExposure, 0.1)), vec3(0.0));
          return min(lin, vec3(2.11));
        }

        float mirrorCoord(float x) {
          float m = mod(x, 2.0);
          return m <= 1.0 ? m : 2.0 - m;
        }

        vec3 sampleScreenXWing(float rawU, float rawV) {
          vec2 safeUv = vec2(clamp(mirrorCoord(rawU), 0.001, 0.999), clamp(rawV, 0.001, 0.999));
          return srgbToLinear(texture2D(uMap, safeUv).rgb);
        }

        void main() {
          vec3 linearRgb;
          if (uIsVideo > 0.5 && uScreenXFitRatio < 0.999) {
            float halfFit = 0.5 * uScreenXFitRatio;
            float dx = vUv.x - 0.5;
            if (abs(dx) <= halfFit) {
              float centerU = 0.5 + dx / uScreenXFitRatio;
              vec2 mappedUv = vec2(centerU, vUv.y) * uRepeat + uOffset;
              linearRgb = srgbToLinear(texture2D(uMap, mappedUv).rgb);
            } else {
              float wingMeters = (abs(dx) - halfFit) * uScreenXFrontWidth;
              float nativeWidth = max(uScreenXFrontWidth * uScreenXFitRatio, 1.0);
              float wingNorm = wingMeters / nativeWidth;
              float wingMax = 0.30;
              float panDist = (wingNorm * wingMax) / (wingMax + wingNorm);
              float rawU = dx < 0.0
                ? (uOffset.x - panDist * uRepeat.x)
                : (uOffset.x + uRepeat.x + panDist * uRepeat.x);
              float rawV = vUv.y * uRepeat.y + uOffset.y;
              linearRgb = sampleScreenXWing(rawU, rawV);
            }
          } else {
            vec2 mappedUv = vUv * uRepeat + uOffset;
            vec4 tex = texture2D(uMap, mappedUv);
            linearRgb = uIsVideo > 0.5 ? srgbToLinear(tex.rgb) : tex.rgb;
          }

          vec2 centered = vUv - 0.5;
          float radial = dot(centered, centered);
          float projectorFalloff = 1.0 - radial * 0.025;

          vec3 finalCol = linearRgb * uBrightness * projectorFalloff;
          if (uHdrBloomMode > 0.5) {
            // Convert target sRGB appearance through inverse ACES so OutputPass reproduces exact cinema image with zero bloom halo
            vec3 desiredSrgb = linearToSrgb(finalCol);
            gl_FragColor = vec4(inverseACESFilmic(desiredSrgb), 1.0);
          } else {
            gl_FragColor = vec4(linearToSrgb(finalCol), 1.0);
          }
        }
      `,
      toneMapped: false,
    });
    shaderMatRef.current = mat;
    return mat;
  }, [standbyTexture, effectiveScreenWidth, isBioluminescentBeach, isSoftwareGl]);

  useEffect(() => {
    return () => {
      screenShaderMaterial.dispose();
    };
  }, [screenShaderMaterial]);

  useFrame(({ gl }, delta) => {
    const dt = Math.min(delta, 0.25);
    const targetBrightness =
      showState === 'AUDITORIUM_OPEN'
        ? isFloatingFramelessScreenX
          ? 0.72
          : isScreenX
            ? 0.56
            : isDeccanDolby
              ? 0.86
              : 0.34
        : showState === 'SHOW_STARTING'
          ? 0.62
          : showState === 'SHOW_PLAYING'
            ? isPaused
              ? 0.84
              : 1.0
            : 0.12;

    screenBrightnessRef.current = THREE.MathUtils.damp(
      screenBrightnessRef.current,
      targetBrightness,
      2.6,
      dt,
    );

    const currentEl = activeDeck === 'A' ? videoElementA : videoElementB;
    const currentTex = activeDeck === 'A' ? texARef.current : texBRef.current;
    const backupTex = activeDeck === 'A' ? texBRef.current : texARef.current;
    const backupEl = activeDeck === 'A' ? videoElementB : videoElementA;
    const standbyKey: 'A' | 'B' = activeDeck === 'A' ? 'B' : 'A';

    // Detect playlist item switch on the same <video> deck (e.g. mobile single-deck With Ads queue)
    const activeSrcStr = currentEl?.currentSrc || currentEl?.src || '';
    if (activeSrcStr !== lastVideoSrcByDeckRef.current[activeDeck]) {
      lastVideoSrcByDeckRef.current[activeDeck] = activeSrcStr;
      uploadedDeckRef.current[activeDeck] = false;
      lastDecodedFramesRef.current = -1;
      lastVideoTimeRef.current = -1;
      lastActiveTexRef.current = null;
      lastSamplerTexRef.current = null;
    }

    const backupSrcStr = backupEl?.currentSrc || backupEl?.src || '';
    if (backupSrcStr !== lastVideoSrcByDeckRef.current[standbyKey]) {
      lastVideoSrcByDeckRef.current[standbyKey] = backupSrcStr;
      uploadedDeckRef.current[standbyKey] = false;
    }

    const currentHasData = (currentEl?.readyState ?? 0) >= 2;
    const backupHasData = (backupEl?.readyState ?? 0) >= 2;

    if (currentHasData) {
      uploadedDeckRef.current[activeDeck] = true;
    }
    if (backupHasData) {
      uploadedDeckRef.current[standbyKey] = true;
    }

    const currentReady =
      Boolean(currentEl) &&
      Boolean(activeSrcStr) &&
      (currentHasData || uploadedDeckRef.current[activeDeck]);

    const backupReady =
      !activeSrcStr &&
      Boolean(backupEl) &&
      Boolean(backupSrcStr) &&
      (backupHasData || uploadedDeckRef.current[standbyKey]);

    let activeTex: THREE.Texture = standbyTexture;
    let activeVideo: HTMLVideoElement | null = null;
    if (showState === 'SHOW_PLAYING' || showState === 'SHOW_COMPLETED') {
      if (currentTex && currentReady) {
        activeTex = currentTex;
        activeVideo = currentEl;
      } else if (backupTex && backupReady) {
        activeTex = backupTex;
        activeVideo = backupEl;
      }
    }

    const isVideo = activeTex !== standbyTexture;
    const nowMs = performance.now();

    // Exact 1:1 decoded frame upload: relies on THREE.VideoTexture's built-in rVFC plus decoded-frame counter check
    // so texImage2D never stalls by re-uploading identical frames on 60/120Hz displays.
    if (isVideo && activeVideo && activeVideo.readyState >= 2) {
      const quality = typeof activeVideo.getVideoPlaybackQuality === 'function'
        ? activeVideo.getVideoPlaybackQuality()
        : null;
      const totalFrames = quality ? quality.totalVideoFrames : -1;
      const decodedChanged = totalFrames >= 0 && totalFrames !== lastDecodedFramesRef.current;
      const texChanged = activeTex !== lastActiveTexRef.current;
      const hasRvfc = 'requestVideoFrameCallback' in activeVideo;
      const timeChanged = !hasRvfc && activeVideo.currentTime !== lastVideoTimeRef.current;

      if (decodedChanged || texChanged || timeChanged) {
        if (totalFrames >= 0) {
          lastDecodedFramesRef.current = totalFrames;
        }
        lastVideoTimeRef.current = activeVideo.currentTime;
        lastActiveTexRef.current = activeTex;
        lastUploadMsRef.current = nowMs;
        activeTex.needsUpdate = true;
      }
    }

    // Pace 32x18 GPU screen light sampling cleanly (~15Hz in fullscreen / ~24Hz windowed) during active playback
    const samplerIntervalMs = isFullscreen || isSoftwareGl ? 66 : 42;
    const samplerDue =
      screenReflectionBrightness > 0.01 &&
      (activeTex !== lastSamplerTexRef.current ||
        (isVideo && !isPaused && nowMs - lastSamplerMsRef.current >= samplerIntervalMs));
    if (samplerDue) {
      lastSamplerTexRef.current = activeTex;
      lastSamplerMsRef.current = nowMs;

      gpuLightSampler.mat.uniforms.uMap.value = activeTex;
      gpuLightSampler.mat.uniforms.uIsVideo.value = isVideo ? 1.0 : 0.0;
      gpuLightSampler.mat.uniforms.uRepeat.value.set(
        isVideo ? uvRepeatX : 1,
        isVideo ? uvRepeatY : 1,
      );
      gpuLightSampler.mat.uniforms.uOffset.value.set(
        isVideo ? uvOffsetX : 0,
        isVideo ? uvOffsetY : 0,
      );

      const prevTarget = gl.getRenderTarget();
      const prevAutoClear = gl.autoClear;
      gl.autoClear = true;
      gl.setRenderTarget(gpuLightSampler.rt);
      gl.render(gpuLightSampler.scene, gpuLightSampler.camera);
      gl.setRenderTarget(prevTarget);
      gl.autoClear = prevAutoClear;
    }

    // Real-time average video RGB, luminance & 4DX optical scene analysis (~22Hz, zero WebGL pipeline stall)
    const needRgbRead = Boolean(screenBounceRef || (fourDxTelemetryRef && fourDxActive));
    if (needRgbRead) {
      if (isVideo && activeVideo && activeVideo.readyState >= 2 && rgbSamplerCanvas) {
        if (nowMs - lastRgbReadMsRef.current >= 45) {
          lastRgbReadMsRef.current = nowMs;
          try {
            rgbSamplerCanvas.ctx.drawImage(activeVideo, 0, 0, SAMPLE_W, SAMPLE_H);
            const data = rgbSamplerCanvas.ctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H).data;
            if (screenBounceRef) {
              let rSum = 0;
              let gSum = 0;
              let bSum = 0;
              for (let i = 0; i < data.length; i += 4) {
                rSum += data[i];
                gSum += data[i + 1];
                bSum += data[i + 2];
              }
              const rAvg = rSum / (SAMPLE_PIXELS * 255);
              const gAvg = gSum / (SAMPLE_PIXELS * 255);
              const bAvg = bSum / (SAMPLE_PIXELS * 255);
              const lum = 0.2126 * rAvg + 0.7152 * gAvg + 0.0722 * bAvg;
              screenBounceRef.current.r = THREE.MathUtils.damp(screenBounceRef.current.r, rAvg, 8, dt);
              screenBounceRef.current.g = THREE.MathUtils.damp(screenBounceRef.current.g, gAvg, 8, dt);
              screenBounceRef.current.b = THREE.MathUtils.damp(screenBounceRef.current.b, bAvg, 8, dt);
              screenBounceRef.current.luminance = THREE.MathUtils.damp(
                screenBounceRef.current.luminance,
                isPaused ? lum * 0.45 : lum,
                8,
                dt,
              );
            }
            if (fourDxTelemetryRef && fourDxActive && showState === 'SHOW_PLAYING' && !isPaused) {
              analyzeVideoFrameOptical(
                data,
                prevOpticalRgbRef.current,
                hasPrevOpticalRef.current,
                prevMeanLumRef.current,
                opticalOutRef.current,
              );
              hasPrevOpticalRef.current = true;
              prevMeanLumRef.current = opticalOutRef.current.meanLuminance;
            }
          } catch {
            // Ignore cross-origin drawImage if any external URL ever appears
          }
        }
      } else if (screenBounceRef) {
        const restR = isBioluminescentBeach ? 0.34 : 0.72;
        const restG = isBioluminescentBeach ? 0.68 : 0.8;
        const restB = isBioluminescentBeach ? 0.92 : 0.95;
        screenBounceRef.current.r = THREE.MathUtils.damp(screenBounceRef.current.r, restR, 4, dt);
        screenBounceRef.current.g = THREE.MathUtils.damp(screenBounceRef.current.g, restG, 4, dt);
        screenBounceRef.current.b = THREE.MathUtils.damp(screenBounceRef.current.b, restB, 4, dt);
        screenBounceRef.current.luminance = THREE.MathUtils.damp(
          screenBounceRef.current.luminance,
          showState === 'SHOW_PLAYING' && !isPaused ? 0.34 : 0.14,
          4,
          dt,
        );
      }
    }

    // 60fps real-time FFT audio bass + optical motion fusion for all 4DX theaters
    if (fourDxTelemetryRef) {
      const tel = fourDxTelemetryRef.current;
      const telemetryRunning =
        fourDxActive && showState === 'SHOW_PLAYING' && !isPaused && isVideo;
      if (telemetryRunning) {
        cinemaAudioEngine.sampleAudioTelemetry(audioOutRef.current);
        const aud = audioOutRef.current;
        const opt = opticalOutRef.current;

        tel.audioActive = aud.active;
        tel.subBass = THREE.MathUtils.damp(
          tel.subBass,
          aud.subBass,
          aud.subBass > tel.subBass ? 28 : 14,
          dt,
        );
        tel.bass = THREE.MathUtils.damp(
          tel.bass,
          aud.bass,
          aud.bass > tel.bass ? 26 : 13,
          dt,
        );
        tel.bassTransient = THREE.MathUtils.damp(
          tel.bassTransient,
          aud.transient,
          aud.transient > tel.bassTransient ? 34 : 16,
          dt,
        );
        tel.highFreq = THREE.MathUtils.damp(tel.highFreq, aud.high, 14, dt);
        tel.rms = THREE.MathUtils.damp(tel.rms, aud.rms, 18, dt);

        tel.sceneMotion = THREE.MathUtils.damp(tel.sceneMotion, opt.motionEnergy, 9, dt);
        tel.panBias = THREE.MathUtils.damp(tel.panBias, opt.panBias, 8, dt);
        tel.pitchBias = THREE.MathUtils.damp(tel.pitchBias, opt.pitchBias, 8, dt);
        tel.fireLevel = THREE.MathUtils.damp(
          tel.fireLevel,
          opt.fireScore,
          opt.fireScore > tel.fireLevel ? 8 : 3.2,
          dt,
        );
        tel.fireCenterX = THREE.MathUtils.damp(tel.fireCenterX, opt.fireCenterX, 5, dt);
        tel.rainLevel = THREE.MathUtils.damp(
          tel.rainLevel,
          opt.rainScore,
          opt.rainScore > tel.rainLevel ? 5 : 2.6,
          dt,
        );
        tel.snowLevel = THREE.MathUtils.damp(
          tel.snowLevel,
          opt.snowScore,
          opt.snowScore > tel.snowLevel ? 4.5 : 2.4,
          dt,
        );
        tel.windLevel = THREE.MathUtils.damp(tel.windLevel, opt.windScore, 6, dt);

        if (opt.flashSpike > tel.lightningFlash) {
          tel.lightningFlash = opt.flashSpike;
        } else {
          tel.lightningFlash = THREE.MathUtils.damp(tel.lightningFlash, 0, 14, dt);
        }
        opt.flashSpike *= Math.exp(-16 * dt);
        tel.flashColor = tel.fireLevel > 0.25 ? '#ff6b2b' : '#e0f2fe';

        stepFourDxSeatPhysics(fourDxSpringRef.current, tel, dt, true);
      } else {
        hasPrevOpticalRef.current = false;
        opticalOutRef.current.flashSpike = 0;
        tel.audioActive = false;
        tel.subBass = THREE.MathUtils.damp(tel.subBass, 0, 8, dt);
        tel.bass = THREE.MathUtils.damp(tel.bass, 0, 8, dt);
        tel.bassTransient = THREE.MathUtils.damp(tel.bassTransient, 0, 8, dt);
        tel.highFreq = THREE.MathUtils.damp(tel.highFreq, 0, 8, dt);
        tel.rms = THREE.MathUtils.damp(tel.rms, 0, 8, dt);
        tel.sceneMotion = THREE.MathUtils.damp(tel.sceneMotion, 0, 8, dt);
        tel.panBias = THREE.MathUtils.damp(tel.panBias, 0, 8, dt);
        tel.pitchBias = THREE.MathUtils.damp(tel.pitchBias, 0, 8, dt);
        tel.fireLevel = THREE.MathUtils.damp(tel.fireLevel, 0, 6, dt);
        tel.rainLevel = THREE.MathUtils.damp(tel.rainLevel, 0, 6, dt);
        tel.snowLevel = THREE.MathUtils.damp(tel.snowLevel, 0, 6, dt);
        tel.windLevel = THREE.MathUtils.damp(tel.windLevel, 0, 6, dt);
        tel.lightningFlash = THREE.MathUtils.damp(tel.lightningFlash, 0, 10, dt);

        stepFourDxSeatPhysics(fourDxSpringRef.current, tel, dt, false);
      }
    }

    // Calibrated screen bounce reflections on seats (kept dark & moody on Beach Theaters)
    const baseBounceGain = isBeach
      ? showState === 'SHOW_PLAYING' && isVideo
        ? (isPaused ? 0.14 : 0.38) * lightingProfile.screenGlowStrength
        : 0.08 * lightingProfile.screenGlowStrength
      : showState === 'SHOW_PLAYING' && isVideo
        ? isPaused
          ? 0.45 * lightingProfile.screenGlowStrength
          : 2.9 * lightingProfile.screenGlowStrength
        : showState === 'SHOW_STARTING'
          ? 0.55
          : showState === 'AUDITORIUM_OPEN'
            ? 0.22
            : 0.14;
    const targetBounceGain = baseBounceGain * screenReflectionBrightness;

    currentBounceGainRef.current = THREE.MathUtils.damp(
      currentBounceGainRef.current,
      targetBounceGain,
      3.8,
      dt,
    );
    if (screenBounceUniforms) {
      screenBounceUniforms.uScreenLightTex.value = gpuLightSampler.rt.texture;
      screenBounceUniforms.uScreenBounceGain.value = currentBounceGainRef.current;
    }

    if (shaderMatRef.current) {
      shaderMatRef.current.uniforms.uMap.value = activeTex;
      shaderMatRef.current.uniforms.uBrightness.value = screenBrightnessRef.current;
      shaderMatRef.current.uniforms.uIsVideo.value = isVideo ? 1.0 : 0.0;
      shaderMatRef.current.uniforms.uScreenXFitRatio.value = isVideo ? screenXFitRatio : 1.0;
      shaderMatRef.current.uniforms.uScreenXFrontWidth.value = effectiveScreenWidth;
      shaderMatRef.current.uniforms.uHdrBloomMode.value =
        isBioluminescentBeach && !isSoftwareGl ? 1.0 : 0.0;
      shaderMatRef.current.uniforms.uRepeat.value.set(
        isVideo ? uvRepeatX : 1,
        isVideo ? uvRepeatY : 1,
      );
      shaderMatRef.current.uniforms.uOffset.value.set(
        isVideo ? uvOffsetX : 0,
        isVideo ? uvOffsetY : 0,
      );
    }

    isVideoActiveRef.current = isVideo;
    activeTexRef.current = activeTex;
    uvRepeatRef.current.x = uvRepeatX;
    uvRepeatRef.current.y = uvRepeatY;
    uvOffsetRef.current.x = uvOffsetX;
    uvOffsetRef.current.y = uvOffsetY;
    scaleYRef.current = scaleY;
    wingStartMetersRef.current = isVideo ? screenXWingStartMeters : 0;
    frontWidthRef.current = effectiveScreenWidth;
    fitRatioRef.current = isVideo ? screenXFitRatio : 1;

    // Calibrated volumetric projector beam: strictly zero on beach standby, RGB-synced during playback
    const beamActive = showState === 'SHOW_PLAYING' && isVideo;
    const outerTarget = beamActive ? (isPaused ? 0.045 : isMobile ? 0.075 : 0.185) : 0.0;
    const innerTarget = beamActive ? (isPaused ? 0.03 : isMobile ? 0.052 : 0.135) : 0.0;
    const flareTarget = beamActive
      ? isPaused
        ? 0.16
        : isMobile
          ? 0.24
          : 0.48
      : isBeach
        ? 0.0
        : 0.04;

    if (outerBeamMatRef.current) {
      outerBeamMatRef.current.uniforms.uScreenLightTex.value = gpuLightSampler.rt.texture;
      outerBeamMatRef.current.uniforms.uOpacity.value = THREE.MathUtils.damp(
        outerBeamMatRef.current.uniforms.uOpacity.value,
        isBeach ? 0 : outerTarget,
        3.2,
        dt,
      );
    }
    if (innerBeamMatRef.current) {
      innerBeamMatRef.current.uniforms.uScreenLightTex.value = gpuLightSampler.rt.texture;
      innerBeamMatRef.current.uniforms.uOpacity.value = THREE.MathUtils.damp(
        innerBeamMatRef.current.uniforms.uOpacity.value,
        isBeach ? 0 : innerTarget,
        3.2,
        dt,
      );
    }
    if (lensFlareMatRef.current) {
      lensFlareMatRef.current.uniforms.uScreenLightTex.value = gpuLightSampler.rt.texture;
      lensFlareMatRef.current.uniforms.uOpacity.value = THREE.MathUtils.damp(
        lensFlareMatRef.current.uniforms.uOpacity.value,
        flareTarget,
        3.2,
        dt,
      );
    }

    // Update Beach volumetric projector frustum beams directly from uScreenLightTex (zero randomness)
    if (isBeach) {
      const beachOuterTarget = beamActive
        ? isBioluminescentBeach
          ? isPaused
            ? 0.028
            : isMobile
              ? 0.05
              : 0.095
          : isPaused
            ? 0.04
            : isMobile
              ? 0.072
              : 0.145
        : 0.0;
      const beachInnerTarget = beamActive
        ? isBioluminescentBeach
          ? isPaused
            ? 0.02
            : isMobile
              ? 0.036
              : 0.068
          : isPaused
            ? 0.028
            : isMobile
              ? 0.052
              : 0.105
        : 0.0;

      if (beachOuterBeamMatRef.current) {
        beachOuterBeamMatRef.current.uniforms.uScreenLightTex.value = gpuLightSampler.rt.texture;
        beachOuterBeamMatRef.current.uniforms.uOpacity.value = THREE.MathUtils.damp(
          beachOuterBeamMatRef.current.uniforms.uOpacity.value,
          beachOuterTarget,
          3.6,
          dt,
        );
      }
      if (beachInnerBeamMatRef.current) {
        beachInnerBeamMatRef.current.uniforms.uScreenLightTex.value = gpuLightSampler.rt.texture;
        beachInnerBeamMatRef.current.uniforms.uOpacity.value = THREE.MathUtils.damp(
          beachInnerBeamMatRef.current.uniforms.uOpacity.value,
          beachInnerTarget,
          3.6,
          dt,
        );
      }
    }

    if (surfaceMeshRef.current) {
      surfaceMeshRef.current.scale.set(
        isVideo ? scaleX : 1,
        isVideo ? scaleY : 1,
        1,
      );
    }
  });

  const isMandap2d = sideLightStyle === 'indian_mandap_jali';
  const isParametricObsidian = sideLightStyle === 'parametric_obsidian_waves';
  const isBiophilicMoss = sideLightStyle === 'biophilic_crystalline_moss';
  const stageFootlightIntensity = lightFactor * 0.95;

  return (
    <group>
      <group position={screenPosition}>
        {/* Sleek Matte/Satin Black Acoustic Outer Frame (omitted for seamless frameless floating Dolby, ScreenX 270, Mandap, Obsidian Wave, Sylva Moss, 4DX Exo-Skeleton & Beach truss screens) */}
        {!isBeach && !isDolbyFloating && !isScreenX && !isMandap2d && !isParametricObsidian && !isBiophilicMoss && !isExoskeleton4dx && (
          <mesh geometry={outerFrameGeo} position={[0, 0, -0.05]}>
            <meshStandardMaterial
              color={
                isIceFlagship
                  ? '#07080b'
                  : isIceCobalt
                    ? '#1b130f'
                    : isIceAmber
                      ? '#08090c'
                      : isCrimson4dx || isArctic4dx || isThunder4dx
                        ? '#06070a'
                        : isVolcanicCopper2d
                          ? '#0b0c10'
                          : isPrivateVolcanic
                            ? '#140e0b'
                            : isPrivateChampagne
                              ? '#0c100f'
                              : '#0b0c10'
              }
              roughness={
                isIceFlagship || isIceCobalt || isIceAmber
                  ? 0.95
                  : isCrimson4dx || isArctic4dx || isThunder4dx
                    ? 0.9
                    : isVolcanicCopper2d
                      ? 0.56
                      : isPrivateVolcanic || isPrivateChampagne
                        ? 0.72
                        : 0.42
              }
              metalness={
                isIceFlagship || isIceCobalt || isIceAmber
                  ? 0.04
                  : isCrimson4dx || isArctic4dx || isThunder4dx
                    ? 0.1
                    : isVolcanicCopper2d
                      ? 0.22
                      : isPrivateVolcanic || isPrivateChampagne
                        ? 0.08
                        : 0.62
              }
            />
          </mesh>
        )}

        {/* Precision-Engineered Matte-Black Titanium Top & Bottom Horizontal Borders Only (Obsidian Panorama ScreenX) */}
        {isScreenX && !isFloatingFramelessScreenX && (
          <group>
            <mesh position={[0, screenHeight / 2 + 0.055, 0.028]}>
              <boxGeometry args={[effectiveScreenWidth, 0.11, 0.08]} />
              <meshStandardMaterial color="#0b0d12" roughness={0.28} metalness={0.86} />
            </mesh>
            <mesh position={[0, -screenHeight / 2 - 0.055, 0.028]}>
              <boxGeometry args={[effectiveScreenWidth, 0.11, 0.08]} />
              <meshStandardMaterial color="#0b0d12" roughness={0.28} metalness={0.86} />
            </mesh>
          </group>
        )}

        {/* Recessed Brushed-Champagne Metal / Brushed-Brass Trim Framing Screen (Walnut Reserve & Champagne Ivory) */}
        {brassTrimGeo && (
          <mesh geometry={brassTrimGeo} position={[0, 0, -0.024]}>
            <meshStandardMaterial
              color={isPrivateVolcanic ? '#d6c096' : '#c9a861'}
              roughness={isPrivateVolcanic ? 0.25 : 0.28}
              metalness={0.86}
            />
          </mesh>
        )}

        {/* Deep Light-Absorbing Satin-Black / Matte-Espresso / Charcoal Velvet Border Masking */}
        {!isBeach && !isScreenX && !isMandap2d && !isParametricObsidian && !isBiophilicMoss && !isDolbyVeil && !isKakatiyaDolby && !isDeccanDolby && !isExoskeleton4dx && (
          <mesh geometry={velvetMaskGeo} position={[0, 0, -0.01]}>
            <meshStandardMaterial
              color={
                isDolbyFloating
                  ? '#020203'
                  : isIceFlagship
                    ? '#050609'
                    : isIceCobalt
                      ? '#160f0b'
                      : isIceAmber
                        ? '#07080b'
                        : isCrimson4dx || isArctic4dx || isThunder4dx
                          ? '#050608'
                          : isPrivateVolcanic
                            ? '#120b09'
                            : isPrivateChampagne
                              ? '#060908'
                              : '#040406'
              }
              roughness={0.97}
              metalness={0.0}
            />
          </mesh>
        )}

        {/* Silver-White 3D Projection Screen Perimeter Trim */}
        {silverBezelGeo && (
          <mesh geometry={silverBezelGeo} position={[0, 0, 0.002]}>
            <meshStandardMaterial color="#cfd6e0" roughness={0.32} metalness={0.55} />
          </mesh>
        )}

        {/* Pure Black Backing Matte for Letterbox / Pillarbox Fit */}
        <mesh geometry={screenGeo} position={[0, 0, 0.008]}>
          <meshBasicMaterial color="#020203" />
        </mesh>

        {/* Active Cinema Projection Surface */}
        <mesh
          ref={surfaceMeshRef}
          geometry={screenGeo}
          position={[0, 0, 0.028]}
          material={screenShaderMaterial}
        />

        {/* Subtle Under-Screen Stage Footlight Wash */}
        {!isBeach &&
          !isIce &&
          !isScreenX &&
          !isZeroStageImax &&
          !isCrimson4dx &&
          !isArctic4dx &&
          !isThunder4dx &&
          !isExoskeleton4dx &&
          !isDolbyFloating &&
          !isVolcanicCopper2d &&
          !isMandap2d &&
          !isParametricObsidian &&
          !isBiophilicMoss &&
          !isPrivateVolcanic &&
          !isPrivateChampagne && (
            <mesh position={[0, -screenHeight / 2 - 0.14, 0.06]}>
              <boxGeometry args={[screenWidth * 0.92, 0.035, 0.04]} />
              <meshStandardMaterial
                color="#0e0e12"
                emissive={lightingProfile.accentColor}
                emissiveIntensity={stageFootlightIntensity}
                roughness={0.4}
              />
            </mesh>
          )}
      </group>

      {/* ScreenX 270-Degree Seamless Multi-Projection Side Screen Walls */}
      {isScreenX && (
        <ScreenXSideWalls
          config={config}
          activeTexRef={activeTexRef}
          standbyTexture={standbyTexture}
          isVideoRef={isVideoActiveRef}
          screenBrightnessRef={screenBrightnessRef}
          uvRepeatRef={uvRepeatRef}
          uvOffsetRef={uvOffsetRef}
          scaleYRef={scaleYRef}
          wingStartMetersRef={wingStartMetersRef}
          frontWidthRef={frontWidthRef}
          fitRatioRef={fitRatioRef}
          lightFactor={lightFactor}
          showState={showState}
        />
      )}

      {/* ICE Side Visual Panels: 12-16 Angled Vertical Peripheral LED Displays */}
      {supportsIcePanels && (
        <IceSidePanels
          config={config}
          screenLightTex={gpuLightSampler.rt.texture}
          showState={showState}
          isPaused={isPaused}
          isVideoRef={isVideoActiveRef}
          lightFactor={lightFactor}
          screenReflectionBrightness={screenReflectionBrightness}
        />
      )}

      {/* Real-Time Video-Matched Volumetric Projector Frustum Beam (Indoor Booth -> Screen) */}
      {!isBeach && (
        <>
          <mesh geometry={outerBeamGeo} material={outerBeamMaterial} renderOrder={4} />
          <mesh geometry={innerBeamGeo} material={innerBeamMaterial} renderOrder={5} />
          <mesh
            position={[boothLensPos[0], boothLensPos[1], boothLensPos[2] - 0.04]}
            material={lensFlareMaterial}
            renderOrder={6}
          >
            <planeGeometry args={[0.46, 0.28]} />
          </mesh>
        </>
      )}

      {/* Outdoor Beach Theater Real-Time Video-Mapped Projector Beams */}
      {isBeach && beachBeamAssets && (
        <group>
          {beachBeamAssets.frustums.map((frustum, fi) => (
            <React.Fragment key={`beach-beam-frustum-${fi}`}>
              <mesh
                geometry={frustum.outerGeo}
                material={beachOuterBeamMaterial}
                renderOrder={4}
              />
              <mesh
                geometry={frustum.innerGeo}
                material={beachInnerBeamMaterial}
                renderOrder={5}
              />
              <mesh
                position={[frustum.origin[0], frustum.origin[1], frustum.origin[2] - 0.025]}
                material={lensFlareMaterial}
                renderOrder={6}
              >
                <planeGeometry args={[0.26, 0.18]} />
              </mesh>
            </React.Fragment>
          ))}
        </group>
      )}
    </group>
  );
};
