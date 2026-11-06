-- The two things a course hands you that are neither a lecture nor an exam.
--
-- PURELY ADDITIVE. Four new tables, no column altered, no column dropped, no
-- row touched. Undoing it is four DROP TABLEs against tables nothing else
-- references, and nothing that existed before this file can be lost by
-- running it or by reversing it.
--
-- WHY NOT `Problem`. The obvious move was to hang sheet questions off the
-- Problem model, which already has `question`, `userAnswer` and a status. It
-- also has `correctAnswer NOT NULL`, an attempt count and a difficulty,
-- because it is a practice question the system drills the student on and
-- already knows the answer to. A sheet question is the opposite: a prompt the
-- student writes a long answer to and hands in for marks, whose correct
-- answer nobody here holds. Reusing the model would have meant making
-- `correctAnswer` nullable — a change to an existing column, to serve a
-- feature that would then read the same rows with opposite expectations.
-- Problem has zero rows on this account today, so that change would have been
-- safe and it would still have been wrong.
--
-- WHY NO `Project` TABLE. A project already exists here as a Task of type
-- PROJECT — "Problem-Solving Project submission (group, 10%)" is one, due
-- 2026-12-05 — carrying its own title, deadline and completion. A second
-- model would be a second answer to "when is it due", and the first time the
-- two disagreed the student would be told the wrong date by the screen that
-- looked more official. So the milestones and the team hang off the Task.

-- CreateTable
CREATE TABLE "Sheet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "taskId" TEXT,
    "title" TEXT NOT NULL,
    "number" INTEGER,
    "criteria" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sourceCaptureId" TEXT,

    CONSTRAINT "Sheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SheetQuestion" (
    "id" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "prompt" TEXT NOT NULL,
    -- NULL means never started. '' means opened and cleared. The count of
    -- answered questions has to agree with the student about which is which,
    -- so the two are not collapsed.
    "answer" TEXT,
    "answeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SheetQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMilestone" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    -- A timestamp and not a boolean: "المرحلة الحالية" is read from when the
    -- step before it finished, and a boolean throws that away.
    "doneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceCaptureId" TEXT,

    CONSTRAINT "ProjectMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMember" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    -- A name, not a userId. These are classmates with no account here.
    "name" TEXT NOT NULL,
    "role" TEXT,
    "workingOn" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceCaptureId" TEXT,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Sheet_userId_idx" ON "Sheet"("userId");
CREATE INDEX "Sheet_subjectId_idx" ON "Sheet"("subjectId");
CREATE INDEX "Sheet_taskId_idx" ON "Sheet"("taskId");
CREATE INDEX "SheetQuestion_sheetId_idx" ON "SheetQuestion"("sheetId");
CREATE INDEX "ProjectMilestone_taskId_idx" ON "ProjectMilestone"("taskId");
CREATE INDEX "ProjectMember_taskId_idx" ON "ProjectMember"("taskId");

-- AddForeignKey
--
-- The sheet CASCADES from its student and its course, because a sheet without
-- either is unreachable. It SETS NULL from its task: deleting the deadline
-- must not delete the answers written against it. That asymmetry is the whole
-- reason the two are separate rows.
ALTER TABLE "Sheet" ADD CONSTRAINT "Sheet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Sheet" ADD CONSTRAINT "Sheet_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Sheet" ADD CONSTRAINT "Sheet_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SheetQuestion" ADD CONSTRAINT "SheetQuestion_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "Sheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectMilestone" ADD CONSTRAINT "ProjectMilestone_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
