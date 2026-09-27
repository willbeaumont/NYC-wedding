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
    [html.includes('styles.css') && html.includes('script.js'), 'index.html must load local CSS and JavaScript'],
    [css.includes('@media (prefers-reduced-motion: reduce)'), 'styles.css must respect reduced motion'],
    [css.includes(':focus-visible'), 'styles.css must provide visible keyboard focus']
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
