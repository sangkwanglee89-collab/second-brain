import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { action, userId, conversationId, title, messages, chatType } = await req.json();

  if (!userId) {
    return Response.json({ error: "Missing userId" }, { status: 400 });
  }

  // List conversations for a user
  if (action === "list") {
    const { data, error } = await supabase
      .from("conversations")
      .select("id, title, chat_type, updated_at")
      .eq("user_id", userId)
      .eq("chat_type", chatType || "brain")
      .order("updated_at", { ascending: false });

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ conversations: data });
  }

  // Load a single conversation with messages
  if (action === "load") {
    if (!conversationId) return Response.json({ error: "Missing conversationId" }, { status: 400 });

    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .eq("id", conversationId)
      .eq("user_id", userId)
      .single();

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ conversation: data });
  }

  // Create a new conversation
  if (action === "create") {
    const { data, error } = await supabase
      .from("conversations")
      .insert({
        user_id: userId,
        title: title || "New conversation",
        chat_type: chatType || "brain",
        messages: messages || [],
      })
      .select()
      .single();

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ conversation: data });
  }

  // Save messages to an existing conversation
  if (action === "save") {
    if (!conversationId) return Response.json({ error: "Missing conversationId" }, { status: 400 });

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (messages !== undefined) updateData.messages = messages;
    if (title) updateData.title = title;

    const { error } = await supabase
      .from("conversations")
      .update(updateData)
      .eq("id", conversationId)
      .eq("user_id", userId);

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ success: true });
  }

  // Delete a conversation
  if (action === "delete") {
    if (!conversationId) return Response.json({ error: "Missing conversationId" }, { status: 400 });

    const { error } = await supabase
      .from("conversations")
      .delete()
      .eq("id", conversationId)
      .eq("user_id", userId);

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ success: true });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
