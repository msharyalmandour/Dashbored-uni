"use client";

import * as React from "react";
import { buildWeekMap, startOfWeek } from "@/lib/week-map";
import { WeekTimeline } from "@/components/week/week-timeline";

/* Demo content. Invented on purpose — see page.tsx. */
const TILES = [
  { label: "مراجعات اليوم", value: "12", unit: "من 69", pct: "18%", grad: "linear-gradient(150deg,#E28A6E,#B44A64)", glow: "#FFB48F" },
  { label: "مهام مستحقة", value: "3", unit: "مهام", pct: "40%", grad: "linear-gradient(150deg,#7E9B8A,#3A554A)", glow: "#B6D8C2" },
  { label: "للاختبار", value: "3", unit: "أيام", pct: "78%", grad: "linear-gradient(150deg,#D2601A,#7A2B05)", glow: "#FFA04D" },
  { label: "ما فهمته بعد", value: "8", unit: "مواضيع", pct: "55%", grad: "linear-gradient(150deg,#B0906A,#51402D)", glow: "#E8CFA6" },
];

const PILE = [
  { name: "Pharmacokinetics L1.pdf", c: "#FFB067" },
  { name: "محاضرة الدوران — تصوير.jpg", c: "#E28A6E" },
  { name: "Research Methods syllabus.docx", c: "#7ED9A6" },
  { name: "IMG_2841.jpg", c: "#FFA04D" },
];

const GROUPS = [
  { n: "3", subject: "Pharmacology", what: "محاضرتان + ورقة أسئلة", sure: "واثق", c: "#FFB067" },
  { n: "2", subject: "Research Methods", what: "خطة المقرر + موعد تسليم", sure: "واثق", c: "#7ED9A6" },
  { n: "1", subject: "Pathology", what: "صورة سبورة", sure: "يسأل", c: "#FFA04D" },
];

/** The soft blurred lobe inside a card. This is what stops a fill reading flat. */
function Glow({ color, size, className }: { color: string; size: number; className: string }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute z-0 rounded-full blur-[34px] preview-drift ${className}`}
      style={{ width: size, height: size, background: color }}
    />
  );
}

function Card({
  children,
  grad,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  grad: string;
  className?: string;
  delay?: number;
}) {
  return (
    <div
      className={`preview-card relative isolate overflow-hidden rounded-[28px] ${className}`}
      style={{ background: grad, animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

export function Bento() {
  // The one piece of real interaction: tapping a tab swaps the screen, so the
  // direction can be judged on a phone the way it would actually be used.
  const [tab, setTab] = React.useState<"today" | "week" | "drop">("today");

  return (
    /* The first draft capped this at 430px, so on an iPad the whole design was
       a phone column with 48% of the screen left black — 64% in landscape. A
       bento grid that never spreads is just a list. */
    <div className="mx-auto w-full max-w-[430px] px-[18px] pb-10 pt-[22px] text-white md:max-w-[1120px] md:px-8 md:pt-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex size-[34px] items-center justify-center rounded-[11px] bg-[linear-gradient(140deg,#D4FF3D,#8FBF12)]">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#0B1400" strokeWidth="2.4" strokeLinecap="round">
              <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
              <circle cx="12" cy="12" r="3.2" />
            </svg>
          </span>
          <span className="text-[15px] font-semibold tracking-tight">صباح الخير، مشاري</span>
        </div>
      </div>

      {/* Two screens, one switch — 44px targets, per the walkthrough. */}
      <div className="mb-4 flex gap-2 rounded-2xl bg-white/[0.06] p-1 md:mb-6 md:w-fit">
        {([["today", "اليوم"], ["week", "أسبوعك"], ["drop", "أسقط أي شيء"]] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`min-h-11 flex-1 rounded-xl px-6 text-[13.5px] font-semibold transition-colors md:flex-none ${
              tab === k ? "bg-[#D4FF3D] text-[#0B1400]" : "text-white/70"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "today" ? <Today /> : tab === "week" ? <Week /> : <Drop />}

      <p className="mt-8 text-center text-[11.5px] leading-relaxed text-white/35">
        معاينة تصميم — كل رقم هنا تجريبي وثابت، ولا يقرأ من حسابك.
      </p>
    </div>
  );
}

function Today() {
  return (
    /* Four columns from md up. The hero takes two of them and two rows, the
       four tiles fill the other half, and the week runs the full width
       underneath — so the same pieces become a bento instead of a stack. */
    <div key="today" className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
      <Card grad="linear-gradient(160deg,#C86A22 0%,#7A3A0E 52%,#3A1A05 100%)" className="col-span-2 flex flex-col justify-center p-[22px] md:row-span-2 md:p-8" delay={40}>
        <Glow color="#FFB067" size={190} className="-top-[70px] -right-10 opacity-80" />
        <div className="relative z-10">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-[11.5px] font-semibold tracking-wide text-white/70">الآن — 20 دقيقة</span>
            <span className="flex gap-[3.5px]">
              {Array.from({ length: 12 }).map((_, i) => (
                <span
                  key={i}
                  className="preview-dot size-1 rounded-full"
                  style={{ background: i < 8 ? "#D4FF3D" : "rgba(255,255,255,.22)", animationDelay: `${i * 90}ms` }}
                />
              ))}
            </span>
          </div>
          <h1 className="mb-1.5 text-[25px] font-semibold leading-[1.28] tracking-tight md:text-[34px]">راجع توزيع الدواء</h1>
          <p className="mb-5 text-[13.5px] leading-relaxed text-white/[0.66]">
            6 أسئلة غلط في هذا الموضوع — الاختبار بعد 3 أيام
          </p>
          <div className="flex gap-2.5">
            <button className="min-h-11 flex-1 rounded-[15px] bg-[#D4FF3D] py-[15px] text-[14.5px] font-bold text-[#0B1400]">
              ابدأ
            </button>
            <button className="min-h-11 rounded-[15px] bg-white/[0.13] px-[18px] py-[15px] text-[14.5px] font-semibold">
              غيره
            </button>
          </div>
        </div>
      </Card>

      <>
        {TILES.map((t, i) => (
          <Card key={t.label} grad={t.grad} className="flex min-h-[124px] flex-col justify-between p-[17px] md:min-h-[150px] md:p-5" delay={120 + i * 60}>
            <Glow color={t.glow} size={120} className="-top-[46px] -left-[34px] opacity-75" />
            <div className="relative z-10 flex h-full flex-col justify-between">
              <span className="text-[12px] font-semibold text-white/[0.78]">{t.label}</span>
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="preview-num text-[36px] font-semibold leading-none md:text-[44px]">{t.value}</span>
                  <span className="text-[12px] text-white/60">{t.unit}</span>
                </div>
                <div className="mt-2.5 h-[3px] overflow-hidden rounded-[3px] bg-white/20">
                  <div className="h-full rounded-[3px] bg-white/90" style={{ width: t.pct }} />
                </div>
              </div>
            </div>
          </Card>
        ))}
      </>

      <Card grad="linear-gradient(140deg,#1B1B1F,#0E0E11)" className="col-span-2 p-[18px] pb-3.5 md:col-span-4 md:p-6" delay={360}>
        <div className="relative z-10">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[12.5px] font-semibold text-white/80">أسبوعك</span>
            <span className="text-[11.5px] font-semibold text-[#D4FF3D]">الوقت يكفي</span>
          </div>
          <svg width="100%" height="46" viewBox="0 0 320 46" preserveAspectRatio="none" className="block">
            <polyline
              points="0,34 46,28 92,31 138,18 184,22 230,11 276,15 320,7"
              fill="none" stroke="#D4FF3D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="preview-draw"
            />
            <circle cx="320" cy="7" r="3.4" fill="#D4FF3D" />
          </svg>
          <div className="mt-[7px] flex justify-between text-[10.5px] text-white/40">
            <span>السبت</span><span>الاثنين</span><span>الأربعاء</span><span>الجمعة</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

/**
 * The week, through the real engine rather than a drawing of one — so what this
 * preview shows is what the page will do, lane collisions and all.
 */
function Week() {
  const map = React.useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now);
    const at = (day: number, h: number, m = 0) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + day);
      d.setHours(h, m, 0, 0);
      return d;
    };
    return buildWeekMap({
      weekStart,
      now,
      events: [
        { id: "1", title: "Nursing Leadership", type: "LECTURE", startsAt: at(1, 9), endsAt: at(1, 12, 50), subjectId: null },
        { id: "2", title: "Research Methods", type: "LECTURE", startsAt: at(1, 16), endsAt: at(1, 17, 50), subjectId: null },
        { id: "3", title: "تدريب سريري", type: "CLINICAL", startsAt: at(2, 7), endsAt: at(2, 13), subjectId: null },
        { id: "4", title: "Pharmacology", type: "LECTURE", startsAt: at(3, 10), endsAt: at(3, 12), subjectId: null },
        { id: "5", title: "معمل التشريح", type: "LECTURE", startsAt: at(3, 11), endsAt: at(3, 13), subjectId: null },
        { id: "6", title: "Pathology", type: "LECTURE", startsAt: at(4, 9), endsAt: at(4, 11), subjectId: null },
      ],
      commitments: [
        { id: "c1", label: "دوام", kind: "WORK", weekday: 6, startMinute: 16 * 60, endMinute: 20 * 60, subjectId: null },
      ],
      tasks: [
        { id: "t1", title: "Pharmacology Problem Set 4", deadline: at(2, 23, 59), estimatedMinutes: 90, status: "OVERDUE", subjectId: null },
        { id: "t2", title: "Pathology Case Report", deadline: at(3, 23, 59), estimatedMinutes: null, status: "IN_PROGRESS", subjectId: null },
        { id: "t3", title: "Anatomy Practical Exam", deadline: at(5, 8), estimatedMinutes: 120, status: "IN_PROGRESS", subjectId: null },
      ],
      reviews: Array.from({ length: 12 }, (_, i) => ({
        id: `r${i}`, scheduledDate: at(2, 9), status: "DUE", subjectId: null,
      })),
      reviewLabel: "مراجعة",
    });
  }, []);

  return (
    <div key="week" className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[19px] font-semibold tracking-tight">أسبوعك</h2>
        <span className="text-[12px] text-white/45">كل شيء له وقت، في مكان واحد</span>
      </div>
      <WeekTimeline
        map={map}
        dayNames={["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"]}
        labels={{
          now: "الآن",
          nothing: "ما فيه شيء هذا الأسبوع بعد.",
          unplaced: "شغل بلا وقت محجوز — أنت تقرر متى",
          noEstimate: "؟",
          overdue: "متأخرة",
        }}
      />
    </div>
  );
}

function Drop() {
  return (
    /* The pile reads on one side and what it became on the other, so the
       before and after are visible at once rather than one scroll apart. */
    <div key="drop" className="grid grid-cols-1 gap-3 md:grid-cols-2 md:items-start md:gap-4">
      <Card grad="linear-gradient(155deg,#C86A22,#7A3A0E 55%,#341605)" className="p-[22px] md:p-7" delay={40}>
        <Glow color="#FFB067" size={200} className="-top-20 -right-[50px] opacity-80" />
        <div className="relative z-10">
          <div className="mb-[18px] flex items-center gap-3.5">
            <svg width="46" height="46" viewBox="0 0 46 46" className="shrink-0">
              <circle cx="23" cy="23" r="19" fill="none" stroke="rgba(255,255,255,.16)" strokeWidth="2.5" />
              <g className="preview-orbit" style={{ transformOrigin: "50% 50%" }}>
                <circle cx="23" cy="23" r="19" fill="none" stroke="#D4FF3D" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="30 90" />
              </g>
            </svg>
            <div className="min-w-0">
              <p className="mb-[3px] text-[15px] font-semibold">أقرأ الكومة كاملة</p>
              <p className="text-[12.5px] text-white/60">قبل ما أكتب أي شيء في سجلك</p>
            </div>
          </div>
          <div className="flex flex-col gap-[7px]">
            {PILE.map((f, i) => (
              <div key={f.name} className="flex items-center gap-2.5 rounded-[13px] bg-white/[0.08] px-3 py-2.5">
                <span className="size-[7px] shrink-0 rounded-full" style={{ background: f.c }} />
                <span dir="auto" className="min-w-0 flex-1 truncate text-[12.5px] [unicode-bidi:isolate]">{f.name}</span>
                <span className="flex h-[13px] shrink-0 items-end gap-[2px]">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <span
                      key={j}
                      className="preview-bar w-[2px] rounded-[2px]"
                      style={{ height: 13, background: f.c, animationDelay: `${i * 200 + j * 130}ms` }}
                    />
                  ))}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card grad="linear-gradient(150deg,#1B1B1F,#0D0D10)" className="p-[18px] md:row-span-2 md:p-7" delay={140}>
        <div className="relative z-10">
          <div className="mb-[15px] flex items-center justify-between">
            <span className="text-[13px] font-semibold">فهمت الكومة كذا</span>
            <span className="text-[11px] font-semibold text-[#D4FF3D]">عدّل قبل الحفظ</span>
          </div>
          {GROUPS.map((g) => (
            <div key={g.subject} className="flex items-center gap-[11px] border-t border-white/[0.07] py-[11px]">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-[11px]" style={{ background: `${g.c}22` }}>
                <span className="preview-num text-[13px] font-bold" style={{ color: g.c }}>{g.n}</span>
              </span>
              <div className="min-w-0 flex-1">
                <p dir="auto" className="mb-0.5 text-[13px] font-semibold [unicode-bidi:isolate]">{g.subject}</p>
                <p className="text-[11.5px] text-white/50">{g.what}</p>
              </div>
              <span className="text-[11px] text-white/[0.35]">{g.sure}</span>
            </div>
          ))}
          <button className="mt-[15px] min-h-11 w-full rounded-[15px] bg-[#D4FF3D] py-[15px] text-[14.5px] font-bold text-[#0B1400]">
            احفظ الكل
          </button>
        </div>
      </Card>

      <Card grad="linear-gradient(150deg,#D2601A,#7A2B05)" className="p-[18px] md:p-6" delay={220}>
        <Glow color="#FFA04D" size={120} className="-bottom-[50px] -left-[30px] opacity-55" />
        <div className="relative z-10 flex items-start gap-3">
          <span className="preview-dot mt-1.5 size-[7px] shrink-0 rounded-full bg-white" />
          <div>
            <p dir="auto" className="mb-1 text-[13px] font-semibold [unicode-bidi:isolate]">IMG_2841.jpg</p>
            <p className="text-[12.5px] leading-relaxed text-white/[0.82]">
              صورة سبورة ما فيها اسم مادة. هي من Pharmacology ولا Pathology؟
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
