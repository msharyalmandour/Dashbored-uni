import Link from "next/link";
import { BrandMark } from "@/components/ui/brand-mark";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";

/**
 * 404.
 *
 * THIS FILE DID NOT EXIST. Next.js has a built-in not-found page and it is a
 * white page with black Helvetica on it — so the one screen in this product
 * guaranteed to be reached by accident was the only one with no design at
 * all, and it was white, in a product that is black. The inventory found it
 * by walking the folder rather than by remembering.
 *
 * It says where he is and gives him two doors, which is all a wrong address
 * needs. No illustration, no joke: he got here by mistake and wants out.
 */
export default async function NotFound() {
  const dict = getDictionary(await getLocale());
  const t = dict.notFound;

  return (
    <main className="c-ground grid min-h-screen place-items-center px-4 py-16">
      <div className="flex max-w-[34ch] flex-col items-center gap-4 text-center">
        <BrandMark size={56} variant="dark" />
        <p className="t-figure m-0 text-[13px]" style={{ color: "var(--o-300)" }}>
          404
        </p>
        <h1 className="t-kufi m-0 text-[28px] font-extrabold text-[color:var(--cream)]">
          {t.title}
        </h1>
        <p className="m-0 text-[14px]" style={{ color: "var(--sec)" }}>
          {t.body}
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <Link href="/" className="c-btn c-press">
            {t.home}
          </Link>
          <Link href="/time" className="c-btn-ghost c-press">
            {t.week}
          </Link>
        </div>
      </div>
    </main>
  );
}
