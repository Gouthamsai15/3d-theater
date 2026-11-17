import * as THREE from 'three';
import { EnvironmentProfile, SideLightStyle } from '../../types/cinema';

export interface AuditoriumTextureSet {
  carpetMap: THREE.CanvasTexture;
  carpetBumpMap: THREE.CanvasTexture;
  wallMap: THREE.CanvasTexture;
  wallBumpMap: THREE.CanvasTexture;
  exitSignMap: THREE.CanvasTexture;
  standbyScreenMap: THREE.CanvasTexture;
  speakerGrilleMap: THREE.CanvasTexture;
  curtainMap: THREE.CanvasTexture;
  posterMap: THREE.CanvasTexture;
  entranceSignMap: THREE.CanvasTexture;
  sconceWashMap: THREE.CanvasTexture;
  dispose: () => void;
}

export interface SeatUpholsteryTextureSet {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  dispose: () => void;
}

export function createCarpetTexture(
  env: EnvironmentProfile,
  sideLightStyle?: SideLightStyle,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = env.carpetColor;
  ctx.fillRect(0, 0, 512, 512);

  ctx.strokeStyle = env.carpetAccentColor;
  ctx.fillStyle = env.carpetAccentColor;

  if (sideLightStyle === 'art_deco_navy_sunburst') {
    // Dark patterned acoustic carpeting with subtle warm bronze & crimson geometric Deco arches
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 2.2;
    for (let y = 0; y < 512; y += 64) {
      for (let x = 0; x < 512; x += 64) {
        ctx.strokeStyle = env.carpetAccentColor;
        [14, 24, 34].forEach((r) => {
          ctx.beginPath();
          ctx.arc(x + 32, y + 64, r, Math.PI, Math.PI * 2);
          ctx.stroke();
        });
        ctx.strokeStyle = 'rgba(212, 175, 55, 0.28)';
        ctx.beginPath();
        ctx.moveTo(x + 32, y + 8);
        ctx.lineTo(x + 56, y + 32);
        ctx.lineTo(x + 32, y + 56);
        ctx.lineTo(x + 8, y + 32);
        ctx.closePath();
        ctx.stroke();
      }
    }
  } else if (sideLightStyle === 'modern_charcoal_navy_diagonal') {
    // Dark low-pile commercial multiplex carpet with subtle charcoal & midnight woven micro-stripes
    ctx.globalAlpha = 0.24;
    ctx.lineWidth = 1.2;
    for (let y = 0; y < 512; y += 24) {
      ctx.strokeStyle = y % 48 === 0 ? env.carpetAccentColor : '#161922';
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.14;
    for (let x = 0; x < 512; x += 32) {
      ctx.fillStyle = (x / 32) % 2 === 0 ? '#181c26' : '#12151d';
      ctx.fillRect(x, 0, 14, 512);
    }
  } else if (sideLightStyle === 'volcanic_copper_ribbons') {
    // Deep-pile dark woven-pattern acoustic carpet (deep basalt charcoal with crisp basketweave threads & subtle bronze undertones)
    ctx.fillStyle = '#0f1116';
    ctx.fillRect(0, 0, 512, 512);

    const tile = 32;
    for (let y = 0; y < 512; y += tile) {
      for (let x = 0; x < 512; x += tile) {
        const horiz = ((x / tile) + (y / tile)) % 2 === 0;
        ctx.fillStyle = horiz ? '#181b22' : '#12151b';
        ctx.fillRect(x + 2, y + 2, tile - 4, tile - 4);
        ctx.strokeStyle = horiz ? '#26211e' : '#1e222b';
        ctx.lineWidth = 2;
        for (let k = 6; k < tile - 4; k += 6) {
          ctx.beginPath();
          if (horiz) {
            ctx.moveTo(x + 3, y + k);
            ctx.lineTo(x + tile - 3, y + k);
          } else {
            ctx.moveTo(x + k, y + 3);
            ctx.lineTo(x + k, y + tile - 3);
          }
          ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;
  } else if (sideLightStyle === 'private_volcanic_copper_ribbons') {
    // Custom hand-tufted espresso-and-taupe wool acoustic carpet (Walnut Reserve Salon)
    ctx.fillStyle = '#1c1614';
    ctx.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 11000; i++) {
      const px = (i * 83 + (i % 19) * 17) % 512;
      const py = (i * 149 + (i % 13) * 23) % 512;
      const len = 3 + (i % 4);
      ctx.fillStyle =
        i % 5 === 0
          ? 'rgba(138, 118, 102, 0.32)'
          : i % 3 === 0
            ? 'rgba(84, 68, 57, 0.38)'
            : 'rgba(18, 13, 11, 0.42)';
      if (i % 2 === 0) {
        ctx.fillRect(px, py, len, 1.8);
      } else {
        ctx.fillRect(px, py, 1.8, len);
      }
    }

    // Refined hand-tufted taupe wool geometric border & tonal bands
    ctx.strokeStyle = 'rgba(138, 118, 102, 0.28)';
    ctx.lineWidth = 3;
    for (let y = 0; y < 512; y += 128) {
      ctx.strokeRect(10, y + 10, 492, 108);
    }
    ctx.strokeStyle = 'rgba(201, 168, 97, 0.08)';
    ctx.lineWidth = 1.5;
    for (let x = 0; x < 512; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 512);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else if (sideLightStyle === 'champagne_fluted_oak_alcoves') {
    // Thick hand-tufted charcoal wool rug with rich heather wool pile flecks & subtle tonal weave
    ctx.fillStyle = '#1b1e24';
    ctx.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 9500; i++) {
      const px = (i * 89 + (i % 17) * 13) % 512;
      const py = (i * 137 + (i % 11) * 23) % 512;
      const len = 3 + (i % 4);
      ctx.fillStyle =
        i % 7 === 0
          ? 'rgba(155, 158, 166, 0.22)'
          : i % 3 === 0
            ? 'rgba(72, 76, 86, 0.34)'
            : 'rgba(14, 16, 20, 0.38)';
      if (i % 2 === 0) {
        ctx.fillRect(px, py, len, 1.8);
      } else {
        ctx.fillRect(px, py, 1.8, len);
      }
    }

    ctx.strokeStyle = 'rgba(210, 195, 165, 0.08)';
    ctx.lineWidth = 1.5;
    for (let y = 0; y < 512; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else if (sideLightStyle === 'screenx_panoramic_walls' || sideLightStyle === 'screenx_silver_baffles') {
    // Deep obsidian acoustic broadloom carpet with fine woven charcoal broadloom micro-tufts
    ctx.fillStyle = '#07090d';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 12000; i++) {
      const px = (i * 89 + (i % 19) * 11) % 512;
      const py = (i * 139 + (i % 17) * 17) % 512;
      ctx.fillStyle =
        i % 5 === 0
          ? 'rgba(38, 46, 58, 0.24)'
          : i % 2 === 0
            ? 'rgba(18, 22, 30, 0.35)'
            : 'rgba(3, 4, 7, 0.45)';
      ctx.fillRect(px, py, 2, 2);
    }
    ctx.globalAlpha = 1;
  } else if (sideLightStyle === 'ice_faceted_cyan') {
    // Dark geometric micro-patterned acoustic carpet (Flagship)
    ctx.fillStyle = '#0b0d12';
    ctx.fillRect(0, 0, 512, 512);
    const step = 32;
    for (let y = 0; y < 512; y += step) {
      for (let x = 0; x < 512; x += step) {
        const alt = ((x / step) + (y / step)) % 2 === 0;
        ctx.fillStyle = alt ? '#131722' : '#0e1118';
        ctx.beginPath();
        ctx.moveTo(x + step * 0.5, y + 3);
        ctx.lineTo(x + step - 3, y + step * 0.5);
        ctx.lineTo(x + step * 0.5, y + step - 3);
        ctx.lineTo(x + 3, y + step * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.09)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  } else if (sideLightStyle === 'ice_faceted_cobalt') {
    // Custom woven bronze-and-charcoal acoustic carpet (Cobalt Grand)
    ctx.fillStyle = '#111216';
    ctx.fillRect(0, 0, 512, 512);
    const tile = 32;
    for (let y = 0; y < 512; y += tile) {
      for (let x = 0; x < 512; x += tile) {
        const horiz = ((x / tile) + (y / tile)) % 2 === 0;
        ctx.fillStyle = horiz ? '#1a1715' : '#141519';
        ctx.fillRect(x + 1, y + 1, tile - 2, tile - 2);
        ctx.strokeStyle = horiz ? 'rgba(138, 99, 58, 0.34)' : 'rgba(62, 56, 52, 0.36)';
        ctx.lineWidth = 2;
        for (let k = 5; k < tile - 3; k += 6) {
          ctx.beginPath();
          if (horiz) {
            ctx.moveTo(x + 2, y + k);
            ctx.lineTo(x + tile - 2, y + k);
          } else {
            ctx.moveTo(x + k, y + 2);
            ctx.lineTo(x + k, y + tile - 2);
          }
          ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;
  } else if (sideLightStyle === 'ice_faceted_amber') {
    // Dark lichen-textured woven acoustic carpet (Obsidian Amber)
    ctx.fillStyle = '#0d0f12';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 6500; i++) {
      const px = (i * 83 + (i % 19) * 17) % 512;
      const py = (i * 149 + (i % 11) * 23) % 512;
      const sz = i % 7 === 0 ? 4 : 2.5;
      ctx.fillStyle =
        i % 9 === 0
          ? 'rgba(42, 62, 52, 0.34)'
          : i % 3 === 0
            ? 'rgba(30, 36, 38, 0.4)'
            : 'rgba(10, 12, 14, 0.46)';
      ctx.fillRect(px, py, sz, sz * 0.7);
    }
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.05)';
    ctx.lineWidth = 1.2;
    for (let y = 0; y < 512; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else if (sideLightStyle === 'imax_cobalt_wave') {
    // Dark geometric-patterned acoustic carpet for IMAX Cobalt Horizon
    ctx.globalAlpha = 0.42;
    ctx.lineWidth = 2.0;
    const step = 64;
    for (let y = 0; y < 512; y += step) {
      for (let x = 0; x < 512; x += step) {
        const isAlt = ((x / step) + (y / step)) % 2 === 0;
        ctx.fillStyle = isAlt ? '#131926' : '#0f131c';
        ctx.beginPath();
        ctx.moveTo(x + step * 0.5, y + 4);
        ctx.lineTo(x + step - 4, y + step * 0.5);
        ctx.lineTo(x + step * 0.5, y + step - 4);
        ctx.lineTo(x + 4, y + step * 0.5);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = isAlt ? env.carpetAccentColor : '#1f283b';
        ctx.stroke();

        ctx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + step * 0.5, y + step * 0.5);
        ctx.lineTo(x + step, y);
        ctx.stroke();
        ctx.lineWidth = 2.0;
      }
    }
  } else if (sideLightStyle === 'obsidian_slat_grazers') {
    // Clean dark architectural geometric patterned acoustic carpet for Dolby Obsidian Reference
    ctx.globalAlpha = 0.34;
    ctx.lineWidth = 1.6;
    const step = 64;
    for (let y = 0; y < 512; y += step) {
      for (let x = 0; x < 512; x += step) {
        const isAlt = ((x / step) + (y / step)) % 2 === 0;
        ctx.fillStyle = isAlt ? '#141720' : '#0f1218';
        ctx.beginPath();
        ctx.moveTo(x + step * 0.5, y + 6);
        ctx.lineTo(x + step - 6, y + step * 0.5);
        ctx.lineTo(x + step * 0.5, y + step - 6);
        ctx.lineTo(x + 6, y + step * 0.5);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = isAlt ? '#1f2636' : '#181c26';
        ctx.stroke();

        ctx.strokeStyle = 'rgba(96, 165, 250, 0.08)';
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.moveTo(x + 8, y + 8);
        ctx.lineTo(x + step - 8, y + step - 8);
        ctx.stroke();
        ctx.lineWidth = 1.6;
      }
    }
    ctx.globalAlpha = 1;
  } else if (sideLightStyle === 'cobalt_veil_laser_recess') {
    // Deep matte-obsidian & charcoal low-pile architectural carpet with ultra-subtle amber-bronze micro-weave
    ctx.fillStyle = '#09090c';
    ctx.fillRect(0, 0, 512, 512);
    ctx.globalAlpha = 0.2;
    ctx.lineWidth = 1.0;
    for (let y = 0; y < 512; y += 8) {
      ctx.strokeStyle = y % 16 === 0 ? '#181412' : '#050507';
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.12;
    for (let x = 0; x < 512; x += 16) {
      ctx.fillStyle = (x / 16) % 2 === 0 ? '#151218' : '#08080b';
      ctx.fillRect(x, 0, 6, 512);
    }
    ctx.globalAlpha = 1;
  } else if (sideLightStyle === 'diagonal_parabolic_ribs') {
    // Clean dark low-pile acoustic theater carpet with ultra-subtle matte weave
    ctx.globalAlpha = 0.14;
    ctx.lineWidth = 1.0;
    for (let y = 0; y < 512; y += 6) {
      ctx.strokeStyle = y % 12 === 0 ? '#16181f' : '#090a0e';
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.08;
    for (let x = 0; x < 512; x += 12) {
      ctx.fillStyle = (x / 12) % 2 === 0 ? '#14171e' : '#0a0b0f';
      ctx.fillRect(x, 0, 5, 512);
    }
    ctx.globalAlpha = 1;
  } else if (sideLightStyle === 'aurora_ribbon_waves') {
    // Dark low-pile geometric-patterned acoustic carpet for IMAX Polar Aurora
    ctx.globalAlpha = 0.36;
    ctx.lineWidth = 1.6;
    const step = 64;
    for (let y = 0; y < 512; y += step) {
      for (let x = 0; x < 512; x += step) {
        const isAlt = ((x / step) + (y / step)) % 2 === 0;
        ctx.fillStyle = isAlt ? '#151b28' : '#0f131c';
        ctx.beginPath();
        ctx.moveTo(x + step * 0.5, y + 5);
        ctx.lineTo(x + step - 5, y + step * 0.5);
        ctx.lineTo(x + step * 0.5, y + step - 5);
        ctx.lineTo(x + 5, y + step * 0.5);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = isAlt ? '#202b40' : '#182030';
        ctx.stroke();

        ctx.strokeStyle = 'rgba(147, 197, 253, 0.1)';
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.moveTo(x + 12, y + 12);
        ctx.lineTo(x + step - 12, y + step - 12);
        ctx.stroke();
        ctx.lineWidth = 1.6;
      }
    }
    ctx.globalAlpha = 1;
  } else if (sideLightStyle === 'horizon_tier_strips') {
    // Dark low-pile striped acoustic carpet for IMAX Obsidian Amber
    ctx.globalAlpha = 0.28;
    for (let x = 0; x < 512; x += 24) {
      ctx.fillStyle = (x / 24) % 2 === 0 ? '#141920' : '#0c1216';
      ctx.fillRect(x, 0, 12, 512);
    }
    ctx.globalAlpha = 0.2;
    ctx.lineWidth = 1.0;
    for (let x = 0; x < 512; x += 48) {
      ctx.strokeStyle = '#1b353e';
      ctx.beginPath();
      ctx.moveTo(x + 6, 0);
      ctx.lineTo(x + 6, 512);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.12;
    for (let y = 0; y < 512; y += 8) {
      ctx.strokeStyle = '#090b0f';
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else if (sideLightStyle === 'thunder_emerald_waves') {
    // Dark speckled rubberized acoustic flooring (matte charcoal rubber base + fine mineral speckles)
    ctx.fillStyle = '#0e1014';
    ctx.fillRect(0, 0, 512, 512);

    // Subtle seamless rubber floor tile joints
    ctx.strokeStyle = '#15181f';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 512; i += 256) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 512);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(512, i);
      ctx.stroke();
    }

    // Fine mineral rubber speckles across surface
    for (let i = 0; i < 4200; i++) {
      const px = (i * 97 + (i % 13) * 19) % 512;
      const py = (i * 151 + (i % 7) * 29) % 512;
      const sz = i % 9 === 0 ? 2.4 : 1.5;
      ctx.fillStyle =
        i % 7 === 0
          ? 'rgba(180, 190, 204, 0.28)'
          : i % 3 === 0
            ? 'rgba(120, 130, 145, 0.22)'
            : 'rgba(55, 62, 74, 0.24)';
      ctx.fillRect(px, py, sz, sz);
    }
    ctx.globalAlpha = 1;
  } else if (
    sideLightStyle === 'crimson_velocity_4dx' ||
    sideLightStyle === 'arctic_parametric_fins'
  ) {
    // Dark non-slip waterproof acoustic flooring: rubberized matte carbon deck with subtle diamond-tread & waterproof tile seams
    ctx.fillStyle = '#0c0d11';
    ctx.fillRect(0, 0, 512, 512);

    // Waterproof modular acoustic deck tiles
    ctx.strokeStyle = '#181b22';
    ctx.lineWidth = 3;
    for (let i = 0; i <= 512; i += 128) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 512);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(512, i);
      ctx.stroke();
    }

    // Subtle non-slip industrial rubber tread lugs
    ctx.globalAlpha = 0.32;
    for (let y = 8; y < 512; y += 24) {
      for (let x = 8; x < 512; x += 24) {
        const alt = ((x + y) / 24) % 2 === 0;
        ctx.fillStyle = alt ? '#1c2028' : '#14171d';
        ctx.save();
        ctx.translate(x + 4, y + 4);
        ctx.rotate(alt ? Math.PI / 4 : -Math.PI / 4);
        ctx.fillRect(-5, -1.6, 10, 3.2);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  } else if (sideLightStyle === 'indian_mandap_jali') {
    // Rich dark espresso & charcoal heritage woven carpet with subtle royal crimson & antiqued-gold Mughal rosette medallions
    ctx.fillStyle = '#150d0c';
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = 'rgba(138, 58, 38, 0.28)';
    ctx.lineWidth = 2;
    for (let y = 0; y < 512; y += 64) {
      for (let x = 0; x < 512; x += 64) {
        ctx.beginPath();
        ctx.moveTo(x + 32, y + 6);
        ctx.lineTo(x + 58, y + 32);
        ctx.lineTo(x + 32, y + 58);
        ctx.lineTo(x + 6, y + 32);
        ctx.closePath();
        ctx.stroke();

        ctx.strokeStyle = 'rgba(164, 128, 66, 0.2)';
        ctx.strokeRect(x + 20, y + 20, 24, 24);
        ctx.strokeStyle = 'rgba(138, 58, 38, 0.28)';

        ctx.fillStyle = 'rgba(102, 18, 28, 0.42)';
        ctx.beginPath();
        ctx.arc(x + 32, y + 32, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (sideLightStyle === 'parametric_obsidian_waves') {
    // Deep matte carbon-obsidian commercial broadloom with crisp charcoal woven micro-texture
    ctx.fillStyle = '#0c0d12';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 10500; i++) {
      const px = (i * 89 + (i % 19) * 11) % 512;
      const py = (i * 139 + (i % 17) * 17) % 512;
      ctx.fillStyle =
        i % 7 === 0
          ? 'rgba(54, 58, 72, 0.24)'
          : i % 2 === 0
            ? 'rgba(20, 22, 30, 0.36)'
            : 'rgba(5, 6, 9, 0.44)';
      ctx.fillRect(px, py, 2, 2);
    }
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.05)';
    ctx.lineWidth = 1;
    for (let y = 0; y < 512; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else if (sideLightStyle === 'biophilic_crystalline_moss') {
    // Deep matte charcoal-espresso woven broadloom carpet with subtle sage-moss flecks
    ctx.fillStyle = '#12110e';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 11000; i++) {
      const px = (i * 83 + (i % 17) * 13) % 512;
      const py = (i * 149 + (i % 19) * 11) % 512;
      ctx.fillStyle =
        i % 9 === 0
          ? 'rgba(93, 118, 86, 0.24)'
          : i % 5 === 0
            ? 'rgba(155, 138, 112, 0.14)'
            : i % 2 === 0
              ? 'rgba(28, 25, 22, 0.42)'
              : 'rgba(10, 9, 8, 0.48)';
      ctx.fillRect(px, py, 2, 2);
    }
    ctx.globalAlpha = 1;
  } else if (env.architectureStyle === 'classic') {
    ctx.globalAlpha = 0.38;
    ctx.lineWidth = 2;
    for (let y = 0; y < 512; y += 64) {
      for (let x = 0; x < 512; x += 64) {
        ctx.beginPath();
        ctx.moveTo(x + 32, y + 6);
        ctx.lineTo(x + 58, y + 32);
        ctx.lineTo(x + 32, y + 58);
        ctx.lineTo(x + 6, y + 32);
        ctx.closePath();
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(x + 32, y + 32, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (env.architectureStyle === 'private') {
    ctx.globalAlpha = 0.28;
    ctx.lineWidth = 3;
    for (let y = 0; y < 512; y += 32) {
      for (let x = 0; x < 512; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 16, y + 16);
        ctx.lineTo(x + 32, y);
        ctx.stroke();
      }
    }
  } else {
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 512; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 512);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.1;
    for (let i = 0; i < 512; i += 64) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(512, i);
      ctx.stroke();
    }
  }

  // Fine plush pile grain
  ctx.globalAlpha = 0.09;
  for (let i = 0; i < 3600; i++) {
    const px = Math.random() * 512;
    const py = Math.random() * 512;
    ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#000000';
    ctx.fillRect(px, py, 2, 2);
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 12);
  tex.anisotropy = 8;
  return tex;
}

export function createCarpetBumpTexture(sideLightStyle?: SideLightStyle): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);

  if (sideLightStyle === 'thunder_emerald_waves') {
    // Tactile speckled acoustic rubber flooring micro-grain
    for (let i = 0; i < 4200; i++) {
      const px = (i * 73) % 256;
      const py = (i * 131) % 256;
      ctx.fillStyle = i % 3 === 0 ? '#a4a4a4' : '#646464';
      ctx.fillRect(px, py, 2, 2);
    }
  } else if (
    sideLightStyle === 'crimson_velocity_4dx' ||
    sideLightStyle === 'arctic_parametric_fins'
  ) {
    // Tactile non-slip waterproof rubberized diamond tread lugs
    for (let y = 6; y < 256; y += 16) {
      for (let x = 6; x < 256; x += 16) {
        const alt = ((x + y) / 16) % 2 === 0;
        ctx.fillStyle = '#d4d4d4';
        ctx.save();
        ctx.translate(x + 2, y + 2);
        ctx.rotate(alt ? Math.PI / 4 : -Math.PI / 4);
        ctx.fillRect(-3.5, -1.2, 7, 2.4);
        ctx.restore();
      }
    }
    ctx.strokeStyle = '#383838';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 256; i += 64) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 256);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(256, i);
      ctx.stroke();
    }
  } else if (sideLightStyle === 'volcanic_copper_ribbons') {
    // Deep-pile basketweave acoustic carpet bump
    for (let y = 0; y < 256; y += 16) {
      for (let x = 0; x < 256; x += 16) {
        const horiz = ((x / 16) + (y / 16)) % 2 === 0;
        for (let k = 2; k < 14; k += 4) {
          ctx.fillStyle = '#b4b4b4';
          if (horiz) ctx.fillRect(x + 1, y + k, 14, 2);
          else ctx.fillRect(x + k, y + 1, 2, 14);
        }
      }
    }
  } else if (sideLightStyle === 'private_volcanic_copper_ribbons') {
    // Thick hand-tufted espresso-and-taupe wool acoustic carpet bump
    for (let i = 0; i < 7200; i++) {
      const px = (i * 67) % 256;
      const py = (i * 113) % 256;
      ctx.fillStyle = i % 2 === 0 ? '#c2c2c2' : '#464646';
      ctx.fillRect(px, py, 2.6, 2.6);
    }
  } else if (sideLightStyle === 'champagne_fluted_oak_alcoves') {
    // Thick hand-tufted charcoal wool rug bump
    for (let i = 0; i < 6800; i++) {
      const px = (i * 67) % 256;
      const py = (i * 113) % 256;
      ctx.fillStyle = i % 2 === 0 ? '#bcbcbc' : '#4a4a4a';
      ctx.fillRect(px, py, 2.5, 2.5);
    }
  } else if (
    sideLightStyle === 'screenx_panoramic_walls' ||
    sideLightStyle === 'screenx_silver_baffles' ||
    sideLightStyle === 'parametric_obsidian_waves' ||
    sideLightStyle === 'biophilic_crystalline_moss' ||
    sideLightStyle === 'cobalt_veil_laser_recess'
  ) {
    // Tight woven obsidian acoustic broadloom loop-pile bump
    for (let i = 0; i < 7200; i++) {
      const px = (i * 73) % 256;
      const py = (i * 127) % 256;
      ctx.fillStyle = i % 2 === 0 ? '#9e9e9e' : '#606060';
      ctx.fillRect(px, py, 2, 2);
    }
  } else if (sideLightStyle === 'indian_mandap_jali') {
    // Plush heritage wool-pile weave bump
    for (let i = 0; i < 6200; i++) {
      const px = (i * 71 + (i % 11) * 9) % 256;
      const py = (i * 129 + (i % 13) * 7) % 256;
      ctx.fillStyle = i % 2 === 0 ? '#b2b2b2' : '#525252';
      ctx.fillRect(px, py, 2.2, 2.2);
    }
  } else if (sideLightStyle === 'ice_faceted_cyan') {
    for (let y = 0; y < 256; y += 16) {
      for (let x = 0; x < 256; x += 16) {
        ctx.strokeStyle = '#505050';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x + 8, y + 2);
        ctx.lineTo(x + 14, y + 8);
        ctx.lineTo(x + 8, y + 14);
        ctx.lineTo(x + 2, y + 8);
        ctx.closePath();
        ctx.stroke();
      }
    }
  } else if (sideLightStyle === 'ice_faceted_cobalt') {
    for (let y = 0; y < 256; y += 16) {
      for (let x = 0; x < 256; x += 16) {
        const horiz = ((x / 16) + (y / 16)) % 2 === 0;
        for (let k = 2; k < 14; k += 4) {
          ctx.fillStyle = '#aeaeae';
          if (horiz) ctx.fillRect(x + 1, y + k, 14, 2);
          else ctx.fillRect(x + k, y + 1, 2, 14);
        }
      }
    }
  } else if (sideLightStyle === 'ice_faceted_amber') {
    for (let i = 0; i < 5400; i++) {
      const px = (i * 71) % 256;
      const py = (i * 127) % 256;
      ctx.fillStyle = i % 2 === 0 ? '#b2b2b2' : '#525252';
      ctx.fillRect(px, py, 2.6, 2);
    }
  } else {
    for (let i = 0; i < 5200; i++) {
      const px = Math.random() * 256;
      const py = Math.random() * 256;
      ctx.fillStyle = i % 2 === 0 ? '#a8a8a8' : '#565656';
      ctx.fillRect(px, py, 2, 2);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(14, 20);
  tex.anisotropy = 4;
  return tex;
}

export function createAcousticWallTexture(
  env: EnvironmentProfile,
  sideLightStyle?: SideLightStyle,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = env.wallMaterialColor;
  ctx.fillRect(0, 0, 512, 512);

  if (sideLightStyle === 'art_deco_navy_sunburst') {
    // Rich matte midnight navy blue & charcoal slate textured acoustic fabric panels
    const bgGrad = ctx.createLinearGradient(0, 0, 512, 512);
    bgGrad.addColorStop(0, '#0d1930');
    bgGrad.addColorStop(0.5, '#172133');
    bgGrad.addColorStop(1, '#1a202c');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 512, 512);

    // Textured acoustic linen/fabric cross-weave
    ctx.strokeStyle = 'rgba(255,255,255,0.032)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 512; i += 4) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(512, i);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    for (let x = 0; x < 512; x += 8) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 512);
      ctx.stroke();
    }

    // Symmetrical outer warm bronze & brushed gold stepped panel border
    ctx.strokeStyle = '#9c6b3b';
    ctx.lineWidth = 5;
    ctx.strokeRect(18, 18, 476, 476);
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(28, 28, 456, 456);

    // Charcoal slate stepped inner field
    ctx.fillStyle = 'rgba(22, 28, 39, 0.72)';
    ctx.fillRect(48, 48, 416, 416);

    // Upper & lower symmetrical Art Deco radial sunburst fans
    const drawSunburst = (cx: number, cy: number, startAngle: number, endAngle: number) => {
      const rays = 14;
      for (let i = 0; i <= rays; i++) {
        const a = startAngle + (i / rays) * (endAngle - startAngle);
        const len = i % 2 === 0 ? 158 : 118;
        ctx.strokeStyle = i % 2 === 0 ? '#d4af37' : '#a36e38';
        ctx.lineWidth = i % 2 === 0 ? 3.2 : 2.0;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
        ctx.stroke();
      }
      [42, 68, 94].forEach((r, ri) => {
        ctx.strokeStyle = ri === 1 ? '#e2be60' : '#9c6b3b';
        ctx.lineWidth = ri === 1 ? 3 : 2;
        ctx.beginPath();
        ctx.arc(cx, cy, r, startAngle, endAngle);
        ctx.stroke();
      });
    };
    drawSunburst(256, 44, 0.16 * Math.PI, 0.84 * Math.PI);
    drawSunburst(256, 468, 1.16 * Math.PI, 1.84 * Math.PI);

    // Symmetrical central Art Deco nested chevron / diamond lattice
    for (let k = 0; k < 5; k++) {
      const spreadY = 38 + k * 28;
      const spreadX = 165 - k * 14;
      ctx.strokeStyle = k % 2 === 0 ? '#d4af37' : '#9c6b3b';
      ctx.lineWidth = k === 0 ? 4 : 2.6;
      ctx.beginPath();
      ctx.moveTo(256 - spreadX, 256);
      ctx.lineTo(256, 256 - spreadY);
      ctx.lineTo(256 + spreadX, 256);
      ctx.lineTo(256, 256 + spreadY);
      ctx.closePath();
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(5, 1);
    tex.anisotropy = 8;
    return tex;
  }

  if (sideLightStyle === 'modern_charcoal_navy_diagonal') {
    // Matte charcoal grey & deep midnight blue fabric-wrapped acoustic panels in angled geometric & diagonal line patterns
    ctx.fillStyle = '#20242d';
    ctx.fillRect(0, 0, 512, 512);

    const drawPoly = (pts: [number, number][], fill: string) => {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      ctx.fill();
    };

    // Crisp angled geometric & diagonal faceted fabric zones
    drawPoly([[0, 0], [310, 0], [160, 270], [0, 190]], '#111f3b');
    drawPoly([[310, 0], [512, 0], [512, 230], [335, 340], [160, 270]], '#252934');
    drawPoly([[0, 190], [160, 270], [335, 340], [190, 512], [0, 512]], '#1c2029');
    drawPoly([[335, 340], [512, 230], [512, 512], [190, 512]], '#152546');

    // Fine commercial acoustic fabric micro-weave
    ctx.strokeStyle = 'rgba(255,255,255,0.024)';
    ctx.lineWidth = 1;
    for (let y = 0; y < 512; y += 3) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    for (let x = 0; x < 512; x += 6) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 512);
      ctx.stroke();
    }

    // Crisp recessed dark shadow-gap seams along the diagonal boundaries
    const seams: [[number, number], [number, number]][] = [
      [[0, 190], [335, 340]],
      [[310, 0], [160, 270]],
      [[335, 340], [512, 230]],
      [[335, 340], [190, 512]],
      [[160, 270], [335, 340]],
    ];
    ctx.strokeStyle = '#07090d';
    ctx.lineWidth = 5;
    seams.forEach(([a, b]) => {
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    });

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 1);
    tex.anisotropy = 8;
    return tex;
  }

  if (sideLightStyle === 'volcanic_copper_ribbons') {
    // Broad gently angled interlocking bands of matte volcanic-basalt fabric & warm muted terracotta-copper suede panels with dark-bronze shadow reveals
    ctx.fillStyle = '#242831';
    ctx.fillRect(0, 0, 512, 512);

    const drawRibbon = (pts: [number, number][], fill: string) => {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      ctx.fill();
    };

    drawRibbon([[0, 0], [512, 0], [512, 190], [260, 140], [0, 200]], '#262a33');
    drawRibbon([[0, 200], [260, 140], [512, 190], [512, 340], [250, 290], [0, 355]], '#95503b');
    drawRibbon([[0, 355], [250, 290], [512, 340], [512, 512], [0, 512]], '#22262f');

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.lineWidth = 1;
    for (let y = 0; y < 512; y += 3) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }

    ctx.strokeStyle = '#332419';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, 200);
    ctx.lineTo(260, 140);
    ctx.lineTo(512, 190);
    ctx.moveTo(0, 355);
    ctx.lineTo(250, 290);
    ctx.lineTo(512, 340);
    ctx.stroke();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 1);
    tex.anisotropy = 8;
    return tex;
  }

  if (sideLightStyle === 'private_volcanic_copper_ribbons') {
    // Vertical fluted American walnut panels & softly curved oatmeal bouclé / cognac suede backing texture
    ctx.fillStyle = '#3c2416';
    ctx.fillRect(0, 0, 512, 512);

    for (let x = 0; x < 512; x += 24) {
      const grad = ctx.createLinearGradient(x, 0, x + 16, 0);
      grad.addColorStop(0, '#361f12');
      grad.addColorStop(0.45, '#593620');
      grad.addColorStop(1, '#2d1a0f');
      ctx.fillStyle = grad;
      ctx.fillRect(x, 0, 16, 512);
      ctx.fillStyle = '#18100c';
      ctx.fillRect(x + 16, 0, 8, 512);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 1);
    tex.anisotropy = 8;
    return tex;
  }

  if (sideLightStyle === 'champagne_fluted_oak_alcoves') {
    // Rhythmic vertical fluted smoked-oak slats, warm alabaster plaster & muted sage-slate fabric panels with champagne-gold inlays
    ctx.fillStyle = '#36271d';
    ctx.fillRect(0, 0, 512, 512);

    // Smoked-oak fluted strip left & right thirds
    const drawFlutes = (x0: number, w: number) => {
      for (let x = x0; x < x0 + w; x += 14) {
        ctx.fillStyle = '#433023';
        ctx.fillRect(x, 0, 8, 512);
        ctx.fillStyle = '#1d140e';
        ctx.fillRect(x + 8, 0, 6, 512);
      }
    };
    drawFlutes(0, 140);
    drawFlutes(372, 140);

    // Warm alabaster plaster frame & sage-slate inner fabric panel
    ctx.fillStyle = '#cbc0ad';
    ctx.fillRect(140, 0, 232, 512);
    ctx.fillStyle = '#475752';
    ctx.fillRect(168, 36, 176, 440);

    // Hairline champagne-gold metallic inlays
    ctx.fillStyle = '#d4b87c';
    ctx.fillRect(138, 0, 4, 512);
    ctx.fillRect(370, 0, 4, 512);
    ctx.strokeStyle = '#d4b87c';
    ctx.lineWidth = 3;
    ctx.strokeRect(168, 36, 176, 440);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 1);
    tex.anisotropy = 8;
    return tex;
  }

  if (sideLightStyle === 'imax_cobalt_wave') {
    // Matte obsidian black & deep charcoal acoustic wave panels with subtle angled geometric grooves
    ctx.fillStyle = '#07090d';
    ctx.fillRect(0, 0, 512, 512);

    // Subtle undulating vertical/angled obsidian-charcoal acoustic wave bands
    for (let x = 0; x < 512; x += 32) {
      const grad = ctx.createLinearGradient(x, 0, x + 32, 0);
      grad.addColorStop(0, '#040508');
      grad.addColorStop(0.28, '#0c0f16');
      grad.addColorStop(0.55, '#131722');
      grad.addColorStop(0.85, '#090b10');
      grad.addColorStop(1, '#040508');
      ctx.fillStyle = grad;
      ctx.fillRect(x, 0, 32, 512);
    }

    // Angled geometric wave groove lines (non-reflective deep charcoal absorption ribs)
    ctx.strokeStyle = '#030406';
    ctx.lineWidth = 3.5;
    for (let i = -512; i < 1024; i += 48) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 220, 256);
      ctx.lineTo(i + 80, 512);
      ctx.stroke();
    }

    // Subtle matte acoustic felt grain
    for (let i = 0; i < 2400; i++) {
      const px = (i * 89) % 512;
      const py = (i * 151) % 512;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.012)' : 'rgba(0,0,0,0.38)';
      ctx.fillRect(px, py, 2, 2);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 1);
    tex.anisotropy = 8;
    return tex;
  }

  if (sideLightStyle === 'aurora_ribbon_waves') {
    // Matte slate-grey & deep indigo-charcoal hexagonal and angled polygon acoustic fabric panels with brushed dark-aluminum trims
    ctx.fillStyle = '#1b2134';
    ctx.fillRect(0, 0, 512, 512);

    const drawHex = (cx: number, cy: number, r: number, fill: string) => {
      ctx.fillStyle = fill;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (k * Math.PI) / 3;
        const px = cx + Math.cos(a) * r;
        const py = cy + Math.sin(a) * r;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#404856';
      ctx.lineWidth = 4;
      ctx.stroke();
    };

    drawHex(128, 128, 112, '#343c4d');
    drawHex(384, 128, 112, '#1d253d');
    drawHex(256, 256, 112, '#2d3545');
    drawHex(128, 384, 112, '#1b2236');
    drawHex(384, 384, 112, '#363f50');

    // Subtle acoustic fabric weave
    ctx.fillStyle = 'rgba(255,255,255,0.016)';
    for (let y = 0; y < 512; y += 4) {
      ctx.fillRect(0, y, 512, 1);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 1);
    tex.anisotropy = 8;
    return tex;
  }

  if (sideLightStyle === 'horizon_tier_strips') {
    // 3D origami-folded triangular and trapezoidal acoustic fabric panels in matte graphite-black & deep ocean-teal with satin-black shadow gaps
    ctx.fillStyle = '#161920';
    ctx.fillRect(0, 0, 512, 512);

    const drawTri = (pts: [number, number][], fill: string) => {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#07090d';
      ctx.lineWidth = 5;
      ctx.stroke();
    };

    drawTri([[0, 0], [256, 0], [160, 220], [0, 180]], '#1a1e26');
    drawTri([[256, 0], [512, 0], [512, 190], [310, 250], [160, 220]], '#12424f');
    drawTri([[0, 180], [160, 220], [120, 512], [0, 512]], '#103945');
    drawTri([[160, 220], [310, 250], [380, 512], [120, 512]], '#181c24');
    drawTri([[310, 250], [512, 190], [512, 512], [380, 512]], '#144957');

    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    for (let y = 2; y < 512; y += 4) {
      ctx.fillRect(0, y, 512, 1);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 1);
    tex.anisotropy = 8;
    return tex;
  }

  if (sideLightStyle === 'crimson_velocity_4dx') {
    // Matte carbon-black and dark gunmetal-grey angular acoustic panels with perforated micro-weave
    ctx.fillStyle = '#111318';
    ctx.fillRect(0, 0, 512, 512);

    const drawFacet = (pts: [number, number][], fill: string) => {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      ctx.fill();
    };

    drawFacet([[0, 0], [320, 0], [185, 250], [0, 170]], '#1d212a');
    drawFacet([[320, 0], [512, 0], [512, 220], [350, 315], [185, 250]], '#12151b');
    drawFacet([[0, 170], [185, 250], [350, 315], [190, 512], [0, 512]], '#151820');
    drawFacet([[350, 315], [512, 220], [512, 512], [190, 512]], '#232833');

    // Fine perforated acoustic micro-dot grid
    ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
    for (let y = 4; y < 512; y += 8) {
      for (let x = 4; x < 512; x += 8) {
        ctx.fillRect(x, y, 2, 2);
      }
    }

    // Crisp recessed shadow-gap seams along angular panel joints
    ctx.strokeStyle = '#050608';
    ctx.lineWidth = 5;
    [
      [[0, 170], [350, 315]],
      [[320, 0], [185, 250]],
      [[350, 315], [512, 220]],
      [[350, 315], [190, 512]],
    ].forEach(([a, b]) => {
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    });

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 1);
    tex.anisotropy = 8;
    return tex;
  }

  if (sideLightStyle === 'arctic_parametric_fins') {
    // Interlocking diamond & diagonal-cut acoustic panels in matte slate-grey, deep indigo, and pitch-black + bold painted geometric line patterns
    ctx.fillStyle = '#0b0d12';
    ctx.fillRect(0, 0, 512, 512);

    const drawFacet = (pts: [number, number][], fill: string) => {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      ctx.fill();
    };

    drawFacet([[0, 0], [256, 0], [128, 256], [0, 128]], '#384152');
    drawFacet([[256, 0], [512, 0], [512, 128], [384, 256]], '#1e1b4b');
    drawFacet([[256, 0], [384, 256], [256, 512], [128, 256]], '#0c0e14');
    drawFacet([[0, 128], [128, 256], [0, 384]], '#1e1b4b');
    drawFacet([[512, 128], [512, 384], [384, 256]], '#384152');
    drawFacet([[128, 256], [256, 512], [0, 512], [0, 384]], '#313949');
    drawFacet([[384, 256], [512, 384], [512, 512], [256, 512]], '#17153b');

    // Bold painted geometric line patterns inside the diamond facets
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.28)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(256, 46);
    ctx.lineTo(356, 256);
    ctx.lineTo(256, 466);
    ctx.lineTo(156, 256);
    ctx.closePath();
    ctx.stroke();

    ctx.strokeStyle = 'rgba(34, 211, 238, 0.24)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, 182);
    ctx.lineTo(96, 256);
    ctx.lineTo(0, 330);
    ctx.moveTo(512, 182);
    ctx.lineTo(416, 256);
    ctx.lineTo(512, 330);
    ctx.stroke();

    // Fine perforated acoustic micro-dot grid
    ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
    for (let y = 4; y < 512; y += 8) {
      for (let x = 4; x < 512; x += 8) {
        ctx.fillRect(x, y, 2, 2);
      }
    }

    // Crisp recessed shadow-gap diamond seams
    ctx.strokeStyle = '#050608';
    ctx.lineWidth = 5;
    [
      [[256, 0], [0, 256]],
      [[256, 0], [512, 256]],
      [[0, 256], [256, 512]],
      [[512, 256], [256, 512]],
      [[0, 128], [256, 384]],
      [[512, 128], [256, 384]],
    ].forEach(([a, b]) => {
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    });

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 1);
    tex.anisotropy = 8;
    return tex;
  }

  if (sideLightStyle === 'thunder_emerald_waves') {
    // Matte titanium grey and deep espresso-bronze acoustic backing behind parametric fins
    const grad = ctx.createLinearGradient(0, 0, 512, 0);
    grad.addColorStop(0, '#2a201b');
    grad.addColorStop(0.5, '#3b2b22');
    grad.addColorStop(1, '#323741');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    for (let x = 0; x < 512; x += 16) {
      ctx.fillRect(x, 0, 3, 512);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 1);
    tex.anisotropy = 8;
    return tex;
  }

  if (sideLightStyle === 'obsidian_slat_grazers') {
    // Matte charcoal-black & deep midnight-slate acoustic fabric panels divided by clean diagonal & vertical gunmetal seams
    ctx.fillStyle = '#151820';
    ctx.fillRect(0, 0, 512, 512);

    const drawPoly = (pts: [number, number][], fill: string) => {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      ctx.fill();
    };

    drawPoly([[0, 0], [256, 0], [256, 220], [0, 320]], '#162136');
    drawPoly([[256, 0], [512, 0], [512, 260], [256, 180]], '#1b1f29');
    drawPoly([[0, 320], [256, 220], [256, 512], [0, 512]], '#171a22');
    drawPoly([[256, 180], [512, 260], [512, 512], [256, 512]], '#141e32');

    // Fine acoustic fabric micro-weave
    ctx.strokeStyle = 'rgba(255,255,255,0.02)';
    ctx.lineWidth = 1;
    for (let y = 0; y < 512; y += 3) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }

    // Clean vertical & diagonal brushed gunmetal division trims
    ctx.strokeStyle = '#4b5563';
    ctx.lineWidth = 5;
    [
      [[256, 0], [256, 512]],
      [[0, 320], [256, 220]],
      [[256, 180], [512, 260]],
    ].forEach(([a, b]) => {
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    });

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 1);
    tex.anisotropy = 8;
    return tex;
  }

  if (sideLightStyle === 'cobalt_veil_laser_recess') {
    // Acoustically porous charcoal-suede & matte obsidian substrate behind overlapping 3D carbon-fiber scales
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, '#09090c');
    grad.addColorStop(0.5, '#131419');
    grad.addColorStop(1, '#08080b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // Fine porous acoustic suede micro-nap
    for (let i = 0; i < 6000; i++) {
      const px = (i * 73) % 512;
      const py = (i * 139) % 512;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.22)';
      ctx.fillRect(px, py, 2, 2);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 2);
    tex.anisotropy = 8;
    return tex;
  }

  if (sideLightStyle === 'diagonal_parabolic_ribs') {
    // Horizontal charcoal-slate fabric acoustic bands & warm dark walnut-bronze wood slats separated by satin-black trims
    ctx.fillStyle = '#1e222b';
    ctx.fillRect(0, 0, 512, 512);

    // Upper & lower walnut-bronze vertical acoustic slat zones
    const drawWalnutBand = (y0: number, h: number) => {
      ctx.fillStyle = '#1c120d';
      ctx.fillRect(0, y0, 512, h);
      for (let x = 0; x < 512; x += 14) {
        ctx.fillStyle = (x / 14) % 2 === 0 ? '#462c1e' : '#3a2418';
        ctx.fillRect(x, y0, 9, h);
        ctx.fillStyle = '#0e0a08';
        ctx.fillRect(x + 9, y0, 5, h);
      }
    };
    drawWalnutBand(0, 150);
    drawWalnutBand(362, 150);

    // Mid horizontal charcoal-slate fabric band
    ctx.fillStyle = '#242934';
    ctx.fillRect(0, 158, 512, 196);
    ctx.strokeStyle = 'rgba(255,255,255,0.02)';
    ctx.lineWidth = 1;
    for (let y = 160; y < 354; y += 3) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }

    // Clean satin-black horizontal & vertical separation trims
    ctx.fillStyle = '#0d0f14';
    ctx.fillRect(0, 150, 512, 8);
    ctx.fillRect(0, 354, 512, 8);
    ctx.fillRect(252, 0, 8, 512);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 1);
    tex.anisotropy = 8;
    return tex;
  }

  if (sideLightStyle === 'ice_faceted_cyan') {
    // Matte-black carbon-weave acoustic wall modules separated by precision brushed-aluminum reveals
    ctx.fillStyle = '#111318';
    ctx.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 512; y += 8) {
      for (let x = 0; x < 512; x += 8) {
        const shift = ((x + y) / 8) % 2 === 0;
        ctx.fillStyle = shift ? '#181b22' : '#0e1015';
        ctx.fillRect(x, y, 6, 4);
      }
    }
    ctx.strokeStyle = '#6c7687';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 508, 252);
    ctx.strokeRect(2, 258, 508, 252);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 2);
    tex.anisotropy = 8;
    return tex;
  }

  if (sideLightStyle === 'ice_faceted_cobalt') {
    // Sculpted sandblasted-taupe acoustic plaster walls with fine warm mineral plaster grain
    ctx.fillStyle = '#5f544a';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 8200; i++) {
      const px = (i * 83 + (i % 13) * 19) % 512;
      const py = (i * 139 + (i % 17) * 11) % 512;
      ctx.fillStyle =
        i % 3 === 0 ? 'rgba(154, 138, 122, 0.22)' : 'rgba(54, 46, 39, 0.24)';
      ctx.fillRect(px, py, 2.5, 2.5);
    }
    ctx.strokeStyle = '#473d34';
    ctx.lineWidth = 3;
    for (let y = 128; y < 512; y += 128) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(5, 2);
    tex.anisotropy = 8;
    return tex;
  }

  if (sideLightStyle === 'ice_faceted_amber') {
    // Charred Shou Sugi Ban vertical timber slats & dark basalt acoustic fabric bays
    ctx.fillStyle = '#181b21';
    ctx.fillRect(0, 0, 512, 512);
    for (let x = 0; x < 512; x += 24) {
      ctx.fillStyle = (x / 24) % 2 === 0 ? '#161210' : '#120f0e';
      ctx.fillRect(x + 2, 0, 16, 512);
      ctx.fillStyle = '#07080a';
      ctx.fillRect(x + 18, 0, 6, 512);
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 6, 0);
      ctx.lineTo(x + 6, 512);
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(5, 2);
    tex.anisotropy = 8;
    return tex;
  }

  if (sideLightStyle === 'screenx_panoramic_walls' || sideLightStyle === 'screenx_silver_baffles') {
    // Seamless dark obsidian / non-reflective matte-indigo acoustic finish
    ctx.fillStyle = sideLightStyle === 'screenx_silver_baffles' ? '#171c3d' : '#0c0f15';
    ctx.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 512; y += 6) {
      for (let x = 0; x < 512; x += 6) {
        ctx.fillStyle = (x + y) % 12 === 0 ? 'rgba(255,255,255,0.022)' : 'rgba(0,0,0,0.28)';
        ctx.fillRect(x, y, 2, 2);
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 2);
    tex.anisotropy = 8;
    return tex;
  }

  if (sideLightStyle === 'indian_mandap_jali') {
    // Non-reflective matte terracotta & deep royal crimson textured acoustic wool-fabric bays
    ctx.fillStyle = '#5f131b';
    ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = '#843623';
    ctx.fillRect(0, 0, 512, 256);

    ctx.strokeStyle = 'rgba(255, 224, 186, 0.028)';
    ctx.lineWidth = 1;
    for (let y = 0; y < 512; y += 4) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.24)';
    for (let x = 0; x < 512; x += 6) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 512);
      ctx.stroke();
    }
    ctx.fillStyle = '#22140f';
    ctx.fillRect(0, 252, 512, 8);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 1);
    tex.anisotropy = 8;
    return tex;
  }

  if (sideLightStyle === 'parametric_obsidian_waves') {
    // Deep matte obsidian & carbon-grey acoustic backing fabric
    ctx.fillStyle = '#0c0e13';
    ctx.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 512; y += 6) {
      for (let x = 0; x < 512; x += 6) {
        ctx.fillStyle = (x + y) % 12 === 0 ? 'rgba(56, 62, 76, 0.08)' : 'rgba(0, 0, 0, 0.34)';
        ctx.fillRect(x, y, 2, 2);
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 2);
    tex.anisotropy = 8;
    return tex;
  }

  if (env.architectureStyle === 'dolby') {
    for (let x = 0; x < 512; x += 16) {
      ctx.fillStyle = '#020204';
      ctx.fillRect(x, 0, 6, 512);
      ctx.fillStyle = env.wallMaterialColor;
      ctx.fillRect(x + 6, 0, 10, 512);
    }
  } else if (env.architectureStyle === 'private') {
    const grad = ctx.createLinearGradient(0, 0, 512, 0);
    grad.addColorStop(0, env.wallMaterialColor);
    grad.addColorStop(0.5, env.carpetAccentColor);
    grad.addColorStop(1, env.wallMaterialColor);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = 'rgba(10, 6, 4, 0.34)';
    ctx.lineWidth = 2;
    for (let x = 0; x < 512; x += 10) {
      ctx.beginPath();
      ctx.moveTo(x + Math.sin(x * 0.1) * 3, 0);
      ctx.lineTo(x + Math.cos(x * 0.15) * 4, 512);
      ctx.stroke();
    }
  } else if (sideLightStyle === 'biophilic_crystalline_moss') {
    // Organic preserved moss & acoustic mineral wool backing with fine matte stipple
    ctx.fillStyle = '#1b1f1e';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 12000; i++) {
      const px = (i * 97 + (i % 23) * 7) % 512;
      const py = (i * 163 + (i % 13) * 19) % 512;
      ctx.fillStyle =
        i % 7 === 0
          ? 'rgba(93, 118, 86, 0.22)'
          : i % 4 === 0
            ? 'rgba(197, 178, 150, 0.12)'
            : i % 2 === 0
              ? 'rgba(42, 48, 45, 0.35)'
              : 'rgba(10, 12, 12, 0.42)';
      ctx.fillRect(px, py, 2, 2);
    }
  } else {
    // Perforated & woven acoustic theater fabric with recessed panel seams
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let y = 0; y < 512; y += 6) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }
    for (let x = 0; x < 512; x += 64) {
      ctx.fillStyle = 'rgba(0,0,0,0.44)';
      ctx.fillRect(x, 0, 4, 512);
      ctx.fillStyle = 'rgba(255,255,255,0.035)';
      ctx.fillRect(x + 4, 0, 2, 512);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    for (let y = 0; y < 512; y += 128) {
      ctx.fillRect(0, y, 512, 3);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 2);
  tex.anisotropy = 8;
  return tex;
}

export function createAcousticWallBumpTexture(
  env: EnvironmentProfile,
  sideLightStyle?: SideLightStyle,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);

  if (sideLightStyle === 'modern_charcoal_navy_diagonal') {
    for (let y = 0; y < 256; y += 3) {
      ctx.fillStyle = y % 6 === 0 ? '#909090' : '#707070';
      ctx.fillRect(0, y, 256, 1.5);
    }
    ctx.strokeStyle = '#242424';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 95);
    ctx.lineTo(168, 170);
    ctx.lineTo(256, 115);
    ctx.moveTo(155, 0);
    ctx.lineTo(80, 135);
    ctx.moveTo(168, 170);
    ctx.lineTo(95, 256);
    ctx.stroke();
  } else if (sideLightStyle === 'volcanic_copper_ribbons') {
    for (let y = 0; y < 256; y += 3) {
      ctx.fillStyle = y % 6 === 0 ? '#8c8c8c' : '#747474';
      ctx.fillRect(0, y, 256, 1.5);
    }
    ctx.strokeStyle = '#282828';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 100);
    ctx.lineTo(128, 70);
    ctx.lineTo(256, 95);
    ctx.moveTo(0, 178);
    ctx.lineTo(128, 145);
    ctx.lineTo(256, 170);
    ctx.stroke();
  } else if (sideLightStyle === 'private_volcanic_copper_ribbons') {
    for (let x = 0; x < 256; x += 12) {
      ctx.fillStyle = '#c8c8c8';
      ctx.fillRect(x, 0, 8, 256);
      ctx.fillStyle = '#262626';
      ctx.fillRect(x + 8, 0, 4, 256);
    }
  } else if (sideLightStyle === 'champagne_fluted_oak_alcoves') {
    for (let x = 0; x < 70; x += 7) {
      ctx.fillStyle = '#c8c8c8';
      ctx.fillRect(x, 0, 4, 256);
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(x + 4, 0, 3, 256);
    }
    for (let x = 186; x < 256; x += 7) {
      ctx.fillStyle = '#c8c8c8';
      ctx.fillRect(x, 0, 4, 256);
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(x + 4, 0, 3, 256);
    }
    ctx.fillStyle = '#848484';
    ctx.fillRect(70, 0, 116, 256);
  } else if (sideLightStyle === 'screenx_panoramic_walls' || sideLightStyle === 'screenx_silver_baffles') {
    // Specialized micro-perforated acoustic screen fabric bump (no joints or seams)
    for (let y = 2; y < 256; y += 4) {
      for (let x = 2; x < 256; x += 4) {
        ctx.fillStyle = '#484848';
        ctx.fillRect(x, y, 1.5, 1.5);
      }
    }
  } else if (sideLightStyle === 'biophilic_crystalline_moss') {
    // Tactile organic moss-tuft cellular bump relief
    for (let i = 0; i < 9500; i++) {
      const px = (i * 79 + (i % 11) * 5) % 256;
      const py = (i * 137 + (i % 13) * 7) % 256;
      ctx.fillStyle = i % 3 === 0 ? '#bcbcbc' : i % 2 === 0 ? '#686868' : '#4a4a4a';
      ctx.fillRect(px, py, 2.5, 2.5);
    }
  } else if (sideLightStyle === 'ice_faceted_cyan') {
    for (let y = 0; y < 256; y += 6) {
      for (let x = 0; x < 256; x += 6) {
        const alt = ((x + y) / 6) % 2 === 0;
        ctx.fillStyle = alt ? '#a2a2a2' : '#5e5e5e';
        ctx.fillRect(x, y, 4, 3);
      }
    }
  } else if (sideLightStyle === 'ice_faceted_cobalt') {
    for (let i = 0; i < 6200; i++) {
      const px = (i * 71) % 256;
      const py = (i * 119) % 256;
      ctx.fillStyle = i % 2 === 0 ? '#a8a8a8' : '#5a5a5a';
      ctx.fillRect(px, py, 2, 2);
    }
  } else if (sideLightStyle === 'ice_faceted_amber') {
    for (let x = 0; x < 256; x += 12) {
      ctx.fillStyle = '#bcbcbc';
      ctx.fillRect(x + 1, 0, 8, 256);
      ctx.fillStyle = '#2e2e2e';
      ctx.fillRect(x + 9, 0, 3, 256);
    }
  } else if (sideLightStyle === 'imax_cobalt_wave') {
    // Angled wave ridges and deep acoustic groove channels
    for (let x = 0; x < 256; x += 16) {
      const grad = ctx.createLinearGradient(x, 0, x + 16, 0);
      grad.addColorStop(0, '#363636');
      grad.addColorStop(0.5, '#b8b8b8');
      grad.addColorStop(1, '#363636');
      ctx.fillStyle = grad;
      ctx.fillRect(x, 0, 16, 256);
    }
    ctx.strokeStyle = '#202020';
    ctx.lineWidth = 3;
    for (let i = -256; i < 512; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 110, 128);
      ctx.lineTo(i + 40, 256);
      ctx.stroke();
    }
  } else if (sideLightStyle === 'aurora_ribbon_waves') {
    // Hexagonal & angled polygon fabric grooves
    ctx.strokeStyle = '#323232';
    ctx.lineWidth = 3;
    [
      [64, 64, 54],
      [192, 64, 54],
      [128, 128, 54],
      [64, 192, 54],
      [192, 192, 54],
    ].forEach(([cx, cy, r]) => {
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (k * Math.PI) / 3;
        const px = cx + Math.cos(a) * r;
        const py = cy + Math.sin(a) * r;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    });
  } else if (sideLightStyle === 'horizon_tier_strips') {
    // Origami folded triangular creases
    ctx.strokeStyle = '#282828';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 90);
    ctx.lineTo(80, 110);
    ctx.lineTo(155, 125);
    ctx.lineTo(256, 95);
    ctx.moveTo(128, 0);
    ctx.lineTo(80, 110);
    ctx.lineTo(60, 256);
    ctx.moveTo(155, 125);
    ctx.lineTo(190, 256);
    ctx.stroke();
  } else if (sideLightStyle === 'crimson_velocity_4dx') {
    // Micro-perforated matte carbon/gunmetal acoustic texture + angular seam grooves
    ctx.fillStyle = '#606060';
    for (let y = 3; y < 256; y += 6) {
      for (let x = 3; x < 256; x += 6) {
        ctx.fillRect(x, y, 2, 2);
      }
    }
    ctx.strokeStyle = '#242424';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 85);
    ctx.lineTo(175, 158);
    ctx.lineTo(256, 110);
    ctx.moveTo(160, 0);
    ctx.lineTo(92, 125);
    ctx.moveTo(175, 158);
    ctx.lineTo(95, 256);
    ctx.stroke();
  } else if (sideLightStyle === 'arctic_parametric_fins') {
    ctx.fillStyle = '#606060';
    for (let y = 3; y < 256; y += 6) {
      for (let x = 3; x < 256; x += 6) {
        ctx.fillRect(x, y, 2, 2);
      }
    }
    ctx.strokeStyle = '#242424';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(128, 0);
    ctx.lineTo(0, 128);
    ctx.lineTo(128, 256);
    ctx.lineTo(256, 128);
    ctx.closePath();
    ctx.stroke();
  } else if (sideLightStyle === 'thunder_emerald_waves') {
    for (let x = 0; x < 256; x += 8) {
      ctx.fillStyle = x % 16 === 0 ? '#989898' : '#585858';
      ctx.fillRect(x, 0, 4, 256);
    }
  } else if (sideLightStyle === 'obsidian_slat_grazers') {
    // Acoustic fabric micro-weave + clean diagonal & vertical trim seams
    for (let y = 0; y < 256; y += 3) {
      ctx.fillStyle = y % 6 === 0 ? '#8c8c8c' : '#747474';
      ctx.fillRect(0, y, 256, 1.5);
    }
    ctx.strokeStyle = '#282828';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(128, 0);
    ctx.lineTo(128, 256);
    ctx.moveTo(0, 160);
    ctx.lineTo(128, 110);
    ctx.moveTo(128, 90);
    ctx.lineTo(256, 130);
    ctx.stroke();
  } else if (sideLightStyle === 'cobalt_veil_laser_recess') {
    // Acoustically porous charcoal-suede micro-nap bump
    for (let i = 0; i < 4200; i++) {
      const px = (i * 53) % 256;
      const py = (i * 97) % 256;
      ctx.fillStyle = i % 2 === 0 ? '#969696' : '#646464';
      ctx.fillRect(px, py, 2, 2);
    }
  } else if (sideLightStyle === 'diagonal_parabolic_ribs') {
    // Horizontal walnut acoustic slat grooves + smooth charcoal-slate mid band
    for (let x = 0; x < 256; x += 8) {
      ctx.fillStyle = '#c4c4c4';
      ctx.fillRect(x, 0, 5, 76);
      ctx.fillRect(x, 180, 5, 76);
      ctx.fillStyle = '#282828';
      ctx.fillRect(x + 5, 0, 3, 76);
      ctx.fillRect(x + 5, 180, 3, 76);
    }
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 76, 256, 104);
    ctx.fillStyle = '#262626';
    ctx.fillRect(0, 74, 256, 4);
    ctx.fillRect(0, 178, 256, 4);
  } else if (sideLightStyle === 'indian_mandap_jali') {
    // Tightly woven matte acoustic tapestry fabric bump
    for (let y = 0; y < 256; y += 3) {
      ctx.fillStyle = y % 6 === 0 ? '#929292' : '#6c6c6c';
      ctx.fillRect(0, y, 256, 1.5);
    }
    for (let x = 0; x < 256; x += 4) {
      ctx.fillStyle = x % 8 === 0 ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.18)';
      ctx.fillRect(x, 0, 1.5, 256);
    }
  } else if (sideLightStyle === 'parametric_obsidian_waves') {
    for (let y = 2; y < 256; y += 4) {
      for (let x = 2; x < 256; x += 4) {
        ctx.fillStyle = (x + y) % 8 === 0 ? '#969696' : '#585858';
        ctx.fillRect(x, y, 1.6, 1.6);
      }
    }
  } else if (env.architectureStyle === 'dolby') {
    for (let x = 0; x < 256; x += 8) {
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(x, 0, 3, 256);
      ctx.fillStyle = '#d0d0d0';
      ctx.fillRect(x + 3, 0, 5, 256);
    }
  } else {
    for (let y = 0; y < 256; y += 4) {
      ctx.fillStyle = y % 8 === 0 ? '#989898' : '#686868';
      ctx.fillRect(0, y, 256, 2);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 2);
  tex.anisotropy = 4;
  return tex;
}

export function createSeatUpholsteryTextures(
  isLeather: boolean,
  isQuilted = false,
  isRedStitched = false,
  styleVariant: 'default' | 'perforated' | 'suede' | 'violet_stitched' | 'orange_stitched' | 'blue_stitched' | 'boucle' | 'charcoal_knit' = 'default',
): SeatUpholsteryTextureSet {
  const mapCanvas = document.createElement('canvas');
  mapCanvas.width = 256;
  mapCanvas.height = 256;
  const mCtx = mapCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 256;
  bumpCanvas.height = 256;
  const bCtx = bumpCanvas.getContext('2d')!;

  // Neutral white-ish base so Three.js instanceColor tints accurately without darkening too much
  mCtx.fillStyle = '#ececec';
  mCtx.fillRect(0, 0, 256, 256);

  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, 256, 256);

  if (isLeather) {
    // Pebbled leather grain + optional diamond quilting or twin-needle seams
    for (let i = 0; i < 4200; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const shade = i % 2 === 0 ? 245 : 225;
      mCtx.fillStyle = `rgb(${shade},${shade},${shade})`;
      mCtx.fillRect(x, y, 2, 2);

      const bShade = i % 2 === 0 ? 148 : 108;
      bCtx.fillStyle = `rgb(${bShade},${bShade},${bShade})`;
      bCtx.fillRect(x, y, 2, 2);
    }

    if (styleVariant === 'perforated') {
      // Crisp perforated leather center panel micro-pores + twin-needle saddle seams
      mCtx.fillStyle = 'rgba(20, 16, 12, 0.34)';
      bCtx.fillStyle = '#323232';
      for (let y = 10; y < 246; y += 10) {
        for (let x = 36; x < 220; x += 10) {
          mCtx.beginPath();
          mCtx.arc(x + ((y / 10) % 2) * 5, y, 1.4, 0, Math.PI * 2);
          mCtx.fill();
          bCtx.beginPath();
          bCtx.arc(x + ((y / 10) % 2) * 5, y, 1.6, 0, Math.PI * 2);
          bCtx.fill();
        }
      }
      [42, 214].forEach((sx) => {
        mCtx.fillStyle = 'rgba(0,0,0,0.22)';
        mCtx.fillRect(sx, 0, 3, 256);
        bCtx.fillStyle = '#282828';
        bCtx.fillRect(sx, 0, 3, 256);
        mCtx.strokeStyle = 'rgba(255, 224, 185, 0.45)';
        mCtx.setLineDash([4, 4]);
        mCtx.lineWidth = 1.4;
        mCtx.beginPath();
        mCtx.moveTo(sx - 4, 0);
        mCtx.lineTo(sx - 4, 256);
        mCtx.moveTo(sx + 6, 0);
        mCtx.lineTo(sx + 6, 256);
        mCtx.stroke();
        mCtx.setLineDash([]);
      });
    } else if (styleVariant === 'suede') {
      // Soft matte suede-and-leather dual-finish microfiber nap + charcoal bolster seams
      for (let i = 0; i < 5200; i++) {
        const px = (i * 83) % 256;
        const py = (i * 149) % 256;
        mCtx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.12)';
        mCtx.fillRect(px, py, 3, 1.5);
        bCtx.fillStyle = i % 2 === 0 ? '#989898' : '#646464';
        bCtx.fillRect(px, py, 3, 1.5);
      }
      [44, 212].forEach((sx) => {
        mCtx.fillStyle = 'rgba(0,0,0,0.28)';
        mCtx.fillRect(sx, 0, 3, 256);
        bCtx.fillStyle = '#2c2c2c';
        bCtx.fillRect(sx, 0, 3, 256);
        mCtx.strokeStyle = 'rgba(110, 231, 183, 0.25)';
        mCtx.setLineDash([4, 4]);
        mCtx.lineWidth = 1.2;
        mCtx.beginPath();
        mCtx.moveTo(sx - 4, 0);
        mCtx.lineTo(sx - 4, 256);
        mCtx.stroke();
        mCtx.setLineDash([]);
      });
    } else if (styleVariant === 'boucle') {
      // Rich textured Italian bouclé & saddle leather micro-grain weave
      for (let i = 0; i < 6500; i++) {
        const px = (i * 71 + (i % 19) * 11) % 256;
        const py = (i * 139 + (i % 13) * 17) % 256;
        mCtx.fillStyle = i % 3 === 0 ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.12)';
        mCtx.fillRect(px, py, 2.6, 2.6);
        bCtx.fillStyle = i % 2 === 0 ? '#b6b6b6' : '#525252';
        bCtx.fillRect(px, py, 2.5, 2.5);
      }
      [46, 210].forEach((sx) => {
        mCtx.fillStyle = 'rgba(0,0,0,0.2)';
        mCtx.fillRect(sx, 0, 2.5, 256);
        bCtx.fillStyle = '#2c2c2c';
        bCtx.fillRect(sx, 0, 2.5, 256);
      });
    } else if (isQuilted) {
      // Luxury diamond-quilted leather puff & subtle stitched channels
      const step = 64;
      for (let y = 0; y < 256; y += step) {
        for (let x = 0; x < 256; x += step) {
          const cx = x + step / 2;
          const cy = y + step / 2;
          const grad = bCtx.createRadialGradient(cx, cy, 4, cx, cy, step * 0.65);
          grad.addColorStop(0, 'rgba(218,218,218,0.42)');
          grad.addColorStop(1, 'rgba(80,80,80,0.0)');
          bCtx.fillStyle = grad;
          bCtx.fillRect(x, y, step, step);
        }
      }
      const drawDiamondGrid = (ctx: CanvasRenderingContext2D, color: string, width: number, dash: number[]) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.setLineDash(dash);
        for (let d = -256; d <= 512; d += step) {
          ctx.beginPath();
          ctx.moveTo(d, 0);
          ctx.lineTo(d + 256, 256);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(d, 256);
          ctx.lineTo(d + 256, 0);
          ctx.stroke();
        }
        ctx.setLineDash([]);
      };
      drawDiamondGrid(bCtx, '#323232', 2.5, []);
      drawDiamondGrid(mCtx, 'rgba(0,0,0,0.18)', 2, []);
      drawDiamondGrid(mCtx, 'rgba(255,255,255,0.22)', 1, [3, 4]);
    } else if (
      isRedStitched ||
      styleVariant === 'violet_stitched' ||
      styleVariant === 'orange_stitched' ||
      styleVariant === 'blue_stitched'
    ) {
      // Heavy-duty leather bolster seams with crisp red, violet, orange, or blue twin-needle stitching
      const stitchHex =
        styleVariant === 'violet_stitched'
          ? '#a855f7'
          : styleVariant === 'orange_stitched'
            ? '#f97316'
            : styleVariant === 'blue_stitched'
              ? '#60a5fa'
              : '#ef4444';
      [48, 128, 208].forEach((sy) => {
        mCtx.fillStyle = 'rgba(0,0,0,0.26)';
        mCtx.fillRect(0, sy, 256, 3);
        bCtx.fillStyle = '#282828';
        bCtx.fillRect(0, sy, 256, 3);

        mCtx.strokeStyle = stitchHex;
        mCtx.setLineDash([5, 4]);
        mCtx.lineWidth = 1.8;
        mCtx.beginPath();
        mCtx.moveTo(0, sy - 4);
        mCtx.lineTo(256, sy - 4);
        mCtx.moveTo(0, sy + 6);
        mCtx.lineTo(256, sy + 6);
        mCtx.stroke();
        mCtx.setLineDash([]);
      });
      [40, 216].forEach((sx) => {
        mCtx.fillStyle = 'rgba(0,0,0,0.24)';
        mCtx.fillRect(sx, 0, 3, 256);
        bCtx.fillStyle = '#282828';
        bCtx.fillRect(sx, 0, 3, 256);

        mCtx.strokeStyle = stitchHex;
        mCtx.setLineDash([5, 4]);
        mCtx.lineWidth = 1.8;
        mCtx.beginPath();
        mCtx.moveTo(sx - 4, 0);
        mCtx.lineTo(sx - 4, 256);
        mCtx.moveTo(sx + 6, 0);
        mCtx.lineTo(sx + 6, 256);
        mCtx.stroke();
        mCtx.setLineDash([]);
      });
    } else {
      // Twin-needle upholstery seams
      [64, 192].forEach((sy) => {
        mCtx.fillStyle = 'rgba(0,0,0,0.18)';
        mCtx.fillRect(0, sy, 256, 3);
        bCtx.fillStyle = '#303030';
        bCtx.fillRect(0, sy, 256, 3);

        mCtx.strokeStyle = 'rgba(255,255,255,0.22)';
        mCtx.setLineDash([4, 4]);
        mCtx.lineWidth = 1;
        mCtx.beginPath();
        mCtx.moveTo(0, sy - 3);
        mCtx.lineTo(256, sy - 3);
        mCtx.moveTo(0, sy + 5);
        mCtx.lineTo(256, sy + 5);
        mCtx.stroke();
        mCtx.setLineDash([]);
      });
    }
  } else if (styleVariant === 'charcoal_knit') {
    // Fine matte-charcoal technical knit upholstery with precision twin-ribbed diagonal interlock
    for (let y = 0; y < 256; y += 4) {
      for (let x = 0; x < 256; x += 4) {
        const rib = ((x + y) / 4) % 2 === 0;
        mCtx.fillStyle = rib ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.12)';
        mCtx.fillRect(x, y, 3, 3);
        bCtx.fillStyle = rib ? '#9c9c9c' : '#666666';
        bCtx.fillRect(x, y, 3, 3);
      }
    }
    [44, 212].forEach((sx) => {
      mCtx.fillStyle = 'rgba(0,0,0,0.22)';
      mCtx.fillRect(sx, 0, 2.5, 256);
      bCtx.fillStyle = '#303030';
      bCtx.fillRect(sx, 0, 2.5, 256);
    });
  } else {
    // Plush cinema velvet / acoustic fabric micro-rib
    for (let y = 0; y < 256; y += 3) {
      mCtx.fillStyle = y % 6 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';
      mCtx.fillRect(0, y, 256, 2);
      bCtx.fillStyle = y % 6 === 0 ? '#949494' : '#6c6c6c';
      bCtx.fillRect(0, y, 256, 2);
    }
    for (let i = 0; i < 3000; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      mCtx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)';
      mCtx.fillRect(x, y, 2, 2);
    }
  }

  const map = new THREE.CanvasTexture(mapCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2, 2);
  map.anisotropy = 4;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(2, 2);
  bumpMap.anisotropy = 4;

  return {
    map,
    bumpMap,
    dispose: () => {
      map.dispose();
      bumpMap.dispose();
    },
  };
}

export function createSconceWashTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 128, 256);

  // Dual upward and downward architectural wall sconce light cones
  const upGrad = ctx.createRadialGradient(64, 128, 2, 64, 52, 92);
  upGrad.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
  upGrad.addColorStop(0.4, 'rgba(255, 255, 255, 0.35)');
  upGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = upGrad;
  ctx.fillRect(0, 0, 128, 128);

  const downGrad = ctx.createRadialGradient(64, 128, 2, 64, 204, 92);
  downGrad.addColorStop(0, 'rgba(255, 255, 255, 0.75)');
  downGrad.addColorStop(0.4, 'rgba(255, 255, 255, 0.3)');
  downGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = downGrad;
  ctx.fillRect(0, 128, 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createExitSignTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#03120a';
  ctx.fillRect(0, 0, 256, 96);
  ctx.strokeStyle = '#059669';
  ctx.lineWidth = 5;
  ctx.strokeRect(4, 4, 248, 88);

  ctx.fillStyle = '#10b981';
  ctx.font = 'bold 44px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('EXIT', 128, 50);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function drawTrackedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  centerY: number,
  trackingPx: number,
): number {
  const chars = Array.from(text);
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const totalWidth =
    widths.reduce((acc, w) => acc + w, 0) + Math.max(0, chars.length - 1) * trackingPx;
  let cursorX = centerX - totalWidth / 2;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  chars.forEach((ch, idx) => {
    ctx.fillText(ch, cursorX, centerY);
    cursorX += widths[idx] + trackingPx;
  });
  return totalWidth;
}

export function createCarbonFiberTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#12151b';
  ctx.fillRect(0, 0, 256, 256);

  // Diagonal 2x2 twill carbon weave + subtle brushed directional grain
  const cell = 8;
  for (let y = 0; y < 256; y += cell) {
    for (let x = 0; x < 256; x += cell) {
      const diag = ((x / cell) + (y / cell)) % 2 === 0;
      const grad = ctx.createLinearGradient(x, y, x + cell, y + cell);
      if (diag) {
        grad.addColorStop(0, '#1e242e');
        grad.addColorStop(0.5, '#2b323f');
        grad.addColorStop(1, '#151921');
      } else {
        grad.addColorStop(0, '#0d1016');
        grad.addColorStop(0.5, '#191e27');
        grad.addColorStop(1, '#0b0d12');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, cell, cell);
    }
  }
  ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
  for (let y = 0; y < 256; y += 3) {
    ctx.fillRect(0, y, 256, 1);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 3);
  tex.anisotropy = 8;
  return tex;
}

export function createAmberVioletGradientTexture(reverse = false): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 512, 0);
  if (reverse) {
    grad.addColorStop(0, '#6d28d9');
    grad.addColorStop(0.28, '#8b35a3');
    grad.addColorStop(0.55, '#d96b27');
    grad.addColorStop(0.82, '#ff981a');
    grad.addColorStop(1, '#ffb347');
  } else {
    grad.addColorStop(0, '#ffb347');
    grad.addColorStop(0.22, '#ff8f1c');
    grad.addColorStop(0.48, '#c24d66');
    grad.addColorStop(0.75, '#7c3aed');
    grad.addColorStop(1, '#5b21b6');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 32);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 4;
  return tex;
}

export function createAmberCoveWashTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  // y=256 maps to UV v=0 (bottom recessed LED crease); y=0 maps to UV v=1 (top outer lip)
  const grad = ctx.createLinearGradient(0, 256, 0, 0);
  grad.addColorStop(0, '#ffd98a');
  grad.addColorStop(0.14, '#ff9c1e');
  grad.addColorStop(0.42, '#b8560e');
  grad.addColorStop(0.75, '#421d08');
  grad.addColorStop(1, '#181416');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 4;
  return tex;
}

export function createVioletCoveWashTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 256, 0, 0);
  grad.addColorStop(0, '#ebd8ff');
  grad.addColorStop(0.18, '#a470ff');
  grad.addColorStop(0.46, '#572ca3');
  grad.addColorStop(0.78, '#211838');
  grad.addColorStop(1, '#161820');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 4;
  return tex;
}

export function createMarbleTrayTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#17191f';
  ctx.fillRect(0, 0, 256, 256);

  // Subtle dark stone mottling
  for (let i = 0; i < 1800; i++) {
    const x = (i * 73) % 256;
    const y = (i * 131) % 256;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.2)';
    ctx.fillRect(x, y, 4, 3);
  }

  // Fine honed golden-amber & warm-ivory Nero Marquina mineral veins
  const veins = [
    { x0: 0, y0: 42, cx: 118, cy: 96, x1: 256, y1: 158, color: 'rgba(235, 186, 120, 0.34)', w: 1.5 },
    { x0: 18, y0: 256, cx: 144, cy: 140, x1: 242, y1: 0, color: 'rgba(244, 240, 232, 0.24)', w: 1.1 },
    { x0: 0, y0: 190, cx: 96, cy: 210, x1: 256, y1: 112, color: 'rgba(218, 142, 62, 0.28)', w: 1.2 },
    { x0: 84, y0: 0, cx: 168, cy: 128, x1: 210, y1: 256, color: 'rgba(255, 250, 240, 0.18)', w: 0.9 },
  ];
  veins.forEach((v) => {
    ctx.strokeStyle = v.color;
    ctx.lineWidth = v.w;
    ctx.beginPath();
    ctx.moveTo(v.x0, v.y0);
    ctx.quadraticCurveTo(v.cx, v.cy, v.x1, v.y1);
    ctx.stroke();
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

export function createStandbyScreenTexture(
  _theaterName: string,
  architectureStyle?: EnvironmentProfile['architectureStyle'],
  sideLightStyle?: SideLightStyle,
): THREE.CanvasTexture {
  const W = 2048;
  const H = 1024;
  const cx = W / 2;
  const cy = H / 2;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  const drawStandbyArtwork = () => {
    ctx.clearRect(0, 0, W, H);

    if (sideLightStyle === 'screenx_silver_baffles') {
      // Clean floating wall-to-wall matte white acoustically transparent primary canvas (no logos, text, or frames)
      const whiteGrad = ctx.createRadialGradient(cx, cy, 80, cx, cy, 1280);
      whiteGrad.addColorStop(0, '#eef1f6');
      whiteGrad.addColorStop(0.65, '#e2e6ee');
      whiteGrad.addColorStop(1, '#cfd5e0');
      ctx.fillStyle = whiteGrad;
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.045)';
      for (let y = 0; y < H; y += 8) {
        for (let x = 0; x < W; x += 8) {
          ctx.fillRect(x, y, 2, 2);
        }
      }
      return;
    }

    if (architectureStyle === 'screenx') {
      // Rich luminous obsidian-slate 270-degree ScreenX canvas calibrated for pre-show brightness (0.34x)
      const slateGrad = ctx.createLinearGradient(0, 0, W, 0);
      slateGrad.addColorStop(0, '#1e2c40');
      slateGrad.addColorStop(0.22, '#253750');
      slateGrad.addColorStop(0.5, '#2d4360');
      slateGrad.addColorStop(0.78, '#253750');
      slateGrad.addColorStop(1, '#1e2c40');
      ctx.fillStyle = slateGrad;
      ctx.fillRect(0, 0, W, H);

      // Vertical studio vignette keeping center & horizon bright while grounding top/bottom borders
      const vGrad = ctx.createLinearGradient(0, 0, 0, H);
      vGrad.addColorStop(0, 'rgba(6, 10, 18, 0.72)');
      vGrad.addColorStop(0.22, 'rgba(8, 14, 24, 0.14)');
      vGrad.addColorStop(0.5, 'rgba(8, 14, 24, 0)');
      vGrad.addColorStop(0.78, 'rgba(8, 14, 24, 0.14)');
      vGrad.addColorStop(1, 'rgba(6, 10, 18, 0.78)');
      ctx.fillStyle = vGrad;
      ctx.fillRect(0, 0, W, H);

      // Subtle futuristic cyberpunk architectural silhouettes along lower horizon (fading gracefully toward outer edges)
      const horizonY = cy + 68;
      const towerCount = 26;
      for (let i = 0; i < towerCount; i++) {
        const tx = (i / towerCount) * W;
        const tw = 34 + ((i * 29) % 44);
        const th = 90 + ((i * 67) % 195);
        const distFromCenter = Math.abs(tx + tw * 0.5 - cx) / cx;
        const edgeFade = 1 - Math.pow(distFromCenter, 1.8) * 0.65;
        ctx.fillStyle = `rgba(11, 18, 30, ${0.42 * edgeFade})`;
        ctx.fillRect(tx, horizonY - th * 0.45, tw, th + 260);

        // Subtle cyan vertical architectural trim & window clusters
        if (i % 2 === 0) {
          ctx.fillStyle = `rgba(34, 211, 238, ${0.22 * edgeFade})`;
          ctx.fillRect(tx + tw - 3, horizonY - th * 0.42, 2, th * 0.7);
        }
        ctx.fillStyle = `rgba(165, 243, 252, ${0.18 * edgeFade})`;
        for (let wy = horizonY - th * 0.36; wy < horizonY + 120; wy += 16) {
          for (let wx = tx + 6; wx < tx + tw - 8; wx += 11) {
            if (((wx + wy + i) % 5) < 2) {
              ctx.fillRect(wx, wy, 4, 5);
            }
          }
        }
      }

      // Fine micro-perforated acoustic screen weave
      ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
      for (let y = 0; y < H; y += 8) {
        for (let x = 0; x < W; x += 8) {
          ctx.fillRect(x, y, 2, 2);
        }
      }

      // Continuous panoramic cyan horizon atmospheric glow reaching full strength to left & right corners
      const horizonGlow = ctx.createLinearGradient(0, cy - 175, 0, cy + 175);
      horizonGlow.addColorStop(0, 'rgba(6, 182, 212, 0)');
      horizonGlow.addColorStop(0.4, 'rgba(6, 182, 212, 0.24)');
      horizonGlow.addColorStop(0.5, 'rgba(34, 211, 238, 0.52)');
      horizonGlow.addColorStop(0.6, 'rgba(6, 182, 212, 0.24)');
      horizonGlow.addColorStop(1, 'rgba(6, 182, 212, 0)');
      ctx.fillStyle = horizonGlow;
      ctx.fillRect(0, cy - 175, W, 350);

      // Crisp cyan optical horizon laser beam extending seamlessly edge-to-edge into side screens
      const beamGrad = ctx.createLinearGradient(0, cy - 4, 0, cy + 4);
      beamGrad.addColorStop(0, 'rgba(103, 232, 249, 0)');
      beamGrad.addColorStop(0.5, 'rgba(165, 243, 252, 0.85)');
      beamGrad.addColorStop(1, 'rgba(103, 232, 249, 0)');
      ctx.fillStyle = beamGrad;
      ctx.fillRect(0, cy - 4, W, 8);

      // Continuous outer architectural framing laser hairlines
      ctx.strokeStyle = 'rgba(56, 224, 248, 0.34)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, 118);
      ctx.lineTo(W, 118);
      ctx.moveTo(0, H - 118);
      ctx.lineTo(W, H - 118);
      ctx.stroke();

      const coreGlow = ctx.createRadialGradient(cx, cy, 24, cx, cy, 620);
      coreGlow.addColorStop(0, 'rgba(34, 211, 238, 0.38)');
      coreGlow.addColorStop(0.5, 'rgba(6, 182, 212, 0.14)');
      coreGlow.addColorStop(1, 'rgba(6, 182, 212, 0)');
      ctx.fillStyle = coreGlow;
      ctx.fillRect(cx - 640, cy - 320, 1280, 640);

      // Minimalist ScreenX 270° panoramic typography
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '600 32px "Montserrat", "Plus Jakarta Sans", sans-serif';
      drawTrackedText(ctx, '270° MULTI-PROJECTION', cx, cy - 92, 16);

      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(34, 211, 238, 0.72)';
      ctx.shadowBlur = 32;
      ctx.font = '800 108px "Montserrat", "Plus Jakarta Sans", sans-serif';
      drawTrackedText(ctx, 'SCREENX', cx, cy + 8, 28);
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#67e8f9';
      ctx.font = '600 28px "Montserrat", "Plus Jakarta Sans", sans-serif';
      drawTrackedText(ctx, 'OBSIDIAN PANORAMA', cx, cy + 98, 14);
      return;
    }

    // Deep obsidian-cinema radial stage vignette with warm golden atmospheric center bloom
    const bgGrad = ctx.createRadialGradient(cx, cy - 10, 30, cx, cy, 1080);
    bgGrad.addColorStop(0, '#2a2013');
    bgGrad.addColorStop(0.28, '#141114');
    bgGrad.addColorStop(0.62, '#090a0e');
    bgGrad.addColorStop(1, '#020204');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Subtle horizontal anamorphic spotlight flare behind GSR centerpiece
    const flareGrad = ctx.createRadialGradient(cx, cy - 12, 8, cx, cy - 12, 460);
    flareGrad.addColorStop(0, 'rgba(245, 200, 92, 0.22)');
    flareGrad.addColorStop(0.45, 'rgba(212, 175, 55, 0.08)');
    flareGrad.addColorStop(1, 'rgba(212, 175, 55, 0)');
    ctx.fillStyle = flareGrad;
    ctx.fillRect(cx - 500, cy - 280, 1000, 560);

    const streakGrad = ctx.createLinearGradient(cx - 520, cy - 12, cx + 520, cy - 12);
    streakGrad.addColorStop(0, 'rgba(255, 224, 140, 0)');
    streakGrad.addColorStop(0.32, 'rgba(245, 205, 110, 0.09)');
    streakGrad.addColorStop(0.5, 'rgba(255, 240, 190, 0.24)');
    streakGrad.addColorStop(0.68, 'rgba(245, 205, 110, 0.09)');
    streakGrad.addColorStop(1, 'rgba(255, 224, 140, 0)');
    ctx.fillStyle = streakGrad;
    ctx.fillRect(cx - 520, cy - 16, 1040, 8);

    // Theatrical gold double proscenium border
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.42)';
    ctx.lineWidth = 3;
    ctx.strokeRect(72, 72, W - 144, H - 144);
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.16)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(92, 92, W - 184, H - 184);

    // Safe horizontal span ~880px centered so mobile portrait & desktop widescreen both see 100% of text
    const safeMaxWidth = 880;

    // 1. Top Line: "TIN FACTORY" in wide-tracked geometric cinema sans
    const eyebrowText = 'TIN FACTORY';
    ctx.font = '600 38px "Montserrat", "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#E6DEC8';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = 12;
    const eyebrowW = drawTrackedText(ctx, eyebrowText, cx, cy - 162, 18);
    ctx.shadowBlur = 0;

    // Subtle flanking hairlines beside eyebrow
    const ruleSpan = 104;
    const gapFromText = 28;
    const leftRuleEnd = cx - eyebrowW / 2 - gapFromText;
    const rightRuleStart = cx + eyebrowW / 2 + gapFromText;
    const leftRuleGrad = ctx.createLinearGradient(leftRuleEnd - ruleSpan, cy - 162, leftRuleEnd, cy - 162);
    leftRuleGrad.addColorStop(0, 'rgba(212, 175, 55, 0)');
    leftRuleGrad.addColorStop(1, 'rgba(212, 175, 55, 0.65)');
    ctx.strokeStyle = leftRuleGrad;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(leftRuleEnd - ruleSpan, cy - 162);
    ctx.lineTo(leftRuleEnd, cy - 162);
    ctx.stroke();

    const rightRuleGrad = ctx.createLinearGradient(rightRuleStart, cy - 162, rightRuleStart + ruleSpan, cy - 162);
    rightRuleGrad.addColorStop(0, 'rgba(212, 175, 55, 0.65)');
    rightRuleGrad.addColorStop(1, 'rgba(212, 175, 55, 0)');
    ctx.strokeStyle = rightRuleGrad;
    ctx.beginPath();
    ctx.moveTo(rightRuleStart, cy - 162);
    ctx.lineTo(rightRuleStart + ruleSpan, cy - 162);
    ctx.stroke();

    // 2. Hero Centerpiece Highlight: "GSR" in monumental Cinzel Black sculpted gold
    const heroText = 'GSR';
    ctx.font = '900 188px "Cinzel", Georgia, serif';
    const heroTracking = 32;

    // Deep shadow underlayer
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowColor = 'rgba(245, 196, 81, 0.56)';
    ctx.shadowBlur = 36;
    ctx.shadowOffsetY = 6;
    drawTrackedText(ctx, heroText, cx, cy - 12, heroTracking);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Multi-stop vertical metallic gold gradient fill
    const goldGrad = ctx.createLinearGradient(0, cy - 104, 0, cy + 76);
    goldGrad.addColorStop(0, '#FFF8DF');
    goldGrad.addColorStop(0.28, '#F6D26C');
    goldGrad.addColorStop(0.54, '#D4AF37');
    goldGrad.addColorStop(0.78, '#9E731A');
    goldGrad.addColorStop(1, '#F8DB82');
    ctx.fillStyle = goldGrad;
    drawTrackedText(ctx, heroText, cx, cy - 12, heroTracking);

    // Subtle bright rim stroke around GSR glyphs
    ctx.strokeStyle = 'rgba(255, 244, 200, 0.52)';
    ctx.lineWidth = 2.2;
    const gsrChars = Array.from(heroText);
    const gsrWidths = gsrChars.map((ch) => ctx.measureText(ch).width);
    const gsrTotalW =
      gsrWidths.reduce((a, b) => a + b, 0) + (gsrChars.length - 1) * heroTracking;
    let gx = cx - gsrTotalW / 2;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    gsrChars.forEach((ch, idx) => {
      ctx.strokeText(ch, gx, cy - 12);
      gx += gsrWidths[idx] + heroTracking;
    });

    // 3. Ornamental tapered gold divider + central diamond below GSR
    const divY = cy + 106;
    const divGrad = ctx.createLinearGradient(cx - 320, divY, cx + 320, divY);
    divGrad.addColorStop(0, 'rgba(212, 175, 55, 0)');
    divGrad.addColorStop(0.35, 'rgba(212, 175, 55, 0.55)');
    divGrad.addColorStop(0.5, 'rgba(255, 236, 170, 0.92)');
    divGrad.addColorStop(0.65, 'rgba(212, 175, 55, 0.55)');
    divGrad.addColorStop(1, 'rgba(212, 175, 55, 0)');
    ctx.strokeStyle = divGrad;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 320, divY);
    ctx.lineTo(cx + 320, divY);
    ctx.stroke();

    ctx.save();
    ctx.translate(cx, divY);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#F7D97E';
    ctx.fillRect(-5.5, -5.5, 11, 11);
    ctx.restore();

    // 4. Bottom Subtitle: "ra neeee akkkkkkkkkaaaaa" in wide-tracked Cinzel / Montserrat
    const subText = 'ra neeee akkkkkkkkkaaaaa';
    let subSize = 40;
    const subTracking = 6;
    while (subSize > 22) {
      ctx.font = `600 ${subSize}px "Cinzel", "Montserrat", serif`;
      const subChars = Array.from(subText);
      const estW =
        subChars.reduce((acc, ch) => acc + ctx.measureText(ch).width, 0) +
        (subChars.length - 1) * subTracking;
      if (estW <= safeMaxWidth) break;
      subSize -= 2;
    }

    ctx.fillStyle = '#F3ECD8';
    ctx.shadowColor = 'rgba(212, 175, 55, 0.3)';
    ctx.shadowBlur = 14;
    drawTrackedText(ctx, subText, cx, cy + 172, subTracking);
    ctx.shadowBlur = 0;
  };

  drawStandbyArtwork();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;

  if (typeof document !== 'undefined' && document.fonts?.ready) {
    document.fonts.ready.then(() => {
      drawStandbyArtwork();
      tex.needsUpdate = true;
    });
  }

  return tex;
}

export function createScreenXSideStandbyTexture(
  side: -1 | 1 = 1,
  isSilverMatte = false,
): THREE.CanvasTexture {
  const W = 2048;
  const H = 512;
  const cy = H * 0.5;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  const drawSidePanorama = () => {
    ctx.clearRect(0, 0, W, H);

    if (isSilverMatte) {
      // Smooth continuous micro-perforated matte silver-grey acoustic screen fabric with zero seams or fixtures
      const silverGrad = ctx.createLinearGradient(0, 0, W, 0);
      silverGrad.addColorStop(0, '#9ba3b0');
      silverGrad.addColorStop(0.35, '#8f97a5');
      silverGrad.addColorStop(1, '#848c9a');
      ctx.fillStyle = silverGrad;
      ctx.fillRect(0, 0, W, H);

      const vShade = ctx.createLinearGradient(0, 0, 0, H);
      vShade.addColorStop(0, 'rgba(20, 24, 34, 0.14)');
      vShade.addColorStop(0.15, 'rgba(20, 24, 34, 0.03)');
      vShade.addColorStop(0.5, 'rgba(255, 255, 255, 0.02)');
      vShade.addColorStop(0.85, 'rgba(20, 24, 34, 0.03)');
      vShade.addColorStop(1, 'rgba(20, 24, 34, 0.16)');
      ctx.fillStyle = vShade;
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.055)';
      for (let y = 0; y < H; y += 6) {
        for (let x = 0; x < W; x += 6) {
          ctx.fillRect(x, y, 1.5, 1.5);
        }
      }
      return;
    }

    // Seamless edge match at x=0 (#1e2c40) tapering smoothly into deep obsidian-slate toward rear (x=W)
    const bgGrad = ctx.createLinearGradient(0, 0, W, 0);
    bgGrad.addColorStop(0, '#1e2c40');
    bgGrad.addColorStop(0.28, '#1a2638');
    bgGrad.addColorStop(0.65, '#141d2c');
    bgGrad.addColorStop(1, '#0e1420');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Matching vertical studio vignette (exact proportion to main standby 1024px canvas)
    const vGrad = ctx.createLinearGradient(0, 0, 0, H);
    vGrad.addColorStop(0, 'rgba(6, 10, 18, 0.72)');
    vGrad.addColorStop(0.22, 'rgba(8, 14, 24, 0.14)');
    vGrad.addColorStop(0.5, 'rgba(8, 14, 24, 0)');
    vGrad.addColorStop(0.78, 'rgba(8, 14, 24, 0.14)');
    vGrad.addColorStop(1, 'rgba(6, 10, 18, 0.78)');
    ctx.fillStyle = vGrad;
    ctx.fillRect(0, 0, W, H);

    // Continuous cyberpunk architectural perspective vista extending seamlessly from curved corner
    const horizonY = cy + 34;
    const buildingCount = 34;
    for (let i = 0; i < buildingCount; i++) {
      const t = i / buildingCount;
      const bx = t * W;
      const bw = 28 + ((i * 23) % 44);
      const bh = 48 + ((i * 41) % 135);
      const fade = 1 - Math.pow(t, 1.35) * 0.72;
      // Leave clean margin at x=0..30 so front corner edge match stays 100% pure gradient
      const cornerRamp = Math.min(1, bx / 48);
      const alpha = 0.44 * fade * cornerRamp;

      ctx.fillStyle = `rgba(10, 16, 28, ${alpha})`;
      ctx.fillRect(bx, horizonY - bh * 0.45, bw, bh + 150);

      if (i % 3 === 1) {
        ctx.fillStyle = `rgba(34, 211, 238, ${0.26 * fade * cornerRamp})`;
        ctx.fillRect(bx + 2, horizonY - bh * 0.42, 2, bh * 0.68);
      }

      ctx.fillStyle = `rgba(165, 243, 252, ${0.2 * fade * cornerRamp})`;
      for (let wy = horizonY - bh * 0.35; wy < horizonY + 70; wy += 10) {
        for (let wx = bx + 5; wx < bx + bw - 6; wx += 8) {
          if (((wx + wy + i) % 5) < 2) {
            ctx.fillRect(wx, wy, 3, 3);
          }
        }
      }
    }

    // Continuous panoramic cyan horizon glow fading gently toward rear
    const horizonGlow = ctx.createLinearGradient(0, cy - 88, 0, cy + 88);
    horizonGlow.addColorStop(0, 'rgba(6, 182, 212, 0)');
    horizonGlow.addColorStop(0.4, 'rgba(6, 182, 212, 0.24)');
    horizonGlow.addColorStop(0.5, 'rgba(34, 211, 238, 0.52)');
    horizonGlow.addColorStop(0.6, 'rgba(6, 182, 212, 0.24)');
    horizonGlow.addColorStop(1, 'rgba(6, 182, 212, 0)');
    ctx.fillStyle = horizonGlow;
    ctx.fillRect(0, cy - 88, W, 176);

    // Mask horizon beam opacity smoothly toward far rear
    const beamHGrad = ctx.createLinearGradient(0, 0, W, 0);
    beamHGrad.addColorStop(0, 'rgba(165, 243, 252, 0.85)');
    beamHGrad.addColorStop(0.45, 'rgba(103, 232, 249, 0.58)');
    beamHGrad.addColorStop(0.85, 'rgba(34, 211, 238, 0.22)');
    beamHGrad.addColorStop(1, 'rgba(34, 211, 238, 0.08)');
    ctx.fillStyle = beamHGrad;
    ctx.fillRect(0, cy - 2, W, 4);

    // Continuous top & bottom architectural framing hairlines aligned at 118/1024 & 906/1024
    const topY = (118 / 1024) * H;
    const botY = H - topY;
    const hairlineGrad = ctx.createLinearGradient(0, 0, W, 0);
    hairlineGrad.addColorStop(0, 'rgba(56, 224, 248, 0.34)');
    hairlineGrad.addColorStop(0.65, 'rgba(56, 224, 248, 0.18)');
    hairlineGrad.addColorStop(1, 'rgba(56, 224, 248, 0.06)');
    ctx.strokeStyle = hairlineGrad;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, topY);
    ctx.lineTo(W, topY);
    ctx.moveTo(0, botY);
    ctx.lineTo(W, botY);
    ctx.stroke();

    // Crisp subtle SCREENX wing emblem oriented cleanly left-to-right from inside the auditorium
    ctx.save();
    if (side === -1) {
      ctx.translate(640, 92);
      ctx.scale(-1, 1);
    } else {
      ctx.translate(440, 92);
    }
    ctx.fillStyle = 'rgba(226, 232, 240, 0.78)';
    ctx.shadowColor = 'rgba(34, 211, 238, 0.55)';
    ctx.shadowBlur = 16;
    ctx.font = '800 34px "Montserrat", "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('S C R E E N X', 0, 0);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(103, 232, 249, 0.6)';
    ctx.font = '600 13px "Montserrat", "Plus Jakarta Sans", sans-serif';
    ctx.fillText('270° PANORAMIC WING', 2, 30);
    ctx.restore();
  };

  drawSidePanorama();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;

  if (typeof document !== 'undefined' && document.fonts?.ready) {
    document.fonts.ready.then(() => {
      drawSidePanorama();
      tex.needsUpdate = true;
    });
  }

  return tex;
}

export function createSpeakerGrilleTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#141519';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#050507';
  for (let y = 4; y < 128; y += 8) {
    for (let x = 4; x < 128; x += 8) {
      ctx.beginPath();
      ctx.arc(x, y, 2.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 6);
  return tex;
}

export function createRowMarkerTexture(rowLabel: string, accentHex = '#38bdf8'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#06080c';
  ctx.fillRect(0, 0, 96, 96);

  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, 76, 76);

  ctx.fillStyle = accentHex;
  ctx.font = 'bold 46px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(rowLabel, 48, 50);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createCurtainTexture(baseHex: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);

  for (let x = 0; x < 256; x += 24) {
    const grad = ctx.createLinearGradient(x, 0, x + 24, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0.68)');
    grad.addColorStop(0.45, 'rgba(255,255,255,0.14)');
    grad.addColorStop(0.8, 'rgba(0,0,0,0.42)');
    grad.addColorStop(1, 'rgba(0,0,0,0.72)');
    ctx.fillStyle = grad;
    ctx.fillRect(x, 0, 24, 256);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 1);
  tex.anisotropy = 4;
  return tex;
}

export function createPosterLightboxTexture(theaterName: string, accentHex: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 384;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, 384);
  grad.addColorStop(0, '#0a0e1a');
  grad.addColorStop(0.55, '#1b1410');
  grad.addColorStop(1, '#070709');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 384);

  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(128, 155, 62, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 2;
  ctx.strokeRect(14, 14, 228, 356);

  ctx.fillStyle = '#f4f1ea';
  ctx.font = 'bold 20px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('AURELIA PREMIERE', 128, 290);

  ctx.fillStyle = accentHex;
  ctx.font = '600 13px sans-serif';
  ctx.fillText(theaterName.toUpperCase().slice(0, 20), 128, 322);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createEntranceSignTexture(accentHex: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 72;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#070a10';
  ctx.fillRect(0, 0, 256, 72);
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, 248, 64);

  ctx.fillStyle = '#e5f0ff';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('AUDITORIUM', 128, 37);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createAuditoriumTextures(
  env: EnvironmentProfile,
  theaterName: string,
  accentHex = '#38bdf8',
  sideLightStyle?: SideLightStyle,
): AuditoriumTextureSet {
  const carpetMap = createCarpetTexture(env, sideLightStyle);
  const carpetBumpMap = createCarpetBumpTexture(sideLightStyle);
  const wallMap = createAcousticWallTexture(env, sideLightStyle);
  const wallBumpMap = createAcousticWallBumpTexture(env, sideLightStyle);
  const exitSignMap = createExitSignTexture();
  const standbyScreenMap = createStandbyScreenTexture(
    theaterName,
    env.architectureStyle,
    sideLightStyle,
  );
  const speakerGrilleMap = createSpeakerGrilleTexture();
  const curtainBase =
    env.curtainColor ??
    (env.architectureStyle === 'classic'
      ? '#4b0d17'
      : env.architectureStyle === 'imax'
        ? '#0f2347'
        : env.architectureStyle === 'ice'
          ? '#0A0A0D'
          : env.architectureStyle === 'private'
            ? '#2a1d17'
            : '#111420');
  const curtainMap = createCurtainTexture(curtainBase);
  const posterMap = createPosterLightboxTexture(theaterName, accentHex);
  const entranceSignMap = createEntranceSignTexture(accentHex);
  const sconceWashMap = createSconceWashTexture();

  return {
    carpetMap,
    carpetBumpMap,
    wallMap,
    wallBumpMap,
    exitSignMap,
    standbyScreenMap,
    speakerGrilleMap,
    curtainMap,
    posterMap,
    entranceSignMap,
    sconceWashMap,
    dispose: () => {
      carpetMap.dispose();
      carpetBumpMap.dispose();
      wallMap.dispose();
      wallBumpMap.dispose();
      exitSignMap.dispose();
      standbyScreenMap.dispose();
      speakerGrilleMap.dispose();
      curtainMap.dispose();
      posterMap.dispose();
      entranceSignMap.dispose();
      sconceWashMap.dispose();
    },
  };
}

export interface JaliLatticeTextureSet {
  map: THREE.CanvasTexture;
  alphaMap: THREE.CanvasTexture;
  dispose: () => void;
}

/**
 * Generates seamless intricate non-reflective matte antiqued-gold Indian Mughal Jali latticework
 * with crisp octagonal-star & geometric cusp cutouts via paired color map + alpha mask.
 */
export function createJaliLatticeTexture(): JaliLatticeTextureSet {
  const size = 512;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const cCtx = colorCanvas.getContext('2d')!;

  const alphaCanvas = document.createElement('canvas');
  alphaCanvas.width = size;
  alphaCanvas.height = size;
  const aCtx = alphaCanvas.getContext('2d')!;

  // Matte antiqued sandstone-gold tone (non-reflective)
  const goldGrad = cCtx.createLinearGradient(0, 0, size, size);
  goldGrad.addColorStop(0, '#9a783d');
  goldGrad.addColorStop(0.5, '#866631');
  goldGrad.addColorStop(1, '#96743a');
  cCtx.fillStyle = goldGrad;
  cCtx.fillRect(0, 0, size, size);

  // Subtle carved stone-gold micro-grain
  for (let i = 0; i < 4200; i++) {
    const px = (i * 79) % size;
    const py = (i * 137) % size;
    cCtx.fillStyle = i % 2 === 0 ? 'rgba(255, 232, 185, 0.06)' : 'rgba(28, 18, 8, 0.08)';
    cCtx.fillRect(px, py, 2, 2);
  }

  // Opaque lattice background (white = solid stone/gold rib, black = pierced cutout)
  aCtx.fillStyle = '#ffffff';
  aCtx.fillRect(0, 0, size, size);

  const cell = 128;
  const drawOctaStarCutout = (cx: number, cy: number, rOuter: number, rInner: number) => {
    aCtx.fillStyle = '#000000';
    aCtx.beginPath();
    const pts = 16;
    for (let i = 0; i < pts; i++) {
      const a = (i * Math.PI * 2) / pts;
      const rad = i % 2 === 0 ? rOuter : rInner;
      const px = cx + Math.cos(a) * rad;
      const py = cy + Math.sin(a) * rad;
      if (i === 0) aCtx.moveTo(px, py);
      else aCtx.lineTo(px, py);
    }
    aCtx.closePath();
    aCtx.fill();

    // Inner stone filigree ring preserved inside each star medallion
    aCtx.fillStyle = '#ffffff';
    aCtx.beginPath();
    aCtx.arc(cx, cy, rInner * 0.42, 0, Math.PI * 2);
    aCtx.fill();

    aCtx.fillStyle = '#000000';
    aCtx.beginPath();
    aCtx.arc(cx, cy, rInner * 0.21, 0, Math.PI * 2);
    aCtx.fill();

    // Subtle carved edge shadow on the color canvas around cutouts
    cCtx.strokeStyle = 'rgba(42, 28, 14, 0.45)';
    cCtx.lineWidth = 3;
    cCtx.beginPath();
    for (let i = 0; i < pts; i++) {
      const a = (i * Math.PI * 2) / pts;
      const rad = i % 2 === 0 ? rOuter : rInner;
      const px = cx + Math.cos(a) * rad;
      const py = cy + Math.sin(a) * rad;
      if (i === 0) cCtx.moveTo(px, py);
      else cCtx.lineTo(px, py);
    }
    cCtx.closePath();
    cCtx.stroke();
  };

  for (let y = cell * 0.5; y < size; y += cell) {
    for (let x = cell * 0.5; x < size; x += cell) {
      drawOctaStarCutout(x, y, 44, 28);
    }
  }
  // Corner/edge diamond-petal cutouts bridging adjacent tiles
  for (let y = 0; y <= size; y += cell) {
    for (let x = 0; x <= size; x += cell) {
      aCtx.fillStyle = '#000000';
      aCtx.beginPath();
      aCtx.moveTo(x, y - 22);
      aCtx.lineTo(x + 22, y);
      aCtx.lineTo(x, y + 22);
      aCtx.lineTo(x - 22, y);
      aCtx.closePath();
      aCtx.fill();
    }
  }

  // Outer carved molding frame lines
  cCtx.strokeStyle = '#6c5124';
  cCtx.lineWidth = 6;
  cCtx.strokeRect(3, 3, size - 6, size - 6);

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 8;

  const alphaMap = new THREE.CanvasTexture(alphaCanvas);
  alphaMap.wrapS = THREE.RepeatWrapping;
  alphaMap.wrapT = THREE.RepeatWrapping;
  alphaMap.anisotropy = 8;

  return {
    map,
    alphaMap,
    dispose: () => {
      map.dispose();
      alphaMap.dispose();
    },
  };
}

/**
 * Smooth horizontal Gaussian neon-purple glow texture for recessed vertical S-wave
 * channel canyons in Obsidian Wave 550 (bright lavender-white core fading across violet cheeks).
 */
export function createVioletChannelGlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0.0, '#07050c');
  grad.addColorStop(0.16, '#1f0b38');
  grad.addColorStop(0.32, '#5b21b6');
  grad.addColorStop(0.44, '#a855f7');
  grad.addColorStop(0.5, '#f3e8ff');
  grad.addColorStop(0.56, '#a855f7');
  grad.addColorStop(0.68, '#5b21b6');
  grad.addColorStop(0.84, '#1f0b38');
  grad.addColorStop(1.0, '#07050c');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 32);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Crisp matte-black suspended acoustic T-bar grid tile texture for modern commercial auditorium ceilings.
 */
export function createTBarCeilingGridTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Matte-black perforated mineral acoustic ceiling field
  ctx.fillStyle = '#0c0d12';
  ctx.fillRect(0, 0, size, size);

  // Subtle acoustic micro-perforation stipple
  for (let i = 0; i < 6400; i++) {
    const px = (i * 73 + (i % 19) * 11) % size;
    const py = (i * 131 + (i % 23) * 7) % size;
    ctx.fillStyle = i % 3 === 0 ? 'rgba(32, 36, 46, 0.24)' : 'rgba(3, 4, 7, 0.55)';
    ctx.fillRect(px, py, 2, 2);
  }

  // Crisp 4x4 dark-slate suspended T-bar grid rails
  const step = size / 4;
  ctx.strokeStyle = '#2b303c';
  ctx.lineWidth = 4;
  for (let i = 0; i <= 4; i++) {
    const p = i * step;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
    ctx.stroke();
  }

  // Fine dark inner shadow seam flanking T-bars
  ctx.strokeStyle = '#050608';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      ctx.strokeRect(i * step + 3, j * step + 3, step - 6, step - 6);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(9, 11);
  tex.anisotropy = 8;
  return tex;
}

