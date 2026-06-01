const fs = require('fs');
const data = JSON.parse(fs.readFileSync('public/assets/data/kgk.json', 'utf8'));
let fixed = 0;
const normalized = data.map(entry => {
  const id = entry.id || entry.ID;
  let text = entry.text || entry.TEXT || '';
  if (text.includes('%20') || text.includes('%2C')) {
    try { text = decodeURIComponent(text); } catch(e) {
      text = text.replace(/%20/g, ' ').replace(/%2C/g, ',').replace(/%2E/g, '.')
        .replace(/%3B/g, ';').replace(/%3A/g, ':').replace(/%21/g, '!')
        .replace(/%3F/g, '?').replace(/%22/g, '"').replace(/%27/g, "'")
        .replace(/%28/g, '(').replace(/%29/g, ')').replace(/%C2%A0/g, ' ');
    }
    fixed++;
  }
  return { id: String(id), text };
});
fs.writeFileSync('public/assets/data/kgk.json', JSON.stringify(normalized, null, 2));
console.log('Fixed entries:', fixed);
console.log('Total entries:', normalized.length);
console.log('Sample id=2:', JSON.stringify(normalized[1]).slice(0, 200));
