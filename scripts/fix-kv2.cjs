const fs = require('fs');
const data = JSON.parse(fs.readFileSync('public/assets/data/kvii.json', 'utf8'));
// Flatten nested structure: {"Doc": {"1": {"TEXT": "..."}}} -> {"Doc": {"1": "..."}}
let fixed = 0;
const normalized = {};
for (const [docName, paragraphs] of Object.entries(data)) {
  normalized[docName] = {};
  for (const [num, val] of Object.entries(paragraphs)) {
    if (typeof val === 'object' && val !== null && val.TEXT) {
      // Decode URI-encoded text
      let text = val.TEXT;
      try { text = decodeURIComponent(text); } catch(e) {
        text = text.replace(/%20/g, ' ').replace(/%2C/g, ',').replace(/%2E/g, '.')
          .replace(/%3B/g, ';').replace(/%3A/g, ':').replace(/%21/g, '!')
          .replace(/%3F/g, '?').replace(/%22/g, '"').replace(/%27/g, "'")
          .replace(/%28/g, '(').replace(/%29/g, ')');
      }
      normalized[docName][num] = text;
      fixed++;
    } else if (typeof val === 'string') {
      // Already flat, just decode
      let text = val;
      if (text.includes('%20') || text.includes('%2C')) {
        try { text = decodeURIComponent(text); } catch(e) {
          text = text.replace(/%20/g, ' ').replace(/%2C/g, ',');
        }
      }
      normalized[docName][num] = text;
      fixed++;
    }
  }
}
fs.writeFileSync('public/assets/data/kvii.json', JSON.stringify(normalized, null, 2));
console.log('Fixed entries:', fixed);
console.log('Docs:', Object.keys(normalized).length);
const firstDoc = Object.keys(normalized)[0];
const firstEntries = Object.entries(normalized[firstDoc]).slice(0, 2);
console.log('Sample:', JSON.stringify(firstEntries).slice(0, 300));
