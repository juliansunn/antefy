# Antefy for iOS / Android

Capacitor shell that loads the hosted web app (`server.url` in `capacitor.config.json`,
currently https://spot-clone-two.vercel.app) and appends `AntefyApp` to the user agent. Music plays in-app
through the Spotify Web Playback SDK ("This computer" in the device picker); background audio is enabled
(`UIBackgroundModes: audio` + an `AVAudioSession` playback category in `AppDelegate.swift`).

- `npm install && npx cap sync`
- `npm run ios`: open in Xcode (pick a team under Signing to run on a device)
- `npm run android`: open in Android Studio (needs the Android SDK)

Web changes ship via Vercel; only native config changes need a rebuild. Sign in with your Spotify email
and password: Google/Apple/Facebook login pages refuse embedded webviews.
