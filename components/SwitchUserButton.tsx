"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

export default function SwitchUserButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const onSwitch = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();

      // Clear active company selection cookie (prevents stale company redirects for the next user)
      if (typeof document !== "undefined") {
        document.cookie = "stokstak_company_id=; Path=/; Max-Age=0; SameSite=Lax";
      }

      await supabase.auth.signOut();

      // Force navigation to auth; refresh clears any client state.
      router.push("/auth");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onSwitch}
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
      title="Switch user"
    >
      <LogOut className="h-4 w-4" />
      <span className="hidden sm:inline">Switch user</span>
    </button>
  );
}
