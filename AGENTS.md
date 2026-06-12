# LCP.FE — Frontend for Local Cinema Player

## Overview

Angular 21 standalone application that serves as the web UI for LCP.BE. Browses, edits metadata, and plays local video files streamed from the .NET backend.

## Architecture

```
src/
├── main.ts                          # Bootstrap (standalone)
├── index.html
├── styles.scss                      # CSS custom property theming (dark/light)
└── app/
    ├── app.config.ts                # App config (router, HttpClient)
    ├── app.routes.ts                # Route definitions
    ├── app.ts / .html / .scss       # Root component (password gate, app logo)
    ├── models/
    │   ├── video.ts                 # VideoDto, VideoType, UpdateVideoRequest, PagedResult
    │   ├── collection.ts            # CollectionDto
    │   └── settings.ts              # SettingsDto
    ├── services/
    │   ├── video.service.ts         # Video CRUD + stream/preview/thumbnail URLs
    │   ├── tag.service.ts           # Tag CRUD
    │   ├── collection.service.ts    # Collection CRUD
    │   └── settings.service.ts      # Settings + password check
    └── components/
        ├── video-list/              # / — paginated video grid (page in query params)
        ├── video-detail/            # /videos/:id — metadata editor
        ├── video-player/            # /videos/:id/play — HTML5 video player (anime 2x speed)
        ├── collection-browser/      # /collections, /collections/:id — browse collections
        ├── tag-manager/             # /tags — manage master tag list
        └── settings/                # /settings — theme, anime speed-up, warm cache
```

## Routes

| Path | Component | Description |
|---|---|---|
| `/` | — | Redirects to `/videos` |
| `/videos` | `VideoListComponent` | Paginated grid of non-deleted videos |
| `/videos/:id` | `VideoDetailComponent` | Edit metadata (names, collection, episode, type, tags) |
| `/videos/:id/play` | `VideoPlayerComponent` | Stream video with HTML5 `<video>` |
| `/tags` | `TagManagerComponent` | Add/remove master tags |
| `/collections` | `CollectionBrowserComponent` | Browse collections with thumbnails |
| `/collections/:id` | `CollectionBrowserComponent` | Videos in a collection |
| `/settings` | `SettingsComponent` | Theme, anime speed-up, warm cache |

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
| GET | `/api/videos/{id}/preview?resolution=0&v=` | VideoList, VideoDetail, CollectionBrowser |
| GET | `/api/videos/{id}/thumbnail?t=&v=` | VideoList, VideoDetail, CollectionBrowser |
| POST | `/api/videos/{id}/regenerate-slices` | VideoDetail |
| GET | `/api/tags` | VideoDetail, TagManager |
| POST | `/api/tags` | TagManager |
| DELETE | `/api/tags/{tag}` | TagManager |
| GET | `/api/collections` | CollectionBrowser |
| GET | `/api/collections/{id}/videos` | CollectionBrowser (videos in collection) |
| GET | `/api/Settings` | App (theme bootstrap) |
| PUT | `/api/Settings` | Settings |
| POST | `/api/Settings/check-password` | Password gate |

## Data Model

See `LCP.Domain/Entities/` in the backend repo for the full `VideoMetadata` schema. The frontend mirrors it in `src/app/models/video.ts`.

## Key Conventions

- **Standalone components only** — no NgModules
- **No tests** — project does not use any test runner; `skipTests: true` in `angular.json`
- **No unit test scripts** — `package.json` has no `test` script (only `ng`, `start`, `build`, `watch`)
- **API proxy** — `/api/*` proxied to LCP.BE via `proxy.conf.json`
- **No comments in code** — keep source files clean
- **Router‑based navigation** — no modals or overlays for edit/play
- **Signal-based state** — all component state uses Angular signals, no NgRx or BehaviorSubjects
- **Back navigation** — back buttons use `Location.back()` (not absolute `routerLink`) to preserve history
- **Page as query param** — video list page number is stored in `?page=` query param (browser-history friendly)
- **Password gate** — root component checks `localStorage` on new tabs, resets on refresh (uses `PerformanceNavigationTiming`)
- **CSS custom property theming** — `data-theme="dark|light"` toggles CSS variables on `:root`
- **SCSS styles** — component-scoped stylesheets (`.btn`, `.back`, `.container` duplicated per component)
- **Prettier** — `.prettierrc` config present at root (`printWidth: 100`, `singleQuote: true`)

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
