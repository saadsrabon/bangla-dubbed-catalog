const grid = document.getElementById('grid');
const search = document.getElementById('search');
const stats = document.getElementById('stats');

function primaryWatch(item) {
  if (item.watchLinks?.length) return item.watchLinks[0];
  if (item.episodes?.length) return item.episodes[0].watchUrl;
  return null;
}

function linkCount(item) {
  const ep = item.episodes?.length || 0;
  const wl = new Set(item.watchLinks || []).size;
  return ep + wl;
}

function itemId(item, index) {
  return item.id || String(index);
}

function renderCard(item, index) {
  const watch = primaryWatch(item);
  const id = itemId(item, index);
  const href = watch ? `/watch?id=${encodeURIComponent(id)}` : item.sourceUrl;
  const external = !watch;

  const card = document.createElement('a');
  card.className = 'card';
  card.href = href;
  if (external) {
    card.target = '_blank';
    card.rel = 'noopener noreferrer';
  }

  const img = document.createElement('img');
  img.src = item.poster || 'https://placehold.co/400x600/1a1a24/666?text=No+Poster';
  img.alt = item.title;
  img.loading = 'lazy';

  const meta = document.createElement('div');
  meta.className = 'meta';
  const h2 = document.createElement('h2');
  h2.textContent = item.title;
  meta.appendChild(h2);

  const n = linkCount(item);
  if (n > 0) {
    const b = document.createElement('span');
    b.className = 'badge';
    b.textContent = `${n} stream link${n === 1 ? '' : 's'}`;
    meta.appendChild(b);
  }

  card.append(img, meta);
  return card;
}

let catalog = [];
let meta = {};

async function init() {
  const res = await fetch('/catalog.json');
  const data = await res.json();
  catalog = data.items || [];
  meta = data;
  if (stats) {
    stats.textContent = `${catalog.length} titles · ${meta.pagesCrawled || '?'} listing pages · updated ${new Date(meta.scrapedAt || Date.now()).toLocaleDateString()}`;
  }
  draw('');
}

function draw(q) {
  grid.replaceChildren();
  const query = q.trim().toLowerCase();
  catalog.forEach((item, index) => {
    if (query && !item.title.toLowerCase().includes(query)) return;
    grid.appendChild(renderCard(item, index));
  });
}

search.addEventListener('input', () => draw(search.value));
init();
