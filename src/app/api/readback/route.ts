import { validateServiceContext } from "@/lib/service-context";
import { emptyIntake, validateIntake, type Intake } from "@/lib/jobs";
import { buildReadback } from "@/lib/readback";

export const runtime = "nodejs";
const reply = (error: string, status: number) => Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
let inFlight = false;

export async function POST(request: Request) {
  const expected = new URL(request.url);
  if (request.headers.get("host")) expected.host = request.headers.get("host")!;
  if (request.headers.get("origin") && request.headers.get("origin") !== expected.origin) return reply("Only requests from this app are allowed.", 403);
  if (Number(request.headers.get("content-length") ?? 0) > 65536) return reply("The intake is too large for spoken review.", 413);
  let body: unknown;
  try { body = await request.json(); } catch { return reply("Send a reviewed intake to generate speech.", 400); }
  if (!body || typeof body !== "object" || !("consent" in body) || body.consent !== true) return reply("Confirm permission to send the summary to Gnani.", 400);
  if (!("intake" in body) || !body.intake || typeof body.intake !== "object") return reply("A complete intake draft is required.", 400);
  const raw = body.intake as Record<string, unknown>;
  if (!Object.keys(emptyIntake).every(key => typeof raw[key] === "string")) return reply("The intake contains invalid fields.", 400);
  const intake = Object.fromEntries(Object.keys(emptyIntake).map(key => [key, raw[key]])) as Intake;
  if (!["Not recorded", "Ask before any paid work"].includes(intake.approval) || validateIntake(intake).length) return reply("Check the required intake details and spending amount before spoken review.", 400);
  let service;
  try { service = validateServiceContext("service" in body ? body.service : undefined); }
  catch { return reply("Choose a valid conversation language.", 400); }
  let text: string;
  try { text = buildReadback(intake, service.language); } catch (e) { return reply(e instanceof Error ? e.message : "This intake cannot be read aloud.", 422); }
  const key = process.env.GNANI_API_KEY?.trim();
  if (!key) return reply("Gnani is not configured. Add GNANI_API_KEY to .env.local and restart the app.", 503);
  if (inFlight) return reply("Another read-back is being generated. Wait for it to finish.", 429);
  inFlight = true;
  try {
    const response = await fetch("https://api.vachana.ai/api/v1/tts/inference", {
      method: "POST", cache: "no-store", headers: { "Content-Type": "application/json", "X-API-Key-ID": key },
      signal: AbortSignal.any([AbortSignal.timeout(90000), request.signal]),
      body: JSON.stringify({ text, model: "timbre-v3.0", voice: "Shivani", language: service.language, speed: 1,
        audio_config: { sample_rate: 24000, num_channels: 1, sample_width: 2, encoding: "linear_pcm", container: "wav" } }),
    });
    if (!response.ok) {
      const messages: Record<number, string> = {
        400: "Gnani rejected the speech request. Check the draft and voice configuration.",
        401: "Gnani rejected the API key. Check the local key.",
        402: "Your Gnani account has insufficient credits for speech generation.",
        403: "Your Gnani key may not have text-to-speech access. Enable the TTS scope in the dashboard.",
        429: "Your Gnani speech account is busy or rate-limited. Wait for other speech requests to finish.",
      };
      return reply(messages[response.status] ?? "Gnani speech generation is temporarily unavailable. Confirmation has not changed.", response.status >= 500 ? 502 : response.status);
    }
    const audio = await response.arrayBuffer();
    const header = new Uint8Array(audio, 0, Math.min(audio.byteLength, 12));
    const marker = String.fromCharCode(...header);
    if (audio.byteLength < 44 || audio.byteLength > 12 * 1024 * 1024 || !marker.startsWith("RIFF") || marker.slice(8) !== "WAVE") return reply("Gnani did not return a usable WAV recording. Your confirmation has not changed.", 502);
    return new Response(audio, { headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (e) {
    return reply(e instanceof Error && ["AbortError", "TimeoutError"].includes(e.name) ? "Speech generation stopped or timed out. Confirmation has not changed." : "Could not reach Gnani for speech generation. Try again when ready.", 502);
  } finally { inFlight = false; }
}
