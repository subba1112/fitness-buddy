import { redirect } from "next/navigation";
import Link from "next/link";
import { Droplet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "./logout-button";

const WATER_TARGET_ML = 3000;

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Look up the name from profiles (fall back to signup metadata, then "friend")
  const metadataName =
    typeof user.user_metadata?.name === "string"
      ? user.user_metadata.name
      : undefined;

  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile && metadataName) {
    await supabase.from("profiles").insert({
      id: user.id,
      name: metadataName,
    });
  }

  const displayName = profile?.name || metadataName || "friend";

  // Fetch today's water logs (using server's local day)
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const startOfTomorrow = new Date(
    startOfToday.getTime() + 24 * 60 * 60 * 1000,
  );

  const { data: waterLogs } = await supabase
    .from("water_logs")
    .select("amount_ml")
    .eq("user_id", user.id)
    .gte("logged_at", startOfToday.toISOString())
    .lt("logged_at", startOfTomorrow.toISOString());

  const waterMlToday =
    waterLogs?.reduce((sum, log) => sum + log.amount_ml, 0) || 0;
  const waterLitersToday = waterMlToday / 1000;
  const waterTargetLiters = WATER_TARGET_ML / 1000;
  const waterPercent = Math.min(
    100,
    Math.round((waterMlToday / WATER_TARGET_ML) * 100),
  );

  return (
    <div className="flex flex-1 flex-col px-6 py-8 md:px-12">
      {/* Greeting */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-white">
            Hey {displayName} 👋
          </h1>
          <p className="mt-1 text-sm text-lavender/70">
            Logged in as{" "}
            <span className="font-mono text-highlight">{user.email}</span>
          </p>
        </div>
        <LogoutButton />
      </div>

      {/* Tracker cards grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Water card — live */}
        <Link
          href="/water"
          className="rounded-2xl border border-primary/40 bg-card/60 p-5 transition-all hover:border-cyan/60 hover:shadow-[0_0_25px_rgba(125,249,255,0.15)]"
        >
          <div className="mb-3 flex items-center justify-between">
            <Droplet className="h-6 w-6 text-cyan" />
            <span className="h-2 w-2 rounded-full bg-cyan" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-widest text-lavender/70">
            Water
          </p>
          <p className="mt-2 text-3xl font-bold text-white">
            {waterLitersToday.toFixed(1)}
            <span className="ml-1 text-base font-normal text-lavender/70">
              / {waterTargetLiters.toFixed(1)} L
            </span>
          </p>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-space/60">
            <div
              className="h-full rounded-full bg-cyan transition-all"
              style={{ width: `${waterPercent}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-lavender/60">
            {waterPercent}% of daily target
          </p>
        </Link>

        {/* Placeholder cards for trackers we'll build in 5B/5C/5D */}
        <ComingSoonCard label="Steps" phase="5B" />
        <ComingSoonCard label="Calories In" phase="5C" />
        <ComingSoonCard label="Calories Out" phase="5D" />
      </div>
    </div>
  );
}

function ComingSoonCard({ label, phase }: { label: string; phase: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-primary/30 bg-card/30 p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-lavender/50">
        {label}
      </p>
      <p className="mt-2 text-sm text-lavender/50">Coming in Phase {phase}</p>
    </div>
  );
}
