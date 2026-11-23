-- Human-reviewed competency evidence and student learning goals.
-- Scores are 0..100, and SkillProgress.mastery aggregates only verified evidence.
CREATE TYPE "LearningGoalStatus" AS ENUM ('ACTIVE','ACHIEVED','CANCELLED');

CREATE TABLE "SkillEvidence" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "topicId" TEXT NOT NULL,
  "studentUserId" TEXT NOT NULL,
  "reviewerUserId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "score" INTEGER NOT NULL,
  "note" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SkillEvidence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SkillEvidence_score_check" CHECK ("score" BETWEEN 0 AND 100)
);
CREATE UNIQUE INDEX "SkillEvidence_workspaceId_reviewerUserId_requestId_key"
ON "SkillEvidence"("workspaceId","reviewerUserId","requestId");
CREATE INDEX "SkillEvidence_workspaceId_studentUserId_topicId_idx"
ON "SkillEvidence"("workspaceId","studentUserId","topicId");
ALTER TABLE "SkillEvidence"
ADD CONSTRAINT "SkillEvidence_workspaceId_fkey" FOREIGN KEY ("workspaceId")
REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SkillEvidence"
ADD CONSTRAINT "SkillEvidence_topicId_fkey" FOREIGN KEY ("topicId")
REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SkillEvidence"
ADD CONSTRAINT "SkillEvidence_studentUserId_fkey" FOREIGN KEY ("studentUserId")
REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SkillEvidence"
ADD CONSTRAINT "SkillEvidence_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId")
REFERENCES "User"("id") ON UPDATE CASCADE;

CREATE TABLE "LearningGoal" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "topicId" TEXT,
  "studentUserId" TEXT NOT NULL,
  "assignedByUserId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "targetMastery" INTEGER,
  "status" "LearningGoalStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "LearningGoal_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LearningGoal_targetMastery_check" CHECK ("targetMastery" IS NULL OR "targetMastery" BETWEEN 1 AND 100)
);
CREATE INDEX "LearningGoal_workspaceId_studentUserId_courseId_status_idx"
ON "LearningGoal"("workspaceId","studentUserId","courseId","status");
ALTER TABLE "LearningGoal"
ADD CONSTRAINT "LearningGoal_workspaceId_fkey" FOREIGN KEY ("workspaceId")
REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LearningGoal"
ADD CONSTRAINT "LearningGoal_courseId_fkey" FOREIGN KEY ("courseId")
REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LearningGoal"
ADD CONSTRAINT "LearningGoal_topicId_fkey" FOREIGN KEY ("topicId")
REFERENCES "Topic"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LearningGoal"
ADD CONSTRAINT "LearningGoal_studentUserId_fkey" FOREIGN KEY ("studentUserId")
REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LearningGoal"
ADD CONSTRAINT "LearningGoal_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId")
REFERENCES "User"("id") ON UPDATE CASCADE;

CREATE TABLE "LearningGoalEvent" (
  "id" TEXT NOT NULL,
  "goalId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "fromStatus" "LearningGoalStatus" NOT NULL,
  "toStatus" "LearningGoalStatus" NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LearningGoalEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LearningGoalEvent_goalId_createdAt_idx" ON "LearningGoalEvent"("goalId","createdAt");
ALTER TABLE "LearningGoalEvent"
ADD CONSTRAINT "LearningGoalEvent_goalId_fkey" FOREIGN KEY ("goalId")
REFERENCES "LearningGoal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
