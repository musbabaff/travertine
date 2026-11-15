import { NextResponse } from "next/server";

/**
 * Cosmo's free-text answers. The Gemini key stays on the server (GEMINI_API_KEY); the browser only sends the question
 * and the engine responses already loaded for the field. The model is told to answer from those numbers only and to
 * say so when they do not hold the answer. Without a key the route answers 503 and Cosmo keeps its fixed answers.
 */
const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const SYSTEM = `You are Cosmo, the guide inside Travertine, a crop-rotation decision-support tool built on NASA POWER weather,
SoilGrids soil, MODIS and HLS vegetation and the FAO-56 water balance.
Rules:
- Answer only from the JSON context you are given (engine responses for the selected field) and the page name. Never
  invent, estimate or round away a number; quote numbers exactly as they appear, with units.
- If the context does not contain what is needed, say so in one sentence and name the page that shows it
  (Field, Explore, Plan, Evidence, Data).
- Scores are relative rankings on past years under the user's priorities, not predictions or forecasts.
- Validation wording: say "difference established" or "difference not established"; never "beats", "passes" or "fails".
- Travertine supports the farmer's judgment and local expertise; it does not replace them.
- Reply in the user's language (en = English, tr = Turkish), plain text, at most 90 words, no markdown.`;

export async function POST(req: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  let body: { question?: string; language?: string; page?: string; context?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const question = String(body.question ?? "").slice(0, 300).trim();
  if (!question) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const context = JSON.stringify(body.context ?? {}).slice(0, 24_000);
  const language = body.language === "tr" ? "tr" : "en";

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    signal: AbortSignal.timeout(15_000),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: "user", parts: [{ text: `Language: ${language}\nPage: ${body.page ?? "/"}\nContext JSON: ${context}\n\nQuestion: ${question}` }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 400 },
    }),
  }).catch(() => null);
  if (!res || !res.ok) return NextResponse.json({ error: "upstream" }, { status: 502 });
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
  if (!text) return NextResponse.json({ error: "empty" }, { status: 502 });
  return NextResponse.json({ text, model: MODEL });
}
