import type { Worker, Page } from "tesseract.js";
export type Extraction = {
  text: string;
  pages: number;
  method: string;
  warnings: string[];
};
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_PAGES = 20;
export function validateFile(file: Pick<File, "name" | "size" | "type">) {
  if (!file.size)
    throw new Error("This file is empty. Choose a screenshot or PDF.");
  if (file.size > MAX_FILE_BYTES)
    throw new Error("Choose a file smaller than 20 MB.");
  if (!/\.(pdf|png|jpe?g|webp)$/i.test(file.name))
    throw new Error("Use a PDF, PNG, JPG or WebP file.");
}
type PositionedText = {
  str: string;
  transform: number[];
  width: number;
  height: number;
};
// PDF content order is not necessarily reading order: group by baseline before sorting left to right.
export function textInReadingOrder(items: PositionedText[]): string {
  const rows: { y: number; height: number; items: PositionedText[] }[] = [];
  for (const item of [...items].sort(
    (a, b) => b.transform[5] - a.transform[5],
  )) {
    if (!item.str.trim()) continue;
    const y = item.transform[5];
    const row = rows.find(
      (r) =>
        Math.abs(r.y - y) <=
        Math.max(2, Math.min(r.height, item.height) * 0.35),
    );
    if (row) row.items.push(item);
    else rows.push({ y, height: item.height || 10, items: [item] });
  }
  return rows
    .map((r) =>
      r.items
        .sort((a, b) => a.transform[4] - b.transform[4])
        .map((i) => i.str)
        .join("  "),
    )
    .join("\n");
}
function ocrInReadingOrder(data: Page): string {
  const words =
    data.blocks?.flatMap((b) =>
      b.paragraphs.flatMap((p) => p.lines.flatMap((l) => l.words)),
    ) ?? [];
  if (!words.length) return data.text;
  // OCR's automatic layout can read the entire description column before the price column.
  // Rejoin words at their visual baseline to keep each card attached to its own price.
  return textInReadingOrder(
    words.map((w) => ({
      str: w.text,
      transform: [1, 0, 0, 1, w.bbox.x0, -(w.bbox.y0 + w.bbox.y1) / 2],
      width: w.bbox.x1 - w.bbox.x0,
      height: w.bbox.y1 - w.bbox.y0,
    })),
  );
}
export async function extractFile(
  file: File,
  onProgress: (message: string) => void,
  signal: AbortSignal,
): Promise<Extraction> {
  validateFile(file);
  let worker: Worker | undefined;
  let workerFailure: ((reason: Error) => void) | undefined;
  let workerError: Error | undefined;
  let rejectStopped: (reason: Error) => void = () => {};
  const stopped = new Promise<never>((_, reject) => {
    rejectStopped = reject;
  });
  // A cancellation can precede the first raced OCR operation.
  void stopped.catch(() => {});
  const timeout = setTimeout(() => {
    workerError = new Error(
      "Scanning took too long. Try a smaller or clearer file, or paste the order text.",
    );
    rejectStopped(workerError);
    void worker?.terminate();
    void pdfTask?.destroy();
  }, 120_000);
  let pdfTask: import("pdfjs-dist").PDFDocumentLoadingTask | undefined;
  const check = () => {
    if (signal.aborted)
      throw new DOMException("Import cancelled.", "AbortError");
  };
  const cancel = () => {
    const reason = new DOMException("Import cancelled.", "AbortError");
    rejectStopped(reason);
    void worker?.terminate();
    void pdfTask?.destroy();
    workerFailure?.(reason);
  };
  signal.addEventListener("abort", cancel, { once: true });
  const ocr = async (image: HTMLCanvasElement) => {
    check();
    if (!worker) {
      onProgress("Loading the local text scanner…");
      const { createWorker, PSM } = await import("tesseract.js");
      const base = window.location.origin + "/vendor/ocr";
      const initialization = createWorker("eng", 1, {
        workerPath: `${base}/worker.min.js`,
        corePath: base,
        langPath: base,
        workerBlobURL: false,
        logger: (m) => {
          if (!signal.aborted && m.status === "recognizing text")
            onProgress(`Reading text… ${Math.round(m.progress * 100)}%`);
        },
        errorHandler: (e) => {
          workerError = new Error(
            typeof e === "string"
              ? e
              : "The text scanner could not read this file.",
          );
          rejectStopped(workerError);
          workerFailure?.(workerError);
        },
      });
      void initialization
        .then((w) => {
          if (signal.aborted || workerError) void w.terminate();
        })
        .catch(() => {});
      worker = await Promise.race([initialization, stopped]);
      check();
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.AUTO,
        preserve_interword_spaces: "1",
      });
    }
    check();
    if (workerError) throw workerError;
    const result = await Promise.race([
      worker.recognize(image, {}, { text: true, blocks: true }),
      stopped,
      new Promise<never>((_, reject) => {
        workerFailure = reject;
      }),
    ]);
    workerFailure = undefined;
    check();
    return { ...result.data, text: ocrInReadingOrder(result.data) };
  };
  const warnings: string[] = [];
  try {
    check();
    if (/\.pdf$/i.test(file.name)) {
      onProgress("Opening PDF…");
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdf.worker.min.mjs";
      pdfTask = pdfjs.getDocument({
        data: new Uint8Array(await file.arrayBuffer()),
        standardFontDataUrl: "/vendor/standard_fonts/",
        cMapUrl: "/vendor/cmaps/",
        cMapPacked: true,
        wasmUrl: "/vendor/wasm/",
      });
      const pdf = await Promise.race([pdfTask.promise, stopped]);
      if (pdf.numPages > MAX_PAGES)
        throw new Error(
          "Import up to 20 PDF pages at a time. Split this PDF into smaller files.",
        );
      const texts: string[] = [];
      let scanned = 0;
      for (let n = 1; n <= pdf.numPages; n++) {
        check();
        onProgress(`Reading PDF page ${n} of ${pdf.numPages}…`);
        const page = await pdf.getPage(n);
        const content = await page.getTextContent();
        const text = textInReadingOrder(
          content.items.filter(
            (i): i is PositionedText & typeof i => "str" in i,
          ),
        );
        // Text-only headers on otherwise scanned pages must not suppress OCR of the card table.
        if (text.replace(/\s/g, "").length >= 50 && /\d[.,]\d{2}/.test(text))
          texts.push(text);
        else {
          const natural = page.getViewport({ scale: 1 });
          const scale = Math.min(
            2.5,
            3500 / Math.max(natural.width, natural.height),
            Math.sqrt(12_000_000 / (natural.width * natural.height)),
          );
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          await Promise.race([
            page.render({ canvas, viewport }).promise,
            stopped,
          ]);
          const result = await ocr(canvas);
          texts.push(result.text);
          scanned++;
          if (result.confidence < 80)
            warnings.push(
              `Page ${n} has low OCR confidence. Check it carefully against the source.`,
            );
          canvas.width = 0;
          canvas.height = 0;
        }
        page.cleanup();
      }
      const text = texts.join("\n\n");
      if (!text.trim())
        throw new Error(
          "No readable text was found. Try a clearer, upright screenshot.",
        );
      return {
        text,
        pages: pdf.numPages,
        method: scanned ? "PDF + OCR" : "PDF text",
        warnings,
      };
    }
    const bitmap = await createImageBitmap(file);
    if (bitmap.width * bitmap.height > 40_000_000) {
      bitmap.close();
      throw new Error(
        "Image resolution is too large. Use an image below 40 megapixels.",
      );
    }
    const scale = Math.min(
      Math.max(1, 1800 / bitmap.width),
      3500 / Math.max(bitmap.width, bitmap.height),
      Math.sqrt(12_000_000 / (bitmap.width * bitmap.height)),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(bitmap.width * scale);
    canvas.height = Math.ceil(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser could not open this image.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const result = await ocr(canvas);
    canvas.width = 0;
    canvas.height = 0;
    if (!result.text.trim())
      throw new Error(
        "No readable text was found. Try a clearer, upright screenshot.",
      );
    if (result.confidence < 80)
      warnings.push("Low OCR confidence. Check every line against the source.");
    return { text: result.text, pages: 1, method: "Image OCR", warnings };
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener("abort", cancel);
    await worker?.terminate();
    await pdfTask?.destroy();
  }
}
