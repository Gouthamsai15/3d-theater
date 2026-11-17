import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { TheaterConfiguration } from '../../types/cinema';
import { getAisleWorldXs } from '../../config/seating/seatGenerator';
import {
  createAuditoriumTextures,
  createCarbonFiberTexture,
  createRowMarkerTexture,
  createTBarCeilingGridTexture,
} from '../materials/proceduralTextures';
import {
  applyScreenBounceToMaterial,
  ScreenBounceUniforms,
} from '../lighting/screenBounceShader';
import { CinemaSpeakers } from './CinemaSpeakers';
import { SideWallLighting } from './SideWallLighting';

interface AuditoriumShellProps {
  config: TheaterConfiguration;
  lightFactor: number; // 0 = dark show playing, 1 = auditorium open
  screenBounceUniforms?: ScreenBounceUniforms;
}

const ROW_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Generates a realistic 3D pleated velvet curtain geometry with undulating vertical folds.
 */
function buildPleatedCurtainGeometry(
  width: number,
  height: number,
  depth: number,
  folds = 7,
): THREE.BufferGeometry {
  const segX = folds * 6;
  const segY = 2;
  const geom = new THREE.PlaneGeometry(width, height, segX, segY);
  const pos = geom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const normX = x / width + 0.5;
    const pleat = Math.sin(normX * folds * Math.PI * 2) * (depth * 0.5);
    pos.setZ(i, pleat);
  }
  geom.computeVertexNormals();
  return geom;
}

export const AuditoriumShell: React.FC<AuditoriumShellProps> = ({
  config,
  lightFactor,
  screenBounceUniforms,
}) => {
  const {
    auditoriumWidth: W,
    auditoriumLength: L,
    auditoriumHeight: H,
    seatingRows,
    rowSpacing,
    rowElevationStep,
    firstRowZ,
    screenPosition,
    screenWidth,
    screenHeight,
    environmentProfile,
    lightingProfile,
    sideLightStyle,
    ceilingLightStyle,
    wallBayCount,
  } = config;

  const isIce = environmentProfile.architectureStyle === 'ice';
  const isIceFlagship = sideLightStyle === 'ice_faceted_cyan';
  const isIceCobalt = sideLightStyle === 'ice_faceted_cobalt';
  const isIceAmber = sideLightStyle === 'ice_faceted_amber';
  const isBiophilicMoss = sideLightStyle === 'biophilic_crystalline_moss';
  const isArtDecoSunburst = sideLightStyle === 'art_deco_navy_sunburst';
  const isModernMultiplex = sideLightStyle === 'modern_charcoal_navy_diagonal';
  const isVolcanicCopper2d = sideLightStyle === 'volcanic_copper_ribbons';
  const isMandap2d = sideLightStyle === 'indian_mandap_jali';
  const isParametricObsidian = sideLightStyle === 'parametric_obsidian_waves';
  const isZeroStageImax =
    sideLightStyle === 'imax_cobalt_wave' ||
    sideLightStyle === 'aurora_ribbon_waves' ||
    sideLightStyle === 'horizon_tier_strips';
  const isCrimson4dx = sideLightStyle === 'crimson_velocity_4dx';
  const isArctic4dx = sideLightStyle === 'arctic_parametric_fins';
  const isThunder4dx = sideLightStyle === 'thunder_emerald_waves';
  const isDolbyObsidian = sideLightStyle === 'obsidian_slat_grazers';
  const isDolbyCobalt = sideLightStyle === 'diagonal_parabolic_ribs';
  const isDolbyVeil = sideLightStyle === 'cobalt_veil_laser_recess';
  const isDolbyFloating = isDolbyObsidian || isDolbyCobalt || isDolbyVeil;
  const isPrivateVolcanic = sideLightStyle === 'private_volcanic_copper_ribbons';
  const isPrivateChampagne = sideLightStyle === 'champagne_fluted_oak_alcoves';
  const isScreenX =
    Boolean(config.supportsScreenX) ||
    environmentProfile.architectureStyle === 'screenx';
  const isObsidianScreenX = sideLightStyle === 'screenx_panoramic_walls';
  const isMultiplexScreenX = sideLightStyle === 'screenx_silver_baffles';

  const textures = useMemo(
    () =>
      createAuditoriumTextures(
        environmentProfile,
        config.theaterName,
        lightingProfile.accentColor,
        sideLightStyle,
      ),
    [environmentProfile, config.theaterName, lightingProfile.accentColor, sideLightStyle],
  );

  const carbonFiberMap = useMemo(
    () => (isObsidianScreenX ? createCarbonFiberTexture() : null),
    [isObsidianScreenX],
  );

  const tBarCeilingGridMap = useMemo(
    () => (ceilingLightStyle === 'industrial_open_baffle_atmos' ? createTBarCeilingGridTexture() : null),
    [ceilingLightStyle],
  );

  const rowMarkerTextures = useMemo(() => {
    const arr: THREE.CanvasTexture[] = [];
    for (let r = 0; r < seatingRows; r++) {
      const label = ROW_LABELS[r] || `${r + 1}`;
      arr.push(createRowMarkerTexture(label, lightingProfile.stepLightColor));
    }
    return arr;
  }, [seatingRows, lightingProfile.stepLightColor]);

  useEffect(() => {
    return () => {
      textures.dispose();
      carbonFiberMap?.dispose();
      tBarCeilingGridMap?.dispose();
      rowMarkerTextures.forEach((t) => t.dispose());
    };
  }, [textures, carbonFiberMap, tBarCeilingGridMap, rowMarkerTextures]);

  const aisleXs = useMemo(() => getAisleWorldXs(config), [config]);

  const wingWidth = Math.max(0.75, (W - screenWidth) / 2);
  const valanceHeight = Math.max(0.45, H - (screenPosition[1] + screenHeight / 2) - 0.15);

  const curtainGeos = useMemo(() => {
    const sideCurtainGeo = buildPleatedCurtainGeometry(wingWidth, H - 0.35, 0.22, 6);
    const valanceCurtainGeo = buildPleatedCurtainGeometry(
      screenWidth + 0.8,
      valanceHeight,
      0.16,
      18,
    );
    return { sideCurtainGeo, valanceCurtainGeo };
  }, [wingWidth, H, screenWidth, valanceHeight]);

  useEffect(() => {
    return () => {
      curtainGeos.sideCurtainGeo.dispose();
      curtainGeos.valanceCurtainGeo.dispose();
    };
  }, [curtainGeos]);

  const auroraHexCeilingGeo = useMemo(() => {
    if (ceilingLightStyle !== 'imax_angular_grid') return null;
    const r = Math.min(W * 0.088, 2.35);
    const shape = new THREE.Shape();
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3 + Math.PI / 6;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) shape.moveTo(px, py);
      else shape.lineTo(px, py);
    }
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.09,
      bevelEnabled: true,
      bevelThickness: 0.015,
      bevelSize: 0.015,
      bevelSegments: 2,
    });
    geo.rotateX(Math.PI / 2);
    geo.computeVertexNormals();
    return geo;
  }, [ceilingLightStyle, W]);

  useEffect(() => {
    return () => {
      auroraHexCeilingGeo?.dispose();
    };
  }, [auroraHexCeilingGeo]);

  const materials = useMemo(() => {
    const carpetMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        map: textures.carpetMap,
        bumpMap: textures.carpetBumpMap,
        bumpScale: 0.015,
        roughness: 0.94,
        metalness: 0.02,
      }),
      screenBounceUniforms,
    );
    const wallMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        map: textures.wallMap,
        bumpMap: textures.wallBumpMap,
        bumpScale: 0.018,
        roughness: environmentProfile.architectureStyle === 'private' ? 0.52 : 0.86,
        metalness: 0.04,
      }),
      screenBounceUniforms,
    );
    const acousticPanelMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: environmentProfile.wallMaterialColor,
        bumpMap: textures.wallBumpMap,
        bumpScale: 0.014,
        roughness: 0.92,
        metalness: 0.02,
      }),
      screenBounceUniforms,
    );
    const ceilingMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        map: tBarCeilingGridMap || undefined,
        color:
          ceilingLightStyle === 'industrial_open_baffle_atmos'
            ? '#ffffff'
            : ceilingLightStyle === 'monolithic_acoustic_plaster'
              ? '#030406'
              : ceilingLightStyle === 'espresso_tray_atmos'
                ? '#140e0a'
                : environmentProfile.ceilingColor,
        roughness:
          ceilingLightStyle === 'monolithic_acoustic_plaster'
            ? 0.99
            : ceilingLightStyle === 'espresso_tray_atmos'
              ? 0.94
              : 0.9,
        metalness:
          ceilingLightStyle === 'monolithic_acoustic_plaster'
            ? 0.0
            : ceilingLightStyle === 'espresso_tray_atmos'
              ? 0.02
              : 0.06,
      }),
      screenBounceUniforms,
    );
    const trimMetalMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: isModernMultiplex
          ? '#242832'
          : isBiophilicMoss
            ? '#231b16'
            : environmentProfile.architectureStyle === 'private' ||
                sideLightStyle === 'brass_torchieres' ||
                sideLightStyle === 'art_deco_stepped_fins' ||
                sideLightStyle === 'art_deco_navy_sunburst'
              ? '#b89446'
              : '#323744',
        roughness: isModernMultiplex || isBiophilicMoss ? 0.48 : 0.28,
        metalness: isModernMultiplex ? 0.62 : isBiophilicMoss ? 0.35 : 0.84,
      }),
      screenBounceUniforms,
    );
    const nosingMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#1b1d24',
        roughness: 0.36,
        metalness: 0.72,
      }),
      screenBounceUniforms,
    );
    const stageMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: isDolbyFloating ? '#030305' : '#090a0d',
        roughness: isDolbyFloating ? 0.96 : 0.86,
        metalness: isDolbyFloating ? 0.0 : 0.06,
      }),
      screenBounceUniforms,
    );
    const darkStoneMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#15171c',
        roughness: 0.86,
        metalness: 0.06,
      }),
      screenBounceUniforms,
    );
    const darkBronzeTrimMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#4e3826',
        roughness: 0.38,
        metalness: 0.56,
      }),
      screenBounceUniforms,
    );
    const speakerMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        map: textures.speakerGrilleMap,
        color: '#181a20',
        roughness: 0.75,
        metalness: 0.18,
      }),
      screenBounceUniforms,
    );
    const doorMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#14161d',
        roughness: 0.45,
        metalness: 0.45,
      }),
      screenBounceUniforms,
    );
    const exitSignMat = new THREE.MeshBasicMaterial({
      map: textures.exitSignMap,
      color: '#7aa896',
    });
    const entranceSignMat = new THREE.MeshBasicMaterial({
      map: textures.entranceSignMap,
      transparent: true,
      opacity: 0.9,
    });
    const posterMat = new THREE.MeshStandardMaterial({
      map: textures.posterMap,
      emissive: '#ffffff',
      emissiveMap: textures.posterMap,
      emissiveIntensity: 0.45,
      roughness: 0.3,
    });
    const curtainMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        map: textures.curtainMap,
        roughness: 0.88,
        metalness: 0.02,
        side: THREE.DoubleSide,
      }),
      screenBounceUniforms,
    );
    const pearlSlateWallMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#5a6270',
        roughness: 0.84,
        metalness: 0.06,
      }),
      screenBounceUniforms,
    );
    const bronzeBaffleMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#432e23',
        roughness: 0.78,
        metalness: 0.12,
      }),
      screenBounceUniforms,
    );
    const titaniumBaffleMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#525864',
        roughness: 0.78,
        metalness: 0.18,
      }),
      screenBounceUniforms,
    );
    const obsidianRevealMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#0c0e13',
        roughness: 0.92,
        metalness: 0.02,
      }),
      screenBounceUniforms,
    );
    const brushedAluminumMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#9aa4b2',
        roughness: 0.28,
        metalness: 0.86,
      }),
      screenBounceUniforms,
    );
    const temperedGlassMat = new THREE.MeshPhysicalMaterial({
      color: '#d8eefc',
      transparent: true,
      opacity: 0.26,
      roughness: 0.08,
      metalness: 0.1,
      reflectivity: 0.85,
      depthWrite: false,
    });
    const extinguisherMat = new THREE.MeshStandardMaterial({
      color: '#991b1b',
      roughness: 0.38,
      metalness: 0.45,
    });

    // Dedicated Projection Booth Materials
    const boothInteriorWallMat = new THREE.MeshStandardMaterial({
      color: '#14161d',
      roughness: 0.85,
      metalness: 0.12,
    });
    const boothFloorMat = new THREE.MeshStandardMaterial({
      color: '#0e1015',
      roughness: 0.75,
      metalness: 0.2,
    });
    const boothGlassMat = new THREE.MeshStandardMaterial({
      color: '#1b2638',
      transparent: true,
      opacity: 0.22,
      roughness: 0.08,
      metalness: 0.25,
      depthWrite: false,
    });
    const projectorBodyMat = new THREE.MeshStandardMaterial({
      color: '#1b1e27',
      roughness: 0.34,
      metalness: 0.72,
    });
    const projectorChromeMat = new THREE.MeshStandardMaterial({
      color: '#5a6375',
      roughness: 0.2,
      metalness: 0.9,
    });
    const honedDarkStoneMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#191b20',
        roughness: 0.68,
        metalness: 0.08,
      }),
      screenBounceUniforms,
    );
    const travertineMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#342d27',
        roughness: 0.62,
        metalness: 0.06,
      }),
      screenBounceUniforms,
    );
    const champagneBrassMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#c9a861',
        roughness: 0.28,
        metalness: 0.85,
      }),
      screenBounceUniforms,
    );
    const walnutCofferMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#382216',
        roughness: 0.48,
        metalness: 0.08,
      }),
      screenBounceUniforms,
    );
    const charcoalWoolRugMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#1f2229',
        bumpMap: textures.carpetBumpMap,
        bumpScale: 0.022,
        roughness: 0.97,
        metalness: 0.0,
      }),
      screenBounceUniforms,
    );
    const smokedGlassMat = new THREE.MeshPhysicalMaterial({
      color: '#1a2026',
      transparent: true,
      opacity: 0.44,
      roughness: 0.1,
      metalness: 0.16,
      reflectivity: 0.85,
      depthWrite: false,
    });
    const wineBottleMat = new THREE.MeshStandardMaterial({
      color: '#152b1b',
      roughness: 0.18,
      metalness: 0.24,
    });
    const amberDecanterMat = new THREE.MeshStandardMaterial({
      color: '#9c5819',
      roughness: 0.16,
      metalness: 0.12,
    });
    const brushedTitaniumMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#717a88',
        roughness: 0.28,
        metalness: 0.88,
      }),
      screenBounceUniforms,
    );
    const ribbedLimestoneMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#5c544a',
        roughness: 0.86,
        metalness: 0.04,
      }),
      screenBounceUniforms,
    );
    const espressoTrimMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#1b130f',
        roughness: 0.92,
        metalness: 0.04,
      }),
      screenBounceUniforms,
    );
    const cleftSlateMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#1e2228',
        roughness: 0.88,
        metalness: 0.06,
      }),
      screenBounceUniforms,
    );
    const silverTravertineMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#9c968d',
        roughness: 0.62,
        metalness: 0.05,
      }),
      screenBounceUniforms,
    );
    const matteEspressoCofferMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#201713',
        roughness: 0.88,
        metalness: 0.03,
      }),
      screenBounceUniforms,
    );
    const espressoCofferPanelMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#16100d',
        roughness: 0.94,
        metalness: 0.02,
      }),
      screenBounceUniforms,
    );
    const espressoMachineBodyMat = new THREE.MeshStandardMaterial({
      color: '#181a1f',
      roughness: 0.28,
      metalness: 0.78,
    });
    const porcelainCupMat = new THREE.MeshStandardMaterial({
      color: '#efe8da',
      roughness: 0.18,
      metalness: 0.05,
    });
    const carbonFiberMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        map: carbonFiberMap || undefined,
        color: carbonFiberMap ? '#ffffff' : '#14171f',
        roughness: 0.34,
        metalness: 0.56,
      }),
      screenBounceUniforms,
    );
    const matteTitaniumMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#0c0e13',
        roughness: 0.32,
        metalness: 0.86,
      }),
      screenBounceUniforms,
    );
    const translucentQuartzMat = new THREE.MeshStandardMaterial({
      color: '#e6f7ff',
      emissive: '#d8f3ff',
      emissiveIntensity: 0.45,
      roughness: 0.14,
      metalness: 0.08,
    });
    const matteIndigoBaffleMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#1a2048',
        roughness: 0.96,
        metalness: 0.01,
      }),
      screenBounceUniforms,
    );
    const matteIndigoDeepMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#111636',
        roughness: 0.97,
        metalness: 0.01,
      }),
      screenBounceUniforms,
    );
    const laserPodBodyMat = new THREE.MeshStandardMaterial({
      color: '#10131a',
      roughness: 0.34,
      metalness: 0.72,
    });

    return {
      carpetMat,
      wallMat,
      acousticPanelMat,
      ceilingMat,
      trimMetalMat,
      nosingMat,
      stageMat,
      darkStoneMat,
      darkBronzeTrimMat,
      speakerMat,
      doorMat,
      exitSignMat,
      entranceSignMat,
      posterMat,
      curtainMat,
      pearlSlateWallMat,
      bronzeBaffleMat,
      titaniumBaffleMat,
      obsidianRevealMat,
      brushedAluminumMat,
      temperedGlassMat,
      extinguisherMat,
      boothInteriorWallMat,
      boothFloorMat,
      boothGlassMat,
      projectorBodyMat,
      projectorChromeMat,
      honedDarkStoneMat,
      travertineMat,
      champagneBrassMat,
      walnutCofferMat,
      charcoalWoolRugMat,
      smokedGlassMat,
      wineBottleMat,
      amberDecanterMat,
      brushedTitaniumMat,
      ribbedLimestoneMat,
      espressoTrimMat,
      cleftSlateMat,
      silverTravertineMat,
      matteEspressoCofferMat,
      espressoCofferPanelMat,
      espressoMachineBodyMat,
      porcelainCupMat,
      carbonFiberMat,
      matteTitaniumMat,
      translucentQuartzMat,
      matteIndigoBaffleMat,
      matteIndigoDeepMat,
      laserPodBodyMat,
    };
  }, [textures, carbonFiberMap, tBarCeilingGridMap, environmentProfile, sideLightStyle, ceilingLightStyle, screenBounceUniforms]);

  useEffect(() => {
    return () => {
      Object.values(materials).forEach((m) => m.dispose());
    };
  }, [materials]);

  // Step lights remain ALWAYS ON during the entire show
  materials.posterMat.emissiveIntensity = 0.02 + lightFactor * 0.46;
  materials.entranceSignMat.opacity = 0.08 + lightFactor * 0.92;
  materials.translucentQuartzMat.emissiveIntensity = 0.34 + lightFactor * 0.64;

  const stepEmissiveIntensity = 1.45;
  const rowBadgeOpacity = 0.65 + lightFactor * 0.35;
  const wallAccentIntensity = lightFactor * 1.55;
  const ceilingPuckIntensity = lightFactor * 2.2;
  const boothWorkLightIntensity = 0.06 + lightFactor * 0.52;
  const lensEmissiveIntensity = lightFactor < 0.25 ? 0.58 : 0.28;

  const frontZ = -L / 2;
  const backZ = L / 2;
  const topTierY = (seatingRows - 1) * rowElevationStep;

  const tiers = useMemo(() => {
    const arr: { row: number; y: number; z: number; depth: number; height: number }[] = [];
    for (let r = 0; r < seatingRows; r++) {
      const y = r * rowElevationStep;
      const z = firstRowZ + r * rowSpacing;
      const depth = r === seatingRows - 1 ? backZ - (z - rowSpacing * 0.5) + 0.5 : rowSpacing;
      const centerZ = r === seatingRows - 1 ? (z - rowSpacing * 0.5 + backZ) / 2 : z;
      arr.push({
        row: r,
        y,
        z: centerZ,
        depth,
        height: Math.max(0.18, y + 0.12),
      });
    }
    return arr;
  }, [seatingRows, rowElevationStep, firstRowZ, rowSpacing, backZ]);

  const wallBayZs = useMemo(() => {
    const count = Math.max(3, wallBayCount);
    const span = L * 0.72;
    const start = -L * 0.34;
    return Array.from({ length: count }, (_, i) => start + (i / (count - 1)) * span);
  }, [L, wallBayCount]);

  const ceilingLightPositions = useMemo(() => {
    const pts: [number, number][] = [];
    const xs = [-W * 0.28, 0, W * 0.28];
    const zs = [-L * 0.28, 0, L * 0.28];
    xs.forEach((x) => {
      zs.forEach((z) => {
        pts.push([x, z]);
      });
    });
    return pts;
  }, [W, L]);

  const starPoints = useMemo(() => {
    const pts: [number, number][] = [];
    const cols = 6;
    const rows = 5;
    for (let ix = 0; ix < cols; ix++) {
      for (let iz = 0; iz < rows; iz++) {
        const u = (ix + 0.5) / cols - 0.5;
        const v = (iz + 0.5) / rows - 0.5;
        const jitterX = Math.sin(ix * 2.1 + iz * 1.7) * 0.55;
        const jitterZ = Math.cos(ix * 1.3 + iz * 2.9) * 0.55;
        pts.push([u * (W - 3.0) + jitterX, v * (L - 4.0) + jitterZ]);
      }
    }
    return pts;
  }, [W, L]);

  const champagneStarField = useMemo(() => {
    const pts: [number, number][] = [];
    const cols = 8;
    const rows = 6;
    const spanX = W * 0.36;
    const spanZ = L * 0.24;
    for (let ix = 0; ix < cols; ix++) {
      for (let iz = 0; iz < rows; iz++) {
        const u = (ix + 0.5) / cols - 0.5;
        const v = (iz + 0.5) / rows - 0.5;
        const jx = Math.sin(ix * 3.1 + iz * 1.9) * 0.22;
        const jz = Math.cos(ix * 2.3 + iz * 2.7) * 0.18;
        pts.push([u * spanX + jx, v * spanZ + jz]);
      }
    }
    return pts;
  }, [W, L]);

  // Real 3D Recessed Projection Room Dimensions (aligned to boothY)
  const boothY = isIce
    ? Math.min(H - 1.65, Math.max(10.35, topTierY + 5.6))
    : Math.min(H - 1.4, topTierY + 3.25);
  const boothWinW = Math.min(4.8, W * 0.42);
  const boothWinH = Math.min(1.42, H * 0.24);
  const winTop = Math.min(H - 0.28, boothY + boothWinH / 2);
  const winBot = Math.max(0.25, boothY - boothWinH / 2);
  const actualWinH = Math.max(0.6, winTop - winBot);
  const winMidY = (winTop + winBot) / 2;

  const boothChamberW = boothWinW + 1.6;
  const boothFloorY = winBot - 0.42;
  const boothCeilY = Math.min(H + 0.4, winTop + 0.65);
  const boothChamberH = Math.max(1.8, boothCeilY - boothFloorY);
  const boothMidY = (boothFloorY + boothCeilY) / 2;
  const boothDepth = 2.7;
  const boothCenterZ = backZ + boothDepth / 2 - 0.05;

  const sideBackWallW = Math.max(0.5, (W - boothWinW) / 2);

  return (
    <group>
      {/* Flat lower auditorium floor from front wall to first row */}
      <mesh
        position={[0, -0.05, (frontZ + firstRowZ) / 2]}
        receiveShadow
        material={materials.carpetMat}
      >
        <boxGeometry args={[W, 0.1, Math.abs(firstRowZ - frontZ) + 1.5]} />
      </mesh>

      {/* Stepped Seating Tiers + Aluminum Stair Nosing + Micro Step LEDs + Row Badges */}
      {tiers.map((tier) => (
        <group key={`tier-${tier.row}`}>
          <mesh
            position={[0, tier.y - tier.height / 2, tier.z]}
            receiveShadow
            castShadow
            material={materials.carpetMat}
          >
            <boxGeometry args={[W - 0.1, tier.height, tier.depth]} />
          </mesh>

          {/* Curved Tier Riser Arc Rim & Warm-Gold Curved Step Accents (ICE Immersive Cobalt Grand) */}
          {isIceCobalt &&
            Array.from({ length: 9 }, (_, si) => {
              const u = si / 8;
              const segX = THREE.MathUtils.lerp(-W * 0.44, W * 0.44, u);
              const normX = Math.abs(segX) / (W * 0.44);
              const arcDepth = Math.min(0.42, rowSpacing * 0.28);
              const curveZ = tier.z - tier.depth / 2 + 0.04 + arcDepth * 0.28 - arcDepth * normX * normX;
              const segRotY = Math.atan2(2 * arcDepth * normX * Math.sign(segX), W * 0.44) * 0.65;
              return (
                <mesh
                  key={`cobalt-curved-edge-${tier.row}-${si}`}
                  position={[segX, tier.y - 0.04, curveZ]}
                  rotation={[0, -segRotY, 0]}
                  material={materials.espressoTrimMat}
                >
                  <boxGeometry args={[W * 0.115, 0.09, 0.18]} />
                </mesh>
              );
            })}

          {/* Continuous Linear LED Safety Strip Along Every Tiered Step Edge (Neon-Blue on Multiplex ScreenX, Golden-Yellow on Mandap Heritage 2D, Neon-Purple on Obsidian Wave 550, Warm-Gold on Sylva Moss 250) */}
          {(isMultiplexScreenX || isMandap2d || isParametricObsidian || isBiophilicMoss) && (
            <group position={[0, tier.y + 0.014, tier.z - tier.depth / 2 + 0.026]}>
              <mesh position={[0, -0.008, 0]} material={isBiophilicMoss ? materials.espressoTrimMat : materials.nosingMat}>
                <boxGeometry args={[W - 0.56, 0.018, 0.048]} />
              </mesh>
              <mesh position={[0, 0.003, -0.004]}>
                <boxGeometry args={[W - 0.64, 0.016, 0.024]} />
                <meshStandardMaterial
                  color={isMandap2d ? '#ca8a04' : isBiophilicMoss ? '#d97706' : isParametricObsidian ? '#9333ea' : '#1d4ed8'}
                  emissive={lightingProfile.stepLightColor}
                  emissiveIntensity={stepEmissiveIntensity * 1.18}
                  toneMapped={false}
                  roughness={0.18}
                />
              </mesh>
            </group>
          )}

          {aisleXs.map((ax, aIdx) => (
            <React.Fragment key={`step-${tier.row}-${aIdx}`}>
              <mesh
                position={[ax, tier.y + 0.005, tier.z - tier.depth / 2 + 0.03]}
                material={
                  isPrivateChampagne || isPrivateVolcanic
                    ? materials.walnutCofferMat
                    : isDolbyVeil
                      ? materials.espressoTrimMat
                      : isScreenX || isParametricObsidian
                        ? materials.matteTitaniumMat
                        : isMandap2d || isBiophilicMoss
                          ? materials.darkBronzeTrimMat
                          : materials.nosingMat
                }
              >
                <boxGeometry args={[isPrivateChampagne || isPrivateVolcanic || isDolbyVeil ? 1.5 : isScreenX || isMandap2d || isParametricObsidian || isBiophilicMoss ? 1.28 : 0.96, 0.022, 0.06]} />
              </mesh>

              {/* Always-on recessed safety step LED line */}
              <mesh
                position={[
                  ax,
                  isPrivateChampagne || isPrivateVolcanic ? tier.y - 0.004 : tier.y + 0.017,
                  tier.z - tier.depth / 2 + (isPrivateChampagne || isPrivateVolcanic ? 0.018 : 0.026),
                ]}
              >
                <boxGeometry args={[isDolbyVeil ? 1.44 : isPrivateChampagne || isPrivateVolcanic ? 1.36 : isScreenX || isBiophilicMoss ? 1.14 : 0.88, isDolbyVeil ? 0.008 : 0.014, isDolbyVeil ? 0.011 : 0.024]} />
                <meshStandardMaterial
                  color={lightingProfile.stepLightColor}
                  emissive={lightingProfile.stepLightColor}
                  emissiveIntensity={isDolbyVeil ? stepEmissiveIntensity * 1.45 : stepEmissiveIntensity}
                  toneMapped={false}
                  roughness={0.22}
                />
              </mesh>
              {(isPrivateChampagne || isPrivateVolcanic) && tier.row === 1 && (
                /* Mid-riser recessed step-light bar along wide aisle step face */
                <group position={[ax, tier.y - rowElevationStep * 0.5, tier.z - tier.depth / 2 - 0.01]}>
                  <mesh material={materials.walnutCofferMat}>
                    <boxGeometry args={[1.52, 0.05, 0.03]} />
                  </mesh>
                  <mesh position={[0, -0.015, -0.005]}>
                    <boxGeometry args={[1.32, 0.016, 0.02]} />
                    <meshStandardMaterial
                      color={lightingProfile.stepLightColor}
                      emissive={lightingProfile.stepLightColor}
                      emissiveIntensity={stepEmissiveIntensity * 0.9}
                      toneMapped={false}
                      roughness={0.25}
                    />
                  </mesh>
                </group>
              )}

              {!isPrivateVolcanic && !isPrivateChampagne && !isScreenX && rowMarkerTextures[tier.row] && (
                <mesh
                  position={[ax, tier.y + 0.011, firstRowZ + tier.row * rowSpacing]}
                  rotation={[-Math.PI / 2, 0, 0]}
                >
                  <planeGeometry args={[0.3, 0.3]} />
                  <meshBasicMaterial
                    map={rowMarkerTextures[tier.row]}
                    transparent
                    opacity={rowBadgeOpacity}
                  />
                </mesh>
              )}

              {/* Compact aisle safety handrail posts (brushed aluminum on 4DX Thunder Arena, dark metallic on Crimson/Arctic) */}
              {(isCrimson4dx || isArctic4dx || isThunder4dx || (rowElevationStep >= 0.4 && tier.row >= 2 && tier.row % 2 === 0)) && (
                <group position={[ax + (ax >= 0 ? 0.52 : -0.52), tier.y, tier.z - tier.depth / 2 + 0.14]}>
                  <mesh
                    position={[0, 0.38, 0]}
                    material={
                      isThunder4dx
                        ? materials.brushedAluminumMat
                        : isCrimson4dx || isArctic4dx
                          ? materials.nosingMat
                          : materials.trimMetalMat
                    }
                  >
                    <cylinderGeometry args={[0.022, 0.024, 0.76, 10]} />
                  </mesh>
                  <mesh
                    position={[0, 0.015, 0]}
                    material={isThunder4dx ? materials.brushedAluminumMat : materials.nosingMat}
                  >
                    <cylinderGeometry args={[0.048, 0.052, 0.03, 12]} />
                  </mesh>
                  <mesh
                    position={[0, 0.76, rowSpacing * 0.48]}
                    rotation={[Math.atan2(rowElevationStep, rowSpacing), 0, 0]}
                    material={
                      isThunder4dx
                        ? materials.brushedAluminumMat
                        : isCrimson4dx || isArctic4dx
                          ? materials.nosingMat
                          : materials.trimMetalMat
                    }
                  >
                    <boxGeometry args={[0.038, 0.03, Math.hypot(rowSpacing, rowElevationStep) * 1.02]} />
                  </mesh>
                  {(isCrimson4dx || isArctic4dx) && (
                    <mesh position={[0, 0.46, rowSpacing * 0.48]} rotation={[Math.atan2(rowElevationStep, rowSpacing), 0, 0]} material={materials.trimMetalMat}>
                      <boxGeometry args={[0.02, 0.018, Math.hypot(rowSpacing, rowElevationStep) * 1.02]} />
                    </mesh>
                  )}
                  {isThunder4dx && (
                    <mesh
                      position={[0, 0.44, rowSpacing * 0.48]}
                      rotation={[Math.atan2(rowElevationStep, rowSpacing), 0, 0]}
                      material={materials.temperedGlassMat}
                    >
                      <boxGeometry args={[0.016, 0.52, Math.hypot(rowSpacing, rowElevationStep) * 0.94]} />
                    </mesh>
                  )}
                </group>
              )}
              {/* Aisle Edge Low-Intensity Step Navigation Strip Lights */}
              {(isIce ||
                isModernMultiplex ||
                sideLightStyle === 'imax_cobalt_wave' ||
                isCrimson4dx ||
                isArctic4dx ||
                isThunder4dx ||
                isPrivateVolcanic ||
                isScreenX ||
                isMandap2d ||
                isParametricObsidian ||
                isDolbyVeil) &&
                [
                  isDolbyVeil ? -0.72 : isPrivateVolcanic || isMandap2d ? -0.66 : isMultiplexScreenX || isParametricObsidian ? -0.64 : isScreenX ? -0.58 : -0.46,
                  isDolbyVeil ? 0.72 : isPrivateVolcanic || isMandap2d ? 0.66 : isMultiplexScreenX || isParametricObsidian ? 0.64 : isScreenX ? 0.58 : 0.46,
                ].map((ex, ei) => (
                  <mesh
                    key={`aisle-edge-${tier.row}-${aIdx}-${ei}`}
                    position={[ax + ex, tier.y + 0.015, tier.z]}
                  >
                    <boxGeometry args={[isDolbyVeil ? 0.011 : isMultiplexScreenX || isMandap2d || isParametricObsidian ? 0.026 : isScreenX ? 0.016 : 0.026, isDolbyVeil ? 0.008 : 0.014, Math.max(0.4, tier.depth - 0.02)]} />
                    <meshStandardMaterial
                      color={lightingProfile.stepLightColor}
                      emissive={lightingProfile.stepLightColor}
                      emissiveIntensity={stepEmissiveIntensity * (isDolbyVeil ? 1.45 : isMultiplexScreenX || isMandap2d || isParametricObsidian ? 1.15 : isScreenX ? 0.72 : 0.94)}
                      toneMapped={false}
                      roughness={0.22}
                    />
                  </mesh>
                ))}
            </React.Fragment>
          ))}

          {/* Thick Hand-Tufted Charcoal Wool Rug Layered Cleanly on Lounge Tiers (Champagne Ivory Lounge) */}
          {isPrivateChampagne && (
            <group position={[0, tier.y + 0.011, tier.z - (tier.row === 1 ? 0.45 : 0)]}>
              <mesh receiveShadow material={materials.charcoalWoolRugMat}>
                <boxGeometry
                  args={[
                    5.65,
                    0.022,
                    tier.row === 1 ? Math.max(1.8, tier.depth - 1.35) : tier.depth - 0.24,
                  ]}
                />
              </mesh>
              {/* Subtle woven charcoal-bronze border piping around wool rug */}
              <mesh position={[0, -0.003, 0]} material={materials.darkBronzeTrimMat}>
                <boxGeometry
                  args={[
                    5.74,
                    0.016,
                    tier.row === 1 ? Math.max(1.88, tier.depth - 1.27) : tier.depth - 0.16,
                  ]}
                />
              </mesh>
            </group>
          )}

          {/* Dark Metallic Safety Guardrails Along Stepped Stadium Tier Drop-Edges (Crimson Velocity & Arctic Storm) */}
          {(isCrimson4dx || isArctic4dx) &&
            tier.row >= 1 &&
            aisleXs.length === 2 &&
            [
              { x0: -W / 2 + 0.58, x1: aisleXs[0] - 0.58 },
              { x0: aisleXs[0] + 0.58, x1: aisleXs[1] - 0.58 },
              { x0: aisleXs[1] + 0.58, x1: W / 2 - 0.58 },
            ].map((span, si) => {
              const railW = Math.max(0.8, span.x1 - span.x0);
              const railCx = (span.x0 + span.x1) * 0.5;
              const railZ = tier.z - tier.depth / 2 + 0.08;
              return (
                <group key={`tier-guard-${tier.row}-${si}`} position={[railCx, tier.y, railZ]}>
                  {/* Top & Mid Horizontal Dark Metallic Safety Rails */}
                  <mesh position={[0, 0.44, 0]} material={materials.nosingMat}>
                    <boxGeometry args={[railW, 0.032, 0.036]} />
                  </mesh>
                  <mesh position={[0, 0.24, 0]} material={materials.trimMetalMat}>
                    <boxGeometry args={[railW, 0.022, 0.024]} />
                  </mesh>
                  {/* Vertical Steel Stanchions */}
                  {[-railW * 0.48, 0, railW * 0.48].map((px, pi) => (
                    <group key={`stanchion-${pi}`} position={[px, 0, 0]}>
                      <mesh position={[0, 0.22, 0]} material={materials.nosingMat}>
                        <cylinderGeometry args={[0.02, 0.022, 0.45, 10]} />
                      </mesh>
                      <mesh position={[0, 0.012, 0]} material={materials.trimMetalMat}>
                        <cylinderGeometry args={[0.044, 0.048, 0.024, 10]} />
                      </mesh>
                    </group>
                  ))}
                </group>
              );
            })}

          {/* Clear Tempered-Glass Safety Barriers with Brushed Aluminum Base Shoes (4DX Thunder Arena) */}
          {isThunder4dx &&
            tier.row >= 1 &&
            aisleXs.length === 2 &&
            [
              { x0: -W / 2 + 0.58, x1: aisleXs[0] - 0.58 },
              { x0: aisleXs[0] + 0.58, x1: aisleXs[1] - 0.58 },
              { x0: aisleXs[1] + 0.58, x1: W / 2 - 0.58 },
            ].map((span, si) => {
              const railW = Math.max(0.8, span.x1 - span.x0);
              const railCx = (span.x0 + span.x1) * 0.5;
              const railZ = tier.z - tier.depth / 2 + 0.08;
              return (
                <group key={`tier-glass-barrier-${tier.row}-${si}`} position={[railCx, tier.y, railZ]}>
                  {/* Brushed Aluminum Floor Base Shoe */}
                  <mesh position={[0, 0.032, 0]} material={materials.brushedAluminumMat}>
                    <boxGeometry args={[railW, 0.064, 0.056]} />
                  </mesh>
                  {/* Clear Tempered-Glass Safety Panel */}
                  <mesh position={[0, 0.34, 0]} material={materials.temperedGlassMat}>
                    <boxGeometry args={[railW - 0.04, 0.58, 0.018]} />
                  </mesh>
                  {/* Slim Brushed Aluminum Top Cap Rail */}
                  <mesh position={[0, 0.64, 0]} material={materials.brushedAluminumMat}>
                    <boxGeometry args={[railW, 0.028, 0.042]} />
                  </mesh>
                  {/* Minimal Brushed Aluminum End & Center Stanchions */}
                  {[-railW * 0.48, 0, railW * 0.48].map((px, pi) => (
                    <mesh key={`glass-post-${pi}`} position={[px, 0.32, 0]} material={materials.brushedAluminumMat}>
                      <boxGeometry args={[0.034, 0.64, 0.046]} />
                    </mesh>
                  ))}
                </group>
              );
            })}
        </group>
      ))}

      {/* Clean Flush Front Deck with Concealed Floor Fog Vents (4DX Thunder Arena) */}
      {isThunder4dx && (
        <group position={[0, 0.006, screenPosition[2] + 0.95]}>
          <mesh receiveShadow material={materials.carpetMat}>
            <boxGeometry args={[W - 0.6, 0.012, 1.85]} />
          </mesh>
          {/* Concealed Flush Floor Fog Vent Grilles */}
          {[-W * 0.32, -W * 0.11, W * 0.11, W * 0.32].map((fx, fi) => (
            <group key={`flush-fog-vent-${fi}`} position={[fx, 0.008, 0.15]}>
              <mesh material={materials.brushedAluminumMat}>
                <boxGeometry args={[1.65, 0.008, 0.32]} />
              </mesh>
              <mesh position={[0, 0.005, 0]} material={materials.speakerMat}>
                <boxGeometry args={[1.55, 0.004, 0.24]} />
              </mesh>
            </group>
          ))}
        </group>
      )}

      {/* Low Front Fog-Machine Stage Riser (4DX Crimson Velocity & Arctic Storm) */}
      {(isCrimson4dx || isArctic4dx) && (
        <group position={[0, 0.13, screenPosition[2] + 0.92]}>
          <mesh receiveShadow material={materials.stageMat}>
            <boxGeometry args={[W - 1.2, 0.26, 1.7]} />
          </mesh>
          {/* Matte Gunmetal Edge Lip */}
          <mesh position={[0, 0.132, 0.84]} material={materials.nosingMat}>
            <boxGeometry args={[W - 1.2, 0.026, 0.06]} />
          </mesh>
          {/* Low-Profile Recessed Fog-Machine Emitter Housings & Nozzles */}
          {[-W * 0.32, -W * 0.11, W * 0.11, W * 0.32].map((fx, fi) => (
            <group key={`fog-emitter-${fi}`} position={[fx, 0.04, 0.86]}>
              <mesh material={materials.nosingMat}>
                <boxGeometry args={[1.05, 0.14, 0.12]} />
              </mesh>
              <mesh position={[0, 0, 0.062]} material={materials.speakerMat}>
                <planeGeometry args={[0.88, 0.095]} />
              </mesh>
              {/* Dual Recessed Fog Discharge Nozzles */}
              {[-0.24, 0.24].map((nx, ni) => (
                <mesh key={`fog-noz-${ni}`} position={[nx, 0.02, 0.075]} rotation={[Math.PI / 2, 0, 0]} material={materials.trimMetalMat}>
                  <cylinderGeometry args={[0.032, 0.042, 0.05, 12]} />
                </mesh>
              ))}
              {/* Subtle Themed Riser Indicator Strip */}
              <mesh position={[0, -0.055, 0.05]}>
                <boxGeometry args={[0.72, 0.016, 0.02]} />
                <meshStandardMaterial
                  color="#0a0c12"
                  emissive={fi % 2 === 0 ? lightingProfile.wallColor : lightingProfile.accentColor}
                  emissiveIntensity={lightFactor * 0.95}
                  roughness={0.25}
                />
              </mesh>
            </group>
          ))}
        </group>
      )}

      {/* Raised Front Stage Apron */}
      {!isIce &&
        !isScreenX &&
        !isZeroStageImax &&
        !isCrimson4dx &&
        !isArctic4dx &&
        !isThunder4dx &&
        !isDolbyFloating &&
        !isVolcanicCopper2d &&
        !isMandap2d &&
        !isParametricObsidian &&
        !isPrivateVolcanic &&
        !isPrivateChampagne && (
          <group
            position={[
              0,
              isArtDecoSunburst || isModernMultiplex ? 0.18 : 0.25,
              screenPosition[2] + 0.85,
            ]}
          >
            <mesh receiveShadow material={materials.stageMat}>
              <boxGeometry
                args={[W - 0.8, isArtDecoSunburst || isModernMultiplex ? 0.36 : 0.5, 1.9]}
              />
            </mesh>
            <mesh
              position={[0, isArtDecoSunburst || isModernMultiplex ? 0.182 : 0.252, 0.94]}
              material={materials.trimMetalMat}
            >
              <boxGeometry args={[W - 0.8, 0.03, 0.06]} />
            </mesh>
            {[-W * 0.28, 0, W * 0.28].map((gx, gi) => (
              <mesh key={`stage-vent-${gi}`} position={[gx, -0.02, 0.96]} material={materials.speakerMat}>
                <planeGeometry args={[2.2, 0.28]} />
              </mesh>
            ))}
            {[-1, 1].map((side) => (
              <group key={`stage-step-${side}`} position={[side * (W / 2 - 1.15), -0.1, 1.3]}>
                <mesh material={materials.stageMat} position={[0, 0.08, -0.18]}>
                  <boxGeometry args={[1.0, 0.32, 0.4]} />
                </mesh>
                <mesh material={materials.stageMat} position={[0, -0.04, 0.2]}>
                  <boxGeometry args={[1.0, 0.16, 0.4]} />
                </mesh>
              </group>
            ))}
          </group>
        )}

      {/* ICE Theater 1 (Flagship): Low Cantilevered Smoked-Glass & Brushed-Titanium Front Stage Riser */}
      {isIceFlagship && (
        <group position={[0, 0.14, screenPosition[2] + 0.72]}>
          {/* Recessed Brushed-Titanium Support Plinth */}
          <mesh position={[0, -0.04, -0.1]} receiveShadow material={materials.brushedTitaniumMat}>
            <boxGeometry args={[screenWidth * 0.92, 0.2, 1.05]} />
          </mesh>
          {/* Cantilevered Smoked-Glass Top Deck Overhanging Plinth */}
          <mesh position={[0, 0.09, 0.08]} receiveShadow material={materials.smokedGlassMat}>
            <boxGeometry args={[screenWidth * 0.96, 0.06, 1.35]} />
          </mesh>
          {/* Brushed-Titanium Front Perimeter Bezel */}
          <mesh position={[0, 0.09, 0.76]} material={materials.brushedTitaniumMat}>
            <boxGeometry args={[screenWidth * 0.96, 0.055, 0.035]} />
          </mesh>
          {/* Subtle Cyan-White Under-Cantilever Linear Wash */}
          <mesh position={[0, 0.055, 0.48]}>
            <boxGeometry args={[screenWidth * 0.88, 0.015, 0.04]} />
            <meshStandardMaterial
              color="#07111a"
              emissive={lightingProfile.wallColor}
              emissiveIntensity={lightFactor * 1.1}
              roughness={0.22}
            />
          </mesh>
        </group>
      )}

      {/* ICE Theater 2 (Cobalt Grand): Low Monolithic Ribbed-Limestone Front Stage Plinth */}
      {isIceCobalt && (
        <group position={[0, 0.16, screenPosition[2] + 0.78]}>
          {/* Monolithic Limestone Core Plinth */}
          <mesh receiveShadow material={materials.ribbedLimestoneMat}>
            <boxGeometry args={[screenWidth * 0.96, 0.32, 1.35]} />
          </mesh>
          {/* Matte-Espresso Top Shadow Cap */}
          <mesh position={[0, 0.166, 0]} material={materials.espressoTrimMat}>
            <boxGeometry args={[screenWidth * 0.96, 0.018, 1.37]} />
          </mesh>
          {/* Architectural Vertical Limestone Ribs Along Front Plinth Face */}
          {Array.from({ length: 28 }, (_, ri) => {
            const rx = THREE.MathUtils.lerp(-screenWidth * 0.46, screenWidth * 0.46, ri / 27);
            return (
              <mesh
                key={`limestone-rib-${ri}`}
                position={[rx, 0, 0.68]}
                material={materials.ribbedLimestoneMat}
              >
                <boxGeometry args={[0.14, 0.3, 0.045]} />
              </mesh>
            );
          })}
        </group>
      )}

      {/* ICE Theater 3 (Obsidian Amber): Low Cantilevered Cleft-Slate Front Stage Ledge */}
      {isIceAmber && (
        <group position={[0, 0.13, screenPosition[2] + 0.7]}>
          {/* Recessed Shadow Plinth */}
          <mesh position={[0, -0.045, -0.1]} receiveShadow material={materials.stageMat}>
            <boxGeometry args={[screenWidth * 0.88, 0.17, 0.98]} />
          </mesh>
          {/* Cantilevered Cleft-Slate Ledge Slab */}
          <mesh position={[0, 0.068, 0.06]} receiveShadow material={materials.cleftSlateMat}>
            <boxGeometry args={[screenWidth * 0.95, 0.075, 1.32]} />
          </mesh>
          {/* Subtle Emerald-Ivory Recessed Shadow-Gap Ledge Glow */}
          <mesh position={[0, 0.028, 0.46]}>
            <boxGeometry args={[screenWidth * 0.86, 0.014, 0.035]} />
            <meshStandardMaterial
              color="#081410"
              emissive={lightingProfile.wallColor}
              emissiveIntensity={lightFactor * 0.95}
              roughness={0.25}
            />
          </mesh>
        </group>
      )}

      {/* Low Monolithic Honed Silver-Travertine Media Hearth (Walnut Reserve Salon) */}
      {isPrivateVolcanic && (
        <group position={[0, 0.15, screenPosition[2] + 0.56]}>
          {/* Monolithic Honed Silver-Travertine Hearth Plinth */}
          <mesh receiveShadow castShadow material={materials.silverTravertineMat}>
            <boxGeometry args={[screenWidth * 0.86, 0.26, 0.96]} />
          </mesh>
          {/* Recessed Matte-Espresso Shadow Base */}
          <mesh position={[0, -0.125, 0.01]} material={materials.espressoTrimMat}>
            <boxGeometry args={[screenWidth * 0.82, 0.05, 0.88]} />
          </mesh>
          {/* Honed Silver-Travertine Top Hearth Cap Overhang */}
          <mesh position={[0, 0.14, 0.02]} receiveShadow material={materials.silverTravertineMat}>
            <boxGeometry args={[screenWidth * 0.88, 0.045, 1.02]} />
          </mesh>
          {/* Precision Brushed-Champagne Reveal Inlay */}
          <mesh position={[0, 0.125, 0.52]} material={materials.champagneBrassMat}>
            <boxGeometry args={[screenWidth * 0.86, 0.016, 0.02]} />
          </mesh>
          {/* Subtle Warm-Amber Under-Hearth Indirect Cove Glow */}
          <mesh position={[0, -0.115, 0.45]}>
            <boxGeometry args={[screenWidth * 0.8, 0.014, 0.03]} />
            <meshStandardMaterial
              color="#1c1106"
              emissive={lightingProfile.wallColor}
              emissiveIntensity={wallAccentIntensity * 0.9}
              roughness={0.24}
            />
          </mesh>
        </group>
      )}

      {/* Floating Dark Travertine Hearth Console with Indirect Warm-Amber Under-Glow (Champagne Ivory Lounge) */}
      {isPrivateChampagne && (
        <group position={[0, 0.52, screenPosition[2] + 0.48]}>
          {/* Cantilevered Floating Dark Travertine Hearth Slab */}
          <mesh receiveShadow castShadow material={materials.travertineMat}>
            <boxGeometry args={[screenWidth * 0.64, 0.2, 0.66]} />
          </mesh>
          {/* Brushed-Brass Front Edge Inlay */}
          <mesh position={[0, 0.06, 0.335]} material={materials.champagneBrassMat}>
            <boxGeometry args={[screenWidth * 0.635, 0.018, 0.016]} />
          </mesh>
          {/* Dark Recessed Cantilever Wall Cleat */}
          <mesh position={[0, -0.02, -0.22]} material={materials.stageMat}>
            <boxGeometry args={[screenWidth * 0.56, 0.12, 0.22]} />
          </mesh>
          {/* Indirect Warm-Amber Under-Hearth LED Cove Wash */}
          <mesh position={[0, -0.105, 0.18]}>
            <boxGeometry args={[screenWidth * 0.58, 0.018, 0.04]} />
            <meshStandardMaterial
              color="#1c1106"
              emissive={lightingProfile.wallColor}
              emissiveIntensity={wallAccentIntensity * 1.1}
              roughness={0.22}
            />
          </mesh>
        </group>
      )}

      {/* Completely Unblemished Matte-Black Stage & Deep Shadow Backing Under Floating Curved Dolby Vision Screen (Dolby Cobalt Veil 250) */}
      {isDolbyVeil && (
        <group>
          <mesh position={[0, 0.2, frontZ + 1.45]} receiveShadow material={materials.stageMat}>
            <boxGeometry args={[W - 0.36, 0.4, 2.9]} />
          </mesh>
          <mesh position={[0, H * 0.5, screenPosition[2] - 0.24]} material={materials.stageMat}>
            <boxGeometry args={[W - 0.18, H, 0.28]} />
          </mesh>
        </group>
      )}

      {/* Low Minimalist Dark-Stone Stage Riser (Grand Crimson Palace 2D Redesign) */}
      {isVolcanicCopper2d && (
        <group position={[0, 0.16, screenPosition[2] + 0.85]}>
          <mesh receiveShadow material={materials.darkStoneMat}>
            <boxGeometry args={[W - 0.8, 0.32, 1.8]} />
          </mesh>
          <mesh position={[0, 0.162, 0.88]} material={materials.darkBronzeTrimMat}>
            <boxGeometry args={[W - 0.8, 0.025, 0.055]} />
          </mesh>
          {[-1, 1].map((side) => (
            <group key={`stone-stage-step-${side}`} position={[side * (W / 2 - 1.15), -0.08, 1.18]}>
              <mesh material={materials.darkStoneMat} position={[0, 0.06, -0.16]}>
                <boxGeometry args={[1.0, 0.24, 0.36]} />
              </mesh>
              <mesh material={materials.darkStoneMat} position={[0, -0.02, 0.18]}>
                <boxGeometry args={[1.0, 0.12, 0.36]} />
              </mesh>
            </group>
          ))}
        </group>
      )}

      {/* Proscenium / Screen Front Wall */}
      <mesh position={[0, H / 2, frontZ]} receiveShadow material={materials.stageMat}>
        <boxGeometry args={[W, H, 0.4]} />
      </mesh>

      {/* Minimalist Matte/Satin-Black Acoustic Border Masking Framing Wide Screen */}
      {(isModernMultiplex || isCrimson4dx || isArctic4dx || isVolcanicCopper2d || isPrivateVolcanic) && (
        <group>
          {[-1, 1].map((side) => (
            <mesh
              key={`multiplex-mask-wing-${side}`}
              position={[side * (W / 2 - wingWidth / 2 - 0.04), H * 0.5, frontZ + 0.42]}
              material={materials.stageMat}
              receiveShadow
            >
              <boxGeometry args={[wingWidth + 0.2, H - 0.12, 0.46]} />
            </mesh>
          ))}
          {valanceHeight > 0.2 && (
            <mesh
              position={[0, H - valanceHeight / 2 - 0.04, frontZ + 0.44]}
              material={materials.stageMat}
              receiveShadow
            >
              <boxGeometry args={[screenWidth + 0.9, valanceHeight + 0.14, 0.48]} />
            </mesh>
          )}
          <mesh
            position={[0, (screenPosition[1] - screenHeight / 2) * 0.5 + 0.18, frontZ + 0.42]}
            material={materials.stageMat}
          >
            <boxGeometry
              args={[screenWidth + 0.5, Math.max(0.25, screenPosition[1] - screenHeight / 2), 0.42]}
            />
          </mesh>
        </group>
      )}

      {/* Matte Pearl-Slate Side Projection Walls Seamlessly Flanking Curved Edge-to-Edge Screen (4DX Thunder Arena) */}
      {isThunder4dx && (
        <group>
          {[-1, 1].map((side) => (
            <mesh
              key={`thunder-pearl-slate-wing-${side}`}
              position={[side * (W / 2 - wingWidth / 2 - 0.04), H * 0.5, frontZ + 0.44]}
              material={materials.pearlSlateWallMat}
              receiveShadow
            >
              <boxGeometry args={[wingWidth + 0.22, H - 0.1, 0.48]} />
            </mesh>
          ))}
          {valanceHeight > 0.18 && (
            <mesh
              position={[0, H - valanceHeight / 2 - 0.04, frontZ + 0.44]}
              material={materials.pearlSlateWallMat}
              receiveShadow
            >
              <boxGeometry args={[screenWidth + 0.6, valanceHeight + 0.12, 0.46]} />
            </mesh>
          )}
          <mesh
            position={[0, (screenPosition[1] - screenHeight / 2) * 0.5 + 0.1, frontZ + 0.4]}
            material={materials.obsidianRevealMat}
          >
            <boxGeometry
              args={[screenWidth + 0.4, Math.max(0.2, screenPosition[1] - screenHeight / 2), 0.42]}
            />
          </mesh>
        </group>
      )}

      {/* Slim Matte Obsidian Acoustic Perimeter Seal Around Wall-to-Wall Floor-to-Ceiling 1.90:1 IMAX Screen */}
      {isZeroStageImax && (
        <group>
          {[-1, 1].map((side) => (
            <mesh
              key={`imax-edge-seal-${side}`}
              position={[side * (W / 2 - 0.3), H * 0.5, frontZ + 0.52]}
              material={materials.stageMat}
            >
              <boxGeometry args={[0.48, H, 0.56]} />
            </mesh>
          ))}
          <mesh position={[0, H - 0.14, frontZ + 0.52]} material={materials.stageMat}>
            <boxGeometry args={[W, 0.28, 0.56]} />
          </mesh>
        </group>
      )}

      {/* Sculpted 3D Pleated Velvet Side Curtains Flanking the Giant Screen */}
      {!isIce &&
        !isScreenX &&
        !isModernMultiplex &&
        !isZeroStageImax &&
        !isCrimson4dx &&
        !isArctic4dx &&
        !isThunder4dx &&
        !isDolbyFloating &&
        !isVolcanicCopper2d &&
        !isMandap2d &&
        !isParametricObsidian &&
        !isBiophilicMoss &&
        !isPrivateVolcanic &&
        !isPrivateChampagne &&
        [-1, 1].map((side) => (
          <mesh
            key={`wing-${side}`}
            position={[side * (W / 2 - wingWidth / 2 - 0.18), H / 2, frontZ + 0.48]}
            geometry={curtainGeos.sideCurtainGeo}
            material={materials.curtainMat}
            receiveShadow
          />
        ))}

      {/* Motorized Deep-Espresso Velvet & Deep-Emerald Side Drapery + Brushed-Champagne/Brass Track Rails (Walnut Reserve & Champagne Ivory) */}
      {(isPrivateChampagne || isPrivateVolcanic) && (
        <group>
          {[-1, 1].map((side) => (
            <group key={`private-curtain-${side}`}>
              <mesh
                position={[side * (W / 2 - wingWidth / 2 - 0.12), H / 2 - 0.05, frontZ + 0.58]}
                geometry={curtainGeos.sideCurtainGeo}
                material={materials.curtainMat}
                receiveShadow
                castShadow
              />
              {/* Motorized Brushed-Champagne / Brass Drapery Track Rail */}
              <mesh
                position={[side * (W / 2 - wingWidth / 2 - 0.12), H - 0.22, frontZ + 0.58]}
                material={materials.champagneBrassMat}
              >
                <boxGeometry args={[wingWidth + 0.35, 0.065, 0.12]} />
              </mesh>
            </group>
          ))}
        </group>
      )}

      {/* Overhead Pleated Velvet Valance Header above Screen */}
      {!isIce &&
        !isScreenX &&
        !isModernMultiplex &&
        !isZeroStageImax &&
        !isCrimson4dx &&
        !isArctic4dx &&
        !isThunder4dx &&
        !isDolbyFloating &&
        !isVolcanicCopper2d &&
        !isMandap2d &&
        !isParametricObsidian &&
        !isBiophilicMoss &&
        !isPrivateVolcanic &&
        !isPrivateChampagne &&
        valanceHeight > 0.35 && (
          <mesh
            position={[0, H - valanceHeight / 2 - 0.1, frontZ + 0.56]}
            geometry={curtainGeos.valanceCurtainGeo}
            material={materials.curtainMat}
            receiveShadow
          />
        )}

      {/* Left & Right Side Walls */}
      <mesh position={[-W / 2, H / 2, 0]} receiveShadow material={materials.wallMat}>
        <boxGeometry args={[0.4, H, L]} />
      </mesh>
      <mesh position={[W / 2, H / 2, 0]} receiveShadow material={materials.wallMat}>
        <boxGeometry args={[0.4, H, L]} />
      </mesh>

      {/* Mandap Heritage 2D, Obsidian Wave 550 & Sylva Moss 250: Deep Acoustic Shadow Cavity Behind Floating Wall-to-Wall Primary 2D Screen */}
      {(isMandap2d || isParametricObsidian || isBiophilicMoss) && (
        <mesh
          position={[0, H * 0.5, screenPosition[2] - 0.22]}
          material={isParametricObsidian ? materials.stageMat : materials.espressoCofferPanelMat}
        >
          <boxGeometry args={[W - 0.2, H, 0.24]} />
        </mesh>
      )}

      {/* ScreenX Obsidian Panorama: Seamless Matte-Obsidian Dado, Frieze & Rear Wall Returns */}
      {isObsidianScreenX && (
        <group>
          {/* Front Center Matte-Obsidian Lower Dado Directly Under Front Titanium Screen Border */}
          <mesh
            position={[
              0,
              Math.max(0.18, screenPosition[1] - screenHeight * 0.5 - 0.11) * 0.5,
              screenPosition[2] - 0.04,
            ]}
            material={materials.obsidianRevealMat}
            receiveShadow
          >
            <boxGeometry
              args={[
                Math.max(4, screenWidth - Math.min(1.15, screenWidth * 0.06) * 2),
                Math.max(0.2, screenPosition[1] - screenHeight * 0.5 - 0.11),
                0.17,
              ]}
            />
          </mesh>
          {/* Front Center Matte-Obsidian Upper Acoustic Frieze Directly Above Front Titanium Screen Border */}
          {H - 0.18 - (screenPosition[1] + screenHeight * 0.5 + 0.11) > 0.08 && (
            <mesh
              position={[
                0,
                (screenPosition[1] + screenHeight * 0.5 + 0.11 + H - 0.18) * 0.5,
                screenPosition[2] - 0.04,
              ]}
              material={materials.obsidianRevealMat}
              receiveShadow
            >
              <boxGeometry
                args={[
                  Math.max(4, screenWidth - Math.min(1.15, screenWidth * 0.06) * 2),
                  H - 0.18 - (screenPosition[1] + screenHeight * 0.5 + 0.11),
                  0.17,
                ]}
              />
            </mesh>
          )}
          {[-1, 1].map((side) => (
            <group key={`screenx-wall-trim-${side}`}>
              <mesh
                position={[side * (screenWidth * 0.5 + 0.17), H * 0.5, -0.45]}
                material={materials.obsidianRevealMat}
                receiveShadow
              >
                <boxGeometry args={[0.16, H, L - 4.1]} />
              </mesh>
              <mesh
                position={[side * (screenWidth * 0.5 + 0.06), H * 0.5, backZ - 1.32]}
                material={materials.obsidianRevealMat}
                receiveShadow
              >
                <boxGeometry args={[0.14, H, 2.65]} />
              </mesh>
            </group>
          ))}
        </group>
      )}

      {/* ScreenX Commercial Multiplex 400: Clean Floating Front Backing + Rear 1/3 Deeply Sculpted Matte-Indigo 3D Acoustic Baffles */}
      {isMultiplexScreenX &&
        (() => {
          const frontSurfaceZ = screenPosition[2] + 0.028;
          const twoThirdEndZ = frontSurfaceZ + (L - 0.6) * (2 / 3);
          const frontSideLen = Math.max(4, twoThirdEndZ - frontSurfaceZ);
          const rearLen = Math.max(4, backZ - 0.18 - twoThirdEndZ);
          const rearCenterZ = twoThirdEndZ + rearLen * 0.5;
          const frontBotY = Math.max(0.12, screenPosition[1] - screenHeight * 0.5);
          const frontTopY = screenPosition[1] + screenHeight * 0.5;
          const upperGapH = Math.max(0.08, H - 0.2 - frontTopY);
          const cols = 6;
          const rows = 4;
          const colW = (rearLen - 0.6) / cols;
          const rowH = (H - 0.95) / rows;
          return (
            <group>
              {/* Deep matte-black shadow cavity behind floating 2.39:1 matte white screen */}
              <mesh position={[0, H * 0.5, screenPosition[2] - 0.18]} material={materials.stageMat}>
                <boxGeometry args={[W - 0.2, H, 0.24]} />
              </mesh>
              {/* Dark shadow void below front floating canvas */}
              <mesh position={[0, frontBotY * 0.5, screenPosition[2] - 0.08]} material={materials.stageMat}>
                <boxGeometry args={[W - 0.35, frontBotY, 0.18]} />
              </mesh>

              {/* Left & Right Front 2/3 Acoustic Screen Backing + Flush Lower Wall Skirt & Upper Reveal */}
              {[-1, 1].map((side) => (
                <group key={`sx400-side-${side}`}>
                  {/* Lightproof acoustic wall backing sitting cleanly behind the 2/3 side screen */}
                  <mesh
                    position={[side * (screenWidth * 0.5 + 0.12), H * 0.5, frontSurfaceZ + frontSideLen * 0.5]}
                    material={materials.stageMat}
                  >
                    <boxGeometry args={[0.18, H, frontSideLen]} />
                  </mesh>
                  {/* Flush matte-indigo lower acoustic dado beneath the side projection canvas */}
                  <mesh
                    position={[side * (screenWidth * 0.5 + 0.12), (frontBotY - 0.02) * 0.5, frontSurfaceZ + frontSideLen * 0.5]}
                    material={materials.matteIndigoDeepMat}
                    receiveShadow
                  >
                    <boxGeometry args={[0.24, Math.max(0.1, frontBotY - 0.02), frontSideLen]} />
                  </mesh>
                  {/* Subtle matte-black upper shadow reveal between side screen top edge and stepped tray ceiling */}
                  <mesh
                    position={[side * (screenWidth * 0.5 + 0.12), frontTopY + upperGapH * 0.5 + 0.01, frontSurfaceZ + frontSideLen * 0.5]}
                    material={materials.stageMat}
                  >
                    <boxGeometry args={[0.24, upperGapH, frontSideLen]} />
                  </mesh>

                  {/* Rear 1/3 Deeply Sculpted Matte-Indigo Base Backing Wall */}
                  <mesh
                    position={[side * (W * 0.5 - 0.22), H * 0.5, rearCenterZ]}
                    material={materials.matteIndigoDeepMat}
                    receiveShadow
                  >
                    <boxGeometry args={[0.16, H, rearLen]} />
                  </mesh>

                  {/* Rear 1/3 Deeply Sculpted Geometric Layout of Non-Reflective Matte-Indigo 3D Acoustic Baffles */}
                  {Array.from({ length: cols }, (_, ci) =>
                    Array.from({ length: rows }, (_, ri) => {
                      const bz = twoThirdEndZ + 0.3 + (ci + 0.5) * colW;
                      const by = 0.55 + (ri + 0.5) * rowH;
                      const isPrimary = (ci + ri) % 2 === 0;
                      const tiltY = side * (isPrimary ? 0.22 : -0.18);
                      const tiltX = ri % 2 === 0 ? 0.09 : -0.09;
                      const blockDepth = isPrimary ? 0.34 : 0.22;
                      return (
                        <group
                          key={`indigo-baffle-${side}-${ci}-${ri}`}
                          position={[side * (W * 0.5 - 0.34), by, bz]}
                          rotation={[tiltX, tiltY, 0]}
                        >
                          <mesh
                            material={isPrimary ? materials.matteIndigoBaffleMat : materials.matteIndigoDeepMat}
                            castShadow
                            receiveShadow
                          >
                            <boxGeometry args={[blockDepth, rowH * 0.86, colW * 0.84]} />
                          </mesh>
                          {/* Stepped inner geometric acoustic relief facet */}
                          <mesh
                            position={[-side * (blockDepth * 0.38), 0, 0]}
                            rotation={[0, side * 0.16, 0]}
                            material={materials.matteIndigoBaffleMat}
                            receiveShadow
                          >
                            <boxGeometry args={[0.12, rowH * 0.54, colW * 0.54]} />
                          </mesh>
                        </group>
                      );
                    }),
                  )}
                </group>
              ))}
            </group>
          );
        })()}

      {/* Rear Wall Built Around Real Recessed Projection Room Window Opening */}
      {/* Bottom rear wall */}
      <mesh position={[0, winBot / 2, backZ]} receiveShadow material={materials.wallMat}>
        <boxGeometry args={[W, winBot, 0.4]} />
      </mesh>
      {/* Top rear wall above booth window */}
      {H - winTop > 0.05 && (
        <mesh position={[0, (H + winTop) / 2, backZ]} receiveShadow material={materials.wallMat}>
          <boxGeometry args={[W, H - winTop, 0.4]} />
        </mesh>
      )}
      {/* Left & Right walls flanking the booth window */}
      <mesh
        position={[-(W + boothWinW) / 4, winMidY, backZ]}
        receiveShadow
        material={materials.wallMat}
      >
        <boxGeometry args={[sideBackWallW, actualWinH, 0.4]} />
      </mesh>
      <mesh
        position={[(W + boothWinW) / 4, winMidY, backZ]}
        receiveShadow
        material={materials.wallMat}
      >
        <boxGeometry args={[sideBackWallW, actualWinH, 0.4]} />
      </mesh>

      {/* Architectural Floor Skirting & Ceiling Crown Cornice Moldings (omitted on seamless ScreenX & Dolby Cobalt Veil continuous fabric veil walls) */}
      {!isScreenX &&
        !isDolbyVeil &&
        [-1, 1].map((side) => (
          <group key={`wall-molding-${side}`}>
            <mesh position={[side * (W / 2 - 0.22), 0.12, 0]} material={materials.nosingMat}>
              <boxGeometry args={[0.06, 0.24, L]} />
            </mesh>
            <mesh position={[side * (W / 2 - 0.24), H - 0.22, 0]} material={materials.trimMetalMat}>
              <boxGeometry args={[0.14, 0.12, L]} />
            </mesh>
          </group>
        ))}
      {!isScreenX && !isDolbyVeil && (
        <mesh position={[0, H - 0.22, backZ - 0.22]} material={materials.trimMetalMat}>
          <boxGeometry args={[W - 0.4, 0.12, 0.14]} />
        </mesh>
      )}

      {/* Symmetrical Vertical Acoustic Diffuser Slats on Rear Wall Flanking Booth & Doors (omitted in private luxury residential suites, ScreenX, Obsidian Wave 550, Sylva Moss 250 & Dolby Cobalt Veil) */}
      {!isPrivateVolcanic &&
        !isPrivateChampagne &&
        !isScreenX &&
        !isParametricObsidian &&
        !isBiophilicMoss &&
        !isDolbyVeil &&
        [-1, 1].map((side) =>
          Array.from({ length: 4 }, (_, si) => {
            const slatX = side * (boothWinW / 2 + 1.55 + si * 0.42);
            if (Math.abs(slatX) > W / 2 - 0.55) return null;
            return (
              <mesh
                key={`rear-diffuser-${side}-${si}`}
                position={[slatX, H * 0.52, backZ - 0.22]}
                material={materials.acousticPanelMat}
              >
                <boxGeometry args={[0.12, H * 0.72, 0.07]} />
              </mesh>
            );
          }),
        )}

      {/* Rear Cinema Entrance Double Doors / ICE Light-Trap Vomitory Entry Corridor */}
      {!isPrivateVolcanic && !isPrivateChampagne && !isObsidianScreenX && (
        <group position={[0, Math.min(winBot - 1.35, topTierY + 1.15), backZ - 0.24]}>
          <mesh material={materials.trimMetalMat}>
            <boxGeometry args={[2.5, 2.45, 0.14]} />
          </mesh>
          <mesh position={[-0.58, 0, 0.04]} material={materials.doorMat}>
            <boxGeometry args={[1.1, 2.28, 0.08]} />
          </mesh>
          <mesh position={[0.58, 0, 0.04]} material={materials.doorMat}>
            <boxGeometry args={[1.1, 2.28, 0.08]} />
          </mesh>
          <mesh position={[-0.58, -0.05, 0.1]} material={materials.trimMetalMat}>
            <boxGeometry args={[0.7, 0.06, 0.05]} />
          </mesh>
          <mesh position={[0.58, -0.05, 0.1]} material={materials.trimMetalMat}>
            <boxGeometry args={[0.7, 0.06, 0.05]} />
          </mesh>
          <mesh position={[0, 1.44, 0.05]} material={materials.entranceSignMat}>
            <planeGeometry args={[1.15, 0.3]} />
          </mesh>
          {/* Light-Trap Dark Acoustic Vomitory Vestibule Hood & Side Baffles for ICE Theater */}
          {isIce && (
            <group position={[0, 0, -0.34]}>
              <mesh position={[-1.42, 0, 0]} material={materials.stageMat}>
                <boxGeometry args={[0.18, 2.55, 0.72]} />
              </mesh>
              <mesh position={[1.42, 0, 0]} material={materials.stageMat}>
                <boxGeometry args={[0.18, 2.55, 0.72]} />
              </mesh>
              <mesh position={[0, 1.28, 0]} material={materials.stageMat}>
                <boxGeometry args={[3.02, 0.16, 0.72]} />
              </mesh>
              {/* Angled inner side light-trap fins */}
              {[-1, 1].map((side) => (
                <mesh
                  key={`trap-fin-${side}`}
                  position={[side * 1.12, 0, -0.26]}
                  rotation={[0, side * 0.42, 0]}
                  material={materials.stageMat}
                >
                  <boxGeometry args={[0.52, 2.42, 0.1]} />
                </mesh>
              ))}
            </group>
          )}
          {!isMultiplexScreenX &&
            !isParametricObsidian &&
            !isBiophilicMoss &&
            !isDolbyVeil &&
            [-1, 1].map((pside) => (
              <group key={`rear-poster-${pside}`} position={[pside * Math.min(2.25, W * 0.22), 0.12, 0.04]}>
                <mesh material={materials.trimMetalMat}>
                  <boxGeometry args={[0.96, 1.36, 0.06]} />
                </mesh>
                <mesh position={[0, 0, 0.04]} material={materials.posterMat}>
                  <planeGeometry args={[0.84, 1.22]} />
                </mesh>
              </group>
            ))}
        </group>
      )}

      {/* Walnut Reserve Salon: Sleek Backlit Smoked-Glass Wine & Espresso Bar Built Into Rear Corner + Concealed Entry Door */}
      {isPrivateVolcanic && (
        <group>
          {/* Sleek Residential American Walnut Acoustic Entry Door (Rear-Left) */}
          <group position={[-W * 0.3, topTierY + 1.14, backZ - 0.24]}>
            <mesh material={materials.champagneBrassMat}>
              <boxGeometry args={[1.38, 2.34, 0.12]} />
            </mesh>
            <mesh position={[0, 0, 0.04]} material={materials.walnutCofferMat}>
              <boxGeometry args={[1.22, 2.22, 0.07]} />
            </mesh>
            <mesh position={[0.45, -0.04, 0.095]} material={materials.champagneBrassMat}>
              <boxGeometry args={[0.04, 0.36, 0.04]} />
            </mesh>
          </group>

          {/* Sleek Backlit Smoked-Glass Wine & Espresso Bar (Rear-Right Corner) */}
          <group position={[W / 2 - 1.56, topTierY, backZ - 0.44]}>
            {/* American Walnut & Matte-Espresso Lower Bar Cabinetry */}
            <mesh position={[0, 0.44, 0]} material={materials.matteEspressoCofferMat} castShadow receiveShadow>
              <boxGeometry args={[2.35, 0.88, 0.6]} />
            </mesh>
            {/* Honed Silver-Travertine Espresso Bar Countertop */}
            <mesh position={[0, 0.905, -0.02]} material={materials.silverTravertineMat} castShadow receiveShadow>
              <boxGeometry args={[2.44, 0.065, 0.66]} />
            </mesh>
            {/* Built-In Under-Counter Smoked-Glass Wine Chiller */}
            <mesh position={[-0.6, 0.44, -0.3]} material={materials.smokedGlassMat}>
              <boxGeometry args={[0.88, 0.68, 0.03]} />
            </mesh>
            {/* Under-Counter Warm Wine Chiller Glow Strip */}
            <mesh position={[-0.6, 0.74, -0.26]}>
              <boxGeometry args={[0.78, 0.016, 0.03]} />
              <meshStandardMaterial color="#2a1d0c" emissive="#f5b041" emissiveIntensity={0.45 + wallAccentIntensity * 0.55} />
            </mesh>

            {/* Countertop Commercial-Grade Espresso Machine & Demitasse Cups */}
            <group position={[0.56, 0.94, -0.04]}>
              {/* Matte-Espresso & Steel Machine Chassis */}
              <mesh position={[0, 0.19, 0.06]} material={materials.espressoMachineBodyMat}>
                <boxGeometry args={[0.46, 0.38, 0.34]} />
              </mesh>
              {/* Brushed Chrome Front Group Panel & Drip Tray */}
              <mesh position={[0, 0.24, -0.115]} material={materials.brushedAluminumMat}>
                <boxGeometry args={[0.44, 0.2, 0.04]} />
              </mesh>
              <mesh position={[0, 0.025, -0.14]} material={materials.brushedAluminumMat}>
                <boxGeometry args={[0.44, 0.045, 0.14]} />
              </mesh>
              {/* Group Heads & Portafilters */}
              {[-0.1, 0.1].map((gx, gi) => (
                <group key={`espresso-group-${gi}`} position={[gx, 0.2, -0.16]}>
                  <mesh material={materials.brushedAluminumMat}>
                    <cylinderGeometry args={[0.032, 0.032, 0.05, 12]} />
                  </mesh>
                  <mesh position={[0, -0.02, -0.055]} rotation={[Math.PI / 2, 0, 0]} material={materials.walnutCofferMat}>
                    <cylinderGeometry args={[0.01, 0.012, 0.09, 10]} />
                  </mesh>
                </group>
              ))}
              {/* Porcelain Espresso Cups & Saucers on Silver-Travertine Counter */}
              {[-0.36, -0.24].map((cx, ci) => (
                <group key={`espresso-cup-${ci}`} position={[cx, 0.025, -0.1]}>
                  <mesh material={materials.porcelainCupMat}>
                    <cylinderGeometry args={[0.035, 0.026, 0.048, 12]} />
                  </mesh>
                  <mesh position={[0, -0.022, 0]} material={materials.porcelainCupMat}>
                    <cylinderGeometry args={[0.052, 0.042, 0.008, 12]} />
                  </mesh>
                </group>
              ))}
            </group>

            {/* Upper Backlit Smoked-Glass Wine Display Vitrine */}
            <mesh position={[0, 1.84, 0.06]} material={materials.walnutCofferMat}>
              <boxGeometry args={[2.32, 1.24, 0.42]} />
            </mesh>
            {/* Warm-Amber Backlit Glass Vitrine Backplane */}
            <mesh position={[0, 1.84, -0.13]}>
              <planeGeometry args={[2.12, 1.08]} />
              <meshStandardMaterial
                color="#2b1e10"
                emissive="#f5b041"
                emissiveIntensity={0.44 + wallAccentIntensity * 0.56}
                roughness={0.3}
              />
            </mesh>
            {/* Champagne-Brass Vertical Vitrine Mullions */}
            {[-1.06, -0.35, 0.35, 1.06].map((mx, mi) => (
              <mesh key={`walnut-bar-mullion-${mi}`} position={[mx, 1.84, -0.17]} material={materials.champagneBrassMat}>
                <boxGeometry args={[0.026, 1.18, 0.028]} />
              </mesh>
            ))}
            {/* Illuminated Reserve Wine & Glassware Shelves */}
            {[1.52, 1.86, 2.18].map((sy, si) => (
              <group key={`wine-shelf-${si}`} position={[0, sy, -0.12]}>
                <mesh material={materials.silverTravertineMat}>
                  <boxGeometry args={[2.1, 0.026, 0.28]} />
                </mesh>
                {/* Under-shelf warm LED strip */}
                <mesh position={[0, -0.018, 0.08]}>
                  <boxGeometry args={[2.02, 0.01, 0.02]} />
                  <meshStandardMaterial
                    color="#2a1d0c"
                    emissive="#ffdca0"
                    emissiveIntensity={0.5 + wallAccentIntensity * 0.7}
                  />
                </mesh>
                {/* Curated Reserve Wine Bottles & Stemware */}
                {[-0.82, -0.58, -0.16, 0.14, 0.56, 0.82].map((bx, bi) => (
                  <mesh
                    key={`wine-bot-${si}-${bi}`}
                    position={[bx, 0.12, 0]}
                    material={bi % 2 === 0 ? materials.wineBottleMat : materials.amberDecanterMat}
                  >
                    <cylinderGeometry args={[0.036, 0.04, 0.22, 10]} />
                  </mesh>
                ))}
              </group>
            ))}
            {/* Smoked-Glass Vitrine Doors */}
            <mesh position={[0, 1.84, -0.19]} material={materials.smokedGlassMat}>
              <boxGeometry args={[2.12, 1.14, 0.02]} />
            </mesh>
          </group>
        </group>
      )}

      {/* Champagne Ivory Lounge: Backlit Smoked-Glass Refreshment Bar Along Rear Wall + Smoked-Oak Door */}
      {isPrivateChampagne && (
        <group>
          {/* Sleek Smoked-Oak & Brushed-Brass Entry Door (Rear-Right) */}
          <group position={[W * 0.32, topTierY + 1.14, backZ - 0.24]}>
            <mesh material={materials.champagneBrassMat}>
              <boxGeometry args={[1.38, 2.34, 0.12]} />
            </mesh>
            <mesh position={[0, 0, 0.04]} material={materials.walnutCofferMat}>
              <boxGeometry args={[1.22, 2.22, 0.07]} />
            </mesh>
            <mesh position={[-0.44, -0.04, 0.095]} material={materials.champagneBrassMat}>
              <boxGeometry args={[0.04, 0.38, 0.04]} />
            </mesh>
          </group>

          {/* Backlit Smoked-Glass Refreshment Bar Visible Along Rear Wall */}
          <group position={[-1.05, topTierY, backZ - 0.44]}>
            {/* Dark Travertine & Smoked-Oak Lower Bar Credenza */}
            <mesh position={[0, 0.44, 0]} material={materials.walnutCofferMat} castShadow receiveShadow>
              <boxGeometry args={[4.15, 0.88, 0.56]} />
            </mesh>
            <mesh position={[0, 0.9, -0.02]} material={materials.travertineMat} castShadow>
              <boxGeometry args={[4.24, 0.06, 0.62]} />
            </mesh>
            {/* Upper Smoked-Glass Vitrine Cabinet */}
            <mesh position={[0, 1.66, 0.04]} material={materials.walnutCofferMat}>
              <boxGeometry args={[4.12, 1.44, 0.44]} />
            </mesh>
            {/* Warm-Amber Backlit Glass Bar Backplane */}
            <mesh position={[0, 1.66, -0.14]}>
              <planeGeometry args={[3.9, 1.28]} />
              <meshStandardMaterial
                color="#261b0e"
                emissive="#fbbf6a"
                emissiveIntensity={0.45 + wallAccentIntensity * 0.55}
                roughness={0.3}
              />
            </mesh>
            {/* Brushed-Brass Vertical Vitrine Mullions */}
            {[-1.96, -0.66, 0.66, 1.96].map((mx, mi) => (
              <mesh key={`bar-mullion-${mi}`} position={[mx, 1.66, -0.19]} material={materials.champagneBrassMat}>
                <boxGeometry args={[0.032, 1.38, 0.03]} />
              </mesh>
            ))}
            {/* Illuminated Bar Display Shelves & Bottle/Glassware Silhouettes */}
            {[1.24, 1.66, 2.06].map((sy, si) => (
              <group key={`bar-shelf-${si}`} position={[0, sy, -0.14]}>
                <mesh material={materials.travertineMat}>
                  <boxGeometry args={[3.88, 0.03, 0.28]} />
                </mesh>
                {[-1.55, -1.2, -0.85, -0.25, 0.15, 0.85, 1.22, 1.56].map((bx, bi) => (
                  <mesh
                    key={`bar-bottle-${si}-${bi}`}
                    position={[bx, 0.135, 0]}
                    material={bi % 3 === 0 ? materials.amberDecanterMat : materials.wineBottleMat}
                  >
                    <cylinderGeometry args={[0.038, 0.044, 0.24, 10]} />
                  </mesh>
                ))}
              </group>
            ))}
            {/* Tinted Smoked-Glass Vitrine Doors */}
            <mesh position={[0, 1.66, -0.22]} material={materials.smokedGlassMat}>
              <boxGeometry args={[3.9, 1.34, 0.02]} />
            </mesh>
          </group>
        </group>
      )}

      {/* ScreenX Obsidian Panorama: Far Rear Corner Brushed-Carbon-Fiber & Cold-White Backlit Translucent Quartz Beverage Bar + Stealth Entry Door */}
      {isObsidianScreenX && (
        <group>
          {/* Minimalist Matte-Obsidian & Titanium Flush Entry Door (Rear-Left) */}
          <group position={[-W * 0.3, topTierY + 1.14, backZ - 0.24]}>
            <mesh material={materials.matteTitaniumMat}>
              <boxGeometry args={[1.34, 2.34, 0.1]} />
            </mesh>
            <mesh position={[0, 0, 0.04]} material={materials.carbonFiberMat}>
              <boxGeometry args={[1.2, 2.22, 0.06]} />
            </mesh>
            <mesh position={[0.45, -0.04, 0.085]} material={materials.brushedTitaniumMat}>
              <boxGeometry args={[0.032, 0.42, 0.03]} />
            </mesh>
            <mesh position={[0.45, -0.04, 0.102]}>
              <boxGeometry args={[0.008, 0.36, 0.008]} />
              <meshStandardMaterial
                color="#041820"
                emissive="#06b6d4"
                emissiveIntensity={0.35 + lightFactor * 0.7}
              />
            </mesh>
          </group>

          {/* Far Rear-Right Corner Brushed-Carbon-Fiber Beverage Bar with Continuous Cold-White Backlit Translucent Quartz Sheet */}
          <group position={[W / 2 - 1.65, topTierY, backZ - 0.52]}>
            {/* Brushed-Carbon-Fiber Monolith Lower Bar Cabinetry */}
            <mesh position={[0, 0.45, 0]} material={materials.carbonFiberMat} castShadow receiveShadow>
              <boxGeometry args={[2.45, 0.9, 0.64]} />
            </mesh>
            {/* Carbon-Fiber L-Corner Side Wing Return */}
            <mesh position={[1.11, 0.45, -0.62]} material={materials.carbonFiberMat} castShadow receiveShadow>
              <boxGeometry args={[0.24, 0.9, 0.68]} />
            </mesh>
            {/* Precision Matte-Black Titanium Recessed Kick Plinth & Reveal */}
            <mesh position={[0, 0.035, -0.02]} material={materials.matteTitaniumMat}>
              <boxGeometry args={[2.42, 0.07, 0.58]} />
            </mesh>
            <mesh position={[0, 0.87, -0.325]} material={materials.matteTitaniumMat}>
              <boxGeometry args={[2.46, 0.035, 0.03]} />
            </mesh>

            {/* Built-In Smoked-Glass Beverage Chiller Showcase */}
            <mesh position={[-0.62, 0.45, -0.32]} material={materials.smokedGlassMat}>
              <boxGeometry args={[0.92, 0.68, 0.03]} />
            </mesh>
            <mesh position={[-0.62, 0.75, -0.28]}>
              <boxGeometry args={[0.84, 0.014, 0.02]} />
              <meshStandardMaterial
                color="#d8f3ff"
                emissive="#cffafe"
                emissiveIntensity={0.45 + lightFactor * 0.65}
              />
            </mesh>

            {/* Continuous Cold-White Backlit Translucent Quartz Countertop Waterfall Sheet */}
            <mesh position={[0, 0.925, -0.02]} material={materials.translucentQuartzMat} castShadow>
              <boxGeometry args={[2.52, 0.055, 0.7]} />
            </mesh>
            {/* Waterfall Quartz Edge Drop on Left End */}
            <mesh position={[-1.235, 0.465, -0.02]} material={materials.translucentQuartzMat}>
              <boxGeometry args={[0.052, 0.92, 0.7]} />
            </mesh>

            {/* Continuous Vertical Sheet of Cold-White Backlit Translucent Quartz Backsplash */}
            <mesh position={[0, 1.62, 0.14]} material={materials.translucentQuartzMat}>
              <boxGeometry args={[2.42, 1.32, 0.045]} />
            </mesh>
            {/* Matte-Black Titanium Perimeter Frame Around Backlit Quartz Monolith */}
            <mesh position={[0, 2.3, 0.05]} material={materials.matteTitaniumMat}>
              <boxGeometry args={[2.52, 0.08, 0.34]} />
            </mesh>
            {[-1.23, 1.23].map((bx, bi) => (
              <mesh key={`sx-bar-stile-${bi}`} position={[bx, 1.62, 0.14]} material={materials.matteTitaniumMat}>
                <boxGeometry args={[0.045, 1.36, 0.08]} />
              </mesh>
            ))}

            {/* Floating Matte-Titanium Shelf & Dark Smoked-Glass Carafes */}
            <mesh position={[0, 1.56, -0.02]} material={materials.matteTitaniumMat}>
              <boxGeometry args={[2.22, 0.028, 0.24]} />
            </mesh>
            {[-0.84, -0.58, -0.22, 0.18, 0.56, 0.84].map((gx, gi) => (
              <mesh
                key={`sx-bar-bottle-${gi}`}
                position={[gx, 1.68, -0.02]}
                material={gi % 2 === 0 ? materials.matteTitaniumMat : materials.smokedGlassMat}
              >
                <cylinderGeometry args={[0.036, 0.042, 0.22, 12]} />
              </mesh>
            ))}
            {/* Chilled Countertop Glassware Silhouetted Against Quartz */}
            {[-0.3, -0.14, 0.45, 0.62].map((cx, ci) => (
              <mesh
                key={`sx-counter-glass-${ci}`}
                position={[cx, 1.01, -0.12]}
                material={materials.smokedGlassMat}
              >
                <cylinderGeometry args={[0.036, 0.03, 0.11, 12]} />
              </mesh>
            ))}
          </group>
        </group>
      )}

      {/* ===================================================================== */}
      {/* REAL 3D RECESSED PROJECTION ROOM (BOOTH) + 3D CINEMA PROJECTOR       */}
      {/* ===================================================================== */}
      <group>
        {/* Sealed Booth Room Floor, Ceiling, Back & Side Walls */}
        <mesh position={[0, boothFloorY, boothCenterZ]} material={materials.boothFloorMat}>
          <boxGeometry args={[boothChamberW, 0.18, boothDepth]} />
        </mesh>
        <mesh position={[0, boothCeilY, boothCenterZ]} material={materials.boothInteriorWallMat}>
          <boxGeometry args={[boothChamberW, 0.18, boothDepth]} />
        </mesh>
        <mesh
          position={[0, boothMidY, backZ + boothDepth - 0.1]}
          material={materials.boothInteriorWallMat}
        >
          <boxGeometry args={[boothChamberW, boothChamberH, 0.2]} />
        </mesh>
        <mesh
          position={[-boothChamberW / 2, boothMidY, boothCenterZ]}
          material={materials.boothInteriorWallMat}
        >
          <boxGeometry args={[0.2, boothChamberH, boothDepth]} />
        </mesh>
        <mesh
          position={[boothChamberW / 2, boothMidY, boothCenterZ]}
          material={materials.boothInteriorWallMat}
        >
          <boxGeometry args={[0.2, boothChamberH, boothDepth]} />
        </mesh>

        {/* Window Perimeter Acoustic Steel Bezel & Vertical Glass Mullions */}
        <mesh position={[0, winTop - 0.04, backZ - 0.12]} material={materials.trimMetalMat}>
          <boxGeometry args={[boothWinW + 0.16, 0.1, 0.36]} />
        </mesh>
        <mesh position={[0, winBot + 0.04, backZ - 0.12]} material={materials.trimMetalMat}>
          <boxGeometry args={[boothWinW + 0.16, 0.1, 0.36]} />
        </mesh>
        <mesh position={[-boothWinW / 2, winMidY, backZ - 0.12]} material={materials.trimMetalMat}>
          <boxGeometry args={[0.1, actualWinH + 0.12, 0.36]} />
        </mesh>
        <mesh position={[boothWinW / 2, winMidY, backZ - 0.12]} material={materials.trimMetalMat}>
          <boxGeometry args={[0.1, actualWinH + 0.12, 0.36]} />
        </mesh>
        {[-boothWinW * 0.24, boothWinW * 0.24].map((mx, mi) => (
          <mesh
            key={`booth-mullion-${mi}`}
            position={[mx, winMidY, backZ - 0.04]}
            material={materials.trimMetalMat}
          >
            <boxGeometry args={[0.06, actualWinH, 0.12]} />
          </mesh>
        ))}

        {/* Angled Anti-Reflective Optical Observation Glass */}
        <mesh
          position={[0, winMidY, backZ - 0.02]}
          rotation={[0.09, 0, 0]}
          material={materials.boothGlassMat}
        >
          <planeGeometry args={[boothWinW - 0.06, actualWinH - 0.06]} />
        </mesh>

        {/* Interior Overhead Projectionist Worklight Tube */}
        <mesh position={[0, boothCeilY - 0.14, boothCenterZ]}>
          <boxGeometry args={[boothChamberW * 0.62, 0.045, 0.14]} />
          <meshStandardMaterial
            color="#1e2430"
            emissive={lightingProfile.ceilingColor}
            emissiveIntensity={boothWorkLightIntensity}
            roughness={0.3}
          />
        </mesh>

        {/* Interior Left Operator Desk & Dual Monitoring Displays */}
        <group position={[-boothWinW * 0.34, boothFloorY + 0.42, backZ + 0.95]}>
          <mesh material={materials.projectorBodyMat}>
            <boxGeometry args={[1.05, 0.06, 0.65]} />
          </mesh>
          <mesh position={[0, -0.2, 0]} material={materials.trimMetalMat}>
            <boxGeometry args={[0.92, 0.34, 0.5]} />
          </mesh>
          {/* Console Monitors */}
          <mesh position={[-0.22, 0.24, -0.1]} rotation={[-0.18, 0.15, 0]}>
            <boxGeometry args={[0.36, 0.24, 0.03]} />
            <meshStandardMaterial
              color="#0b1220"
              emissive="#38bdf8"
              emissiveIntensity={0.28 + lightFactor * 0.45}
            />
          </mesh>
          <mesh position={[0.22, 0.24, -0.1]} rotation={[-0.18, -0.1, 0]}>
            <boxGeometry args={[0.34, 0.22, 0.03]} />
            <meshStandardMaterial
              color="#0b1220"
              emissive={lightingProfile.accentColor}
              emissiveIntensity={0.22 + lightFactor * 0.4}
            />
          </mesh>
        </group>

        {/* Interior Right DCP Media Server & Laser Chiller Rack */}
        <group position={[boothWinW * 0.34, boothFloorY + 0.72, backZ + 1.05]}>
          <mesh material={materials.projectorBodyMat}>
            <boxGeometry args={[0.72, 1.32, 0.65]} />
          </mesh>
          {[-0.4, -0.15, 0.1, 0.35].map((ry, ri) => (
            <group key={`rack-u-${ri}`} position={[0, ry, -0.33]}>
              <mesh material={materials.projectorChromeMat}>
                <boxGeometry args={[0.6, 0.14, 0.02]} />
              </mesh>
              <mesh position={[0.22, 0, -0.015]}>
                <boxGeometry args={[0.04, 0.025, 0.01]} />
                <meshBasicMaterial color={ri % 2 === 0 ? '#34d399' : '#38bdf8'} />
              </mesh>
            </group>
          ))}
        </group>

        {/* Multi-Part 3D Digital Laser Cinema Projector Assembly */}
        <group position={[0, boothY, backZ + 0.75]}>
          {/* Floor Pedestal Column & Base Plate */}
          <mesh
            position={[0, -(boothY - boothFloorY) / 2 - 0.08, 0.15]}
            material={materials.projectorBodyMat}
          >
            <boxGeometry args={[0.42, Math.max(0.4, boothY - boothFloorY - 0.12), 0.58]} />
          </mesh>
          <mesh
            position={[0, -(boothY - boothFloorY) + 0.08, 0.15]}
            material={materials.projectorChromeMat}
          >
            <boxGeometry args={[0.74, 0.06, 0.82]} />
          </mesh>

          {/* Main Projector Chassis */}
          <mesh position={[0, 0, 0.18]} material={materials.projectorBodyMat}>
            <boxGeometry args={[0.78, 0.48, 1.12]} />
          </mesh>
          {/* Upper Thermal Cooling Shroud */}
          <mesh position={[0, 0.28, 0.2]} material={materials.projectorChromeMat}>
            <boxGeometry args={[0.64, 0.1, 0.92]} />
          </mesh>
          {/* Overhead Exhaust Duct Collar */}
          <mesh position={[0, 0.44, 0.25]} material={materials.projectorBodyMat}>
            <cylinderGeometry args={[0.14, 0.16, 0.28, 16]} />
          </mesh>
          {/* Side Intake Louvre Plates */}
          {[-0.4, 0.4].map((sx, si) => (
            <mesh key={`proj-vent-${si}`} position={[sx, 0, 0.2]} material={materials.speakerMat}>
              <boxGeometry args={[0.03, 0.36, 0.82]} />
            </mesh>
          ))}
          {/* Optical Lens Turret Flange */}
          <mesh
            position={[0, 0, -0.4]}
            rotation={[Math.PI / 2, 0, 0]}
            material={materials.projectorChromeMat}
          >
            <cylinderGeometry args={[0.2, 0.22, 0.08, 24]} />
          </mesh>
          {/* Stepped Anodized Projection Lens Barrel */}
          <mesh
            position={[0, 0, -0.56]}
            rotation={[Math.PI / 2, 0, 0]}
            material={materials.projectorBodyMat}
          >
            <cylinderGeometry args={[0.15, 0.17, 0.28, 24]} />
          </mesh>
          {/* Focus Ring Trim */}
          <mesh
            position={[0, 0, -0.62]}
            rotation={[Math.PI / 2, 0, 0]}
            material={materials.trimMetalMat}
          >
            <cylinderGeometry args={[0.162, 0.162, 0.05, 24]} />
          </mesh>
          {/* Glowing Optical Front Projection Element */}
          <mesh position={[0, 0, -0.7]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.125, 0.125, 0.02, 24]} />
            <meshStandardMaterial
              color="#c8e6ff"
              emissive="#bfe2ff"
              emissiveIntensity={lensEmissiveIntensity}
              roughness={0.05}
              metalness={0.2}
            />
          </mesh>
        </group>
      </group>

      {/* Ceiling Slab + Recessed Acoustic Baffle Strips & HVAC Return Louvers */}
      <mesh position={[0, H, 0]} receiveShadow material={materials.ceilingMat}>
        <boxGeometry args={[W, 0.4, L]} />
      </mesh>
      {!isPrivateVolcanic &&
        !isPrivateChampagne &&
        !isIce &&
        !isScreenX &&
        !isDolbyVeil &&
        !isParametricObsidian &&
        [-0.22, 0.22].map((lzFactor, li) => (
          <mesh
            key={`hvac-vent-${li}`}
            position={[0, H - 0.205, L * lzFactor]}
            material={materials.speakerMat}
          >
            <boxGeometry args={[Math.min(2.6, W * 0.18), 0.03, 0.9]} />
          </mesh>
        ))}

      {/* Real Multi-Part 3D Cinema Speakers (Side/Rear Surrounds, Overhead Atmos Pods & Front Line-Array Subwoofers) */}
      <CinemaSpeakers
        config={config}
        wallBayZs={wallBayZs}
        topTierY={topTierY}
        lightFactor={lightFactor}
        speakerGrilleMap={textures.speakerGrilleMap}
        screenBounceUniforms={screenBounceUniforms}
      />

      {/* Emergency Exit Doors near Front Left & Right + Dim EXIT Sign + Red Fire Extinguisher (omitted on private luxury residences, ScreenX & Dolby Cobalt Veil continuous fabric veil walls) */}
      {!isPrivateVolcanic &&
        !isPrivateChampagne &&
        !isScreenX &&
        !isDolbyVeil &&
        [-1, 1].map((side) => (
          <group
            key={`exit-${side}`}
            position={[side * (W / 2 - 0.24), 1.18, frontZ + 2.4]}
            rotation={[0, (side * -Math.PI) / 2, 0]}
          >
            <mesh material={materials.doorMat}>
              <boxGeometry args={[1.15, 2.35, 0.1]} />
            </mesh>
            <mesh position={[0, 1.42, 0.04]} material={materials.exitSignMat}>
              <planeGeometry args={[0.52, 0.2]} />
            </mesh>
            <mesh position={[side * 0.85, -0.35, 0.08]} material={materials.extinguisherMat}>
              <cylinderGeometry args={[0.075, 0.075, 0.54, 12]} />
            </mesh>
          </group>
        ))}

      {/* ===================================================================== */}
      {/* ARCHITECTURAL SIDE WALL BAYS & 15 DISTINCT REALISTIC LIGHT DESIGNS    */}
      {/* ===================================================================== */}
      <SideWallLighting
        config={config}
        wallBayZs={wallBayZs}
        topTierY={topTierY}
        lightFactor={lightFactor}
        trimMetalMat={materials.trimMetalMat}
        acousticPanelMat={materials.acousticPanelMat}
        wallMat={materials.wallMat}
        screenBounceUniforms={screenBounceUniforms}
      />

      {/* ===================================================================== */}
      {/* DISTINCT CEILING ARCHITECTURES & LIGHTING STYLES                      */}
      {/* ===================================================================== */}
      {ceilingLightStyle === 'puck_grid' &&
        ceilingLightPositions.map(([cx, cz], ci) => (
          <group key={`ceiling-puck-${ci}`} position={[cx, H - 0.21, cz]}>
            <mesh rotation={[Math.PI / 2, 0, 0]} material={materials.trimMetalMat}>
              <ringGeometry args={[0.14, 0.2, 18]} />
            </mesh>
            <mesh position={[0, -0.002, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.14, 18]} />
              <meshStandardMaterial
                color="#0b0c10"
                emissive={lightingProfile.ceilingColor}
                emissiveIntensity={ceilingPuckIntensity}
              />
            </mesh>
          </group>
        ))}

      {ceilingLightStyle === 'coffered_beams' &&
        Array.from({ length: 5 }, (_, i) => (
          <group
            key={`coffer-${i}`}
            position={[0, H - 0.35, frontZ + 3 + i * ((L - 6) / 4)]}
          >
            <mesh material={materials.trimMetalMat}>
              <boxGeometry args={[W - 0.4, 0.34, 0.45]} />
            </mesh>
            <mesh position={[0, -0.18, 0]}>
              <boxGeometry args={[W - 2.4, 0.04, 0.14]} />
              <meshStandardMaterial
                color="#101218"
                emissive={lightingProfile.ceilingColor}
                emissiveIntensity={wallAccentIntensity * 0.85}
              />
            </mesh>
          </group>
        ))}

      {ceilingLightStyle === 'overlapping_angled_planes' && (
        <group>
          {/* Clean Overlapping Angled Dark Acoustic Ceiling Planes with Dark-Bronze Lip Trim */}
          {Array.from({ length: 7 }, (_, i) => {
            const zStart = frontZ + 2.6;
            const zEnd = backZ - 2.6;
            const pz = THREE.MathUtils.lerp(zStart, zEnd, i / 6);
            const planeDepth = L * 0.19;
            const py = i % 2 === 0 ? H - 0.25 : H - 0.31;
            return (
              <group key={`angled-plane-${i}`} position={[0, py, pz]} rotation={[-0.085, 0, 0]}>
                <mesh material={materials.acousticPanelMat} receiveShadow castShadow>
                  <boxGeometry args={[W - 1.35, 0.11, planeDepth]} />
                </mesh>
                <mesh position={[0, -0.056, planeDepth / 2 - 0.04]} material={materials.darkBronzeTrimMat}>
                  <boxGeometry args={[W - 1.35, 0.025, 0.06]} />
                </mesh>
              </group>
            );
          })}

          {/* Soft Recessed Pin-Spot Downlights Mounted Cleanly Beneath Overlapping Angled Planes */}
          {[-W * 0.28, 0, W * 0.28].map((dx, di) =>
            Array.from({ length: 5 }, (_, dzi) => {
              const dz = THREE.MathUtils.lerp(frontZ + 3.1, backZ - 3.0, dzi / 4);
              return (
                <group key={`vc-pinspot-${di}-${dzi}`} position={[dx, H - 0.355, dz]}>
                  <mesh position={[0, 0.06, 0]} material={materials.nosingMat}>
                    <cylinderGeometry args={[0.068, 0.072, 0.12, 16]} />
                  </mesh>
                  <mesh position={[0, -0.002, 0]} rotation={[Math.PI / 2, 0, 0]} material={materials.darkBronzeTrimMat}>
                    <ringGeometry args={[0.045, 0.076, 16]} />
                  </mesh>
                  <mesh position={[0, -0.004, 0]} rotation={[Math.PI / 2, 0, 0]}>
                    <circleGeometry args={[0.045, 16]} />
                    <meshStandardMaterial
                      color="#16140f"
                      emissive="#fff7e6"
                      emissiveIntensity={ceilingPuckIntensity * 1.05}
                    />
                  </mesh>
                </group>
              );
            }),
          )}

          {/* Warm-Ivory Perimeter Cove Lighting Along All Four Ceiling Soffits */}
          {[-1, 1].map((side) => (
            <group key={`vc-cove-side-${side}`} position={[side * (W / 2 - 0.42), H - 0.23, 0]}>
              <mesh material={materials.stageMat}>
                <boxGeometry args={[0.24, 0.11, L - 1.2]} />
              </mesh>
              <mesh position={[-side * 0.085, 0.018, 0]}>
                <boxGeometry args={[0.05, 0.04, L - 1.4]} />
                <meshStandardMaterial
                  color="#181510"
                  emissive="#fff8e7"
                  emissiveIntensity={wallAccentIntensity * 1.12}
                  roughness={0.2}
                />
              </mesh>
            </group>
          ))}
          {[-1, 1].map((end) => (
            <group key={`vc-cove-end-${end}`} position={[0, H - 0.23, end * (L / 2 - 0.55)]}>
              <mesh material={materials.stageMat}>
                <boxGeometry args={[W - 1.1, 0.11, 0.24]} />
              </mesh>
              <mesh position={[0, 0.018, -end * 0.085]}>
                <boxGeometry args={[W - 1.25, 0.04, 0.05]} />
                <meshStandardMaterial
                  color="#181510"
                  emissive="#fff8e7"
                  emissiveIntensity={wallAccentIntensity * 1.12}
                  roughness={0.2}
                />
              </mesh>
            </group>
          ))}
        </group>
      )}

      {/* Champagne Ivory Lounge: Stepped Dark-Walnut Coffered Ceiling Trays + Warm-White Perimeter LED Coves + Subtle Fiber-Optic Starlight Center Field */}
      {ceilingLightStyle === 'stepped_walnut_starlight_trays' && (
        <group>
          {/* Outer Dark-Walnut Stepped Coffer Beams */}
          {[-L * 0.36, -L * 0.16, L * 0.16, L * 0.36].map((bz, bi) => (
            <group key={`walnut-beam-z-${bi}`} position={[0, H - 0.28, bz]}>
              <mesh material={materials.walnutCofferMat} receiveShadow castShadow>
                <boxGeometry args={[W - 0.85, 0.18, 0.32]} />
              </mesh>
              <mesh position={[0, -0.095, 0]} material={materials.champagneBrassMat}>
                <boxGeometry args={[W - 1.0, 0.015, 0.08]} />
              </mesh>
            </group>
          ))}
          {[-W * 0.4, -W * 0.22, W * 0.22, W * 0.4].map((bx, bi) => (
            <group key={`walnut-beam-x-${bi}`} position={[bx, H - 0.28, 0]}>
              <mesh material={materials.walnutCofferMat} receiveShadow castShadow>
                <boxGeometry args={[0.3, 0.18, L - 1.9]} />
              </mesh>
              <mesh position={[0, -0.095, 0]} material={materials.champagneBrassMat}>
                <boxGeometry args={[0.075, 0.015, L - 2.0]} />
              </mesh>
            </group>
          ))}

          {/* Stepped Inner Coffer Tray Framing Around Central Starlight Field */}
          {[-W * 0.205, W * 0.205].map((sx, si) => (
            <group key={`star-tray-step-x-${si}`} position={[sx, H - 0.23, 0]}>
              <mesh material={materials.walnutCofferMat}>
                <boxGeometry args={[0.14, 0.09, L * 0.31]} />
              </mesh>
              <mesh position={[-Math.sign(sx) * 0.055, 0.015, 0]}>
                <boxGeometry args={[0.032, 0.025, L * 0.29]} />
                <meshStandardMaterial
                  color="#18140d"
                  emissive="#fff6e3"
                  emissiveIntensity={wallAccentIntensity * 1.08}
                  roughness={0.2}
                />
              </mesh>
            </group>
          ))}
          {[-L * 0.15, L * 0.15].map((sz, si) => (
            <group key={`star-tray-step-z-${si}`} position={[0, H - 0.23, sz]}>
              <mesh material={materials.walnutCofferMat}>
                <boxGeometry args={[W * 0.42, 0.09, 0.14]} />
              </mesh>
              <mesh position={[0, 0.015, -Math.sign(sz) * 0.055]}>
                <boxGeometry args={[W * 0.4, 0.025, 0.032]} />
                <meshStandardMaterial
                  color="#18140d"
                  emissive="#fff6e3"
                  emissiveIntensity={wallAccentIntensity * 1.08}
                  roughness={0.2}
                />
              </mesh>
            </group>
          ))}

          {/* Warm-White Perimeter LED Coves Tucked Around Outer Walnut Ceiling Tray */}
          {[-1, 1].map((side) => (
            <group key={`walnut-cove-side-${side}`} position={[side * (W / 2 - 0.48), H - 0.22, 0]}>
              <mesh material={materials.walnutCofferMat}>
                <boxGeometry args={[0.2, 0.09, L - 1.5]} />
              </mesh>
              <mesh position={[-side * 0.075, 0.018, 0]}>
                <boxGeometry args={[0.042, 0.03, L - 1.7]} />
                <meshStandardMaterial
                  color="#18140d"
                  emissive="#fff6e3"
                  emissiveIntensity={wallAccentIntensity * 1.05}
                  roughness={0.2}
                />
              </mesh>
            </group>
          ))}
          {[-1, 1].map((end) => (
            <group key={`walnut-cove-end-${end}`} position={[0, H - 0.22, end * (L / 2 - 0.85)]}>
              <mesh material={materials.walnutCofferMat}>
                <boxGeometry args={[W - 1.15, 0.09, 0.2]} />
              </mesh>
              <mesh position={[0, 0.018, -end * 0.075]}>
                <boxGeometry args={[W - 1.3, 0.03, 0.042]} />
                <meshStandardMaterial
                  color="#18140d"
                  emissive="#fff6e3"
                  emissiveIntensity={wallAccentIntensity * 1.05}
                  roughness={0.2}
                />
              </mesh>
            </group>
          ))}

          {/* Subtle Fiber-Optic Starlight Center Field */}
          {champagneStarField.map(([sx, sz], si) => (
            <mesh key={`champagne-star-${si}`} position={[sx, H - 0.208, sz]} rotation={[Math.PI / 2, 0, 0]}>
              <circleGeometry args={[si % 5 === 0 ? 0.032 : 0.019, 8]} />
              <meshStandardMaterial
                color="#12100d"
                emissive={si % 3 === 0 ? '#fde68a' : '#fff8e7'}
                emissiveIntensity={ceilingPuckIntensity * (si % 4 === 0 ? 1.25 : 0.82)}
              />
            </mesh>
          ))}

          {/* Soft Brushed-Brass Recessed Downlights in Outer Coffer Trays */}
          {[-W * 0.31, W * 0.31].map((dx, di) =>
            [-L * 0.26, 0, L * 0.26].map((dz, dzi) => (
              <group key={`champagne-dl-${di}-${dzi}`} position={[dx, H - 0.212, dz]}>
                <mesh rotation={[Math.PI / 2, 0, 0]} material={materials.champagneBrassMat}>
                  <ringGeometry args={[0.048, 0.078, 16]} />
                </mesh>
                <mesh position={[0, -0.002, 0]} rotation={[Math.PI / 2, 0, 0]}>
                  <circleGeometry args={[0.048, 16]} />
                  <meshStandardMaterial
                    color="#18140d"
                    emissive="#fff6e3"
                    emissiveIntensity={ceilingPuckIntensity * 0.96}
                  />
                </mesh>
              </group>
            )),
          )}
        </group>
      )}

      {/* Walnut Reserve Salon: Refined Geometric Coffered Grid of Matte-Espresso Acoustic Trays Inlaid with Warm-Ivory Perimeter Cove Lighting & Soft Pin-Spot Downlights */}
      {ceilingLightStyle === 'matte_espresso_coffered_grid' && (
        <group>
          {/* Matte-Espresso Geometric Coffer Grid Transverse Beams */}
          {[-L * 0.38, -L * 0.19, 0, L * 0.19, L * 0.38].map((bz, bi) => (
            <group key={`espresso-beam-z-${bi}`} position={[0, H - 0.29, bz]}>
              <mesh material={materials.matteEspressoCofferMat} receiveShadow castShadow>
                <boxGeometry args={[W - 0.88, 0.18, 0.28]} />
              </mesh>
              <mesh position={[0, -0.095, 0]} material={materials.champagneBrassMat}>
                <boxGeometry args={[W - 1.04, 0.014, 0.05]} />
              </mesh>
            </group>
          ))}
          {/* Matte-Espresso Geometric Coffer Grid Longitudinal Beams */}
          {[-W * 0.39, -W * 0.14, W * 0.14, W * 0.39].map((bx, bi) => (
            <group key={`espresso-beam-x-${bi}`} position={[bx, H - 0.29, 0]}>
              <mesh material={materials.matteEspressoCofferMat} receiveShadow castShadow>
                <boxGeometry args={[0.26, 0.18, L - 1.8]} />
              </mesh>
              <mesh position={[0, -0.095, 0]} material={materials.champagneBrassMat}>
                <boxGeometry args={[0.05, 0.014, L - 1.95]} />
              </mesh>
            </group>
          ))}

          {/* Recessed Matte-Espresso Acoustic Tray Panels Inside Coffer Bays */}
          {[-W * 0.265, 0, W * 0.265].map((tx, xi) =>
            [-L * 0.285, -L * 0.095, L * 0.095, L * 0.285].map((tz, zi) => (
              <mesh
                key={`espresso-tray-bay-${xi}-${zi}`}
                position={[tx, H - 0.21, tz]}
                material={materials.espressoCofferPanelMat}
                receiveShadow
              >
                <boxGeometry args={[W * 0.22, 0.035, L * 0.16]} />
              </mesh>
            )),
          )}

          {/* Warm-Ivory Perimeter Cove Lighting Inlaid Around Matte-Espresso Coffered Grid */}
          {[-1, 1].map((side) => (
            <group key={`espresso-cove-side-${side}`} position={[side * (W / 2 - 0.48), H - 0.22, 0]}>
              <mesh material={materials.matteEspressoCofferMat}>
                <boxGeometry args={[0.2, 0.09, L - 1.45]} />
              </mesh>
              <mesh position={[-side * 0.075, 0.018, 0]}>
                <boxGeometry args={[0.044, 0.03, L - 1.65]} />
                <meshStandardMaterial
                  color="#18140d"
                  emissive="#fff6e3"
                  emissiveIntensity={wallAccentIntensity * 1.08}
                  roughness={0.2}
                />
              </mesh>
            </group>
          ))}
          {[-1, 1].map((end) => (
            <group key={`espresso-cove-end-${end}`} position={[0, H - 0.22, end * (L / 2 - 0.85)]}>
              <mesh material={materials.matteEspressoCofferMat}>
                <boxGeometry args={[W - 1.12, 0.09, 0.2]} />
              </mesh>
              <mesh position={[0, 0.018, -end * 0.075]}>
                <boxGeometry args={[W - 1.28, 0.03, 0.044]} />
                <meshStandardMaterial
                  color="#18140d"
                  emissive="#fff6e3"
                  emissiveIntensity={wallAccentIntensity * 1.08}
                  roughness={0.2}
                />
              </mesh>
            </group>
          ))}

          {/* Soft Pin-Spot Downlights Centered in Matte-Espresso Acoustic Coffer Trays */}
          {[-W * 0.265, 0, W * 0.265].map((dx, di) =>
            [-L * 0.285, -L * 0.095, L * 0.095, L * 0.285].map((dz, dzi) => (
              <group key={`espresso-pinspot-${di}-${dzi}`} position={[dx, H - 0.23, dz]}>
                <mesh rotation={[Math.PI / 2, 0, 0]} material={materials.champagneBrassMat}>
                  <ringGeometry args={[0.042, 0.072, 16]} />
                </mesh>
                <mesh position={[0, -0.002, 0]} rotation={[Math.PI / 2, 0, 0]}>
                  <circleGeometry args={[0.042, 16]} />
                  <meshStandardMaterial
                    color="#18140d"
                    emissive="#fff6e3"
                    emissiveIntensity={ceilingPuckIntensity * 0.98}
                  />
                </mesh>
              </group>
            )),
          )}
        </group>
      )}

      {ceilingLightStyle === 'linear_coves' && (
        <group>
          {/* Dark Acoustic Coffered Ceiling Beams (Clean Geometric Coffered Layout) */}
          {Array.from({ length: 6 }, (_, i) => (
            <mesh
              key={`obs-coffer-z-${i}`}
              position={[0, H - 0.3, frontZ + 2.2 + i * ((L - 4.4) / 5)]}
              material={materials.stageMat}
              receiveShadow
            >
              <boxGeometry args={[W - 1.1, 0.22, 0.28]} />
            </mesh>
          ))}
          {[-W * 0.3, -W * 0.1, W * 0.1, W * 0.3].map((cx, ci) => (
            <mesh
              key={`obs-coffer-x-${ci}`}
              position={[cx, H - 0.3, 0]}
              material={materials.stageMat}
              receiveShadow
            >
              <boxGeometry args={[0.26, 0.22, L - 2.2]} />
            </mesh>
          ))}

          {/* Recessed Dark Acoustic Panels Inside Coffer Bays */}
          {Array.from({ length: 5 }, (_, ix) =>
            Array.from({ length: 5 }, (_, iz) => {
              const bayXs = [-W * 0.4, -W * 0.2, 0, W * 0.2, W * 0.4];
              const bayZStep = (L - 4.4) / 5;
              const pz = frontZ + 2.2 + (iz + 0.5) * bayZStep;
              return (
                <mesh
                  key={`obs-coffer-tile-${ix}-${iz}`}
                  position={[bayXs[ix], H - 0.21, pz]}
                  material={materials.ceilingMat}
                  receiveShadow
                >
                  <boxGeometry args={[W * 0.175, 0.03, bayZStep - 0.32]} />
                </mesh>
              );
            }),
          )}

          {/* Soft Recessed Pin-Spot Downlights Centered in Coffer Bays */}
          {[-W * 0.2, 0, W * 0.2].map((dx, di) =>
            Array.from({ length: 4 }, (_, dzi) => {
              const dz = frontZ + 3.4 + dzi * ((L - 6.8) / 3);
              return (
                <group key={`obs-pinspot-${di}-${dzi}`} position={[dx, H - 0.228, dz]}>
                  <mesh rotation={[Math.PI / 2, 0, 0]} material={materials.nosingMat}>
                    <ringGeometry args={[0.042, 0.072, 16]} />
                  </mesh>
                  <mesh position={[0, -0.002, 0]} rotation={[Math.PI / 2, 0, 0]}>
                    <circleGeometry args={[0.042, 16]} />
                    <meshStandardMaterial
                      color="#12100d"
                      emissive={lightingProfile.ceilingColor}
                      emissiveIntensity={ceilingPuckIntensity * 1.05}
                    />
                  </mesh>
                </group>
              );
            }),
          )}

          {/* Warm-White Linear Perimeter Cove Lighting Along All Four Ceiling Edges */}
          {[-1, 1].map((side) => (
            <group key={`obs-cove-side-${side}`} position={[side * (W / 2 - 0.42), H - 0.28, 0]}>
              <mesh material={materials.stageMat}>
                <boxGeometry args={[0.26, 0.12, L - 1.2]} />
              </mesh>
              <mesh position={[-side * 0.09, 0.02, 0]}>
                <boxGeometry args={[0.055, 0.045, L - 1.4]} />
                <meshStandardMaterial
                  color="#161410"
                  emissive="#fff2d6"
                  emissiveIntensity={wallAccentIntensity * 1.05}
                  roughness={0.2}
                />
              </mesh>
            </group>
          ))}
          {[-1, 1].map((end) => (
            <group key={`obs-cove-end-${end}`} position={[0, H - 0.28, end * (L / 2 - 0.55)]}>
              <mesh material={materials.stageMat}>
                <boxGeometry args={[W - 1.1, 0.12, 0.26]} />
              </mesh>
              <mesh position={[0, 0.02, -end * 0.09]}>
                <boxGeometry args={[W - 1.25, 0.045, 0.055]} />
                <meshStandardMaterial
                  color="#161410"
                  emissive="#fff2d6"
                  emissiveIntensity={wallAccentIntensity * 1.05}
                  roughness={0.2}
                />
              </mesh>
            </group>
          ))}
        </group>
      )}

      {ceilingLightStyle === 'acoustic_grid_linear' && (
        <group>
          {/* Dark Commercial Acoustic Ceiling Grid T-Bars (Transverse & Longitudinal) */}
          {Array.from({ length: 8 }, (_, i) => (
            <mesh
              key={`grid-z-${i}`}
              position={[0, H - 0.24, frontZ + 2.2 + i * ((L - 4.4) / 7)]}
              material={materials.stageMat}
            >
              <boxGeometry args={[W - 0.4, 0.11, 0.12]} />
            </mesh>
          ))}
          {[-W * 0.36, -W * 0.18, 0, W * 0.18, W * 0.36].map((gx, gi) => (
            <mesh
              key={`grid-x-${gi}`}
              position={[gx, H - 0.24, 0]}
              material={materials.stageMat}
            >
              <boxGeometry args={[0.12, 0.11, L - 2.2]} />
            </mesh>
          ))}

          {/* Recessed Linear Warm-White & Subtle Amber LED Lighting Channels in Ceiling Grid */}
          {[-W * 0.28, W * 0.28].map((lx, li) => (
            <group key={`grid-lin-long-${li}`} position={[lx, H - 0.22, 0]}>
              <mesh material={materials.nosingMat}>
                <boxGeometry args={[0.14, 0.06, L - 3.0]} />
              </mesh>
              <mesh position={[0, -0.025, 0]}>
                <boxGeometry args={[0.055, 0.03, L - 3.1]} />
                <meshStandardMaterial
                  color="#101218"
                  emissive={lightingProfile.ceilingColor}
                  emissiveIntensity={wallAccentIntensity * 1.05}
                />
              </mesh>
            </group>
          ))}
          {[-L * 0.34, L * 0.32].map((lz, lzi) => (
            <group key={`grid-lin-cross-${lzi}`} position={[0, H - 0.22, lz]}>
              <mesh material={materials.nosingMat}>
                <boxGeometry args={[W * 0.56, 0.06, 0.12]} />
              </mesh>
              <mesh position={[0, -0.025, 0]}>
                <boxGeometry args={[W * 0.54, 0.03, 0.048]} />
                <meshStandardMaterial
                  color="#101218"
                  emissive={lightingProfile.accentColor}
                  emissiveIntensity={wallAccentIntensity * 0.92}
                />
              </mesh>
            </group>
          ))}

          {/* Subtle Recessed Warm Downlights Mounted Symmetrically Across Grid Bays */}
          {[-W * 0.36, -W * 0.12, W * 0.12, W * 0.36].map((dx, di) =>
            [-L * 0.25, -L * 0.08, L * 0.1, L * 0.27].map((dz, dzi) => (
              <group key={`grid-downlight-${di}-${dzi}`} position={[dx, H - 0.21, dz]}>
                <mesh rotation={[Math.PI / 2, 0, 0]} material={materials.nosingMat}>
                  <ringGeometry args={[0.085, 0.13, 16]} />
                </mesh>
                <mesh position={[0, -0.003, 0]} rotation={[Math.PI / 2, 0, 0]}>
                  <circleGeometry args={[0.085, 16]} />
                  <meshStandardMaterial
                    color="#0d0e12"
                    emissive={lightingProfile.ceilingColor}
                    emissiveIntensity={ceilingPuckIntensity * 0.72}
                  />
                </mesh>
              </group>
            )),
          )}
        </group>
      )}

      {ceilingLightStyle === 'vaulted_ribs' &&
        Array.from({ length: 6 }, (_, i) => (
          <group
            key={`vault-rib-${i}`}
            position={[0, H - 0.45, frontZ + 2.5 + i * ((L - 5) / 5)]}
          >
            <mesh material={materials.trimMetalMat}>
              <boxGeometry args={[W - 0.5, 0.5, 0.35]} />
            </mesh>
            <mesh position={[0, -0.28, 0]}>
              <boxGeometry args={[W - 2.2, 0.06, 0.12]} />
              <meshStandardMaterial
                color="#0e131e"
                emissive={lightingProfile.accentColor}
                emissiveIntensity={wallAccentIntensity}
              />
            </mesh>
          </group>
        ))}

      {ceilingLightStyle === 'star_ceiling' && (
        <group>
          {starPoints.map(([sx, sz], si) => (
            <mesh key={`star-${si}`} position={[sx, H - 0.22, sz]} rotation={[Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.065, 10]} />
              <meshStandardMaterial
                color="#090a0e"
                emissive={si % 3 === 0 ? lightingProfile.accentColor : lightingProfile.ceilingColor}
                emissiveIntensity={ceilingPuckIntensity * 1.2}
              />
            </mesh>
          ))}
        </group>
      )}

      {ceilingLightStyle === 'coffered_starlight_coves' && (
        <group>
          {/* Dark Acoustic Coffered Grid Beams (Transverse + Longitudinal) */}
          {Array.from({ length: 6 }, (_, i) => (
            <mesh
              key={`deco-coffer-z-${i}`}
              position={[0, H - 0.34, frontZ + 2.5 + i * ((L - 5.0) / 5)]}
              material={materials.stageMat}
            >
              <boxGeometry args={[W - 0.5, 0.32, 0.36]} />
            </mesh>
          ))}
          {[-W * 0.34, -W * 0.11, W * 0.11, W * 0.34].map((cx, ci) => (
            <mesh
              key={`deco-coffer-x-${ci}`}
              position={[cx, H - 0.34, 0]}
              material={materials.stageMat}
            >
              <boxGeometry args={[0.32, 0.3, L - 2.6]} />
            </mesh>
          ))}
          {/* Twinkling Fiber-Optic Starlight Points Inside Dark Coffered Bays */}
          {starPoints.map(([sx, sz], si) => (
            <mesh key={`deco-star-${si}`} position={[sx, H - 0.215, sz]} rotation={[Math.PI / 2, 0, 0]}>
              <circleGeometry args={[si % 4 === 0 ? 0.055 : 0.036, 8]} />
              <meshStandardMaterial
                color="#090a0e"
                emissive={si % 2 === 0 ? '#fff2d6' : '#ffd078'}
                emissiveIntensity={ceilingPuckIntensity * (si % 3 === 0 ? 1.4 : 0.9)}
              />
            </mesh>
          ))}
          {/* Concealed Warm 2700K Amber LED Perimeter Cove Strips Washing Down the Side Walls */}
          {[-1, 1].map((side) => (
            <group key={`deco-cove-wall-${side}`} position={[side * (W / 2 - 0.44), H - 0.29, 0]}>
              <mesh material={materials.stageMat}>
                <boxGeometry args={[0.26, 0.14, L - 1.4]} />
              </mesh>
              <mesh position={[side * 0.04, 0.02, 0]}>
                <boxGeometry args={[0.14, 0.055, L - 1.6]} />
                <meshStandardMaterial
                  color="#140d06"
                  emissive="#ffb347"
                  emissiveIntensity={wallAccentIntensity * 1.15}
                  roughness={0.2}
                />
              </mesh>
            </group>
          ))}
        </group>
      )}

      {ceilingLightStyle === 'perimeter_halo' && !isDolbyCobalt && (
        <group position={[0, H - 0.36, 0]}>
          {/* Suspended Floating Acoustic Cloud Panel */}
          <mesh material={materials.wallMat}>
            <boxGeometry args={[W - 2.8, 0.1, L - 4.0]} />
          </mesh>
          {/* Glowing 4-Sided Indirect Perimeter Halo Cove Strips */}
          {[-1, 1].map((side) => (
            <mesh key={`halo-x-${side}`} position={[side * ((W - 2.8) / 2 + 0.07), 0.055, 0]}>
              <boxGeometry args={[0.1, 0.05, L - 3.7]} />
              <meshStandardMaterial
                color="#101218"
                emissive={lightingProfile.accentColor}
                emissiveIntensity={wallAccentIntensity}
              />
            </mesh>
          ))}
          {[-1, 1].map((end) => (
            <mesh key={`halo-z-${end}`} position={[0, 0.055, end * ((L - 4.0) / 2 + 0.07)]}>
              <boxGeometry args={[W - 2.5, 0.05, 0.1]} />
              <meshStandardMaterial
                color="#101218"
                emissive={lightingProfile.ceilingColor}
                emissiveIntensity={wallAccentIntensity}
              />
            </mesh>
          ))}
        </group>
      )}

      {/* Dolby Cobalt Noir Ceiling: Sleek Parallel Linear Acoustic Baffles + Soft Recessed Downlights + Warm-Amber Perimeter Cove Lighting */}
      {isDolbyCobalt && (
        <group>
          {/* Sleek Parallel Linear Dark Acoustic Ceiling Baffles */}
          {Array.from({ length: 10 }, (_, i) => {
            const bz = frontZ + 2.0 + i * ((L - 4.0) / 9);
            return (
              <mesh
                key={`cobalt-baffle-${i}`}
                position={[0, H - 0.33, bz]}
                material={materials.stageMat}
                receiveShadow
                castShadow
              >
                <boxGeometry args={[W - 1.5, 0.26, 0.14]} />
              </mesh>
            );
          })}

          {/* Soft Recessed Downlights Between Acoustic Baffles */}
          {[-W * 0.28, 0, W * 0.28].map((dx, di) =>
            Array.from({ length: 4 }, (_, dzi) => {
              const dz = frontZ + 3.2 + dzi * ((L - 6.4) / 3);
              return (
                <group key={`cobalt-dl-${di}-${dzi}`} position={[dx, H - 0.215, dz]}>
                  <mesh rotation={[Math.PI / 2, 0, 0]} material={materials.nosingMat}>
                    <ringGeometry args={[0.068, 0.105, 16]} />
                  </mesh>
                  <mesh position={[0, -0.002, 0]} rotation={[Math.PI / 2, 0, 0]}>
                    <circleGeometry args={[0.068, 16]} />
                    <meshStandardMaterial
                      color="#14100a"
                      emissive="#fef3c7"
                      emissiveIntensity={ceilingPuckIntensity * 0.95}
                    />
                  </mesh>
                </group>
              );
            }),
          )}

          {/* Warm-Amber Perimeter Cove Lighting Along Ceiling Edges */}
          {[-1, 1].map((side) => (
            <group key={`cobalt-cove-side-${side}`} position={[side * (W / 2 - 0.42), H - 0.28, 0]}>
              <mesh material={materials.stageMat}>
                <boxGeometry args={[0.26, 0.12, L - 1.2]} />
              </mesh>
              <mesh position={[-side * 0.09, 0.02, 0]}>
                <boxGeometry args={[0.055, 0.045, L - 1.4]} />
                <meshStandardMaterial
                  color="#181006"
                  emissive="#f59e0b"
                  emissiveIntensity={wallAccentIntensity * 1.08}
                  roughness={0.2}
                />
              </mesh>
            </group>
          ))}
          {[-1, 1].map((end) => (
            <group key={`cobalt-cove-end-${end}`} position={[0, H - 0.28, end * (L / 2 - 0.55)]}>
              <mesh material={materials.stageMat}>
                <boxGeometry args={[W - 1.1, 0.12, 0.26]} />
              </mesh>
              <mesh position={[0, 0.02, -end * 0.09]}>
                <boxGeometry args={[W - 1.25, 0.045, 0.055]} />
                <meshStandardMaterial
                  color="#181006"
                  emissive="#f59e0b"
                  emissiveIntensity={wallAccentIntensity * 1.08}
                  roughness={0.2}
                />
              </mesh>
            </group>
          ))}
        </group>
      )}

      {/* 4DX Overhead Wind/Strobe Rig Truss (generic 4DX halls, replaced by bespoke ceilings in Crimson, Arctic & Thunder 4DX) */}
      {environmentProfile.architectureStyle === '4dx' &&
        !isCrimson4dx &&
        !isArctic4dx &&
        !isThunder4dx &&
        Array.from({ length: 4 }, (_, i) => (
          <group key={`4dx-rig-${i}`} position={[0, H - 0.58, firstRowZ + i * 3.6]}>
            <mesh material={materials.trimMetalMat}>
              <boxGeometry args={[W - 2.6, 0.16, 0.2]} />
            </mesh>
            <mesh position={[0, -0.09, 0]}>
              <boxGeometry args={[W - 4.0, 0.04, 0.08]} />
              <meshStandardMaterial
                color="#0d1724"
                emissive={lightingProfile.accentColor}
                emissiveIntensity={wallAccentIntensity * 0.9}
              />
            </mesh>
          </group>
        ))}

      {/* 4DX Arctic Storm Ceiling: Bold Geometric Angular Acoustic Grid, Rain-Mist Nozzles, Lightning Strobe Bars & Linear Violet/Cyan LED Channels */}
      {ceilingLightStyle === 'hexagonal_acoustic_4dx' && (
        <group>
          {/* Bold Dark Geometric Angular Acoustic Grid Beams (Crisscross Diagonal Lattice) */}
          {Array.from({ length: 6 }, (_, i) => {
            const cz = frontZ + 3.2 + i * ((L - 6.4) / 5);
            const diagSpan = Math.hypot(W * 0.46, 3.8);
            const yawAng = Math.atan2(3.8, W * 0.46);
            return (
              <group key={`arctic-angular-bay-${i}`} position={[0, H - 0.36, cz]}>
                {/* Left & Right Angled Crisscross Acoustic Grid Ribs */}
                {[-1, 1].map((side) => (
                  <group key={`ang-rib-${side}`} position={[side * W * 0.23, 0, 0]} rotation={[0, side * yawAng, 0]}>
                    <mesh material={materials.obsidianRevealMat}>
                      <boxGeometry args={[diagSpan, 0.22, 0.18]} />
                    </mesh>
                    {/* Recessed Electric-Violet & Bright Cyan LED Channels Tracing Geometric Grid */}
                    <mesh position={[0, -0.115, 0]}>
                      <boxGeometry args={[diagSpan - 0.3, 0.022, 0.055]} />
                      <meshStandardMaterial
                        color="#100a1c"
                        emissive={i % 2 === 0 ? lightingProfile.wallColor : lightingProfile.accentColor}
                        emissiveIntensity={wallAccentIntensity * 1.15}
                        roughness={0.2}
                      />
                    </mesh>
                  </group>
                ))}
                {/* Counter-Angled Cross Grid Ribs Forming Diamond Ceiling Lattice */}
                {[-1, 1].map((side) => (
                  <group key={`ang-cross-${side}`} position={[side * W * 0.23, 0, 0]} rotation={[0, -side * yawAng, 0]}>
                    <mesh material={materials.stageMat}>
                      <boxGeometry args={[diagSpan, 0.2, 0.16]} />
                    </mesh>
                    <mesh position={[0, -0.105, 0]}>
                      <boxGeometry args={[diagSpan - 0.35, 0.02, 0.048]} />
                      <meshStandardMaterial
                        color="#08141a"
                        emissive={i % 2 === 0 ? lightingProfile.accentColor : lightingProfile.wallColor}
                        emissiveIntensity={wallAccentIntensity * 1.05}
                        roughness={0.2}
                      />
                    </mesh>
                  </group>
                ))}

                {/* Overhead Rain-Mist Nozzle Manifolds */}
                {[-W * 0.28, 0, W * 0.28].map((nx, ni) => (
                  <group key={`arctic-rain-mist-${ni}`} position={[nx, -0.22, 0]}>
                    <mesh material={materials.trimMetalMat}>
                      <boxGeometry args={[1.05, 0.045, 0.045]} />
                    </mesh>
                    {[-0.32, 0, 0.32].map((mx, mi) => (
                      <mesh key={`arctic-mist-tip-${mi}`} position={[mx, -0.06, 0]} material={materials.projectorChromeMat}>
                        <cylinderGeometry args={[0.016, 0.032, 0.08, 10]} />
                      </mesh>
                    ))}
                  </group>
                ))}

                {/* Mounted Overhead Lightning Strobe Light Bars */}
                {[-W * 0.15, W * 0.15].map((sx, si) => (
                  <group key={`arctic-strobe-bar-${si}`} position={[sx, -0.2, 0.16]}>
                    <mesh material={materials.nosingMat}>
                      <boxGeometry args={[1.22, 0.07, 0.1]} />
                    </mesh>
                    <mesh position={[0, -0.038, 0]}>
                      <boxGeometry args={[1.08, 0.022, 0.06]} />
                      <meshStandardMaterial
                        color="#101424"
                        emissive="#a855f7"
                        emissiveIntensity={lightFactor * 0.45}
                        roughness={0.18}
                      />
                    </mesh>
                  </group>
                ))}
              </group>
            );
          })}

          {/* Longitudinal Violet & Cyan Linear Accent Spine Channels */}
          {[-W * 0.36, W * 0.36].map((lx, li) => (
            <group key={`arctic-long-violet-${li}`} position={[lx, H - 0.5, 0]}>
              <mesh material={materials.nosingMat}>
                <boxGeometry args={[0.1, 0.04, L - 2.6]} />
              </mesh>
              <mesh position={[0, -0.022, 0]}>
                <boxGeometry args={[0.045, 0.022, L - 2.7]} />
                <meshStandardMaterial
                  color="#12091d"
                  emissive={lightingProfile.wallColor}
                  emissiveIntensity={wallAccentIntensity * 1.15}
                  roughness={0.2}
                />
              </mesh>
            </group>
          ))}
        </group>
      )}

      {/* 4DX Thunder Arena Ceiling: Layered Hexagonal Acoustic Baffles, Overhead Mist Diffusers, Concealed Strobe Panels & Warm Amber Cove Lighting */}
      {ceilingLightStyle === 'emerald_cloud_4dx' && (
        <group>
          {/* Warm Amber Longitudinal Perimeter Cove Channels */}
          {[-W * 0.42, W * 0.42].map((lx, li) => (
            <group key={`thunder-amber-cove-${li}`} position={[lx, H - 0.26, 0]}>
              <mesh material={materials.obsidianRevealMat}>
                <boxGeometry args={[0.24, 0.08, L - 2.2]} />
              </mesh>
              <mesh position={[0, -0.042, 0]}>
                <boxGeometry args={[0.075, 0.03, L - 2.4]} />
                <meshStandardMaterial
                  color="#1c1104"
                  emissive={lightingProfile.wallColor}
                  emissiveIntensity={wallAccentIntensity * 1.18}
                  roughness={0.2}
                />
              </mesh>
            </group>
          ))}

          {/* Sculpted Layered Hexagonal Acoustic Baffles + Integrated Mist Diffusers & Concealed Strobe Panels */}
          {Array.from({ length: 6 }, (_, iz) => {
            const cz = frontZ + 2.8 + iz * ((L - 5.6) / 5);
            const rowOffset = iz % 2 === 0 ? 0 : W * 0.11;
            return (
              <group key={`thunder-hex-row-${iz}`}>
                {[-W * 0.32, -W * 0.11, W * 0.11, W * 0.32].map((hxBase, ix) => {
                  const hx = THREE.MathUtils.clamp(hxBase + rowOffset * 0.45, -W * 0.37, W * 0.37);
                  const isLayer2 = (iz + ix) % 2 === 0;
                  const hexY = H - (isLayer2 ? 0.42 : 0.3);
                  const hexRadius = isLayer2 ? 1.05 : 1.24;
                  const hexMat =
                    (iz + ix) % 3 === 0
                      ? materials.bronzeBaffleMat
                      : (iz + ix) % 3 === 1
                        ? materials.titaniumBaffleMat
                        : materials.obsidianRevealMat;
                  return (
                    <group key={`thunder-hex-${iz}-${ix}`} position={[hx, hexY, cz]}>
                      {/* Layered Hexagonal Acoustic Baffle Tile */}
                      <mesh rotation={[0, Math.PI / 6, 0]} material={hexMat}>
                        <cylinderGeometry args={[hexRadius, hexRadius, 0.14, 6]} />
                      </mesh>
                      {/* Warm Amber Recessed Cove Halo Above Layer 2 Hex Baffles */}
                      {isLayer2 && (
                        <mesh position={[0, 0.085, 0]} rotation={[0, Math.PI / 6, 0]}>
                          <cylinderGeometry args={[hexRadius * 0.92, hexRadius * 0.92, 0.025, 6]} />
                          <meshStandardMaterial
                            color="#1c1104"
                            emissive="#f59e0b"
                            emissiveIntensity={wallAccentIntensity * 0.92}
                            roughness={0.22}
                          />
                        </mesh>
                      )}
                      {/* Integrated Overhead Mist Diffuser Ring */}
                      {(ix === 1 || ix === 2) && (
                        <group position={[0, -0.082, 0]}>
                          <mesh material={materials.brushedAluminumMat}>
                            <cylinderGeometry args={[0.16, 0.18, 0.03, 14]} />
                          </mesh>
                          <mesh position={[0, -0.02, 0]} material={materials.speakerMat}>
                            <cylinderGeometry args={[0.11, 0.11, 0.02, 12]} />
                          </mesh>
                        </group>
                      )}
                    </group>
                  );
                })}

                {/* Concealed Overhead Strobe Light Panels Tucked Between Hexagonal Layers */}
                {[-W * 0.21, W * 0.21].map((sx, si) => (
                  <group key={`thunder-concealed-strobe-${iz}-${si}`} position={[sx, H - 0.24, cz + 0.95]}>
                    <mesh material={materials.obsidianRevealMat}>
                      <boxGeometry args={[0.82, 0.04, 0.24]} />
                    </mesh>
                    <mesh position={[0, -0.022, 0]}>
                      <boxGeometry args={[0.68, 0.016, 0.14]} />
                      <meshStandardMaterial
                        color="#141820"
                        emissive="#f8fafc"
                        emissiveIntensity={lightFactor * 0.35}
                        roughness={0.18}
                      />
                    </mesh>
                  </group>
                ))}
              </group>
            );
          })}
        </group>
      )}

      {/* 4DX Crimson Velocity Exposed Industrial Acoustic Ceiling Truss Grid: Rain-Mist Nozzles, Lightning Strobe Bars & Linear Red/Cyan LED Channels */}
      {ceilingLightStyle === 'industrial_4dx_truss' && (
        <group>
          {/* Longitudinal Exposed Dark Steel Box Trusses */}
          {[-W * 0.36, -W * 0.22, 0, W * 0.22, W * 0.36].map((tx, ti) => (
            <group key={`4dx-long-truss-${ti}`} position={[tx, H - 0.46, 0]}>
              {[-0.12, 0.12].map((cx, ci) => (
                <mesh key={`long-chord-${ci}`} position={[cx, 0, 0]} material={materials.nosingMat}>
                  <boxGeometry args={[0.048, 0.075, L - 2.4]} />
                </mesh>
              ))}
              {Array.from({ length: 14 }, (_, wi) => (
                <mesh
                  key={`long-web-${wi}`}
                  position={[0, 0, frontZ + 1.8 + wi * ((L - 3.6) / 13)]}
                  material={materials.trimMetalMat}
                >
                  <boxGeometry args={[0.28, 0.042, 0.048]} />
                </mesh>
              ))}
            </group>
          ))}

          {/* Transverse Exposed Acoustic Lattice Trusses + Rain-Mist Nozzles + Lightning Strobe Bars */}
          {Array.from({ length: 6 }, (_, i) => {
            const tz = frontZ + 2.8 + i * ((L - 5.4) / 5);
            return (
              <group key={`4dx-trans-truss-${i}`} position={[0, H - 0.44, tz]}>
                {/* Upper & Lower Steel Truss Chords */}
                {[-0.12, 0.12].map((dy, di) => (
                  <mesh key={`trans-chord-${di}`} position={[0, dy, 0]} material={materials.nosingMat}>
                    <boxGeometry args={[W - 1.2, 0.055, 0.16]} />
                  </mesh>
                ))}
                {/* Diagonal Web Braces */}
                {Array.from({ length: 10 }, (_, bi) => (
                  <mesh
                    key={`trans-brace-${bi}`}
                    position={[-W * 0.4 + bi * ((W * 0.8) / 9), 0, 0]}
                    rotation={[0, 0, bi % 2 === 0 ? 0.55 : -0.55]}
                    material={materials.trimMetalMat}
                  >
                    <boxGeometry args={[0.04, 0.28, 0.06]} />
                  </mesh>
                ))}

                {/* Fitted Overhead Rain-Mist Nozzle Manifolds Above Pod Lanes */}
                {[-W * 0.3, 0, W * 0.3].map((nx, ni) => (
                  <group key={`rain-mist-${ni}`} position={[nx, -0.18, 0]}>
                    <mesh material={materials.trimMetalMat}>
                      <boxGeometry args={[1.15, 0.05, 0.05]} />
                    </mesh>
                    {[-0.36, 0, 0.36].map((mx, mi) => (
                      <mesh key={`mist-tip-${mi}`} position={[mx, -0.065, 0]} material={materials.projectorChromeMat}>
                        <cylinderGeometry args={[0.016, 0.032, 0.09, 10]} />
                      </mesh>
                    ))}
                  </group>
                ))}

                {/* Mounted Overhead Lightning Strobe Light Bars */}
                {[-W * 0.16, W * 0.16].map((sx, si) => (
                  <group key={`strobe-bar-${si}`} position={[sx, -0.16, 0.14]}>
                    <mesh material={materials.nosingMat}>
                      <boxGeometry args={[1.28, 0.075, 0.11]} />
                    </mesh>
                    <mesh position={[0, -0.04, 0]}>
                      <boxGeometry args={[1.12, 0.025, 0.065]} />
                      <meshStandardMaterial
                        color="#101826"
                        emissive="#bae6fd"
                        emissiveIntensity={lightFactor * 0.45}
                        roughness={0.18}
                      />
                    </mesh>
                  </group>
                ))}
              </group>
            );
          })}

          {/* Linear Red & Cyan LED Accent Channels Integrated Along Ceiling Truss Perimeter */}
          {[-W * 0.36, W * 0.36].map((lx, li) => (
            <group key={`4dx-ceil-red-led-${li}`} position={[lx, H - 0.52, 0]}>
              <mesh material={materials.nosingMat}>
                <boxGeometry args={[0.1, 0.04, L - 2.6]} />
              </mesh>
              <mesh position={[0, -0.022, 0]}>
                <boxGeometry args={[0.044, 0.022, L - 2.7]} />
                <meshStandardMaterial
                  color="#14080a"
                  emissive={lightingProfile.wallColor}
                  emissiveIntensity={wallAccentIntensity * 1.15}
                  roughness={0.2}
                />
              </mesh>
            </group>
          ))}
          {[-W * 0.11, W * 0.11].map((cx, ci) => (
            <group key={`4dx-ceil-cyan-led-${ci}`} position={[cx, H - 0.52, 0]}>
              <mesh material={materials.nosingMat}>
                <boxGeometry args={[0.09, 0.04, L - 2.8]} />
              </mesh>
              <mesh position={[0, -0.022, 0]}>
                <boxGeometry args={[0.04, 0.022, L - 2.9]} />
                <meshStandardMaterial
                  color="#08141a"
                  emissive={lightingProfile.ceilingColor}
                  emissiveIntensity={wallAccentIntensity * 1.1}
                  roughness={0.2}
                />
              </mesh>
            </group>
          ))}
        </group>
      )}

      {/* ICE Flagship Ceiling: Faceted Origami-Inspired Dark Acoustic Baffles, Hidden Cyan-White Indirect Coves & Pin-Spot Downlights */}
      {(ceilingLightStyle === 'ice_origami_baffles' || ceilingLightStyle === 'ice_truss_ribs') && (
        <group>
          {/* Faceted Origami-Inspired Folded Acoustic Baffle Chevron Pairs */}
          {Array.from({ length: 7 }, (_, i) => {
            const bz = frontZ + 2.8 + i * ((L - 5.6) / 6);
            return (
              <group key={`ice-origami-row-${i}`} position={[0, H - 0.34, bz]}>
                {[-1, 1].map((side) => (
                  <group key={`origami-wing-${side}`}>
                    <mesh
                      position={[side * (W * 0.22), 0.02, 0]}
                      rotation={[side * 0.14, 0, side * -0.18]}
                      material={materials.acousticPanelMat}
                    >
                      <boxGeometry args={[W * 0.44, 0.12, 1.85]} />
                    </mesh>
                    {/* Crisp Folded Outer Wing */}
                    <mesh
                      position={[side * (W * 0.4), -0.05, 0.18]}
                      rotation={[-side * 0.1, 0, side * 0.22]}
                      material={materials.cleftSlateMat}
                    >
                      <boxGeometry args={[W * 0.18, 0.1, 1.6]} />
                    </mesh>
                  </group>
                ))}
                {/* Recessed Hidden Linear Cyan-White Indirect Cove Strip Along Baffle Fold Ridge */}
                <mesh position={[0, -0.05, 0]}>
                  <boxGeometry args={[W - 2.6, 0.025, 0.045]} />
                  <meshStandardMaterial
                    color="#09161b"
                    emissive={lightingProfile.ceilingColor}
                    emissiveIntensity={wallAccentIntensity * 0.72}
                    roughness={0.22}
                  />
                </mesh>
              </group>
            );
          })}
          {/* Side Perimeter Cyan-White Indirect Ceiling Cove Lines */}
          {[-1, 1].map((side) => (
            <mesh
              key={`ice-origami-perim-${side}`}
              position={[side * (W / 2 - 0.44), H - 0.24, 0]}
            >
              <boxGeometry args={[0.04, 0.022, L - 2.6]} />
              <meshStandardMaterial
                color="#09161b"
                emissive={lightingProfile.ceilingColor}
                emissiveIntensity={wallAccentIntensity * 0.75}
                roughness={0.22}
              />
            </mesh>
          ))}
          {/* Subtle Pin-Spot Ceiling Downlights */}
          {[-W * 0.28, W * 0.28].map((px, xi) =>
            [-L * 0.26, -L * 0.08, L * 0.1, L * 0.28].map((pz, zi) => (
              <mesh key={`ice-origami-pin-${xi}-${zi}`} position={[px, H - 0.28, pz]}>
                <cylinderGeometry args={[0.05, 0.05, 0.03, 14]} />
                <meshStandardMaterial
                  color="#182028"
                  emissive={lightingProfile.ceilingColor}
                  emissiveIntensity={ceilingPuckIntensity * 0.75}
                />
              </mesh>
            )),
          )}
        </group>
      )}

      {/* ICE Cobalt Grand Ceiling: Sweeping Wave-Contoured Undulating Timber-and-Fabric Acoustic Fins, Warm-Ivory Coves & Pinpoint Downlights */}
      {ceilingLightStyle === 'ice_wave_timber_fins' && (
        <group>
          {Array.from({ length: 18 }, (_, i) => {
            const u = i / 17;
            const fz = frontZ + 2.0 + u * (L - 4.0);
            const waveDip = Math.sin(u * Math.PI * 2.5) * 0.14;
            const isTimber = i % 2 === 0;
            return (
              <group key={`ice-wave-fin-${i}`} position={[0, H - 0.34 + waveDip, fz]}>
                {/* Undulating Transverse Acoustic Fin */}
                <mesh material={isTimber ? materials.walnutCofferMat : materials.acousticPanelMat}>
                  <boxGeometry args={[W - 1.2, 0.24, 0.16]} />
                </mesh>
                {/* Gently Arched Side Wing Extensions Following Sweeping Wave Profile */}
                {[-1, 1].map((side) => (
                  <mesh
                    key={`wave-wing-${side}`}
                    position={[side * (W * 0.42), 0.08, 0]}
                    rotation={[0, 0, side * 0.18]}
                    material={isTimber ? materials.walnutCofferMat : materials.acousticPanelMat}
                  >
                    <boxGeometry args={[W * 0.18, 0.18, 0.15]} />
                  </mesh>
                ))}
              </group>
            );
          })}
          {/* Soft Warm-Ivory Indirect Perimeter Cove Lighting */}
          {[-1, 1].map((side) => (
            <mesh
              key={`ice-wave-cove-${side}`}
              position={[side * (W / 2 - 0.48), H - 0.23, 0]}
            >
              <boxGeometry args={[0.045, 0.025, L - 2.6]} />
              <meshStandardMaterial
                color="#1c160c"
                emissive={lightingProfile.ceilingColor}
                emissiveIntensity={wallAccentIntensity * 0.85}
                roughness={0.22}
              />
            </mesh>
          ))}
          {/* Recessed Pinpoint Ceiling Downlights */}
          {[-W * 0.26, 0, W * 0.26].map((px, xi) =>
            [-L * 0.26, -L * 0.08, L * 0.1, L * 0.28].map((pz, zi) => (
              <mesh key={`ice-wave-pin-${xi}-${zi}`} position={[px, H - 0.22, pz]}>
                <cylinderGeometry args={[0.048, 0.048, 0.028, 14]} />
                <meshStandardMaterial
                  color="#1d1810"
                  emissive={lightingProfile.ceilingColor}
                  emissiveIntensity={ceilingPuckIntensity * 0.82}
                />
              </mesh>
            )),
          )}
        </group>
      )}

      {/* ICE Obsidian Amber Ceiling: Cathedral-Stepped Layered Matte-Black Acoustic Coffers, Warm-Ivory Indirect Cove Lines & Soft Pin-Spots */}
      {ceilingLightStyle === 'ice_cathedral_coffers' && (
        <group>
          {/* Three Ascending Stepped Cathedral Coffer Tiers Framing Central Ceiling Vault */}
          {[
            { inset: 0.45, yOff: -0.54, thick: 0.28, mat: materials.cleftSlateMat, glowW: W - 1.2, glowL: L - 2.2 },
            { inset: 2.35, yOff: -0.36, thick: 0.24, mat: materials.acousticPanelMat, glowW: W - 5.0, glowL: L - 5.6 },
            { inset: 4.35, yOff: -0.2, thick: 0.18, mat: materials.stageMat, glowW: W - 9.0, glowL: L - 9.2 },
          ].map((step, si) => {
            const frameW = W - step.inset * 2;
            const frameL = L - 1.6 - step.inset * 1.1;
            const beamThick = 0.45;
            return (
              <group key={`cathedral-step-${si}`} position={[0, H + step.yOff, 0]}>
                {/* Left & Right Coffer Side Beams */}
                {[-1, 1].map((side) => (
                  <mesh
                    key={`cath-side-${side}`}
                    position={[side * (frameW * 0.5 - beamThick * 0.5), 0, 0]}
                    material={step.mat}
                  >
                    <boxGeometry args={[beamThick, step.thick, frameL]} />
                  </mesh>
                ))}
                {/* Front & Rear Transverse Coffer Beams */}
                {[-1, 1].map((fb) => (
                  <mesh
                    key={`cath-fb-${fb}`}
                    position={[0, 0, fb * (frameL * 0.5 - beamThick * 0.5)]}
                    material={step.mat}
                  >
                    <boxGeometry args={[frameW, step.thick, beamThick]} />
                  </mesh>
                ))}
                {/* Subtle Warm-Ivory Indirect Cove Strip Tucked Under Inner Step Lip */}
                {[-1, 1].map((side) => (
                  <mesh
                    key={`cath-cove-side-${side}`}
                    position={[side * (step.glowW * 0.5 - 0.12), -step.thick * 0.35, 0]}
                  >
                    <boxGeometry args={[0.028, 0.018, step.glowL]} />
                    <meshStandardMaterial
                      color="#1b1812"
                      emissive={lightingProfile.ceilingColor}
                      emissiveIntensity={wallAccentIntensity * 0.72}
                      roughness={0.24}
                    />
                  </mesh>
                ))}
              </group>
            );
          })}
          {/* Soft Pin-Spot Downlights Along Lower Cathedral Coffer Shoulders */}
          {[-W * 0.32, W * 0.32].map((px, xi) =>
            [-L * 0.28, -L * 0.09, L * 0.1, L * 0.28].map((pz, zi) => (
              <mesh key={`ice-cath-pin-${xi}-${zi}`} position={[px, H - 0.68, pz]}>
                <cylinderGeometry args={[0.048, 0.048, 0.025, 14]} />
                <meshStandardMaterial
                  color="#181715"
                  emissive={lightingProfile.ceilingColor}
                  emissiveIntensity={ceilingPuckIntensity * 0.72}
                />
              </mesh>
            )),
          )}
        </group>
      )}



      {/* IMAX Cobalt Horizon Ceiling: Recessed Starlight Pin-Spot Downlights, Linear Blue Cove Channels & Speaker Rigging Trusses */}
      {ceilingLightStyle === 'imax_starlight_coves' && (
        <group>
          {/* Matte Obsidian Acoustic Ceiling Baffle Beams */}
          {Array.from({ length: 7 }, (_, i) => (
            <mesh
              key={`imax-baffle-${i}`}
              position={[0, H - 0.3, frontZ + 2.5 + i * ((L - 5.0) / 6)]}
              material={materials.stageMat}
            >
              <boxGeometry args={[W - 0.6, 0.24, 0.28]} />
            </mesh>
          ))}

          {/* Twin Longitudinal Dark Steel IMAX Ceiling Speaker Rigging Trusses (aligned above overhead speakers at ±0.22W) */}
          {[-W * 0.22, W * 0.22].map((tx, ti) => (
            <group key={`imax-rig-truss-${ti}`} position={[tx, H - 0.54, 0]}>
              {[-0.14, 0.14].map((cx, ci) => (
                <mesh key={`imax-chord-${ci}`} position={[cx, 0, 0]} material={materials.nosingMat}>
                  <boxGeometry args={[0.055, 0.08, L - 3.6]} />
                </mesh>
              ))}
              {Array.from({ length: 14 }, (_, wi) => (
                <mesh
                  key={`imax-web-${wi}`}
                  position={[0, 0, frontZ + 2.4 + wi * ((L - 4.8) / 13)]}
                  material={materials.trimMetalMat}
                >
                  <boxGeometry args={[0.32, 0.045, 0.055]} />
                </mesh>
              ))}
            </group>
          ))}

          {/* Signature Linear Electric Cobalt-Blue & Cyan Ceiling Cove Channels */}
          {[-W * 0.42, -W * 0.13, W * 0.13, W * 0.42].map((lx, li) => (
            <group key={`imax-blue-cove-${li}`} position={[lx, H - 0.24, 0]}>
              <mesh material={materials.nosingMat}>
                <boxGeometry args={[0.16, 0.07, L - 2.4]} />
              </mesh>
              <mesh position={[0, -0.028, 0]}>
                <boxGeometry args={[0.06, 0.03, L - 2.6]} />
                <meshStandardMaterial
                  color="#0a1224"
                  emissive={li === 0 || li === 3 ? lightingProfile.wallColor : lightingProfile.accentColor}
                  emissiveIntensity={wallAccentIntensity * 1.15}
                  roughness={0.2}
                />
              </mesh>
            </group>
          ))}

          {/* Cross-Hall Rear & Mid Linear Blue Cove Accent Strips */}
          {[-L * 0.34, 0, L * 0.34].map((cz, czi) => (
            <group key={`imax-cross-cove-${czi}`} position={[0, H - 0.24, cz]}>
              <mesh material={materials.nosingMat}>
                <boxGeometry args={[W * 0.84, 0.06, 0.14]} />
              </mesh>
              <mesh position={[0, -0.025, 0]}>
                <boxGeometry args={[W * 0.82, 0.028, 0.05]} />
                <meshStandardMaterial
                  color="#0a1224"
                  emissive={lightingProfile.ceilingColor}
                  emissiveIntensity={wallAccentIntensity * 0.88}
                  roughness={0.2}
                />
              </mesh>
            </group>
          ))}

          {/* Recessed Starlight-Style Pin-Spot Downlights Across Dark Acoustic Ceiling */}
          {[-W * 0.32, -W * 0.16, 0, W * 0.16, W * 0.32].map((dx, di) =>
            [-L * 0.34, -L * 0.17, 0, L * 0.17, L * 0.34].map((dz, dzi) => (
              <group key={`imax-pinspot-${di}-${dzi}`} position={[dx, H - 0.205, dz]}>
                <mesh rotation={[Math.PI / 2, 0, 0]} material={materials.nosingMat}>
                  <ringGeometry args={[0.05, 0.09, 14]} />
                </mesh>
                <mesh position={[0, -0.004, 0]} rotation={[Math.PI / 2, 0, 0]}>
                  <circleGeometry args={[0.05, 14]} />
                  <meshStandardMaterial
                    color="#090d16"
                    emissive={(di + dzi) % 2 === 0 ? '#dbeafe' : '#60a5fa'}
                    emissiveIntensity={ceilingPuckIntensity * 1.1}
                  />
                </mesh>
              </group>
            )),
          )}
        </group>
      )}

      {/* IMAX Polar Aurora Ceiling: Clean Hexagonal-and-Linear Acoustic Panel Layout, Overhead IMAX Speakers, Soft Recessed Pin-Spot Downlights & Subtle Cool-Blue Perimeter Cove */}
      {ceilingLightStyle === 'imax_angular_grid' && (
        <group>
          {/* Longitudinal & Transverse Linear Acoustic Ceiling Ribs */}
          {[-W * 0.3, -W * 0.1, W * 0.1, W * 0.3].map((rx, ri) => (
            <mesh key={`aurora-ceil-rib-x-${ri}`} position={[rx, H - 0.19, 0]} material={materials.nosingMat}>
              <boxGeometry args={[0.14, 0.11, L - 2.2]} />
            </mesh>
          ))}
          {[-L * 0.36, -L * 0.18, 0, L * 0.18, L * 0.36].map((rz, ri) => (
            <mesh key={`aurora-ceil-rib-z-${ri}`} position={[0, H - 0.19, rz]} material={materials.trimMetalMat}>
              <boxGeometry args={[W - 1.4, 0.1, 0.12]} />
            </mesh>
          ))}

          {/* Symmetrical Beveled Hexagonal Acoustic Ceiling Panels */}
          {auroraHexCeilingGeo &&
            [-W * 0.2, 0, W * 0.2].map((hx, hi) =>
              [-L * 0.27, -L * 0.09, L * 0.09, L * 0.27].map((hz, hzi) => (
                <mesh
                  key={`aurora-ceil-hex-${hi}-${hzi}`}
                  position={[hx, H - 0.13, hz]}
                  geometry={auroraHexCeilingGeo}
                  material={materials.acousticPanelMat}
                  receiveShadow
                />
              )),
            )}

          {/* Subtle Cool-Blue Perimeter Cove Lighting (Left, Right, Front, Rear) */}
          {[-1, 1].map((side) => (
            <group key={`aurora-perim-x-${side}`} position={[side * (W / 2 - 0.5), H - 0.22, 0]}>
              <mesh material={materials.nosingMat}>
                <boxGeometry args={[0.14, 0.045, L - 1.5]} />
              </mesh>
              <mesh position={[0, -0.022, 0]}>
                <boxGeometry args={[0.045, 0.022, L - 1.7]} />
                <meshStandardMaterial
                  color="#0a1224"
                  emissive="#3b82f6"
                  emissiveIntensity={wallAccentIntensity * 0.88}
                  roughness={0.2}
                />
              </mesh>
            </group>
          ))}
          {[-1, 1].map((end) => (
            <group key={`aurora-perim-z-${end}`} position={[0, H - 0.22, end * (L / 2 - 0.85)]}>
              <mesh material={materials.nosingMat}>
                <boxGeometry args={[W - 1.0, 0.045, 0.14]} />
              </mesh>
              <mesh position={[0, -0.022, 0]}>
                <boxGeometry args={[W - 1.15, 0.022, 0.045]} />
                <meshStandardMaterial
                  color="#0a1224"
                  emissive="#3b82f6"
                  emissiveIntensity={wallAccentIntensity * 0.88}
                  roughness={0.2}
                />
              </mesh>
            </group>
          ))}

          {/* Soft Recessed Pin-Spot Downlights */}
          {[-W * 0.3, -W * 0.1, W * 0.1, W * 0.3].map((dx, di) =>
            [-L * 0.36, -L * 0.18, 0, L * 0.18, L * 0.36].map((dz, dzi) => (
              <group key={`aurora-pinspot-${di}-${dzi}`} position={[dx, H - 0.25, dz]}>
                <mesh rotation={[Math.PI / 2, 0, 0]} material={materials.nosingMat}>
                  <ringGeometry args={[0.045, 0.082, 14]} />
                </mesh>
                <mesh position={[0, -0.004, 0]} rotation={[Math.PI / 2, 0, 0]}>
                  <circleGeometry args={[0.045, 14]} />
                  <meshStandardMaterial
                    color="#090d16"
                    emissive="#e2e8f0"
                    emissiveIntensity={ceilingPuckIntensity * 1.02}
                  />
                </mesh>
              </group>
            )),
          )}
        </group>
      )}

      {/* IMAX Obsidian Amber Ceiling: Clean Stepped Transverse Acoustic Beams, Overhead IMAX Speakers, Soft Recessed Pin-Spot Downlights & Subtle Cyan Perimeter Cove */}
      {ceilingLightStyle === 'imax_v_baffle_grid' && (
        <group>
          {/* Clean Stepped Transverse Acoustic Beams */}
          {Array.from({ length: 7 }, (_, i) => {
            const bz = frontZ + 2.6 + i * ((L - 5.2) / 6);
            return (
              <group key={`amber-stepped-beam-${i}`} position={[0, H - 0.22, bz]}>
                {/* Upper Wide Acoustic Flange */}
                <mesh position={[0, 0.07, 0]} material={materials.acousticPanelMat}>
                  <boxGeometry args={[W - 0.85, 0.14, 0.44]} />
                </mesh>
                {/* Lower Narrower Stepped Soffit Beam */}
                <mesh position={[0, -0.06, 0]} material={materials.stageMat}>
                  <boxGeometry args={[W - 1.15, 0.14, 0.22]} />
                </mesh>
              </group>
            );
          })}

          {/* Subtle Cyan Perimeter Cove Lighting (Left, Right, Front, Rear) */}
          {[-1, 1].map((side) => (
            <group key={`amber-perim-x-${side}`} position={[side * (W / 2 - 0.48), H - 0.22, 0]}>
              <mesh material={materials.nosingMat}>
                <boxGeometry args={[0.14, 0.045, L - 1.6]} />
              </mesh>
              <mesh position={[0, -0.022, 0]}>
                <boxGeometry args={[0.042, 0.02, L - 1.8]} />
                <meshStandardMaterial
                  color="#06181e"
                  emissive="#22d3ee"
                  emissiveIntensity={wallAccentIntensity * 0.85}
                  roughness={0.2}
                />
              </mesh>
            </group>
          ))}
          {[-1, 1].map((end) => (
            <group key={`amber-perim-z-${end}`} position={[0, H - 0.22, end * (L / 2 - 0.88)]}>
              <mesh material={materials.nosingMat}>
                <boxGeometry args={[W - 1.0, 0.045, 0.14]} />
              </mesh>
              <mesh position={[0, -0.022, 0]}>
                <boxGeometry args={[W - 1.2, 0.02, 0.042]} />
                <meshStandardMaterial
                  color="#06181e"
                  emissive="#22d3ee"
                  emissiveIntensity={wallAccentIntensity * 0.85}
                  roughness={0.2}
                />
              </mesh>
            </group>
          ))}

          {/* Soft Recessed Pin-Spot Downlights Centered Between Stepped Transverse Beams */}
          {[-W * 0.3, 0, W * 0.3].map((dx, di) =>
            Array.from({ length: 6 }, (_, bIdx) => {
              const stepZ = (L - 5.2) / 6;
              const dz = frontZ + 2.6 + (bIdx + 0.5) * stepZ;
              return (
                <group key={`amber-pinspot-${di}-${bIdx}`} position={[dx, H - 0.16, dz]}>
                  <mesh rotation={[Math.PI / 2, 0, 0]} material={materials.nosingMat}>
                    <ringGeometry args={[0.044, 0.08, 14]} />
                  </mesh>
                  <mesh position={[0, -0.004, 0]} rotation={[Math.PI / 2, 0, 0]}>
                    <circleGeometry args={[0.044, 14]} />
                    <meshStandardMaterial
                      color="#12100c"
                      emissive="#fef3c7"
                      emissiveIntensity={ceilingPuckIntensity * 0.96}
                    />
                  </mesh>
                </group>
              );
            }),
          )}
        </group>
      )}

      {/* ScreenX Obsidian Panorama Ceiling: Dark Geometric Grid of Acoustic Tiles Accented by Laser-Thin Deep-Cyan Linear LED Channels */}
      {ceilingLightStyle === 'screenx_cyan_grid' && (
        <group>
          {/* Dark Geometric Acoustic Grid Beams (Longitudinal & Transverse) */}
          {[-W * 0.375, -W * 0.125, W * 0.125, W * 0.375].map((gx, gi) => (
            <group key={`sx-grid-x-${gi}`} position={[gx, H - 0.25, 0]}>
              <mesh material={materials.matteTitaniumMat}>
                <boxGeometry args={[0.14, 0.1, L - 1.2]} />
              </mesh>
              {/* Recessed Laser-Thin Deep-Cyan Linear LED Channel */}
              <mesh position={[0, -0.052, 0]}>
                <boxGeometry args={[0.016, 0.012, L - 1.3]} />
                <meshStandardMaterial
                  color="#031922"
                  emissive="#06b6d4"
                  emissiveIntensity={0.22 + wallAccentIntensity * 0.95}
                  toneMapped={false}
                  roughness={0.18}
                />
              </mesh>
            </group>
          ))}
          {[-L * 0.36, -L * 0.18, 0, L * 0.18, L * 0.36].map((gz, gi) => (
            <group key={`sx-grid-z-${gi}`} position={[0, H - 0.25, gz]}>
              <mesh material={materials.matteTitaniumMat}>
                <boxGeometry args={[W - 0.6, 0.1, 0.14]} />
              </mesh>
              {/* Recessed Laser-Thin Deep-Cyan Transverse LED Channel */}
              <mesh position={[0, -0.052, 0]}>
                <boxGeometry args={[W - 0.7, 0.012, 0.016]} />
                <meshStandardMaterial
                  color="#031922"
                  emissive="#06b6d4"
                  emissiveIntensity={0.22 + wallAccentIntensity * 0.95}
                  toneMapped={false}
                  roughness={0.18}
                />
              </mesh>
            </group>
          ))}

          {/* Recessed Dark Geometric Acoustic Tile Bays Between Channels */}
          {[-W * 0.25, 0, W * 0.25].map((tx, xi) =>
            [-L * 0.27, -L * 0.09, L * 0.09, L * 0.27].map((tz, zi) => (
              <mesh
                key={`sx-ceil-tile-${xi}-${zi}`}
                position={[tx, H - 0.205, tz]}
                material={materials.obsidianRevealMat}
                receiveShadow
              >
                <boxGeometry args={[W * 0.21, 0.032, L * 0.155]} />
              </mesh>
            )),
          )}

          {/* Subtle Perimeter Laser-Thin Deep-Cyan Edge Channels Tracing Top of ScreenX Walls */}
          {[-1, 1].map((side) => (
            <mesh key={`sx-perim-cyan-${side}`} position={[side * (screenWidth * 0.5 - 0.08), H - 0.23, -0.6]}>
              <boxGeometry args={[0.014, 0.012, L - 1.5]} />
              <meshStandardMaterial
                color="#031922"
                emissive="#06b6d4"
                emissiveIntensity={0.18 + wallAccentIntensity * 0.85}
                toneMapped={false}
                roughness={0.18}
              />
            </mesh>
          ))}
        </group>
      )}

      {/* ScreenX Multiplex 400 Ceiling: Matte-Black Acoustic Stepped Tray Ceiling, Recessed Dual-Laser Side Projection Pods, Flush Atmos & Pin-Spot Downlights */}
      {ceilingLightStyle === 'screenx_stepped_tray_pods' && (
        <group>
          {/* Outer Matte-Black Stepped Drop Perimeter Soffits */}
          {[-1, 1].map((side) => (
            <mesh
              key={`sx400-tray-outer-x-${side}`}
              position={[side * (W * 0.43), H - 0.38, 0]}
              material={materials.stageMat}
              receiveShadow
            >
              <boxGeometry args={[W * 0.14, 0.44, L - 0.4]} />
            </mesh>
          ))}
          {[-1, 1].map((end) => (
            <mesh
              key={`sx400-tray-outer-z-${end}`}
              position={[0, H - 0.38, end * (L * 0.44)]}
              material={materials.stageMat}
              receiveShadow
            >
              <boxGeometry args={[W * 0.74, 0.44, L * 0.12]} />
            </mesh>
          ))}

          {/* Second Inner Stepped Acoustic Tray Coffers */}
          {[-W * 0.28, W * 0.28].map((tx, ti) => (
            <mesh
              key={`sx400-tray-step-x-${ti}`}
              position={[tx, H - 0.24, 0]}
              material={materials.stageMat}
              receiveShadow
            >
              <boxGeometry args={[W * 0.14, 0.22, L * 0.78]} />
            </mesh>
          ))}
          {[-L * 0.34, -L * 0.17, 0, L * 0.17, L * 0.34].map((tz, ti) => (
            <mesh
              key={`sx400-tray-step-z-${ti}`}
              position={[0, H - 0.24, tz]}
              material={materials.obsidianRevealMat}
              receiveShadow
            >
              <boxGeometry args={[W * 0.74, 0.22, 0.48]} />
            </mesh>
          ))}

          {/* Recessed Commercial Dual-Laser Projection Pods Aimed at 2/3 Panoramic Side Screens */}
          {[-1, 1].map((side) =>
            [-L * 0.34, -L * 0.2, -L * 0.06, L * 0.08].map((pz, pi) => (
              <group
                key={`sx400-laser-pod-${side}-${pi}`}
                position={[side * (W * 0.265), H - 0.34, pz]}
              >
                {/* Recessed Matte-Black Ceiling Pocket Trim */}
                <mesh position={[0, 0.04, 0]} material={materials.obsidianRevealMat}>
                  <boxGeometry args={[1.12, 0.12, 1.38]} />
                </mesh>
                {/* Commercial Dual-Laser Optical Projector Chassis Aimed Outward/Downward Toward Opposite/Flanking Side Screen */}
                <group
                  position={[0, -0.06, 0]}
                  rotation={[0.04, side * -1.18, side * 0.24]}
                >
                  <mesh material={materials.laserPodBodyMat} castShadow>
                    <boxGeometry args={[0.62, 0.26, 0.82]} />
                  </mesh>
                  {/* Heat-Sink Side Louvers */}
                  {[-0.32, 0.32].map((lx, li) => (
                    <mesh key={`pod-vent-${li}`} position={[lx, 0, 0]} material={materials.nosingMat}>
                      <boxGeometry args={[0.03, 0.18, 0.62]} />
                    </mesh>
                  ))}
                  {/* Twin Cylindrical Dual-Laser Optical Lens Barrels */}
                  {[-0.14, 0.14].map((ox, oi) => (
                    <group key={`pod-lens-${oi}`} position={[ox, -0.02, 0.44]}>
                      <mesh rotation={[Math.PI / 2, 0, 0]} material={materials.projectorChromeMat}>
                        <cylinderGeometry args={[0.072, 0.082, 0.14, 16]} />
                      </mesh>
                      <mesh position={[0, 0, 0.072]} rotation={[Math.PI / 2, 0, 0]}>
                        <cylinderGeometry args={[0.056, 0.056, 0.015, 16]} />
                        <meshStandardMaterial
                          color="#0c2648"
                          emissive="#60a5fa"
                          emissiveIntensity={lensEmissiveIntensity}
                          roughness={0.12}
                        />
                      </mesh>
                    </group>
                  ))}
                </group>
              </group>
            )),
          )}

          {/* Recessed Pin-Spot Downlights Across Stepped Matte-Black Ceiling Trays */}
          {[-W * 0.41, -W * 0.145, 0, W * 0.145, W * 0.41].map((dx, di) =>
            [-L * 0.42, -L * 0.255, -L * 0.085, L * 0.085, L * 0.255, L * 0.42].map((dz, dzi) => {
              const onOuterSoffit = Math.abs(dx) > W * 0.35 || Math.abs(dz) > L * 0.37;
              return (
                <group
                  key={`sx400-pinspot-${di}-${dzi}`}
                  position={[dx, onOuterSoffit ? H - 0.602 : H - 0.206, dz]}
                >
                  <mesh rotation={[Math.PI / 2, 0, 0]} material={materials.nosingMat}>
                    <ringGeometry args={[0.042, 0.078, 14]} />
                  </mesh>
                  <mesh position={[0, -0.004, 0]} rotation={[Math.PI / 2, 0, 0]}>
                    <circleGeometry args={[0.042, 14]} />
                    <meshStandardMaterial
                      color="#090c14"
                      emissive="#dbeafe"
                      emissiveIntensity={ceilingPuckIntensity * 0.92}
                    />
                  </mesh>
                </group>
              );
            }),
          )}
        </group>
      )}

      {/* Mandap Heritage 2D Ceiling: Modern Mughal Coffered Layout in Matte-Espresso Acoustic Trays + Recessed Warm-Amber Perimeter Cove Lighting & Pin-Spot Downlights */}
      {ceilingLightStyle === 'mughal_espresso_coffers' && (
        <group>
          {/* Outer Matte-Espresso Perimeter Soffit Frame */}
          {[-1, 1].map((side) => (
            <mesh
              key={`mughal-soffit-x-${side}`}
              position={[side * (W * 0.44), H - 0.36, 0]}
              material={materials.matteEspressoCofferMat}
              receiveShadow
            >
              <boxGeometry args={[W * 0.12, 0.42, L - 0.4]} />
            </mesh>
          ))}
          {[-1, 1].map((end) => (
            <mesh
              key={`mughal-soffit-z-${end}`}
              position={[0, H - 0.36, end * (L * 0.44)]}
              material={materials.matteEspressoCofferMat}
              receiveShadow
            >
              <boxGeometry args={[W * 0.78, 0.42, L * 0.12]} />
            </mesh>
          ))}

          {/* Recessed Warm-Amber Perimeter Cove Lighting Wrapping All Four Ceiling Perimeter Soffits */}
          {[-1, 1].map((side) => (
            <mesh
              key={`mughal-cove-x-${side}`}
              position={[side * (W * 0.376), H - 0.46, 0]}
            >
              <boxGeometry args={[0.048, 0.026, L * 0.76]} />
              <meshStandardMaterial
                color="#422006"
                emissive={lightingProfile.ceilingColor}
                emissiveIntensity={wallAccentIntensity * 1.15}
                toneMapped={false}
                roughness={0.22}
              />
            </mesh>
          ))}
          {[-1, 1].map((end) => (
            <mesh
              key={`mughal-cove-z-${end}`}
              position={[0, H - 0.46, end * (L * 0.376)]}
            >
              <boxGeometry args={[W * 0.75, 0.026, 0.048]} />
              <meshStandardMaterial
                color="#422006"
                emissive={lightingProfile.ceilingColor}
                emissiveIntensity={wallAccentIntensity * 1.15}
                toneMapped={false}
                roughness={0.22}
              />
            </mesh>
          ))}

          {/* Primary Longitudinal & Transverse Matte-Espresso Mughal Coffer Beams */}
          {[-W * 0.25, 0, W * 0.25].map((bx, bi) => (
            <mesh
              key={`mughal-beam-x-${bi}`}
              position={[bx, H - 0.26, 0]}
              material={materials.matteEspressoCofferMat}
              receiveShadow
            >
              <boxGeometry args={[0.38, 0.28, L * 0.78]} />
            </mesh>
          ))}
          {[-L * 0.29, -L * 0.097, L * 0.097, L * 0.29].map((bz, bi) => (
            <mesh
              key={`mughal-beam-z-${bi}`}
              position={[0, H - 0.26, bz]}
              material={materials.matteEspressoCofferMat}
              receiveShadow
            >
              <boxGeometry args={[W * 0.78, 0.28, 0.38]} />
            </mesh>
          ))}

          {/* Deeply Recessed Matte-Espresso Mughal Geometric Octagonal Coffered Acoustic Trays (4×5 Grid) */}
          {[-W * 0.315, -W * 0.125, W * 0.125, W * 0.315].map((tx, xi) =>
            [-L * 0.335, -L * 0.193, 0, L * 0.193, L * 0.335].map((tz, zi) => (
              <group key={`mughal-coffer-bay-${xi}-${zi}`} position={[tx, H - 0.145, tz]}>
                {/* Recessed Matte-Espresso Acoustic Backing Tray */}
                <mesh material={materials.espressoCofferPanelMat} receiveShadow>
                  <boxGeometry args={[W * 0.165, 0.08, L * 0.13]} />
                </mesh>
                {/* Chamfered Mughal Octagonal Geometric Frame Moldings Inside Coffer */}
                {[0, Math.PI / 4].map((rot, ri) => (
                  <mesh
                    key={`mughal-oct-${ri}`}
                    position={[0, -0.048, 0]}
                    rotation={[0, rot, 0]}
                    material={materials.matteEspressoCofferMat}
                  >
                    <cylinderGeometry args={[Math.min(W * 0.068, L * 0.056), Math.min(W * 0.078, L * 0.064), 0.065, 4, 1, true]} />
                  </mesh>
                ))}
              </group>
            )),
          )}

          {/* Recessed Pin-Spot Downlights Positioned Cleanly at Coffer Intersections */}
          {[-W * 0.25, 0, W * 0.25].map((dx, di) =>
            [-L * 0.29, -L * 0.097, L * 0.097, L * 0.29].map((dz, dzi) => (
              <group key={`mughal-pinspot-${di}-${dzi}`} position={[dx, H - 0.402, dz]}>
                <mesh rotation={[Math.PI / 2, 0, 0]} material={materials.darkBronzeTrimMat}>
                  <ringGeometry args={[0.045, 0.082, 14]} />
                </mesh>
                <mesh position={[0, -0.004, 0]} rotation={[Math.PI / 2, 0, 0]}>
                  <circleGeometry args={[0.045, 14]} />
                  <meshStandardMaterial
                    color="#1f140a"
                    emissive="#fff2d6"
                    emissiveIntensity={ceilingPuckIntensity * 0.96}
                  />
                </mesh>
              </group>
            )),
          )}
        </group>
      )}

      {/* Obsidian Wave 550 Ceiling: Suspended Matte-Black Acoustic T-Bar Grid Ceiling with Circular HVAC Diffusers & Recessed Pin-Spot Downlights */}
      {ceilingLightStyle === 'industrial_open_baffle_atmos' && (
        <group>
          {/* Twin Columns of Recessed Circular HVAC Ceiling Air Diffusers */}
          {[-W * 0.11, W * 0.11].map((hx, hi) =>
            [-L * 0.28, -L * 0.08, L * 0.12, L * 0.3].map((hz, hzi) => (
              <group key={`tbar-hvac-${hi}-${hzi}`} position={[hx, H - 0.204, hz]}>
                <mesh material={materials.matteTitaniumMat}>
                  <boxGeometry args={[0.74, 0.014, 0.74]} />
                </mesh>
                <mesh position={[0, -0.008, 0]} rotation={[Math.PI / 2, 0, 0]} material={materials.stageMat}>
                  <ringGeometry args={[0.1, 0.28, 20]} />
                </mesh>
                <mesh position={[0, -0.01, 0]} rotation={[Math.PI / 2, 0, 0]} material={materials.matteTitaniumMat}>
                  <ringGeometry args={[0.17, 0.21, 20]} />
                </mesh>
              </group>
            )),
          )}

          {/* Crisp 4x5 Grid of Recessed Matte-Black Ceiling Pin-Spot Downlights */}
          {[-W * 0.32, -W * 0.11, W * 0.11, W * 0.32].map((dx, di) =>
            [-L * 0.36, -L * 0.18, 0, L * 0.18, L * 0.36].map((dz, dzi) => (
              <group key={`tbar-pinspot-${di}-${dzi}`} position={[dx, H - 0.206, dz]}>
                <mesh rotation={[Math.PI / 2, 0, 0]} material={materials.matteTitaniumMat}>
                  <ringGeometry args={[0.048, 0.085, 16]} />
                </mesh>
                <mesh position={[0, -0.003, 0]} rotation={[Math.PI / 2, 0, 0]}>
                  <circleGeometry args={[0.048, 16]} />
                  <meshStandardMaterial
                    color="#120e1c"
                    emissive="#f8fafc"
                    emissiveIntensity={ceilingPuckIntensity * 1.1}
                    toneMapped={false}
                  />
                </mesh>
              </group>
            )),
          )}
        </group>
      )}
      {/* Sylva Moss 250 Ceiling: Dark Matte-Espresso Acoustic Ceiling Layout with Flush Dolby Atmos Bays & Soft Pin-Spot Downlights */}
      {ceilingLightStyle === 'espresso_biophilic_atmos' && (
        <group>
          {/* Matte-Espresso Perimeter Acoustic Soffit Border */}
          {[-1, 1].map((side) => (
            <mesh
              key={`biophilic-soffit-x-${side}`}
              position={[side * (W * 0.45), H - 0.32, 0]}
              material={materials.matteEspressoCofferMat}
              receiveShadow
            >
              <boxGeometry args={[W * 0.1, 0.34, L - 0.3]} />
            </mesh>
          ))}
          {[-1, 1].map((end) => (
            <mesh
              key={`biophilic-soffit-z-${end}`}
              position={[0, H - 0.32, end * (L * 0.45)]}
              material={materials.matteEspressoCofferMat}
              receiveShadow
            >
              <boxGeometry args={[W * 0.82, 0.34, L * 0.1]} />
            </mesh>
          ))}

          {/* Concealed Soft Warm-Gold Perimeter Edge Halo Inside Espresso Soffit */}
          {[-1, 1].map((side) => (
            <mesh
              key={`biophilic-ceil-halo-x-${side}`}
              position={[side * (W * 0.398), H - 0.39, 0]}
            >
              <boxGeometry args={[0.032, 0.02, L * 0.8]} />
              <meshStandardMaterial
                color="#3b2308"
                emissive={lightingProfile.ceilingColor}
                emissiveIntensity={wallAccentIntensity * 0.72}
                toneMapped={false}
                roughness={0.26}
              />
            </mesh>
          ))}

          {/* Longitudinal Matte-Espresso Acoustic Spine & Flanking Coffer Rails (clear of Atmos speaker axes at ±0.22W) */}
          {[-W * 0.33, 0, W * 0.33].map((bx, bi) => (
            <mesh
              key={`biophilic-beam-x-${bi}`}
              position={[bx, H - 0.25, 0]}
              material={materials.matteEspressoCofferMat}
              receiveShadow
            >
              <boxGeometry args={[0.32, 0.22, L * 0.82]} />
            </mesh>
          ))}

          {/* Transverse Matte-Espresso Acoustic Beams Interleaving Flush Atmos Speaker Bays */}
          {[-L * 0.36, -L * 0.19, -L * 0.02, L * 0.15, L * 0.32].map((bz, bi) => (
            <mesh
              key={`biophilic-beam-z-${bi}`}
              position={[0, H - 0.25, bz]}
              material={materials.matteEspressoCofferMat}
              receiveShadow
            >
              <boxGeometry args={[W * 0.82, 0.22, 0.28]} />
            </mesh>
          ))}

          {/* Recessed Matte-Espresso Acoustic Ceiling Field Panels */}
          {[-W * 0.165, W * 0.165].map((tx, xi) =>
            [-L * 0.275, -L * 0.105, L * 0.065, L * 0.235].map((tz, zi) => (
              <mesh
                key={`biophilic-ceil-bay-${xi}-${zi}`}
                position={[tx, H - 0.175, tz]}
                material={materials.espressoCofferPanelMat}
                receiveShadow
              >
                <boxGeometry args={[W * 0.28, 0.08, L * 0.14]} />
              </mesh>
            )),
          )}

          {/* Soft Warm Pin-Spot Downlights Embedded Cleanly Along Espresso Ceiling Beams */}
          {[-W * 0.33, 0, W * 0.33].map((dx, di) =>
            [-L * 0.36, -L * 0.19, -L * 0.02, L * 0.15, L * 0.32].map((dz, dzi) => (
              <group key={`biophilic-pinspot-${di}-${dzi}`} position={[dx, H - 0.362, dz]}>
                <mesh rotation={[Math.PI / 2, 0, 0]} material={materials.espressoTrimMat}>
                  <ringGeometry args={[0.04, 0.074, 14]} />
                </mesh>
                <mesh position={[0, -0.004, 0]} rotation={[Math.PI / 2, 0, 0]}>
                  <circleGeometry args={[0.04, 14]} />
                  <meshStandardMaterial
                    color="#1a120a"
                    emissive="#fde68a"
                    emissiveIntensity={ceilingPuckIntensity * 0.82}
                  />
                </mesh>
              </group>
            )),
          )}
        </group>
      )}

      {/* Dolby Cobalt Veil 250 Ceiling: Smooth Matte-Espresso Acoustic Ceiling with Flush Seam Reveals, Linear HVAC Diffusers, Flush Dolby Atmos Modules & Warm Pin-Spot Downlights */}
      {ceilingLightStyle === 'espresso_tray_atmos' && (
        <group>
          {/* Subtle Low-Profile Espresso Acoustic Panel Seam Trim */}
          {[-W * 0.38, -W * 0.14, W * 0.14, W * 0.38].map((bx, bi) => (
            <mesh
              key={`espresso-seam-x-${bi}`}
              position={[bx, H - 0.206, 0]}
              material={materials.matteEspressoCofferMat}
            >
              <boxGeometry args={[0.09, 0.016, L * 0.9]} />
            </mesh>
          ))}
          {[-L * 0.37, -L * 0.185, 0, L * 0.185, L * 0.37].map((bz, bi) => (
            <mesh
              key={`espresso-seam-z-${bi}`}
              position={[0, H - 0.206, bz]}
              material={materials.matteEspressoCofferMat}
            >
              <boxGeometry args={[W * 0.9, 0.016, 0.09]} />
            </mesh>
          ))}

          {/* Flush Linear Slotted HVAC Diffusers */}
          {[-W * 0.29, W * 0.29].map((hx, hi) =>
            [-L * 0.22, L * 0.06, L * 0.31].map((hz, hzi) => (
              <group key={`espresso-hvac-${hi}-${hzi}`} position={[hx, H - 0.204, hz]}>
                <mesh material={materials.espressoTrimMat}>
                  <boxGeometry args={[0.42, 0.012, 1.45]} />
                </mesh>
                <mesh position={[0, -0.005, 0]} material={materials.speakerMat}>
                  <boxGeometry args={[0.34, 0.006, 1.35]} />
                </mesh>
              </group>
            )),
          )}

          {/* Perimeter & Overhead Warm Architectural Pin-Spot Downlights */}
          {[-W * 0.435, -W * 0.22, W * 0.22, W * 0.435].map((dx, di) =>
            Array.from({ length: 10 }, (_, dzi) => {
              const dz = THREE.MathUtils.lerp(-L * 0.41, L * 0.41, dzi / 9);
              return (
                <group key={`espresso-pinspot-${di}-${dzi}`} position={[dx, H - 0.204, dz]}>
                  <mesh rotation={[Math.PI / 2, 0, 0]} material={materials.espressoTrimMat}>
                    <ringGeometry args={[0.036, 0.064, 14]} />
                  </mesh>
                  <mesh position={[0, -0.004, 0]} rotation={[Math.PI / 2, 0, 0]}>
                    <circleGeometry args={[0.036, 14]} />
                    <meshStandardMaterial
                      color="#24180c"
                      emissive="#ffe2b0"
                      emissiveIntensity={ceilingPuckIntensity * 0.92}
                      toneMapped={false}
                    />
                  </mesh>
                </group>
              );
            }),
          )}
        </group>
      )}
    </group>
  );
};
