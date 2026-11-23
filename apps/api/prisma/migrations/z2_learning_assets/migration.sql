-- Teacher-reviewed flashcard decks and micro-lessons are published explicitly.
CREATE TYPE "LearningAssetKind" AS ENUM ('FLASHCARDS','MICROLESSON');
CREATE TABLE "LearningAsset" (
 "id" TEXT NOT NULL,
 "reflectionId" TEXT NOT NULL,
 "createdByUserId" TEXT NOT NULL,
 "kind" "LearningAssetKind" NOT NULL,
 "title" TEXT NOT NULL,
 "content" JSONB NOT NULL,
 "publishedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "LearningAsset_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LearningAsset_reflectionId_publishedAt_idx" ON "LearningAsset"("reflectionId","publishedAt");
ALTER TABLE "LearningAsset" ADD CONSTRAINT "LearningAsset_reflectionId_fkey"
 FOREIGN KEY ("reflectionId") REFERENCES "ClassReflection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LearningAsset" ADD CONSTRAINT "LearningAsset_createdByUserId_fkey"
 FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
