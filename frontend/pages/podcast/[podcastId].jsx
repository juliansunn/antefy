import { useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { Podcast } from 'lucide-react';
import CollectionHeader, { ActionBar, Dot } from '@/components/media/CollectionHeader';
import EpisodeRow from '@/components/media/EpisodeRow';
import PlayButton from '@/components/media/PlayButton';
import SaveButton from '@/components/media/SaveButton';
import Shelf from '@/components/media/Shelf';
import { EmptyState, ErrorState, Spinner } from '@/components/ui/States';
import Chip from '@/components/ui/Chip';
import { cleanDescription, pluralize } from '@/lib/format';
import { getSeen, isPlayed, markSeen, setHidePlayed, usePodcastState } from '@/lib/podcastState';
import { useInView } from '@/hooks/useInView';
import { useNowPlaying, usePlayFrom } from '@/hooks/usePlayback';
import { useShow } from '@/hooks/useCollections';
import { useSavedShows } from '@/hooks/useLibrary';
import { useSimilarShows } from '@/hooks/usePodcasts';

export default function PodcastPage() {
	const { query } = useRouter();
	const id = query.podcastId;
	const { show, episodes } = useShow(id);
	const playFrom = usePlayFrom();
	const now = useNowPlaying();
	const [expanded, setExpanded] = useState(false);
	const s = show.data;
	const saved = useSavedShows();
	const similar = useSimilarShows(s, saved.data, { enabled: Boolean(saved.data) });

	const list = useMemo(() => (episodes.data?.pages ?? []).flatMap((p) => p.items ?? []).filter(Boolean), [episodes.data]);
	const podcastState = usePodcastState();
	const visible = podcastState.hidePlayed ? list.filter((ep) => !isPlayed(podcastState, ep)) : list;

	// "New" = episodes that weren't there on your last visit. Snapshot what was
	// seen before this visit (per podcast), then record everything shown now.
	const [seenBefore, setSeenBefore] = useState({ id: null, ids: null });
	if (id && seenBefore.id !== id) setSeenBefore({ id, ids: getSeen(id) });
	useEffect(() => {
		if (id && list.length) markSeen(id, list.map((ep) => ep.id));
	}, [id, list]);
	const isNew = (ep) => Boolean(seenBefore.ids && !seenBefore.ids.has(ep.id) && !isPlayed(podcastState, ep));
	const newCount = seenBefore.ids ? list.filter(isNew).length : 0;
	const sentinel = useInView(() => episodes.hasNextPage && !episodes.isFetchingNextPage && episodes.fetchNextPage(), {
		enabled: Boolean(episodes.hasNextPage)
	});

	const onPlay = useCallback(
		(ep) => {
			const resume = ep.resume_point;
			const positionMs = !resume?.fully_played ? resume?.resume_position_ms : 0;
			playFrom({ contextUri: s?.uri }, ep, { positionMs });
		},
		[playFrom, s?.uri]
	);

	if (show.error) return <ErrorState error={show.error} onRetry={show.refetch} className="min-h-[60vh]" />;
	const isCurrent = s && now.contextUri === s.uri;
	const description = cleanDescription(s?.description);

	return (
		<>
			<Head>
				<title>{s ? `${s.name} · Antefy` : 'Podcast · Antefy'}</title>
			</Head>
			<CollectionHeader
				loading={show.isLoading}
				label="Podcast"
				title={s?.name}
				images={s?.images}
				coverType="show"
				seed={id}
				meta={
					s && (
						<>
							{s.publisher && (
								<>
									<span className="font-semibold">{s.publisher}</span>
									<Dot />
								</>
							)}
							<span>{pluralize(s.total_episodes ?? list.length, 'episode')}</span>
						</>
					)
				}
			/>
			{s && (
				<ActionBar>
					<PlayButton
						size="lg"
						playing={isCurrent && now.isPlaying}
						onClick={() => (list[0] ? onPlay(list[0]) : playFrom({ contextUri: s.uri }))}
						label="Play latest episode"
					/>
					<SaveButton uri={s.uri} name={s.name} labels={['Follow', 'Following']} />
				</ActionBar>
			)}
			<div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
				<section aria-label="Episodes">
					<div className="flex flex-wrap items-center gap-3 px-4 pb-2 sm:px-6">
						<h2 className="text-xl font-bold">All episodes</h2>
						{newCount > 0 && (
							<span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-accent-fg">{newCount} new</span>
						)}
						<Chip
							active={podcastState.hidePlayed}
							onClick={() => setHidePlayed(!podcastState.hidePlayed)}
							className="ml-auto"
						>
							Hide played
						</Chip>
					</div>
					{episodes.isLoading ? (
						<div className="flex justify-center py-12">
							<Spinner />
						</div>
					) : episodes.error ? (
						<ErrorState error={episodes.error} onRetry={episodes.refetch} />
					) : list.length === 0 ? (
						<EmptyState icon={Podcast} title="No episodes yet" />
					) : (
						<>
							{visible.map((ep) => (
								<EpisodeRow key={ep.id} episode={ep} onPlay={onPlay} isNew={isNew(ep)} />
							))}
							{visible.length === 0 && (
								<p className="px-4 py-8 text-center text-sm text-muted sm:px-6">
									All loaded episodes are played.
								</p>
							)}
							{episodes.hasNextPage && (
								<div ref={sentinel} className="flex justify-center py-6">
									<Spinner />
								</div>
							)}
						</>
					)}
				</section>
				{description && (
					<aside className="order-first px-4 sm:px-6 lg:order-none lg:px-0 lg:pr-6">
						<h2 className="pb-2 text-xl font-bold">About</h2>
						<p className={expanded ? 'text-sm text-muted' : 'line-clamp-4 text-sm text-muted'}>{description}</p>
						{description.length > 240 && (
							<button
								type="button"
								onClick={() => setExpanded((v) => !v)}
								className="mt-1 text-sm font-semibold hover:underline"
							>
								{expanded ? 'Show less' : 'Show more'}
							</button>
						)}
					</aside>
				)}
			</div>
			<div className="mt-10 px-1 sm:px-3">
				<Shelf title="Podcasts like this" items={similar.data} loading={similar.isLoading} rows={1} />
			</div>
		</>
	);
}
