// Copies the static site into www/ for the Android app (Capacitor's webDir).
// The site itself stays the source of truth; www/ is generated and git-ignored.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'www');
const items = ['index.html', 'css', 'js', 'assets', 'data'];
const skip = (p) => /(^|\/)\.(lock|gitkeep|DS_Store)$|\.tmp$/.test(p);

fs.rmSync(out, { recursive: true, force: true });
for (const item of items) {
  fs.cpSync(path.join(root, item), path.join(out, item), {
    recursive: true,
    filter: (src) => !skip(path.relative(root, src)),
  });
}
let bytes = 0;
const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); f.isDirectory() ? walk(p) : (bytes += fs.statSync(p).size); } };
walk(out);
console.log(`www/ ready: ${(bytes / 1048576).toFixed(1)} MB`);
