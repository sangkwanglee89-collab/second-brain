"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";
import type { GeneratedFile, SharingSetting, Partnership } from "@/lib/types";

type SettingsViewProps = {
  files: GeneratedFile[] | null;
  partnership: Partnership;
  sharingSettings: SharingSetting[];
  inviteCode: string | null;
  userEmail: string;
  onBack: () => void;
  onLogout: () => void;
  onGenerateInvite: () => void;
  onUpdateSharing: (fileName: string, shared: boolean) => void;
};

export default function SettingsView({
  files,
  partnership,
  sharingSettings,
  inviteCode,
  userEmail,
  onBack,
  onLogout,
  onGenerateInvite,
  onUpdateSharing,
}: SettingsViewProps) {
  const [newPassword, setNewPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);

  const supabase = createClient();

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setPasswordMessage("Password must be at least 6 characters.");
      return;
    }
    setPasswordLoading(true);
    setPasswordMessage(null);

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setPasswordMessage(error.message);
    } else {
      setPasswordMessage("Password updated.");
      setNewPassword("");
    }
    setPasswordLoading(false);
  }

  const inviteUrl = inviteCode
    ? `${window.location.origin}/invite?code=${inviteCode}`
    : null;

  return (
    <div className="flex flex-col h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Settings
        </h1>
        <button
          onClick={onBack}
          className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
        >
          Back to Chat
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-lg mx-auto space-y-10">
          {/* Partner Connection */}
          <section>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              Partner Connection
            </h2>
            {partnership ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Connected with <span className="font-medium text-zinc-900 dark:text-zinc-100">{partnership.partnerEmail}</span>
              </p>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  No partner connected. Generate an invite link to share.
                </p>
                <button
                  onClick={onGenerateInvite}
                  className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-xs font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
                >
                  Generate Invite Link
                </button>
                {inviteUrl && (
                  <div className="mt-3 p-3 bg-zinc-100 dark:bg-zinc-900 rounded-lg">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
                      Send this link to your partner:
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={inviteUrl}
                        className="flex-1 text-xs bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded px-2 py-1.5 text-zinc-700 dark:text-zinc-300"
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(inviteUrl);
                          alert("Link copied!");
                        }}
                        className="rounded bg-zinc-900 dark:bg-zinc-100 px-3 py-1.5 text-xs font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Sharing Controls */}
          {files && (
            <section>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
                Sharing Controls
              </h2>
              <p className="text-xs text-zinc-400 dark:text-zinc-600 mb-4">
                Choose which files your partner can see when talking to your avatar.
              </p>
              <div className="space-y-2">
                {files.map((file) => {
                  const setting = sharingSettings.find((s) => s.file_name === file.name);
                  const isShared = setting?.shared || false;
                  return (
                    <label
                      key={file.name}
                      className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
                    >
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">
                        {file.name}
                      </span>
                      <input
                        type="checkbox"
                        checked={isShared}
                        onChange={(e) => onUpdateSharing(file.name, e.target.checked)}
                        className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-zinc-900 focus:ring-zinc-500"
                      />
                    </label>
                  );
                })}
              </div>
            </section>
          )}

          {/* Account */}
          <section>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              Account
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
              {userEmail}
            </p>

            <form onSubmit={handleChangePassword} className="mb-4">
              <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-2">
                Change password
              </label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password (min 6 characters)"
                  minLength={6}
                  className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600"
                />
                <button
                  type="submit"
                  disabled={passwordLoading || !newPassword}
                  className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-xs font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 disabled:opacity-40 transition-colors"
                >
                  {passwordLoading ? "…" : "Update"}
                </button>
              </div>
              {passwordMessage && (
                <p className={`text-xs mt-2 ${passwordMessage === "Password updated." ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                  {passwordMessage}
                </p>
              )}
            </form>

            <button
              onClick={onLogout}
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
            >
              Log Out
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
