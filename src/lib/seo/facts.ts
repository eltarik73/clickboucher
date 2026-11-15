// The one source of the commercial facts that public pages, FAQ JSON-LD, metadata and
// public/llms.txt repeat. Each sentence must stay true as the product stands:
// - the only payment method is ON_PICKUP (src/lib/validators/order.ts): the customer pays the
//   shop at pickup, and serviceFeeCentsFor("ON_PICKUP") is 0 (src/lib/pricing/totals.ts);
// - click and collect only: the customer picks the order up as soon as it is ready or at the
//   slot chosen in the cart;
// - each shop is responsible for its halal certification; Klik&Go certifies nothing.
// When one of these changes, change the sentence here: every page follows.
// Every sentence must pass findForbiddenClaims (src/lib/seo/claims.ts).

export type Faq = { question: string; answer: string };

export const FACT_PAYMENT =
  "Vous réglez votre commande directement à la boucherie, au moment du retrait, avec les moyens de paiement qu'elle accepte.";

export const FACT_FEES =
  "Commander sur Klik&Go est sans frais de service : vous payez les prix fixés par la boucherie.";

export const FACT_PICKUP =
  "Klik&Go fonctionne uniquement en click & collect, sans livraison : vous retirez votre commande en boutique, dès qu'elle est prête ou au créneau choisi.";

export const FACT_HALAL =
  "Chaque boucherie est responsable de sa certification halal et du choix de son organisme certificateur : Klik&Go ne certifie pas la viande.";

export const FACT_SUMMARY_SHORT = "Retrait et paiement en boutique, sans frais de service.";

export const ORDER_STEPS: readonly { title: string; text: string }[] = [
  {
    title: "Choisissez",
    text: "Sélectionnez une boucherie halal et vos produits.",
  },
  {
    title: "Commandez",
    text: "Validez votre commande, sans frais de service, pour un retrait dès que possible ou au créneau choisi.",
  },
  {
    title: "Retirez et payez",
    text: "Récupérez votre commande en boutique et réglez-la sur place.",
  },
];

export const COMMON_FAQ: { fees: Faq; payment: Faq; halal: Faq; delivery: Faq } = {
  fees: {
    question: "Y a-t-il des frais de service ?",
    answer: `Non. ${FACT_FEES}`,
  },
  payment: {
    question: "Comment se passe le paiement ?",
    answer: `${FACT_PAYMENT} Pour les produits vendus au poids, le montant peut être ajusté selon la pesée.`,
  },
  halal: {
    question: "Qui garantit que la viande est halal ?",
    answer: `${FACT_HALAL} Demandez à votre boucher quel organisme le certifie.`,
  },
  delivery: {
    question: "Klik&Go livre-t-il à domicile ?",
    answer: `Non. ${FACT_PICKUP}`,
  },
};
