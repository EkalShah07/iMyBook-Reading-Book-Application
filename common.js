/* common.js - small DOM helpers shared by every page */

// Create an element: props (className, text, on<Event> handlers, attributes) + children
function el(tag, props, children) {
  const node = document.createElement(tag);
  props = props || {};
  Object.keys(props).forEach(function (key) {
    const value = props[key];
    if (key === 'className') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.indexOf('on') === 0 && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value); // e.g. onClick -> click
    } else if (value !== null && value !== undefined && value !== false) {
      node.setAttribute(key, value);
    }
  });
  (children || []).forEach(function (child) {
    if (child) node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  });
  return node;
}

// Remove every child of a node
function clearNode(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

// Show an inline message (info | success | warn | error) inside a container
function showMessage(container, text, type) {
  clearNode(container);
  if (!text) return;
  container.appendChild(el('div', { className: 'message ' + (type || 'info'), role: 'alert', text: text }));
}

// Short pop-up feedback after an action completes
function toast(text, type) {
  const t = el('div', { className: 'toast ' + (type || 'success'), text: text });
  document.body.appendChild(t);
  setTimeout(function () { t.remove(); }, 2800);
}

// 7.5 hours -> "7 h 30 min"
function formatDuration(hours) {
  const totalMin = Math.round(hours * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return m + ' min';
  if (m === 0) return h + ' h';
  return h + ' h ' + m + ' min';
}

function formatDate(date) {
  return date.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Build a book cover <img>, falling back to a text placeholder if it fails to load
function coverElement(coverId, title) {
  const holder = el('div');
  function placeholder() {
    clearNode(holder);
    holder.appendChild(el('div', { className: 'cover-ph', text: 'No cover' }));
  }
  if (!coverId) {
    placeholder();
    return holder;
  }
  const img = el('img', {
    className: 'cover',
    alt: 'Cover of ' + title,
    src: 'https://covers.openlibrary.org/b/id/' + coverId + '-M.jpg'
  });
  img.addEventListener('error', placeholder);
  holder.appendChild(img);
  return holder;
}

if (typeof module !== 'undefined') module.exports = { formatDuration };
