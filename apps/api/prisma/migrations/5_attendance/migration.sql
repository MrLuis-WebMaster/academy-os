CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT','ABSENT','LATE','EXCUSED');
ALTER TABLE "ClassBooking" ADD COLUMN "attendance" "AttendanceStatus";
