const { readFile } = require('node:fs/promises');
const { Script } = require('node:vm');

const requiredFiles = ['index.html', 'styles.css', 'script.js'];

async function validate() {
  const [html, css, javascript] = await Promise.all(
    requiredFiles.map((file) => readFile(file, 'utf8'))
  );

  const checks = [
    [html.includes('<main id="main-content">'), 'index.html must include the main landmark'],
    [html.includes('Manhattan Marriage Bureau'), 'index.html must include the ceremony venue'],
    [html.includes('Keens Steakhouse') && html.includes('Celebration lunch'), 'index.html must include the lunch venue'],
    [html.includes('datetime="2026-10-09T20:00:00-04:00"') && html.includes('8:00 PM') && html.includes('Cocktail party') && html.includes("newlyweds' apartment") && html.includes('shared privately'), 'index.html must include the privacy-safe Friday cocktail party'],
    [html.includes('styles.css') && html.includes('script.js'), 'index.html must load local CSS and JavaScript'],
    [html.includes('id="weather"') && html.includes('id="weather-status" role="status"') && html.includes('id="weather-updated" hidden'), 'index.html must include accessible weather status and persistent live-update time'],
    [(html.match(/data-weather-date="2026-10-0[789]"/g) || []).length === 3, 'index.html must include all three event weather dates'],
    [html.includes('Typical early October conditions are shown') && html.includes('About 68°F') && html.includes('About 54°F') && html.includes('About 30% chance') && (html.match(/data-weather-source>Typical estimate/g) || []).length === 3, 'index.html must clearly label typical weather estimates before live forecasts are available'],
    [html.includes('forecast.weather.gov') && html.includes('rel="noopener noreferrer"'), 'index.html must include a secure direct forecast link'],
    [html.includes('id="theme-toggle"') && html.includes('aria-pressed="false"') && html.includes('id="theme-toggle-label">Dark mode</span>'), 'index.html must include an accessible theme toggle with a stable name'],
    [html.indexOf("'nyc-wedding-theme'") < html.indexOf('href="styles.css"'), 'index.html must apply a stored theme before loading CSS'],
    [css.includes('@media (prefers-reduced-motion: reduce)'), 'styles.css must respect reduced motion'],
    [css.includes(':root[data-theme="dark"]'), 'styles.css must define an explicit dark palette'],
    [css.includes('.theme-toggle') && css.includes('.weather-grid'), 'styles.css must style theme and weather controls'],
    [css.includes('@media (min-width: 561px)') && css.includes('@media (min-width: 821px)'), 'styles.css must progressively enhance its mobile-first layout'],
    [css.includes(':focus-visible'), 'styles.css must provide visible keyboard focus'],
    [css.includes('.theme-toggle[aria-pressed="true"]') && css.includes('.timeline li { grid-template-columns: minmax(0, 1fr); gap: 0.35rem; }'), 'styles.css must show selected dark mode and stack the narrow timeline'],
    [css.includes('body {\n    min-width: 0;'), 'styles.css must not force narrow viewports wider than the available page'],
    [javascript.includes("icon.textContent = isDark ? '☾' : '☀'"), 'script.js must provide immediate visual theme feedback'],
    [javascript.includes('api.open-meteo.com') && javascript.includes('WEATHER_FORECAST_DAYS = 16'), 'script.js must use the bounded no-key forecast provider'],
    [javascript.includes('WEATHER_REFRESH_MS = 30 * 60 * 1000') && javascript.includes('startWeatherUpdates') && javascript.includes("source.textContent = 'Live forecast'"), 'script.js must refresh live data and clearly label its source'],
    [javascript.includes("EVENT_DATES.filter((date) => date >= today)") && !javascript.includes("return 'underway'"), 'script.js must continue loading remaining forecasts throughout the event window'],
    [javascript.includes('AbortController') && javascript.includes('response.ok'), 'script.js must handle forecast timeout and HTTP failures'],
    [javascript.includes('THEME_STORAGE_KEY') && javascript.includes('prefers-color-scheme: dark'), 'script.js must persist theme preference and follow the system default'],
    [!javascript.includes('innerHTML'), 'script.js must render without innerHTML']
  ];

  for (const [passes, message] of checks) {
    if (!passes) throw new Error(message);
  }

  new Script(javascript, { filename: 'script.js' });
  console.log(`Validated ${requiredFiles.length} production files successfully.`);
}

validate().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
