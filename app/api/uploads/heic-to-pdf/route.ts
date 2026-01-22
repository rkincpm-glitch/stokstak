import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";

/**
 * Server-side conversion for HEIC/HEIF attachments.
 *
 * Input: multipart/form-data
 *  - file: HEIC/HEIF
 *  - companyId: string
 *  - vendorId: string
 *  - folder: "invoices" | "payments"
 *  - baseName: string (already sanitized)
 *
 * Output: { path }
 */
export async function POST(req: Request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!url || !serviceRole) {
      return NextResponse.json({ error: "Missing SUPABASE env vars." }, { status: 500 });
    }

    const form = await req.formData();
    const file = form.get("file");
    const companyId = String(form.get("companyId") || "").trim();
    const vendorId = String(form.get("vendorId") || "").trim();
    const folder = String(form.get("folder") || "").trim();
    const baseName = String(form.get("baseName") || "file").trim();

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required." }, { status: 400 });
    }
    if (!companyId || !vendorId || (folder !== "invoices" && folder !== "payments")) {
      return NextResponse.json({ error: "companyId, vendorId and valid folder are required." }, { status: 400 });
    }

    // Read file bytes
    const input = Buffer.from(await file.arrayBuffer());

    // Convert to PNG first (sharp has the broadest decode/encode surface)
    const png = await sharp(input).png({ quality: 90 }).toBuffer();

    // Wrap into a single-page PDF
    const pdf = await PDFDocument.create();
    const img = await pdf.embedPng(png);
    const { width, height } = img.scale(1);
    const page = pdf.addPage([width, height]);
    page.drawImage(img, { x: 0, y: 0, width, height });
    const pdfBytes = await pdf.save();

    const safeBase = baseName.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 80) || "file";
    const fname = `${crypto.randomUUID()}-${safeBase}.pdf`;
    const path = `${companyId}/vendors/${vendorId}/${folder}/${fname}`;

    const admin = createClient(url, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error } = await admin.storage
      .from("attachments")
      .upload(path, pdfBytes, { cacheControl: "3600", upsert: false, contentType: "application/pdf" });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ path }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}
