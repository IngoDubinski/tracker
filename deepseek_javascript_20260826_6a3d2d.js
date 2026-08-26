// ============================================================
// STATE
// ============================================================
const STATE_KEY = 'tracker_data';
let entries = [];
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();

// ============================================================
// DOM REFS
// ============================================================
const $ = (id) => document.getElementById(id);
const currentDateEl = $('currentDate');
const statusText = $('statusText');
const dayNumber = $('dayNumber');
const timeline = $('timeline');
const avgEl = $('avg');
const rangeEl = $('range');
const forecastEl = $('forecast');
const calendarEl = $('calendar');
const monthTitle = $('monthTitle');
const entryDialog = $('entryDialog');
const entryDate = $('entryDate');
const entryLength = $('entryLength');
const shareDialog = $('shareDialog');
const shareUrl = $('shareUrl');

// ============================================================
// HELPERS
// ============================================================
function formatDate(d) {
  return d.toISOString().split('T')[0];
}

function parseDate(str) {
  const [y, m, day] = str.split('-').map(Number);
  return new Date(y, m - 1, day);
}

function dateKey(d) {
  return formatDate(d);
}

function getDaysBetween(a, b) {
  const diff = b.getTime() - a.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

function getMonthDays(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

function normalizeDate(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

// ============================================================
// STORAGE
// ============================================================
function loadEntries() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data)) return data;
    }
  } catch (_) {}
  return [];
}

function saveEntries() {
  localStorage.setItem(STATE_KEY, JSON.stringify(entries));
}

// ============================================================
// CORE LOGIC
// ============================================================
function getSortedEntries() {
  return [...entries].sort((a, b) => a.date.localeCompare(b.date));
}

function getStats() {
  const sorted = getSortedEntries();
  if (sorted.length < 2) {
    return { avg: null, min: null, max: null, last: sorted.length ? sorted[sorted.length - 1] : null };
  }

  const gaps = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = parseDate(sorted[i - 1].date);
    const curr = parseDate(sorted[i].date);
    gaps.push(getDaysBetween(prev, curr));
  }

  const avg = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
  const min = Math.min(...gaps);
  const max = Math.max(...gaps);
  const last = sorted[sorted.length - 1];

  return { avg, min, max, last, gaps };
}

function getForecast() {
  const stats = getStats();
  if (!stats.avg || !stats.last) return null;
  const lastDate = parseDate(stats.last.date);
  const forecastDate = addDays(lastDate, stats.avg);
  return {
    date: forecastDate,
    avg: stats.avg,
    range: stats.max - stats.min,
  };
}

// ============================================================
// RENDER: HERO
// ============================================================
function renderHero() {
  const sorted = getSortedEntries();
  if (sorted.length === 0) {
    currentDateEl.textContent = '—';
    statusText.textContent = 'Noch keine Daten';
    dayNumber.textContent = '—';
    return;
  }

  const last = parseDate(sorted[sorted.length - 1].date);
  const today = normalizeDate(new Date());
  const days = getDaysBetween(last, today);

  currentDateEl.textContent = last.toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
  statusText.textContent = days === 0 ? 'Heute' : days === 1 ? 'Gestern' : `Vor ${days} Tagen`;
  dayNumber.textContent = days;
}

// ============================================================
// RENDER: TIMELINE
// ============================================================
function renderTimeline() {
  const sorted = getSortedEntries();
  if (sorted.length === 0) {
    timeline.classList.add('empty');
    timeline.innerHTML = '<p class="muted">Füge deinen ersten Eintrag hinzu.</p>';
    return;
  }

  timeline.classList.remove('empty');
  const maxGap = sorted.length > 1 ? Math.max(
    ...sorted.slice(1).map((e, i) => getDaysBetween(parseDate(sorted[i].date), parseDate(e.date)))
  ) : 1;

  let html = '';
  for (let i = 1; i < sorted.length; i++) {
    const prev = parseDate(sorted[i - 1].date);
    const curr = parseDate(sorted[i].date);
    const gap = getDaysBetween(prev, curr);
    const height = Math.max(10, (gap / maxGap) * 120);

    html += `
      <div class="bar-wrap">
        <div class="bar" style="--h:${height}px"></div>
        <div class="bar-date">${gap} Tage</div>
      </div>
    `;
  }

  timeline.innerHTML = html;
}

// ============================================================
// RENDER: STATS
// ============================================================
function renderStats() {
  const stats = getStats();
  const forecast = getForecast();

  avgEl.textContent = stats.avg !== null ? stats.avg : '—';
  rangeEl.textContent = stats.min !== null && stats.max !== null ? `${stats.min}–${stats.max}` : '—';
  forecastEl.textContent = forecast ? `${forecast.avg} Tage` : '—';
}

// ============================================================
// RENDER: CALENDAR
// ============================================================
function renderCalendar() {
  const daysInMonth = getMonthDays(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
  const today = normalizeDate(new Date());

  const sorted = getSortedEntries();
  const actualDates = new Set(sorted.map(e => e.date));

  const forecastDates = new Set();
  const stats = getStats();
  if (stats.avg && stats.last) {
    const lastDate = parseDate(stats.last.date);
    let forecastDate = addDays(lastDate, stats.avg);
    for (let i = 0; i < 6; i++) {
      const key = dateKey(forecastDate);
      if (!actualDates.has(key)) {
        forecastDates.add(key);
      }
      forecastDate = addDays(forecastDate, stats.avg);
    }
  }

  let html = '';
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  for (let i = 0; i < offset; i++) {
    html += '<div></div>';
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(currentYear, currentMonth, day);
    const key = dateKey(date);
    const isToday = dateKey(date) === dateKey(today);
    const isActual = actualDates.has(key);
    const isForecast = forecastDates.has(key);
    const isInRange = isForecast && !isActual;

    let classes = 'calendar-day';
    if (isActual) classes += ' actual';
    else if (isForecast) classes += ' forecast';
    if (isInRange) classes += ' forecast-range';
    if (isToday) classes += ' today';

    let inner = day;
    if (isInRange) {
      inner = `<span class="range"></span>${day}`;
    }

    html += `<div class="${classes}">${inner}</div>`;
  }

  calendarEl.innerHTML = html;

  monthTitle.textContent = new Date(currentYear, currentMonth).toLocaleDateString('de-DE', {
    month: 'long',
    year: 'numeric'
  });
}

// ============================================================
// RENDER ALL
// ============================================================
function renderAll() {
  renderHero();
  renderTimeline();
  renderStats();
  renderCalendar();
}

// ============================================================
// ADD ENTRY
// ============================================================
function addEntry(date, length) {
  const entry = { date, length: length || null };
  entries.push(entry);
  saveEntries();
  renderAll();
}

// ============================================================
// DIALOG: ADD
// ============================================================
$('addBtn').addEventListener('click', () => {
  const today = formatDate(new Date());
  entryDate.value = today;
  entryLength.value = '';
  entryDialog.showModal();
});

$('saveEntry').addEventListener('click', (e) => {
  e.preventDefault();
  const date = entryDate.value;
  const length = parseInt(entryLength.value) || null;
  if (!date) return;
  addEntry(date, length);
  entryDialog.close();
});

entryDialog.addEventListener('close', () => {});

// ============================================================
// SHARE
// ============================================================
$('shareBtn').addEventListener('click', () => {
  const data = JSON.stringify(entries);
  const encoded = btoa(encodeURIComponent(data));
  const url = `${window.location.origin}${window.location.pathname}#data=${encoded}`;
  shareUrl.value = url;
  shareDialog.showModal();
});

$('closeShare').addEventListener('click', () => shareDialog.close());

$('copyBtn').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(shareUrl.value);
    $('copyBtn').textContent = '✅ Kopiert!';
    setTimeout(() => { $('copyBtn').textContent = 'Link kopieren'; }, 2000);
  } catch (_) {
    shareUrl.select();
    document.execCommand('copy');
    $('copyBtn').textContent = '✅ Kopiert!';
    setTimeout(() => { $('copyBtn').textContent = 'Link kopieren'; }, 2000);
  }
});

// ============================================================
// LOAD FROM URL
// ============================================================
function loadFromURL() {
  const hash = window.location.hash;
  if (hash.startsWith('#data=')) {
    try {
      const encoded = hash.substring(6);
      const data = JSON.parse(decodeURIComponent(atob(encoded)));
      if (Array.isArray(data)) {
        entries = data;
        saveEntries();
        renderAll();
        window.location.hash = '';
        return true;
      }
    } catch (_) {}
  }
  return false;
}

// ============================================================
// CLEAR
// ============================================================
$('clearBtn').addEventListener('click', () => {
  if (confirm('Alle Daten wirklich löschen?')) {
    entries = [];
    saveEntries();
    renderAll();
  }
});

// ============================================================
// MONTH NAVIGATION
// ============================================================
$('prevMonth').addEventListener('click', () => {
  if (currentMonth === 0) {
    currentMonth = 11;
    currentYear--;
  } else {
    currentMonth--;
  }
  renderCalendar();
});

$('nextMonth').addEventListener('click', () => {
  if (currentMonth === 11) {
    currentMonth = 0;
    currentYear++;
  } else {
    currentMonth++;
  }
  renderCalendar();
});

// ============================================================
// INIT
// ============================================================
if (!loadFromURL()) {
  entries = loadEntries();
}
renderAll();