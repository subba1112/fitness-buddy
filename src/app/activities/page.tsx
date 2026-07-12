"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Flame, ArrowLeft, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const DAILY_TARGET_KCAL = 400;

// Common activities with MET values (Metabolic Equivalent of Task).
// calories = MET × weight_kg × (duration_mins / 60)
const ACTIVITIES: { name: string; met: number }[] = [
  { name: "Walking (slow)", met: 2.5 },
  { name: "Walking (moderate)", met: 3.5 },
  { name: "Walking (brisk)", met: 5.0 },
  { name: "Running (jog)", met: 7.0 },
  { name: "Running (fast)", met: 11.5 },
  { name: "Cycling (leisurely)", met: 4.0 },
  { name: "Cycling (moderate)", met: 8.0 },
  { name: "Cycling (vigorous)", met: 12.0 },
  { name: "Swimming (leisurely)", met: 6.0 },
  { name: "Swimming (laps)", met: 8.0 },
  { name: "Yoga", met: 2.5 },
  { name: "Pilates", met: 3.0 },
  { name: "Dancing", met: 4.5 },
  { name: "Zumba", met: 6.5 },
  { name: "Aerobics", met: 6.5 },
  { name: "Weight lifting", met: 3.5 },
  { name: "HIIT", met: 8.0 },
  { name: "CrossFit", met: 8.0 },
  { name: "Basketball", met: 8.0 },
  { name: "Tennis", met: 7.0 },
  { name: "Football", met: 8.0 },
  { name: "Hiking", met: 6.0 },
  { name: "Jump rope", met: 12.0 },
  { name: "Skipping", met: 12.0 },
  { name: "Stair climbing", met: 8.0 },
  { name: "Rowing", met: 7.0 },
  { name: "Boxing", met: 9.0 },
  { name: "Kickboxing", met: 7.0 },
  { name: "Skating", met: 7.0 },
  { name: "Tai chi", met: 3.0 },
  { name: "Elliptical", met: 5.0 },
  { name: "Rowing machine", met: 7.0 },
  { name: "House cleaning", met: 3.5 },
  { name: "Gardening", met: 4.0 },
];

type ActivityLog = {
  id: string;
  activity_name: string;
  duration_mins: number;
  calories_burnt: number;
  logged_at: string;
};

function estimateCalories(met: number, weightKg: number, minutes: number) {
  return Math.round(met * weightKg * (minutes / 60));
}

export default function ActivitiesPage() {
  const router = useRouter();
  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [todayLogs, setTodayLogs] = useState<ActivityLog[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedActivity, setSelectedActivity] = useState<{
    name: string;
    met: number;
  } | null>(null);
  const [duration, setDuration] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function getTodayRange() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return { start: start.toISOString(), end: end.toISOString() };
  }

  const loadData = useCallback(async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      // Weight from the profile — needed for calorie calculation
      const { data: profile } = await supabase
        .from("profiles")
        .select("weight_kg")
        .eq("id", user.id)
        .maybeSingle();
      setWeightKg(profile?.weight_kg ?? null);

      // Today's activity logs
      const { start, end } = getTodayRange();
      const { data, error: fetchError } = await supabase
        .from("activity_logs")
        .select("id, activity_name, duration_mins, calories_burnt, logged_at")
        .eq("user_id", user.id)
        .gte("logged_at", start)
        .lt("logged_at", end)
        .order("logged_at", { ascending: false });
      if (fetchError) {
        setError(fetchError.message);
        return;
      }
      setTodayLogs(data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredActivities = searchQuery
    ? ACTIVITIES.filter((a) =>
        a.name.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : ACTIVITIES;

  // Live-computed calorie preview
  const durationNum = parseInt(duration, 10);
  const estimatedCalories =
    selectedActivity && weightKg && !isNaN(durationNum) && durationNum > 0
      ? estimateCalories(selectedActivity.met, weightKg, durationNum)
      : null;

  async function handleAdd() {
    setError("");
    if (!selectedActivity) {
      setError("Pick an activity first");
      return;
    }
    if (!weightKg) {
      setError(
        "Set your weight in Profile Setup before logging activities",
      );
      return;
    }
    if (isNaN(durationNum) || durationNum <= 0) {
      setError("Enter a valid duration in minutes");
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const calories = estimateCalories(
        selectedActivity.met,
        weightKg,
        durationNum,
      );
      const { error: insertError } = await supabase
        .from("activity_logs")
        .insert({
          user_id: user.id,
          activity_name: selectedActivity.name,
          duration_mins: durationNum,
          calories_burnt: calories,
        });
      if (insertError) {
        setError(insertError.message);
        return;
      }
      // Reset the form
      setSelectedActivity(null);
      setSearchQuery("");
      setDuration("");
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const supabase = createClient();
      await supabase.from("activity_logs").delete().eq("id", id);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  const totalCalories = todayLogs.reduce(
    (sum, log) => sum + log.calories_burnt,
    0,
  );
  const percent = Math.min(
    100,
    Math.round((totalCalories / DAILY_TARGET_KCAL) * 100),
  );

  return (
    <div className="flex flex-1 flex-col px-6 py-8 md:px-12">
      {/* Header */}
      <div className="mb-8 flex items-center gap-3">
        <Link
          href="/dashboard"
          className="rounded-full border-2 border-primary/40 p-2 text-lavender hover:border-primary hover:text-white"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex items-center gap-2">
          <Flame className="h-6 w-6 text-pink" />
          <h1 className="text-2xl font-bold text-white">Calories Out</h1>
        </div>
      </div>

      <div className="mx-auto w-full max-w-2xl">
        {/* Today total */}
        <div className="mb-6 rounded-3xl border border-primary/60 bg-card/70 p-8 shadow-[0_0_60px_rgba(157,78,221,0.2)]">
          <p className="text-xs font-semibold uppercase tracking-widest text-lavender/70">
            Today
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-6xl font-bold text-white">
              {totalCalories}
            </span>
            <span className="text-xl font-semibold text-lavender/70">
              / {DAILY_TARGET_KCAL} kcal
            </span>
          </div>
          <div className="mt-6 h-3 w-full overflow-hidden rounded-full bg-space/70">
            <div
              className="h-full rounded-full bg-pink transition-all duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-lavender/70">
            {percent}% of daily target
            {weightKg && (
              <span className="ml-2 text-lavender/50">
                · your weight: {weightKg} kg
              </span>
            )}
          </p>
        </div>

        {/* Add activity form */}
        <div className="mb-8 rounded-2xl border border-primary/40 bg-card/40 p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-lavender/70">
            Log activity
          </p>

          <div className="mb-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSelectedActivity(null);
              }}
              placeholder="Search: running, yoga, cycling..."
              className="w-full rounded-xl border border-primary/40 bg-space/60 px-4 py-3 text-white placeholder:text-lavender/40 focus:border-primary focus:outline-none"
            />
          </div>

          {/* Autocomplete list (only when typing and no selection) */}
          {searchQuery && !selectedActivity && (
            <div className="mb-3 max-h-40 overflow-y-auto rounded-xl border border-primary/30 bg-space/80">
              {filteredActivities.length === 0 ? (
                <p className="p-3 text-sm text-lavender/60">
                  No matches. Try a different word.
                </p>
              ) : (
                filteredActivities.map((a) => (
                  <button
                    key={a.name}
                    onClick={() => {
                      setSelectedActivity(a);
                      setSearchQuery(a.name);
                    }}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-lavender hover:bg-primary/20"
                  >
                    <span>{a.name}</span>
                    <span className="text-xs text-lavender/60">
                      MET {a.met}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}

          <div className="mb-3 flex gap-3">
            <input
              type="number"
              min="1"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="Duration (mins)"
              className="flex-1 rounded-xl border border-primary/40 bg-space/60 px-4 py-3 text-white placeholder:text-lavender/40 focus:border-primary focus:outline-none"
            />
            <button
              onClick={handleAdd}
              disabled={saving || !selectedActivity || !duration}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 font-semibold text-white shadow-[0_0_20px_rgba(157,78,221,0.3)] hover:bg-highlight disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
              {saving ? "..." : "ADD"}
            </button>
          </div>

          {/* Live preview */}
          {estimatedCalories !== null && (
            <p className="text-sm text-lavender/80">
              Estimated burn:{" "}
              <span className="font-bold text-pink">
                {estimatedCalories} kcal
              </span>
            </p>
          )}

          {!weightKg && !loading && (
            <p className="mt-2 text-sm text-emergency">
              We need your weight to estimate calories. Complete{" "}
              <Link
                href="/profile-setup"
                className="underline hover:text-white"
              >
                profile setup
              </Link>{" "}
              first.
            </p>
          )}

          {error && (
            <p className="mt-2 text-sm text-emergency">{error}</p>
          )}
        </div>

        {/* Today's logged activities */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-lavender/70">
            Today&apos;s activities
          </p>
          {loading && <p className="text-sm text-lavender/60">Loading...</p>}
          {!loading && todayLogs.length === 0 && (
            <p className="text-sm text-lavender/60">
              No activities logged yet today. Pick one above to start.
            </p>
          )}
          {!loading && todayLogs.length > 0 && (
            <ul className="space-y-2">
              {todayLogs.map((log) => (
                <li
                  key={log.id}
                  className="flex items-center justify-between rounded-xl border border-primary/40 bg-space/40 px-4 py-3"
                >
                  <div className="flex flex-col">
                    <span className="font-semibold text-white">
                      {log.activity_name}
                    </span>
                    <span className="text-xs text-lavender/60">
                      {log.duration_mins} mins ·{" "}
                      {new Date(log.logged_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-pink/20 px-3 py-1 text-sm font-bold text-pink">
                      {log.calories_burnt} kcal
                    </span>
                    <button
                      onClick={() => handleDelete(log.id)}
                      className="rounded-full p-2 text-lavender/60 hover:bg-emergency/10 hover:text-emergency"
                      aria-label="Delete entry"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
