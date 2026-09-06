-- CreateTable
CREATE TABLE "match_issues" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "match_issues_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "match_issues_matchId_idx" ON "match_issues"("matchId");

-- CreateIndex
CREATE INDEX "match_issues_authorId_idx" ON "match_issues"("authorId");

-- AddForeignKey
ALTER TABLE "match_issues" ADD CONSTRAINT "match_issues_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_issues" ADD CONSTRAINT "match_issues_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
