/* models.js - Object-oriented model for iMyBook
 *  MediaItem           parent class
 *  BookItem            child class (extends MediaItem, overrides getSummary)
 *  ReadingListManager  CRUD manager that saves BookItem objects in Local Storage
 */

// Parent Class
class MediaItem {
    constructor(id, title, creator, category) {
        this.id = id;
        this.title = title;
        this.creator = creator;
        this.category = category;
    }

    getSummary() {
        return `${this.title} by ${this.creator} [${this.category}]`;
    }
}

// Subclass / Child Class extending MediaItem
class BookItem extends MediaItem {
    constructor(id, title, author, category, pageCount, publishedDate, suggestion, status = 'want', userNotes = '', extras = {}) {
        super(id, title, author, category);
        this.author = author;
        this.pageCount = Number(pageCount) || 150;
        this.publishedDate = publishedDate || 'N/A';
        this.suggestion = suggestion || 'Standard reading pace recommended.';
        this.status = status;            // 'want' | 'reading' | 'finished'
        this.userNotes = userNotes;
        // extra details kept for the library page
        this.key = extras.key || '';                 // Open Library work key (stops duplicates)
        this.currentPage = Number(extras.currentPage) || 0;
        this.rating = extras.rating || '';           // the user's own rating 1-5
        this.coverId = extras.coverId || null;
        this.source = extras.source || 'Manual';
        const now = new Date().toISOString();
        this.addedAt = extras.addedAt || now;
        this.updatedAt = extras.updatedAt || now;
    }

    // Method Overriding
    getSummary() {
        return `${super.getSummary()} - ${this.pageCount} pages (${BookItem.STATUS_LABEL[this.status] || this.status})`;
    }

    getProgress() {
        return Math.round((this.currentPage / this.pageCount) * 100);
    }

    static newId() {
        return 'b' + Date.now() + Math.random().toString(36).slice(2, 6);
    }

    // Input validation - returns an array of error messages (empty = valid)
    static validate(d) {
        const errors = [];
        const title = String(d.title || '').trim();
        const author = String(d.author || '').trim();

        if (!title) errors.push('Title is required.');
        else if (title.length > 150) errors.push('Title must be 150 characters or fewer.');

        if (!author) errors.push('Author is required.');
        else if (author.length > 100) errors.push('Author must be 100 characters or fewer.');

        const pages = Number(d.pageCount);
        const pagesOk = Number.isInteger(pages) && pages >= 1 && pages <= 10000;
        if (!pagesOk) errors.push('Total pages must be a whole number between 1 and 10,000.');

        const current = Number(d.currentPage === '' || d.currentPage == null ? 0 : d.currentPage);
        if (!Number.isInteger(current) || current < 0) {
            errors.push('Current page must be a whole number (0 or more).');
        } else if (pagesOk && current > pages) {
            errors.push('Current page cannot be higher than total pages.');
        }

        if (d.year !== '' && d.year != null) {
            const y = Number(d.year);
            if (!Number.isInteger(y) || y < 1000 || y > new Date().getFullYear() + 1) {
                errors.push('Publication year must be a valid 4-digit year.');
            }
        }

        if (BookItem.STATUSES.indexOf(d.status) === -1) errors.push('Please choose a reading status.');

        if (d.rating !== '' && d.rating != null && Number(d.rating) !== 0) {
            const r = Number(d.rating);
            if (!Number.isInteger(r) || r < 1 || r > 5) errors.push('Your rating must be between 1 and 5.');
        }

        if (String(d.notes || '').length > 500) errors.push('Notes must be 500 characters or fewer.');
        return errors;
    }
}
BookItem.STATUSES = ['want', 'reading', 'finished'];
BookItem.STATUS_LABEL = { want: 'Want to read', reading: 'Reading', finished: 'Finished' };

// Local Storage CRUD Manager
class ReadingListManager {
    constructor(storageKey = 'imybook_records') {
        this.storageKey = storageKey;
    }

    // READ: Retrieve all records and deserialize JSON string to BookItem objects
    getAllBooks() {
        let parsedArray = [];
        try {
            const rawData = localStorage.getItem(this.storageKey);
            if (!rawData) return [];
            parsedArray = JSON.parse(rawData);
        } catch (e) {
            return [];                       // corrupted or blocked storage: start empty
        }
        if (!Array.isArray(parsedArray)) return [];
        return parsedArray.map(item => new BookItem(
            item.id, item.title, item.author, item.category,
            item.pageCount, item.publishedDate, item.suggestion,
            item.status, item.userNotes,
            {
                key: item.key, currentPage: item.currentPage, rating: item.rating,
                coverId: item.coverId, source: item.source,
                addedAt: item.addedAt, updatedAt: item.updatedAt
            }
        ));
    }

    // READ one record
    getBookById(id) {
        return this.getAllBooks().find(b => b.id === id) || null;
    }

    // Used to stop the same Open Library work being added twice
    findByKey(key) {
        if (!key) return null;
        return this.getAllBooks().find(b => b.key === key) || null;
    }

    // Helper: Serialize array of objects into JSON string (false if storage is full/blocked)
    saveAllBooks(booksArray) {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(booksArray));
            return true;
        } catch (e) {
            return false;
        }
    }

    // CREATE: Add a new book record
    addBook(bookItem) {
        const books = this.getAllBooks();
        books.push(bookItem);
        return this.saveAllBooks(books);
    }

    // UPDATE: Edit an existing book record by ID (only these fields can change)
    updateBook(id, updatedFields) {
        const editable = ['title', 'author', 'category', 'pageCount', 'publishedDate',
                          'status', 'currentPage', 'rating', 'userNotes'];
        const books = this.getAllBooks();
        const index = books.findIndex(b => b.id === id);
        if (index === -1) return false;
        editable.forEach(field => {
            if (updatedFields[field] !== undefined) books[index][field] = updatedFields[field];
        });
        books[index].creator = books[index].author;   // keep parent field in step with author
        books[index].updatedAt = new Date().toISOString();
        return this.saveAllBooks(books);
    }

    // DELETE: Remove a book record by ID
    deleteBook(id) {
        const books = this.getAllBooks();
        const filtered = books.filter(b => b.id !== id);
        if (filtered.length === books.length) return false;
        return this.saveAllBooks(filtered);
    }
}

if (typeof module !== 'undefined') module.exports = { MediaItem, BookItem, ReadingListManager };
