"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Sparkles, Plus, LayoutDashboard, Lightbulb, RotateCcw, CheckSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_SECTIONS, type ModuleAccent } from "@/components/shared/nav-config";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { LanguageToggle } from "@/components/shared/language-toggle";
import { GlobalSearch } from "@/components/shared/global-search";
import { QuickCaptureButton, QuickCaptureDialog } from "@/components/shared/quick-capture";
import { QuickCaptureProvider, useQuickCapture } from "@/components/shared/quick-capture-context";
import { SignOutButton } from "@/components/shared/sign-out-button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/shared/i18n-provider";
import type { Dictionary } from "@/lib/i18n/dictionaries";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

function Logo({ dict }: { dict: Dictionary }) {
  return (
    <Link href="/" className="flex items-center gap-2 px-1">
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-[0_0_18px_var(--glow-primary-strong)]">
        <Sparkles className="size-4" />
      </span>
      <span className="font-display text-sm font-semibold leading-tight">
        {dict.shell.appName}
        <span className="block text-[10px] font-normal text-muted-foreground">{dict.shell.tagline}</span>
      </span>
    </Link>
  );
}

/**
 * Module-identity colors applied only as a thin active-state accent (left
 * border + faint background tint + icon color) — never as a full-block
 * background. Keeps the sidebar legible as "which area am I in" without
 * turning it into a rainbow of five loudly-colored sections. Home has no
 * entry here and falls through to the app's own primary color, since it's
 * the one destination that isn't a "module."
 */
const ACCENT_STYLES: Record<ModuleAccent, { active: string; icon: string; hoverBorder: string }> = {
  academics: {
    active: "border-module-academics bg-module-academics/15 text-module-academics",
    icon: "text-module-academics",
    hoverBorder: "hover:border-module-academics/30",
  },
  clinical: {
    active: "border-module-clinical bg-module-clinical/15 text-module-clinical",
    icon: "text-module-clinical",
    hoverBorder: "hover:border-module-clinical/30",
  },
  planning: {
    active: "border-module-planning bg-module-planning/15 text-module-planning",
    icon: "text-module-planning",
    hoverBorder: "hover:border-module-planning/30",
  },
  intelligence: {
    active: "border-module-intelligence bg-module-intelligence/15 text-module-intelligence",
    icon: "text-module-intelligence",
    hoverBorder: "hover:border-module-intelligence/30",
  },
};

function SidebarNav({
  pathname,
  dict,
  onNavigate,
}: {
  pathname: string;
  dict: Dictionary;
  onNavigate?: () => void;
}) {
  const { setOpen } = useQuickCapture();

  return (
    <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-2 scrollbar-thin">
      <div>
        <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          {dict.nav.sections.capture}
        </p>
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            onNavigate?.();
          }}
          className="group flex w-full items-center gap-2.5 rounded-md border-s-2 border-transparent px-2.5 py-2 text-sm text-sidebar-foreground transition-colors duration-200 hover:border-primary/30 hover:bg-muted"
        >
          <Plus className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
          <span className="truncate">{dict.shell.quickCapture}</span>
        </button>
      </div>
      {NAV_SECTIONS.map((section) => {
        const accentStyles = section.accent ? ACCENT_STYLES[section.accent] : null;
        return (
          <div key={section.key}>
            <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {dict.nav.sections[section.key]}
            </p>
            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const active = isActive(pathname, item.href);
                const label = dict.nav.items[item.key].label;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "group relative flex items-center gap-2.5 rounded-md border-s-2 px-2.5 py-2 text-sm transition-colors duration-200",
                      active
                        ? cn(
                            "font-semibold",
                            accentStyles ? accentStyles.active : "border-primary bg-primary/15 text-primary shadow-[0_0_16px_var(--glow-primary)]"
                          )
                        : cn(
                            "border-transparent text-sidebar-foreground hover:bg-muted",
                            accentStyles ? accentStyles.hoverBorder : "hover:border-primary/30"
                          )
                    )}
                  >
                    <item.icon
                      className={cn(
                        "size-4 shrink-0",
                        active ? (accentStyles ? accentStyles.icon : "text-primary") : "text-muted-foreground group-hover:text-foreground"
                      )}
                    />
                    <span className="truncate">{label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

const MOBILE_TABS = [
  { href: "/", key: "today" as const, icon: LayoutDashboard },
  { href: "/knowledge-gaps", key: "gaps" as const, icon: Lightbulb },
  { href: "/review", key: "review" as const, icon: RotateCcw },
  { href: "/tasks", key: "tasks" as const, icon: CheckSquare },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const { dict, dir } = useI18n();

  return (
    <QuickCaptureProvider>
    <div className="flex h-full">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-e border-sidebar-border bg-sidebar lg:flex">
        <div className="flex h-16 items-center border-b border-sidebar-border px-4">
          <Logo dict={dict} />
        </div>
        <SidebarNav pathname={pathname} dict={dict} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        {/* Opaque rather than translucent+blurred: a full-width backdrop-filter
            forces the browser to re-blur the region behind it on every scroll
            frame, which is the most expensive effect the shell had. */}
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background px-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileNavOpen(true)}
            aria-label={dict.shell.openNavigation}
          >
            <Menu className="size-5" />
          </Button>
          <div className="lg:hidden">
            <Logo dict={dict} />
          </div>
          <div className="ms-auto flex items-center gap-2">
            <GlobalSearch />
            <LanguageToggle />
            <ThemeToggle />
            <SignOutButton />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto pb-24 lg:pb-8">
          <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>

      {/* Mobile nav drawer — opens from the reading-direction start edge */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side={dir === "rtl" ? "right" : "left"} className="flex flex-col p-0">
          <SheetHeader className="border-b border-sidebar-border">
            <SheetTitle asChild>
              <Logo dict={dict} />
            </SheetTitle>
          </SheetHeader>
          <SidebarNav pathname={pathname} dict={dict} onNavigate={() => setMobileNavOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-center justify-around border-t border-border bg-background lg:hidden">
        {MOBILE_TABS.map((tab) => {
          const active = isActive(pathname, tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] transition-colors duration-200",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <tab.icon className={cn("size-5", active && "drop-shadow-[0_0_6px_var(--glow-primary-strong)]")} />
              {dict.nav.mobile[tab.key]}
            </Link>
          );
        })}
      </nav>

      <QuickCaptureButton />
      <QuickCaptureDialog />
    </div>
    </QuickCaptureProvider>
  );
}
