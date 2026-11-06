/* discover.js - Discover page: search, suggestions, calculator, details, add to library */

const $ = function (id) { return document.getElementById(id); };
let settings = Settings.get();
const manager = new ReadingListManager();

/* ============ Page setup & event handlers ============ */
document.addEventListener('DOMContentLoaded', function () {
  $('searchForm').addEventListener('submit', onSearch);          // event 1: search
  $('suggestBtn').addEventListener('click', onSuggest);          // event 2: suggest
  $('clearBtn').addEventListener('click', onClear);              // event 3: clear
  $('closeDetails').addEventListener('click', closeDetails);     // event 4: close modal
  $('detailsModal').addEventListener('click', function (e) {
    if (e.target === $('detailsModal')) closeDetails();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeDetails();
  });
});

function readFilters() {
  return {
    keyword: $('keyword').value.trim(),
    author: $('authorInput').value.trim(),
    genre: $('genre').value,
    length: $('length').value,
    mood: $('mood').value
  };
}

function setBusy(busy) {
  $('searchBtn').disabled = busy;
  $('suggestBtn').disabled = busy;
}

function showLoading(text) {
  const results = $('results');
  clearNode(results);
  results.appendChild(el('div', { className: 'spinner', text: text }));
}

/* ============ Search ============ */
async function onSearch(event) {
  event.preventDefault();
  const f = readFilters();
  clearNode($('suggestionBox'));
  $('resultsTitle').textContent = 'Search Results';

  // validation: need at least one search condition
  if (!f.keyword && !f.author && !f.genre) {
    showMessage($('searchMessage'), 'Please enter a title, an author, or choose a genre before searching.', 'error');
    return;
  }
  showMessage($('searchMessage'), '');
  setBusy(true);
  showLoading('Searching Open Library...');

  try {
    const books = await searchBooks({ keyword: f.keyword, author: f.author, subject: f.genre, limit: 20 });
    if (books.length === 0) {
      clearNode($('results'));
      $('results').appendChild(el('div', { className: 'empty', text: 'No books found. Try different keywords.' }));
      showMessage($('searchMessage'), 'No results found for your search.', 'warn');
    } else {
      renderBooks(books);
      showMessage($('searchMessage'), 'Found ' + books.length + ' books.', 'success');
    }
  } catch (err) {
    clearNode($('results'));
    $('results').appendChild(el('div', { className: 'empty', text: 'Could not load books.' }));
    showMessage($('searchMessage'), 'Search failed: ' + err.message, 'error');
  } finally {
    setBusy(false);
  }
}

/* ============ Suggestions ============ */
async function onSuggest() {
  const f = readFilters();
  clearNode($('suggestionBox'));
  $('resultsTitle').textContent = 'Suggested For You';

  // Choose a genre to fetch candidates from. If none is given, derive one from the mood.
  let genre = f.genre;
  if (!genre && !f.author) {
    switch (f.mood) {
      case 'relax':   genre = 'romance'; break;
      case 'learn':   genre = 'history'; break;
      case 'thrill':  genre = 'mystery'; break;
      case 'inspire': genre = 'biography'; break;
      default:        genre = '';
    }
  }
  if (!genre && !f.author) {
    showMessage($('searchMessage'), 'To get suggestions, choose a genre, enter an author, or pick a reading mood.', 'error');
    return;
  }

  showMessage($('searchMessage'), '');
  setBusy(true);
  showLoading('Finding the best books for you...');

  try {
    const candidates = await searchBooks({
      keyword: f.keyword, author: f.author, subject: genre, limit: 40, sort: 'rating'
    });
    const owned = manager.getAllBooks().map(function (b) { return b.key; });
    const prefs = {
      genre: genre, author: f.author, length: f.length, mood: f.mood,
      pagesPerHour: settings.pagesPerHour, minutesPerDay: settings.minutesPerDay
    };
    const outcome = suggestBooks(candidates, prefs, owned); // student-written logic

    clearNode($('results'));
    if (outcome.suggestions.length === 0) {
      $('results').appendChild(el('div', { className: 'empty', text: outcome.message }));
      showMessage($('searchMessage'), outcome.message, 'warn');
      return;
    }

    renderBooks(outcome.suggestions.map(function (s) { return s.book; }), outcome.suggestions);
    saveSuggestionHistory(f, genre, outcome.suggestions);
    showMessage($('searchMessage'),
      outcome.suggestions.length + ' suggestions found and saved to your suggestion history.', 'success');
  } catch (err) {
    clearNode($('results'));
    $('results').appendChild(el('div', { className: 'empty', text: 'Could not load suggestions.' }));
    showMessage($('searchMessage'), 'Suggestion failed: ' + err.message, 'error');
  } finally {
    setBusy(false);
  }
}

// Store suggestions in Local Storage
function saveSuggestionHistory(filters, genre, suggestions) {
  SuggestionStore.add({
    id: 's' + Date.now(),
    date: new Date().toISOString(),
    criteria: {
      genre: genre, author: filters.author, length: filters.length, mood: filters.mood
    },
    items: suggestions.map(function (s) {
      return {
        key: s.book.key, title: s.book.title, author: s.book.authors[0] || 'Unknown',
        year: s.book.year, pages: s.book.pages, coverId: s.book.coverId,
        score: s.score, reasons: s.reasons
      };
    })
  });
}

function onClear() {
  $('searchForm').reset();
  clearNode($('searchMessage'));
  clearNode($('suggestionBox'));
  clearNode($('results'));
  $('resultsTitle').textContent = 'Results';
  $('results').appendChild(el('div', { className: 'empty', text: 'Search for a book or ask for a suggestion to get started.' }));
}

/* ============ Rendering book cards (DOM manipulation) ============ */
function renderBooks(books, suggestionInfo) {
  const results = $('results');
  clearNode(results);
  const grid = el('div', { className: 'book-grid' });

  books.forEach(function (book, index) {
    const info = el('div', { className: 'book-info' });
    info.appendChild(el('h3', { text: book.title }));
    info.appendChild(el('div', { className: 'meta', text: 'by ' + (book.authors.join(', ') || 'Unknown author') }));

    const facts = [];
    if (book.year) facts.push('First published ' + book.year);
    if (book.pages) facts.push(book.pages + ' pages');
    if (book.rating) facts.push('★ ' + book.rating + ' (' + book.ratingCount + ')');
    info.appendChild(el('div', { className: 'meta', text: facts.join(' · ') || 'No extra details' }));

    const badges = el('div');
    book.subjects.slice(0, 3).forEach(function (s) { badges.appendChild(el('span', { className: 'badge', text: s })); });
    info.appendChild(badges);

    // Reading-time estimate from the calculation
    const calc = book.pages ? calcReading({
      pages: book.pages, currentPage: 0,
      pagesPerHour: settings.pagesPerHour, minutesPerDay: settings.minutesPerDay
    }) : null;
    if (calc && calc.ok) {
      info.appendChild(el('div', {
        className: 'estimate',
        text: '≈ ' + formatDuration(calc.hoursNeeded) + ' total · about ' + calc.daysToFinish +
              ' days at ' + settings.minutesPerDay + ' min/day'
      }));
    } else {
      info.appendChild(el('div', { className: 'estimate', text: 'Page count unavailable - reading time cannot be estimated.' }));
    }

    // Why this was suggested
    if (suggestionInfo && suggestionInfo[index]) {
      const sug = suggestionInfo[index];
      const reasonList = el('ul');
      sug.reasons.forEach(function (r) { reasonList.appendChild(el('li', { text: r })); });
      info.appendChild(el('div', { className: 'suggestion' }, [
        el('h3', { text: 'Match score: ' + sug.score }), reasonList
      ]));
    }

    const actions = el('div', { className: 'actions' });
    actions.appendChild(el('button', { className: 'btn secondary small', text: 'Details', onClick: function () { openDetails(book); } }));
    const exists = manager.findByKey(book.key);
    const addBtn = el('button', {
      className: 'btn small',
      text: exists ? 'In library' : 'Add to Library',
      disabled: exists ? 'disabled' : null
    });
    addBtn.addEventListener('click', function () { addToLibrary(book, addBtn); });
    actions.appendChild(addBtn);
    info.appendChild(actions);

    grid.appendChild(el('div', { className: 'book-card' }, [coverElement(book.coverId, book.title), info]));
  });
  results.appendChild(grid);
}

/* ============ CREATE: add book to library ============ */
function addToLibrary(book, button) {
  if (manager.findByKey(book.key)) {
    toast('This book is already in your library.', 'warn');
    return;
  }
  const newBook = new BookItem(
    BookItem.newId(),
    book.title,
    book.authors[0] || 'Unknown author',
    book.subjects[0] || '',
    book.pages || 300,                  // default if the API has no page count (editable later)
    book.year || '',
    '',
    'want',
    book.pages ? '' : 'Page count unknown - please update it.',
    { key: book.key, coverId: book.coverId, source: 'Open Library' }
  );
  const record = manager.addBook(newBook);
  if (!record) {
    toast('Could not save - browser storage is full or blocked.', 'error');
    return;
  }
  button.textContent = 'In library';
  button.disabled = true;
  toast('"' + book.title + '" added to My Library.');
}

/* ============ Details modal (3 extra API calls) ============ */
async function openDetails(book) {
  const body = $('detailsBody');
  $('detailsTitle').textContent = book.title;
  clearNode(body);
  body.appendChild(el('div', { className: 'spinner', text: 'Loading details...' }));
  $('detailsModal').hidden = false;

  const authorKey = book.authorKeys[0];
  // allSettled so one failing request does not hide the others
  const results = await Promise.allSettled([
    getWorkDetails(book.key),
    authorKey ? getAuthor(authorKey) : Promise.reject(new Error('No author information.')),
    getRatings(book.key)
  ]);
  const work = results[0], author = results[1], rating = results[2];

  clearNode(body);

  body.appendChild(el('h2', { text: 'Description' }));
  if (work.status === 'fulfilled' && work.value.description) {
    body.appendChild(el('p', { text: work.value.description.split('\n')[0] }));
  } else {
    body.appendChild(el('p', { className: 'hint', text: work.status === 'rejected'
      ? 'Could not load the description (' + work.reason.message + ')'
      : 'No description is available for this book.' }));
  }

  body.appendChild(el('h2', { text: 'About the Author' }));
  if (author.status === 'fulfilled') {
    const a = author.value;
    const born = a.birthDate ? ' (born ' + a.birthDate + (a.deathDate ? ', died ' + a.deathDate : '') + ')' : '';
    body.appendChild(el('p', { text: a.name + born }));
    if (a.bio) body.appendChild(el('p', { className: 'hint', text: a.bio.split('\n')[0] }));
  } else {
    body.appendChild(el('p', { className: 'hint', text: 'Author information is not available.' }));
  }

  body.appendChild(el('h2', { text: 'Reader Ratings' }));
  if (rating.status === 'fulfilled' && rating.value.average) {
    body.appendChild(el('p', { text: '★ ' + rating.value.average + ' / 5 from ' + rating.value.count + ' ratings' }));
  } else {
    body.appendChild(el('p', { className: 'hint', text: 'No ratings have been recorded for this book yet.' }));
  }

  if (work.status === 'fulfilled' && work.value.subjects.length) {
    body.appendChild(el('h2', { text: 'Subjects' }));
    const badges = el('div');
    work.value.subjects.forEach(function (s) { badges.appendChild(el('span', { className: 'badge', text: s })); });
    body.appendChild(badges);
  }
}

function closeDetails() {
  $('detailsModal').hidden = true;
}
