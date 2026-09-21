"use client";

import { useEffect, useRef, useState } from "react";

export default function PdfPreview({ bytes }: { bytes: Uint8Array }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let disposed = false;
    let task: import("pdfjs-dist").PDFDocumentLoadingTask | undefined;
    let render: import("pdfjs-dist").RenderTask | undefined;
    setLoading(true);
    setError("");
    async function showPage() {
      try {
        const pdfjs = await import("pdfjs-dist");
        if (disposed) return;
        pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdf.worker.min.mjs";
        task = pdfjs.getDocument({
          // PDF.js transfers the buffer to its worker. Keep the download intact.
          data: new Uint8Array(bytes),
          standardFontDataUrl: "/vendor/standard_fonts/",
          cMapUrl: "/vendor/cmaps/",
          cMapPacked: true,
          wasmUrl: "/vendor/wasm/",
        });
        const pdf = await task.promise;
        if (disposed) return;
        const page = await pdf.getPage(pageNumber);
        if (disposed || !canvas.current) return;
        setPageCount(pdf.numPages);
        const viewport = page.getViewport({ scale: 2 });
        canvas.current.width = Math.ceil(viewport.width);
        canvas.current.height = Math.ceil(viewport.height);
        render = page.render({ canvas: canvas.current, viewport });
        await render.promise;
        if (!disposed) setLoading(false);
      } catch (e) {
        if (!disposed) {
          setError(
            e instanceof Error
              ? e.message
              : "Could not display the PDF preview.",
          );
          setLoading(false);
        }
      }
    }
    void showPage();
    return () => {
      disposed = true;
      render?.cancel();
      void task?.destroy();
    };
  }, [bytes, pageNumber]);

  return (
    <section
      className="document-preview"
      aria-label="Reconciled document preview"
    >
      <div className="pdf-preview-controls">
        <button
          className="secondary small"
          disabled={loading || pageNumber <= 1}
          onClick={() => setPageNumber((p) => p - 1)}
        >
          Previous page
        </button>
        <p role="status">
          {loading
            ? "Rendering PDF preview…"
            : `Page ${pageNumber} of ${pageCount}`}
        </p>
        <button
          className="secondary small"
          disabled={loading || pageNumber >= pageCount}
          onClick={() => setPageNumber((p) => p + 1)}
        >
          Next page
        </button>
      </div>
      {error && (
        <p role="alert">
          Preview unavailable: {error} Your edits are still here.
        </p>
      )}
      <canvas
        ref={canvas}
        aria-label={`PDF page ${pageNumber}`}
        hidden={loading || !!error}
      />
    </section>
  );
}
