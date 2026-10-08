import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, IBM_Plex_Sans_Arabic, Readex_Pro } from "next/font/google";
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
 * The display face, and the one job it has.
 *
 * The body font was deliberately made to carry the "display" register by
 * weight alone, on the reasoning that a second typeface competes with the
 * first. That reasoning is right about a second BODY face and wrong about a
 * heading face, and the difference is where it is allowed to appear: this one
 * is bound to `--font-display`, which only `h1`/`h2`/`h3`, `.t-display` and
 * `.t-title` consume. Nothing set below 1.2rem ever sees it, so the two faces
 * never meet inside a paragraph.
 *
 * Readex Pro rather than a Latin display face with an Arabic substitute
 * underneath it: it was drawn for both scripts as one family, so an Arabic
 * heading and the English course code inside it share a weight axis, a stroke
 * contrast and a cap height. A Latin display face paired with a fallback is
 * exactly the "two products in one page" failure the body font was chosen to
 * avoid, and it shows up precisely in the headings, where this app mixes
 * scripts most (an Arabic lecture title carrying "NURC 411").
 */
const readex = Readex_Pro({
  variable: "--font-display-face",
  subsets: ["arabic", "latin"],
  // 600 and 700 are what headings use; 400/500 come along because `.t-label`
  // and the figure in a section head borrow the face at small sizes.
  weight: ["400", "500", "600", "700"],
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
      className={`${plexSans.variable} ${plexSansArabic.variable} ${readex.variable} h-full antialiased`}
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
            <Toaster position="bottom-right" richColors closeButton dir={dir} />
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
