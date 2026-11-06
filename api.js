/* api.js - Open Library API integration (https://openlibrary.org/developers/api)
 *
 * Information retrieved (5 kinds):
 *  1. Book search results  (title, authors, first publish year, page count)   /search.json
 *  2. Cover images         (cover id -> covers.openlibrary.org image)          /search.json (cover_i)
 *  3. Book description     (+ subjects)                                        /works/{id}.json
 *  4. Author biography     (name, birth date, bio)                             /authors/{id}.json
 *  5. Community ratings    (average rating + number of ratings)                /works/{id}/ratings.json
 */

const API_BASE = 'https://openlibrary.org';

// Fetch JSON with a timeout and readable errors
async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(function () { controller.abort(); }, 12000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error('The server responded with status ' + response.status + '.');
    }
    return await response.json(); // JSON text -> JavaScript object
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('The request timed out. Please try again.');
    if (err instanceof TypeError) throw new Error('Cannot reach Open Library. Check your internet connection.');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// Convert one raw search "doc" from the API into a clean book object
function normalizeDoc(doc) {
  return {
    key: doc.key || '',                                   // e.g. "/works/OL45883W"
    title: doc.title || 'Untitled',
    authors: doc.author_name || [],
    authorKeys: doc.author_key || [],
    year: doc.first_publish_year || null,
    pages: doc.number_of_pages_median || null,
    coverId: doc.cover_i || null,
    subjects: (doc.subject || []).slice(0, 40),
    rating: doc.ratings_average ? Math.round(doc.ratings_average * 100) / 100 : null,
    ratingCount: doc.ratings_count || 0
  };
}

// 1 + 2: search books by keyword / author / genre
async function searchBooks(opts) {
  const parts = [];
  if (opts.keyword) parts.push(opts.keyword);
  if (opts.subject) parts.push('subject:"' + opts.subject + '"');

  const params = new URLSearchParams();
  if (parts.length) params.set('q', parts.join(' '));
  if (opts.author) params.set('author', opts.author);
  params.set('limit', String(opts.limit || 20));
  params.set('fields', [
    'key', 'title', 'author_name', 'author_key', 'first_publish_year',
    'number_of_pages_median', 'cover_i', 'subject', 'ratings_average', 'ratings_count'
  ].join(','));
  if (opts.sort) params.set('sort', opts.sort);

  const data = await fetchJson(API_BASE + '/search.json?' + params.toString());
  const docs = Array.isArray(data.docs) ? data.docs : [];
  return docs.map(normalizeDoc);
}

// Descriptions come back either as a string or as { type, value }
function readText(field) {
  if (!field) return '';
  return typeof field === 'string' ? field : (field.value || '');
}

// 3: description + subjects of a work
async function getWorkDetails(workKey) {
  const data = await fetchJson(API_BASE + workKey + '.json');
  return {
    description: readText(data.description),
    subjects: (data.subjects || []).slice(0, 8)
  };
}

// 4: author biography
async function getAuthor(authorKey) {
  const data = await fetchJson(API_BASE + '/authors/' + authorKey + '.json');
  return {
    name: data.name || '',
    birthDate: data.birth_date || '',
    deathDate: data.death_date || '',
    bio: readText(data.bio)
  };
}

// 5: community ratings
async function getRatings(workKey) {
  const data = await fetchJson(API_BASE + workKey + '/ratings.json');
  const summary = data.summary || {};
  return {
    average: summary.average ? Math.round(summary.average * 100) / 100 : null,
    count: summary.count || 0
  };
}
