"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { searchEverything, type SearchResults } from "@/app/actions/search";
import { useI18n } from "@/components/shared/i18n-provider";

/**
 * The cmdk-backed body of global search. Split out of `GlobalSearch` so the
 * command-palette dependency tree loads as its own chunk instead of riding
 * along in the shell bundle that every page must parse and hydrate.
 */
export default function GlobalSearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { dict, format } = useI18n();
  const GROUP_LABELS: Record<keyof SearchResults, string> = dict.search.groups;
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResults | null>(null);
  const [loading, setLoading] = React.useState(false);

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
    onOpenChange(false);
    router.push(href);
  }

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) {
      setQuery("");
      setResults(null);
    }
  }

  const searchActive = query.trim().length >= 2;
  const hasAnyResults = searchActive && results && Object.values(results).some((arr) => arr.length > 0);

  return (
    <CommandDialog open={open} onOpenChange={handleOpenChange}>
      <CommandInput value={query} onValueChange={setQuery} placeholder={dict.search.placeholder} />
      <CommandList>
        {!searchActive && <CommandEmpty>{dict.search.typeToSearch}</CommandEmpty>}
        {searchActive && loading && <CommandEmpty>{dict.search.searching}</CommandEmpty>}
        {searchActive && !loading && !hasAnyResults && (
          <CommandEmpty>{format(dict.search.noResults, { query })}</CommandEmpty>
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
  );
}
