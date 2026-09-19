import {
  cents,
  decimal,
  emptyInvoice,
  totals,
  type Invoice,
  type LineItem,
} from "./invoice";

const AMOUNT = /(?:US\s*)?\$\s*([\d,]+\.\d{2})|\b([\d,]+\.\d{2})\b/g;
const SUMMARY =
  /^(?:items?\s+(?:sub)?total|products?\s+(?:sub)?total|subtotal|sub\s+total|shipping(?:\s+(?:cost|and handling))?|sales\s+tax|tax|discount|order\s+total|grand\s+total|total(?:\s+(?:cost|paid|amount))?)\s*:?\s*(?:US\s*)?\$?\s*[\d,]+\.\d{2}\s*$/i;
const CONDITION =
  /\b(?:Near Mint|Lightly Played|Moderately Played|Heavily Played|Damaged|Unopened)(?:\s+(?:Holofoil|Reverse Holofoil|Foil|Normal))?\b/i;
const HEADER =
  /(?:description|product|item|card name).*(?:price|quantity|qty|total)|(?:qty|quantity).*(?:description|product|item)/i;
const META =
  /^(?:TCGplayer|packing slip|order (?:details|summary)|page \d|thank you|contact |https?:|www\.|shipped |tracking|estimated |delivery|payment|paid |ship to|shipping address|bill to)/i;
function amount(value: string): number | null {
  return cents(value.replace(/,/g, "").replace(/\s/g, ""));
}
function amounts(line: string) {
  return [...line.matchAll(new RegExp(AMOUNT))].map((m) => ({
    value: amount(m[1] ?? m[2]),
    index: m.index!,
    end: m.index! + m[0].length,
  }));
}

/** Conservative TCGplayer receipt/packing-slip parser. Every inferred row remains unreviewed. */
export function parseOrder(
  text: string,
  sourceName = "Pasted TCGplayer order",
): Invoice {
  const invoice = emptyInvoice();
  invoice.sourceText = text;
  invoice.sourceName = sourceName;
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.replace(/[|]/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  let seller = "";
  let pending: string[] = [];
  let inTable = false;
  let expectTotal = "";
  let previous: LineItem | undefined;
  const orderIds = new Set<string>();
  const addWarning = (warning: string) => {
    if (!invoice.warnings.includes(warning)) invoice.warnings.push(warning);
  };
  const applyTotal = (line: string) => {
    if (!SUMMARY.test(line)) return false;
    const value = amounts(line).at(-1)?.value;
    if (value === null || value === undefined) return false;
    if (/^shipping/i.test(line)) invoice.shipping = decimal(value);
    else if (/^(sales\s+)?tax/i.test(line)) invoice.tax = decimal(value);
    else if (/^discount/i.test(line)) invoice.discount = decimal(value);
    else if (/^(?:items?|products?|sub)/i.test(line))
      invoice.sourceSubtotal = value;
    else invoice.sourceTotal = value;
    pending = [];
    previous = undefined;
    inTable = false;
    return true;
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (expectTotal) {
      if (applyTotal(`${expectTotal} ${line}`)) {
        expectTotal = "";
        continue;
      }
      expectTotal = "";
    }
    if (applyTotal(line)) continue;
    if (
      /^(?:item total|subtotal|shipping|sales tax|tax|discount|order total|grand total|total)\s*:?$/i.test(
        line,
      )
    ) {
      expectTotal = line;
      pending = [];
      continue;
    }
    const order = line.match(
      /\border\s*(?:number|no\.?|#|id)\s*[:#]?\s*([A-Z0-9][A-Z0-9-]{3,})/i,
    );
    if (order) {
      invoice.orderNumber ||= order[1];
      orderIds.add(order[1]);
      pending = [];
      continue;
    }
    const date = line.match(/^(?:order\s*)?date\s*:?\s*(.+)/i);
    if (date) {
      invoice.orderDate ||= date[1];
      continue;
    }
    const sellerMatch = line.match(
      /^(?:seller|sold by|shipped (?:and sold )?by|package from)\s*:?\s*(.+)/i,
    );
    if (sellerMatch) {
      seller = sellerMatch[1];
      invoice.seller ||= seller;
      pending = [];
      continue;
    }
    if (/^(?:ship to|shipping address)\s*:?$/i.test(line)) {
      const address: string[] = [];
      while (
        i + 1 < lines.length &&
        address.length < 6 &&
        !HEADER.test(lines[i + 1]) &&
        !/^(?:order|seller|sold by|date|billing|payment|tracking|quantity|qty|shipping|subtotal|item total)/i.test(
          lines[i + 1],
        ) &&
        amounts(lines[i + 1]).length === 0
      )
        address.push(lines[++i]);
      invoice.recipient = address.shift() ?? "";
      invoice.address = address.join("\n");
      pending = [];
      continue;
    }
    if (
      HEADER.test(line) ||
      /^(?:qty|quantity|description|product|condition|price|unit price|total price)$/i.test(
        line,
      )
    ) {
      inTable = true;
      pending = [];
      previous = undefined;
      continue;
    }
    if (META.test(line)) {
      pending = [];
      previous = undefined;
      continue;
    }
    const values = amounts(line);
    if (values.length > 0 && !/^\$?[\d,.\s]+$/.test(line)) {
      const first = values[0];
      let before = line.slice(0, first.index).trim();
      const between =
        values.length > 1
          ? line.slice(first.end, values[1].index).trim()
          : line.slice(first.end).trim();
      let q = "";
      let description = before;
      let inferred = false;
      const leading = before.match(/^(\d{1,4})\s+(?:x\s+)?(.+)/i);
      const trailing = before.match(
        /^(.*?)\s+(?:qty\s*:?\s*)?(\d{1,4})\s*(?:x)?$/i,
      );
      const explicit = before.match(/\b(?:qty|quantity)\s*:?\s*(\d{1,4})\b/i);
      if (explicit) {
        q = explicit[1];
        description = before.replace(explicit[0], "").trim();
      } else if (leading) {
        q = leading[1];
        description = leading[2];
      } else if (/^(?:qty\s*:?\s*)?\d{1,4}$/i.test(between)) {
        q = between.replace(/\D/g, "");
      } else if (
        trailing &&
        !/\/#?\s*\d+$/.test(before) &&
        values.length > 1 &&
        first.value !== null &&
        first.value * Number(trailing[2]) === values.at(-1)!.value
      ) {
        q = trailing[2];
        description = trailing[1];
      } else if (/^\d{1,4}$/.test(before)) {
        q = before;
        description = "";
      }
      const unit = first.value;
      const extended = values.length > 1 ? values.at(-1)!.value : null;
      if (
        !q &&
        unit !== null &&
        extended !== null &&
        unit > 0 &&
        extended % unit === 0 &&
        extended / unit <= 9999
      ) {
        q = String(extended / unit);
        inferred = true;
      }
      if (!q) {
        q = "1";
        inferred = true;
      }
      const fullDescription = [...pending, description].join(" ").trim();
      // A price without a usable description is never turned into a fake card.
      if (!fullDescription || !/[a-z]/i.test(fullDescription)) {
        addWarning(`Could not match a description to: ${line}`);
        pending = [];
        continue;
      }
      const cond = fullDescription.match(CONDITION)?.[0] ?? "";
      const item: LineItem = {
        id: `import-${invoice.items.length + 1}`,
        description: fullDescription
          .replace(CONDITION, "")
          .trim()
          .replace(/[-–:]\s*$/, "")
          .trim(),
        details: cond,
        seller,
        quantity: q,
        unitPrice: unit === null ? "" : decimal(unit),
        sourceText: [...pending, line].join("\n"),
        reviewed: false,
      };
      invoice.items.push(item);
      previous = item;
      pending = [];
      inTable = true;
      if (inferred)
        addWarning(
          "Some quantities were inferred from the printed prices. Check each quantity against the source.",
        );
      if (unit !== null && extended !== null && unit * Number(q) !== extended)
        addWarning(
          `Line ${invoice.items.length}: printed line total does not match quantity × unit price.`,
        );
      continue;
    }
    if (values.length === 1 && pending.length && /^\$?[\d,.\s]+$/.test(line)) {
      // Stacked screenshot layout: description, condition, quantity, then price.
      const context = pending.join(" ");
      const qMatch = context.match(/(?:qty|quantity)\s*:?\s*(\d+)/i);
      const cond = context.match(CONDITION)?.[0] ?? "";
      const desc = context
        .replace(CONDITION, "")
        .replace(/(?:qty|quantity)\s*:?\s*\d+/i, "")
        .trim();
      if (desc) {
        const item: LineItem = {
          id: `import-${invoice.items.length + 1}`,
          description: desc,
          details: cond,
          seller,
          quantity: qMatch?.[1] ?? "1",
          unitPrice: values[0].value === null ? "" : decimal(values[0].value),
          sourceText: [...pending, line].join("\n"),
          reviewed: false,
        };
        invoice.items.push(item);
        previous = item;
        pending = [];
        inTable = true;
        if (!qMatch)
          addWarning(
            "Some quantities were inferred from the printed prices. Check each quantity against the source.",
          );
        continue;
      }
    }
    if (previous && CONDITION.test(line) && !pending.length) {
      previous.details = line;
      previous.sourceText += `\n${line}`;
      continue;
    }
    if (
      inTable ||
      CONDITION.test(line) ||
      /pokemon|pokémon|\d+\/\d+|qty\s*:/i.test(line)
    ) {
      pending.push(line);
      if (pending.length > 5) {
        addWarning(`Unmatched text: ${pending.shift()}`);
      }
    }
  }
  if (pending.length) addWarning(`Unmatched text: ${pending.join(" ")}`);
  if (orderIds.size > 1)
    addWarning(
      "Multiple order numbers found. Import one order at a time, or separate the orders before exporting.",
    );
  if (/£|€|\b(?:GBP|EUR|CAD|AUD)\b/.test(text))
    addWarning(
      "This V1 supports USD only. A different currency may be present; verify every amount before export.",
    );
  if (!invoice.items.length)
    addWarning(
      "No complete line items were recognised. Try a clearer source, correct the extracted text, or add lines manually.",
    );
  if (!invoice.orderNumber)
    addWarning("Order number was not recognised. Enter it from the source.");
  const t = totals(invoice);
  if (invoice.sourceSubtotal !== null && invoice.sourceSubtotal !== t.subtotal)
    addWarning(
      "Extracted item subtotal differs from the printed subtotal. Check for missing or misread lines.",
    );
  if (invoice.sourceTotal !== null && invoice.sourceTotal !== t.total)
    addWarning(
      "Extracted total differs from the printed order total. Review line items, shipping, tax and discount.",
    );
  return invoice;
}
