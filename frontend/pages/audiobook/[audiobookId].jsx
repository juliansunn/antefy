import { useCallback, useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { BookOpen } from 'lucide-react';
import CollectionHeader, { ActionBar, Dot } from '@/components/media/CollectionHeader';
import EpisodeRow from '@/components/media/EpisodeRow';
import PlayButton from '@/components/media/PlayButton';
import SaveButton from '@/components/media/SaveButton';
import { EmptyState, ErrorState, Spinner } from '@/components/ui/States';
import { cleanDescription, pluralize } from '@/lib/format';
import { useInView } from '@/hooks/useInView';
import { useNowPlaying, usePlayEpisode } from '@/hooks/usePlayback';
import * as spotify from '@/lib/spotify';

const names = (list) => (list ?? []).map((p) => p.name).join(', ');

export default function AudiobookPage() {
	const { query } = useRouter();
	const id = typeof query.audiobookId === 'string' ? query.audiobookId : '';
	const enabled = useSession().status === 'authenticated' && Boolean(id);
	const book = useQuery({ queryKey: ['audiobook', id], queryFn: () => spotify.getAudiobook(id), enabled });
	const chapters = useInfiniteQuery({
		queryKey: ['audiobook-chapters', id],
		queryFn: ({ pageParam }) => spotify.getAudiobookChapters(id, pageParam, 50),
		initialPageParam: 0,
		getNextPageParam: (last) => (last?.next ? (last.offset ?? 0) + (last.items?.length ?? 0) : undefined),
		enabled
	});
	const playEpisode = usePlayEpisode();
	const now = useNowPlaying();
	const [expanded, setExpanded] = useState(false);
	const b = book.data;

	const list = useMemo(() => (chapters.data?.pages ?? []).flatMap((p) => p.items ?? []).filter(Boolean), [chapters.data]);
	const sentinel = useInView(() => chapters.hasNextPage && !chapters.isFetchingNextPage && chapters.fetchNextPage(), {
		enabled: Boolean(chapters.hasNextPage)
	});
	const onPlay = useCallback((ch) => playEpisode(ch, b?.uri), [playEpisode, b?.uri]);
	// Resume the first chapter that isn't finished.
	const next = list.find((ch) => !ch.resume_point?.fully_played) ?? list[0];

	if (book.error) return <ErrorState error={book.error} onRetry={book.refetch} className="min-h-[60vh]" />;
	const description = cleanDescription(b?.description);
	const isCurrent = b && now.contextUri === b.uri;

	return (
		<>
			<Head>
				<title>{b ? `${b.name} · Antefy` : 'Audiobook · Antefy'}</title>
			</Head>
			<CollectionHeader
				loading={book.isLoading}
				label="Audiobook"
				title={b?.name}
				images={b?.images}
				coverType="audiobook"
				seed={id}
				meta={
					b && (
						<>
							{b.authors?.length > 0 && <span className="font-semibold">{names(b.authors)}</span>}
							{b.narrators?.length > 0 && (
								<>
									<Dot />
									<span>Narrated by {names(b.narrators)}</span>
								</>
							)}
							<Dot />
							<span>{pluralize(b.total_chapters ?? list.length, 'chapter')}</span>
						</>
					)
				}
			/>
			{b && (
				<ActionBar>
					<PlayButton
						size="lg"
						playing={isCurrent && now.isPlaying}
						onClick={() => next && onPlay(next)}
						label={next?.resume_point?.resume_position_ms ? 'Resume' : 'Play'}
					/>
					<SaveButton uri={b.uri} name={b.name} />
				</ActionBar>
			)}
			<div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
				<section aria-label="Chapters">
					<h2 className="px-4 pb-2 text-xl font-bold sm:px-6">Chapters</h2>
					{chapters.isLoading ? (
						<div className="flex justify-center py-12">
							<Spinner />
						</div>
					) : chapters.error ? (
						<ErrorState error={chapters.error} onRetry={chapters.refetch} />
					) : list.length === 0 ? (
						<EmptyState icon={BookOpen} title="No chapters available" />
					) : (
						<>
							{list.map((ch) => (
								<EpisodeRow key={ch.id} episode={ch} onPlay={onPlay} />
							))}
							{chapters.hasNextPage && (
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
						<p className={expanded ? 'text-sm text-muted' : 'line-clamp-6 text-sm text-muted'}>{description}</p>
						{description.length > 320 && (
							<button type="button" onClick={() => setExpanded((v) => !v)} className="mt-1 text-sm font-semibold hover:underline">
								{expanded ? 'Show less' : 'Show more'}
							</button>
						)}
					</aside>
				)}
			</div>
		</>
	);
}
