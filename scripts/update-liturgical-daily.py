#!/usr/bin/env python3
"""
Liturgical Calendar Daily Updater for web-dkc-astro
Updates the current month's data in the static JSON file.
Called by GitHub Actions daily-rebuild workflow.
"""
import requests, json, os, sys
from bs4 import BeautifulSoup
from datetime import datetime, timezone, timedelta

YEAR = datetime.now(timezone(timedelta(hours=7))).year
MONTH = datetime.now(timezone(timedelta(hours=7))).month
OUTPUT = os.path.join(os.path.dirname(__file__), "..", "public", "assets", "data", f"liturgical-{YEAR}.json")


def scrape_month(month, year):
    """Scrape all days from a month page on imankatolik.or.id"""
    url = f"https://www.imankatolik.or.id/kalender.php?b={month}&t={year}"
    print(f"Month {month}/{year}: fetching...")
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    r = requests.get(url, headers=headers, timeout=30)
    r.raise_for_status()
    soup = BeautifulSoup(r.content, 'html.parser')
    
    cells = soup.find_all('td', class_='k_tbl_td')
    print(f"  Found {len(cells)} cells")
    
    days = {}
    for cell in cells:
        date_link = cell.find('a', href=lambda x: x and 'kalender/' in x)
        if not date_link: continue
        day_div = date_link.find('div', class_='k_tgl')
        if not day_div: continue
        try: day_num = int(day_div.get_text(strip=True))
        except ValueError: continue
        
        perayaan_div = cell.find('div', class_='k_perayaan')
        perayaan = perayaan_div.get_text(separator=' ', strip=True) if perayaan_div else 'Hari Biasa'
        perayaan = ' '.join(perayaan.split())
        
        pakaian_td = cell.find('td', class_='k_pakaian')
        warna = pakaian_td.get_text(strip=True) if pakaian_td else 'Hijau'
        warna = warna.replace('Warna Liturgi', '').strip()
        
        cell_text = cell.get_text(separator='\n', strip=True)
        lines = [line.strip() for line in cell_text.split('\n') if line.strip()]
        
        # Extract BcO
        bco_index = -1
        for i, line in enumerate(lines):
            if line == 'BcO': bco_index = i; break
        
        bco = ''
        if bco_index >= 0:
            bco_lines = []
            for j in range(bco_index + 1, len(lines)):
                if lines[j].startswith('Warna Liturgi') or lines[j] == '.': break
                bco_lines.append(lines[j])
            bco = ' '.join(bco_lines).strip()
        
        # Extract Bacaan (between perayaan end and BcO)
        bacaan_lines = []
        perayaan_words = set(perayaan.lower().split())
        started = False
        for i, line in enumerate(lines):
            if not started:
                words = line.lower().split()
                if any(w in perayaan_words for w in words):
                    started = True
                continue
            if line == 'BcO' or line.startswith('Warna Liturgi'): break
            if line and line != str(day_num) and not line.startswith('Warna'):
                bacaan_lines.append(line)
        
        bacaan = ' '.join(bacaan_lines).strip() if bacaan_lines else ''
        
        date_key = f"{year}-{month:02d}-{day_num:02d}"
        days[date_key] = {'perayaan': perayaan, 'warna': warna, 'bacaan': bacaan, 'bco': bco}
        print(f"  Day {day_num}: {perayaan} ({warna})")
    
    return days


def main():
    print(f"=== Liturgical Daily Update: {YEAR}-{MONTH:02d} ===")
    
    # Load existing data
    existing = {}
    if os.path.exists(OUTPUT):
        with open(OUTPUT, 'r', encoding='utf-8') as f:
            existing = json.load(f)
        print(f"Loaded {len(existing)} existing days from {OUTPUT}")
    
    # Scrape current month
    try:
        month_data = scrape_month(MONTH, YEAR)
    except Exception as e:
        print(f"ERROR scraping: {e}")
        sys.exit(1)
    
    if not month_data:
        print("No data scraped, aborting")
        sys.exit(1)
    
    # Merge: update current month, keep the rest
    changed = 0
    for key, val in month_data.items():
        old = existing.get(key)
        if old != val:
            existing[key] = val
            changed += 1
    
    # Also scrape next month if we're past the 25th (prepare ahead)
    today = datetime.now(timezone(timedelta(hours=7)))
    if today.day >= 25:
        next_month = MONTH + 1
        next_year = YEAR
        if next_month > 12:
            next_month = 1
            next_year += 1
        print(f"\n--- Pre-fetching next month {next_month}/{next_year} ---")
        try:
            next_data = scrape_month(next_month, next_year)
            for key, val in next_data.items():
                old = existing.get(key)
                if old != val:
                    existing[key] = val
                    changed += 1
        except Exception as e:
            print(f"WARN: Could not pre-fetch next month: {e}")
    
    # Save
    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    with open(OUTPUT, 'w', encoding='utf-8') as f:
        json.dump(existing, f, ensure_ascii=False, indent=2)
    
    print(f"\nUpdated {changed} days. Total: {len(existing)} days saved to {OUTPUT}")
    
    # Signal to CI whether we changed anything
    if changed > 0:
        print("CHANGED=true")
    else:
        print("CHANGED=false")


if __name__ == '__main__':
    main()
