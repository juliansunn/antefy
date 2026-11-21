import { Check, Plus } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useSavedStatus, useToggleSaved } from '@/hooks/useLibrary';

/** Follow / save toggle for shows, albums and audiobooks (pill style, like Spotify's "Follow"). */
export default function SaveButton({ uri, name, labels = ['Save', 'Saved'], className }) {
	const isSaved = useSavedStatus(uri ? [uri] : []);
	const toggle = useToggleSaved();
	if (!uri) return null;
	const saved = isSaved(uri);
	return (
		<button
			type="button"
			aria-pressed={saved}
			onClick={() => toggle.mutate({ uri, name, saved })}
			className={cn(
				'inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-semibold transition hover:scale-105',
				saved ? 'border-accent text-accent' : 'border-line text-fg hover:border-fg',
				className
			)}
		>
			{saved ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
			{saved ? labels[1] : labels[0]}
		</button>
	);
}
