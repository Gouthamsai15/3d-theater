import { PreviewCameraPreset, TheaterConfiguration } from '../../types/cinema';

export interface CameraPresetPose {
  position: [number, number, number];
  target: [number, number, number];
}

export function getTheaterCameraPresetPose(
  config: TheaterConfiguration,
  preset: PreviewCameraPreset,
): CameraPresetPose {
  const isTreeOfLife = config.theaterId === 'imax_tree_of_life';
  const isDeccan = config.theaterId === 'dolby_deccan';
  const isKinetic4dx = config.theaterId === '4dx_kinetic_250';
  const isBeach = config.environmentProfile.architectureStyle === 'beach';

  const midRowIdx = Math.floor(Math.max(1, config.seatingRows) * 0.54);
  const midRowZ = config.firstRowZ + midRowIdx * config.rowSpacing;
  const midRowEyeY = midRowIdx * config.rowElevationStep + 1.32;

  if (isTreeOfLife) {
    switch (preset) {
      case 'sweet_spot':
        return {
          position: [0, 5.18, 3.05],
          target: [0, 6.1, -14.75],
        };
      case 'side_wall':
        return {
          position: [4.2, 5.25, 1.85],
          target: [-10.9, 5.85, -4.6],
        };
      case 'overview':
      default:
        return {
          position: [0, 7.35, 13.8],
          target: [0, 5.05, -6.5],
        };
    }
  }

  if (isBeach) {
    switch (preset) {
      case 'sweet_spot':
        return {
          position: [0, 2.25, midRowZ],
          target: [0, config.screenPosition[1], config.screenPosition[2]],
        };
      case 'side_wall':
        return {
          position: [6.5, 3.6, 5.5],
          target: [-11.5, 2.5, -2.5],
        };
      case 'overview':
      default:
        return {
          position: [config.auditoriumWidth * 0.22, 4.2, 12.5],
          target: [0, Math.min(config.screenPosition[1] * 0.5, config.auditoriumHeight * 0.45), -config.auditoriumLength * 0.06],
        };
    }
  }

  if (preset === 'sweet_spot') {
    return {
      position: [
        0,
        Math.min(config.auditoriumHeight - 1.1, midRowEyeY),
        Math.min(config.auditoriumLength / 2 - 1.1, midRowZ),
      ],
      target: [config.screenPosition[0], config.screenPosition[1], config.screenPosition[2]],
    };
  }

  if (preset === 'side_wall') {
    return {
      position: [
        Math.min(config.auditoriumWidth * 0.2, 4.2),
        Math.min(config.auditoriumHeight - 1.4, midRowEyeY + 1.35),
        Math.min(config.auditoriumLength / 2 - 1.5, midRowZ + 1.6),
      ],
      target: [
        -config.auditoriumWidth * 0.46,
        Math.min(config.auditoriumHeight * 0.65, midRowEyeY + 1.5),
        config.screenPosition[2] * 0.35,
      ],
    };
  }

  // Default: 'overview'
  const rearY = isDeccan
    ? 6.05
    : isKinetic4dx
      ? 5.15
      : Math.min(
          config.auditoriumHeight - 1.1,
          (config.seatingRows - 1) * config.rowElevationStep + 2.4,
        );
  const rearZ = isDeccan
    ? 13.85
    : isKinetic4dx
      ? 9.6
      : Math.min(config.auditoriumLength / 2 - 0.9, config.auditoriumLength * 0.3);
  const initialCamX = isDeccan || isKinetic4dx ? 0 : config.auditoriumWidth * 0.22;

  return {
    position: [initialCamX, rearY, rearZ],
    target: isDeccan
      ? [0, 4.75, -7.5]
      : isKinetic4dx
        ? [0, 4.75, -8.8]
        : [
            0,
            Math.min(config.screenPosition[1] * 0.5, config.auditoriumHeight * 0.45),
            -config.auditoriumLength * 0.06,
          ],
  };
}
