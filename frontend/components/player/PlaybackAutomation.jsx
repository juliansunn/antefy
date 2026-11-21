import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { pickNext } from '@/lib/autoplay';
import { useUiStore } from '@/lib/store';
import { PLAYBACK_KEY, usePlaybackState, usePlayerControls } from '@/hooks/usePlayback';

/** Arm autoplay this long before the end, and re-check playback this long after it. */
const ARM_LEAD_MS = 4000;
const RECHECK_AFTER_END_MS = 1500;

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
 * Did playback stop because `armed` reached its end (not a manual pause, a
 * skip, or Spotify's own autoplay starting something)? Spotify reports a
 * finished item as paused at position 0 (or at the very end), or with no
 * item at all.
 */
export function endedNaturally(armed, { item, playing, progress }, now = Date.now()) {
	if (!armed || playing || now < armed.endsAt - 1000) return false;
	if (!item) return true;
	// Some contexts rewind to their first item, paused at 0, when they finish.
	if (item.id !== armed.id) return progress < 1500;
	return progress < 1500 || progress >= (item.duration_ms ?? 0) - 1000;
}

/**
 * Autoplay: when the current track or episode finishes and nothing else
 * starts (no queue, end of context, Spotify's own autoplay off), play the top
 * suggestion: the next song-radio pick or the newest unplayed episode of the
 * same podcast. Acting after the end, instead of queueing ahead of time,
 * means it never stacks on top of Spotify's autoplay.
 */
function useAutoplay() {
	const queryClient = useQueryClient();
	const enabled = useUiStore((s) => s.autoplay);
	const state = useRemaining();
	const { item, playing, repeat, progress, updatedAt } = state;
	const { play } = usePlayerControls();
	const armed = useRef(null);
	const played = useRef(new Set());

	// While playing, arm shortly before the end and force a fresh read just after it.
	useEffect(() => {
		if (!enabled || !playing || !item?.id || repeat !== 'off') return undefined;
		const remaining = remainingMs(item, progress, updatedAt);
		const arm = setTimeout(() => {
			armed.current = { id: item.id, item, endsAt: Date.now() + Math.max(0, remainingMs(item, progress, updatedAt)) };
		}, Math.max(0, remaining - ARM_LEAD_MS));
		const recheck = setTimeout(
			() => queryClient.invalidateQueries({ queryKey: PLAYBACK_KEY }),
			Math.max(0, remaining + RECHECK_AFTER_END_MS)
		);
		return () => {
			clearTimeout(arm);
			clearTimeout(recheck);
		};
	}, [enabled, playing, item, repeat, progress, updatedAt, queryClient]);

	// On each playback update: if the armed item ended and nothing followed, continue.
	useEffect(() => {
		const current = armed.current;
		if (!current) return;
		if (playing && item?.id !== current.id) {
			armed.current = null; // something else started (queue, context, Spotify autoplay)
			return;
		}
		if (!enabled || !endedNaturally(current, state)) return;
		armed.current = null;
		// The sleep timer just paused on purpose.
		if (Date.now() - useUiStore.getState().sleptAt < 60000) return;
		pickNext(current.item, queryClient, played.current)
			.then((next) => {
				if (!next) return;
				played.current.add(next.uri);
				const resume = next.resume_point;
				play({ uris: [next.uri], positionMs: resume && !resume.fully_played ? resume.resume_position_ms : 0 });
				toast(`Autoplay: ${next.name}`, { id: 'autoplay', description: 'Playing something similar.' });
			})
			.catch((e) => console.warn('[autoplay]', e));
		// `state` is the same data as the fields listed.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [enabled, item, playing, progress, updatedAt, queryClient, play]);
}

/** Sleep timer: pause after N minutes, or when the current track/episode ends. */
function useSleepTimer() {
	const timer = useUiStore((s) => s.sleepTimer);
	const setTimer = useUiStore((s) => s.setSleepTimer);
	const setSleptAt = useUiStore((s) => s.setSleptAt);
	const { pause } = usePlayerControls();
	const { item, playing, progress, updatedAt } = useRemaining();

	const fire = useRef(null);
	useEffect(() => {
		fire.current = () => {
			setTimer(null);
			setSleptAt(Date.now());
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
