import React, { ComponentRef, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import {
  FourDxCameraPresetId,
  FourDxWallLedTheme,
  TheaterConfiguration,
} from '../../types/cinema';
import { generateSeatsForTheater } from '../../config/seating/seatGenerator';
import { AuditoriumShell } from '../models/AuditoriumShell';
import { SeatModels } from '../models/SeatModels';
import { CinemaScreen } from '../models/CinemaScreen';
import {
  BioluminescentBloomComposer,
  CinemaLightingRig,
} from '../lighting/CinemaLightingRig';
import { beachHeightAt } from '../models/beachTerrain';
import { computeAdaptiveCinemaFov, detectWebGLSupport, isMobileDevice } from '../../utils/formatters';

interface TheaterPreviewCanvasProps {
  config: TheaterConfiguration;
}

const FOUR_DX_CAMERA_PRESETS: {
  id: FourDxCameraPresetId;
  label: string;
  position: [number, number, number];
  target: [number, number, number];
}[] = [
  {
    id: 'overview',
    label: 'Overview',
    position: [5.4, 5.8, 10.6],
    target: [0, 3.8, -6.5],
  },
  {
    id: 'seat_pov',
    label: 'Center 4DX Seat POV',
    position: [0, 2.75, 5.65],
    target: [0, 4.7, -14.0],
  },
  {
    id: 'aisle',
    label: 'Front-to-Back Aisle',
    position: [-4.95, 4.6, 13.4],
    target: [-4.95, 2.2, -4.5],
  },
  {
    id: 'screen_stage',
    label: 'Screen & Stage',
    position: [0, 3.4, -3.2],
    target: [0, 4.4, -14.2],
  },
  {
    id: 'wall_speaker_rig',
    label: 'Wall & Speaker Rig',
    position: [-6.8, 4.2, 6.2],
    target: [9.6, 4.5, -2.5],
  },
];

const FOUR_DX_LED_THEMES: { id: FourDxWallLedTheme; label: string; dotColor: string }[] = [
  { id: 'idle', label: 'Idle / Movie Mode', dotColor: '#38bdf8' },
  { id: 'storm', label: 'Storm / Lightning', dotColor: '#818cf8' },
  { id: 'action', label: 'Action / Red-Amber', dotColor: '#f97316' },
  { id: 'underwater', label: 'Underwater / Cyan', dotColor: '#22d3ee' },
];

const _presetGoalPos = new THREE.Vector3();
const _presetGoalTarget = new THREE.Vector3();

const PreviewOrbitRig: React.FC<{
  config: TheaterConfiguration;
  isSoftwareGl: boolean;
  activePresetId?: FourDxCameraPresetId;
  presetTrigger?: number;
}> = ({ config, isSoftwareGl, activePresetId, presetTrigger = 0 }) => {
  const { camera, size, gl } = useThree();
  const orbitRef = useRef<ComponentRef<typeof OrbitControls>>(null);
  const transitioningRef = useRef(false);

  useEffect(() => {
    gl.domElement.style.touchAction = 'none';
  }, [gl]);

  const isDeccan = config.theaterId === 'dolby_deccan';
  const isKinetic4dx = config.theaterId === '4dx_kinetic_250';

  useEffect(() => {
    const persp = camera as THREE.PerspectiveCamera;
    const baseFov = computeAdaptiveCinemaFov(config.categoryId, size.width, size.height);
    const nextFov = isDeccan ? Math.max(baseFov, 66) : baseFov;
    if (Math.abs(persp.fov - nextFov) > 0.05) {
      persp.fov = nextFov;
      persp.updateProjectionMatrix();
    }
  }, [camera, config.categoryId, isDeccan, size.width, size.height]);

  useEffect(() => {
    if (!isKinetic4dx || presetTrigger === 0) return;
    transitioningRef.current = true;
  }, [isKinetic4dx, activePresetId, presetTrigger]);

  const isBeach = config.environmentProfile.architectureStyle === 'beach';

  const clampCamera = () => {
    if (isBeach) {
      const maxHalfX = 24;
      const minZ = config.screenPosition[2] + 1.5;
      const maxZ = 22;
      camera.position.x = THREE.MathUtils.clamp(camera.position.x, -maxHalfX, maxHalfX);
      camera.position.z = THREE.MathUtils.clamp(camera.position.z, minZ, maxZ);
      const variant =
        config.theaterId === 'beach_bioluminescent' ? 'bioluminescent' : 'sunset';
      const floorY = beachHeightAt(camera.position.x, camera.position.z, variant);
      camera.position.y = THREE.MathUtils.clamp(camera.position.y, floorY + 0.72, 18);
      return;
    }

    const maxHalfX = Math.max(1.2, config.auditoriumWidth / 2 - 0.72);
    const minZ = config.screenPosition[2] + 1.25;
    const maxZ = config.auditoriumLength / 2 - 0.72;
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -maxHalfX, maxHalfX);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, minZ, maxZ);

    let floorY = 0;
    if (camera.position.z >= config.firstRowZ - config.rowSpacing * 0.5) {
      const r = THREE.MathUtils.clamp(
        Math.round((camera.position.z - config.firstRowZ) / Math.max(0.5, config.rowSpacing)),
        0,
        Math.max(0, config.seatingRows - 1),
      );
      floorY = r * config.rowElevationStep;
    }
    const minY = floorY + 0.85;
    const maxY = Math.max(minY + 0.5, config.auditoriumHeight - 0.75);
    camera.position.y = THREE.MathUtils.clamp(camera.position.y, minY, maxY);
  };

  useFrame((_, delta) => {
    if (transitioningRef.current && isKinetic4dx && orbitRef.current && activePresetId) {
      const preset = FOUR_DX_CAMERA_PRESETS.find((p) => p.id === activePresetId);
      if (preset) {
        const dt = Math.min(delta, 0.05);
        _presetGoalPos.set(...preset.position);
        _presetGoalTarget.set(...preset.target);
        camera.position.x = THREE.MathUtils.damp(camera.position.x, _presetGoalPos.x, 6.5, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, _presetGoalPos.y, 6.5, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, _presetGoalPos.z, 6.5, dt);
        orbitRef.current.target.x = THREE.MathUtils.damp(orbitRef.current.target.x, _presetGoalTarget.x, 6.5, dt);
        orbitRef.current.target.y = THREE.MathUtils.damp(orbitRef.current.target.y, _presetGoalTarget.y, 6.5, dt);
        orbitRef.current.target.z = THREE.MathUtils.damp(orbitRef.current.target.z, _presetGoalTarget.z, 6.5, dt);
        orbitRef.current.update();
        if (
          camera.position.distanceToSquared(_presetGoalPos) < 0.002 &&
          orbitRef.current.target.distanceToSquared(_presetGoalTarget) < 0.002
        ) {
          camera.position.copy(_presetGoalPos);
          orbitRef.current.target.copy(_presetGoalTarget);
          orbitRef.current.update();
          transitioningRef.current = false;
        }
      } else {
        transitioningRef.current = false;
      }
    }
    clampCamera();
  });

  const maxDist = isBeach
    ? 24
    : isDeccan || isKinetic4dx
      ? 24
      : Math.max(
          3.2,
          Math.min(config.auditoriumWidth * 0.45, config.auditoriumLength * 0.48),
        );

  return (
    <OrbitControls
      ref={orbitRef}
      target={
        isDeccan
          ? [0, 4.75, -7.5]
          : isKinetic4dx
            ? [0, 3.8, -6.5]
            : [
                0,
                Math.min(config.screenPosition[1] * 0.5, config.auditoriumHeight * 0.45),
                -config.auditoriumLength * 0.06,
              ]
      }
      enablePan={false}
      enableDamping={!isSoftwareGl}
      dampingFactor={0.075}
      rotateSpeed={isMobileDevice() ? 0.62 : 0.72}
      minDistance={isKinetic4dx ? 1.8 : 2.8}
      maxDistance={maxDist}
      maxPolarAngle={Math.PI * 0.58}
      minPolarAngle={0.22}
      onStart={() => {
        transitioningRef.current = false;
      }}
      onChange={clampCamera}
    />
  );
};

export const TheaterPreviewCanvas: React.FC<TheaterPreviewCanvasProps> = ({ config }) => {
  const webglInfo = useMemo(() => detectWebGLSupport(), []);
  const seats = useMemo(() => generateSeatsForTheater(config), [config]);
  const screenBrightnessRef = useRef(0.35);

  const isKinetic4dx = config.theaterId === '4dx_kinetic_250';
  const [presetId, setPresetId] = useState<FourDxCameraPresetId>('overview');
  const [presetTrigger, setPresetTrigger] = useState(0);
  const [motionTestActive, setMotionTestActive] = useState(false);
  const [motionIntensity, setMotionIntensity] = useState(0.75);
  const [wallLedTheme, setWallLedTheme] = useState<FourDxWallLedTheme>('idle');
  const [effectLightIntensity, setEffectLightIntensity] = useState(0.85);
  const [dockOpen, setDockOpen] = useState(true);

  if (!webglInfo.supported) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#0b0c10] p-6 text-center text-sm text-neutral-400">
        Interactive 3D preview requires WebGL. Static architectural preview remains available.
      </div>
    );
  }

  const isDeccan = config.theaterId === 'dolby_deccan';
  const rearY = isDeccan
    ? 6.05
    : isKinetic4dx
      ? 5.8
      : Math.min(
          config.auditoriumHeight - 1.1,
          (config.seatingRows - 1) * config.rowElevationStep + 2.4,
        );
  const rearZ = isDeccan
    ? 13.85
    : isKinetic4dx
      ? 10.6
      : Math.min(config.auditoriumLength / 2 - 0.9, config.auditoriumLength * 0.3);
  const initialCamX = isDeccan ? 0 : isKinetic4dx ? 5.4 : config.auditoriumWidth * 0.22;
  const baseFov = computeAdaptiveCinemaFov(
    config.categoryId,
    typeof window !== 'undefined' ? window.innerWidth : 900,
    typeof window !== 'undefined' ? window.innerHeight : 600,
  );

  return (
    <div className="relative h-full w-full">
      <Canvas
        dpr={webglInfo.isSoftwareGl ? 0.75 : isMobileDevice() ? [1, 1.25] : [1, 1.75]}
        gl={{
          antialias: !webglInfo.isSoftwareGl,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.05,
        }}
        camera={{
          position: [initialCamX, rearY, rearZ],
          fov: isDeccan ? Math.max(baseFov, 66) : baseFov,
          near: 0.1,
          far: config.categoryId === 'beach' ? 2400 : 120,
        }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
      >
        <CinemaLightingRig
          config={config}
          showState="AUDITORIUM_OPEN"
          isSoftwareGl={webglInfo.isSoftwareGl}
          effectLightIntensity={isKinetic4dx ? effectLightIntensity : undefined}
          wallLedTheme={isKinetic4dx ? wallLedTheme : undefined}
        />
        <AuditoriumShell
          config={config}
          lightFactor={1}
          wallLedTheme={isKinetic4dx ? wallLedTheme : undefined}
          effectLightIntensity={isKinetic4dx ? effectLightIntensity : undefined}
          motionTestActive={isKinetic4dx ? motionTestActive : undefined}
          isSoftwareGl={webglInfo.isSoftwareGl}
        />
        <SeatModels
          config={config}
          seats={seats}
          selectedSeatId={null}
          fourDxVibration={0}
          isPlaying={false}
          motionTestActive={isKinetic4dx ? motionTestActive : undefined}
          motionTestIntensity={isKinetic4dx ? motionIntensity : undefined}
          wallLedTheme={isKinetic4dx ? wallLedTheme : undefined}
          interactive={false}
        />
        <CinemaScreen
          config={config}
          videoElementA={null}
          videoElementB={null}
          activeDeck="A"
          videoAspectRatio={config.screenWidth / config.screenHeight}
          screenFraming="fill"
          showState="AUDITORIUM_OPEN"
          isSoftwareGl={webglInfo.isSoftwareGl}
          screenBrightnessRef={screenBrightnessRef}
        />
        <PreviewOrbitRig
          config={config}
          isSoftwareGl={webglInfo.isSoftwareGl}
          activePresetId={isKinetic4dx ? presetId : undefined}
          presetTrigger={isKinetic4dx ? presetTrigger : 0}
        />
        {config.theaterId === 'beach_bioluminescent' && !webglInfo.isSoftwareGl && (
          <BioluminescentBloomComposer />
        )}
      </Canvas>

      {isKinetic4dx && (
        <>
          <button
            type="button"
            onClick={() => setDockOpen((prev) => !prev)}
            className="absolute right-3 top-3 z-10 rounded-md border border-white/15 bg-[#0c1018]/92 px-2.5 py-1 text-[11px] font-medium tracking-wide text-slate-200 transition-colors hover:border-sky-400/50 hover:text-white"
          >
            {dockOpen ? 'Hide 4DX Demo Controls' : '4DX Demo Controls'}
          </button>

          {dockOpen && (
            <div className="absolute bottom-3 right-3 z-10 flex w-[min(560px,calc(100%-184px))] flex-col gap-2 rounded-lg border border-white/15 bg-[#0c1018]/94 p-2.5 text-[11px] text-slate-200 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-white/10 pb-2">
                <span className="font-semibold uppercase tracking-wider text-slate-400">
                  Camera
                </span>
                <div className="flex flex-wrap gap-1">
                  {FOUR_DX_CAMERA_PRESETS.map((p) => {
                    const active = presetId === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setPresetId(p.id);
                          setPresetTrigger((n) => n + 1);
                        }}
                        className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                          active
                            ? 'bg-sky-500/25 text-sky-200 ring-1 ring-sky-400/60'
                            : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold uppercase tracking-wider text-slate-400">
                      4DX Motion
                    </span>
                    <button
                      type="button"
                      onClick={() => setMotionTestActive((v) => !v)}
                      className={`rounded px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${
                        motionTestActive
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-white/10 text-slate-200 hover:bg-white/20'
                      }`}
                    >
                      {motionTestActive ? 'Motion Test: ON' : '4DX Motion Test'}
                    </button>
                  </div>
                  <label className="flex items-center gap-2 text-slate-300">
                    <span className="w-20 shrink-0 text-[10px] text-slate-400">Motion Gain</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round(motionIntensity * 100)}
                      onChange={(e) => setMotionIntensity(Number(e.target.value) / 100)}
                      className="h-1.5 w-full cursor-pointer accent-sky-400"
                    />
                    <span className="w-8 text-right tabular-nums text-[10px] text-slate-300">
                      {Math.round(motionIntensity * 100)}%
                    </span>
                  </label>
                  <label className="flex items-center gap-2 text-slate-300">
                    <span className="w-20 shrink-0 text-[10px] text-slate-400">Effect Light</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round(effectLightIntensity * 100)}
                      onChange={(e) => setEffectLightIntensity(Number(e.target.value) / 100)}
                      className="h-1.5 w-full cursor-pointer accent-sky-400"
                    />
                    <span className="w-8 text-right tabular-nums text-[10px] text-slate-300">
                      {Math.round(effectLightIntensity * 100)}%
                    </span>
                  </label>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="font-semibold uppercase tracking-wider text-slate-400">
                    Wall LED Theme
                  </span>
                  <div className="grid grid-cols-2 gap-1">
                    {FOUR_DX_LED_THEMES.map((theme) => {
                      const active = wallLedTheme === theme.id;
                      return (
                        <button
                          key={theme.id}
                          type="button"
                          onClick={() => setWallLedTheme(theme.id)}
                          className={`flex items-center gap-1.5 rounded px-2 py-1 text-left text-[11px] font-medium transition-colors ${
                            active
                              ? 'bg-white/15 text-white ring-1 ring-white/40'
                              : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <span
                            className="inline-block h-2 w-2 shrink-0 rounded-sm"
                            style={{ backgroundColor: theme.dotColor }}
                          />
                          <span className="truncate">{theme.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
