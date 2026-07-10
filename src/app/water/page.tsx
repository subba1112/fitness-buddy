"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Droplet, ArrowLeft, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const DAILY_TARGET_ML = 3000;

type WaterLog = {
  id: string;
  amount_ml: number;
  logged_at: string;
};

export default function WaterPage() {
  const router = useRouter();
  const [todayLogs, setTodayLogs] = useState<WaterLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Compute the start/end of today so we can filter to today's entries only
  function getTodayRange() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return { start: start.toISOString(), end: end.toISOString() };
  }

  const loadTodayLogs = useCallback(async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      const { start, end } = getTodayRange();
      const { data, error: fetchError } = await supabase
        .from("water_logs")
        .select("id, amount_ml, logged_at")
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
      setError(e instanceof Error ? e.message : "Failed to load logs");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadTodayLogs();
  }, [loadTodayLogs]);

  async function addWater(amountMl: number) {
    setError("");
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      const { error: insertError } = await supabase.from("water_logs").insert({
        user_id: user.id,
        amount_ml: amountMl,
      });
      if (insertError) {
        setError(insertError.message);
        return;
      }
      await loadTodayLogs();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add water");
    }
  }

  async function removeLog(id: string) {
    setError("");
    try {
      const supabase = createClient();
      const { error: deleteError } = await supabase
        .from("water_logs")
        .delete()
        .eq("id", id);
      if (deleteError) {
        setError(deleteError.message);
        return;
      }
      await loadTodayLogs();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete log");
    }
  }

  const totalMl = todayLogs.reduce((sum, log) => sum + log.amount_ml, 0);
  const totalLiters = totalMl / 1000;
  const targetLiters = DAILY_TARGET_ML / 1000;
  const percent = Math.min(100, Math.round((totalMl / DAILY_TARGET_ML) * 100));

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
          <Droplet className="h-6 w-6 text-cyan" />
          <h1 className="text-2xl font-bold text-white">Water</h1>
        </div>
      </div>

      {/* Main progress card */}
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6 rounded-3xl border border-primary/60 bg-card/70 p-8 shadow-[0_0_60px_rgba(157,78,221,0.2)]">
          <p className="text-xs font-semibold uppercase tracking-widest text-lavender/70">
            Today
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-6xl font-bold text-white">
              {totalLiters.toFixed(1)}
            </span>
            <span className="text-2xl font-semibold text-lavender/70">
              / {targetLiters.toFixed(1)} L
            </span>
          </div>

          {/* Progress bar */}
          <div className="mt-6 h-3 w-full overflow-hidden rounded-full bg-space/70">
            <div
              className="h-full rounded-full bg-cyan transition-all duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-lavender/70">
            {percent}% of daily target
          </p>
        </div>

        {/* Quick-add buttons */}
        <div className="mb-8 grid grid-cols-3 gap-3">
          <QuickAdd label="+250 ml" onClick={() => addWater(250)} />
          <QuickAdd label="+500 ml" onClick={() => addWater(500)} />
          <QuickAdd label="+1 L" onClick={() => addWater(1000)} />
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-emergency/50 bg-emergency/10 p-3 text-sm text-emergency">
            {error}
          </div>
        )}

        {/* Today's log entries */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-lavender/70">
            Today&apos;s log
          </p>
          {loading && (
            <p className="text-sm text-lavender/60">Loading...</p>
          )}
          {!loading && todayLogs.length === 0 && (
            <p className="text-sm text-lavender/60">
              No water logged yet today. Tap a button above to start.
            </p>
          )}
          {!loading && todayLogs.length > 0 && (
            <ul className="space-y-2">
              {todayLogs.map((log) => (
                <li
                  key={log.id}
                  className="flex items-center justify-between rounded-xl border border-primary/40 bg-space/40 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <Droplet className="h-4 w-4 text-cyan" />
                    <span className="font-semibold text-white">
                      {log.amount_ml} ml
                    </span>
                    <span className="text-xs text-lavender/60">
                      {new Date(log.logged_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <button
                    onClick={() => removeLog(log.id)}
                    className="rounded-full p-2 text-lavender/60 hover:bg-emergency/10 hover:text-emergency"
                    aria-label="Delete entry"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function QuickAdd({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-2xl border-2 border-cyan/60 bg-cyan/10 py-4 text-sm font-bold tracking-widest text-white transition-colors hover:bg-cyan/20"
    >
      {label}
    </button>
  );
}
