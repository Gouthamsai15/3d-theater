import { SeatData, SeatStatus, TheaterConfiguration } from '../../types/cinema';
import { beachHeightAt } from '../../three/models/beachTerrain';

const ROW_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function isFourSeatPodBreakAfter(seatNumber: number, config: TheaterConfiguration): boolean {
  if (config.aisleAfterSeats.includes(seatNumber) || seatNumber >= config.seatsPerRow) {
    return false;
  }
  if (
    config.seatsPerRow === 22 &&
    config.aisleAfterSeats.length === 2 &&
    config.aisleAfterSeats[0] === 8 &&
    config.aisleAfterSeats[1] === 14
  ) {
    // Symmetric modular blocks: [1-4][5-8] | [9-11][12-14] | [15-18][19-22]
    return seatNumber === 4 || seatNumber === 11 || seatNumber === 18;
  }
  return seatNumber % 4 === 0;
}

export function getFourSeatPodGroupKey(
  rowIndex: number,
  seatNumber: number,
  config: TheaterConfiguration,
): string {
  if (
    config.seatsPerRow === 22 &&
    config.aisleAfterSeats.length === 2 &&
    config.aisleAfterSeats[0] === 8 &&
    config.aisleAfterSeats[1] === 14
  ) {
    let podIdx = 5;
    if (seatNumber <= 4) podIdx = 0;
    else if (seatNumber <= 8) podIdx = 1;
    else if (seatNumber <= 11) podIdx = 2;
    else if (seatNumber <= 14) podIdx = 3;
    else if (seatNumber <= 18) podIdx = 4;
    return `${rowIndex}-${podIdx}`;
  }
  return `${rowIndex}-${Math.floor((seatNumber - 1) / 4)}`;
}

function computeBaseRowXs(config: TheaterConfiguration): {
  centeredXs: number[];
  aisleXs: number[];
} {
  const { seatsPerRow, seatSpacing, aisleAfterSeats, aisleGapWidth, seatPattern } = config;
  const rawXs: number[] = [];
  let currentX = 0;

  for (let s = 1; s <= seatsPerRow; s++) {
    rawXs.push(currentX);
    if (s < seatsPerRow) {
      if (aisleAfterSeats.includes(s)) {
        currentX += seatSpacing + aisleGapWidth;
      } else if (seatPattern === 'twin_pods') {
        // Pair seats (1,2), (3,4), ... closely together with a wider gap between pods
        currentX += s % 2 === 1 ? seatSpacing * 0.84 : seatSpacing * 1.28;
      } else if (seatPattern === 'four_seat_pods') {
        // Group seats into cohesive modular 4DX hydraulic motion pods with clearance between blocks
        currentX += isFourSeatPodBreakAfter(s, config)
          ? seatSpacing * 1.38
          : seatSpacing * 0.88;
      } else {
        currentX += seatSpacing;
      }
    }
  }

  const minX = rawXs[0] ?? 0;
  const maxX = rawXs[rawXs.length - 1] ?? 0;
  const centerOffset = (minX + maxX) / 2;
  const centeredXs = rawXs.map((x) => x - centerOffset);

  const aisleXs: number[] = [];
  if (aisleAfterSeats.length > 0) {
    for (const afterSeat of aisleAfterSeats) {
      const idx = afterSeat - 1;
      if (idx >= 0 && idx < centeredXs.length - 1) {
        aisleXs.push((centeredXs[idx] + centeredXs[idx + 1]) / 2);
      }
    }
  } else {
    aisleXs.push((centeredXs[0] ?? 0) - seatSpacing * 0.95);
    aisleXs.push((centeredXs[centeredXs.length - 1] ?? 0) + seatSpacing * 0.95);
  }

  return { centeredXs, aisleXs };
}

export function generateSeatsForTheater(config: TheaterConfiguration): SeatData[] {
  const seats: SeatData[] = [];
  const {
    theaterId,
    seatingRows,
    seatsPerRow,
    seatSpacing,
    rowSpacing,
    rowElevationStep,
    firstRowZ,
    seatEyeOffsetY,
    premiumRows,
    accessibleSeatIds,
    unavailableSeatIds,
    screenPosition,
    seatPattern,
    environmentProfile,
  } = config;

  const isBeach = environmentProfile.architectureStyle === 'beach';
  const { centeredXs, aisleXs } = computeBaseRowXs(config);

  const maxHalfX = Math.max(
    1,
    Math.abs(centeredXs[0] ?? 0),
    Math.abs(centeredXs[centeredXs.length - 1] ?? 0),
  );
  const arcDepth =
    seatPattern === 'curved_arc'
      ? isBeach
        ? Math.min(1.55, rowSpacing * 0.9)
        : Math.min(0.42, rowSpacing * 0.28)
      : 0;

  for (let r = 0; r < seatingRows; r++) {
    const rowLabel = ROW_LABELS[r] || `R${r + 1}`;
    const baseRowZ = firstRowZ + r * rowSpacing;
    const baseTierY = Number((r * rowElevationStep).toFixed(3));
    const staggerShift =
      seatPattern === 'staggered'
        ? r % 2 === 1
          ? seatSpacing * 0.42
          : -seatSpacing * 0.22
        : 0;

    for (let s = 1; s <= seatsPerRow; s++) {
      const seatId = `${rowLabel}${s}`;
      const seatX = Number(((centeredXs[s - 1] ?? 0) + staggerShift).toFixed(3));
      let seatZNum = baseRowZ;
      let yaw = 0;
      if (seatPattern === 'curved_arc') {
        const normX = Math.min(1, Math.abs(seatX) / maxHalfX);
        // Gently concave toward the screen: outer wings step forward slightly while staying safely inside tier tread
        seatZNum = baseRowZ + arcDepth * 0.38 - arcDepth * normX * normX;
        const distZ = Math.max(4, seatZNum - screenPosition[2]);
        yaw = Number((Math.atan2(-seatX, distZ) * (isBeach ? 0.72 : 0.62)).toFixed(4));
      }
      const seatZ = Number(seatZNum.toFixed(3));
      const beachVariant = theaterId === 'beach_bioluminescent' ? 'bioluminescent' : 'sunset';
      const tierY = isBeach
        ? Number(beachHeightAt(seatX, seatZ, beachVariant).toFixed(3))
        : baseTierY;

      let status: SeatStatus = 'available';
      if (unavailableSeatIds.includes(seatId)) {
        status = 'unavailable';
      } else if (accessibleSeatIds.includes(seatId)) {
        status = 'accessible';
      } else if (premiumRows.includes(r)) {
        status = 'premium';
      }

      let nearestAisleX = aisleXs[0] ?? 0;
      let minDist = Math.abs(seatX - nearestAisleX);
      for (const ax of aisleXs) {
        const d = Math.abs(seatX - ax);
        if (d < minDist) {
          minDist = d;
          nearestAisleX = ax;
        }
      }

      const effectiveEyeOffset = isBeach
        ? r <= 1
          ? 0.72
          : 0.62
        : seatEyeOffsetY;
      const eyeY = Number((tierY + effectiveEyeOffset).toFixed(3));
      const eyeX = Number(seatX.toFixed(3));
      const eyeZ = Number((seatZ + 0.08).toFixed(3));

      seats.push({
        id: seatId,
        rowIndex: r,
        rowLabel,
        seatNumber: s,
        status,
        mapX: s - 1,
        mapY: r,
        worldPosition: [seatX, tierY, seatZ],
        eyePosition: [eyeX, eyeY, eyeZ],
        lookAtTarget: [screenPosition[0], screenPosition[1], screenPosition[2]],
        nearestAisleX: Number(nearestAisleX.toFixed(3)),
        yaw,
        theaterId,
      });
    }
  }

  return seats;
}

export function getAisleWorldXs(config: TheaterConfiguration): number[] {
  return computeBaseRowXs(config).aisleXs;
}
