import { NextRequest } from "next/server";
import { analyzeAudio } from "@/lib/audio/analyzer";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("audio") as File | null;

    if (!file) {
      return Response.json({ error: "No audio file provided" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ["audio/mpeg", "audio/wav", "audio/flac", "audio/x-wav"];
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|flac)$/i)) {
      return Response.json({ error: "Unsupported audio format" }, { status: 400 });
    }

    // Validate file size (20MB)
    if (file.size > 20 * 1024 * 1024) {
      return Response.json({ error: "File too large (max 20MB)" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const analysis = await analyzeAudio(buffer);

    return Response.json({ analysis });
  } catch {
    return Response.json({ error: "Analysis failed" }, { status: 500 });
  }
}
