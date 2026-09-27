const test = require('node:test');
const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const { Script } = require('node:vm');

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

test('provides keyboard, mobile, and reduced-motion styling', () => {
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media \(max-width: 560px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);

  for (const selector of ['.wordmark', '.nav-links a', '.text-link', '.button', '.site-footer a']) {
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
  assert.match(javascript, /2026-10-09T11:00:00-04:00/);
  assert.match(javascript, /America\/New_York/);
  assert.match(javascript, /navigator\.clipboard\.writeText/);
  assert.doesNotMatch(javascript, /innerHTML\s*=/);
});
