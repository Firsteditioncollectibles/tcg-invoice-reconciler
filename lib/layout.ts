import { cents, decimal, emptyInvoice, type Invoice } from "./invoice";

export type TextBox = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
};
export type TextPage = { width: number; height: number; boxes: TextBox[] };
const clean = (s: string) => s.replace(/[^a-z0-9]/gi, "").toLowerCase();
const middle = (b: TextBox) => b.y + b.height / 2;
export function layoutLines(boxes: TextBox[]): TextBox[] {
  const rows: TextBox[][] = [];
  for (const box of [...boxes]
    .filter((b) => b.text.trim())
    .sort((a, b) => middle(a) - middle(b))) {
    const row = rows.find(
      (r) =>
        Math.abs(middle(r[0]) - middle(box)) <
        Math.max(2, Math.min(r[0].height, box.height) * 0.45),
    );
    if (row) row.push(box);
    else rows.push([box]);
  }
  return rows.map((row) => {
    row.sort((a, b) => a.x - b.x);
    const x = Math.min(...row.map((b) => b.x)),
      y = Math.min(...row.map((b) => b.y));
    return {
      text: row
        .map((b) => b.text)
        .join(" ")
        .trim(),
      x,
      y,
      width: Math.max(...row.map((b) => b.x + b.width)) - x,
      height: Math.max(...row.map((b) => b.y + b.height)) - y,
    };
  });
}
function region(
  page: TextPage,
  left: number,
  right: number,
  top: number,
  bottom: number,
) {
  return page.boxes.filter(
    (b) => b.x >= left && b.x < right && middle(b) > top && middle(b) < bottom,
  );
}
function phrase(page: TextPage, name: string): TextBox | undefined {
  const words = [...page.boxes].sort((a, b) => a.x - b.x);
  for (const start of words) {
    const row = words.filter(
      (b) =>
        b.x >= start.x &&
        Math.abs(middle(b) - middle(start)) < Math.max(3, start.height * 0.6),
    );
    for (let count = 1; count <= Math.min(6, row.length); count++) {
      const parts = row.slice(0, count);
      if (clean(parts.map((b) => b.text).join(" ")) === clean(name))
        return {
          ...start,
          text: name,
          width: parts.at(-1)!.x + parts.at(-1)!.width - start.x,
        };
    }
  }
}
export function marketplaceTable(page: TextPage) {
  const items = phrase(page, "ITEMS");
  if (!items) return null;
  const aligned = {
    ...page,
    boxes: page.boxes.filter(
      (b) => Math.abs(middle(b) - middle(items)) < items.height * 1.5,
    ),
  };
  const details = phrase(aligned, "DETAILS"),
    price = phrase(aligned, "PRICE"),
    qty = phrase(aligned, "QUANTITY");
  if (
    !items ||
    !details ||
    !price ||
    !qty ||
    !(items.x < details.x && details.x < price.x && price.x < qty.x)
  )
    return null;
  if (
    Math.max(items.y, details.y, price.y, qty.y) -
      Math.min(items.y, details.y, price.y, qty.y) >
    items.height * 1.5
  )
    return null;
  const pad = items.height * 0.55;
  return {
    top: Math.max(items.y + items.height, qty.y + qty.height),
    left: items.x - pad,
    details: details.x - pad,
    price: price.x - pad,
    qty: qty.x - pad,
    height: items.height,
  };
}
export function marketplacePrices(
  page: TextPage,
  table: NonNullable<ReturnType<typeof marketplaceTable>>,
) {
  return layoutLines(
    region(page, table.price, table.qty, table.top, page.height),
  ).flatMap((b) => {
    const m = b.text.replace(/\s/g, "").match(/^(?:US)?\$?([\d,]+\.\d{2})$/);
    const value = m ? cents(m[1].replace(/,/g, "")) : null;
    return value === null ? [] : [{ ...b, value }];
  });
}

/** Read the marketplace order grid by column/row geometry, never by flattened text order. */
export function parseMarketplaceLayout(pages: TextPage[]): Invoice | null {
  if (!pages.some((p) => marketplaceTable(p))) return null;
  const doc = emptyInvoice();
  const ids = new Set<string>();
  for (const [pageIndex, page] of pages.entries()) {
    const table = marketplaceTable(page);
    if (!table) {
      doc.warnings.push(
        `Page ${pageIndex + 1}: the marketplace table headers were not found. Check for omitted items.`,
      );
      continue;
    }
    const label = (s: string) =>
      phrase({ ...page, boxes: page.boxes.filter((b) => b.y < table.top) }, s);
    const date = label("ORDER DATE"),
      channel = label("CHANNEL"),
      order = label("ORDER NUMBER");
    const summary = label("ORDER SUMMARY"),
      ship = label("SHIP TO"),
      bill = label("BILL TO"),
      seller = label("SHIPPED AND SOLD BY");
    const metaBottom = summary?.y ?? table.top;
    const below = (b: TextBox | undefined, right: number, bottom: number) =>
      b
        ? layoutLines(region(page, b.x - 3, right, b.y + b.height, bottom)).map(
            (r) => r.text,
          )
        : [];
    if (date)
      doc.orderDate ||=
        below(date, channel?.x ?? order?.x ?? page.width, metaBottom)[0] ?? "";
    if (channel)
      doc.channel ||=
        below(channel, order?.x ?? page.width, metaBottom)[0] ?? "";
    if (order) {
      const id =
        below(
          order,
          Math.min(page.width, order.x + page.width * 0.23),
          metaBottom,
        )[0] ?? "";
      if (id) {
        ids.add(id);
        doc.orderNumber ||= id;
      }
    }
    if (ship) {
      const address = below(
        ship,
        bill?.x ?? seller?.x ?? page.width,
        table.top - table.height * 2,
      );
      doc.recipient ||= address.shift() ?? "";
      doc.address ||= address.join("\n");
    }
    if (bill) {
      const address = below(
        bill,
        seller?.x ?? page.width,
        table.top - table.height * 2,
      );
      doc.billingRecipient ||= address.shift() ?? "";
      doc.billingAddress ||= address.join("\n");
    }
    if (seller) {
      const tracking = label("SHIPPED WITH TRACKING");
      doc.seller ||= below(
        seller,
        page.width,
        tracking?.y ?? table.top - table.height * 2,
      ).join(" ");
      if (tracking) {
        const lines = below(tracking, page.width, table.top - table.height * 2);
        doc.tracking ||= lines.shift() ?? "";
        doc.shippingMethod ||= lines.join(" ");
      }
    }
    if (summary) {
      for (const line of below(
        summary,
        ship?.x ?? table.details,
        table.top - table.height * 2,
      )) {
        const q = line.match(/^Quantity\s*:?\s*(\d+)$/i);
        if (q) doc.sourceQuantity = Number(q[1]);
        const m = line.match(
          /^(Subtotal|Shipping|Sales Tax(?:\s*\([^)]*\))?|Tax|Total|Discount)\s*:?\s*\$?\s*([\d,]+\.\d{2})$/i,
        );
        const value = m ? cents(m[2].replace(/,/g, "")) : null;
        if (!m || value === null) continue;
        if (/^subtotal$/i.test(m[1])) doc.sourceSubtotal = value;
        else if (/^total$/i.test(m[1])) doc.sourceTotal = value;
        else if (/^shipping$/i.test(m[1])) doc.shipping = decimal(value);
        else if (/^discount$/i.test(m[1])) doc.discount = decimal(value);
        else doc.tax = decimal(value);
      }
    }
    const prices = marketplacePrices(page, table);
    prices.forEach((price, index) => {
      const top = index
        ? (middle(prices[index - 1]) + middle(price)) / 2
        : table.top;
      const bottom =
        index + 1 < prices.length
          ? (middle(price) + middle(prices[index + 1])) / 2
          : Math.min(
              page.height,
              middle(price) +
                (index
                  ? (middle(price) - middle(prices[index - 1])) / 2
                  : table.height * 4),
            );
      const itemLines = layoutLines(
        region(page, table.left, table.details, top, bottom),
      )
        .map((b) => b.text.replace(/^[^\p{L}\d]+/u, "").trim())
        .filter((s) => /\p{L}{3}/u.test(s));
      const detailLines = layoutLines(
        region(page, table.details, table.price, top, bottom),
      ).map((b) => b.text);
      const qtyLines = layoutLines(
        region(page, table.qty, page.width, top, bottom),
      );
      const q =
        qtyLines.map((b) => b.text.trim()).find((s) => /^\d{1,4}$/.test(s)) ??
        "";
      const rarity =
        detailLines
          .find((s) => /^Rarity\s*:/i.test(s))
          ?.replace(/^Rarity\s*:\s*/i, "") ?? "";
      const condition =
        detailLines
          .find((s) => /^Condition\s*:/i.test(s))
          ?.replace(/^Condition\s*:\s*/i, "") ??
        detailLines.filter((s) => !/^Rarity\s*:/i.test(s)).join(" ");
      if (
        !itemLines.length ||
        /^(Subtotal|Shipping|Tax|Total)\b/i.test(itemLines[0])
      ) {
        doc.warnings.push(
          `Page ${pageIndex + 1}: unmatched price ${decimal(price.value)}. Check for a missing item.`,
        );
        return;
      }
      doc.items.push({
        id: `import-${doc.items.length + 1}`,
        description: itemLines[0],
        setName: itemLines.slice(1).join(" "),
        rarity,
        details: condition,
        seller: doc.seller,
        quantity: q,
        unitPrice: decimal(price.value),
        sourceText: [
          ...itemLines,
          ...detailLines,
          `Price: ${decimal(price.value)}`,
          `Quantity: ${q || "unreadable"}`,
        ].join("\n"),
        reviewed: false,
      });
      if (!q)
        doc.warnings.push(
          `Line ${doc.items.length}: quantity could not be read. Enter it from the source.`,
        );
    });
  }
  if (ids.size > 1)
    doc.warnings.push(
      "Multiple order numbers found. Import one order at a time.",
    );
  return doc;
}
