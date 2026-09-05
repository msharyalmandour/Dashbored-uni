import { PrismaClient, Difficulty, GapSource, GapStatus, FlashcardStatus, ProblemStatus, MistakeType, MistakeStatus, TaskType, TaskPriority, TaskStatus, VideoStatus, VideoPlatform, LectureStatus, ResourceType, ReviewType, FocusSessionStatus } from "@prisma/client";

const prisma = new PrismaClient();

function daysFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(9, 0, 0, 0);
  return d;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const DEFAULT_INTERVALS = [1, 3, 7, 14, 30];

async function createReviewSchedule(opts: {
  userId: string;
  subjectId: string;
  lectureId?: string | null;
  topicId?: string | null;
  flashcardId?: string | null;
  knowledgeGapId?: string | null;
  mistakeId?: string | null;
  type: ReviewType;
  startDate: Date;
}) {
  const rows = DEFAULT_INTERVALS.map((days, i) => {
    const scheduledDate = new Date(opts.startDate);
    scheduledDate.setDate(scheduledDate.getDate() + days);
    const stages = ["REVIEW_1", "REVIEW_2", "REVIEW_3", "REVIEW_4", "MASTERY_REVIEW"] as const;
    const status = scheduledDate < new Date() ? "DUE" : "SCHEDULED";
    return {
      userId: opts.userId,
      subjectId: opts.subjectId,
      lectureId: opts.lectureId ?? null,
      topicId: opts.topicId ?? null,
      flashcardId: opts.flashcardId ?? null,
      knowledgeGapId: opts.knowledgeGapId ?? null,
      mistakeId: opts.mistakeId ?? null,
      type: opts.type,
      scheduledDate,
      reviewStage: stages[i],
      status,
    } as const;
  });
  await prisma.reviewItem.createMany({ data: rows });
}

async function main() {
  console.log("Seeding University OS...");

  // Clean slate for idempotent re-seeding in dev.
  await prisma.$transaction([
    prisma.reviewItem.deleteMany(),
    prisma.focusSession.deleteMany(),
    prisma.mistake.deleteMany(),
    prisma.problem.deleteMany(),
    prisma.flashcard.deleteMany(),
    prisma.video.deleteMany(),
    prisma.knowledgeGap.deleteMany(),
    prisma.lectureResource.deleteMany(),
    prisma.lecture.deleteMany(),
    prisma.topic.deleteMany(),
    prisma.task.deleteMany(),
    prisma.clinicalTraining.deleteMany(),
    prisma.subject.deleteMany(),
    prisma.semester.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  const user = await prisma.user.create({
    data: {
      name: "Amina Yusuf",
      email: "student@university-os.app",
      profileSettings: { reviewIntervals: DEFAULT_INTERVALS, theme: "system" },
    },
  });

  const activeSemester = await prisma.semester.create({
    data: {
      userId: user.id,
      name: "Fall 2026",
      startDate: daysFromNow(-45),
      endDate: daysFromNow(60),
      status: "ACTIVE",
    },
  });

  const pastSemester = await prisma.semester.create({
    data: {
      userId: user.id,
      name: "Spring 2026",
      startDate: daysFromNow(-220),
      endDate: daysFromNow(-50),
      status: "COMPLETED",
    },
  });

  // ---------------------------------------------------------------------
  // SUBJECTS
  // ---------------------------------------------------------------------
  const subjectDefs = [
    {
      name: "Pharmacology",
      code: "PHRM 302",
      color: "#8b5cf6",
      instructor: "Dr. Femi Okafor",
      creditHours: 4,
      topics: ["Pharmacokinetics", "Drug Distribution", "Drug Metabolism", "Adverse Drug Reactions", "Autonomic Pharmacology"],
    },
    {
      name: "Pathology",
      code: "PATH 210",
      color: "#ef4444",
      instructor: "Dr. Grace Adeyemi",
      creditHours: 4,
      topics: ["Cell Injury", "Inflammation", "Neoplasia", "Hemodynamic Disorders"],
    },
    {
      name: "Anatomy & Physiology",
      code: "ANAT 150",
      color: "#0ea5e9",
      instructor: "Prof. Daniel Osei",
      creditHours: 3,
      topics: ["Cardiovascular System", "Respiratory System", "Nervous System", "Renal System"],
    },
    {
      name: "Clinical Skills",
      code: "CLIN 220",
      color: "#10b981",
      instructor: "Dr. Bola Martins",
      creditHours: 3,
      topics: ["Patient Assessment", "Vital Signs", "History Taking", "Clinical Reasoning"],
    },
    {
      name: "Biochemistry",
      code: "BIOC 180",
      color: "#f59e0b",
      instructor: "Dr. Ifeoma Chukwu",
      creditHours: 3,
      topics: ["Enzyme Kinetics", "Metabolic Pathways", "Amino Acids & Proteins"],
    },
  ];

  const subjects: Record<string, Awaited<ReturnType<typeof prisma.subject.create>>> = {};
  const topicsBySubject: Record<string, Awaited<ReturnType<typeof prisma.topic.create>>[]> = {};

  for (const def of subjectDefs) {
    const subject = await prisma.subject.create({
      data: {
        userId: user.id,
        semesterId: activeSemester.id,
        name: def.name,
        code: def.code,
        color: def.color,
        instructor: def.instructor,
        creditHours: def.creditHours,
        status: "ACTIVE",
      },
    });
    subjects[def.name] = subject;

    const topics = [];
    for (const [i, topicName] of def.topics.entries()) {
      const difficulty = i % 3 === 0 ? Difficulty.HARD : i % 3 === 1 ? Difficulty.MEDIUM : Difficulty.EASY;
      const topic = await prisma.topic.create({
        data: {
          subjectId: subject.id,
          name: topicName,
          difficulty,
          masteryLevel: randomInt(30, 90),
        },
      });
      topics.push(topic);
    }
    topicsBySubject[def.name] = topics;
  }

  // A prior, completed subject for history / analytics depth.
  await prisma.subject.create({
    data: {
      userId: user.id,
      semesterId: pastSemester.id,
      name: "Microbiology",
      code: "MICR 140",
      color: "#64748b",
      instructor: "Dr. Chidi Nnamdi",
      creditHours: 3,
      status: "COMPLETED",
    },
  });

  // ---------------------------------------------------------------------
  // LECTURES + RESOURCES + KNOWLEDGE GAPS
  // ---------------------------------------------------------------------
  const lectureStatuses: LectureStatus[] = [
    LectureStatus.COMPLETED,
    LectureStatus.COMPLETED,
    LectureStatus.COMPLETED,
    LectureStatus.NEEDS_REVIEW,
    LectureStatus.IN_PROGRESS,
    LectureStatus.NOT_STARTED,
  ];

  const allLectures: Awaited<ReturnType<typeof prisma.lecture.create>>[] = [];
  let pharmacologyDrugDistLecture: Awaited<ReturnType<typeof prisma.lecture.create>> | null = null;
  let pharmacologyDrugDistTopic: Awaited<ReturnType<typeof prisma.topic.create>> | null = null;

  for (const def of subjectDefs) {
    const subject = subjects[def.name];
    const topics = topicsBySubject[def.name];
    const lectureCount = randomInt(5, 7);

    for (let i = 0; i < lectureCount; i++) {
      const topic = topics[i % topics.length];
      const status = i < lectureCount - 2 ? pick(lectureStatuses.slice(0, 4)) : pick(lectureStatuses.slice(3));
      const completion = status === "COMPLETED" ? 100 : status === "NEEDS_REVIEW" ? 100 : status === "IN_PROGRESS" ? randomInt(30, 70) : 0;

      const lecture = await prisma.lecture.create({
        data: {
          subjectId: subject.id,
          topicId: topic.id,
          title: `${topic.name}: Lecture ${i + 1}`,
          lectureNumber: i + 1,
          date: daysFromNow(-30 + i * 4),
          lecturer: def.instructor,
          status,
          completionPercentage: completion,
          difficultyRating: randomInt(1, 5),
          selfAssessment: status === "NOT_STARTED" ? null : randomInt(45, 95),
          quickNotes: status === "NOT_STARTED" ? null : "Key mechanisms and clinical correlations covered in class.",
        },
      });
      allLectures.push(lecture);

      if (def.name === "Pharmacology" && topic.name === "Drug Distribution" && !pharmacologyDrugDistLecture) {
        pharmacologyDrugDistLecture = lecture;
        pharmacologyDrugDistTopic = topic;
      }

      await prisma.lectureResource.createMany({
        data: [
          { lectureId: lecture.id, type: ResourceType.POWERPOINT, title: `${topic.name} — Slides`, url: null },
          { lectureId: lecture.id, type: ResourceType.PDF, title: `${topic.name} — Lecture Notes`, url: null },
          ...(i % 2 === 0
            ? [{ lectureId: lecture.id, type: ResourceType.VIDEO, title: `${topic.name} — Recording`, url: "https://example.edu/recordings" }]
            : []),
        ],
      });

      // Sprinkle knowledge gaps on completed / needs-review lectures.
      if ((status === "COMPLETED" || status === "NEEDS_REVIEW") && Math.random() < 0.55) {
        const gapStatus = pick([GapStatus.NOT_UNDERSTOOD, GapStatus.LEARNING, GapStatus.PRACTICING, GapStatus.UNDERSTOOD, GapStatus.MASTERED]);
        await prisma.knowledgeGap.create({
          data: {
            subjectId: subject.id,
            lectureId: lecture.id,
            topicId: topic.id,
            title: `Unclear: ${topic.name} mechanism`,
            description: `Struggling to connect ${topic.name.toLowerCase()} theory to the clinical case discussed in lecture ${i + 1}.`,
            source: GapSource.LECTURE,
            difficulty: topic.difficulty,
            status: gapStatus,
            resolvedAt: gapStatus === GapStatus.MASTERED || gapStatus === GapStatus.UNDERSTOOD ? daysFromNow(-randomInt(1, 10)) : null,
          },
        });
      }
    }

    // Create review schedules for completed lectures (backdated so several stages are already due).
    const completedLectures = allLectures.filter(
      (l) => l.subjectId === subject.id && (l.status === "COMPLETED" || l.status === "NEEDS_REVIEW")
    );
    for (const lecture of completedLectures.slice(0, 2)) {
      await createReviewSchedule({
        userId: user.id,
        subjectId: subject.id,
        lectureId: lecture.id,
        topicId: lecture.topicId,
        type: ReviewType.LECTURE,
        startDate: daysFromNow(-20),
      });
    }

    // Review schedule for the hardest topic in each subject.
    const hardTopic = topics.find((t) => t.difficulty === Difficulty.HARD);
    if (hardTopic) {
      await createReviewSchedule({
        userId: user.id,
        subjectId: subject.id,
        topicId: hardTopic.id,
        type: ReviewType.TOPIC,
        startDate: daysFromNow(-16),
      });
    }
  }

  if (!pharmacologyDrugDistLecture || !pharmacologyDrugDistTopic) {
    throw new Error("Expected a Drug Distribution lecture to exist for the seeded weakness example.");
  }

  // ---------------------------------------------------------------------
  // THE SPEC'S HERO EXAMPLE: repeated weakness on "Drug Distribution"
  // ---------------------------------------------------------------------
  const drugDistSubject = subjects["Pharmacology"];
  const drugDistGap = await prisma.knowledgeGap.create({
    data: {
      subjectId: drugDistSubject.id,
      lectureId: pharmacologyDrugDistLecture.id,
      topicId: pharmacologyDrugDistTopic.id,
      title: "Drug Distribution",
      description: "Can't reliably predict how plasma protein binding changes the volume of distribution.",
      source: GapSource.PROBLEM_SOLVING,
      difficulty: Difficulty.HARD,
      status: GapStatus.PRACTICING,
    },
  });

  const drugDistMistakeTemplates: Array<[string, string, MistakeType]> = [
    ["Confused volume of distribution with clearance", "Vd and clearance describe different pharmacokinetic behaviors", MistakeType.MISUNDERSTANDING],
    ["Forgot to account for protein binding", "Only free drug distributes into tissue", MistakeType.KNOWLEDGE_GAP],
    ["Mixed up highly vs poorly perfused tissue uptake", "Highly perfused organs equilibrate first", MistakeType.MISUNDERSTANDING],
    ["Misread the question's units (mg vs mg/kg)", "Always check dose units before calculating Vd", MistakeType.QUESTION_MISINTERPRETATION],
    ["Forgot loading dose formula entirely", "Loading dose = Vd × target concentration", MistakeType.MEMORY_ERROR],
    ["Rushed the calculation and mis-keyed a value", "Slow down on multi-step PK calculations", MistakeType.CARELESS_MISTAKE],
  ];

  for (const [why, concept, type] of drugDistMistakeTemplates) {
    const problem = await prisma.problem.create({
      data: {
        userId: user.id,
        subjectId: drugDistSubject.id,
        lectureId: pharmacologyDrugDistLecture.id,
        topicId: pharmacologyDrugDistTopic.id,
        knowledgeGapId: drugDistGap.id,
        question: "A 70kg patient is given a drug with Vd = 0.5 L/kg. What loading dose achieves a target plasma concentration of 10 mg/L?",
        userAnswer: "70 mg",
        correctAnswer: "350 mg (Vd 35L x 10 mg/L)",
        difficulty: Difficulty.HARD,
        status: ProblemStatus.INCORRECT,
        attempts: randomInt(1, 3),
      },
    });

    await prisma.mistake.create({
      data: {
        userId: user.id,
        problemId: problem.id,
        subjectId: drugDistSubject.id,
        topicId: pharmacologyDrugDistTopic.id,
        lectureId: pharmacologyDrugDistLecture.id,
        knowledgeGapId: drugDistGap.id,
        mistakeType: type,
        whyIGotItWrong: why,
        correctConcept: concept,
        whatIShouldReview: "Redo 10 loading-dose practice questions and re-watch the Vd walkthrough video.",
        frequency: 1,
        status: MistakeStatus.OPEN,
      },
    });
  }

  // Flashcards + review schedule tied to the Drug Distribution gap.
  const drugDistCardDefs = [
    ["What does Vd (volume of distribution) represent?", "A theoretical volume relating total drug in the body to plasma concentration."],
    ["Loading dose formula?", "Loading Dose = Vd × Target Plasma Concentration."],
    ["Why does protein binding lower apparent Vd?", "Only unbound (free) drug can distribute into tissues; bound drug stays in plasma."],
  ];
  for (const [front, back] of drugDistCardDefs) {
    const card = await prisma.flashcard.create({
      data: {
        userId: user.id,
        subjectId: drugDistSubject.id,
        lectureId: pharmacologyDrugDistLecture.id,
        topicId: pharmacologyDrugDistTopic.id,
        knowledgeGapId: drugDistGap.id,
        front,
        back,
        difficulty: Difficulty.HARD,
        status: FlashcardStatus.LEARNING,
        nextReviewDate: daysFromNow(-randomInt(0, 3)),
        reviewCount: randomInt(1, 4),
        correctCount: randomInt(0, 2),
        incorrectCount: randomInt(1, 3),
      },
    });
    await createReviewSchedule({
      userId: user.id,
      subjectId: drugDistSubject.id,
      topicId: pharmacologyDrugDistTopic.id,
      knowledgeGapId: drugDistGap.id,
      flashcardId: card.id,
      type: ReviewType.KNOWLEDGE_GAP,
      startDate: daysFromNow(-12),
    });
  }

  // ---------------------------------------------------------------------
  // GENERAL FLASHCARDS across every subject
  // ---------------------------------------------------------------------
  const flashcardBank: Record<string, Array<[string, string]>> = {
    Pharmacology: [
      ["Define first-pass metabolism.", "Drug concentration reduction before reaching systemic circulation, mainly via the liver."],
      ["Zero-order vs first-order kinetics?", "Zero-order: constant amount eliminated per time. First-order: constant fraction eliminated per time."],
      ["What is bioavailability (F)?", "Fraction of administered drug that reaches systemic circulation unchanged."],
      ["Name two Phase I metabolism reactions.", "Oxidation and reduction (also hydrolysis)."],
      ["What triggers an anaphylactoid ADR?", "Direct mast cell degranulation, not IgE-mediated."],
    ],
    Pathology: [
      ["Reversible vs irreversible cell injury?", "Reversible: swelling, fatty change. Irreversible: membrane rupture, karyolysis."],
      ["Cardinal signs of acute inflammation?", "Rubor, calor, tumor, dolor, functio laesa."],
      ["Define metaplasia.", "Reversible replacement of one differentiated cell type with another."],
      ["Difference between thrombus and embolus?", "Thrombus forms in situ; embolus travels and lodges elsewhere."],
    ],
    "Anatomy & Physiology": [
      ["Path of blood through the heart?", "RA → RV → pulmonary artery → lungs → pulmonary vein → LA → LV → aorta."],
      ["What controls the respiratory rate centrally?", "The medullary respiratory center, modulated by CO2/pH via chemoreceptors."],
      ["Function of the loop of Henle?", "Creates the medullary concentration gradient for water reabsorption."],
    ],
    "Clinical Skills": [
      ["Normal adult resting heart rate range?", "60–100 bpm."],
      ["Components of a focused history (OPQRST)?", "Onset, Provocation, Quality, Radiation, Severity, Timing."],
    ],
    Biochemistry: [
      ["What is Km in enzyme kinetics?", "Substrate concentration at half of Vmax; reflects enzyme-substrate affinity."],
      ["Rate-limiting enzyme of glycolysis?", "Phosphofructokinase-1 (PFK-1)."],
    ],
  };

  for (const [subjectName, cards] of Object.entries(flashcardBank)) {
    const subject = subjects[subjectName];
    for (const [front, back] of cards) {
      const dueOffset = pick([-4, -2, -1, 0, 0, 2, 5, 10]);
      const reviewCount = randomInt(0, 6);
      await prisma.flashcard.create({
        data: {
          userId: user.id,
          subjectId: subject.id,
          front,
          back,
          difficulty: pick([Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD]),
          status: reviewCount === 0 ? FlashcardStatus.NEW : pick([FlashcardStatus.LEARNING, FlashcardStatus.REVIEWING, FlashcardStatus.MASTERED]),
          nextReviewDate: daysFromNow(dueOffset),
          reviewCount,
          correctCount: Math.max(0, reviewCount - randomInt(0, 2)),
          incorrectCount: randomInt(0, 2),
          lastReviewed: reviewCount > 0 ? daysFromNow(-randomInt(1, 14)) : null,
        },
      });
    }
  }

  // ---------------------------------------------------------------------
  // ADDITIONAL PROBLEMS (non-Drug-Distribution) for variety
  // ---------------------------------------------------------------------
  const otherProblemSubjects = ["Pathology", "Anatomy & Physiology", "Biochemistry"];
  for (const subjectName of otherProblemSubjects) {
    const subject = subjects[subjectName];
    const topics = topicsBySubject[subjectName];
    for (let i = 0; i < 6; i++) {
      const topic = pick(topics);
      const status = pick([ProblemStatus.CORRECT, ProblemStatus.CORRECT, ProblemStatus.INCORRECT, ProblemStatus.NOT_ATTEMPTED]);
      const problem = await prisma.problem.create({
        data: {
          userId: user.id,
          subjectId: subject.id,
          topicId: topic.id,
          question: `Practice question ${i + 1} on ${topic.name}`,
          userAnswer: status === "NOT_ATTEMPTED" ? null : "Student response",
          correctAnswer: "Reference answer covering key mechanism",
          difficulty: topic.difficulty,
          status,
          attempts: status === "NOT_ATTEMPTED" ? 0 : 1,
        },
      });

      if (status === ProblemStatus.INCORRECT) {
        await prisma.mistake.create({
          data: {
            userId: user.id,
            problemId: problem.id,
            subjectId: subject.id,
            topicId: topic.id,
            mistakeType: pick([MistakeType.MISUNDERSTANDING, MistakeType.MEMORY_ERROR, MistakeType.CARELESS_MISTAKE]),
            whyIGotItWrong: "Misapplied the underlying mechanism to this specific scenario.",
            correctConcept: `Review the core concept behind ${topic.name}.`,
            whatIShouldReview: `Revisit ${topic.name} lecture notes and attempt 5 more questions.`,
            frequency: randomInt(1, 3),
            status: pick([MistakeStatus.OPEN, MistakeStatus.REVIEWING]),
          },
        });
      }
    }
  }

  // ---------------------------------------------------------------------
  // CLINICAL TRAINING
  // ---------------------------------------------------------------------
  const clinicalDefs = [
    {
      hospital: "St. Augustine Teaching Hospital",
      department: "Internal Medicine",
      supervisor: "Dr. Kalu Emeka",
      skillsPracticed: "Venipuncture, patient interviewing, chart review",
      casesSeen: 6,
      whatILearned: "Recognizing early signs of fluid overload in CHF patients.",
      whatIDidNotUnderstand: "Why the attending titrated the diuretic dose differently than the protocol.",
      questionsToAsk: "What lab values trigger a diuretic dose change mid-admission?",
      reflection: "Felt confident on history taking, less so on connecting labs to bedside decisions.",
      nextAction: "Read up on diuretic titration protocols before next rotation.",
    },
    {
      hospital: "Grace Community Clinic",
      department: "Emergency Medicine",
      supervisor: "Dr. Nkechi Obi",
      skillsPracticed: "Triage assessment, vital sign interpretation",
      casesSeen: 9,
      whatILearned: "Triage prioritization using the ESI algorithm.",
      whatIDidNotUnderstand: "How to distinguish anxiety-driven tachycardia from early sepsis.",
      questionsToAsk: "What's the fastest reliable bedside sepsis screen?",
      reflection: "Pace of the ED pushed me to think faster under pressure.",
      nextAction: "Create flashcards on qSOFA criteria.",
    },
    {
      hospital: "St. Augustine Teaching Hospital",
      department: "Pharmacy",
      supervisor: "Dr. Femi Okafor",
      skillsPracticed: "Medication reconciliation, dose adjustment for renal impairment",
      casesSeen: 4,
      whatILearned: "Renal dosing adjustments for common antibiotics.",
      whatIDidNotUnderstand: "How creatinine clearance estimates change the loading dose vs maintenance dose.",
      questionsToAsk: "Does the loading dose change with renal impairment, or only maintenance dosing?",
      reflection: "This ties directly into the Vd / loading dose gap I still have from Pharmacology.",
      nextAction: "Connect this to the Drug Distribution knowledge gap and re-derive the loading dose formula.",
    },
  ];

  for (const [i, def] of clinicalDefs.entries()) {
    const entry = await prisma.clinicalTraining.create({
      data: {
        userId: user.id,
        date: daysFromNow(-randomInt(2, 25)),
        ...def,
      },
    });

    if (i === clinicalDefs.length - 1) {
      // This rotation directly reinforces the Drug Distribution gap.
      await prisma.knowledgeGap.create({
        data: {
          subjectId: drugDistSubject.id,
          topicId: pharmacologyDrugDistTopic.id,
          clinicalTrainingId: entry.id,
          title: "Renal dosing & loading dose interaction",
          description: def.whatIDidNotUnderstand,
          source: GapSource.CLINICAL_TRAINING,
          difficulty: Difficulty.HARD,
          status: GapStatus.NOT_UNDERSTOOD,
        },
      });
    }
  }

  // ---------------------------------------------------------------------
  // VIDEOS
  // ---------------------------------------------------------------------
  const videoDefs: Array<{ subjectName: string; title: string; status: VideoStatus }> = [
    { subjectName: "Pharmacology", title: "Volume of Distribution Explained (Osmosis)", status: VideoStatus.COMPLETED },
    { subjectName: "Pharmacology", title: "Loading & Maintenance Dose Walkthrough", status: VideoStatus.WATCHING },
    { subjectName: "Pathology", title: "Acute vs Chronic Inflammation", status: VideoStatus.WATCH_LATER },
    { subjectName: "Anatomy & Physiology", title: "Cardiac Cycle Animation", status: VideoStatus.COMPLETED },
    { subjectName: "Clinical Skills", title: "OSCE History-Taking Demo", status: VideoStatus.WATCH_LATER },
    { subjectName: "Biochemistry", title: "Michaelis-Menten Kinetics Derivation", status: VideoStatus.WATCHING },
  ];
  for (const v of videoDefs) {
    const subject = subjects[v.subjectName];
    await prisma.video.create({
      data: {
        userId: user.id,
        subjectId: subject.id,
        title: v.title,
        url: "https://www.youtube.com/watch?v=example",
        platform: VideoPlatform.YOUTUBE,
        duration: randomInt(300, 1500),
        status: v.status,
        knowledgeGaps:
          v.title.includes("Volume of Distribution") || v.title.includes("Loading")
            ? { connect: [{ id: drugDistGap.id }] }
            : undefined,
      },
    });
  }

  // ---------------------------------------------------------------------
  // TASKS / DEADLINES — spread across every urgency tier
  // ---------------------------------------------------------------------
  const taskDefs: Array<{ title: string; type: TaskType; deadlineOffset: number; priority: TaskPriority; subjectName?: string; status?: TaskStatus }> = [
    { title: "Pharmacology Problem Set 4", type: TaskType.ASSIGNMENT, deadlineOffset: -1, priority: TaskPriority.HIGH, subjectName: "Pharmacology" },
    { title: "Pathology Case Report", type: TaskType.PROJECT, deadlineOffset: 0, priority: TaskPriority.URGENT, subjectName: "Pathology" },
    { title: "Anatomy Practical Exam", type: TaskType.EXAM, deadlineOffset: 2, priority: TaskPriority.URGENT, subjectName: "Anatomy & Physiology" },
    { title: "Clinical Skills OSCE Prep", type: TaskType.QUIZ, deadlineOffset: 3, priority: TaskPriority.HIGH, subjectName: "Clinical Skills" },
    { title: "Biochemistry Reading: Enzyme Kinetics Ch.6", type: TaskType.READING, deadlineOffset: 5, priority: TaskPriority.MEDIUM, subjectName: "Biochemistry" },
    { title: "Pharmacology Midterm", type: TaskType.EXAM, deadlineOffset: 9, priority: TaskPriority.URGENT, subjectName: "Pharmacology" },
    { title: "Group Presentation: Inflammation Pathways", type: TaskType.PRESENTATION, deadlineOffset: 12, priority: TaskPriority.MEDIUM, subjectName: "Pathology" },
    { title: "Clinical Rotation Reflection Journal", type: TaskType.OTHER, deadlineOffset: 20, priority: TaskPriority.LOW, subjectName: "Clinical Skills" },
    { title: "Submit Elective Course Registration", type: TaskType.OTHER, deadlineOffset: -3, priority: TaskPriority.MEDIUM, status: TaskStatus.COMPLETED },
    { title: "Anatomy Lab Worksheet", type: TaskType.ASSIGNMENT, deadlineOffset: -6, priority: TaskPriority.MEDIUM, subjectName: "Anatomy & Physiology", status: TaskStatus.COMPLETED },
  ];

  for (const t of taskDefs) {
    await prisma.task.create({
      data: {
        userId: user.id,
        subjectId: t.subjectName ? subjects[t.subjectName].id : null,
        title: t.title,
        type: t.type,
        deadline: daysFromNow(t.deadlineOffset),
        priority: t.priority,
        status: t.status ?? (t.deadlineOffset < 0 ? TaskStatus.OVERDUE : t.deadlineOffset <= 2 ? TaskStatus.IN_PROGRESS : TaskStatus.NOT_STARTED),
        completionPercentage: t.status === TaskStatus.COMPLETED ? 100 : t.deadlineOffset <= 2 ? randomInt(20, 70) : 0,
      },
    });
  }

  // ---------------------------------------------------------------------
  // FOCUS SESSIONS — study-time / consistency history
  // ---------------------------------------------------------------------
  const subjectNames = Object.keys(subjects);
  for (let i = 0; i < 14; i++) {
    if (Math.random() < 0.25) continue; // some days have no study session
    const subjectName = pick(subjectNames);
    const planned = pick([25, 30, 45, 50, 60]);
    const started = daysFromNow(-i);
    started.setHours(randomInt(8, 21), 0, 0, 0);
    const ended = new Date(started);
    ended.setMinutes(ended.getMinutes() + planned);
    await prisma.focusSession.create({
      data: {
        userId: user.id,
        subjectId: subjects[subjectName].id,
        taskLabel: `${subjectName} deep work`,
        plannedMinutes: planned,
        actualMinutes: planned - randomInt(0, 5),
        startedAt: started,
        endedAt: ended,
        status: FocusSessionStatus.COMPLETED,
        accomplished: `Reviewed ${subjectName} material and completed practice questions.`,
      },
    });
  }

  console.log("Seed complete:", {
    user: user.email,
    subjects: subjectDefs.length + 1,
    lectures: allLectures.length,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
