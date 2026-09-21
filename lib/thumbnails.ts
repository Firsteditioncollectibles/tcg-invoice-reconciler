import { marketplaceRows, marketplaceTable, type TextPage } from "./layout";

/** Keep the actual card pictures from the uploaded page; never fetch substitutes. */
export function captureThumbnails(canvas: HTMLCanvasElement, page: TextPage) {
  const table = marketplaceTable(page);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!table || !context) return;
  const scale = canvas.width / page.width;
  const unit = (table.details - table.left) / 490;
  page.thumbnails = [];
  for (const row of marketplaceRows(page, table)) {
    const left = Math.max(0, Math.floor((table.left + 6 * unit) * scale));
    const top = Math.max(
      0,
      Math.floor(Math.max(row.top, row.center - 42 * unit) * scale),
    );
    const width = Math.min(canvas.width - left, Math.ceil(61 * unit * scale));
    const height = Math.min(
      canvas.height - top,
      Math.ceil(Math.min(row.bottom, row.center + 42 * unit) * scale - top),
    );
    if (width < 2 || height < 2) continue;
    const pixels = context.getImageData(left, top, width, height).data;
    let x0 = width,
      y0 = height,
      x1 = -1,
      y1 = -1;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const hi = Math.max(pixels[i], pixels[i + 1], pixels[i + 2]);
        const lo = Math.min(pixels[i], pixels[i + 1], pixels[i + 2]);
        if (hi - lo > 12 && lo < 230 && pixels[i + 3] > 200) {
          x0 = Math.min(x0, x);
          x1 = Math.max(x1, x);
          y0 = Math.min(y0, y);
          y1 = Math.max(y1, y);
        }
      }
    if (x1 - x0 < 12 * unit * scale || y1 - y0 < 20 * unit * scale) continue;
    x0 = Math.max(0, x0 - 1);
    y0 = Math.max(0, y0 - 1);
    x1 = Math.min(width - 1, x1 + 1);
    y1 = Math.min(height - 1, y1 + 1);
    const crop = document.createElement("canvas");
    const reduce = Math.min(1, 100 / (x1 - x0 + 1), 140 / (y1 - y0 + 1));
    crop.width = Math.ceil((x1 - x0 + 1) * reduce);
    crop.height = Math.ceil((y1 - y0 + 1) * reduce);
    crop
      .getContext("2d")!
      .drawImage(
        canvas,
        left + x0,
        top + y0,
        x1 - x0 + 1,
        y1 - y0 + 1,
        0,
        0,
        crop.width,
        crop.height,
      );
    page.thumbnails.push({
      center: row.center,
      dataUrl: crop.toDataURL("image/png"),
    });
    crop.width = 0;
    crop.height = 0;
  }
}
