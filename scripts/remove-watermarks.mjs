// Script to remove halal/boucherie watermarks from product images
// Uses stacked blurred SVG ellipses for seamless blending
import sharp from "sharp";
import { writeFileSync } from "fs";
import { join } from "path";

const IMG_DIR = "public/img/products";

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

// 5 stacked blurred ellipses per watermark: wide/faint → tight/opaque
const svg = Buffer.from(`<svg width="300" height="300" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="b1" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="28"/></filter>
    <filter id="b2" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="16"/></filter>
    <filter id="b3" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="8"/></filter>
    <filter id="b4" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="4"/></filter>
  </defs>

  <!-- Bottom-left halal badge -->
  <ellipse cx="22" cy="272" rx="68" ry="55" fill="white" filter="url(#b1)"/>
  <ellipse cx="22" cy="273" rx="55" ry="44" fill="white" filter="url(#b2)"/>
  <ellipse cx="22" cy="274" rx="44" ry="36" fill="white" filter="url(#b3)"/>
  <ellipse cx="22" cy="276" rx="35" ry="28" fill="white" filter="url(#b4)"/>
  <ellipse cx="22" cy="278" rx="28" ry="22" fill="white"/>

  <!-- Bottom-right BOUCHERIE -->
  <ellipse cx="262" cy="272" rx="68" ry="50" fill="white" filter="url(#b1)"/>
  <ellipse cx="264" cy="273" rx="55" ry="40" fill="white" filter="url(#b2)"/>
  <ellipse cx="266" cy="274" rx="44" ry="32" fill="white" filter="url(#b3)"/>
  <ellipse cx="268" cy="276" rx="35" ry="26" fill="white" filter="url(#b4)"/>
  <ellipse cx="270" cy="278" rx="28" ry="20" fill="white"/>
</svg>`);

console.log(`Processing ${WATERMARKED.length} images...`);

for (const file of WATERMARKED) {
  try {
    const filepath = join(IMG_DIR, file);
    const buf = await sharp(filepath)
      .composite([{ input: svg, top: 0, left: 0 }])
      .jpeg({ quality: 92 })
      .toBuffer();
    writeFileSync(filepath, buf);
    console.log(`✓ ${file}`);
  } catch (err) {
    console.error(`✗ ${file}: ${err.message}`);
  }
}

console.log("Done!");
