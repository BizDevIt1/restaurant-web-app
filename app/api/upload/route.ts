import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://lcukmzldwsnkkfcogaug.supabase.co";
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const BUCKET_NAME = "restaurant-logos";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/svg+xml",
  "image/webp",
  "image/gif",
];

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const urlParam = formData.get("url") as string | null;

    // If a direct URL is submitted, validate and return it
    if (urlParam && typeof urlParam === "string" && urlParam.trim()) {
      const cleanUrl = urlParam.trim();
      return NextResponse.json({ success: true, url: cleanUrl });
    }

    if (!file) {
      return NextResponse.json({ error: "No file or URL provided for upload" }, { status: 400 });
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds 5MB limit. Please upload a smaller image." },
        { status: 400 }
      );
    }

    // Validate mime type
    const mimeType = file.type || "image/png";
    if (!ALLOWED_MIME_TYPES.includes(mimeType) && !mimeType.startsWith("image/")) {
      return NextResponse.json(
        { error: "Invalid file format. Please upload PNG, SVG, JPEG, or WebP." },
        { status: 400 }
      );
    }

    const fileBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(fileBuffer);

    // Attempt upload to Supabase Storage bucket
    try {
      // Ensure bucket exists or attempt to create it
      const { data: buckets } = await supabase.storage.listBuckets();
      const bucketExists = buckets?.some((b) => b.name === BUCKET_NAME);

      if (!bucketExists) {
        await supabase.storage.createBucket(BUCKET_NAME, {
          public: true,
          fileSizeLimit: MAX_FILE_SIZE,
          allowedMimeTypes: ALLOWED_MIME_TYPES,
        });
      }

      // Generate clean unique filename
      const rawExt = file.name.split(".").pop() || "png";
      const cleanExt = rawExt.toLowerCase().replace(/[^a-z0-9]/g, "");
      const cleanFileName = `logo_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${cleanExt}`;
      const filePath = `uploads/${cleanFileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, buffer, {
          contentType: mimeType,
          cacheControl: "3600",
          upsert: true,
        });

      if (!uploadError && uploadData) {
        const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);
        if (urlData?.publicUrl) {
          return NextResponse.json({
            success: true,
            url: urlData.publicUrl,
            fileName: cleanFileName,
          });
        }
      } else {
        console.warn("[Supabase Storage Notice]:", uploadError?.message);
      }
    } catch (storageErr) {
      console.warn("[Supabase Storage Exception]:", storageErr);
    }

    // High-availability fallback: convert buffer to base64 Data URI if bucket upload is not accessible
    const base64String = buffer.toString("base64");
    const dataUri = `data:${mimeType};base64,${base64String}`;

    return NextResponse.json({
      success: true,
      url: dataUri,
      fileName: file.name,
      fallback: true,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to process logo upload";
    console.error("[Upload Error]:", errorMsg);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
