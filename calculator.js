/* calculator.js - Reading time calculator page */

const $ = function (id) { return document.getElementById(id); };
let settings = Settings.get();

document.addEventListener('DOMContentLoaded', function () {
  $('calcSpeed').value = settings.pagesPerHour;
  $('calcMinutes').value = settings.minutesPerDay;
  $('calcForm').addEventListener('submit', onCalculate);
  $('saveSettingsBtn').addEventListener('click', onSaveSettings);
});

function onCalculate(event) {
  event.preventDefault();
  const out = $('calcResult');
  clearNode(out);

  const result = calcReading({
    pages: $('calcPages').value,
    currentPage: $('calcCurrent').value,
    pagesPerHour: $('calcSpeed').value,
    minutesPerDay: $('calcMinutes').value
  });

  if (!result.ok) {
    showMessage($('calcMessage'), result.error, 'error');
    return;
  }
  showMessage($('calcMessage'), '');

  if (result.finished) {
    showMessage($('calcMessage'), 'You are already on the last page - this book is finished!', 'success');
    return;
  }

  const stats = el('div', { className: 'stats' }, [
    statBox(result.remainingPages + ' pages', 'Pages remaining'),
    statBox(formatDuration(result.hoursNeeded), 'Total reading time'),
    statBox(result.pagesPerDay + ' pages', 'Pages per day'),
    statBox(result.daysToFinish + ' days', 'Finish by ' + formatDate(result.finishDate))
  ]);
  out.appendChild(stats);
}

function statBox(value, label) {
  return el('div', { className: 'stat' }, [el('strong', { text: value }), el('span', { text: label })]);
}

function onSaveSettings() {
  const pph = Number($('calcSpeed').value);
  const mpd = Number($('calcMinutes').value);
  if (!(pph >= 1 && pph <= 300) || !(mpd >= 5 && mpd <= 1440)) {
    showMessage($('calcMessage'), 'Reading speed must be 1-300 pages/hour and daily time 5-1,440 minutes.', 'error');
    return;
  }
  settings = { pagesPerHour: pph, minutesPerDay: mpd };
  if (Settings.save(settings)) {
    showMessage($('calcMessage'), 'Reading speed saved. Book estimates now use these values.', 'success');
    toast('Reading speed saved.');
  } else {
    showMessage($('calcMessage'), 'Could not save settings.', 'error');
  }
}
