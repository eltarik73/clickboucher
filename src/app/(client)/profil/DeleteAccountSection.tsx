// Profile section « Zone dangereuse »: the customer deletes his account (DELETE /api/users/me, which
// anonymises it), then is signed out.
"use client";

import { useState } from "react";
import { useClerk } from "@clerk/nextjs";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export default function DeleteAccountSection() {
  const clerk = useClerk();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const res = await fetch("/api/users/me", { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.success("Compte supprimé. Vous allez être déconnecté.");
        // Keep deleting=true to prevent double-click, then sign out
        setTimeout(() => clerk.signOut({ redirectUrl: "/" }), 1500);
        return; // Don't reset state on success
      } else {
        toast.error(data.error?.message || "Erreur lors de la suppression");
      }
    } catch {
      toast.error("Erreur réseau");
    }
    setDeleting(false);
    setShowDeleteConfirm(false);
  };

  return (
    <section className="rounded-2xl border border-red-200 bg-white p-5 shadow-[0_1px_4px_rgba(0,0,0,0.03)] dark:border-red-900/30 dark:bg-[#141414]">
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle size={16} className="text-red-500" />
        <h2 className="text-sm font-bold text-red-600 dark:text-red-400">Zone dangereuse</h2>
      </div>

      {!showDeleteConfirm ? (
        <div>
          <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
            La suppression de votre compte est irréversible. Vos données personnelles seront
            anonymisées.
          </p>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="text-sm font-medium text-red-500 transition-colors hover:text-red-700 dark:hover:text-red-300"
          >
            Supprimer mon compte
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-red-600 dark:text-red-400">
            Êtes-vous sûr ? Cette action est irréversible.
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Vos commandes passées resteront visibles pour les bouchers mais vos informations
            personnelles seront supprimées.
          </p>
          <div className="flex gap-2">
            <Button
              onClick={handleDeleteAccount}
              disabled={deleting}
              className="bg-red-600 text-white hover:bg-red-700"
              size="sm"
            >
              {deleting ? "Suppression..." : "Confirmer la suppression"}
            </Button>
            <Button
              onClick={() => setShowDeleteConfirm(false)}
              variant="outline"
              size="sm"
              disabled={deleting}
            >
              Annuler
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
