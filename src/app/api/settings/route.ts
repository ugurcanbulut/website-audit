import { NextResponse } from "next/server";

// GET /api/settings - Get current AI provider settings
export async function GET() {
  return NextResponse.json({
    anthropicConfigured: !!process.env.ANTHROPIC_API_KEY,
    openaiConfigured: !!process.env.OPENAI_API_KEY,
  });
}
