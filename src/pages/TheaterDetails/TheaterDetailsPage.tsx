import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Box, Check, Image as ImageIcon } from 'lucide-react';
import { useCinemaStore } from '../../store/cinemaStore';
import { getTheatersByCategory } from '../../config/theaters/theaterConfigs';
import { StepProgressBar } from '../../components/common/StepProgressBar';
import { TheaterPreviewCanvas } from '../../three/scenes/TheaterPreviewCanvas';

export const TheaterDetailsPage: React.FC = () => {
  const { selectedTheaterConfig, selectTheater, navigate } = useCinemaStore();
  const [viewMode, setViewMode] = useState<'photo' | '3d'>('photo');

  if (!selectedTheaterConfig) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center bg-[#070709] p-6 text-center">
        <p className="font-display text-3xl text-[#F4F1EA]">No Theater Selected</p>
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
  const totalSeats = config.seatingRows * config.seatsPerRow;
  const categoryVariants = getTheatersByCategory(config.categoryId);

  return (
    <div className="min-h-[calc(100vh-56px)] sm:min-h-[calc(100vh-73px)] bg-[#070709] text-[#F4F1EA]">
      <StepProgressBar />

      <div className="mx-auto max-w-[1440px] px-3.5 py-4 sm:px-6 sm:py-10 lg:px-10 lg:py-14">
        <button
          type="button"
          onClick={() => navigate('theaters')}
          className="inline-flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-medium text-neutral-400 hover:text-[#F4F1EA] cursor-pointer mb-3 sm:mb-6"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Theaters</span>
        </button>

        {/* Top Preview Split */}
        <div className="grid grid-cols-1 gap-4 sm:gap-8 lg:grid-cols-12 lg:items-stretch">
          {/* Left: Photo / Interactive 3D Auditorium Toggle */}
          <div className="lg:col-span-7 flex flex-col">
            <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg sm:rounded-xl border border-white/[0.08] bg-[#0E0F13]">
              {viewMode === 'photo' ? (
                <>
                  <img
                    src={config.previewImage}
                    alt={config.theaterName}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                  <div
                    className="pointer-events-none absolute inset-0 opacity-30 mix-blend-color"
                    style={{
                      background: `linear-gradient(135deg, ${config.ambienceSwatches[0]}, ${config.ambienceSwatches[1]})`,
                    }}
                  />
                </>
              ) : (
                <TheaterPreviewCanvas config={config} />
              )}

              {/* View Mode Switcher */}
              <div className="absolute bottom-2.5 left-2.5 sm:bottom-4 sm:left-4 flex items-center gap-1 rounded-lg border border-white/15 bg-black/75 p-0.5 sm:p-1">
                <button
                  type="button"
                  onClick={() => setViewMode('photo')}
                  className={`inline-flex items-center gap-1 sm:gap-1.5 rounded-md px-2.5 py-1 sm:px-3 sm:py-1.5 text-[11px] sm:text-xs font-medium cursor-pointer transition-colors ${
                    viewMode === 'photo'
                      ? 'bg-[#D4AF37] text-[#070709]'
                      : 'text-neutral-300 hover:text-white'
                  }`}
                >
                  <ImageIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  <span>Photo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('3d')}
                  className={`inline-flex items-center gap-1 sm:gap-1.5 rounded-md px-2.5 py-1 sm:px-3 sm:py-1.5 text-[11px] sm:text-xs font-medium cursor-pointer transition-colors ${
                    viewMode === '3d'
                      ? 'bg-[#D4AF37] text-[#070709]'
                      : 'text-neutral-300 hover:text-white'
                  }`}
                >
                  <Box className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  <span>3D View</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right: Configuration Summary & CTA */}
          <div className="lg:col-span-5 flex flex-col justify-between rounded-lg sm:rounded-xl border border-white/[0.08] bg-[#0E0F13] p-3.5 sm:p-7 space-y-4 sm:space-y-6">
            <div className="space-y-3 sm:space-y-4">
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] sm:text-xs text-[#D4AF37]">
                <span>{config.category}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-tabular">{totalSeats} Seats</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-tabular">
                  {config.auditoriumWidth}m × {config.auditoriumLength}m Hall
                </span>
              </div>

              <h1 className="font-display text-2xl sm:text-4xl font-semibold text-[#F4F1EA] leading-tight">
                {config.theaterName}
              </h1>

              {/* Category Theater Variants Switcher (3 in a row on mobile & desktop) */}
              <div className="space-y-1.5 sm:space-y-2 rounded-lg border border-white/[0.08] bg-black/30 p-2 sm:p-3">
                <p className="text-[10px] sm:text-[11px] font-medium uppercase tracking-wider text-neutral-400">
                  Ambience
                </p>
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                  {categoryVariants.map((variant) => {
                    const isActive = variant.theaterId === config.theaterId;
                    return (
                      <button
                        key={variant.theaterId}
                        type="button"
                        onClick={() => selectTheater(variant.theaterId, 'theater_details')}
                        className={`flex flex-col items-start gap-1 sm:gap-1.5 rounded-md border p-1.5 sm:p-2.5 text-left transition-colors cursor-pointer min-w-0 ${
                          isActive
                            ? 'border-[#D4AF37] bg-[#D4AF37]/12 text-[#F4F1EA]'
                            : 'border-white/10 bg-white/[0.02] text-neutral-300 hover:border-white/25'
                        }`}
                      >
                        <div className="flex items-center gap-0.5 sm:gap-1">
                          {variant.ambienceSwatches.map((hex, idx) => (
                            <span
                              key={idx}
                              className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-sm border border-white/25"
                              style={{ backgroundColor: hex }}
                            />
                          ))}
                        </div>
                        <span className="w-full truncate text-[10px] sm:text-xs font-semibold leading-tight">
                          {variant.shortName}
                        </span>
                        <span className="w-full truncate text-[9px] sm:text-[10px] text-neutral-400 leading-tight">
                          {variant.ambienceName}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-white/[0.08] pt-3 sm:pt-5 space-y-2 sm:space-y-3.5 text-[11px] sm:text-sm">
                <div className="flex justify-between gap-3 sm:gap-4">
                  <span className="text-neutral-400 shrink-0">Screen</span>
                  <span className="text-right text-[#F4F1EA] font-medium">
                    {config.screenSpecText}
                  </span>
                </div>
                <div className="flex justify-between gap-3 sm:gap-4">
                  <span className="text-neutral-400 shrink-0">Seating</span>
                  <span className="text-right text-[#F4F1EA] font-medium">
                    {config.seatingArrangementText}
                  </span>
                </div>
                <div className="flex justify-between gap-3 sm:gap-4">
                  <span className="text-neutral-400 shrink-0">Audio</span>
                  <span className="text-right text-[#F4F1EA] font-medium">
                    {config.audioExperienceText}
                  </span>
                </div>
                <div className="flex justify-between gap-3 sm:gap-4">
                  <span className="text-neutral-400 shrink-0">Lighting</span>
                  <span className="text-right text-[#F4F1EA] font-medium">
                    {config.lightingStyleText}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-1 sm:pt-2">
              <button
                type="button"
                onClick={() => navigate('seat_selection')}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#D4AF37] px-5 py-3 sm:px-6 sm:py-4 text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-[#070709] cursor-pointer transition-colors hover:bg-[#E5C158] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
              >
                <span>Select Your Seat</span>
                <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Features List */}
        <div className="mt-4 sm:mt-10 rounded-lg sm:rounded-xl border border-white/[0.08] bg-[#0E0F13] p-3.5 sm:p-7">
          <h2 className="font-display text-lg sm:text-2xl font-semibold text-[#F4F1EA]">Features</h2>
          <div className="mt-2.5 sm:mt-5 grid grid-cols-1 gap-2 sm:gap-4 md:grid-cols-2">
            {config.features.map((feat, i) => (
              <div
                key={i}
                className="flex items-start gap-2 sm:gap-3 border-t border-white/[0.06] pt-2.5 sm:pt-4 text-xs sm:text-sm text-neutral-300"
              >
                <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#D4AF37] shrink-0 mt-0.5" />
                <span>{feat}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
