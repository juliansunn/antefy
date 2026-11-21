import * as spotify from '@/lib/spotify';
import { buildRadio } from '@/lib/radio';
import { isPlayed, readPodcastState } from '@/lib/podcastState';

/**
 * What to play after `item` when nothing else is queued: the next song from
 * its song radio mix, or the newest unplayed episode of the same podcast.
 * `skip` holds URIs already auto-queued, so it doesn't repeat itself.
 */
export async function pickNext(item, queryClient, skip = new Set()) {
	if (item.type === 'episode') {
		const showId = item.show?.id;
		if (!showId) return null;
		const page = await queryClient.fetchQuery({
			queryKey: ['show-episodes-peek', showId],
			queryFn: () => spotify.getShowEpisodes(showId, 0, 20),
			staleTime: 5 * 60 * 1000
		});
		const state = readPodcastState();
		return (
			(page?.items ?? []).find(
				(ep) => ep?.id && ep.id !== item.id && ep.is_playable !== false && !skip.has(ep.uri) && !isPlayed(state, ep)
			) ?? null
		);
	}
	if (!item.id || item.type !== 'track') return null;
	const radio = await queryClient.fetchQuery({
		queryKey: ['radio', item.id, 0],
		queryFn: () => buildRadio(item, 0),
		staleTime: 30 * 60 * 1000
	});
	return (radio?.tracks ?? []).find((t) => t.id !== item.id && !skip.has(t.uri)) ?? null;
}
