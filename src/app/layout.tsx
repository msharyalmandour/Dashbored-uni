import type { Metadata, Viewport } from "next";
import { Inter, Lexend, Noto_Sans_Arabic } from "next/font/google";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { AppShell } from "@/components/shared/app-shell";
import { I18nProvider } from "@/components/shared/i18n-provider";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { localeDirection } from "@/lib/i18n/config";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const lexend = Lexend({
  variable: "--font-lexend",
  subsets: ["latin"],
});

const notoSansArabic = Noto_Sans_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
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
      className={`${inter.variable} ${lexend.variable} ${notoSansArabic.variable} h-full antialiased`}
    >
      <body className="h-full bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <I18nProvider locale={locale} dict={dict}>
            <AppShell>{children}</AppShell>
            <Toaster position="bottom-right" richColors closeButton dir={dir} />
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
