import { SubjectCover } from "@/components/academics/subject-cover";
import type { World } from "@/lib/world";

export interface ShelfSubject {
  id: string;
  name: string;
  code: string | null;
  kind: string | null;
  world: World;
  nextLabel: string | null;
  next: string | null;
  status: string | null;
  weight: string | null;
}

/**
 * The courses, as covers.
 *
 * ONE ROW THAT SCROLLS ON A PHONE, A GRID ON AN iPAD. The handoff asks for a
 * cover-flow carousel and a 3×2 grid, and this is both without JavaScript:
 * a flex row that scrolls horizontally with snap points, which at `md` becomes
 * a wrapping grid. No carousel library, no transform maths, and it works
 * before the page hydrates — which on hospital wifi is a real interval.
 *
 * The tilted side-cards from the mockup are deliberately not here. They are
 * `perspective` + `rotateY` on neighbours of the centre card, which needs to
 * know which card is centred — that is scroll state, and scroll state means
 * JavaScript running on every frame of a swipe. The handoff's own rule is
 * readability over luxury; this keeps the swipe at 60fps on his iPad and the
 * covers full-strength instead of dimmed to 55%.
 */
export function SubjectShelf({ subjects }: { subjects: ShelfSubject[] }) {
  return (
    <div className="shelf">
      {subjects.map((s) => (
        <SubjectCover
          key={s.id}
          href={`/subjects/${s.id}`}
          code={s.code}
          name={s.name}
          kind={s.kind}
          world={s.world}
          nextLabel={s.nextLabel}
          next={s.next}
          status={s.status}
          weight={s.weight}
        />
      ))}
    </div>
  );
}
