import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, IBM_Plex_Sans_Arabic } from "next/font/google";
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
      className={`${plexSans.variable} ${plexSansArabic.variable} h-full antialiased`}
    >
      <body className="h-full bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <I18nProvider locale={locale} dict={dict}>
            {children}
            <Toaster position="bottom-right" richColors closeButton dir={dir} />
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
