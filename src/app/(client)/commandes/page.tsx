"use client";

import { useRouter } from "next/navigation";
import { StickyHeader, BackBtn, EmptyState, Btn } from "@/components/ui/shared";

export default function CommandesPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-stone-50">
      <StickyHeader>
        <BackBtn onClick={() => router.push("/decouvrir")} />
        <p className="font-display text-xl font-bold">Mes commandes</p>
      </StickyHeader>

      <main className="mx-auto max-w-[600px] px-5 py-7">
        <EmptyState
          icon="📋"
          title="Aucune commande pour le moment"
          sub="Tes commandes apparaîtront ici après ton premier achat."
          action={
            <Btn className="mt-4" onClick={() => router.push("/decouvrir")}>
              Découvrir les boucheries
            </Btn>
          }
        />
      </main>
    </div>
  );
}
