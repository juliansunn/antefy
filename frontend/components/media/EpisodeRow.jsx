import { memo } from 'react';
import Link from 'next/link';
import { Check, CheckCircle2 } from 'lucide-react';
import Cover from '@/components/ui/Cover';
import PlayButton from './PlayButton';
import QueueButton from './QueueButton';
import { cn } from '@/lib/cn';
import { cleanDescription, formatDate, formatLongDuration } from '@/lib/format';
import { isPlayed, setPlayed, usePodcastState } from '@/lib/podcastState';
import { useNowPlaying } from '@/hooks/usePlayback';

/**
 * `show` adds a link to the podcast (lists that mix shows). `isNew` shows a
 * "New" badge. Chapters (audiobooks) pass `markable={false}`.
 */
function EpisodeRow({ episode, onPlay, show, isNew, markable = true }) {
	const now = useNowPlaying();
	const podcastState = usePodcastState();
	const current = now.id === episode.id;
	const resume = episode.resume_point;
	const played = isPlayed(podcastState, episode);
	const pct = !played && resume?.resume_position_ms ? (resume.resume_position_ms / episode.duration_ms) * 100 : 0;
	const remaining = pct ? episode.duration_ms - resume.resume_position_ms : 0;
	const playable = episode.is_playable !== false;
	const isEpisode = episode.uri?.startsWith('spotify:episode:');

	return (
		<article
			className={cn(
				'group flex gap-4 border-b border-line/60 px-4 py-4 transition hover:bg-hover/40 sm:px-6',
				!playable && 'opacity-50'
			)}
		>
			<Cover images={episode.images ?? show?.images} type="episode" alt="" size={120} className="hidden h-28 w-28 shrink-0 rounded-lg sm:block" />
			<div className="min-w-0 flex-1">
				<h3 className={cn('line-clamp-2 font-semibold', current && 'text-accent', played && !current && 'text-fg/70')}>
					{isNew && (
						<span className="mr-1.5 inline-block rounded-full bg-accent px-1.5 py-px align-[2px] text-[10px] font-bold uppercase tracking-wide text-accent-fg">
							New
						</span>
					)}
					{episode.explicit && (
						<span className="mr-1.5 inline-flex h-4 w-4 items-center justify-center rounded-sm bg-muted/70 align-[2px] text-[9px] font-bold text-bg">
							E
						</span>
					)}
					{episode.name}
				</h3>
				{show?.id && (
					<Link href={`/podcast/${show.id}`} className="mt-0.5 block truncate text-sm font-medium text-fg/80 hover:underline">
						{show.name}
					</Link>
				)}
				<p className="mt-1 line-clamp-2 text-sm text-muted">{cleanDescription(episode.description)}</p>
				<div className="mt-3 flex items-center gap-4">
					<PlayButton
						size="sm"
						playing={current && now.isPlaying}
						label={`${current && now.isPlaying ? 'Pause' : 'Play'} ${episode.name}`}
						onClick={() => playable && onPlay(episode)}
						className="bg-fg text-bg"
					/>
					<span className="text-sm text-muted">
						{formatDate(episode.release_date)} ·{' '}
						{remaining ? `${formatLongDuration(remaining)} left` : formatLongDuration(episode.duration_ms)}
					</span>
					{pct > 0 && (
						<span className="hidden h-1 w-24 overflow-hidden rounded-full bg-fg/20 sm:block">
							<span className="block h-full bg-accent" style={{ width: `${pct}%` }} />
						</span>
					)}
					{played && !markable && <CheckCircle2 className="h-4 w-4 text-accent" aria-label="Played" />}
					<div className="ml-auto flex items-center gap-1">
						{markable && isEpisode && (
							<button
								type="button"
								aria-pressed={played}
								aria-label={played ? `Mark ${episode.name} as unplayed` : `Mark ${episode.name} as played`}
								title={played ? 'Mark as unplayed' : 'Mark as played'}
								onClick={() => setPlayed(episode.id, !played)}
								className={cn(
									'inline-flex h-8 w-8 items-center justify-center rounded-full transition',
									played
										? 'text-accent hover:text-accent/80'
										: 'text-muted opacity-0 hover:text-fg focus-visible:opacity-100 group-hover:opacity-100'
								)}
							>
								{played ? <CheckCircle2 className="h-[18px] w-[18px]" /> : <Check className="h-[18px] w-[18px]" />}
							</button>
						)}
						{playable && isEpisode && (
							<QueueButton uri={episode.uri} name={episode.name} className="opacity-0 focus-visible:opacity-100 group-hover:opacity-100" />
						)}
					</div>
				</div>
			</div>
		</article>
	);
}

export default memo(EpisodeRow);
