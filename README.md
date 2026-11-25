# Antefy

A cleaner Spotify library and player. Browse your library, search music and podcasts, edit playlists and play everything right in the browser. It also ships as an iOS and Android app.

<!-- TODO: add docs/media/antefy.gif (a 10-15 s screen recording: library, search, northern-lights visualizer) -->
<!-- ![Antefy](docs/media/antefy.gif) -->

**Live:** https://spot-clone-two.vercel.app (Spotify keeps apps in Development Mode invite-only, so ask me for access)

## What it does

- **Library:** liked songs, playlists, albums, artists, podcasts, audiobooks and recently played
- **Playback in the browser** via the Web Playback SDK, or control any Spotify device you own
- **Search and podcast discovery**, a queue panel, playlist editing, song radio and save-as-playlist
- **Podcasts:** Your Episodes, played state, new-episode badges, autoplay and a sleep timer
- **Visualizer:** northern lights that follow the music
- **Mobile:** iOS and Android through a Capacitor shell

## How it's built

| Area | Approach |
| --- | --- |
| Framework | Next.js 16, React 19, Tailwind |
| Auth | NextAuth with Spotify OAuth and token refresh; `proxy.js` sends signed-out requests to `/login` |
| API client | `lib/spotify.js`: fetch wrapper with 401 refresh, 429 retry and fallbacks for Spotify's Feb 2026 API changes |
| Server state | React Query hooks in `hooks/` |
| Playback | `hooks/usePlayback.js` polls `/me/player`, interpolates progress and applies controls optimistically |
| UI state | zustand (`lib/store.js`) |
| Mobile | Capacitor wrapping the hosted site (`mobile/`) |

## Run it

```bash
cd frontend
cp .env.example .env.local   # SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, NEXTAUTH_SECRET
npm install && npm run dev   # http://127.0.0.1:3000
```

Full setup: [frontend/README.md](frontend/README.md). Mobile: [mobile/README.md](mobile/README.md).

Keyboard: `Space` plays or pauses, `/` focuses search.
