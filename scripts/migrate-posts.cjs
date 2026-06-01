#!/usr/bin/env node
/**
 * Migrate Jekyll _posts/ to Astro Content Collections.
 * 
 * Usage: node scripts/migrate-posts.cjs
 * 
 * Reads from: ../web-dkc/_posts/*.md
 * Writes to:  src/content/blog/*.md
 * Copies images if referenced.
 */

const fs = require('fs');
const path = require('path');

const JEKYLL_POSTS = path.resolve(__dirname, '../../web-dkc/_posts');
const ASTRO_BLOG = path.resolve(__dirname, '../src/content/blog');
const DRY_RUN = process.argv.includes('--dry-run');

let migrated = 0;
let errors = 0;

function parseJekyllDate(dateStr) {
  // "2025-10-15 06:00:00 +0700" → Date
  return new Date(dateStr);
}

function convertFrontMatter(raw) {
  const lines = raw.split('\n');
  const result = { tags: [] };
  
  for (const line of lines) {
    const match = line.match(/^(\w[\w-]*):\s*(.+)/);
    if (!match) continue;
    const [, key, val] = match;
    const clean = val.replace(/^["']|["']$/g, '').trim();
    
    switch (key) {
      case 'title': result.title = clean; break;
      case 'subtitle': result.subtitle = clean; break;
      case 'author': result.author = clean; break;
      case 'date': result.publishedAt = parseJekyllDate(clean); break;
      case 'bigimg':
      case 'cover-img': result.coverImage = clean; break;
      case 'thumbnail-img': result.thumbnailImage = clean; break;
      case 'category': result.category = clean; break;
      case 'toc': result.toc = clean === 'true'; break;
      case 'layout':
      case 'comments':
      case 'social-share': break; // Skip Jekyll-specific
    }
  }
  
  // Parse tags: [tag1, tag2] or tag1 tag2
  const tagsMatch = raw.match(/tags:\s*\[(.+?)\]/);
  if (tagsMatch) {
    result.tags = tagsMatch[1].split(',').map(t => t.trim().replace(/^["']|["']$/g, ''));
  }
  
  result.publishedAt = result.publishedAt || new Date();
  return result;
}

function buildAstroFrontMatter(fm) {
  const lines = ['---'];
  lines.push(`title: "${fm.title}"`);
  if (fm.subtitle) lines.push(`subtitle: "${fm.subtitle}"`);
  lines.push(`author: "${fm.author || 'Damai Kasih Channel'}"`);
  lines.push(`publishedAt: ${fm.publishedAt.toISOString()}`);
  if (fm.coverImage) lines.push(`coverImage: "${fm.coverImage}"`);
  if (fm.thumbnailImage) lines.push(`thumbnailImage: "${fm.thumbnailImage}"`);
  lines.push(`tags: [${fm.tags.map(t => `"${t}"`).join(', ')}]`);
  if (fm.category) lines.push(`category: "${fm.category}"`);
  if (fm.toc) lines.push('toc: true');
  lines.push('---');
  lines.push('');
  return lines.join('\n');
}

function migratePost(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  
  // Split front matter from body
  const parts = raw.split('---\n');
  if (parts.length < 3) {
    console.error(`  SKIP: ${path.basename(filePath)} (no front matter)`);
    errors++;
    return;
  }
  
  const fm = convertFrontMatter(parts[1]);
  const body = parts.slice(2).join('---\n').trim();
  
  // Derive slug from filename: "2025-10-15-judul-posting.md" → "judul-posting"
  const basename = path.basename(filePath, '.md');
  const slugMatch = basename.match(/^\d{4}-\d{2}-\d{2}-(.+)$/);
  const slug = slugMatch ? slugMatch[1] : basename;
  
  const outPath = path.join(ASTRO_BLOG, `${slug}.md`);
  const content = buildAstroFrontMatter(fm) + '\n' + body + '\n';
  
  if (DRY_RUN) {
    console.log(`  [DRY] ${slug}.md — ${fm.title}`);
  } else {
    fs.writeFileSync(outPath, content, 'utf-8');
  }
  migrated++;
  return slug;
}

// Main
console.log(`\n📦 Migrating Jekyll posts: ${JEKYLL_POSTS}`);
console.log(`   To Astro: ${ASTRO_BLOG}\n`);

if (DRY_RUN) console.log('   🔍 DRY RUN — no files written\n');

const files = fs.readdirSync(JEKYLL_POSTS).filter(f => f.endsWith('.md'));
console.log(`   Found ${files.length} posts\n`);

// Only process first 5 in dry run, all if not
const toProcess = DRY_RUN ? files.slice(0, 5) : files;

for (const file of toProcess) {
  try {
    const slug = migratePost(path.join(JEKYLL_POSTS, file));
    console.log(`   ✅ ${slug}.md`);
  } catch (e) {
    console.error(`   ❌ ${file}: ${e.message}`);
    errors++;
  }
}

console.log(`\n   Migrated: ${migrated} | Errors: ${errors}`);
if (DRY_RUN) console.log('   Run without --dry-run to write files.\n');
