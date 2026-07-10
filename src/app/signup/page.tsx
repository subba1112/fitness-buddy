"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();

    // Create the auth account; pass the name as metadata so the DB trigger
    // can insert the corresponding profiles row automatically.
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-md rounded-3xl border border-primary/60 bg-card/70 p-8 shadow-[0_0_60px_rgba(157,78,221,0.25)]">
        <div className="mb-6 flex justify-center">
          <div className="rounded-2xl bg-primary/20 p-4">
            <UserPlus className="h-8 w-8 text-highlight" />
          </div>
        </div>

        <h1 className="mb-2 text-center text-2xl font-bold text-white">
          Create Your Account
        </h1>
        <p className="mb-8 text-center text-sm text-lavender/80">
          Start your wellness journey with us.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="mb-1 block text-xs font-semibold uppercase tracking-widest text-lavender/70">
              Full Name
            </label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-primary/40 bg-space/60 px-4 py-3 text-white placeholder:text-lavender/40 focus:border-primary focus:outline-none"
              placeholder="Subba Reddy"
            />
          </div>

          <div>
            <label htmlFor="email" className="mb-1 block text-xs font-semibold uppercase tracking-widest text-lavender/70">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-primary/40 bg-space/60 px-4 py-3 text-white placeholder:text-lavender/40 focus:border-primary focus:outline-none"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-xs font-semibold uppercase tracking-widest text-lavender/70">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-primary/40 bg-space/60 px-4 py-3 text-white placeholder:text-lavender/40 focus:border-primary focus:outline-none"
              placeholder="At least 6 characters"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-emergency/50 bg-emergency/10 p-3 text-sm text-emergency">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-primary py-3 font-semibold tracking-widest text-white transition-colors hover:bg-highlight disabled:opacity-50 shadow-[0_0_30px_rgba(157,78,221,0.4)]"
          >
            {loading ? "CREATING ACCOUNT..." : "SIGN UP"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-lavender/70">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-highlight hover:text-white">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
