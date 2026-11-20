import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { CameraViewMode } from '../../types/cinema';

interface ReservedSeatMarkerProps {
  position: [number, number, number];
  yaw: number;
  plaqueLocalPos: [number, number, number];
  seatLabel: string;
  accentHex?: string;
  lightFactor: number;
  isPlaying: boolean;
  viewMode: CameraViewMode;
  floorRingYOffset?: number;
  floorRingRadius?: [number, number];
}

function createReservedPlaqueTexture(seatLabel: string, accentHex: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Rich brushed dark obsidian plate with metallic accent hairline
    ctx.fillStyle = '#0c0e14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = accentHex;
    ctx.lineWidth = 10;
    ctx.strokeRect(16, 16, canvas.width - 32, canvas.height - 32);

    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 2;
    ctx.strokeRect(30, 30, canvas.width - 60, canvas.height - 60);

    ctx.fillStyle = accentHex;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 42px system-ui, -apple-system, sans-serif';
    ctx.fillText('RESERVED', canvas.width / 2, 96);

    ctx.fillStyle = '#f4f1ea';
    ctx.font = '600 46px ui-monospace, SFMono-Regular, monospace';
    ctx.fillText(`SEAT ${seatLabel}`, canvas.width / 2, 166);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

function createPlaybillTexture(seatLabel: string, accentHex: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 384;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#141721';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = accentHex;
    ctx.lineWidth = 8;
    ctx.strokeRect(14, 14, canvas.width - 28, canvas.height - 28);

    ctx.fillStyle = accentHex;
    ctx.fillRect(36, 48, canvas.width - 72, 4);
    ctx.fillRect(36, 332, canvas.width - 72, 4);

    ctx.fillStyle = '#f4f1ea';
    ctx.textAlign = 'center';
    ctx.font = '700 22px system-ui, -apple-system, sans-serif';
    ctx.fillText('AURELIA', canvas.width / 2, 128);

    ctx.fillStyle = accentHex;
    ctx.font = '600 16px system-ui, -apple-system, sans-serif';
    ctx.fillText('PRIVATE SCREENING', canvas.width / 2, 164);

    ctx.fillStyle = '#d4d4d8';
    ctx.font = '600 26px ui-monospace, SFMono-Regular, monospace';
    ctx.fillText(seatLabel, canvas.width / 2, 232);

    ctx.fillStyle = 'rgba(244,241,234,0.55)';
    ctx.font = '500 14px system-ui, -apple-system, sans-serif';
    ctx.fillText('RESERVED FOR YOU', canvas.width / 2, 276);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

export const ReservedSeatMarker: React.FC<ReservedSeatMarkerProps> = ({
  position,
  yaw,
  plaqueLocalPos,
  seatLabel,
  accentHex = '#d4af37',
  lightFactor,
  isPlaying,
  viewMode,
  floorRingYOffset = 0.014,
  floorRingRadius = [0.42, 0.47],
}) => {
  const resources = useMemo(() => {
    const plaqueTex = createReservedPlaqueTexture(seatLabel, accentHex);
    const playbillTex = createPlaybillTexture(seatLabel, accentHex);

    const metalMat = new THREE.MeshStandardMaterial({
      color: accentHex,
      roughness: 0.28,
      metalness: 0.85,
      emissive: accentHex,
      emissiveIntensity: 0.14,
    });

    const plaqueFaceMat = new THREE.MeshStandardMaterial({
      map: plaqueTex,
      roughness: 0.36,
      metalness: 0.25,
      emissive: accentHex,
      emissiveMap: plaqueTex,
      emissiveIntensity: 0.45,
    });

    const playbillMat = new THREE.MeshStandardMaterial({
      map: playbillTex,
      roughness: 0.78,
      metalness: 0.04,
      emissive: accentHex,
      emissiveIntensity: 0.06,
    });

    const playbillEdgeMat = new THREE.MeshStandardMaterial({
      color: '#e7e2d7',
      roughness: 0.85,
    });

    const ringMat = new THREE.MeshBasicMaterial({
      color: accentHex,
      transparent: true,
      opacity: 0.72,
    });

    return {
      plaqueTex,
      playbillTex,
      metalMat,
      plaqueFaceMat,
      playbillMat,
      playbillEdgeMat,
      ringMat,
    };
  }, [seatLabel, accentHex]);

  useEffect(() => {
    return () => {
      resources.plaqueTex.dispose();
      resources.playbillTex.dispose();
      resources.metalMat.dispose();
      resources.plaqueFaceMat.dispose();
      resources.playbillMat.dispose();
      resources.playbillEdgeMat.dispose();
      resources.ringMat.dispose();
    };
  }, [resources]);

  if (viewMode === 'screen_full') {
    return null;
  }

  const isExploreMode = viewMode === 'hall' || viewMode === 'walk';

  // Keep physical plaque legible when house lights are on or inspecting in Hall/Walk View, and subtly dimmed during active movie
  const activeVisibility = isPlaying && !isExploreMode ? 0.22 : Math.max(0.35, lightFactor);
  resources.plaqueFaceMat.emissiveIntensity = isExploreMode ? 0.65 : 0.42 * activeVisibility;
  resources.metalMat.emissiveIntensity = isExploreMode ? 0.22 : 0.1 * activeVisibility;

  const showFloorRing = isExploreMode || (!isPlaying && lightFactor > 0.12);
  resources.ringMat.opacity =
    isExploreMode
      ? 0.78
      : Math.max(0, 0.58 * lightFactor);

  return (
    <group position={position} rotation={[0, yaw, 0]}>
      {/* Grounded Sculpted Brass/Cyan Tent Stand + Folded Screening Program on Seat Cushion */}
      <group position={plaqueLocalPos}>
        {/* Folded Linen Screening Program lying beside the plaque */}
        <group position={[-0.145, 0.008, 0.015]} rotation={[0, 0.16, 0]}>
          <mesh material={resources.playbillEdgeMat} castShadow>
            <boxGeometry args={[0.105, 0.012, 0.15]} />
          </mesh>
          <mesh position={[0, 0.0068, 0]} rotation={[-Math.PI / 2, 0, 0]} material={resources.playbillMat}>
            <planeGeometry args={[0.103, 0.148]} />
          </mesh>
        </group>

        {/* Sculpted Beveled Metallic Tent Stand ("RESERVED · SEAT") */}
        <group position={[0.02, 0, 0]} rotation={[0, -0.14, 0]}>
          {/* Machined Base Foot */}
          <mesh position={[0, 0.005, 0]} material={resources.metalMat} castShadow>
            <boxGeometry args={[0.155, 0.01, 0.088]} />
          </mesh>
          {/* Rear Angled Tent Leg */}
          <mesh position={[0, 0.036, 0.018]} rotation={[-0.38, 0, 0]} material={resources.metalMat} castShadow>
            <boxGeometry args={[0.145, 0.068, 0.008]} />
          </mesh>
          {/* Front Angled Display Tent Leg */}
          <mesh position={[0, 0.036, -0.018]} rotation={[0.38, 0, 0]} material={resources.metalMat} castShadow>
            <boxGeometry args={[0.145, 0.068, 0.008]} />
          </mesh>
          {/* Front Engraved/Illuminated Plaque Face */}
          <group rotation={[0, Math.PI, 0]}>
            <mesh
              position={[0, 0.036, 0.023]}
              rotation={[-0.38, 0, 0]}
              material={resources.plaqueFaceMat}
            >
              <planeGeometry args={[0.136, 0.062]} />
            </mesh>
          </group>
          {/* Rear Face (visible from behind and when looking down while seated) */}
          <mesh
            position={[0, 0.036, 0.023]}
            rotation={[-0.38, 0, 0]}
            material={resources.plaqueFaceMat}
          >
            <planeGeometry args={[0.136, 0.062]} />
          </mesh>
        </group>
      </group>

      {/* Subtle Ground Perimeter Highlight Ring in Hall View / Pre-Show */}
      {showFloorRing && (
        <mesh position={[0, floorRingYOffset, 0.02]} rotation={[-Math.PI / 2, 0, 0]} material={resources.ringMat}>
          <ringGeometry args={[floorRingRadius[0], floorRingRadius[1], 40]} />
        </mesh>
      )}
    </group>
  );
};
