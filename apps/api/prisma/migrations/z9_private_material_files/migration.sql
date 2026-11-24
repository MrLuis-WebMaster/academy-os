CREATE TABLE "PrivateMaterialFile" (
 "resourceId" TEXT NOT NULL,
 "filename" TEXT NOT NULL,
 "mimeType" TEXT NOT NULL,
 "sizeBytes" INTEGER NOT NULL,
 "content" BYTEA NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "PrivateMaterialFile_pkey" PRIMARY KEY ("resourceId"),
 CONSTRAINT "PrivateMaterialFile_size_check" CHECK ("sizeBytes" > 0 AND "sizeBytes" <= 5242880 AND octet_length("content") = "sizeBytes"),
 CONSTRAINT "PrivateMaterialFile_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
