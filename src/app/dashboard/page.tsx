import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "./logout-button";

export default async function DashboardPage() {
  const supabase = await createClient();

  // Check who's logged in
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Grab the name we stashed in user_metadata at signup time
  const metadataName =
    typeof user.user_metadata?.name === "string"
      ? user.user_metadata.name
      : undefined;

  // Look for an existing profiles row (may not exist yet)
  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", user.id)
    .maybeSingle();

  // Self-heal: if the profile row is missing but we have a name from
  // signup metadata, create it now. Works whether or not the DB trigger fired.
  if (!profile && metadataName) {
    await supabase.from("profiles").insert({
      id: user.id,
      name: metadataName,
    });
  }

  const displayName = profile?.name || metadataName || "friend";

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg text-center">
        <h1 className="mb-4 text-4xl md:text-5xl font-bold text-white">
          Hey {displayName} 👋
        </h1>
        <p className="mb-8 text-lavender/80 text-lg">
          Your dashboard will live here. Coming next: your daily trackers.
        </p>
        <p className="mb-10 text-sm text-lavender/60">
          Logged in as{" "}
          <span className="font-mono text-highlight">{user.email}</span>
        </p>
        <LogoutButton />
      </div>
    </div>
  );
}
