const params = new URLSearchParams(location.search);
const id = params.get('id');

const titleEl = document.getElementById('title');
const player = document.getElementById('player');
const openTab = document.getElementById('open-tab');
const sourceLink = document.getElementById('source-link');
const altLinks = document.getElementById('alt-links');
const embedNote = document.getElementById('embed-note');
const episodeList = document.getElementById('episode-list');

function allWatchUrls(item) {
  const urls = [...new Set([...(item.watchLinks || []), ...(item.episodes || []).map((e) => e.watchUrl).filter(Boolean)])];
  return urls;
}

async function main() {
  if (!id) {
    titleEl.textContent = 'Missing title id';
    return;
  }

  const res = await fetch('/catalog.json');
  const data = await res.json();
  const item = (data.items || []).find((x, i) => (x.id || String(i)) === id);
  if (!item) {
    titleEl.textContent = 'Not found';
    return;
  }

  titleEl.textContent = item.title;
  sourceLink.href = item.sourceUrl;

  if (item.episodes?.length && episodeList) {
    episodeList.replaceChildren();
    const h = document.createElement('h2');
    h.textContent = 'Episodes';
    episodeList.appendChild(h);
    const ul = document.createElement('ul');
    for (const ep of item.episodes) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = ep.watchUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = ep.label;
      li.appendChild(a);
      ul.appendChild(li);
    }
    episodeList.appendChild(ul);
  }

  const urls = allWatchUrls(item);
  const stream = urls[0];

  if (!stream) {
    titleEl.textContent += ' (no direct links)';
    openTab.href = item.sourceUrl;
    openTab.textContent = 'Open on CineFreak';
    player?.remove();
    return;
  }

  openTab.href = stream;
  if (player) {
    player.src = stream;
    player.addEventListener('load', () => embedNote?.classList.remove('hidden'));
  }

  urls.slice(1, 12).forEach((url, i) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = `Alternate stream ${i + 2}`;
    li.appendChild(a);
    altLinks.appendChild(li);
  });
}

main();
