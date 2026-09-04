"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Sparkles, LayoutDashboard, Lightbulb, RotateCcw, CheckSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_SECTIONS } from "@/components/shared/nav-config";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { LanguageToggle } from "@/components/shared/language-toggle";
import { GlobalSearch } from "@/components/shared/global-search";
import { QuickCapture } from "@/components/shared/quick-capture";
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

function SidebarNav({
  pathname,
  dict,
  onNavigate,
}: {
  pathname: string;
  dict: Dictionary;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-2 scrollbar-thin">
      {NAV_SECTIONS.map((section) => (
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
                      ? "border-primary bg-primary/10 font-medium text-primary shadow-[0_0_16px_var(--glow-primary)]"
                      : "border-transparent text-sidebar-foreground hover:border-primary/30 hover:bg-muted"
                  )}
                >
                  <item.icon className={cn("size-4 shrink-0", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                  <span className="truncate">{label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
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
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md">
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
      <nav className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-center justify-around border-t border-border bg-background/95 backdrop-blur-md lg:hidden">
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

      <QuickCapture />
    </div>
  );
}
