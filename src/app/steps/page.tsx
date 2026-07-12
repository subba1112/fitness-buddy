"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Footprints, ArrowLeft, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const DAILY_TARGET = 10000;

type StepLog = {
  log_date: string; // 'YYYY-MM-DD'
  steps: number;
};

// Format a Date as YYYY-MM-DD in local time (not UTC)
function toLocalDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getLast7Dates(): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dates.push(toLocalDateString(d));
  }
  return dates;
}

function getDayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

export default function StepsPage() {
  const router = useRouter();
  const [inputSteps, setInputSteps] = useState("");
  const [todaySteps, setTodaySteps] = useState(0);
  const [weekLogs, setWeekLogs] = useState<StepLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

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

      const last7 = getLast7Dates();
      const startDate = last7[0];
      const endDate = last7[6];

      const { data, error: fetchError } = await supabase
        .from("step_logs")
        .select("log_date, steps")
        .eq("user_id", user.id)
        .gte("log_date", startDate)
        .lte("log_date", endDate);

      if (fetchError) {
        setError(fetchError.message);
        return;
      }

      const logs = (data as StepLog[]) || [];
      setWeekLogs(logs);
      const today = toLocalDateString(new Date());
      const todayLog = logs.find((log) => log.log_date === today);
      setTodaySteps(todayLog?.steps || 0);
      setInputSteps(todayLog ? String(todayLog.steps) : "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleSave() {
    setError("");
    setSaveMessage("");
    const steps = parseInt(inputSteps, 10);
    if (isNaN(steps) || steps < 0) {
      setError("Please enter a valid number of steps");
      return;
    }
    setSaving(true);
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
      const { error: upsertError } = await supabase.from("step_logs").upsert(
        {
          user_id: user.id,
          log_date: today,
          steps,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,log_date" },
      );
      if (upsertError) {
        setError(upsertError.message);
        setSaving(false);
        return;
      }
      setSaveMessage("Saved!");
      setTimeout(() => setSaveMessage(""), 2000);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const percent = Math.min(100, Math.round((todaySteps / DAILY_TARGET) * 100));
  const last7 = getLast7Dates();
  const maxSteps = Math.max(DAILY_TARGET, ...weekLogs.map((l) => l.steps));

  return (
    <div className="flex flex-1 flex-col px-6 py-8 md:px-12">
      {/* Header with back link */}
      <div className="mb-8 flex items-center gap-3">
        <Link
          href="/dashboard"
          className="rounded-full border-2 border-primary/40 p-2 text-lavender hover:border-primary hover:text-white"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex items-center gap-2">
          <Footprints className="h-6 w-6 text-green-400" />
          <h1 className="text-2xl font-bold text-white">Steps</h1>
        </div>
      </div>

      <div className="mx-auto w-full max-w-2xl">
        {/* Today's progress card */}
        <div className="mb-6 rounded-3xl border border-primary/60 bg-card/70 p-8 shadow-[0_0_60px_rgba(157,78,221,0.2)]">
          <p className="text-xs font-semibold uppercase tracking-widest text-lavender/70">
            Today
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-6xl font-bold text-white">
              {todaySteps.toLocaleString()}
            </span>
            <span className="text-xl font-semibold text-lavender/70">
              / {DAILY_TARGET.toLocaleString()}
            </span>
          </div>
          <div className="mt-6 h-3 w-full overflow-hidden rounded-full bg-space/70">
            <div
              className="h-full rounded-full bg-green-400 transition-all duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-lavender/70">
            {percent}% of daily target
          </p>
        </div>

        {/* Input */}
        <div className="mb-8">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-lavender/70">
            Enter today&apos;s steps
          </label>
          <div className="flex gap-3">
            <input
              type="number"
              min="0"
              value={inputSteps}
              onChange={(e) => setInputSteps(e.target.value)}
              placeholder="10000"
              className="flex-1 rounded-xl border border-primary/40 bg-space/60 px-4 py-3 text-white placeholder:text-lavender/40 focus:border-primary focus:outline-none"
            />
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 font-semibold text-white shadow-[0_0_20px_rgba(157,78,221,0.3)] hover:bg-highlight disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? "SAVING..." : "SAVE"}
            </button>
          </div>
          {saveMessage && (
            <p className="mt-2 text-sm text-green-400">{saveMessage}</p>
          )}
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-emergency/50 bg-emergency/10 p-3 text-sm text-emergency">
            {error}
          </div>
        )}

        {/* 7-day chart */}
        <div>
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-lavender/70">
            Last 7 days
          </p>
          {loading ? (
            <p className="text-sm text-lavender/60">Loading...</p>
          ) : (
            <div
              className="flex items-end justify-between gap-2 rounded-2xl border border-primary/40 bg-space/40 p-4"
              style={{ height: "180px" }}
            >
              {last7.map((date) => {
                const log = weekLogs.find((l) => l.log_date === date);
                const steps = log?.steps || 0;
                const heightPercent = Math.max(2, (steps / maxSteps) * 100);
                const isToday = date === toLocalDateString(new Date());
                return (
                  <div
                    key={date}
                    className="flex flex-1 flex-col items-center gap-2"
                  >
                    <div className="flex w-full flex-1 items-end">
                      <div
                        className={`w-full rounded-t-lg transition-all ${
                          isToday ? "bg-green-400" : "bg-green-400/40"
                        }`}
                        style={{ height: `${heightPercent}%` }}
                        title={`${steps.toLocaleString()} steps`}
                      />
                    </div>
                    <span
                      className={`text-xs font-semibold ${
                        isToday ? "text-white" : "text-lavender/60"
                      }`}
                    >
                      {getDayLabel(date)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
