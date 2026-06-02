#!/usr/bin/env python3
"""Generate public/assets/data/renungan-index.json from Astro blog content.
Maps ISO dates to blog URLs for finding today's renungan article."""
import os, json, re, yaml
from datetime import datetime
from pathlib import Path

BLOG_DIR = Path(__file__).resolve().parent.parent / "src" / "content" / "blog"
OUTPUT = Path(__file__).resolve().parent.parent / "public" / "assets" / "data" / "renungan-index.json"

def slugify(filename_stem: str) -> str:
    """Convert filename stem to Astro-compatible slug (spaces → hyphens)"""
    return re.sub(r'[\s]+', '-', filename_stem.strip())

def parse_frontmatter(filepath):
    """Extract YAML frontmatter from a markdown file"""
    try:
        content = filepath.read_text(encoding='utf-8')
    except (OSError, FileNotFoundError):
        return None
    
    if not content.startswith('---'):
        return None
    
    parts = content.split('---', 2)
    if len(parts) < 3:
        return None
    
    try:
        return yaml.safe_load(parts[1])
    except:
        return None

def generate():
    entries = []
    
    for filepath in BLOG_DIR.glob('*.md'):
        try:
            fm = parse_frontmatter(filepath)
        except Exception:
            print(f"  SKIP (error): {filepath.name}")
            continue
        
        if not fm:
            continue
        
        tags = fm.get('tags', [])
        title = fm.get('title', '')
        
        # Check if it's a renungan post
        is_renungan = False
        if isinstance(tags, list) and 'Renungan' in tags:
            is_renungan = True
        if 'renungan' in title.lower():
            is_renungan = True
        if 'renungan' in filepath.name.lower():
            is_renungan = True
        
        if not is_renungan:
            continue
        
        published = fm.get('publishedAt')
        if not published:
            continue
        
        # Parse date
        if isinstance(published, datetime):
            date_str = published.strftime('%Y-%m-%d')
        elif hasattr(published, 'strftime'):  # datetime.date also has strftime
            date_str = published.strftime('%Y-%m-%d')
        elif isinstance(published, str):
            date_str = published[:10]  # YYYY-MM-DD
        else:
            continue
        
        # Build URL: /blog/<filename without .md>/
        slug = slugify(filepath.stem)
        url = f"/blog/{slug}/"
        
        entries.append({
            'date': date_str,
            'url': url,
            'title': title
        })
        print(f"  {date_str} → {url}")
    
    # Sort by date, newest first
    entries.sort(key=lambda x: x['date'], reverse=True)
    
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(entries, ensure_ascii=False, indent=2), encoding='utf-8')
    
    print(f"\nGenerated {len(entries)} renungan entries → {OUTPUT}")

if __name__ == '__main__':
    generate()
