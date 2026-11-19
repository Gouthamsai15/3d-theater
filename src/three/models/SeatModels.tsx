import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ThreeEvent, useFrame } from '@react-three/fiber';
import { CameraViewMode, SeatData, SeatModelType, TheaterConfiguration } from '../../types/cinema';
import { getFourSeatPodGroupKey } from '../../config/seating/seatGenerator';
import { createMarbleTrayTexture, createSeatUpholsteryTextures } from '../materials/proceduralTextures';
import {
  applyScreenBounceToMaterial,
  ScreenBounceUniforms,
} from '../lighting/screenBounceShader';
import { BeachSeats } from './BeachSeats';
import { ReservedSeatMarker } from './ReservedSeatMarker';

interface SeatModelsProps {
  config: TheaterConfiguration;
  seats: SeatData[];
  selectedSeatId: string | null;
  hoveredSeatId?: string | null;
  fourDxVibration: number; // 0..1 active motion intensity
  isPlaying: boolean;
  lightFactor?: number; // 0 = dark show, 1 = house lights on
  viewMode?: CameraViewMode;
  interactive?: boolean;
  enableHover?: boolean;
  screenBounceUniforms?: ScreenBounceUniforms;
  onSelectSeat?: (seatId: string) => void;
  onHoverSeat?: (seatId: string | null) => void;
}

interface SeatPartOffsets {
  cushionWidth: number;
  cushionHeight: number;
  cushionDepth: number;
  cushionPos: [number, number, number];
  backrestWidth: number;
  backrestHeight: number;
  backrestDepth: number;
  backrestPos: [number, number, number];
  backrestTilt: number;
  headrestWidth: number;
  headrestHeight: number;
  headrestDepth: number;
  headrestPos: [number, number, number];
  armWidth: number;
  armHeight: number;
  armDepth: number;
  armOffsetX: number;
  armPosY: number;
  armPosZ: number;
  pedestalRadius: number;
  pedestalHeight: number;
  pedestalPos: [number, number, number];
  hasFootrest?: boolean;
  is4dxPod?: boolean;
}

function getSeatProportions(model: SeatModelType, widthScale = 1): SeatPartOffsets {
  const s = widthScale;
  switch (model) {
    case 'charcoal_moss_rocker':
      return {
        cushionWidth: 0.58 * s,
        cushionHeight: 0.19,
        cushionDepth: 0.58,
        cushionPos: [0, 0.43, 0.01],
        backrestWidth: 0.56 * s,
        backrestHeight: 0.72,
        backrestDepth: 0.17,
        backrestPos: [0, 0.8, 0.25],
        backrestTilt: 0.14,
        headrestWidth: 0.46 * s,
        headrestHeight: 0.23,
        headrestDepth: 0.15,
        headrestPos: [0, 1.18, 0.31],
        armWidth: 0.12,
        armHeight: 0.135,
        armDepth: 0.58,
        armOffsetX: 0.35 * s,
        armPosY: 0.585,
        armPosZ: 0.03,
        pedestalRadius: 0.24,
        pedestalHeight: 0.35,
        pedestalPos: [0, 0.175, 0.02],
      };
    case 'ice_recliner':
      return {
        cushionWidth: 0.72 * s,
        cushionHeight: 0.21,
        cushionDepth: 0.64,
        cushionPos: [0, 0.43, 0.02],
        backrestWidth: 0.7 * s,
        backrestHeight: 0.72,
        backrestDepth: 0.19,
        backrestPos: [0, 0.81, 0.27],
        backrestTilt: 0.16,
        headrestWidth: 0.52 * s,
        headrestHeight: 0.24,
        headrestDepth: 0.17,
        headrestPos: [0, 1.19, 0.35],
        armWidth: 0.16,
        armHeight: 0.17,
        armDepth: 0.7,
        armOffsetX: 0.45 * s,
        armPosY: 0.57,
        armPosZ: 0.04,
        pedestalRadius: 0.33,
        pedestalHeight: 0.35,
        pedestalPos: [0, 0.175, 0.02],
        hasFootrest: true,
      };
    case 'ice_cobalt_armchair':
      return {
        cushionWidth: 0.72 * s,
        cushionHeight: 0.21,
        cushionDepth: 0.64,
        cushionPos: [0, 0.43, 0.02],
        backrestWidth: 0.7 * s,
        backrestHeight: 0.7,
        backrestDepth: 0.19,
        backrestPos: [0, 0.8, 0.27],
        backrestTilt: 0.15,
        headrestWidth: 0.52 * s,
        headrestHeight: 0.23,
        headrestDepth: 0.17,
        headrestPos: [0, 1.17, 0.34],
        armWidth: 0.155,
        armHeight: 0.17,
        armDepth: 0.68,
        armOffsetX: 0.45 * s,
        armPosY: 0.57,
        armPosZ: 0.04,
        pedestalRadius: 0.33,
        pedestalHeight: 0.35,
        pedestalPos: [0, 0.175, 0.02],
        hasFootrest: false,
      };
    case 'ice_obsidian_recliner':
      return {
        cushionWidth: 0.73 * s,
        cushionHeight: 0.21,
        cushionDepth: 0.65,
        cushionPos: [0, 0.43, 0.02],
        backrestWidth: 0.71 * s,
        backrestHeight: 0.72,
        backrestDepth: 0.19,
        backrestPos: [0, 0.81, 0.27],
        backrestTilt: 0.16,
        headrestWidth: 0.53 * s,
        headrestHeight: 0.24,
        headrestDepth: 0.17,
        headrestPos: [0, 1.19, 0.35],
        armWidth: 0.155,
        armHeight: 0.17,
        armDepth: 0.7,
        armOffsetX: 0.455 * s,
        armPosY: 0.57,
        armPosZ: 0.04,
        pedestalRadius: 0.33,
        pedestalHeight: 0.35,
        pedestalPos: [0, 0.175, 0.02],
        hasFootrest: true,
      };
    case 'dolby_recliner':
      return {
        cushionWidth: 0.66 * s,
        cushionHeight: 0.2,
        cushionDepth: 0.62,
        cushionPos: [0, 0.42, 0.02],
        backrestWidth: 0.64 * s,
        backrestHeight: 0.68,
        backrestDepth: 0.18,
        backrestPos: [0, 0.78, 0.27],
        backrestTilt: 0.14,
        headrestWidth: 0.48 * s,
        headrestHeight: 0.22,
        headrestDepth: 0.16,
        headrestPos: [0, 1.15, 0.34],
        armWidth: 0.14,
        armHeight: 0.16,
        armDepth: 0.66,
        armOffsetX: 0.41 * s,
        armPosY: 0.56,
        armPosZ: 0.04,
        pedestalRadius: 0.3,
        pedestalHeight: 0.34,
        pedestalPos: [0, 0.17, 0.02],
        hasFootrest: true,
      };
    case 'private_recliner':
      return {
        cushionWidth: 0.74 * s,
        cushionHeight: 0.22,
        cushionDepth: 0.65,
        cushionPos: [0, 0.44, 0.02],
        backrestWidth: 0.72 * s,
        backrestHeight: 0.72,
        backrestDepth: 0.2,
        backrestPos: [0, 0.82, 0.28],
        backrestTilt: 0.16,
        headrestWidth: 0.54 * s,
        headrestHeight: 0.24,
        headrestDepth: 0.17,
        headrestPos: [0, 1.2, 0.36],
        armWidth: 0.16,
        armHeight: 0.18,
        armDepth: 0.7,
        armOffsetX: 0.46 * s,
        armPosY: 0.58,
        armPosZ: 0.04,
        pedestalRadius: 0.34,
        pedestalHeight: 0.36,
        pedestalPos: [0, 0.18, 0.02],
        hasFootrest: true,
      };
    case 'walnut_loveseat':
      return {
        cushionWidth: 0.86 * s,
        cushionHeight: 0.24,
        cushionDepth: 0.94,
        cushionPos: [0, 0.44, -0.11],
        backrestWidth: 0.84 * s,
        backrestHeight: 0.72,
        backrestDepth: 0.22,
        backrestPos: [0, 0.81, 0.33],
        backrestTilt: 0.17,
        headrestWidth: 0.64 * s,
        headrestHeight: 0.25,
        headrestDepth: 0.18,
        headrestPos: [0, 1.19, 0.42],
        armWidth: 0.155,
        armHeight: 0.2,
        armDepth: 0.84,
        armOffsetX: 0.495 * s,
        armPosY: 0.58,
        armPosZ: -0.05,
        pedestalRadius: 0.35,
        pedestalHeight: 0.34,
        pedestalPos: [0, 0.17, -0.08],
        hasFootrest: true,
      };
    case 'champagne_daybed':
      return {
        cushionWidth: 0.84 * s,
        cushionHeight: 0.24,
        cushionDepth: 1.18,
        cushionPos: [0, 0.42, -0.24],
        backrestWidth: 0.82 * s,
        backrestHeight: 0.68,
        backrestDepth: 0.22,
        backrestPos: [0, 0.78, 0.36],
        backrestTilt: 0.16,
        headrestWidth: 0.64 * s,
        headrestHeight: 0.24,
        headrestDepth: 0.18,
        headrestPos: [0, 1.14, 0.44],
        armWidth: 0.16,
        armHeight: 0.22,
        armDepth: 0.96,
        armOffsetX: 0.49 * s,
        armPosY: 0.56,
        armPosZ: -0.1,
        pedestalRadius: 0.36,
        pedestalHeight: 0.31,
        pedestalPos: [0, 0.155, -0.16],
        hasFootrest: false,
      };
    case 'screenx_lounge_pit':
      return {
        cushionWidth: 0.88 * s,
        cushionHeight: 0.22,
        cushionDepth: 0.96,
        cushionPos: [0, 0.34, -0.08],
        backrestWidth: 0.86 * s,
        backrestHeight: 0.58,
        backrestDepth: 0.22,
        backrestPos: [0, 0.64, 0.34],
        backrestTilt: 0.19,
        headrestWidth: 0.68 * s,
        headrestHeight: 0.19,
        headrestDepth: 0.17,
        headrestPos: [0, 0.97, 0.43],
        armWidth: 0.19,
        armHeight: 0.24,
        armDepth: 0.92,
        armOffsetX: 0.505 * s,
        armPosY: 0.44,
        armPosZ: -0.05,
        pedestalRadius: 0.35,
        pedestalHeight: 0.22,
        pedestalPos: [0, 0.11, -0.06],
        hasFootrest: true,
      };
    case 'screenx_multiplex_rocker':
      return {
        cushionWidth: 0.58 * s,
        cushionHeight: 0.185,
        cushionDepth: 0.56,
        cushionPos: [0, 0.43, 0.01],
        backrestWidth: 0.56 * s,
        backrestHeight: 0.72,
        backrestDepth: 0.16,
        backrestPos: [0, 0.8, 0.24],
        backrestTilt: 0.13,
        headrestWidth: 0.48 * s,
        headrestHeight: 0.23,
        headrestDepth: 0.15,
        headrestPos: [0, 1.18, 0.3],
        armWidth: 0.115,
        armHeight: 0.135,
        armDepth: 0.56,
        armOffsetX: 0.35 * s,
        armPosY: 0.58,
        armPosZ: 0.03,
        pedestalRadius: 0.24,
        pedestalHeight: 0.35,
        pedestalPos: [0, 0.175, 0.02],
        hasFootrest: false,
      };
    case '4dx_crimson_pod':
      return {
        cushionWidth: 0.6 * s,
        cushionHeight: 0.18,
        cushionDepth: 0.56,
        cushionPos: [0, 0.58, 0],
        backrestWidth: 0.58 * s,
        backrestHeight: 0.78,
        backrestDepth: 0.17,
        backrestPos: [0, 0.98, 0.22],
        backrestTilt: 0.1,
        headrestWidth: 0.44 * s,
        headrestHeight: 0.26,
        headrestDepth: 0.16,
        headrestPos: [0, 1.4, 0.27],
        armWidth: 0.11,
        armHeight: 0.125,
        armDepth: 0.58,
        armOffsetX: 0.355 * s,
        armPosY: 0.74,
        armPosZ: 0.02,
        pedestalRadius: 0.13,
        pedestalHeight: 0.36,
        pedestalPos: [0, 0.32, 0.03],
        is4dxPod: true,
      };
    case '4dx_arctic_pod':
      return {
        cushionWidth: 0.6 * s,
        cushionHeight: 0.18,
        cushionDepth: 0.56,
        cushionPos: [0, 0.58, 0],
        backrestWidth: 0.58 * s,
        backrestHeight: 0.78,
        backrestDepth: 0.17,
        backrestPos: [0, 0.98, 0.22],
        backrestTilt: 0.1,
        headrestWidth: 0.44 * s,
        headrestHeight: 0.26,
        headrestDepth: 0.16,
        headrestPos: [0, 1.4, 0.27],
        armWidth: 0.11,
        armHeight: 0.125,
        armDepth: 0.58,
        armOffsetX: 0.355 * s,
        armPosY: 0.74,
        armPosZ: 0.02,
        pedestalRadius: 0.13,
        pedestalHeight: 0.36,
        pedestalPos: [0, 0.32, 0.03],
        is4dxPod: true,
      };
    case '4dx_thunder_pod':
      return {
        cushionWidth: 0.6 * s,
        cushionHeight: 0.18,
        cushionDepth: 0.56,
        cushionPos: [0, 0.58, 0],
        backrestWidth: 0.58 * s,
        backrestHeight: 0.78,
        backrestDepth: 0.17,
        backrestPos: [0, 0.98, 0.22],
        backrestTilt: 0.1,
        headrestWidth: 0.44 * s,
        headrestHeight: 0.26,
        headrestDepth: 0.16,
        headrestPos: [0, 1.4, 0.27],
        armWidth: 0.11,
        armHeight: 0.125,
        armDepth: 0.58,
        armOffsetX: 0.355 * s,
        armPosY: 0.74,
        armPosZ: 0.02,
        pedestalRadius: 0.13,
        pedestalHeight: 0.36,
        pedestalPos: [0, 0.32, 0.03],
        is4dxPod: true,
      };
    case '4dx_exoskeleton_pod':
      return {
        cushionWidth: 0.59 * s,
        cushionHeight: 0.185,
        cushionDepth: 0.56,
        cushionPos: [0, 0.58, 0],
        backrestWidth: 0.57 * s,
        backrestHeight: 0.78,
        backrestDepth: 0.17,
        backrestPos: [0, 0.98, 0.22],
        backrestTilt: 0.1,
        headrestWidth: 0.44 * s,
        headrestHeight: 0.26,
        headrestDepth: 0.16,
        headrestPos: [0, 1.4, 0.27],
        armWidth: 0.11,
        armHeight: 0.125,
        armDepth: 0.58,
        armOffsetX: 0.35 * s,
        armPosY: 0.74,
        armPosZ: 0.02,
        pedestalRadius: 0.13,
        pedestalHeight: 0.36,
        pedestalPos: [0, 0.32, 0.03],
        is4dxPod: true,
      };
    case '4dx_motion':
      return {
        cushionWidth: 0.58 * s,
        cushionHeight: 0.17,
        cushionDepth: 0.56,
        cushionPos: [0, 0.54, 0],
        backrestWidth: 0.56 * s,
        backrestHeight: 0.72,
        backrestDepth: 0.16,
        backrestPos: [0, 0.92, 0.22],
        backrestTilt: 0.1,
        headrestWidth: 0.42 * s,
        headrestHeight: 0.24,
        headrestDepth: 0.15,
        headrestPos: [0, 1.32, 0.27],
        armWidth: 0.11,
        armHeight: 0.12,
        armDepth: 0.58,
        armOffsetX: 0.35 * s,
        armPosY: 0.71,
        armPosZ: 0.02,
        pedestalRadius: 0.18,
        pedestalHeight: 0.46,
        pedestalPos: [0, 0.23, 0.04],
        is4dxPod: true,
      };
    case 'multiplex_stadium':
      return {
        cushionWidth: 0.57 * s,
        cushionHeight: 0.175,
        cushionDepth: 0.55,
        cushionPos: [0, 0.425, 0.01],
        backrestWidth: 0.56 * s,
        backrestHeight: 0.69,
        backrestDepth: 0.16,
        backrestPos: [0, 0.78, 0.23],
        backrestTilt: 0.12,
        headrestWidth: 0.46 * s,
        headrestHeight: 0.21,
        headrestDepth: 0.145,
        headrestPos: [0, 1.15, 0.285],
        armWidth: 0.115,
        armHeight: 0.125,
        armDepth: 0.54,
        armOffsetX: 0.345 * s,
        armPosY: 0.575,
        armPosZ: 0.025,
        pedestalRadius: 0.11,
        pedestalHeight: 0.36,
        pedestalPos: [0, 0.18, 0.04],
      };
    case 'mandap_royal_stadium':
      return {
        cushionWidth: 0.56 * s,
        cushionHeight: 0.18,
        cushionDepth: 0.55,
        cushionPos: [0, 0.425, 0.01],
        backrestWidth: 0.55 * s,
        backrestHeight: 0.7,
        backrestDepth: 0.16,
        backrestPos: [0, 0.785, 0.235],
        backrestTilt: 0.13,
        headrestWidth: 0.45 * s,
        headrestHeight: 0.21,
        headrestDepth: 0.145,
        headrestPos: [0, 1.155, 0.29],
        armWidth: 0.115,
        armHeight: 0.128,
        armDepth: 0.55,
        armOffsetX: 0.345 * s,
        armPosY: 0.575,
        armPosZ: 0.025,
        pedestalRadius: 0.115,
        pedestalHeight: 0.36,
        pedestalPos: [0, 0.18, 0.04],
      };
    case 'charcoal_purple_stadium':
      return {
        cushionWidth: 0.56 * s,
        cushionHeight: 0.175,
        cushionDepth: 0.55,
        cushionPos: [0, 0.425, 0.01],
        backrestWidth: 0.55 * s,
        backrestHeight: 0.71,
        backrestDepth: 0.16,
        backrestPos: [0, 0.79, 0.235],
        backrestTilt: 0.13,
        headrestWidth: 0.45 * s,
        headrestHeight: 0.22,
        headrestDepth: 0.145,
        headrestPos: [0, 1.16, 0.29],
        armWidth: 0.115,
        armHeight: 0.125,
        armDepth: 0.55,
        armOffsetX: 0.345 * s,
        armPosY: 0.575,
        armPosZ: 0.025,
        pedestalRadius: 0.115,
        pedestalHeight: 0.36,
        pedestalPos: [0, 0.18, 0.04],
      };
    case 'imax_rocker':
      return {
        cushionWidth: 0.58 * s,
        cushionHeight: 0.19,
        cushionDepth: 0.57,
        cushionPos: [0, 0.43, 0.01],
        backrestWidth: 0.57 * s,
        backrestHeight: 0.71,
        backrestDepth: 0.17,
        backrestPos: [0, 0.79, 0.24],
        backrestTilt: 0.14,
        headrestWidth: 0.48 * s,
        headrestHeight: 0.23,
        headrestDepth: 0.155,
        headrestPos: [0, 1.17, 0.3],
        armWidth: 0.148,
        armHeight: 0.135,
        armDepth: 0.58,
        armOffsetX: 0.365 * s,
        armPosY: 0.58,
        armPosZ: 0.03,
        pedestalRadius: 0.12,
        pedestalHeight: 0.355,
        pedestalPos: [0, 0.178, 0.04],
      };
    case 'imax_stadium':
      return {
        cushionWidth: 0.54 * s,
        cushionHeight: 0.16,
        cushionDepth: 0.52,
        cushionPos: [0, 0.42, 0],
        backrestWidth: 0.52 * s,
        backrestHeight: 0.64,
        backrestDepth: 0.14,
        backrestPos: [0, 0.76, 0.21],
        backrestTilt: 0.1,
        headrestWidth: 0.42 * s,
        headrestHeight: 0.18,
        headrestDepth: 0.13,
        headrestPos: [0, 1.11, 0.25],
        armWidth: 0.09,
        armHeight: 0.09,
        armDepth: 0.48,
        armOffsetX: 0.32 * s,
        armPosY: 0.58,
        armPosZ: 0.02,
        pedestalRadius: 0.085,
        pedestalHeight: 0.36,
        pedestalPos: [0, 0.18, 0.05],
      };
    case 'standard':
    default:
      return {
        cushionWidth: 0.53 * s,
        cushionHeight: 0.15,
        cushionDepth: 0.5,
        cushionPos: [0, 0.42, 0],
        backrestWidth: 0.51 * s,
        backrestHeight: 0.62,
        backrestDepth: 0.13,
        backrestPos: [0, 0.74, 0.21],
        backrestTilt: 0.09,
        headrestWidth: 0.4 * s,
        headrestHeight: 0.16,
        headrestDepth: 0.12,
        headrestPos: [0, 1.08, 0.25],
        armWidth: 0.09,
        armHeight: 0.09,
        armDepth: 0.46,
        armOffsetX: 0.31 * s,
        armPosY: 0.57,
        armPosZ: 0.02,
        pedestalRadius: 0.075,
        pedestalHeight: 0.36,
        pedestalPos: [0, 0.18, 0.05],
      };
  }
}

/**
 * Side-profile extruded waterfall seat cushion (rotated so -Z is front edge).
 */
function buildErgonomicCushionGeo(w: number, h: number, d: number): THREE.BufferGeometry {
  const hd = d / 2;
  const hh = h / 2;
  const shape = new THREE.Shape();
  // x runs -hd (front) to +hd (rear)
  shape.moveTo(-hd + 0.05, -hh);
  shape.lineTo(hd - 0.03, -hh + 0.02);
  shape.quadraticCurveTo(hd, -hh + 0.02, hd, 0);
  shape.lineTo(hd - 0.01, hh - 0.02);
  shape.quadraticCurveTo(0, hh + 0.015, -hd + 0.04, hh);
  shape.quadraticCurveTo(-hd - 0.015, hh - 0.02, -hd, -hh + 0.03);
  shape.quadraticCurveTo(-hd, -hh, -hd + 0.05, -hh);

  const innerW = Math.max(0.1, w - 0.055);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: innerW,
    bevelEnabled: true,
    bevelThickness: 0.028,
    bevelSize: 0.022,
    bevelSegments: 2,
    curveSegments: 5,
  });
  geo.translate(0, 0, -innerW / 2);
  geo.rotateY(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Side-profile extruded lumbar-contoured backrest.
 */
function buildErgonomicBackrestGeo(w: number, h: number, d: number): THREE.BufferGeometry {
  const hd = d / 2;
  const hh = h / 2;
  const shape = new THREE.Shape();
  // Lumbar bulge at lower-mid front (-x), curved back at top
  shape.moveTo(-hd + 0.01, -hh);
  shape.lineTo(hd, -hh);
  shape.quadraticCurveTo(hd + 0.02, 0, hd - 0.01, hh - 0.02);
  shape.quadraticCurveTo(0, hh + 0.02, -hd + 0.02, hh - 0.02);
  shape.quadraticCurveTo(-hd - 0.028, -hh * 0.25, -hd + 0.01, -hh);

  const innerW = Math.max(0.1, w - 0.055);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: innerW,
    bevelEnabled: true,
    bevelThickness: 0.028,
    bevelSize: 0.022,
    bevelSegments: 2,
    curveSegments: 6,
  });
  geo.translate(0, 0, -innerW / 2);
  geo.rotateY(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

/**
 * U-shaped contrast upholstery piping tracing the left, top, and right backrest seam.
 */
function buildSeatBackPipingGeo(w: number, h: number): THREE.BufferGeometry {
  const hw = w * 0.47;
  const hh = h * 0.46;
  const botY = -h * 0.41;
  const t = 0.019;

  const shape = new THREE.Shape();
  shape.moveTo(-hw, botY);
  shape.lineTo(-hw, hh);
  shape.lineTo(hw, hh);
  shape.lineTo(hw, botY);
  shape.lineTo(hw - t, botY);
  shape.lineTo(hw - t, hh - t);
  shape.lineTo(-hw + t, hh - t);
  shape.lineTo(-hw + t, botY);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.022,
    bevelEnabled: false,
  });
  geo.translate(0, 0, -0.011);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Side-profile plush pillow headrest.
 */
function buildHeadrestPillowGeo(w: number, h: number, d: number): THREE.BufferGeometry {
  const hd = d / 2;
  const hh = h / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-hd + 0.02, -hh);
  shape.lineTo(hd - 0.01, -hh);
  shape.quadraticCurveTo(hd + 0.015, 0, hd - 0.015, hh);
  shape.quadraticCurveTo(0, hh + 0.015, -hd + 0.02, hh - 0.01);
  shape.quadraticCurveTo(-hd - 0.025, 0, -hd + 0.02, -hh);

  const innerW = Math.max(0.1, w - 0.045);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: innerW,
    bevelEnabled: true,
    bevelThickness: 0.024,
    bevelSize: 0.02,
    bevelSegments: 2,
    curveSegments: 5,
  });
  geo.translate(0, 0, -innerW / 2);
  geo.rotateY(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Curved ergonomic armrest body.
 */
function buildSculptedArmrestGeo(w: number, h: number, d: number): THREE.BufferGeometry {
  const hd = d / 2;
  const hh = h / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-hd + 0.04, -hh);
  shape.lineTo(hd, -hh);
  shape.lineTo(hd, hh * 0.75);
  shape.quadraticCurveTo(0, hh + 0.02, -hd + 0.03, hh * 0.85);
  shape.quadraticCurveTo(-hd - 0.02, 0, -hd + 0.04, -hh);

  const innerW = Math.max(0.04, w - 0.028);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: innerW,
    bevelEnabled: true,
    bevelThickness: 0.014,
    bevelSize: 0.012,
    bevelSegments: 2,
    curveSegments: 4,
  });
  geo.translate(0, 0, -innerW / 2);
  geo.rotateY(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

const IndoorSeatModels: React.FC<SeatModelsProps> = ({
  config,
  seats,
  selectedSeatId,
  hoveredSeatId = null,
  fourDxVibration,
  isPlaying,
  lightFactor = 1,
  viewMode = 'seat',
  interactive = false,
  enableHover = false,
  screenBounceUniforms,
  onSelectSeat,
  onHoverSeat,
}) => {
  const { environmentProfile, seatModel, seatWidthScale = 1 } = config;
  const props = useMemo(() => getSeatProportions(seatModel, seatWidthScale), [seatModel, seatWidthScale]);

  const cushionRef = useRef<THREE.InstancedMesh>(null);
  const backrestRef = useRef<THREE.InstancedMesh>(null);
  const headrestRef = useRef<THREE.InstancedMesh>(null);
  const leftArmRef = useRef<THREE.InstancedMesh>(null);
  const rightArmRef = useRef<THREE.InstancedMesh>(null);
  const cupholderRef = useRef<THREE.InstancedMesh>(null);
  const cupRimRef = useRef<THREE.InstancedMesh>(null);
  const pedestalRef = useRef<THREE.InstancedMesh>(null);
  const pedestalFlangeRef = useRef<THREE.InstancedMesh>(null);
  const footrestRef = useRef<THREE.InstancedMesh>(null);
  const nozzleRef = useRef<THREE.InstancedMesh>(null);
  const armControlRef = useRef<THREE.InstancedMesh>(null);
  const pipingRef = useRef<THREE.InstancedMesh>(null);
  const backShellRef = useRef<THREE.InstancedMesh>(null);
  const leftBolsterRef = useRef<THREE.InstancedMesh>(null);
  const rightBolsterRef = useRef<THREE.InstancedMesh>(null);
  const redStitchTrimRef = useRef<THREE.InstancedMesh>(null);
  const neckVentRef = useRef<THREE.InstancedMesh>(null);
  const steelFootBarRef = useRef<THREE.InstancedMesh>(null);
  const steelFootHangerLeftRef = useRef<THREE.InstancedMesh>(null);
  const steelFootHangerRightRef = useRef<THREE.InstancedMesh>(null);
  const lumbarCushionRef = useRef<THREE.InstancedMesh>(null);
  const leftActuatorRef = useRef<THREE.InstancedMesh>(null);
  const rightActuatorRef = useRef<THREE.InstancedMesh>(null);
  const seatTagRef = useRef<THREE.InstancedMesh>(null);
  const sideTablePostRef = useRef<THREE.InstancedMesh>(null);
  const sideTableTopRef = useRef<THREE.InstancedMesh>(null);
  const throwPillowRef = useRef<THREE.InstancedMesh>(null);
  const throwBlanketRef = useRef<THREE.InstancedMesh>(null);
  const lampStemRef = useRef<THREE.InstancedMesh>(null);
  const lampShadeRef = useRef<THREE.InstancedMesh>(null);
  const seatGroupRef = useRef<THREE.Group>(null);

  const count = seats.length;
  const isLeather = environmentProfile.seatMaterialType !== 'fabric';
  const isIceRecliner = seatModel === 'ice_recliner';
  const isIceCobaltArmchair = seatModel === 'ice_cobalt_armchair';
  const isIceObsidianRecliner = seatModel === 'ice_obsidian_recliner';
  const isAnyIceSeat = isIceRecliner || isIceCobaltArmchair || isIceObsidianRecliner;
  const isWalnutLoveseat = seatModel === 'walnut_loveseat';
  const isChampagneDaybed = seatModel === 'champagne_daybed';
  const isScreenXPit = seatModel === 'screenx_lounge_pit';
  const isMultiplexScreenXRocker = seatModel === 'screenx_multiplex_rocker';
  const isCrimson4dxPod = seatModel === '4dx_crimson_pod';
  const isArctic4dxPod = seatModel === '4dx_arctic_pod';
  const isThunder4dxPod = seatModel === '4dx_thunder_pod';
  const isExoskeleton4dxPod = seatModel === '4dx_exoskeleton_pod';
  const isAny4dxPod = isCrimson4dxPod || isArctic4dxPod || isThunder4dxPod || isExoskeleton4dxPod;
  const isMultiplexStadium = seatModel === 'multiplex_stadium';
  const isMandapSeat = seatModel === 'mandap_royal_stadium';
  const isParametricPurpleSeat = seatModel === 'charcoal_purple_stadium';
  const isBiophilicMossSeat = seatModel === 'charcoal_moss_rocker';
  const isVolcanicCopperSeat = isMultiplexStadium && config.theaterId === 'standard_2d';
  const isImaxRocker = seatModel === 'imax_rocker';
  const isImaxAuroraSeat = isImaxRocker && config.theaterId === 'imax_aurora';
  const isImaxSolarSeat = isImaxRocker && config.theaterId === 'imax_solar';
  const isDolbyObsidianSeat = config.theaterId === 'dolby';
  const isDolbyCobaltSeat = config.theaterId === 'dolby_cobalt';
  const isDolbyVeilSeat = config.theaterId === 'dolby_cobalt_veil';
  const isImaxVipTwoTone = isImaxAuroraSeat || isImaxSolarSeat;

  const upholsteryTex = useMemo(
    () =>
      createSeatUpholsteryTextures(
        isLeather,
        isIceRecliner || isIceObsidianRecliner,
        isAny4dxPod,
        isChampagneDaybed || isWalnutLoveseat
          ? 'boucle'
          : isIceObsidianRecliner
            ? 'suede'
            : isDolbyVeilSeat
              ? 'charcoal_knit'
              : isIceRecliner || isDolbyObsidianSeat
                ? 'blue_stitched'
                : isArctic4dxPod
                  ? 'violet_stitched'
                  : isExoskeleton4dxPod
                    ? 'crimson_tech_leather'
                    : isThunder4dxPod
                      ? 'perforated'
                      : 'default',
      ),
    [isLeather, isIceRecliner, isIceObsidianRecliner, isAny4dxPod, isChampagneDaybed, isWalnutLoveseat, isArctic4dxPod, isThunder4dxPod, isExoskeleton4dxPod, isDolbyObsidianSeat, isDolbyVeilSeat],
  );

  const marbleTrayMap = useMemo(
    () => (isDolbyVeilSeat ? createMarbleTrayTexture() : null),
    [isDolbyVeilSeat],
  );

  // Group modular synchronized 4DX motion pods so every 4-seat (or 3-seat center) bank sits on an articulated hydraulic chassis deck
  const fourSeatPods = useMemo(() => {
    if (!isAny4dxPod) return [];
    const podMap = new Map<string, { sumX: number; minX: number; maxX: number; y: number; z: number; yaw: number; count: number }>();
    seats.forEach((seat) => {
      const key = getFourSeatPodGroupKey(seat.rowIndex, seat.seatNumber, config);
      const [sx, sy, sz] = seat.worldPosition;
      const existing = podMap.get(key);
      if (!existing) {
        podMap.set(key, { sumX: sx, minX: sx, maxX: sx, y: sy, z: sz, yaw: seat.yaw ?? 0, count: 1 });
      } else {
        existing.sumX += sx;
        existing.minX = Math.min(existing.minX, sx);
        existing.maxX = Math.max(existing.maxX, sx);
        existing.count += 1;
      }
    });
    return Array.from(podMap.entries()).map(([key, val]) => ({
      key,
      cx: val.sumX / val.count,
      y: val.y,
      z: val.z,
      yaw: val.yaw,
      width: Math.max(1.85, val.maxX - val.minX + 0.84),
    }));
  }, [isAny4dxPod, seats, config]);

  useEffect(() => {
    return () => {
      upholsteryTex.dispose();
      marbleTrayMap?.dispose();
    };
  }, [upholsteryTex, marbleTrayMap]);

  const materials = useMemo(() => {
    const primaryMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#ffffff',
        map: upholsteryTex.map,
        bumpMap: upholsteryTex.bumpMap,
        bumpScale: isDolbyVeilSeat || isExoskeleton4dxPod ? 0.011 : isDolbyObsidianSeat || isDolbyCobaltSeat ? 0.008 : isLeather ? 0.009 : 0.014,
        roughness: isIceObsidianRecliner
          ? 0.78
          : isWalnutLoveseat
            ? 0.86
            : isScreenXPit || isMultiplexScreenXRocker
              ? 0.84
              : isBiophilicMossSeat
                ? 0.89
                : isMultiplexStadium
                  ? 0.82
                  : isMandapSeat
                    ? 0.92
                    : isParametricPurpleSeat
                      ? 0.9
                      : isDolbyVeilSeat
                        ? 0.88
                        : isExoskeleton4dxPod
                          ? 0.46
                          : isImaxSolarSeat
                            ? 0.48
                            : isImaxRocker
                              ? 0.54
                              : isDolbyObsidianSeat || isDolbyCobaltSeat
                                ? 0.36
                                : isLeather
                                  ? 0.28
                                  : 0.72,
        metalness: isIceObsidianRecliner || isWalnutLoveseat || isScreenXPit || isMultiplexScreenXRocker || isMultiplexStadium || isMandapSeat || isParametricPurpleSeat || isBiophilicMossSeat || isDolbyVeilSeat ? 0.01 : isImaxRocker || isExoskeleton4dxPod ? 0.05 : isLeather ? 0.07 : 0.02,
      }),
      screenBounceUniforms,
    );
    const trimMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        map: isChampagneDaybed ? upholsteryTex.map : undefined,
        bumpMap: isChampagneDaybed ? upholsteryTex.bumpMap : undefined,
        bumpScale: isChampagneDaybed ? 0.012 : 0,
        color: isIceRecliner
          ? '#8e99aa'
          : isIceCobaltArmchair
            ? '#c7b28f'
            : isIceObsidianRecliner
              ? '#14161a'
              : isScreenXPit
                ? '#0e1014'
                : isMultiplexScreenXRocker || isMandapSeat
                  ? '#1e222b'
                  : isParametricPurpleSeat
                    ? '#171920'
                    : isBiophilicMossSeat
                      ? '#272c30'
                      : isVolcanicCopperSeat
                        ? '#4f3a29'
                        : isWalnutLoveseat
                          ? '#9d522b'
                          : isChampagneDaybed
                            ? '#0f3b2e'
                            : isDolbyVeilSeat
                              ? '#1a1c22'
                              : isDolbyObsidianSeat
                                ? '#0b0d12'
                                : isDolbyCobaltSeat
                                  ? '#1a1412'
                                  : isImaxAuroraSeat
                                    ? '#2e3440'
                                    : isImaxSolarSeat
                                      ? '#134c59'
                                      : isThunder4dxPod
                                        ? '#363b44'
                                        : isExoskeleton4dxPod
                                          ? '#13151b'
                                          : isAny4dxPod
                                            ? '#16181f'
                                            : environmentProfile.seatTrimColor,
        roughness: isIceRecliner
          ? 0.28
          : isIceCobaltArmchair
            ? 0.32
            : isIceObsidianRecliner
              ? 0.42
              : isScreenXPit
                ? 0.36
                : isMultiplexScreenXRocker || isMandapSeat || isParametricPurpleSeat || isBiophilicMossSeat
                  ? 0.88
                  : isChampagneDaybed
                    ? 0.86
                    : isWalnutLoveseat
                      ? 0.34
                      : isVolcanicCopperSeat
                        ? 0.42
                        : isMultiplexStadium
                          ? 0.78
                          : isImaxRocker
                            ? 0.68
                            : isThunder4dxPod
                              ? 0.34
                              : isDolbyVeilSeat
                                ? 0.52
                                : isDolbyObsidianSeat || isDolbyCobaltSeat
                                  ? 0.35
                                  : seatModel === '4dx_motion' || isAny4dxPod
                                    ? 0.36
                                    : 0.38,
        metalness: isIceRecliner
          ? 0.85
          : isIceCobaltArmchair
            ? 0.68
            : isIceObsidianRecliner
              ? 0.78
              : isScreenXPit
                ? 0.06
                : isMultiplexScreenXRocker || isMandapSeat || isParametricPurpleSeat || isBiophilicMossSeat
                  ? 0.02
                  : isChampagneDaybed
                    ? 0.02
                    : isWalnutLoveseat
                      ? 0.06
                      : isVolcanicCopperSeat
                        ? 0.42
                        : isMultiplexStadium
                          ? 0.04
                          : isImaxRocker
                            ? 0.06
                            : seatModel === '4dx_motion'
                              ? 0.65
                              : isAny4dxPod
                                ? 0.18
                                : isDolbyVeilSeat
                                  ? 0.04
                                  : isDolbyObsidianSeat || isDolbyCobaltSeat
                                    ? 0.08
                                    : 0.28,
      }),
      screenBounceUniforms,
    );
    const charcoalBolsterMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: isDolbyVeilSeat
          ? '#c46818'
          : isIceRecliner
            ? '#475263'
            : isIceCobaltArmchair
              ? '#7d6e60'
              : isIceObsidianRecliner
                ? '#282c32'
                : isMultiplexScreenXRocker || isParametricPurpleSeat
                  ? '#1b1e26'
                  : isBiophilicMossSeat
                    ? '#272c30'
                    : '#272a31',
        roughness: isDolbyVeilSeat ? 0.36 : isIceObsidianRecliner || isMultiplexScreenXRocker || isMandapSeat || isParametricPurpleSeat || isBiophilicMossSeat ? 0.88 : isIceRecliner || isIceCobaltArmchair ? 0.46 : 0.8,
        metalness: isDolbyVeilSeat ? 0.04 : 0.02,
      }),
      screenBounceUniforms,
    );
    const baseMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: seatModel === '4dx_motion'
          ? '#1e293b'
          : isScreenXPit
            ? '#0c0e13'
            : isWalnutLoveseat || isChampagneDaybed
              ? '#c9a861'
              : isThunder4dxPod
                ? '#9aa3b2'
                : isExoskeleton4dxPod
                  ? '#181b22'
                  : isAny4dxPod
                    ? '#1a1d24'
                    : '#121318',
        roughness: isThunder4dxPod ? 0.26 : isScreenXPit ? 0.32 : isWalnutLoveseat || isChampagneDaybed ? 0.28 : isMultiplexStadium || isParametricPurpleSeat || isBiophilicMossSeat || isImaxRocker ? 0.8 : 0.36,
        metalness: isThunder4dxPod ? 0.88 : isScreenXPit ? 0.82 : isWalnutLoveseat || isChampagneDaybed ? 0.85 : isMultiplexStadium || isParametricPurpleSeat || isBiophilicMossSeat || isImaxRocker ? 0.15 : 0.78,
      }),
      screenBounceUniforms,
    );
    const cupMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#07080a',
        roughness: isMultiplexStadium || isParametricPurpleSeat || isBiophilicMossSeat || isImaxRocker ? 0.72 : 0.28,
        metalness: isMultiplexStadium || isParametricPurpleSeat || isBiophilicMossSeat || isImaxRocker ? 0.12 : 0.75,
      }),
      screenBounceUniforms,
    );
    const cupRimMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color:
          isIceRecliner
            ? '#8e99aa'
            : isIceCobaltArmchair
              ? '#c7b28f'
              : isIceObsidianRecliner
                ? '#1e2228'
                : isDolbyVeilSeat
                  ? '#9a5e24'
                  : isDolbyObsidianSeat
                    ? '#1a2b4a'
                  : isDolbyCobaltSeat
                    ? '#242934'
                    : seatModel === 'private_recliner' || isChampagneDaybed
                      ? '#b89446'
                      : isWalnutLoveseat
                        ? '#5e432c'
                        : isCrimson4dxPod || isExoskeleton4dxPod
                          ? '#b91c1c'
                          : isArctic4dxPod
                            ? '#8b5cf6'
                            : isThunder4dxPod
                              ? '#b4becd'
                              : isMultiplexStadium || isImaxRocker || isMandapSeat || isParametricPurpleSeat || isBiophilicMossSeat
                                ? '#252934'
                                : '#525866',
        roughness: isMultiplexStadium || isImaxRocker || isMandapSeat || isParametricPurpleSeat || isBiophilicMossSeat ? 0.72 : 0.24,
        metalness: isMultiplexStadium || isImaxRocker || isMandapSeat || isParametricPurpleSeat || isBiophilicMossSeat ? 0.16 : 0.88,
      }),
      screenBounceUniforms,
    );
    const nozzleMat = new THREE.MeshStandardMaterial({
      color: isCrimson4dxPod ? '#2563eb' : isArctic4dxPod ? '#22d3ee' : isExoskeleton4dxPod ? '#cbd5e1' : isThunder4dxPod ? '#c2cbd8' : '#38bdf8',
      emissive: isArctic4dxPod ? '#8b5cf6' : isExoskeleton4dxPod ? '#ef4444' : isThunder4dxPod ? '#f59e0b' : '#0ea5e9',
      emissiveIntensity: isThunder4dxPod || isExoskeleton4dxPod ? 0.26 : 0.35,
      roughness: 0.24,
      metalness: 0.86,
    });
    const armControlMat = new THREE.MeshStandardMaterial({
      color: '#1e293b',
      emissive: config.lightingProfile.stepLightColor,
      emissiveIntensity: 0.72,
      roughness: 0.22,
      metalness: 0.4,
    });
    const pipingMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: isCrimson4dxPod || isExoskeleton4dxPod ? '#dc2626' : isArctic4dxPod || isParametricPurpleSeat ? '#a855f7' : isThunder4dxPod ? '#9aa3b2' : '#6b7280',
        emissive: isParametricPurpleSeat ? '#7e22ce' : '#000000',
        emissiveIntensity: isParametricPurpleSeat ? 0.26 : 0,
        roughness: isThunder4dxPod ? 0.26 : 0.28,
        metalness: isThunder4dxPod ? 0.88 : isAny4dxPod ? 0.32 : isParametricPurpleSeat ? 0.12 : 0.6,
      }),
      screenBounceUniforms,
    );
    const brushedSteelMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: isThunder4dxPod ? '#b8c1cf' : '#8892a2',
        roughness: 0.26,
        metalness: 0.9,
      }),
      screenBounceUniforms,
    );
    const lumbarMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: isThunder4dxPod ? '#323740' : isExoskeleton4dxPod ? '#15181f' : '#16181f',
        roughness: 0.38,
        metalness: 0.04,
      }),
      screenBounceUniforms,
    );
    const dolbyTagMat = new THREE.MeshStandardMaterial({
      color: '#0e2244',
      emissive: '#0088ff',
      emissiveIntensity: 0.72,
      roughness: 0.24,
      metalness: 0.3,
    });
    const sideTableTopMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        map: isDolbyVeilSeat && marbleTrayMap ? marbleTrayMap : undefined,
        color: isDolbyVeilSeat
          ? '#ffffff'
          : isScreenXPit
            ? '#b8cce0'
            : isWalnutLoveseat
              ? '#e2ddd4'
              : isIceObsidianRecliner
                ? '#4b2e1b'
                : isIceCobaltArmchair
                  ? '#6e4e35'
                  : isChampagneDaybed
                    ? '#352d26'
                    : '#13161c',
        roughness: isDolbyVeilSeat ? 0.2 : isScreenXPit ? 0.16 : isWalnutLoveseat ? 0.32 : isIceObsidianRecliner ? 0.44 : isChampagneDaybed ? 0.62 : 0.42,
        metalness: isDolbyVeilSeat ? 0.08 : isScreenXPit ? 0.12 : isWalnutLoveseat ? 0.06 : isChampagneDaybed || isIceObsidianRecliner ? 0.08 : 0.26,
        transparent: isScreenXPit,
        opacity: isScreenXPit ? 0.88 : 1.0,
      }),
      screenBounceUniforms,
    );
    const throwPillowMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#ffffff',
        roughness: 0.88,
        metalness: 0.02,
      }),
      screenBounceUniforms,
    );
    const cashmereMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#e0d6c6',
        roughness: 0.94,
        metalness: 0.01,
      }),
      screenBounceUniforms,
    );
    const brassLampMat = applyScreenBounceToMaterial(
      new THREE.MeshStandardMaterial({
        color: '#c9a861',
        roughness: 0.26,
        metalness: 0.88,
      }),
      screenBounceUniforms,
    );
    const lampShadeMat = new THREE.MeshStandardMaterial({
      color: '#f7e5c3',
      emissive: '#ffcf86',
      emissiveIntensity: 0.9,
      roughness: 0.42,
      metalness: 0.05,
    });
    return {
      primaryMat,
      trimMat,
      charcoalBolsterMat,
      baseMat,
      cupMat,
      cupRimMat,
      nozzleMat,
      armControlMat,
      pipingMat,
      brushedSteelMat,
      lumbarMat,
      dolbyTagMat,
      sideTableTopMat,
      throwPillowMat,
      cashmereMat,
      brassLampMat,
      lampShadeMat,
    };
  }, [
    environmentProfile,
    seatModel,
    upholsteryTex,
    marbleTrayMap,
    isLeather,
    isIceRecliner,
    isIceCobaltArmchair,
    isIceObsidianRecliner,
    isWalnutLoveseat,
    isChampagneDaybed,
    isScreenXPit,
    isMultiplexScreenXRocker,
    isCrimson4dxPod,
    isArctic4dxPod,
    isThunder4dxPod,
    isExoskeleton4dxPod,
    isAny4dxPod,
    isMultiplexStadium,
    isMandapSeat,
    isParametricPurpleSeat,
    isBiophilicMossSeat,
    isVolcanicCopperSeat,
    isImaxRocker,
    isImaxAuroraSeat,
    isImaxSolarSeat,
    isDolbyObsidianSeat,
    isDolbyCobaltSeat,
    isDolbyVeilSeat,
    screenBounceUniforms,
    config.lightingProfile.stepLightColor,
  ]);

  useEffect(() => {
    materials.nozzleMat.emissiveIntensity = isPlaying ? 0.18 : 0.35;
    materials.armControlMat.emissiveIntensity = isPlaying ? 0.22 : 0.75;
    materials.dolbyTagMat.emissiveIntensity = isPlaying ? 0.32 : 0.78;
    materials.lampShadeMat.emissiveIntensity = isPlaying ? 0.18 : 0.92;
  }, [materials, isPlaying]);

  const geometries = useMemo(() => {
    const cushionGeo = buildErgonomicCushionGeo(
      props.cushionWidth,
      props.cushionHeight,
      props.cushionDepth,
    );
    const backrestGeo = buildErgonomicBackrestGeo(
      props.backrestWidth,
      props.backrestHeight,
      props.backrestDepth,
    );
    const headrestGeo = buildHeadrestPillowGeo(
      props.headrestWidth,
      props.headrestHeight,
      props.headrestDepth,
    );
    const armGeo = buildSculptedArmrestGeo(props.armWidth, props.armHeight, props.armDepth);
    const cupGeo = new THREE.CylinderGeometry(0.036, 0.031, 0.055, 14);
    const cupRimGeo = new THREE.TorusGeometry(0.039, 0.0055, 8, 18);
    cupRimGeo.rotateX(Math.PI / 2);

    const pedestalGeo =
      props.hasFootrest || isChampagneDaybed || isScreenXPit
        ? new THREE.BoxGeometry(
            props.cushionWidth * (isScreenXPit ? 0.96 : 0.92),
            props.pedestalHeight,
            isChampagneDaybed ? props.cushionDepth * 0.86 : isScreenXPit ? 0.86 : 0.56,
          )
        : new THREE.CylinderGeometry(
            props.pedestalRadius * 0.82,
            props.pedestalRadius * 1.12,
            props.pedestalHeight,
            14,
          );
    const pedestalFlangeGeo = new THREE.CylinderGeometry(
      props.pedestalRadius * 1.9,
      props.pedestalRadius * 2.1,
      0.035,
      16,
    );
    const footrestGeo = buildErgonomicCushionGeo(props.cushionWidth * 0.88, 0.095, 0.36);
    const nozzleGeo = new THREE.CylinderGeometry(0.025, 0.032, 0.56, 10);
    nozzleGeo.rotateZ(Math.PI / 2);
    const armControlGeo = new THREE.BoxGeometry(0.022, 0.012, 0.068);
    const pipingGeo = isParametricPurpleSeat
      ? buildSeatBackPipingGeo(props.backrestWidth, props.backrestHeight)
      : new THREE.BoxGeometry(props.backrestWidth * 0.96, 0.016, 0.022);
    const backShellGeo = new THREE.BoxGeometry(
      props.backrestWidth * 0.94,
      props.backrestHeight * 0.88,
      0.045,
    );
    const bolsterGeo = new THREE.BoxGeometry(0.085, 0.52, 0.16);
    const redStitchTrimGeo = new THREE.BoxGeometry(props.backrestWidth * 0.88, 0.018, 0.024);
    const neckVentGeo = new THREE.BoxGeometry(0.28, 0.075, 0.085);
    const steelFootBarGeo = new THREE.CylinderGeometry(0.022, 0.022, props.cushionWidth * 0.92, 12);
    steelFootBarGeo.rotateZ(Math.PI / 2);
    const steelFootHangerGeo = new THREE.BoxGeometry(0.026, 0.26, 0.036);
    const lumbarCushionGeo = buildErgonomicCushionGeo(props.backrestWidth * 0.78, 0.19, 0.085);
    const actuatorPodGeo = new THREE.BoxGeometry(0.055, 0.22, 0.11);
    const seatTagGeo = new THREE.BoxGeometry(0.058, 0.016, 0.028);
    const sideTablePostGeo = isScreenXPit
      ? new THREE.BoxGeometry(0.175, 0.016, 0.29)
      : isChampagneDaybed
        ? new THREE.CylinderGeometry(0.085, 0.12, 0.54, 16)
        : isWalnutLoveseat
          ? new THREE.CylinderGeometry(0.018, 0.022, 0.22, 12)
          : isIceObsidianRecliner
            ? new THREE.CylinderGeometry(0.016, 0.018, 0.12, 10)
            : new THREE.CylinderGeometry(0.032, 0.055, 0.56, 12);
    const sideTableTopGeo = isDolbyVeilSeat
      ? new THREE.BoxGeometry(0.19, 0.022, 0.31)
      : isScreenXPit
        ? new THREE.BoxGeometry(0.155, 0.014, 0.265)
        : isChampagneDaybed
          ? new THREE.CylinderGeometry(0.24, 0.24, 0.042, 20)
          : isWalnutLoveseat
            ? new THREE.CylinderGeometry(0.2, 0.2, 0.028, 22)
            : isIceObsidianRecliner
              ? new THREE.BoxGeometry(0.27, 0.022, 0.34)
              : isIceCobaltArmchair
                ? new THREE.CylinderGeometry(0.18, 0.18, 0.032, 18)
                : new THREE.BoxGeometry(0.36, 0.036, 0.48);
    const throwPillowGeo = buildErgonomicCushionGeo(0.35, 0.31, 0.12);
    const throwBlanketGeo = buildErgonomicCushionGeo(0.46, 0.065, 0.52);
    const lampStemGeo = new THREE.CylinderGeometry(0.014, 0.022, 0.48, 10);
    const lampShadeGeo = new THREE.CylinderGeometry(0.065, 0.105, 0.14, 16);

    return {
      cushionGeo,
      backrestGeo,
      headrestGeo,
      armGeo,
      cupGeo,
      cupRimGeo,
      pedestalGeo,
      pedestalFlangeGeo,
      footrestGeo,
      nozzleGeo,
      armControlGeo,
      pipingGeo,
      backShellGeo,
      bolsterGeo,
      redStitchTrimGeo,
      neckVentGeo,
      steelFootBarGeo,
      steelFootHangerGeo,
      lumbarCushionGeo,
      actuatorPodGeo,
      seatTagGeo,
      sideTablePostGeo,
      sideTableTopGeo,
      throwPillowGeo,
      throwBlanketGeo,
      lampStemGeo,
      lampShadeGeo,
    };
  }, [props, isDolbyVeilSeat, isScreenXPit, isChampagneDaybed, isWalnutLoveseat, isIceObsidianRecliner, isIceCobaltArmchair, isParametricPurpleSeat]);

  useEffect(() => {
    return () => {
      Object.values(materials).forEach((m) => m.dispose());
      Object.values(geometries).forEach((g) => g.dispose());
    };
  }, [materials, geometries]);

  useEffect(() => {
    const dummy = new THREE.Object3D();
    // During movie playback, selected seat blends naturally instead of glowing bright yellow
    const selectedColor = new THREE.Color(isPlaying ? environmentProfile.seatPrimaryColor : '#e0a938');
    const hoveredColor = new THREE.Color('#38bdf8');
    const unavailableColor = new THREE.Color('#334155');
    const normalColor = new THREE.Color(environmentProfile.seatPrimaryColor);
    const deepTealHeadrestColor = new THREE.Color('#134e5e');
    const charcoalGreyHeadrestColor = new THREE.Color('#343b48');
    const warmCharcoalHeadrestColor = new THREE.Color('#282b33');
    const jetBlackColor = new THREE.Color('#0d0f13');
    const terracottaLeatherColor = new THREE.Color('#95503b');
    const saddleTanLeatherColor = new THREE.Color('#9c643b');
    const pillowTerracottaColor = new THREE.Color('#a65740');
    const pillowOatmealColor = new THREE.Color('#c8baa6');
    const slateGreyHeadrestColor = new THREE.Color('#475263');
    const warmTaupeHeadrestColor = new THREE.Color('#7d6e60');
    const charcoalNubuckHeadrestColor = new THREE.Color('#282c32');
    const multiplexCharcoalTechColor = new THREE.Color('#1f232c');
    const cognacAnilineColor = new THREE.Color('#9d522b');
    const cashmereCognacPillow = new THREE.Color('#9d522b');
    const cashmereOatmealPillow = new THREE.Color('#dfd5c4');
    const dolbyVeilCharcoalHeadrest = new THREE.Color('#21242b');

    const setSeatPart = (
      sx: number,
      sy: number,
      sz: number,
      yaw: number,
      cosY: number,
      sinY: number,
      lx: number,
      ly: number,
      lz: number,
      rx = 0,
      scaleX = 1,
      scaleY = 1,
      scaleZ = 1,
    ) => {
      dummy.position.set(sx + lx * cosY + lz * sinY, sy + ly, sz - lx * sinY + lz * cosY);
      dummy.rotation.set(rx, yaw, 0, 'YXZ');
      dummy.scale.set(scaleX, scaleY, scaleZ);
      dummy.updateMatrix();
    };

    seats.forEach((seat, idx) => {
      const [sx, sy, sz] = seat.worldPosition;
      const yaw = seat.yaw ?? 0;
      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);
      const isSelected = seat.id === selectedSeatId;
      const isHovered = seat.id === hoveredSeatId && !isSelected;
      const isUnavailable = seat.status === 'unavailable';

      const instanceColor = isSelected
        ? selectedColor
        : isHovered
          ? hoveredColor
          : isUnavailable
            ? unavailableColor
            : normalColor;

      const cushionColor =
        isChampagneDaybed && !isSelected && !isHovered && !isUnavailable
          ? saddleTanLeatherColor
          : instanceColor;

      const footrestColor =
        isWalnutLoveseat && !isSelected && !isHovered && !isUnavailable
          ? cognacAnilineColor
          : instanceColor;

      const headrestColor =
        isIceRecliner && !isSelected && !isHovered && !isUnavailable
          ? slateGreyHeadrestColor
          : isIceCobaltArmchair && !isSelected && !isHovered && !isUnavailable
            ? warmTaupeHeadrestColor
            : isIceObsidianRecliner && !isSelected && !isHovered && !isUnavailable
              ? charcoalNubuckHeadrestColor
              : isWalnutLoveseat && !isSelected && !isHovered && !isUnavailable
                ? cognacAnilineColor
                : isChampagneDaybed && !isSelected && !isHovered && !isUnavailable
                  ? saddleTanLeatherColor
                  : isVolcanicCopperSeat && !isSelected && !isHovered && !isUnavailable
                    ? warmCharcoalHeadrestColor
                    : isImaxAuroraSeat && !isSelected && !isHovered && !isUnavailable
                      ? charcoalGreyHeadrestColor
                      : isImaxSolarSeat && !isSelected && !isHovered && !isUnavailable
                        ? deepTealHeadrestColor
                        : isDolbyVeilSeat && !isSelected && !isHovered && !isUnavailable
                          ? dolbyVeilCharcoalHeadrest
                          : isDolbyObsidianSeat && !isSelected && !isHovered && !isUnavailable
                            ? jetBlackColor
                            : isScreenXPit && !isSelected && !isHovered && !isUnavailable
                              ? jetBlackColor
                              : (isMultiplexScreenXRocker || isMandapSeat || isBiophilicMossSeat) && !isSelected && !isHovered && !isUnavailable
                                ? multiplexCharcoalTechColor
                                : instanceColor;

      // Seat cushion (Saddle-Tan Italian leather daybed mattress on Champagne Ivory Lounge)
      setSeatPart(sx, sy, sz, yaw, cosY, sinY, props.cushionPos[0], props.cushionPos[1], props.cushionPos[2], -0.05, 1, 1, 1);
      cushionRef.current?.setMatrixAt(idx, dummy.matrix);
      cushionRef.current?.setColorAt(idx, cushionColor);

      // Lumbar Backrest
      setSeatPart(sx, sy, sz, yaw, cosY, sinY, props.backrestPos[0], props.backrestPos[1], props.backrestPos[2], props.backrestTilt, 1, 1, 1);
      backrestRef.current?.setMatrixAt(idx, dummy.matrix);
      backrestRef.current?.setColorAt(idx, instanceColor);

      // Plush Headrest
      setSeatPart(sx, sy, sz, yaw, cosY, sinY, props.headrestPos[0], props.headrestPos[1], props.headrestPos[2], props.backrestTilt * 0.55, 1, 1, 1);
      headrestRef.current?.setMatrixAt(idx, dummy.matrix);
      headrestRef.current?.setColorAt(idx, headrestColor);

      // Left & Right Sculpted Armrests (wide armrests on IMAX Aurora/Obsidian Amber & Dolby halls)
      const armScaleX = isDolbyCobaltSeat || isDolbyVeilSeat ? 1.24 : isImaxAuroraSeat || isImaxSolarSeat ? 1.22 : isDolbyObsidianSeat ? 1.12 : 1.0;
      const effectiveArmOffsetX = isDolbyCobaltSeat
        ? props.armOffsetX + 0.018
        : isDolbyVeilSeat || isImaxAuroraSeat || isImaxSolarSeat
          ? props.armOffsetX + 0.014
          : isDolbyObsidianSeat
            ? props.armOffsetX + 0.008
            : props.armOffsetX;
      setSeatPart(sx, sy, sz, yaw, cosY, sinY, -effectiveArmOffsetX, props.armPosY, props.armPosZ, 0, armScaleX, 1, 1);
      leftArmRef.current?.setMatrixAt(idx, dummy.matrix);

      setSeatPart(sx, sy, sz, yaw, cosY, sinY, effectiveArmOffsetX, props.armPosY, props.armPosZ, 0, armScaleX, 1, 1);
      rightArmRef.current?.setMatrixAt(idx, dummy.matrix);

      // Recessed Cupholder & Brushed Trim Rim (omitted on bespoke private luxury loveseats, daybeds & ScreenX wireless-charging lounge pits)
      if (!isWalnutLoveseat && !isChampagneDaybed && !isScreenXPit) {
        const cupLx = effectiveArmOffsetX;
        const cupLy = props.armPosY + props.armHeight * 0.42;
        const cupLz = props.armPosZ - props.armDepth * 0.34;
        setSeatPart(sx, sy, sz, yaw, cosY, sinY, cupLx, cupLy, cupLz);
        cupholderRef.current?.setMatrixAt(idx, dummy.matrix);

        setSeatPart(sx, sy, sz, yaw, cosY, sinY, cupLx, cupLy + 0.027, cupLz);
        cupRimRef.current?.setMatrixAt(idx, dummy.matrix);
      }

      // Pedestal / Hydraulic Base + Floor Mounting Flange
      setSeatPart(sx, sy, sz, yaw, cosY, sinY, props.pedestalPos[0], props.pedestalPos[1], props.pedestalPos[2]);
      pedestalRef.current?.setMatrixAt(idx, dummy.matrix);

      setSeatPart(sx, sy, sz, yaw, cosY, sinY, props.pedestalPos[0], 0.018, props.pedestalPos[2]);
      pedestalFlangeRef.current?.setMatrixAt(idx, dummy.matrix);

      // Optional Footrest (all recliners & ScreenX modular lounge pit chaise extensions)
      if (props.hasFootrest && footrestRef.current) {
        const footScale = 1.0;
        const footZ = isWalnutLoveseat ? -0.68 : isScreenXPit ? -0.66 : -0.37;
        const footY = isWalnutLoveseat ? 0.28 : isScreenXPit ? 0.28 : 0.25;
        const footRx = isWalnutLoveseat ? -0.24 : isScreenXPit ? -0.09 : -0.34;
        setSeatPart(
          sx,
          sy,
          sz,
          yaw,
          cosY,
          sinY,
          0,
          footY,
          footZ,
          footRx,
          footScale,
          isScreenXPit ? footScale * 1.45 : footScale,
          isScreenXPit ? footScale * 1.35 : footScale,
        );
        footrestRef.current.setMatrixAt(idx, dummy.matrix);
        footrestRef.current.setColorAt(idx, footrestColor);
      }

      // Dolby Veil 250 Integrated Honed Dark Marble Armrest Tray Mounted Flush on Left Wide Armrest
      if (isDolbyVeilSeat && sideTableTopRef.current) {
        setSeatPart(
          sx,
          sy,
          sz,
          yaw,
          cosY,
          sinY,
          -effectiveArmOffsetX,
          props.armPosY + props.armHeight * 0.5 + 0.009,
          props.armPosZ - 0.04,
        );
        sideTableTopRef.current.setMatrixAt(idx, dummy.matrix);
      }

      // ScreenX Modular Lounge Pit Integrated Frosted-Glass Wireless Charging Panels Mounted Flush on Exposed Armrests
      if (isScreenXPit && sideTablePostRef.current && sideTableTopRef.current) {
        const armSide = seat.seatNumber % 2 === 1 ? -1 : 1;
        const padX = armSide * effectiveArmOffsetX;
        const padY = props.armPosY + props.armHeight * 0.5 + 0.002;
        const padZ = props.armPosZ - 0.16;
        setSeatPart(sx, sy, sz, yaw, cosY, sinY, padX, padY, padZ);
        sideTablePostRef.current.setMatrixAt(idx, dummy.matrix);
        setSeatPart(sx, sy, sz, yaw, cosY, sinY, padX, padY + 0.012, padZ);
        sideTableTopRef.current.setMatrixAt(idx, dummy.matrix);
      }

      // Bespoke Walnut Reserve Salon Daybed Props: Integrated Marble Swivel Cocktail Tables & Cashmere Throw Pillows
      if (isWalnutLoveseat) {
        const isOuterSeat = seat.seatNumber === 1 || seat.seatNumber === 4;
        const outerDir = seat.seatNumber === 1 ? -1 : 1;
        const tableScale = isOuterSeat ? 1.0 : 0.0001;
        const postX = outerDir * effectiveArmOffsetX;
        const postY = props.armPosY + props.armHeight * 0.5 + 0.09;
        const postZ = props.armPosZ - props.armDepth * 0.28;
        if (sideTablePostRef.current && sideTableTopRef.current) {
          setSeatPart(sx, sy, sz, yaw, cosY, sinY, postX, postY, postZ, 0, tableScale, tableScale, tableScale);
          sideTablePostRef.current.setMatrixAt(idx, dummy.matrix);
          setSeatPart(sx, sy, sz, yaw, cosY, sinY, postX - outerDir * 0.12, postY + 0.11, postZ - 0.04, 0, tableScale, tableScale, tableScale);
          sideTableTopRef.current.setMatrixAt(idx, dummy.matrix);
        }
        if (throwPillowRef.current) {
          const pillowDir = seat.seatNumber % 2 === 1 ? -1 : 1;
          dummy.position.set(
            sx + pillowDir * 0.24 * cosY + 0.12 * sinY,
            sy + 0.67,
            sz - pillowDir * 0.24 * sinY + 0.12 * cosY,
          );
          dummy.rotation.set(0.32, yaw + pillowDir * 0.28, pillowDir * -0.08, 'YXZ');
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          throwPillowRef.current.setMatrixAt(idx, dummy.matrix);
          throwPillowRef.current.setColorAt(
            idx,
            seat.seatNumber % 2 === 1 ? cashmereCognacPillow : cashmereOatmealPillow,
          );
        }
      }

      // Bespoke Champagne Ivory Lounge Daybed Props: Travertine Cocktail Tables, Brass Reading Lamps & Cashmere Throw Blankets
      if (isChampagneDaybed) {
        const isOuterSeat = seat.seatNumber === 1 || seat.seatNumber === 4;
        const outerDir = seat.seatNumber === 1 ? -1 : 1;
        const propScale = isOuterSeat ? 1.0 : 0.0001;
        const tableX = outerDir * (effectiveArmOffsetX + 0.34);
        const tableZ = -0.16;
        if (sideTablePostRef.current && sideTableTopRef.current) {
          setSeatPart(sx, sy, sz, yaw, cosY, sinY, tableX, 0.27, tableZ, 0, propScale, propScale, propScale);
          sideTablePostRef.current.setMatrixAt(idx, dummy.matrix);
          setSeatPart(sx, sy, sz, yaw, cosY, sinY, tableX, 0.56, tableZ, 0, propScale, propScale, propScale);
          sideTableTopRef.current.setMatrixAt(idx, dummy.matrix);
        }
        if (lampStemRef.current && lampShadeRef.current) {
          const lampX = tableX + outerDir * 0.04;
          const lampZ = tableZ + 0.06;
          setSeatPart(sx, sy, sz, yaw, cosY, sinY, lampX, 0.82, lampZ, 0, propScale, propScale, propScale);
          lampStemRef.current.setMatrixAt(idx, dummy.matrix);
          setSeatPart(sx, sy, sz, yaw, cosY, sinY, lampX - outerDir * 0.03, 1.07, lampZ - 0.03, 0.15, propScale, propScale, propScale);
          lampShadeRef.current.setMatrixAt(idx, dummy.matrix);
        }
        if (throwBlanketRef.current) {
          const blanketDir = seat.seatNumber % 2 === 1 ? -1 : 1;
          setSeatPart(sx, sy, sz, yaw, cosY, sinY, blanketDir * 0.18, 0.535, -0.52, -0.05, 1, 1, 1);
          throwBlanketRef.current.setMatrixAt(idx, dummy.matrix);
        }
      }

      // Optional 4DX Headrest Air/Mist Jet Nozzle Pod
      if (props.is4dxPod && nozzleRef.current) {
        setSeatPart(sx, sy, sz, yaw, cosY, sinY, 0, props.headrestPos[1] - 0.02, props.headrestPos[2] + 0.03);
        nozzleRef.current.setMatrixAt(idx, dummy.matrix);
      }

      // Optional ICE Recliner Backlit Armrest Control Buttons & Metallic Shoulder Piping
      if (isIceRecliner && armControlRef.current) {
        setSeatPart(
          sx,
          sy,
          sz,
          yaw,
          cosY,
          sinY,
          -props.armOffsetX + props.armWidth * 0.12,
          props.armPosY + props.armHeight * 0.48,
          props.armPosZ - props.armDepth * 0.14,
        );
        armControlRef.current.setMatrixAt(idx, dummy.matrix);
      }
      if (isIceRecliner && pipingRef.current) {
        setSeatPart(
          sx,
          sy,
          sz,
          yaw,
          cosY,
          sinY,
          0,
          props.backrestPos[1] + props.backrestHeight * 0.46,
          props.backrestPos[2] - props.backrestDepth * 0.36,
          props.backrestTilt,
        );
        pipingRef.current.setMatrixAt(idx, dummy.matrix);
      }
      if (isParametricPurpleSeat && pipingRef.current) {
        setSeatPart(
          sx,
          sy,
          sz,
          yaw,
          cosY,
          sinY,
          0,
          props.backrestPos[1] + 0.01,
          props.backrestPos[2] - props.backrestDepth * 0.46,
          props.backrestTilt,
        );
        pipingRef.current.setMatrixAt(idx, dummy.matrix);
      }
      if ((isMultiplexStadium || isMultiplexScreenXRocker || isMandapSeat || isParametricPurpleSeat || isBiophilicMossSeat || isImaxRocker || isThunder4dxPod || isExoskeleton4dxPod) && backShellRef.current) {
        setSeatPart(
          sx,
          sy,
          sz,
          yaw,
          cosY,
          sinY,
          0,
          props.backrestPos[1] + 0.01,
          props.backrestPos[2] + props.backrestDepth * 0.56,
          props.backrestTilt,
        );
        backShellRef.current.setMatrixAt(idx, dummy.matrix);
      }

      // ICE Cobalt Grand: Integrated Side Tables Flanking Aisle & Outer Armchairs
      if (isIceCobaltArmchair && sideTablePostRef.current && sideTableTopRef.current) {
        const isLeftOuter = seat.seatNumber === 1 || seat.seatNumber === 5 || seat.seatNumber === 13;
        const isRightOuter = seat.seatNumber === 4 || seat.seatNumber === 12 || seat.seatNumber === 16;
        const hasTable = isLeftOuter || isRightOuter;
        const tableScale = hasTable ? 1.0 : 0.0001;
        const tableDir = isLeftOuter ? -1 : 1;
        const tableX = tableDir * (effectiveArmOffsetX + 0.22);
        setSeatPart(sx, sy, sz, yaw, cosY, sinY, tableX, 0.28, -0.06, 0, tableScale, tableScale, tableScale);
        sideTablePostRef.current.setMatrixAt(idx, dummy.matrix);
        setSeatPart(sx, sy, sz, yaw, cosY, sinY, tableX, 0.565, -0.06, 0, tableScale, tableScale, tableScale);
        sideTableTopRef.current.setMatrixAt(idx, dummy.matrix);
      }

      // ICE Obsidian Amber: Integrated Walnut Swivel Trays Mounted on Left Matte-Black Steel Armrest
      if (isIceObsidianRecliner && sideTablePostRef.current && sideTableTopRef.current) {
        const postX = -effectiveArmOffsetX + props.armWidth * 0.1;
        const postY = props.armPosY + props.armHeight * 0.5 + 0.06;
        const postZ = props.armPosZ - props.armDepth * 0.32;
        setSeatPart(sx, sy, sz, yaw, cosY, sinY, postX, postY, postZ);
        sideTablePostRef.current.setMatrixAt(idx, dummy.matrix);
        dummy.position.set(
          sx + (postX + 0.14) * cosY + (postZ - 0.06) * sinY,
          sy + postY + 0.068,
          sz - (postX + 0.14) * sinY + (postZ - 0.06) * cosY,
        );
        dummy.rotation.set(0, yaw - 0.18, 0, 'YXZ');
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        sideTableTopRef.current.setMatrixAt(idx, dummy.matrix);
      }

      if (isImaxVipTwoTone || isVolcanicCopperSeat || isAnyIceSeat || isMultiplexScreenXRocker || isMandapSeat || isParametricPurpleSeat || isBiophilicMossSeat || isDolbyVeilSeat) {
        if (leftBolsterRef.current) {
          setSeatPart(sx, sy, sz, yaw, cosY, sinY, -props.backrestWidth * 0.45, props.backrestPos[1] - 0.02, props.backrestPos[2] - 0.06, props.backrestTilt);
          leftBolsterRef.current.setMatrixAt(idx, dummy.matrix);
        }
        if (rightBolsterRef.current) {
          setSeatPart(sx, sy, sz, yaw, cosY, sinY, props.backrestWidth * 0.45, props.backrestPos[1] - 0.02, props.backrestPos[2] - 0.06, props.backrestTilt);
          rightBolsterRef.current.setMatrixAt(idx, dummy.matrix);
        }
      }

      // Bespoke 4DX Pods: Side Bolsters, Contrast Piping, Neck Air/Scent Vents, Suspended Footrests, Lumbar Cushions & Vibration Actuators
      if (isAny4dxPod) {
        if (leftBolsterRef.current) {
          setSeatPart(sx, sy, sz, yaw, cosY, sinY, -props.backrestWidth * 0.45, props.backrestPos[1] - 0.04, props.backrestPos[2] - 0.06, props.backrestTilt);
          leftBolsterRef.current.setMatrixAt(idx, dummy.matrix);
        }
        if (rightBolsterRef.current) {
          setSeatPart(sx, sy, sz, yaw, cosY, sinY, props.backrestWidth * 0.45, props.backrestPos[1] - 0.04, props.backrestPos[2] - 0.06, props.backrestTilt);
          rightBolsterRef.current.setMatrixAt(idx, dummy.matrix);
        }
        if (redStitchTrimRef.current) {
          setSeatPart(sx, sy, sz, yaw, cosY, sinY, 0, props.backrestPos[1] + 0.34, props.backrestPos[2] - 0.08, props.backrestTilt);
          redStitchTrimRef.current.setMatrixAt(idx, dummy.matrix);
        }
        if (neckVentRef.current) {
          setSeatPart(sx, sy, sz, yaw, cosY, sinY, 0, props.headrestPos[1] - 0.13, props.headrestPos[2] - 0.055, props.backrestTilt * 0.4);
          neckVentRef.current.setMatrixAt(idx, dummy.matrix);
        }
        if (steelFootBarRef.current) {
          setSeatPart(sx, sy, sz, yaw, cosY, sinY, 0, 0.25, -0.36);
          steelFootBarRef.current.setMatrixAt(idx, dummy.matrix);
        }
        if (steelFootHangerLeftRef.current) {
          setSeatPart(sx, sy, sz, yaw, cosY, sinY, -props.cushionWidth * 0.38, 0.38, -0.31, -0.35);
          steelFootHangerLeftRef.current.setMatrixAt(idx, dummy.matrix);
        }
        if (steelFootHangerRightRef.current) {
          setSeatPart(sx, sy, sz, yaw, cosY, sinY, props.cushionWidth * 0.38, 0.38, -0.31, -0.35);
          steelFootHangerRightRef.current.setMatrixAt(idx, dummy.matrix);
        }
        if ((isArctic4dxPod || isThunder4dxPod || isExoskeleton4dxPod) && lumbarCushionRef.current) {
          setSeatPart(sx, sy, sz, yaw, cosY, sinY, 0, props.backrestPos[1] - 0.21, props.backrestPos[2] - 0.095, props.backrestTilt);
          lumbarCushionRef.current.setMatrixAt(idx, dummy.matrix);
        }
        if ((isThunder4dxPod || isExoskeleton4dxPod) && leftActuatorRef.current && rightActuatorRef.current) {
          setSeatPart(sx, sy, sz, yaw, cosY, sinY, -props.backrestWidth * 0.51, props.backrestPos[1] - 0.12, props.backrestPos[2] - 0.04, props.backrestTilt);
          leftActuatorRef.current.setMatrixAt(idx, dummy.matrix);
          setSeatPart(sx, sy, sz, yaw, cosY, sinY, props.backrestWidth * 0.51, props.backrestPos[1] - 0.12, props.backrestPos[2] - 0.04, props.backrestTilt);
          rightActuatorRef.current.setMatrixAt(idx, dummy.matrix);
        }
      }

      // (Dolby Obsidian Reference uses charcoal-and-black leather with blue accent stitching; Dolby Cobalt Noir uses wide espresso-charcoal armrests)
    });

    const meshes = [
      cushionRef.current,
      backrestRef.current,
      headrestRef.current,
      leftArmRef.current,
      rightArmRef.current,
      cupholderRef.current,
      cupRimRef.current,
      pedestalRef.current,
      pedestalFlangeRef.current,
      footrestRef.current,
      nozzleRef.current,
      armControlRef.current,
      pipingRef.current,
      backShellRef.current,
      leftBolsterRef.current,
      rightBolsterRef.current,
      redStitchTrimRef.current,
      neckVentRef.current,
      steelFootBarRef.current,
      steelFootHangerLeftRef.current,
      steelFootHangerRightRef.current,
      lumbarCushionRef.current,
      leftActuatorRef.current,
      rightActuatorRef.current,
      seatTagRef.current,
      sideTablePostRef.current,
      sideTableTopRef.current,
      throwPillowRef.current,
      throwBlanketRef.current,
      lampStemRef.current,
      lampShadeRef.current,
    ];

    meshes.forEach((m) => {
      if (!m) return;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      m.computeBoundingSphere();
    });
  }, [seats, selectedSeatId, hoveredSeatId, props, environmentProfile.seatPrimaryColor, isPlaying, isIceRecliner, isIceCobaltArmchair, isIceObsidianRecliner, isAnyIceSeat, isWalnutLoveseat, isChampagneDaybed, isScreenXPit, isMultiplexScreenXRocker, isMandapSeat, isParametricPurpleSeat, isBiophilicMossSeat, isCrimson4dxPod, isArctic4dxPod, isThunder4dxPod, isExoskeleton4dxPod, isAny4dxPod, isMultiplexStadium, isVolcanicCopperSeat, isImaxRocker, isImaxAuroraSeat, isImaxSolarSeat, isImaxVipTwoTone, isDolbyObsidianSeat, isDolbyCobaltSeat, isDolbyVeilSeat]);

  useFrame(({ clock }) => {
    const grp = seatGroupRef.current;
    if (!grp) return;
    if ((seatModel === '4dx_motion' || isAny4dxPod) && isPlaying && fourDxVibration > 0.01) {
      const t = clock.getElapsedTime();
      const heave = Math.sin(t * 2.4) * 0.032 + Math.sin(t * 14.5) * 0.01;
      const pitch = Math.sin(t * 1.65) * 0.024 + Math.cos(t * 3.1) * 0.008;
      const roll = Math.cos(t * 1.25) * 0.022;
      grp.position.y = heave * fourDxVibration;
      grp.rotation.x = pitch * fourDxVibration;
      grp.rotation.z = roll * fourDxVibration;
    } else if (
      grp.position.y !== 0 ||
      grp.rotation.x !== 0 ||
      grp.rotation.z !== 0
    ) {
      grp.position.y = Math.abs(grp.position.y) < 1e-4 ? 0 : THREE.MathUtils.lerp(grp.position.y, 0, 0.14);
      grp.rotation.x = Math.abs(grp.rotation.x) < 1e-4 ? 0 : THREE.MathUtils.lerp(grp.rotation.x, 0, 0.14);
      grp.rotation.z = Math.abs(grp.rotation.z) < 1e-4 ? 0 : THREE.MathUtils.lerp(grp.rotation.z, 0, 0.14);
    }
  });

  const handleSeatPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!interactive || !enableHover || e.instanceId === undefined) return;
    if (e.nativeEvent.pointerType === 'touch') return;
    e.stopPropagation();
    const seat = seats[e.instanceId];
    if (!seat || seat.status === 'unavailable') {
      document.body.style.cursor = 'not-allowed';
      onHoverSeat?.(null);
      return;
    }
    document.body.style.cursor = 'pointer';
    onHoverSeat?.(seat.id);
  };

  const handleSeatPointerOut = () => {
    if (!interactive || !enableHover) return;
    document.body.style.cursor = 'auto';
    onHoverSeat?.(null);
  };

  const handleSeatClick = (e: ThreeEvent<MouseEvent>) => {
    if (!interactive || e.instanceId === undefined || e.delta > 8) return;
    e.stopPropagation();
    const seat = seats[e.instanceId];
    if (!seat || seat.status === 'unavailable') return;
    onSelectSeat?.(seat.id);
  };

  useEffect(() => {
    return () => {
      document.body.style.cursor = 'auto';
    };
  }, []);

  const selectedSeat = useMemo(
    () => seats.find((s) => s.id === selectedSeatId) || null,
    [seats, selectedSeatId],
  );
  const hoveredSeat = useMemo(
    () => (hoveredSeatId ? seats.find((s) => s.id === hoveredSeatId) || null : null),
    [seats, hoveredSeatId],
  );

  return (
    <group ref={seatGroupRef}>
      <instancedMesh
        ref={cushionRef}
        args={[geometries.cushionGeo, materials.primaryMat, count]}
        receiveShadow
        onClick={interactive ? handleSeatClick : undefined}
        onPointerMove={enableHover ? handleSeatPointerMove : undefined}
        onPointerOut={enableHover ? handleSeatPointerOut : undefined}
      />
      <instancedMesh
        ref={backrestRef}
        args={[geometries.backrestGeo, materials.primaryMat, count]}
        castShadow
        receiveShadow
        onClick={interactive ? handleSeatClick : undefined}
        onPointerMove={enableHover ? handleSeatPointerMove : undefined}
        onPointerOut={enableHover ? handleSeatPointerOut : undefined}
      />
      <instancedMesh
        ref={headrestRef}
        args={[geometries.headrestGeo, materials.primaryMat, count]}
        receiveShadow
        onClick={interactive ? handleSeatClick : undefined}
        onPointerMove={enableHover ? handleSeatPointerMove : undefined}
        onPointerOut={enableHover ? handleSeatPointerOut : undefined}
      />
      <instancedMesh
        ref={leftArmRef}
        args={[geometries.armGeo, materials.trimMat, count]}
        receiveShadow
      />
      <instancedMesh
        ref={rightArmRef}
        args={[geometries.armGeo, materials.trimMat, count]}
        receiveShadow
      />
      {!isWalnutLoveseat && !isChampagneDaybed && !isScreenXPit && (
        <>
          <instancedMesh ref={cupholderRef} args={[geometries.cupGeo, materials.cupMat, count]} />
          <instancedMesh ref={cupRimRef} args={[geometries.cupRimGeo, materials.cupRimMat, count]} />
        </>
      )}
      <instancedMesh
        ref={pedestalRef}
        args={[geometries.pedestalGeo, materials.baseMat, count]}
        receiveShadow
      />
      <instancedMesh
        ref={pedestalFlangeRef}
        args={[geometries.pedestalFlangeGeo, materials.baseMat, count]}
        receiveShadow
      />
      {props.hasFootrest && (
        <instancedMesh
          ref={footrestRef}
          args={[geometries.footrestGeo, materials.primaryMat, count]}
          receiveShadow
        />
      )}
      {(isWalnutLoveseat || isChampagneDaybed || isIceCobaltArmchair || isIceObsidianRecliner || isScreenXPit) && (
        <instancedMesh
          ref={sideTablePostRef}
          args={[
            geometries.sideTablePostGeo,
            isChampagneDaybed
              ? materials.sideTableTopMat
              : isWalnutLoveseat
                ? materials.brassLampMat
                : materials.baseMat,
            count,
          ]}
          receiveShadow
        />
      )}
      {(isWalnutLoveseat || isChampagneDaybed || isIceCobaltArmchair || isIceObsidianRecliner || isScreenXPit || isDolbyVeilSeat) && (
        <instancedMesh
          ref={sideTableTopRef}
          args={[geometries.sideTableTopGeo, materials.sideTableTopMat, count]}
          castShadow
          receiveShadow
        />
      )}
      {isWalnutLoveseat && (
        <instancedMesh
          ref={throwPillowRef}
          args={[geometries.throwPillowGeo, materials.throwPillowMat, count]}
          castShadow
          receiveShadow
        />
      )}
      {isChampagneDaybed && (
        <>
          <instancedMesh
            ref={throwBlanketRef}
            args={[geometries.throwBlanketGeo, materials.cashmereMat, count]}
            castShadow
            receiveShadow
          />
          <instancedMesh
            ref={lampStemRef}
            args={[geometries.lampStemGeo, materials.brassLampMat, count]}
          />
          <instancedMesh
            ref={lampShadeRef}
            args={[geometries.lampShadeGeo, materials.lampShadeMat, count]}
          />
        </>
      )}
      {props.is4dxPod && (
        <instancedMesh ref={nozzleRef} args={[geometries.nozzleGeo, materials.nozzleMat, count]} />
      )}
      {isIceRecliner && (
        <>
          <instancedMesh
            ref={armControlRef}
            args={[geometries.armControlGeo, materials.armControlMat, count]}
          />
          <instancedMesh
            ref={pipingRef}
            args={[geometries.pipingGeo, materials.pipingMat, count]}
          />
        </>
      )}
      {isParametricPurpleSeat && (
        <instancedMesh
          ref={pipingRef}
          args={[geometries.pipingGeo, materials.pipingMat, count]}
        />
      )}
      {(isMultiplexStadium || isMultiplexScreenXRocker || isMandapSeat || isParametricPurpleSeat || isBiophilicMossSeat || isImaxRocker || isThunder4dxPod || isExoskeleton4dxPod) && (
        <instancedMesh
          ref={backShellRef}
          args={[
            geometries.backShellGeo,
            isVolcanicCopperSeat || isMultiplexScreenXRocker || isMandapSeat || isParametricPurpleSeat || isBiophilicMossSeat
              ? materials.charcoalBolsterMat
              : isThunder4dxPod || isExoskeleton4dxPod
                ? materials.baseMat
                : materials.trimMat,
            count,
          ]}
          receiveShadow
        />
      )}
      {(isImaxVipTwoTone || isVolcanicCopperSeat || isAnyIceSeat || isMultiplexScreenXRocker || isMandapSeat || isParametricPurpleSeat || isBiophilicMossSeat || isDolbyVeilSeat) && (
        <>
          <instancedMesh
            ref={leftBolsterRef}
            args={[
              geometries.bolsterGeo,
              isVolcanicCopperSeat || isAnyIceSeat || isMultiplexScreenXRocker || isMandapSeat || isParametricPurpleSeat || isBiophilicMossSeat || isDolbyVeilSeat ? materials.charcoalBolsterMat : materials.trimMat,
              count,
            ]}
            receiveShadow
          />
          <instancedMesh
            ref={rightBolsterRef}
            args={[
              geometries.bolsterGeo,
              isVolcanicCopperSeat || isAnyIceSeat || isMultiplexScreenXRocker || isMandapSeat || isParametricPurpleSeat || isBiophilicMossSeat || isDolbyVeilSeat ? materials.charcoalBolsterMat : materials.trimMat,
              count,
            ]}
            receiveShadow
          />
        </>
      )}
      {/* (Dolby Obsidian & Dolby Cobalt seats use clean two-tone/espresso leather upholstery without seat tags or side tables) */}
      {isAny4dxPod && (
        <>
          {/* Contoured Side Bolsters + Contrast Trim */}
          <instancedMesh
            ref={leftBolsterRef}
            args={[geometries.bolsterGeo, materials.trimMat, count]}
            receiveShadow
          />
          <instancedMesh
            ref={rightBolsterRef}
            args={[geometries.bolsterGeo, materials.trimMat, count]}
            receiveShadow
          />
          <instancedMesh
            ref={redStitchTrimRef}
            args={[geometries.redStitchTrimGeo, materials.pipingMat, count]}
          />
          {(isArctic4dxPod || isThunder4dxPod || isExoskeleton4dxPod) && (
            <instancedMesh
              ref={lumbarCushionRef}
              args={[geometries.lumbarCushionGeo, materials.lumbarMat, count]}
              receiveShadow
            />
          )}
          {(isThunder4dxPod || isExoskeleton4dxPod) && (
            <>
              <instancedMesh
                ref={leftActuatorRef}
                args={[geometries.actuatorPodGeo, materials.baseMat, count]}
              />
              <instancedMesh
                ref={rightActuatorRef}
                args={[geometries.actuatorPodGeo, materials.baseMat, count]}
              />
            </>
          )}
          {/* Built-In Neck Air & Scent Vents */}
          <instancedMesh
            ref={neckVentRef}
            args={[geometries.neckVentGeo, isThunder4dxPod ? materials.brushedSteelMat : materials.baseMat, count]}
          />
          {/* Suspended Footrest Bars & Hanger Brackets */}
          <instancedMesh
            ref={steelFootBarRef}
            args={[geometries.steelFootBarGeo, materials.brushedSteelMat, count]}
          />
          <instancedMesh
            ref={steelFootHangerLeftRef}
            args={[geometries.steelFootHangerGeo, materials.baseMat, count]}
          />
          <instancedMesh
            ref={steelFootHangerRightRef}
            args={[geometries.steelFootHangerGeo, materials.baseMat, count]}
          />
          {/* Articulated 4-Seat Hydraulic Motion Pod Decks & Heavy-Duty Hydraulic Cylinders */}
          {fourSeatPods.map((pod) => (
            <group key={pod.key} position={[pod.cx, pod.y, pod.z]} rotation={[0, pod.yaw, 0]}>
              {/* Heavy-Duty Articulated Pod Deck Frame Spanning All 4 Seats */}
              <mesh
                position={[0, 0.18, 0.04]}
                material={materials.baseMat}
                receiveShadow
                castShadow
              >
                <boxGeometry args={[pod.width, 0.075, 0.66]} />
              </mesh>
              {/* Side Pod End-Caps */}
              {[-pod.width * 0.5, pod.width * 0.5].map((ex, ei) => (
                <mesh
                  key={`pod-cap-${ei}`}
                  position={[ex, 0.18, 0.04]}
                  material={materials.pipingMat}
                >
                  <boxGeometry args={[0.045, 0.085, 0.68]} />
                </mesh>
              ))}
              {/* Twin Hydraulic Ram Cylinders Under Each 4-Seat Pod */}
              {[-pod.width * 0.28, pod.width * 0.28].map((hx, hi) => (
                <group key={`hyd-${hi}`} position={[hx, 0.09, 0.04]}>
                  <mesh material={materials.brushedSteelMat}>
                    <cylinderGeometry args={[0.055, 0.065, 0.16, 12]} />
                  </mesh>
                  <mesh position={[0, -0.055, 0]} material={materials.baseMat}>
                    <boxGeometry args={[0.26, 0.04, 0.42]} />
                  </mesh>
                </group>
              ))}
            </group>
          ))}
        </>
      )}

      {/* Grounded brass/cyan 3D Reserved plaque, folded screening program, and hall ring */}
      {selectedSeat && (
        <ReservedSeatMarker
          position={selectedSeat.worldPosition}
          yaw={selectedSeat.yaw ?? 0}
          plaqueLocalPos={[
            Math.min(0.18, props.cushionWidth * 0.22),
            props.cushionPos[1] + props.cushionHeight * 0.5 + 0.004,
            props.cushionPos[2] - props.cushionDepth * 0.18,
          ]}
          seatLabel={selectedSeat.id}
          accentHex={
            config.categoryId === 'ice' || config.categoryId === 'screenx'
              ? '#22d3ee'
              : '#d4af37'
          }
          lightFactor={lightFactor}
          isPlaying={isPlaying}
          viewMode={viewMode}
          floorRingYOffset={0.016}
          floorRingRadius={[
            Math.max(0.42, props.cushionWidth * 0.64),
            Math.max(0.47, props.cushionWidth * 0.64 + 0.05),
          ]}
        />
      )}

      {/* Cyan hover target ring when hovering seats in Hall View */}
      {hoveredSeat && hoveredSeat.id !== selectedSeatId && (
        <mesh
          position={[
            hoveredSeat.worldPosition[0],
            hoveredSeat.worldPosition[1] + 0.6,
            hoveredSeat.worldPosition[2],
          ]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.18, 0.25, 32]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.95} />
        </mesh>
      )}
    </group>
  );
};

export const SeatModels: React.FC<SeatModelsProps> = (props) => {
  if (
    props.config.seatModel === 'beach_lounger_beanbag' ||
    props.config.seatModel === 'beach_bioluminescent_lounge'
  ) {
    return <BeachSeats {...props} />;
  }
  return <IndoorSeatModels {...props} />;
};
