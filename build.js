// build.js
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const templatePath = path.join(srcDir, 'index.template.html');
const outputPath = path.join(__dirname, 'index.html');

const scriptFiles = ['calc.js', 'storage.js', 'image.js', 'export.js', 'vendor/xlsx.min.js', 'app.js'];

const template = fs.readFileSync(templatePath, 'utf8');
const scripts = scriptFiles
  .map((file) => `<script>\n${fs.readFileSync(path.join(srcDir, file), 'utf8')}\n</script>`)
  .join('\n');

if (!template.includes('<!-- APP_SCRIPTS -->')) {
  throw new Error('Template is missing the <!-- APP_SCRIPTS --> placeholder');
}

// Use a function replacer (not a string) so that literal `$&`, `$1`, etc.
// sequences inside the vendored xlsx.min.js source are inserted verbatim
// instead of being interpreted as String.replace special patterns.
const output = template.replace('<!-- APP_SCRIPTS -->', () => scripts);
fs.writeFileSync(outputPath, output, 'utf8');
console.log(`Built ${outputPath} (${(Buffer.byteLength(output, 'utf8') / 1024).toFixed(0)} KB)`);
