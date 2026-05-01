// scripts/fix-recipe-images-v2.ts — Smart recipe image matching by keywords
// Run : DATABASE_URL=... npx tsx scripts/fix-recipe-images-v2.ts
//
// Probleme : v1 utilisait round-robin par meatType => Bourguignon recevait
// "kefta-grillee.jpg" (n'a rien a voir). Carre d'agneau recevait "tajine".
//
// Fix : matching par mots-cles dans le titre, ordre de priorite specifique
// -> generique. Les 8 images locales sont reutilisees mais au moins jamais
// semantiquement absurdes.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const IMG = {
  brochettesMerguez: "/img/recipes/brochettes-merguez.jpg",
  couscousRoyal: "/img/recipes/couscous-royal.jpg",
  emincesPoulet: "/img/recipes/eminces-poulet.jpg",
  epauleAgneau: "/img/recipes/epaule-agneau.jpg",
  keftaGrillee: "/img/recipes/kefta-grillee.jpg",
  shawarmaPoulet: "/img/recipes/shawarma-poulet.jpg",
  tajineAgneau: "/img/recipes/tajine-agneau.jpg",
  wokBoeuf: "/img/recipes/wok-boeuf.jpg",
} as const;

// Ordre = priorite. Premier match gagne.
const RULES: { match: RegExp; img: string }[] = [
  // === Plats specifiques (haute priorite) ===
  { match: /tajine|mijote|mijote|ragout|ragout|blanquette|bourguignon|curry/i, img: IMG.tajineAgneau },
  { match: /couscous/i, img: IMG.couscousRoyal },
  { match: /shawarma|chawarma/i, img: IMG.shawarmaPoulet },
  { match: /wok|saute|saute|teriyaki/i, img: IMG.wokBoeuf },
  { match: /merguez/i, img: IMG.brochettesMerguez },
  { match: /kefta|boulette/i, img: IMG.keftaGrillee },
  { match: /brochette|bbq|grillee?s?/i, img: IMG.brochettesMerguez },

  // === Coupes specifiques ===
  { match: /gigot|carre d|carre d|epaule|epaule|cotelette|cotelette/i, img: IMG.epauleAgneau },
  { match: /entrecote|entrecote|steak|cote de boeuf|cote de boeuf/i, img: IMG.wokBoeuf },
  { match: /escalope.*poulet|escalope.*volaille|cuisses?.*poulet|poulet.*roti|poulet.*lacque|poulet.*grille|poulet.*marine/i, img: IMG.shawarmaPoulet },
  { match: /eminces?.*poulet|poulet.*saute|poulet.*ananas/i, img: IMG.emincesPoulet },
  { match: /escalope.*veau|cote.*veau|cotes.*veau/i, img: IMG.keftaGrillee },

  // === Type de viande generique (fallback) ===
  { match: /agneau/i, img: IMG.tajineAgneau },
  { match: /poulet|volaille/i, img: IMG.shawarmaPoulet },
  { match: /veau/i, img: IMG.keftaGrillee },
  { match: /boeuf|boeuf|rouleaux de printemps/i, img: IMG.wokBoeuf },
];

function pickImage(title: string, meatType: string): string {
  for (const rule of RULES) {
    if (rule.match.test(title)) return rule.img;
  }
  // Ultime fallback par meatType
  switch (meatType.toLowerCase()) {
    case "agneau": return IMG.tajineAgneau;
    case "poulet": case "volaille": return IMG.shawarmaPoulet;
    case "veau": return IMG.keftaGrillee;
    default: return IMG.wokBoeuf;
  }
}

async function main() {
  const recipes = await prisma.recipe.findMany({
    select: { id: true, slug: true, title: true, imageUrl: true, meatType: true },
    orderBy: { title: "asc" },
  });

  console.log(`Found ${recipes.length} recipes\n`);
  let updated = 0;

  for (const r of recipes) {
    const newUrl = pickImage(r.title, r.meatType || "");
    if (r.imageUrl !== newUrl) {
      await prisma.recipe.update({ where: { id: r.id }, data: { imageUrl: newUrl } });
      const old = r.imageUrl?.split("/").pop() || "null";
      const nu = newUrl.split("/").pop();
      console.log(`UPDATED ${r.title.slice(0, 60).padEnd(60)} ${old} -> ${nu}`);
      updated++;
    } else {
      console.log(`KEEP    ${r.title.slice(0, 60)}`);
    }
  }

  console.log(`\nDone : ${updated}/${recipes.length} updated`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
