const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ── GreenAPI config ──────────────────────────────────────────────
const GREEN_API_URL = 'https://1103.api.green-api.com';
const ID_INSTANCE = '1103676791';
const API_TOKEN = '491b374c9c004749b9f0315ba15310cd80403ea9ee8b4ddcbb';
const CHAT_ID = '6281398253186@c.us';   // ← ganti ke group ID untuk production
// ─────────────────────────────────────────────────────────────────

/**
 * Today's date in Asia/Jakarta (GMT+7).
 */
function getTodayWIB() {
  const wib = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  const y = wib.getFullYear();
  const m = String(wib.getMonth() + 1).padStart(2, '0');
  const d = String(wib.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Strip markdown for plain-text WhatsApp.
 */
function cleanMarkdown(text) {
  return text
    .replace(/^#+\s*.+/gm, '')           // headings
    .replace(/\*\*(.+?)\*\*/g, '$1')     // bold → plain
    .replace(/_(.+?)_/g, '$1')           // italic → plain
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links → text
    .replace(/^[-*●]\s+/gm, '')          // list bullets
    .replace(/^\d+\.\s+/gm, '')          // numbered lists
    .replace(/\n{3,}/g, '\n\n')          // collapse blank lines
    .trim();
}

(async () => {
  const today = getTodayWIB();
  console.log(`=== Send Renungan WhatsApp ===`);
  console.log(`Today (WIB): ${today}`);

  // 1. Load renungan index
  const indexPath = path.join(__dirname, '..', 'public', 'assets', 'data', 'renungan-index.json');
  if (!fs.existsSync(indexPath)) {
    console.error(`❌ Index not found: ${indexPath}`);
    process.exit(1);
  }
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));

  // 2. Find today's entry
  let entry = index.find(e => e.date === today);

  if (!entry) {
    // Fallback: try yesterday (in case scraper hasn't run yet)
    const yesterday = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    yesterday.setDate(yesterday.getDate() - 1);
    const y = yesterday.getFullYear();
    const m = String(yesterday.getMonth() + 1).padStart(2, '0');
    const d = String(yesterday.getDate()).padStart(2, '0');
    const yestStr = `${y}-${m}-${d}`;
    entry = index.find(e => e.date === yestStr);
    if (entry) {
      console.log(`⚠️  No entry for ${today}, using ${yestStr}`);
    } else {
      console.error(`❌ No renungan found for ${today} or ${yestStr}`);
      const available = index.slice(0, 5).map(e => e.date).join(', ');
      console.error(`   Latest in index: ${available}`);
      process.exit(1);
    }
  }

  console.log(`📄 ${entry.title}`);
  console.log(`🔗 ${entry.url}`);

  // 3. Read the markdown file
  const slug = entry.url.replace(/^\/blog\//, '').replace(/\/$/, '');
  const mdPath = path.join(__dirname, '..', 'src', 'content', 'blog', `${slug}.md`);

  if (!fs.existsSync(mdPath)) {
    console.error(`❌ Markdown not found: ${mdPath}`);
    process.exit(1);
  }
  const mdContent = fs.readFileSync(mdPath, 'utf-8');

  // 4. Parse frontmatter & body
  const fmMatch = mdContent.match(/^---\n([\s\S]*?)\n---\n?/);
  const body = fmMatch ? mdContent.slice(fmMatch[0].length).trim() : mdContent;

  let title = entry.title;
  let coverImage = '';
  if (fmMatch) {
    const t = fmMatch[1].match(/title:\s*["'](.+?)["']/);
    if (t) title = t[1].replace(/\\"/g, '"');
    const img = fmMatch[1].match(/coverImage:\s*"(.+?)"/);
    if (img) coverImage = img[1];
  }

  // 5. Build message
  const siteUrl = 'https://damaikasihchannel.com';
  const fullUrl = `${siteUrl}${entry.url}`;

  const cleanBody = cleanMarkdown(body);
  const excerpt = cleanBody.substring(0, 400).replace(/\n/g, ' ').trim();
  const ellipsis = cleanBody.length > 400 ? '…' : '';

  const message =
    `📖 *${title}*\n\n` +
    `${excerpt}${ellipsis}\n\n` +
    `📲 Baca selengkapnya:\n${fullUrl}`;

  console.log(`📝 Message: ${message.length} chars`);

  // 6. Send via GreenAPI
  const apiUrl = `${GREEN_API_URL}/waInstance${ID_INSTANCE}/sendMessage/${API_TOKEN}`;
  console.log(`📤 Sending to ${CHAT_ID}...`);

  const { data } = await axios.post(apiUrl,
    { chatId: CHAT_ID, message },
    { headers: { 'Content-Type': 'application/json' }, timeout: 20_000 },
  );

  console.log(`✅ Sent! idMessage: ${data.idMessage}`);
})().catch(err => {
  const detail = err.response?.data || err.message;
  console.error(`❌ Failed: ${JSON.stringify(detail, null, 2)}`);
  process.exit(1);
});
