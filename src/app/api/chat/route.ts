import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const { messages } = await req.json();

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: "You are a helpful assistant. Keep your responses concise.",
    messages,
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  return Response.json({ text });
}
