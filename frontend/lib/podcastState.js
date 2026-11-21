import { useSyncExternalStore } from 'react';

/**
 * Podcast state Spotify's API can't store for us, kept in localStorage:
 * - played: manual "mark as played / unplayed" overrides (episode id -> bool)
 * - seen: episode ids already shown per podcast, for "New" badges
 * - hidePlayed: hide finished episodes on podcast pages
 */
const KEY = 'antefy-podcast-state';
const MAX_SEEN = 200;
const MAX_PLAYED = 1000;
const EMPTY = { played: {}, seen: {}, hidePlayed: false };
const listeners = new Set();
let cache = null;

function read() {
	if (cache) return cache;
	try {
		const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? 'null');
		cache = parsed && typeof parsed === 'object' ? { ...EMPTY, ...parsed } : EMPTY;
	} catch {
		cache = EMPTY;
	}
	return cache;
}

function update(fn) {
	cache = fn(read());
	try {
		window.localStorage.setItem(KEY, JSON.stringify(cache));
	} catch {
		/* storage unavailable – keep in memory */
	}
	listeners.forEach((l) => l());
}

function subscribe(fn) {
	listeners.add(fn);
	const onStorage = (e) => {
		if (e.key === KEY) {
			cache = null;
			fn();
		}
	};
	window.addEventListener('storage', onStorage);
	return () => {
		listeners.delete(fn);
		window.removeEventListener('storage', onStorage);
	};
}

/** Current state outside React (event handlers, timers). */
export const readPodcastState = () => read();

export function usePodcastState() {
	return useSyncExternalStore(subscribe, read, () => EMPTY);
}

/** Played = a manual override if there is one, otherwise Spotify's resume point. */
export function isPlayed(state, episode) {
	const override = state.played[episode.id];
	return override ?? Boolean(episode.resume_point?.fully_played);
}

export function setPlayed(episodeId, played) {
	update((s) => {
		const entries = Object.entries({ ...s.played, [episodeId]: played });
		// Oldest overrides drop off first (insertion order).
		return { ...s, played: Object.fromEntries(entries.slice(-MAX_PLAYED)) };
	});
}

export function setHidePlayed(hidePlayed) {
	update((s) => ({ ...s, hidePlayed }));
}

/** Ids already seen for a show, or null if the show has never been visited. */
export function getSeen(showId) {
	const ids = read().seen[showId];
	return ids ? new Set(ids) : null;
}

export function markSeen(showId, episodeIds) {
	if (!showId || !episodeIds.length) return;
	update((s) => {
		const prev = s.seen[showId] ?? [];
		const merged = [...new Set([...episodeIds, ...prev])].slice(0, MAX_SEEN);
		return { ...s, seen: { ...s.seen, [showId]: merged } };
	});
}
