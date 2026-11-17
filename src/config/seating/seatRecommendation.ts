import { SeatData, TheaterConfiguration } from '../../types/cinema';

export interface BestSeatRecommendation {
  seat: SeatData;
  horizontalFovDeg: number;
  viewingDistanceMeters: number;
  verticalAngleDeg: number;
  centerAlignmentPct: number;
  viewSummary: string;
  audioSummary: string;
  experienceSummary: string;
  overallHeadline: string;
}

/**
 * Evaluates every selectable seat in the auditorium using true 3D spatial geometry
 * (eye-to-screen distance, horizontal viewing angle, vertical neck comfort, lateral
 * symmetry between L/R surrounds, and Dolby Atmos / ScreenX / 4DX / IMAX sweet spots)
 * and returns the single optimal seat for view, audio, and theatrical immersion.
 */
export function findBestSeatForTheater(
  config: TheaterConfiguration,
  seats: SeatData[],
): BestSeatRecommendation | null {
  const candidates = seats.filter((s) => s.status !== 'unavailable');
  if (candidates.length === 0) return null;

  const {
    screenWidth,
    screenPosition,
    auditoriumWidth,
    auditoriumLength,
    seatingRows,
    supportsScreenX,
    supports4dxEffects,
    supportsIcePanels,
    categoryId,
  } = config;

  // Format-specific ideal horizontal viewing angle (SMPTE / THX / IMAX / ScreenX sweet spot)
  const targetFovDeg =
    categoryId === 'imax'
      ? 56
      : supportsScreenX
        ? 47
        : supports4dxEffects
          ? 44
          : categoryId === 'private_luxury'
            ? 38
            : 42;

  // Format-specific ideal row depth ratio (0 = front row, 1 = back row)
  const targetRowFrac =
    categoryId === 'imax'
      ? 0.65
      : supportsScreenX
        ? 0.62
        : supports4dxEffects
          ? 0.6
          : categoryId === 'private_luxury'
            ? 0.55
            : 0.6;

  const rearWallZ = auditoriumLength / 2;
  const frontWallZ = -auditoriumLength / 2;
  const acousticRefZ = frontWallZ + (rearWallZ - frontWallZ) * 0.58;

  let bestSeat: SeatData | null = null;
  let bestScore = -Infinity;
  let bestMetrics = {
    horizontalFovDeg: 40,
    viewingDistanceMeters: 15,
    verticalAngleDeg: 5,
    centerAlignmentPct: 100,
  };

  for (const seat of candidates) {
    const [eyeX, eyeY, eyeZ] = seat.eyePosition;
    const dz = Math.max(2.5, eyeZ - screenPosition[2]);
    const dy = screenPosition[1] - eyeY;
    const dist = Math.hypot(eyeX - screenPosition[0], dy, dz);

    const hFovDeg = (2 * Math.atan(screenWidth / (2 * dz)) * 180) / Math.PI;
    const vAngleDeg = (Math.atan2(dy, dz) * 180) / Math.PI;
    const rowFrac = seatingRows > 1 ? seat.rowIndex / (seatingRows - 1) : 0.5;

    // 1. Center symmetry score (L/C/R and side surround acoustic & optical balance)
    const halfWidth = Math.max(2, auditoriumWidth * 0.42);
    const latOffsetNorm = Math.abs(eyeX) / halfWidth;
    const centerScore = Math.max(0, 1 - latOffsetNorm * 1.45);

    // 2. Optical viewing angle comfort score
    const fovError = Math.abs(hFovDeg - targetFovDeg) / 28;
    const fovScore = Math.max(0, 1 - fovError * fovError);

    // 3. Vertical neck sightline comfort (ideal gentle +0°..+10° upward gaze)
    const vIdeal = 4.5;
    const vPenalty = Math.abs(vAngleDeg - vIdeal) / 18;
    const verticalScore = Math.max(0, 1 - vPenalty * vPenalty);

    // 4. Spatial audio surround + Atmos convergence depth score
    const depthDiff = Math.abs(rowFrac - targetRowFrac) / 0.55;
    const acousticDepthDiff = Math.abs(eyeZ - acousticRefZ) / Math.max(6, auditoriumLength * 0.35);
    const audioDepthScore = Math.max(
      0,
      1 - (depthDiff * 0.65 + acousticDepthDiff * 0.35),
    );

    // 5. Tier & seating comfort bonus (prefer premium center seats, keep accessible seats slightly lower priority unless ideal)
    const tierBonus =
      seat.status === 'premium'
        ? 0.09
        : seat.status === 'accessible'
          ? -0.06
          : 0;

    const totalScore =
      centerScore * 0.36 +
      fovScore * 0.28 +
      audioDepthScore * 0.22 +
      verticalScore * 0.14 +
      tierBonus;

    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestSeat = seat;
      bestMetrics = {
        horizontalFovDeg: Math.round(hFovDeg),
        viewingDistanceMeters: Number(dist.toFixed(1)),
        verticalAngleDeg: Number(vAngleDeg.toFixed(1)),
        centerAlignmentPct: Math.max(
          85,
          Math.min(100, Math.round((1 - Math.abs(eyeX) / Math.max(4, auditoriumWidth * 0.5)) * 100)),
        ),
      };
    }
  }

  if (!bestSeat) return null;

  const isDeadCenter = Math.abs(bestSeat.worldPosition[0]) < config.seatSpacing * 0.75;
  const viewSummary = `${bestMetrics.horizontalFovDeg}° panoramic FOV at ${bestMetrics.viewingDistanceMeters}m · ${
    isDeadCenter ? 'Dead-center axis' : `${bestMetrics.centerAlignmentPct}% center symmetry`
  }, zero neck strain (${bestMetrics.verticalAngleDeg >= 0 ? '+' : ''}${bestMetrics.verticalAngleDeg}° eye angle).`;

  const audioSummary =
    'Equidistant L/C/R stage towers, balanced left/right side surrounds, and direct overhead Atmos convergence.';

  let experienceSummary =
    'Optimal full-frame visual immersion with crisp acoustic localization across every channel.';
  if (supportsScreenX) {
    experienceSummary =
      'Centered 270° panoramic sweet spot where both micro-perforated side screens wrap seamlessly into peripheral vision.';
  } else if (supports4dxEffects) {
    experienceSummary =
      'Mid-rear hydraulic motion hub balancing pitch/heave/roll dynamics, directional wind turbines, and full-screen scale.';
  } else if (supportsIcePanels) {
    experienceSummary =
      'Surrounded symmetrically by angled peripheral LED ambient ribbons with balanced front projection clarity.';
  } else if (categoryId === 'imax') {
    experienceSummary =
      'Reference 1.90:1 / 1.43:1 IMAX sweet spot filling peripheral vision floor-to-ceiling alongside 12-channel laser precision.';
  } else if (categoryId === 'dolby') {
    experienceSummary =
      'Reference Dolby Atmos mixing console position pairing deep contrast sightlines with pinpoint overhead object audio.';
  } else if (categoryId === 'private_luxury') {
    experienceSummary =
      'Prime lounge position offering effortless center framing, balanced acoustic dispersion, and relaxed luxury ergonomics.';
  }

  return {
    seat: bestSeat,
    ...bestMetrics,
    viewSummary,
    audioSummary,
    experienceSummary,
    overallHeadline: `Row ${bestSeat.rowLabel} · Seat ${bestSeat.seatNumber}`,
  };
}
