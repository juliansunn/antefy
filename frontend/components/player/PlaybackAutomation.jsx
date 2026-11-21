import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { pickNext } from '@/lib/autoplay';
import * as spotify from '@/lib/spotify';
import { useUiStore } from '@/lib/store';
import { usePlaybackState, usePlayerControls } from '@/hooks/usePlayback';

/** How long before the end of a track/episode autoplay checks the queue. */
const AUTOPLAY_LEAD_MS = 25000;

function useRemaining() {
	const { data, dataUpdatedAt } = usePlaybackState();
	const item = data?.item;
	return {
		item,
		playing: Boolean(data?.is_playing),
		repeat: data?.repeat_state ?? 'off',
		progress: data?.progress_ms ?? 0,
		updatedAt: dataUpdatedAt
	};
}

/** Remaining ms of the current item, measured now (call from effects/timers, not render). */
const remainingMs = (item, progress, updatedAt) => (item?.duration_ms ?? 0) - (progress + (Date.now() - updatedAt));

/**
 * Autoplay: shortly before the current track or episode ends, if Spotify has
 * nothing queued after it, queue the top suggestion (song radio / next
 * unplayed episode). Runs at most once per item.
 */
function useAutoplay() {
	const queryClient = useQueryClient();
	const enabled = useUiStore((s) => s.autoplay);
	const { item, playing, repeat, progress, updatedAt } = useRemaining();
	const handled = useRef(new Set());
	const queued = useRef(new Set());

	useEffect(() => {
		if (!enabled || !playing || !item?.id || repeat !== 'off' || handled.current.has(item.id)) return undefined;
		const delay = Math.max(0, remainingMs(item, progress, updatedAt) - AUTOPLAY_LEAD_MS);
		const t = setTimeout(async () => {
			if (handled.current.has(item.id)) return;
			handled.current.add(item.id);
			try {
				const queue = await spotify.getQueue();
				if ((queue?.queue ?? []).some(Boolean)) return;
				const next = await pickNext(item, queryClient, queued.current);
				if (!next) return;
				await spotify.addToQueue(next.uri);
				queued.current.add(next.uri);
				queryClient.invalidateQueries({ queryKey: ['queue'] });
				toast(`Up next: ${next.name}`, { description: 'Autoplay queued something similar.', id: 'autoplay' });
			} catch (e) {
				console.warn('[autoplay]', e);
			}
		}, delay);
		return () => clearTimeout(t);
	}, [enabled, playing, item, repeat, progress, updatedAt, queryClient]);
}

/** Sleep timer: pause after N minutes, or when the current track/episode ends. */
function useSleepTimer() {
	const timer = useUiStore((s) => s.sleepTimer);
	const setTimer = useUiStore((s) => s.setSleepTimer);
	const { pause } = usePlayerControls();
	const { item, playing, progress, updatedAt } = useRemaining();

	const fire = useRef(null);
	useEffect(() => {
		fire.current = () => {
			setTimer(null);
			pause();
			toast('Sleep timer: playback paused', { id: 'sleep-timer' });
		};
	});

	// Fixed duration.
	useEffect(() => {
		if (!timer?.endsAt) return undefined;
		const t = setTimeout(() => fire.current(), Math.max(0, timer.endsAt - Date.now()));
		return () => clearTimeout(t);
	}, [timer]);

	// End of the current item: pause just before it ends, or as soon as the
	// next item shows up if the timing missed (e.g. after a seek).
	useEffect(() => {
		if (!timer?.itemId || !playing) return undefined;
		if (item?.id && item.id !== timer.itemId) {
			fire.current();
			return undefined;
		}
		const t = setTimeout(() => fire.current(), Math.max(0, remainingMs(item, progress, updatedAt) - 600));
		return () => clearTimeout(t);
	}, [timer, item, playing, progress, updatedAt]);
}

/** Background playback helpers (autoplay, sleep timer). Renders nothing. */
export default function PlaybackAutomation() {
	useAutoplay();
	useSleepTimer();
	return null;
}
