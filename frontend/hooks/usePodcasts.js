import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import * as spotify from '@/lib/spotify';
import { podcastShelves, similarShows } from '@/lib/podcastRecs';

const FEED_SHOWS = 8;
const NEW_DAYS = 21;

function useAuthed() {
	return useSession().status === 'authenticated';
}

const ageDays = (date) => (Date.now() - new Date(date).getTime()) / 86400000;

/**
 * Latest episodes from the podcasts you follow, split into ones you've started
 * (with resume points) and recent ones you haven't.
 */
export function useEpisodeFeed(savedShows) {
	const enabled = useAuthed() && Boolean(savedShows?.length);
	const shows = (savedShows ?? []).slice(0, FEED_SHOWS);
	return useQuery({
		queryKey: ['episode-feed', shows.map((s) => s.id)],
		queryFn: async () => {
			const pages = await Promise.all(
				shows.map((show) =>
					spotify
						.getShowEpisodes(show.id, 0, 4)
						.then((p) => (p?.items ?? []).filter(Boolean).map((ep) => ({ ...ep, show })))
						.catch(() => [])
				)
			);
			const episodes = pages.flat().sort((a, b) => String(b.release_date).localeCompare(String(a.release_date)));
			const started = (ep) => ep.resume_point?.resume_position_ms > 0 && !ep.resume_point?.fully_played;
			return {
				inProgress: episodes.filter(started),
				fresh: episodes.filter(
					(ep) => !started(ep) && !ep.resume_point?.fully_played && ep.is_playable !== false && ageDays(ep.release_date) <= NEW_DAYS
				)
			};
		},
		enabled,
		staleTime: 5 * 60 * 1000
	});
}

/** "For you" and "Because you listen to …" podcast shelves. */
export function usePodcastRecommendations(savedShows) {
	const enabled = useAuthed() && Boolean(savedShows?.length);
	return useQuery({
		queryKey: ['podcast-recs', (savedShows ?? []).slice(0, 20).map((s) => s.id)],
		queryFn: () => podcastShelves(savedShows),
		enabled,
		staleTime: 30 * 60 * 1000
	});
}

/** Shows similar to one show (podcast page, queue suggestions). */
export function useSimilarShows(show, savedShows, { enabled: on = true } = {}) {
	const enabled = useAuthed() && Boolean(show?.id) && on;
	return useQuery({
		queryKey: ['similar-shows', show?.id],
		queryFn: () => similarShows([show], { exclude: savedShows ?? [], limit: 10 }),
		enabled,
		staleTime: 30 * 60 * 1000
	});
}
