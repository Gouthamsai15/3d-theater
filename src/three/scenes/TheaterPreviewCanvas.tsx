import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { TheaterConfiguration } from '../../types/cinema';
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

const PreviewOrbitRig: React.FC<{
  config: TheaterConfiguration;
  isSoftwareGl: boolean;
}> = ({ config, isSoftwareGl }) => {
  const { camera, size, gl } = useThree();

  useEffect(() => {
    gl.domElement.style.touchAction = 'none';
  }, [gl]);

  const isDeccan = config.theaterId === 'dolby_deccan';
  const isKinetic4dx = config.theaterId === '4dx_kinetic_250';

  useEffect(() => {
    const persp = camera as THREE.PerspectiveCamera;
    const baseFov = computeAdaptiveCinemaFov(config.categoryId, size.width, size.height);
    const nextFov = isDeccan ? Math.max(baseFov, 66) : isKinetic4dx ? Math.max(baseFov, 66) : baseFov;
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

  useFrame(() => {
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
      target={
        isDeccan
          ? [0, 4.75, -7.5]
          : isKinetic4dx
            ? [0, 4.75, -8.8]
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
      onChange={clampCamera}
    />
  );
};

export const TheaterPreviewCanvas: React.FC<TheaterPreviewCanvasProps> = ({ config }) => {
  const webglInfo = useMemo(() => detectWebGLSupport(), []);
  const seats = useMemo(() => generateSeatsForTheater(config), [config]);
  const screenBrightnessRef = useRef(0.35);

  const isKinetic4dx = config.theaterId === '4dx_kinetic_250';

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
      ? 5.15
      : Math.min(
          config.auditoriumHeight - 1.1,
          (config.seatingRows - 1) * config.rowElevationStep + 2.4,
        );
  const rearZ = isDeccan
    ? 13.85
    : isKinetic4dx
      ? 9.6
      : Math.min(config.auditoriumLength / 2 - 0.9, config.auditoriumLength * 0.3);
  const initialCamX = isDeccan || isKinetic4dx ? 0 : config.auditoriumWidth * 0.22;
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
          fov: isDeccan ? Math.max(baseFov, 66) : isKinetic4dx ? Math.max(baseFov, 66) : baseFov,
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
        />
        {config.theaterId === 'beach_bioluminescent' && !webglInfo.isSoftwareGl && (
          <BioluminescentBloomComposer />
        )}
      </Canvas>
    </div>
  );
};
