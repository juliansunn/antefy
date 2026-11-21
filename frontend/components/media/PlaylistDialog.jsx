import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { Spinner } from '@/components/ui/States';
import { cleanDescription } from '@/lib/format';

const field =
	'w-full rounded-md border border-line bg-bg/60 px-3 py-2 text-sm text-fg placeholder:text-subtle focus:border-fg/40 focus:outline-none';

/**
 * Create or edit a playlist's name, description and visibility.
 * Pass `playlist` to edit; omit it to create. `onSubmit` gets
 * { name, description, isPublic } and may return a promise.
 */
export default function PlaylistDialog({ open, onOpenChange, playlist, onSubmit, pending }) {
	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Portal>
				<Dialog.Overlay className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm" />
				<Dialog.Content
					aria-describedby={undefined}
					className="fixed left-1/2 top-1/2 z-[80] w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 animate-fade-in rounded-xl border border-line bg-elevated p-5 text-fg shadow-2xl"
				>
					{/* Remount the form each time it opens so it starts from the playlist's current values. */}
					{open && <PlaylistForm playlist={playlist} onSubmit={onSubmit} pending={pending} />}
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}

function PlaylistForm({ playlist, onSubmit, pending }) {
	const [name, setName] = useState(playlist?.name ?? '');
	const [description, setDescription] = useState(cleanDescription(playlist?.description));
	const [isPublic, setIsPublic] = useState(playlist ? playlist.public !== false : false);
	const editing = Boolean(playlist);

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				if (!name.trim()) return;
				onSubmit({ name: name.trim(), description: description.trim(), isPublic });
			}}
			className="space-y-4"
		>
			<div className="flex items-center justify-between">
				<Dialog.Title className="text-lg font-bold">{editing ? 'Edit details' : 'New playlist'}</Dialog.Title>
				<Dialog.Close aria-label="Close" className="rounded-full p-1 text-muted hover:text-fg">
					<X className="h-5 w-5" />
				</Dialog.Close>
			</div>
			<label className="block space-y-1.5">
				<span className="text-xs font-semibold text-muted">Name</span>
				<input
					autoFocus
					value={name}
					onChange={(e) => setName(e.target.value)}
					maxLength={100}
					placeholder="My playlist"
					className={field}
				/>
			</label>
			<label className="block space-y-1.5">
				<span className="text-xs font-semibold text-muted">Description</span>
				<textarea
					value={description}
					onChange={(e) => setDescription(e.target.value)}
					maxLength={300}
					rows={3}
					placeholder="Add an optional description"
					className={`${field} resize-none`}
				/>
			</label>
			<label className="flex items-center gap-2 text-sm">
				<input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="accent-[rgb(var(--accent))]" />
				Public (shows on your Spotify profile)
			</label>
			<div className="flex justify-end">
				<button
					type="submit"
					disabled={!name.trim() || pending}
					className="inline-flex min-w-[6rem] items-center justify-center rounded-full bg-fg px-5 py-2 text-sm font-bold text-bg transition hover:scale-105 disabled:opacity-50"
				>
					{pending ? <Spinner className="h-4 w-4 text-bg" /> : editing ? 'Save' : 'Create'}
				</button>
			</div>
		</form>
	);
}
