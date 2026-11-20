import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { TheaterConfiguration } from '../../types/cinema';
import {
  CorridorAnimationState,
  CorridorThemeConfig,
} from './corridorThemes';

interface CinemaTicket3DProps {
  config: TheaterConfiguration;
  theme: CorridorThemeConfig;
  seatId: string;
  corridorStateRef: React.MutableRefObject<CorridorAnimationState>;
  handAnchor: [number, number, number];
  scannerAnchor: [number, number, number];
  scannerYawY: number;
  scannerTiltX: number;
  onScanClick: () => void;
  interactive: boolean;
}

const _posA = new THREE.Vector3();
const _posB = new THREE.Vector3();
const _eulerA = new THREE.Euler(0, 0, 0, 'YXZ');
const _quatA = new THREE.Quaternion();

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function createLuxuryTicketTexture(
  config: TheaterConfiguration,
  theme: CorridorThemeConfig,
  seatId: string,
): THREE.CanvasTexture {
  const w = 1024;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Deep multi-stop luxury foil card background
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, theme.ticketBgPrimary);
  grad.addColorStop(0.5, theme.ticketBgSecondary);
  grad.addColorStop(1, theme.ticketBgPrimary);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Security guilloche diagonal watermark lines
  ctx.save();
  ctx.strokeStyle = theme.ticketAccent;
  ctx.globalAlpha = 0.085;
  ctx.lineWidth = 1.5;
  for (let i = -h; i < w + h; i += 22) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + h * 0.65, h);
    ctx.stroke();
  }
  ctx.restore();

  // Outer engraved foil border
  ctx.save();
  ctx.strokeStyle = theme.ticketAccent;
  ctx.lineWidth = 3.2;
  drawRoundedRect(ctx, 26, 26, w - 52, h - 52, 18);
  ctx.stroke();

  ctx.globalAlpha = 0.42;
  ctx.lineWidth = 1.2;
  drawRoundedRect(ctx, 36, 36, w - 72, h - 72, 12);
  ctx.stroke();
  ctx.restore();

  // Left vertical accent spine
  ctx.fillStyle = theme.ticketAccent;
  ctx.fillRect(54, 58, 12, 152);

  // Category & VIP classification badge
  ctx.save();
  ctx.fillStyle = theme.ticketAccent;
  ctx.globalAlpha = 0.16;
  drawRoundedRect(ctx, 84, 58, 258, 36, 6);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = theme.ticketAccent;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = theme.ticketAccent;
  ctx.font = '700 18px "Inter", system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(`VIP PASS · ${config.categoryId.toUpperCase()}`, 102, 77);

  // Theater title
  ctx.fillStyle = theme.ticketTextLight;
  ctx.font = '700 40px Georgia, serif';
  ctx.textBaseline = 'top';
  ctx.fillText(config.theaterName, 84, 114, 585);

  ctx.fillStyle = theme.ticketAccent;
  ctx.font = '600 17px "Inter", system-ui, sans-serif';
  ctx.fillText(
    `${config.environmentProfile.architectureStyle.toUpperCase()} AUDITORIUM · RESERVED ACCESS`,
    84,
    172,
    585,
  );

  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(58, 224, 620, 2);

  // Parse seat ID cleanly (e.g., E10 -> Row E, Seat 10)
  const match = seatId.match(/^([A-Za-z]+)(\d+)$/);
  const rowStr = match ? match[1].toUpperCase() : seatId.slice(0, 1);
  const numStr = match ? match[2] : seatId.slice(1) || '1';

  const drawStatBlock = (
    bx: number,
    by: number,
    bw: number,
    label: string,
    value: string,
    highlight = false,
  ) => {
    ctx.save();
    ctx.fillStyle = highlight ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.04)';
    drawRoundedRect(ctx, bx, by, bw, 116, 12);
    ctx.fill();
    ctx.strokeStyle = highlight ? theme.ticketAccent : 'rgba(255,255,255,0.16)';
    ctx.lineWidth = highlight ? 2 : 1.2;
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = 'rgba(244,241,234,0.62)';
    ctx.font = '600 15px "Inter", system-ui, sans-serif';
    ctx.fillText(label, bx + 20, by + 18);

    ctx.fillStyle = highlight ? theme.ticketAccent : theme.ticketTextLight;
    ctx.font = '700 44px "JetBrains Mono", monospace';
    ctx.fillText(value, bx + 20, by + 48, bw - 36);
  };

  drawStatBlock(60, 250, 175, 'ROW', rowStr, true);
  drawStatBlock(254, 250, 195, 'SEAT', numStr, true);
  drawStatBlock(468, 250, 206, 'ADMIT', '01 VIP', false);

  const seed = hashSeed(`${config.theaterId}-${seatId}`);
  const serialCode = `SC-${config.theaterId.slice(0, 4).toUpperCase()}-${seatId.toUpperCase()}-${(seed % 8999) + 1000}`;
  ctx.fillStyle = 'rgba(244,241,234,0.62)';
  ctx.font = '600 16px "JetBrains Mono", monospace';
  ctx.fillText(`PASS ID  ${serialCode}`, 62, 398);

  ctx.fillStyle = theme.ticketTextLight;
  let bxCursor = 62;
  for (let i = 0; i < 42; i++) {
    const bit = ((seed >> (i % 24)) + i * 7) % 4;
    const barW = bit === 0 ? 6 : bit === 1 ? 3 : 2;
    ctx.fillRect(bxCursor, 430, barW, 30);
    bxCursor += barW + (i % 3 === 0 ? 5 : 3);
  }

  // Perforated vertical tear seam
  ctx.save();
  ctx.strokeStyle = theme.ticketAccent;
  ctx.globalAlpha = 0.65;
  ctx.lineWidth = 2.5;
  ctx.setLineDash([10, 10]);
  ctx.beginPath();
  ctx.moveTo(706, 44);
  ctx.lineTo(706, h - 44);
  ctx.stroke();
  ctx.restore();

  // Right optical QR stub panel (center x = 846 -> normalized +0.098m on 0.35m card)
  ctx.fillStyle = theme.ticketAccent;
  ctx.font = '700 17px "Inter", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('OPTICAL QR', 846, 56);

  const qrSize = 232;
  const qrX = 730;
  const qrY = 92;
  ctx.save();
  ctx.fillStyle = '#ffffff';
  drawRoundedRect(ctx, qrX, qrY, qrSize, qrSize, 14);
  ctx.fill();
  ctx.strokeStyle = theme.ticketAccent;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();

  const grid = 21;
  const pad = 20;
  const cell = (qrSize - pad * 2) / grid;
  const isFinder = (r: number, c: number) =>
    (r < 7 && c < 7) || (r < 7 && c >= grid - 7) || (r >= grid - 7 && c < 7);

  const drawFinder = (r0: number, c0: number) => {
    ctx.fillStyle = '#090b10';
    ctx.fillRect(qrX + pad + c0 * cell, qrY + pad + r0 * cell, 7 * cell, 7 * cell);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(
      qrX + pad + (c0 + 1) * cell,
      qrY + pad + (r0 + 1) * cell,
      5 * cell,
      5 * cell,
    );
    ctx.fillStyle = '#090b10';
    ctx.fillRect(
      qrX + pad + (c0 + 2) * cell,
      qrY + pad + (r0 + 2) * cell,
      3 * cell,
      3 * cell,
    );
  };

  drawFinder(0, 0);
  drawFinder(0, grid - 7);
  drawFinder(grid - 7, 0);

  ctx.fillStyle = '#090b10';
  for (let r = 0; r < grid; r++) {
    for (let c = 0; c < grid; c++) {
      if (isFinder(r, c)) continue;
      if (r === 6 || c === 6) {
        if ((r + c) % 2 === 0) {
          ctx.fillRect(qrX + pad + c * cell, qrY + pad + r * cell, cell * 0.95, cell * 0.95);
        }
        continue;
      }
      const mix = hashSeed(`${seed}-${r}-${c}`);
      if (mix % 11 < 5) {
        ctx.fillRect(qrX + pad + c * cell, qrY + pad + r * cell, cell * 0.96, cell * 0.96);
      }
    }
  }

  ctx.fillStyle = theme.ticketTextLight;
  ctx.font = '700 28px "JetBrains Mono", monospace';
  ctx.fillText(`SEAT ${seatId.toUpperCase()}`, 846, 344);

  ctx.fillStyle = theme.ticketAccent;
  ctx.font = '600 15px "Inter", system-ui, sans-serif';
  ctx.fillText('CLICK TO SCAN', 846, 386);

  ctx.fillStyle = 'rgba(244,241,234,0.55)';
  ctx.font = '500 13px "JetBrains Mono", monospace';
  ctx.fillText(serialCode, 846, 422);

  ctx.textAlign = 'left';

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function buildNotchedTicketGeometry(
  width: number,
  height: number,
  depth: number,
): THREE.ExtrudeGeometry {
  const hw = width / 2;
  const hh = height / 2;
  const c = 0.014;
  const nr = 0.017;

  const shape = new THREE.Shape();
  shape.moveTo(-hw + c, -hh);
  shape.lineTo(hw - c, -hh);
  shape.lineTo(hw, -hh + c);
  shape.lineTo(hw, -nr);
  shape.absarc(hw, 0, nr, -Math.PI / 2, Math.PI / 2, true);
  shape.lineTo(hw, hh - c);
  shape.lineTo(hw - c, hh);
  shape.lineTo(-hw + c, hh);
  shape.lineTo(-hw, hh - c);
  shape.lineTo(-hw, nr);
  shape.absarc(-hw, 0, nr, Math.PI / 2, -Math.PI / 2, true);
  shape.lineTo(-hw, -hh + c);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.0012,
    bevelSize: 0.0012,
    bevelSegments: 2,
    curveSegments: 14,
  });
  geo.center();
  return geo;
}

export const CinemaTicket3D: React.FC<CinemaTicket3DProps> = ({
  config,
  theme,
  seatId,
  corridorStateRef,
  handAnchor,
  scannerAnchor,
  scannerYawY,
  scannerTiltX,
  onScanClick,
  interactive,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const faceMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const qrHighlightRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  // Exact world quaternion so front QR face (+Z local) aligns cleanly upward toward scanner head & viewer
  const scannerTargetQuat = useMemo(() => {
    const qYaw = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(0, scannerYawY, 0, 'YXZ'),
    );
    const qDeck = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(scannerTiltX, 0, 0, 'YXZ'),
    );
    const qFlatFaceUp = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(-Math.PI / 2, 0, 0, 'YXZ'),
    );
    return qYaw.multiply(qDeck).multiply(qFlatFaceUp);
  }, [scannerYawY, scannerTiltX]);

  useEffect(() => {
    if (!interactive) {
      setHovered(false);
    }
    return () => {
      document.body.style.cursor = 'auto';
    };
  }, [interactive]);

  useEffect(() => {
    if (interactive && hovered) {
      document.body.style.cursor = 'pointer';
    } else {
      document.body.style.cursor = 'auto';
    }
  }, [hovered, interactive]);

  const ticketTexture = useMemo(
    () => createLuxuryTicketTexture(config, theme, seatId),
    [config, theme, seatId],
  );

  const ticketGeo = useMemo(() => buildNotchedTicketGeometry(0.35, 0.175, 0.004), []);

  const rimMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: theme.ticketAccent,
        metalness: 0.88,
        roughness: 0.22,
      }),
    [theme.ticketAccent],
  );

  const backMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: theme.ticketBgPrimary,
        metalness: 0.45,
        roughness: 0.45,
      }),
    [theme.ticketBgPrimary],
  );

  const faceMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: ticketTexture,
        roughness: 0.24,
        metalness: 0.24,
        emissive: new THREE.Color(theme.ticketAccent),
        emissiveIntensity: 0.05,
      }),
    [ticketTexture, theme.ticketAccent],
  );

  useEffect(() => {
    return () => {
      ticketTexture.dispose();
      ticketGeo.dispose();
      rimMat.dispose();
      backMat.dispose();
      faceMat.dispose();
    };
  }, [ticketTexture, ticketGeo, rimMat, backMat, faceMat]);

  useFrame((state) => {
    const grp = groupRef.current;
    if (!grp) return;

    const st = corridorStateRef.current;
    const vis = st.ticketVisible;
    grp.visible = vis > 0.015;
    if (!grp.visible) return;

    const scanT = THREE.MathUtils.clamp(st.ticketScanT, 0, 1);
    const t = state.clock.elapsedTime;
    const idleFactor = 1 - Math.min(1, scanT * 5);

    const idleBob = Math.sin(t * 2.2) * 0.008 * idleFactor;
    const idleTiltZ = Math.sin(t * 1.45) * 0.03 * idleFactor;
    const hoverBoost = hovered && interactive ? 0.018 * idleFactor : 0;

    _posA.set(handAnchor[0], handAnchor[1] + idleBob + hoverBoost, handAnchor[2]);
    _posB.set(scannerAnchor[0], scannerAnchor[1], scannerAnchor[2]);

    grp.position.lerpVectors(_posA, _posB, scanT);
    // Natural forward wrist presentation arc into the optical cradle
    grp.position.y += Math.sin(scanT * Math.PI) * 0.095;

    _eulerA.set(-0.22, -0.24, 0.04 + idleTiltZ, 'YXZ');
    _quatA.setFromEuler(_eulerA);
    grp.quaternion.slerpQuaternions(_quatA, scannerTargetQuat, scanT);

    // Subtle tuck shrink once pass is verified and gates open
    const scale =
      Math.max(0.001, vis) * (hovered && interactive && scanT < 0.02 ? 1.035 : 1);
    grp.scale.setScalar(scale);

    if (faceMatRef.current) {
      faceMatRef.current.emissiveIntensity =
        0.05 + st.laserActive * 0.14 + st.scanFlash * 0.25 + (hovered && interactive ? 0.06 : 0);
    }

    // Crisp illuminated optical scan bar sweeping directly across the QR square on the front of the ticket
    if (qrHighlightRef.current) {
      const showQrPulse = st.laserActive > 0.05 || st.scanFlash > 0.05;
      qrHighlightRef.current.visible = showQrPulse;
      if (showQrPulse) {
        const yOff = (0.5 - st.laserSweep) * 0.072;
        qrHighlightRef.current.position.set(0.11, 0.006 + yOff, 0.0048);
        const m = qrHighlightRef.current.material as THREE.MeshBasicMaterial;
        if (st.scanFlash > 0.05) {
          m.color.set('#10b981');
          m.opacity = 0.75 * st.scanFlash;
          qrHighlightRef.current.scale.set(1, 5.5, 1);
        } else {
          m.color.set('#22d3ee');
          m.opacity = 0.9 * st.laserActive;
          qrHighlightRef.current.scale.set(1, 1, 1);
        }
      }
    }
  });

  const isTicketInteractive = () =>
    interactive && corridorStateRef.current.phase === 'ticket_check';

  return (
    <group
      ref={groupRef}
      onPointerOver={(e) => {
        if (!isTicketInteractive()) return;
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => {
        setHovered(false);
      }}
      onClick={(e) => {
        if (!isTicketInteractive()) return;
        e.stopPropagation();
        onScanClick();
      }}
    >
      {/* Extruded Metallic Ticket Chassis */}
      <mesh geometry={ticketGeo} material={rimMat} castShadow />

      {/* Front Printed VIP Pass & Crisp QR Stub Face */}
      <mesh position={[0, 0, 0.0033]}>
        <planeGeometry args={[0.338, 0.166]} />
        <primitive object={faceMat} ref={faceMatRef} attach="material" />
      </mesh>

      {/* Rear Metallic Card Backing */}
      <mesh position={[0, 0, -0.0033]} rotation={[0, Math.PI, 0]} material={backMat}>
        <planeGeometry args={[0.338, 0.166]} />
      </mesh>

      {/* Subtle Embossed Holographic Perforation Foil Seam */}
      <mesh position={[0.065, 0, 0.0035]}>
        <planeGeometry args={[0.003, 0.156]} />
        <meshStandardMaterial
          color={theme.ticketAccent}
          emissive={theme.ticketAccent}
          emissiveIntensity={0.45}
          metalness={0.95}
          roughness={0.15}
        />
      </mesh>

      {/* Direct Optical Laser Strike Highlight Line Sweeping Across Visible QR Stub */}
      <mesh ref={qrHighlightRef} position={[0.11, 0.006, 0.0048]} visible={false}>
        <planeGeometry args={[0.088, 0.008]} />
        <meshBasicMaterial
          color="#22d3ee"
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
};
