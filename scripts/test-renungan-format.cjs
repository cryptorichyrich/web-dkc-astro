/**
 * Self-check: renungan markdown → WhatsApp text must contain NO markdown
 * artifacts that don't render on WhatsApp (#headings, **bold**, links, images).
 *
 * Run: node scripts/test-renungan-format.cjs
 * Exits non-zero if any of the last 10 renungan files fail.
 */
const fs = require('fs');
const path = require('path');
const { bodyToWhatsApp } = require('./send-renungan-whatsapp.cjs');

const dir = path.join(__dirname, '..', 'src', 'content', 'blog');
const files = fs.readdirSync(dir)
  .filter((f) => f.includes('katolik') && f.endsWith('.md'))
  .map((f) => ({ f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
  .sort((a, b) => a.mtime - b.mtime)
  .slice(-10)
  .map((x) => x.f);

let failed = 0;
for (const f of files) {
  const md = fs.readFileSync(path.join(dir, f), 'utf8').replace(/\r\n/g, '\n');
  const fm = md.match(/^---\n[\s\S]*?\n---\n?/);
  const out = bodyToWhatsApp(fm ? md.slice(fm[0].length).trim() : md);

  const issues = [];
  if (/^#{1,6}[ \t]/m.test(out)) issues.push('heading "#" leaked');
  if (out.includes('**')) issues.push('double-asterisk leaked');
  if (/\]\(http/.test(out)) issues.push('markdown link leaked');
  if (/!\[/.test(out)) issues.push('image syntax leaked');
  if (/^-   /m.test(out)) issues.push('raw list marker leaked');

  if (issues.length) {
    failed++;
    console.log(`❌ ${f}\n   → ${issues.join(', ')}`);
  } else {
    console.log(`✅ ${f}`);
  }
}

console.log(failed ? `\n${failed} file(s) FAILED` : `\nAll ${files.length} files OK`);
process.exit(failed ? 1 : 0);
