import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

const client = new Anthropic();

// Step 1: Quick analysis — which files need what changes?
const ANALYZE_PROMPT = `You are analyzing a conversation to determine what vault updates are needed.

You will receive the user's current vault file NAMES (not full content) and a recent conversation. Identify:
1. Which files need updates and what specifically should be added/changed
2. Whether any new files should be created

Be LIBERAL about detecting updates. New timelines, decisions, concrete details, perspective shifts, and new information all count. The bar is: "Would a future version of the user's second brain be more helpful if it knew this?"

Respond with JSON only:
{"changes": [{"file": "career.md", "action": "update", "instructions": "Add a new section about...with these specific details..."}, ...]}

If no changes needed: {"changes": []}

Be specific in instructions — include the actual new information to add, not just "update the AI section." No code fences.`;

// Step 2: Apply changes to a specific file
const APPLY_PROMPT = `You are updating a single vault file based on specific instructions. You will receive:
1. The current file content
2. Instructions for what to add or change

Rules:
- Preserve everything that is still accurate
- Match the existing writing style and structure
- Add the new content in the most logical location
- Do not remove content unless explicitly superseded
- Return the COMPLETE updated file content

Respond with the full updated file content only. No JSON wrapper, no code fences, no explanation.`;

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const { messages, files } = await req.json();

  const fileNames = files.map((f: { name: string }) => f.name).join(", ");
  const conversationContext = messages
    .map((m: { role: string; content: string }) => `${m.role === "user" ? "USER" : "ASSISTANT"}: ${m.content}`)
    .join("\n\n");

  // Step 1: Quick analysis
  const analysisResponse = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: ANALYZE_PROMPT,
    messages: [
      {
        role: "user",
        content: `## Vault Files\n${fileNames}\n\n## Recent Conversation\n\n${conversationContext}`,
      },
    ],
  });

  const analysisText =
    analysisResponse.content[0].type === "text" ? analysisResponse.content[0].text : "";

  let analysis;
  try {
    const cleaned = analysisText.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
    analysis = JSON.parse(cleaned);
  } catch {
    console.error("Failed to parse analysis:", analysisText.substring(0, 500));
    return Response.json({ updated: false, reason: "Failed to analyze conversation." });
  }

  if (!analysis.changes || analysis.changes.length === 0) {
    return Response.json({ updated: false, reason: "No updates needed based on the conversation." });
  }

  // Step 2: Apply changes to each file
  const updatedFiles: { name: string; content: string }[] = [];

  for (const change of analysis.changes) {
    if (change.action === "create") {
      // New file — generate from scratch
      const createResponse = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8192,
        system: APPLY_PROMPT,
        messages: [
          {
            role: "user",
            content: `## Current File Content\n(New file — no existing content)\n\n## Instructions\nCreate a new file called "${change.file}" with the following content:\n${change.instructions}`,
          },
        ],
      });
      const content = createResponse.content[0].type === "text" ? createResponse.content[0].text : "";
      updatedFiles.push({ name: change.file, content: content.trim() });
    } else {
      // Update existing file
      const existingFile = files.find((f: { name: string; content: string }) => f.name === change.file);
      if (!existingFile) continue;

      const applyResponse = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 16384,
        system: APPLY_PROMPT,
        messages: [
          {
            role: "user",
            content: `## Current File Content\n\n${existingFile.content}\n\n## Instructions\n\n${change.instructions}`,
          },
        ],
      });
      const content = applyResponse.content[0].type === "text" ? applyResponse.content[0].text : "";
      updatedFiles.push({ name: change.file, content: content.trim() });
    }
  }

  if (updatedFiles.length === 0) {
    return Response.json({ updated: false, reason: "No files were updated." });
  }

  return Response.json({ updated: true, files: updatedFiles });
}
