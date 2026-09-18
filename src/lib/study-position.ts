/**
 * Where a student is in a document, and what to do about it.
 *
 * The rules here decide what "continue" means, and every one of them is a
 * judgement that is easy to get subtly wrong and impossible to notice: a deck
 * that quietly forgets where you were, a "continue" that sends you backwards, a
 * finished deck that keeps asking you to finish it. So they are pure functions
 * with a test rather than conditions scattered through a component.
 */

/** What the database holds for one document. */
export type Position = {
  lastPage: number;
  furthestPage: number;
  lastViewedAt: Date;
  completedAt: Date | null;
};

export type Deck = {
  slideId: string;
  pageCount: number;
  position: Position | null;
};

/**
 * How a position moves when a page is opened.
 *
 * `furthestPage` only ever grows. That asymmetry is the whole point: flicking
 * back to check a definition on slide 4 must not tell the system you have
 * unlearned slides 5 to 30. `lastPage` follows the student exactly, because
 * that is where they are; `furthestPage` remembers how far they have been.
 */
export function advance(current: Position | null, page: number, pageCount: number, now: Date): Position {
  const clamped = clampPage(page, pageCount);
  const furthest = Math.max(clamped, current?.furthestPage ?? 1);
  return {
    lastPage: clamped,
    furthestPage: furthest,
    lastViewedAt: now,
    // Completion latches. A student who finishes a deck and later flicks back
    // to slide 2 has not un-finished it, and being told so would be absurd.
    completedAt: current?.completedAt ?? (furthest >= pageCount && pageCount > 0 ? now : null),
  };
}

export function clampPage(page: number, pageCount: number): number {
  if (!Number.isFinite(page)) return 1;
  const max = Math.max(1, Math.floor(pageCount) || 1);
  return Math.min(max, Math.max(1, Math.floor(page)));
}

/**
 * The page "continue" should open.
 *
 * Deliberately the page they stopped ON, not the one after it. A student who
 * left off mid-slide needs to see that slide again to pick the thread back up,
 * and a system that skips it makes them navigate backwards to find their place
 * — which is the opposite of the feature.
 *
 * Standing at the last page means start again. There is nowhere further to go,
 * and the only reason to open a document you are already at the end of is to go
 * through it once more.
 *
 * What this deliberately does NOT look at is `completedAt`. An earlier version
 * did, and it was wrong in a way only using it revealed: a student who finished
 * a deck, came back a week later and re-read as far as page 2 was sent back to
 * page 1 every single time, because "finished" had latched and was still
 * answering a question it should not have been asked. Completion is a fact
 * about the past — worth showing, never worth overriding where they are now.
 */
export function resumePage(deck: Deck): number {
  const p = deck.position;
  if (!p) return 1;
  const at = clampPage(p.lastPage, deck.pageCount);
  if (at >= Math.max(1, deck.pageCount)) return 1;
  return at;
}

/**
 * Whether there is anything to resume — i.e. whether to offer it at all.
 *
 * Two ways there is not: they never opened it, and they are somewhere a
 * "continue" would take them nowhere. Page one is where a deck opens anyway,
 * and the last page has nothing after it; offering either is offering nothing,
 * and a row on Studio's home that does nothing is clutter on the one screen
 * that exists to be uncluttered.
 *
 * Note what this means for a deck the student is re-reading: it IS offered
 * again, from wherever they have got to. That is the point — a second pass
 * through a lecture is still a pass through a lecture.
 */
export function isResumable(deck: Deck): boolean {
  const p = deck.position;
  if (!p) return false;
  const at = clampPage(p.lastPage, deck.pageCount);
  return at > 1 && at < Math.max(1, deck.pageCount);
}

/**
 * Whether to show this deck as finished.
 *
 * Finished AND still standing at the end. Completion alone is not enough, and
 * that distinction came out of using it: a deck gone all the way through, then
 * re-opened and read as far as page two, was still labelled "Finished" beside
 * the word "Recent" — which is stale rather than wrong, and stale is what makes
 * a student stop trusting a screen. If they have moved back into the document,
 * where they are now is the more useful fact and the one shown.
 */
export function showsAsFinished(deck: Deck): boolean {
  const p = deck.position;
  if (!p?.completedAt) return false;
  return clampPage(p.lastPage, deck.pageCount) >= Math.max(1, deck.pageCount);
}

/**
 * How far through, 0..1.
 *
 * From `furthestPage`, not `lastPage`: progress is how much of the document the
 * student has seen, and flicking back does not undo that.
 */
export function progressOf(deck: Deck): number {
  const p = deck.position;
  if (!p || deck.pageCount <= 0) return 0;
  return Math.min(1, Math.max(0, p.furthestPage / deck.pageCount));
}

/**
 * Where they are, 0..1 — as opposed to how much they have seen.
 *
 * Both numbers are true and they are not the same, which is a problem the
 * moment they appear together: a bar drawn from `progressOf` sat at 100% beside
 * the sentence "you stopped at page 2 of 3", because the student had been all
 * the way through once. Two true statements that look like a contradiction read
 * as a bug. So a bar that accompanies a sentence about where they are is drawn
 * from the same number the sentence states.
 */
export function positionOf(deck: Deck): number {
  const p = deck.position;
  if (!p || deck.pageCount <= 0) return 0;
  return Math.min(1, Math.max(0, clampPage(p.lastPage, deck.pageCount) / deck.pageCount));
}

/**
 * Which deck "Continue Learning" should offer.
 *
 * The most recently touched one that still has somewhere to go. Not the least
 * finished, and not the most urgent — those are questions Home answers. Studio
 * answers one question only: what was I reading?
 */
export function continueWith(decks: Deck[]): Deck | null {
  const resumable = decks.filter(isResumable);
  if (resumable.length === 0) return null;
  return resumable.reduce((best, d) =>
    (d.position!.lastViewedAt.getTime() > best.position!.lastViewedAt.getTime() ? d : best)
  );
}

/**
 * Recent learning, newest first.
 *
 * Everything touched, finished or not — "recent" is a history, and a deck you
 * completed yesterday is still the thing you were doing yesterday.
 */
export function recent(decks: Deck[], limit = 6): Deck[] {
  return decks
    .filter((d) => d.position !== null)
    .sort((a, b) => b.position!.lastViewedAt.getTime() - a.position!.lastViewedAt.getTime())
    .slice(0, limit);
}

/**
 * How often a position is worth writing.
 *
 * A page turn is cheap to make and not cheap to store: paging through a
 * forty-slide deck at reading speed would otherwise be forty round trips. The
 * position is written when the student settles, and the last one always wins
 * because the row is an upsert rather than an append.
 */
export const POSITION_SAVE_DELAY_MS = 1500;
