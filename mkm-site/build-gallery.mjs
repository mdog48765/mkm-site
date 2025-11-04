// scripts/build-gallery.mjs
import fs from "fs-extra";
import path from "path";
import { globSync } from "glob";       // ← use v10 API
import sharp from "sharp";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "public", "gallery-src");
const OUT = path.join(ROOT, "public", "gallery");
const DATA = path.join(ROOT, "src", "galleryList.json");

// cache-busting
const VERSION = Date.now();

(async () => {
  console.log("🧩 MKM Gallery Builder");
  console.log("ROOT:", ROOT);
  console.log("SRC :", SRC);
  console.log("OUT :", OUT);
  console.log("DATA:", DATA);

  await fs.ensureDir(SRC);
  await fs.ensureDir(OUT);
  await fs.emptyDir(OUT);

 const files = globSync(path.resolve(SRC, '*.{jpg,jpeg,png,webp}').replace(/\\/g, '/'), {
  nocase: true,
});

  console.log(`Found ${files.length} source image(s)`);

  if (files.length === 0) {
    console.log("⚠️  No input images found in public/gallery-src. Add images and re-run.");
    await fs.writeJSON(DATA, [], { spaces: 2 });
    return;
  }

  const entries = [];
  let i = 1;

  for (const file of files) {
    const base = `event${i++}`;
    const jpgOut = path.join(OUT, `${base}.jpg`);
    const webpOut = path.join(OUT, `${base}.webp`);

    console.log(`→ Processing: ${path.basename(file)}  ->  ${path.basename(jpgOut)}, ${path.basename(webpOut)}`);

    const img = sharp(file).rotate();
    const pipeline = img.resize({ width: 1920, height: 1080, fit: "cover" });

    await pipeline.jpeg({ quality: 90, progressive: true }).toFile(jpgOut);
    await pipeline.webp({ quality: 90 }).toFile(webpOut);

    entries.push({
      jpg: `/gallery/${base}.jpg?v=${VERSION}`,
      webp: `/gallery/${base}.webp?v=${VERSION}`,
    });
  }

  await fs.writeJSON(DATA, entries, { spaces: 2 });
  console.log(`✅ Gallery built: ${entries.length} image(s)`);
  console.log(`✅ Wrote list to: ${DATA}`);
})();
