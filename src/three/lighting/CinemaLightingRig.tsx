import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { ShowState, TheaterConfiguration } from '../../types/cinema';
import { ScreenBounceSample } from '../models/CinemaScreen';

const NEUTRAL_WALL_FILL_TINT = new THREE.Color('#eae6f2');

interface CinemaLightingRigProps {
  config: TheaterConfiguration;
  showState: ShowState;
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
    scene.environmentIntensity = 0.36;
    return () => {
      scene.environment = null;
      envTex.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.25);

    // Lights stay ON when auditorium is open, completed, or when video is paused; OFF when actively playing
    const targetFactor =
      showState === 'AUDITORIUM_OPEN' ||
      showState === 'SHOW_COMPLETED' ||
      (showState === 'SHOW_PLAYING' && isPaused)
        ? 1.0
        : showState === 'SHOW_STARTING'
          ? 0.1
          : 0.0;

    const dampSpeed = showState === 'SHOW_STARTING' ? 2.2 : targetFactor === 1.0 ? 2.8 : 3.4;
    lightFactorRef.current = THREE.MathUtils.damp(lightFactorRef.current, targetFactor, dampSpeed, dt);
    const f = lightFactorRef.current < 0.004 && targetFactor === 0 ? 0 : lightFactorRef.current;

    if (onLightFactorChange) {
      onLightFactorChange(f);
    }

    // Dim IBL reflections completely to 0 when house lights turn off so video reflections dominate cleanly
    scene.environmentIntensity = f * 0.36;

    // Skip expensive shadow map geometry passes when house lights are dimmed or during fullscreen movie playback
    if (gl.shadowMap.enabled) {
      const shouldUpdateShadows =
        !isSoftwareGl &&
        !isFullscreen &&
        f > 0.02 &&
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
      ambientRef.current.intensity = 0.003 + f * lightingProfile.ambientOpenIntensity * swBoost;
    }
    if (mainCeilingRef.current) {
      const mainBoost = isSoftwareGl ? 1.48 : 1.2;
      mainCeilingRef.current.intensity = f * lightingProfile.mainOpenIntensity * mainBoost;
    }
    if (wallFillLeftRef.current) {
      if (isCobaltVeil) {
        wallFillLeftRef.current.intensity = f * 0.44;
        wallFillLeftRef.current.color.set('#ffdcb4');
      } else {
        wallFillLeftRef.current.intensity =
          f * lightingProfile.wallOpenIntensity * 0.34 + flashLevel * 0.85;
        wallFillLeftRef.current.color
          .set(flashLevel > 0.05 ? flashColor : lightingProfile.wallColor)
          .lerp(NEUTRAL_WALL_FILL_TINT, flashLevel > 0.05 ? 0.15 : 0.48);
      }
    }
    if (wallFillRightRef.current) {
      if (isCobaltVeil) {
        wallFillRightRef.current.intensity = f * 0.38;
        wallFillRightRef.current.color.set('#cbbcf6');
      } else {
        wallFillRightRef.current.intensity =
          f * lightingProfile.wallOpenIntensity * 0.32 + flashLevel * 0.85;
        wallFillRightRef.current.color
          .set(flashLevel > 0.05 ? flashColor : lightingProfile.wallColor)
          .lerp(NEUTRAL_WALL_FILL_TINT, flashLevel > 0.05 ? 0.15 : 0.48);
      }
    }

    if (screenGlowRef.current) {
      const targetScreenLight =
        (showState === 'SHOW_PLAYING'
          ? flashLevel * 6
          : showState === 'SHOW_STARTING'
            ? lightingProfile.screenGlowStrength * 1.1
            : lightingProfile.screenGlowStrength * 0.55) * screenReflectionBrightness;
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

  return (
    <>
      <color attach="background" args={['#030305']} />
      <fogExp2 attach="fog" args={['#030305', 0.01]} />

      {/* Cool/Warm Hemisphere Fill (smooth ceiling & upward bounce without point hotspots) */}
      <hemisphereLight
        ref={ambientRef}
        args={[
          lightingProfile.ceilingColor,
          isCobaltVeil ? '#544236' : '#3d3746',
          lightingProfile.ambientOpenIntensity,
        ]}
      />

      {/* Primary Overhead Key Light (shadow caster) */}
      <directionalLight
        ref={mainCeilingRef}
        position={[2, auditoriumHeight - 0.6, 2]}
        color={lightingProfile.ceilingColor}
        intensity={lightingProfile.mainOpenIntensity}
        castShadow={!isSoftwareGl}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.0005}
        shadow-normalBias={0.02}
        shadow-camera-left={-auditoriumWidth / 2}
        shadow-camera-right={auditoriumWidth / 2}
        shadow-camera-top={auditoriumLength / 2}
        shadow-camera-bottom={-auditoriumLength / 2}
        shadow-camera-near={0.5}
        shadow-camera-far={auditoriumHeight + 14}
      />

      {/* Smooth Parallel Side-Wall Architectural Fills Across All Theaters (zero point-light circular hotspots) */}
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

      {/* Primary Dynamic Movie Screen Bounce Light */}
      <pointLight
        ref={screenGlowRef}
        position={[screenPosition[0], screenPosition[1], screenPosition[2] + 3.4]}
        color="#c8dcff"
        intensity={2}
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
