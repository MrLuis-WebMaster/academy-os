CREATE TABLE "CalendarSyncLink" (
 "id" TEXT NOT NULL,
 "connectionId" TEXT NOT NULL,
 "sessionId" TEXT NOT NULL,
 "connectionGeneration" TIMESTAMP(3) NOT NULL,
 "revision" INTEGER NOT NULL DEFAULT 1,
 "deliveredRevision" INTEGER NOT NULL DEFAULT 0,
 "attempts" INTEGER NOT NULL DEFAULT 0,
 "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "leaseToken" TEXT,
 "leaseUntil" TIMESTAMP(3),
 "lastErrorCode" TEXT,
 CONSTRAINT "CalendarSyncLink_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "CalendarSyncLink_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ExternalConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "CalendarSyncLink_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClassSession"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CalendarSyncLink_connectionId_sessionId_key" ON "CalendarSyncLink"("connectionId","sessionId");
CREATE INDEX "CalendarSyncLink_nextAttemptAt_idx" ON "CalendarSyncLink"("nextAttemptAt");
CREATE INDEX "CalendarSyncLink_sessionId_idx" ON "CalendarSyncLink"("sessionId");

-- Changes to the event projection and enqueue of existing opt-in links are atomic.
-- Never enroll new classes automatically and never call a remote provider in SQL.
CREATE FUNCTION academy_os_queue_calendar_sync() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."title" IS DISTINCT FROM OLD."title"
 OR NEW."startsAt" IS DISTINCT FROM OLD."startsAt"
 OR NEW."endsAt" IS DISTINCT FROM OLD."endsAt"
 OR NEW."timezone" IS DISTINCT FROM OLD."timezone"
 OR NEW."status" IS DISTINCT FROM OLD."status" THEN
  UPDATE "CalendarSyncLink"
  SET "revision" = "revision" + 1, "nextAttemptAt" = CURRENT_TIMESTAMP,
      "attempts" = 0, "lastErrorCode" = NULL
  WHERE "sessionId" = NEW."id";
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER academy_os_class_calendar_sync AFTER UPDATE ON "ClassSession"
FOR EACH ROW EXECUTE FUNCTION academy_os_queue_calendar_sync();
