# Antefy for macOS

Electron shell that runs the Next.js app as a bundled standalone server on `http://127.0.0.1:3000`
(Spotify only accepts loopback redirect URIs on 127.0.0.1). It reuses the dev redirect URI, so quit
`npm run dev` before opening the app. Set `ANTEFY_PORT` in `antefy.env` to use another registered port.

## Setup

1. Make sure this redirect URI is registered in your Spotify app: `http://127.0.0.1:3000/api/auth/callback/spotify`
2. `npm install`

## Run / build

- `npm run prepare-server && npm start`: run from the repo (reads `../frontend/.env.local`)
- `ANTEFY_URL=http://127.0.0.1:3000 npm start`: point the shell at `npm run dev` instead
- `npm run dist`: builds `dist/Antefy-<version>-arm64.dmg` (unsigned; fine for your own Mac)

The packaged app reads `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` from
`~/Library/Application Support/Antefy/antefy.env` (it creates a template and opens it on first launch)
and generates its own NextAuth secret.

## Playback

Stock Electron has no Widevine, so the in-app web player is hidden and playback goes through a Spotify
app (desktop, phone, speaker) picked from the device menu.
