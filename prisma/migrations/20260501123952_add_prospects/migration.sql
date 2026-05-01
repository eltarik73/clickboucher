-- CreateEnum
CREATE TYPE "ProspectStatus" AS ENUM ('NEW', 'CONTACTED', 'REPLIED', 'VISIT_SCHEDULED', 'VISITED', 'SIGNED', 'REFUSED', 'UNREACHABLE');

-- CreateEnum
CREATE TYPE "ProspectSource" AS ENUM ('GOOGLE_PLACES', 'MANUAL', 'REFERRAL', 'INBOUND');

-- CreateTable
CREATE TABLE "prospects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "zip_code" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "google_place_id" TEXT,
    "google_url" TEXT,
    "rating" DOUBLE PRECISION,
    "review_count" INTEGER,
    "status" "ProspectStatus" NOT NULL DEFAULT 'NEW',
    "source" "ProspectSource" NOT NULL DEFAULT 'MANUAL',
    "notes" TEXT,
    "contacted_at" TIMESTAMP(3),
    "replied_at" TIMESTAMP(3),
    "visit_scheduled_at" TIMESTAMP(3),
    "visited_at" TIMESTAMP(3),
    "signed_at" TIMESTAMP(3),
    "refused_at" TIMESTAMP(3),
    "refused_reason" TEXT,
    "signed_shop_id" TEXT,
    "emails_sent_count" INTEGER NOT NULL DEFAULT 0,
    "last_email_at" TIMESTAMP(3),
    "whatsapp_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prospects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "prospects_google_place_id_key" ON "prospects"("google_place_id");

-- CreateIndex
CREATE UNIQUE INDEX "prospects_signed_shop_id_key" ON "prospects"("signed_shop_id");

-- CreateIndex
CREATE INDEX "prospects_status_idx" ON "prospects"("status");

-- CreateIndex
CREATE INDEX "prospects_city_idx" ON "prospects"("city");

-- CreateIndex
CREATE INDEX "prospects_source_idx" ON "prospects"("source");
