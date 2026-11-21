import { useMemo } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { Bookmark } from 'lucide-react';
import CollectionHeader, { Dot } from '@/components/media/CollectionHeader';
import EpisodeRow from '@/components/media/EpisodeRow';
import { EmptyState, ErrorState, Spinner } from '@/components/ui/States';
import { pluralize } from '@/lib/format';
import { isPlayed, setHidePlayed, usePodcastState } from '@/lib/podcastState';
import Chip from '@/components/ui/Chip';
import { useInView } from '@/hooks/useInView';
import { useSavedEpisodes } from '@/hooks/useLibrary';
import { usePlayEpisode } from '@/hooks/usePlayback';

function EpisodesCover({ className }) {
	return (
		<div className={`flex items-center justify-center bg-gradient-to-br from-emerald-700 to-teal-400 text-white ${className}`}>
			<Bookmark className="h-1/3 w-1/3 fill-current" />
		</div>
	);
}

export default function EpisodesPage() {
	const saved = useSavedEpisodes();
	const playEpisode = usePlayEpisode();
	const podcastState = usePodcastState();
	const episodes = useMemo(
		() => (saved.data?.pages ?? []).flatMap((p) => p.items ?? []).map((i) => i?.episode).filter((e) => e?.id),
		[saved.data]
	);
	const visible = podcastState.hidePlayed ? episodes.filter((ep) => !isPlayed(podcastState, ep)) : episodes;
	const total = saved.data?.pages?.[0]?.total ?? 0;
	const sentinel = useInView(() => saved.hasNextPage && !saved.isFetchingNextPage && saved.fetchNextPage(), {
		enabled: Boolean(saved.hasNextPage)
	});

	return (
		<>
			<Head>
				<title>Your Episodes · Antefy</title>
			</Head>
			<CollectionHeader
				label="Collection"
				title="Your Episodes"
				seed="your-episodes-teal"
				cover={<EpisodesCover className="h-44 w-44 rounded-md shadow-2xl shadow-black/50 sm:h-52 sm:w-52 lg:h-56 lg:w-56" />}
				meta={
					total > 0 && (
						<>
							<span>{pluralize(total, 'episode')}</span>
							<Dot />
							<span>Saved on Spotify</span>
						</>
					)
				}
			/>
			{episodes.length > 0 && (
				<div className="flex px-4 py-4 sm:px-6">
					<Chip active={podcastState.hidePlayed} onClick={() => setHidePlayed(!podcastState.hidePlayed)}>
						Hide played
					</Chip>
				</div>
			)}
			{saved.isLoading ? (
				<div className="flex justify-center py-12">
					<Spinner />
				</div>
			) : saved.error ? (
				<ErrorState error={saved.error} onRetry={saved.refetch} />
			) : episodes.length === 0 ? (
				<EmptyState
					icon={Bookmark}
					title="Episodes you save will appear here"
					action={
						<Link href="/search?type=episode" className="rounded-full bg-fg px-5 py-2 text-sm font-semibold text-bg hover:scale-105">
							Find episodes
						</Link>
					}
				>
					Save episodes in Spotify to keep them here.
				</EmptyState>
			) : (
				<>
					{visible.map((ep) => (
						<EpisodeRow key={ep.id} episode={ep} show={ep.show} onPlay={playEpisode} />
					))}
					{visible.length === 0 && <EmptyState title="All caught up">Every saved episode here is played.</EmptyState>}
					{saved.hasNextPage && (
						<div ref={sentinel} className="flex justify-center py-6">
							<Spinner />
						</div>
					)}
				</>
			)}
		</>
	);
}
