import * as THREE from 'three';

export interface FourDxAudioTelemetry {
  active: boolean;
  subBass: number;
  bass: number;
  bassBalance: number;
  mid: number;
  high: number;
  transient: number;
  rms: number;
}

export interface FourDxLiveTelemetry {
  audioActive: boolean;
  bass: number;
  subBass: number;
  bassBalance: number;
  bassTransient: number;
  highFreq: number;
  rms: number;
  sceneMotion: number;
  panBias: number;
  pitchBias: number;
  fireLevel: number;
  fireCenterX: number;
  rainLevel: number;
  snowLevel: number;
  windLevel: number;
  lightningFlash: number;
  flashColor: string;
  // Unified spring-damped motion outputs shared 1:1 by SeatModels & FirstPersonCameraRig
  seatHeaveY: number;
  seatPitchX: number;
  seatRollZ: number;
}

export function createInitialFourDxTelemetry(): FourDxLiveTelemetry {
  return {
    audioActive: false,
    bass: 0,
    subBass: 0,
    bassBalance: 0,
    bassTransient: 0,
    highFreq: 0,
    rms: 0,
    sceneMotion: 0,
    panBias: 0,
    pitchBias: 0,
    fireLevel: 0,
    fireCenterX: 0,
    rainLevel: 0,
    snowLevel: 0,
    windLevel: 0,
    lightningFlash: 0,
    flashColor: '#7dd3fc',
    seatHeaveY: 0,
    seatPitchX: 0,
    seatRollZ: 0,
  };
}

export interface OpticalFrameAnalysis {
  motionEnergy: number;
  panBias: number;
  pitchBias: number;
  fireScore: number;
  fireCenterX: number;
  rainScore: number;
  snowScore: number;
  windScore: number;
  flashSpike: number;
  meanLuminance: number;
}

export const SAMPLE_W = 16;
export const SAMPLE_H = 9;
export const SAMPLE_PIXELS = SAMPLE_W * SAMPLE_H;

/**
 * Zero-allocation real-time optical analyzer over a 16x9 downsampled video frame.
 * Extracts scene movement, horizontal/vertical pan bias, fire/flames, light rain,
 * blizzard/snow, wind gusts, and sudden brightness flashes directly from the playing video.
 */
export function analyzeVideoFrameOptical(
  rgba: Uint8ClampedArray,
  prevRgb: Float32Array,
  hasPrevFrame: boolean,
  prevMeanLum: number,
  out: OpticalFrameAnalysis,
): void {
  let lumSum = 0;
  let nonBlackCount = 0;
  let motionSum = 0;
  let leftMotion = 0;
  let rightMotion = 0;
  let topMotion = 0;
  let bottomMotion = 0;
  let shimmerCount = 0;
  let fireAccum = 0;
  let fireWeightedX = 0;
  let fireWeightSum = 0;
  let coolSlateCount = 0;
  let brightColdCount = 0;
  let vertStreakEnergy = 0;

  for (let y = 0; y < SAMPLE_H; y++) {
    for (let x = 0; x < SAMPLE_W; x++) {
      const pIdx = y * SAMPLE_W + x;
      const i4 = pIdx * 4;
      const i3 = pIdx * 3;

      const r = rgba[i4] / 255;
      const g = rgba[i4 + 1] / 255;
      const b = rgba[i4 + 2] / 255;
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      lumSum += lum;
      if (lum > 0.055) nonBlackCount++;

      let diff = 0;
      if (hasPrevFrame) {
        const dr = Math.abs(r - prevRgb[i3]);
        const dg = Math.abs(g - prevRgb[i3 + 1]);
        const db = Math.abs(b - prevRgb[i3 + 2]);
        diff = (dr + dg + db) * 0.3333;
        motionSum += diff;
        if (diff > 0.018 && diff < 0.32) {
          shimmerCount++;
        }
        if (x < SAMPLE_W * 0.5) leftMotion += diff;
        else rightMotion += diff;
        if (y < SAMPLE_H * 0.5) topMotion += diff;
        else bottomMotion += diff;
      }

      // Vertical spatial texture variance for falling rain streaks
      if (y > 0) {
        const upIdx = ((y - 1) * SAMPLE_W + x) * 4;
        const upLum =
          (0.2126 * rgba[upIdx] + 0.7152 * rgba[upIdx + 1] + 0.0722 * rgba[upIdx + 2]) / 255;
        vertStreakEnergy += Math.abs(lum - upLum);
      }

      prevRgb[i3] = r;
      prevRgb[i3 + 1] = g;
      prevRgb[i3 + 2] = b;

      // Fire / Flame / Ember spectral + flicker check
      const isOrangeRedFlame =
        r > 0.5 && r - b > 0.32 && r > g * 1.18 && g >= b * 1.05;
      const isYellowFlameCore =
        r > 0.85 && g > 0.56 && b < 0.48 && r - b > 0.38;
      if (isOrangeRedFlame || isYellowFlameCore) {
        // Weight bright flame cores and flickering flames higher than static warm props
        const chroma = THREE.MathUtils.clamp((r - b - 0.28) * 1.6, 0.2, 1.0);
        const flickerBoost = hasPrevFrame && diff > 0.02 ? 1.45 : 0.85;
        const weight = chroma * flickerBoost;
        fireAccum += weight;
        const normX = (x / (SAMPLE_W - 1)) * 2 - 1;
        fireWeightedX += normX * weight;
        fireWeightSum += weight;
      }

      // Cool/overcast rain slate palette check (rejects warm sunny/fire colors)
      if (lum > 0.05 && lum < 0.76 && b >= r - 0.045 && r - b < 0.1) {
        coolSlateCount++;
      }

      // Cold icy snow/blizzard palette check
      if (lum > 0.48 && b >= r - 0.03 && r - b < 0.08) {
        brightColdCount++;
      }
    }
  }

  const meanLum = lumSum / SAMPLE_PIXELS;
  const nonBlackFrac = nonBlackCount / SAMPLE_PIXELS;
  const rawMotion = hasPrevFrame ? THREE.MathUtils.clamp((motionSum / SAMPLE_PIXELS) * 6.5, 0, 1) : 0;

  // Directional pan/pitch bias from left-right & top-bottom optical movement asymmetry
  const halfPixels = SAMPLE_PIXELS * 0.5;
  const rawPanBias = hasPrevFrame
    ? THREE.MathUtils.clamp(((rightMotion - leftMotion) / halfPixels) * 7.5, -1, 1)
    : 0;
  const rawPitchBias = hasPrevFrame
    ? THREE.MathUtils.clamp(((topMotion - bottomMotion) / halfPixels) * 6.5, -1, 1)
    : 0;

  // Fire fraction across frame
  const fireFrac = fireAccum / SAMPLE_PIXELS;
  const fireScore =
    nonBlackFrac > 0.12 && fireFrac > 0.032
      ? THREE.MathUtils.clamp((fireFrac - 0.025) * 4.2, 0, 1)
      : 0;
  const fireCenterX = fireWeightSum > 0.001 ? THREE.MathUtils.clamp(fireWeightedX / fireWeightSum, -1, 1) : 0;

  // Rain detection: cool/overcast slate tone + vertical droplet/shimmer activity + no dominant fire
  const coolFrac = coolSlateCount / SAMPLE_PIXELS;
  const shimmerFrac = hasPrevFrame ? shimmerCount / SAMPLE_PIXELS : 0;
  const avgVertEnergy = vertStreakEnergy / (SAMPLE_W * (SAMPLE_H - 1));
  const isNotCredits = nonBlackFrac > 0.22;
  const rainPaletteOk = isNotCredits && coolFrac > 0.36 && fireScore < 0.14 && meanLum < 0.76;
  const rainActivity = THREE.MathUtils.clamp(shimmerFrac * 2.1 + Math.max(0, avgVertEnergy - 0.03) * 3.8, 0, 1);
  const rainScore = rainPaletteOk && rainActivity > 0.18
    ? THREE.MathUtils.clamp((coolFrac - 0.28) * 1.45 * rainActivity, 0, 1)
    : 0;

  // Snow / Blizzard detection: bright cool icy scenes with dynamic shimmer/motion
  const coldFrac = brightColdCount / SAMPLE_PIXELS;
  const snowScore =
    isNotCredits && coldFrac > 0.34 && fireScore < 0.08 && rawMotion > 0.12
      ? THREE.MathUtils.clamp((coldFrac - 0.28) * 1.6 * Math.min(1, rawMotion * 1.6), 0, 1)
      : 0;

  // Wind level from fast scene motion + rain/storm gusts
  const windScore = THREE.MathUtils.clamp(
    Math.max(0, rawMotion - 0.14) * 1.25 + rainScore * 0.35 + fireScore * 0.25,
    0,
    1,
  );

  // Sudden bright flash spike (lightning strike, gunfire, explosion flash)
  const lumDelta = hasPrevFrame ? meanLum - prevMeanLum : 0;
  const flashSpike =
    lumDelta > 0.16 ? THREE.MathUtils.clamp((lumDelta - 0.14) * 4.5, 0, 1) : 0;

  out.motionEnergy = rawMotion;
  out.panBias = rawPanBias;
  out.pitchBias = rawPitchBias;
  out.fireScore = fireScore;
  out.fireCenterX = fireCenterX;
  out.rainScore = rainScore;
  out.snowScore = snowScore;
  out.windScore = windScore;
  out.flashSpike = flashSpike;
  out.meanLuminance = meanLum;
}

export interface FourDxMotionSpringState {
  heavePos: number;
  heaveVel: number;
  pitchPos: number;
  pitchVel: number;
  rollPos: number;
  rollVel: number;
  prevBass: number;
  rumblePhase: number;
  groovePhase: number;
  beatCooldown: number;
  beatSign: number;
}

export function createFourDxMotionSpring(): FourDxMotionSpringState {
  return {
    heavePos: 0,
    heaveVel: 0,
    pitchPos: 0,
    pitchVel: 0,
    rollPos: 0,
    rollVel: 0,
    prevBass: 0,
    rumblePhase: 0,
    groovePhase: 0,
    beatCooldown: 0,
    beatSign: 1,
  };
}

/**
 * Advances the unified 4DX seat & camera hydraulic spring-damper strictly from
 * live audio bass, sub-bass transients, and stereo L/R bass balance (zero randomness).
 */
export function stepFourDxSeatPhysics(
  spring: FourDxMotionSpringState,
  telemetry: FourDxLiveTelemetry,
  dt: number,
  active: boolean,
): void {
  const safeDt = Math.min(Math.max(dt, 0.001), 0.04);
  spring.beatCooldown = Math.max(0, spring.beatCooldown - safeDt);

  if (!active || !telemetry.audioActive) {
    telemetry.seatHeaveY = Math.abs(telemetry.seatHeaveY) < 1e-4 ? 0 : THREE.MathUtils.damp(telemetry.seatHeaveY, 0, 8, safeDt);
    telemetry.seatPitchX = Math.abs(telemetry.seatPitchX) < 1e-4 ? 0 : THREE.MathUtils.damp(telemetry.seatPitchX, 0, 8, safeDt);
    telemetry.seatRollZ = Math.abs(telemetry.seatRollZ) < 1e-4 ? 0 : THREE.MathUtils.damp(telemetry.seatRollZ, 0, 8, safeDt);
    spring.heavePos = telemetry.seatHeaveY;
    spring.heaveVel *= 0.78;
    spring.pitchPos = telemetry.seatPitchX;
    spring.pitchVel *= 0.78;
    spring.rollPos = telemetry.seatRollZ;
    spring.rollVel *= 0.78;
    spring.prevBass = 0;
    return;
  }

  // Pure low-frequency audio bass energy (0 during quiet dialogue/silence!)
  const bassDrive = THREE.MathUtils.clamp(
    telemetry.subBass * 0.65 + telemetry.bass * 0.35,
    0,
    1.25,
  );
  const beatPunch = Math.max(
    telemetry.bassTransient,
    Math.max(0, telemetry.subBass - spring.prevBass) * 3.0,
  );
  const gatedBass = bassDrive > 0.04 ? bassDrive : 0;
  const gatedPunch = beatPunch > 0.08 ? beatPunch : 0;

  // Hydraulic beat kick: deterministic vertical thump + pitch kick + stereo bass roll
  if (gatedPunch > 0.14 && spring.beatCooldown <= 0) {
    spring.beatCooldown = 0.1;
    const kick = THREE.MathUtils.clamp(gatedPunch * (0.75 + gatedBass * 0.55), 0.18, 1.35);
    spring.heaveVel -= kick * 0.96;
    spring.pitchVel += kick * 0.68;
    spring.rollVel += telemetry.bassBalance * kick * 0.72;
  }

  // Heavy sub-bass tactile transducer pulse (only active during real sub-bass pressure)
  const subStrength = Math.max(0, telemetry.subBass - 0.22);
  if (subStrength > 0.01) {
    spring.rumblePhase += safeDt * (24 + telemetry.subBass * 22);
  }
  const subRumble =
    subStrength > 0.01 ? Math.sin(spring.rumblePhase) * subStrength * 0.018 : 0;

  const heavyScale = Math.min(1.4, gatedBass * gatedBass);
  const targetHeave = -gatedBass * 0.052 + subRumble;
  const targetPitch = heavyScale * 0.048 + gatedPunch * 0.055;
  const targetRoll = telemetry.bassBalance * gatedBass * 0.075;

  // Underdamped hydraulic actuator springs for crisp physical bass slam + smooth rebound
  const stiffnessH = 86;
  const dampingH = 10.2;
  spring.heaveVel += (-stiffnessH * (spring.heavePos - targetHeave) - dampingH * spring.heaveVel) * safeDt;
  spring.heavePos += spring.heaveVel * safeDt;

  const stiffnessR = 50;
  const dampingR = 9.0;
  spring.pitchVel += (-stiffnessR * (spring.pitchPos - targetPitch) - dampingR * spring.pitchVel) * safeDt;
  spring.pitchPos += spring.pitchVel * safeDt;

  spring.rollVel += (-stiffnessR * (spring.rollPos - targetRoll) - dampingR * spring.rollVel) * safeDt;
  spring.rollPos += spring.rollVel * safeDt;

  telemetry.seatHeaveY = THREE.MathUtils.clamp(spring.heavePos, -0.115, 0.095);
  telemetry.seatPitchX = THREE.MathUtils.clamp(spring.pitchPos, -0.11, 0.125);
  telemetry.seatRollZ = THREE.MathUtils.clamp(spring.rollPos, -0.1, 0.1);
  spring.prevBass = telemetry.subBass;
}
