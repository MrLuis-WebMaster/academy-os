-- School scheduling preferences. Existing academies keep scheduling enabled on holidays
-- until an owner explicitly enables the opt-in policy.
ALTER TABLE "Workspace"
  ADD COLUMN "holidayCountry" TEXT NOT NULL DEFAULT 'CO',
  ADD COLUMN "avoidPublicHolidays" BOOLEAN NOT NULL DEFAULT false;
