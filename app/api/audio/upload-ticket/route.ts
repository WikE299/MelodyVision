import {
  AudioUploadValidationError,
  createAudioUploadTicket,
  removeStoredAudio,
} from "@/lib/storage/audio-analysis";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    return Response.json(
      await createAudioUploadTicket(await request.json())
    );
  } catch (error) {
    if (error instanceof AudioUploadValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error("Audio upload ticket creation failed:", error);
    return Response.json(
      { error: "Audio upload is temporarily unavailable" },
      { status: 503 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { storagePath?: unknown };
    if (typeof body.storagePath !== "string") {
      throw new AudioUploadValidationError("storagePath is required");
    }
    await removeStoredAudio(body.storagePath);
    return Response.json({ status: "deleted" });
  } catch (error) {
    if (error instanceof AudioUploadValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error("Audio upload cleanup failed:", error);
    return Response.json(
      { error: "Audio cleanup is temporarily unavailable" },
      { status: 503 }
    );
  }
}
