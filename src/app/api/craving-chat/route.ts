import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type CraveMessage = {
  role: "user" | "assistant";
  content: string;
};

type Profile = {
  name: string | null;
  age: number | null;
  gender: string | null;
  goals: string[] | null;
  health_conditions: string[] | null;
  mental_conditions: string[] | null;
};

// Build the system prompt from the user's profile so the bot knows who it's talking to
function buildSystemPrompt(profile: Profile | null): string {
  const name = profile?.name || "friend";
  const parts: string[] = [];

  parts.push(
    `You are the Crave Killer — a warm, patient companion helping ${name} through a craving moment. This is a real, difficult moment for them.`,
  );

  if (profile) {
    parts.push("\nWhat you know about them:");
    if (profile.age) parts.push(`- Age: ${profile.age}`);
    if (profile.gender) parts.push(`- Gender: ${profile.gender}`);
    if (profile.goals?.length)
      parts.push(`- Their goals: ${profile.goals.join(", ")}`);
    if (profile.health_conditions?.length)
      parts.push(
        `- Health conditions: ${profile.health_conditions.join(", ")}`,
      );
    if (profile.mental_conditions?.length)
      parts.push(
        `- Mental state they shared: ${profile.mental_conditions.join(", ")}`,
      );
  }

  parts.push(`
How to help them:
1. FIRST: acknowledge the feeling without judgment. Ask them to take one slow deep breath.
2. Ask what triggered this craving: stress, boredom, habit, or actual hunger?
3. If it's not real hunger, help them ride the wave — cravings peak in 15-20 minutes and pass.
4. If they seem genuinely hungry, suggest a specific healthy option that fits their conditions and goals.
5. Ask them: "How would you feel in 15 minutes if you resisted? vs. if you gave in?"
6. Remind them of their goals when it feels supportive, never preachy.

Tone rules:
- Short messages: 2-4 sentences per reply. This is a chat, not a lecture.
- Warm and human — like a wise friend, not a nutritionist or therapist.
- Never shame. Never scold. If they gave in, help them plan for next time.
- If they type just "give me a recipe" or ask for food ideas, help — you're not the food police.
- Ask one question at a time so they can actually answer.
`);

  return parts.join("\n");
}

// Call Gemini with the full conversation
async function callGemini(
  systemPrompt: string,
  history: CraveMessage[],
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const geminiResponse = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: history.map((m) => ({
          // Gemini uses "model" for assistant messages
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 300,
        },
      }),
    },
  );

  if (!geminiResponse.ok) {
    const text = await geminiResponse.text();
    console.error("Gemini API error:", text);
    throw new Error("AI service unavailable");
  }

  const data = await geminiResponse.json();
  const reply =
    data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
  if (!reply) throw new Error("Empty response from AI");
  return reply;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  let body: { sessionId?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const message = String(body.message || "").trim();
  if (!message) {
    return NextResponse.json({ error: "Empty message" }, { status: 400 });
  }

  // Get or create the session
  let sessionId = body.sessionId;
  if (!sessionId) {
    const { data: newSession, error: createErr } = await supabase
      .from("crave_sessions")
      .insert({ user_id: user.id })
      .select("id")
      .single();
    if (createErr || !newSession) {
      return NextResponse.json(
        { error: createErr?.message || "Could not start session" },
        { status: 500 },
      );
    }
    sessionId = newSession.id;
  }

  // Load prior messages for this session
  const { data: priorMessages } = await supabase
    .from("crave_messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  const history: CraveMessage[] = [
    ...((priorMessages as CraveMessage[]) || []),
    { role: "user", content: message },
  ];

  // Load profile for system prompt personalization
  const { data: profile } = await supabase
    .from("profiles")
    .select("name, age, gender, goals, health_conditions, mental_conditions")
    .eq("id", user.id)
    .maybeSingle();

  const systemPrompt = buildSystemPrompt(profile as Profile | null);

  // Call Gemini
  let assistantReply: string;
  try {
    assistantReply = await callGemini(systemPrompt, history);
  } catch (e) {
    console.error("Gemini call failed:", e);
    return NextResponse.json(
      { error: "AI is not responding. Try again in a moment." },
      { status: 502 },
    );
  }

  // Persist both messages
  const { error: insertErr } = await supabase.from("crave_messages").insert([
    { session_id: sessionId, role: "user", content: message },
    { session_id: sessionId, role: "assistant", content: assistantReply },
  ]);
  if (insertErr) {
    console.error("Failed to save messages:", insertErr);
    // Still return the reply so the user isn't stuck
  }

  return NextResponse.json({
    sessionId,
    reply: assistantReply,
  });
}
