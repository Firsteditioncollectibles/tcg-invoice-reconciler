// Keep store names readable while removing path separators and filename controls.
function orderFileStem(seller: string, orderNumber: string) {
  const clean = (value: string) =>
    value
      .normalize("NFC")
      .replace(/[<>:"/\\|?*\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]+/g, "-")
      .replace(/\s+/g, " ")
      .replace(/^[ .-]+|[ .-]+$/g, "")
      .slice(0, 100)
      .trim();
  const name = clean(seller) || clean(orderNumber) || "TCGplayer order";
  return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)
    ? `${name} store`
    : name;
}

export function pdfFileName(orderNumber: string, seller = "") {
  return `${orderFileStem(seller, orderNumber)}.pdf`;
}

export function draftFileName(orderNumber: string, seller = "") {
  return `${orderFileStem(seller, orderNumber)}.json`;
}
