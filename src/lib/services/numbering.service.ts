import prisma from "@/lib/prisma";

/**
 * Génère le prochain numéro de commande du jour pour une boucherie.
 * Thread-safe grâce à upsert + increment atomique.
 * Reset automatique chaque jour (nouvelle entrée par date).
 */
export async function getNextDailyNumber(shopId: string): Promise<{
  dailyNumber: number;
  displayNumber: string;
}> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const counter = await prisma.dailyCounter.upsert({
    where: {
      shopId_date: { shopId, date: today },
    },
    create: {
      shopId,
      date: today,
      lastNumber: 1,
    },
    update: {
      lastNumber: { increment: 1 },
    },
  });

  return {
    dailyNumber: counter.lastNumber,
    displayNumber: `#${String(counter.lastNumber).padStart(3, "0")}`,
  };
}

/**
 * Attribue un numéro client permanent si l'utilisateur n'en a pas encore.
 * Format : "C-001", "C-002", etc. Compteur par boucherie.
 */
export async function ensureCustomerNumber(
  userId: string,
  shopId: string
): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { customerNumber: true },
  });

  if (user?.customerNumber) return user.customerNumber;

  const counter = await prisma.customerCounter.upsert({
    where: { shopId },
    create: { shopId, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
  });

  const customerNumber = `C-${String(counter.lastNumber).padStart(3, "0")}`;

  await prisma.user.update({
    where: { id: userId },
    data: { customerNumber },
  });

  return customerNumber;
}
