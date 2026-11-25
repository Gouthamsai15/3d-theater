import React, { ComponentRef, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { PreviewCameraPreset, TheaterConfiguration } from '../../types/cinema';
import { generateSeatsForTheater } from '../../config/seating/seatGenerator';
import { AuditoriumShell } from '../models/AuditoriumShell';
import { SeatModels } from '../models/SeatModels';
import { CinemaScreen } from '../models/CinemaScreen';
import {
  BioluminescentBloomComposer,
  CinemaLightingRig,
} from '../lighting/CinemaLightingRig';
import { beachHeightAt } from '../models/beachTerrain';
import { getTheaterCameraPresetPose } from '../cameras/cameraPresets';
import { computeAdaptiveCinemaFov, detectWebGLSupport, isMobileDevice } from '../../utils/formatters';

interface TheaterPreviewCanvasProps {
  config: TheaterConfiguration;
}

const PreviewOrbitRig: React.FC<{
  config: TheaterConfiguration;
  isSoftwareGl: boolean;
  preset: PreviewCameraPreset;
  presetSignal: number;
}> = ({ config, isSoftwareGl, preset, presetSignal }) => {
  const { camera, size, gl } = useThree();
  const controlsRef = useRef<ComponentRef<typeof OrbitControls>>(null);
  const initialPose = useMemo(
    () => getTheaterCameraPresetPose(config, 'overview'),
    [config],
  );
  const targetPosRef = useRef(new THREE.Vector3(...initialPose.position));
  const targetLookRef = useRef(new THREE.Vector3(...initialPose.target));
  const isTransitioningRef = useRef(false);

  useEffect(() => {
    gl.domElement.style.touchAction = 'none';
  }, [gl]);

  const isDeccan = config.theaterId === 'dolby_deccan';
  const isKinetic4dx = config.theaterId === '4dx_kinetic_250';
  const isTreeOfLife = config.theaterId === 'imax_tree_of_life';

  useEffect(() => {
    const pose = getTheaterCameraPresetPose(config, preset);
    targetPosRef.current.set(...pose.position);
    targetLookRef.current.set(...pose.target);
    if (presetSignal > 0) {
      isTransitioningRef.current = true;
    } else if (controlsRef.current) {
      camera.position.copy(targetPosRef.current);
      controlsRef.current.target.copy(targetLookRef.current);
      controlsRef.current.update();
    }
  }, [config, preset, presetSignal, camera]);

  useEffect(() => {
    const persp = camera as THREE.PerspectiveCamera;
    const baseFov = computeAdaptiveCinemaFov(config.categoryId, size.width, size.height);
    const nextFov = isDeccan || isKinetic4dx ? Math.max(baseFov, 66) : baseFov;
    if (Math.abs(persp.fov - nextFov) > 0.05) {
      persp.fov = nextFov;
      persp.updateProjectionMatrix();
    }
  }, [camera, config.categoryId, isDeccan, isKinetic4dx, size.width, size.height]);

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
    if (isTransitioningRef.current && controlsRef.current) {
      const dt = Math.min(delta, 0.05);
      camera.position.x = THREE.MathUtils.damp(
        camera.position.x,
        targetPosRef.current.x,
        5.5,
        dt,
      );
      camera.position.y = THREE.MathUtils.damp(
        camera.position.y,
        targetPosRef.current.y,
        5.5,
        dt,
      );
      camera.position.z = THREE.MathUtils.damp(
        camera.position.z,
        targetPosRef.current.z,
        5.5,
        dt,
      );
      controlsRef.current.target.x = THREE.MathUtils.damp(
        controlsRef.current.target.x,
        targetLookRef.current.x,
        5.5,
        dt,
      );
      controlsRef.current.target.y = THREE.MathUtils.damp(
        controlsRef.current.target.y,
        targetLookRef.current.y,
        5.5,
        dt,
      );
      controlsRef.current.target.z = THREE.MathUtils.damp(
        controlsRef.current.target.z,
        targetLookRef.current.z,
        5.5,
        dt,
      );
      controlsRef.current.update();

      if (
        camera.position.distanceTo(targetPosRef.current) < 0.04 &&
        controlsRef.current.target.distanceTo(targetLookRef.current) < 0.04
      ) {
        isTransitioningRef.current = false;
      }
    }
    clampCamera();
  });

  const maxDist = isBeach
    ? 24
    : isDeccan || isKinetic4dx || isTreeOfLife
      ? 25
      : Math.max(
          3.2,
          Math.min(config.auditoriumWidth * 0.45, config.auditoriumLength * 0.48),
        );

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enablePan={false}
      enableDamping={!isSoftwareGl}
      dampingFactor={0.075}
      rotateSpeed={isMobileDevice() ? 0.62 : 0.72}
      minDistance={isKinetic4dx ? 1.8 : 2.8}
      maxDistance={maxDist}
      maxPolarAngle={Math.PI * 0.58}
      minPolarAngle={0.22}
      onStart={() => {
        isTransitioningRef.current = false;
      }}
      onChange={clampCamera}
    />
  );
};

export const TheaterPreviewCanvas: React.FC<TheaterPreviewCanvasProps> = ({ config }) => {
  const webglInfo = useMemo(() => detectWebGLSupport(), []);
  const seats = useMemo(() => generateSeatsForTheater(config), [config]);
  const screenBrightnessRef = useRef(0.35);
  const [preset, setPreset] = useState<PreviewCameraPreset>('overview');
  const [presetSignal, setPresetSignal] = useState(0);

  useEffect(() => {
    setPreset('overview');
    setPresetSignal(0);
  }, [config.theaterId]);

  const isKinetic4dx = config.theaterId === '4dx_kinetic_250';
  const isDeccan = config.theaterId === 'dolby_deccan';
  const isTreeOfLife = config.theaterId === 'imax_tree_of_life';

  if (!webglInfo.supported) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#0b0c10] p-6 text-center text-sm text-neutral-400">
        Interactive 3D preview requires WebGL. Static architectural preview remains available.
      </div>
    );
  }

  const initialPose = useMemo(
    () => getTheaterCameraPresetPose(config, 'overview'),
    [config],
  );
  const baseFov = computeAdaptiveCinemaFov(
    config.categoryId,
    typeof window !== 'undefined' ? window.innerWidth : 900,
    typeof window !== 'undefined' ? window.innerHeight : 600,
  );

  const handleSelectPreset = (next: PreviewCameraPreset) => {
    setPreset(next);
    setPresetSignal((s) => s + 1);
  };

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
          position: initialPose.position,
          fov: isDeccan || isKinetic4dx ? Math.max(baseFov, 66) : baseFov,
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
        />
        <AuditoriumShell
          config={config}
          lightFactor={1}
          isSoftwareGl={webglInfo.isSoftwareGl}
        />
        <SeatModels
          config={config}
          seats={seats}
          selectedSeatId={null}
          fourDxVibration={0}
          isPlaying={false}
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
          preset={preset}
          presetSignal={presetSignal}
        />
        {config.theaterId === 'beach_bioluminescent' && !webglInfo.isSoftwareGl && (
          <BioluminescentBloomComposer />
        )}
      </Canvas>

      {/* Camera View Presets */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute bottom-3 right-3 z-20 flex items-center gap-1 rounded-md border border-white/15 bg-[#090A0E]/92 p-1 text-[11px] shadow-lg"
      >
        {(
          [
            { id: 'overview', label: 'Overview' },
            { id: 'sweet_spot', label: 'Sweet Spot' },
            { id: 'side_wall', label: isTreeOfLife ? 'Tree Wall' : 'Side Wall' },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => handleSelectPreset(item.id)}
            className={`rounded px-2.5 py-1 font-medium transition-colors cursor-pointer whitespace-nowrap ${
              preset === item.id
                ? 'bg-[#D4AF37] text-[#070709]'
                : 'text-neutral-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
};

