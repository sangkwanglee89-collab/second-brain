import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

const client = new Anthropic();

const GENERATE_SYSTEM_PROMPT = `You are a structured data extractor. You will receive a full onboarding conversation between a user and an AI assistant. Your job is to synthesize that conversation into a set of markdown files that form the user's "second brain."

## Output Format

Respond with a valid JSON object containing a "files" array. Each file has a "name" and "content" field.

You MUST produce:
1. **identity.md** — A profile of who this person is. Include: name, age, background, family, location, personality traits you observed, how they think, what matters to them, what's on their mind right now. Write it as a living snapshot, not a resume. Use natural prose with markdown headers to organize sections.

2. **3-5 domain files** — One per major life area that emerged from the conversation. Name each file after the domain in lowercase (e.g., "career.md", "family.md", "fitness.md", "golf.md"). Each domain file should capture: what's happening in this area, what they care about, what tensions or goals exist, and any relevant details. Keep it concise but substantive.

## Writing Style

- Write as if you're capturing a snapshot for a future AI that needs to understand this person quickly
- Use the person's own language where possible — don't sanitize or formalize their voice
- Include specific details, not just generalities. "Plays golf on weekends" is weak. "Trying to break 90, working on iron contact, plays at [course name]" is useful.
- Organize with markdown headers (##) but keep it readable, not bureaucratic
- Do NOT include information that wasn't discussed in the conversation — no assumptions or inferences beyond what was explicitly shared

## Example Output Structure

\`\`\`json
{
  "files": [
    {
      "name": "identity.md",
      "content": "# Identity\\n\\n## Who I Am\\n\\n..."
    },
    {
      "name": "career.md",
      "content": "# Career\\n\\n## Current Role\\n\\n..."
    }
  ]
}
\`\`\`

Respond ONLY with the JSON object. No preamble, no explanation, no markdown code fences around the JSON.`;

export async function POST(req: NextRequest) {
  const { messages } = await req.json();

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: GENERATE_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Here is the full onboarding conversation:\n\n${messages
          .map((m: { role: string; content: string }) => `${m.role === "user" ? "USER" : "ASSISTANT"}: ${m.content}`)
          .join("\n\n")}`,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  try {
    // Strip markdown code fences if Claude wrapped the JSON
    const cleaned = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned);
    return Response.json(parsed);
  } catch {
    console.error("Failed to parse generate response:", text.substring(0, 500));
    return Response.json(
      { error: "Failed to parse generated files", raw: text },
      { status: 500 }
    );
  }
}
