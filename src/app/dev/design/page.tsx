"use client";

import * as React from "react";
import { BrandMark } from "@/components/ui/brand-mark";
import { CinematicCard, GlassCard } from "@/components/ui/cinematic-card";
import { DropZone } from "@/components/ui/drop-zone";
import { ProgressRing, TutorOrb } from "@/components/ui/progress-ring";
import { Chip, IconButton, Segmented, SubjectBlock } from "@/components/ui/controls";
import { BRAND_LINE, BRAND_SUB, TUTOR_NAME } from "@/lib/brand";

/**
 * Every component, in every state, on one page.
 *
 * It exists because the reference asks for it, and because the alternative is
 * reviewing a component inside the screen that uses it — where a thing that
 * is wrong in all six states looks like one broken screen instead of one
 * broken component.
 *
 * The two measured collisions in the subject palette are shown ADJACENT and
 * labelled with their numbers, rather than spread across a page where they
 * would never be seen side by side. That is the only honest way to ask
 * whether two colours read apart.
 */

function Row({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="t-kufi m-0 text-[17px] font-bold text-[color:var(--cream)]">{title}</h2>
        {note && <p className="m-0 text-[12px]" style={{ color: "var(--sec)" }}>{note}</p>}
      </div>
      <div className="flex flex-wrap items-start gap-3">{children}</div>
    </section>
  );
}

export default function DesignSystemPage() {
  const [seg, setSeg] = React.useState<"a" | "b" | "c">("a");
  const [drop, setDrop] = React.useState<"idle" | "over" | "reading">("idle");

  return (
    <div className="c-ground min-h-screen" dir="rtl" lang="ar">
      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-10 px-4 py-10 sm:px-6">
        <header className="flex items-center gap-3">
          <BrandMark size={52} variant="fill" />
          <div>
            <h1 className="t-kufi m-0 text-[30px] font-extrabold text-[color:var(--cream)]">
              {BRAND_LINE}
            </h1>
            <p className="m-0 text-[14px]" style={{ color: "var(--sec)" }}>
              {BRAND_SUB} · نظام المكونات · المرحلة ١
            </p>
          </div>
        </header>

        <Row title="العلامة" note="ثلاث حالات. كل تدرّج له id خاص فيه عشان ما تتصادم مع بعض في نفس الصفحة.">
          <BrandMark size={64} variant="dark" />
          <BrandMark size={64} variant="fill" />
          <BrandMark size={64} variant="mono" />
        </Row>

        <Row title="الأزرار" note="زر برتقالي واحد بس بكل شاشة. الباقي شبح. كلها ≥44px وترد على الضغط.">
          <button type="button" className="c-btn c-press">كمّل مذاكرتك</button>
          <button type="button" className="c-btn-ghost c-press">شوف أسبوعي</button>
          <IconButton label="رجوع">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 6l6 6-6 6" /></svg>
          </IconButton>
          <IconButton label="إغلاق">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
          </IconButton>
        </Row>

        <Row title="الشرائح" note="الأيقونة دايم معها كلمة.">
          <Chip>الشيت ٩</Chip>
          <Chip tone="warm">بعد ٤ أيام</Chip>
          <Chip tone="danger">متأخر</Chip>
        </Row>

        <Row title="المبدّل">
          <Segmented
            ariaLabel="مثال"
            value={seg}
            onChange={setSeg}
            options={[
              { value: "a", label: "اليوم" },
              { value: "b", label: "أسبوعي" },
              { value: "c", label: "الشهر" },
            ]}
            className="w-[320px]"
          />
        </Row>

        <Row title="الدوائر والكرة" note="كل دائرة معها كلمة تقول وش الرقم. ما فيه رقم عاري.">
          <ProgressRing value={72} label="من المحاضرة" />
          <ProgressRing value={38} size={80} label="من الشيت" sublabel="جاوبت ٣ من ٨" />
          <ProgressRing value={100} size={64} label="خلصت" />
          <div className="flex items-center gap-3">
            <TutorOrb size={56} floaty />
            <span className="text-[13px]" style={{ color: "var(--sec)" }}>{TUTOR_NAME}</span>
          </div>
        </Row>

        <Row title="الزجاج">
          <GlassCard className="w-[260px] p-4">
            <p className="m-0 text-[14px] text-[color:var(--cream)]">زجاج عادي</p>
            <p className="m-0 text-[12px]" style={{ color: "var(--sec)" }}>فوق الخلفية</p>
          </GlassCard>
          <GlassCard dark className="w-[260px] p-4">
            <p className="m-0 text-[14px] text-[color:var(--cream)]">زجاج داكن</p>
            <p className="m-0 text-[12px]" style={{ color: "var(--sec)" }}>فوق الصور</p>
          </GlassCard>
        </Row>

        <Row
          title="الكرت السينمائي"
          note="ست طبقات بنفس الترتيب. الصور ما وصلت بعد — فالكرت يرسم التدرّج والطبقات ٣–٥ ويحتفظ بنصه."
        >
          {(["start", "end", "bottom"] as const).map((side) => (
            <CinematicCard
              key={side}
              darkSide={side}
              ribbed={side === "start"}
              className="h-[180px] w-[300px] rounded-[24px]"
            >
              <div className="flex h-[180px] flex-col justify-end p-4">
                <span className="t-kufi text-[20px] font-extrabold">العناية المركزة</span>
                <span className="text-[12px]" style={{ color: "var(--sec-2)" }}>
                  الغامق جهة {side === "bottom" ? "تحت" : side === "end" ? "اليسار" : "اليمين"}
                </span>
              </div>
            </CinematicCard>
          ))}
        </Row>

        <Row title="ارمِ كل شي هنا" note="ثلاث حالات. اضغط الأزرار تحت عشان تشوفها.">
          <div className="flex w-full flex-col gap-3">
            <Segmented
              ariaLabel="حالة الرمي"
              value={drop}
              onChange={setDrop}
              options={[
                { value: "idle", label: "تنتظر" },
                { value: "over", label: "الملف فوقها" },
                { value: "reading", label: "تقرأ" },
              ]}
              className="w-[360px]"
            />
            <DropZone state={drop} reading={3} progress={46} className="max-w-[520px]" />
          </div>
        </Row>

        <Row
          title="بلوك المادة"
          note="حافة ٣px بلون المادة، وتحتها شارات اللي مربوط بالموعد."
        >
          <div className="w-[260px]">
            <SubjectBlock
              code="NURC410"
              title="Critical Care Nursing"
              time="٨:٠٠ – ١٠:٥٠"
              place="قاعة ٣"
              badges={["الشيت ٩", "حقيبة المستشفى"]}
            />
          </div>
          <div className="w-[260px]">
            <SubjectBlock code="NURP431" title="Nursing Leadership" time="٨:٠٠ – ١٠:٥٠" now badges={["الحين"]} />
          </div>
          <div className="w-[260px]">
            <SubjectBlock code="NURM410" title="Research Methods" time="١:٠٠ – ٣:٥٠" suggestion place="ساعة مذاكرة" />
          </div>
        </Row>

        <Row
          title="ألوان المواد — القياس"
          note="الزوجان اللي تحت مقيسان ومتقاربان: 0.0653 و 0.0672 في Oklab. الزوج اللي سبق وطلع يُقرأ كلون واحد على الآيباد كان 0.0459. شوفهم جنب بعض وقرّر."
        >
          <div className="flex flex-col gap-2">
            <span className="text-[12px]" style={{ color: "var(--danger)" }}>0.0653 — متقاربان</span>
            <div className="flex gap-2">
              <Swatch name="NURC 411" v="--subject-nurc411" />
              <Swatch name="NURM 410" v="--subject-nurm410" />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-[12px]" style={{ color: "var(--danger)" }}>0.0672 — متقاربان</span>
            <div className="flex gap-2">
              <Swatch name="NURP 432" v="--subject-nurp432" />
              <Swatch name="نشاط" v="--subject-activity" />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-[12px]" style={{ color: "var(--sec)" }}>الباقي</span>
            <div className="flex gap-2">
              <Swatch name="NURC 410" v="--subject-nurc410" />
              <Swatch name="NURP 431" v="--subject-nurp431" />
              <Swatch name="اختياري" v="--subject-elective" />
            </div>
          </div>
        </Row>

        <Row title="الحركة" note="كلها تنطفي مع prefers-reduced-motion.">
          <div className="c-stagger flex flex-wrap gap-3">
            {["pop", "floaty", "pulse", "sheen", "tilt"].map((n) => (
              <GlassCard
                key={n}
                className={`c-pop grid h-[88px] w-[140px] place-items-center ${
                  n === "floaty" ? "c-floaty" : n === "pulse" ? "c-pulse" : n === "sheen" ? "c-sheen" : n === "tilt" ? "c-tilt" : ""
                }`}
              >
                <span className="t-figure text-[13px]" style={{ color: "var(--sec-2)" }}>{n}</span>
              </GlassCard>
            ))}
          </div>
        </Row>

        <Row title="النص" note="٣ أحجام بس، والأرقام استثناء.">
          <div className="flex flex-col gap-1">
            <span className="t-kufi text-[30px] font-extrabold text-[color:var(--cream)]">عنوان الصفحة</span>
            <span className="t-kufi text-[18px] font-bold text-[color:var(--cream)]">عنوان الكرت</span>
            <span className="text-[15px] text-[color:var(--cream)]">الكلام العادي اللي تقراه</span>
            <span className="text-[12px]" style={{ color: "var(--sec)" }}>التلميح الصغير</span>
            <span className="t-figure text-[52px] font-bold text-[color:var(--cream)]">٦٠</span>
            <span style={{ fontFamily: "var(--font-hand)", fontSize: 26, color: "var(--o-300)" }}>
              خط اليد في الملاحظات
            </span>
          </div>
        </Row>
      </div>
    </div>
  );
}

function Swatch({ name, v }: { name: string; v: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className="block h-16 w-16 rounded-[14px]"
        style={{ background: `var(${v})`, border: "1px solid rgba(255,220,190,0.16)" }}
      />
      <span className="t-figure text-[11px]" style={{ color: "var(--sec)" }}>{name}</span>
    </div>
  );
}
