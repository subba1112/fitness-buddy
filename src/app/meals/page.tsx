"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Utensils, ArrowLeft, Sparkles, Save, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// Default daily target — matches the profile-setup wizard defaults
const DEFAULT_CALORIE_TARGET = 2000;

type MealType = "breakfast" | "lunch" | "snacks" | "dinner";

type MealLog = {
  meal_type: MealType;
  description: string;
  calories: number;
};

const MEAL_TYPES: { key: MealType; label: string }[] = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "snacks", label: "Snacks" },
  { key: "dinner", label: "Dinner" },
];

function toLocalDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function MealsPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<Record<MealType, MealLog | null>>({
    breakfast: null,
    lunch: null,
    snacks: null,
    dinner: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
      const today = toLocalDateString(new Date());
      const { data, error: fetchError } = await supabase
        .from("meal_logs")
        .select("meal_type, description, calories")
        .eq("user_id", user.id)
        .eq("log_date", today);
      if (fetchError) {
        setError(fetchError.message);
        return;
      }
      const grouped: Record<MealType, MealLog | null> = {
        breakfast: null,
        lunch: null,
        snacks: null,
        dinner: null,
      };
      for (const row of (data as MealLog[]) || []) {
        grouped[row.meal_type] = row;
      }
      setLogs(grouped);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load meals");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalCalories = Object.values(logs).reduce(
    (sum, log) => sum + (log?.calories || 0),
    0,
  );
  const percent = Math.min(
    100,
    Math.round((totalCalories / DEFAULT_CALORIE_TARGET) * 100),
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
          <Utensils className="h-6 w-6 text-orange-400" />
          <h1 className="text-2xl font-bold text-white">Calories In</h1>
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl">
        {/* Daily total card */}
        <div className="mb-6 rounded-3xl border border-primary/60 bg-card/70 p-8 shadow-[0_0_60px_rgba(157,78,221,0.2)]">
          <p className="text-xs font-semibold uppercase tracking-widest text-lavender/70">
            Today
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-6xl font-bold text-white">
              {totalCalories.toLocaleString()}
            </span>
            <span className="text-xl font-semibold text-lavender/70">
              / {DEFAULT_CALORIE_TARGET.toLocaleString()} kcal
            </span>
          </div>
          <div className="mt-6 h-3 w-full overflow-hidden rounded-full bg-space/70">
            <div
              className="h-full rounded-full bg-orange-400 transition-all duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-lavender/70">
            {percent}% of daily target
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-emergency/50 bg-emergency/10 p-3 text-sm text-emergency">
            {error}
          </div>
        )}

        {/* One card per meal type */}
        {loading ? (
          <p className="text-sm text-lavender/60">Loading...</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {MEAL_TYPES.map(({ key, label }) => (
              <MealCard
                key={key}
                mealType={key}
                label={label}
                initialLog={logs[key]}
                onSaved={loadData}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// One editable card per meal type
function MealCard({
  mealType,
  label,
  initialLog,
  onSaved,
}: {
  mealType: MealType;
  label: string;
  initialLog: MealLog | null;
  onSaved: () => Promise<void>;
}) {
  const [description, setDescription] = useState(initialLog?.description || "");
  const [calories, setCalories] = useState<number | null>(
    initialLog?.calories ?? null,
  );
  const [estimating, setEstimating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Reset if the parent reloads new data (e.g. after delete)
  useEffect(() => {
    setDescription(initialLog?.description || "");
    setCalories(initialLog?.calories ?? null);
  }, [initialLog]);

  async function handleEstimate() {
    setError("");
    if (!description.trim()) {
      setError("Type what you ate first");
      return;
    }
    setEstimating(true);
    try {
      const res = await fetch("/api/estimate-calories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Estimation failed");
        return;
      }
      setCalories(data.calories);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Estimation failed");
    } finally {
      setEstimating(false);
    }
  }

  async function handleSave() {
    setError("");
    if (calories === null) {
      setError("Estimate calories first");
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const today = toLocalDateString(new Date());
      const { error: upsertError } = await supabase.from("meal_logs").upsert(
        {
          user_id: user.id,
          log_date: today,
          meal_type: mealType,
          description,
          calories,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,log_date,meal_type" },
      );
      if (upsertError) {
        setError(upsertError.message);
        return;
      }
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    setError("");
    if (!initialLog) {
      setDescription("");
      setCalories(null);
      return;
    }
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const today = toLocalDateString(new Date());
      const { error: deleteError } = await supabase
        .from("meal_logs")
        .delete()
        .eq("user_id", user.id)
        .eq("log_date", today)
        .eq("meal_type", mealType);
      if (deleteError) {
        setError(deleteError.message);
        return;
      }
      setDescription("");
      setCalories(null);
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Clear failed");
    }
  }

  return (
    <div className="rounded-2xl border border-primary/40 bg-card/60 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-lavender">
          {label}
        </h3>
        {calories !== null && (
          <span className="rounded-full bg-orange-400/20 px-3 py-1 text-sm font-bold text-orange-400">
            {calories} kcal
          </span>
        )}
      </div>

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="e.g. 2 chapati, dal, small bowl of rice"
        rows={3}
        className="w-full resize-none rounded-xl border border-primary/30 bg-space/60 px-4 py-3 text-sm text-white placeholder:text-lavender/40 focus:border-primary focus:outline-none"
      />

      {error && (
        <p className="mt-2 text-xs text-emergency">{error}</p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={handleEstimate}
          disabled={estimating || !description.trim()}
          className="inline-flex items-center gap-2 rounded-full border-2 border-orange-400/60 bg-orange-400/10 px-4 py-2 text-xs font-semibold tracking-widest text-orange-400 hover:bg-orange-400/20 disabled:opacity-40"
        >
          <Sparkles className="h-3 w-3" />
          {estimating ? "ESTIMATING..." : "ESTIMATE"}
        </button>
        <button
          onClick={handleSave}
          disabled={saving || calories === null}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold tracking-widest text-white hover:bg-highlight disabled:opacity-40 shadow-[0_0_15px_rgba(157,78,221,0.3)]"
        >
          <Save className="h-3 w-3" />
          {saving ? "SAVING..." : "SAVE"}
        </button>
        {initialLog && (
          <button
            onClick={handleClear}
            className="inline-flex items-center gap-2 rounded-full border-2 border-primary/30 px-4 py-2 text-xs font-semibold tracking-widest text-lavender/70 hover:border-emergency/60 hover:text-emergency"
          >
            <Trash2 className="h-3 w-3" />
            CLEAR
          </button>
        )}
      </div>
    </div>
  );
}
