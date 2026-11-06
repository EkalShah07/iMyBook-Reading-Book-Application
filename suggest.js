/* suggest.js - Book suggestion logic 
 *
 * The API only supplies candidate books. THIS code decides which ones are suggested,
 * by scoring each candidate against the reader's conditions:
 *   - genre / category   - author          - preferred length (short / medium / long)
 *   - reading mood       - community rating - how fast the reader could finish it
 */

// Which subject keywords belong to each reading mood
function moodKeywords(mood) {
  switch (mood) {
    case 'relax':   return ['romance', 'humor', 'fantasy', 'cozy', 'comedy', 'adventure'];
    case 'learn':   return ['history', 'science', 'biography', 'self-help', 'programming', 'psychology'];
    case 'thrill':  return ['mystery', 'thriller', 'horror', 'crime', 'suspense', 'detective'];
    case 'inspire': return ['biography', 'self-help', 'motivation', 'autobiography', 'inspiration'];
    default:        return [];
  }
}

// Page range allowed for each length preference
function lengthRange(length) {
  switch (length) {
    case 'short':  return { min: 1, max: 250 };
    case 'medium': return { min: 251, max: 450 };
    case 'long':   return { min: 451, max: 10000 };
    default:       return null; // "any length"
  }
}

function includesText(list, needle) {
  const n = String(needle).toLowerCase();
  return list.some(function (item) { return String(item).toLowerCase().indexOf(n) !== -1; });
}

/* Score one book. Returns { score, reasons, rejected } */
function scoreBook(book, prefs) {
  let score = 0;
  const reasons = [];

  // 1. Genre / category match
  if (prefs.genre) {
    if (includesText(book.subjects, prefs.genre)) {
      score += 3;
      reasons.push('Matches your genre: ' + prefs.genre);
    } else {
      score -= 3; // wrong genre: heavy penalty so rating alone cannot rescue it
    }
  }

  // 2. Author match
  if (prefs.author) {
    if (includesText(book.authors, prefs.author)) {
      score += 3;
      reasons.push('Written by ' + book.authors[0]);
    } else {
      return { score: -99, reasons: [], rejected: true }; // wrong author: exclude
    }
  }

  // 3. Mood match
  const keywords = moodKeywords(prefs.mood);
  if (keywords.length > 0) {
    const hit = keywords.find(function (k) { return includesText(book.subjects, k); });
    if (hit) {
      score += 2;
      reasons.push('Fits your "' + prefs.mood + '" mood (' + hit + ')');
    }
  }

  // 4. Length preference
  const range = lengthRange(prefs.length);
  if (range) {
    if (!book.pages) {
      reasons.push('Page count unknown, so length could not be checked');
    } else if (book.pages >= range.min && book.pages <= range.max) {
      score += 2;
      reasons.push('Length suits you (' + book.pages + ' pages)');
    } else {
      return { score: -99, reasons: [], rejected: true }; // outside preferred length
    }
  }

  // 5. Community rating
  if (book.rating !== null) {
    if (book.rating >= 4.2) { score += 3; reasons.push('Excellent rating (' + book.rating + '/5)'); }
    else if (book.rating >= 3.8) { score += 2; reasons.push('Good rating (' + book.rating + '/5)'); }
    else if (book.rating >= 3.4) { score += 1; reasons.push('Decent rating (' + book.rating + '/5)'); }
    else if (book.rating < 3) { score -= 2; }
  }

  // 6. How quickly the reader could finish it (uses calcReading)
  if (book.pages && prefs.pagesPerHour && prefs.minutesPerDay) {
    const calc = calcReading({
      pages: book.pages, currentPage: 0,
      pagesPerHour: prefs.pagesPerHour, minutesPerDay: prefs.minutesPerDay
    });
    if (calc.ok) {
      if (calc.daysToFinish <= 14) { score += 2; reasons.push('Can be finished in about ' + calc.daysToFinish + ' days'); }
      else if (calc.daysToFinish <= 30) { score += 1; reasons.push('Can be finished in about ' + calc.daysToFinish + ' days'); }
      else if (calc.daysToFinish > 60) { score -= 1; }
    }
  }

  return { score: score, reasons: reasons, rejected: false };
}

/* Suggest the best books from a list of candidates. */
function suggestBooks(candidates, prefs, ownedKeys) {
  const owned = ownedKeys || [];
  const MIN_SCORE = 3;
  const results = [];

  candidates.forEach(function (book) {
    if (owned.indexOf(book.key) !== -1) return; // already in the library
    const result = scoreBook(book, prefs);
    if (result.rejected) return;
    if (result.score >= MIN_SCORE) {
      results.push({ book: book, score: result.score, reasons: result.reasons });
    }
  });

  results.sort(function (a, b) { return b.score - a.score; });

  if (results.length === 0) {
    let msg;
    if (candidates.length === 0) {
      msg = 'No books were found for these conditions. Try a different genre or author.';
    } else if (prefs.length !== 'any') {
      msg = 'No ' + prefs.length + ' books matched all your conditions. Try "Any length" or another genre.';
    } else {
      msg = 'No suitable suggestion is available. Try changing the genre, author or mood.';
    }
    return { suggestions: [], message: msg };
  }
  return { suggestions: results.slice(0, 6), message: '' };
}

if (typeof module !== 'undefined') {
  // allow testing in Node: calcReading is a global in the browser
  module.exports = { suggestBooks, scoreBook, moodKeywords, lengthRange };
}
