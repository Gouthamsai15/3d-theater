import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { TheaterConfiguration } from '../../types/cinema';

interface FourDxEffectsRigProps {
  config: TheaterConfiguration;
  enabled: boolean;
  isPlaying: boolean;
  intensity: number; // 0..1
  atmosphericLightEnabled: boolean;
  fourDxFlashRef?: React.MutableRefObject<{ level: number; color: string }>;
}

export const FourDxEffectsRig: React.FC<FourDxEffectsRigProps> = ({
  config,
  enabled,
  isPlaying,
  intensity,
  atmosphericLightEnabled,
  fourDxFlashRef,
}) => {
  const windPointsRef = useRef<THREE.Points>(null);
  const rainPointsRef = useRef<THREE.Points>(null);
  const snowPointsRef = useRef<THREE.Points>(null);
  const fogMeshRef = useRef<THREE.Mesh>(null);
  const strobeLightRef = useRef<THREE.PointLight>(null);
  const strobeBarMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const turbineRefs = useRef<(THREE.Group | null)[]>([]);

  const particleCount = 210;
  const rainCount = 160;
  const snowCount = 240;
  const isCrimson4dx = config.sideLightStyle === 'crimson_velocity_4dx';
  const isArctic4dx = config.sideLightStyle === 'arctic_parametric_fins';
  const isThunder4dx = config.sideLightStyle === 'thunder_emerald_waves';
  const isExoskeleton4dx = config.sideLightStyle === 'exoskeleton_crimson_matrix_4dx';
  const hasBespoke4dxMist = isCrimson4dx || isArctic4dx || isThunder4dx || isExoskeleton4dx;

  const { W, L, H, firstRowZ, screenZ, screenY, screenW, screenH } = useMemo(
    () => ({
      W: config.auditoriumWidth,
      L: config.auditoriumLength,
      H: config.auditoriumHeight,
      firstRowZ: config.firstRowZ,
      screenZ: config.screenPosition[2],
      screenY: config.screenPosition[1],
      screenW: config.screenWidth,
      screenH: config.screenHeight,
    }),
    [config],
  );

  // Front environmental truss storm-wind axial turbine coordinates matching AuditoriumShell shrouds
  const turbinePositions = useMemo(() => {
    if (!isExoskeleton4dx) return [];
    const topTrussY = screenY + screenH * 0.5 + 1.08;
    const flankX = Math.min(W * 0.44, screenW * 0.5 + 0.92);
    const trussZ = screenZ + 0.52;
    return [
      { x: -W * 0.22, y: topTrussY, z: trussZ, radius: 0.62 },
      { x: W * 0.22, y: topTrussY, z: trussZ, radius: 0.62 },
      { x: -flankX, y: screenY + 1.4, z: trussZ, radius: 0.54 },
      { x: flankX, y: screenY + 1.4, z: trussZ, radius: 0.54 },
    ];
  }, [isExoskeleton4dx, W, screenW, screenH, screenY, screenZ]);

  const windGeo = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * (W - 2.5);
      positions[i * 3 + 1] = 1.2 + Math.random() * (H - 2.5);
      positions[i * 3 + 2] = screenZ + Math.random() * (L * 0.85);
    }
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geom;
  }, [W, L, H, screenZ]);

  const rainGeo = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * (W - 3.0);
      positions[i * 3 + 1] = 1.4 + Math.random() * (H - 2.2);
      positions[i * 3 + 2] = firstRowZ - 0.5 + Math.random() * (L * 0.65);
    }
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geom;
  }, [W, L, H, firstRowZ]);

  const snowGeo = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(snowCount * 3);
    for (let i = 0; i < snowCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * (W - 3.0);
      positions[i * 3 + 1] = 1.5 + Math.random() * (H - 2.6);
      positions[i * 3 + 2] = firstRowZ - 0.5 + Math.random() * (L * 0.68);
    }
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geom;
  }, [W, L, H, firstRowZ]);

  const mistSprite = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext('2d')!;
    const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255,255,255,0.92)');
    grad.addColorStop(0.45, 'rgba(255,255,255,0.36)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    return tex;
  }, []);

  const windMat = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: '#bae6fd',
        map: mistSprite,
        size: 0.14,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    [mistSprite],
  );

  const rainMat = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: '#7dd3fc',
        map: mistSprite,
        size: 0.095,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    [mistSprite],
  );

  const snowMat = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: '#f1f5f9',
        map: mistSprite,
        size: 0.135,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    [mistSprite],
  );

  const bladeMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#20242c',
        roughness: 0.34,
        metalness: 0.78,
      }),
    [],
  );

  const hubMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#b91c1c',
        roughness: 0.3,
        metalness: 0.55,
      }),
    [],
  );

  useEffect(() => {
    return () => {
      windGeo.dispose();
      rainGeo.dispose();
      snowGeo.dispose();
      windMat.dispose();
      rainMat.dispose();
      snowMat.dispose();
      mistSprite.dispose();
      bladeMat.dispose();
      hubMat.dispose();
    };
  }, [windGeo, rainGeo, snowGeo, windMat, rainMat, snowMat, mistSprite, bladeMat, hubMat]);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    const active = Boolean(config.supports4dxEffects) && enabled && isPlaying && intensity > 0.02;

    if (!active) {
      windMat.opacity = THREE.MathUtils.lerp(windMat.opacity, 0, 0.15);
      rainMat.opacity = THREE.MathUtils.lerp(rainMat.opacity, 0, 0.15);
      snowMat.opacity = THREE.MathUtils.lerp(snowMat.opacity, 0, 0.15);
      if (fogMeshRef.current) {
        const mat = fogMeshRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = THREE.MathUtils.lerp(mat.opacity, 0, 0.15);
      }
      if (strobeLightRef.current) {
        strobeLightRef.current.intensity = THREE.MathUtils.lerp(
          strobeLightRef.current.intensity,
          0,
          0.2,
        );
      }
      if (strobeBarMatRef.current) {
        strobeBarMatRef.current.opacity = THREE.MathUtils.lerp(
          strobeBarMatRef.current.opacity,
          0,
          0.2,
        );
      }
      if (fourDxFlashRef) {
        fourDxFlashRef.current.level = 0;
      }
      return;
    }

    const t = clock.getElapsedTime();
    // Rhythmic theme-park gust wave
    const gustWave = Math.max(0, Math.sin(t * 0.75) * 0.6 + Math.sin(t * 1.9) * 0.4);
    const speed = (6.5 + gustWave * 14.0) * intensity;

    // Spin front environmental truss axial wind turbine blades smoothly with gusts
    if (isExoskeleton4dx) {
      const omega = (6.0 + gustWave * 16.0) * intensity * dt;
      for (let i = 0; i < turbinePositions.length; i++) {
        const rotor = turbineRefs.current[i];
        if (rotor) {
          rotor.rotation.z += i % 2 === 0 ? omega : -omega;
        }
      }
    }

    // Move air/mist streak particles toward the back of the hall
    const posAttr = windGeo.getAttribute('position') as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    for (let i = 0; i < particleCount; i++) {
      arr[i * 3 + 2] += speed * dt;
      arr[i * 3 + 1] += Math.sin(t * 3 + i) * 0.15 * dt;
      if (arr[i * 3 + 2] > L * 0.45) {
        arr[i * 3] = (Math.random() - 0.5) * (W - 2.5);
        arr[i * 3 + 1] = 1.0 + Math.random() * (H - 2.4);
        arr[i * 3 + 2] = screenZ + 0.8;
      }
    }
    posAttr.needsUpdate = true;
    windMat.opacity = (0.14 + gustWave * 0.35) * intensity;

    // Overhead rain-mist / mist diffuser droplet fall
    if (hasBespoke4dxMist) {
      const rainWave = Math.max(0, Math.sin(t * 0.55 + 1.1));
      const rainAttr = rainGeo.getAttribute('position') as THREE.BufferAttribute;
      const rArr = rainAttr.array as Float32Array;
      const fallSpeed = (hasBespoke4dxMist ? 4.8 + rainWave * 4.5 : 3.2 + rainWave * 3.0) * intensity;
      for (let i = 0; i < rainCount; i++) {
        rArr[i * 3 + 1] -= fallSpeed * dt;
        if (rArr[i * 3 + 1] < 0.8) {
          rArr[i * 3] = (Math.random() - 0.5) * (W - 3.0);
          rArr[i * 3 + 1] = H - 0.72;
          rArr[i * 3 + 2] = firstRowZ - 0.5 + Math.random() * (L * 0.65);
        }
      }
      rainAttr.needsUpdate = true;
      rainMat.opacity = (hasBespoke4dxMist ? 0.1 + rainWave * 0.24 : 0.08 + rainWave * 0.18) * intensity;
    } else {
      rainMat.opacity = 0;
    }

    // Overhead swirling snow flake drift from ceiling blower arrays (4DX Exo-Skeleton 550)
    if (isExoskeleton4dx) {
      const snowWave = Math.max(0, Math.sin(t * 0.42 + 2.4));
      const snowAttr = snowGeo.getAttribute('position') as THREE.BufferAttribute;
      const sArr = snowAttr.array as Float32Array;
      const snowFall = (1.6 + snowWave * 1.4) * intensity;
      for (let i = 0; i < snowCount; i++) {
        sArr[i * 3] += Math.sin(t * 1.4 + i * 0.37) * 0.65 * dt;
        sArr[i * 3 + 1] -= snowFall * dt;
        sArr[i * 3 + 2] += Math.cos(t * 1.1 + i * 0.29) * 0.35 * dt;
        if (sArr[i * 3 + 1] < 1.2) {
          sArr[i * 3] = (Math.random() - 0.5) * (W - 3.2);
          sArr[i * 3 + 1] = H - 0.85;
          sArr[i * 3 + 2] = firstRowZ - 0.5 + Math.random() * (L * 0.68);
        }
      }
      snowAttr.needsUpdate = true;
      snowMat.opacity = (0.08 + snowWave * 0.34) * intensity;
    } else {
      snowMat.opacity = 0;
    }

    // Low front fog-machine stage riser / truss mist plume oscillation
    if (fogMeshRef.current) {
      const fogWave = (Math.sin(t * 0.65) + 1) * 0.5;
      const mat = fogMeshRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = (isExoskeleton4dx ? 0.09 + fogWave * 0.18 : hasBespoke4dxMist ? 0.07 + fogWave * 0.15 : 0.04 + fogWave * 0.12) * intensity;
      fogMeshRef.current.position.x = Math.sin(t * 0.4) * 1.2;
    }

    // Periodic lightning / strobe burst synced with motion wave
    const strobeBurst = Math.pow(Math.max(0, Math.sin(t * 1.15) * Math.sin(t * 4.3)), 4);
    const flashLevel = atmosphericLightEnabled ? strobeBurst * intensity : 0;
    const isWarmPyro = Math.sin(t * 0.45) > 0;
    const flashColor = isExoskeleton4dx
      ? isWarmPyro
        ? '#ef4444'
        : '#e2e8f0'
      : isCrimson4dx
        ? isWarmPyro
          ? '#ef4444'
          : '#bae6fd'
        : isArctic4dx
          ? isWarmPyro
            ? '#a855f7'
            : '#22d3ee'
          : isThunder4dx
            ? isWarmPyro
              ? '#f97316'
              : '#f0f9ff'
            : isWarmPyro
              ? '#f59e0b'
              : '#7dd3fc';

    if (strobeLightRef.current) {
      strobeLightRef.current.intensity = flashLevel * 28;
      strobeLightRef.current.color.set(flashColor);
    }
    if (strobeBarMatRef.current) {
      strobeBarMatRef.current.opacity = flashLevel * 0.85;
      strobeBarMatRef.current.color.set(flashColor);
    }
    if (fourDxFlashRef) {
      fourDxFlashRef.current.level = flashLevel;
      fourDxFlashRef.current.color = flashColor;
    }
  });

  if (!config.supports4dxEffects) return null;

  return (
    <group>
      {/* Wind / Mist Particle Streams */}
      <points ref={windPointsRef} geometry={windGeo} material={windMat} />

      {/* Overhead Rain-Mist Nozzles */}
      {hasBespoke4dxMist && (
        <points ref={rainPointsRef} geometry={rainGeo} material={rainMat} />
      )}

      {/* Overhead Swirling Snow Dispersal Particles (4DX Exo-Skeleton 550) */}
      {isExoskeleton4dx && (
        <points ref={snowPointsRef} geometry={snowGeo} material={snowMat} />
      )}

      {/* Animated Storm-Wind Turbine Rotor Assemblies Mounted Inside Front Environmental Truss Cowlings */}
      {isExoskeleton4dx &&
        turbinePositions.map((tp, idx) => (
          <group key={`exo-turbine-rotor-${idx}`} position={[tp.x, tp.y, tp.z]}>
            <group
              ref={(el) => {
                turbineRefs.current[idx] = el;
              }}
            >
              {/* Crimson Spinner Hub */}
              <mesh rotation={[Math.PI / 2, 0, 0]} material={hubMat}>
                <cylinderGeometry args={[tp.radius * 0.22, tp.radius * 0.28, 0.16, 16]} />
              </mesh>
              {/* 6 Pitched Axial Turbine Blades */}
              {Array.from({ length: 6 }, (_, bi) => {
                const ang = (bi * Math.PI) / 3;
                return (
                  <group key={`blade-${bi}`} rotation={[0, 0, ang]}>
                    <mesh
                      position={[0, tp.radius * 0.56, 0]}
                      rotation={[0, 0.38, 0]}
                      material={bladeMat}
                    >
                      <boxGeometry args={[tp.radius * 0.26, tp.radius * 0.66, 0.025]} />
                    </mesh>
                  </group>
                );
              })}
            </group>
          </group>
        ))}

      {/* Low Front Fog-Machine Stage Riser / Truss Atmospheric Mist Layer */}
      <mesh
        ref={fogMeshRef}
        position={[
          0,
          hasBespoke4dxMist ? 0.42 : 0.95,
          hasBespoke4dxMist ? screenZ + 1.55 : firstRowZ - 1.8,
        ]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[W - 2, 4.5]} />
        <meshBasicMaterial
          color="#cbd5e1"
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>

      {/* Overhead 4DX Action Strobe Flash */}
      <pointLight
        ref={strobeLightRef}
        position={[0, H - 1.4, firstRowZ + 2.5]}
        color="#7dd3fc"
        intensity={0}
        distance={L * 0.9}
        decay={1.8}
      />

      {/* Overhead Front Strobe Rig Emitter */}
      <mesh position={[0, H - 0.6, firstRowZ + 1.4]}>
        <boxGeometry args={[W - 4, 0.08, 0.14]} />
        <meshBasicMaterial ref={strobeBarMatRef} color="#7dd3fc" transparent opacity={0} />
      </mesh>
    </group>
  );
};
