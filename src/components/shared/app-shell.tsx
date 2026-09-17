"use client";

import * as React from "react";
import Link, { useLinkStatus } from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, Sparkles, Plus, LayoutDashboard, Lightbulb, RotateCcw, CheckSquare, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_SECTIONS, type ModuleAccent, type NavItem } from "@/components/shared/nav-config";
import { LanguageToggle } from "@/components/shared/language-toggle";
import { GlobalSearch } from "@/components/shared/global-search";
import { QuickCaptureButton } from "@/components/shared/quick-capture-button";
import { QuickCaptureMount } from "@/components/shared/quick-capture-mount";
import { WhatShouldIDo } from "@/components/shared/what-should-i-do";
import { SaveMyDay } from "@/components/shared/save-my-day";
import { QuickCaptureProvider, useQuickCapture } from "@/components/shared/quick-capture-context";
import { SignOutButton } from "@/components/shared/sign-out-button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/shared/i18n-provider";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/**
 * The routes where the rail gets out of the way.
 *
 * A lecture and a slide deck are the two places in this product where the
 * content is the point and everything else is furniture — a student reading a
 * dense slide on a 13" laptop should not be giving 216 pixels of it to a list
 * of ten destinations they are not going to. On those routes the rail keeps
 * its icons, which is enough to leave, and gives the width back.
 */
function railCollapses(pathname: string) {
  return pathname.startsWith("/lectures/");
}

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

/**
 * `showWordmark` exists because the same logo appears in a 256px sidebar and in
 * a 390px phone header. In the header it wrapped "University OS" onto two lines
 * and the tagline onto a third, so the brand took more of the bar than every
 * control put together. On a phone the mark alone is enough — the student knows
 * which app they opened.
 */
function Logo({ dict, showWordmark = true }: { dict: Dictionary; showWordmark?: boolean }) {
  return (
    <Link href="/" className="flex min-w-0 items-center gap-2 px-1">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-[0_0_18px_var(--glow-primary-strong)]">
        <Sparkles className="size-4" />
      </span>
      {showWordmark && (
        <span className="min-w-0 font-display text-sm font-semibold leading-tight">
          {dict.shell.appName}
          <span className="block text-[10px] font-normal text-muted-foreground">{dict.shell.tagline}</span>
        </span>
      )}
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
  learn: {
    active: "border-module-learn bg-module-learn/15 text-module-learn",
    icon: "text-module-learn",
    hoverBorder: "hover:border-module-learn/30",
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

/**
 * Rendered inside the <Link>, so `useLinkStatus` can report that this
 * specific link is navigating. `usePathname` only updates once the
 * navigation commits, which meant the item the user clicked sat there
 * looking untouched for the whole wait. This paints the pending item as
 * selected on the very next frame after the click.
 */
function NavItemBody({
  item,
  label,
  active,
  accentStyles,
  collapsed,
}: {
  item: NavItem;
  label: string;
  active: boolean;
  accentStyles: { active: string; icon: string; hoverBorder: string } | null;
  collapsed: boolean;
}) {
  const { pending } = useLinkStatus();
  const selected = active || pending;

  return (
    <span
      title={collapsed ? label : undefined}
      className={cn(
        "group relative flex items-center rounded-full py-2 text-sm",
        "transition-all duration-250",
        collapsed ? "justify-center px-0" : "gap-2.5 px-3",
        selected
          ? cn(
              // Where you are is said with material, not with paint.
              //
              // This used to be a filled pill in the module's own colour, at
              // 15% over a glossy dome — two loud signals for one quiet fact.
              // With ten items and five module colours the rail became the
              // brightest thing on a screen whose actual subject was a lecture,
              // and "you are here" competed with "this is the thing to press",
              // which is the one state that had earned that treatment.
              //
              // Now the selected item is simply made of a different material:
              // a faintly lifted surface with light caught along its top edge,
              // the same near-face trick every panel in the product uses. The
              // module's colour survives on the icon alone, which is where it
              // was doing real work — telling you which part of the app you are
              // standing in — and nowhere else.
              "bg-[oklch(100%_0_0_/_8%)] font-semibold text-foreground",
              "shadow-[inset_0_1px_0_oklch(100%_0_0_/_16%),inset_0_-1px_0_oklch(0%_0_0_/_28%)]"
            )
          : cn(
              "text-sidebar-foreground/80",
              // Quiet glass on hover rather than a flat grey fill, so the
              // hover state is made of the same material as everything else.
              "hover:bg-[oklch(100%_0_0_/_7%)] hover:text-foreground hover:shadow-[inset_0_1px_0_oklch(100%_0_0_/_14%)]"
            )
      )}
    >
      <item.icon
        className={cn(
          "size-4 shrink-0 transition-colors",
          // On the lit dome the icon has to be dark to be seen; everywhere
          // else it is the quiet grey it was.
          selected
            ? accentStyles?.icon ?? "text-primary"
            : "text-muted-foreground group-hover:text-foreground"
        )}
      />
      {!collapsed && <span className="truncate">{label}</span>}
      {pending && !active && (
        <span
          aria-hidden
          className={cn(
            "size-1.5 shrink-0 animate-pulse rounded-full bg-current opacity-70",
            collapsed ? "absolute end-1 top-1" : "ms-auto"
          )}
        />
      )}
    </span>
  );
}

function SidebarNav({
  pathname,
  dict,
  onNavigate,
  collapsed = false,
}: {
  pathname: string;
  dict: Dictionary;
  onNavigate?: () => void;
  /** Icons only. Set on the routes where the content needs the width. */
  collapsed?: boolean;
}) {
  const { setOpen } = useQuickCapture();

  return (
    <nav
      className={cn(
        "flex flex-1 flex-col overflow-y-auto py-2 scrollbar-thin",
        collapsed ? "gap-3 px-2" : "gap-5 px-3"
      )}
    >
      <div>
        {!collapsed && (
          <p className="t-label mb-1.5 px-2 text-muted-foreground/70">
            {dict.nav.sections.capture}
          </p>
        )}
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            onNavigate?.();
          }}
          title={collapsed ? dict.shell.quickCapture : undefined}
          className={cn(
            "group flex w-full items-center rounded-full py-2 text-sm text-sidebar-foreground/80 transition-all duration-250 hover:bg-[oklch(100%_0_0_/_7%)] hover:text-foreground hover:shadow-[inset_0_1px_0_oklch(100%_0_0_/_14%)]",
            collapsed ? "justify-center px-0" : "gap-2.5 px-3"
          )}
        >
          <Plus className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
          {!collapsed && <span className="truncate">{dict.shell.quickCapture}</span>}
        </button>
      </div>
      {NAV_SECTIONS.map((section) => {
        const accentStyles = section.accent ? ACCENT_STYLES[section.accent] : null;
        const primary = section.items.filter((i) => !i.secondary);
        const tools = section.items.filter((i) => i.secondary);
        // A tool the student is currently using must not be hidden behind a
        // disclosure, or the sidebar would stop reflecting where they are.
        const toolActive = tools.some((i) => isActive(pathname, i.href));

        function renderItem(item: NavItem) {
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              // Every app route is force-dynamic, so a prefetch returns
              // only the loading shell — measured at under 10ms of
              // benefit to click-to-content — while still costing a
              // remote auth round trip in middleware. Fourteen of those
              // fired on every page load for nothing.
              prefetch={false}
            >
              <NavItemBody
                item={item}
                label={dict.nav.items[item.key].label}
                active={isActive(pathname, item.href)}
                accentStyles={accentStyles}
                collapsed={collapsed}
              />
            </Link>
          );
        }

        return (
          <div key={section.key}>
            {collapsed ? (
              // The group still has to be a group. With the names gone, a
              // hairline is what is left to say "these belong together" — and
              // it costs one pixel where the label cost a line.
              <div aria-hidden className="mx-2 mb-2 h-px bg-[oklch(100%_0_0_/_8%)]" />
            ) : (
              <p className="t-label mb-1.5 px-2 text-muted-foreground/70">
                {dict.nav.sections[section.key]}
              </p>
            )}
            <div className="flex flex-col gap-0.5">
              {primary.map(renderItem)}

              {/* Collapsed, the disclosure has nothing to disclose — a caret
                  with no label beside it is a mystery, not an affordance — so
                  the secondary tools are simply shown. There are two or three
                  of them and they are icons; the column has the room. */}
              {collapsed && tools.map(renderItem)}

              {!collapsed && tools.length > 0 && (
                <details className="group/tools" open={toolActive}>
                  <summary className="flex cursor-pointer list-none items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                    <ChevronRight className="size-4 shrink-0 transition-transform group-open/tools:rotate-90 rtl:rotate-180 rtl:group-open/tools:-rotate-90" />
                    <span className="truncate">{dict.nav.moreTools}</span>
                  </summary>
                  <div className="mt-0.5 flex flex-col gap-0.5">{tools.map(renderItem)}</div>
                </details>
              )}
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

/**
 * Identity in the sidebar footer rather than buried in a menu: on a tool a
 * student lives in daily, knowing which account is open should not require a
 * click. Both values come from the session the layout already verified.
 */
/**
 * A small piece of visual relief at the foot of a long navigation column,
 * carrying the same photographic language as the dashboard hero so the
 * sidebar does not read as a plain list of links. Purely decorative — it
 * states no data and claims no progress it cannot back up.
 */
function SidebarEncouragement({ dict }: { dict: Dictionary }) {
  return (
    <div className="relative mx-3 mb-3 hidden overflow-hidden rounded-xl border border-sidebar-border lg:block">
      <Image
        src="/ambient/night.jpg"
        alt=""
        width={240}
        height={135}
        sizes="240px"
        className="pointer-events-none h-24 w-full object-cover opacity-70"
      />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-sidebar via-sidebar/70 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-3">
        <p className="text-sm font-semibold leading-tight">{dict.shell.keepGoing}</p>
        <p className="text-[11px] leading-tight text-muted-foreground">{dict.shell.keepGoingSub}</p>
      </div>
    </div>
  );
}

function SidebarIdentity({
  userName,
  userEmail,
  collapsed = false,
}: {
  userName: string;
  userEmail: string;
  collapsed?: boolean;
}) {
  const initial = (userName || userEmail || "?").charAt(0).toUpperCase();
  if (!userName && !userEmail) return null;

  if (collapsed) {
    return (
      <div className="flex justify-center border-t border-sidebar-border py-3">
        <span
          title={userName || userEmail}
          className="flex size-8 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary"
        >
          {initial}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5 border-t border-sidebar-border px-3 py-3">
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary"
      >
        {initial}
      </span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-sm font-medium">{userName || userEmail}</span>
        {userName && userEmail && (
          <span className="truncate text-[11px] text-muted-foreground">{userEmail}</span>
        )}
      </span>
    </div>
  );
}

/**
 * Renders only after mount. Formatting "today" on the server and again in the
 * browser is a reliable hydration mismatch — the two can be in different
 * timezones, or land either side of a midnight boundary — so this stays empty
 * for the first paint and fills in on the client, where the user's own locale
 * and clock are the correct source.
 */
function TodayStamp({ locale }: { locale: string }) {
  // Formatting "today" on the server and again in the browser is a reliable
  // hydration mismatch — the two can sit in different timezones, or land
  // either side of a midnight boundary. `useSyncExternalStore` is the
  // idiomatic way to hold a deliberately different server and client value:
  // it reports false while rendering on the server and true in the browser,
  // with no effect and no setState, so the date simply appears after
  // hydration instead of contradicting the server's markup.
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const today = React.useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date()),
    [locale]
  );

  return (
    <span className="hidden text-xs text-muted-foreground xl:block">
      {mounted ? today : "\u00A0"}
    </span>
  );
}

export function AppShell({
  children,
  userName = "",
  userEmail = "",
}: {
  children: React.ReactNode;
  userName?: string;
  userEmail?: string;
}) {
  const pathname = usePathname();
  const collapsed = railCollapses(pathname);
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const { dict, dir, locale } = useI18n();

  return (
    <QuickCaptureProvider>
    <div className="flex h-full">
      {/* Desktop sidebar */}
      {/* Glass rather than a solid panel. The forest shows through it, which is
          what stops the rail reading as a separate application bolted to the
          side of the page — and the bright inner edge gives it a near face, so
          it has a thickness instead of being a coloured rectangle. */}
      {/* 216px, not 256. The old width was set before the rail had a
          disclosure for secondary tools, and the longest label in either
          language clears 216 comfortably — so the extra 40 pixels were being
          spent on nothing at all, on every screen, forever. On a 1280px laptop
          that is 3% of the page back.

          The width animates because it changes underneath you when you open a
          lecture, and a rail that snaps looks like a layout bug. */}
      <aside
        className={cn(
          "glass hidden shrink-0 flex-col rounded-none border-y-0 border-s-0 transition-[width] duration-300 lg:flex",
          collapsed ? "w-[68px]" : "w-[216px]"
        )}
      >
        <div
          className={cn(
            "flex h-16 items-center border-b border-sidebar-border",
            collapsed ? "justify-center px-0" : "px-4"
          )}
        >
          <Logo dict={dict} showWordmark={!collapsed} />
        </div>
        <SidebarNav pathname={pathname} dict={dict} collapsed={collapsed} />
        {!collapsed && <SidebarEncouragement dict={dict} />}
        <SidebarIdentity userName={userName} userEmail={userEmail} collapsed={collapsed} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        {/* Opaque rather than translucent+blurred: a full-width backdrop-filter
            forces the browser to re-blur the region behind it on every scroll
            frame, which is the most expensive effect the shell had.

            Opaque, but in the panel's colour rather than `bg-background`, and
            a shade darker than the panels so the bar sits behind them rather
            than level with them. It was a navy slab for a while, which as the
            full width of the first thing on the screen was the single most
            visible piece of the old blue theme.
            The lit lower edge is the same one-pixel trick the panels use, so
            the bar has a near face too. */}
        <header
          className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-[oklch(100%_0_0_/_7%)] px-4"
          style={{
            background:
              "linear-gradient(180deg, oklch(13% 0.006 55) 0%, oklch(10% 0.005 52) 100%)",
            boxShadow: "inset 0 1px 0 oklch(99% 0.02 62 / 10%), 0 10px 28px -20px oklch(0% 0 0 / 80%)",
          }}
        >
          <Button
            variant="ghost"
            size="icon"
            /* Measured at 16x36 on a 390px screen — the only way to reach
               navigation on a phone, and narrower than a fingertip. 44px is the
               floor Apple and Google both publish. */
            className="size-11 shrink-0 lg:hidden"
            onClick={() => setMobileNavOpen(true)}
            aria-label={dict.shell.openNavigation}
          >
            <Menu className="size-5" />
          </Button>
          <div className="lg:hidden">
            <Logo dict={dict} showWordmark={false} />
          </div>

          {/* Search takes the centre of the bar rather than sitting in the
              corner: it is the fastest route to anything in the app, so it
              reads as the primary affordance instead of one icon among four. */}
          {/* `w-full` here was the real cause of every page scrolling sideways
              on a phone. In a flex row it asks for 100% of the container before
              anything else is measured, so the search box took the whole bar and
              pushed the controls past the edge — sign-out ended up entirely
              off-screen. `min-w-0 flex-1` lets it take what is left instead of
              everything, which is what `max-w-md` always assumed. */}
          <div className="mx-auto flex min-w-0 flex-1 justify-center px-2">
            <GlobalSearch />
          </div>

          {/* `shrink-0` on a row of six controls is what made every page in the
              app scroll sideways on a phone: the row refused to shrink, ran 18px
              past the edge, and took the sign-out button half off-screen with
              it. `min-w-0` lets the row yield, and the two secondary controls
              step aside below `sm` rather than fighting for width — the date
              stamp is decoration next to a 390px screen, and the language
              toggle belongs in the menu a student opens once. */}
          <div className="ms-auto flex shrink-0 items-center gap-1 sm:gap-2">
            {/* Sits in the header on every screen on purpose: being stuck is
                not something you should have to navigate to solve. */}
            <WhatShouldIDo />
            {/* The other half of the same need: not "what do I do" but
                "today went wrong, what now". Both live here because being
                stuck should never require navigating anywhere. */}
            <SaveMyDay />
            <span className="hidden sm:contents">
              <TodayStamp locale={locale} />
              <LanguageToggle />
            </span>
            <SignOutButton />
          </div>
        </header>

        {/* `pb-24` clears the bottom bar but not the floating capture button that
            sits above it, so on /today the last card's "ابدأ" — the single most
            important action on the page — sat underneath the orb. Measured: the
            bar is 64px and the orb clears 96px, so the floor is that plus the
            phone's own home-indicator inset. */}
        <main className="flex-1 overflow-y-auto pb-[calc(7.5rem+env(safe-area-inset-bottom))] lg:pb-8">
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

      {/* Mobile bottom tab bar.

          It was an opaque slab of `bg-background` pinned across the bottom,
          which on a product whose whole ground is a photograph is a strip of
          flat black cut out of the picture. It floats now, in the same glass
          the rail and the pen toolbar are made of, and it clears the phone's
          home indicator rather than sitting under it — `pb-[env(safe-area-inset-bottom)]`
          is the difference between a tab you can press and a tab your thumb
          cannot reach past the gesture bar. */}
      <nav className="fixed inset-x-3 bottom-3 z-30 lg:hidden">
        <div className="glass-quiet flex items-center justify-around rounded-2xl px-1 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
        {MOBILE_TABS.map((tab) => {
          const active = isActive(pathname, tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] transition-all duration-200",
                active
                  ? "bg-[oklch(100%_0_0_/_10%)] text-primary shadow-[inset_0_1px_0_oklch(100%_0_0_/_16%)]"
                  : "text-muted-foreground"
              )}
            >
              <tab.icon className="size-5" />
              {dict.nav.mobile[tab.key]}
            </Link>
          );
        })}
        </div>
      </nav>

      <QuickCaptureButton />
      <QuickCaptureMount />
    </div>
    </QuickCaptureProvider>
  );
}
