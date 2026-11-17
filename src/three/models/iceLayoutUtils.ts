import * as THREE from 'three';
import { TheaterConfiguration } from '../../types/cinema';

export interface IcePanelPlacement {
  index: number;
  col: number;
  row: number;
  t: number; // 0 (front) .. 1 (rear)
  z: number;
  y: number;
  x: number;
  width: number;
  height: number;
  side: -1 | 1;
  rotY: number;
  rotZ?: number;
}

export interface IceTheaterLayout {
  panelCountPerSide: number;
  panelWidth: number;
  panelHeight: number;
  inwardAngle: number;
  panelZs: number[];
  panelYs: number[];
  betweenPanelZs: number[];
  panels: IcePanelPlacement[];
  curvedWallPoints?: { z: number; wallX: number; tangentYaw: number }[];
}

/**
 * Computes consistent 3D coordinates for the ICE peripheral LED panels
 * and the between-panel acoustic wall bays / concealed surround positions:
 * - ice_faceted_cyan (Flagship): 2 symmetrical horizontal tiers across 5 bays per angled wall (10 panels/side)
 * - ice_faceted_cobalt (Cobalt Grand): Staggered dual-row architectural grid along sweeping curved side walls (5 panels/side, 10 total)
 * - ice_faceted_amber (Obsidian Amber): Clean floating diagonal array along angled side walls (5 panels/side, 10 total)
 */
export function getIceTheaterLayout(config: TheaterConfiguration): IceTheaterLayout {
  const {
    auditoriumWidth: W,
    auditoriumLength: L,
    auditoriumHeight: H,
    firstRowZ,
    seatingRows,
    rowSpacing,
    rowElevationStep,
    sideLightStyle,
    icePanelCountPerSide = 5,
    icePanelDimensions = [2.75, 3.25],
    icePanelInwardAngle = 0.08,
  } = config;

  const frontZ = -L / 2;
  const backZ = L / 2;
  const lastRowZ = firstRowZ + Math.max(0, seatingRows - 1) * rowSpacing;
  const topTierY = Math.max(0, seatingRows - 1) * rowElevationStep;

  const [panelWidth, panelHeight] = icePanelDimensions;
  const colCount = Math.max(5, Math.min(8, icePanelCountPerSide));

  // Clear front emergency exit doors and rear corners
  const zStart = Math.max(frontZ + 4.4, firstRowZ - 4.1);
  const zEnd = Math.min(backZ - 2.8, lastRowZ + 2.0);

  const panelZs: number[] = [];
  const panelYs: number[] = [];
  for (let i = 0; i < colCount; i++) {
    const t = colCount > 1 ? i / (colCount - 1) : 0.5;
    panelZs.push(THREE.MathUtils.lerp(zStart, zEnd, t));
  }

  const betweenPanelZs: number[] = [];
  for (let i = 0; i < panelZs.length - 1; i++) {
    betweenPanelZs.push((panelZs[i] + panelZs[i + 1]) * 0.5);
  }

  const panels: IcePanelPlacement[] = [];

  if (sideLightStyle === 'ice_faceted_cobalt') {
    // Sweeping curved side walls: wall gently bows outward in mid-hall and curves smoothly toward screen/rear
    const curvedWallPoints: { z: number; wallX: number; tangentYaw: number }[] = [];
    const segs = 12;
    for (let i = 0; i <= segs; i++) {
      const u = i / segs;
      const cz = THREE.MathUtils.lerp(frontZ + 1.2, backZ - 1.2, u);
      const bow = Math.sin(Math.PI * u) * 0.85;
      const wallX = W / 2 - 0.95 + bow;
      const dBowDz = (Math.PI / (L - 2.4)) * Math.cos(Math.PI * u) * 0.85;
      curvedWallPoints.push({ z: cz, wallX, tangentYaw: Math.atan(dBowDz) });
    }

    // Staggered dual-row architectural grid: 5 large panels per curved wall (10 total)
    for (let i = 0; i < colCount; i++) {
      const t = colCount > 1 ? i / (colCount - 1) : 0.5;
      const pz = panelZs[i];
      const u = THREE.MathUtils.clamp((pz - (frontZ + 1.2)) / (L - 2.4), 0.05, 0.95);
      const isUpperRow = i % 2 === 0;
      const baseSlopeY = THREE.MathUtils.lerp(3.6, topTierY + 2.55, t);
      const py = isUpperRow
        ? Math.min(H - panelHeight * 0.5 - 1.05, baseSlopeY + 2.45)
        : Math.max(panelHeight * 0.5 + 1.15, baseSlopeY - 0.95);
      panelYs.push(py);

      const bow = Math.sin(Math.PI * u) * 0.85;
      const wallX = W / 2 - 0.95 + bow;
      const dBowDz = (Math.PI / (L - 2.4)) * Math.cos(Math.PI * u) * 0.85;
      const tangentAngle = Math.atan(dBowDz);

      ([-1, 1] as const).forEach((side) => {
        // Left wall (-1) faces +X; tangent turns along wall curve
        const rotY = side === -1 ? Math.PI / 2 - tangentAngle : -Math.PI / 2 + tangentAngle;
        panels.push({
          index: i,
          col: i,
          row: isUpperRow ? 1 : 0,
          t,
          z: pz,
          y: py,
          x: side * (wallX - 0.175),
          width: panelWidth,
          height: panelHeight,
          side,
          rotY,
        });
      });
    }

    return {
      panelCountPerSide: colCount,
      panelWidth,
      panelHeight,
      inwardAngle: icePanelInwardAngle,
      panelZs,
      panelYs,
      betweenPanelZs,
      panels,
      curvedWallPoints,
    };
  }

  if (sideLightStyle === 'ice_faceted_amber') {
    // Clean floating diagonal array: 5 large panels per angled wall (10 total) stepping along stadium rake
    const wallFaceX = W / 2 - 0.28 - Math.sin(icePanelInwardAngle) * (panelWidth * 0.45);
    for (let i = 0; i < colCount; i++) {
      const t = colCount > 1 ? i / (colCount - 1) : 0.5;
      const py = THREE.MathUtils.lerp(4.05, Math.min(H - panelHeight * 0.5 - 0.95, topTierY + 4.3), t);
      panelYs.push(py);

      ([-1, 1] as const).forEach((side) => {
        const rotY = side === -1 ? Math.PI / 2 - icePanelInwardAngle : -Math.PI / 2 + icePanelInwardAngle;
        panels.push({
          index: i,
          col: i,
          row: 0,
          t,
          z: panelZs[i],
          y: py,
          x: side * (wallFaceX - t * 0.12),
          width: panelWidth,
          height: panelHeight,
          side,
          rotY,
        });
      });
    }

    return {
      panelCountPerSide: colCount,
      panelWidth,
      panelHeight,
      inwardAngle: icePanelInwardAngle,
      panelZs,
      panelYs,
      betweenPanelZs,
      panels,
    };
  }

  // Default / ICE Immersive Flagship (ice_faceted_cyan):
  // Two symmetrical horizontal tiers across 5 columns per angled wall (10 panels per side)
  const wallFaceX = W / 2 - 0.28 - Math.sin(icePanelInwardAngle) * (panelWidth * 0.45);
  for (let i = 0; i < colCount; i++) {
    const t = colCount > 1 ? i / (colCount - 1) : 0.5;
    const pz = panelZs[i];
    const tierMidY = THREE.MathUtils.lerp(5.55, Math.min(H - 4.3, topTierY + 3.15), t);
    const lowerY = Math.max(panelHeight * 0.5 + 1.05, tierMidY - panelHeight * 0.5 - 0.28);
    const upperY = Math.min(H - panelHeight * 0.5 - 0.95, tierMidY + panelHeight * 0.5 + 0.28);
    panelYs.push((lowerY + upperY) * 0.5);

    ([-1, 1] as const).forEach((side) => {
      const rotY = side === -1 ? Math.PI / 2 - icePanelInwardAngle : -Math.PI / 2 + icePanelInwardAngle;
      // Lower Tier (row 0)
      panels.push({
        index: i * 2,
        col: i,
        row: 0,
        t,
        z: pz,
        y: lowerY,
        x: side * (wallFaceX - t * 0.16),
        width: panelWidth,
        height: panelHeight,
        side,
        rotY,
      });
      // Upper Tier (row 1)
      panels.push({
        index: i * 2 + 1,
        col: i,
        row: 1,
        t,
        z: pz,
        y: upperY,
        x: side * (wallFaceX - t * 0.16),
        width: panelWidth,
        height: panelHeight,
        side,
        rotY,
      });
    });
  }

  return {
    panelCountPerSide: colCount,
    panelWidth,
    panelHeight,
    inwardAngle: icePanelInwardAngle,
    panelZs,
    panelYs,
    betweenPanelZs,
    panels,
  };
}
