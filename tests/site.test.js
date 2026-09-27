const test = require('node:test');
const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const { Script, createContext } = require('node:vm');

let html;
let css;
let javascript;

function declarationsFor(selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `Expected a CSS rule for ${selector}`);
  return match[1];
}

function propertyValue(declarations, property) {
  const escapedProperty = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = declarations.match(new RegExp(`(?:^|;)\\s*${escapedProperty}:\\s*([^;]+)`));
  assert.ok(match, `Expected ${property} declaration`);
  return match[1].trim();
}

function relativeLuminance(color) {
  const namedColors = { white: '#ffffff' };
  const hexColor = namedColors[color.toLowerCase()] || color;
  assert.match(hexColor, /^#[0-9a-f]{6}$/i, `Expected a six-digit hex color, received ${color}`);
  const channels = hexColor.slice(1).match(/.{2}/g).map((channel) => parseInt(channel, 16) / 255);
  const [red, green, blue] = channels.map((channel) => (
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  ));
  return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
}

function contrastRatio(colorA, colorB) {
  const luminances = [relativeLuminance(colorA), relativeLuminance(colorB)].sort((a, b) => b - a);
  return (luminances[0] + 0.05) / (luminances[1] + 0.05);
}

function makeNode() {
  const listeners = {};
  const classes = new Set();
  return {
    textContent: '',
    dataset: {},
    style: {},
    attributes: {},
    classList: {
      add(...names) { names.forEach((name) => classes.add(name)); },
      remove(...names) { names.forEach((name) => classes.delete(name)); },
      toggle(name, force) {
        const shouldAdd = force === undefined ? !classes.has(name) : force;
        if (shouldAdd) classes.add(name);
        else classes.delete(name);
        return shouldAdd;
      },
      contains(name) { return classes.has(name); }
    },
    addEventListener(type, listener) { listeners[type] = listener; },
    dispatch(type) { listeners[type]?.(); },
    setAttribute(name, value) { this.attributes[name] = String(value); },
    removeAttribute(name) { delete this.attributes[name]; },
    getAttribute(name) { return this.attributes[name]; }
  };
}

function executeApp({ storedTheme = null, systemDark = false, storageThrows = false } = {}) {
  class TestDate extends Date {
    constructor(...args) {
      super(...(args.length ? args : ['2026-09-01T16:00:00Z']));
    }

    static now() { return new Date('2026-09-01T16:00:00Z').getTime(); }
  }

  const root = makeNode();
  const status = makeNode();
  const updated = makeNode();
  updated.hidden = true;
  const toggle = makeNode();
  const icon = makeNode();
  const label = makeNode();
  const themeColor = makeNode();
  const countdownNode = makeNode();
  const countdownValueNode = makeNode();
  const countdownLabelNode = makeNode();
  const cards = Object.fromEntries(['2026-10-07', '2026-10-08', '2026-10-09'].map((date) => {
    const fields = {
      '[data-weather-condition]': makeNode(),
      '[data-weather-source]': makeNode(),
      '[data-weather-high]': makeNode(),
      '[data-weather-low]': makeNode(),
      '[data-weather-rain]': makeNode()
    };
    const card = makeNode();
    card.querySelector = (selector) => fields[selector];
    card.fields = fields;
    return [date, card];
  }));
  const mediaListeners = [];
  const mediaQuery = {
    matches: systemDark,
    addEventListener(type, listener) { if (type === 'change') mediaListeners.push(listener); }
  };
  let savedTheme = storedTheme;
  const storage = {
    getItem() {
      if (storageThrows) throw new Error('Storage disabled');
      return savedTheme;
    },
    setItem(key, value) {
      if (storageThrows) throw new Error('Storage disabled');
      savedTheme = value;
    }
  };
  const documentDouble = {
    documentElement: root,
    querySelector(selector) {
      if (selector === '#weather-status') return status;
      if (selector === '#weather-updated') return updated;
      if (selector === '#theme-toggle') return toggle;
      if (selector === '.theme-toggle-icon') return icon;
      if (selector === '#theme-toggle-label') return label;
      if (selector === 'meta[name="theme-color"]') return themeColor;
      if (selector === '#countdown') return countdownNode;
      if (selector === '#countdown-value') return countdownValueNode;
      if (selector === '#countdown-label') return countdownLabelNode;
      const weatherCard = selector.match(/^\[data-weather-date="([^"]+)"\]$/);
      return weatherCard ? cards[weatherCard[1]] : null;
    },
    querySelectorAll() { return []; }
  };
  const context = {
    AbortController,
    Date: TestDate,
    Intl,
    URL,
    URLSearchParams,
    console,
    document: documentDouble,
    fetch: undefined,
    localStorage: storage,
    matchMedia: () => mediaQuery,
    navigator: { clipboard: { writeText: async () => {} } },
    setTimeout,
    clearTimeout
  };
  context.window = context;
  context.globalThis = context;
  const vmContext = createContext(context);
  new Script(javascript, { filename: 'script.js' }).runInContext(vmContext);
  return {
    app: context.WeddingApp,
    cards,
    context,
    countdownLabel: countdownLabelNode,
    countdownValue: countdownValueNode,
    icon,
    label,
    mediaListeners,
    root,
    status,
    updated,
    themeColor,
    toggle,
    getSavedTheme: () => savedTheme
  };
}

function themeToggleAnnouncement(runtime) {
  const state = runtime.toggle.getAttribute('aria-pressed') === 'true' ? 'pressed' : 'not pressed';
  return `${runtime.label.textContent}, ${state}`;
}

test.before(async () => {
  [html, css, javascript] = await Promise.all([
    readFile('index.html', 'utf8'),
    readFile('styles.css', 'utf8'),
    readFile('script.js', 'utf8')
  ]);
});

test('shows distinct arrival and wedding dates', () => {
  assert.match(html, /Wednesday[^<]*is for arriving|Wednesday arrivals/i);
  assert.match(html, /Wednesday, October 7, 2026|October 7-9, 2026/i);
  assert.match(html, /Friday, October 9|2026-10-09/);
  assert.match(html, /Arrival day/);
  assert.match(html, /Wedding day/);
});

test('makes the Friday countdown prominent, responsive, and honest over time', () => {
  assert.match(html, /id="countdown" aria-live="polite" aria-atomic="true"/);
  assert.match(html, /id="countdown-value">Friday<\/span>/);
  assert.match(html, /id="countdown-label">Wedding day · October 9, 2026<\/span>/);

  const valueSize = propertyValue(declarationsFor('.countdown-value'), 'font-size');
  const labelSize = propertyValue(declarationsFor('.countdown-label'), 'font-size');
  assert.equal(valueSize, 'clamp(3.25rem, 8vw, 5.75rem)');
  assert.equal(labelSize, 'clamp(0.76rem, 1.4vw, 0.9rem)');
  assert.ok(3.25 / 0.9 > 3.5, 'The countdown value should be substantially larger than its label');
  assert.equal(propertyValue(declarationsFor('.countdown'), 'max-width'), '100%');

  const runtime = executeApp();
  assert.equal(runtime.countdownValue.textContent, '38');
  assert.equal(runtime.countdownLabel.textContent, 'days until Friday, October 9, 2026');

  runtime.app.updateCountdown(new Date('2026-10-08T16:00:00-04:00'));
  assert.equal(runtime.countdownValue.textContent, '1');
  assert.equal(runtime.countdownLabel.textContent, 'day until Friday, October 9, 2026');

  runtime.app.updateCountdown(new Date('2026-10-09T12:00:00-04:00'));
  assert.equal(runtime.countdownValue.textContent, 'Today');
  assert.match(runtime.countdownLabel.textContent, /Friday, October 9, 2026.*celebration is here/);

  runtime.app.updateCountdown(new Date('2026-10-10T00:00:00-04:00'));
  assert.equal(runtime.countdownValue.textContent, 'Oct 9');
  assert.equal(runtime.countdownLabel.textContent, 'The Friday celebration was held in 2026');
});

test('gives valid 2026 subway payment advice', () => {
  assert.doesNotMatch(html, /MetroCard/i);
  assert.match(html, /OMNY/i);
  assert.match(html, /contactless card or phone/i);
});

test('includes the confirmed ceremony details', () => {
  assert.match(html, /11:00 AM/);
  assert.match(html, /Manhattan Marriage Bureau/);
  assert.match(html, /141 Worth Street/);
  assert.match(html, /New York, NY 10013/);
  assert.match(html, /near City Hall|beside City Hall/i);
});

test('includes the confirmed post-ceremony lunch without inventing its time', () => {
  assert.match(html, /Keens Steakhouse/);
  assert.match(html, /72 West 36th Street/);
  assert.match(html, /New York, NY 10018/);
  assert.match(html, /Celebration lunch/);
  assert.match(html, /Afterward/);
  assert.match(html, /exact lunch timing has not been confirmed|final timing will be shared/i);
});

test('includes the confirmed Friday cocktail party without exposing private logistics', () => {
  const cocktailEvent = html.match(/<li>\s*<time datetime="2026-10-09T20:00:00-04:00">8:00 PM<\/time>[\s\S]*?<\/li>/)?.[0];

  assert.ok(cocktailEvent, 'Expected the 8:00 PM Friday event');
  assert.match(cocktailEvent, /Cocktail party/);
  assert.match(cocktailEvent, /newlyweds' apartment/i);
  assert.doesNotMatch(cocktailEvent, /\d+\s+(?:East|West|E\.|W\.)?\s*[A-Z][a-z]+\s+(?:Street|Avenue|Road)|access code|apartment number/i);
  assert.match(html, /Apartment address and arrival details will be shared privately/i);
});

test('provides both required routes and live-service advice', () => {
  assert.match(html, /West 79th Street \/ Museum area/);
  assert.match(html, /81 St-Museum of Natural History/);
  assert.match(html, /downtown <strong>C train/);
  assert.match(html, /Marriage Bureau[^<]*<span[^>]*>→<\/span> Keens Steakhouse/);
  assert.match(html, /uptown <strong>R or W train/);
  assert.match(html, /Verify live MTA service/i);
  assert.match(html, /https:\/\/new\.mta\.info\//);
});

test('uses semantic landmarks and an accessible skip link', () => {
  for (const landmark of ['<header', '<nav', '<main', '<section', '<footer']) {
    assert.ok(html.includes(landmark), `Expected ${landmark} landmark`);
  }
  assert.match(html, /class="skip-link" href="#main-content"/);
  assert.match(html, /aria-live="polite"/);
  assert.equal((html.match(/<h1/g) || []).length, 1);
});

test('secures every external new-tab link', () => {
  const links = [...html.matchAll(/<a\s+[^>]*href="(https:[^"]+)"[^>]*>/g)].map((match) => match[0]);
  assert.ok(links.length >= 5, 'Expected map, transit, and MTA links');
  for (const link of links) {
    assert.match(link, /target="_blank"/);
    assert.match(link, /rel="noopener noreferrer"/);
  }
  assert.doesNotMatch(html, /href="http:/);
});

test('has no third-party runtime assets', () => {
  assert.doesNotMatch(html, /<(?:script|link)[^>]+(?:src|href)="https?:/i);
  assert.match(html, /href="styles\.css"/);
  assert.match(html, /src="script\.js"/);
});

test('provides a semantic weather fallback and secure direct forecast links', () => {
  assert.match(html, /id="weather"[^>]*aria-labelledby="weather-title"/);
  assert.match(html, /id="weather-status" role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(html, /id="weather-updated" hidden/);
  assert.equal((html.match(/data-weather-date="2026-10-0[789]"/g) || []).length, 3);
  assert.match(html, /Typical early October conditions are shown until a live daily forecast/i);
  assert.equal((html.match(/About 68°F/g) || []).length, 3);
  assert.equal((html.match(/About 54°F/g) || []).length, 3);
  assert.equal((html.match(/About 30% chance/g) || []).length, 3);
  assert.equal((html.match(/data-weather-source>Typical estimate/g) || []).length, 3);
  assert.doesNotMatch(html, /Not available yet|Forecast details will appear here/i);
  assert.match(html, /forecast\.weather\.gov\/MapClick\.php\?lat=40\.7128&amp;lon=-74\.0060/);
  assert.match(html, /open-meteo\.com/);
});

test('renders controlled available forecast data without network access', async () => {
  const runtime = executeApp();
  const daily = {
    time: ['2026-10-07', '2026-10-08', '2026-10-09'],
    weather_code: [0, 3, 61],
    temperature_2m_max: [68.4, 63.2, 59.7],
    temperature_2m_min: [52.2, 50.1, 48.6],
    precipitation_probability_max: [5, 20, 70]
  };
  let requestedUrl;
  const result = await runtime.app.loadWeatherForecast({
    now: new Date('2026-09-25T16:00:00Z'),
    fetchImpl: async (url) => {
      requestedUrl = url;
      return { ok: true, json: async () => ({ daily }) };
    }
  });

  assert.equal(result, 'success');
  assert.match(requestedUrl, /latitude=40\.7128/);
  assert.match(requestedUrl, /longitude=-74\.0060/);
  assert.match(requestedUrl, /timezone=America%2FNew_York/);
  assert.match(requestedUrl, /daily=weather_code%2Ctemperature_2m_max%2Ctemperature_2m_min%2Cprecipitation_probability_max/);
  assert.equal(runtime.cards['2026-10-07'].fields['[data-weather-condition]'].textContent, 'Clear sky');
  assert.equal(runtime.cards['2026-10-07'].fields['[data-weather-high]'].textContent, '68°F');
  assert.equal(runtime.cards['2026-10-09'].fields['[data-weather-low]'].textContent, '49°F');
  assert.equal(runtime.cards['2026-10-09'].fields['[data-weather-rain]'].textContent, '70% chance');
  assert.equal(runtime.cards['2026-10-09'].fields['[data-weather-source]'].textContent, 'Live forecast');
  assert.equal(runtime.cards['2026-10-09'].dataset.forecast, 'live');
  assert.equal(runtime.status.dataset.state, 'success');
  assert.match(runtime.status.textContent, /Live Open-Meteo forecast updated Sep 25, 2026/i);
  assert.equal(runtime.updated.hidden, false);
  assert.match(runtime.updated.textContent, /Last successful live update: Sep 25, 2026/i);

  const lastUpdate = runtime.updated.textContent;
  const refreshResult = await runtime.app.loadWeatherForecast({
    now: new Date('2026-09-25T16:30:00Z'),
    fetchImpl: async () => { throw new Error('refresh failed'); }
  });
  assert.equal(refreshResult, 'error');
  assert.equal(runtime.updated.textContent, lastUpdate, 'A failed refresh should preserve the last successful update time');
});

test('honors the inclusive forecast boundary, avoids early fetches, and handles service failures', async () => {
  const runtime = executeApp();
  let calls = 0;

  assert.equal(
    runtime.app.forecastAvailability(new Date('2026-09-24T16:00:00Z')),
    'available',
    'October 9 should be available on the first day of the inclusive 16-day window'
  );
  assert.equal(runtime.app.forecastAvailability(new Date('2026-09-23T16:00:00Z')), 'early');

  const tooEarly = await runtime.app.loadWeatherForecast({
    now: new Date('2026-09-01T16:00:00Z'),
    fetchImpl: async () => { calls += 1; }
  });
  assert.equal(tooEarly, 'early');
  assert.equal(calls, 0);
  assert.match(runtime.status.textContent, /16-day forecast window/i);

  const failed = await runtime.app.loadWeatherForecast({
    now: new Date('2026-09-25T16:00:00Z'),
    fetchImpl: async () => { throw new Error('offline'); }
  });
  assert.equal(failed, 'error');
  assert.equal(runtime.status.dataset.state, 'error');
  assert.match(runtime.status.textContent, /direct New York forecast link/i);
});

test('continues live requests through the final event day using only remaining dates', async () => {
  const runtime = executeApp();
  const cases = [
    {
      now: new Date('2026-10-08T16:00:00Z'),
      dates: ['2026-10-08', '2026-10-09'],
      start: '2026-10-08',
      end: '2026-10-09'
    },
    {
      now: new Date('2026-10-09T16:00:00Z'),
      dates: ['2026-10-09'],
      start: '2026-10-09',
      end: '2026-10-09'
    }
  ];

  for (const scenario of cases) {
    const daily = {
      time: scenario.dates,
      weather_code: scenario.dates.map(() => 1),
      temperature_2m_max: scenario.dates.map(() => 65),
      temperature_2m_min: scenario.dates.map(() => 53),
      precipitation_probability_max: scenario.dates.map(() => 25)
    };
    let requestedUrl;
    const result = await runtime.app.loadWeatherForecast({
      now: scenario.now,
      fetchImpl: async (url) => {
        requestedUrl = new URL(url);
        return { ok: true, json: async () => ({ daily }) };
      }
    });

    assert.equal(result, 'success');
    assert.equal(runtime.app.forecastAvailability(scenario.now), 'available');
    assert.equal(requestedUrl.searchParams.get('start_date'), scenario.start);
    assert.equal(requestedUrl.searchParams.get('end_date'), scenario.end);
    assert.match(runtime.status.textContent, /Past event-date cards remain labeled as typical estimates/i);
  }

  assert.equal(runtime.app.forecastAvailability(new Date('2026-10-10T16:00:00Z')), 'past');
});

test('refreshes live weather every 30 minutes without overlapping requests', async () => {
  const runtime = executeApp();
  const daily = {
    time: ['2026-10-07', '2026-10-08', '2026-10-09'],
    weather_code: [0, 0, 0],
    temperature_2m_max: [68, 68, 68],
    temperature_2m_min: [54, 54, 54],
    precipitation_probability_max: [10, 10, 10]
  };
  const resolvers = [];
  let calls = 0;
  let refresh;
  let scheduledDelay;
  const updates = runtime.app.startWeatherUpdates({
    nowProvider: () => new Date('2026-09-25T16:00:00Z'),
    fetchImpl: () => {
      calls += 1;
      return new Promise((resolve) => resolvers.push(() => resolve({
        ok: true,
        json: async () => ({ daily })
      })));
    },
    setIntervalImpl(callback, delay) {
      refresh = callback;
      scheduledDelay = delay;
      return 42;
    }
  });

  assert.equal(calls, 1);
  assert.equal(updates.intervalId, 42);
  assert.equal(scheduledDelay, 30 * 60 * 1000);
  const overlapping = refresh();
  assert.equal(calls, 1, 'A refresh must reuse the active request');
  resolvers.shift()();
  await Promise.all([updates.initialLoad, overlapping]);

  const refreshed = refresh();
  assert.equal(calls, 2, 'A completed request should allow the next refresh');
  resolvers.shift()();
  await refreshed;
});

test('falls back safely for malformed, HTTP, and timed-out forecast requests', async () => {
  const runtime = executeApp();
  const availableNow = new Date('2026-09-25T16:00:00Z');

  const malformed = await runtime.app.loadWeatherForecast({
    now: availableNow,
    fetchImpl: async () => ({ ok: true, json: async () => ({ daily: { time: [] } }) })
  });
  assert.equal(malformed, 'error');
  assert.equal(runtime.status.dataset.state, 'error');

  const httpFailure = await runtime.app.loadWeatherForecast({
    now: availableNow,
    fetchImpl: async () => ({ ok: false, status: 503 })
  });
  assert.equal(httpFailure, 'error');
  assert.equal(runtime.status.dataset.state, 'error');

  let requestSignal;
  const timedOut = await runtime.app.loadWeatherForecast({
    now: availableNow,
    timeout: 1,
    fetchImpl: async (url, { signal }) => {
      requestSignal = signal;
      await new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('Request aborted')));
      });
    }
  });
  assert.equal(timedOut, 'error');
  assert.equal(requestSignal.aborted, true);
  assert.equal(runtime.status.dataset.state, 'error');
  assert.match(runtime.status.textContent, /direct New York forecast link/i);
});

test('uses persisted theme choice or system preference and survives blocked storage', () => {
  const persisted = executeApp({ storedTheme: 'dark', systemDark: false });
  assert.equal(persisted.root.dataset.theme, 'dark');
  assert.equal(themeToggleAnnouncement(persisted), 'Dark mode, pressed');
  assert.equal(persisted.icon.textContent, '☾');
  assert.equal(persisted.toggle.getAttribute('aria-label'), undefined);
  assert.equal(persisted.themeColor.getAttribute('content'), '#0d1c18');

  const system = executeApp({ systemDark: true });
  assert.equal(system.root.dataset.theme, 'dark');
  assert.equal(themeToggleAnnouncement(system), 'Dark mode, pressed');
  system.mediaListeners[0]({ matches: false });
  assert.equal(system.root.dataset.theme, 'light');
  assert.equal(themeToggleAnnouncement(system), 'Dark mode, not pressed');
  assert.equal(system.icon.textContent, '☀');
  system.toggle.dispatch('click');
  assert.equal(system.getSavedTheme(), 'dark');
  assert.equal(themeToggleAnnouncement(system), 'Dark mode, pressed');
  system.mediaListeners[0]({ matches: false });
  assert.equal(system.root.dataset.theme, 'dark', 'Explicit selection should ignore later system changes');

  assert.doesNotThrow(() => executeApp({ storageThrows: true, systemDark: true }));
  const blocked = executeApp({ storageThrows: true, systemDark: false });
  blocked.toggle.dispatch('click');
  assert.equal(blocked.root.dataset.theme, 'dark');
  assert.equal(themeToggleAnnouncement(blocked), 'Dark mode, pressed');
  assert.equal(blocked.root.classList.contains('theme-ready'), true);
});

test('hides the theme control until its JavaScript behavior is initialized', () => {
  assert.equal(propertyValue(declarationsFor('.theme-toggle'), 'display'), 'none');
  assert.equal(propertyValue(declarationsFor('.js.theme-ready .theme-toggle'), 'display'), 'inline-flex');

  const initialized = executeApp();
  assert.equal(initialized.root.classList.contains('js'), true);
  assert.equal(initialized.root.classList.contains('theme-ready'), true);
});

test('provides keyboard, mobile-first, and reduced-motion styling', () => {
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media \(min-width: 561px\)/);
  assert.match(css, /@media \(min-width: 821px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);

  const mobileBaseline = css.indexOf('.day-grid, .venue-grid, .notes-grid, .weather-grid { grid-template-columns: 1fr; }');
  const stackedTimeline = css.indexOf('.timeline li { grid-template-columns: minmax(0, 1fr); gap: 0.35rem; }');
  const wideEnhancement = css.indexOf('@media (min-width: 821px)');
  const tabletEnhancement = css.indexOf('@media (min-width: 561px)');
  assert.ok(mobileBaseline >= 0 && mobileBaseline < wideEnhancement, 'Single-column mobile layouts should be the default before wider enhancements');
  assert.ok(stackedTimeline >= 0 && stackedTimeline < tabletEnhancement, 'Timeline labels should stack before the 561px enhancement');
  assert.match(css.slice(tabletEnhancement), /\.timeline li \{ grid-template-columns: 100px 1fr; \}/);
  assert.equal(propertyValue(declarationsFor('body'), 'min-width'), '0');

  for (const selector of ['.wordmark', '.nav-links a', '.text-link', '.button', '.theme-toggle', '.site-footer a']) {
    const minHeight = parseFloat(propertyValue(declarationsFor(selector), 'min-height'));
    assert.ok(minHeight >= 44, `${selector} should have a touch target at least 44px tall`);
  }
});

test('keeps small eyebrow labels at WCAG AA contrast on light sections', () => {
  const eyebrowColor = propertyValue(declarationsFor('.eyebrow'), 'color');
  const lightBackgrounds = [
    propertyValue(declarationsFor(':root'), '--paper'),
    propertyValue(declarationsFor(':root'), '--paper-light'),
    propertyValue(declarationsFor('.travel'), 'background')
  ];

  for (const background of lightBackgrounds) {
    const ratio = contrastRatio(eyebrowColor, background);
    assert.ok(ratio >= 4.5, `${eyebrowColor} on ${background} has only ${ratio.toFixed(2)}:1 contrast`);
  }
});

test('keeps dark body, hero, header, and small tip labels at readable contrast', () => {
  const root = declarationsFor(':root');
  const dark = declarationsFor(':root[data-theme="dark"]');
  const darkInk = propertyValue(dark, '--ink');
  const darkPaper = propertyValue(dark, '--paper');
  const darkMuted = propertyValue(dark, '--text-muted');
  const darkCard = propertyValue(dark, '--surface-card');

  assert.ok(contrastRatio(darkInk, darkPaper) >= 7, 'Dark theme body text should have enhanced contrast');
  assert.ok(contrastRatio(darkMuted, darkCard) >= 4.5, 'Dark theme muted card text should meet WCAG AA');

  const heroForegroundToken = '--hero-foreground';
  const heroForeground = propertyValue(root, heroForegroundToken);
  assert.equal(propertyValue(declarationsFor('.site-header'), 'color'), `var(${heroForegroundToken})`);
  assert.equal(propertyValue(declarationsFor('.hero'), 'color'), `var(${heroForegroundToken})`);
  const heroBackgrounds = [
    propertyValue(root, '--hero-gradient-start'),
    propertyValue(root, '--hero-gradient-end'),
    propertyValue(dark, '--hero-gradient-start'),
    propertyValue(dark, '--hero-gradient-end')
  ];
  assert.match(propertyValue(declarationsFor('.hero::before'), 'background'), /var\(--hero-gradient-start\)[\s\S]*var\(--hero-gradient-end\)/);
  for (const background of heroBackgrounds) {
    const ratio = contrastRatio(heroForeground, background);
    assert.ok(ratio >= 4.5, `Hero foreground on ${background} has only ${ratio.toFixed(2)}:1 contrast`);
  }

  const darkAccent = propertyValue(dark, '--accent-text');
  const darkNotes = propertyValue(dark, '--paper-light');
  assert.equal(propertyValue(declarationsFor('.tips-grid article > span'), 'color'), 'var(--accent-text)');
  assert.ok(
    contrastRatio(darkAccent, darkNotes) >= 4.5,
    `Dark tip labels on notes have only ${contrastRatio(darkAccent, darkNotes).toFixed(2)}:1 contrast`
  );

  assert.match(css, /:root\[data-theme="dark"\] \.venue-card/);
  assert.match(css, /:root\[data-theme="dark"\] \.toast/);
  assert.match(css, /:root:not\(\[data-theme="light"\]\) \.venue-card/);
  assert.match(css, /:root:not\(\[data-theme="light"\]\)[\s\S]*--accent-text:\s*#e0bc78/);
  assert.match(css, /@media print/);
});

test('keeps a high-contrast two-color focus indicator on every surface', () => {
  const focusDeclarations = declarationsFor(':focus-visible');
  const focusColors = [
    propertyValue(focusDeclarations, 'outline'),
    propertyValue(focusDeclarations, 'box-shadow')
  ].flatMap((value) => value.match(/#[0-9a-f]{6}/gi) || []);

  assert.equal(focusColors.length, 2, 'Expected contrasting inner and outer focus-ring colors');

  const surfaceColors = [
    propertyValue(declarationsFor(':root'), '--paper'),
    propertyValue(declarationsFor(':root'), '--paper-light'),
    propertyValue(declarationsFor('.travel'), 'background'),
    propertyValue(declarationsFor('.venue-card'), 'background'),
    propertyValue(declarationsFor(':root'), '--ink'),
    propertyValue(declarationsFor(':root'), '--ink-deep')
  ];

  for (const background of surfaceColors) {
    const bestRatio = Math.max(...focusColors.map((color) => contrastRatio(color, background)));
    assert.ok(
      bestRatio >= 3,
      `Focus indicator on ${background} reaches only ${bestRatio.toFixed(2)}:1 contrast`
    );
  }
});

test('JavaScript parses and enhances rather than hiding core content', () => {
  assert.doesNotThrow(() => new Script(javascript));
  assert.match(javascript, /2026-10-09T00:00:00-04:00/);
  assert.match(javascript, /America\/New_York/);
  assert.match(javascript, /navigator\.clipboard\.writeText/);
  assert.doesNotMatch(javascript, /innerHTML\s*=/);
});
