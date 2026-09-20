import { cents, money, totals, type Invoice, type LineItem } from "./invoice";

// Coordinates are measured from the user's 1436px TCGplayer order screenshot.
// Both the editable sheet and PDF consume these same drawing instructions.
export const ORDER_WIDTH = 1436;
export const INK = "#595959",
  LINK = "#0d5b92",
  RULE = "#dcdadb";
export type FieldRef = {
  key: keyof Invoice | keyof LineItem;
  label: string;
  itemId?: string;
};
export type TextRun = {
  text: string;
  x: number;
  y: number;
  size: number;
  color: string;
  bold?: boolean;
  align?: "left" | "right" | "center";
  testId?: string;
};
export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  radius?: number;
};
export type Slot = {
  ref: FieldRef;
  x: number;
  y: number;
  width: number;
  height: number;
  align?: "left" | "right" | "center";
  color: string;
  bold?: boolean;
  lineHeight: number;
  fontSize: number;
};
export type Sheet = {
  width: number;
  height: number;
  texts: TextRun[];
  rects: Rect[];
  images: {
    src: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }[];
  fields: Slot[];
  rows: { id: string; index: number; top: number; height: number }[];
};
export type Measure = (text: string, bold?: boolean) => number;
const normal = (s: string) =>
  s.replace(/[–—]/g, "-").replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
export function wrapText(
  value: string,
  width: number,
  measure: Measure,
): string[] {
  return normal(value)
    .split("\n")
    .flatMap((paragraph) => {
      if (!paragraph) return [""];
      const lines: string[] = [];
      let current = "";
      for (const word of paragraph.split(/\s+/)) {
        if (current && measure(`${current} ${word}`) > width) {
          lines.push(current);
          current = "";
        }
        if (measure(word) > width) {
          for (const char of word) {
            if (measure(current + char) > width && current) {
              lines.push(current);
              current = "";
            }
            current += char;
          }
        } else current = current ? `${current} ${word}` : word;
      }
      if (current) lines.push(current);
      return lines;
    });
}
export function orderSheets(
  invoice: Invoice,
  measure: Measure = (s) => s.length * 11,
  paginate = false,
): Sheet[] {
  const t = totals(invoice);
  const sheets: Sheet[] = [];
  let s: Sheet;
  const text = (
    value: string,
    x: number,
    y: number,
    bold = false,
    color = INK,
    align: TextRun["align"] = "left",
    testId?: string,
    size = 22,
  ) =>
    s.texts.push({
      text: normal(value),
      x,
      y,
      bold,
      color,
      align,
      size,
      testId,
    });
  const box = (
    x: number,
    y: number,
    width: number,
    height: number,
    fill: string,
    stroke?: string,
    strokeWidth = 2,
    radius = 0,
  ) => s.rects.push({ x, y, width, height, fill, stroke, strokeWidth, radius });
  const field = (
    ref: FieldRef,
    value: string,
    x: number,
    baseline: number,
    width: number,
    opts: {
      color?: string;
      bold?: boolean;
      align?: Slot["align"];
      lineHeight?: number;
      display?: string;
      fit?: boolean;
    } = {},
  ) => {
    const displayed = opts.display ?? value;
    const fontSize = opts.fit
      ? Math.min(22, (22 * width) / Math.max(1, measure(displayed)))
      : 22;
    const lines = opts.fit ? [displayed] : wrapText(displayed, width, measure);
    const lineHeight = opts.lineHeight ?? 36;
    const height = Math.max(lineHeight, lines.length * lineHeight);
    lines.forEach((line, i) =>
      text(
        line,
        opts.align === "right"
          ? x + width
          : opts.align === "center"
            ? x + width / 2
            : x,
        baseline + i * lineHeight,
        opts.bold,
        opts.color ?? INK,
        opts.align,
        undefined,
        fontSize,
      ),
    );
    s.fields.push({
      ref,
      x,
      y: baseline - 24,
      width,
      height,
      align: opts.align,
      color: opts.color ?? INK,
      bold: opts.bold,
      lineHeight,
      fontSize,
    });
    return baseline + (lines.length - 1) * lineHeight;
  };
  const meta = (
    key: keyof Invoice,
    label: string,
    x: number,
    y: number,
    width: number,
    opts: Parameters<typeof field>[5] = {},
  ) => field({ key, label }, String(invoice[key] ?? ""), x, y, width, opts);
  const heading = (value: string, x: number, y = 168) =>
    text(value, x, y, true);
  const newSheet = () => {
    s = {
      width: ORDER_WIDTH,
      height: 0,
      texts: [],
      rects: [],
      images: [],
      fields: [],
      rows: [],
    };
    sheets.push(s);
    box(8, 11, 1418, 99, "#f9f9f9");
    box(8, 109, 1418, 2, RULE);
    heading("ORDER DATE", 28, 52);
    heading("CHANNEL", 310, 52);
    heading("ORDER NUMBER", 592, 52);
    const dateEnd = meta("orderDate", "Order date", 28, 82, 265, {
      lineHeight: 29,
    });
    const channelEnd = field(
      { key: "channel", label: "Channel" },
      invoice.channel || "TCG Marketplace",
      310,
      82,
      265,
      { lineHeight: 29 },
    );
    const orderEnd = meta("orderNumber", "Order number *", 592, 82, 315, {
      lineHeight: 29,
    });
    box(920, 32, 208, 48, "#0a5d99", "#2097dc", 2, 16);
    text("Contact Seller", 1024, 65, false, "#ffffff", "center", undefined, 26);
    box(1166, 32, 239, 48, "#0a5d99", "#2097dc", 2, 16);
    text(
      "Rate Transaction",
      1285.5,
      65,
      false,
      "#ffffff",
      "center",
      undefined,
      26,
    );
    const headerExtra = Math.max(dateEnd, channelEnd, orderEnd) - 82;
    s.rects[0].height += headerExtra;
    s.rects[1].y += headerExtra;
    const metaTextStart = s.texts.length;
    const metaFieldStart = s.fields.length;
    heading("ORDER SUMMARY", 28);
    heading("SHIP TO", 374);
    heading("BILL TO", 720);
    heading("SHIPPED AND SOLD BY", 1066);
    text("Quantity:", 28, 204);
    text(String(t.count), 335, 204, false, INK, "right", "card-count");
    text("Subtotal:", 28, 240);
    text(t.valid ? money(t.subtotal) : "—", 335, 240, false, INK, "right");
    text("Shipping:", 28, 276);
    meta("shipping", "Shipping", 245, 276, 90, {
      align: "right",
      fit: true,
      display: t.shipping === null ? invoice.shipping : money(t.shipping),
    });
    const taxEnd = field(
      { key: "taxLabel", label: "Tax label" },
      invoice.taxLabel || "Sales Tax",
      28,
      312,
      212,
      { display: `${invoice.taxLabel || "Sales Tax"}:` },
    );
    meta("tax", "Tax", 245, 312, 90, {
      align: "right",
      fit: true,
      display: t.tax === null ? invoice.tax : money(t.tax),
    });
    let totalY = Math.max(348, taxEnd + 36);
    if (t.discount !== 0) {
      text("Discount:", 28, totalY);
      text(
        t.discount === null ? invoice.discount : `-${money(t.discount)}`,
        335,
        totalY,
        false,
        INK,
        "right",
      );
      totalY += 36;
    }
    text("Total:", 28, totalY, true);
    text(
      t.valid ? money(t.total) : "Check amounts",
      335,
      totalY,
      true,
      INK,
      "right",
      "grand-total",
    );
    const recipientEnd = meta("recipient", "Recipient", 374, 204, 320);
    let shipEnd = meta(
      "address",
      "Delivery address",
      374,
      recipientEnd + 36,
      320,
    );
    if (invoice.reference) {
      const lines = wrapText(`Package: ${invoice.reference}`, 320, measure);
      lines.forEach((line, i) => text(line, 374, shipEnd + (i + 1) * 36));
      shipEnd += lines.length * 36;
    }
    const billEnd = meta(
      "billingRecipient",
      "Billing recipient",
      720,
      204,
      320,
    );
    const addressEnd = meta(
      "billingAddress",
      "Billing address",
      720,
      billEnd + 36,
      320,
    );
    const sellerEnd = meta("seller", "Seller / store", 1066, 204, 335, {
      color: LINK,
    });
    heading("SHIPPED WITH TRACKING:", 1066, sellerEnd + 52);
    const trackEnd = meta(
      "tracking",
      "Tracking number",
      1066,
      sellerEnd + 88,
      335,
      { color: LINK },
    );
    const methodEnd = meta(
      "shippingMethod",
      "Shipping method",
      1066,
      trackEnd + 36,
      335,
    );
    for (const run of s.texts.slice(metaTextStart)) run.y += headerExtra;
    for (const slot of s.fields.slice(metaFieldStart)) slot.y += headerExtra;
    const top =
      headerExtra +
      Math.max(411, totalY + 48, shipEnd + 48, addressEnd + 48, methodEnd + 47);
    box(29, top + 1, 1372, 72, "#eeeeee", RULE);
    for (const [x, label] of [
      [40, "ITEMS"],
      [530, "DETAILS"],
      [1034, "PRICE"],
      [1221, "QUANTITY"],
    ] as const)
      heading(label, x, top + 44);
    for (const x of [519, 1023, 1210]) box(x, top + 1, 2, 72, RULE);
    return top + 73;
  };
  const finish = (end: number) => {
    s.height = end + 30;
    // The outer frame is separate from the four unboxed metadata columns.
    s.rects.push({
      x: 5,
      y: 8,
      width: 1424,
      height: s.height - 14,
      fill: "none",
      stroke: RULE,
      strokeWidth: 6,
      radius: 3,
    });
  };
  let y = newSheet();
  invoice.items.forEach((item, index) => {
    const name = wrapText(item.description, 405, measure),
      set = wrapText(item.setName ?? "", 405, measure);
    const rarity = wrapText(
      item.rarity ?? "",
      480 - measure("Rarity: "),
      measure,
    );
    const condition = wrapText(
      item.details,
      480 - measure("Condition: "),
      measure,
    );
    const otherSeller = item.seller && item.seller !== invoice.seller;
    const height = Math.max(
      86,
      22 +
        Math.max(
          name.length + set.length,
          rarity.length +
            condition.length +
            (otherSeller
              ? wrapText(`Seller: ${item.seller}`, 480, measure).length
              : 0),
        ) *
          32,
    );
    if (paginate && s.rows.length && y + height + 26 > 2030) {
      finish(y);
      y = newSheet();
    }
    box(29, y, 1372, height, index % 2 ? "#f9f9f9" : "#ffffff", RULE);
    for (const x of [519, 1023, 1210]) box(x, y, 2, height, RULE);
    s.rows.push({ id: item.id, index, top: y, height });
    if (item.thumbnail)
      s.images.push({
        src: item.thumbnail,
        x: 40,
        y: y + 11,
        width: 42,
        height: 58,
      });
    const itemField = (
      key: keyof LineItem,
      label: string,
      value: string,
      x: number,
      baseline: number,
      width: number,
      opts: Parameters<typeof field>[5] = {},
    ) =>
      field(
        { key, label: `${label} line ${index + 1}`, itemId: item.id },
        value,
        x,
        baseline,
        width,
        { lineHeight: 32, ...opts },
      );
    const nameEnd = itemField(
      "description",
      "Description",
      item.description,
      100,
      y + 34,
      405,
      { color: LINK },
    );
    itemField("setName", "Set", item.setName ?? "", 100, nameEnd + 32, 405);
    text("Rarity: ", 530, y + 34);
    const rarityEnd = itemField(
      "rarity",
      "Rarity",
      item.rarity ?? "",
      530 + measure("Rarity: "),
      y + 34,
      480 - measure("Rarity: "),
    );
    text("Condition: ", 530, rarityEnd + 32);
    const conditionEnd = itemField(
      "details",
      "Condition and details",
      item.details,
      530 + measure("Condition: "),
      rarityEnd + 32,
      480 - measure("Condition: "),
    );
    if (otherSeller)
      wrapText(`Seller: ${item.seller}`, 480, measure).forEach((v, i) =>
        text(v, 530, conditionEnd + 32 * (i + 1)),
      );
    itemField(
      "unitPrice",
      "Unit price",
      item.unitPrice,
      1034,
      y + height / 2 + 8,
      164,
      {
        display:
          cents(item.unitPrice) === null
            ? item.unitPrice
            : money(cents(item.unitPrice)!),
      },
    );
    itemField(
      "quantity",
      "Quantity",
      item.quantity,
      1222,
      y + height / 2 + 8,
      166,
      { align: "center" },
    );
    y += height;
  });
  if (invoice.notes.trim()) {
    const lines = wrapText(invoice.notes, 1330, measure);
    if (paginate && y + 64 + lines.length * 32 > 2030) {
      finish(y);
      y = newSheet();
    }
    heading("RECONCILIATION NOTES", 40, y + 42);
    lines.forEach((line, i) => text(line, 40, y + 78 + i * 32));
    y += 94 + lines.length * 32;
  }
  finish(y);
  return sheets;
}
