import React, { ComponentRef, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import gsap from 'gsap';
import {
  CameraViewMode,
  PreviewCameraPreset,
  SeatData,
  TheaterConfiguration,
  WalkInputState,
} from '../../types/cinema';
import { getTheaterCameraPresetPose } from './cameraPresets';
import { cinemaAudioEngine } from '../../services/audio/cinemaAudioEngine';
import { computeAdaptiveCinemaFov, isMobileDevice } from '../../utils/formatters';
import {
  BEACH_WATER_Y,
  beachHeightAt,
  beachShorelineZ,
} from '../models/beachTerrain';
import {
  BEACH_CAMPFIRE_POS,
  BEACH_SURF_RACK_POS,
  BEACH_TIKI_SHACK_POS,
  CAMPFIRE_BENCH_SPECS,
} from '../models/BeachEnvironment';
import { FourDxLiveTelemetry } from '../models/fourDxTelemetry';
import {
  CorridorAnimationState,
  CorridorPhase,
  getCorridorThemeConfig,
} from '../models/corridorThemes';

const _listenerFwd = new THREE.Vector3();
const _listenerUp = new THREE.Vector3();
const _walkForwardVec = new THREE.Vector3();
const _walkRightVec = new THREE.Vector3();

const WALK_EYE_HEIGHT = 1.62;
const WALK_SPEED = 2.9;
const WALK_SPRINT_SPEED = 4.9;
const WALK_TURN_SPEED = 1.65;

interface FirstPersonCameraRigProps {
  config: TheaterConfiguration;
  seat: SeatData;
  viewMode: CameraViewMode;
  entranceComplete: boolean;
  onEntranceComplete: () => void;
  resetViewSignal: number;
  skipWalkSignal: number;
  scanTicketSignal: number;
  corridorStateRef: React.MutableRefObject<CorridorAnimationState>;
  onCorridorPhaseChange?: (phase: CorridorPhase) => void;
  isPlaying: boolean;
  isSoftwareGl?: boolean;
  fourDxCameraIntensity: number; // 0..1
  fourDxTelemetryRef?: React.MutableRefObject<FourDxLiveTelemetry>;
  walkInputRef?: React.MutableRefObject<WalkInputState>;
  hallPreset?: PreviewCameraPreset;
  hallPresetSignal?: number;
}

function getWalkFloorHeight(
  x: number,
  z: number,
  config: TheaterConfiguration,
): number {
  const isBeach = config.environmentProfile.architectureStyle === 'beach';
  if (isBeach) {
    const variant =
      config.theaterId === 'beach_bioluminescent' ? 'bioluminescent' : 'sunset';
    return Math.max(BEACH_WATER_Y + 0.14, beachHeightAt(x, z, variant));
  }

  const rows = Math.max(1, config.seatingRows);
  const spacing = Math.max(0.5, config.rowSpacing);
  const step = config.rowElevationStep;
  const frontStartZ = config.firstRowZ - spacing * 0.5;
  const riserHalfBand = Math.min(0.16, spacing * 0.15);

  if (z <= frontStartZ - riserHalfBand) {
    return 0;
  }

  // Smoothly interpolate across each stepped tier riser (row 0 .. rows - 1)
  for (let r = 1; r < rows; r++) {
    const riserZ = config.firstRowZ + (r - 0.5) * spacing;
    if (Math.abs(z - riserZ) <= riserHalfBand) {
      const t = THREE.MathUtils.smoothstep(
        z,
        riserZ - riserHalfBand,
        riserZ + riserHalfBand,
      );
      return ((r - 1) + t) * step;
    }
  }

  const rowIdx = THREE.MathUtils.clamp(
    Math.floor((z - frontStartZ) / spacing),
    0,
    rows - 1,
  );
  return rowIdx * step;
}

function pushOutCircle(
  pos: { x: number; z: number },
  cx: number,
  cz: number,
  minRadius: number,
) {
  const dx = pos.x - cx;
  const dz = pos.z - cz;
  const dist = Math.hypot(dx, dz);
  if (dist < minRadius) {
    if (dist > 1e-4) {
      const s = minRadius / dist;
      pos.x = cx + dx * s;
      pos.z = cz + dz * s;
    } else {
      pos.z = cz + minRadius;
    }
  }
}

function pushOutBox(
  pos: { x: number; z: number },
  cx: number,
  cz: number,
  halfW: number,
  halfD: number,
) {
  const dx = pos.x - cx;
  const dz = pos.z - cz;
  if (Math.abs(dx) < halfW && Math.abs(dz) < halfD) {
    const penX = halfW - Math.abs(dx);
    const penZ = halfD - Math.abs(dz);
    if (penX < penZ) {
      pos.x = cx + (dx >= 0 ? 1 : -1) * halfW;
    } else {
      pos.z = cz + (dz >= 0 ? 1 : -1) * halfD;
    }
  }
}

function resolveWalkConstraints(
  pos: { x: number; z: number },
  config: TheaterConfiguration,
) {
  const isBeach = config.environmentProfile.architectureStyle === 'beach';
  if (isBeach) {
    const isBio = config.theaterId === 'beach_bioluminescent';
    pos.x = THREE.MathUtils.clamp(pos.x, -20.5, 20.5);
    const minShoreZ = Math.max(-16.5, beachShorelineZ(pos.x) - 0.55);
    pos.z = THREE.MathUtils.clamp(pos.z, minShoreZ, 13.4);

    // Avoid walking straight through Beach Projector Housing, Campfire/Benches, Tiki Shack, Surfboard Rack, or Screen Pillars
    pushOutCircle(pos, 0, isBio ? 9.0 : 8.6, 0.96);
    pushOutBox(pos, BEACH_TIKI_SHACK_POS.x, BEACH_TIKI_SHACK_POS.z, 1.72, 1.32);
    pushOutCircle(pos, BEACH_SURF_RACK_POS.x, BEACH_SURF_RACK_POS.z, 1.15);
    if (!isBio) {
      pushOutCircle(pos, -11.4, 0.6, 1.38);
      CAMPFIRE_BENCH_SPECS.forEach((b) => {
        pushOutCircle(
          pos,
          BEACH_CAMPFIRE_POS[0] + Math.cos(b.ang) * b.r,
          BEACH_CAMPFIRE_POS[2] + Math.sin(b.ang) * b.r,
          0.62,
        );
      });
    }
    const pillarHalfW = config.screenWidth * 0.5 + 0.45;
    pushOutCircle(pos, -pillarHalfW, config.screenPosition[2], 0.65);
    pushOutCircle(pos, pillarHalfW, config.screenPosition[2], 0.65);
    return;
  }

  const W = config.auditoriumWidth;
  const L = config.auditoriumLength;
  const backZ = L / 2;

  pos.x = THREE.MathUtils.clamp(pos.x, -W / 2 + 0.68, W / 2 - 0.68);
  pos.z = THREE.MathUtils.clamp(
    pos.z,
    config.screenPosition[2] + 1.18,
    backZ - 0.68,
  );

  // Rear suite bars / monolithic counters (allow standing right in front without clipping through)
  const sideLightStyle = config.sideLightStyle;
  if (sideLightStyle === 'private_volcanic_copper_ribbons') {
    pushOutBox(pos, W / 2 - 1.56, backZ - 0.44, 1.42, 0.52);
  } else if (sideLightStyle === 'champagne_fluted_oak_alcoves') {
    pushOutBox(pos, -1.05, backZ - 0.44, 2.28, 0.52);
  } else if (sideLightStyle === 'screenx_panoramic_walls') {
    pushOutBox(pos, W / 2 - 1.65, backZ - 0.52, 1.42, 0.58);
  }
}

function clampInsideHall(
  pos: { x: number; y: number; z: number },
  config: TheaterConfiguration,
) {
  const isBeach = config.environmentProfile.architectureStyle === 'beach';
  if (isBeach) {
    const maxHalfX = 24;
    const minZ = config.screenPosition[2] + 1.5;
    const maxZ = 22;
    pos.x = THREE.MathUtils.clamp(pos.x, -maxHalfX, maxHalfX);
    pos.z = THREE.MathUtils.clamp(pos.z, minZ, maxZ);

    const variant =
      config.theaterId === 'beach_bioluminescent' ? 'bioluminescent' : 'sunset';
    const floorY = beachHeightAt(pos.x, pos.z, variant);
    const minY = floorY + 0.72;
    const maxY = 18;
    pos.y = THREE.MathUtils.clamp(pos.y, minY, maxY);
    return;
  }

  const maxHalfX = Math.max(1.2, config.auditoriumWidth / 2 - 0.72);
  const minZ = config.screenPosition[2] + 1.25;
  const maxZ = config.auditoriumLength / 2 - 0.72;

  pos.x = THREE.MathUtils.clamp(pos.x, -maxHalfX, maxHalfX);
  pos.z = THREE.MathUtils.clamp(pos.z, minZ, maxZ);

  let floorY = 0;
  if (pos.z >= config.firstRowZ - config.rowSpacing * 0.5) {
    const r = THREE.MathUtils.clamp(
      Math.round((pos.z - config.firstRowZ) / Math.max(0.5, config.rowSpacing)),
      0,
      Math.max(0, config.seatingRows - 1),
    );
    floorY = r * config.rowElevationStep;
  }
  const minY = floorY + 0.85;
  const maxY = Math.max(minY + 0.5, config.auditoriumHeight - 0.75);
  pos.y = THREE.MathUtils.clamp(pos.y, minY, maxY);
}

export const FirstPersonCameraRig: React.FC<FirstPersonCameraRigProps> = ({
  config,
  seat,
  viewMode,
  entranceComplete,
  onEntranceComplete,
  resetViewSignal,
  skipWalkSignal,
  scanTicketSignal,
  corridorStateRef,
  onCorridorPhaseChange,
  isPlaying,
  isSoftwareGl = false,
  fourDxCameraIntensity,
  fourDxTelemetryRef,
  walkInputRef,
}) => {
  const { camera, gl, size } = useThree();
  const walkTimelineRef = useRef<gsap.core.Timeline | null>(null);
  const glideTweenRef = useRef<gsap.core.Tween | null>(null);
  const isGlidingRef = useRef(false);

  // Unlimited 360-degree yaw + comfortable pitch offset while seated or walking, with smooth inertia momentum
  const lookOffsetRef = useRef({
    yaw: 0,
    pitch: 0,
    targetYaw: 0,
    targetPitch: 0,
    yawVel: 0,
    pitchVel: 0,
  });
  const isDraggingRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);
  const isFirstTouchMoveRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0, timeMs: 0 });

  // Free-Walk physical state & keyboard tracking
  const walkPoseRef = useRef({
    x: 0,
    z: 0,
    groundY: 0,
    velX: 0,
    velZ: 0,
    stridePhase: 0,
  });
  const walkBaseAnglesRef = useRef({ yaw: 0, pitch: 0 });
  const pressedKeysRef = useRef<Set<string>>(new Set());

  const baseQuatRef = useRef(new THREE.Quaternion());
  const baseAnglesRef = useRef({ yaw: 0, pitch: 0 });
  const screenFullQuatRef = useRef(new THREE.Quaternion());
  const startQuatRef = useRef(new THREE.Quaternion());
  const lookEulerRef = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));
  const offsetEulerRef = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));
  const offsetQuatRef = useRef(new THREE.Quaternion());
  const lookTargetVec = useRef(new THREE.Vector3());

  const prevSeatIdRef = useRef<string>(seat.id);
  const prevViewModeRef = useRef<CameraViewMode>(viewMode);
  const entranceStartedRef = useRef(false);
  const scanTriggeredRef = useRef(false);
  const onEntranceCompleteRef = useRef(onEntranceComplete);
  onEntranceCompleteRef.current = onEntranceComplete;
  const onCorridorPhaseChangeRef = useRef(onCorridorPhaseChange);
  onCorridorPhaseChangeRef.current = onCorridorPhaseChange;

  // Compute exact base orientation pointing from seat.eyePosition to seat.lookAtTarget
  useEffect(() => {
    const dummyCam = new THREE.PerspectiveCamera();
    dummyCam.position.set(...seat.eyePosition);
    dummyCam.lookAt(...seat.lookAtTarget);
    baseQuatRef.current.copy(dummyCam.quaternion);

    const euler = new THREE.Euler().setFromQuaternion(dummyCam.quaternion, 'YXZ');
    baseAnglesRef.current = { yaw: euler.y, pitch: euler.x };

    const fullDummy = new THREE.PerspectiveCamera();
    const fov = computeAdaptiveCinemaFov(config.categoryId, size.width, size.height);
    const fovRad = THREE.MathUtils.degToRad(fov);
    const viewportAspect = size.width / Math.max(1, size.height);
    const halfH = config.screenHeight / 2;
    const halfW = config.screenWidth / 2;
    const distV = halfH / Math.tan(fovRad / 2);
    const hFovRad = 2 * Math.atan(Math.tan(fovRad / 2) * viewportAspect);
    const distH = halfW / Math.tan(hFovRad / 2);
    const idealDist = Math.max(distV, distH) * 1.02;
    const clampedZ = Math.min(
      config.auditoriumLength / 2 - 0.8,
      config.screenPosition[2] + idealDist,
    );

    fullDummy.position.set(config.screenPosition[0], config.screenPosition[1], clampedZ);
    fullDummy.lookAt(...config.screenPosition);
    screenFullQuatRef.current.copy(fullDummy.quaternion);
  }, [seat, config, size.width, size.height]);

  // Dynamically adapt FOV on viewport resize / mobile portrait-landscape orientation changes
  useEffect(() => {
    const persp = camera as THREE.PerspectiveCamera;
    const nextFov = computeAdaptiveCinemaFov(config.categoryId, size.width, size.height);
    if (Math.abs(persp.fov - nextFov) > 0.05) {
      persp.fov = nextFov;
      persp.updateProjectionMatrix();
    }
  }, [camera, config.categoryId, size.width, size.height]);

  // Initial Checkpoint Pose: Position guest in front of the theater's 3D Optical QR Turnstile holding their VIP Pass
  useEffect(() => {
    const persp = camera as THREE.PerspectiveCamera;
    persp.fov = computeAdaptiveCinemaFov(config.categoryId, size.width, size.height);
    persp.updateProjectionMatrix();

    if (entranceComplete || entranceStartedRef.current) {
      return;
    }
    entranceStartedRef.current = true;
    scanTriggeredRef.current = false;

    const theme = getCorridorThemeConfig(config);
    const isBeach = theme.isBeach;
    const beachVariant =
      config.theaterId === 'beach_bioluminescent' ? 'bioluminescent' : 'sunset';
    const backZ = config.auditoriumLength / 2;
    const topTierY = (config.seatingRows - 1) * config.rowElevationStep;
    const gateZ = isBeach ? 16.0 : backZ + 6.4;
    const startZ = gateZ + 2.45;
    const gateFloorY = isBeach
      ? beachHeightAt(0, gateZ, beachVariant) + 0.04
      : topTierY;
    const startFloorY = isBeach
      ? beachHeightAt(0, startZ, beachVariant) + 0.04
      : topTierY;

    corridorStateRef.current.phase = 'ticket_check';
    corridorStateRef.current.ticketScanT = 0;
    corridorStateRef.current.laserSweep = 0;
    corridorStateRef.current.laserActive = 0;
    corridorStateRef.current.verified = 0;
    corridorStateRef.current.scanFlash = 0;
    corridorStateRef.current.gateOpen = 0;
    corridorStateRef.current.ticketVisible = 1;
    corridorStateRef.current.doorOpen = 0;
    onCorridorPhaseChangeRef.current?.('ticket_check');

    camera.position.set(theme.portalX, startFloorY + 1.56, startZ);
    camera.lookAt(theme.portalX + 0.16, gateFloorY + 1.16, gateZ - 0.35);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, camera]);

  // Continuous 3D Entrance Sequence triggered by clicking Scan Ticket / 3D Pass / Scanner Gate
  useEffect(() => {
    if (entranceComplete || scanTicketSignal === 0 || scanTriggeredRef.current) {
      return;
    }
    scanTriggeredRef.current = true;

    const theme = getCorridorThemeConfig(config);
    const isBeach = theme.isBeach;
    const beachVariant =
      config.theaterId === 'beach_bioluminescent' ? 'bioluminescent' : 'sunset';
    const backZ = config.auditoriumLength / 2;
    const topTierY = (config.seatingRows - 1) * config.rowElevationStep;
    const portalZ = isBeach ? 12.2 : backZ + 0.08;
    const gateZ = isBeach ? 16.0 : backZ + 6.4;
    const gateFloorY = isBeach
      ? beachHeightAt(0, gateZ, beachVariant) + 0.04
      : topTierY;
    const portalFloorY = isBeach
      ? beachHeightAt(0, portalZ, beachVariant) + 0.04
      : topTierY;

    const st = corridorStateRef.current;
    st.phase = 'scanning';
    onCorridorPhaseChangeRef.current?.('scanning');

    const proxy = {
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z,
      lookX: theme.portalX + 0.16,
      lookY: gateFloorY + 1.16,
      lookZ: gateZ - 0.35,
    };

    const tl = gsap.timeline({
      onUpdate: () => {
        camera.position.set(proxy.x, proxy.y, proxy.z);
        lookTargetVec.current.set(proxy.lookX, proxy.lookY, proxy.lookZ);
        camera.lookAt(lookTargetVec.current);
      },
      onComplete: () => {
        st.phase = 'done';
        st.doorOpen = 0;
        st.gateOpen = 0;
        st.ticketVisible = 0;
        st.scanFlash = 0;
        onCorridorPhaseChangeRef.current?.('done');
        camera.position.set(...seat.eyePosition);
        camera.quaternion.copy(baseQuatRef.current);
        onEntranceCompleteRef.current();
      },
    });

    // 1. Hold pass QR stub under the cantilevered optical laser arch & lean naturally in
    tl.to(
      st,
      {
        ticketScanT: 1,
        duration: 0.44,
        ease: 'power2.inOut',
      },
      0,
    );
    tl.to(
      proxy,
      {
        x: theme.portalX + 0.12,
        y: gateFloorY + 1.44,
        z: gateZ + 1.42,
        lookX: theme.portalX + 0.44,
        lookY: gateFloorY + 1.07,
        lookZ: gateZ + 0.32,
        duration: 0.44,
        ease: 'power2.inOut',
      },
      0,
    );

    // 2. Overhead optical cyan laser curtain sweeps visibly across the front-facing QR squares
    tl.to(st, { laserActive: 1, duration: 0.05 }, 0.42);
    tl.to(
      st,
      {
        laserSweep: 1,
        duration: 0.45,
        ease: 'sine.inOut',
      },
      0.45,
    );

    // 3. Verified emerald optical confirmation flash + OLED "ACCESS GRANTED" + speed-gate retraction
    tl.to(
      st,
      {
        verified: 1,
        laserActive: 0,
        scanFlash: 1,
        duration: 0.08,
      },
      0.9,
    );
    tl.to(
      st,
      {
        scanFlash: 0,
        duration: 0.34,
        ease: 'power2.out',
      },
      1.0,
    );
    tl.to(
      st,
      {
        gateOpen: 1,
        duration: 0.38,
        ease: 'power2.out',
      },
      0.94,
    );
    tl.to(
      st,
      {
        ticketVisible: 0,
        duration: 0.28,
        ease: 'power2.in',
      },
      1.08,
    );
    tl.to(
      proxy,
      {
        x: theme.portalX,
        y: gateFloorY + 1.62,
        lookX: theme.portalX,
        lookY: portalFloorY + 1.4,
        lookZ: portalZ - 4.0,
        duration: 0.42,
        ease: 'power2.out',
      },
      1.04,
    );

    // 4. Transition to continuous walk down the theater-specific corridor while auditorium doors swing/slide open
    tl.call(
      () => {
        st.phase = 'walking';
        onCorridorPhaseChangeRef.current?.('walking');
      },
      undefined,
      1.26,
    );

    const doorPrepZ = portalZ + 1.45;
    tl.to(
      proxy,
      {
        x: theme.portalX,
        y: portalFloorY + 1.64,
        z: doorPrepZ,
        lookX: theme.portalX * 0.6,
        lookY: config.screenPosition[1] * 0.72,
        lookZ: config.screenPosition[2],
        duration: 1.45,
        ease: 'power1.inOut',
      },
      1.26,
    );

    // Doors swing/slide wide open BEFORE the camera crosses the portal threshold — revealing the real 3D auditorium
    tl.to(
      st,
      {
        doorOpen: 1,
        duration: 0.92,
        ease: 'power2.inOut',
      },
      1.68,
    );

    // 5. Walk smoothly right through the open auditorium doorway into rear hall aisle
    const lastRowZ = config.firstRowZ + Math.max(0, config.seatingRows - 1) * config.rowSpacing;
    const rearWalkZ = isBeach
      ? 11.15
      : THREE.MathUtils.clamp(
          (lastRowZ + 0.48 + (backZ - 0.16)) * 0.5,
          backZ - 0.96,
          backZ - 0.28,
        );
    const hallEntryFloorY = isBeach
      ? beachHeightAt(theme.portalX, rearWalkZ, beachVariant)
      : topTierY;

    tl.to(proxy, {
      x: theme.portalX,
      y: hallEntryFloorY + 1.62,
      z: rearWalkZ,
      lookX: 0,
      lookY: config.screenPosition[1] - 0.4,
      lookZ: config.screenPosition[2],
      duration: 0.75,
      ease: 'power1.inOut',
    });

    const aisleX = seat.nearestAisleX;
    const targetRowPassageZ = seat.worldPosition[2] + 0.45;

    if (isBeach) {
      // Curve smoothly around rear Beach Projector Booth housing at [0,0,8.6..9.0]
      const bypassX = seat.worldPosition[0] < 0 ? -1.42 : 1.42;
      tl.to(proxy, {
        x: bypassX,
        y: beachHeightAt(bypassX, 10.0, beachVariant) + 1.62,
        z: 10.0,
        duration: 0.55,
        ease: 'power1.inOut',
      });
      tl.to(proxy, {
        x: bypassX,
        y: beachHeightAt(bypassX, 7.2, beachVariant) + 1.62,
        z: 7.2,
        duration: 0.65,
        ease: 'none',
      });
    } else if (Math.abs(aisleX - theme.portalX) > 0.18) {
      tl.to(proxy, {
        x: aisleX,
        y: topTierY + 1.64,
        z: rearWalkZ,
        duration: 0.72,
        ease: 'power2.inOut',
      });
    }

    // Gently close auditorium entrance doors behind guest as they head down toward their row
    tl.to(
      st,
      {
        doorOpen: 0,
        duration: 0.85,
        ease: 'power2.inOut',
      },
      '>-0.25',
    );

    const startWalkZ = isBeach ? 7.2 : rearWalkZ;
    const aisleDistance = Math.abs(startWalkZ - targetRowPassageZ);
    const walkDuration = Math.min(2.2, Math.max(0.95, aisleDistance * 0.14));
    tl.to(proxy, {
      x: aisleX,
      y: seat.worldPosition[1] + 1.62,
      z: targetRowPassageZ,
      lookX: seat.worldPosition[0] * 0.4,
      lookY: config.screenPosition[1],
      duration: walkDuration,
      ease: 'power1.inOut',
    });

    const rowDistance = Math.abs(aisleX - seat.worldPosition[0]);
    const rowDuration = Math.min(1.15, Math.max(0.5, rowDistance * 0.24));
    tl.to(proxy, {
      x: seat.eyePosition[0],
      y: seat.worldPosition[1] + 1.54,
      z: targetRowPassageZ,
      lookX: seat.lookAtTarget[0],
      lookY: seat.lookAtTarget[1],
      lookZ: seat.lookAtTarget[2],
      duration: rowDuration,
      ease: 'power2.inOut',
    });

    tl.to(proxy, {
      x: seat.eyePosition[0],
      y: seat.eyePosition[1],
      z: seat.eyePosition[2],
      lookX: seat.lookAtTarget[0],
      lookY: seat.lookAtTarget[1],
      lookZ: seat.lookAtTarget[2],
      duration: 0.72,
      ease: 'power3.out',
    });

    walkTimelineRef.current = tl;

    return () => {
      tl.kill();
      walkTimelineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanTicketSignal, entranceComplete, config, camera]);

  // Smooth GSAP camera glide when shifting seats mid-show or switching viewMode (Seat / Walk / Hall / Screen Full)
  useEffect(() => {
    if (!entranceComplete) return;

    const seatChanged = prevSeatIdRef.current !== seat.id;
    const modeChanged = prevViewModeRef.current !== viewMode;

    if (!seatChanged && !modeChanged) return;
    prevSeatIdRef.current = seat.id;
    prevViewModeRef.current = viewMode;

    glideTweenRef.current?.kill();
    isGlidingRef.current = true;
    lookOffsetRef.current.targetYaw = 0;
    lookOffsetRef.current.targetPitch = 0;
    lookOffsetRef.current.yaw = 0;
    lookOffsetRef.current.pitch = 0;
    lookOffsetRef.current.yawVel = 0;
    lookOffsetRef.current.pitchVel = 0;

    let targetPos: [number, number, number];
    const targetQuat = new THREE.Quaternion();

    if (viewMode === 'walk') {
      const spawn = {
        x: seat.nearestAisleX,
        z: seat.worldPosition[2] + 0.42,
      };
      resolveWalkConstraints(spawn, config);
      const groundY = getWalkFloorHeight(spawn.x, spawn.z, config);
      targetPos = [spawn.x, groundY + WALK_EYE_HEIGHT, spawn.z];

      const dummy = new THREE.PerspectiveCamera();
      dummy.position.set(...targetPos);
      dummy.lookAt(
        0,
        Math.max(groundY + 1.4, config.screenPosition[1] * 0.68),
        config.screenPosition[2],
      );
      targetQuat.copy(dummy.quaternion);

      const walkEuler = new THREE.Euler().setFromQuaternion(dummy.quaternion, 'YXZ');
      walkBaseAnglesRef.current = {
        yaw: walkEuler.y,
        pitch: THREE.MathUtils.clamp(walkEuler.x, -0.35, 0.35),
      };
      walkPoseRef.current = {
        x: spawn.x,
        z: spawn.z,
        groundY,
        velX: 0,
        velZ: 0,
        stridePhase: 0,
      };
    } else if (viewMode === 'hall') {
      const pose = getTheaterCameraPresetPose(config, hallPreset);
      const clampedHall = { x: pose.position[0], y: pose.position[1], z: pose.position[2] };
      clampInsideHall(clampedHall, config);
      targetPos = [clampedHall.x, clampedHall.y, clampedHall.z];
      const dummy = new THREE.PerspectiveCamera();
      dummy.position.set(...targetPos);
      dummy.lookAt(...pose.target);
      targetQuat.copy(dummy.quaternion);
      hallTargetPosRef.current.set(...targetPos);
      hallTargetLookRef.current.set(...pose.target);
      isHallPresetTransitioningRef.current = false;
    } else if (viewMode === 'screen_full') {
      const fov = computeAdaptiveCinemaFov(config.categoryId, size.width, size.height);
      const fovRad = THREE.MathUtils.degToRad(fov);
      const viewportAspect = size.width / Math.max(1, size.height);
      const halfH = config.screenHeight / 2;
      const halfW = config.screenWidth / 2;
      const distV = halfH / Math.tan(fovRad / 2);
      const hFovRad = 2 * Math.atan(Math.tan(fovRad / 2) * viewportAspect);
      const distH = halfW / Math.tan(hFovRad / 2);
      const idealDist = Math.max(distV, distH) * 1.02;
      const clampedZ = Math.min(
        config.auditoriumLength / 2 - 0.8,
        config.screenPosition[2] + idealDist,
      );

      targetPos = [
        config.screenPosition[0],
        config.screenPosition[1],
        clampedZ,
      ];
      targetQuat.copy(screenFullQuatRef.current);
    } else {
      targetPos = [...seat.eyePosition];
      targetQuat.copy(baseQuatRef.current);
    }

    const startPos = camera.position.clone();
    startQuatRef.current.copy(camera.quaternion);
    const proxy = { t: 0 };

    glideTweenRef.current = gsap.to(proxy, {
      t: 1,
      duration: 0.78,
      ease: 'power2.inOut',
      onUpdate: () => {
        camera.position.set(
          THREE.MathUtils.lerp(startPos.x, targetPos[0], proxy.t),
          THREE.MathUtils.lerp(startPos.y, targetPos[1], proxy.t),
          THREE.MathUtils.lerp(startPos.z, targetPos[2], proxy.t),
        );
        camera.quaternion.slerpQuaternions(startQuatRef.current, targetQuat, proxy.t);
      },
      onComplete: () => {
        camera.position.set(...targetPos);
        camera.quaternion.copy(targetQuat);
        isGlidingRef.current = false;
      },
    });

    return () => {
      glideTweenRef.current?.kill();
    };
  }, [seat, viewMode, entranceComplete, camera, config, size.width, size.height]);

  // Allow skipping entrance walk directly into exact seat
  useEffect(() => {
    if (skipWalkSignal > 0 && !entranceComplete) {
      if (walkTimelineRef.current) {
        walkTimelineRef.current.kill();
        walkTimelineRef.current = null;
      }
      corridorStateRef.current.phase = 'done';
      corridorStateRef.current.doorOpen = 0;
      corridorStateRef.current.gateOpen = 0;
      corridorStateRef.current.ticketVisible = 0;
      corridorStateRef.current.verified = 1;
      onCorridorPhaseChangeRef.current?.('done');
      camera.position.set(...seat.eyePosition);
      camera.quaternion.copy(baseQuatRef.current);
      onEntranceCompleteRef.current();
    }
  }, [skipWalkSignal, entranceComplete, camera, seat, corridorStateRef]);

  // Reset View back to screen center via shortest 360-degree turn
  useEffect(() => {
    if (resetViewSignal > 0) {
      const nearestTurn =
        Math.round(lookOffsetRef.current.yaw / (Math.PI * 2)) * (Math.PI * 2);
      lookOffsetRef.current.targetYaw = nearestTurn;
      lookOffsetRef.current.targetPitch = 0;
      lookOffsetRef.current.yawVel = 0;
      lookOffsetRef.current.pitchVel = 0;
    }
  }, [resetViewSignal]);

  // Keyboard WASD / ArrowUp-Down / Shift / Q-E locomotion listener in Free-Walk mode
  useEffect(() => {
    const keys = pressedKeysRef.current;
    if (!entranceComplete || viewMode !== 'walk') {
      keys.clear();
      return;
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (
        e.code === 'KeyW' ||
        e.code === 'KeyA' ||
        e.code === 'KeyS' ||
        e.code === 'KeyD' ||
        e.code === 'KeyQ' ||
        e.code === 'KeyE' ||
        e.code === 'ArrowUp' ||
        e.code === 'ArrowDown' ||
        e.code === 'ShiftLeft' ||
        e.code === 'ShiftRight'
      ) {
        if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
          e.preventDefault();
        }
        keys.add(e.code);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keys.delete(e.code);
    };

    const onBlur = () => {
      keys.clear();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      keys.clear();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [entranceComplete, viewMode]);

  // Full 360-degree horizontal drag look + smooth touch momentum inertia while seated or walking
  useEffect(() => {
    const dom = gl.domElement;
    dom.style.touchAction = 'none';
    const canDragLook = entranceComplete && (viewMode === 'seat' || viewMode === 'walk');

    const onPointerDown = (e: PointerEvent) => {
      if (!canDragLook) return;
      if (activePointerIdRef.current !== null && activePointerIdRef.current !== e.pointerId) {
        return;
      }
      activePointerIdRef.current = e.pointerId;
      isDraggingRef.current = true;
      isFirstTouchMoveRef.current = e.pointerType === 'touch';
      lastPointerRef.current = { x: e.clientX, y: e.clientY, timeMs: performance.now() };
      lookOffsetRef.current.yawVel = 0;
      lookOffsetRef.current.pitchVel = 0;
      try {
        dom.setPointerCapture(e.pointerId);
      } catch {
        // Ignore if pointer capture unsupported
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current || !canDragLook) return;
      if (activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) {
        return;
      }

      const nowMs = performance.now();
      const elapsedSec = Math.max(0.008, Math.min(0.05, (nowMs - lastPointerRef.current.timeMs) / 1000));
      const rawDx = e.clientX - lastPointerRef.current.x;
      const rawDy = e.clientY - lastPointerRef.current.y;
      lastPointerRef.current = { x: e.clientX, y: e.clientY, timeMs: nowMs };

      // Ignore tiny sub-pixel jitter and absorb browser touch-slop initial jump cleanly
      const maxStep = isFirstTouchMoveRef.current ? 18 : 70;
      isFirstTouchMoveRef.current = false;
      const dx = THREE.MathUtils.clamp(rawDx, -maxStep, maxStep);
      const dy = THREE.MathUtils.clamp(rawDy, -maxStep, maxStep);

      const isTouch = e.pointerType === 'touch';
      const walkLookSign = viewMode === 'walk' ? -1 : 1;
      const yawStep = dx * (isTouch ? 0.0046 : 0.0042) * walkLookSign;
      const pitchStep = dy * (isTouch ? 0.0033 : 0.0031) * walkLookSign;

      const look = lookOffsetRef.current;
      look.targetYaw += yawStep;
      look.targetPitch = THREE.MathUtils.clamp(look.targetPitch + pitchStep, -1.22, 1.22);

      if (isTouch) {
        const instYawVel = THREE.MathUtils.clamp(yawStep / elapsedSec, -5.0, 5.0);
        const instPitchVel = THREE.MathUtils.clamp(pitchStep / elapsedSec, -2.8, 2.8);
        look.yawVel = THREE.MathUtils.lerp(look.yawVel, instYawVel, 0.35);
        look.pitchVel = THREE.MathUtils.lerp(look.pitchVel, instPitchVel, 0.35);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) {
        return;
      }
      if (activePointerIdRef.current !== null) {
        try {
          if (dom.hasPointerCapture(activePointerIdRef.current)) {
            dom.releasePointerCapture(activePointerIdRef.current);
          }
        } catch {
          // Ignore release failure
        }
      }
      isDraggingRef.current = false;
      activePointerIdRef.current = null;
      isFirstTouchMoveRef.current = false;
      // Only carry forward touch inertia if the last move was recent (< 75ms)
      if (performance.now() - lastPointerRef.current.timeMs > 75) {
        lookOffsetRef.current.yawVel = 0;
        lookOffsetRef.current.pitchVel = 0;
      }
    };

    const onBlur = () => {
      isDraggingRef.current = false;
      activePointerIdRef.current = null;
      isFirstTouchMoveRef.current = false;
      lookOffsetRef.current.yawVel = 0;
      lookOffsetRef.current.pitchVel = 0;
    };

    dom.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('blur', onBlur);
    return () => {
      dom.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [gl, entranceComplete, viewMode]);

  const lastListenerPoseRef = useRef<number[] | null>(null);

  const syncAudioListener = () => {
    if (config.categoryId === 'beach') return;
    if (!cinemaAudioEngine.initialized) return;
    _listenerFwd.set(0, 0, -1).applyQuaternion(camera.quaternion);
    _listenerUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
    const px = camera.position.x;
    const py = camera.position.y;
    const pz = camera.position.z;
    const fx = _listenerFwd.x;
    const fy = _listenerFwd.y;
    const fz = _listenerFwd.z;
    const prev = lastListenerPoseRef.current;
    if (
      prev &&
      Math.abs(prev[0] - px) < 1e-4 &&
      Math.abs(prev[1] - py) < 1e-4 &&
      Math.abs(prev[2] - pz) < 1e-4 &&
      Math.abs(prev[3] - fx) < 1e-4 &&
      Math.abs(prev[4] - fy) < 1e-4 &&
      Math.abs(prev[5] - fz) < 1e-4
    ) {
      return;
    }
    if (prev) {
      prev[0] = px;
      prev[1] = py;
      prev[2] = pz;
      prev[3] = fx;
      prev[4] = fy;
      prev[5] = fz;
    } else {
      lastListenerPoseRef.current = [px, py, pz, fx, fy, fz];
    }
    cinemaAudioEngine.updateListenerPose(
      px,
      py,
      pz,
      fx,
      fy,
      fz,
      _listenerUp.x,
      _listenerUp.y,
      _listenerUp.z,
    );
  };

  useFrame((_, delta) => {
    if (!entranceComplete) {
      // Do NOT clamp camera inside the hall while standing in or walking through the external entrance corridor
      syncAudioListener();
      return;
    }

    if (viewMode === 'hall' || isGlidingRef.current) {
      if (viewMode === 'hall' && !isGlidingRef.current && isHallPresetTransitioningRef.current && orbitControlsRef.current) {
        const dtHall = Math.min(delta, 0.05);
        camera.position.x = THREE.MathUtils.damp(camera.position.x, hallTargetPosRef.current.x, 5.5, dtHall);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, hallTargetPosRef.current.y, 5.5, dtHall);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, hallTargetPosRef.current.z, 5.5, dtHall);
        orbitControlsRef.current.target.x = THREE.MathUtils.damp(orbitControlsRef.current.target.x, hallTargetLookRef.current.x, 5.5, dtHall);
        orbitControlsRef.current.target.y = THREE.MathUtils.damp(orbitControlsRef.current.target.y, hallTargetLookRef.current.y, 5.5, dtHall);
        orbitControlsRef.current.target.z = THREE.MathUtils.damp(orbitControlsRef.current.target.z, hallTargetLookRef.current.z, 5.5, dtHall);
        orbitControlsRef.current.update();
        if (
          camera.position.distanceTo(hallTargetPosRef.current) < 0.04 &&
          orbitControlsRef.current.target.distanceTo(hallTargetLookRef.current) < 0.04
        ) {
          isHallPresetTransitioningRef.current = false;
        }
      }
      clampInsideHall(camera.position, config);
      syncAudioListener();
      return;
    }

    const dt = Math.min(delta, 0.05);

    const look = lookOffsetRef.current;
    if (!isDraggingRef.current && (Math.abs(look.yawVel) > 0.002 || Math.abs(look.pitchVel) > 0.002)) {
      look.targetYaw += look.yawVel * dt;
      look.targetPitch = THREE.MathUtils.clamp(look.targetPitch + look.pitchVel * dt, -1.22, 1.22);
      const decay = Math.exp(-4.8 * dt);
      look.yawVel *= decay;
      look.pitchVel *= decay;
    } else if (!isDraggingRef.current) {
      look.yawVel = 0;
      look.pitchVel = 0;
    }

    if (viewMode === 'walk') {
      const keys = pressedKeysRef.current;
      const touchIn = walkInputRef?.current;

      if (keys.has('KeyQ')) look.targetYaw += WALK_TURN_SPEED * dt;
      if (keys.has('KeyE')) look.targetYaw -= WALK_TURN_SPEED * dt;

      const followLambda = isDraggingRef.current ? 16 : 12;
      look.yaw = THREE.MathUtils.damp(look.yaw, look.targetYaw, followLambda, dt);
      look.pitch = THREE.MathUtils.damp(look.pitch, look.targetPitch, followLambda, dt);

      const finalYaw = walkBaseAnglesRef.current.yaw + look.yaw;
      const finalPitch = THREE.MathUtils.clamp(
        walkBaseAnglesRef.current.pitch + look.pitch,
        -1.28,
        1.28,
      );

      let fwdInput =
        (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) -
        (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) +
        (touchIn ? touchIn.forward : 0);
      let rightInput =
        (keys.has('KeyD') ? 1 : 0) -
        (keys.has('KeyA') ? 1 : 0) +
        (touchIn ? touchIn.right : 0);

      const inputLen = Math.hypot(fwdInput, rightInput);
      if (inputLen > 1) {
        fwdInput /= inputLen;
        rightInput /= inputLen;
      }

      const isSprinting =
        keys.has('ShiftLeft') || keys.has('ShiftRight') || Boolean(touchIn?.sprint);
      const moveSpeed = isSprinting ? WALK_SPRINT_SPEED : WALK_SPEED;

      _walkForwardVec.set(-Math.sin(finalYaw), 0, -Math.cos(finalYaw));
      _walkRightVec.set(Math.cos(finalYaw), 0, -Math.sin(finalYaw));

      const targetVx =
        (_walkForwardVec.x * fwdInput + _walkRightVec.x * rightInput) * moveSpeed;
      const targetVz =
        (_walkForwardVec.z * fwdInput + _walkRightVec.z * rightInput) * moveSpeed;

      const wp = walkPoseRef.current;
      wp.velX = THREE.MathUtils.damp(wp.velX, targetVx, 12, dt);
      wp.velZ = THREE.MathUtils.damp(wp.velZ, targetVz, 12, dt);

      wp.x += wp.velX * dt;
      wp.z += wp.velZ * dt;
      resolveWalkConstraints(wp, config);

      const targetGroundY = getWalkFloorHeight(wp.x, wp.z, config);
      wp.groundY = THREE.MathUtils.damp(wp.groundY, targetGroundY, 16, dt);

      const horizontalSpeed = Math.hypot(wp.velX, wp.velZ);
      let headBobY = 0;
      if (horizontalSpeed > 0.12) {
        wp.stridePhase += dt * horizontalSpeed * 2.7;
        headBobY =
          Math.sin(wp.stridePhase) *
          0.022 *
          Math.min(1, horizontalSpeed / WALK_SPEED);
      }

      camera.position.set(wp.x, wp.groundY + WALK_EYE_HEIGHT + headBobY, wp.z);
      lookEulerRef.current.set(finalPitch, finalYaw, 0, 'YXZ');
      camera.quaternion.setFromEuler(lookEulerRef.current);
      syncAudioListener();
      return;
    }

    const followLambda = isDraggingRef.current ? 16 : 11;
    look.yaw = THREE.MathUtils.damp(look.yaw, look.targetYaw, followLambda, dt);
    look.pitch = THREE.MathUtils.damp(look.pitch, look.targetPitch, followLambda, dt);

    // Synchronized 4DX camera heave, pitch & roll matching each seat's local hydraulic pedestal pivot
    let motionX = 0;
    let motionY = 0;
    let swayPitch = 0;
    let swayRoll = 0;
    if (isPlaying && fourDxCameraIntensity > 0.01 && fourDxTelemetryRef) {
      const tel = fourDxTelemetryRef.current;
      motionY = tel.seatHeaveY * fourDxCameraIntensity;
      motionX = -Math.sin(tel.seatRollZ) * 0.92 * fourDxCameraIntensity;
      swayPitch = tel.seatPitchX * fourDxCameraIntensity;
      swayRoll = tel.seatRollZ * fourDxCameraIntensity;
    }

    if (viewMode === 'screen_full') {
      const fov = computeAdaptiveCinemaFov(config.categoryId, size.width, size.height);
      const fovRad = THREE.MathUtils.degToRad(fov);
      const viewportAspect = size.width / Math.max(1, size.height);
      const halfH = config.screenHeight / 2;
      const halfW = config.screenWidth / 2;
      const distV = halfH / Math.tan(fovRad / 2);
      const hFovRad = 2 * Math.atan(Math.tan(fovRad / 2) * viewportAspect);
      const distH = halfW / Math.tan(hFovRad / 2);
      const idealDist = Math.max(distV, distH) * 1.02;
      const clampedZ = Math.min(
        config.auditoriumLength / 2 - 0.8,
        config.screenPosition[2] + idealDist,
      );

      camera.position.set(
        config.screenPosition[0] + motionX * 0.5,
        config.screenPosition[1] + motionY * 0.5,
        clampedZ,
      );
      clampInsideHall(camera.position, config);
      offsetEulerRef.current.set(swayPitch * 0.45, 0, swayRoll * 0.45, 'YXZ');
      offsetQuatRef.current.setFromEuler(offsetEulerRef.current);
      camera.quaternion.copy(screenFullQuatRef.current).multiply(offsetQuatRef.current);
      syncAudioListener();
      return;
    }

    camera.position.set(
      seat.eyePosition[0] + motionX,
      seat.eyePosition[1] + motionY,
      seat.eyePosition[2],
    );
    clampInsideHall(camera.position, config);

    // Apply world-up 360-degree yaw + local pitch so turning 180° keeps horizon completely level
    const finalPitch = THREE.MathUtils.clamp(
      baseAnglesRef.current.pitch + look.pitch + swayPitch,
      -1.35,
      1.35,
    );
    const finalYaw = baseAnglesRef.current.yaw + look.yaw;
    lookEulerRef.current.set(finalPitch, finalYaw, swayRoll, 'YXZ');
    camera.quaternion.setFromEuler(lookEulerRef.current);
    syncAudioListener();
  });

  if (entranceComplete && viewMode === 'hall' && !isGlidingRef.current) {
    const isLongHall =
      config.theaterId === 'imax_tree_of_life' ||
      config.theaterId === 'dolby_deccan' ||
      config.theaterId === '4dx_kinetic_250';
    const hallMaxDistance =
      config.environmentProfile.architectureStyle === 'beach'
        ? 24
        : isLongHall
          ? 25
          : Math.max(
              3.5,
              Math.min(config.auditoriumWidth * 0.45, config.auditoriumLength * 0.48),
            );
    const mobile = isMobileDevice();
    return (
      <OrbitControls
        ref={orbitControlsRef}
        target={hallInitialPose.target}
        enablePan={false}
        enableDamping={!isSoftwareGl}
        dampingFactor={0.075}
        rotateSpeed={mobile ? 0.62 : 0.72}
        minDistance={2.8}
        maxDistance={hallMaxDistance}
        minAzimuthAngle={-Infinity}
        maxAzimuthAngle={Infinity}
        maxPolarAngle={Math.PI * 0.58}
        minPolarAngle={0.22}
        onStart={() => {
          isHallPresetTransitioningRef.current = false;
        }}
        onChange={() => clampInsideHall(camera.position, config)}
      />
    );
  }

  return null;
};
