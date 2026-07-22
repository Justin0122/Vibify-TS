# Vibify

Self-hosted Spotify companion: a typed Express API over the Spotify Web API plus an Astro web UI (Vue + React islands) with full playback control, an in-browser player, monthly liked-songs playlists and an API explorer.

Built on the official [`@spotify/web-api-ts-sdk`](https://www.npmjs.com/package/@spotify/web-api-ts-sdk), patched for the **Feb 2026 dev-mode API migration** (the SDK predates it):

- Playlist create: `POST /me/playlists` (old `/users/{id}/playlists` returns 403)
- Playlist tracks: `/playlists/{id}/items` (old `/tracks` path returns 403; `tracks` field renamed `items`)
- Library save/remove/check: `PUT|DELETE /me/library?uris=…` and `GET /me/library/contains?uris=…` (query params, not body)
- Batch multi-gets (`/artists?ids=`, `/tracks?ids=`) removed — fetched individually
- Search `limit` hard-capped at 10
- Removed with no replacement (not used): recommendations, audio features/analysis, related artists, artist top-tracks, browse/new-releases/categories, `/markets`

All of the removed/moved endpoints answer `403 "Bad OAuth request (wrong consumer key…)"` — misleading; it's the endpoint, not your auth.

## Stack

- **API** — Node 22+, Express, TypeScript (ESM), MySQL via knex, Redis (cache, login handoff, sync jobs)
- **Web UI** — Astro v7 (static output), Vue islands for data/forms, React islands for the player + API explorer, Tailwind v4, nanostores
- **Playback** — Spotify Web Playback SDK (browser becomes a device) + REST control of any device. Premium required for playback control.

## Setup

```bash
cp .env.example .env       # fill in Spotify + DB credentials
npm install
npm run createdb           # DROPS and recreates the database — first time only
npm run migrate
npm --prefix web install
```

Register the exact `SPOTIFY_REDIRECT_URI` in your Spotify app dashboard.
Note: newly created Spotify apps only accept HTTPS or `http://127.0.0.1:…` redirect URIs. If your LAN URI is rejected, register `http://127.0.0.1:3333/auth/callback` and log in once from the server machine — tokens persist, everything else works over LAN afterwards.

## Run

```bash
npm run dev        # API on http://0.0.0.0:3333 (tsx watch)
npm run web:dev    # UI on http://0.0.0.0:5432 (Astro dev)
```

Production: `npm run build && npm run web:build && npm start` — Express serves the built UI from `web/dist` on port 3333 (single origin, set `FRONTEND_URL` to the API origin and rebuild the UI with empty `PUBLIC_API_BASE`).

## Auth flow

1. UI → `GET /auth/authorize/:userId` → Spotify consent (includes `streaming` + playback scopes)
2. Spotify → `GET /auth/callback` → tokens stored in MySQL → redirect to UI with a **one-time code** (2 min TTL, api_token never in a URL)
3. UI → `POST /auth/exchange` → `{userId, api_token}` → stored in localStorage, sent as `X-API-Key`

## API

All routes (except `/auth/*`) need `X-API-Key`. Trusted consumers may instead send `X-Application-Id` + `X-User-Id`.

| Area | Routes |
|---|---|
| Auth | `GET /auth/authorize/:userId`, `GET /auth/callback`, `POST /auth/exchange`, `GET /auth/token` (Web Playback SDK token) |
| Profile | `GET /me`, `DELETE /me` |
| Library | `GET /me/top/tracks`, `GET /me/top/artists`, `GET /me/tracks`, `GET /me/tracks/recent`, `GET /me/tracks/years`, `GET /me/tracks/years/:year/months`, `POST /me/tracks/sync`, `GET /me/tracks/sync/status` |
| Playlists | `GET /me/playlists`, `POST /me/playlists` (name or month+year), `POST /me/playlists/monthly`, `GET /playlists/:id` |
| Catalog | `GET /search`, `GET /artists/:id`, `GET /artists/:id/albums` |
| Player | `GET/PUT /me/player`, `GET /me/player/devices`, `GET /me/player/currently-playing`, `PUT /me/player/play\|pause\|seek\|shuffle\|repeat\|volume`, `POST /me/player/next\|previous`, `GET/POST /me/player/queue` |

Pagination: `?limit=` (max 50) `&offset=`. Top items: `&time_range=short_term|medium_term|long_term`. The `/explorer` page in the web UI documents and fires every endpoint.

## Notes

- **In-browser player** needs a DRM-capable browser (Widevine) and a secure context — works on `localhost`/HTTPS, not plain LAN HTTP. Device transfer + remote control work everywhere.
- Existing users from v1 must re-authorize once (new playback scopes) — the API answers `401 REAUTH_REQUIRED` until then.
- `npm test` runs the vitest suite; `npm run lint` lints.
