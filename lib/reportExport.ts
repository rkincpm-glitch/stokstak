// Client-side export helpers for reports.
// - Excel: xlsx
// - PDF: jsPDF + autotable

export type PdfImageCell = {
  /** data:image/...;base64,... */
  __imageDataUrl: string;
};

export type PdfCell = string | number | null | undefined | PdfImageCell;

export type ExportColumn<T> = {
  header: string;
  // Return a string/number for normal cells, or {__imageDataUrl} to render an image inside the PDF cell.
  value: (row: T) => PdfCell;
};

export async function exportToExcel<T>(
  filename: string,
  rows: T[],
  columns: ExportColumn<T>[]
) {
  const XLSX = await import("xlsx");
  const data = rows.map((r) => {
    const obj: Record<string, any> = {};
    for (const c of columns) obj[c.header] = c.value(r) ?? "";
    return obj;
  });

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}

export async function exportToPdf<T>(
  filename: string,
  title: string,
  rows: T[],
  columns: ExportColumn<T>[],
  options?: { companyName?: string }
) {
  const [{ jsPDF }, autoTableMod] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  // jspdf-autotable v5 exports a function (default export) rather than augmenting jsPDF.
  const autoTable: any = (autoTableMod as any).default ?? (autoTableMod as any);

  const doc = new jsPDF({ orientation: "landscape" });
  // Improve contrast/readability
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(16);
  doc.text(title, 14, 16);
  if (options?.companyName) {
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    doc.text(String(options.companyName), 14, 22);
    doc.setTextColor(0, 0, 0);
  }

  const head = [columns.map((c) => c.header)];
  const body = rows.map((r) =>
    columns.map((c) => {
      const v = c.value(r);
      return v ?? "";
    })
  );

  autoTable(doc, {
    styles: { fontSize: 10, textColor: [0, 0, 0], lineColor: [60, 60, 60], lineWidth: 0.1, cellPadding: 3 },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
    bodyStyles: { fillColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [245, 247, 250] },

    startY: 22,
    head,
    body,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [241, 245, 249] },
    didParseCell: (data: any) => {
      const raw = data.cell?.raw;
      if (raw && typeof raw === "object" && "__imageDataUrl" in raw) {
        // Prevent printing the object as text.
        data.cell.text = [""];
        data.cell.styles.minCellHeight = Math.max(data.cell.styles.minCellHeight || 0, 18);
      }
    },
    didDrawCell: (data: any) => {
      const raw = data.cell?.raw;
      if (!raw || typeof raw !== "object" || !("__imageDataUrl" in raw)) return;

      const dataUrl: string = raw.__imageDataUrl;
      const format = dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";

      // Fit image within cell with small padding.
      const pad = 2;
      const x = data.cell.x + pad;
      const y = data.cell.y + pad;
      const w = Math.max(1, data.cell.width - pad * 2);
      const h = Math.max(1, data.cell.height - pad * 2);

      try {
        doc.addImage(dataUrl, format as any, x, y, w, h);
      } catch {
        // If the image can't be embedded, leave the cell empty.
      }
    },
  });

  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}
