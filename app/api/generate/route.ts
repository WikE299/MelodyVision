import { NextRequest } from "next/server";
import { synthesizeImagePrompt } from "@/lib/prompts/image-gen";
import { callLLMForImagePrompt } from "@/lib/llm";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { comments, presets, userNote } = body;

    // comments: { characterId: string; text: string }[]
    // presets: { style, mood, tone }
    if (!comments || !Array.isArray(comments) || comments.length === 0) {
      return Response.json({ error: "Comments required" }, { status: 400 });
    }

    // Synthesize image prompt from comments (hidden from user)
    const imageGenPrompt = synthesizeImagePrompt(
      [], // characters not needed for prompt synthesis
      comments,
      presets,
      userNote
    );

    // TODO: Replace with actual image generation API (DALL-E 3 / 通义万相)
    // For now, generate the prompt and return it (mock image URL)
    const imagePrompt = await callLLMForImagePrompt(imageGenPrompt, "Generate image prompt");

    // Mock: return a placeholder image URL
    // In production, this would call DALL-E or similar
    const mockImageUrl = `https://placehold.co/1024x1024/1a1a2e/e0e0e0?text=${encodeURIComponent(presets.style || "水墨")}`;

    return Response.json({
      imageUrl: mockImageUrl,
      prompt: imagePrompt, // Hidden from user in production
      presets,
    });
  } catch {
    return Response.json({ error: "Image generation failed" }, { status: 500 });
  }
}
