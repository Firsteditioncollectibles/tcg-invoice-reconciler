import type { Worker, Page } from "tesseract.js";
import { marketplaceTable, marketplacePrices, type TextPage } from "./layout";
export type Extraction = {
  text: string;
  pages: number;
  method: string;
  warnings: string[];
  layout: TextPage[];
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
export function ocrLayout(data: Page, width: number, height: number): TextPage {
  const words =
    data.blocks?.flatMap((b) =>
      b.paragraphs.flatMap((p) => p.lines.flatMap((l) => l.words)),
    ) ?? [];
  return {
    width,
    height,
    boxes: words.map((w) => ({
      text: w.text,
      x: w.bbox.x0,
      y: w.bbox.y0,
      width: w.bbox.x1 - w.bbox.x0,
      height: w.bbox.y1 - w.bbox.y0,
    })),
  };
}
function layoutText(page: TextPage) {
  return textInReadingOrder(
    page.boxes.map((b) => ({
      str: b.text,
      transform: [1, 0, 0, 1, b.x, -(b.y + b.height / 2)],
      width: b.width,
      height: b.height,
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
        tessedit_pageseg_mode: PSM.SPARSE_TEXT,
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
    const layout = ocrLayout(result.data, image.width, image.height);
    const table = marketplaceTable(layout);
    if (table) {
      // Thin table rules and isolated "1" digits defeat whole-page OCR. Read each
      // quantity cell separately, using the matching price's vertical position.
      const prices = marketplacePrices(layout, table);
      const { PSM } = await import("tesseract.js");
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_LINE,
        tessedit_char_whitelist: "0123456789",
      });
      const quantities: TextPage["boxes"] = [];
      for (const [index, price] of prices.entries()) {
        check();
        onProgress(`Reading quantity ${index + 1} of ${prices.length}…`);
        const center = price.y + price.height / 2;
        const radius = Math.max(price.height, table.height) * 1.2;
        const top = Math.max(0, Math.floor(center - radius));
        const left = Math.max(0, Math.floor(table.qty + table.height * 0.3));
        const cell = await Promise.race([
          worker.recognize(
            image,
            {
              rectangle: {
                left,
                top,
                width: Math.max(1, image.width - left - 8),
                height: Math.min(image.height - top, Math.ceil(radius * 2)),
              },
            },
            { text: true, blocks: true },
          ),
          stopped,
        ]);
        const value = cell.data.text.trim();
        if (/^\d{1,4}$/.test(value))
          quantities.push({
            text: value,
            x: left,
            y: center - price.height / 2,
            width: table.height,
            height: price.height,
          });
      }
      layout.boxes = [
        ...layout.boxes.filter((b) => !(b.x >= table.qty && b.y > table.top)),
        ...quantities,
      ];
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SPARSE_TEXT,
        tessedit_char_whitelist: "",
      });
    }
    return {
      ...result.data,
      text: layout.boxes.length ? layoutText(layout) : result.data.text,
      layout,
    };
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
      const layout: TextPage[] = [];
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
        if (text.replace(/\s/g, "").length >= 50 && /\d[.,]\d{2}/.test(text)) {
          texts.push(text);
          const viewport = page.getViewport({ scale: 1 });
          layout.push({
            width: viewport.width,
            height: viewport.height,
            boxes: content.items
              .filter((i): i is PositionedText & typeof i => "str" in i)
              .map((i) => {
                const transform = pdfjs.Util.transform(
                  viewport.transform,
                  i.transform,
                );
                return {
                  text: i.str,
                  x: transform[4],
                  y: transform[5] - i.height,
                  width: i.width,
                  height: i.height,
                };
              }),
          });
        } else {
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
          layout.push(result.layout);
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
        layout,
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
    return {
      text: result.text,
      pages: 1,
      method: "Image OCR",
      warnings,
      layout: [result.layout],
    };
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener("abort", cancel);
    await worker?.terminate();
    await pdfTask?.destroy();
  }
}
