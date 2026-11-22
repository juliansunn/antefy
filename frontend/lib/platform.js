/**
 * Detects the native wrappers around this site: the Capacitor app on iOS/Android
 * (which appends "AntefyApp" to the user agent) and the Electron app on macOS.
 */
export function nativeShell() {
	if (typeof navigator === 'undefined') return null;
	const ua = navigator.userAgent;
	if (/AntefyApp/.test(ua)) return 'mobile';
	if (/Electron\//.test(ua)) return 'desktop';
	return null;
}

/** Whether this webview can decrypt Spotify's Widevine-protected audio. */
export async function hasWidevine() {
	if (typeof navigator === 'undefined' || !navigator.requestMediaKeySystemAccess) return false;
	try {
		await navigator.requestMediaKeySystemAccess('com.widevine.alpha', [
			{ initDataTypes: ['cenc'], audioCapabilities: [{ contentType: 'audio/mp4; codecs="mp4a.40.2"' }] }
		]);
		return true;
	} catch {
		return false;
	}
}

/**
 * Whether the Web Playback SDK should run here. The mobile apps never use it
 * (WKWebView/Android webviews lack Widevine and stop audio in the background),
 * so playback goes through the Spotify app instead. The desktop app tries it
 * only when its Electron build ships Widevine.
 */
export async function canUseWebPlayer() {
	const shell = nativeShell();
	if (shell === 'mobile') return false;
	if (shell === 'desktop') return hasWidevine();
	return true;
}
