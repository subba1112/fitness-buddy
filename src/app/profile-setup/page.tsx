"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Target,
  User as UserIcon,
  HeartPulse,
  Brain,
  Sparkles,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";

// ─── Options for the multi-select steps ──────────────────────────────
const GOAL_OPTIONS = [
  "Weight Loss",
  "Control Cravings",
  "Food Addiction Support",
  "Calorie Tracking",
  "Muscle Gain",
  "Stress Reduction",
  "Better Sleep",
  "Build Habits",
];

const HEALTH_OPTIONS = [
  "PCOD / PCOS",
  "Diabetes",
  "High BP",
  "Asthma",
  "Thyroid",
  "High Cholesterol",
  "Heart Condition",
  "None of these",
];

const MENTAL_OPTIONS = [
  "Anxiety",
  "Food Addiction",
  "Lack of Control",
  "Chronic Stress",
  "Sleep Deprivation",
  "Low Mood",
  "Emotional Eating",
  "None of these",
];

const ACTIVITY_LEVELS = [
  { value: "sedentary", label: "Sedentary", multiplier: 1.2 },
  { value: "lightly_active", label: "Lightly active", multiplier: 1.375 },
  { value: "moderately_active", label: "Moderately active", multiplier: 1.55 },
  { value: "very_active", label: "Very active", multiplier: 1.725 },
  { value: "extra_active", label: "Extra active", multiplier: 1.9 },
];

const GENDERS = ["Female", "Male", "Non-binary", "Prefer not to say"];

// ─── The math ────────────────────────────────────────────────────────
// BMI = weight (kg) / height (m)^2
// BMR (Mifflin-St Jeor): base calories to keep the body running at rest
// TDEE = BMR × activity multiplier — the "maintain" number
// Weight loss = TDEE − 300 (moderate deficit). Muscle gain = TDEE + 300.
function calculatePlan(
  age: number,
  gender: string,
  heightCm: number,
  weightKg: number,
  activityLevel: string,
  goals: string[],
) {
  const heightM = heightCm / 100;
  const bmi = Math.round((weightKg / (heightM * heightM)) * 10) / 10;

  let bmiCategory = "Normal";
  if (bmi < 18.5) bmiCategory = "Underweight";
  else if (bmi >= 25 && bmi < 30) bmiCategory = "Overweight";
  else if (bmi >= 30) bmiCategory = "Obese";

  const isFemale = gender === "Female";
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + (isFemale ? -161 : 5);
  const activity = ACTIVITY_LEVELS.find((a) => a.value === activityLevel);
  const tdee = Math.round(bmr * (activity?.multiplier || 1.375));

  let eatPerDay = tdee;
  if (goals.includes("Weight Loss")) eatPerDay = tdee - 300;
  else if (goals.includes("Muscle Gain")) eatPerDay = tdee + 300;

  return {
    bmi,
    bmiCategory,
    maintain: tdee,
    eatPerDay: Math.round(eatPerDay),
    burnPerDay: 400,
    stepsTarget: 10000,
    waterLiters: 3.0,
  };
}

// ─── The page component ──────────────────────────────────────────────
export default function ProfileSetupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState("friend");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Form data
  const [goals, setGoals] = useState<string[]>([]);
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [activityLevel, setActivityLevel] = useState("");
  const [healthConditions, setHealthConditions] = useState<string[]>([]);
  const [mentalConditions, setMentalConditions] = useState<string[]>([]);

  // Load user's name when the page mounts, so we can say "Hey Subba"
  useEffect(() => {
    async function loadName() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      const nameFromMeta =
        typeof user.user_metadata?.name === "string"
          ? user.user_metadata.name
          : "";
      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .maybeSingle();
      setDisplayName(profile?.name || nameFromMeta || "friend");
    }
    loadName();
  }, [router]);

  // Toggle helper for multi-select chips
  function toggle(
    list: string[],
    setList: (l: string[]) => void,
    value: string,
  ) {
    if (list.includes(value)) setList(list.filter((v) => v !== value));
    else setList([...list, value]);
  }

  // Only compute the plan once all inputs are ready
  const plan =
    age && gender && heightCm && weightKg && activityLevel
      ? calculatePlan(
          Number(age),
          gender,
          Number(heightCm),
          Number(weightKg),
          activityLevel,
          goals,
        )
      : null;

  async function handleFinish() {
    setLoading(true);
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
      // upsert = insert if new, update if a row already exists for this user
      const { error: upsertError } = await supabase.from("profiles").upsert({
        id: user.id,
        age: Number(age),
        gender,
        height_cm: Number(heightCm),
        weight_kg: Number(weightKg),
        activity_level: activityLevel,
        goals,
        health_conditions: healthConditions,
        mental_conditions: mentalConditions,
        updated_at: new Date().toISOString(),
      });
      if (upsertError) {
        setError(upsertError.message);
        setLoading(false);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong";
      setError(`${message}. Please try again.`);
      setLoading(false);
    }
  }

  // Guard so you can't advance without filling in the current step
  const canGoNext =
    (step === 1 && goals.length > 0) ||
    (step === 2 &&
      Boolean(
        age && gender && heightCm && weightKg && activityLevel,
      )) ||
    (step === 3 && healthConditions.length > 0) ||
    (step === 4 && mentalConditions.length > 0) ||
    step === 5;

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-2xl rounded-3xl border border-primary/60 bg-card/70 p-8 shadow-[0_0_60px_rgba(157,78,221,0.25)]">
        {/* Progress bar */}
        <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-primary/20">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${(step / 5) * 100}%` }}
          />
        </div>
        <p className="mb-6 text-xs font-semibold uppercase tracking-widest text-lavender/70">
          Step {step} of 5
        </p>

        {/* Step 1: Goals */}
        {step === 1 && (
          <div>
            <div className="mb-2 flex items-center gap-3">
              <Target className="h-6 w-6 text-highlight" />
              <h2 className="text-2xl font-bold text-white">
                Hey {displayName}, what are your goals?
              </h2>
            </div>
            <p className="mb-8 text-sm text-lavender/80">
              Pick your top priorities. We&apos;ll build your plan around them.
            </p>
            <div className="flex flex-wrap gap-3">
              {GOAL_OPTIONS.map((option) => (
                <Chip
                  key={option}
                  label={option}
                  active={goals.includes(option)}
                  onClick={() => toggle(goals, setGoals, option)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Personal details */}
        {step === 2 && (
          <div>
            <div className="mb-2 flex items-center gap-3">
              <UserIcon className="h-6 w-6 text-highlight" />
              <h2 className="text-2xl font-bold text-white">
                Tell us a bit about yourself
              </h2>
            </div>
            <p className="mb-8 text-sm text-lavender/80">
              This helps us calculate your daily targets.
            </p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field
                label="Age"
                value={age}
                onChange={setAge}
                type="number"
                placeholder="24"
              />
              <SelectField
                label="Gender"
                value={gender}
                onChange={setGender}
                options={GENDERS}
                placeholder="Select..."
              />
              <Field
                label="Height (cm)"
                value={heightCm}
                onChange={setHeightCm}
                type="number"
                placeholder="162"
              />
              <Field
                label="Weight (kg)"
                value={weightKg}
                onChange={setWeightKg}
                type="number"
                placeholder="58"
              />
              <div className="md:col-span-2">
                <SelectField
                  label="Activity level"
                  value={activityLevel}
                  onChange={setActivityLevel}
                  options={ACTIVITY_LEVELS.map((a) => a.label)}
                  placeholder="Select..."
                  valueMap={Object.fromEntries(
                    ACTIVITY_LEVELS.map((a) => [a.label, a.value]),
                  )}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Health */}
        {step === 3 && (
          <div>
            <div className="mb-2 flex items-center gap-3">
              <HeartPulse className="h-6 w-6 text-highlight" />
              <h2 className="text-2xl font-bold text-white">
                Any health conditions?
              </h2>
            </div>
            <p className="mb-8 text-sm text-lavender/80">
              Select all that apply — this helps us personalize your plan.
            </p>
            <div className="flex flex-wrap gap-3">
              {HEALTH_OPTIONS.map((option) => (
                <Chip
                  key={option}
                  label={option}
                  active={healthConditions.includes(option)}
                  onClick={() =>
                    toggle(healthConditions, setHealthConditions, option)
                  }
                />
              ))}
            </div>
          </div>
        )}

        {/* Step 4: Mental */}
        {step === 4 && (
          <div>
            <div className="mb-2 flex items-center gap-3">
              <Brain className="h-6 w-6 text-highlight" />
              <h2 className="text-2xl font-bold text-white">
                How are you feeling mentally?
              </h2>
            </div>
            <p className="mb-8 text-sm text-lavender/80">
              No judgment. Your buddy will adapt to how you are.
            </p>
            <div className="flex flex-wrap gap-3">
              {MENTAL_OPTIONS.map((option) => (
                <Chip
                  key={option}
                  label={option}
                  active={mentalConditions.includes(option)}
                  onClick={() =>
                    toggle(mentalConditions, setMentalConditions, option)
                  }
                />
              ))}
            </div>
          </div>
        )}

        {/* Step 5: Plan */}
        {step === 5 && plan && (
          <div>
            <div className="mb-2 flex items-center gap-3">
              <Sparkles className="h-6 w-6 text-highlight" />
              <h2 className="text-2xl font-bold text-white">
                Here&apos;s your plan, {displayName}!
              </h2>
            </div>
            <p className="mb-8 text-sm text-lavender/80">
              You can fine-tune these anytime in Settings.
            </p>

            <div className="mb-4 flex items-center justify-between rounded-2xl border border-primary/40 bg-space/40 p-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-lavender/70">
                  BMI
                </p>
                <p className="mt-1 text-4xl font-bold text-white">{plan.bmi}</p>
              </div>
              <span className="rounded-full bg-green-500/20 px-4 py-1.5 text-sm font-semibold text-green-400">
                {plan.bmiCategory}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <StatCard
                label="Maintain"
                value={plan.maintain.toLocaleString()}
                unit="kcal"
                tint="text-highlight"
              />
              <StatCard
                label="Eat / day"
                value={plan.eatPerDay.toLocaleString()}
                unit="kcal"
                tint="text-orange-400"
              />
              <StatCard
                label="Burn / day"
                value={plan.burnPerDay.toString()}
                unit="kcal"
                tint="text-pink"
              />
              <StatCard
                label="Steps"
                value={plan.stepsTarget.toLocaleString()}
                unit="daily"
                tint="text-green-400"
              />
              <StatCard
                label="Water"
                value={plan.waterLiters.toFixed(1)}
                unit="L"
                tint="text-cyan"
              />
            </div>
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-xl border border-emergency/50 bg-emergency/10 p-3 text-sm text-emergency">
            {error}
          </div>
        )}

        {/* Navigation buttons */}
        <div className="mt-8 flex items-center justify-between gap-4">
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="inline-flex items-center gap-2 rounded-full border-2 border-primary px-6 py-3 text-sm font-semibold tracking-widest text-white hover:bg-primary/10"
            >
              <ArrowLeft className="h-4 w-4" />
              BACK
            </button>
          ) : (
            <div />
          )}
          {step < 5 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canGoNext}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold tracking-widest text-white shadow-[0_0_20px_rgba(157,78,221,0.4)] hover:bg-highlight disabled:opacity-40"
            >
              NEXT
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold tracking-widest text-white shadow-[0_0_20px_rgba(157,78,221,0.4)] hover:bg-highlight disabled:opacity-50"
            >
              {loading ? "SAVING..." : "LET'S GO"}
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Little building blocks used above ───────────────────────────────
function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border-2 px-4 py-2 text-sm font-semibold transition-colors ${
        active
          ? "border-primary bg-primary text-white shadow-[0_0_15px_rgba(157,78,221,0.5)]"
          : "border-primary/40 bg-transparent text-lavender/80 hover:border-primary"
      }`}
    >
      {label}
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-lavender/70">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-primary/40 bg-space/60 px-4 py-3 text-white placeholder:text-lavender/40 focus:border-primary focus:outline-none"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  valueMap,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  valueMap?: Record<string, string>;
}) {
  // valueMap lets us show a friendly label but store a machine key
  // (e.g., show "Lightly active" but store "lightly_active")
  const displayValue = valueMap
    ? Object.entries(valueMap).find(([, v]) => v === value)?.[0] || ""
    : value;

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const selected = e.target.value;
    if (valueMap && valueMap[selected]) onChange(valueMap[selected]);
    else onChange(selected);
  }

  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-lavender/70">
        {label}
      </label>
      <select
        value={displayValue}
        onChange={handleChange}
        className="w-full rounded-xl border border-primary/40 bg-space/60 px-4 py-3 text-white focus:border-primary focus:outline-none"
      >
        <option value="" className="bg-space text-lavender">
          {placeholder || "Select..."}
        </option>
        {options.map((o) => (
          <option key={o} value={o} className="bg-space text-white">
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

function StatCard({
  label,
  value,
  unit,
  tint,
}: {
  label: string;
  value: string;
  unit: string;
  tint: string;
}) {
  return (
    <div className="rounded-xl border border-primary/40 bg-space/40 p-4">
      <p
        className={`text-xs font-semibold uppercase tracking-widest ${tint}`}
      >
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-lavender/60">{unit}</p>
    </div>
  );
}
