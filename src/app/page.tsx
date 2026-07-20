"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MagicLoader } from "@/components/MagicLoader";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // A password-reset email can land here (Supabase falls back to the site
    // root when the redirect URL isn't allow-listed) — carry the recovery
    // code over to the reset page instead of silently signing them in.
    const params = new URLSearchParams(window.location.search);
    if (params.has("code")) {
      router.replace(`/reset-password?code=${encodeURIComponent(params.get("code")!)}`);
      return;
    }
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.replace("/login");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();
      router.replace(profile?.role === "parent" ? "/admin" : "/app");
    });
  }, [router]);

  return <MagicLoader full label="Opening the portal…" />;
}
