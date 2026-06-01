import os, re, sys

# cd to summa dir and fix all files
os.chdir(os.path.dirname(os.path.abspath(__file__)))

summa_dir = 'src/content/summa'
if not os.path.isdir(summa_dir):
    print(f"Not found: {summa_dir}")
    sys.exit(1)

part_names = {'1': 'Prima Pars', '2': 'Prima Secundae Partis', '3': 'Secunda Secundae Partis', '4': 'Tertia Pars', '5': 'Supplementum Tertiae Partis'}
part_slugs = {'1': 'part1', '2': 'part2', '3': 'part3', '4': 'part4', '5': 'part5'}
count = 0
errors = []

for fname in sorted(os.listdir(summa_dir)):
    if not fname.endswith('.md'):
        continue
    path = os.path.join(summa_dir, fname)
    try:
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
    except:
        errors.append(f"READ: {fname}")
        continue

    m = re.match(r'^---\n(.*?)\n---\n(.*)', content, re.DOTALL)
    if not m:
        errors.append(f"FM: {fname}")
        continue

    fm_text = m.group(1)
    body = m.group(2)
    
    # Extract from Jekyll frontmatter
    fm = {}
    for line in fm_text.strip().split('\n'):
        # Only parse known keys
        for key in ['title', 'part', 'question_number', 'layout', 'permalink']:
            if line.startswith(f'{key}:'):
                val = line[len(key)+1:].strip().strip('"').strip("'")
                fm[key] = val
                break

    pm = re.match(r'part(\d+)', fname)
    qm = re.search(r'question(\d+)', fname)
    if not pm or not qm:
        errors.append(f"PARSE: {fname}")
        continue
    
    pn, qn = pm.group(1), int(qm.group(1))
    title = fm.get('title', '')
    
    # YAML-safe title
    if '"' in title:
        yt = "title: '" + title + "'"
    elif "'" in title:
        yt = 'title: "' + title + '"'
    else:
        yt = 'title: "' + title + '"'
    
    part = part_names.get(pn, fm.get('part', 'Prima Pars'))
    
    new_fm = (
        '---\n'
        + yt + '\n'
        + 'part: "' + part + '"\n'
        + 'partNum: ' + pn + '\n'
        + 'questionNumber: ' + str(qn) + '\n'
        + 'partSlug: "' + part_slugs[pn] + '"\n'
        + '---\n\n'
        + body.strip()
    )
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(new_fm)
    count += 1

print(f'Fixed {count} files')
if errors:
    print(f'Errors ({len(errors)}):')
    for e in errors:
        print(f'  {e}')
