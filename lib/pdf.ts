import { jsPDF } from "jspdf";
import { orderSheets, ORDER_WIDTH } from "./document-layout";
import { DISCLOSURE, totals, type Invoice } from "./invoice";
export { pdfFileName } from "./filenames";

export async function createReconciledPdf(
  invoice: Invoice,
  fonts?: { regular: Uint8Array; bold: Uint8Array },
): Promise<jsPDF> {
  const t = totals(invoice);
  if (!t.valid || !invoice.items.length || !invoice.orderNumber.trim())
    throw new Error(
      "Enter the order number and correct missing item details or invalid amounts before exporting.",
    );
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const loadFont = async (name: string) => {
    const response = await fetch(
      `/vendor/standard_fonts/LiberationSans-${name}.ttf`,
    );
    if (!response.ok)
      throw new Error("Could not load the PDF font. Try exporting again.");
    return new Uint8Array(await response.arrayBuffer());
  };
  const loaded = fonts ?? {
    regular: await loadFont("Regular"),
    bold: await loadFont("Bold"),
  };
  const base64 = (bytes: Uint8Array) => {
    let result = "";
    for (let i = 0; i < bytes.length; i += 8192)
      result += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(result);
  };
  doc.addFileToVFS("LiberationSans-Regular.ttf", base64(loaded.regular));
  doc.addFileToVFS("LiberationSans-Bold.ttf", base64(loaded.bold));
  doc.addFont("LiberationSans-Regular.ttf", "LiberationSans", "normal");
  doc.addFont("LiberationSans-Bold.ttf", "LiberationSans", "bold");
  doc.setProperties({
    title: `Reconciled TCGplayer order ${invoice.orderNumber}`,
    author: "Buyer-prepared reconciliation",
    subject: DISCLOSURE,
    creator: "TCG Invoice Reconciler",
  });
  const exportedText = [
    invoice.orderNumber,
    invoice.orderDate,
    invoice.channel,
    invoice.billingRecipient,
    invoice.billingAddress,
    invoice.tracking,
    invoice.shippingMethod,
    invoice.taxLabel,
    invoice.seller,
    invoice.recipient,
    invoice.address,
    invoice.reference,
    invoice.notes,
    ...invoice.items.flatMap((i) => [
      i.description,
      i.setName,
      i.rarity,
      i.details,
      i.seller,
    ]),
  ].join("");
  if (
    /[^\x09\x0A\x0D\x20-\x7E\u00A0-\u00FF\u2013\u2014\u2018\u2019\u201C\u201D]/.test(
      exportedText,
    )
  )
    throw new Error(
      "PDF export currently supports English and Latin accented text. Replace unsupported symbols in the document before exporting.",
    );
  const scale = 595.28 / ORDER_WIDTH;
  const sheets = orderSheets(
    invoice,
    (value, bold = false) => {
      doc.setFont("LiberationSans", bold ? "bold" : "normal");
      doc.setFontSize(22 * scale);
      return doc.getTextWidth(value) / scale;
    },
    true,
  );
  doc.deletePage(1);
  for (const sheet of sheets) {
    doc.addPage(
      [sheet.width * scale, sheet.height * scale],
      sheet.width > sheet.height ? "landscape" : "portrait",
    );
    for (const r of sheet.rects) {
      if (r.fill !== "none") doc.setFillColor(r.fill);
      if (r.stroke) doc.setDrawColor(r.stroke);
      doc.setLineWidth((r.strokeWidth ?? 0) * scale);
      const style = r.fill === "none" ? "S" : r.stroke ? "FD" : "F";
      if (r.radius)
        doc.roundedRect(
          r.x * scale,
          r.y * scale,
          r.width * scale,
          r.height * scale,
          r.radius * scale,
          r.radius * scale,
          style,
        );
      else
        doc.rect(
          r.x * scale,
          r.y * scale,
          r.width * scale,
          r.height * scale,
          style,
        );
    }
    for (const image of sheet.images)
      doc.addImage(
        image.src,
        image.src.startsWith("data:image/jpeg") ? "JPEG" : "PNG",
        image.x * scale,
        image.y * scale,
        image.width * scale,
        image.height * scale,
      );
    for (const run of sheet.texts) {
      doc.setFont("LiberationSans", run.bold ? "bold" : "normal");
      doc.setFontSize(run.size * scale);
      doc.setTextColor(run.color);
      doc.text(run.text, run.x * scale, run.y * scale, {
        align: run.align ?? "left",
      });
    }
  }
  return doc;
}
