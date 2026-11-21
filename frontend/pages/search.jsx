import { useEffect, useMemo } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { History, Radio, SearchX, X } from 'lucide-react';
import Cover from '@/components/ui/Cover';
import Chip from '@/components/ui/Chip';
import { EmptyState, ErrorState, Spinner } from '@/components/ui/States';
import MediaCard, { MediaCardSkeleton } from '@/components/media/MediaCard';
import PlayButton from '@/components/media/PlayButton';
import Shelf, { CARD_GRID } from '@/components/media/Shelf';
import TrackList, { TrackListSkeleton } from '@/components/media/TrackList';
import ArtistLinks from '@/components/media/ArtistLinks';
import EpisodeRow from '@/components/media/EpisodeRow';
import EpisodeCard, { EPISODE_GRID } from '@/components/media/EpisodeCard';
import { useNowPlaying, usePlayEpisode, usePlayFrom } from '@/hooks/usePlayback';
import { useSavedShows } from '@/hooks/useLibrary';
import { useEpisodeFeed, usePodcastRecommendations, useSimilarShows } from '@/hooks/usePodcasts';
import { addRecentSearch, clearRecentSearches, removeRecentSearch, useRecentSearches } from '@/lib/recentSearches';
import * as spotify from '@/lib/spotify';
import { cn } from '@/lib/cn';

const FILTERS = [
	{ id: 'all', label: 'All' },
	{ id: 'track', label: 'Songs', key: 'tracks' },
	{ id: 'artist', label: 'Artists', key: 'artists' },
	{ id: 'album', label: 'Albums', key: 'albums' },
	{ id: 'playlist', label: 'Playlists', key: 'playlists' },
	{ id: 'show', label: 'Podcasts', key: 'shows' },
	{ id: 'episode', label: 'Episodes', key: 'episodes' },
	{ id: 'audiobook', label: 'Audiobooks', key: 'audiobooks' }
];

const ALL_TYPES = ['track', 'artist', 'album', 'playlist', 'show', 'episode', 'audiobook'];

const PODCAST_TOPICS = [
	['True crime', 'from-red-700 to-zinc-900'],
	['Comedy', 'from-yellow-500 to-orange-700'],
	['News', 'from-sky-600 to-slate-800'],
	['Technology', 'from-violet-600 to-indigo-900'],
	['History', 'from-amber-700 to-stone-900'],
	['Science', 'from-teal-500 to-cyan-900'],
	['Business', 'from-emerald-600 to-green-900'],
	['Sports', 'from-orange-500 to-red-800'],
	['Health', 'from-pink-500 to-rose-800'],
	['Society & culture', 'from-fuchsia-600 to-purple-900'],
	['Self-improvement', 'from-lime-500 to-emerald-800'],
	['Interviews', 'from-blue-500 to-indigo-800']
];

const GENRES = [
	['Pop', 'from-pink-500 to-rose-700'],
	['Hip-Hop', 'from-orange-500 to-amber-700'],
	['Rock', 'from-red-600 to-red-900'],
	['Indie', 'from-emerald-500 to-teal-800'],
	['Electronic', 'from-cyan-500 to-blue-800'],
	['Jazz', 'from-amber-500 to-yellow-800'],
	['R&B', 'from-fuchsia-500 to-purple-800'],
	['Classical', 'from-stone-500 to-stone-800'],
	['Country', 'from-yellow-600 to-orange-800'],
	['Metal', 'from-zinc-600 to-zinc-900'],
	['Latin', 'from-lime-500 to-green-800'],
	['Lo-fi', 'from-indigo-500 to-violet-800']
];

/** Null entries show up in Spotify search results; drop them. */
const clean = (page) => (page?.items ?? []).filter(Boolean);

function TopResult({ item }) {
	const playFrom = usePlayFrom();
	const now = useNowPlaying();
	if (!item) return null;
	const isTrack = item.type === 'track';
	const page = { show: 'podcast' }[item.type] ?? item.type;
	const href = isTrack ? `/album/${item.album?.id}` : `/${page}/${item.id}`;
	const subtitle = isTrack ? null : item.type === 'show' ? item.publisher : item.authors?.map((a) => a.name).join(', ');
	const current = isTrack ? now.uri === item.uri : now.contextUri === item.uri;
	const images = isTrack ? item.album?.images : item.images;

	return (
		<div className="group relative flex h-full flex-col gap-5 rounded-xl bg-elevated/70 p-5 transition hover:bg-hover/70">
			<Cover images={images} type={item.type} alt="" size={160} className="h-24 w-24 shadow-xl" />
			<div className="min-w-0">
				<Link href={href} className="line-clamp-2 text-3xl font-extrabold after:absolute after:inset-0">
					{item.name}
				</Link>
				<p className="mt-1 flex items-center gap-2 text-sm text-muted">
					{isTrack && <ArtistLinks artists={item.artists} className="relative z-10" />}
					{subtitle && <span className="truncate">{subtitle}</span>}
					<span className="shrink-0 rounded-full bg-bg/60 px-2.5 py-0.5 text-xs font-semibold capitalize text-fg">
						{{ track: 'Song', show: 'Podcast' }[item.type] ?? item.type}
					</span>
				</p>
			</div>
			{isTrack && (
				<Link
					href={`/radio/${item.id}`}
					className="relative z-10 inline-flex w-fit items-center gap-1.5 rounded-full border border-line px-3 py-1 text-xs font-semibold text-muted transition hover:border-fg hover:text-fg"
				>
					<Radio className="h-3.5 w-3.5" /> Song radio
				</Link>
			)}
			<PlayButton
				playing={current && now.isPlaying}
				onClick={() => (isTrack ? playFrom({ uris: [item.uri] }, item) : playFrom({ contextUri: item.uri }))}
				className="absolute bottom-5 right-5 z-10 translate-y-2 opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100 focus-visible:translate-y-0 focus-visible:opacity-100"
			/>
		</div>
	);
}

const norm = (s) => (s ?? '').toLowerCase().replace(/^the\s+/, '').replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Prefer an exact name match of any type, then a podcast you already follow
 * that matches the query, then Spotify's top track.
 */
function pickTopResult(data, q, savedShows = []) {
	const needle = norm(q.replace(/^(artist|album|track|genre):/i, '').replace(/"/g, ''));
	const lists = ['artists', 'shows', 'albums', 'audiobooks', 'playlists'].map((k) => clean(data?.[k]));
	for (const list of lists) {
		const hit = list[0] && norm(list[0].name) === needle ? list[0] : null;
		if (hit) return hit;
	}
	const followed = new Set(savedShows.map((s) => s.id));
	const followedMatch = clean(data?.shows).find((s) => followed.has(s.id) && norm(s.name).includes(needle));
	if (needle && followedMatch) return followedMatch;
	const show = clean(data?.shows)[0];
	if (needle.length > 3 && show && norm(show.name).startsWith(needle)) return show;
	return clean(data?.tracks)[0] ?? lists.find((l) => l.length)?.[0] ?? null;
}

function Tiles({ title, tiles, href }) {
	return (
		<section className="px-4 sm:px-6">
			<h2 className="pb-4 text-2xl font-bold">{title}</h2>
			<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
				{tiles.map(([name, gradient]) => (
					<Link
						key={name}
						href={href(name)}
						className={`relative aspect-[16/10] overflow-hidden rounded-xl bg-gradient-to-br ${gradient} p-4 text-xl font-extrabold text-white shadow-lg transition hover:scale-[1.02]`}
					>
						{name}
						<span aria-hidden className="absolute -bottom-4 -right-4 h-20 w-20 rotate-12 rounded-lg bg-white/15" />
					</Link>
				))}
			</div>
		</section>
	);
}

function RecentSearches() {
	const recent = useRecentSearches();
	if (!recent.length) return null;
	return (
		<section className="px-4 sm:px-6">
			<div className="flex items-center justify-between pb-3">
				<h2 className="text-2xl font-bold">Recent searches</h2>
				<button type="button" onClick={clearRecentSearches} className="text-sm font-semibold text-muted hover:text-fg hover:underline">
					Clear
				</button>
			</div>
			<ul className="flex flex-wrap gap-2">
				{recent.map((q) => (
					<li key={q} className="group flex items-center rounded-full bg-elevated text-sm transition hover:bg-hover">
						<Link href={`/search?q=${encodeURIComponent(q)}`} className="flex items-center gap-2 py-1.5 pl-3.5 pr-1">
							<History className="h-3.5 w-3.5 text-muted" />
							{q}
						</Link>
						<button
							type="button"
							aria-label={`Remove “${q}” from recent searches`}
							onClick={() => removeRecentSearch(q)}
							className="mr-1 rounded-full p-1 text-muted hover:text-fg"
						>
							<X className="h-3.5 w-3.5" />
						</button>
					</li>
				))}
			</ul>
		</section>
	);
}

function EpisodeShelf({ title, episodes, loading }) {
	const playEpisode = usePlayEpisode();
	if (!loading && !episodes?.length) return null;
	return (
		<section>
			<h2 className="mb-3 px-4 text-2xl font-bold sm:px-6">{title}</h2>
			<div className={cn(EPISODE_GRID, 'sm:px-6')}>
				{loading
					? Array.from({ length: 3 }, (_, i) => <div key={i} className="skeleton h-[6.5rem]" />)
					: episodes.slice(0, 6).map((ep) => <EpisodeCard key={ep.id} episode={ep} onPlay={playEpisode} />)}
			</div>
		</section>
	);
}

function Browse() {
	const saved = useSavedShows();
	const feed = useEpisodeFeed(saved.data);
	const recs = usePodcastRecommendations(saved.data);
	const hasShows = Boolean(saved.data?.length);

	return (
		<div className="space-y-10 pt-2">
			<RecentSearches />
			{hasShows && (
				<>
					<EpisodeShelf title="Continue listening" episodes={feed.data?.inProgress} loading={feed.isLoading} />
					<EpisodeShelf title="New from your podcasts" episodes={feed.data?.fresh} loading={feed.isLoading} />
					<div className="space-y-8 px-1 sm:px-3">
						<Shelf title="Podcasts for you" items={recs.data?.forYou} loading={recs.isLoading} rows={1} />
						{recs.data?.because.map(({ seed, shows }) => (
							<Shelf key={seed.id} title={`Because you listen to ${seed.name}`} items={shows} rows={1} />
						))}
					</div>
				</>
			)}
			<Tiles
				title="Podcast topics"
				tiles={PODCAST_TOPICS}
				href={(name) => `/search?q=${encodeURIComponent(name.toLowerCase())}&type=show`}
			/>
			<Tiles
				title="Browse genres"
				tiles={GENRES}
				href={(name) => `/search?q=${encodeURIComponent(`genre:"${name.toLowerCase()}"`)}`}
			/>
		</div>
	);
}

function SimilarPodcasts({ show }) {
	const saved = useSavedShows();
	const similar = useSimilarShows(show, saved.data, { enabled: Boolean(saved.data) });
	return <Shelf title={`Podcasts like ${show.name}`} items={similar.data} loading={similar.isLoading} rows={1} />;
}

function AllResults({ q }) {
	const enabled = useSession().status === 'authenticated';
	const saved = useSavedShows();
	const playEpisode = usePlayEpisode();
	const { data, isLoading, error, refetch, isPlaceholderData } = useQuery({
		queryKey: ['search', q, 'all'],
		queryFn: () => spotify.search(q, ALL_TYPES),
		enabled,
		placeholderData: keepPreviousData,
		staleTime: 5 * 60 * 1000
	});

	if (error) return <ErrorState error={error} onRetry={refetch} />;
	if (isLoading) {
		return (
			<div className="space-y-6">
				<TrackListSkeleton rows={4} />
				<div className={CARD_GRID}>
					{Array.from({ length: 5 }, (_, i) => (
						<MediaCardSkeleton key={i} />
					))}
				</div>
			</div>
		);
	}
	const tracks = clean(data?.tracks).map((track) => ({ track }));
	const top = pickTopResult(data, q, saved.data);
	const episodes = clean(data?.episodes);
	const nothing = !top && !clean(data?.shows).length && !episodes.length;
	// Put podcasts first when the query is clearly about one.
	const podcastFirst = top?.type === 'show';
	const podcastSections = (
		<>
			<Shelf title="Podcasts" items={clean(data?.shows)} rows={1} />
			{episodes.length > 0 && (
				<section>
					<div className="flex items-end justify-between px-3 pb-1">
						<h2 className="text-xl font-bold tracking-tight sm:text-2xl">Episodes</h2>
						<Link
							href={`/search?q=${encodeURIComponent(q)}&type=episode`}
							className="text-sm font-semibold text-muted hover:text-fg hover:underline"
						>
							Show all
						</Link>
					</div>
					<div className="-mx-1 sm:-mx-3">
						{episodes.slice(0, 4).map((ep) => (
							<EpisodeRow key={ep.id} episode={ep} onPlay={playEpisode} />
						))}
					</div>
				</section>
			)}
		</>
	);
	if (nothing) {
		return (
			<EmptyState icon={SearchX} title={`No results found for “${q}”`}>
				Check the spelling, or try fewer or different keywords.
			</EmptyState>
		);
	}

	return (
		<div className={isPlaceholderData ? 'space-y-8 opacity-60 transition-opacity' : 'space-y-8 transition-opacity'}>
			<div className="grid gap-6 px-1 sm:px-3 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
				<section className="px-3">
					<h2 className="mb-3 text-2xl font-bold">Top result</h2>
					<TopResult item={top} />
				</section>
				{tracks.length > 0 && (
					<section className="min-w-0">
						<h2 className="mb-1 px-3 text-2xl font-bold">Songs</h2>
						<TrackList items={tracks.slice(0, 5)} context={{ uris: tracks.map((t) => t.track.uri) }} showAlbum={false} className="-mx-1" />
					</section>
				)}
			</div>
			<div className="space-y-8 px-1 sm:px-3">
				{podcastFirst && podcastSections}
				{podcastFirst && <SimilarPodcasts show={top} />}
				<Shelf title="Artists" items={clean(data?.artists)} rows={1} />
				<Shelf title="Albums" items={clean(data?.albums)} rows={1} />
				<Shelf title="Playlists" items={clean(data?.playlists)} rows={1} />
				{!podcastFirst && podcastSections}
				<Shelf title="Audiobooks" items={clean(data?.audiobooks)} rows={1} />
			</div>
		</div>
	);
}

function TypedResults({ q, filter }) {
	const enabled = useSession().status === 'authenticated';
	const playEpisode = usePlayEpisode();
	const res = useInfiniteQuery({
		queryKey: ['search', q, filter.id],
		queryFn: ({ pageParam }) => spotify.search(q, [filter.id], { limit: 10, offset: pageParam }),
		initialPageParam: 0,
		getNextPageParam: (last) => {
			const page = last?.[filter.key];
			// The search API stops at offset 1000.
			return page?.next && page.offset + page.limit < 1000 ? page.offset + page.limit : undefined;
		},
		enabled
	});
	const items = useMemo(() => (res.data?.pages ?? []).flatMap((p) => clean(p?.[filter.key])), [res.data, filter.key]);

	if (res.error) return <ErrorState error={res.error} onRetry={res.refetch} />;
	if (res.isLoading) return filter.id === 'track' || filter.id === 'episode' ? <TrackListSkeleton /> : (
		<div className={CARD_GRID}>{Array.from({ length: 10 }, (_, i) => <MediaCardSkeleton key={i} />)}</div>
	);
	if (!items.length) return <EmptyState icon={SearchX} title={`No ${filter.label.toLowerCase()} found for “${q}”`} />;

	const more = res.hasNextPage && (
		<div className="flex justify-center py-6">
			<button
				type="button"
				onClick={() => res.fetchNextPage()}
				disabled={res.isFetchingNextPage}
				className="rounded-full border border-line px-5 py-2 text-sm font-semibold transition hover:border-fg disabled:opacity-50"
			>
				{res.isFetchingNextPage ? <Spinner className="h-4 w-4" /> : 'Load more'}
			</button>
		</div>
	);

	if (filter.id === 'episode') {
		return (
			<>
				{items.map((ep) => (
					<EpisodeRow key={ep.id} episode={ep} onPlay={playEpisode} />
				))}
				{more}
			</>
		);
	}
	if (filter.id === 'track') {
		const rows = items.map((track) => ({ track }));
		return (
			<>
				<TrackList items={rows} context={{ uris: items.map((t) => t.uri) }} />
				{more}
			</>
		);
	}
	return (
		<div className="px-1 sm:px-3">
			<div className={CARD_GRID}>
				{items.map((item, i) => (
					<MediaCard key={`${item.id}-${i}`} item={item} />
				))}
			</div>
			{more}
		</div>
	);
}

export default function SearchPage() {
	const router = useRouter();
	const q = typeof router.query.q === 'string' ? router.query.q.trim() : '';
	const filter = FILTERS.find((f) => f.id === router.query.type) ?? FILTERS[0];

	// Remember a query once the user has paused on it (typing updates the URL as they go).
	useEffect(() => {
		if (!q) return undefined;
		const t = setTimeout(() => addRecentSearch(q), 1500);
		return () => clearTimeout(t);
	}, [q]);

	const setFilter = (id) => {
		const query = { q, ...(id !== 'all' ? { type: id } : {}) };
		router.replace({ pathname: '/search', query }, undefined, { shallow: true, scroll: false });
	};

	return (
		<>
			<Head>
				<title>{q ? `“${q}” · Search · Antefy` : 'Search · Antefy'}</title>
			</Head>
			{!q ? (
				<Browse />
			) : (
				<div className="space-y-6">
					<div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pt-1 sm:px-6" role="tablist" aria-label="Result type">
						{FILTERS.map((f) => (
							<Chip key={f.id} role="tab" aria-selected={f.id === filter.id} active={f.id === filter.id} onClick={() => setFilter(f.id)}>
								{f.label}
							</Chip>
						))}
					</div>
					{filter.id === 'all' ? <AllResults q={q} /> : <TypedResults key={filter.id} q={q} filter={filter} />}
				</div>
			)}
		</>
	);
}
