import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { TheaterConfiguration } from '../../types/cinema';
import { FourDxLiveTelemetry } from './fourDxTelemetry';

interface FourDxEffectsRigProps {
  config: TheaterConfiguration;
  enabled: boolean;
  isPlaying: boolean;
  intensity: number; // 0..1
  atmosphericLightEnabled: boolean;
  fourDxFlashRef?: React.MutableRefObject<{ level: number; color: string }>;
  fourDxTelemetryRef?: React.MutableRefObject<FourDxLiveTelemetry>;
}

const _fogMistColor = new THREE.Color('#cbd5e1');
const _fogFireColor = new THREE.Color('#ff7a33');
const _fogRainColor = new THREE.Color('#94a3b8');
const _tempFogColor = new THREE.Color();

export const FourDxEffectsRig: React.FC<FourDxEffectsRigProps> = ({
  config,
  enabled,
  isPlaying,
  intensity,
  atmosphericLightEnabled,
  fourDxFlashRef,
  fourDxTelemetryRef,
}) => {
  const windPointsRef = useRef<THREE.Points>(null);
  const rainPointsRef = useRef<THREE.Points>(null);
  const snowPointsRef = useRef<THREE.Points>(null);
  const emberPointsRef = useRef<THREE.Points>(null);
  const flameGroupRefs = useRef<(THREE.Group | null)[]>([]);
  const fogMeshRef = useRef<THREE.Mesh>(null);
  const strobeLightRef = useRef<THREE.PointLight>(null);
  const strobeBarMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const fireLightLeftRef = useRef<THREE.PointLight>(null);
  const fireLightRightRef = useRef<THREE.PointLight>(null);
  const turbineRefs = useRef<(THREE.Group | null)[]>([]);

  const particleCount = 210;
  const rainCount = 220;
  const snowCount = 220;
  const emberCount = 190;
  const isExoskeleton4dx = config.sideLightStyle === 'exoskeleton_crimson_matrix_4dx';
  const hasBespoke4dxMist =
    config.sideLightStyle === 'crimson_velocity_4dx' ||
    config.sideLightStyle === 'arctic_parametric_fins' ||
    config.sideLightStyle === 'thunder_emerald_waves' ||
    isExoskeleton4dx;

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

  // Front stage pyrotechnic flame nozzle slots
  const flameJetXPositions = useMemo(
    () => [-W * 0.28, -W * 0.1, W * 0.1, W * 0.28],
    [W],
  );

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
      positions[i * 3] = (Math.random() - 0.5) * (W - 2.6);
      positions[i * 3 + 1] = 1.1 + Math.random() * (H - 1.9);
      positions[i * 3 + 2] = firstRowZ - 0.8 + Math.random() * (L * 0.68);
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

  const emberGeo = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(emberCount * 3);
    for (let i = 0; i < emberCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * (W - 3.2);
      positions[i * 3 + 1] = 0.25 + Math.random() * (H * 0.65);
      positions[i * 3 + 2] = screenZ + 0.8 + Math.random() * (L * 0.58);
    }
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geom;
  }, [W, L, H, screenZ]);

  const flameGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(1.55, 2.6, 1, 1);
    g.translate(0, 1.3, 0);
    return g;
  }, []);

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
    return new THREE.CanvasTexture(c);
  }, []);

  const rainStreakSprite = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 16;
    c.height = 64;
    const ctx = c.getContext('2d')!;
    const grad = ctx.createLinearGradient(8, 0, 8, 64);
    grad.addColorStop(0, 'rgba(224,242,254,0)');
    grad.addColorStop(0.35, 'rgba(224,242,254,0.75)');
    grad.addColorStop(0.75, 'rgba(255,255,255,0.95)');
    grad.addColorStop(1, 'rgba(224,242,254,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(6, 2, 4, 60);
    return new THREE.CanvasTexture(c);
  }, []);

  const emberSprite = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext('2d')!;
    const grad = ctx.createRadialGradient(32, 32, 1, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255,248,210,1)');
    grad.addColorStop(0.28, 'rgba(255,140,36,0.92)');
    grad.addColorStop(0.62, 'rgba(239,68,68,0.42)');
    grad.addColorStop(1, 'rgba(239,68,68,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
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
        color: '#bae6fd',
        map: rainStreakSprite,
        size: 0.24,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    [rainStreakSprite],
  );

  const snowMat = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: '#f1f5f9',
        map: mistSprite,
        size: 0.13,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    [mistSprite],
  );

  const emberMat = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: '#ff9234',
        map: emberSprite,
        size: 0.2,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [emberSprite],
  );

  const flameMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uIntensity: { value: 0 },
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec2 vUv;
          uniform float uTime;
          uniform float uIntensity;

          float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
          }
          float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(
              mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
              mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
              u.y
            );
          }

          void main() {
            float xCenter = abs(vUv.x - 0.5) * 2.0;
            float taper = mix(0.9, 0.12, pow(vUv.y, 0.72));
            float sway = (noise(vec2(vUv.y * 3.8 - uTime * 4.2, uTime * 0.7)) - 0.5) * 0.34 * vUv.y;
            float dist = abs((vUv.x - 0.5) * 2.0 - sway) / max(0.08, taper);
            float n = noise(vec2(vUv.x * 5.2, vUv.y * 4.5 - uTime * 6.5));
            float tongue = smoothstep(1.0, 0.15, dist + (n - 0.5) * 0.45);
            float vFade = smoothstep(0.0, 0.16, vUv.y) * smoothstep(1.0, 0.25, vUv.y);
            float shape = tongue * vFade;

            vec3 coreCol = vec3(1.0, 0.88, 0.42);
            vec3 midCol = vec3(1.0, 0.38, 0.06);
            vec3 outerCol = vec3(0.75, 0.11, 0.02);
            vec3 col = mix(outerCol, midCol, smoothstep(0.15, 0.6, shape));
            col = mix(col, coreCol, smoothstep(0.62, 0.95, shape) * (1.0 - vUv.y * 0.6));

            float alpha = clamp(shape * uIntensity * 0.72, 0.0, 0.78);
            if (alpha < 0.008) discard;
            gl_FragColor = vec4(col, alpha);
          }
        `,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    [],
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
      emberGeo.dispose();
      flameGeo.dispose();
      windMat.dispose();
      rainMat.dispose();
      snowMat.dispose();
      emberMat.dispose();
      flameMat.dispose();
      mistSprite.dispose();
      rainStreakSprite.dispose();
      emberSprite.dispose();
      bladeMat.dispose();
      hubMat.dispose();
    };
  }, [
    windGeo,
    rainGeo,
    snowGeo,
    emberGeo,
    flameGeo,
    windMat,
    rainMat,
    snowMat,
    emberMat,
    flameMat,
    mistSprite,
    rainStreakSprite,
    emberSprite,
    bladeMat,
    hubMat,
  ]);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    const active = Boolean(config.supports4dxEffects) && enabled && isPlaying && intensity > 0.02;

    if (!active) {
      windMat.opacity = THREE.MathUtils.damp(windMat.opacity, 0, 8, dt);
      rainMat.opacity = THREE.MathUtils.damp(rainMat.opacity, 0, 8, dt);
      snowMat.opacity = THREE.MathUtils.damp(snowMat.opacity, 0, 8, dt);
      emberMat.opacity = THREE.MathUtils.damp(emberMat.opacity, 0, 8, dt);
      flameMat.uniforms.uIntensity.value = THREE.MathUtils.damp(
        flameMat.uniforms.uIntensity.value,
        0,
        8,
        dt,
      );
      for (let i = 0; i < flameGroupRefs.current.length; i++) {
        const fg = flameGroupRefs.current[i];
        if (fg) fg.visible = flameMat.uniforms.uIntensity.value > 0.02;
      }
      if (fogMeshRef.current) {
        const mat = fogMeshRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = THREE.MathUtils.damp(mat.opacity, 0, 8, dt);
      }
      if (fireLightLeftRef.current) {
        fireLightLeftRef.current.intensity = THREE.MathUtils.damp(
          fireLightLeftRef.current.intensity,
          0,
          10,
          dt,
        );
      }
      if (fireLightRightRef.current) {
        fireLightRightRef.current.intensity = THREE.MathUtils.damp(
          fireLightRightRef.current.intensity,
          0,
          10,
          dt,
        );
      }
      if (strobeLightRef.current) {
        strobeLightRef.current.intensity = THREE.MathUtils.damp(
          strobeLightRef.current.intensity,
          0,
          10,
          dt,
        );
      }
      if (strobeBarMatRef.current) {
        strobeBarMatRef.current.opacity = THREE.MathUtils.damp(
          strobeBarMatRef.current.opacity,
          0,
          10,
          dt,
        );
      }
      if (fourDxFlashRef) {
        fourDxFlashRef.current.level = 0;
      }
      return;
    }

    const t = clock.getElapsedTime();
    const tel = fourDxTelemetryRef?.current;
    const fireLevel = tel ? tel.fireLevel : 0;
    const fireCenterX = tel ? tel.fireCenterX : 0;
    const rainLevel = tel ? tel.rainLevel : 0;
    const snowLevel = tel ? tel.snowLevel : 0;
    const windLevel = tel ? tel.windLevel : 0;
    const sceneMotion = tel ? tel.sceneMotion : 0;
    const bass = tel ? tel.bass : 0;
    const subBass = tel ? tel.subBass : 0;
    const lightningFlash = tel ? tel.lightningFlash : 0;

    // 1. Live Video-Driven Wind & Exo-Skeleton Storm Turbines (idle when calm)
    const windDrive = THREE.MathUtils.clamp(
      windLevel * 0.65 + sceneMotion * 0.35 + bass * 0.32,
      0,
      1,
    );
    if (isExoskeleton4dx && windDrive > 0.04) {
      const omega = (2.5 + windDrive * 21.0) * intensity * dt;
      for (let i = 0; i < turbinePositions.length; i++) {
        const rotor = turbineRefs.current[i];
        if (rotor) {
          rotor.rotation.z += i % 2 === 0 ? omega : -omega;
        }
      }
    }

    const targetWindOpacity = windDrive > 0.06 ? windDrive * 0.42 * intensity : 0;
    windMat.opacity = THREE.MathUtils.damp(windMat.opacity, targetWindOpacity, 7, dt);
    if (windMat.opacity > 0.008) {
      const windSpeed = (3.5 + windDrive * 18.0) * intensity;
      const posAttr = windGeo.getAttribute('position') as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        arr[i * 3 + 2] += windSpeed * dt;
        arr[i * 3 + 1] += Math.sin(t * 2.6 + i) * 0.12 * dt;
        if (arr[i * 3 + 2] > L * 0.45) {
          arr[i * 3] = (Math.random() - 0.5) * (W - 2.5);
          arr[i * 3 + 1] = 1.0 + Math.random() * (H - 2.4);
          arr[i * 3 + 2] = screenZ + 0.8;
        }
      }
      posAttr.needsUpdate = true;
    }

    // 2. Live Video-Driven Light Rain across ALL 4DX theaters (only when rain is in video)
    const targetRainOpacity =
      rainLevel > 0.04 ? THREE.MathUtils.clamp(rainLevel * 0.27 * intensity, 0, 0.28) : 0;
    rainMat.opacity = THREE.MathUtils.damp(rainMat.opacity, targetRainOpacity, 6, dt);
    if (rainMat.opacity > 0.005) {
      const rainAttr = rainGeo.getAttribute('position') as THREE.BufferAttribute;
      const rArr = rainAttr.array as Float32Array;
      const fallSpeed = (4.6 + rainLevel * 3.8) * (0.65 + 0.35 * intensity);
      const activeDropCount = Math.max(
        40,
        Math.round(rainCount * THREE.MathUtils.clamp(0.28 + rainLevel * 0.72, 0, 1)),
      );
      for (let i = 0; i < activeDropCount; i++) {
        rArr[i * 3 + 1] -= fallSpeed * dt;
        if (rArr[i * 3 + 1] < 0.7) {
          rArr[i * 3] = (Math.random() - 0.5) * (W - 2.6);
          rArr[i * 3 + 1] = H - 0.65;
          rArr[i * 3 + 2] = firstRowZ - 0.8 + Math.random() * (L * 0.68);
        }
      }
      rainAttr.needsUpdate = true;
    }

    // 3. Live Video-Driven Fire Effects (Rising Embers + Front Stage Flame Plumes + Warm Fire Lights)
    const activeFire = THREE.MathUtils.clamp(fireLevel * intensity, 0, 1);
    const targetEmberOpacity = fireLevel > 0.04 ? Math.min(0.92, activeFire * 1.15) : 0;
    emberMat.opacity = THREE.MathUtils.damp(emberMat.opacity, targetEmberOpacity, 8, dt);

    if (emberMat.opacity > 0.008) {
      const emberAttr = emberGeo.getAttribute('position') as THREE.BufferAttribute;
      const eArr = emberAttr.array as Float32Array;
      const riseSpeed = 2.0 + activeFire * 4.4 + subBass * 1.6;
      const spawnCenterX = fireCenterX * W * 0.32;
      for (let i = 0; i < emberCount; i++) {
        eArr[i * 3] += Math.sin(t * 2.8 + i * 0.41) * 0.55 * dt;
        eArr[i * 3 + 1] += riseSpeed * (0.75 + (i % 5) * 0.1) * dt;
        eArr[i * 3 + 2] += (0.5 + activeFire * 1.2) * dt;
        if (eArr[i * 3 + 1] > H - 0.8) {
          const wideSpread = (Math.random() - 0.5) * (W * 0.72);
          eArr[i * 3] = THREE.MathUtils.clamp(
            spawnCenterX * 0.55 + wideSpread,
            -W * 0.46,
            W * 0.46,
          );
          eArr[i * 3 + 1] = 0.2 + Math.random() * 0.45;
          eArr[i * 3 + 2] = screenZ + 0.85 + Math.random() * (L * 0.42);
        }
      }
      emberAttr.needsUpdate = true;
    }

    flameMat.uniforms.uTime.value = t;
    const targetFlameStrength = fireLevel > 0.06 ? Math.min(1.0, activeFire * (0.85 + subBass * 0.45)) : 0;
    flameMat.uniforms.uIntensity.value = THREE.MathUtils.damp(
      flameMat.uniforms.uIntensity.value,
      targetFlameStrength,
      8,
      dt,
    );
    const flameIntensity = flameMat.uniforms.uIntensity.value;
    for (let i = 0; i < flameJetXPositions.length; i++) {
      const fg = flameGroupRefs.current[i];
      if (!fg) continue;
      if (flameIntensity <= 0.02) {
        fg.visible = false;
      } else {
        fg.visible = true;
        const nozzleNormX = flameJetXPositions[i] / (W * 0.32);
        const sideMatch = Math.max(0.45, 1.0 - Math.abs(nozzleNormX - fireCenterX) * 0.45);
        const heightScale = (0.45 + flameIntensity * 0.85) * sideMatch;
        fg.scale.set(0.75 + flameIntensity * 0.45, heightScale, 0.75 + flameIntensity * 0.45);
      }
    }

    const fireGlowEnergy = activeFire * (1.0 + subBass * 0.65);
    const flicker = 0.88 + Math.sin(t * 24) * 0.07 + Math.cos(t * 37) * 0.05;
    if (fireLightLeftRef.current) {
      const leftBias = THREE.MathUtils.clamp(1.0 - fireCenterX * 0.45, 0.5, 1.35);
      fireLightLeftRef.current.intensity = THREE.MathUtils.damp(
        fireLightLeftRef.current.intensity,
        fireLevel > 0.04 ? fireGlowEnergy * 18 * leftBias * flicker : 0,
        10,
        dt,
      );
    }
    if (fireLightRightRef.current) {
      const rightBias = THREE.MathUtils.clamp(1.0 + fireCenterX * 0.45, 0.5, 1.35);
      fireLightRightRef.current.intensity = THREE.MathUtils.damp(
        fireLightRightRef.current.intensity,
        fireLevel > 0.04 ? fireGlowEnergy * 18 * rightBias * flicker : 0,
        10,
        dt,
      );
    }

    // 4. Live Video-Driven Swirling Snow (only on snow/blizzard scenes in video)
    const targetSnowOpacity = snowLevel > 0.04 ? Math.min(0.4, snowLevel * 0.4 * intensity) : 0;
    snowMat.opacity = THREE.MathUtils.damp(snowMat.opacity, targetSnowOpacity, 6, dt);
    if (snowMat.opacity > 0.006) {
      const snowAttr = snowGeo.getAttribute('position') as THREE.BufferAttribute;
      const sArr = snowAttr.array as Float32Array;
      const snowFall = (1.5 + snowLevel * 1.8) * intensity;
      for (let i = 0; i < snowCount; i++) {
        sArr[i * 3] += Math.sin(t * 1.4 + i * 0.37) * 0.6 * dt;
        sArr[i * 3 + 1] -= snowFall * dt;
        sArr[i * 3 + 2] += Math.cos(t * 1.1 + i * 0.29) * 0.3 * dt;
        if (sArr[i * 3 + 1] < 1.1) {
          sArr[i * 3] = (Math.random() - 0.5) * (W - 3.2);
          sArr[i * 3 + 1] = H - 0.85;
          sArr[i * 3 + 2] = firstRowZ - 0.5 + Math.random() * (L * 0.68);
        }
      }
      snowAttr.needsUpdate = true;
    }

    // 5. Stage Fog Plume Synced to Fire / Rain / Wind
    if (fogMeshRef.current) {
      const mat = fogMeshRef.current.material as THREE.MeshBasicMaterial;
      const targetFogOpacity = THREE.MathUtils.clamp(
        (fireLevel * 0.13 + rainLevel * 0.12 + windDrive * 0.09) * intensity,
        0,
        0.24,
      );
      mat.opacity = THREE.MathUtils.damp(mat.opacity, targetFogOpacity, 6, dt);
      _tempFogColor.copy(_fogMistColor);
      if (fireLevel > rainLevel) {
        _tempFogColor.lerp(_fogFireColor, Math.min(1, fireLevel * 1.15));
      } else if (rainLevel > 0.05) {
        _tempFogColor.lerp(_fogRainColor, Math.min(1, rainLevel));
      }
      mat.color.copy(_tempFogColor);
      fogMeshRef.current.position.x = fireCenterX * 1.25;
    }

    // 6. Live Video-Synced Strobe Lightning + Pyrotechnic Wall Glow
    const rawFlash = Math.max(lightningFlash, fireLevel * 0.34 * (0.7 + subBass * 0.5));
    const flashLevel = atmosphericLightEnabled ? THREE.MathUtils.clamp(rawFlash * intensity, 0, 1) : 0;
    const flashColor = fireLevel > 0.22 && lightningFlash < 0.35 ? '#ff6b2b' : tel?.flashColor || '#e0f2fe';

    if (strobeLightRef.current) {
      strobeLightRef.current.intensity = flashLevel * 24;
      strobeLightRef.current.color.set(flashColor);
    }
    if (strobeBarMatRef.current) {
      strobeBarMatRef.current.opacity = flashLevel * 0.8;
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
      {/* Video/Wind Driven Mist Particle Streams */}
      <points ref={windPointsRef} geometry={windGeo} material={windMat} />

      {/* Video-Synced Light Rain Nozzles Across All 4DX Halls */}
      <points ref={rainPointsRef} geometry={rainGeo} material={rainMat} />

      {/* Video-Synced Fire Embers & Stage Flame Jets Across All 4DX Halls */}
      <points ref={emberPointsRef} geometry={emberGeo} material={emberMat} />
      {flameJetXPositions.map((fx, idx) => (
        <group
          key={`stage-flame-jet-${idx}`}
          ref={(el) => {
            flameGroupRefs.current[idx] = el;
          }}
          position={[fx, 0.25, screenZ + 1.12]}
          visible={false}
        >
          <mesh geometry={flameGeo} material={flameMat} renderOrder={7} />
          <mesh
            geometry={flameGeo}
            material={flameMat}
            rotation={[0, Math.PI * 0.5, 0]}
            renderOrder={7}
          />
        </group>
      ))}
      <pointLight
        ref={fireLightLeftRef}
        position={[-W * 0.24, 1.45, screenZ + 2.2]}
        color="#ff5a14"
        intensity={0}
        distance={L * 0.65}
        decay={1.8}
      />
      <pointLight
        ref={fireLightRightRef}
        position={[W * 0.24, 1.45, screenZ + 2.2]}
        color="#ff5a14"
        intensity={0}
        distance={L * 0.65}
        decay={1.8}
      />

      {/* Video-Synced Swirling Snow Particles */}
      <points ref={snowPointsRef} geometry={snowGeo} material={snowMat} />

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
