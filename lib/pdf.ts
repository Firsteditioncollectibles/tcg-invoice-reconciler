import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { DISCLOSURE, cents, money, totals, type Invoice } from "./invoice";

export async function createReconciledPdf(
  invoice: Invoice,
  fonts?: { regular: Uint8Array; bold: Uint8Array },
): Promise<jsPDF> {
  const t = totals(invoice);
  if (
    !t.valid ||
    !invoice.items.length ||
    !invoice.orderNumber.trim() ||
    invoice.items.some((i) => !i.reviewed)
  )
    throw new Error(
      "Review all line items, enter the order number and correct invalid amounts before exporting.",
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
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = 38;
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
  const normal = (value: string) =>
    value.replace(/[–—]/g, "-").replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
  const header = () => {
    doc.setFillColor(20, 44, 74);
    doc.rect(0, 0, width, 8, "F");
    doc.setFont("LiberationSans", "bold");
    doc.setFontSize(19);
    doc.setTextColor(20, 44, 74);
    doc.text("TCGplayer order", margin, 42);
    doc.setFontSize(10);
    doc.setTextColor(67, 86, 107);
    doc.text("RECONCILED SHIPMENT DOCUMENT", margin, 61);
    doc.setFont("LiberationSans", "normal");
    doc.setFontSize(8);
    doc.setTextColor(70);
    doc.text(DISCLOSURE, margin, 78);
  };
  const footer = () => {
    doc.setDrawColor(213, 221, 230);
    doc.line(margin, height - 42, width - margin, height - 42);
    doc.setFont("LiberationSans", "normal");
    doc.setTextColor(86);
    doc.setFontSize(7);
    doc.text(
      "Buyer-prepared reconciliation. Not a seller-issued invoice.",
      margin,
      height - 29,
    );
    doc.text(
      `Page ${doc.getCurrentPageInfo().pageNumber}`,
      width - margin,
      height - 29,
      { align: "right" },
    );
  };
  const after = () =>
    (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  autoTable(doc, {
    startY: 94,
    theme: "grid",
    margin: { left: margin, right: margin, top: 94, bottom: 55 },
    styles: {
      font: "LiberationSans",
      fontSize: 8,
      cellPadding: 7,
      overflow: "linebreak",
      textColor: [65, 70, 78],
      lineColor: [215, 215, 215],
      lineWidth: 0.4,
    },
    body: [
      [
        `ORDER DATE\n${normal(invoice.orderDate) || "Not specified"}`,
        `CHANNEL\n${normal(invoice.channel || "TCG Marketplace")}`,
        `ORDER NUMBER\n${normal(invoice.orderNumber)}`,
      ],
    ],
  });
  autoTable(doc, {
    startY: after(),
    theme: "grid",
    margin: { left: margin, right: margin, top: 94, bottom: 55 },
    styles: {
      font: "LiberationSans",
      fontSize: 8,
      cellPadding: 7,
      overflow: "linebreak",
      textColor: [65, 70, 78],
      lineColor: [225, 225, 225],
      lineWidth: 0.3,
      valign: "top",
    },
    columnStyles: {
      0: { cellWidth: 120 },
      1: { cellWidth: 130 },
      2: { cellWidth: 125 },
      3: { cellWidth: width - 2 * margin - 375 },
    },
    body: [
      [
        `ORDER SUMMARY\nQuantity: ${t.count}\nSubtotal: ${money(t.subtotal)}\nShipping: ${money(t.shipping!)}\nSales tax: ${money(t.tax!)}\nDiscount: -${money(t.discount!)}\nTotal: ${money(t.total)}`,
        normal(
          `SHIP TO\n${invoice.recipient || "Not specified"}\n${invoice.address}\n${invoice.reference ? "Package: " + invoice.reference : ""}`,
        ),
        normal(
          `BILL TO\n${invoice.billingRecipient || "Not specified"}\n${invoice.billingAddress || ""}`,
        ),
        normal(
          `SHIPPED AND SOLD BY\n${invoice.seller || "See line items"}\n${invoice.tracking ? "Tracking: " + invoice.tracking : ""}\n${invoice.shippingMethod || ""}`,
        ),
      ],
    ],
  });
  const differentSellers =
    new Set(invoice.items.map((i) => i.seller).filter(Boolean)).size > 1;
  autoTable(doc, {
    startY: after() + 18,
    margin: { top: 96, left: margin, right: margin, bottom: 55 },
    head: [["ITEMS", "DETAILS", "PRICE", "QUANTITY"]],
    body: invoice.items.map((i) => [
      normal([i.description, i.setName].filter(Boolean).join("\n")),
      normal(
        [
          i.rarity ? `Rarity: ${i.rarity}` : "",
          i.details ? `Condition: ${i.details}` : "",
          i.seller && (differentSellers || i.seller !== invoice.seller)
            ? `Seller: ${i.seller}`
            : "",
        ]
          .filter(Boolean)
          .join("\n"),
      ),
      money(cents(i.unitPrice)!),
      i.quantity,
    ]),
    theme: "grid",
    styles: {
      font: "LiberationSans",
      fontSize: 8,
      cellPadding: 7,
      lineColor: [220, 226, 233],
      lineWidth: 0.4,
      overflow: "linebreak",
      textColor: [35, 49, 63],
    },
    headStyles: {
      fillColor: [237, 237, 237],
      textColor: [75, 75, 75],
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [246, 248, 251] },
    columnStyles: {
      0: { cellWidth: width - 2 * margin - 288 },
      1: { cellWidth: 164 },
      2: { cellWidth: 65, halign: "right", valign: "middle" },
      3: { cellWidth: 59, halign: "center", valign: "middle" },
    },
    rowPageBreak: "avoid",
  });
  autoTable(doc, {
    startY: after() + 10,
    margin: { left: width - margin - 236, right: margin, top: 96, bottom: 55 },
    theme: "plain",
    styles: {
      font: "LiberationSans",
      fontSize: 10,
      cellPadding: 6,
      fontStyle: "bold",
      fillColor: [235, 241, 249],
    },
    columnStyles: {
      0: { cellWidth: 145 },
      1: { cellWidth: 91, halign: "right" },
    },
    body: [["Reconciled total (USD)", money(t.total)]],
  });
  if (invoice.notes.trim())
    autoTable(doc, {
      startY: after() + 20,
      margin: { left: margin, right: margin, top: 96, bottom: 55 },
      head: [["RECONCILIATION NOTES"]],
      body: [[normal(invoice.notes)]],
      theme: "plain",
      styles: { font: "LiberationSans", fontSize: 9, cellPadding: 5 },
      headStyles: { textColor: [20, 44, 74] },
    });
  for (let page = 1; page <= doc.getNumberOfPages(); page++) {
    doc.setPage(page);
    header();
    footer();
  }
  return doc;
}
export function pdfFileName(orderNumber: string) {
  return `reconciled-tcgplayer-${orderNumber.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 70) || "order"}.pdf`;
}
