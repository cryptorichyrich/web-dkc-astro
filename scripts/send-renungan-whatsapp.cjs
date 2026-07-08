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
  const now = new Date();
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const y = wib.getUTCFullYear();
  const m = String(wib.getUTCMonth() + 1).padStart(2, '0');
  const d = String(wib.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Convert markdown body to styled WhatsApp text.
 */
function bodyToWhatsApp(md) {
  let text = md;

  // ── 1. Cut footer: everything from the first WP image down ──
  const imgIdx = text.search(/\n!\[.*?\]\(https?:\/\/i\d*\.wp\.com/);
  if (imgIdx !== -1) text = text.slice(0, imgIdx);

  // Strip any remaining inline images
  text = text.replace(/!\[.*?\]\(https?:\/\/[^)]+\)/g, '');

  // ── 2. Convert **bold** → *bold* (multi-line safe) ──
  text = text.replace(/\*\*([\s\S]+?)\*\*/g, '*$1*');

  // ── 3. Convert [text](url) → text ──
  text = text.replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g, '$1');

  // ── 4. Clean up list markers ──
  text = text.replace(/^- {2,4}/gm, '  • ');

  // ── 5. Section emoji + separators ──
  const SEP = '\n━━━━━━━━━━━━━━\n';

  // Liturgical header (day, saints, color) — no emoji, just clean
  // Already handled by bold→italic conversion above

  // Bacaan I
  text = text.replace(
    /(^|\n)(\*Bacaan I[^\n]*\*)/g,
    `$1${SEP}📖 $2`
  );

  // Mazmur Tanggapan
  text = text.replace(
    /(^|\n)(\*Mazmur Tanggapan[^\n]*\*)/g,
    `$1${SEP}🎵 $2`
  );

  // Bait Pengantar Injil
  text = text.replace(
    /(^|\n)(\*Bait Pengantar Injil[^\n]*\*)/g,
    `$1${SEP}📯 $2`
  );

  // Bacaan Injil (not always bold-wrapped — handle both, trim trailing spaces)
  text = text.replace(
    /(^|\n)(\*?Bacaan Injil[^\n]*?\*?)[ \t]*(\n)/g,
    (_m, nl, hdr, eol) => `${nl}${SEP}✝️ *${hdr.replace(/\*/g, '').trim()}*${eol}`
  );

  // Renungan
  text = text.replace(
    /(^|\n)(\*Renungan\*)/g,
    `$1${SEP}🙏 $2`
  );

  // ── 6. Separator before HUT section ──
  text = text.replace(
    /(^|\n)(\*HUT Tahbisan[\s\S]*?\*)/g,
    `$1${SEP}🕯️ $2`
  );

  // ── 7. Remove leading separator if it's the very first thing ──
  text = text.replace(/^\n*━━━━━━━━━━━━━━\n/, '');

  // ── 8. Clean double-newlines before separators ──
  text = text.replace(/\n{2,}(━━━━━━━━━━━━━━)/g, '\n$1');
  text = text.replace(/\n{3,}/g, '\n\n');

  // ── 9. Fix orphaned bold markers ──
  text = text.replace(/^\* \*$/gm, '');

  return text.trim();
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
    const now = new Date();
    const yesterday = new Date(now.getTime() + (7 * 60 * 60 * 1000));
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yestStr = [
      yesterday.getUTCFullYear(),
      String(yesterday.getUTCMonth() + 1).padStart(2, '0'),
      String(yesterday.getUTCDate()).padStart(2, '0'),
    ].join('-');
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
  // Normalize line endings (repo may have CRLF on Windows checkout)
  const normalized = mdContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const fmMatch = normalized.match(/^---\n([\s\S]*?)\n---\n?/);
  const bodyRaw = fmMatch ? normalized.slice(fmMatch[0].length).trim() : normalized;

  let title = entry.title;
  if (fmMatch) {
    const t = fmMatch[1].match(/title:\s*["'](.+?)["']/);
    if (t) title = t[1].replace(/\\"/g, '"');
  }

  // 5. Build message — FULL readings with styled sections
  const waBody = bodyToWhatsApp(bodyRaw);

  const message =
    `📖 *${title}*\n\n` +
    `${waBody}`;

  // Safety: GreenAPI limit is 20 000 chars
  const MAX = 19_500;
  let finalMessage = message;
  if (message.length > MAX) {
    // Truncate body at last complete line
    let truncated = waBody.slice(0, MAX - 3);
    truncated = truncated.replace(/\n[^\n]*$/, '');
    finalMessage = `📖 *${title}*\n\n${truncated}\n…`;
    console.warn(`⚠️  Truncated from ${message.length} → ${finalMessage.length} chars`);
  }

  console.log(`📝 Message: ${finalMessage.length} chars`);
  console.log(`📤 Sending to ${CHAT_ID}...`);

  const apiUrl = `${GREEN_API_URL}/waInstance${ID_INSTANCE}/sendMessage/${API_TOKEN}`;
  const { data } = await axios.post(apiUrl,
    { chatId: CHAT_ID, message: finalMessage },
    { headers: { 'Content-Type': 'application/json' }, timeout: 20_000 },
  );

  console.log(`✅ Sent! idMessage: ${data.idMessage}`);

})().catch(err => {
  const detail = err.response?.data || err.message;
  console.error(`❌ Failed: ${JSON.stringify(detail, null, 2)}`);
  process.exit(1);
});
