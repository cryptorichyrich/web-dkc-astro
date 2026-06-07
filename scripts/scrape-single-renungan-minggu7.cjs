const axios = require('axios');
const cheerio = require('cheerio');
const TurndownService = require('turndown');
const fs = require('fs');
const path = require('path');

const INDONESIAN_MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const INDONESIAN_DAYS = ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'];

(async () => {
    const postUrl = 'https://www.mirifica.net/bacaan-mazmur-tanggapan-dan-renungan-harian-katolik-minggu-7-juni-2026/';
    console.log('Scraping:', postUrl);
    const res = await axios.get(postUrl);
    const post$ = cheerio.load(res.data);

    const rawTitle = post$('h1.entry-title').text().trim();
    console.log('Title:', rawTitle);

    let heroImageUrl = post$('div.td-post-featured-image img, figure img.entry-thumb, .td-module-thumb img').attr('src') || '';

    let pubDateStr = post$('time.entry-date').attr('datetime');
    console.log('Date:', pubDateStr);
    let pubDate = new Date(pubDateStr);

    const titleDateRegex = new RegExp('(' + INDONESIAN_DAYS.join('|') + '),?\\s*(\\d{1,2})\\s+(' + INDONESIAN_MONTHS.join('|') + ')\\s+(\\d{4})', 'i');
    const titleDateMatch = rawTitle.match(titleDateRegex);
    let dayName, dateID;
    if (titleDateMatch) {
        dayName = titleDateMatch[1];
        const td = parseInt(titleDateMatch[2], 10);
        const tm = INDONESIAN_MONTHS.indexOf(titleDateMatch[3]);
        const ty = parseInt(titleDateMatch[4], 10);
        pubDate = new Date(ty, tm, td);
        dateID = td + ' ' + INDONESIAN_MONTHS[tm] + ' ' + ty;
    } else {
        const d = pubDate.getDate();
        const m = INDONESIAN_MONTHS[pubDate.getMonth()];
        const y = pubDate.getFullYear();
        const dayIdx = pubDate.getDay();
        dayName = INDONESIAN_DAYS[dayIdx === 0 ? 6 : dayIdx - 1];
        dateID = d + ' ' + m + ' ' + y;
    }

    const cleanTitle = 'Renungan Harian Katolik, ' + dayName + ', ' + dateID + ', Bacaan, Mazmur, Injil dan Renungan';
    console.log('Clean title:', cleanTitle);

    post$('div.sharedaddy, div.sd-block, div.jetpack-likes-widget-wrapper, div.jp-relatedposts, div.td-related-posts').remove();
    let contentHtml = post$('div.td-post-content.td-pb-padding-side').html() || '';

    const turndown = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-', codeBlockStyle: 'fenced', strongDelimiter: '**' });
    turndown.keep(['iframe']);
    turndown.remove(['script', 'style']);
    let markdownContent = turndown.turndown(contentHtml).replace(/Like this:.*?Loading\.\.\./gi, '').trim();

    const formattedDate = pubDate.getFullYear() + '-' + String(pubDate.getMonth() + 1).padStart(2, '0') + '-' + String(pubDate.getDate()).padStart(2, '0');
    console.log('Formatted date:', formattedDate);

    let excerptText = '';
    const firstStrongP = post$('div.td-post-content p strong').first().parent('p');
    if (firstStrongP.length > 0) {
        let excerptParts = [];
        let el = firstStrongP;
        let totalLength = 0;
        while (el.length > 0 && el.prop('tagName') === 'P' && totalLength < 400) {
            const txt = el.text().trim();
            if (txt) { excerptParts.push(txt); totalLength += txt.length; }
            el = el.next('p');
        }
        excerptText = excerptParts.join(' ');
    }
    if (!excerptText) excerptText = markdownContent.split('\n\n')[0] || 'Renungan harian katolik dari Mirifica.';

    const escapedExcerpt = excerptText.replace(/"/g, '\\"').replace(/\n/g, ' ').substring(0, 300);
    const featuredImage = heroImageUrl || '/assets/img/renungan.webp';

    const frontmatter = '---\n' +
        'title: "' + cleanTitle.replace(/"/g, '\\"') + '"\n' +
        'subtitle: "' + escapedExcerpt.substring(0, 150) + '"\n' +
        'author: "Mirifica (Komsos KWI)"\n' +
        'publishedAt: ' + formattedDate + '\n' +
        'tags: ["Renungan"]\n' +
        'coverImage: "' + featuredImage + '"\n' +
        'thumbnailImage: "' + featuredImage + '"\n' +
        'toc: false\n' +
        'featured: false\n' +
        '---\n\n';

    const fullMarkdown = frontmatter + markdownContent;
    const slug = rawTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
    const filename = 'renungan-harian-' + slug + '.md';
    const projectRoot = path.resolve(__dirname, '..');
    const filepath = path.join(projectRoot, 'src', 'content', 'blog', filename);

    fs.writeFileSync(filepath, fullMarkdown);
    console.log('SAVED:', filename);
    console.log('SIZE:', fullMarkdown.length, 'chars');
})();
