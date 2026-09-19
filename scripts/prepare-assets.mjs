import { mkdir, copyFile, readdir, cp } from "node:fs/promises";
import { join } from "node:path";
const root = new URL("../", import.meta.url).pathname;
const modules = join(root, "node_modules");
const out = join(root, "public/vendor");
await mkdir(out, { recursive: true });
await mkdir(join(out, "ocr"), { recursive: true });
await copyFile(
  join(modules, "pdfjs-dist/build/pdf.worker.min.mjs"),
  join(out, "pdf.worker.min.mjs"),
);
await cp(
  join(modules, "pdfjs-dist/standard_fonts"),
  join(out, "standard_fonts"),
  { recursive: true },
);
await cp(join(modules, "pdfjs-dist/cmaps"), join(out, "cmaps"), {
  recursive: true,
});
await cp(join(modules, "pdfjs-dist/wasm"), join(out, "wasm"), {
  recursive: true,
});
await copyFile(
  join(modules, "tesseract.js/dist/worker.min.js"),
  join(out, "ocr/worker.min.js"),
);
for (const file of await readdir(join(modules, "tesseract.js-core"))) {
  if (/\.wasm(?:\.js)?$/.test(file))
    await copyFile(
      join(modules, "tesseract.js-core", file),
      join(out, "ocr", file),
    );
}
await copyFile(
  join(modules, "@tesseract.js-data/eng/4.0.0/eng.traineddata.gz"),
  join(out, "ocr/eng.traineddata.gz"),
);
console.log(
  "PDF and OCR assets prepared locally. No third-party requests are required.",
);
