/* library.js - My Library page: full CRUD on books stored in Local Storage */

const $ = function (id) { return document.getElementById(id); };
let editingId = null;      // null = creating a new book, otherwise the id being edited
let pendingDeleteId = null;
const settings = Settings.get();
const manager = new ReadingListManager();

document.addEventListener('DOMContentLoaded', function () {
  $('bookForm').addEventListener('submit', onSubmit);
  $('cancelBtn').addEventListener('click', resetForm);
  $('filterText').addEventListener('input', renderList);
  $('filterStatus').addEventListener('change', renderList);
  $('sortBy').addEventListener('change', renderList);
  $('confirmYes').addEventListener('click', confirmDelete);
  $('confirmNo').addEventListener('click', closeConfirm);
  $('clearHistoryBtn').addEventListener('click', function () {
    SuggestionStore.clear();
    renderHistory();
    toast('Suggestion history cleared.', 'warn');
  });
  // finishing a book fills in the last page automatically
  $('fStatus').addEventListener('change', function () {
    if ($('fStatus').value === 'finished' && $('fPages').value) $('fCurrent').value = $('fPages').value;
    if ($('fStatus').value === 'want') $('fCurrent').value = 0;
  });
  refreshAll();
});

function refreshAll() {
  renderStats();
  renderList();
  renderHistory();
}

/* ============ CREATE + UPDATE ============ */
function onSubmit(event) {
  event.preventDefault();
  const data = {
    title: $('fTitle').value.trim(),
    author: $('fAuthor').value.trim(),
    category: $('fGenre').value.trim(),
    year: $('fYear').value,
    pageCount: $('fPages').value,
    status: $('fStatus').value,
    currentPage: $('fCurrent').value === '' ? 0 : $('fCurrent').value,
    rating: $('fRating').value,
    notes: $('fNotes').value.trim()
  };

  const errors = BookItem.validate(data);
  if (errors.length > 0) {
    showMessage($('formMessage'), errors.join(' '), 'error');
    return;
  }

  // convert text fields to numbers and keep status consistent with progress
  const record = {
    title: data.title, author: data.author, category: data.category,
    publishedDate: data.year === '' ? 'N/A' : Number(data.year),
    pageCount: Number(data.pageCount),
    status: data.status,
    currentPage: Number(data.currentPage),
    rating: data.rating === '' ? '' : Number(data.rating),
    userNotes: data.notes
  };
  if (record.status === 'finished') record.currentPage = record.pageCount;
  else if (record.status === 'want') record.currentPage = 0;
  else if (record.currentPage === record.pageCount) record.status = 'finished'; // reached the last page
  else if (record.currentPage === 0) record.status = 'want';                    // nothing read yet

  if (editingId) {
    const updated = manager.updateBook(editingId, record);                      // UPDATE
    if (!updated) { showMessage($('formMessage'), 'Could not update this book.', 'error'); return; }
    toast('Book updated.');
  } else {
    const book = new BookItem(BookItem.newId(), record.title, record.author, record.category,
      record.pageCount, record.publishedDate, '', record.status, record.userNotes,
      { currentPage: record.currentPage, rating: record.rating, source: 'Manual' });
    if (!manager.addBook(book)) {                                               // CREATE
      showMessage($('formMessage'), 'Could not save - browser storage is full or blocked.', 'error');
      return;
    }
    toast('Book added to your library.');
  }
  resetForm();
  refreshAll();
}

function startEdit(id) {
  const book = manager.getBookById(id);
  if (!book) return;
  editingId = id;
  $('fTitle').value = book.title;
  $('fAuthor').value = book.author;
  $('fGenre').value = book.category || '';
  $('fYear').value = book.publishedDate !== 'N/A' ? book.publishedDate : '';
  $('fPages').value = book.pageCount;
  $('fStatus').value = book.status;
  $('fCurrent').value = book.currentPage || 0;
  $('fRating').value = book.rating || '';
  $('fNotes').value = book.userNotes || '';
  $('formTitle').textContent = 'Edit Book';
  $('saveBtn').textContent = 'Save Changes';
  $('cancelBtn').hidden = false;
  showMessage($('formMessage'), 'Editing "' + book.title + '". Change the details and press Save Changes.', 'info');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  $('fTitle').focus();
}

function resetForm() {
  editingId = null;
  $('bookForm').reset();
  $('formTitle').textContent = 'Add a Book';
  $('saveBtn').textContent = 'Add Book';
  $('cancelBtn').hidden = true;
  clearNode($('formMessage'));
}

/* ============ DELETE ============ */
function askDelete(book) {
  pendingDeleteId = book.id;
  $('confirmText').textContent = 'Are you sure you want to remove "' + book.title + '" from your library? This cannot be undone.';
  $('confirmModal').hidden = false;
}

function closeConfirm() {
  pendingDeleteId = null;
  $('confirmModal').hidden = true;
}

function confirmDelete() {
  if (pendingDeleteId && manager.deleteBook(pendingDeleteId)) {
    if (editingId === pendingDeleteId) resetForm();
    toast('Book deleted.', 'warn');
  } else {
    toast('Could not delete the book.', 'error');
  }
  closeConfirm();
  refreshAll();
}

/* ============ READ ============ */
function renderStats() {
  const books = manager.getAllBooks();
  const reading = books.filter(function (b) { return b.status === 'reading'; }).length;
  const finished = books.filter(function (b) { return b.status === 'finished'; }).length;
  const pagesRead = books.reduce(function (sum, b) { return sum + (Number(b.currentPage) || 0); }, 0);

  const stats = $('stats');
  clearNode(stats);
  [[books.length, 'Books saved'], [reading, 'Currently reading'], [finished, 'Finished'], [pagesRead, 'Pages read']]
    .forEach(function (pair) {
      stats.appendChild(el('div', { className: 'stat' }, [el('strong', { text: String(pair[0]) }), el('span', { text: pair[1] })]));
    });
}

function renderList() {
  const text = $('filterText').value.trim().toLowerCase();
  const status = $('filterStatus').value;
  const sortBy = $('sortBy').value;
  const all = manager.getAllBooks();

  let books = all.filter(function (b) {
    const matchesText = !text || b.title.toLowerCase().indexOf(text) !== -1 || b.author.toLowerCase().indexOf(text) !== -1;
    const matchesStatus = status === 'all' || b.status === status;
    return matchesText && matchesStatus;
  });

  switch (sortBy) {
    case 'title':    books.sort(function (a, b) { return a.title.localeCompare(b.title); }); break;
    case 'progress': books.sort(function (a, b) { return (b.currentPage / b.pageCount) - (a.currentPage / a.pageCount); }); break;
    case 'rating':   books.sort(function (a, b) { return (Number(b.rating) || 0) - (Number(a.rating) || 0); }); break;
    default:         books.sort(function (a, b) { return b.addedAt.localeCompare(a.addedAt); });
  }

  const list = $('bookList');
  clearNode(list);
  clearNode($('listMessage'));

  if (all.length === 0) {
    list.appendChild(el('div', { className: 'empty', text: 'Your library is empty. Add a book above or use the Discover page.' }));
    return;
  }
  if (books.length === 0) {
    list.appendChild(el('div', { className: 'empty', text: 'No saved books match your search or filter.' }));
    return;
  }

  const grid = el('div', { className: 'book-grid' });
  books.forEach(function (book) { grid.appendChild(bookCard(book)); });
  list.appendChild(grid);
}

function bookCard(book) {
  const percent = book.getProgress();
  const info = el('div', { className: 'book-info' });
  info.appendChild(el('h3', { text: book.title }));
  info.appendChild(el('div', { className: 'meta', text: 'by ' + book.author + (book.publishedDate !== 'N/A' ? ' · ' + book.publishedDate : '') }));
  info.appendChild(el('div', {}, [
    el('span', { className: 'badge ' + book.status, text: BookItem.STATUS_LABEL[book.status] }),
    book.category ? el('span', { className: 'badge', text: book.category }) : null
  ]));

  info.appendChild(el('div', { className: 'meta', text: 'Page ' + book.currentPage + ' of ' + book.pageCount + ' (' + percent + '%)' }));
  info.appendChild(el('div', { className: 'progress' }, [el('div', { style: 'width:' + percent + '%' })]));

  // time left, using the calculation
  if (book.status !== 'finished') {
    const calc = calcReading({
      pages: book.pageCount, currentPage: book.currentPage,
      pagesPerHour: settings.pagesPerHour, minutesPerDay: settings.minutesPerDay
    });
    if (calc.ok && !calc.finished) {
      info.appendChild(el('div', {
        className: 'estimate',
        text: formatDuration(calc.hoursNeeded) + ' left · finish by ' + formatDate(calc.finishDate)
      }));
    }
  }
  if (book.rating) info.appendChild(el('div', { className: 'meta', text: 'My rating: ' + '★'.repeat(book.rating) + '☆'.repeat(5 - book.rating) }));
  if (book.userNotes) info.appendChild(el('div', { className: 'meta', text: 'Notes: ' + book.userNotes }));

  info.appendChild(el('div', { className: 'actions' }, [
    el('button', { className: 'btn secondary small', text: 'Edit', onClick: function () { startEdit(book.id); } }),
    el('button', { className: 'btn danger small', text: 'Delete', onClick: function () { askDelete(book); } })
  ]));
  return el('div', { className: 'book-card' }, [coverElement(book.coverId, book.title), info]);
}

/* ============ Saved suggestions ============ */
function renderHistory() {
  const box = $('suggestionHistory');
  clearNode(box);
  const history = SuggestionStore.getAll();
  $('clearHistoryBtn').hidden = history.length === 0;

  if (history.length === 0) {
    box.appendChild(el('div', { className: 'empty', text: 'No saved suggestions yet. Use "Suggest For Me" on the Discover page.' }));
    return;
  }

  history.forEach(function (entry) {
    const c = entry.criteria;
    const parts = [];
    if (c.genre) parts.push('Genre: ' + c.genre);
    if (c.author) parts.push('Author: ' + c.author);
    if (c.mood) parts.push('Mood: ' + c.mood);
    parts.push('Length: ' + c.length);

    const block = el('div', { className: 'suggestion' });
    block.appendChild(el('h3', { text: new Date(entry.date).toLocaleString('en-MY') + ' - ' + parts.join(', ') }));
    const ul = el('ul');
    entry.items.forEach(function (item) {
      const li = el('li', { text: item.title + ' by ' + item.author + ' (score ' + item.score + ') ' });
      const owned = manager.findByKey(item.key);
      const btn = el('button', { className: 'btn secondary small', text: owned ? 'In library' : 'Add', disabled: owned ? 'disabled' : null });
      btn.addEventListener('click', function () {
        const book = new BookItem(BookItem.newId(), item.title, item.author, c.genre || '',
          item.pages || 300, item.year || '', '', 'want', '',
          { key: item.key, coverId: item.coverId, source: 'Suggestion' });
        if (manager.addBook(book)) toast('Added to your library.');
        else toast('Could not save - browser storage is full or blocked.', 'error');
        refreshAll();
      });
      li.appendChild(btn);
      ul.appendChild(li);
    });
    block.appendChild(ul);
    box.appendChild(block);
  });
}
