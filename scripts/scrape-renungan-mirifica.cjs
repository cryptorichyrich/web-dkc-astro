const axios = require('axios');
const cheerio = require('cheerio');
const TurndownService = require('turndown');
const fs = require('fs');
const path = require('path');

const INDONESIAN_MONTHS = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const INDONESIAN_DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

function toTitleCase(str) {
    return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());
}

function formatDateID(date) {
    const d = date.getDate();
    const m = INDONESIAN_MONTHS[date.getMonth()];
    const y = date.getFullYear();
    return `${d} ${m} ${y}`;
}

function formatDateISO(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

(async () => {
    try {
        const categoryUrl = 'https://www.mirifica.net/category/jendela-alkitab/harian/';
        const res = await axios.get(categoryUrl);
        const $ = cheerio.load(res.data);

        const postLinks = new Set();

        $('#tdi_9 .td-image-wrap, #tdi_9 h3 a').each((i, el) => {
            const href = $(el).attr('href');
            if (href && !href.includes('/author/') && !href.includes('/category/')) {
                postLinks.add(href);
            }
        });

        $('article .entry-title a, .td-module-thumb a, .td-big-grid-post a').each((i, el) => {
            const href = $(el).attr('href');
            if (href && !href.includes('/author/') && !href.includes('/category/')) {
                postLinks.add(href);
            }
        });

        const uniqueUrls = Array.from(postLinks);
        console.log(`Ketemu ${uniqueUrls.length} renungan unik.`);

        const dir = path.join(__dirname, '..', 'src', 'content', 'blog');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        for (const postUrl of uniqueUrls) {
            try {
                console.log(`Scraping: ${postUrl}`);
                const postRes = await axios.get(postUrl);
                const post$ = cheerio.load(postRes.data);

                const rawTitle = post$('h1.entry-title').text().trim() || 'Renungan Harian Mirifica';

                let heroImageUrl = post$('div.td-post-featured-image img, figure img.entry-thumb, .td-module-thumb img').attr('src') || '';

                let pubDateStr = post$('time.entry-date').attr('datetime');
                if (!pubDateStr) throw new Error('Tanggal gak ketemu');
                let pubDate = new Date(pubDateStr);
                let formattedDate = formatDateISO(pubDate);
                let dateID = formatDateID(pubDate);

                const dayPattern = INDONESIAN_DAYS.join('|');
                const titleDateRegex = new RegExp(`(${dayPattern}),?\\s*(\\d{1,2})\\s+(${INDONESIAN_MONTHS.join('|')})\\s+(\\d{4})`, 'i');
                const titleDateMatch = rawTitle.match(titleDateRegex);

                let cleanTitle;
                if (titleDateMatch) {
                    const dayName = titleDateMatch[1];
                    const d = parseInt(titleDateMatch[2], 10);
                    const m = INDONESIAN_MONTHS.indexOf(titleDateMatch[3]);
                    const y = parseInt(titleDateMatch[4], 10);
                    pubDate = new Date(y, m, d);
                    formattedDate = formatDateISO(pubDate);
                    dateID = formatDateID(pubDate);
                    cleanTitle = `Renungan Harian Katolik, ${dayName}, ${dateID}, Bacaan, Mazmur, Injil dan Renungan`;
                } else {
                    const escaped = toTitleCase(rawTitle);
                    cleanTitle = `Renungan ${dateID}, ${escaped}`;
                }

                // Extract scripture
                let scriptureVerse = '';
                let scriptureText = '';
                const injilHeaderP = post$('div.td-post-content p').filter((i, el) => {
                    return post$(el).find('strong').text().trim().startsWith('Bacaan Injil –');
                });

                if (injilHeaderP.length > 0) {
                    const strongText = injilHeaderP.find('strong').text().trim();
                    scriptureVerse = strongText.replace(/^Bacaan Injil\s*–\s*/, '').trim();

                    let shortDesc = injilHeaderP.find('em').text().trim();
                    let current = injilHeaderP;
                    if (!shortDesc) {
                        current = current.next('p');
                        shortDesc = current.find('em').text().trim() || current.text().trim();
                    }

                    let textParts = shortDesc ? [shortDesc] : [];
                    let nextEl = shortDesc ? current.next('p') : injilHeaderP.next('p');
                    while (nextEl.length > 0 && nextEl.prop('tagName') === 'P') {
                        const txt = nextEl.text().trim();
                        if (txt) textParts.push(txt);
                        if (txt.includes('Demikianlah Sabda Tuhan') || txt.includes('Demikianlah Injil Tuhan')) break;
                        nextEl = nextEl.next();
                    }
                    scriptureText = textParts.join('\n\n');
                }

                // Clean content
                post$('div.sharedaddy, div.sd-block, div.jetpack-likes-widget-wrapper, div[class*="jetpack-likes"], div[class*="sd-like"], div.jp-relatedposts, div.td-related-posts').remove();

                let contentHtml = post$('div.td-post-content.td-pb-padding-side').html() || '';
                contentHtml = contentHtml.replace(/Like this:.*?Loading\.\.\./gi, '').trim();

                const turndown = new TurndownService({
                    headingStyle: 'atx',
                    bulletListMarker: '-',
                    codeBlockStyle: 'fenced',
                    strongDelimiter: '**'
                });
                turndown.keep(['iframe']);
                turndown.remove(['script', 'style']);

                let markdownContent = turndown.turndown(contentHtml)
                    .replace(/Like this:.*?Loading\.\.\./gi, '')
                    .trim();

                if (!rawTitle || rawTitle === 'Renungan Harian Mirifica') {
                    console.log(`Skip (judul default/kosong): ${postUrl}`);
                    continue;
                }

                if (markdownContent.length < 100) {
                    console.log(`Skip (konten terlalu pendek): ${postUrl}`);
                    continue;
                }

                // Extract excerpt
                let excerptText = '';
                const firstStrongP = post$('div.td-post-content p strong').first().parent('p');
                if (firstStrongP.length > 0) {
                    let excerptParts = [];
                    let el = firstStrongP;
                    let totalLength = 0;
                    while (el.length > 0 && el.prop('tagName') === 'P' && totalLength < 400) {
                        const txt = el.text().trim();
                        if (txt) {
                            excerptParts.push(txt);
                            totalLength += txt.length;
                        }
                        el = el.next('p');
                    }
                    excerptText = excerptParts.join(' ');
                }
                if (!excerptText) excerptText = markdownContent.split('\n\n')[0] || 'Renungan harian katolik dari Mirifica.';

                const escapedExcerpt = excerptText.replace(/"/g, '\\"').replace(/\n/g, ' ').substring(0, 300);
                const featuredImage = heroImageUrl || '/assets/img/renungan.webp';

                // Astro content collection frontmatter format
                const frontmatter = `---
title: "${cleanTitle.replace(/"/g, '\\"')}"
subtitle: "${escapedExcerpt.substring(0, 150)}"
author: "Mirifica (Komsos KWI)"
publishedAt: ${formattedDate}
tags: ["Renungan"]
coverImage: "${featuredImage}"
thumbnailImage: "${featuredImage}"
toc: false
featured: false
---

`;

                const fullMarkdown = frontmatter + markdownContent;

                const slug = rawTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
                const filename = `renungan-harian-${slug}.md`;
                const filepath = path.join(dir, filename);

                if (fs.existsSync(filepath)) {
                    console.log(`Skip (sudah ada): ${filename}`);
                    continue;
                }

                fs.writeFileSync(filepath, fullMarkdown);
                console.log(`Sukses simpan: ${filename}`);

                await new Promise(resolve => setTimeout(resolve, 1000));

            } catch (err) {
                console.error(`Gagal ${postUrl}: ${err.message}`);
            }
        }

        console.log('\nSemua renungan selesai di-scrape.');

    } catch (error) {
        console.error('Fatal:', error.message);
    }
})();
