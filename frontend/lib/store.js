import { create } from 'zustand';

const read = (key) => {
	try {
		return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
	} catch {
		return null;
	}
};
const write = (key, value) => {
	try {
		if (value == null) window.localStorage.removeItem(key);
		else window.localStorage.setItem(key, value);
	} catch {
		/* storage unavailable (private mode) – non-critical */
	}
};

/** UI-only state. Server state (playback, library, etc.) lives in react-query. */
export const useUiStore = create((set) => ({
	sidebarOpen: false,
	setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),

	devicePickerOpen: false,
	setDevicePickerOpen: (devicePickerOpen) => set({ devicePickerOpen }),

	lastDeviceId: read('antefy-last-device'),
	setLastDeviceId: (lastDeviceId) => {
		write('antefy-last-device', lastDeviceId);
		set({ lastDeviceId });
	},

	// Web Playback SDK device ("this browser").
	// status: 'idle' | 'loading' | 'ready' | 'unsupported' | 'needs-reauth' | 'premium-required' | 'error'
	webPlayer: { status: 'idle', deviceId: null, message: null },
	setWebPlayer: (patch) => set((s) => ({ webPlayer: { ...s.webPlayer, ...patch } })),

	// Queue something similar when the queue is about to run out.
	autoplay: read('antefy-autoplay') !== 'off',
	setAutoplay: (autoplay) => {
		write('antefy-autoplay', autoplay ? null : 'off');
		set({ autoplay });
	},

	// null | { endsAt: number } | { itemId: string } (pause at the end of that track/episode)
	sleepTimer: null,
	setSleepTimer: (sleepTimer) => set({ sleepTimer }),

	queueOpen: false,
	setQueueOpen: (queueOpen) => set({ queueOpen }),

	// Volume to restore after unmuting.
	volumeBeforeMute: null,
	setVolumeBeforeMute: (volumeBeforeMute) => set({ volumeBeforeMute })
}));

export function getStoredTheme() {
	return read('antefy-theme') === 'light' ? 'light' : 'dark';
}

export function storeTheme(theme) {
	write('antefy-theme', theme);
}
