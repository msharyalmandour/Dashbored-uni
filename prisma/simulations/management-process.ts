/**
 * المحاكاة الأولى: Management Process & First-Line Nurse Manager's Roles.
 * NURP (431) Nursing Leadership, lecture 2.
 *
 * WHERE THIS CONTENT COMES FROM, precisely, because it matters for trust.
 *
 * The student built himself a study app for this lecture and revised from it —
 * his words: "اول مرا اذكر كذا". That app is where the FORM comes from: a ward,
 * a few dials, four decisions, an explanation after each one. But the app did
 * not contain a simulation as data. Its مواقف feature builds the scenario live
 * by prompting a model with the lecture text, grades it by matching
 * /النتيجة:\s*(\d)\s*\/\s*4/ out of the reply, and keeps nothing. So there was
 * no eight-step graph to copy across; there was a shape, and a lecture.
 *
 * The TEACHING CONTENT and every slide number below are transcribed from that
 * app's own lesson data, which is a faithful outline of the deck: lesson t2
 * (slides 4–5) managers, t3 (6) leaders, t4 (7–8) the five functions and their
 * order, t5 (9) planning, t6 (10) organizing, t7 (11) assembling resources,
 * t8 (12) directing, t9 (13) controlling. The definitions are the slides'
 * English; the explanations are in the student's own register.
 *
 * The STORY — a new head nurse, a ward that keeps falling, a senior nurse
 * everyone defers to — is written here. It is a frame to hang the lecture on,
 * not a claim about anything that happened. Every fact a choice turns on is
 * from the deck; nothing is scored on a detail of the story.
 *
 * WHY IT STOPS AT SLIDE 13. The lecture runs to 33 slides, and parts 3 (nurse
 * manager roles, AONE, head nurse vs charge nurse) are the better half of it.
 * They are left out on purpose: the management process is one closed arc —
 * plan, organize, assemble, direct, control, and back to planning — and eight
 * steps is already the length past which `MAX_NODES` says a student abandons
 * the run. Part 3 is its own simulation, and it should be its own simulation.
 */

import type { Simulation } from "../../src/lib/simulation";

export const MANAGEMENT_PROCESS: Simulation = {
  title: "أول أسبوع لك كـ head nurse",
  start: "n1",
  /* The ward, as four dials. Values are display strings, not counters — a
     choice says what a dial NOW READS, which is why morale can be a face. */
  meters: { Staff: "6/7", Patients: 28, Morale: "😐", Quality: "78%" },
  nodes: [
    {
      key: "n1",
      situation:
        "تعيّنت head nurse لجناح الباطنية. أول يوم، تلاحظ إن الممرضين يرجعون لممرضة قديمة في كل شي، مع إنها مو مديرة.",
      question: "وش تفهم من هذا؟",
      choices: [
        {
          text: "أنا مدير: قوتي من المنصب. وهي قائدة: قوتها من التأثير",
          next: "n2",
          score: 10,
          why: "صح. المدير تعيّنه المؤسسة وقوته legitimate من الصلاحية المعطاة له. القائد غالباً ما عنده صلاحية رسمية ويأخذ قوته من influence.",
          slide: 5,
          effects: { Morale: "🙂" },
        },
        {
          text: "هي المديرة الحقيقية وأنا ما عندي صلاحية",
          next: "n2",
          score: 0,
          why: "لا. الصلاحية عندك، معطاة لك مع المنصب. تأثيرها ما يلغي صلاحيتك.",
          slide: 5,
        },
        {
          text: "أنقلها لجناح ثاني قبل ما تكبر المشكلة",
          next: "n2",
          score: 0,
          why: "القائد غير الرسمي ممكن يكون أقوى عون لك: اللكتشر يقول إن القائد يركّز على group process و feedback و empowering others.",
          slide: 6,
          effects: { Morale: "😟" },
        },
      ],
    },
    {
      key: "n2",
      situation: "الإدارة تبغا الجناح ينزّل السقطات (falls) خلال الشهر الجاي.",
      question: "وش أول خطوة في الـ management process؟",
      choices: [
        {
          text: "Planning",
          next: "n3",
          score: 10,
          why: "صح. الترتيب في السلايد: Planning ← Organizing ← Assembling Resources ← Directing ← Controlling، وبعدها ترجع للتخطيط.",
          slide: 8,
        },
        {
          text: "Controlling: أقيس السقطات الحين",
          next: "n3",
          score: 0,
          why: "المراقبة آخر خطوة، لأنها تقارن الأداء بالهدف — ولازم يكون فيه هدف وخطة قبلها.",
          slide: 13,
        },
        {
          text: "Directing: أوزّع التعليمات على الفريق",
          next: "n3",
          score: 0,
          why: "التوجيه رابع خطوة. توجّه فريق على خطة، وهي ما كُتبت بعد.",
          slide: 12,
        },
      ],
    },
    {
      key: "n3",
      situation: "قعدت تكتب الخطة. تبغا تتأكد إنها كاملة.",
      question: "التخطيط يجاوب على كم سؤال، ووش هي؟",
      choices: [
        {
          text: "خمسة: وش · كيف · متى · وين · ومين",
          next: "n4",
          score: 10,
          why: "صح. Planning is deciding in advance what should be done, how, when, where and by whom.",
          slide: 9,
          effects: { Quality: "80%" },
        },
        {
          text: "ثلاثة: وش · متى · ومين",
          next: "n4",
          score: 0,
          why: "ناقص اثنين. التعريف فيه how و where كذلك، وهذي نقطة تجي في الامتحان.",
          slide: 9,
        },
      ],
    },
    {
      key: "n4",
      situation: "الخطة جاهزة. الحين تقسم الجناح: ممرضة للغرف ١–٦، وممرضة للغرف ٧–١٢، والـ charge nurse تتابع.",
      question: "هذي أي خطوة، وليش؟",
      choices: [
        {
          text: "Organizing: توزيع شغل مع صلاحية، وخط سلطة واضح",
          next: "n5",
          score: 10,
          why: "صح. Organizing = setting up the group, allocating resources, and assigning work with enough authority and responsibilities. ومنها تطلع line of authority و minimize friction.",
          slide: 10,
        },
        {
          text: "Assembling resources: توفير الناس والأدوات",
          next: "n5",
          score: 0,
          why: "قريب بس لا. تجميع الموارد = تتوقع وتوفّر. هنا الناس موجودين وأنت توزّع عليهم الشغل والصلاحية.",
          slide: 11,
        },
        {
          text: "Planning: لأني أقرر مين يسوي وش",
          next: "n5",
          score: 0,
          why: "التخطيط يقرر by whom على ورق قبل البداية. التنفيذ الفعلي للتوزيع مع الصلاحية هو Organizing.",
          slide: 10,
        },
      ],
    },
    {
      key: "n5",
      situation: "موسم الحج جاي والمرضى بيزيدون. ما عندك ممرضين كفاية.",
      question: "وش تسوي، وتحت أي خطوة يدخل؟",
      choices: [
        {
          text: "Assembling resources: أتوقع الزيادة وأستعير ممرضين وأجهزة، من داخل المستشفى أو من خارجه",
          next: "n6",
          score: 10,
          why: "صح. التعريف يقول anticipating and providing… within and outside organization. والموارد خمسة: manpower · financial · time · material · physical facilities.",
          slide: 11,
          effects: { Staff: "8/8", Patients: 34 },
        },
        {
          text: "أستنى لين يزيدون فعلاً وبعدها أطلب",
          next: "n6",
          score: 0,
          why: "كلمة anticipating هي بيت القصيد: تجميع الموارد يصير قبل الحاجة، مو بعدها.",
          slide: 11,
          effects: { Patients: 34, Morale: "😟" },
        },
      ],
    },
    {
      key: "n6",
      situation: "الفريق كبر وفيه ممرضين جداد ما يعرفون بروتوكول السقطات.",
      question: "الخطوة الجاية وش تتضمن؟",
      choices: [
        {
          text: "Directing: تواصل، تدريب، أوامر، وتحفيز — وهي شغل مستمر",
          next: "n7",
          score: 10,
          why: "صح. Directing is a continuous task of making contacts with subordinates, training them, giving them orders, leading & motivating them. وعناصره: delegation & supervision · motivation · communication · coordination.",
          slide: 12,
          effects: { Morale: "🙂" },
        },
        {
          text: "Controlling: أراقبهم وأكتب ملاحظات على أخطائهم",
          next: "n7",
          score: 0,
          why: "المراقبة تجي بعد التوجيه. ممرض جديد ما دُرّب، تدريبه أول — والمراقبة تقارن الأداء بالهدف، لا تعلّم.",
          slide: 13,
        },
        {
          text: "Organizing: أعيد توزيع الغرف عليهم",
          next: "n7",
          score: 0,
          why: "التوزيع صار في الخطوة اللي قبل. اللي ناقص الحين هو التدريب والتواصل، وهذا Directing.",
          slide: 12,
        },
      ],
    },
    {
      key: "n7",
      situation: "آخر الشهر. الهدف كان صفر سقطات، وصار ثلاث سقطات.",
      question: "وش خطوات Controlling بالترتيب؟",
      choices: [
        {
          text: "تقيس الأداء ← تقارنه بالهدف ← تاخذ corrective action",
          next: "n8",
          score: 10,
          why: "صح، وهذا نص التعريف: monitoring performance, comparing it with goals, and taking corrective action as needed.",
          slide: 13,
          effects: { Quality: "86%" },
        },
        {
          text: "تاخذ إجراء على الممرضين المسؤولين ← بعدها تقيس",
          next: "n8",
          score: 0,
          why: "الترتيب معكوس. تقيس وتقارن أول، وبعدها تصلّح — وإلا أنت تصلّح شي ما تعرف سببه.",
          slide: 13,
        },
        {
          text: "تكتب تقرير وترفعه للإدارة",
          next: "n8",
          score: 0,
          why: "التقرير مو من التعريف. وأغراض المراقبة الستة فيها discover irregularities و detect opportunities و reduce costs — كلها تصليح، مو توثيق.",
          slide: 13,
        },
      ],
    },
    {
      key: "n8",
      situation: "صلّحت الخطة والسقطات نزلت. الإدارة تسألك: وش بعد؟",
      question: "بعد Controlling، وين تروح الدائرة؟",
      choices: [
        {
          text: "ترجع لـ Planning: الخطوات دائرة تتكرر",
          next: "end",
          score: 10,
          why: "صح. السلايد يرسمها دائرة: بعد المراقبة ترجع تخطط من جديد على ضوء اللي قسته.",
          slide: 8,
          effects: { Morale: "😄", Quality: "90%" },
        },
        {
          text: "تخلص. الخطوات خمس وانتهت",
          next: "end",
          score: 0,
          why: "لا، وهي نقطة يحبها الامتحان: الخطوات cycle مو list. بعد Controlling ترجع لـ Planning.",
          slide: 8,
        },
      ],
    },
  ],
};
