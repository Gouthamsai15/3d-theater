import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { AuditoriumLightingPreset, ShowState, TheaterConfiguration } from '../../types/cinema';
import { ScreenBounceSample } from '../models/CinemaScreen';

const NEUTRAL_WALL_FILL_TINT = new THREE.Color('#eae6f2');

interface CinemaLightingRigProps {
  config: TheaterConfiguration;
  showState: ShowState;
  openLightingPreset?: AuditoriumLightingPreset;
  isPaused?: boolean;
  isFullscreen?: boolean;
  isSoftwareGl: boolean;
  onLightFactorChange?: (factor: number) => void;
  fourDxFlashRef?: React.MutableRefObject<{ level: number; color: string }>;
  screenBounceRef?: React.MutableRefObject<ScreenBounceSample>;
  screenReflectionBrightness?: number;
}

export const CinemaLightingRig: React.FC<CinemaLightingRigProps> = ({
  config,
  showState,
  openLightingPreset = 'doors_open',
  isPaused = false,
  isFullscreen = false,
  isSoftwareGl,
  onLightFactorChange,
  fourDxFlashRef,
  screenBounceRef,
  screenReflectionBrightness = 1,
}) => {
  const { lightingProfile, auditoriumWidth, auditoriumLength, auditoriumHeight, screenPosition } = config;
  const { scene, gl } = useThree();

  const isCobaltVeil = config.sideLightStyle === 'cobalt_veil_laser_recess';
  const isKakatiyaDolby = config.sideLightStyle === 'telugu_kakatiya_dolby';
  const isDeccanDolby = config.sideLightStyle === 'deccan_basalt_monsoon';
  const isBeach = config.environmentProfile.architectureStyle === 'beach';
  const isBioluminescentBeach = config.theaterId === 'beach_bioluminescent';

  const ambientRef = useRef<THREE.HemisphereLight>(null);
  const mainCeilingRef = useRef<THREE.DirectionalLight>(null);
  const wallFillLeftRef = useRef<THREE.DirectionalLight>(null);
  const wallFillRightRef = useRef<THREE.DirectionalLight>(null);
  const screenGlowRef = useRef<THREE.PointLight>(null);
  const screenHallBounceRef = useRef<THREE.PointLight>(null);

  const lightFactorRef = useRef(1);

  // Procedural studio environment reflections (dynamically dimmed during playback)
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    scene.environmentIntensity = isBeach ? 0.24 : 0.36;
    return () => {
      scene.environment = null;
      envTex.dispose();
      pmrem.dispose();
    };
  }, [gl, scene, isBeach]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.25);

    const openPresetFactor =
      openLightingPreset === 'feature_blackout'
        ? 0.0
        : openLightingPreset === 'pre_show_dim'
          ? 0.34
          : 1.0;

    // Lights stay ON/preset-tuned when auditorium is open, full when completed or paused, OFF when actively playing
    const targetFactor =
      showState === 'AUDITORIUM_OPEN'
        ? openPresetFactor
        : showState === 'SHOW_COMPLETED' || (showState === 'SHOW_PLAYING' && isPaused)
          ? 1.0
          : showState === 'SHOW_STARTING'
            ? 0.1
            : 0.0;

    const dampSpeed = showState === 'SHOW_STARTING' ? 2.2 : targetFactor >= 0.99 ? 2.8 : 3.4;
    lightFactorRef.current = THREE.MathUtils.damp(lightFactorRef.current, targetFactor, dampSpeed, dt);
    const f = lightFactorRef.current < 0.004 && targetFactor === 0 ? 0 : lightFactorRef.current;

    if (onLightFactorChange) {
      onLightFactorChange(f);
    }

    // Dim IBL reflections completely to 0 when house lights turn off so dark beach & movie reflections stay cinema-focused
    scene.environmentIntensity = f * (isBeach ? 0.24 : 0.36);

    // Skip expensive shadow map geometry passes when house lights are dimmed or during fullscreen movie playback
    if (gl.shadowMap.enabled) {
      const shouldUpdateShadows =
        !isSoftwareGl &&
        !isFullscreen &&
        (f > 0.02 || isBioluminescentBeach) &&
        !(showState === 'SHOW_PLAYING' && !isPaused);
      if (shouldUpdateShadows) {
        if (!gl.shadowMap.autoUpdate) {
          gl.shadowMap.autoUpdate = true;
          gl.shadowMap.needsUpdate = true;
        }
      } else if (gl.shadowMap.autoUpdate) {
        gl.shadowMap.autoUpdate = false;
      }
    }

    const flashLevel = config.supports4dxEffects ? (fourDxFlashRef?.current.level ?? 0) : 0;
    const flashColor = fourDxFlashRef?.current.color ?? '#7dd3fc';

    const bounce = screenBounceRef?.current ?? { r: 0.72, g: 0.8, b: 0.95, luminance: 0.25 };

    if (ambientRef.current) {
      const swBoost = isSoftwareGl ? 1.48 : 1.24;
      if (isBioluminescentBeach) {
        ambientRef.current.intensity = 0.014 + f * lightingProfile.ambientOpenIntensity;
      } else if (isBeach) {
        ambientRef.current.intensity = 0.004 + f * lightingProfile.ambientOpenIntensity;
      } else {
        ambientRef.current.intensity = 0.003 + f * lightingProfile.ambientOpenIntensity * swBoost;
      }
    }
    if (mainCeilingRef.current) {
      if (isBioluminescentBeach) {
        // Crisp cool silver moonlight illuminating dune ridges even in cinema mode
        mainCeilingRef.current.intensity = 0.34 + f * 0.44;
      } else if (isBeach) {
        mainCeilingRef.current.intensity = 0.035 + f * lightingProfile.mainOpenIntensity;
      } else {
        const mainBoost = isSoftwareGl ? 1.48 : 1.2;
        mainCeilingRef.current.intensity = f * lightingProfile.mainOpenIntensity * mainBoost;
      }
    }
    if (wallFillLeftRef.current) {
      if (isBeach) {
        wallFillLeftRef.current.intensity = f * lightingProfile.wallOpenIntensity * 0.28;
      } else if (isCobaltVeil) {
        wallFillLeftRef.current.intensity = f * 0.44;
        wallFillLeftRef.current.color.set('#ffdcb4');
      } else if (isKakatiyaDolby) {
        wallFillLeftRef.current.intensity = f * 0.46;
        wallFillLeftRef.current.color.set('#ffd59e');
      } else if (isDeccanDolby) {
        wallFillLeftRef.current.intensity = f * 0.56;
        wallFillLeftRef.current.color.set('#6ad2ab');
      } else {
        wallFillLeftRef.current.intensity =
          f * lightingProfile.wallOpenIntensity * 0.34 + flashLevel * 0.85;
        wallFillLeftRef.current.color
          .set(flashLevel > 0.05 ? flashColor : lightingProfile.wallColor)
          .lerp(NEUTRAL_WALL_FILL_TINT, flashLevel > 0.05 ? 0.15 : 0.48);
      }
    }
    if (wallFillRightRef.current) {
      if (isBeach) {
        wallFillRightRef.current.intensity = f * lightingProfile.wallOpenIntensity * 0.26;
      } else if (isCobaltVeil) {
        wallFillRightRef.current.intensity = f * 0.38;
        wallFillRightRef.current.color.set('#cbbcf6');
      } else if (isKakatiyaDolby) {
        wallFillRightRef.current.intensity = f * 0.46;
        wallFillRightRef.current.color.set('#ffd59e');
      } else if (isDeccanDolby) {
        wallFillRightRef.current.intensity = f * 0.54;
        wallFillRightRef.current.color.set('#84c8d4');
      } else {
        wallFillRightRef.current.intensity =
          f * lightingProfile.wallOpenIntensity * 0.32 + flashLevel * 0.85;
        wallFillRightRef.current.color
          .set(flashLevel > 0.05 ? flashColor : lightingProfile.wallColor)
          .lerp(NEUTRAL_WALL_FILL_TINT, flashLevel > 0.05 ? 0.15 : 0.48);
      }
    }

    if (screenGlowRef.current) {
      const openGlowScale =
        showState === 'AUDITORIUM_OPEN' && openLightingPreset === 'feature_blackout'
          ? 0.25
          : showState === 'AUDITORIUM_OPEN' && openLightingPreset === 'pre_show_dim'
            ? 0.72
            : 1.0;
      const targetScreenLight = isBeach
        ? showState === 'SHOW_PLAYING'
          ? 0
          : lightingProfile.screenGlowStrength * 0.42 * screenReflectionBrightness * openGlowScale
        : (showState === 'SHOW_PLAYING'
            ? flashLevel * 6
            : showState === 'SHOW_STARTING'
              ? lightingProfile.screenGlowStrength * 1.1
              : lightingProfile.screenGlowStrength * 0.55 * openGlowScale) * screenReflectionBrightness;
      screenGlowRef.current.intensity = THREE.MathUtils.damp(
        screenGlowRef.current.intensity,
        targetScreenLight,
        3.5,
        dt,
      );
      screenGlowRef.current.color.setRGB(bounce.r, bounce.g, bounce.b);
    }

    if (screenHallBounceRef.current) {
      screenHallBounceRef.current.intensity = THREE.MathUtils.damp(
        screenHallBounceRef.current.intensity,
        0,
        3.5,
        dt,
      );
    }
  });

  const bgColor = isBioluminescentBeach
    ? '#03071e'
    : isBeach
      ? '#0b1426'
      : '#030305';
  const fogDensity = isBioluminescentBeach
    ? 0.02
    : isBeach
      ? 0.0085
      : 0.01;

  const hemiTopColor = isBioluminescentBeach
    ? '#1d3557'
    : isBeach
      ? '#3b5998'
      : lightingProfile.ceilingColor;
  const hemiBotColor = isBioluminescentBeach
    ? '#080e1c'
    : isBeach
      ? '#c2b280'
      : isCobaltVeil
        ? '#544236'
        : isKakatiyaDolby
          ? '#463529'
          : isDeccanDolby
            ? '#22362f'
            : '#3d3746';

  const keyPos: [number, number, number] = isBioluminescentBeach
    ? [-24, 38, -60]
    : isBeach
      ? [-20, 14, -48]
      : [2, auditoriumHeight - 0.6, 2];
  const keyColor = isBioluminescentBeach
    ? '#aaccff'
    : isBeach
      ? '#ff9b54'
      : lightingProfile.ceilingColor;

  return (
    <>
      <color attach="background" args={[bgColor]} />
      <fogExp2 attach="fog" args={[bgColor, fogDensity]} />

      {/* Cool/Warm Hemisphere Fill */}
      <hemisphereLight
        ref={ambientRef}
        args={[hemiTopColor, hemiBotColor, lightingProfile.ambientOpenIntensity]}
      />

      {/* Primary Overhead Key Light (Moonlight on Bioluminescent Cove, Sunset on Sunset Cove) */}
      <directionalLight
        ref={mainCeilingRef}
        position={keyPos}
        color={keyColor}
        intensity={lightingProfile.mainOpenIntensity}
        castShadow={!isSoftwareGl}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.0005}
        shadow-normalBias={0.02}
        shadow-camera-left={isBeach ? -26 : -auditoriumWidth / 2}
        shadow-camera-right={isBeach ? 26 : auditoriumWidth / 2}
        shadow-camera-top={isBeach ? 24 : auditoriumLength / 2}
        shadow-camera-bottom={isBeach ? -24 : -auditoriumLength / 2}
        shadow-camera-near={0.5}
        shadow-camera-far={isBeach ? 140 : auditoriumHeight + 14}
      />

      {/* Smooth Parallel Side-Wall Architectural Fills (fade cleanly to 0 during playback) */}
      <directionalLight
        ref={wallFillLeftRef}
        position={[-16, auditoriumHeight * 0.72, 4]}
        color={isCobaltVeil ? '#ffdcb4' : lightingProfile.wallColor}
        intensity={isCobaltVeil ? 0.44 : lightingProfile.wallOpenIntensity * 0.34}
      />
      <directionalLight
        ref={wallFillRightRef}
        position={[16, auditoriumHeight * 0.72, -4]}
        color={isCobaltVeil ? '#cbbcf6' : lightingProfile.wallColor}
        intensity={isCobaltVeil ? 0.38 : lightingProfile.wallOpenIntensity * 0.32}
      />

      {/* Primary Dynamic Movie Screen Bounce Light (kept dark/off on Beach Theaters during movie) */}
      <pointLight
        ref={screenGlowRef}
        position={[screenPosition[0], screenPosition[1], screenPosition[2] + 3.4]}
        color="#c8dcff"
        intensity={isBeach ? 0.35 : 2}
        distance={auditoriumLength * 1.25}
        decay={1.7}
      />

      {/* Secondary Subtle Mid-Hall Screen Reflection Bounce */}
      <pointLight
        ref={screenHallBounceRef}
        position={[0, auditoriumHeight * 0.65, -auditoriumLength * 0.06]}
        color="#c8dcff"
        intensity={0}
        distance={auditoriumLength * 1.3}
        decay={1.8}
      />
    </>
  );
};

export const BioluminescentBloomComposer: React.FC = () => {
  const { gl, scene, camera, size } = useThree();
  const composerRef = useRef<{
    composer: EffectComposer;
    rt: THREE.WebGLRenderTarget;
    bloomPass: UnrealBloomPass;
  } | null>(null);

  useEffect(() => {
    const dpr = gl.getPixelRatio();
    const w = Math.max(1, Math.floor(size.width * dpr));
    const h = Math.max(1, Math.floor(size.height * dpr));
    const rt = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
    });
    const composer = new EffectComposer(gl, rt);
    composer.setPixelRatio(dpr);
    composer.setSize(size.width, size.height);

    const renderPass = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(w, h),
      0.3, // strength
      0.34, // radius
      2.18, // threshold (strictly above inverse-ACES screen ceiling <= 2.11)
    );
    const outputPass = new OutputPass();

    composer.addPass(renderPass);
    composer.addPass(bloomPass);
    composer.addPass(outputPass);

    composerRef.current = { composer, rt, bloomPass };

    return () => {
      composerRef.current = null;
      composer.dispose();
      rt.dispose();
    };
    // Build once per renderer/scene/camera instance; resize handled below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, camera]);

  useEffect(() => {
    const entry = composerRef.current;
    if (!entry) return;
    const dpr = gl.getPixelRatio();
    entry.composer.setPixelRatio(dpr);
    entry.composer.setSize(size.width, size.height);
    entry.bloomPass.resolution.set(
      Math.max(1, Math.floor(size.width * dpr)),
      Math.max(1, Math.floor(size.height * dpr)),
    );
  }, [gl, size.width, size.height]);

  useFrame(() => {
    composerRef.current?.composer.render();
  }, 1);

  return null;
};
