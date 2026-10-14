import { pageTitle } from "@/lib/i18n/page-title";
import { getCurrentUserId } from "@/lib/current-user";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { loadMawad } from "@/lib/mawad-store";
import { MawadScreen } from "@/components/academics/mawad-screen";

export const generateMetadata = pageTitle((dict) => dict.nav.items.academics.label);
export const dynamic = "force-dynamic";

/** موادي. Which rows, and nothing else — the screen itself is MawadScreen. */
export default async function AcademicsPage() {
  const userId = await getCurrentUserId();
  const locale = await getLocale();
  const { terms, nearest } = await loadMawad(userId, new Date());

  return (
    <MawadScreen
      terms={terms}
      nearest={nearest}
      dict={getDictionary(locale)}
      locale={locale}
    />
  );
}
