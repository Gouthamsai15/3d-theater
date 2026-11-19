import React, { useMemo, useState } from 'react';
import { Accessibility, ArrowLeft, ArrowRight, Award, Check, Lock, Sparkles } from 'lucide-react';
import { useCinemaStore } from '../../store/cinemaStore';
import { StepProgressBar } from '../../components/common/StepProgressBar';
import { SeatData } from '../../types/cinema';
import { findBestSeatForTheater } from '../../config/seating/seatRecommendation';
import { isFourSeatPodBreakAfter } from '../../config/seating/seatGenerator';

export const SeatSelectionPage: React.FC = () => {
  const {
    selectedTheaterConfig,
    theaterSeats,
    selectedSeatId,
    selectedSeat,
    selectSeat,
    navigate,
  } = useCinemaStore();

  const [hoveredSeat, setHoveredSeat] = useState<SeatData | null>(null);

  const rowsGrouped = useMemo(() => {
    const map = new Map<number, { rowLabel: string; seats: SeatData[] }>();
    theaterSeats.forEach((seat) => {
      if (!map.has(seat.rowIndex)) {
        map.set(seat.rowIndex, { rowLabel: seat.rowLabel, seats: [] });
      }
      map.get(seat.rowIndex)!.seats.push(seat);
    });
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [theaterSeats]);

  const bestRecommendation = useMemo(() => {
    if (!selectedTheaterConfig || theaterSeats.length === 0) return null;
    return findBestSeatForTheater(selectedTheaterConfig, theaterSeats);
  }, [selectedTheaterConfig, theaterSeats]);

  if (!selectedTheaterConfig) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center bg-[#070709] p-6 text-center">
        <p className="font-display text-3xl text-[#F4F1EA]">Select a Theater First</p>
        <button
          type="button"
          onClick={() => navigate('theaters')}
          className="mt-6 rounded-md bg-[#D4AF37] px-6 py-3 text-xs font-semibold uppercase tracking-wider text-[#070709] cursor-pointer"
        >
          Browse Theaters
        </button>
      </div>
    );
  }

  const config = selectedTheaterConfig;
  const bestSeatId = bestRecommendation?.seat.id ?? null;

  const handleSeatClick = (seat: SeatData) => {
    if (seat.status === 'unavailable') return;
    if (selectedSeatId === seat.id) {
      selectSeat(null);
    } else {
      selectSeat(seat.id);
    }
  };

  return (
    <div className="min-h-[calc(100vh-73px)] bg-[#070709] text-[#F4F1EA]">
      <StepProgressBar />

      <div className="mx-auto max-w-[1440px] px-6 py-10 lg:px-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between border-b border-white/[0.08] pb-6">
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => navigate('theater_details')}
              className="inline-flex items-center gap-2 text-xs font-medium text-neutral-400 hover:text-[#F4F1EA] cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to {config.theaterName}</span>
            </button>
            <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[#F4F1EA]">
              Select Seat — {config.theaterName}
            </h1>
          </div>

          {/* Seat Legend (No black seats anywhere; distinct non-black slate for unavailable seats) */}
          <div className="flex flex-wrap items-center gap-5 text-xs text-neutral-300">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-emerald-600/85 border border-emerald-400" />
              <span>Available</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-sky-500 border border-sky-200">
                <Award className="h-2.5 w-2.5 text-white" />
              </span>
              <span>Best Seat</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-[#D4AF37]/90 border border-[#F3D578]">
                <Sparkles className="h-2.5 w-2.5 text-[#1A1405]" />
              </span>
              <span>Premium</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-red-600 border border-red-300">
                <Check className="h-2.5 w-2.5 text-white" />
              </span>
              <span>Selected</span>
            </div>
            {theaterSeats.some((s) => s.status === 'unavailable') && (
              <div className="flex items-center gap-2">
                <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-[#4B5565] border border-[#7D899E]">
                  <Lock className="h-2.5 w-2.5 text-[#DCE3EE]" />
                </span>
                <span>Unavailable</span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
          {/* Interactive 2D Seating Map */}
          <div className="lg:col-span-8 rounded-xl border border-white/[0.08] bg-[#0B0C10] p-5 sm:p-8 overflow-x-auto">
            {/* Screen Direction Graphic */}
            <div className="mx-auto mb-10 max-w-2xl text-center">
              <div
                className={`mx-auto h-3 w-full rounded-t-full border-t-4 border-[#D4AF37]/80 bg-gradient-to-b from-[#D4AF37]/25 to-transparent ${
                  config.screenCurvature > 0.15 ? 'scale-y-125' : ''
                }`}
              />
              <p className="mt-2 text-xs font-medium tracking-[0.22em] text-neutral-400 uppercase">
                Screen
              </p>
            </div>

            {/* Seat Grid Rows */}
            <div className="min-w-max mx-auto flex flex-col items-center gap-2.5">
              {rowsGrouped.map(([rowIdx, group]) => {
                const isPremiumRow = config.premiumRows.includes(rowIdx);
                const staggerClass =
                  config.seatPattern === 'staggered'
                    ? rowIdx % 2 === 1
                      ? 'translate-x-2.5'
                      : '-translate-x-1.5'
                    : '';
                const compactSeat = config.seatsPerRow >= 20;
                const ultraCompactSeat = config.seatsPerRow >= 27;
                return (
                  <div key={group.rowLabel} className={`flex items-center gap-3 ${staggerClass}`}>
                    {/* Left Row Label */}
                    <span className="font-mono-tabular w-6 text-right text-xs font-medium text-neutral-400">
                      {group.rowLabel}
                    </span>

                    <div className="flex items-center gap-1">
                      {group.seats.map((seat) => {
                        const isSelected = selectedSeatId === seat.id;
                        const isBestSeat = bestSeatId === seat.id;
                        const isUnavailable = seat.status === 'unavailable';
                        const isAccessible = seat.status === 'accessible';
                        const isPremium = seat.status === 'premium';
                        const hasAisleAfter = config.aisleAfterSeats.includes(seat.seatNumber);
                        const hasPodGapAfter =
                          !hasAisleAfter &&
                          ((config.seatPattern === 'twin_pods' && seat.seatNumber % 2 === 0) ||
                            (config.seatPattern === 'four_seat_pods' &&
                              isFourSeatPodBreakAfter(seat.seatNumber, config))) &&
                          seat.seatNumber < config.seatsPerRow;

                        let seatClasses =
                          'bg-emerald-600/85 border-emerald-400/80 text-white hover:bg-emerald-500';
                        if (isUnavailable) {
                          seatClasses =
                            'bg-[#4B5565] border-[#7D899E] text-[#E2E8F0] cursor-not-allowed';
                        } else if (isSelected) {
                          seatClasses = isBestSeat
                            ? 'bg-red-600 border-sky-200 text-white ring-2 ring-sky-300 scale-105'
                            : 'bg-red-600 border-red-300 text-white ring-2 ring-red-400/70 scale-105';
                        } else if (isBestSeat) {
                          seatClasses =
                            'bg-sky-500 border-sky-200 text-white ring-2 ring-sky-300/85 hover:bg-sky-400 scale-105';
                        } else if (isPremium) {
                          seatClasses =
                            'bg-[#D4AF37]/90 border-[#F5D97E] text-[#1C1606] hover:bg-[#E5C158]';
                        } else if (isAccessible) {
                          seatClasses =
                            'bg-teal-600/85 border-teal-300 text-white hover:bg-teal-500';
                        }

                        return (
                          <React.Fragment key={seat.id}>
                            <button
                              type="button"
                              disabled={isUnavailable}
                              onClick={() => handleSeatClick(seat)}
                              onMouseEnter={() => setHoveredSeat(seat)}
                              onMouseLeave={() => setHoveredSeat(null)}
                              aria-label={`Row ${seat.rowLabel} Seat ${seat.seatNumber} (${
                                isSelected ? 'Selected' : isBestSeat ? 'Best Seat' : seat.status
                              })`}
                              title={
                                isBestSeat
                                  ? `Best Seat (${seat.id}) — Optimal View & Atmos Audio`
                                  : `Row ${seat.rowLabel} · Seat ${seat.seatNumber}`
                              }
                              className={`relative flex ${
                                ultraCompactSeat
                                  ? 'h-5 w-5 sm:h-6 sm:w-6 text-[9px]'
                                  : compactSeat
                                    ? 'h-6 w-6 sm:h-7 sm:w-7 text-[10px]'
                                    : 'h-7 w-7 sm:h-8 sm:w-8 text-[10px]'
                              } items-center justify-center rounded-t-md rounded-b-sm border font-mono-tabular font-semibold transition-transform cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] ${seatClasses}`}
                            >
                              {isAccessible ? (
                                <Accessibility className="h-3.5 w-3.5" />
                              ) : isUnavailable ? (
                                '×'
                              ) : (
                                seat.seatNumber
                              )}
                            </button>

                            {hasPodGapAfter && <div className="w-2.5 sm:w-3.5" aria-hidden="true" />}

                            {hasAisleAfter && (
                              <div
                                className="w-4 sm:w-6 flex items-center justify-center text-[10px] text-neutral-600 select-none"
                                aria-hidden="true"
                              >
                                ·
                              </div>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>

                    {/* Right Row Label */}
                    <span className="font-mono-tabular w-6 text-left text-xs font-medium text-neutral-400">
                      {group.rowLabel}
                    </span>

                    {isPremiumRow && (
                      <span className="hidden xl:inline-block w-16 text-[10px] text-[#D4AF37]/80">
                        Premium
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {hoveredSeat && (
              <div className="mt-6 border-t border-white/[0.06] pt-3 text-xs text-neutral-400">
                Row {hoveredSeat.rowLabel} · Seat {hoveredSeat.seatNumber}
                {hoveredSeat.id === bestSeatId ? ' · Recommended Best Seat' : ''}
              </div>
            )}
          </div>

          {/* Right Sidebar: Best Seat Suggestion + Selected Seat Details */}
          <div className="lg:col-span-4 space-y-6">
            {bestRecommendation && (
              <section className="rounded-xl border border-sky-400/30 bg-[#0E131B] p-6 space-y-4">
                <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] pb-4">
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-300">
                      Recommended Best Seat
                    </p>
                    <h2 className="font-display text-2xl font-semibold text-[#F4F1EA]">
                      Seat {bestRecommendation.seat.id}
                    </h2>
                    <p className="font-mono-tabular text-xs text-neutral-300">
                      {bestRecommendation.overallHeadline} · {bestRecommendation.seat.status}
                    </p>
                  </div>
                  <Award className="h-5 w-5 text-sky-300 shrink-0 mt-1" />
                </div>

                <div className="space-y-3 text-xs leading-relaxed text-neutral-300">
                  <div>
                    <span className="font-semibold text-[#F4F1EA]">View &amp; Sightline: </span>
                    <span className="font-mono-tabular">{bestRecommendation.viewSummary}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-[#F4F1EA]">Audio Sweet Spot: </span>
                    <span>{bestRecommendation.audioSummary}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-[#F4F1EA]">Theatrical Experience: </span>
                    <span>{bestRecommendation.experienceSummary}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => selectSeat(bestRecommendation.seat.id)}
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-3 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
                    selectedSeatId === bestRecommendation.seat.id
                      ? 'border border-sky-300/60 bg-sky-500/20 text-sky-200'
                      : 'bg-sky-500 text-white hover:bg-sky-400'
                  }`}
                >
                  {selectedSeatId === bestRecommendation.seat.id ? (
                    <>
                      <Check className="h-4 w-4" />
                      <span>Best Seat Selected</span>
                    </>
                  ) : (
                    <span>Select Best Seat ({bestRecommendation.seat.id})</span>
                  )}
                </button>
              </section>
            )}

            <div className="rounded-xl border border-white/[0.08] bg-[#0E0F13] p-6 space-y-6">
              <div className="border-b border-white/[0.08] pb-4">
                <h2 className="font-display text-2xl font-semibold text-[#F4F1EA]">
                  {selectedSeat ? `Seat ${selectedSeat.id}` : 'No Seat Selected'}
                </h2>
              </div>

              {selectedSeat ? (
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Theater</span>
                    <span className="text-[#F4F1EA] font-medium">{config.shortName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Row &amp; Seat</span>
                    <span className="font-mono-tabular text-[#F4F1EA] font-medium">
                      Row {selectedSeat.rowLabel} · Seat {selectedSeat.seatNumber}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Tier</span>
                    <span className="capitalize text-[#E5C158] font-medium">
                      {selectedSeat.status}
                      {selectedSeat.id === bestSeatId ? ' · Best Seat' : ''}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-neutral-400">
                  Choose an available seat or pick the recommended best seat above.
                </p>
              )}

              <button
                type="button"
                disabled={!selectedSeat}
                onClick={() => navigate('video_upload')}
                className={`inline-flex w-full items-center justify-center gap-2 rounded-md px-6 py-4 text-xs font-semibold uppercase tracking-wider transition-colors ${
                  selectedSeat
                    ? 'bg-[#D4AF37] text-[#070709] hover:bg-[#E5C158] cursor-pointer'
                    : 'bg-slate-700 text-slate-300 cursor-not-allowed'
                }`}
              >
                <span>Continue</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
