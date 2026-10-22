# Bangla Dubbed Catalog

Static movie/series **index** built from [CineFreak](https://cinefreak.net/bangla-dubbed/) listing pages. Does not host video—links to public stream URLs found on source posts.

See [docs/CINEFREAK-PIPELINE.md](docs/CINEFREAK-PIPELINE.md) for how CineFreak’s WordPress + CineCloud + Turnstile player works.

## Commands

```bash
npm run crawl:bangla   # all 10 listing pages → data/catalog.json
npm run sync-data      # copy to public/catalog.json
npm run dev            # http://localhost:8765
```

## Deploy

Vercel serves the `public/` folder (`vercel.json`). Commit `public/catalog.json` after crawling so builds stay fast.
