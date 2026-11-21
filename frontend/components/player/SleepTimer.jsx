import { useEffect, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Moon } from 'lucide-react';
import IconButton from '@/components/ui/IconButton';
import { cn } from '@/lib/cn';
import { useUiStore } from '@/lib/store';
import { usePlaybackState } from '@/hooks/usePlayback';

const MINUTES = [5, 15, 30, 45, 60, 90];

/** Minutes left on a fixed timer, refreshed every few seconds while one is set. */
function useMinutesLeft(endsAt) {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		if (!endsAt) return undefined;
		const id = setInterval(() => setNow(Date.now()), 5000);
		return () => clearInterval(id);
	}, [endsAt]);
	return endsAt ? Math.max(1, Math.ceil((endsAt - now) / 60000)) : null;
}

export default function SleepTimer() {
	const timer = useUiStore((s) => s.sleepTimer);
	const setTimer = useUiStore((s) => s.setSleepTimer);
	const { data } = usePlaybackState();
	const item = data?.item;
	const [open, setOpen] = useState(false);
	const left = useMinutesLeft(timer?.endsAt);
	const isEpisode = item?.type === 'episode';
	const label = timer?.endsAt ? `Sleep timer: ${left} min left` : timer?.itemId ? 'Sleep timer: end of this item' : 'Sleep timer';

	const option = 'w-full rounded-lg px-3 py-2 text-left transition hover:bg-hover';
	const choose = (value) => {
		setTimer(value);
		setOpen(false);
	};

	return (
		<Popover.Root open={open} onOpenChange={setOpen}>
			<Popover.Trigger asChild>
				<IconButton label={label} active={Boolean(timer)} className="relative">
					<Moon className={cn('h-[18px] w-[18px]', timer && 'fill-current')} />
					{left && (
						<span className="absolute -right-0.5 -top-0.5 rounded-full bg-accent px-1 text-[9px] font-bold leading-4 text-accent-fg">
							{left}
						</span>
					)}
				</IconButton>
			</Popover.Trigger>
			<Popover.Portal>
				<Popover.Content
					side="top"
					align="end"
					sideOffset={12}
					collisionPadding={12}
					className="z-[60] w-56 animate-fade-in rounded-xl border border-line bg-elevated p-2 text-sm text-fg shadow-2xl outline-none"
				>
					<p className="px-3 pb-1 pt-1 font-bold">Sleep timer</p>
					{timer && <p className="px-3 pb-2 text-xs text-accent">{label.replace('Sleep timer: ', 'Pausing: ')}</p>}
					<ul>
						{MINUTES.map((m) => (
							<li key={m}>
								<button type="button" className={option} onClick={() => choose({ endsAt: Date.now() + m * 60000 })}>
									{m < 60 ? `${m} minutes` : m === 60 ? '1 hour' : `${m / 60} hours`}
								</button>
							</li>
						))}
						<li>
							<button type="button" disabled={!item?.id} className={cn(option, 'disabled:opacity-40')} onClick={() => choose({ itemId: item.id })}>
								End of {isEpisode ? 'episode' : 'track'}
							</button>
						</li>
						{timer && (
							<li className="mt-1 border-t border-line pt-1">
								<button type="button" className={cn(option, 'text-muted')} onClick={() => choose(null)}>
									Turn off timer
								</button>
							</li>
						)}
					</ul>
					<Popover.Arrow className="fill-elevated" />
				</Popover.Content>
			</Popover.Portal>
		</Popover.Root>
	);
}
