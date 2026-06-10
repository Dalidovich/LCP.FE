# LCP.FE — Frontend for Local Cinema Player

## Overview

Angular 21 standalone application that serves as the web UI for LCP.BE. Browses, edits metadata, and plays local video files streamed from the .NET backend.

## Architecture

```
src/
├── main.ts                          # Bootstrap (standalone)
├── index.html
├── styles.scss
└── app/
    ├── app.ts                       # Root component
    ├── app.config.ts                # App config (router, HttpClient)
    ├── app.routes.ts                # Route definitions
    ├── models/
    │   └── video.ts                 # VideoDto, VideoType, UpdateVideoRequest, PagedResult
    ├── services/
    │   ├── video.service.ts         # Video CRUD + stream URL
    │   └── tag.service.ts           # Tag CRUD
    └── components/
        ├── video-list/              # / — paginated video grid
        ├── video-detail/            # /videos/:id — metadata editor
        ├── video-player/            # /videos/:id/play — HTML5 video player
        └── tag-manager/             # /tags — manage master tag list
```

## Routes

| Path | Component | Description |
|---|---|---|
| `/` | — | Redirects to `/videos` |
| `/videos` | `VideoListComponent` | Paginated grid of non-deleted videos |
| `/videos/:id` | `VideoDetailComponent` | Edit metadata (names, collection, episode, type, tags) |
| `/videos/:id/play` | `VideoPlayerComponent` | Stream video with HTML5 `<video>` |
| `/tags` | `TagManagerComponent` | Add/remove master tags |

## Backend API

API requests are proxied through the Angular dev server (`proxy.conf.json`) to LCP.BE at `http://localhost:5107`. See `LCP.BE/AGENTS.md` for full API reference.

### Endpoints consumed

| Method | Route | Used by |
|---|---|---|
| GET | `/api/videos` | — |
| GET | `/api/videos/paged?page=&pageSize=` | VideoList |
| GET | `/api/videos/{id}` | VideoDetail, VideoPlayer |
| PATCH | `/api/videos/{id}` | VideoDetail |
| DELETE | `/api/videos/{id}` | VideoDetail |
| GET | `/api/videos/{id}/stream` | VideoPlayer (as `<source>` URL) |
| GET | `/api/tags` | VideoDetail, TagManager |
| POST | `/api/tags` | TagManager |
| DELETE | `/api/tags/{tag}` | TagManager |

## Data Model

See `LCP.Domain/Entities/` in the backend repo for the full `VideoMetadata` schema. The frontend mirrors it in `src/app/models/video.ts`.

## Key Conventions

- **Standalone components only** — no NgModules
- **No tests** — project does not use any test runner; `skipTests: true` in `angular.json`
- **No unit test scripts** — `package.json` has no `test` script (only `ng`, `start`, `build`, `watch`)
- **API proxy** — `/api/*` proxied to LCP.BE via `proxy.conf.json`
- **No comments in code** — keep source files clean
- **Router‑based navigation** — no modals or overlays for edit/play
- **SCSS styles** — component-scoped stylesheets
- **Prettier** — `.prettierrc` config present at root

## Build & Run

```bash
npm install
npm start          # ng serve --host 0.0.0.0 --proxy-config proxy.conf.json → http://localhost:4200
```

Requires `LCP.BE` running on port 5107.

## Package Dependencies

- `@angular/*` 21.2.x
- `rxjs` ~7.8.0
- `typescript` ~5.9.2
- `prettier` ^3.8.1 (dev)

## Project References

```
LCP.FE  ← HTTP →  LCP.BE  (.NET 9, port 5107)
```
