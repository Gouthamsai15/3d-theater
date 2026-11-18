import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { TheaterConfiguration } from '../../types/cinema';
import {
  applyScreenBounceToMaterial,
  ScreenBounceUniforms,
} from '../lighting/screenBounceShader';
import { getBiophilicSpeakerPositions, getDolbyVeilWaveHeights } from './SideWallLighting';

interface CinemaSpeakersProps {
  config: TheaterConfiguration;
  wallBayZs: number[];
  topTierY: number;
  lightFactor: number;
  speakerGrilleMap: THREE.Texture;
  screenBounceUniforms?: ScreenBounceUniforms;
}

/**
 * Builds a trapezoidal, chamfered cinema surround cabinet oriented along local +Z
 * (narrower rear mounting face, wider flared front acoustic baffle).
 */
function buildTrapezoidCabinetGeometry(
  frontWidth: number,
  rearWidth: number,
  height: number,
  depth: number,
  bevel = 0.018,
): THREE.BufferGeometry {
  const halfFront = frontWidth / 2;
  const halfRear = rearWidth / 2;
  const halfD = depth / 2;

  const shape = new THREE.Shape();
  shape.moveTo(-halfRear, -halfD);
  shape.lineTo(halfRear, -halfD);
  shape.lineTo(halfFront, halfD);
  shape.lineTo(-halfFront, halfD);
  shape.closePath();

  const extrudeH = Math.max(0.08, height - bevel * 2);
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: extrudeH,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    steps: 1,
  });

  // Extrude runs along +Z; rotate -90 deg on X so shape X stays X, shape Y (depth) becomes +Z, and extrusion becomes +Y
  geom.rotateX(-Math.PI / 2);
  geom.center();
  geom.computeVertexNormals();
  return geom;
}

/**
 * Builds a sculpted curved woofer cone via LatheGeometry (concave parabolic diaphragm).
 */
function buildWooferConeGeometry(
  outerRadius: number,
  innerRadius: number,
  coneDepth: number,
  segments = 28,
): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(innerRadius * 0.9, 0),
    new THREE.Vector2(innerRadius + (outerRadius - innerRadius) * 0.35, coneDepth * 0.32),
    new THREE.Vector2(innerRadius + (outerRadius - innerRadius) * 0.72, coneDepth * 0.72),
    new THREE.Vector2(outerRadius, coneDepth),
  ];
  const geom = new THREE.LatheGeometry(pts, segments);
  geom.rotateX(Math.PI / 2); // cone opens toward +Z
  geom.computeVertexNormals();
  return geom;
}

/**
 * Builds a flared constant-directivity high-frequency compression horn mouth via ExtrudeGeometry.
 */
function buildHornWaveguideGeometry(
  mouthW: number,
  mouthH: number,
  throatDepth: number,
): THREE.BufferGeometry {
  const hw = mouthW / 2;
  const hh = mouthH / 2;
  const r = Math.min(hw, hh) * 0.32;

  const outer = new THREE.Shape();
  outer.moveTo(-hw + r, -hh);
  outer.lineTo(hw - r, -hh);
  outer.quadraticCurveTo(hw, -hh, hw, -hh + r);
  outer.lineTo(hw, hh - r);
  outer.quadraticCurveTo(hw, hh, hw - r, hh);
  outer.lineTo(-hw + r, hh);
  outer.quadraticCurveTo(-hw, hh, -hw, hh - r);
  outer.lineTo(-hw, -hh + r);
  outer.quadraticCurveTo(-hw, -hh, -hw + r, -hh);

  const iw = hw * 0.44;
  const ih = hh * 0.38;
  const hole = new THREE.Path();
  hole.moveTo(-iw, -ih);
  hole.lineTo(iw, -ih);
  hole.lineTo(iw, ih);
  hole.lineTo(-iw, ih);
  hole.closePath();
  outer.holes.push(hole);

  const geom = new THREE.ExtrudeGeometry(outer, {
    depth: throatDepth,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.01,
    bevelSegments: 2,
  });
  geom.center();
  geom.computeVertexNormals();
  return geom;
}

export const CinemaSpeakers: React.FC<CinemaSpeakersProps> = ({
  config,
  wallBayZs,
  topTierY,
  lightFactor,
  speakerGrilleMap,
  screenBounceUniforms,
}) => {
  const {
    auditoriumWidth: W,
    auditoriumLength: L,
    auditoriumHeight: H,
    screenPosition,
    screenWidth,
    lightingProfile,
    environmentProfile,
  } = config;

  const frontZ = -L / 2;
  const backZ = L / 2;
  const isIce = environmentProfile.architectureStyle === 'ice';
  const isScreenX =
    Boolean(config.supportsScreenX) ||
    environmentProfile.architectureStyle === 'screenx';
  const isArtDecoSunburst = config.sideLightStyle === 'art_deco_navy_sunburst';
  const isModernMultiplex = config.sideLightStyle === 'modern_charcoal_navy_diagonal';
  const isVolcanicCopper2d = config.sideLightStyle === 'volcanic_copper_ribbons';
  const isMandap2d = config.sideLightStyle === 'indian_mandap_jali';
  const isParametricObsidian = config.sideLightStyle === 'parametric_obsidian_waves';
  const isBiophilicMoss = config.sideLightStyle === 'biophilic_crystalline_moss';
  const isPrivateVolcanic = config.sideLightStyle === 'private_volcanic_copper_ribbons';
  const isPrivateChampagne = config.sideLightStyle === 'champagne_fluted_oak_alcoves';
  const isCobaltHorizonImax = config.sideLightStyle === 'imax_cobalt_wave';
  const isImaxLaser =
    config.sideLightStyle === 'imax_cobalt_wave' ||
    config.sideLightStyle === 'aurora_ribbon_waves' ||
    config.sideLightStyle === 'horizon_tier_strips';
  const isAuroraMinimal = config.sideLightStyle === 'aurora_ribbon_waves';
  const isAmberHorizontal = config.sideLightStyle === 'horizon_tier_strips';
  const isCrimson4dx = config.sideLightStyle === 'crimson_velocity_4dx';
  const isArctic4dx = config.sideLightStyle === 'arctic_parametric_fins';
  const isThunder4dx = config.sideLightStyle === 'thunder_emerald_waves';
  const isDolbyMediumLuxury =
    config.sideLightStyle === 'obsidian_slat_grazers' ||
    config.sideLightStyle === 'diagonal_parabolic_ribs';
  const isCobaltVeilDolby = config.sideLightStyle === 'cobalt_veil_laser_recess';
  const isWarmBrass =
    environmentProfile.architectureStyle === 'private' ||
    config.sideLightStyle === 'brass_torchieres' ||
    config.sideLightStyle === 'art_deco_stepped_fins' ||
    isArtDecoSunburst;

  const speakerScale = useMemo(
    () =>
      Math.min(1.22, Math.max(0.76, W / 19.5)) *
      (isAuroraMinimal || isAmberHorizontal ? 1.02 : isImaxLaser ? 1.08 : 1.0),
    [W, isImaxLaser, isAuroraMinimal, isAmberHorizontal],
  );

  const geometries = useMemo(() => {
    // Surround enclosure + driver geometries
    const surroundCabinetGeo = buildTrapezoidCabinetGeometry(0.46, 0.34, 0.7, 0.32, 0.018);
    const surroundBaffleGeo = new THREE.BoxGeometry(0.41, 0.63, 0.025);
    const surroundGrilleRimGeo = new THREE.BoxGeometry(0.44, 0.66, 0.02);
    const surroundWooferRimGeo = new THREE.TorusGeometry(0.145, 0.014, 12, 28);
    const surroundWooferSurroundGeo = new THREE.TorusGeometry(0.128, 0.016, 12, 28);
    const surroundWooferConeGeo = buildWooferConeGeometry(0.125, 0.032, 0.036, 28);
    const surroundDustCapGeo = new THREE.SphereGeometry(0.034, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55);
    const surroundHornGeo = buildHornWaveguideGeometry(0.24, 0.135, 0.055);
    const surroundHornBackGeo = new THREE.BoxGeometry(0.14, 0.075, 0.03);
    const surroundPortGeo = new THREE.CylinderGeometry(0.026, 0.026, 0.04, 16);
    surroundPortGeo.rotateX(Math.PI / 2);

    // Wall yoke bracket geometries
    const wallPlateGeo = new THREE.BoxGeometry(0.24, 0.36, 0.03);
    const yokeArmGeo = new THREE.BoxGeometry(0.035, 0.055, 0.28);
    const yokeRearBarGeo = new THREE.BoxGeometry(0.56, 0.055, 0.04);
    const pivotBoltGeo = new THREE.CylinderGeometry(0.026, 0.026, 0.05, 14);
    pivotBoltGeo.rotateZ(Math.PI / 2);

    // Overhead Dolby Atmos ceiling pod geometries
    const atmosCabinetGeo = buildTrapezoidCabinetGeometry(0.58, 0.44, 0.28, 0.52, 0.016);
    const atmosBaffleGeo = new THREE.BoxGeometry(0.52, 0.024, 0.46);
    const atmosWooferRimGeo = new THREE.TorusGeometry(0.165, 0.015, 12, 28);
    const atmosWooferConeGeo = buildWooferConeGeometry(0.15, 0.038, 0.04, 28);
    atmosWooferConeGeo.rotateX(Math.PI / 2); // cone opens downward (-Y)
    const atmosTweeterPodGeo = new THREE.CylinderGeometry(0.038, 0.048, 0.04, 18);
    const atmosCeilingPlateGeo = new THREE.BoxGeometry(0.32, 0.03, 0.32);
    const atmosDropArmGeo = new THREE.BoxGeometry(0.04, 0.22, 0.05);

    // Front stage subwoofer + 3-way line-array tower geometries
    const towerPlinthGeo = new THREE.BoxGeometry(0.88, 0.12, 0.78);
    const subCabinetGeo = buildTrapezoidCabinetGeometry(0.82, 0.68, 1.38, 0.7, 0.024);
    const subBaffleGeo = new THREE.BoxGeometry(0.74, 1.28, 0.03);
    const subWooferRimGeo = new THREE.TorusGeometry(0.245, 0.022, 12, 32);
    const subWooferSurroundGeo = new THREE.TorusGeometry(0.218, 0.024, 12, 32);
    const subWooferConeGeo = buildWooferConeGeometry(0.212, 0.055, 0.065, 32);
    const subDustCapGeo = new THREE.SphereGeometry(0.06, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55);
    const subSlotPortGeo = new THREE.BoxGeometry(0.64, 0.065, 0.04);

    const lineArrayCabinetGeo = buildTrapezoidCabinetGeometry(0.78, 0.58, 0.34, 0.54, 0.016);
    const lineArrayBaffleGeo = new THREE.BoxGeometry(0.7, 0.28, 0.025);
    const lineMidRimGeo = new THREE.TorusGeometry(0.095, 0.011, 10, 24);
    const lineMidConeGeo = buildWooferConeGeometry(0.088, 0.022, 0.026, 22);
    const lineHornGeo = buildHornWaveguideGeometry(0.22, 0.2, 0.05);
    const rigBracketGeo = new THREE.BoxGeometry(0.04, 0.92, 0.24);

    // Shared thin grille mesh bars (vertical & horizontal wire protection look without hiding drivers)
    const grilleBarVGeo = new THREE.BoxGeometry(0.006, 0.6, 0.006);
    const grilleBarHGeo = new THREE.BoxGeometry(0.39, 0.006, 0.006);

    // Flush-mounted recessed architectural ceiling speakers (Walnut Reserve Salon & Champagne Ivory Lounge)
    const flushCeilingTrimGeo = new THREE.CylinderGeometry(0.165, 0.165, 0.016, 28);
    const flushCeilingGrilleGeo = new THREE.CylinderGeometry(0.138, 0.138, 0.02, 28);

    // Flush architectural Dolby Atmos overhead ceiling modules (Dolby Cobalt Veil 250 matte-espresso ceiling)
    const cobaltAtmosBezelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.024, 32);
    const cobaltAtmosTrimGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.028, 32);
    const cobaltAtmosGrilleGeo = new THREE.CylinderGeometry(0.33, 0.33, 0.032, 32);
    const cobaltAtmosDriverRimGeo = new THREE.TorusGeometry(0.16, 0.014, 12, 28);
    cobaltAtmosDriverRimGeo.rotateX(Math.PI / 2);
    const cobaltAtmosDriverConeGeo = new THREE.CylinderGeometry(0.145, 0.045, 0.024, 24);
    const cobaltAtmosTweeterGeo = new THREE.CylinderGeometry(0.04, 0.048, 0.024, 18);

    return {
      surroundCabinetGeo,
      surroundBaffleGeo,
      surroundGrilleRimGeo,
      surroundWooferRimGeo,
      surroundWooferSurroundGeo,
      surroundWooferConeGeo,
      surroundDustCapGeo,
      surroundHornGeo,
      surroundHornBackGeo,
      surroundPortGeo,
      wallPlateGeo,
      yokeArmGeo,
      yokeRearBarGeo,
      pivotBoltGeo,
      atmosCabinetGeo,
      atmosBaffleGeo,
      atmosWooferRimGeo,
      atmosWooferConeGeo,
      atmosTweeterPodGeo,
      atmosCeilingPlateGeo,
      atmosDropArmGeo,
      towerPlinthGeo,
      subCabinetGeo,
      subBaffleGeo,
      subWooferRimGeo,
      subWooferSurroundGeo,
      subWooferConeGeo,
      subDustCapGeo,
      subSlotPortGeo,
      lineArrayCabinetGeo,
      lineArrayBaffleGeo,
      lineMidRimGeo,
      lineMidConeGeo,
      lineHornGeo,
      rigBracketGeo,
      grilleBarVGeo,
      grilleBarHGeo,
      flushCeilingTrimGeo,
      flushCeilingGrilleGeo,
      cobaltAtmosBezelGeo,
      cobaltAtmosTrimGeo,
      cobaltAtmosGrilleGeo,
      cobaltAtmosDriverRimGeo,
      cobaltAtmosDriverConeGeo,
      cobaltAtmosTweeterGeo,
    };
  }, []);

  useEffect(() => {
    return () => {
      Object.values(geometries).forEach((g) => g.dispose());
    };
  }, [geometries]);

  const materials = useMemo(() => {
    const cabinetMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: isBiophilicMoss ? '#23272b' : '#171920',
        roughness: isBiophilicMoss ? 0.88 : 0.72,
        metalness: isBiophilicMoss ? 0.03 : 0.12,
      }),
      screenBounceUniforms,
    );

    const baffleMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        map: speakerGrilleMap,
        color: isBiophilicMoss ? '#191c20' : '#101217',
        roughness: isBiophilicMoss ? 0.92 : 0.86,
        metalness: isBiophilicMoss ? 0.02 : 0.08,
      }),
      screenBounceUniforms,
    );

    const coneMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#20242e',
        roughness: 0.62,
        metalness: 0.14,
      }),
      screenBounceUniforms,
    );

    const rubberMat = new THREE.MeshStandardMaterial({
      color: '#0c0d10',
      roughness: 0.48,
      metalness: 0.05,
    });

    const metalTrimMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: isBiophilicMoss
          ? '#272b30'
          : isImaxLaser || isDolbyMediumLuxury || isParametricObsidian
            ? '#181b22'
            : isModernMultiplex || isVolcanicCopper2d || isMandap2d
              ? '#1c1f26'
              : isWarmBrass
                ? '#a88743'
                : '#4a5365',
        roughness: isBiophilicMoss
          ? 0.82
          : isModernMultiplex || isVolcanicCopper2d || isMandap2d || isParametricObsidian || isImaxLaser || isDolbyMediumLuxury
            ? 0.44
            : 0.24,
        metalness: isBiophilicMoss
          ? 0.08
          : isModernMultiplex || isVolcanicCopper2d || isMandap2d || isParametricObsidian || isImaxLaser || isDolbyMediumLuxury
            ? 0.62
            : 0.88,
      }),
      screenBounceUniforms,
    );

    const darkSteelMat = new THREE.MeshStandardMaterial({
      color: isBiophilicMoss ? '#1e2226' : '#252932',
      roughness: isBiophilicMoss ? 0.8 : 0.34,
      metalness: isBiophilicMoss ? 0.12 : 0.82,
    });

    const hornThroatMat = new THREE.MeshStandardMaterial({
      color: '#181c24',
      roughness: isBiophilicMoss ? 0.68 : 0.28,
      metalness: isBiophilicMoss ? 0.14 : 0.68,
    });

    const portVoidMat = new THREE.MeshBasicMaterial({
      color: '#040406',
    });

    const statusLedMat = new THREE.MeshStandardMaterial({
      color: lightingProfile.accentColor,
      emissive: lightingProfile.accentColor,
      emissiveIntensity: isBiophilicMoss ? 0.2 + lightFactor * 0.2 : 0.45 + (1 - lightFactor) * 0.25,
      roughness: 0.2,
    });

    const cobaltAtmosBezelMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#2c313b',
        roughness: 0.4,
        metalness: 0.62,
      }),
      screenBounceUniforms,
    );

    const cobaltAtmosBronzeTrimMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#5a4230',
        roughness: 0.44,
        metalness: 0.56,
      }),
      screenBounceUniforms,
    );

    const cobaltAtmosGrilleMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        map: speakerGrilleMap,
        color: '#272c36',
        roughness: 0.84,
        metalness: 0.14,
      }),
      screenBounceUniforms,
    );

    return {
      cabinetMat,
      baffleMat,
      coneMat,
      rubberMat,
      metalTrimMat,
      darkSteelMat,
      hornThroatMat,
      portVoidMat,
      statusLedMat,
      cobaltAtmosBezelMat,
      cobaltAtmosBronzeTrimMat,
      cobaltAtmosGrilleMat,
    };
  }, [speakerGrilleMap, isWarmBrass, isModernMultiplex, isVolcanicCopper2d, isMandap2d, isParametricObsidian, isBiophilicMoss, isImaxLaser, isDolbyMediumLuxury, lightingProfile.accentColor, screenBounceUniforms, lightFactor]);

  useEffect(() => {
    return () => {
      Object.values(materials).forEach((m) => m.dispose());
    };
  }, [materials]);

  // Compute safe side-wall surround bay coordinates (concealed in ICE side wall modules, ScreenX panoramic walls & Walnut/Champagne private salons)
  const sideSpeakerPositions = useMemo(() => {
    const arr: { x: number; y: number; z: number; side: -1 | 1; bayIdx: number }[] = [];
    if (isPrivateVolcanic || isPrivateChampagne || isIce || isScreenX) return arr;
    if (isCobaltVeilDolby) {
      // 6 symmetrical matte-black directional surround speakers mounted cleanly along the molten-amber wave ridge
      const countPerSide = 6;
      const zMin = -L * 0.482;
      const zMax = L * 0.482;
      const zStart = Math.max(frontZ + 5.2, config.firstRowZ - 0.8);
      const zEnd = Math.min(backZ - 2.6, config.firstRowZ + (config.seatingRows - 1) * config.rowSpacing + 0.4);
      for (let i = 0; i < countPerSide; i++) {
        const t = countPerSide > 1 ? i / (countPerSide - 1) : 0.5;
        const spkZ = THREE.MathUtils.lerp(zStart, zEnd, t);
        const u = THREE.MathUtils.clamp((spkZ - zMin) / Math.max(1, zMax - zMin), 0, 1);
        const { amberTopY } = getDolbyVeilWaveHeights(u, H, topTierY);
        const spkY = amberTopY + 0.36;
        ([-1, 1] as const).forEach((side) => {
          arr.push({
            x: side * (W / 2 - 0.45),
            y: spkY,
            z: spkZ,
            side,
            bayIdx: i,
          });
        });
      }
      return arr;
    }
    if (isMandap2d) {
      const bayCount = 5;
      const zMin = -L * 0.415;
      const zMax = L * 0.415;
      const baySpan = (zMax - zMin) / bayCount;
      const spkY = Math.min(H - 3.2, Math.max(topTierY + 1.15, H * 0.52));
      for (let i = 0; i < bayCount; i++) {
        const bayMidZ = zMin + (i + 0.5) * baySpan;
        ([-1, 1] as const).forEach((side) => {
          arr.push({
            x: side * (W / 2 - 0.325),
            y: spkY,
            z: bayMidZ,
            side,
            bayIdx: i,
          });
        });
      }
      return arr;
    }
    if (isParametricObsidian) {
      // 5 rugged matte-black commercial surround speakers per side wall ascending gently toward rear rows
      const countPerSide = 5;
      const zStart = Math.max(frontZ + 4.8, config.firstRowZ - 1.0);
      const zEnd = Math.min(backZ - 2.6, config.firstRowZ + (config.seatingRows - 1) * config.rowSpacing + 0.2);
      const yLow = Math.max(4.6, H * 0.32);
      const yHigh = Math.min(H - 2.6, topTierY + 1.85);
      for (let i = 0; i < countPerSide; i++) {
        const t = countPerSide > 1 ? i / (countPerSide - 1) : 0.5;
        const spkZ = THREE.MathUtils.lerp(zStart, zEnd, t);
        const spkY = THREE.MathUtils.lerp(yLow, yHigh, t);
        ([-1, 1] as const).forEach((side) => {
          arr.push({
            x: side * (W / 2 - 0.68),
            y: spkY,
            z: spkZ,
            side,
            bayIdx: i,
          });
        });
      }
      return arr;
    }
    if (isDolbyMediumLuxury) {
      // Symmetrical row of neatly mounted black Dolby Atmos surround sound speakers along the mid-upper wall
      const countPerSide = 6;
      const zStart = Math.max(frontZ + 4.4, config.firstRowZ - 1.4);
      const zEnd = Math.min(backZ - 2.6, config.firstRowZ + (config.seatingRows - 1) * config.rowSpacing + 0.4);
      const midUpperY = Math.min(H - 2.15, Math.max(topTierY + 1.45, H * 0.62));
      for (let i = 0; i < countPerSide; i++) {
        const t = countPerSide > 1 ? i / (countPerSide - 1) : 0.5;
        const spkZ = THREE.MathUtils.lerp(zStart, zEnd, t);
        ([-1, 1] as const).forEach((side) => {
          arr.push({
            x: side * (W / 2 - 0.25),
            y: midUpperY,
            z: spkZ,
            side,
            bayIdx: i,
          });
        });
      }
      return arr;
    }

    if (isBiophilicMoss) {
      // Visible matte-charcoal surround speakers stepping cleanly down along the stadium rake inside wood-lined inset alcoves
      const { sideSpeakers } = getBiophilicSpeakerPositions(config, topTierY);
      sideSpeakers.forEach((spk, i) => {
        ([-1, 1] as const).forEach((side) => {
          arr.push({
            x: side * (W / 2 - 0.26),
            y: spk.y,
            z: spk.z,
            side,
            bayIdx: i,
          });
        });
      });
      return arr;
    }

    if (isArtDecoSunburst) {
      const bayCount = Math.max(1, wallBayZs.length - 1);
      for (let idx = 0; idx < bayCount; idx++) {
        const bayMidZ = (wallBayZs[idx] + wallBayZs[idx + 1]) * 0.5;
        const rowFrac = THREE.MathUtils.clamp(
          (bayMidZ - config.firstRowZ) / Math.max(0.5, config.rowSpacing),
          0,
          Math.max(0, config.seatingRows - 1),
        );
        const earLevelY = rowFrac * config.rowElevationStep + 1.32;
        ([-1, 1] as const).forEach((side) => {
          arr.push({
            x: side * (W / 2 - 0.25),
            y: earLevelY,
            z: bayMidZ,
            side,
            bayIdx: idx,
          });
        });
      }
      return arr;
    }

    if (isCobaltHorizonImax) {
      // 6 sleek matte-black tilted IMAX surround speakers per side stepping smoothly upward along the stadium rake
      const countPerSide = 6;
      const zStart = Math.max(frontZ + 5.4, config.firstRowZ - 1.2);
      const zEnd = Math.min(backZ - 2.6, config.firstRowZ + (config.seatingRows - 1) * config.rowSpacing + 0.4);
      const yLow = Math.max(4.4, H * 0.3);
      const yHigh = Math.min(H - 2.2, topTierY + 2.15);
      for (let i = 0; i < countPerSide; i++) {
        const t = countPerSide > 1 ? i / (countPerSide - 1) : 0.5;
        const spkZ = THREE.MathUtils.lerp(zStart, zEnd, t);
        const spkY = THREE.MathUtils.lerp(yLow, yHigh, t);
        ([-1, 1] as const).forEach((side) => {
          arr.push({
            x: side * (W / 2 - 0.34),
            y: spkY,
            z: spkZ,
            side,
            bayIdx: i,
          });
        });
      }
      return arr;
    }

    if (isModernMultiplex || isVolcanicCopper2d || isImaxLaser) {
      // Symmetrical horizontal rows of black surrounds mounted along the upper side walls
      const countPerSide = L > 32 ? 7 : 6;
      const zStart = Math.max(frontZ + 4.8, config.firstRowZ - 2.2);
      const zEnd = Math.min(backZ - 2.8, config.firstRowZ + (config.seatingRows - 1) * config.rowSpacing + 0.6);
      const upperWallY = isImaxLaser
        ? Math.min(H - 1.95, Math.max(topTierY + 2.35, H * 0.72))
        : Math.min(H - 1.75, Math.max(topTierY + 2.0, H * 0.69));
      for (let i = 0; i < countPerSide; i++) {
        const t = i / (countPerSide - 1);
        const spkZ = THREE.MathUtils.lerp(zStart, zEnd, t);
        ([-1, 1] as const).forEach((side) => {
          arr.push({
            x: side * (W / 2 - 0.22),
            y: upperWallY,
            z: spkZ,
            side,
            bayIdx: i,
          });
        });
      }
      return arr;
    }

    if (isThunder4dx) {
      // Hidden surround sound speaker arrays integrated cleanly flush between the 3D parametric wall ribs
      const bayCount = Math.max(1, wallBayZs.length - 1);
      for (let idx = 0; idx < bayCount; idx++) {
        const bayMidZ = (wallBayZs[idx] + wallBayZs[idx + 1]) * 0.5;
        const rowFrac = THREE.MathUtils.clamp(
          (bayMidZ - config.firstRowZ) / Math.max(0.5, config.rowSpacing),
          0,
          Math.max(0, config.seatingRows - 1),
        );
        const spkY = Math.min(H - 1.8, Math.max(3.6, rowFrac * config.rowElevationStep + 3.05));
        ([-1, 1] as const).forEach((side) => {
          arr.push({
            x: side * (W / 2 - 0.14),
            y: spkY,
            z: bayMidZ,
            side,
            bayIdx: idx,
          });
        });
      }
      return arr;
    }

    if (isCrimson4dx || isArctic4dx) {
      // Directional surround sound speakers interleaved cleanly at bay midpoints between wind blowers & SFX nozzles
      const bayCount = Math.max(1, wallBayZs.length - 1);
      for (let idx = 0; idx < bayCount; idx++) {
        const bayMidZ = (wallBayZs[idx] + wallBayZs[idx + 1]) * 0.5;
        const rowFrac = THREE.MathUtils.clamp(
          (bayMidZ - config.firstRowZ) / Math.max(0.5, config.rowSpacing),
          0,
          Math.max(0, config.seatingRows - 1),
        );
        const spkY = Math.min(H - 1.75, Math.max(3.6, rowFrac * config.rowElevationStep + 3.05));
        ([-1, 1] as const).forEach((side) => {
          arr.push({
            x: side * (W / 2 - 0.24),
            y: spkY,
            z: bayMidZ,
            side,
            bayIdx: idx,
          });
        });
      }
      return arr;
    }

    const usableBays = wallBayZs.filter((_, idx) => idx >= 1 && idx <= wallBayZs.length - 1);
    usableBays.forEach((bz, idx) => {
      const spkZ = Math.min(backZ - 1.15, bz + 0.82);
      const spkY = Math.min(
        H - 1.35,
        Math.max(2.35, topTierY + 2.25 - (usableBays.length - 1 - idx) * 0.16),
      );
      ([-1, 1] as const).forEach((side) => {
        arr.push({
          x: side * (W / 2 - 0.22),
          y: spkY,
          z: spkZ,
          side,
          bayIdx: idx,
        });
      });
    });
    return arr;
  }, [isPrivateVolcanic, isPrivateChampagne, isDolbyMediumLuxury, isCobaltVeilDolby, isIce, isScreenX, isMandap2d, isParametricObsidian, isBiophilicMoss, isArtDecoSunburst, isModernMultiplex, isVolcanicCopper2d, isCobaltHorizonImax, isImaxLaser, isCrimson4dx, isArctic4dx, isThunder4dx, config, wallBayZs, frontZ, backZ, H, topTierY, W, L]);

  // Rear-wall surround speakers: dedicated speakers flanking the projector booth window & back wall (omitted on private residential rear walls & ScreenX 3-wall halls)
  const rearSpeakerPositions = useMemo(() => {
    if (isPrivateVolcanic || isPrivateChampagne || isScreenX) return [];
    const boothY = isIce
      ? Math.min(H - 1.65, Math.max(10.35, topTierY + 5.6))
      : Math.min(H - 1.4, topTierY + 3.25);
    const boothWinW = Math.min(4.8, W * 0.42);
    const boothWinH = Math.min(1.42, H * 0.24);
    const winTop = Math.min(H - 0.28, boothY + boothWinH / 2);
    const winBot = Math.max(0.25, boothY - boothWinH / 2);
    const winMidY = (winTop + winBot) / 2;
    const rearZ = isCobaltVeilDolby
      ? backZ - 0.46
      : isParametricObsidian
        ? backZ - 0.68
        : isBiophilicMoss
          ? backZ - 0.26
          : backZ - 0.21;

    const list: { x: number; y: number; z: number; yaw: number; pitch: number }[] = [];

    const boothSideX = Math.min(W / 2 - 0.68, boothWinW / 2 + 0.78);
    ([-1, 1] as const).forEach((side) => {
      list.push({
        x: side * boothSideX,
        y: winMidY,
        z: rearZ,
        yaw: Math.PI - side * (isBiophilicMoss ? 0.06 : 0.14),
        pitch: 0,
      });
    });

    if (W >= 14.0 && !isIce) {
      const cornerX = Math.max(boothSideX + 1.45, Math.min(W * 0.38, W / 2 - 1.05));
      const cornerY = Math.min(H - 1.2, Math.max(2.35, winMidY - 0.12));
      ([-1, 1] as const).forEach((side) => {
        list.push({
          x: side * cornerX,
          y: cornerY,
          z: rearZ,
          yaw: Math.PI - side * (isBiophilicMoss ? 0.08 : 0.24),
          pitch: 0,
        });
      });
    }

    const crownClearance = H - winTop;
    const rearCenterY =
      crownClearance >= 0.92
        ? winTop + 0.48
        : Math.max(2.6, topTierY + 1.85);
    if (!isIce && !isBiophilicMoss && (crownClearance >= 0.92 || winBot - (topTierY + 2.45) >= 0.85)) {
      list.push({
        x: 0,
        y: rearCenterY,
        z: rearZ,
        yaw: Math.PI,
        pitch: 0.12,
      });
    }

    return list;
  }, [isPrivateVolcanic, isPrivateChampagne, isIce, isScreenX, isCobaltVeilDolby, isParametricObsidian, isBiophilicMoss, W, H, topTierY, backZ]);

  // Overhead height speaker coordinates (ICE, ScreenX, Modern Multiplex, Dolby Atmos, IMAX 12-Channel, Private Salons & bespoke 4DX ceilings)
  const atmosSpeakerPositions = useMemo(() => {
    const pts: { x: number; y: number; z: number; side: -1 | 1 }[] = [];
    if (isCobaltHorizonImax) {
      // IMAX Cobalt Horizon mounts curved line-array clusters & angled canisters directly beneath its central box-truss
      return pts;
    }
    if (isCobaltVeilDolby) {
      const xs = [-W * 0.25, 0, W * 0.25];
      const zs = [-L * 0.28, -L * 0.095, L * 0.095, L * 0.28];
      xs.forEach((x, xi) => {
        zs.forEach((z) => {
          pts.push({
            x,
            y: H - 0.2,
            z,
            side: xi === 0 ? -1 : 1,
          });
        });
      });
      return pts;
    }
    if (isScreenX) {
      if (config.ceilingLightStyle === 'screenx_stepped_tray_pods') {
        const xs = [-W * 0.145, W * 0.145];
        const zs = [-L * 0.255, -L * 0.085, L * 0.085, L * 0.255];
        xs.forEach((x, xi) => {
          zs.forEach((z) => {
            pts.push({
              x,
              y: H - 0.204,
              z,
              side: xi === 0 ? -1 : 1,
            });
          });
        });
        return pts;
      }
      const xs = [-W * 0.25, W * 0.25];
      const zs = [-L * 0.27, -L * 0.09, L * 0.09, L * 0.27];
      xs.forEach((x, xi) => {
        zs.forEach((z) => {
          pts.push({
            x,
            y: H - 0.195,
            z,
            side: xi === 0 ? -1 : 1,
          });
        });
      });
      return pts;
    }
    if (isPrivateVolcanic) {
      const xs = [-W * 0.24, W * 0.24];
      const zs = [-1.6, 1.6];
      xs.forEach((x, xi) => {
        zs.forEach((z) => {
          pts.push({
            x,
            y: H - 0.214,
            z,
            side: xi === 0 ? -1 : 1,
          });
        });
      });
      return pts;
    }
    if (isPrivateChampagne) {
      const xs = [-W * 0.31, W * 0.31];
      const zs = [-L * 0.09, L * 0.09];
      xs.forEach((x, xi) => {
        zs.forEach((z) => {
          pts.push({
            x,
            y: H - 0.212,
            z,
            side: xi === 0 ? -1 : 1,
          });
        });
      });
      return pts;
    }
    if (isMandap2d) {
      const xs = [-W * 0.125, W * 0.125];
      const zs = [-L * 0.335, -L * 0.193, 0, L * 0.193, L * 0.335];
      xs.forEach((x, xi) => {
        zs.forEach((z) => {
          pts.push({
            x,
            y: H - 0.188,
            z,
            side: xi === 0 ? -1 : 1,
          });
        });
      });
      return pts;
    }
    if (isParametricObsidian) {
      const countPerRow = 4;
      const xs = [-W * 0.3, -W * 0.1, W * 0.1, W * 0.3];
      const zStart = Math.max(frontZ + 5.2, config.firstRowZ - 3.0);
      const zEnd = Math.min(backZ - 3.6, config.firstRowZ + (config.seatingRows - 1) * config.rowSpacing + 0.4);
      xs.forEach((x, xi) => {
        for (let i = 0; i < countPerRow; i++) {
          const t = countPerRow > 1 ? i / (countPerRow - 1) : 0.5;
          pts.push({
            x,
            y: H - 0.2,
            z: THREE.MathUtils.lerp(zStart, zEnd, t),
            side: xi < 2 ? -1 : 1,
          });
        }
      });
      return pts;
    }
    if (isBiophilicMoss) {
      const countPerRow = 4;
      const xs = [-W * 0.27, -W * 0.09, W * 0.09, W * 0.27];
      const zStart = Math.max(frontZ + 4.4, config.firstRowZ - 2.8);
      const zEnd = Math.min(backZ - 3.0, config.firstRowZ + (config.seatingRows - 1) * config.rowSpacing + 0.8);
      xs.forEach((x, xi) => {
        for (let i = 0; i < countPerRow; i++) {
          const t = countPerRow > 1 ? i / (countPerRow - 1) : 0.5;
          pts.push({
            x,
            y: H - 0.205,
            z: THREE.MathUtils.lerp(zStart, zEnd, t),
            side: xi < 2 ? -1 : 1,
          });
        }
      });
      return pts;
    }
    if (isIce || isModernMultiplex || isVolcanicCopper2d || isImaxLaser || isCrimson4dx || isArctic4dx || isThunder4dx || isDolbyMediumLuxury) {
      const countPerRow = isIce
        ? 6
        : isModernMultiplex || isImaxLaser
          ? L > 32
            ? 7
            : 6
          : isCrimson4dx || isArctic4dx || isThunder4dx || isDolbyMediumLuxury || isVolcanicCopper2d || isBiophilicMoss
            ? 5
            : 7;
      const xs = [-W * 0.22, W * 0.22];
      const zStart = Math.max(frontZ + 4.2, config.firstRowZ - 3.4);
      const zEnd = Math.min(backZ - 3.0, config.firstRowZ + (config.seatingRows - 1) * config.rowSpacing + 1.4);
      const iceCeilingY =
        config.ceilingLightStyle === 'ice_origami_baffles'
          ? H - 0.34
          : config.ceilingLightStyle === 'ice_wave_timber_fins'
            ? H - 0.28
            : H - 0.22;
      xs.forEach((x, xi) => {
        for (let i = 0; i < countPerRow; i++) {
          const t = countPerRow > 1 ? i / (countPerRow - 1) : 0.5;
          pts.push({
            x,
            y: isIce
              ? iceCeilingY
              : isImaxLaser && !isAuroraMinimal && !isAmberHorizontal
                ? H - 0.68
                : isCrimson4dx || isArctic4dx
                  ? H - 0.56
                  : isVolcanicCopper2d
                    ? H - 0.34
                    : isBiophilicMoss
                      ? H - 0.205
                      : H - 0.24,
            z: THREE.MathUtils.lerp(zStart, zEnd, t),
            side: xi === 0 ? -1 : 1,
          });
        }
      });
      return pts;
    }

    const xs = [-W * 0.22, W * 0.22];
    const zs = [-L * 0.18, L * 0.08];
    xs.forEach((x, xi) => {
      zs.forEach((z) => {
        pts.push({
          x,
          y: H - 0.2,
          z,
          side: xi === 0 ? -1 : 1,
        });
      });
    });
    return pts;
  }, [isScreenX, isPrivateVolcanic, isPrivateChampagne, isDolbyMediumLuxury, isCobaltVeilDolby, isCobaltHorizonImax, isIce, isModernMultiplex, isVolcanicCopper2d, isMandap2d, isParametricObsidian, isBiophilicMoss, isImaxLaser, isAuroraMinimal, isAmberHorizontal, isCrimson4dx, isArctic4dx, isThunder4dx, W, L, H, frontZ, backZ, config.ceilingLightStyle, config.firstRowZ, config.seatingRows, config.rowSpacing]);

  // Front Proscenium Dual-18" Subwoofer + 3-Way Line-Array Towers (omitted on floating frameless Dolby & flush seamless ScreenX 270 front walls; behind-screen for ICE, Modern Multiplex, IMAX, Private Salons, bespoke 4DX, volcanic-copper 2D, Mandap 2D, Obsidian Wave 550 & Sylva Moss 250 halls)
  const frontTowerPositions = useMemo(() => {
    if (isDolbyMediumLuxury || isCobaltVeilDolby || isScreenX) return [];
    if (isIce || isModernMultiplex || isVolcanicCopper2d || isMandap2d || isParametricObsidian || isBiophilicMoss || isPrivateVolcanic || isPrivateChampagne || isImaxLaser || isCrimson4dx || isArctic4dx || isThunder4dx) {
      // Recessed Left, Center, Right behind-screen speakers & subwoofers behind acoustically transparent screen
      const behindZ = Math.max(frontZ + 0.38, screenPosition[2] - 0.55);
      return [-screenWidth * 0.34, 0, screenWidth * 0.34].map((tx, idx) => ({
        x: tx,
        y: 0.4,
        z: behindZ,
        side: idx === 0 ? (-1 as const) : idx === 2 ? (1 as const) : (0 as const),
      }));
    }
    const safeMinX = Math.min(W / 2 - 0.45, screenWidth / 2 + 0.36);
    const towerX = Math.max(safeMinX, W / 2 - 0.56);
    const towerZ = Math.max(frontZ + 0.65, screenPosition[2] + 0.56);
    return ([-1, 1] as const).map((side) => ({
      x: side * towerX,
      y: 0.5,
      z: towerZ,
      side,
    }));
  }, [isScreenX, isDolbyMediumLuxury, isCobaltVeilDolby, isIce, isModernMultiplex, isVolcanicCopper2d, isMandap2d, isParametricObsidian, isBiophilicMoss, isPrivateVolcanic, isPrivateChampagne, isImaxLaser, isCrimson4dx, isArctic4dx, isThunder4dx, W, screenWidth, frontZ, screenPosition]);

  const renderSurroundUnit = (key: string, recessedFlush = false) => (
    <group key={key} scale={speakerScale}>
      {!recessedFlush && (
        <>
          {/* Flush Wall Mounting Plate */}
          <mesh position={[0, 0, 0.015]} geometry={geometries.wallPlateGeo} material={materials.darkSteelMat} />

          {/* Steel U-Yoke Bracket */}
          <mesh position={[0, 0, 0.055]} geometry={geometries.yokeRearBarGeo} material={materials.darkSteelMat} />
          {[-0.265, 0.265].map((yx, yi) => (
            <group key={`yoke-${yi}`} position={[yx, 0, 0.18]}>
              <mesh geometry={geometries.yokeArmGeo} material={materials.darkSteelMat} />
              <mesh position={[0, 0, 0.12]} geometry={geometries.pivotBoltGeo} material={materials.metalTrimMat} />
            </group>
          ))}
        </>
      )}

      {/* Angled or Flush-Recessed Acoustic Cabinet */}
      <group
        position={recessedFlush ? [0, 0, -0.095] : [0, -0.02, 0.28]}
        rotation={recessedFlush ? [0, 0, 0] : [0.34, 0, 0]}
      >
        {/* Main Trapezoidal Cabinet */}
        <mesh
          geometry={geometries.surroundCabinetGeo}
          material={materials.cabinetMat}
          castShadow
        />

        {/* Chamfered Metallic Front Bezel Frame */}
        <mesh
          position={[0, 0, 0.162]}
          geometry={geometries.surroundGrilleRimGeo}
          material={recessedFlush ? materials.cabinetMat : materials.metalTrimMat}
        />

        {/* Recessed Acoustic Baffle Plate */}
        <mesh
          position={[0, 0, 0.166]}
          geometry={geometries.surroundBaffleGeo}
          material={materials.baffleMat}
        />

        {/* Lower 8" Sculpted Woofer Driver Assembly */}
        <group position={[0, -0.11, 0.178]}>
          <mesh geometry={geometries.surroundWooferRimGeo} material={materials.metalTrimMat} />
          <mesh position={[0, 0, 0.002]} geometry={geometries.surroundWooferSurroundGeo} material={materials.rubberMat} />
          <mesh position={[0, 0, -0.032]} geometry={geometries.surroundWooferConeGeo} material={materials.coneMat} />
          <mesh position={[0, 0, -0.018]} rotation={[Math.PI / 2, 0, 0]} geometry={geometries.surroundDustCapGeo} material={materials.rubberMat} />
        </group>

        {/* Upper Flared High-Frequency Constant-Directivity Horn Waveguide */}
        <group position={[0, 0.165, 0.176]}>
          <mesh geometry={geometries.surroundHornGeo} material={materials.hornThroatMat} />
          <mesh position={[0, 0, -0.028]} geometry={geometries.surroundHornBackGeo} material={materials.portVoidMat} />
        </group>

        {/* Dual Tuned Bass Reflex Ports */}
        {[-0.12, 0.12].map((px, pi) => (
          <mesh
            key={`port-${pi}`}
            position={[px, -0.275, 0.172]}
            geometry={geometries.surroundPortGeo}
            material={materials.portVoidMat}
          />
        ))}

        {/* Thin Studio Protective Wire Bars Across Front Baffle */}
        {[-0.14, 0.14].map((gx, gi) => (
          <mesh
            key={`gbar-v-${gi}`}
            position={[gx, 0, 0.194]}
            geometry={geometries.grilleBarVGeo}
            material={materials.darkSteelMat}
          />
        ))}
        {[-0.29, 0.03, 0.29].map((gy, gi) => (
          <mesh
            key={`gbar-h-${gi}`}
            position={[0, gy, 0.194]}
            geometry={geometries.grilleBarHGeo}
            material={materials.darkSteelMat}
          />
        ))}

        {/* Subtle Cinema Power Status Badge LED (omitted on Sylva Moss 250, Dolby Cobalt Veil 250 & IMAX Cobalt Horizon so surrounds remain sleek matte black) */}
        {!isBiophilicMoss && !isCobaltVeilDolby && !isCobaltHorizonImax && (
          <mesh position={[0, -0.285, 0.186]} material={materials.statusLedMat}>
            <boxGeometry args={[0.045, 0.012, 0.008]} />
          </mesh>
        )}
      </group>
    </group>
  );

  return (
    <group>
      {/* Side-Wall Surround Speaker Arrays (Wall-Mounted or Recessed/Hidden in Wall Cavities) */}
      {sideSpeakerPositions.map((sp, i) => (
        <group
          key={`side-surround-${i}`}
          position={[sp.x, sp.y, sp.z]}
          rotation={[0, sp.side === -1 ? Math.PI / 2 : -Math.PI / 2, 0]}
        >
          {renderSurroundUnit(`side-unit-${i}`, isArtDecoSunburst || isThunder4dx)}
        </group>
      ))}

      {/* Rear-Wall Surround Speakers Flanking & Framing the Projection Booth */}
      {rearSpeakerPositions.map((sp, i) => (
        <group
          key={`rear-surround-${i}`}
          position={[sp.x, sp.y, sp.z]}
          rotation={[sp.pitch, sp.yaw, 0]}
        >
          {renderSurroundUnit(`rear-unit-${i}`, isIce)}
        </group>
      ))}

      {/* Overhead Dolby Atmos Ceiling Gimbal Speaker Pods / Concealed Flush Architectural Ceiling Speakers */}
      {atmosSpeakerPositions.map((ap, i) =>
        isCobaltVeilDolby ? (
          <group
            key={`atmos-cobalt-flush-${i}`}
            position={[ap.x, ap.y, ap.z]}
          >
            {/* Outer Anodized Gunmetal Flush Ceiling Ring */}
            <mesh
              position={[0, -0.006, 0]}
              geometry={geometries.cobaltAtmosBezelGeo}
              material={materials.cobaltAtmosBezelMat}
            />
            {/* Satin Dark-Bronze Recessed Trim Ring */}
            <mesh
              position={[0, -0.01, 0]}
              geometry={geometries.cobaltAtmosTrimGeo}
              material={materials.cobaltAtmosBronzeTrimMat}
            />
            {/* Perforated Acoustic Speaker Grille Disc */}
            <mesh
              position={[0, -0.014, 0]}
              geometry={geometries.cobaltAtmosGrilleGeo}
              material={materials.cobaltAtmosGrilleMat}
            />
            {/* Centered Flush Coaxial Atmos Driver */}
            <group position={[0, -0.022, 0]}>
              <mesh
                geometry={geometries.cobaltAtmosDriverRimGeo}
                material={materials.cobaltAtmosBezelMat}
              />
              <mesh
                position={[0, 0.004, 0]}
                geometry={geometries.cobaltAtmosDriverConeGeo}
                material={materials.coneMat}
              />
              <mesh
                position={[0, -0.002, 0]}
                geometry={geometries.cobaltAtmosTweeterGeo}
                material={materials.hornThroatMat}
              />
            </group>
          </group>
        ) : isPrivateVolcanic || isPrivateChampagne || isIce || isScreenX || isMandap2d ? (
          <group
            key={`atmos-flush-${i}`}
            position={[ap.x, ap.y, ap.z]}
            rotation={[0, 0, 0]}
          >
            <mesh
              position={[0, 0.004, 0]}
              geometry={geometries.flushCeilingTrimGeo}
              material={isPrivateChampagne || isPrivateVolcanic || isIce || isScreenX || isMandap2d ? materials.cabinetMat : materials.darkSteelMat}
            />
            <mesh
              position={[0, 0.001, 0]}
              geometry={geometries.flushCeilingGrilleGeo}
              material={materials.baffleMat}
            />
          </group>
        ) : (
          <group
            key={`atmos-${i}`}
            position={[ap.x, ap.y, ap.z]}
            scale={speakerScale}
          >
            {/* Ceiling Mounting Plate */}
            <mesh position={[0, -0.015, 0]} geometry={geometries.atmosCeilingPlateGeo} material={materials.darkSteelMat} />
            {/* Dual Gimbal Drop Arms */}
            {[-0.24, 0.24].map((ax, ai) => (
              <mesh
                key={`arm-${ai}`}
                position={[ax, -0.12, 0]}
                geometry={geometries.atmosDropArmGeo}
                material={materials.darkSteelMat}
              />
            ))}
            {/* Canted Coaxial Atmos Pod Tilted Inward Toward Sweet Spot */}
            <group position={[0, -0.22, 0]} rotation={[0.1, 0, ap.side * 0.36]}>
              <mesh geometry={geometries.atmosCabinetGeo} material={materials.cabinetMat} />
              <mesh position={[0, -0.145, 0]} geometry={geometries.atmosBaffleGeo} material={materials.baffleMat} />
              {/* Coaxial 10" Driver Ring & Cone */}
              <mesh
                position={[0, -0.158, 0]}
                rotation={[Math.PI / 2, 0, 0]}
                geometry={geometries.atmosWooferRimGeo}
                material={materials.metalTrimMat}
              />
              <mesh
                position={[0, -0.118, 0]}
                geometry={geometries.atmosWooferConeGeo}
                material={materials.coneMat}
              />
              {/* Centered Coaxial Compression Tweeter Waveguide */}
              <mesh
                position={[0, -0.155, 0]}
                geometry={geometries.atmosTweeterPodGeo}
                material={materials.hornThroatMat}
              />
              {!isParametricObsidian && !isBiophilicMoss && (
                <mesh position={[0, -0.145, 0.21]} material={materials.statusLedMat}>
                  <boxGeometry args={[0.05, 0.01, 0.01]} />
                </mesh>
              )}
            </group>
          </group>
        ),
      )}

      {/* IMAX Cobalt Horizon: Central Box-Truss Suspended Curved Line-Array Speaker Clusters & Angled Overhead Surrounds */}
      {isCobaltHorizonImax && (
        <group>
          {/* 4 Curved 3-Element Line-Array Clusters Hung Directly Beneath the Central Steel Box-Truss */}
          {[-W * 0.14, W * 0.14].map((tx, xi) =>
            [-L * 0.22, L * 0.08].map((tz, zi) => (
              <group
                key={`imax-truss-array-${xi}-${zi}`}
                position={[tx, H - 0.88, tz]}
                rotation={[0, xi === 0 ? -0.18 : 0.18, 0]}
                scale={speakerScale}
              >
                {/* Steel Truss Clamp & Rigging Fly-Bar */}
                <mesh position={[0, 0.12, 0]} material={materials.darkSteelMat}>
                  <boxGeometry args={[0.84, 0.08, 0.34]} />
                </mesh>
                {[-0.39, 0.39].map((rx, ri) => (
                  <mesh key={`arr-bar-${ri}`} position={[rx, -0.34, 0]} material={materials.darkSteelMat}>
                    <boxGeometry args={[0.04, 0.92, 0.24]} />
                  </mesh>
                ))}
                {/* 3 Canted Matte-Black Line-Array Modules Forming a Curved J-Array */}
                {[0, 1, 2].map((mi) => (
                  <group
                    key={`imax-arr-mod-${mi}`}
                    position={[0, -0.12 - mi * 0.28, -mi * 0.09]}
                    rotation={[0.32 + mi * 0.2, 0, 0]}
                  >
                    <mesh geometry={geometries.lineArrayCabinetGeo} material={materials.cabinetMat} castShadow />
                    <mesh position={[0, 0, 0.27]} geometry={geometries.lineArrayBaffleGeo} material={materials.baffleMat} />
                  </group>
                ))}
              </group>
            )),
          )}

          {/* 4 Angled Matte-Black Overhead Surround Canisters Hung From Cross-Trusses */}
          {[-W * 0.075, W * 0.075].map((cx, xi) =>
            [-L * 0.02, L * 0.18].map((cz, zi) => (
              <group
                key={`imax-truss-canister-${xi}-${zi}`}
                position={[cx, H - 0.88, cz]}
                rotation={[0.82, xi === 0 ? -0.22 : 0.22, 0]}
                scale={speakerScale * 0.88}
              >
                <mesh position={[0, 0.16, 0]} material={materials.darkSteelMat}>
                  <boxGeometry args={[0.16, 0.28, 0.16]} />
                </mesh>
                <mesh geometry={geometries.surroundCabinetGeo} material={materials.cabinetMat} castShadow />
                <mesh position={[0, 0, 0.166]} geometry={geometries.surroundBaffleGeo} material={materials.baffleMat} />
              </group>
            )),
          )}
        </group>
      )}

      {/* Front Proscenium / Behind-Screen Dual-18" Cinema Subwoofers + 3-Way Line-Array Horn Towers */}
      {frontTowerPositions.map((fp, i) => (
        <group
          key={`front-tower-${i}`}
          position={[fp.x, fp.y, fp.z]}
          rotation={[0, isScreenX || isIce || isModernMultiplex || isVolcanicCopper2d || isMandap2d || isParametricObsidian || isBiophilicMoss || isPrivateVolcanic || isPrivateChampagne || isImaxLaser || isCrimson4dx || isArctic4dx || isThunder4dx ? 0 : -fp.side * 0.28, 0]}
          scale={speakerScale}
        >
          {/* Vibration-Isolation Plinth Base (bottom sits flush at y=0) */}
          <mesh
            position={[0, 0.06, 0]}
            geometry={geometries.towerPlinthGeo}
            material={materials.darkSteelMat}
            castShadow
          />

          {/* Lower Dual-18" Cinema Subwoofer Enclosure */}
          <group position={[0, 0.81, 0]}>
            <mesh geometry={geometries.subCabinetGeo} material={materials.cabinetMat} castShadow />
            <mesh position={[0, 0, 0.35]} geometry={geometries.subBaffleGeo} material={materials.baffleMat} />

            {/* Dual 18" Subwoofer Cones */}
            {[-0.31, 0.28].map((wy, wi) => (
              <group key={`sub-driver-${wi}`} position={[0, wy, 0.365]}>
                <mesh geometry={geometries.subWooferRimGeo} material={materials.metalTrimMat} />
                <mesh position={[0, 0, 0.004]} geometry={geometries.subWooferSurroundGeo} material={materials.rubberMat} />
                <mesh position={[0, 0, -0.055]} geometry={geometries.subWooferConeGeo} material={materials.coneMat} />
                <mesh
                  position={[0, 0, -0.032]}
                  rotation={[Math.PI / 2, 0, 0]}
                  geometry={geometries.subDustCapGeo}
                  material={materials.rubberMat}
                />
              </group>
            ))}

            {/* Bottom Laminar Bass Reflex Slot Port */}
            <mesh
              position={[0, -0.61, 0.35]}
              geometry={geometries.subSlotPortGeo}
              material={materials.portVoidMat}
            />
          </group>

          {/* Steel Rigging Side Struts Connecting Sub to Stacked Line Array */}
          {[-0.38, 0.38].map((rx, ri) => (
            <mesh
              key={`rig-${ri}`}
              position={[rx, 1.94, 0.05]}
              geometry={geometries.rigBracketGeo}
              material={materials.metalTrimMat}
            />
          ))}

          {/* Stacked Twin Line-Array Mid-High Cinema Horn Modules */}
          {[0, 1].map((li) => (
            <group
              key={`line-mod-${li}`}
              position={[0, 1.72 + li * 0.36, 0.04]}
              rotation={[0.06 * (1 - li), 0, 0]}
            >
              <mesh geometry={geometries.lineArrayCabinetGeo} material={materials.cabinetMat} castShadow />
              <mesh position={[0, 0, 0.27]} geometry={geometries.lineArrayBaffleGeo} material={materials.baffleMat} />

              {/* Dual Mid-Range Cones Flanking Center Waveguide */}
              {[-0.22, 0.22].map((mx, mi) => (
                <group key={`mid-${mi}`} position={[mx, 0, 0.285]}>
                  <mesh geometry={geometries.lineMidRimGeo} material={materials.metalTrimMat} />
                  <mesh position={[0, 0, -0.022]} geometry={geometries.lineMidConeGeo} material={materials.coneMat} />
                </group>
              ))}

              {/* Central Planar Ribbon / Horn Waveguide */}
              <mesh position={[0, 0, 0.285]} geometry={geometries.lineHornGeo} material={materials.hornThroatMat} />
            </group>
          ))}
        </group>
      ))}
    </group>
  );
};
