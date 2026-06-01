/**
 * Catholic Bible Citation Parser
 * 
 * Supports full Catholic citation format:
 *   BOOK CHAPTER:VERSEPART(.VERSEPART)* (;BOOK CHAPTER:VERSEPART(.VERSEPART)*)*
 * 
 * Examples:
 *   yoh3:16                  → single verse
 *   gal1:13-24               → verse range
 *   gal1:13-999              → verse 13 to end of chapter (999 clamped)
 *   gal1:13-999;gal2:1-10    → semicolon-separated multi-reference
 *   mzm91:1-2.14-16          → dot-chained non-contiguous ranges
 *   mzm91:15ab               → sub-verse: first two clauses of verse 15
 *   mzm91:15c                → sub-verse: third clause of verse 15
 *   mzm91:1-2.14-15ab.15c-16 → complex chained with sub-verses
 *   mzm91                    → full chapter
 *   t-estb:1-5               → special: Esther Greek (alphabetic chapters)
 *   t-dan3:24-90             → special: Daniel Greek additions
 */

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.BibleCitationParser = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {

  // ── Clause Splitter ──────────────────────────────────────
  // Splits verse text into sub-verse parts (a, b, c, d...)
  // Priority: semicolons > colons (in context) > commas
  // Respects parenthetical and quoted segments
  
  function splitVerseIntoClauses(text) {
    if (!text || typeof text !== 'string') return [text || ''];

    const clauses = [];
    let current = '';
    let depth = 0;  // parenthetical depth
    let inQuote = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];

      if (ch === '(' || ch === '[') depth++;
      else if (ch === ')' || ch === ']') depth--;
      else if (ch === '"' || ch === '"') inQuote = !inQuote;

      // Split markers — only at depth 0, not in quotes
      if (depth === 0 && !inQuote) {
        // Semicolons always split
        if (ch === ';') {
          if (current.trim()) clauses.push(current.trim());
          current = '';
          continue;
        }
        // Colons split (these are narrative pauses in Indonesian)
        // But NOT if followed by a digit (could be a reference like 3:16)
        if (ch === ':' && (i + 1 >= text.length || !/\d/.test(text[i + 1]))) {
          if (current.trim()) clauses.push(current.trim());
          current = '';
          continue;
        }
        // Commas split — but only if followed by a space and then
        // a conjunction or new clause (heuristic)
        if (ch === ',' && i + 1 < text.length) {
          const rest = text.slice(i + 1).trimStart();
          // Split on comma if next part starts with a conjunction,
          // a new subject, or is long enough to be a separate clause
          const conjunctionStart = /^(tetapi|namun|sedangkan|karena|sebab|supaya|agar|jika|kalau|apabila|ketika|sementara|lalu|maka|oleh|kepada|dengan|bahwa|sebagaimana|seperti|sebelum|sesudah|setelah)/i;
          if (conjunctionStart.test(rest)) {
            if (current.trim()) clauses.push(current.trim());
            current = '';
            continue;
          }
        }
      }

      current += ch;
    }

    if (current.trim()) clauses.push(current.trim());

    // If we only got 1 clause from punctuation splitting,
    // try comma-based splitting as fallback
    if (clauses.length <= 1 && text.includes(',')) {
      return text.split(',').map(s => s.trim()).filter(Boolean);
    }

    return clauses.length > 0 ? clauses : [text];
  }

  // ── Sub-verse Resolver ───────────────────────────────────
  // Given a verse text and sub-verse letters (e.g., 'ab', 'c'),
  // extract the relevant clause(s)
  
  function extractSubVerses(verseText, letters) {
    if (!letters || !verseText) return { text: verseText || '', parts: [] };

    const clauses = splitVerseIntoClauses(verseText);
    const result = [];
    const letterArray = letters.toLowerCase().split('');

    for (const letter of letterArray) {
      const index = letter.charCodeAt(0) - 'a'.charCodeAt(0);
      if (index >= 0 && index < clauses.length) {
        result.push({
          letter: letter,
          index: index,
          text: clauses[index]
        });
      }
    }

    return {
      text: result.map(r => r.text).join(' '),
      parts: result,
      totalClauses: clauses.length
    };
  }

  // ── Citation String Parser ───────────────────────────────

  /**
   * Parse a citation string into structured references.
   * 
   * @param {string} citation - e.g., "mzm91:1-2.14-15ab.15c-16;gal1:13-999"
   * @returns {Array} Parsed references
   * 
   * Each reference: {
   *   book: string,
   *   chapter: string,
   *   verseParts: Array<{
   *     start: number,
   *     end: number|null,
   *     subVerses: string|null  // e.g., 'ab', 'c'
   *   }>
   * }
   */
  function parseCitation(citation) {
    if (!citation || typeof citation !== 'string') return [];

    citation = citation.trim();

    // Split by semicolons for multi-references
    const references = citation.split(';').filter(ref => ref.trim());
    const results = [];

    for (const ref of references) {
      const trimmed = ref.trim();
      if (!trimmed) continue;

      const parsed = parseSingleReference(trimmed);
      if (parsed) results.push(parsed);
    }

    return results;
  }

  function parseSingleReference(ref) {
    // Pattern: BOOK CHAPTER (: VERSEPART (.VERSEPART)*)?
    // BOOK can be: mzm, 1sam, t-est, t-dan, etc.
    // CHAPTER can be: numeric or alphabetic (for t-est: a-f)

    // Special book patterns first
    let match;

    // t-est with alphabetic chapter
    match = ref.match(/^(t-est)([a-f])(?::(.*))?$/i);
    if (match) {
      return {
        book: match[1].toLowerCase(),
        chapter: match[2].toLowerCase(),
        verseParts: match[3] ? parseVerseParts(match[3]) : []
      };
    }

    // t-dan with numeric chapter
    match = ref.match(/^(t-dan)(\d+)(?::(.*))?$/i);
    if (match) {
      return {
        book: match[1].toLowerCase(),
        chapter: match[2],
        verseParts: match[3] ? parseVerseParts(match[3]) : []
      };
    }

    // Standard: BOOK CHAPTER or BOOK CHAPTER:VERSEPARTS
    // Book can start with digit: 1sam, 2kor, etc.
    match = ref.match(/^(\d?[a-zA-Z-]+?)(\d+)(?::(.*))?$/);
    if (match) {
      return {
        book: match[1].toLowerCase(),
        chapter: match[2],
        verseParts: match[3] ? parseVerseParts(match[3]) : []
      };
    }

    return null;
  }

  /**
   * Parse verse parts string like "1-2.14-15ab.15c-16"
   * into array of { start, end, subVerses }
   */
  function parseVerseParts(partsStr) {
    if (!partsStr) return [];

    const parts = partsStr.split('.');
    const results = [];

    for (const part of parts) {
      if (!part.trim()) continue;

      const parsed = parseVersePart(part.trim());
      if (parsed) results.push(parsed);
    }

    return results;
  }

  /**
   * Parse a single verse part like "15ab", "1-2", "14-15ab", "15c-16"
   * 
   * Catholic citation rules:
   *   "15ab"     → verse 15, sub-parts a,b
   *   "1-2"      → verses 1 to 2 (complete)
   *   "14-15ab"  → verse 14 (complete) + verse 15 (sub-parts a,b only)
   *                subVerses applies to the END number only
   *   "15c-16"   → verse 15 (sub-part c only) + verse 16 (complete)
   *                startSubVerses applies to start only
   *   "15a-16c"  → verse 15a through 16c (subVerses on both ends)
   * 
   * Returns { start, end, startSubVerses, endSubVerses }
   */
  function parseVersePart(part) {
    // Pattern: NUMBER(LETTERS)? (- NUMBER(LETTERS)?)?
    // The letters are sub-verse indicators attached to their number
    const match = part.match(/^(\d+)([a-z]*)(?:-(\d+)([a-z]*))?$/i);
    if (!match) return null;

    const start = parseInt(match[1]);
    const startSubVerses = match[2] || null;
    const end = match[3] ? parseInt(match[3]) : null;
    const endSubVerses = match[4] || null;

    // Backward compat: if only start has subVerses and no end, 
    // treat as old single-verse subVerses
    const subVerses = (!end && startSubVerses) ? startSubVerses : null;

    return { 
      start, 
      end, 
      startSubVerses,
      endSubVerses,
      // Legacy field for backward compat
      subVerses
    };
  }

  // ── Book Name Map ────────────────────────────────────────

  const BOOK_NAMES = {
    'kej': 'Kejadian', 'kel': 'Keluaran', 'im': 'Imamat', 'bil': 'Bilangan',
    'ul': 'Ulangan', 'yos': 'Yosua', 'hak': 'Hakim-Hakim', 'rut': 'Rut',
    '1sam': '1 Samuel', '2sam': '2 Samuel', '1raj': '1 Raja-Raja', '2raj': '2 Raja-Raja',
    '1taw': '1 Tawarikh', '2taw': '2 Tawarikh', 'ezr': 'Ezra', 'neh': 'Nehemia',
    'est': 'Ester', 'ayb': 'Ayub', 'mzm': 'Mazmur', 'ams': 'Amsal',
    'pkh': 'Pengkhotbah', 'kid': 'Kidung Agung', 'yes': 'Yesaya', 'yer': 'Yeremia',
    'rat': 'Ratapan', 'yeh': 'Yehezkiel', 'dan': 'Daniel', 'hos': 'Hosea',
    'yl': 'Yoel', 'am': 'Amos', 'ob': 'Obaja', 'yun': 'Yunus',
    'mi': 'Mikha', 'nah': 'Nahum', 'hab': 'Habakuk', 'zef': 'Zefanya',
    'hag': 'Hagai', 'za': 'Zakharia', 'mal': 'Maleakhi',
    'tob': 'Tobit', 'ydt': 'Yudit', 'keb': 'Kebijaksanaan', 'sir': 'Sirakh',
    'bar': 'Barukh', 's-yer': 'Surat Yeremia', '1mak': '1 Makabe', '2mak': '2 Makabe',
    't-est': 'Tambahan Ester', 't-dan': 'Tambahan Daniel',
    'mat': 'Matius', 'mrk': 'Markus', 'luk': 'Lukas', 'yoh': 'Yohanes',
    'kis': 'Kisah Para Rasul', 'rm': 'Roma', '1kor': '1 Korintus', '2kor': '2 Korintus',
    'gal': 'Galatia', 'ef': 'Efesus', 'flp': 'Filipi', 'kol': 'Kolose',
    '1tes': '1 Tesalonika', '2tes': '2 Tesalonika', '1tim': '1 Timotius', '2tim': '2 Timotius',
    'tit': 'Titus', 'flm': 'Filemon', 'ibr': 'Ibrani', 'yak': 'Yakobus',
    '1ptr': '1 Petrus', '2ptr': '2 Petrus', '1yoh': '1 Yohanes', '2yoh': '2 Yohanes',
    '3yoh': '3 Yohanes', 'yud': 'Yudas', 'why': 'Wahyu'
  };

  // ── Data Lookup ──────────────────────────────────────────

  /**
   * Resolve parsed references against Bible JSON data.
   * 
   * @param {Array} references - Output of parseCitation()
   * @param {Object} bibleData - The full Bible JSON object
   * @returns {Array} Resolved verses
   * 
   * Each result: {
   *   book: string,
   *   bookName: string,
   *   chapter: string,
   *   verse: string,
   *   text: string,
   *   subVerse: string|null,
   *   displayRef: string
   * }
   */
  function resolveReferences(references, bibleData) {
    const results = [];
    const MAX_VERSE = 999; // safety clamp

    for (const ref of references) {
      const bookData = bibleData[ref.book];
      if (!bookData) continue;

      const bookName = BOOK_NAMES[ref.book] || bookData.name || ref.book;
      const chapterData = bookData[ref.chapter];
      if (!chapterData) continue;

      // If no verse parts specified, return entire chapter
      if (!ref.verseParts || ref.verseParts.length === 0) {
        const verseKeys = Object.keys(chapterData)
          .filter(k => k !== 'pericopes' && k !== 'name' && k !== 'chapters' && !isNaN(parseInt(k)))
          .sort((a, b) => parseInt(a) - parseInt(b));

        for (const v of verseKeys) {
          results.push({
            book: ref.book,
            bookName: bookName,
            chapter: ref.chapter,
            verse: v,
            text: chapterData[v],
            subVerse: null,
            displayRef: `${bookName} ${ref.chapter}:${v}`
          });
        }
        continue;
      }

      // Process each verse part
      for (const part of ref.verseParts) {
        const endVerse = part.end !== null ? Math.min(part.end, MAX_VERSE) : part.start;

        for (let v = part.start; v <= endVerse; v++) {
          const verseText = chapterData[v];
          if (verseText === undefined) break; // past last verse

          const isStart = (v === part.start);
          const isEnd = (v === endVerse);
          const isSingle = (part.start === endVerse);

          // Determine sub-verse extraction
          // Single verse with subVerses (legacy): "15ab"
          // Range start with startSubVerses: "15c-16" → verse 15 gets 'c'
          // Range end with endSubVerses: "14-15ab" → verse 15 gets 'ab'
          // Middle verses: no sub-verse extraction
          let subVerseLetters = null;

          if (isSingle && part.subVerses) {
            // Legacy: single verse "15ab"
            subVerseLetters = part.subVerses;
          } else if (isSingle && part.startSubVerses) {
            // Single verse with new format
            subVerseLetters = part.startSubVerses;
          } else if (isStart && part.startSubVerses) {
            // Start of range: "15c-16" → verse 15 gets 'c'
            subVerseLetters = part.startSubVerses;
          } else if (isEnd && part.endSubVerses) {
            // End of range: "14-15ab" → verse 15 gets 'ab'
            subVerseLetters = part.endSubVerses;
          }

          if (subVerseLetters) {
            const extracted = extractSubVerses(verseText, subVerseLetters);
            results.push({
              book: ref.book,
              bookName: bookName,
              chapter: ref.chapter,
              verse: v,
              text: extracted.text,
              fullVerseText: verseText,
              subVerse: subVerseLetters,
              parts: extracted.parts,
              totalClauses: extracted.totalClauses,
              displayRef: `${bookName} ${ref.chapter}:${v}${subVerseLetters}`
            });
          } else {
            results.push({
              book: ref.book,
              bookName: bookName,
              chapter: ref.chapter,
              verse: String(v),
              text: verseText,
              subVerse: null,
              displayRef: `${bookName} ${ref.chapter}:${v}`
            });
          }
        }
      }
    }

    return results;
  }

  // ── Convenience: Parse + Resolve ─────────────────────────

  /**
   * Parse a citation string and resolve it against Bible data.
   * One-call convenience wrapper.
   * 
   * @param {string} citation - e.g., "mzm91:1-2.14-15ab.15c-16"
   * @param {Object} bibleData - The full Bible JSON object
   * @returns {Array} Resolved verses
   */
  function parse(citation, bibleData) {
    const refs = parseCitation(citation);
    return resolveReferences(refs, bibleData);
  }

  // ── Public API ───────────────────────────────────────────

  return {
    parseCitation: parseCitation,
    parseSingleReference: parseSingleReference,
    parseVerseParts: parseVerseParts,
    resolveReferences: resolveReferences,
    splitVerseIntoClauses: splitVerseIntoClauses,
    extractSubVerses: extractSubVerses,
    parse: parse
  };

}));
