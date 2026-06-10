# LCP.FE — Local Cinema Player (Frontend)

Web UI for LCP.BE. Browse, edit metadata, and stream local video files from the .NET backend.

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
| `/videos` | Paginated video grid |
| `/videos/:id` | Edit metadata |
| `/videos/:id/play` | Stream video |
| `/tags` | Manage master tags |

## Build

```bash
npm run build     # production → dist/
npm run watch     # dev rebuild on change
```
