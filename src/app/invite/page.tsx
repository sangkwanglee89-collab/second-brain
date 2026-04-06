"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function InviteContent() {
  const [status, setStatus] = useState<"loading" | "accepting" | "success" | "error">("loading");
  const [error, setError] = useState("");
  const searchParams = useSearchParams();
  const code = searchParams.get("code");

  useEffect(() => {
    async function acceptInvite() {
      if (!code) {
        setStatus("error");
        setError("No invite code provided.");
        return;
      }

      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        // Save invite code and redirect to auth
        localStorage.setItem("pending-invite", code);
        window.location.href = "/auth";
        return;
      }

      setStatus("accepting");

      const res = await fetch("/api/partner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept-invite", userId: user.id, inviteCode: code }),
      });
      const data = await res.json();

      if (data.success) {
        setStatus("success");
        setTimeout(() => {
          window.location.href = "/";
        }, 2000);
      } else {
        setStatus("error");
        setError(data.error || "Something went wrong.");
      }
    }

    acceptInvite();
  }, [code]);

  return (
    <div className="flex flex-col h-screen bg-zinc-50 dark:bg-zinc-950 items-center justify-center">
      <div className="max-w-sm text-center px-6 space-y-4">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Second Brain
        </h1>
        {status === "loading" && (
          <p className="text-sm text-zinc-400">Checking invite…</p>
        )}
        {status === "accepting" && (
          <p className="text-sm text-zinc-400">Connecting you with your partner…</p>
        )}
        {status === "success" && (
          <p className="text-sm text-green-600 dark:text-green-400">
            Connected! Redirecting…
          </p>
        )}
        {status === "error" && (
          <div className="space-y-4">
            <p className="text-sm text-red-500">{error}</p>
            <a
              href="/"
              className="inline-block text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
            >
              Go to app
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col h-screen bg-zinc-50 dark:bg-zinc-950 items-center justify-center">
        <p className="text-sm text-zinc-400">Loading…</p>
      </div>
    }>
      <InviteContent />
    </Suspense>
  );
}
