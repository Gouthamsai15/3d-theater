import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { ShowState, TheaterConfiguration } from '../../types/cinema';
import { getIceTheaterLayout } from './iceLayoutUtils';

interface IceSidePanelsProps {
  config: TheaterConfiguration;
  screenLightTex: THREE.Texture;
  showState: ShowState;
  isPaused: boolean;
  isVideoRef: React.MutableRefObject<boolean>;
  lightFactor: number;
  screenReflectionBrightness?: number;
}

export const IceSidePanels: React.FC<IceSidePanelsProps> = ({
  config,
  screenLightTex,
  showState,
  isPaused,
  isVideoRef,
  lightFactor,
  screenReflectionBrightness = 1,
}) => {
  const layout = useMemo(() => getIceTheaterLayout(config), [config]);
  const { panelWidth, panelHeight, panels } = layout;

  const panelMaterialsRef = useRef<THREE.ShaderMaterial[]>([]);
  const projMixRef = useRef(0);

  const geometries = useMemo(() => {
    const faceGeo = new THREE.PlaneGeometry(panelWidth, panelHeight, 1, 1);
    const recessBackingGeo = new THREE.BoxGeometry(panelWidth + 0.06, panelHeight + 0.06, 0.036);
    const shadowGapGeo = new THREE.BoxGeometry(panelWidth + 0.12, panelHeight + 0.12, 0.022);
    return { faceGeo, recessBackingGeo, shadowGapGeo };
  }, [panelWidth, panelHeight]);

  const frameMaterials = useMemo(() => {
    const isCobalt = config.sideLightStyle === 'ice_faceted_cobalt';
    const isAmber = config.sideLightStyle === 'ice_faceted_amber';
    // Ultra-matte flush recessed shadow-gap backing (zero glossy frame glare)
    const darkBezelMat = new THREE.MeshStandardMaterial({
      color: isCobalt ? '#1b1410' : isAmber ? '#0b0d10' : '#07080b',
      roughness: 0.94,
      metalness: 0.04,
    });
    const shadowGapMat = new THREE.MeshStandardMaterial({
      color: isCobalt ? '#281f18' : isAmber ? '#121518' : '#0b0d12',
      roughness: 0.92,
      metalness: 0.08,
    });
    return { darkBezelMat, shadowGapMat };
  }, [config.sideLightStyle]);

  const panelMaterials = useMemo(() => {
    const isCobalt = config.sideLightStyle === 'ice_faceted_cobalt';
    const isAmber = config.sideLightStyle === 'ice_faceted_amber';

    // 3-stop atmospheric palettes matching each ICE hall verbatim
    const colA = new THREE.Color(isCobalt ? '#f59e0b' : isAmber ? '#10b981' : '#06b6d4');
    const colB = new THREE.Color(isCobalt ? '#eab308' : isAmber ? '#0f766e' : '#38bdf8');
    const colC = new THREE.Color(isCobalt ? '#fb7185' : isAmber ? '#5eead4' : '#8b5cf6');

    const panelMats = panels.map((p) => {
      return new THREE.ShaderMaterial({
        uniforms: {
          uScreenLightTex: { value: screenLightTex },
          uTime: { value: 0 },
          uProjMix: { value: 0 },
          uLightFactor: { value: 1 },
          uSide: { value: p.side },
          uPanelT: { value: p.t },
          uPanelRow: { value: p.row },
          uBrightness: { value: 1.0 },
          uPreShowColA: { value: colA.clone() },
          uPreShowColB: { value: colB.clone() },
          uPreShowColC: { value: colC.clone() },
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
          uniform sampler2D uScreenLightTex;
          uniform float uTime;
          uniform float uProjMix;
          uniform float uLightFactor;
          uniform float uSide;
          uniform float uPanelT;
          uniform float uPanelRow;
          uniform float uBrightness;
          uniform vec3 uPreShowColA;
          uniform vec3 uPreShowColB;
          uniform vec3 uPreShowColC;

          vec3 decodeLinearLight(vec2 uvCoord) {
            vec3 enc = texture2D(uScreenLightTex, clamp(uvCoord, 0.02, 0.98)).rgb;
            return pow(max(enc, vec3(1e-4)), vec3(2.2));
          }

          void main() {
            // 1. Frameless satin-diffused pre-show atmospheric wave/gradient (zero distracting glare)
            float phase = uTime * 0.36 - uPanelT * 2.35 + uPanelRow * 0.85;
            float wave1 = 0.5 + 0.5 * sin(vUv.y * 2.8 + vUv.x * 1.4 + phase);
            float wave2 = 0.5 + 0.5 * cos(vUv.x * 2.6 - vUv.y * 1.9 - phase * 0.72);
            vec3 gradAB = mix(uPreShowColA, uPreShowColB, smoothstep(0.15, 0.85, wave1));
            vec3 preShowBase = mix(gradAB, uPreShowColC, smoothstep(0.32, 0.92, wave2) * 0.52);

            // Soft satin-diffused peripheral vignette
            float softEdges =
              smoothstep(0.0, 0.14, vUv.x) *
              smoothstep(1.0, 0.86, vUv.x) *
              smoothstep(0.0, 0.12, vUv.y) *
              smoothstep(1.0, 0.88, vUv.y);
            float vertWash = 0.66 + 0.34 * smoothstep(0.0, 0.58, 1.0 - abs(vUv.y - 0.5) * 1.32);
            vec3 preShowCol = preShowBase * vertWash * (0.48 + 0.52 * softEdges) * (0.14 + 0.28 * uLightFactor);

            // 2. Movie Playback: Non-reflective peripheral atmospheric color extension matched to screen edges
            float edgeZone = uSide < 0.0
              ? mix(0.08, 0.24, uPanelT * 0.65 + vUv.x * 0.22)
              : mix(0.92, 0.76, uPanelT * 0.65 + (1.0 - vUv.x) * 0.22);

            float driftY = sin(uTime * 0.52 + uPanelT * 2.1 + vUv.x * 1.4) * 0.07;
            float baseV = clamp(mix(0.18, 0.84, vUv.y) + driftY, 0.05, 0.95);

            vec3 blurCol = vec3(0.0);
            blurCol += decodeLinearLight(vec2(edgeZone, baseV)) * 0.28;
            blurCol += decodeLinearLight(vec2(edgeZone - 0.07, baseV + 0.14)) * 0.14;
            blurCol += decodeLinearLight(vec2(edgeZone + 0.07, baseV + 0.14)) * 0.14;
            blurCol += decodeLinearLight(vec2(edgeZone - 0.07, baseV - 0.14)) * 0.14;
            blurCol += decodeLinearLight(vec2(edgeZone + 0.07, baseV - 0.14)) * 0.14;
            blurCol += decodeLinearLight(vec2(edgeZone, baseV + 0.26)) * 0.08;
            blurCol += decodeLinearLight(vec2(edgeZone, baseV - 0.26)) * 0.08;

            float rearTapering = mix(0.86, 0.42, pow(uPanelT, 0.95));
            float satinDiffusion = 0.985 + 0.015 * sin(vUv.y * 160.0);

            vec3 activeCol = blurCol * rearTapering * (0.36 + 0.64 * softEdges) * uBrightness * 1.32 * satinDiffusion;
            vec3 finalCol = mix(preShowCol * satinDiffusion, activeCol, uProjMix);

            gl_FragColor = vec4(finalCol, 1.0);
            #include <colorspace_fragment>
          }
        `,
        toneMapped: false,
      });
    });

    panelMaterialsRef.current = panelMats;

    return { panelMats };
  }, [panels, screenLightTex, config.sideLightStyle]);

  useEffect(() => {
    return () => {
      Object.values(geometries).forEach((g) => g.dispose());
      Object.values(frameMaterials).forEach((m) => m.dispose());
      panelMaterials.panelMats.forEach((m) => m.dispose());
      panelMaterialsRef.current = [];
    };
  }, [geometries, frameMaterials, panelMaterials]);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.25);
    const t = clock.getElapsedTime();
    const targetMix =
      showState === 'SHOW_PLAYING' && isVideoRef.current ? (isPaused ? 0.48 : 1.0) : 0.0;
    projMixRef.current = THREE.MathUtils.damp(projMixRef.current, targetMix, 3.0, dt);

    const activeBrightness = Math.max(0.55, Math.min(1.45, screenReflectionBrightness));
    const pMats = panelMaterialsRef.current;
    for (let i = 0; i < pMats.length; i++) {
      const m = pMats[i];
      m.uniforms.uScreenLightTex.value = screenLightTex;
      m.uniforms.uTime.value = t;
      m.uniforms.uProjMix.value = projMixRef.current;
      m.uniforms.uLightFactor.value = lightFactor;
      m.uniforms.uBrightness.value = activeBrightness;
    }
  });

  return (
    <group>
      {panels.map((p, idx) => (
        <group
          key={`ice-panel-${p.side}-${p.index}-${p.row}`}
          position={[p.x, p.y, p.z]}
          rotation={[0, p.rotY, 0]}
        >
          {/* Flush Shadow-Gap Wall Recess */}
          <mesh
            position={[0, 0, -0.032]}
            geometry={geometries.shadowGapGeo}
            material={frameMaterials.shadowGapMat}
          />
          {/* Ultra-Matte Frameless Acoustic Shadow Backing */}
          <mesh
            position={[0, 0, -0.015]}
            geometry={geometries.recessBackingGeo}
            material={frameMaterials.darkBezelMat}
          />
          {/* Frameless Satin-Diffused Non-Reflective LED Ambient Panel */}
          <mesh
            position={[0, 0, 0.008]}
            geometry={geometries.faceGeo}
            material={panelMaterials.panelMats[idx]}
          />
        </group>
      ))}
    </group>
  );
};
