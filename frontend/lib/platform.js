/** True inside the Antefy iOS/Android app, which appends "AntefyApp" to the user agent. */
export function isNativeApp() {
	return typeof navigator !== 'undefined' && /AntefyApp/.test(navigator.userAgent);
}

/**
 * Whether the Web Playback SDK should run here. The mobile apps never use it
 * (their webviews lack Widevine and stop audio in the background), so playback
 * goes through the Spotify app on the device instead.
 */
export function canUseWebPlayer() {
	return !isNativeApp();
}
