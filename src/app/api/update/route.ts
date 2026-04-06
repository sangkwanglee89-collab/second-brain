import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

const client = new Anthropic();

const UPDATE_SYSTEM_PROMPT = `You are a vault updater for a personal "second brain" app. You will receive:
1. The user's current vault (a set of markdown files)
2. A recent conversation between the user and their second brain

Your job: determine if the conversation revealed anything new or changed about the user that should be reflected in their vault. If so, produce updated files. If not, say so.

## Rules

- Only update files where meaningful new information was shared. Do not rewrite files just to rephrase existing content.
- If a new life domain emerged that doesn't have a file yet, create one.
- If existing information has changed (e.g., they got a new job, changed a goal, shifted a perspective), update the relevant section.
- Preserve everything in the existing files that is still accurate. Do not remove content unless it has been explicitly superseded.
- Use the same writing style as the existing files — match their tone and structure.
- Do NOT add information that wasn't discussed in the conversation. No inferences beyond what was explicitly shared.

## Output Format

If updates are needed, respond with a JSON object:
\`\`\`
{"updated": true, "files": [{"name": "identity.md", "content": "...full updated content..."}, ...]}
\`\`\`

Only include files that changed. Unchanged files should be omitted.

If no updates are needed, respond with:
\`\`\`
{"updated": false, "reason": "brief explanation of why no updates were needed"}
\`\`\`

Respond ONLY with the JSON object. No preamble, no explanation, no markdown code fences around the JSON.`;

export async function POST(req: NextRequest) {
  const { messages, files } = await req.json();

  const vaultContext = files
    .map((f: { name: string; content: string }) => `--- ${f.name} ---\n${f.content}`)
    .join("\n\n");

  const conversationContext = messages
    .map((m: { role: string; content: string }) => `${m.role === "user" ? "USER" : "ASSISTANT"}: ${m.content}`)
    .join("\n\n");

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: UPDATE_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `## Current Vault\n\n${vaultContext}\n\n## Recent Conversation\n\n${conversationContext}`,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  try {
    const cleaned = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned);
    return Response.json(parsed);
  } catch {
    console.error("Failed to parse update response:", text.substring(0, 500));
    return Response.json(
      { error: "Failed to parse update response", raw: text },
      { status: 500 }
    );
  }
}
