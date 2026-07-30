# LCP.FE — Local Cinema Player (Frontend)

Web UI for [LCP.BE](https://github.com/anomalyco/LCP.BE). Browse, edit metadata, and stream local video files from the .NET backend.

Angular 21 standalone application with signal-based state, dark/light theming, and a password gate.

## Quick Start

```bash
npm install
npm start
```

Open `http://localhost:4200`. Requires LCP.BE running on port 5107 (API calls are proxied through the Angular dev server).

## Routes

| Path | Description |
|---|---|
| `/` | Redirects to `/videos` |
| `/videos` | Paginated video grid (`?page=` preserved in URL) |
| `/videos/:id` | Edit metadata (names, collection, episode, type, tags) |
| `/videos/:id/play` | Stream video with HTML5 `<video>` |
| `/collections` | Browse collections with thumbnails |
| `/collections/:id` | Videos in a collection |
| `/tags` | Manage master tags |
| `/settings` | Theme, anime speed-up, warm cache, export/import backup |

## Features

- **Password gate** — app-level protection; persists per tab, resets on refresh
- **Dark/light theme** — CSS custom properties toggled via `data-theme`
- **Anime speed-up** — automatically plays anime videos at 2x speed (optional)
- **Video preview** — hover over cards to preview video clips
- **Back navigation** — preserves your place (page number, collection view) when returning from a video
- **Export/Import backup** — download full library ZIP from settings, restore via file upload

## Build

```bash
npm run build     # production → dist/
npm run watch     # dev rebuild on change
```
