import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

const client = new Anthropic();

// Step 1: Quick analysis — which files need what changes?
const ANALYZE_PROMPT = `You are analyzing a conversation to determine what vault updates are needed.

You will receive the user's current vault file NAMES (not full content) and a recent conversation. Identify what should change.

## What Counts as an Update

Be LIBERAL about detecting updates — the bar is: "Would a future version of the user's second brain be more useful if it knew this?"

- New facts, decisions, timelines, or concrete details
- Shifts in perspective, priorities, or emotional state
- New tensions or resolutions of old ones
- Information that supersedes or contradicts what's currently in the vault

## Before You Analyze

Before producing your JSON, silently work through this checklist. Do not output it — let it shape your decisions:

1. **What actually changed?** Separate signal from noise. The person may have talked for 20 messages but only said 2 things that matter for the vault. Don't update just because a topic was mentioned — update because something *new* was learned.
2. **Identity or domain?** For each change, ask: is this about who the person IS (psychology, values, life-level tension) or about the STATE of a specific area (new job title, new goal, new timeline)? If you're unsure, it's probably both — update both files. Getting this routing wrong is the most consequential mistake you can make.
3. **Replace or add?** For each change, check: does this supersede something already in the vault, or is it net new? If it supersedes, your instruction MUST say to replace the specific outdated content. Appending alongside outdated content is how vaults decay.
4. **What should be removed?** This is the step most often skipped. If a tension has been resolved, a goal has been abandoned, or a situation has changed — the old content needs to come out. Stale content in the vault is worse than missing content, because it actively misleads future conversations.
5. **Am I being specific enough?** Your instructions will be executed by another model that can't read the conversation. If your instruction says "update the career section," that model has nothing to work with. Include the actual content to write.

## Update Principles

- **Identity vs. domain.** Update identity.md when something changes about who the person IS — new self-insight, a shift in values or psychology, a life-level tension or resolution. Update domain files when operational state changes within a specific area. Some changes warrant both.
- **Replace, don't accumulate.** If new information supersedes old information, instruct to REPLACE the outdated content, not append alongside it. The vault should be a clean snapshot of now, not a changelog.
- **New domains emerge.** If the conversation reveals a significant life area that doesn't have a file yet, create one.

Respond with JSON only:
{"changes": [{"file": "career.md", "action": "update", "instructions": "Replace the Current Focus section with... Add a new section about..."}, ...]}

If no changes needed: {"changes": []}

Be specific — include the actual new information. "Update the career section" is useless. "Replace the paragraph about current role focus with: [specific new content]" is useful. No code fences.`;

// Step 2: Apply changes to a specific file
const APPLY_PROMPT = `You are updating a single vault file based on specific instructions. You will receive:
1. The current file content
2. Instructions for what to add or change

Rules:
- **Snapshot, not archive.** The file should read as a clean picture of NOW. If new information supersedes old content, replace it — don't keep both.
- Preserve everything that is still accurate
- Match the existing writing style and structure
- Add new content in the most logical location
- Remove content that has been explicitly superseded — don't leave contradictions
- Keep the file focused and concise — if it's growing past ~150 lines, look for content that can be condensed or removed

Return the COMPLETE updated file content only. No JSON wrapper, no code fences, no explanation.`;

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
