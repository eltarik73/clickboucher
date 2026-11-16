// The payment method card of /panier: payment at pickup is the only method (no online payment).
import { Banknote, CreditCard } from "lucide-react";

export function PaymentMethodNotice() {
  return (
    <div className="rounded-2xl border border-[#ece8e3] bg-white p-4 dark:border-white/10 dark:bg-[#141414]">
      <div className="mb-3 flex items-center gap-2">
        <CreditCard size={16} className="text-[#DC2626]" />
        <span className="text-sm font-semibold text-gray-900 dark:text-white">
          Mode de paiement
        </span>
      </div>
      <div className="flex items-center gap-3 rounded-xl border border-[#DC2626] bg-[#DC2626]/5 p-3">
        <Banknote size={18} className="shrink-0 text-emerald-600" />
        <div>
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            Paiement sur place
          </span>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            Payez au retrait (espèces, CB)
          </p>
        </div>
      </div>
    </div>
  );
}
