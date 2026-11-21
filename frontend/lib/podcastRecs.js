import * as spotify from '@/lib/spotify';
import { cleanDescription } from '@/lib/format';

/**
 * Podcast recommendations without a recommendations endpoint.
 *
 * Spotify has no "similar shows" API, and show objects carry no genres. So we
 * read the words in the descriptions of the shows you already follow, find the
 * terms that keep coming up, search for shows matching them, and rank results
 * by how many of your interests they match. Shows you already follow are
 * excluded.
 */

const STOPWORDS = new Set(
	`about above after again against all also always among another any anyone anything around back because been before
	being below best between both bring came can cannot come comes could daily debate deep each every everyone everything
	explore explores features from further get gets getting give given gives going good great guest guests have having
	hear here host hosted hosts how into its join just keep know latest learn life like listen listeners live long look
	made make makes many more most much must need never news next new only other others our ours over own part people
	podcast podcasts real really right said same says season series share shares should show shows since some something
	sometimes spotify still stories story such sure take takes talk talks tell than that their theirs them then there
	these they thing things think this those through time times today together topics under until very want week weekly
	well were what whatever when where whether which while who whom whose why will with within without world would year
	years your yours episode episodes every`.split(/\s+/)
);

/** Lower-cased content words (4+ letters, not stopwords). */
export function tokenize(text) {
	return (cleanDescription(text).toLowerCase().match(/[a-z][a-z'-]{3,}/g) ?? [])
		.map((w) => w.replace(/'s$/, '').replace(/^-+|-+$/g, ''))
		.filter((w) => w.length >= 4 && !STOPWORDS.has(w));
}

/**
 * Terms that describe a set of shows. A term counts once per show (so one
 * wordy description can't dominate) and terms shared by several shows rank
 * higher. Returns up to `max` terms, most representative first.
 */
export function interestTerms(shows, max = 6) {
	const counts = new Map();
	for (const show of shows) {
		const words = new Set([...tokenize(show.name), ...tokenize(show.description)]);
		for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
	}
	const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
	// Prefer shared terms; a library of very different shows falls back to the top single-show ones.
	const shared = ranked.filter(([, n]) => n > 1);
	return (shows.length >= 3 && shared.length >= 3 ? shared : ranked).slice(0, max).map(([w]) => w);
}

/** Top terms for one show: its own most frequent words, title words first. */
export function showTerms(show, max = 3) {
	const counts = new Map();
	for (const w of tokenize(show.name)) counts.set(w, (counts.get(w) ?? 0) + 3);
	for (const w of tokenize(show.description)) counts.set(w, (counts.get(w) ?? 0) + 1);
	return [...counts.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, max)
		.map(([w]) => w);
}

const searchShows = (q) =>
	spotify
		.search(q, ['show'], { limit: 10 })
		.then((r) => (r?.shows?.items ?? []).filter((s) => s?.id))
		.catch(() => []);

/** Merge result lists, ranking shows that appear for more queries first. */
function rank(lists, excludeIds) {
	const scores = new Map();
	lists.forEach((list) =>
		list.forEach((show, i) => {
			if (excludeIds.has(show.id)) return;
			const prev = scores.get(show.id);
			// Appearing for several queries beats ranking high in one.
			const score = (prev?.score ?? 0) + 1 + (10 - Math.min(i, 9)) / 20;
			scores.set(show.id, { show, score });
		})
	);
	return [...scores.values()].sort((a, b) => b.score - a.score).map((s) => s.show);
}

/**
 * Shows similar to the given seed shows.
 * @param {object[]} seeds shows to base the picks on
 * @param {{ exclude?: object[], limit?: number }} opts shows to leave out (e.g. the whole library)
 */
export async function similarShows(seeds, { exclude = [], limit = 14 } = {}) {
	const valid = seeds.filter((s) => s?.id);
	if (!valid.length) return [];
	const excludeIds = new Set([...exclude, ...valid].map((s) => s.id));
	const queries =
		valid.length === 1
			? (() => {
					const t = showTerms(valid[0], 3);
					// Pairs of terms keep results on-topic; single terms add breadth.
					return [t.slice(0, 2).join(' '), ...t].filter(Boolean);
				})()
			: interestTerms(valid, 6);
	const lists = await Promise.all(queries.map(searchShows));
	return rank(lists, excludeIds).slice(0, limit);
}

/**
 * Personalised podcast shelves for the search page.
 * @returns {Promise<{ forYou: object[], because: { seed: object, shows: object[] }[] }>}
 */
export async function podcastShelves(savedShows) {
	if (!savedShows?.length) return { forYou: [], because: [] };
	// Saved shows come back most-recently-saved first: recent saves reflect current taste.
	const seeds = savedShows.slice(0, 2);
	const [forYou, ...becauseLists] = await Promise.all([
		similarShows(savedShows.slice(0, 20), { exclude: savedShows }),
		...seeds.map((seed) => similarShows([seed], { exclude: savedShows, limit: 10 }))
	]);
	const shown = new Set(forYou.slice(0, 7).map((s) => s.id));
	const because = seeds
		.map((seed, i) => ({ seed, shows: becauseLists[i].filter((s) => !shown.has(s.id)) }))
		.filter((b) => b.shows.length >= 3);
	return { forYou, because };
}
