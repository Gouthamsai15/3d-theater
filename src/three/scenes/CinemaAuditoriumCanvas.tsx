import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import {
  AudioSettings,
  AuditoriumLightingPreset,
  CameraViewMode,
  FourDxSettings,
  GraphicsQuality,
  ScreenFramingMode,
  SeatData,
  ShowState,
  TheaterConfiguration,
  WalkInputState,
} from '../../types/cinema';
import { AuditoriumShell } from '../models/AuditoriumShell';
import { BeachPositionalAudioRig } from '../models/BeachEnvironment';
import { SeatModels } from '../models/SeatModels';
import { CinemaScreen, ScreenBounceSample } from '../models/CinemaScreen';
import { FourDxEffectsRig } from '../models/FourDxEffectsRig';
import {
  createInitialFourDxTelemetry,
  FourDxLiveTelemetry,
} from '../models/fourDxTelemetry';
import {
  BioluminescentBloomComposer,
  CinemaLightingRig,
} from '../lighting/CinemaLightingRig';
import { createScreenBounceUniforms } from '../lighting/screenBounceShader';
import { FirstPersonCameraRig } from '../cameras/FirstPersonCameraRig';
import { EntranceCorridor3D } from '../models/EntranceCorridor3D';
import {
  CorridorAnimationState,
  CorridorPhase,
  createInitialCorridorState,
} from '../models/corridorThemes';
import {
  computeAdaptiveCinemaFov,
  detectWebGLSupport,
  isMobileDevice,
} from '../../utils/formatters';

interface CinemaAuditoriumCanvasProps {
  config: TheaterConfiguration;
  seats: SeatData[];
  selectedSeat: SeatData;
  hoveredSeatId: string | null;
  onSelectSeat: (seatId: string) => void;
  onHoverSeat: (seatId: string | null) => void;
  videoElementA: HTMLVideoElement | null;
  videoElementB: HTMLVideoElement | null;
  activeDeck: 'A' | 'B';
  videoAspectRatio: number;
  screenFraming: ScreenFramingMode;
  viewMode: CameraViewMode;
  showState: ShowState;
  openLightingPreset?: AuditoriumLightingPreset;
  isPaused: boolean;
  graphicsQuality: GraphicsQuality;
  fourDxSettings: FourDxSettings;
  audioSettings: AudioSettings;
  screenReflectionBrightness?: number;
  entranceComplete: boolean;
  onEntranceComplete: () => void;
  resetViewSignal: number;
  skipWalkSignal: number;
  scanTicketSignal: number;
  onRequestScanTicket: () => void;
  onCorridorPhaseChange?: (phase: CorridorPhase) => void;
  walkInputRef?: React.MutableRefObject<WalkInputState>;
  onSceneReady: () => void;
}

export const CinemaAuditoriumCanvas: React.FC<CinemaAuditoriumCanvasProps> = React.memo(({
  config,
  seats,
  selectedSeat,
  hoveredSeatId,
  onSelectSeat,
  onHoverSeat,
  videoElementA,
  videoElementB,
  activeDeck,
  videoAspectRatio,
  screenFraming,
  viewMode,
  showState,
  openLightingPreset = 'doors_open',
  isPaused,
  graphicsQuality,
  fourDxSettings,
  audioSettings,
  screenReflectionBrightness = 1,
  entranceComplete,
  onEntranceComplete,
  resetViewSignal,
  skipWalkSignal,
  scanTicketSignal,
  onRequestScanTicket,
  onCorridorPhaseChange,
  walkInputRef,
  onSceneReady,
}) => {
  const webglInfo = useMemo(() => detectWebGLSupport(), []);
  const corridorStateRef = useRef<CorridorAnimationState>(createInitialCorridorState());
  const [contextLost, setContextLost] = useState(false);
  const [lightFactor, setLightFactor] = useState(1);
  const detectAnyFullscreen = () => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return false;
    if (document.fullscreenElement) return true;
    if (isMobileDevice()) return false;
    return (
      window.innerHeight >= window.screen.height - 40 &&
      window.innerWidth >= window.screen.width - 40
    );
  };

  const [isFullscreen, setIsFullscreen] = useState(detectAnyFullscreen);
  const [viewportPixels, setViewportPixels] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth * window.innerHeight : 1280 * 720,
  );

  useEffect(() => {
    const syncViewportMetrics = () => {
      setIsFullscreen(detectAnyFullscreen());
      setViewportPixels(window.innerWidth * window.innerHeight);
    };
    document.addEventListener('fullscreenchange', syncViewportMetrics);
    window.addEventListener('resize', syncViewportMetrics);
    return () => {
      document.removeEventListener('fullscreenchange', syncViewportMetrics);
      window.removeEventListener('resize', syncViewportMetrics);
    };
  }, []);
  const screenBrightnessRef = useRef(0.34);
  const screenBounceRef = useRef<ScreenBounceSample>({
    r: 0.72,
    g: 0.8,
    b: 0.95,
    luminance: 0.25,
  });
  const fourDxFlashRef = useRef({ level: 0, color: '#7dd3fc' });
  const fourDxTelemetryRef = useRef<FourDxLiveTelemetry>(createInitialFourDxTelemetry());
  const lastLightUpdateRef = useRef(0);
  const screenBounceUniforms = useMemo(
    () =>
      createScreenBounceUniforms(
        config.screenPosition,
        config.screenWidth,
        config.screenHeight,
      ),
    [config.screenPosition, config.screenWidth, config.screenHeight],
  );

  // Throttle React prop updates for emissive architecture strips so we don't cause excessive re-renders
  const handleLightFactorChange = useCallback((f: number) => {
    const now = performance.now();
    if (now - lastLightUpdateRef.current > 60 || f === 0 || f === 1) {
      lastLightUpdateRef.current = now;
      setLightFactor((prev) => (Math.abs(prev - f) > 0.02 || f === 0 || f === 1 ? f : prev));
    }
  }, []);

  if (!webglInfo.supported) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-[#070709] p-8 text-center">
        <h2 className="font-display text-3xl text-[#F4F1EA]">WebGL Rendering Unavailable</h2>
        <p className="mt-3 max-w-md text-sm text-neutral-400">
          Your browser or graphics driver currently has WebGL disabled. Enable hardware acceleration
          in browser settings to enter the 3D auditorium.
        </p>
      </div>
    );
  }

  // Cap Retina/4K/fullscreen laptop pixel ratio cleanly at 1:1 native resolution so video decode & WebGL stay 60fps smooth
  const isMobile = isMobileDevice();
  const isLargeViewport = viewportPixels >= 1_050_000;
  const dpr: number | [number, number] = webglInfo.isSoftwareGl
    ? 0.75
    : isMobile
      ? graphicsQuality === 'low'
        ? [1, 1.0]
        : graphicsQuality === 'medium'
          ? [1, 1.15]
          : [1, 1.25]
      : isFullscreen || isLargeViewport
        ? 1
        : graphicsQuality === 'low'
          ? 1
          : graphicsQuality === 'medium'
            ? [1, 1.2]
            : [1, 1.35];

  const initialFov = computeAdaptiveCinemaFov(
    config.categoryId,
    typeof window !== 'undefined' ? window.innerWidth : 1280,
    typeof window !== 'undefined' ? window.innerHeight : 720,
  );

  const isPlaying = showState === 'SHOW_PLAYING';
  const isActivelyPlaying = isPlaying && !isPaused;
  const pauseThreeForNativeFull =
    viewMode === 'screen_full' &&
    (showState === 'SHOW_PLAYING' || showState === 'SHOW_COMPLETED');
  const active4dxVibration =
    config.supports4dxEffects && fourDxSettings.enabled && isActivelyPlaying
      ? fourDxSettings.vibrationIntensity
      : 0;
  const active4dxCamera =
    config.supports4dxEffects && fourDxSettings.enabled && isActivelyPlaying
      ? fourDxSettings.cameraMotionIntensity
      : 0;
  const fourDxActive = Boolean(config.supports4dxEffects && fourDxSettings.enabled);

  return (
    <div className="relative h-full w-full bg-[#030305] touch-none select-none">
      {contextLost && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/90 p-6 text-center">
          <p className="font-display text-2xl text-[#F4F1EA]">Graphics Context Interrupted</p>
          <p className="mt-2 text-sm text-neutral-400">
            Waiting for WebGL context restoration...
          </p>
        </div>
      )}

      <Canvas
        frameloop={pauseThreeForNativeFull ? 'demand' : 'always'}
        shadows={!webglInfo.isSoftwareGl && graphicsQuality === 'high' && !isMobile && !isFullscreen}
        dpr={dpr}
        gl={{
          antialias: !webglInfo.isSoftwareGl && graphicsQuality !== 'low',
          stencil: false,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.05,
        }}
        camera={{
          fov: initialFov,
          near: 0.1,
          far: config.categoryId === 'beach' ? 2600 : 140,
        }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = THREE.SRGBColorSpace;
          const canvas = gl.domElement;
          canvas.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            setContextLost(true);
          });
          canvas.addEventListener('webglcontextrestored', () => {
            setContextLost(false);
          });
          onSceneReady();
        }}
      >
        <CinemaLightingRig
          config={config}
          showState={showState}
          openLightingPreset={openLightingPreset}
          isPaused={isPaused}
          isFullscreen={isFullscreen}
          isSoftwareGl={webglInfo.isSoftwareGl || graphicsQuality === 'low'}
          onLightFactorChange={handleLightFactorChange}
          fourDxFlashRef={fourDxFlashRef}
          screenBounceRef={screenBounceRef}
          screenReflectionBrightness={screenReflectionBrightness}
        />

        <AuditoriumShell
          config={config}
          lightFactor={lightFactor}
          screenBounceUniforms={screenBounceUniforms}
          screenBounceRef={screenBounceRef}
          isSoftwareGl={webglInfo.isSoftwareGl || graphicsQuality === 'low'}
        />

        <EntranceCorridor3D
          config={config}
          seatId={selectedSeat.id}
          showState={showState}
          lightFactor={lightFactor}
          entranceComplete={entranceComplete}
          corridorStateRef={corridorStateRef}
          onScanClick={onRequestScanTicket}
        />

        <SeatModels
          config={config}
          seats={seats}
          selectedSeatId={selectedSeat.id}
          hoveredSeatId={hoveredSeatId}
          fourDxVibration={active4dxVibration}
          fourDxTelemetryRef={fourDxTelemetryRef}
          isPlaying={isPlaying}
          lightFactor={lightFactor}
          viewMode={viewMode}
          interactive={
            entranceComplete && viewMode !== 'screen_full' && viewMode !== 'walk'
          }
          enableHover={!isMobile && entranceComplete && viewMode === 'hall'}
          screenBounceUniforms={screenBounceUniforms}
          onSelectSeat={onSelectSeat}
          onHoverSeat={onHoverSeat}
        />

        <CinemaScreen
          config={config}
          videoElementA={videoElementA}
          videoElementB={videoElementB}
          activeDeck={activeDeck}
          videoAspectRatio={videoAspectRatio}
          screenFraming={screenFraming}
          showState={showState}
          isPaused={isPaused}
          isFullscreen={isFullscreen}
          isSoftwareGl={webglInfo.isSoftwareGl || graphicsQuality === 'low'}
          screenBrightnessRef={screenBrightnessRef}
          screenBounceRef={screenBounceRef}
          screenBounceUniforms={screenBounceUniforms}
          lightFactor={lightFactor}
          screenReflectionBrightness={screenReflectionBrightness}
          fourDxTelemetryRef={fourDxTelemetryRef}
          fourDxActive={fourDxActive}
        />

        {config.supports4dxEffects && (
          <FourDxEffectsRig
            config={config}
            enabled={fourDxSettings.enabled}
            isPlaying={isActivelyPlaying}
            intensity={fourDxSettings.vibrationIntensity}
            atmosphericLightEnabled={fourDxSettings.atmosphericLightEnabled}
            fourDxFlashRef={fourDxFlashRef}
            fourDxTelemetryRef={fourDxTelemetryRef}
          />
        )}

        <FirstPersonCameraRig
          config={config}
          seat={selectedSeat}
          viewMode={viewMode}
          entranceComplete={entranceComplete}
          onEntranceComplete={onEntranceComplete}
          resetViewSignal={resetViewSignal}
          skipWalkSignal={skipWalkSignal}
          scanTicketSignal={scanTicketSignal}
          corridorStateRef={corridorStateRef}
          onCorridorPhaseChange={onCorridorPhaseChange}
          isPlaying={isActivelyPlaying}
          isSoftwareGl={webglInfo.isSoftwareGl}
          fourDxCameraIntensity={active4dxCamera}
          fourDxTelemetryRef={fourDxTelemetryRef}
          walkInputRef={walkInputRef}
        />

        {config.categoryId === 'beach' && (
          <BeachPositionalAudioRig
            audioSettings={audioSettings}
            showState={showState}
            isPaused={isPaused}
            hasCampfire={config.theaterId === 'beach'}
            isBioluminescent={config.theaterId === 'beach_bioluminescent'}
          />
        )}

        {config.theaterId === 'beach_bioluminescent' &&
          !webglInfo.isSoftwareGl &&
          graphicsQuality !== 'low' && <BioluminescentBloomComposer />}
      </Canvas>
    </div>
  );
});
