// Script to remove halal/boucherie watermarks from product images
// Uses sharp to paint white over the watermark areas
import sharp from "sharp";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const IMG_DIR = "public/img/products";

// All images with watermarks (300x300, white bg, halal badge bottom-left, BOUCHERIE bottom-right)
const WATERMARKED = [
  "bavette-aloyau.jpg", "entrecote-boeuf.jpg", "faux-filet.jpg",
  "steak-hache.jpg", "viande-hachee.jpg", "brochettes-boeuf-marine.jpg",
  "brochettes-boeuf.jpg", "cote-de-boeuf.jpg", "basse-cote.jpg",
  "plat-de-cotes.jpg", "roti-boeuf-extra.jpg", "onglet-boeuf.jpg",
  "tournedos-boeuf.jpg", "rumsteak.jpg", "hampe.jpg", "boeuf-marine.jpg",
  "rond-de-gite.jpg", "kefta-maison.jpg",
  "selle-agneau.jpg", "carre-agneau.jpg", "cotes-agneau-filet.jpg",
  "gigot-agneau.jpg", "epaule-agneau.jpg", "collier-agneau.jpg",
  "poitrine-agneau.jpg", "brochettes-agneau.jpg",
  "poulet-blanc.jpg", "cuisses-poulet.jpg", "filet-poulet.jpg",
  "pilons-poulet.jpg", "poulet-fermier.jpg", "poulet-marine.jpg",
  "poulet-roti.jpg", "ailes-poulet.jpg", "brochettes-poulet-marine.jpg",
  "cuisses-dinde.jpg", "filet-dinde.jpg", "delice-dinde.jpg", "delice-poulet.jpg",
  "merguez.jpg", "chipolatas.jpg", "saucisse-volaille.jpg",
  "saucisses-agneau.jpg", "saucisses-tunisiennes.jpg",
  "roti-veau.jpg", "poitrine-veau.jpg", "jarret-veau.jpg",
  "paupiettes-veau.jpg", "cote-veau-lait.jpg", "noix-veau.jpg",
  "escalope-veau.jpg", "carre-veau.jpg", "tendrons-veau.jpg", "cotes-veau.jpg",
  "pastrami-boeuf.jpg", "bacon-dinde.jpg", "rosette.jpg", "mortadelle.jpg",
];

// White rectangles to paint over watermark areas (on 300x300 images)
// Bottom-left: Halal badge (~65x65 in corner)
// Bottom-right: BOUCHERIE logo (~85x40 in corner)
const patches = [
  // Bottom-left halal badge (full corner)
  { left: 0, top: 215, width: 80, height: 85 },
  // Bottom-right boucherie logo + truck icon
  { left: 195, top: 230, width: 105, height: 70 },
];

async function removeWatermark(filename) {
  const filepath = join(IMG_DIR, filename);

  // Create white rectangles as overlays
  const overlays = patches.map(p => ({
    input: Buffer.from(
      `<svg width="${p.width}" height="${p.height}"><rect width="${p.width}" height="${p.height}" fill="white"/></svg>`
    ),
    top: p.top,
    left: p.left,
  }));

  const result = await sharp(filepath)
    .composite(overlays)
    .jpeg({ quality: 90 })
    .toBuffer();

  writeFileSync(filepath, result);
  console.log(`✓ ${filename}`);
}

console.log(`Processing ${WATERMARKED.length} images...`);

for (const file of WATERMARKED) {
  try {
    await removeWatermark(file);
  } catch (err) {
    console.error(`✗ ${file}: ${err.message}`);
  }
}

console.log("Done!");
