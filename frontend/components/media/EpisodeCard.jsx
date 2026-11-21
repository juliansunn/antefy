import Link from 'next/link';
import Cover from '@/components/ui/Cover';
import PlayButton from './PlayButton';
import { cn } from '@/lib/cn';
import { formatDate, formatLongDuration } from '@/lib/format';
import { useNowPlaying } from '@/hooks/usePlayback';

/** Compact episode card for horizontal feeds ("Continue listening", "New episodes"). */
export default function EpisodeCard({ episode, onPlay, className }) {
	const now = useNowPlaying();
	const current = now.id === episode.id;
	const resume = episode.resume_point;
	const pct =
		!resume?.fully_played && resume?.resume_position_ms ? (resume.resume_position_ms / episode.duration_ms) * 100 : 0;
	const remaining = pct ? episode.duration_ms - resume.resume_position_ms : 0;
	const show = episode.show;

	return (
		<div className={cn('group relative flex gap-3 rounded-lg bg-fg/[0.06] p-3 transition hover:bg-fg/[0.12]', className)}>
			<Cover images={episode.images ?? show?.images} type="episode" alt="" size={120} className="h-20 w-20 shrink-0 rounded-md" />
			<div className="flex min-w-0 flex-1 flex-col">
				<Link
					href={show?.id ? `/podcast/${show.id}` : '#'}
					className={cn('line-clamp-2 text-sm font-semibold after:absolute after:inset-0', current && 'text-accent')}
				>
					{episode.name}
				</Link>
				{show?.name && <p className="truncate text-xs text-muted">{show.name}</p>}
				<div className="mt-auto flex items-center gap-2 pt-2 text-xs text-muted">
					<span className="truncate">
						{remaining ? `${formatLongDuration(remaining)} left` : `${formatDate(episode.release_date)} · ${formatLongDuration(episode.duration_ms)}`}
					</span>
					{pct > 0 && (
						<span className="h-1 w-14 shrink-0 overflow-hidden rounded-full bg-fg/20">
							<span className="block h-full bg-accent" style={{ width: `${pct}%` }} />
						</span>
					)}
				</div>
			</div>
			<PlayButton
				size="sm"
				playing={current && now.isPlaying}
				label={`Play ${episode.name}`}
				onClick={() => onPlay(episode)}
				className="relative z-10 self-center"
			/>
		</div>
	);
}

export const EPISODE_GRID = 'grid gap-2 px-3 sm:grid-cols-2 xl:grid-cols-3';
