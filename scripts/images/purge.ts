// scripts/images/purge.ts — Effacer tout de suite une image de notre stockage (retrait sur demande :
// une personne dans le cadre, une photo sans droits). Essai à blanc par défaut.
//
//   npx tsx scripts/images/purge.ts <url>            # montre qui l'utilise et ce qui serait effacé
//   npx tsx scripts/images/purge.ts <url> --apply    # efface la photo, sa vignette et ses lignes du registre
//
// Refusé tant qu'une colonne d'image de la base l'utilise (le recensement liste ces lignes : les
// changer d'abord). --apply suit la même règle que repair.ts : BLOB_READ_WRITE_TOKEN exporté, ou
// base locale avec le stockage sur disque. Les copies optimisées par Vercel (/_next/image) restent en
// cache : la commande Vercel à lancer ensuite est affichée. Procédure : docs/photos.md.
import prisma from "@/lib/prisma";
import { runImageCensus } from "@/lib/images/census";
import { planPurge, purgeImage } from "@/lib/images/maintenance";
import { applyRefusal } from "@/lib/images/repair-plan";
import { getImageStore } from "@/lib/images/store";
import {
  describeDatabase,
  out,
  parseArgs,
  requireDatabaseUrl,
  runScript,
  UsageError,
} from "./shared";

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2), { flags: ["--apply"], options: [] });
  if (args.positionals.length !== 1) {
    throw new UsageError("Usage : npx tsx scripts/images/purge.ts <url de l'image> [--apply]");
  }
  const [url] = args.positionals;
  const databaseUrl = requireDatabaseUrl();
  const apply = args.flags.has("--apply");
  out(`Base : ${describeDatabase(databaseUrl)} — ${apply ? "ÉCRITURE" : "essai à blanc"}`);

  const plan = await planPurge(url);
  out(`Fichiers : ${plan.files.join(" , ")}`);
  out(`Lignes du registre generated_images : ${plan.registryRows}`);
  out(`Lignes de la base qui l'utilisent : ${plan.references.otherUses}`);
  if (plan.references.otherUses > 0) {
    const { rows } = await runImageCensus(prisma);
    const uses = rows.filter(
      (row) => row.table !== "generated_images" && plan.files.includes(row.value)
    );
    for (const row of uses) {
      out(
        `  ${row.table}.${row.column} ${row.id} ${row.shopSlug ?? "-"} ${row.label ?? ""}`.trimEnd()
      );
    }
  }
  if (plan.refusal !== null) throw new UsageError(`Effacement refusé : ${plan.refusal}`);
  if (!apply) {
    out("\nEssai à blanc : rien n'a été effacé. Pour effacer : relancez avec --apply.");
    return;
  }

  const store = getImageStore();
  const refusal = applyRefusal(store.kind, databaseUrl);
  if (refusal !== null) throw new UsageError(refusal);
  const result = await purgeImage(url, store);
  out(`\nEffacé : ${result.files.length} fichier(s), ${result.deletedRows} ligne(s) du registre.`);
  if (store.kind !== "blob") return;
  out("Le stockage peut encore servir le fichier jusqu'à une minute (cache de Vercel Blob).");
  out(
    "Copies optimisées par Vercel : depuis la racine du dépôt lié au projet (vercel link), lancez"
  );
  for (const file of result.files)
    out(`  vercel cache dangerously-delete --srcimg "${file}" --yes`);
  out(
    "(« vercel cache invalidate --srcimg <url> » ne suffit pas pour un retrait : il sert encore la copie une fois.)"
  );
}

runScript(main);
