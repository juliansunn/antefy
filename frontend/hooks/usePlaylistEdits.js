import { useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import * as spotify from '@/lib/spotify';
import { useMyPlaylists } from '@/hooks/useLibrary';

/** Playlists the signed-in user can add to (owned or collaborative). */
export function useEditablePlaylists() {
	const { data: session } = useSession();
	const playlists = useMyPlaylists();
	const userId = session?.user?.id;
	const data = useMemo(
		() => (playlists.data ?? []).filter((p) => p.collaborative || (userId && p.owner?.id === userId)),
		[playlists.data, userId]
	);
	return { ...playlists, data };
}

export function canEditPlaylist(playlist, userId) {
	return Boolean(playlist && (playlist.collaborative || (userId && playlist.owner?.id === userId)));
}

function useRefreshPlaylist() {
	const queryClient = useQueryClient();
	return (id) => {
		queryClient.invalidateQueries({ queryKey: ['playlist', id] });
		queryClient.invalidateQueries({ queryKey: ['playlist-items', id] });
		queryClient.invalidateQueries({ queryKey: ['library', 'playlists'] });
	};
}

export function useAddToPlaylist() {
	const refresh = useRefreshPlaylist();
	return useMutation({
		mutationFn: ({ playlist, uris }) => spotify.addTracksToPlaylist(playlist.id, uris),
		onSuccess: (_d, { playlist, name }) => {
			toast.success(`Added${name ? ` “${name}”` : ''} to ${playlist.name}`);
			refresh(playlist.id);
		},
		onError: (e) => toast.error(spotify.describeError(e))
	});
}

export function useRemoveFromPlaylist() {
	const refresh = useRefreshPlaylist();
	return useMutation({
		mutationFn: ({ playlist, uris }) => spotify.removeFromPlaylist(playlist.id, uris, playlist.snapshot_id),
		onSuccess: (_d, { playlist, name }) => {
			toast.success(`Removed${name ? ` “${name}”` : ''} from ${playlist.name}`);
			refresh(playlist.id);
		},
		onError: (e) => toast.error(spotify.describeError(e))
	});
}

/** Create a playlist, optionally seeded with tracks. Resolves the new playlist. */
export function useCreatePlaylist() {
	const { data: session } = useSession();
	const refresh = useRefreshPlaylist();
	return useMutation({
		mutationFn: async ({ name, description, isPublic, uris }) => {
			const playlist = await spotify.createPlaylist(session?.user?.id, { name, description, isPublic });
			if (uris?.length) await spotify.addTracksToPlaylist(playlist.id, uris);
			return playlist;
		},
		onSuccess: (playlist) => {
			toast.success(`Created “${playlist.name}”`);
			refresh(playlist.id);
		},
		onError: (e) => toast.error(spotify.describeError(e))
	});
}

export function useUpdatePlaylist() {
	const queryClient = useQueryClient();
	const refresh = useRefreshPlaylist();
	return useMutation({
		mutationFn: ({ playlist, ...details }) => spotify.updatePlaylistDetails(playlist.id, details),
		onMutate: ({ playlist, name, description, isPublic }) => {
			queryClient.setQueryData(['playlist', playlist.id], (old) =>
				old ? { ...old, name: name ?? old.name, description: description ?? old.description, public: isPublic ?? old.public } : old
			);
		},
		onSuccess: (_d, { playlist }) => {
			toast.success('Playlist updated');
			refresh(playlist.id);
		},
		onError: (e, { playlist }) => {
			toast.error(spotify.describeError(e));
			refresh(playlist.id);
		}
	});
}
