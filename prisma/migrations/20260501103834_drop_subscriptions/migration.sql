-- DropForeignKey
ALTER TABLE "subscriptions" DROP CONSTRAINT IF EXISTS "subscriptions_shop_id_fkey";

-- DropTable
DROP TABLE IF EXISTS "subscriptions";

-- DropTable
DROP TABLE IF EXISTS "plan_features";

-- DropEnum
DROP TYPE IF EXISTS "SubscriptionPlan";

-- DropEnum
DROP TYPE IF EXISTS "SubscriptionStatus";
