export type TheaterCategoryId =
  | 'standard_2d'
  | 'imax'
  | '4dx'
  | 'dolby'
  | 'ice'
  | 'private_luxury'
  | 'screenx';

export type TheaterId =
  | 'standard_2d'
  | 'standard_2d_emerald'
  | 'standard_2d_sapphire'
  | 'standard_2d_mandap'
  | 'standard_2d_parametric'
  | 'standard_2d_biophilic'
  | 'imax'
  | 'imax_aurora'
  | 'imax_solar'
  | '4dx'
  | '4dx_crimson'
  | '4dx_arctic'
  | 'dolby'
  | 'dolby_cobalt'
  | 'dolby_bordeaux'
  | 'dolby_cobalt_veil'
  | 'ice'
  | 'ice_cobalt'
  | 'ice_amber'
  | 'private_luxury'
  | 'private_champagne'
  | 'private_midnight'
  | 'screenx'
  | 'screenx_multiplex_400';

export type SeatModelType =
  | 'standard'
  | 'imax_stadium'
  | 'imax_rocker'
  | 'multiplex_stadium'
  | 'mandap_royal_stadium'
  | 'charcoal_purple_stadium'
  | 'charcoal_moss_rocker'
  | '4dx_motion'
  | '4dx_crimson_pod'
  | '4dx_arctic_pod'
  | '4dx_thunder_pod'
  | 'dolby_recliner'
  | 'ice_recliner'
  | 'ice_cobalt_armchair'
  | 'ice_obsidian_recliner'
  | 'private_recliner'
  | 'walnut_loveseat'
  | 'champagne_daybed'
  | 'screenx_lounge_pit'
  | 'screenx_multiplex_rocker';

export type SeatPatternType = 'straight' | 'curved_arc' | 'twin_pods' | 'four_seat_pods' | 'staggered';

export type SideLightStyle =
  | 'brass_torchieres'
  | 'art_deco_stepped_fins'
  | 'art_deco_navy_sunburst'
  | 'crisscross_geometric'
  | 'indian_mandap_jali'
  | 'parametric_obsidian_waves'
  | 'biophilic_crystalline_moss'
  | 'monolith_totems'
  | 'imax_cobalt_wave'
  | 'aurora_ribbon_waves'
  | 'horizon_tier_strips'
  | 'kinetic_chevron_blades'
  | 'velocity_racing_stripes'
  | 'crimson_velocity_4dx'
  | 'glacier_hex_matrix'
  | 'arctic_parametric_fins'
  | 'thunder_emerald_waves'
  | 'obsidian_slat_grazers'
  | 'diagonal_parabolic_ribs'
  | 'cobalt_veil_laser_recess'
  | 'tiered_cantilever_shelves'
  | 'modern_charcoal_navy_diagonal'
  | 'ice_faceted_cyan'
  | 'ice_faceted_cobalt'
  | 'ice_faceted_amber'
  | 'walnut_alabaster_lanterns'
  | 'floating_halo_alcoves'
  | 'chevron_louver_columns'
  | 'volcanic_copper_ribbons'
  | 'private_volcanic_copper_ribbons'
  | 'champagne_fluted_oak_alcoves'
  | 'screenx_panoramic_walls'
  | 'screenx_silver_baffles';

export type CeilingLightStyle =
  | 'puck_grid'
  | 'coffered_beams'
  | 'coffered_starlight_coves'
  | 'mughal_espresso_coffers'
  | 'linear_coves'
  | 'monolithic_acoustic_plaster'
  | 'acoustic_grid_linear'
  | 'overlapping_angled_planes'
  | 'industrial_open_baffle_atmos'
  | 'espresso_biophilic_atmos'
  | 'industrial_4dx_truss'
  | 'hexagonal_acoustic_4dx'
  | 'emerald_cloud_4dx'
  | 'imax_starlight_coves'
  | 'imax_angular_grid'
  | 'imax_v_baffle_grid'
  | 'vaulted_ribs'
  | 'ice_truss_ribs'
  | 'ice_origami_baffles'
  | 'ice_wave_timber_fins'
  | 'ice_cathedral_coffers'
  | 'star_ceiling'
  | 'perimeter_halo'
  | 'stepped_walnut_starlight_trays'
  | 'matte_espresso_coffered_grid'
  | 'screenx_cyan_grid'
  | 'screenx_stepped_tray_pods';

export type SeatStatus = 'available' | 'premium' | 'unavailable' | 'accessible';

export interface LightingProfile {
  wallColor: string;
  accentColor: string;
  ceilingColor: string;
  stepLightColor: string;
  ambientOpenIntensity: number;
  mainOpenIntensity: number;
  wallOpenIntensity: number;
  stepOpenIntensity: number;
  screenGlowStrength: number;
}

export interface AudioProfile {
  roomSizeLabel: string;
  reverbDecay: number;
  lowShelfGainDb: number;
  highShelfGainDb: number;
  ambienceLevel: number;
  spatialSpread: number;
}

export interface EnvironmentProfile {
  carpetColor: string;
  carpetAccentColor: string;
  wallMaterialColor: string;
  ceilingColor: string;
  seatPrimaryColor: string;
  seatTrimColor: string;
  curtainColor?: string;
  seatMaterialType: 'fabric' | 'leather' | 'sport_leather';
  architectureStyle: 'classic' | 'imax' | '4dx' | 'dolby' | 'ice' | 'private' | 'screenx';
}

export interface TheaterCategoryInfo {
  categoryId: TheaterCategoryId;
  name: string;
  subtitle: string;
  description: string;
}

export interface TheaterConfiguration {
  theaterId: TheaterId;
  categoryId: TheaterCategoryId;
  theaterName: string;
  shortName: string;
  ambienceName: string;
  ambienceSwatches: [string, string, string];
  category: string;
  tagline: string;
  description: string;
  previewImage: string;
  auditoriumWidth: number;
  auditoriumLength: number;
  auditoriumHeight: number;
  screenWidth: number;
  screenHeight: number;
  screenCurvature: number; // 0 = flat, >0 = cylindrical arc angle in radians
  screenPosition: [number, number, number];
  seatingRows: number;
  seatsPerRow: number;
  seatSpacing: number;
  rowSpacing: number;
  rowElevationStep: number;
  firstRowZ: number;
  seatEyeOffsetY: number;
  aisleAfterSeats: number[]; // seat numbers after which an aisle gap is placed
  aisleGapWidth: number;
  premiumRows: number[]; // 0-indexed rows
  accessibleSeatIds: string[];
  unavailableSeatIds: string[];
  seatModel: SeatModelType;
  seatPattern: SeatPatternType;
  seatWidthScale?: number;
  sideLightStyle: SideLightStyle;
  ceilingLightStyle: CeilingLightStyle;
  wallBayCount: number;
  lightingProfile: LightingProfile;
  audioProfile: AudioProfile;
  environmentProfile: EnvironmentProfile;
  screenSpecText: string;
  seatingArrangementText: string;
  audioExperienceText: string;
  lightingStyleText: string;
  features: string[];
  supports4dxEffects?: boolean;
  supportsIcePanels?: boolean;
  icePanelCountPerSide?: number;
  icePanelDimensions?: [number, number];
  icePanelInwardAngle?: number;
  supportsScreenX?: boolean;
}

export interface SeatData {
  id: string;
  rowIndex: number;
  rowLabel: string;
  seatNumber: number;
  status: SeatStatus;
  mapX: number;
  mapY: number;
  worldPosition: [number, number, number];
  eyePosition: [number, number, number];
  lookAtTarget: [number, number, number];
  nearestAisleX: number;
  yaw?: number;
  theaterId: TheaterId;
}

export type VideoMode = 'without_ads' | 'with_ads';

export interface PlaylistItem {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  duration: number;
  width: number;
  height: number;
  thumbnailUrl: string | null;
  objectUrl: string;
  hasIndexedDbBackup: boolean;
  orderIndex: number;
  label?: string;
}

export type ShowState =
  | 'AUDITORIUM_OPEN'
  | 'SHOW_STARTING'
  | 'SHOW_PLAYING'
  | 'SHOW_COMPLETED';

export type GraphicsQuality = 'low' | 'medium' | 'high';

export type CameraViewMode = 'seat' | 'hall' | 'screen_full';

export type ScreenFramingMode = 'fill' | 'fit';

export interface AudioSettings {
  masterVolume: number;
  videoVolume: number;
  ambienceVolume: number;
  effectsVolume: number;
  muted: boolean;
  spatialSimulation: boolean;
}

export interface FourDxSettings {
  enabled: boolean;
  vibrationIntensity: number; // 0..1
  cameraMotionIntensity: number; // 0..1
  windAudioEnabled: boolean;
  atmosphericLightEnabled: boolean;
}

export type AppRoute =
  | 'home'
  | 'theaters'
  | 'theater_details'
  | 'seat_selection'
  | 'video_upload'
  | 'confirmation'
  | 'virtual_cinema';
