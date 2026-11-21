import { useState } from 'react';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Disc3, ExternalLink, ListMinus, ListPlus, MoreHorizontal, Plus, Radio, User } from 'lucide-react';
import { toast } from 'sonner';
import PlaylistDialog from './PlaylistDialog';
import { cn } from '@/lib/cn';
import { addToQueue, describeError } from '@/lib/spotify';
import {
	canEditPlaylist,
	useAddToPlaylist,
	useCreatePlaylist,
	useEditablePlaylists,
	useRemoveFromPlaylist
} from '@/hooks/usePlaylistEdits';

const item =
	'flex cursor-pointer select-none items-center gap-3 rounded-md px-3 py-2 text-sm outline-none data-[highlighted]:bg-hover';
const panel =
	'z-[60] min-w-[13rem] animate-fade-in rounded-xl border border-line bg-elevated outline-none focus-visible:ring-0 p-1.5 text-fg shadow-2xl';

function AddToPlaylist({ track, onNew }) {
	const { data: playlists, isLoading } = useEditablePlaylists();
	const add = useAddToPlaylist();
	return (
		<Dropdown.Sub>
			<Dropdown.SubTrigger className={item}>
				<ListPlus className="h-4 w-4" /> Add to playlist
				<ChevronRight className="ml-auto h-4 w-4 text-muted" />
			</Dropdown.SubTrigger>
			<Dropdown.Portal>
				<Dropdown.SubContent sideOffset={6} collisionPadding={12} className={cn(panel, 'max-h-80 w-60 overflow-y-auto')}>
					<Dropdown.Item className={item} onSelect={onNew}>
						<Plus className="h-4 w-4" /> New playlist
					</Dropdown.Item>
					<Dropdown.Separator className="my-1 h-px bg-line" />
					{isLoading && <p className="px-3 py-2 text-xs text-muted">Loading…</p>}
					{!isLoading && playlists.length === 0 && <p className="px-3 py-2 text-xs text-muted">No playlists you can edit.</p>}
					{playlists.map((p) => (
						<Dropdown.Item
							key={p.id}
							className={item}
							onSelect={() => add.mutate({ playlist: p, uris: [track.uri], name: track.name })}
						>
							<span className="truncate">{p.name}</span>
						</Dropdown.Item>
					))}
				</Dropdown.SubContent>
			</Dropdown.Portal>
		</Dropdown.Sub>
	);
}

/** "…" menu for a track: radio, queue, playlists, navigation. Pass `playlist` when the row is inside one. */
export default function TrackMenu({ track, playlist, className }) {
	const router = useRouter();
	const { data: session } = useSession();
	const queryClient = useQueryClient();
	const remove = useRemoveFromPlaylist();
	const create = useCreatePlaylist();
	const [creating, setCreating] = useState(false);
	if (!track?.id || !track.uri?.startsWith('spotify:track:')) return null;
	const artist = track.artists?.find((a) => a.id);
	const editable = canEditPlaylist(playlist, session?.user?.id);

	return (
		<>
			<Dropdown.Root modal={false}>
				<Dropdown.Trigger
					aria-label={`More options for ${track.name}`}
					onClick={(e) => e.stopPropagation()}
					onDoubleClick={(e) => e.stopPropagation()}
					className={cn(
						'inline-flex h-7 w-7 items-center justify-center rounded-full text-muted transition hover:text-fg data-[state=open]:text-fg data-[state=open]:opacity-100',
						className
					)}
				>
					<MoreHorizontal className="h-4 w-4" />
				</Dropdown.Trigger>
				<Dropdown.Portal>
					<Dropdown.Content
						align="end"
						sideOffset={4}
						collisionPadding={12}
						onClick={(e) => e.stopPropagation()}
						className={panel}
					>
						<Dropdown.Item className={item} onSelect={() => router.push(`/radio/${track.id}`)}>
							<Radio className="h-4 w-4" /> Go to song radio
						</Dropdown.Item>
						<Dropdown.Item
							className={item}
							onSelect={() =>
								addToQueue(track.uri)
									.then(() => {
										toast.success(`Added “${track.name}” to queue`);
										queryClient.invalidateQueries({ queryKey: ['queue'] });
									})
									.catch((e) => toast.error(describeError(e)))
							}
						>
							<ListPlus className="h-4 w-4" /> Add to queue
						</Dropdown.Item>
						<AddToPlaylist track={track} onNew={() => setCreating(true)} />
						{editable && (
							<Dropdown.Item
								className={item}
								onSelect={() => remove.mutate({ playlist, uris: [track.uri], name: track.name })}
							>
								<ListMinus className="h-4 w-4" /> Remove from this playlist
							</Dropdown.Item>
						)}
						<Dropdown.Separator className="my-1 h-px bg-line" />
						{artist && (
							<Dropdown.Item className={item} onSelect={() => router.push(`/artist/${artist.id}`)}>
								<User className="h-4 w-4" /> Go to artist
							</Dropdown.Item>
						)}
						{track.album?.id && (
							<Dropdown.Item className={item} onSelect={() => router.push(`/album/${track.album.id}`)}>
								<Disc3 className="h-4 w-4" /> Go to album
							</Dropdown.Item>
						)}
						<Dropdown.Item asChild className={item}>
							<a href={`https://open.spotify.com/track/${track.id}`} target="_blank" rel="noreferrer">
								<ExternalLink className="h-4 w-4" /> Open in Spotify
							</a>
						</Dropdown.Item>
					</Dropdown.Content>
				</Dropdown.Portal>
			</Dropdown.Root>
			<PlaylistDialog
				open={creating}
				onOpenChange={setCreating}
				pending={create.isPending}
				onSubmit={(details) =>
					create.mutate({ ...details, uris: [track.uri] }, { onSuccess: () => setCreating(false) })
				}
			/>
		</>
	);
}
