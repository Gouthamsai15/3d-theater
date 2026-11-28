import { isMobileDevice } from './formatters';

type OrientationLockType =
  | 'any'
  | 'natural'
  | 'landscape'
  | 'portrait'
  | 'landscape-primary'
  | 'landscape-secondary'
  | 'portrait-primary'
  | 'portrait-secondary';

interface ScreenOrientationWithLock {
  lock?: (orientation: OrientationLockType) => Promise<void>;
  unlock?: () => void;
  type?: string;
}

interface FullscreenDocument extends Document {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
}

interface FullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

let mobileTheaterModeActive = false;

export function getFullscreenElement(): Element | null {
  if (typeof document === 'undefined') return null;
  const doc = document as FullscreenDocument;
  return doc.fullscreenElement || doc.webkitFullscreenElement || null;
}

export async function requestAppFullscreen(targetEl?: HTMLElement | null): Promise<boolean> {
  if (typeof document === 'undefined') return false;
  if (getFullscreenElement()) return true;
  const el = (targetEl || document.documentElement) as FullscreenElement | null;
  if (!el) return false;
  try {
    if (el.requestFullscreen) {
      try {
        await el.requestFullscreen({ navigationUI: 'hide' });
      } catch {
        await el.requestFullscreen();
      }
      return true;
    }
    if (el.webkitRequestFullscreen) {
      await Promise.resolve(el.webkitRequestFullscreen());
      return true;
    }
  } catch {
    // Fullscreen denied or unsupported by browser
  }
  return false;
}

export async function exitAppFullscreen(): Promise<void> {
  if (typeof document === 'undefined') return;
  const doc = document as FullscreenDocument;
  if (!getFullscreenElement()) return;
  try {
    if (doc.exitFullscreen) {
      await doc.exitFullscreen();
    } else if (doc.webkitExitFullscreen) {
      await Promise.resolve(doc.webkitExitFullscreen());
    }
  } catch {
    // Ignore exit fullscreen error
  }
}

function getOrientationApi(): ScreenOrientationWithLock | null {
  if (typeof window === 'undefined' || !window.screen) return null;
  return (window.screen.orientation as ScreenOrientationWithLock | undefined) || null;
}

export async function lockMobileLandscape(): Promise<boolean> {
  if (!isMobileDevice()) return false;
  const orientation = getOrientationApi();
  if (!orientation?.lock) return false;
  try {
    await orientation.lock('landscape');
    return true;
  } catch {
    try {
      await orientation.lock('landscape-primary');
      return true;
    } catch {
      return false;
    }
  }
}

export async function lockMobilePortrait(): Promise<void> {
  if (!isMobileDevice()) return;
  const orientation = getOrientationApi();
  if (!orientation?.lock) return;
  try {
    await orientation.lock('portrait-primary');
  } catch {
    try {
      await orientation.lock('portrait');
    } catch {
      // Ignore portrait lock failure
    }
  }
}

export function isMobileTheaterModeActive(): boolean {
  return mobileTheaterModeActive;
}

/**
 * Triggered directly inside the "Enter Theater" click handler on mobile:
 * requests fullscreen on documentElement and locks screen orientation to horizontal (landscape).
 */
export async function enterMobileTheaterMode(): Promise<void> {
  if (!isMobileDevice()) return;
  mobileTheaterModeActive = true;
  await requestAppFullscreen(document.documentElement);
  await lockMobileLandscape();
}

/**
 * Triggered ONLY when clicking Leave in the theater:
 * locks orientation back to vertical (portrait) while fullscreen is active,
 * exits fullscreen, and then unlocks orientation for normal browsing.
 */
export async function exitMobileTheaterMode(): Promise<void> {
  mobileTheaterModeActive = false;
  if (!isMobileDevice()) {
    await exitAppFullscreen();
    return;
  }
  await lockMobilePortrait();
  await exitAppFullscreen();
  const orientation = getOrientationApi();
  window.setTimeout(() => {
    if (!mobileTheaterModeActive) {
      try {
        orientation?.unlock?.();
      } catch {
        // Ignore unlock error
      }
    }
  }, 450);
}
