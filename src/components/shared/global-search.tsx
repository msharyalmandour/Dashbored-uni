"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { searchEverything, type SearchResults } from "@/app/actions/search";

const GROUP_LABELS: Record<keyof SearchResults, string> = {
  subjects: "Subjects",
  lectures: "Lectures",
  topics: "Topics",
  knowledgeGaps: "Knowledge Gaps",
  flashcards: "Flashcards",
  problems: "Problems",
  videos: "Videos",
  tasks: "Tasks",
};

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResults | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  React.useEffect(() => {
    if (query.trim().length < 2) return;
    // Debounced search-as-you-type: this effect synchronizes `results` with
    // the external search API in response to `query` changing.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const handle = setTimeout(() => {
      searchEverything(query).then((r) => {
        setResults(r);
        setLoading(false);
      });
    }, 200);
    return () => clearTimeout(handle);
  }, [query]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setQuery("");
      setResults(null);
    }
  }

  const searchActive = query.trim().length >= 2;
  const hasAnyResults = searchActive && results && Object.values(results).some((arr) => arr.length > 0);

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="hidden w-56 items-center justify-between gap-2 text-muted-foreground sm:flex"
      >
        <span className="flex items-center gap-2">
          <Search className="size-4" />
          Search everything
        </span>
        <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px]">⌘K</kbd>
      </Button>
      <Button variant="ghost" size="icon" onClick={() => setOpen(true)} className="sm:hidden">
        <Search className="size-4" />
      </Button>

      <CommandDialog open={open} onOpenChange={onOpenChange}>
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="Search subjects, lectures, gaps, flashcards, tasks…"
        />
        <CommandList>
          {!searchActive && (
            <CommandEmpty>Type at least 2 characters to search everything.</CommandEmpty>
          )}
          {searchActive && loading && (
            <CommandEmpty>Searching…</CommandEmpty>
          )}
          {searchActive && !loading && !hasAnyResults && (
            <CommandEmpty>No results for &ldquo;{query}&rdquo;.</CommandEmpty>
          )}
          {searchActive &&
            results &&
            (Object.keys(results) as (keyof SearchResults)[]).map((key) =>
              results[key].length > 0 ? (
                <CommandGroup key={key} heading={GROUP_LABELS[key]}>
                  {results[key].map((r) => (
                    <CommandItem key={r.id} value={`${key}-${r.id}`} onSelect={() => go(r.href)}>
                      <div className="flex flex-col overflow-hidden">
                        <span className="truncate">{r.title}</span>
                        <span className="truncate text-xs text-muted-foreground">{r.subtitle}</span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null
            )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
