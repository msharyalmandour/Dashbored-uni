"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/shared/i18n-provider";
import { useIdlePreload } from "@/components/shared/use-idle-preload";

/**
 * Only the trigger lives in the shell bundle. The command palette itself is
 * a separate chunk that is never parsed or hydrated until the user actually
 * reaches for search, and is warmed during browser idle time so the first
 * open still feels instant.
 */
const GlobalSearchDialog = dynamic(() => import("@/components/shared/global-search-dialog"), {
  ssr: false,
});

export function GlobalSearch() {
  const { dict } = useI18n();
  const [open, setOpen] = React.useState(false);
  // Once mounted the dialog stays mounted, so reopening costs nothing.
  const [mounted, setMounted] = React.useState(false);

  useIdlePreload(GlobalSearchDialog);

  const openSearch = React.useCallback(() => {
    setMounted(true);
    setOpen(true);
  }, []);

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setMounted(true);
        setOpen((o) => !o);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <Button
        variant="outline"
        onClick={openSearch}
        className="hidden w-56 items-center justify-between gap-2 text-muted-foreground sm:flex"
      >
        <span className="flex items-center gap-2">
          <Search className="size-4" />
          {dict.shell.searchEverything}
        </span>
        <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px]">⌘K</kbd>
      </Button>
      <Button variant="ghost" size="icon" onClick={openSearch} className="sm:hidden">
        <Search className="size-4" />
      </Button>

      {mounted && <GlobalSearchDialog open={open} onOpenChange={setOpen} />}
    </>
  );
}
