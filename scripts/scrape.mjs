#!/usr/bin/env node
/**
 * Scrape CineFreak category/list pages and extract watch (stream) URLs.
 * Watch links are hosted on cinecloud.site; inline player uses a Turnstile-protected API.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function decodeHtml(s) {
  return s
    .replace(/&#038;/g, '&')
    .replace(/&#8211;/g, '–')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"');
}

function unescapeJsString(s) {
  try {
    return JSON.parse(`"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`);
  } catch {
    return s.replace(/\\\//g, '/');
  }
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
  return [...urls].sort();
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
  return [...links].sort();
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
    episodes.push({
      key,
      label: titleM ? decodeHtml(titleM[1].trim()) : key,
      watchUrl: watchM ? watchM[1] : null,
    });
  }
  return episodes.filter((e) => e.watchUrl);
}

function parsePostPage(html, sourceUrl) {
  const titleM = html.match(/<h1 class="page-title">([^<]+)<\/h1>/);
  const posterM = html.match(/wp-post-image"[^>]*src="([^"]+)"/);
  const playApiM = html.match(/const PLAY_API = "([^"]+)";/);
  const ytM = html.match(/data-yt="([^"]+)"/);

  const watchLinks = extractWatchLinks(html);
  const episodes = extractEpisodes(html);

  return {
    sourceUrl,
    title: titleM ? decodeHtml(titleM[1].trim()) : sourceUrl,
    poster: posterM ? posterM[1] : null,
    playApi: playApiM ? playApiM[1].replace(/\\\//g, '/') : null,
    youtubeTrailer: ytM ? ytM[1] : null,
    watchLinks,
    episodes,
  };
}

async function scrapeListing(listUrl, { delayMs = 400 } = {}) {
  const listHtml = await fetchText(listUrl);
  const posts = listingPostUrls(listHtml);
  const items = [];

  for (let i = 0; i < posts.length; i++) {
    const url = posts[i];
    process.stdout.write(`[${i + 1}/${posts.length}] ${url}\n`);
    try {
      const html = await fetchText(url);
      items.push(parsePostPage(html, url));
    } catch (err) {
      items.push({ sourceUrl: url, error: String(err), watchLinks: [], episodes: [] });
    }
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
  }

  return { scrapedFrom: listUrl, scrapedAt: new Date().toISOString(), count: items.length, items };
}

const listUrl = process.argv[2] || 'https://cinefreak.net/bangla-dubbed/page/4/';
const outArg = process.argv[3];
const outPath = outArg
  ? outArg.startsWith('/') || /^[A-Za-z]:/.test(outArg)
    ? outArg
    : join(ROOT, outArg)
  : join(ROOT, 'data', 'catalog.json');

const data = await scrapeListing(listUrl);
await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, JSON.stringify(data, null, 2), 'utf8');
console.log(`Wrote ${outPath} (${data.count} items)`);
