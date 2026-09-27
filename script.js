document.documentElement.classList.add('js');

const WEDDING_DATE = new Date('2026-10-09T11:00:00-04:00');
const EVENT_DATES = ['2026-10-07', '2026-10-08', '2026-10-09'];
const WEATHER_TIME_ZONE = 'America/New_York';
const WEATHER_FORECAST_DAYS = 16;
const THEME_STORAGE_KEY = 'nyc-wedding-theme';
const OPEN_METEO_URL = new URL('https://api.open-meteo.com/v1/forecast');

OPEN_METEO_URL.search = new URLSearchParams({
  latitude: '40.7128',
  longitude: '-74.0060',
  daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
  temperature_unit: 'fahrenheit',
  timezone: WEATHER_TIME_ZONE,
  start_date: EVENT_DATES[0],
  end_date: EVENT_DATES.at(-1)
}).toString();

function dateInNewYork(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: WEATHER_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addUtcDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function forecastAvailability(now = new Date()) {
  const today = dateInNewYork(now);
  if (today > EVENT_DATES.at(-1)) return 'past';
  if (today > EVENT_DATES[0]) return 'underway';
  if (EVENT_DATES.at(-1) > addUtcDays(today, WEATHER_FORECAST_DAYS - 1)) return 'early';
  return 'available';
}

function weatherDescription(code) {
  if (code === 0) return 'Clear sky';
  if ([1, 2].includes(code)) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if ([45, 48].includes(code)) return 'Foggy';
  if ([51, 53, 55, 56, 57].includes(code)) return 'Drizzle';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Rain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Snow';
  if ([95, 96, 99].includes(code)) return 'Thunderstorms';
  return 'Conditions unavailable';
}

function setWeatherStatus(message, state) {
  const status = document.querySelector('#weather-status');
  if (!status) return;
  status.textContent = message;
  status.dataset.state = state;
}

function validDailyForecast(daily) {
  const keys = [
    'time',
    'weather_code',
    'temperature_2m_max',
    'temperature_2m_min',
    'precipitation_probability_max'
  ];
  if (!daily || !keys.every((key) => Array.isArray(daily[key]))) return false;
  if (!keys.every((key) => daily[key].length === daily.time.length)) return false;
  return EVENT_DATES.every((date) => {
    const index = daily.time.indexOf(date);
    return index >= 0 && [
      daily.weather_code[index],
      daily.temperature_2m_max[index],
      daily.temperature_2m_min[index],
      daily.precipitation_probability_max[index]
    ].every(Number.isFinite);
  });
}

function renderForecast(daily) {
  if (!validDailyForecast(daily)) throw new Error('Malformed forecast payload');

  EVENT_DATES.forEach((date) => {
    const card = document.querySelector(`[data-weather-date="${date}"]`);
    if (!card) return;
    const index = daily.time.indexOf(date);
    card.querySelector('[data-weather-condition]').textContent = weatherDescription(daily.weather_code[index]);
    card.querySelector('[data-weather-high]').textContent = `${Math.round(daily.temperature_2m_max[index])}°F`;
    card.querySelector('[data-weather-low]').textContent = `${Math.round(daily.temperature_2m_min[index])}°F`;
    card.querySelector('[data-weather-rain]').textContent = `${Math.round(daily.precipitation_probability_max[index])}% chance`;
    card.dataset.forecast = 'available';
  });
  setWeatherStatus('The latest New York forecast is available below. Conditions can change, so check again before heading out.', 'success');
}

async function loadWeatherForecast({ now = new Date(), fetchImpl = globalThis.fetch, timeout = 8000 } = {}) {
  const availability = forecastAvailability(now);
  if (availability === 'early') {
    setWeatherStatus('Typical early October conditions are shown below. Check again once October 9 is within the 16-day forecast window.', 'early');
    return 'early';
  }
  if (availability === 'past') {
    setWeatherStatus('These event dates have passed. The forecast link below still shows current New York weather.', 'past');
    return 'past';
  }
  if (availability === 'underway') {
    setWeatherStatus('The event week is underway. Use the direct forecast link below for current New York conditions.', 'past');
    return 'underway';
  }
  if (typeof fetchImpl !== 'function') {
    setWeatherStatus('Live forecast data is unavailable right now. Typical early October estimates remain below, and the direct New York forecast link is available.', 'error');
    return 'error';
  }

  setWeatherStatus('Checking the latest New York forecast…', 'loading');
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetchImpl(OPEN_METEO_URL.toString(), {
      headers: { Accept: 'application/json' },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Forecast request failed with ${response.status}`);
    const payload = await response.json();
    renderForecast(payload.daily);
    return 'success';
  } catch {
    setWeatherStatus('Live forecast data is unavailable right now. Typical early October estimates remain below. Use the direct New York forecast link and check again later.', 'error');
    return 'error';
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

function readStoredTheme() {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

function storeTheme(theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    return true;
  } catch {
    return false;
  }
}

function systemTheme(mediaQuery) {
  return mediaQuery?.matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  const isDark = theme === 'dark';
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;

  const toggle = document.querySelector('#theme-toggle');
  const icon = document.querySelector('.theme-toggle-icon');
  const label = document.querySelector('#theme-toggle-label');
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (toggle) toggle.setAttribute('aria-pressed', String(isDark));
  if (icon) icon.textContent = isDark ? '☾' : '☀';
  if (label) label.textContent = 'Dark mode';
  if (themeColor) themeColor.setAttribute('content', isDark ? '#0d1c18' : '#17352d');
  return theme;
}

function initializeTheme({ mediaQuery = globalThis.matchMedia?.('(prefers-color-scheme: dark)') } = {}) {
  let hasExplicitChoice = readStoredTheme() !== null;
  applyTheme(readStoredTheme() || systemTheme(mediaQuery));

  const toggle = document.querySelector('#theme-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      hasExplicitChoice = true;
      storeTheme(nextTheme);
      applyTheme(nextTheme);
    });
    document.documentElement.classList.add('theme-ready');
  }

  const handleSystemChange = (event) => {
    if (!hasExplicitChoice) applyTheme(event.matches ? 'dark' : 'light');
  };
  if (mediaQuery?.addEventListener) mediaQuery.addEventListener('change', handleSystemChange);
  else mediaQuery?.addListener?.(handleSystemChange);

  return document.documentElement.dataset.theme;
}

const countdown = document.querySelector('#countdown');
function updateCountdown(now = new Date()) {
  if (!countdown) return;
  const millisecondsRemaining = WEDDING_DATE.getTime() - now.getTime();
  if (millisecondsRemaining <= 0) {
    countdown.textContent = 'The New York celebration has arrived.';
    return;
  }
  const days = Math.ceil(millisecondsRemaining / 86_400_000);
  countdown.textContent = `${days} ${days === 1 ? 'day' : 'days'} until the Friday celebration.`;
}

function markCurrentItineraryDay(now = new Date()) {
  const currentDate = dateInNewYork(now);
  document.querySelectorAll('[data-event-date]').forEach((card) => {
    const isToday = card.dataset.eventDate === currentDate;
    card.classList.toggle('is-today', isToday);
    if (isToday) card.setAttribute('aria-current', 'date');
    else card.removeAttribute('aria-current');
  });
}

async function copyAddress(button) {
  const address = button.dataset.copy;
  if (!address) return;
  try {
    await navigator.clipboard.writeText(address);
    showToast('Address copied to clipboard.');
  } catch {
    showToast('Copy was unavailable. Select the address above instead.');
  }
}

let toastTimeout;
function showToast(message) {
  const toast = document.querySelector('#copy-toast');
  if (!toast) return;
  window.clearTimeout(toastTimeout);
  toast.textContent = message;
  toast.classList.add('is-visible');
  toastTimeout = window.setTimeout(() => toast.classList.remove('is-visible'), 2800);
}

document.querySelectorAll('[data-copy]').forEach((button) => {
  button.addEventListener('click', () => copyAddress(button));
});

initializeTheme();
updateCountdown();
markCurrentItineraryDay();
loadWeatherForecast();

globalThis.WeddingApp = {
  applyTheme,
  forecastAvailability,
  initializeTheme,
  loadWeatherForecast,
  renderForecast,
  weatherDescription
};
