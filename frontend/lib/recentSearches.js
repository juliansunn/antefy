import { useSyncExternalStore } from 'react';

/** Recent search queries, kept in localStorage and shared across tabs. */
const KEY = 'antefy-recent-searches';
const MAX = 12;
const EMPTY = [];
const listeners = new Set();
let cache = null;

function read() {
	if (cache) return cache;
	try {
		const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? '[]');
		cache = Array.isArray(parsed) ? parsed.filter((q) => typeof q === 'string') : EMPTY;
	} catch {
		cache = EMPTY;
	}
	return cache;
}

function save(list) {
	cache = list;
	try {
		window.localStorage.setItem(KEY, JSON.stringify(list));
	} catch {
		/* storage unavailable – keep the in-memory list */
	}
	listeners.forEach((fn) => fn());
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

export function useRecentSearches() {
	return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function addRecentSearch(q) {
	const query = q.trim();
	if (query.length < 2) return;
	const rest = read().filter((x) => x.toLowerCase() !== query.toLowerCase());
	save([query, ...rest].slice(0, MAX));
}

export function removeRecentSearch(q) {
	save(read().filter((x) => x !== q));
}

export function clearRecentSearches() {
	save([]);
}
