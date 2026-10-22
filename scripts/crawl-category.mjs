#!/usr/bin/env node
/**
 * Crawl all pagination pages of a CineFreak category, dedupe posts, scrape each once.
 * Usage: node scripts/crawl-category.mjs [categoryUrl] [maxPages]
 * Example: node scripts/crawl-category.mjs https://cinefreak.net/bangla-dubbed/ 10
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function decodeHtml(s) {
  return s
    .replace(/&#038;/g, '&')
    .replace(/&#8211;/g, '–')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"');
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'text/html' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function listingPostUrls(html) {
  const urls = new Set();
  const re = /href="(https:\/\/cinefreak\.net\/[^"]+\/)"/g;
  let m;
  while ((m = re.exec(html))) {
    const u = m[1];
    if (!/(download|watch|season|web-dl|web-series)/.test(u)) continue;
    if (/\/(web-series|bangla-movies|english-movies|hindi-movies|bangla-dubbed)\/$/.test(u))
      continue;
    if (u.includes('/page/')) continue;
    urls.add(u);
  }
  return urls;
}

function maxPageFromHtml(html, categoryBase) {
  let max = 1;
  const slug = categoryBase.replace(/\/$/, '').split('/').pop();
  const re = new RegExp(`${slug}/page/(\\d+)`, 'g');
  let m;
  while ((m = re.exec(html))) max = Math.max(max, Number(m[1]));
  const re2 = /pagination-item[^>]*>(\d+)</g;
  while ((m = re2.exec(html))) max = Math.max(max, Number(m[1]));
  return max;
}

function extractWatchLinks(html) {
  const links = new Set();
  const patterns = [
    /class="dlbtn dlbtn-watch"[^>]*href="(https:\/\/[^"]+)"/g,
    /href="(https:\/\/[^"]+)"[^>]*class="dlbtn dlbtn-watch"/g,
    /class="cfs-watch[^"]*"[^>]*href="(https:\/\/[^"]+)"/g,
    /href="(https:\/\/[^"]+)"[^>]*class="cfs-watch[^"]*"/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(html))) links.add(m[1]);
  }
  return [...links];
}

function extractEpisodes(html) {
  const episodes = [];
  const blockRe =
    /<div class="cft-it[^"]*"[^>]*data-k="([^"]+)"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g;
  let m;
  while ((m = blockRe.exec(html))) {
    const key = m[1];
    const chunk = m[2];
    const titleM = chunk.match(/<b>([^<]+)<\/b>/);
    const watchM = chunk.match(/class="cfs-watch[^"]*"[^>]*href="(https:\/\/[^"]+)"/);
    if (watchM) {
      episodes.push({
        key,
        label: titleM ? decodeHtml(titleM[1].trim()) : key,
        watchUrl: watchM[1],
      });
    }
  }
  const seen = new Set();
  return episodes.filter((e) => {
    if (seen.has(e.key)) return false;
    seen.add(e.key);
    return true;
  });
}

function parsePostPage(html, sourceUrl) {
  const titleM = html.match(/<h1 class="page-title">([^<]+)<\/h1>/);
  const posterM = html.match(/wp-post-image"[^>]*src="([^"]+)"/);
  const playApiM = html.match(/const PLAY_API = "([^"]+)";/);
  const ytM = html.match(/data-yt="([^"]+)"/);
  const watchLinks = [...new Set(extractWatchLinks(html))].sort();

  return {
    id: sourceUrl.replace('https://cinefreak.net/', '').replace(/\/$/, ''),
    sourceUrl,
    title: titleM ? decodeHtml(titleM[1].trim()) : sourceUrl,
    poster: posterM ? posterM[1] : null,
    playApi: playApiM ? playApiM[1].replace(/\\\//g, '/') : null,
    youtubeTrailer: ytM ? ytM[1] : null,
    watchLinks,
    episodes: extractEpisodes(html),
  };
}

function listingPageUrl(base, page) {
  const b = base.replace(/\/$/, '');
  if (page <= 1) return `${b}/`;
  return `${b}/page/${page}/`;
}

async function crawlCategory(categoryBase, { maxPages = 10, delayMs = 350 } = {}) {
  const firstHtml = await fetchText(listingPageUrl(categoryBase, 1));
  const detectedMax = maxPageFromHtml(firstHtml, categoryBase);
  const lastPage = Math.min(maxPages || detectedMax, detectedMax);

  const postUrls = new Set(listingPostUrls(firstHtml));
  for (let p = 2; p <= lastPage; p++) {
    const url = listingPageUrl(categoryBase, p);
    process.stdout.write(`Listing page ${p}/${lastPage}: ${url}\n`);
    const html = await fetchText(url);
    for (const u of listingPostUrls(html)) postUrls.add(u);
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
  }

  const sorted = [...postUrls].sort();
  const items = [];
  for (let i = 0; i < sorted.length; i++) {
    const url = sorted[i];
    process.stdout.write(`[${i + 1}/${sorted.length}] ${url.slice(0, 72)}…\n`);
    try {
      const html = await fetchText(url);
      items.push(parsePostPage(html, url));
    } catch (err) {
      items.push({ sourceUrl: url, error: String(err), watchLinks: [], episodes: [] });
    }
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
  }

  return {
    category: categoryBase,
    pagesCrawled: lastPage,
    scrapedAt: new Date().toISOString(),
    count: items.length,
    items,
  };
}

const categoryUrl = process.argv[2] || 'https://cinefreak.net/bangla-dubbed/';
const maxPages = process.argv[3] ? Number(process.argv[3]) : 10;
const outPath = join(ROOT, 'data', 'catalog.json');

const data = await crawlCategory(categoryUrl, { maxPages });
await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, JSON.stringify(data, null, 2), 'utf8');
console.log(`Wrote ${outPath} — ${data.count} titles from ${data.pagesCrawled} listing pages`);
