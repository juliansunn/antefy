import { ListPlus } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/cn';
import { addToQueue, describeError } from '@/lib/spotify';

/** Small "add to queue" icon button for tracks and episodes. */
export default function QueueButton({ uri, name, className }) {
	const queryClient = useQueryClient();
	if (!uri) return null;
	return (
		<button
			type="button"
			aria-label={`Add ${name ?? 'item'} to queue`}
			title="Add to queue"
			onClick={(e) => {
				e.stopPropagation();
				addToQueue(uri)
					.then(() => {
						toast.success(`Added “${name}” to queue`);
						queryClient.invalidateQueries({ queryKey: ['queue'] });
					})
					.catch((err) => toast.error(describeError(err)));
			}}
			className={cn('inline-flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:text-fg', className)}
		>
			<ListPlus className="h-[18px] w-[18px]" />
		</button>
	);
}
