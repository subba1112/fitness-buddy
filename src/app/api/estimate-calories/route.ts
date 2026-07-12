import { NextResponse } from "next/server";

// This runs on the server — the Gemini API key stays private (never sent to browser)
export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server misconfigured: GEMINI_API_KEY not set" },
      { status: 500 },
    );
  }

  let description: string;
  try {
    const body = await request.json();
    description = String(body.description || "").trim();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  if (!description) {
    return NextResponse.json(
      { error: "Please describe the meal first" },
      { status: 400 },
    );
  }

  // Prompt Gemini for a plain-integer calorie estimate
  const prompt = `You are a nutrition estimator. Given the meal description below, estimate the total calories.
Respond with ONLY a single integer number (no units, no explanation, no punctuation).
If the description is not a food/meal, respond with 0.

Meal: ${description}`;

  try {
    // Using flash-lite (fast, non-reasoning) — completes in ~1 second
    const geminiResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 20,
          },
        }),
      },
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error("Gemini API error:", errorText);
      return NextResponse.json(
        { error: "AI estimation failed. Try again." },
        { status: 502 },
      );
    }

    const data = await geminiResponse.json();
    const rawText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";

    // Extract the first integer from the response
    const match = rawText.match(/\d+/);
    if (!match) {
      return NextResponse.json(
        { error: "Could not read the estimate" },
        { status: 502 },
      );
    }
    const calories = parseInt(match[0], 10);

    return NextResponse.json({ calories });
  } catch (e) {
    console.error("Gemini call failed:", e);
    return NextResponse.json(
      { error: "AI service unavailable" },
      { status: 502 },
    );
  }
}
