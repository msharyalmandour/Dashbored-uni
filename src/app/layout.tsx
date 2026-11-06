import type { Metadata, Viewport } from "next";
import { Caveat, IBM_Plex_Sans, IBM_Plex_Sans_Arabic, Noto_Kufi_Arabic, Space_Grotesk } from "next/font/google";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { I18nProvider } from "@/components/shared/i18n-provider";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { localeDirection } from "@/lib/i18n/config";
import "./globals.css";

// One family across both scripts, at every weight the UI actually uses
// (regular body copy through semibold/bold headings) — the premium,
// legible-in-Arabic pairing the interface is built around, rather than
// three unrelated faces (a Latin body font, a separate Latin display font,
// and a system-default-feeling Arabic font) stitched together per script.
const plexSans = IBM_Plex_Sans({
  variable: "--font-sans-latin",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const plexSansArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-sans-arabic",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
});

/**
 * The display face, and the reversal it represents.
 *
 * This app ran on ONE Arabic family on purpose: a second one was removed in
 * October because a Latin display face with an Arabic substitute under it made
 * the two scripts look like two products, and a guard was written so it could
 * not come back by accident.
 *
 * The owner-approved handoff of 2026-10-13 asks for exactly two, and the
 * reasoning that removed the old one does not apply to this pair. Noto Kufi
 * Arabic is an ARABIC display face — it is not a Latin face borrowing Arabic
 * from a fallback, which was the actual failure. Headings get its weight and
 * its flat terminals; body copy stays IBM Plex Sans Arabic. The guard is
 * updated rather than deleted: it now asserts that the display face IS Kufi
 * and the body face is NOT, so a third family still cannot drift in.
 */
const kufi = Noto_Kufi_Arabic({
  variable: "--font-kufi",
  subsets: ["arabic", "latin"],
  /* 600–800 is what the designs use; nothing lighter is ever set in Kufi, so
     loading 400 would be a file downloaded on every visit and never drawn. */
  weight: ["600", "700", "800"],
  display: "swap",
});

/**
 * Numbers, course codes and English medical text.
 *
 * The handoff is specific and it is a real distinction rather than decoration:
 * a countdown set at 52px and a course code like "NURC 410" are Latin objects
 * inside an Arabic sentence, and Plex's proportional figures make a counting
 * number twitch. Space Grotesk's are even-width and its uppercase sits well
 * against Kufi's weight.
 */
const grotesk = Space_Grotesk({
  variable: "--font-grotesk",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

/**
 * The fourth family, and the one place it is allowed.
 *
 * A guard in scripts/verify-type-metrics.ts exists to stop a third face
 * drifting in, and it was written after a display family was added and then
 * removed. This does not reopen that: Caveat is not a UI face and never sets
 * a heading, a label or a button. It is the ink in a handwritten note and in
 * a comment on a slide — content the student wrote, where a hand is the point
 * rather than a decoration. It binds to --font-hand, never to --font-display,
 * so the guard's assertion that the display face IS Kufi still holds.
 */
const caveat = Caveat({
  variable: "--font-hand",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "University OS — Your Academic Second Brain",
    template: "%s · University OS",
  },
  description:
    "The academic operating system that helps you capture, organize, learn, practice, and master every subject.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#141419" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const dir = localeDirection[locale];

  return (
    <html
      lang={locale}
      dir={dir}
      suppressHydrationWarning
      className={`${plexSans.variable} ${plexSansArabic.variable} ${kufi.variable} ${grotesk.variable} ${caveat.variable} h-full antialiased`}
    >
      <body className="h-full bg-background text-foreground">
        {/* Dark only, and forced rather than defaulted.
            The environment behind every screen is a night forest; the light
            palette puts near-black text and a near-white "quiet" surface on
            top of it, which renders as an unreadable mess. `defaultTheme`
            alone was not enough — a student whose phone is set to light mode
            got exactly that. `forcedTheme` is the honest statement: this
            product has one look. */}
        <ThemeProvider attribute="class" forcedTheme="dark" disableTransitionOnChange>
          <I18nProvider locale={locale} dict={dict}>
            {children}
            {/* RESKIN: `richColors` OFF. It paints success green and info
                blue, and the brief bans both by name — achievement is orange
                or gold here. The toast now takes the product's own glass and
                its warm text, so a notice reads as part of the page it
                appeared over rather than as a browser chrome. */}
            <Toaster
              position="bottom-right"
              closeButton
              dir={dir}
              toastOptions={{
                style: {
                  background: "var(--glass-dark)",
                  border: "1px solid var(--glass-border)",
                  color: "var(--cream)",
                  backdropFilter: "blur(22px)",
                  WebkitBackdropFilter: "blur(22px)",
                  borderRadius: "18px",
                },
              }}
            />
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
