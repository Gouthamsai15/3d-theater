import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import {
  THEATER_CATEGORIES,
  THEATER_LIST,
  getTheatersByCategory,
} from '../../config/theaters/theaterConfigs';
import { TheaterCategoryId } from '../../types/cinema';
import { useCinemaStore } from '../../store/cinemaStore';

export const TheaterSelectionPage: React.FC = () => {
  const { selectTheater } = useCinemaStore();
  const [selectedCategory, setSelectedCategory] = useState<TheaterCategoryId | 'all'>('all');

  const visibleCategories =
    selectedCategory === 'all'
      ? THEATER_CATEGORIES
      : THEATER_CATEGORIES.filter((c) => c.categoryId === selectedCategory);

  return (
    <div className="min-h-[calc(100vh-56px)] sm:min-h-[calc(100vh-73px)] bg-[#070709] text-[#F4F1EA]">
      <div className="mx-auto max-w-[1440px] px-3.5 py-5 sm:px-6 sm:py-12 lg:px-10 lg:py-16">
        <div className="border-b border-white/[0.08] pb-3.5 sm:pb-6">
          <h1 className="font-display text-2xl sm:text-5xl font-semibold text-[#F4F1EA]">
            Select Theater
          </h1>
        </div>

        {/* Category Filter Bar */}
        <div className="mt-4 sm:mt-6 flex flex-nowrap sm:flex-wrap items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 -mx-3.5 px-3.5 sm:mx-0 sm:px-0">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`rounded-md border px-2.5 py-1.5 sm:px-3.5 sm:py-2 text-[10px] sm:text-xs font-semibold uppercase tracking-wider whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
              selectedCategory === 'all'
                ? 'border-[#D4AF37] bg-[#D4AF37] text-[#070709]'
                : 'border-white/15 bg-[#0E0F13] text-neutral-300 hover:border-[#D4AF37]/50 hover:text-white'
            }`}
          >
            All ({THEATER_LIST.length})
          </button>
          {THEATER_CATEGORIES.map((cat) => (
            <button
              key={cat.categoryId}
              type="button"
              onClick={() => setSelectedCategory(cat.categoryId)}
              className={`rounded-md border px-2.5 py-1.5 sm:px-3.5 sm:py-2 text-[10px] sm:text-xs font-semibold uppercase tracking-wider whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                selectedCategory === cat.categoryId
                  ? 'border-[#D4AF37] bg-[#D4AF37] text-[#070709]'
                  : 'border-white/15 bg-[#0E0F13] text-neutral-300 hover:border-[#D4AF37]/50 hover:text-white'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Categorized Auditorium Sections (2 cards per row on mobile) */}
        <div className="mt-6 sm:mt-10 space-y-8 sm:space-y-14">
          {visibleCategories.map((cat) => {
            const categoryTheaters = getTheatersByCategory(cat.categoryId);
            return (
              <section key={cat.categoryId} className="space-y-3 sm:space-y-6">
                <div className="border-b border-white/[0.06] pb-2 sm:pb-3">
                  <h2 className="font-display text-lg sm:text-3xl font-semibold text-[#F4F1EA]">
                    {cat.name}
                  </h2>
                </div>

                <div className="grid grid-cols-2 gap-2.5 sm:gap-6 lg:grid-cols-3">
                  {categoryTheaters.map((theater) => {
                    const totalSeats = theater.seatingRows * theater.seatsPerRow;
                    return (
                      <article
                        key={theater.theaterId}
                        className="flex flex-col justify-between overflow-hidden rounded-lg sm:rounded-xl border border-white/[0.08] bg-[#0E0F13] transition-colors hover:border-[#D4AF37]/50"
                      >
                        <div>
                          <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#14161D]">
                            <img
                              src={theater.previewImage}
                              alt={theater.theaterName}
                              referrerPolicy="no-referrer"
                              className="h-full w-full object-cover"
                            />
                            <div
                              className="absolute inset-0 opacity-35 mix-blend-color"
                              style={{
                                background: `linear-gradient(135deg, ${theater.ambienceSwatches[0]}, ${theater.ambienceSwatches[1]})`,
                              }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#0E0F13] via-transparent to-black/35" />

                            {/* Ambience Swatch Bar */}
                            <div className="absolute bottom-1.5 left-1.5 right-1.5 sm:bottom-3 sm:left-4 sm:right-4 flex items-center justify-between gap-1.5 sm:gap-2">
                              <span className="truncate rounded bg-black/75 px-1.5 py-0.5 sm:px-2.5 sm:py-1 text-[9px] sm:text-[11px] font-medium text-[#F4F1EA]">
                                {theater.ambienceName}
                              </span>
                              <div className="hidden sm:flex items-center gap-1.5 rounded bg-black/75 px-2 py-1 shrink-0">
                                {theater.ambienceSwatches.map((hex, idx) => (
                                  <span
                                    key={idx}
                                    className="h-2.5 w-2.5 rounded-sm border border-white/25"
                                    style={{ backgroundColor: hex }}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="p-2.5 sm:p-6 space-y-1 sm:space-y-2">
                            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] sm:text-xs text-[#D4AF37]">
                              <span className="font-mono-tabular">{totalSeats} Seats</span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono-tabular">
                                {theater.screenWidth}m×{theater.screenHeight}m
                                <span className="hidden sm:inline">
                                  {theater.screenCurvature > 0 ? ' Curved' : ' Flat'}
                                </span>
                              </span>
                            </div>

                            <h3 className="font-display text-sm sm:text-2xl font-semibold text-[#F4F1EA] leading-tight line-clamp-2">
                              {theater.theaterName}
                            </h3>
                          </div>
                        </div>

                        <div className="px-2.5 pb-2.5 pt-2 sm:px-6 sm:pb-6 sm:pt-3 border-t border-white/[0.06]">
                          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-1.5 sm:gap-3">
                            <button
                              type="button"
                              onClick={() => selectTheater(theater.theaterId, 'theater_details')}
                              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-white/15 bg-white/[0.03] px-2 py-1.5 sm:px-3 sm:py-2.5 text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-[#F4F1EA] cursor-pointer hover:border-[#D4AF37] hover:text-[#E5C158] transition-colors whitespace-nowrap"
                            >
                              <span>Details</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => selectTheater(theater.theaterId, 'seat_selection')}
                              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-[#D4AF37] px-2 py-2 sm:px-3 sm:py-2.5 text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-[#070709] cursor-pointer hover:bg-[#E5C158] transition-colors whitespace-nowrap"
                            >
                              <span>Select Seat</span>
                              <ArrowRight className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
};
