// @vitest-environment node
//
// The forbidden-claims list (wording rules W1 to W7 of the chantier): each rule must catch the
// sentences the audit found and leave the honest wording alone.

import { describe, it, expect } from "vitest";
import { FORBIDDEN_CLAIMS, findForbiddenClaims } from "@/lib/seo/claims";

const EXPECTED_IDS = [
  "fee-amount",
  "online-payment",
  "delivery",
  "pickup-delay",
  "quote-catering",
  "certification",
  "verification",
  "real-time",
  "superlative",
  "partner-count",
];

const CASES: Record<string, { match: string[]; pass: string[] }> = {
  "fee-amount": {
    match: [
      "Frais de service : 0,99€ par commande.",
      "Seulement 0.99 € de frais.",
      "Des frais de 1,50 € par commande.",
      "Frais de service: 2 euros.",
    ],
    pass: [
      "Commander est sans frais de service.",
      "Gigot d'agneau : 10,99 € le kilo.",
      "Prix fixés par la boucherie.",
    ],
  },
  "online-payment": {
    match: [
      "Payez en ligne en toute sécurité.",
      "Paiement en ligne ou sur place.",
      "Paiement sécurisé et rapide.",
      "Réglez votre commande en ligne.",
      "Paiement par Stripe.",
      "Virement accepté pour les commandes.",
    ],
    pass: [
      "Commandez en ligne, payez en boutique.",
      "Vous réglez votre commande sur place, au retrait.",
      "Paiement en boutique, au moment du retrait.",
    ],
  },
  delivery: {
    match: [
      "Livraison offerte dès 30 €.",
      "Votre viande livrée chez vous.",
      "Nous pouvons livrer votre commande.",
      "Une livraison rapide à domicile.",
    ],
    pass: [
      "Pas de livraison : retrait en boutique.",
      "Click & collect sans livraison.",
      "Il n'y a aucune livraison.",
      "Ni livraison ni frais de service.",
      "Le certificat est délivré par l'organisme.",
    ],
  },
  "pickup-delay": {
    match: [
      "Boucherie halal Lyon — Commande 30min",
      "Votre commande prête en 30 min.",
      "Retrait en moins de 30 minutes.",
      "Récupérez votre viande en 15 minutes chrono.",
    ],
    pass: [
      "Retrait en boutique au créneau choisi.",
      "Sortez la viande 30 minutes avant cuisson.",
      "Au four, comptez 15-20 minutes à 200°C.",
      "Cuisson : 1h30 minimum à feu doux.",
      "Arrosez toutes les 30 minutes.",
      "Gigot au four : 30 min/kg à 180°C.",
    ],
  },
  "quote-catering": {
    match: [
      "Devis personnalisé sous 48h.",
      "Possibilité de prestation traiteur.",
      "Réponse sous 48 h.",
      "Devis sur mesure pour votre mariage.",
    ],
    pass: [
      "Commandez deux semaines avant le mariage.",
      "Prix en devise euro.",
      "Pour les grands repas, prévoir 24h.",
    ],
  },
  certification: {
    match: [
      "Une viande halal certifiée fraîche du jour.",
      "Les boucheries halal certifiées de Lyon.",
      "Des agneaux halal certifiés.",
      "Volailles de Bresse, certifiés halal.",
      "Des boucheries certifiées dans toute la région.",
      "Une viande 100 % halal.",
      "Une viande 100% halal.",
    ],
    pass: [
      "La certification halal relève de chaque boucherie.",
      "Klik&Go ne certifie pas la viande.",
      "Demandez à votre boucher son organisme certificateur.",
    ],
  },
  verification: {
    match: [
      "Des partenaires vérifiés.",
      "Boucheries vérifiées avant mise en ligne.",
      "Chaque boucherie est vérifiée par notre équipe.",
    ],
    pass: [
      "Vérifiez les horaires de la boutique.",
      "Chaque boucherie gère ses horaires.",
      "Consultez la fiche de la boutique.",
    ],
  },
  "real-time": {
    match: ["Horaires en temps réel.", "Suivi temps-réel de la commande.", "Stock en TEMPS RÉEL."],
    pass: ["Suivez l'état de votre commande.", "Horaires indiqués par chaque boutique."],
  },
  superlative: {
    match: [
      "La première plateforme de click & collect halal.",
      "Plus de 50 boucheries halal référencées.",
      "Plus de 50 recettes halal.",
      "Les boucheries les plus actives du Grand Lyon.",
      "Les meilleures boucheries halal.",
      "Le meilleur boucher de la ville.",
      "Une communauté estimée à 8-10% de la population.",
      "Des centaines de boucheries halal.",
    ],
    pass: [
      "La Savoie compte plus de 430 000 habitants.",
      "Une plateforme de click & collect pour boucheries halal.",
      "Taux de matière grasse : 5% pour les régimes.",
    ],
  },
  "partner-count": {
    match: [
      "3 boucheries déjà inscrites à Lyon.",
      "1 boucherie déjà inscrite à Chambéry.",
      "Des bouchers déjà inscrits.",
    ],
    pass: [
      "Inscrivez votre boucherie.",
      "Les boutiques inscrites sur Klik&Go.",
      "Soyez parmi les premières boucheries de la ville.",
    ],
  },
};

function idsOf(text: string): string[] {
  return findForbiddenClaims(text).map((claim) => claim.id);
}

describe("FORBIDDEN_CLAIMS", () => {
  it("defines exactly the ten rules of the contract, each with a reason", () => {
    expect(FORBIDDEN_CLAIMS.map((claim) => claim.id)).toEqual(EXPECTED_IDS);
    for (const claim of FORBIDDEN_CLAIMS) {
      expect(claim.why.length).toBeGreaterThan(10);
      expect(claim.pattern.flags).toContain("i");
      expect(claim.pattern.flags).not.toContain("g");
    }
  });

  it("has at least two matching and two passing sentences per rule", () => {
    for (const id of EXPECTED_IDS) {
      expect(CASES[id].match.length, id).toBeGreaterThanOrEqual(2);
      expect(CASES[id].pass.length, id).toBeGreaterThanOrEqual(2);
    }
  });

  for (const id of EXPECTED_IDS) {
    describe(id, () => {
      it.each(CASES[id].match)("refuses « %s »", (sentence) => {
        expect(idsOf(sentence)).toContain(id);
      });
      it.each(CASES[id].pass)("accepts « %s »", (sentence) => {
        expect(idsOf(sentence)).not.toContain(id);
      });
    });
  }
});

describe("findForbiddenClaims", () => {
  it("accepts « pas de livraison » and refuses « livraison offerte »", () => {
    expect(findForbiddenClaims("Pas de livraison : retrait en boutique.")).toEqual([]);
    expect(findForbiddenClaims("Livraison offerte")).toEqual([
      { id: "delivery", match: "Livraison" },
    ]);
  });

  it("reports every occurrence with the exact matched text", () => {
    const found = findForbiddenClaims(
      "Payez en ligne, 0,99 € par commande, livraison en 30 min. Livraison offerte."
    );
    expect(found).toEqual([
      { id: "fee-amount", match: "0,99" },
      { id: "online-payment", match: "Payez en ligne" },
      { id: "delivery", match: "livraison" },
      { id: "delivery", match: "Livraison" },
      { id: "pickup-delay", match: "30 min" },
    ]);
  });

  it("is stable across calls (no regular-expression state leaks between texts)", () => {
    const text = "Livraison offerte, livraison rapide.";
    expect(findForbiddenClaims(text)).toHaveLength(2);
    expect(findForbiddenClaims(text)).toHaveLength(2);
    expect(FORBIDDEN_CLAIMS.every((claim) => claim.pattern.lastIndex === 0)).toBe(true);
  });

  it("reads non-breaking spaces and curly apostrophes like plain ones", () => {
    expect(idsOf("Frais : 0,99 €")).toContain("fee-amount");
    expect(idsOf("Une viande 100 % halal")).toContain("certification");
    expect(idsOf("Il n’y a pas de livraison.")).toEqual([]);
  });

  it("returns an empty list for an honest sentence", () => {
    expect(
      findForbiddenClaims(
        "Commandez en ligne, retirez votre commande en boutique au créneau choisi et payez sur place, sans frais de service."
      )
    ).toEqual([]);
  });
});
