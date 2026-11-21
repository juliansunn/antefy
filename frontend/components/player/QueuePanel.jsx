import { useMemo } from 'react';
import Link from 'next/link';
import * as Dialog from '@radix-ui/react-dialog';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ListMusic, ListPlus, Play, Radio, X } from 'lucide-react';
import { toast } from 'sonner';
import Cover from '@/components/ui/Cover';
import IconButton from '@/components/ui/IconButton';
import { Spinner } from '@/components/ui/States';
import MediaCard from '@/components/media/MediaCard';
import { cn } from '@/lib/cn';
import { formatDuration } from '@/lib/format';
import { buildRadio } from '@/lib/radio';
import * as spotify from '@/lib/spotify';
import { useUiStore } from '@/lib/store';
import { usePlaybackState, usePlayEpisode, usePlayFrom } from '@/hooks/usePlayback';
import { useSavedShows } from '@/hooks/useLibrary';
import { useSimilarShows } from '@/hooks/usePodcasts';

const SUGGESTIONS = 10;

function subtitle(item) {
	if (item.type === 'episode') return item.show?.name ?? 'Episode';
	return item.artists?.map((a) => a.name).join(', ');
}

function Row({ item, active, onPlay, onQueue }) {
	const images = item.album?.images ?? item.images ?? item.show?.images;
	return (
		<li className="group flex items-center gap-3 rounded-md px-2 py-1.5 transition hover:bg-hover/60">
			<button
				type="button"
				onClick={onPlay}
				disabled={!onPlay}
				aria-label={`Play ${item.name}`}
				className="relative shrink-0 disabled:cursor-default"
			>
				<Cover images={images} type={item.type === 'episode' ? 'episode' : 'album'} alt="" size={64} className="h-10 w-10 rounded" />
				{onPlay && (
					<span className="absolute inset-0 hidden items-center justify-center rounded bg-black/50 text-white group-hover:flex">
						<Play className="h-4 w-4 fill-current" />
					</span>
				)}
			</button>
			<div className="min-w-0 flex-1">
				<p className={cn('truncate text-sm', active ? 'text-accent' : 'text-fg')}>{item.name}</p>
				<p className="truncate text-xs text-muted">{subtitle(item)}</p>
			</div>
			<span className="text-xs tabular-nums text-muted">{formatDuration(item.duration_ms)}</span>
			{onQueue && (
				<button
					type="button"
					onClick={onQueue}
					aria-label={`Add ${item.name} to queue`}
					title="Add to queue"
					className="rounded-full p-1 text-muted opacity-0 transition hover:text-fg focus-visible:opacity-100 group-hover:opacity-100"
				>
					<ListPlus className="h-4 w-4" />
				</button>
			)}
		</li>
	);
}

function Section({ title, action, children }) {
	return (
		<section className="pt-4">
			<div className="flex items-center justify-between px-2 pb-1">
				<h3 className="text-sm font-bold">{title}</h3>
				{action}
			</div>
			{children}
		</section>
	);
}

function useAddToQueue() {
	const queryClient = useQueryClient();
	return (item) =>
		spotify
			.addToQueue(item.uri)
			.then(() => {
				toast.success(`Added “${item.name}” to queue`);
				queryClient.invalidateQueries({ queryKey: ['queue'] });
			})
			.catch((e) => toast.error(spotify.describeError(e)));
}

/** "Suggested next" for a song: the song radio mix, minus what's already queued. */
function TrackSuggestions({ track, queuedIds }) {
	const radio = useQuery({
		queryKey: ['radio', track.id, 0],
		queryFn: () => buildRadio(track, 0),
		staleTime: 30 * 60 * 1000
	});
	const playFrom = usePlayFrom();
	const addToQueue = useAddToQueue();
	const picks = useMemo(
		() => (radio.data?.tracks ?? []).filter((t) => t.id !== track.id && !queuedIds.has(t.id)).slice(0, SUGGESTIONS),
		[radio.data, track.id, queuedIds]
	);

	return (
		<Section
			title="Suggested next"
			action={
				<Link href={`/radio/${track.id}`} className="flex items-center gap-1 text-xs font-semibold text-muted hover:text-fg">
					<Radio className="h-3.5 w-3.5" /> Song radio
				</Link>
			}
		>
			{radio.isLoading ? (
				<div className="flex justify-center py-4">
					<Spinner />
				</div>
			) : picks.length ? (
				<ul>
					{picks.map((t) => (
						<Row
							key={t.id}
							item={t}
							onPlay={() => playFrom({ uris: picks.map((p) => p.uri) }, t)}
							onQueue={() => addToQueue(t)}
						/>
					))}
				</ul>
			) : (
				<p className="px-2 py-3 text-xs text-muted">No suggestions for this song.</p>
			)}
		</Section>
	);
}

/** "Suggested next" for an episode: unplayed episodes of the same show, then similar shows. */
function EpisodeSuggestions({ episode, queuedIds }) {
	const show = episode.show;
	const saved = useSavedShows();
	const playEpisode = usePlayEpisode();
	const addToQueue = useAddToQueue();
	const more = useQuery({
		queryKey: ['show-episodes-peek', show?.id],
		queryFn: () => spotify.getShowEpisodes(show.id, 0, 20),
		enabled: Boolean(show?.id),
		staleTime: 5 * 60 * 1000
	});
	const similar = useSimilarShows(show, saved.data, { enabled: Boolean(saved.data) });
	const episodes = useMemo(
		() =>
			(more.data?.items ?? [])
				.filter((ep) => ep?.id && ep.id !== episode.id && !queuedIds.has(ep.id) && !ep.resume_point?.fully_played)
				.slice(0, 6)
				.map((ep) => ({ ...ep, show })),
		[more.data, episode.id, queuedIds, show]
	);

	return (
		<>
			<Section title={show?.name ? `More from ${show.name}` : 'More episodes'}>
				{more.isLoading ? (
					<div className="flex justify-center py-4">
						<Spinner />
					</div>
				) : episodes.length ? (
					<ul>
						{episodes.map((ep) => (
							<Row key={ep.id} item={ep} onPlay={() => playEpisode(ep)} onQueue={() => addToQueue(ep)} />
						))}
					</ul>
				) : (
					<p className="px-2 py-3 text-xs text-muted">You’re all caught up.</p>
				)}
			</Section>
			{similar.data?.length > 0 && (
				<Section title="Podcasts like this">
					<div className="grid grid-cols-2 gap-1">
						{similar.data.slice(0, 4).map((s) => (
							<MediaCard key={s.id} item={s} />
						))}
					</div>
				</Section>
			)}
		</>
	);
}

export function QueueToggle() {
	const open = useUiStore((s) => s.queueOpen);
	const setOpen = useUiStore((s) => s.setQueueOpen);
	return (
		<IconButton label="Queue" active={open} onClick={() => setOpen(!open)}>
			<ListMusic className="h-[18px] w-[18px]" />
		</IconButton>
	);
}

/** Side panel: what's playing, what's queued, and what you might want next. */
export default function QueuePanel() {
	const open = useUiStore((s) => s.queueOpen);
	const setOpen = useUiStore((s) => s.setQueueOpen);
	const autoplay = useUiStore((s) => s.autoplay);
	const setAutoplay = useUiStore((s) => s.setAutoplay);
	const { data: playback } = usePlaybackState();
	const current = playback?.item;
	const queue = useQuery({
		queryKey: ['queue', current?.id ?? null],
		queryFn: spotify.getQueue,
		enabled: open,
		refetchInterval: open ? 15000 : false,
		staleTime: 3000
	});
	const queued = useMemo(() => (queue.data?.queue ?? []).filter(Boolean), [queue.data]);
	// Spotify pads the queue with the rest of the context; show a sensible amount.
	const visible = queued.slice(0, 20);
	const queuedIds = useMemo(() => new Set(queued.map((q) => q.id)), [queued]);

	return (
		<Dialog.Root open={open} onOpenChange={setOpen} modal={false}>
			<Dialog.Portal>
				<Dialog.Content
					aria-describedby={undefined}
					onInteractOutside={(e) => e.preventDefault()}
					className="fixed bottom-[calc(var(--player-h,88px)+0.5rem)] right-2 top-2 z-50 flex w-[min(24rem,calc(100vw-1rem))] animate-fade-in flex-col rounded-xl border border-line bg-elevated shadow-2xl max-md:bottom-[8.5rem]"
				>
					<div className="flex items-center justify-between border-b border-line px-4 py-3">
						<Dialog.Title className="font-bold">Queue</Dialog.Title>
						<label className="ml-auto mr-2 flex cursor-pointer items-center gap-2 text-xs font-semibold text-muted" title="When playback runs out, play a similar song or the next episode">
							Autoplay
							<button
								type="button"
								role="switch"
								aria-checked={autoplay}
								onClick={() => setAutoplay(!autoplay)}
								className={cn('relative h-5 w-9 rounded-full transition', autoplay ? 'bg-accent' : 'bg-fg/25')}
							>
								<span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all', autoplay ? 'left-[1.125rem]' : 'left-0.5')} />
							</button>
						</label>
						<Dialog.Close asChild>
							<IconButton label="Close queue" size="sm">
								<X className="h-4 w-4" />
							</IconButton>
						</Dialog.Close>
					</div>
					<div className="scroll-area min-h-0 flex-1 overflow-y-auto px-2 pb-4">
						{!current ? (
							<p className="px-2 py-8 text-center text-sm text-muted">Nothing playing. Start something and your queue shows up here.</p>
						) : (
							<>
								<Section title="Now playing">
									<ul>
										<Row item={current} active />
									</ul>
								</Section>
								<Section title="Next up">
									{queue.isLoading ? (
										<div className="flex justify-center py-4">
											<Spinner />
										</div>
									) : visible.length ? (
										<ul>
											{visible.map((item, i) => (
												<Row key={`${item.id}-${i}`} item={item} />
											))}
										</ul>
									) : (
										<p className="px-2 py-3 text-xs text-muted">Your queue is empty.</p>
									)}
								</Section>
								{current.type === 'episode' ? (
									<EpisodeSuggestions episode={current} queuedIds={queuedIds} />
								) : current.id ? (
									<TrackSuggestions track={current} queuedIds={queuedIds} />
								) : null}
							</>
						)}
					</div>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
