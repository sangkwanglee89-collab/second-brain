import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Use service role for partner operations that cross user boundaries
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { action, userId, inviteCode, fileNames, shared } = await req.json();

  if (action === "create-invite") {
    // Check if user already has a partnership
    const { data: existing } = await supabase
      .from("partnerships")
      .select("*")
      .or(`inviter_id.eq.${userId},partner_id.eq.${userId}`)
      .eq("status", "accepted")
      .maybeSingle();

    if (existing) {
      return Response.json({ error: "You already have a partner connected." }, { status: 400 });
    }

    // Generate a random invite code
    const code = crypto.randomUUID().slice(0, 8);

    // Delete any existing pending invites from this user
    await supabase
      .from("partnerships")
      .delete()
      .eq("inviter_id", userId)
      .eq("status", "pending");

    const { error } = await supabase
      .from("partnerships")
      .insert({ inviter_id: userId, invite_code: code });

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ inviteCode: code });
  }

  if (action === "accept-invite") {
    // Find the pending invite
    const { data: invite } = await supabase
      .from("partnerships")
      .select("*")
      .eq("invite_code", inviteCode)
      .eq("status", "pending")
      .maybeSingle();

    if (!invite) {
      return Response.json({ error: "Invalid or expired invite link." }, { status: 400 });
    }

    if (invite.inviter_id === userId) {
      return Response.json({ error: "You can't accept your own invite." }, { status: 400 });
    }

    // Accept the partnership
    const { error } = await supabase
      .from("partnerships")
      .update({ partner_id: userId, status: "accepted" })
      .eq("id", invite.id);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ success: true });
  }

  if (action === "get-partnership") {
    const { data } = await supabase
      .from("partnerships")
      .select("*")
      .or(`inviter_id.eq.${userId},partner_id.eq.${userId}`)
      .eq("status", "accepted")
      .maybeSingle();

    if (!data) {
      return Response.json({ partnership: null });
    }

    const partnerId = data.inviter_id === userId ? data.partner_id : data.inviter_id;

    // Get partner's email
    const { data: { user: partnerUser } } = await supabase.auth.admin.getUserById(partnerId);

    return Response.json({
      partnership: {
        id: data.id,
        partnerId,
        partnerEmail: partnerUser?.email || "Unknown",
      },
    });
  }

  if (action === "get-sharing") {
    const { data } = await supabase
      .from("sharing_settings")
      .select("file_name, shared")
      .eq("user_id", userId);

    return Response.json({ settings: data || [] });
  }

  if (action === "update-sharing") {
    // Upsert sharing settings for each file
    for (let i = 0; i < fileNames.length; i++) {
      await supabase
        .from("sharing_settings")
        .upsert(
          { user_id: userId, file_name: fileNames[i], shared: shared[i] },
          { onConflict: "user_id,file_name" }
        );
    }

    return Response.json({ success: true });
  }

  if (action === "get-partner-files") {
    // Get the partnership
    const { data: partnership } = await supabase
      .from("partnerships")
      .select("*")
      .or(`inviter_id.eq.${userId},partner_id.eq.${userId}`)
      .eq("status", "accepted")
      .maybeSingle();

    if (!partnership) {
      return Response.json({ error: "No partner connected." }, { status: 400 });
    }

    const partnerId = partnership.inviter_id === userId ? partnership.partner_id : partnership.inviter_id;

    // Get partner's shared files
    const { data: sharedSettings } = await supabase
      .from("sharing_settings")
      .select("file_name")
      .eq("user_id", partnerId)
      .eq("shared", true);

    if (!sharedSettings || sharedSettings.length === 0) {
      return Response.json({ files: [], partnerEmail: "" });
    }

    const sharedFileNames = sharedSettings.map((s) => s.file_name);

    const { data: files } = await supabase
      .from("vault_files")
      .select("name, content")
      .eq("user_id", partnerId)
      .in("name", sharedFileNames);

    // Get partner email
    const { data: { user: partnerUser } } = await supabase.auth.admin.getUserById(partnerId);

    return Response.json({
      files: files || [],
      partnerEmail: partnerUser?.email || "Partner",
    });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
