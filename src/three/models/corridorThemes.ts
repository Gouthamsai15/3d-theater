import { SideLightStyle, TheaterConfiguration } from '../../types/cinema';

export type CorridorWallPattern =
  | 'volcanic_ribbons'
  | 'deco_sunburst'
  | 'crisscross'
  | 'mandap_jali'
  | 'parametric_wave'
  | 'biophilic_moss'
  | 'imax_slanted'
  | 'fourdx_kinetic'
  | 'dolby_acoustic'
  | 'dolby_scales'
  | 'ice_portals'
  | 'private_salon'
  | 'screenx_stealth'
  | 'beach_pier';

export type CorridorDoorMode = 'swing' | 'slide';

export type CorridorPhase = 'ticket_check' | 'scanning' | 'walking' | 'done';

export interface CorridorAnimationState {
  phase: CorridorPhase;
  ticketHoverPhase: number;
  ticketScanT: number; // 0 = floating in hand, 1 = seated flat on scanner glass
  laserSweep: number; // 0..1 sweep progress across QR window
  laserActive: number; // 0..1 beam opacity
  verified: number; // 0 = amber/ready, 1 = emerald verified
  scanFlash: number; // 0..1 optical confirmation pulse on glass bay
  gateOpen: number; // 0 = glass barrier wings closed, 1 = retracted into pedestals
  ticketVisible: number; // 0..1 scale/visibility as ticket tucks away
  doorOpen: number; // 0 = closed, 1 = fully open into corridor / pocket
}

export function createInitialCorridorState(): CorridorAnimationState {
  return {
    phase: 'ticket_check',
    ticketHoverPhase: 0,
    ticketScanT: 0,
    laserSweep: 0,
    laserActive: 0,
    verified: 0,
    scanFlash: 0,
    gateOpen: 0,
    ticketVisible: 1,
    doorOpen: 0,
  };
}

export interface CorridorThemeConfig {
  wallPattern: CorridorWallPattern;
  doorMode: CorridorDoorMode;
  isBeach: boolean;
  isSingleDoor: boolean;
  hingeSide: -1 | 1; // Only used when isSingleDoor === true
  portalX: number;
  portalW: number;
  portalH: number;
  corridorWidth: number;
  corridorHeight: number;
  corridorLength: number;
  primaryWallColor: string;
  secondaryWallColor: string;
  trimColor: string;
  metalColor: string;
  accentColor: string;
  secondaryAccentColor: string;
  ceilingColor: string;
  floorColor: string;
  runnerColor: string;
  runnerBorderColor: string;
  doorPrimaryColor: string;
  doorSecondaryColor: string;
  doorHandleColor: string;
  ticketBgPrimary: string;
  ticketBgSecondary: string;
  ticketAccent: string;
  ticketTextLight: string;
  gateBodyColor: string;
  gateTrimColor: string;
}

export interface PortalLayoutMetrics {
  portalX: number;
  portalW: number;
  portalH: number;
  isSingleDoor: boolean;
  hingeSide: -1 | 1;
  doorMode: CorridorDoorMode;
}

export function getPortalLayoutMetrics(config: TheaterConfiguration): PortalLayoutMetrics {
  const W = config.auditoriumWidth;
  const style: SideLightStyle = config.sideLightStyle;

  if (style === 'private_volcanic_copper_ribbons' || style === 'screenx_panoramic_walls') {
    return {
      portalX: -W * 0.3,
      portalW: 1.44,
      portalH: 2.26,
      isSingleDoor: true,
      hingeSide: -1,
      doorMode: 'swing',
    };
  }

  if (style === 'champagne_fluted_oak_alcoves') {
    return {
      portalX: W * 0.32,
      portalW: 1.44,
      portalH: 2.26,
      isSingleDoor: true,
      hingeSide: 1,
      doorMode: 'swing',
    };
  }

  const isIce = config.environmentProfile.architectureStyle === 'ice';
  const isBeach = config.environmentProfile.architectureStyle === 'beach';

  return {
    portalX: 0,
    portalW: isBeach ? 2.6 : 2.46,
    portalH: isBeach ? 2.55 : 2.3,
    isSingleDoor: false,
    hingeSide: -1,
    doorMode: isIce ? 'slide' : 'swing',
  };
}

export function getCorridorThemeConfig(config: TheaterConfiguration): CorridorThemeConfig {
  const portal = getPortalLayoutMetrics(config);
  const style = config.sideLightStyle;
  const env = config.environmentProfile;
  const light = config.lightingProfile;

  const isBeach = env.architectureStyle === 'beach';
  const isPrivate = env.architectureStyle === 'private';

  const base: CorridorThemeConfig = {
    wallPattern: 'volcanic_ribbons',
    doorMode: portal.doorMode,
    isBeach,
    isSingleDoor: portal.isSingleDoor,
    hingeSide: portal.hingeSide,
    portalX: portal.portalX,
    portalW: portal.portalW,
    portalH: portal.portalH,
    corridorWidth: portal.isSingleDoor ? 2.85 : isPrivate ? 3.2 : 3.6,
    corridorHeight: isPrivate ? 3.35 : 3.85,
    corridorLength: isBeach ? 7.4 : 11.8,
    primaryWallColor: env.wallMaterialColor,
    secondaryWallColor: env.carpetAccentColor,
    trimColor: env.seatTrimColor,
    metalColor: '#8d734a',
    accentColor: light.wallColor,
    secondaryAccentColor: light.accentColor,
    ceilingColor: env.ceilingColor,
    floorColor: env.carpetColor,
    runnerColor: env.seatPrimaryColor,
    runnerBorderColor: light.stepLightColor,
    doorPrimaryColor: env.wallMaterialColor,
    doorSecondaryColor: env.seatTrimColor,
    doorHandleColor: '#c9a861',
    ticketBgPrimary: '#0e1118',
    ticketBgSecondary: '#1c2230',
    ticketAccent: '#d4af37',
    ticketTextLight: '#f4f1ea',
    gateBodyColor: '#13161e',
    gateTrimColor: '#8f7545',
  };

  switch (style) {
    case 'volcanic_copper_ribbons':
    case 'brass_torchieres':
      return {
        ...base,
        wallPattern: 'volcanic_ribbons',
        primaryWallColor: '#262a33',
        secondaryWallColor: '#9a533e',
        trimColor: '#4f3a29',
        metalColor: '#a67c52',
        accentColor: '#f5c451',
        secondaryAccentColor: '#fff8e7',
        runnerColor: '#3a1f18',
        runnerBorderColor: '#f5c451',
        doorPrimaryColor: '#222630',
        doorSecondaryColor: '#8f4c38',
        doorHandleColor: '#d4a359',
        ticketBgPrimary: '#14171f',
        ticketBgSecondary: '#5c3124',
        ticketAccent: '#f5c451',
        gateBodyColor: '#181b23',
        gateTrimColor: '#b3844e',
      };

    case 'art_deco_navy_sunburst':
    case 'art_deco_stepped_fins':
      return {
        ...base,
        wallPattern: 'deco_sunburst',
        primaryWallColor: '#0d1930',
        secondaryWallColor: '#1e293b',
        trimColor: '#d4af37',
        metalColor: '#d4af37',
        accentColor: '#ffb347',
        secondaryAccentColor: '#d4af37',
        runnerColor: '#69121d',
        runnerBorderColor: '#d4af37',
        doorPrimaryColor: '#101d38',
        doorSecondaryColor: '#7b1420',
        doorHandleColor: '#e5c158',
        ticketBgPrimary: '#0a1428',
        ticketBgSecondary: '#4d1019',
        ticketAccent: '#e5c158',
        gateBodyColor: '#0c1528',
        gateTrimColor: '#d4af37',
      };

    case 'crisscross_geometric':
    case 'monolith_totems':
      return {
        ...base,
        wallPattern: 'crisscross',
        primaryWallColor: '#0c101b',
        secondaryWallColor: '#1d3c78',
        trimColor: '#334155',
        metalColor: '#94a3b8',
        accentColor: '#fbbf24',
        secondaryAccentColor: '#fff7e6',
        runnerColor: '#162d59',
        runnerBorderColor: '#fbbf24',
        doorPrimaryColor: '#101a30',
        doorSecondaryColor: '#1e3f7d',
        doorHandleColor: '#fbbf24',
        ticketBgPrimary: '#0b1224',
        ticketBgSecondary: '#1c3566',
        ticketAccent: '#fbbf24',
        gateBodyColor: '#0e1320',
        gateTrimColor: '#d4af37',
      };

    case 'indian_mandap_jali':
      return {
        ...base,
        corridorWidth: 3.9,
        corridorHeight: 4.1,
        wallPattern: 'mandap_jali',
        primaryWallColor: '#6b2a1b',
        secondaryWallColor: '#6b101e',
        trimColor: '#94743b',
        metalColor: '#c49b4d',
        accentColor: '#f59e0b',
        secondaryAccentColor: '#fde68a',
        ceilingColor: '#140c08',
        floorColor: '#160d0b',
        runnerColor: '#6e101f',
        runnerBorderColor: '#f5b041',
        doorPrimaryColor: '#6e1221',
        doorSecondaryColor: '#843623',
        doorHandleColor: '#e0b85e',
        ticketBgPrimary: '#240c10',
        ticketBgSecondary: '#662417',
        ticketAccent: '#f5c25b',
        gateBodyColor: '#1c110d',
        gateTrimColor: '#c49b4d',
      };

    case 'parametric_obsidian_waves':
      return {
        ...base,
        corridorWidth: 3.8,
        corridorHeight: 4.0,
        wallPattern: 'parametric_wave',
        primaryWallColor: '#151821',
        secondaryWallColor: '#2d3342',
        trimColor: '#0c0e13',
        metalColor: '#64748b',
        accentColor: '#a855f7',
        secondaryAccentColor: '#c084fc',
        runnerColor: '#181424',
        runnerBorderColor: '#a855f7',
        doorPrimaryColor: '#141720',
        doorSecondaryColor: '#282d38',
        doorHandleColor: '#c084fc',
        ticketBgPrimary: '#0d0f16',
        ticketBgSecondary: '#2d1a47',
        ticketAccent: '#c084fc',
        gateBodyColor: '#101219',
        gateTrimColor: '#9333ea',
      };

    case 'biophilic_crystalline_moss':
      return {
        ...base,
        wallPattern: 'biophilic_moss',
        primaryWallColor: '#5d7656',
        secondaryWallColor: '#c5b296',
        trimColor: '#523824',
        metalColor: '#a8844c',
        accentColor: '#fbbf24',
        secondaryAccentColor: '#fef3c7',
        ceilingColor: '#171411',
        floorColor: '#14120f',
        runnerColor: '#2c3d29',
        runnerBorderColor: '#fbbf24',
        doorPrimaryColor: '#4a3322',
        doorSecondaryColor: '#4e6948',
        doorHandleColor: '#e0b55c',
        ticketBgPrimary: '#171b15',
        ticketBgSecondary: '#3b4f36',
        ticketAccent: '#fbbf24',
        gateBodyColor: '#1a1714',
        gateTrimColor: '#c49849',
      };

    case 'imax_cobalt_wave':
      return {
        ...base,
        corridorWidth: 3.8,
        corridorHeight: 4.0,
        wallPattern: 'imax_slanted',
        primaryWallColor: '#0e131f',
        secondaryWallColor: '#1d2b48',
        trimColor: '#1e293b',
        metalColor: '#475569',
        accentColor: '#22d3ee',
        secondaryAccentColor: '#2563eb',
        runnerColor: '#111c36',
        runnerBorderColor: '#38bdf8',
        doorPrimaryColor: '#0c111c',
        doorSecondaryColor: '#172747',
        doorHandleColor: '#38bdf8',
        ticketBgPrimary: '#080e1c',
        ticketBgSecondary: '#142a59',
        ticketAccent: '#22d3ee',
        gateBodyColor: '#0b101b',
        gateTrimColor: '#2563eb',
      };

    case 'aurora_ribbon_waves':
      return {
        ...base,
        corridorWidth: 3.8,
        corridorHeight: 4.0,
        wallPattern: 'imax_slanted',
        primaryWallColor: '#1b2136',
        secondaryWallColor: '#384152',
        trimColor: '#475569',
        metalColor: '#64748b',
        accentColor: '#e0f2fe',
        secondaryAccentColor: '#2563eb',
        runnerColor: '#162038',
        runnerBorderColor: '#bae6fd',
        doorPrimaryColor: '#1c2338',
        doorSecondaryColor: '#343e52',
        doorHandleColor: '#cbd5e1',
        ticketBgPrimary: '#0f1629',
        ticketBgSecondary: '#273554',
        ticketAccent: '#7dd3fc',
        gateBodyColor: '#141a2b',
        gateTrimColor: '#60a5fa',
      };

    case 'horizon_tier_strips':
      return {
        ...base,
        corridorWidth: 3.8,
        corridorHeight: 4.0,
        wallPattern: 'imax_slanted',
        primaryWallColor: '#171a21',
        secondaryWallColor: '#113f4b',
        trimColor: '#0f172a',
        metalColor: '#4b5563',
        accentColor: '#f59e0b',
        secondaryAccentColor: '#22d3ee',
        runnerColor: '#0f2c36',
        runnerBorderColor: '#f59e0b',
        doorPrimaryColor: '#141820',
        doorSecondaryColor: '#113f4b',
        doorHandleColor: '#f59e0b',
        ticketBgPrimary: '#0d1419',
        ticketBgSecondary: '#123e4a',
        ticketAccent: '#f59e0b',
        gateBodyColor: '#11161c',
        gateTrimColor: '#f59e0b',
      };

    case 'imax_tree_of_life':
      return {
        ...base,
        corridorWidth: 3.8,
        corridorHeight: 4.0,
        wallPattern: 'imax_slanted',
        primaryWallColor: '#2d1c13',
        secondaryWallColor: '#4e3322',
        trimColor: '#1f1510',
        metalColor: '#8d6e47',
        accentColor: '#ffaa44',
        secondaryAccentColor: '#ffd28a',
        runnerColor: '#1a2f28',
        runnerBorderColor: '#ffaa44',
        doorPrimaryColor: '#3a2316',
        doorSecondaryColor: '#243d35',
        doorHandleColor: '#ffd28a',
        ticketBgPrimary: '#1a120d',
        ticketBgSecondary: '#243d35',
        ticketAccent: '#ffaa44',
        gateBodyColor: '#1f1611',
        gateTrimColor: '#ffaa44',
      };

    case 'thunder_emerald_waves':
      return {
        ...base,
        wallPattern: 'fourdx_kinetic',
        primaryWallColor: '#3b302a',
        secondaryWallColor: '#525864',
        trimColor: '#29221d',
        metalColor: '#78808f',
        accentColor: '#f59e0b',
        secondaryAccentColor: '#f0f9ff',
        runnerColor: '#1f1c1b',
        runnerBorderColor: '#f59e0b',
        doorPrimaryColor: '#2e333c',
        doorSecondaryColor: '#694127',
        doorHandleColor: '#f59e0b',
        ticketBgPrimary: '#16181e',
        ticketBgSecondary: '#4d301e',
        ticketAccent: '#f59e0b',
        gateBodyColor: '#1b1d24',
        gateTrimColor: '#f59e0b',
      };

    case 'crimson_velocity_4dx':
    case 'velocity_racing_stripes':
    case 'kinetic_chevron_blades':
      return {
        ...base,
        wallPattern: 'fourdx_kinetic',
        primaryWallColor: '#14161c',
        secondaryWallColor: '#252933',
        trimColor: '#1f232c',
        metalColor: '#64748b',
        accentColor: '#ef4444',
        secondaryAccentColor: '#0ea5e9',
        runnerColor: '#181116',
        runnerBorderColor: '#ef4444',
        doorPrimaryColor: '#12151c',
        doorSecondaryColor: '#262b36',
        doorHandleColor: '#ef4444',
        ticketBgPrimary: '#0f1117',
        ticketBgSecondary: '#3d1016',
        ticketAccent: '#ef4444',
        gateBodyColor: '#11131a',
        gateTrimColor: '#ef4444',
      };

    case 'arctic_parametric_fins':
    case 'glacier_hex_matrix':
      return {
        ...base,
        wallPattern: 'fourdx_kinetic',
        primaryWallColor: '#1e3a75',
        secondaryWallColor: '#718096',
        trimColor: '#1a202c',
        metalColor: '#94a3b8',
        accentColor: '#a855f7',
        secondaryAccentColor: '#22d3ee',
        runnerColor: '#15203b',
        runnerBorderColor: '#22d3ee',
        doorPrimaryColor: '#182442',
        doorSecondaryColor: '#546278',
        doorHandleColor: '#22d3ee',
        ticketBgPrimary: '#0e1424',
        ticketBgSecondary: '#2d1c4d',
        ticketAccent: '#22d3ee',
        gateBodyColor: '#141926',
        gateTrimColor: '#a855f7',
      };

    case 'exoskeleton_crimson_matrix_4dx':
      return {
        ...base,
        corridorWidth: 3.9,
        corridorHeight: 4.1,
        wallPattern: 'fourdx_kinetic',
        primaryWallColor: '#12151b',
        secondaryWallColor: '#1e222b',
        trimColor: '#090a0d',
        metalColor: '#475569',
        accentColor: '#ef4444',
        secondaryAccentColor: '#94a3b8',
        runnerColor: '#161114',
        runnerBorderColor: '#ef4444',
        doorPrimaryColor: '#11141a',
        doorSecondaryColor: '#252a34',
        doorHandleColor: '#ef4444',
        ticketBgPrimary: '#0c0d12',
        ticketBgSecondary: '#471014',
        ticketAccent: '#ef4444',
        gateBodyColor: '#101218',
        gateTrimColor: '#ef4444',
      };

    case 'kinetic_slate_baffles_4dx':
      return {
        ...base,
        corridorWidth: 3.8,
        corridorHeight: 3.9,
        wallPattern: 'fourdx_kinetic',
        primaryWallColor: '#131720',
        secondaryWallColor: '#1a1f2b',
        trimColor: '#0e1117',
        metalColor: '#64748b',
        accentColor: '#38bdf8',
        secondaryAccentColor: '#f59e0b',
        runnerColor: '#0e1117',
        runnerBorderColor: '#f59e0b',
        doorPrimaryColor: '#131720',
        doorSecondaryColor: '#222836',
        doorHandleColor: '#38bdf8',
        ticketBgPrimary: '#0e1117',
        ticketBgSecondary: '#16253b',
        ticketAccent: '#38bdf8',
        gateBodyColor: '#11151d',
        gateTrimColor: '#38bdf8',
      };

    case 'obsidian_slat_grazers':
      return {
        ...base,
        wallPattern: 'dolby_acoustic',
        primaryWallColor: '#171c26',
        secondaryWallColor: '#1f2b42',
        trimColor: '#334155',
        metalColor: '#64748b',
        accentColor: '#0088ff',
        secondaryAccentColor: '#fff2d6',
        runnerColor: '#141a26',
        runnerBorderColor: '#0088ff',
        doorPrimaryColor: '#151a24',
        doorSecondaryColor: '#202d45',
        doorHandleColor: '#38bdf8',
        ticketBgPrimary: '#0c1018',
        ticketBgSecondary: '#0f2854',
        ticketAccent: '#38bdf8',
        gateBodyColor: '#10141c',
        gateTrimColor: '#0088ff',
      };

    case 'diagonal_parabolic_ribs':
    case 'tiered_cantilever_shelves':
      return {
        ...base,
        wallPattern: 'dolby_acoustic',
        primaryWallColor: '#1c2028',
        secondaryWallColor: '#4a2e1f',
        trimColor: '#14161b',
        metalColor: '#8c6947',
        accentColor: '#f59e0b',
        secondaryAccentColor: '#60a5fa',
        runnerColor: '#211916',
        runnerBorderColor: '#f59e0b',
        doorPrimaryColor: '#1b1f26',
        doorSecondaryColor: '#4d3020',
        doorHandleColor: '#f59e0b',
        ticketBgPrimary: '#141212',
        ticketBgSecondary: '#42291b',
        ticketAccent: '#f59e0b',
        gateBodyColor: '#16181e',
        gateTrimColor: '#c4833b',
      };

    case 'modern_charcoal_navy_diagonal':
      return {
        ...base,
        wallPattern: 'dolby_acoustic',
        primaryWallColor: '#1e222b',
        secondaryWallColor: '#122241',
        trimColor: '#2d3340',
        metalColor: '#64748b',
        accentColor: '#f5a642',
        secondaryAccentColor: '#fff2d8',
        runnerColor: '#4f121a',
        runnerBorderColor: '#ffaa44',
        doorPrimaryColor: '#1c2029',
        doorSecondaryColor: '#142647',
        doorHandleColor: '#f5a642',
        ticketBgPrimary: '#11141c',
        ticketBgSecondary: '#4a1019',
        ticketAccent: '#f5a642',
        gateBodyColor: '#14171f',
        gateTrimColor: '#f5a642',
      };

    case 'cobalt_veil_laser_recess':
      return {
        ...base,
        wallPattern: 'dolby_scales',
        primaryWallColor: '#131419',
        secondaryWallColor: '#242730',
        trimColor: '#1e1612',
        metalColor: '#8f5e32',
        accentColor: '#ff981a',
        secondaryAccentColor: '#7c3aed',
        ceilingColor: '#140e0a',
        runnerColor: '#1a1518',
        runnerBorderColor: '#ff9f1c',
        doorPrimaryColor: '#15171d',
        doorSecondaryColor: '#242730',
        doorHandleColor: '#ff9f1c',
        ticketBgPrimary: '#110f16',
        ticketBgSecondary: '#4a240e',
        ticketAccent: '#ff9f1c',
        gateBodyColor: '#121318',
        gateTrimColor: '#ff981a',
      };

    case 'telugu_kakatiya_dolby':
      return {
        ...base,
        corridorWidth: 3.85,
        corridorHeight: 4.05,
        wallPattern: 'mandap_jali',
        primaryWallColor: '#48131d',
        secondaryWallColor: '#17191f',
        trimColor: '#c89d4c',
        metalColor: '#d4af37',
        accentColor: '#f5a638',
        secondaryAccentColor: '#ffd480',
        ceilingColor: '#07080b',
        runnerColor: '#4a121c',
        runnerBorderColor: '#d4af37',
        doorPrimaryColor: '#191b22',
        doorSecondaryColor: '#5c1c23',
        doorHandleColor: '#d4af37',
        ticketBgPrimary: '#1a0a0e',
        ticketBgSecondary: '#541520',
        ticketAccent: '#d4af37',
        gateBodyColor: '#14151b',
        gateTrimColor: '#c89d4c',
      };

    case 'deccan_basalt_monsoon':
      return {
        ...base,
        corridorWidth: 3.85,
        corridorHeight: 4.05,
        wallPattern: 'dolby_scales',
        primaryWallColor: '#131618',
        secondaryWallColor: '#0e2820',
        trimColor: '#8d6b43',
        metalColor: '#9b7748',
        accentColor: '#10b981',
        secondaryAccentColor: '#7399c4',
        ceilingColor: '#07090b',
        runnerColor: '#0f221b',
        runnerBorderColor: '#9b7748',
        doorPrimaryColor: '#14171a',
        doorSecondaryColor: '#0f2d23',
        doorHandleColor: '#9b7748',
        ticketBgPrimary: '#0b0e0e',
        ticketBgSecondary: '#112e24',
        ticketAccent: '#c4965a',
        gateBodyColor: '#111417',
        gateTrimColor: '#8d6b43',
      };

    case 'ice_faceted_cyan':
      return {
        ...base,
        wallPattern: 'ice_portals',
        primaryWallColor: '#12141a',
        secondaryWallColor: '#142442',
        trimColor: '#64748b',
        metalColor: '#94a3b8',
        accentColor: '#06b6d4',
        secondaryAccentColor: '#8b5cf6',
        runnerColor: '#121f38',
        runnerBorderColor: '#06b6d4',
        doorPrimaryColor: '#12151c',
        doorSecondaryColor: '#17294a',
        doorHandleColor: '#22d3ee',
        ticketBgPrimary: '#0a0f1a',
        ticketBgSecondary: '#0d364a',
        ticketAccent: '#22d3ee',
        gateBodyColor: '#0f131a',
        gateTrimColor: '#06b6d4',
      };

    case 'ice_faceted_cobalt':
      return {
        ...base,
        wallPattern: 'ice_portals',
        primaryWallColor: '#5c5147',
        secondaryWallColor: '#786858',
        trimColor: '#8a623c',
        metalColor: '#b88b58',
        accentColor: '#f59e0b',
        secondaryAccentColor: '#fb7185',
        runnerColor: '#4f3322',
        runnerBorderColor: '#f5b942',
        doorPrimaryColor: '#4e443b',
        doorSecondaryColor: '#7a482b',
        doorHandleColor: '#f5b942',
        ticketBgPrimary: '#1e1915',
        ticketBgSecondary: '#6b3e22',
        ticketAccent: '#f5b942',
        gateBodyColor: '#211c18',
        gateTrimColor: '#d49d4a',
      };

    case 'ice_faceted_amber':
      return {
        ...base,
        wallPattern: 'ice_portals',
        primaryWallColor: '#17191d',
        secondaryWallColor: '#1f3a2e',
        trimColor: '#141110',
        metalColor: '#5eead4',
        accentColor: '#10b981',
        secondaryAccentColor: '#5eead4',
        runnerColor: '#152b22',
        runnerBorderColor: '#10b981',
        doorPrimaryColor: '#15171b',
        doorSecondaryColor: '#1d382c',
        doorHandleColor: '#34d399',
        ticketBgPrimary: '#0d1412',
        ticketBgSecondary: '#164533',
        ticketAccent: '#34d399',
        gateBodyColor: '#121516',
        gateTrimColor: '#10b981',
      };

    case 'private_volcanic_copper_ribbons':
    case 'walnut_alabaster_lanterns':
      return {
        ...base,
        corridorWidth: 2.85,
        corridorHeight: 3.2,
        corridorLength: 10.6,
        wallPattern: 'private_salon',
        primaryWallColor: '#52321e',
        secondaryWallColor: '#c7baa6',
        trimColor: '#c9a861',
        metalColor: '#d4b26a',
        accentColor: '#f5b041',
        secondaryAccentColor: '#fff6e3',
        ceilingColor: '#15100e',
        floorColor: '#1c1614',
        runnerColor: '#5e3824',
        runnerBorderColor: '#d4b26a',
        doorPrimaryColor: '#4f301c',
        doorSecondaryColor: '#261812',
        doorHandleColor: '#e2c172',
        ticketBgPrimary: '#1f1510',
        ticketBgSecondary: '#54321c',
        ticketAccent: '#e2c172',
        gateBodyColor: '#1c1410',
        gateTrimColor: '#c9a861',
      };

    case 'champagne_fluted_oak_alcoves':
    case 'floating_halo_alcoves':
      return {
        ...base,
        corridorWidth: 2.85,
        corridorHeight: 3.2,
        corridorLength: 10.6,
        wallPattern: 'private_salon',
        primaryWallColor: '#3a2a1e',
        secondaryWallColor: '#cfc5b4',
        trimColor: '#d4b87c',
        metalColor: '#d4b87c',
        accentColor: '#fbbf6a',
        secondaryAccentColor: '#fff6e3',
        ceilingColor: '#1e1611',
        floorColor: '#1b1e24',
        runnerColor: '#0f3b2e',
        runnerBorderColor: '#d4b87c',
        doorPrimaryColor: '#38281c',
        doorSecondaryColor: '#0f3b2e',
        doorHandleColor: '#e3c785',
        ticketBgPrimary: '#141a18',
        ticketBgSecondary: '#0f3b2e',
        ticketAccent: '#e3c785',
        gateBodyColor: '#1a1511',
        gateTrimColor: '#d4b87c',
      };

    case 'chevron_louver_columns':
      return {
        ...base,
        corridorWidth: 3.2,
        corridorHeight: 3.35,
        corridorLength: 10.8,
        wallPattern: 'private_salon',
        primaryWallColor: '#1b1421',
        secondaryWallColor: '#2b1834',
        trimColor: '#735a82',
        metalColor: '#d4a382',
        accentColor: '#e8a87c',
        secondaryAccentColor: '#d8b4fe',
        ceilingColor: '#100c14',
        floorColor: '#17111c',
        runnerColor: '#2e1838',
        runnerBorderColor: '#e8a87c',
        doorPrimaryColor: '#24142b',
        doorSecondaryColor: '#3d214a',
        doorHandleColor: '#e8a87c',
        ticketBgPrimary: '#160e1c',
        ticketBgSecondary: '#3b1c47',
        ticketAccent: '#e8a87c',
        gateBodyColor: '#17101d',
        gateTrimColor: '#e8a87c',
      };

    case 'screenx_panoramic_walls':
      return {
        ...base,
        corridorWidth: 2.95,
        corridorHeight: 3.4,
        corridorLength: 11.0,
        wallPattern: 'screenx_stealth',
        primaryWallColor: '#11141b',
        secondaryWallColor: '#3e4652',
        trimColor: '#0a0d12',
        metalColor: '#64748b',
        accentColor: '#06b6d4',
        secondaryAccentColor: '#cffafe',
        runnerColor: '#141b24',
        runnerBorderColor: '#06b6d4',
        doorPrimaryColor: '#12161f',
        doorSecondaryColor: '#2b323d',
        doorHandleColor: '#22d3ee',
        ticketBgPrimary: '#080b10',
        ticketBgSecondary: '#162836',
        ticketAccent: '#06b6d4',
        gateBodyColor: '#0d1016',
        gateTrimColor: '#06b6d4',
      };

    case 'screenx_silver_baffles':
      return {
        ...base,
        corridorWidth: 3.8,
        corridorHeight: 3.9,
        wallPattern: 'screenx_stealth',
        primaryWallColor: '#1a2048',
        secondaryWallColor: '#727b8a',
        trimColor: '#0f172a',
        metalColor: '#94a3b8',
        accentColor: '#2563eb',
        secondaryAccentColor: '#dbeafe',
        runnerColor: '#162544',
        runnerBorderColor: '#3b82f6',
        doorPrimaryColor: '#182047',
        doorSecondaryColor: '#5d6675',
        doorHandleColor: '#60a5fa',
        ticketBgPrimary: '#0c1124',
        ticketBgSecondary: '#1a2c5c',
        ticketAccent: '#60a5fa',
        gateBodyColor: '#0e1326',
        gateTrimColor: '#3b82f6',
      };

    case 'beach_torches_fairy':
      return {
        ...base,
        wallPattern: 'beach_pier',
        corridorWidth: 3.2,
        corridorHeight: 3.2,
        corridorLength: 7.2,
        primaryWallColor: '#6e4a2b',
        secondaryWallColor: '#9c7853',
        trimColor: '#4f331c',
        metalColor: '#c4984d',
        accentColor: '#ff9933',
        secondaryAccentColor: '#fde68a',
        floorColor: '#6e4c2e',
        runnerColor: '#8c6642',
        runnerBorderColor: '#fbbf24',
        doorPrimaryColor: '#634124',
        doorSecondaryColor: '#8c6239',
        doorHandleColor: '#fbbf24',
        ticketBgPrimary: '#1a1410',
        ticketBgSecondary: '#73441b',
        ticketAccent: '#ff9933',
        gateBodyColor: '#3b2818',
        gateTrimColor: '#fbbf24',
      };

    case 'beach_neon_palm_bollards':
      return {
        ...base,
        wallPattern: 'beach_pier',
        corridorWidth: 3.2,
        corridorHeight: 3.2,
        corridorLength: 7.2,
        primaryWallColor: '#0c1322',
        secondaryWallColor: '#1e293b',
        trimColor: '#0f172a',
        metalColor: '#00bbf9',
        accentColor: '#00f5d4',
        secondaryAccentColor: '#f15bb5',
        floorColor: '#111827',
        runnerColor: '#0f2933',
        runnerBorderColor: '#00f5d4',
        doorPrimaryColor: '#0e1626',
        doorSecondaryColor: '#163847',
        doorHandleColor: '#00f5d4',
        ticketBgPrimary: '#040a1a',
        ticketBgSecondary: '#0c3b47',
        ticketAccent: '#00f5d4',
        gateBodyColor: '#0a111f',
        gateTrimColor: '#00f5d4',
      };

    default:
      return base;
  }
}
