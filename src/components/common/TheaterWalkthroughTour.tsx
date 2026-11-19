import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Play, X } from 'lucide-react';

export const THEATER_TOUR_STORAGE_KEY = 'aurelia_theater_walkthrough_done_v1';

export function hasCompletedTheaterTour(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(THEATER_TOUR_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markTheaterTourCompleted(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(THEATER_TOUR_STORAGE_KEY, '1');
  } catch {
    // Ignore storage restriction
  }
}

export interface TourStepDefinition {
  id: string;
  targetId: string;
  title: string;
  description: string;
  shortcut?: string;
}

interface TheaterWalkthroughTourProps {
  supports4dxEffects: boolean;
  isAuditoriumOpen: boolean;
  isSeatViewMode: boolean;
  allowDismiss?: boolean;
  onDismiss?: () => void;
  onCompleteAndStartShow: () => void;
}

export const TheaterWalkthroughTour: React.FC<TheaterWalkthroughTourProps> = ({
  supports4dxEffects,
  isAuditoriumOpen,
  isSeatViewMode,
  allowDismiss = false,
  onDismiss,
  onCompleteAndStartShow,
}) => {
  const steps = useMemo<TourStepDefinition[]>(() => {
    const allSteps: TourStepDefinition[] = [
      {
        id: 'view_modes',
        targetId: 'view_modes',
        title: 'Switch View',
        description:
          'Seat = your chair. Hall = move to any seat. Full = full video.',
        shortcut: '1 · 2 · 3',
      },
      ...(isSeatViewMode
        ? [
            {
              id: 'reset_view',
              targetId: 'reset_view',
              title: 'Reset View',
              description: 'Click to look straight at the screen again.',
              shortcut: 'R',
            },
          ]
        : []),
      ...(isAuditoriumOpen
        ? [
            {
              id: 'lighting_presets',
              targetId: 'lighting_presets',
              title: 'Room Lights',
              description: 'Try bright, dim, or dark lights before starting.',
            },
          ]
        : []),
      {
        id: 'scrubber',
        targetId: 'scrubber',
        title: 'Timeline',
        description: 'Drag to jump anywhere in the video.',
      },
      {
        id: 'play_pause',
        targetId: 'play_pause',
        title: 'Play / Pause',
        description: 'Pause or play the movie anytime.',
        shortcut: 'Space',
      },
      {
        id: 'restart_show',
        targetId: 'restart_show',
        title: 'Restart',
        description: 'Play the video from the beginning.',
      },
      {
        id: 'seek_back_10',
        targetId: 'seek_back_10',
        title: 'Back 10s',
        description: 'Go back 10 seconds.',
        shortcut: '←',
      },
      {
        id: 'seek_forward_10',
        targetId: 'seek_forward_10',
        title: 'Forward 10s',
        description: 'Skip forward 10 seconds.',
        shortcut: '→',
      },
      {
        id: 'screen_framing',
        targetId: 'screen_framing',
        title: 'Screen Size',
        description: 'Switch between full screen fill or normal video fit.',
      },
      ...(supports4dxEffects
        ? [
            {
              id: 'fourdx_effects',
              targetId: 'fourdx_effects',
              title: '4DX Effects',
              description: 'Change seat shake and light effects.',
            },
          ]
        : []),
      {
        id: 'mute_volume',
        targetId: 'mute_volume',
        title: 'Volume & Mute',
        description: 'Mute sound or adjust the volume.',
        shortcut: 'M',
      },
      {
        id: 'audio_mixer',
        targetId: 'audio_mixer',
        title: 'Sound & Light Mixer',
        description: 'Change video audio, screen glow, and 3D sound.',
      },
      {
        id: 'hide_controls',
        targetId: 'hide_controls',
        title: 'Hide Buttons',
        description: 'Hide all buttons for a clean view.',
        shortcut: 'H',
      },
      {
        id: 'fullscreen',
        targetId: 'fullscreen',
        title: 'Full Screen',
        description: 'Expand theater to your whole screen.',
        shortcut: 'F',
      },
      {
        id: 'exit_show',
        targetId: 'exit_show',
        title: 'Exit Show',
        description: 'Leave the theater and go back home.',
      },
      ...(isAuditoriumOpen
        ? [
            {
              id: 'start_show',
              targetId: 'start_show',
              title: 'Start Show',
              description: 'All set! Click below to dim lights and start the movie.',
            },
          ]
        : []),
    ];
    return allSteps;
  }, [supports4dxEffects, isAuditoriumOpen, isSeatViewMode]);

  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);
  const [cardSize, setCardSize] = useState<{ width: number; height: number }>({
    width: 320,
    height: 190,
  });
  const cardRef = useRef<HTMLDivElement>(null);

  const currentStep = steps[Math.min(stepIndex, steps.length - 1)];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex >= steps.length - 1;

  const measureTarget = useCallback(() => {
    if (!currentStep) return;
    const el = document.querySelector<HTMLElement>(
      `[data-tour-id="${currentStep.targetId}"]`,
    );
    if (!el) {
      setTargetRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) {
      setTargetRect(null);
      return;
    }
    const pad = 6;
    setTargetRect({
      top: Math.max(4, r.top - pad),
      left: Math.max(4, r.left - pad),
      width: r.width + pad * 2,
      height: r.height + pad * 2,
    });
  }, [currentStep]);

  useLayoutEffect(() => {
    measureTarget();
    const timer = window.setTimeout(measureTarget, 80);
    window.addEventListener('resize', measureTarget);
    window.addEventListener('scroll', measureTarget, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', measureTarget);
      window.removeEventListener('scroll', measureTarget, true);
    };
  }, [measureTarget, stepIndex]);

  useLayoutEffect(() => {
    const cardEl = cardRef.current;
    if (!cardEl) return;
    const r = cardEl.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      setCardSize({ width: r.width, height: r.height });
    }
  }, [stepIndex, targetRect]);

  const handleFinish = () => {
    markTheaterTourCompleted();
    onCompleteAndStartShow();
  };

  // Compute safe non-overlapping card coordinates inside viewport
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 720;
  const effectiveCardW = Math.min(320, vw - 24);
  const effectiveCardH = cardSize.height || 220;

  let cardTop = Math.max(16, (vh - effectiveCardH) / 2);
  let cardLeft = Math.max(12, (vw - effectiveCardW) / 2);

  if (targetRect) {
    const targetCenterX = targetRect.left + targetRect.width / 2;
    const targetCenterY = targetRect.top + targetRect.height / 2;
    cardLeft = Math.max(12, Math.min(vw - effectiveCardW - 12, targetCenterX - effectiveCardW / 2));

    const gap = 14;
    if (targetCenterY > vh * 0.5) {
      // Target is in lower half -> place popover above target
      cardTop = Math.max(12, targetRect.top - effectiveCardH - gap);
    } else {
      // Target is in upper half -> place popover below target
      cardTop = Math.min(vh - effectiveCardH - 12, targetRect.top + targetRect.height + gap);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40"
      role="dialog"
      aria-modal="true"
      aria-label="First-Time Theater Controls Guide"
    >
      {/* Dimmed backdrop cutout around the highlighted theater button */}
      {targetRect ? (
        <div
          className="pointer-events-none fixed rounded-lg border-2 border-[#E5C158] transition-all duration-200"
          style={{
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height,
            boxShadow: '0 0 0 9999px rgba(4, 5, 8, 0.76), 0 0 24px rgba(212, 175, 55, 0.45)',
          }}
        />
      ) : (
        <div className="pointer-events-none fixed inset-0 bg-black/75" />
      )}

      {/* Guided Step Popover Card */}
      <div
        ref={cardRef}
        className="fixed z-50 rounded-xl border border-[#D4AF37]/45 bg-[#0B0C10]/96 p-4 sm:p-5 shadow-2xl transition-all duration-200"
        style={{
          top: cardTop,
          left: cardLeft,
          width: effectiveCardW,
        }}
      >
        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-white/10">
          <span className="font-mono-tabular text-[11px] font-semibold uppercase tracking-wider text-[#E5C158]">
            Step {stepIndex + 1} / {steps.length}
          </span>
          <div className="flex items-center gap-1.5">
            {currentStep.shortcut && (
              <kbd className="rounded border border-white/15 bg-white/[0.04] px-2 py-0.5 font-mono-tabular text-[10px] font-semibold text-neutral-200 whitespace-nowrap">
                Key: {currentStep.shortcut}
              </kbd>
            )}
            {allowDismiss && onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                title="Close steps"
                aria-label="Close steps"
                className="flex h-6 w-6 items-center justify-center rounded border border-white/15 text-neutral-300 hover:border-white/30 hover:text-white cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Step Progress Track */}
        <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full bg-[#D4AF37] transition-all duration-200"
            style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
          />
        </div>

        <h3 className="mt-3 font-display text-lg sm:text-xl font-semibold text-[#F4F1EA]">
          {currentStep.title}
        </h3>
        <p className="mt-1.5 text-xs sm:text-[13px] leading-relaxed text-neutral-300">
          {currentStep.description}
        </p>

        <div className="mt-4 flex items-center justify-between gap-2 pt-2 border-t border-white/[0.08]">
          <button
            type="button"
            onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
            disabled={isFirst}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/15 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-white/5 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back</span>
          </button>

          {!isLast ? (
            <button
              type="button"
              onClick={() => setStepIndex((i) => Math.min(steps.length - 1, i + 1))}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#D4AF37] px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-[#070709] hover:bg-[#E5C158] cursor-pointer whitespace-nowrap"
            >
              <span>Next</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#D4AF37] px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-[#070709] hover:bg-[#E5C158] cursor-pointer whitespace-nowrap"
            >
              {isAuditoriumOpen && <Play className="h-3.5 w-3.5 fill-current" />}
              <span>{isAuditoriumOpen ? 'Start Show' : 'Done'}</span>
              <Check className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
