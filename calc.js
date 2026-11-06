/* calc.js - Reading time calculation
 *
 * Uses API data (page count) and user input (reading speed, daily time, current page)
 * to work out how long a book will take and when it will be finished.
 *
 *   remainingPages = totalPages - currentPage
 *   hoursNeeded    = remainingPages / pagesPerHour
 *   pagesPerDay    = pagesPerHour * (minutesPerDay / 60)
 *   daysToFinish   = ceil(remainingPages / pagesPerDay)
 *   finishDate     = today + daysToFinish
 */

function calcReading(input) {
  const pages = Number(input.pages);
  const current = Number(input.currentPage === '' || input.currentPage == null ? 0 : input.currentPage);
  const pph = Number(input.pagesPerHour);
  const mpd = Number(input.minutesPerDay);

  // ----- validation -----
  if (!Number.isInteger(pages) || pages < 1 || pages > 10000) {
    return { ok: false, error: 'Total pages must be a whole number between 1 and 10,000.' };
  }
  if (!Number.isInteger(current) || current < 0) {
    return { ok: false, error: 'Current page must be a whole number (0 or more).' };
  }
  if (current > pages) {
    return { ok: false, error: 'Current page cannot be higher than total pages.' };
  }
  if (!(pph >= 1 && pph <= 300)) {
    return { ok: false, error: 'Reading speed must be between 1 and 300 pages per hour.' };
  }
  if (!(mpd >= 5 && mpd <= 1440)) {
    return { ok: false, error: 'Daily reading time must be between 5 and 1,440 minutes.' };
  }

  // ----- boundary case: already at the last page -----
  const remaining = pages - current;
  const progress = Math.round((current / pages) * 100);
  if (remaining === 0) {
    return {
      ok: true, finished: true, pages: pages, remainingPages: 0, progress: 100,
      hoursNeeded: 0, pagesPerDay: 0, daysToFinish: 0, finishDate: new Date()
    };
  }

  // ----- calculation -----
  const hoursNeeded = remaining / pph;
  const pagesPerDay = pph * (mpd / 60);
  const daysToFinish = Math.ceil(remaining / pagesPerDay);
  const finishDate = new Date();
  finishDate.setDate(finishDate.getDate() + daysToFinish);

  return {
    ok: true, finished: false, pages: pages, remainingPages: remaining, progress: progress,
    hoursNeeded: hoursNeeded,
    pagesPerDay: Math.round(pagesPerDay * 10) / 10,
    daysToFinish: daysToFinish,
    finishDate: finishDate
  };
}

if (typeof module !== 'undefined') module.exports = { calcReading };
