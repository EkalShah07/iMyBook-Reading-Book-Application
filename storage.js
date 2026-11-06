/* storage.js - Local Storage helpers: reader settings and saved suggestions
   (the book CRUD lives in models.js -> ReadingListManager) */

const Store = {
  KEYS: {
    suggestions: 'imybook_suggestions',
    settings: 'imybook_settings'
  },
  // Read JSON from Local Storage (returns fallback if missing or corrupted)
  load: function (key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  },
  // Write JSON to Local Storage (returns false if it fails, e.g. storage full)
  save: function (key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }
};

/* ---------- Reader settings (used by the calculation) ---------- */
const Settings = {
  defaults: { pagesPerHour: 30, minutesPerDay: 30 },
  get: function () {
    return Object.assign({}, this.defaults, Store.load(Store.KEYS.settings, {}));
  },
  save: function (settings) {
    return Store.save(Store.KEYS.settings, settings);
  }
};

/* ---------- Saved suggestions (history) ---------- */
const SuggestionStore = {
  MAX: 10,
  getAll: function () {
    return Store.load(Store.KEYS.suggestions, []);
  },
  add: function (entry) {
    const list = this.getAll();
    list.unshift(entry); // newest first
    return Store.save(Store.KEYS.suggestions, list.slice(0, this.MAX));
  },
  remove: function (id) {
    const list = this.getAll().filter(function (s) { return s.id !== id; });
    return Store.save(Store.KEYS.suggestions, list);
  },
  clear: function () {
    return Store.save(Store.KEYS.suggestions, []);
  }
};

if (typeof module !== 'undefined') module.exports = { Store, Settings, SuggestionStore };
