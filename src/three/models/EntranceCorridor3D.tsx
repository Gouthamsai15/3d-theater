import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { ShowState, TheaterConfiguration } from '../../types/cinema';
import {
  CorridorAnimationState,
  CorridorThemeConfig,
  getCorridorThemeConfig,
} from './corridorThemes';
import { CinemaTicket3D } from './CinemaTicket3D';
import { beachHeightAt } from './beachTerrain';

interface EntranceCorridor3DProps {
  config: TheaterConfiguration;
  seatId: string;
  showState: ShowState;
  lightFactor: number;
  entranceComplete: boolean;
  corridorStateRef: React.MutableRefObject<CorridorAnimationState>;
  onScanClick: () => void;
}

function createPortalPlaqueTexture(
  config: TheaterConfiguration,
  theme: CorridorThemeConfig,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = theme.gateBodyColor;
  ctx.fillRect(0, 0, 1024, 256);

  ctx.strokeStyle = theme.accentColor;
  ctx.lineWidth = 6;
  ctx.strokeRect(14, 14, 996, 228);

  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 2;
  ctx.strokeRect(26, 26, 972, 204);

  ctx.fillStyle = theme.accentColor;
  ctx.font = '700 26px "Inter", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${config.categoryId.toUpperCase()} AUDITORIUM ENTRANCE`, 512, 84);

  ctx.fillStyle = '#f8f6f0';
  ctx.font = '700 56px Georgia, serif';
  ctx.fillText(config.shortName.toUpperCase(), 512, 168, 920);
  ctx.textAlign = 'left';

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function createRunnerCarpetTexture(theme: CorridorThemeConfig): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = theme.runnerColor;
  ctx.fillRect(0, 0, 512, 512);

  // Fine woven velvet/stone texture
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  for (let y = 0; y < 512; y += 6) {
    ctx.fillRect(0, y, 512, 2);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.035)';
  for (let x = 0; x < 512; x += 8) {
    ctx.fillRect(x, 0, 2, 512);
  }

  // Symmetrical border rails
  ctx.fillStyle = theme.runnerBorderColor;
  ctx.fillRect(24, 0, 12, 512);
  ctx.fillRect(512 - 36, 0, 12, 512);

  ctx.globalAlpha = 0.28;
  ctx.fillRect(50, 0, 4, 512);
  ctx.fillRect(512 - 54, 0, 4, 512);
  ctx.globalAlpha = 1;

  // Center subtle motif along runner
  ctx.strokeStyle = theme.runnerBorderColor;
  ctx.globalAlpha = 0.18;
  ctx.lineWidth = 3;
  for (let y = 32; y < 512; y += 128) {
    ctx.beginPath();
    ctx.moveTo(256, y);
    ctx.lineTo(316, y + 48);
    ctx.lineTo(256, y + 96);
    ctx.lineTo(196, y + 48);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 5);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function createJaliLatticeTexture(
  bgColor: string,
  goldColor: string,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, 512, 512);

  ctx.strokeStyle = goldColor;
  ctx.lineWidth = 6;

  // Classic geometric Mughal / Mandap octagonal star trellis
  const step = 64;
  for (let y = 0; y <= 512; y += step) {
    for (let x = 0; x <= 512; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, y - 24);
      ctx.lineTo(x + 24, y);
      ctx.lineTo(x, y + 24);
      ctx.lineTo(x - 24, y);
      ctx.closePath();
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 3);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createScannerReticleTexture(accentColor: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#03060c';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle concentric optical sensor lens ring
  const rad = ctx.createRadialGradient(256, 256, 20, 256, 256, 240);
  rad.addColorStop(0, 'rgba(34,211,238,0.28)');
  rad.addColorStop(0.5, 'rgba(16,185,129,0.1)');
  rad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rad;
  ctx.fillRect(0, 0, 512, 512);

  // Corner target alignment brackets
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 8;
  const m = 54;
  const len = 76;
  const corners: [number, number, number, number][] = [
    [m, m, 1, 1],
    [512 - m, m, -1, 1],
    [m, 512 - m, 1, -1],
    [512 - m, 512 - m, -1, -1],
  ];
  corners.forEach(([cx, cy, sx, sy]) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy + sy * len);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx + sx * len, cy);
    ctx.stroke();
  });

  // Optical crosshair frame
  ctx.strokeStyle = 'rgba(34,211,238,0.5)';
  ctx.lineWidth = 3;
  ctx.strokeRect(156, 156, 200, 200);
  ctx.beginPath();
  ctx.arc(256, 256, 48, 0, Math.PI * 2);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createOledStatusTexture(
  mode: 'idle' | 'scanning' | 'verified',
  seatId: string,
  accentColor: string,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = mode === 'verified' ? '#041c13' : '#05080f';
  ctx.fillRect(0, 0, 512, 256);

  const borderCol =
    mode === 'verified' ? '#10b981' : mode === 'scanning' ? '#22d3ee' : accentColor;
  ctx.strokeStyle = borderCol;
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, 492, 236);

  ctx.textAlign = 'center';
  if (mode === 'idle') {
    ctx.fillStyle = accentColor;
    ctx.font = '700 24px "Inter", system-ui, sans-serif';
    ctx.fillText('VIP SPEED-GATE READY', 256, 68);
    ctx.fillStyle = '#f8f6f0';
    ctx.font = '700 44px "Inter", system-ui, sans-serif';
    ctx.fillText('SCAN TICKET QR', 256, 134);
    ctx.fillStyle = 'rgba(244,241,234,0.68)';
    ctx.font = '600 24px "JetBrains Mono", monospace';
    ctx.fillText(`RESERVED · SEAT ${seatId.toUpperCase()}`, 256, 198);
  } else if (mode === 'scanning') {
    ctx.fillStyle = '#22d3ee';
    ctx.font = '700 24px "Inter", system-ui, sans-serif';
    ctx.fillText('OPTICAL SENSOR ACTIVE', 256, 68);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 42px "Inter", system-ui, sans-serif';
    ctx.fillText('READING PASS...', 256, 134);
    // Illuminated progress bars
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#22d3ee' : '#0ea5e9';
      ctx.fillRect(106 + i * 52, 178, 38, 16);
    }
  } else {
    ctx.fillStyle = '#10b981';
    ctx.font = '700 24px "Inter", system-ui, sans-serif';
    ctx.fillText('OPTICAL MATCH CONFIRMED', 256, 66);
    ctx.fillStyle = '#ecfdf5';
    ctx.font = '700 46px "Inter", system-ui, sans-serif';
    ctx.fillText('ACCESS GRANTED', 256, 132);
    ctx.fillStyle = '#34d399';
    ctx.font = '700 32px "JetBrains Mono", monospace';
    ctx.fillText(`WELCOME · SEAT ${seatId.toUpperCase()}`, 256, 196);
  }
  ctx.textAlign = 'left';

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

const _amberCol = new THREE.Color('#f59e0b');
const _emeraldCol = new THREE.Color('#10b981');
const _cyanCol = new THREE.Color('#22d3ee');
const _tmpCol = new THREE.Color();

export const EntranceCorridor3D: React.FC<EntranceCorridor3DProps> = ({
  config,
  seatId,
  lightFactor,
  entranceComplete,
  corridorStateRef,
  onScanClick,
}) => {
  const theme = useMemo(() => getCorridorThemeConfig(config), [config]);
  const isBeach = theme.isBeach;
  const beachVariant =
    config.theaterId === 'beach_bioluminescent' ? 'bioluminescent' : 'sunset';

  const backZ = config.auditoriumLength / 2;
  const topTierY = (config.seatingRows - 1) * config.rowElevationStep;
  const isIce = config.environmentProfile.architectureStyle === 'ice';
  const H = config.auditoriumHeight;

  const boothY = isIce
    ? Math.min(H - 1.65, Math.max(10.35, topTierY + 5.6))
    : Math.min(H - 1.4, topTierY + 3.25);
  const boothWinH = Math.min(1.42, H * 0.24);
  const winBot = Math.max(0.25, boothY - boothWinH / 2);

  // Vestibule ceiling stays cleanly below boothFloorY (winBot - 0.21) so zero clipping occurs behind projection booth
  const vestibuleClearH = isBeach
    ? theme.corridorHeight
    : Math.max(
        theme.portalH + 0.08,
        Math.min(theme.corridorHeight, winBot - 0.23 - topTierY),
      );

  const portalZ = isBeach ? 12.2 : backZ + 0.08;
  const gateZ = isBeach ? 16.0 : backZ + 6.4;
  const corridorEndZ = isBeach ? 19.6 : backZ + theme.corridorLength;

  const floorY = isBeach
    ? beachHeightAt(0, gateZ, beachVariant) + 0.04
    : topTierY;
  const portalFloorY = isBeach
    ? beachHeightAt(0, portalZ, beachVariant) + 0.04
    : topTierY;

  // Sculpted Optical Scanner Cradle angled slightly inward toward arriving viewer
  const scannerYawY = -0.22;
  const scannerTiltX = 0.56;
  const cradleWorldX = theme.portalX + 0.48;
  const cradleWorldY = floorY + 0.99;
  const cradleWorldZ = gateZ + 0.36;

  const handAnchor: [number, number, number] = [
    theme.portalX + 0.3,
    floorY + 1.38,
    gateZ + 1.66,
  ];

  // Align the ticket's QR stub (+0.105 local X) dead-center over the optical sensor aperture & below the overhead laser arch
  const scannerAnchor: [number, number, number] = useMemo(() => {
    const q = new THREE.Quaternion()
      .setFromEuler(new THREE.Euler(0, scannerYawY, 0, 'YXZ'))
      .multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(scannerTiltX, 0, 0, 'YXZ')));
    const localCenterOffset = new THREE.Vector3(-0.105, 0.056, 0.008).applyQuaternion(q);
    return [
      cradleWorldX + localCenterOffset.x,
      cradleWorldY + localCenterOffset.y,
      cradleWorldZ + localCenterOffset.z,
    ];
  }, [cradleWorldX, cradleWorldY, cradleWorldZ, scannerYawY, scannerTiltX]);

  // Animated Three refs
  const leftSwingDoorRef = useRef<THREE.Group>(null);
  const rightSwingDoorRef = useRef<THREE.Group>(null);
  const singleSwingDoorRef = useRef<THREE.Group>(null);
  const leftSlideDoorRef = useRef<THREE.Group>(null);
  const rightSlideDoorRef = useRef<THREE.Group>(null);
  const leftGatePaddleRef = useRef<THREE.Group>(null);
  const rightGatePaddleRef = useRef<THREE.Group>(null);
  const laserBeamGroupRef = useRef<THREE.Group>(null);
  const laserCurtainRef = useRef<THREE.Mesh>(null);
  const laserCurtainMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const scannerPadGlowMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const statusRingMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const paddleEdgeMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const oledIdleMeshRef = useRef<THREE.Mesh>(null);
  const oledScanMeshRef = useRef<THREE.Mesh>(null);
  const oledOkMeshRef = useRef<THREE.Mesh>(null);

  const [scannerHovered, setScannerHovered] = useState(false);

  const plaqueTexture = useMemo(
    () => createPortalPlaqueTexture(config, theme),
    [config, theme],
  );
  const runnerTexture = useMemo(() => createRunnerCarpetTexture(theme), [theme]);
  const jaliTexture = useMemo(
    () => createJaliLatticeTexture(theme.secondaryWallColor, theme.accentColor),
    [theme.secondaryWallColor, theme.accentColor],
  );
  const reticleTexture = useMemo(
    () => createScannerReticleTexture(theme.accentColor),
    [theme.accentColor],
  );
  const oledIdleTex = useMemo(
    () => createOledStatusTexture('idle', seatId, theme.accentColor),
    [seatId, theme.accentColor],
  );
  const oledScanTex = useMemo(
    () => createOledStatusTexture('scanning', seatId, theme.accentColor),
    [seatId, theme.accentColor],
  );
  const oledOkTex = useMemo(
    () => createOledStatusTexture('verified', seatId, theme.accentColor),
    [seatId, theme.accentColor],
  );

  const materials = useMemo(() => {
    const primaryWallMat = new THREE.MeshStandardMaterial({
      color: theme.primaryWallColor,
      roughness: 0.72,
      metalness: 0.12,
    });
    const secondaryWallMat = new THREE.MeshStandardMaterial({
      color: theme.secondaryWallColor,
      roughness: 0.56,
      metalness: 0.24,
    });
    const metalMat = new THREE.MeshStandardMaterial({
      color: theme.metalColor,
      roughness: 0.26,
      metalness: 0.86,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: theme.trimColor,
      roughness: 0.42,
      metalness: 0.52,
    });
    const ceilingMat = new THREE.MeshStandardMaterial({
      color: theme.ceilingColor,
      roughness: 0.85,
      metalness: 0.08,
    });
    const floorMat = new THREE.MeshStandardMaterial({
      color: theme.floorColor,
      roughness: 0.82,
      metalness: 0.06,
    });
    const runnerMat = new THREE.MeshStandardMaterial({
      map: runnerTexture,
      roughness: 0.78,
      metalness: 0.05,
    });
    const accentGlowMat = new THREE.MeshStandardMaterial({
      color: theme.accentColor,
      emissive: theme.accentColor,
      emissiveIntensity: 1.15,
      roughness: 0.25,
    });
    const secondaryGlowMat = new THREE.MeshStandardMaterial({
      color: theme.secondaryAccentColor,
      emissive: theme.secondaryAccentColor,
      emissiveIntensity: 0.85,
      roughness: 0.28,
    });
    const doorPrimaryMat = new THREE.MeshStandardMaterial({
      color: theme.doorPrimaryColor,
      roughness: 0.48,
      metalness: 0.22,
    });
    const doorSecondaryMat = new THREE.MeshStandardMaterial({
      color: theme.doorSecondaryColor,
      roughness: 0.44,
      metalness: 0.34,
    });
    const doorHandleMat = new THREE.MeshStandardMaterial({
      color: theme.doorHandleColor,
      roughness: 0.22,
      metalness: 0.9,
    });
    const gateBodyMat = new THREE.MeshStandardMaterial({
      color: theme.gateBodyColor,
      roughness: 0.34,
      metalness: 0.68,
    });
    const gateTrimMat = new THREE.MeshStandardMaterial({
      color: theme.gateTrimColor,
      roughness: 0.25,
      metalness: 0.88,
    });
    const smokedGlassMat = new THREE.MeshPhysicalMaterial({
      color: '#1e293b',
      roughness: 0.08,
      metalness: 0.12,
      transmission: 0.65,
      transparent: true,
      opacity: 0.62,
      ior: 1.48,
    });
    const plaqueMat = new THREE.MeshStandardMaterial({
      map: plaqueTexture,
      emissive: theme.accentColor,
      emissiveIntensity: 0.12,
      roughness: 0.32,
      metalness: 0.35,
    });
    const jaliMat = new THREE.MeshStandardMaterial({
      map: jaliTexture,
      emissive: theme.accentColor,
      emissiveIntensity: 0.22,
      roughness: 0.38,
      metalness: 0.6,
    });
    const reticleMat = new THREE.MeshStandardMaterial({
      map: reticleTexture,
      emissive: '#ffffff',
      emissiveMap: reticleTexture,
      emissiveIntensity: 0.72,
      roughness: 0.14,
      metalness: 0.18,
      transparent: true,
      opacity: 0.9,
    });
    const oledIdleMat = new THREE.MeshStandardMaterial({
      map: oledIdleTex,
      emissive: '#ffffff',
      emissiveMap: oledIdleTex,
      emissiveIntensity: 0.9,
      roughness: 0.18,
    });
    const oledScanMat = new THREE.MeshStandardMaterial({
      map: oledScanTex,
      emissive: '#ffffff',
      emissiveMap: oledScanTex,
      emissiveIntensity: 1.05,
      roughness: 0.18,
    });
    const oledOkMat = new THREE.MeshStandardMaterial({
      map: oledOkTex,
      emissive: '#ffffff',
      emissiveMap: oledOkTex,
      emissiveIntensity: 1.15,
      roughness: 0.18,
    });

    return {
      primaryWallMat,
      secondaryWallMat,
      metalMat,
      trimMat,
      ceilingMat,
      floorMat,
      runnerMat,
      accentGlowMat,
      secondaryGlowMat,
      doorPrimaryMat,
      doorSecondaryMat,
      doorHandleMat,
      gateBodyMat,
      gateTrimMat,
      smokedGlassMat,
      plaqueMat,
      jaliMat,
      reticleMat,
      oledIdleMat,
      oledScanMat,
      oledOkMat,
    };
  }, [theme, plaqueTexture, runnerTexture, jaliTexture, reticleTexture, oledIdleTex, oledScanTex, oledOkTex]);

  useEffect(() => {
    return () => {
      plaqueTexture.dispose();
      runnerTexture.dispose();
      jaliTexture.dispose();
      reticleTexture.dispose();
      oledIdleTex.dispose();
      oledScanTex.dispose();
      oledOkTex.dispose();
      Object.values(materials).forEach((m) => m.dispose());
    };
  }, [plaqueTexture, runnerTexture, jaliTexture, reticleTexture, oledIdleTex, oledScanTex, oledOkTex, materials]);

  // Scale corridor cove glow gently down once the doors shut behind you inside the hall
  useEffect(() => {
    const k = entranceComplete ? 0.35 + lightFactor * 0.45 : 1.0;
    materials.accentGlowMat.emissiveIntensity = 1.15 * k;
    materials.secondaryGlowMat.emissiveIntensity = 0.85 * k;
  }, [entranceComplete, lightFactor, materials]);

  useEffect(() => {
    if (scannerHovered && !entranceComplete) {
      document.body.style.cursor = 'pointer';
    } else if (!scannerHovered) {
      document.body.style.cursor = 'auto';
    }
    return () => {
      document.body.style.cursor = 'auto';
    };
  }, [scannerHovered, entranceComplete]);

  // Frame-smooth mechanical animation for optical laser, status LEDs, turnstile wings, and auditorium doors
  useFrame((state) => {
    const st = corridorStateRef.current;
    const t = state.clock.elapsedTime;

    // 1. Door animation (swing outward into corridor +Z OR slide into pocket for ICE)
    const leafSpan = theme.isSingleDoor ? theme.portalW - 0.08 : (theme.portalW - 0.1) * 0.5;
    if (theme.doorMode === 'slide') {
      const slideDist = st.doorOpen * (leafSpan + 0.08);
      if (leftSlideDoorRef.current) {
        leftSlideDoorRef.current.position.x = -leafSpan * 0.5 - 0.01 - slideDist;
      }
      if (rightSlideDoorRef.current) {
        rightSlideDoorRef.current.position.x = leafSpan * 0.5 + 0.01 + slideDist;
      }
    } else if (theme.isSingleDoor) {
      if (singleSwingDoorRef.current) {
        const sign = theme.hingeSide === -1 ? -1 : 1;
        singleSwingDoorRef.current.rotation.y = sign * st.doorOpen * 1.5;
      }
    } else {
      if (leftSwingDoorRef.current) {
        leftSwingDoorRef.current.rotation.y = -st.doorOpen * 1.52;
      }
      if (rightSwingDoorRef.current) {
        rightSwingDoorRef.current.rotation.y = st.doorOpen * 1.52;
      }
    }

    // 2. Turnstile glass barrier paddles retract into sleek pedestals
    const wingRetract = st.gateOpen * 0.42;
    if (leftGatePaddleRef.current) {
      leftGatePaddleRef.current.position.x = -0.25 - wingRetract;
    }
    if (rightGatePaddleRef.current) {
      rightGatePaddleRef.current.position.x = 0.25 + wingRetract;
    }

    // 3. Sweeping Overhead Optical Laser Curtain + Razor Scan Line hitting the QR code
    if (laserBeamGroupRef.current) {
      const active = st.laserActive > 0.02;
      laserBeamGroupRef.current.visible = active;
      if (active) {
        const targetZ = (st.laserSweep - 0.5) * 0.16;
        // Emitter sits at (0, 0.195, 0.01); beam drops to ticket face (0, 0.06, targetZ)
        const dz = targetZ - 0.01;
        const dy = 0.195 - 0.06;
        const len = Math.sqrt(dy * dy + dz * dz);
        if (laserCurtainRef.current) {
          laserCurtainRef.current.position.set(0, (0.195 + 0.06) * 0.5, (0.01 + targetZ) * 0.5);
          laserCurtainRef.current.rotation.x = Math.atan2(dz, dy);
          laserCurtainRef.current.scale.set(1, len / 0.14, 1);
        }
        if (laserCurtainMatRef.current) {
          laserCurtainMatRef.current.opacity = 0.28 * st.laserActive;
        }
      }
    }

    // 4. OLED Display Instant State Swap (Zero allocations)
    const isVerified = st.verified > 0.5;
    const isScanning = !isVerified && (st.laserActive > 0.05 || st.ticketScanT > 0.55);
    if (oledIdleMeshRef.current) oledIdleMeshRef.current.visible = !isVerified && !isScanning;
    if (oledScanMeshRef.current) oledScanMeshRef.current.visible = isScanning;
    if (oledOkMeshRef.current) oledOkMeshRef.current.visible = isVerified;

    // 5. Status indicator LEDs & scanner glow (amber ready -> pulsing cyan scanning -> vivid emerald verified)
    if (isVerified) {
      _tmpCol.copy(_emeraldCol);
    } else if (st.laserActive > 0.1 || st.ticketScanT > 0.5) {
      _tmpCol.copy(_cyanCol);
    } else {
      _tmpCol.copy(_amberCol);
    }

    if (statusRingMatRef.current) {
      statusRingMatRef.current.color.copy(_tmpCol);
      statusRingMatRef.current.emissive.copy(_tmpCol);
      statusRingMatRef.current.emissiveIntensity =
        isVerified ? 2.1 : 0.8 + Math.sin(t * 3.4) * 0.28;
    }

    if (paddleEdgeMatRef.current) {
      if (isVerified) {
        paddleEdgeMatRef.current.color.copy(_emeraldCol);
        paddleEdgeMatRef.current.emissive.copy(_emeraldCol);
        paddleEdgeMatRef.current.emissiveIntensity = 1.8;
      } else {
        paddleEdgeMatRef.current.color.set(theme.accentColor);
        paddleEdgeMatRef.current.emissive.set(theme.accentColor);
        paddleEdgeMatRef.current.emissiveIntensity = 0.7;
      }
    }

    if (scannerPadGlowMatRef.current) {
      scannerPadGlowMatRef.current.color.copy(_tmpCol);
      scannerPadGlowMatRef.current.emissive.copy(_tmpCol);
      scannerPadGlowMatRef.current.emissiveIntensity =
        isVerified ? 1.85 + st.scanFlash * 1.4 : 0.45 + st.laserActive * 0.95;
    }
  });

  // Render bespoke interior door leaf face inlay matching each theater's signature design
  const renderDoorLeafDetails = (leafW: number, leafH: number, side: -1 | 1) => {
    const handleX = side === -1 ? leafW * 0.36 : -leafW * 0.36;
    const isMandap = theme.wallPattern === 'mandap_jali';
    const isDeco = theme.wallPattern === 'deco_sunburst';
    const is4dx = theme.wallPattern === 'fourdx_kinetic';
    const isScreenX = theme.wallPattern === 'screenx_stealth';
    const isBeachDoor = theme.wallPattern === 'beach_pier';
    const isDolby =
      theme.wallPattern === 'dolby_acoustic' || theme.wallPattern === 'dolby_scales';
    const isIceDoor = theme.wallPattern === 'ice_portals';

    return (
      <group>
        {/* Solid sculpted core door leaf */}
        <mesh material={materials.doorPrimaryMat} castShadow receiveShadow>
          <boxGeometry args={[leafW, leafH, 0.075]} />
        </mesh>

        {/* Metallic perimeter stile & rail frame */}
        <mesh position={[0, leafH * 0.47, 0]} material={materials.metalMat}>
          <boxGeometry args={[leafW, 0.055, 0.088]} />
        </mesh>
        <mesh position={[0, -leafH * 0.47, 0]} material={materials.metalMat}>
          <boxGeometry args={[leafW, 0.075, 0.09]} />
        </mesh>

        {/* Signature Pattern Relief on Corridor-Facing Side (+Z) and Auditorium Side (-Z) */}
        {isMandap && (
          <group>
            <mesh position={[0, 0.06, 0.042]} material={materials.jaliMat}>
              <planeGeometry args={[leafW * 0.68, leafH * 0.68]} />
            </mesh>
            <mesh position={[0, 0.06, -0.042]} rotation={[0, Math.PI, 0]} material={materials.jaliMat}>
              <planeGeometry args={[leafW * 0.68, leafH * 0.68]} />
            </mesh>
            <mesh position={[0, 0.06, 0]} material={materials.doorHandleMat}>
              <boxGeometry args={[leafW * 0.74, leafH * 0.74, 0.082]} />
            </mesh>
          </group>
        )}

        {isDeco && (
          <group>
            {[-0.24, 0, 0.24].map((ry, idx) => (
              <mesh
                key={`deco-bar-${idx}`}
                position={[0, 0.22 + ry * 0.8, 0]}
                rotation={[0, 0, side * ry * 0.55]}
                material={materials.doorHandleMat}
              >
                <boxGeometry args={[leafW * 0.72, 0.032, 0.092]} />
              </mesh>
            ))}
            <mesh position={[0, -0.45, 0]} material={materials.doorSecondaryMat}>
              <boxGeometry args={[leafW * 0.74, 0.76, 0.088]} />
            </mesh>
          </group>
        )}

        {is4dx && (
          <group>
            <mesh position={[0, 0, 0]} material={materials.doorSecondaryMat}>
              <boxGeometry args={[leafW * 0.78, leafH * 0.82, 0.086]} />
            </mesh>
            {[-0.45, 0, 0.45].map((cy, ci) => (
              <mesh
                key={`4dx-chev-${ci}`}
                position={[0, cy, 0]}
                rotation={[0, 0, side * 0.36]}
                material={materials.accentGlowMat}
              >
                <boxGeometry args={[leafW * 0.68, 0.028, 0.094]} />
              </mesh>
            ))}
          </group>
        )}

        {(isScreenX || isIceDoor) && (
          <group>
            <mesh position={[0, 0, 0]} material={materials.doorSecondaryMat}>
              <boxGeometry args={[leafW * 0.84, leafH * 0.88, 0.086]} />
            </mesh>
            <mesh position={[side * leafW * 0.28, 0, 0]} material={materials.accentGlowMat}>
              <boxGeometry args={[0.022, leafH * 0.84, 0.095]} />
            </mesh>
          </group>
        )}

        {isDolby && (
          <group>
            {[-0.26, -0.1, 0.06, 0.22].map((fx, fi) => (
              <mesh key={`dolby-flute-${fi}`} position={[fx * leafW, 0, 0]} material={materials.doorSecondaryMat}>
                <boxGeometry args={[leafW * 0.1, leafH * 0.82, 0.092]} />
              </mesh>
            ))}
            <mesh position={[0, 0, 0]} material={materials.accentGlowMat}>
              <boxGeometry args={[0.018, leafH * 0.78, 0.096]} />
            </mesh>
          </group>
        )}

        {isBeachDoor && (
          <group>
            {Array.from({ length: 11 }, (_, li) => (
              <mesh
                key={`beach-slat-${li}`}
                position={[0, -leafH * 0.36 + li * (leafH * 0.072), 0]}
                rotation={[0.25, 0, 0]}
                material={materials.doorSecondaryMat}
              >
                <boxGeometry args={[leafW * 0.72, 0.04, 0.095]} />
              </mesh>
            ))}
          </group>
        )}

        {!isMandap &&
          !isDeco &&
          !is4dx &&
          !isScreenX &&
          !isIceDoor &&
          !isDolby &&
          !isBeachDoor && (
            <group>
              <mesh position={[0, 0.32, 0]} material={materials.doorSecondaryMat}>
                <boxGeometry args={[leafW * 0.66, leafH * 0.34, 0.088]} />
              </mesh>
              <mesh position={[0, -0.36, 0]} material={materials.doorSecondaryMat}>
                <boxGeometry args={[leafW * 0.66, leafH * 0.32, 0.088]} />
              </mesh>
              <mesh position={[side * -0.18, 0, 0]} material={materials.accentGlowMat}>
                <boxGeometry args={[0.016, leafH * 0.76, 0.094]} />
              </mesh>
            </group>
          )}

        {/* Heavy Brushed Metallic Vertical Pull Handle + Horizontal Push Bar */}
        <mesh position={[handleX, -0.02, 0.065]} material={materials.doorHandleMat}>
          <cylinderGeometry args={[0.016, 0.016, 0.56, 12]} />
        </mesh>
        <mesh position={[handleX, -0.02, -0.065]} material={materials.doorHandleMat}>
          <cylinderGeometry args={[0.016, 0.016, 0.56, 12]} />
        </mesh>
        <mesh position={[0, -0.12, -0.068]} material={materials.doorHandleMat}>
          <boxGeometry args={[leafW * 0.66, 0.042, 0.036]} />
        </mesh>
      </group>
    );
  };

  // Architectural Bays along indoor corridor (Zero posters! Pure bespoke architectural reliefs)
  const indoorMainStartZ = backZ + 2.74;
  const indoorMainLen = Math.max(2, corridorEndZ - indoorMainStartZ);
  const indoorMainMidZ = (indoorMainStartZ + corridorEndZ) * 0.5;
  const bayCount = 4;
  const baySpacing = indoorMainLen / bayCount;

  const renderIndoorWallBays = () => {
    const halfW = theme.corridorWidth / 2;
    const wallH = theme.corridorHeight;
    const bays: React.ReactNode[] = [];

    for (let bi = 0; bi < bayCount; bi++) {
      const bz = indoorMainStartZ + (bi + 0.5) * baySpacing;

      [-1, 1].forEach((side) => {
        const wx = theme.portalX + side * (halfW - 0.08);
        const inDir = -side;

        bays.push(
          <group key={`corridor-bay-${bi}-${side}`} position={[wx, topTierY, bz]}>
            {/* Flanking Structural Pilaster / Column */}
            <mesh
              position={[inDir * 0.04, wallH / 2, -baySpacing * 0.47]}
              material={materials.trimMat}
              receiveShadow
            >
              <boxGeometry args={[0.16, wallH, 0.16]} />
            </mesh>
            <mesh
              position={[inDir * 0.06, wallH * 0.5, -baySpacing * 0.47]}
              material={materials.accentGlowMat}
            >
              <boxGeometry args={[0.025, wallH * 0.84, 0.028]} />
            </mesh>

            {/* Pattern-Specific Architectural Sculptural Bay */}
            {theme.wallPattern === 'volcanic_ribbons' && (
              <group>
                {[-0.45, 0, 0.45].map((rz, ri) => (
                  <mesh
                    key={`v-rib-${ri}`}
                    position={[inDir * 0.06, wallH * 0.48, rz]}
                    rotation={[0.24, 0, 0]}
                    material={materials.secondaryWallMat}
                  >
                    <boxGeometry args={[0.1, wallH * 0.68, 0.16]} />
                  </mesh>
                ))}
                <mesh position={[inDir * 0.02, wallH * 0.85, 0]} material={materials.accentGlowMat}>
                  <boxGeometry args={[0.04, 0.04, baySpacing * 0.72]} />
                </mesh>
              </group>
            )}

            {theme.wallPattern === 'deco_sunburst' && (
              <group>
                <mesh position={[inDir * 0.04, wallH * 0.48, 0]} material={materials.secondaryWallMat}>
                  <boxGeometry args={[0.08, wallH * 0.64, baySpacing * 0.68]} />
                </mesh>
                {[-0.35, 0, 0.35].map((ang, ai) => (
                  <mesh
                    key={`deco-ray-${ai}`}
                    position={[inDir * 0.09, wallH * 0.56, 0]}
                    rotation={[ang, 0, 0]}
                    material={materials.metalMat}
                  >
                    <boxGeometry args={[0.03, wallH * 0.52, 0.05]} />
                  </mesh>
                ))}
                <mesh position={[inDir * 0.09, wallH * 0.3, 0]} material={materials.accentGlowMat}>
                  <boxGeometry args={[0.035, 0.24, 0.06]} />
                </mesh>
              </group>
            )}

            {theme.wallPattern === 'crisscross' && (
              <group>
                <mesh
                  position={[inDir * 0.06, wallH * 0.5, 0]}
                  rotation={[0.58, 0, 0]}
                  material={materials.secondaryWallMat}
                >
                  <boxGeometry args={[0.09, wallH * 0.75, 0.12]} />
                </mesh>
                <mesh
                  position={[inDir * 0.06, wallH * 0.5, 0]}
                  rotation={[-0.58, 0, 0]}
                  material={materials.secondaryWallMat}
                >
                  <boxGeometry args={[0.09, wallH * 0.75, 0.12]} />
                </mesh>
                <mesh position={[inDir * 0.09, wallH * 0.5, 0]} material={materials.accentGlowMat}>
                  <boxGeometry args={[0.035, 0.18, 0.18]} />
                </mesh>
              </group>
            )}

            {theme.wallPattern === 'mandap_jali' && (
              <group>
                <mesh position={[inDir * 0.05, wallH * 0.46, 0]} material={materials.jaliMat}>
                  <boxGeometry args={[0.04, wallH * 0.62, baySpacing * 0.66]} />
                </mesh>
                <mesh position={[inDir * 0.09, wallH * 0.8, 0]} material={materials.metalMat}>
                  <boxGeometry args={[0.12, 0.12, baySpacing * 0.72]} />
                </mesh>
                <mesh position={[inDir * 0.09, wallH * 0.14, 0]} material={materials.trimMat}>
                  <boxGeometry args={[0.12, 0.26, baySpacing * 0.74]} />
                </mesh>
              </group>
            )}

            {(theme.wallPattern === 'parametric_wave' ||
              theme.wallPattern === 'imax_slanted') && (
              <group>
                {Array.from({ length: 5 }, (_, wi) => {
                  const wz = (wi - 2) * (baySpacing * 0.16);
                  const depthWave = 0.08 + Math.sin(wi * 0.9 + bi) * 0.05;
                  return (
                    <mesh
                      key={`wave-fin-${wi}`}
                      position={[inDir * depthWave, wallH * 0.48, wz]}
                      rotation={[theme.wallPattern === 'imax_slanted' ? -0.18 : 0.12, 0, 0]}
                      material={materials.secondaryWallMat}
                    >
                      <boxGeometry args={[0.1, wallH * 0.74, 0.075]} />
                    </mesh>
                  );
                })}
                <mesh position={[inDir * 0.06, wallH * 0.22, 0]} material={materials.accentGlowMat}>
                  <boxGeometry args={[0.03, 0.032, baySpacing * 0.7]} />
                </mesh>
              </group>
            )}

            {theme.wallPattern === 'biophilic_moss' && (
              <group>
                <mesh position={[inDir * 0.05, wallH * 0.5, 0]} material={materials.trimMat}>
                  <boxGeometry args={[0.08, wallH * 0.7, baySpacing * 0.7]} />
                </mesh>
                <mesh position={[inDir * 0.08, wallH * 0.5, 0]} material={materials.primaryWallMat}>
                  <boxGeometry args={[0.04, wallH * 0.6, baySpacing * 0.6]} />
                </mesh>
                <mesh position={[inDir * 0.1, wallH * 0.5, 0]} rotation={[0.45, 0, 0]} material={materials.accentGlowMat}>
                  <boxGeometry args={[0.025, wallH * 0.58, 0.03]} />
                </mesh>
              </group>
            )}

            {theme.wallPattern === 'fourdx_kinetic' && (
              <group>
                <mesh position={[inDir * 0.07, wallH * 0.5, 0]} material={materials.metalMat}>
                  <boxGeometry args={[0.12, wallH * 0.72, 0.14]} />
                </mesh>
                {[-0.25, 0.25].map((kz, ki) => (
                  <mesh
                    key={`4dx-blade-${ki}`}
                    position={[inDir * 0.08, wallH * 0.5, kz * baySpacing]}
                    rotation={[0.38, 0, 0]}
                    material={materials.accentGlowMat}
                  >
                    <boxGeometry args={[0.03, wallH * 0.44, 0.035]} />
                  </mesh>
                ))}
              </group>
            )}

            {(theme.wallPattern === 'dolby_acoustic' ||
              theme.wallPattern === 'dolby_scales' ||
              theme.wallPattern === 'screenx_stealth') && (
              <group>
                {Array.from({ length: 6 }, (_, di) => (
                  <mesh
                    key={`ac-slat-${di}`}
                    position={[inDir * 0.05, wallH * 0.49, (di - 2.5) * (baySpacing * 0.13)]}
                    material={materials.secondaryWallMat}
                  >
                    <boxGeometry args={[0.075, wallH * 0.76, 0.065]} />
                  </mesh>
                ))}
                <mesh position={[inDir * 0.025, wallH * 0.88, 0]} material={materials.accentGlowMat}>
                  <boxGeometry args={[0.03, 0.032, baySpacing * 0.78]} />
                </mesh>
              </group>
            )}

            {theme.wallPattern === 'ice_portals' && (
              <group>
                <mesh position={[inDir * 0.06, wallH * 0.48, 0]} material={materials.secondaryWallMat}>
                  <boxGeometry args={[0.08, wallH * 0.72, baySpacing * 0.68]} />
                </mesh>
                <mesh position={[inDir * 0.1, wallH * 0.48, -baySpacing * 0.24]} material={materials.accentGlowMat}>
                  <boxGeometry args={[0.03, wallH * 0.66, 0.032]} />
                </mesh>
                <mesh position={[inDir * 0.1, wallH * 0.48, baySpacing * 0.24]} material={materials.secondaryGlowMat}>
                  <boxGeometry args={[0.03, wallH * 0.66, 0.032]} />
                </mesh>
              </group>
            )}

            {theme.wallPattern === 'private_salon' && (
              <group>
                {/* Fluted walnut & backlit alabaster sconce bay */}
                <mesh position={[inDir * 0.05, wallH * 0.48, 0]} material={materials.secondaryWallMat}>
                  <boxGeometry args={[0.06, wallH * 0.7, baySpacing * 0.68]} />
                </mesh>
                <mesh position={[inDir * 0.1, wallH * 0.56, 0]} material={materials.accentGlowMat}>
                  <cylinderGeometry args={[0.045, 0.045, 0.46, 12]} />
                </mesh>
                <mesh position={[inDir * 0.1, wallH * 0.16, 0]} material={materials.trimMat}>
                  <boxGeometry args={[0.08, 0.14, baySpacing * 0.74]} />
                </mesh>
              </group>
            )}
          </group>,
        );
      });
    }

    return bays;
  };

  return (
    <group>
      {/* Active corridor local lighting only while entrance is running */}
      {!entranceComplete && (
        <>
          <pointLight
            position={[theme.portalX, floorY + (isBeach ? 2.4 : 2.85), gateZ + 0.5]}
            color={theme.accentColor}
            intensity={isBeach ? 3.2 : 4.2}
            distance={12}
            decay={1.6}
          />
          <pointLight
            position={[theme.portalX, portalFloorY + 2.45, portalZ + 1.55]}
            color={theme.secondaryAccentColor}
            intensity={isBeach ? 2.4 : 3.4}
            distance={10}
            decay={1.7}
          />
        </>
      )}

      {/* ===================================================================== */}
      {/* INDOOR BESPOKE ARCHITECTURAL CORRIDOR SHELL                           */}
      {/* ===================================================================== */}
      {!isBeach && (
        <group>
          {/* Main Corridor Floor + Woven/Stone Runner + Illuminated Guide Rails */}
          <mesh
            position={[theme.portalX, topTierY - 0.08, (backZ + corridorEndZ) * 0.5]}
            material={materials.floorMat}
            receiveShadow
          >
            <boxGeometry args={[theme.corridorWidth + 0.4, 0.16, theme.corridorLength + 0.4]} />
          </mesh>
          <mesh
            position={[theme.portalX, topTierY + 0.008, (backZ + corridorEndZ) * 0.5]}
            material={materials.runnerMat}
            receiveShadow
          >
            <boxGeometry args={[Math.min(theme.portalW * 0.86, 1.95), 0.016, theme.corridorLength - 0.2]} />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh
              key={`floor-led-${side}`}
              position={[
                theme.portalX + side * (Math.min(theme.portalW * 0.43, 0.98) + 0.03),
                topTierY + 0.016,
                (backZ + corridorEndZ) * 0.5,
              ]}
              material={materials.accentGlowMat}
            >
              <boxGeometry args={[0.022, 0.012, theme.corridorLength - 0.35]} />
            </mesh>
          ))}

          {/* Vestibule Collar (z = backZ+0.14 .. backZ+2.74, stays cleanly below booth floor) */}
          <mesh
            position={[theme.portalX, topTierY + vestibuleClearH + 0.08, backZ + 1.44]}
            material={materials.ceilingMat}
          >
            <boxGeometry args={[theme.corridorWidth + 0.3, 0.16, 2.65]} />
          </mesh>
          {[-1, 1].map((side) => (
            <group key={`vestibule-wall-${side}`}>
              <mesh
                position={[
                  theme.portalX + side * (theme.corridorWidth / 2 + 0.1),
                  topTierY + vestibuleClearH / 2,
                  backZ + 1.44,
                ]}
                material={materials.primaryWallMat}
                receiveShadow
              >
                <boxGeometry args={[0.2, vestibuleClearH + 0.16, 2.65]} />
              </mesh>
              <mesh
                position={[
                  theme.portalX + side * (theme.corridorWidth / 2 - 0.02),
                  topTierY + vestibuleClearH - 0.08,
                  backZ + 1.44,
                ]}
                material={materials.accentGlowMat}
              >
                <boxGeometry args={[0.04, 0.035, 2.4]} />
              </mesh>
            </group>
          ))}

          {/* Grand Architectural Hall (z = backZ+2.74 .. corridorEndZ) */}
          <mesh
            position={[theme.portalX, topTierY + theme.corridorHeight + 0.08, indoorMainMidZ]}
            material={materials.ceilingMat}
          >
            <boxGeometry args={[theme.corridorWidth + 0.4, 0.16, indoorMainLen + 0.2]} />
          </mesh>
          {/* Soffit Step Bulkhead Sealing Vestibule-to-Grand-Hall Ceiling Jump */}
          {theme.corridorHeight - vestibuleClearH > 0.05 && (
            <mesh
              position={[
                theme.portalX,
                topTierY + (theme.corridorHeight + vestibuleClearH) * 0.5,
                indoorMainStartZ,
              ]}
              material={materials.primaryWallMat}
            >
              <boxGeometry
                args={[
                  theme.corridorWidth + 0.3,
                  theme.corridorHeight - vestibuleClearH + 0.12,
                  0.18,
                ]}
              />
            </mesh>
          )}

          {/* Corridor Ceiling Architectural Coffers / Cove Strips */}
          {Array.from({ length: bayCount }, (_, ci) => {
            const cz = indoorMainStartZ + (ci + 0.5) * baySpacing;
            return (
              <group key={`ceil-beam-${ci}`} position={[theme.portalX, topTierY + theme.corridorHeight - 0.06, cz]}>
                <mesh material={materials.trimMat}>
                  <boxGeometry args={[theme.corridorWidth - 0.15, 0.12, 0.18]} />
                </mesh>
                <mesh position={[0, -0.065, 0]} material={materials.accentGlowMat}>
                  <boxGeometry args={[theme.corridorWidth * 0.72, 0.02, 0.05]} />
                </mesh>
              </group>
            );
          })}

          {/* Corridor Side Walls & Rear Entrance End Wall */}
          {[-1, 1].map((side) => (
            <mesh
              key={`main-side-wall-${side}`}
              position={[
                theme.portalX + side * (theme.corridorWidth / 2 + 0.1),
                topTierY + theme.corridorHeight / 2,
                indoorMainMidZ,
              ]}
              material={materials.primaryWallMat}
              receiveShadow
            >
              <boxGeometry args={[0.2, theme.corridorHeight + 0.16, indoorMainLen + 0.2]} />
            </mesh>
          ))}
          <mesh
            position={[theme.portalX, topTierY + theme.corridorHeight / 2, corridorEndZ + 0.1]}
            material={materials.primaryWallMat}
          >
            <boxGeometry args={[theme.corridorWidth + 0.4, theme.corridorHeight + 0.2, 0.2]} />
          </mesh>

          {/* Bespoke Patterned Architectural Wall Relief Bays */}
          {renderIndoorWallBays()}
        </group>
      )}

      {/* ===================================================================== */}
      {/* BEACH OPEN-AIR COASTAL ENTRANCE PIER (ZERO ROOF, STARRY SKY)          */}
      {/* ===================================================================== */}
      {isBeach && (
        <group>
          {/* Tiered Coastal Timber / Slate Boardwalk Pier Slabs Following Sand Slope */}
          {Array.from({ length: 12 }, (_, pi) => {
            const z0 = portalZ + 0.2 + pi * 0.62;
            const py = beachHeightAt(0, z0, beachVariant) + 0.02;
            return (
              <mesh
                key={`beach-plank-${pi}`}
                position={[0, py, z0]}
                material={pi % 2 === 0 ? materials.floorMat : materials.runnerMat}
                receiveShadow
              >
                <boxGeometry args={[theme.corridorWidth, 0.08, 0.58]} />
              </mesh>
            );
          })}

          {/* Coastal Pier Side Posts & Stringer Rails + Warm Torches or Bioluminescent Bollards */}
          {[-1, 1].map((side) =>
            [13.0, 14.8, 16.0, 17.6, 19.2].map((pz, pi) => {
              const py = beachHeightAt(side * 1.55, pz, beachVariant);
              return (
                <group
                  key={`beach-post-${side}-${pi}`}
                  position={[side * 1.55, py, pz]}
                >
                  <mesh position={[0, 0.56, 0]} material={materials.trimMat}>
                    <cylinderGeometry args={[0.065, 0.08, 1.12, 10]} />
                  </mesh>
                  <mesh position={[0, 1.16, 0]} material={materials.accentGlowMat}>
                    <cylinderGeometry args={[0.045, 0.055, 0.16, 10]} />
                  </mesh>
                </group>
              );
            }),
          )}
        </group>
      )}

      {/* ===================================================================== */}
      {/* BESPOKE AUDITORIUM PORTAL FRAME + ANIMATED SINGLE/DOUBLE DOORS        */}
      {/* ===================================================================== */}
      <group position={[theme.portalX, portalFloorY, portalZ]}>
        {/* Sculpted Architectural Portal Surround */}
        <mesh position={[-theme.portalW / 2 - 0.08, theme.portalH / 2, -0.02]} material={materials.trimMat}>
          <boxGeometry args={[0.16, theme.portalH + 0.16, 0.36]} />
        </mesh>
        <mesh position={[theme.portalW / 2 + 0.08, theme.portalH / 2, -0.02]} material={materials.trimMat}>
          <boxGeometry args={[0.16, theme.portalH + 0.16, 0.36]} />
        </mesh>
        <mesh position={[0, theme.portalH + 0.07, -0.02]} material={materials.trimMat}>
          <boxGeometry args={[theme.portalW + 0.32, 0.14, 0.38]} />
        </mesh>

        {/* Illuminated Perimeter Portal Arch Trim */}
        <mesh position={[-theme.portalW / 2 + 0.005, theme.portalH / 2, 0.16]} material={materials.accentGlowMat}>
          <boxGeometry args={[0.024, theme.portalH, 0.02]} />
        </mesh>
        <mesh position={[theme.portalW / 2 - 0.005, theme.portalH / 2, 0.16]} material={materials.accentGlowMat}>
          <boxGeometry args={[0.024, theme.portalH, 0.02]} />
        </mesh>
        <mesh position={[0, theme.portalH + 0.005, 0.16]} material={materials.accentGlowMat}>
          <boxGeometry args={[theme.portalW, 0.024, 0.02]} />
        </mesh>

        {/* Engraved Auditorium Header Marquee Plaque (Theater Name Only — Zero Posters) */}
        <group position={[0, theme.portalH + 0.32, 0.1]}>
          <mesh material={materials.metalMat}>
            <boxGeometry args={[Math.min(theme.portalW + 0.1, 2.2), 0.42, 0.08]} />
          </mesh>
          <mesh position={[0, 0, 0.044]} material={materials.plaqueMat}>
            <planeGeometry args={[Math.min(theme.portalW, 2.08), 0.34]} />
          </mesh>
        </group>

        {/* Animated Doors */}
        {(() => {
          const leafH = theme.portalH - 0.04;
          const leafMidY = theme.portalH / 2;

          if (theme.doorMode === 'slide') {
            const leafW = (theme.portalW - 0.06) * 0.5;
            return (
              <group position={[0, leafMidY, -0.1]}>
                <group ref={leftSlideDoorRef} position={[-leafW * 0.5 - 0.01, 0, 0]}>
                  {renderDoorLeafDetails(leafW, leafH, -1)}
                </group>
                <group ref={rightSlideDoorRef} position={[leafW * 0.5 + 0.01, 0, 0]}>
                  {renderDoorLeafDetails(leafW, leafH, 1)}
                </group>
              </group>
            );
          }

          if (theme.isSingleDoor) {
            const leafW = theme.portalW - 0.06;
            const hingeX = theme.hingeSide * (theme.portalW * 0.5 - 0.02);
            const leafOffsetX = -theme.hingeSide * (leafW * 0.5);
            return (
              <group ref={singleSwingDoorRef} position={[hingeX, leafMidY, 0.02]}>
                <group position={[leafOffsetX, 0, 0]}>
                  {renderDoorLeafDetails(leafW, leafH, theme.hingeSide)}
                </group>
              </group>
            );
          }

          const leafW = (theme.portalW - 0.08) * 0.5;
          return (
            <group>
              <group ref={leftSwingDoorRef} position={[-theme.portalW * 0.5 + 0.02, leafMidY, 0.02]}>
                <group position={[leafW * 0.5, 0, 0]}>
                  {renderDoorLeafDetails(leafW, leafH, -1)}
                </group>
              </group>
              <group ref={rightSwingDoorRef} position={[theme.portalW * 0.5 - 0.02, leafMidY, 0.02]}>
                <group position={[-leafW * 0.5, 0, 0]}>
                  {renderDoorLeafDetails(leafW, leafH, 1)}
                </group>
              </group>
            </group>
          );
        })()}
      </group>

      {/* ===================================================================== */}
      {/* SCULPTED ARCHITECTURAL SPEED-GATE & C-ARM OPTICAL QR LASER SCANNER    */}
      {/* ===================================================================== */}
      <group position={[theme.portalX, floorY, gateZ]}>
        {/* Left & Right Sculpted Speed-Gate Pedestal Monoliths */}
        {[-1, 1].map((side) => (
          <group key={`turnstile-pod-${side}`} position={[side * 0.62, 0, 0]}>
            {/* Brushed Metallic Floor Base Plinth */}
            <mesh position={[0, 0.035, 0]} material={materials.gateTrimMat}>
              <boxGeometry args={[0.3, 0.07, 1.18]} />
            </mesh>
            {/* Sculpted Rounded Front & Rear Nose End-Caps */}
            {[-0.48, 0.48].map((nz, ni) => (
              <mesh
                key={`pod-nose-${ni}`}
                position={[0, 0.5, nz]}
                material={materials.gateBodyMat}
                castShadow
                receiveShadow
              >
                <cylinderGeometry args={[0.125, 0.132, 0.9, 18]} />
              </mesh>
            ))}
            {/* Main Anodized Monolith Chassis */}
            <mesh position={[0, 0.5, 0]} material={materials.gateBodyMat} castShadow receiveShadow>
              <boxGeometry args={[0.25, 0.9, 0.96]} />
            </mesh>
            {/* Smoked Tempered Glass Top Deck Cap */}
            <mesh position={[0, 0.965, 0]} material={materials.gateTrimMat}>
              <boxGeometry args={[0.26, 0.035, 1.06]} />
            </mesh>
            {/* Continuous Illuminated Shoulder Accent Strip */}
            <mesh position={[-side * 0.128, 0.88, 0]} material={materials.accentGlowMat}>
              <boxGeometry args={[0.012, 0.022, 0.9]} />
            </mesh>
            {/* Front & Top Curved Status Indicator Beacon */}
            <mesh position={[0, 0.88, 0.58]}>
              <boxGeometry args={[0.15, 0.045, 0.028]} />
              <meshStandardMaterial
                ref={side === 1 ? statusRingMatRef : undefined}
                color="#f59e0b"
                emissive="#f59e0b"
                emissiveIntensity={1.0}
                roughness={0.2}
              />
            </mesh>
          </group>
        ))}

        {/* Integrated C-Arm Optical QR Reader Console + Overhead Laser Emitter + Live OLED Display */}
        <group
          position={[0.48, 0.99, 0.36]}
          rotation={[0, scannerYawY, 0]}
          onPointerOver={(e) => {
            if (entranceComplete) return;
            e.stopPropagation();
            setScannerHovered(true);
          }}
          onPointerOut={() => setScannerHovered(false)}
          onClick={(e) => {
            if (entranceComplete) return;
            e.stopPropagation();
            onScanClick();
          }}
        >
          <group rotation={[scannerTiltX, 0, 0]}>
            {/* Precision Machined Base Housing & Chamfer Rim */}
            <mesh material={materials.gateBodyMat}>
              <boxGeometry args={[0.34, 0.052, 0.34]} />
            </mesh>
            <mesh position={[0, 0.024, 0]} material={materials.gateTrimMat}>
              <boxGeometry args={[0.31, 0.016, 0.31]} />
            </mesh>

            {/* Recessed Optical Camera Chamber & Coated Sensor Lens Under Smoked Platen */}
            <mesh position={[0, 0.022, 0]}>
              <cylinderGeometry args={[0.056, 0.068, 0.014, 24]} />
              <meshStandardMaterial color="#0b0f17" metalness={0.85} roughness={0.25} />
            </mesh>
            <mesh position={[0, 0.03, 0]}>
              <cylinderGeometry args={[0.036, 0.036, 0.008, 24]} />
              <meshStandardMaterial
                color="#091c2e"
                emissive="#0284c7"
                emissiveIntensity={0.45}
                roughness={0.08}
                metalness={0.3}
              />
            </mesh>

            {/* Illuminated Optical Target Reticle Platen Glass */}
            <mesh
              position={[0, 0.035, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
              material={materials.reticleMat}
            >
              <planeGeometry args={[0.27, 0.27]} />
            </mesh>

            {/* Verification Halo Ring Surrounding Sensor Platen */}
            <mesh position={[0, 0.037, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.112, 0.134, 32]} />
              <meshStandardMaterial
                ref={scannerPadGlowMatRef}
                color="#f59e0b"
                emissive="#f59e0b"
                emissiveIntensity={0.7}
                roughness={0.2}
                transparent
                opacity={0.85}
              />
            </mesh>

            {/* Cantilevered Brushed-Titanium Overhead Optical Laser Arch */}
            <group position={[0.165, 0.025, 0]}>
              {/* Vertical Arch Stanchion */}
              <mesh position={[0, 0.09, -0.02]} material={materials.gateBodyMat}>
                <boxGeometry args={[0.036, 0.175, 0.085]} />
              </mesh>
              {/* Overhanging Sensor Hood Spanning Center QR Bay */}
              <mesh position={[-0.165, 0.175, 0.01]} material={materials.gateBodyMat}>
                <boxGeometry args={[0.35, 0.028, 0.09]} />
              </mesh>
              <mesh position={[-0.165, 0.19, 0.01]} material={materials.gateTrimMat}>
                <boxGeometry args={[0.33, 0.008, 0.078]} />
              </mesh>
              {/* Downward-Facing Optical Laser Diode Aperture Slit */}
              <mesh position={[-0.165, 0.16, 0.01]}>
                <boxGeometry args={[0.2, 0.008, 0.018]} />
                <meshBasicMaterial color="#22d3ee" />
              </mesh>
            </group>

            {/* Volumetric Laser Fan Curtain + Crisp Scan Beam Hitting Ticket Face */}
            <group ref={laserBeamGroupRef} visible={false}>
              <mesh ref={laserCurtainRef} position={[0, 0.125, 0.01]}>
                <planeGeometry args={[0.145, 0.14]} />
                <meshBasicMaterial
                  ref={laserCurtainMatRef}
                  color="#22d3ee"
                  transparent
                  opacity={0.28}
                  side={THREE.DoubleSide}
                  blending={THREE.AdditiveBlending}
                  depthWrite={false}
                />
              </mesh>
            </group>

            {/* Angled 3-State High-Contrast OLED Status Display Mounted Above Bay */}
            <group position={[0, 0.142, -0.178]} rotation={[0.18, 0, 0]}>
              <mesh material={materials.gateBodyMat}>
                <boxGeometry args={[0.31, 0.165, 0.026]} />
              </mesh>
              <mesh position={[0, 0, 0.004]} material={materials.gateTrimMat}>
                <boxGeometry args={[0.32, 0.172, 0.016]} />
              </mesh>
              <mesh
                ref={oledIdleMeshRef}
                position={[0, 0, 0.015]}
                material={materials.oledIdleMat}
              >
                <planeGeometry args={[0.285, 0.142]} />
              </mesh>
              <mesh
                ref={oledScanMeshRef}
                position={[0, 0, 0.015]}
                material={materials.oledScanMat}
                visible={false}
              >
                <planeGeometry args={[0.285, 0.142]} />
              </mesh>
              <mesh
                ref={oledOkMeshRef}
                position={[0, 0, 0.015]}
                material={materials.oledOkMat}
                visible={false}
              >
                <planeGeometry args={[0.285, 0.142]} />
              </mesh>
            </group>
          </group>
        </group>

        {/* Tempered Smoked-Glass Barrier Paddles With Glowing Optical Edge Guides */}
        <group position={[0, 0.54, -0.08]}>
          <group ref={leftGatePaddleRef} position={[-0.25, 0, 0]}>
            <mesh material={materials.smokedGlassMat}>
              <boxGeometry args={[0.46, 0.76, 0.022]} />
            </mesh>
            <mesh position={[-0.18, 0, 0]} material={materials.gateTrimMat}>
              <boxGeometry args={[0.07, 0.68, 0.034]} />
            </mesh>
            <mesh position={[0.225, 0, 0]}>
              <boxGeometry args={[0.018, 0.76, 0.028]} />
              <meshStandardMaterial
                ref={paddleEdgeMatRef}
                color={theme.accentColor}
                emissive={theme.accentColor}
                emissiveIntensity={0.75}
                roughness={0.2}
              />
            </mesh>
          </group>

          <group ref={rightGatePaddleRef} position={[0.25, 0, 0]}>
            <mesh material={materials.smokedGlassMat}>
              <boxGeometry args={[0.46, 0.76, 0.022]} />
            </mesh>
            <mesh position={[0.18, 0, 0]} material={materials.gateTrimMat}>
              <boxGeometry args={[0.07, 0.68, 0.034]} />
            </mesh>
            <mesh position={[-0.225, 0, 0]}>
              <boxGeometry args={[0.018, 0.76, 0.028]} />
              <meshStandardMaterial
                color={theme.accentColor}
                emissive={theme.accentColor}
                emissiveIntensity={0.75}
                roughness={0.2}
              />
            </mesh>
          </group>
        </group>
      </group>

      {/* ===================================================================== */}
      {/* INTERACTIVE 3D LUXURY CINEMA TICKET PASS                              */}
      {/* ===================================================================== */}
      <CinemaTicket3D
        config={config}
        theme={theme}
        seatId={seatId}
        corridorStateRef={corridorStateRef}
        handAnchor={handAnchor}
        scannerAnchor={scannerAnchor}
        scannerYawY={scannerYawY}
        scannerTiltX={scannerTiltX}
        onScanClick={onScanClick}
        interactive={!entranceComplete}
      />
    </group>
  );
};
