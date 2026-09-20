"use client";
import { useEffect, useRef, useState } from "react";
import { orderSheets, type Slot } from "../lib/document-layout";
import type { Invoice, LineItem } from "../lib/invoice";

type Props = {
  doc: Invoice;
  busy: boolean;
  field: (key: keyof Invoice, value: string) => void;
  row: (id: string, key: keyof LineItem, value: string | boolean) => void;
  change: (doc: Invoice) => void;
};
export default function OrderSheet({ doc, busy, field, row, change }: Props) {
  const holder = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.75);
  const [measurement, setMeasurement] =
    useState<CanvasRenderingContext2D | null>(null);
  useEffect(() => {
    let active = true;
    void Promise.all([
      document.fonts.load("22px TCGOrder"),
      document.fonts.load("bold 22px TCGOrder"),
    ])
      .then(() => {
        if (active)
          setMeasurement(document.createElement("canvas").getContext("2d"));
      })
      .catch(() => {
        // Keep the usable fallback layout if a local font fails.
        // PDF preparation reports its own actionable error and can retry.
      });
    const observer = new ResizeObserver((entries) =>
      setScale(
        Math.max(0.75, Math.min(1, entries[0].contentRect.width / 1646)),
      ),
    );
    if (holder.current) observer.observe(holder.current);
    return () => {
      active = false;
      observer.disconnect();
    };
  }, []);
  const measure = measurement
    ? (value: string, bold = false) => {
        measurement.font = `${bold ? "bold " : ""}22px TCGOrder`;
        return measurement.measureText(value).width;
      }
    : undefined;
  const sheet = orderSheets(doc, measure)[0];
  const input = (slot: Slot) => {
    const item = slot.ref.itemId
      ? doc.items.find((i) => i.id === slot.ref.itemId)
      : undefined;
    const value = item
      ? item[slot.ref.key as keyof LineItem]
      : doc[slot.ref.key as keyof Invoice];
    return (
      <textarea
        key={`${slot.ref.itemId ?? "meta"}-${slot.ref.key}`}
        aria-label={slot.ref.label}
        className="source-input"
        disabled={busy}
        value={String(value ?? "")}
        maxLength={slot.ref.key === "description" ? 500 : 800}
        inputMode={
          slot.ref.key === "quantity"
            ? "numeric"
            : ["unitPrice", "shipping", "tax"].includes(slot.ref.key)
              ? "decimal"
              : "text"
        }
        rows={1}
        style={
          {
            left: slot.x,
            top: slot.y,
            width: slot.width,
            height: slot.height,
            textAlign: slot.align,
            lineHeight: `${slot.lineHeight}px`,
            fontWeight: slot.bold ? 700 : 400,
            fontSize: slot.fontSize,
            "--field-color": slot.color,
          } as React.CSSProperties
        }
        onChange={(e) =>
          slot.ref.itemId
            ? row(
                slot.ref.itemId,
                slot.ref.key as keyof LineItem,
                e.target.value,
              )
            : field(slot.ref.key as keyof Invoice, e.target.value)
        }
      />
    );
  };
  return (
    <div ref={holder} className="source-layout-scroll">
      <div style={{ width: 1646 * scale, height: sheet.height * scale }}>
        <div
          className="source-layout"
          style={{
            width: 1646,
            height: sheet.height,
            transform: `scale(${scale})`,
          }}
        >
          <svg
            className="source-drawing"
            width={sheet.width}
            height={sheet.height}
            viewBox={`0 0 ${sheet.width} ${sheet.height}`}
            aria-label="TCGplayer document layout"
          >
            {sheet.rects.map((r, i) => (
              <rect
                key={i}
                x={r.x}
                y={r.y}
                width={r.width}
                height={r.height}
                fill={r.fill}
                stroke={r.stroke}
                strokeWidth={r.strokeWidth}
                rx={r.radius}
              />
            ))}
            {sheet.images.map((im, i) => (
              <image
                key={i}
                href={im.src}
                x={im.x}
                y={im.y}
                width={im.width}
                height={im.height}
                preserveAspectRatio="none"
              />
            ))}
            {sheet.texts.map((r, i) => (
              <text
                key={i}
                x={r.x}
                y={r.y}
                fill={r.color}
                fontSize={r.size}
                fontWeight={r.bold ? 700 : 400}
                textAnchor={
                  r.align === "right"
                    ? "end"
                    : r.align === "center"
                      ? "middle"
                      : "start"
                }
                data-testid={r.testId}
              >
                {r.text}
              </text>
            ))}
          </svg>
          {sheet.fields.filter((f) => !f.ref.itemId).map(input)}
          <div role="table" aria-label="Editable line items">
            {sheet.rows.map((r) => {
              const item = doc.items[r.index];
              return (
                <div role="row" aria-label={`Line ${r.index + 1}`} key={r.id}>
                  {sheet.fields.filter((f) => f.ref.itemId === r.id).map(input)}
                  <div
                    className="source-row-controls"
                    style={{ top: r.top, left: 1444, width: 190 }}
                  >
                    <label>
                      <input
                        type="checkbox"
                        disabled={busy}
                        checked={item.reviewed}
                        onChange={(e) =>
                          row(item.id, "reviewed", e.target.checked)
                        }
                      />
                      {item.reviewed ? "Reviewed" : "Mark reviewed"}
                    </label>
                    <button
                      className="remove-line"
                      disabled={busy}
                      aria-label={`Delete line ${r.index + 1}`}
                      onClick={() =>
                        change({
                          ...doc,
                          items: doc.items.filter((i) => i.id !== item.id),
                        })
                      }
                    >
                      Delete
                    </button>
                    <details>
                      <summary>Seller &amp; extracted text</summary>
                      <input
                        aria-label={`Seller line ${r.index + 1}`}
                        disabled={busy}
                        value={item.seller}
                        onChange={(e) => row(item.id, "seller", e.target.value)}
                      />
                      <pre>{item.sourceText}</pre>
                    </details>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
