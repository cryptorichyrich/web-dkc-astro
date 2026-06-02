#!/usr/bin/env python3
"""Scrape full liturgical calendar data for 2026 from imankatolik.or.id"""
import requests, re, json, os
from bs4 import BeautifulSoup

YEAR = 2026
OUTPUT = os.path.join(os.path.dirname(__file__), "..", "public", "assets", "data", "liturgical-2026.json")

def scrape_month(month, year):
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
        
        # Bacaan: lines between perayaan end and BcO
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

all_data = {}
for m in range(1, 13):
    try:
        month_data = scrape_month(m, 2026)
        all_data.update(month_data)
    except Exception as e:
        print(f"ERROR month {m}: {e}")

os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
with open(OUTPUT, 'w', encoding='utf-8') as f:
    json.dump(all_data, f, ensure_ascii=False, indent=2)

print(f"\nDone! Saved {len(all_data)} days to {OUTPUT}")
