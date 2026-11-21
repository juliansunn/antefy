import { useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { ListMusic, Lock, Pencil } from 'lucide-react';
import CollectionHeader, { ActionBar, Dot } from '@/components/media/CollectionHeader';
import PlayButton from '@/components/media/PlayButton';
import PlaylistDialog from '@/components/media/PlaylistDialog';
import IconButton from '@/components/ui/IconButton';
import TrackList, { TrackListSkeleton } from '@/components/media/TrackList';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { cleanDescription, formatNumber, pluralize } from '@/lib/format';
import { useNowPlaying, usePlayFrom } from '@/hooks/usePlayback';
import { usePlaylist } from '@/hooks/useCollections';
import { canEditPlaylist, useUpdatePlaylist } from '@/hooks/usePlaylistEdits';

export default function PlaylistPage() {
	const { query } = useRouter();
	const id = query.playlistId;
	const { playlist, items } = usePlaylist(id);
	const playFrom = usePlayFrom();
	const now = useNowPlaying();
	const p = playlist.data;
	const { data: session } = useSession();
	const editable = canEditPlaylist(p, session?.user?.id);
	const update = useUpdatePlaylist();
	const [editing, setEditing] = useState(false);

	const rows = useMemo(
		() =>
			(items.data?.pages ?? []).flatMap((page) =>
				(page.items ?? []).map((i) => ({ track: i.track, addedAt: i.added_at }))
			),
		[items.data]
	);

	if (playlist.error) return <ErrorState error={playlist.error} onRetry={playlist.refetch} className="min-h-[60vh]" />;

	const context = p ? { contextUri: p.uri } : undefined;
	const isCurrent = p && now.contextUri === p.uri;
	const tracksRestricted = items.error && [403, 404].includes(items.error.status);

	return (
		<>
			<Head>
				<title>{p ? `${p.name} · Antefy` : 'Playlist · Antefy'}</title>
			</Head>
			<CollectionHeader
				loading={playlist.isLoading}
				label={p?.public === false ? 'Private playlist' : 'Playlist'}
				title={p?.name}
				images={p?.images}
				coverType="playlist"
				seed={id}
				description={cleanDescription(p?.description)}
				meta={
					p && (
						<>
							<span className="font-semibold">{p.owner?.display_name}</span>
							{p.followers?.total > 0 && (
								<>
									<Dot />
									<span>{formatNumber(p.followers.total)} saves</span>
								</>
							)}
							{p.total > 0 && (
								<>
									<Dot />
									<span>{pluralize(p.total, 'song')}</span>
								</>
							)}
						</>
					)
				}
			/>
			{p && (
				<ActionBar>
					<PlayButton size="lg" playing={isCurrent && now.isPlaying} onClick={() => playFrom(context)} />
					{p.public === false && <Lock className="h-5 w-5 text-muted" aria-label="Private" />}
					{editable && p.owner?.id === session?.user?.id && (
						<IconButton label="Edit details" onClick={() => setEditing(true)}>
							<Pencil className="h-5 w-5" />
						</IconButton>
					)}
				</ActionBar>
			)}
			{items.isLoading ? (
				<TrackListSkeleton />
			) : tracksRestricted ? (
				<EmptyState icon={Lock} title="Tracks unavailable">
					Spotify only lets this app list tracks for playlists you own or collaborate on. You can still play it with the
					button above.
				</EmptyState>
			) : items.error ? (
				<ErrorState error={items.error} onRetry={items.refetch} />
			) : rows.length === 0 ? (
				<EmptyState icon={ListMusic} title="This playlist is empty" />
			) : (
				<TrackList
					items={rows}
					context={context}
					dateColumn="added"
					playlist={p}
					hasMore={items.hasNextPage}
					loadingMore={items.isFetchingNextPage}
					onLoadMore={items.fetchNextPage}
				/>
			)}
			{p && (
				<PlaylistDialog
					open={editing}
					onOpenChange={setEditing}
					playlist={p}
					pending={update.isPending}
					onSubmit={(details) => {
						update.mutate({ playlist: p, ...details });
						setEditing(false);
					}}
				/>
			)}
		</>
	);
}
