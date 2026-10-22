# How CineFreak stores and shows movies (reverse-engineered)

This is a technical summary for building your own **catalog + deep links** site—not a guide to copying copyrighted streams.

## 1. WordPress catalog (they do not host video files)

- CineFreak is a **WordPress** site with custom theme (`cinefreakv2`).
- Each movie/series is a **post** with SEO title, poster image on `cinefreak.net/wp-content/uploads/...`, and metadata (tags, Rank Math schema).
- Category archives like `/bangla-dubbed/page/4/` are normal **paginated listing pages** (~30 cards per page).

## 2. Where the actual video lives

They state they **do not host files**. On each post you get:

| Layer | What it is |
|--------|------------|
| **CineCloud links** | `https://new5.cinecloud.site/f/<token>` — “Watch Online” / per-quality buttons |
| **Inline player** | `<iframe id="appStreamPlayer">` loaded **after click**, URL returned by their API |
| **Play API** | `POST https://cinefreak.net/wp-json/cf/v1/pl/<opaque-post-key>` with `op=play&ep=m` (movie) or episode id |
| **Turnstile** | API responds `{"need":"ts"}` until Cloudflare Turnstile completes in the browser |
| **Server-side resolver** | Their `cf-player.php` maps post/episode → CineCloud file ids (not exposed in HTML) |

So: **HTML = marketing + links + player shell; playback = CineCloud + optional proxied player iframe after bot check.**

## 3. Movies vs web series UI

- **Movies:** “Download / Watch Online” rows per quality (`dlbtn-watch` → CineCloud).
- **Series:** Episode cards (`cft-it`, `cfs-watch`) with combo packs and per-episode watch links—same CineCloud host.
- **Trailers:** Optional YouTube (`data-yt` → `youtube-nocookie.com/embed/...`).

## 4. What your mirror site does (legitimate pattern)

1. **Crawl** category listing pages → collect post URLs (deduped).
2. **Scrape** each post → title, poster, **public** CineCloud watch URLs, episode list.
3. **Display** your own grid; **play** via new tab (CineCloud blocks cross-site iframes with `X-Frame-Options: SAMEORIGIN`).
4. **Credit** source (`sourceUrl` on every item).

Re-hosting or stripping ads from third-party players without rights is high legal risk; this project is an **index + deep link** demo.
