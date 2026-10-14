import { ContentText } from "@/components/ui/content-text";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import type { MawadNearest, MawadTerm } from "@/lib/mawad-store";
import { clockOf } from "@/lib/next-class";
import { pluralForm, pick } from "@/lib/i18n/plural";
import { NearestCard } from "@/components/academics/nearest-card";
import { SubjectShelf } from "@/components/academics/subject-shelf";
import { CreateSemesterDialog } from "@/components/academics/create-semester-dialog";
import { CreateSubjectDialog } from "@/components/academics/create-subject-dialog";
import { DeleteThing } from "@/components/shared/delete-thing";

/**
 * موادي, as the approved handoff draws it.
 *
 * WHAT CHANGED, AND WHAT DID NOT. The grid of pale cards with a 1px coloured
 * strip is gone; each course is a cover in its own world, the nearest deadline
 * is one card with one big number, and the ground is the world itself rather
 * than the generic scene. What did not change is what the screen can DO —
 * creating a term, creating a course and deleting a term are all still here.
 * A restyle that quietly removes a button is not a restyle.
 *
 * ONE SECTION PER TERM, not just the active one. The mockup shows a single
 * term because this account has a single term; rendering only the active one
 * would make every other term's courses unreachable from the screen whose job
 * is to list courses.
 *
 * SEPARATE FROM THE PAGE because the page cannot be opened in this
 * environment — there is no database connection here, so the only way to look
 * at the real thing is to hand this component rows and render it. A screen
 * that can only be checked in production is a screen nobody checks.
 */
export function MawadScreen({
  terms,
  nearest,
  dict,
  locale,
}: {
  terms: MawadTerm[];
  nearest: MawadNearest | null;
  dict: Dictionary;
  locale: Locale;
}) {
  const A = dict.academics;

  const termLine = (term: MawadTerm) => {
    const n = term.courses.length;
    const courses = pick(A.courseCount, pluralForm(locale, n)).replace("{count}", String(n));
    return (term.hijri ? A.termLine.replace("{hijri}", term.hijri) : A.termLineNoYear)
      .replace("{term}", term.name)
      .replace("{courses}", courses);
  };

  /* "9 محاضرات جاهزة", not "9 محاضرة جاهزة". Today one course has one ready
     lecture and the singular happens to be right; the moment he drops the
     rest, most covers land in the 3-10 bucket, where Arabic takes the broken
     plural. The rule is in src/lib/i18n/plural.ts. */
  const readyLabel = (count: number) =>
    pick(A.lecturesReady, pluralForm(locale, count)).replace("{count}", String(count));

  /* "الأحد · 9 الصبح". Built here rather than in the store because every
     piece of it is a dictionary lookup. The kind moved out of this line and
     up to level 1 of the cover, where the board puts it — "الأحد 9 ص ·
     جامعة" said the word "جامعة" to a student who is at a university. */
  const whenOf = (next: MawadTerm["courses"][number]["next"]) =>
    next ? `${dict.time.weekdays[next.weekday] ?? ""} · ${clockOf(next.startMinute, locale)}`.trim() : null;

  return (
    /* No world vars: `.world`'s own defaults ARE the موادي ground. Setting
       them from the first course would repaint the whole screen whenever a
       course is renamed, and موادي belongs to no single course. */
    <div className="world world-ground">
      <div className="page-col flex flex-col gap-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="t-kufi m-0 text-[30px] font-extrabold">{A.title}</h1>
            {/* The term line belongs under the title, as the handoff draws
                it — but only while there IS one term. With several, the same
                line has to sit on each section or it would describe one term
                and stand above all of them. */}
            {terms.length === 1 && (
              <ContentText as="p" className="m-0 text-[13px] text-[rgba(246,235,221,0.72)]">
                {termLine(terms[0])}
              </ContentText>
            )}
          </div>
          <CreateSemesterDialog />
        </div>

        {/* The one deadline nearest him, above everything. Absent rather than
            empty when he has none ahead: a card that says "no exams" is a
            card he reads every day for no reason. */}
        {nearest && (
          <NearestCard
            title={nearest.title}
            courseCode={nearest.courseCode}
            dateLabel={nearest.date.toLocaleDateString(locale === "ar" ? "ar" : "en-US", {
              day: "numeric",
              month: "short",
            })}
            daysLeft={nearest.daysLeft}
            weight={nearest.weight}
            accent="#F0A23A"
            progress={nearest.termProgress}
            labels={{
              nearest: A.nearest,
              ofGrade: A.ofGrade,
              daysLeft: A.daysLeft,
              today: A.today,
              tomorrow: A.tomorrow,
            }}
          />
        )}

        {terms.length === 0 && (
          <p className="pane p-10 text-center text-sm text-[rgba(246,235,221,0.72)]">
            {A.noSemesters}
          </p>
        )}

        {terms.map((term) => (
          <section key={term.id} className="flex flex-col gap-3">
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <h2 className="t-kufi m-0 text-[17px]">{A.pickOne}</h2>
                {terms.length > 1 && (
                  <ContentText as="p" className="m-0 text-[13px] text-[rgba(246,235,221,0.72)]">
                    {termLine(term)}
                  </ContentText>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <CreateSubjectDialog semesterId={term.id} />
                {/* A term carries every course under it and everything under
                    those, which is why it keeps the typed confirmation. */}
                <DeleteThing kind="semester" id={term.id} name={term.name} />
              </div>
            </div>

            {term.courses.length === 0 ? (
              <p className="pane p-8 text-center text-sm text-[rgba(246,235,221,0.72)]">
                {A.noSubjectsInSemester}
              </p>
            ) : (
              <SubjectShelf
                subjects={term.courses.map((course) => ({
                  id: course.id,
                  nameAr: course.nameAr,
                  nameEn: course.name,
                  code: course.code,
                  /* Null when the course has no timetable row at all: that is
                     "we do not know", and it must not read as "نظري". */
                  kind:
                    course.clinical === null
                      ? null
                      : course.clinical
                        ? A.kindClinical
                        : A.kindTheory,
                  world: course.world,
                  nextLabel: A.nextClass,
                  next: whenOf(course.next),
                  /* Only when there is something to be ready. "0 محاضرة
                     جاهزة" on five covers out of six is a wall of zeroes. */
                  status: course.lecturesReady > 0 ? readyLabel(course.lecturesReady) : null,
                  weight:
                    course.examWeight !== null
                      ? A.gradeShort.replace("{weight}", String(course.examWeight))
                      : null,
                }))}
              />
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
