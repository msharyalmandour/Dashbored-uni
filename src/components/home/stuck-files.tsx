import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { TtSection } from "@/components/shared/tt";
import { format, type Dictionary } from "@/lib/i18n/dictionaries";
import type { StuckFiles } from "@/lib/stuck-files";

/**
 * The one thing the inbox was for, now that the inbox is not a destination.
 *
 * Renders NOTHING at zero. That is the whole reason this is allowed to exist
 * on a page the student opens every morning: a band that is always there
 * teaches them to scroll past it, and this one has to be believed on the day
 * it says nine files never arrived.
 */
export function StuckFilesBand({ files, dict }: { files: StuckFiles; dict: Dictionary }) {
  if (files.count === 0) return null;
  const T = dict.home.stuck;

  return (
    <TtSection title={T.heading} count={files.count}>
      <div className="flex flex-wrap items-center justify-between gap-3 py-3.5">
        <p className="t-meta text-muted-foreground">{format(T.body, { count: files.count })}</p>
        <Link
          href="/inbox"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[color:var(--primary)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]"
        >
          {T.action}
          <ArrowUpRight className="size-4" />
        </Link>
      </div>
    </TtSection>
  );
}
