export type LineItem = {
  id: string;
  description: string;
  setName?: string;
  rarity?: string;
  details: string;
  seller: string;
  quantity: string;
  unitPrice: string;
  sourceText: string;
  reviewed: boolean;
};
export type Invoice = {
  version: 1;
  orderNumber: string;
  orderDate: string;
  channel?: string;
  billingRecipient?: string;
  billingAddress?: string;
  tracking?: string;
  shippingMethod?: string;
  sourceQuantity?: number | null;
  seller: string;
  recipient: string;
  address: string;
  reference: string;
  notes: string;
  shipping: string;
  tax: string;
  discount: string;
  items: LineItem[];
  sourceName: string;
  sourceText: string;
  sourceSubtotal: number | null;
  sourceTotal: number | null;
  warnings: string[];
};
export const DISCLOSURE =
  "Buyer-prepared reconciliation of a TCGplayer order. Not a seller-issued invoice.";
export const MAX_MONEY_CENTS = 99_999_999;
export function emptyInvoice(): Invoice {
  return {
    version: 1,
    orderNumber: "",
    orderDate: "",
    channel: "",
    billingRecipient: "",
    billingAddress: "",
    tracking: "",
    shippingMethod: "",
    sourceQuantity: null,
    seller: "",
    recipient: "",
    address: "",
    reference: "",
    notes: "",
    shipping: "0.00",
    tax: "0.00",
    discount: "0.00",
    items: [],
    sourceName: "",
    sourceText: "",
    sourceSubtotal: null,
    sourceTotal: null,
    warnings: [],
  };
}
// All calculations are integer cents. Invalid/unfinished inputs never silently become zero.
export function cents(value: string): number | null {
  const clean = value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(clean)) return null;
  const [whole, fraction = ""] = clean.split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(result) && result <= MAX_MONEY_CENTS
    ? result
    : null;
}
export function decimal(value: number): string {
  return `${Math.floor(value / 100)}.${String(value % 100).padStart(2, "0")}`;
}
export function money(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value / 100);
}
export function quantity(value: string): number | null {
  return /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 9999
    ? Number(value)
    : null;
}
export function totals(invoice: Invoice) {
  let subtotal = 0;
  let count = 0;
  const errors: string[] = [];
  invoice.items.forEach((item, i) => {
    const q = quantity(item.quantity);
    const p = cents(item.unitPrice);
    if (!item.description.trim())
      errors.push(`Line ${i + 1}: enter a description.`);
    if (q === null)
      errors.push(
        `Line ${i + 1}: quantity must be a whole number from 1 to 9,999.`,
      );
    if (p === null)
      errors.push(
        `Line ${i + 1}: enter a non-negative USD price with up to two decimal places.`,
      );
    if (q !== null && p !== null) {
      subtotal += q * p;
      count += q;
    }
  });
  const shipping = cents(invoice.shipping);
  const tax = cents(invoice.tax);
  const discount = cents(invoice.discount);
  if (shipping === null || tax === null || discount === null)
    errors.push(
      "Shipping, tax and discount must be non-negative USD amounts with up to two decimal places.",
    );
  const total = subtotal + (shipping ?? 0) + (tax ?? 0) - (discount ?? 0);
  if (!Number.isSafeInteger(total) || total > MAX_MONEY_CENTS)
    errors.push("The total exceeds the supported amount.");
  if (total < 0)
    errors.push("Discount cannot exceed the subtotal plus shipping and tax.");
  return {
    subtotal,
    shipping,
    tax,
    discount,
    total,
    count,
    errors,
    valid: errors.length === 0,
  };
}
export function consolidate(items: LineItem[]): LineItem[] {
  const result: LineItem[] = [];
  const seen = new Map<string, LineItem>();
  for (const item of items) {
    const q = quantity(item.quantity);
    const p = cents(item.unitPrice);
    const key = JSON.stringify([
      item.description.trim().toLocaleLowerCase(),
      (item.setName ?? "").trim().toLocaleLowerCase(),
      (item.rarity ?? "").trim().toLocaleLowerCase(),
      item.details.trim().toLocaleLowerCase(),
      item.seller.trim().toLocaleLowerCase(),
      p,
    ]);
    const match = seen.get(key);
    if (
      match &&
      q !== null &&
      p !== null &&
      quantity(match.quantity)! + q <= 9999
    ) {
      match.quantity = String(Number(match.quantity) + q);
      match.reviewed = match.reviewed && item.reviewed;
      match.sourceText = [match.sourceText, item.sourceText]
        .filter(Boolean)
        .join("\n");
    } else {
      const copy = { ...item };
      result.push(copy);
      if (q !== null && p !== null) seen.set(key, copy);
    }
  }
  return result;
}
export function editDocumentField(
  invoice: Invoice,
  key: keyof Invoice,
  value: string,
): Invoice {
  const next = { ...invoice, [key]: value };
  if (key === "seller") {
    const previous = invoice.seller.trim().toLowerCase();
    next.items = invoice.items.map((item) =>
      item.seller.trim().toLowerCase() === previous
        ? { ...item, seller: value, reviewed: false }
        : item,
    );
  }
  return next;
}
export function readDraft(raw: string): Invoice {
  if (raw.length > 2_000_000)
    throw new Error("Draft is too large (maximum 2 MB).");
  const value = JSON.parse(raw) as Invoice;
  const base = emptyInvoice();
  // V1 drafts saved before document-box editing did not contain these fields.
  if (value && typeof value === "object") {
    for (const key of [
      "channel",
      "billingRecipient",
      "billingAddress",
      "tracking",
      "shippingMethod",
    ] as const)
      if (value[key] === undefined) value[key] = "";
    if (value.sourceQuantity === undefined) value.sourceQuantity = null;
  }
  if (
    !value ||
    value.version !== 1 ||
    !Array.isArray(value.items) ||
    value.items.length > 1000
  )
    throw new Error("This is not a supported reconciler draft.");
  for (const [key, field] of Object.entries(base)) {
    if (
      typeof field === "string" &&
      (typeof value[key as keyof Invoice] !== "string" ||
        (value[key as keyof Invoice] as string).length > 200_000)
    )
      throw new Error("The draft contains invalid document fields.");
  }
  if (
    !Array.isArray(value.warnings) ||
    value.warnings.some((w) => typeof w !== "string")
  )
    throw new Error("Invalid draft warnings.");
  for (const key of ["sourceTotal", "sourceSubtotal"] as const) {
    if (
      value[key] !== null &&
      (!Number.isSafeInteger(value[key]) || value[key]! < 0)
    )
      throw new Error("Invalid source totals.");
  }
  const ids = new Set<string>();
  if (
    value.sourceQuantity !== null &&
    (!Number.isSafeInteger(value.sourceQuantity) || value.sourceQuantity! < 0)
  )
    throw new Error("Invalid source quantity.");
  for (const item of value.items) {
    if (
      !item ||
      [
        "id",
        "description",
        "details",
        "seller",
        "quantity",
        "unitPrice",
        "sourceText",
      ].some((k) => typeof item[k as keyof LineItem] !== "string") ||
      typeof item.reviewed !== "boolean" ||
      (item.setName !== undefined && typeof item.setName !== "string") ||
      (item.rarity !== undefined && typeof item.rarity !== "string") ||
      ids.has(item.id)
    )
      throw new Error("The draft contains invalid line items.");
    ids.add(item.id);
  }
  return { ...base, ...value };
}
