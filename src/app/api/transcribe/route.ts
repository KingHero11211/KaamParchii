import { validateServiceContext, serviceCategories, speechCode } from "../../../lib/service-context.ts";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024;
const allowedExtensions = new Set(["wav", "mp3", "ogg", "flac", "aac", "m4a"]);
let inFlight = false;
const reply = (message: string, status: number) => Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  // Next.js may use the bind address (0.0.0.0) in request.url. The Host
  // header preserves the address the browser requested. Do not trust
  // arbitrary forwarded-host headers for this local prototype.
  const expected = new URL(request.url);
  const host = request.headers.get("host");
  if (host) expected.host = host;
  if (origin && origin !== expected.origin) return reply("Only requests from this app are allowed.", 403);
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BYTES + 65536) return reply("Choose an audio file smaller than 8 MB.", 413);
  let form: FormData;
  try { form = await request.formData(); }
  catch { return reply("Send an audio file using the recording or upload controls.", 400); }
  if (form.get("consent") !== "true") return reply("Confirm permission to send this audio to Gnani for transcription.", 400);
  const file = form.get("audio_file");
  if (!(file instanceof File) || !file.size) return reply("Choose a non-empty audio recording.", 400);
  if (file.size > MAX_BYTES) return reply("Choose an audio file smaller than 8 MB.", 413);
  if (!allowedExtensions.has(file.name.split(".").pop()?.toLowerCase() ?? "")) return reply("Use WAV, MP3, OGG, FLAC, AAC or M4A audio.", 400);
  let service;
  try { service = validateServiceContext(form.has("service") ? JSON.parse(String(form.get("service"))) : undefined); }
  catch { return reply("Choose a valid shop and conversation language.", 400); }
  const language = form.get("language_code");
  if (!["hi-IN,en-IN", "en-IN", "te-IN", "indic-auto"].includes(String(language)) || (form.has("service") && language !== speechCode(service.language))) return reply("Use the selected conversation language for transcription.", 400);
  const key = process.env.GNANI_API_KEY?.trim();
  if (!key) return reply("Gnani is not connected yet. Add GNANI_API_KEY to .env.local and restart the app. Your recording has not been sent.", 503);
  if (inFlight) return reply("Another transcription is running. Wait for it to finish, then try again.", 429);
  inFlight = true;
  try {
    const payload = new FormData();
    // Use a neutral filename rather than forwarding potentially identifying upload names.
    payload.set("audio_file", file, `intake.${file.name.split(".").pop()!.toLowerCase()}`);
    payload.set("model", "prisma-v3.0");
    payload.set("language_code", String(language));
    payload.set("format", "transcribe");
    payload.set("topic", serviceCategories[service.category].topic + ": reported faults, received items, asset condition, customer instructions and spending limits. Preserve corrections and negations.");
    payload.set("keyterms", JSON.stringify(serviceCategories[service.category].keyterms));
    const response = await fetch("https://api.vachana.ai/stt/v3", {
      method: "POST", headers: { "X-API-Key-ID": key, "X-API-Request-ID": crypto.randomUUID() },
      body: payload, signal: AbortSignal.any([AbortSignal.timeout(60000), request.signal]), cache: "no-store",
    });
    if (!response.ok) {
      const messages: Record<number, string> = {
        400: "Gnani could not process this audio. Check that it is a valid clip no longer than 30 seconds.",
        401: "Gnani rejected the API key. Check the key in your local settings.",
        402: "Gnani reports insufficient credits. Check your account balance.",
        403: "This Gnani key may not have speech-to-text access. Check its scopes.",
        422: "Gnani rejected the audio request. Check the file and language selection.",
        429: "Gnani is busy or your account limit was reached. Wait before trying again.",
        504: "Gnani timed out. Try a shorter recording; retrying may use additional credits.",
      };
      return reply(messages[response.status] ?? "Gnani is temporarily unavailable. Try again later.", response.status >= 500 ? 502 : response.status);
    }
    const result: unknown = await response.json();
    if (!result || typeof result !== "object" || !("transcript" in result) || typeof result.transcript !== "string") return reply("Gnani returned an unexpected response. Your form has not been changed.", 502);
    const body = result as { transcript: string; truncated?: boolean; detected_language_code?: string };
    return Response.json({ transcript: body.transcript, truncated: body.truncated === true, language: typeof body.detected_language_code === "string" ? body.detected_language_code : null, model: "prisma-v3.0" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const aborted = error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name);
    return reply(aborted ? "Transcription stopped or timed out. Your form is unchanged. Retry only when ready." : "Could not reach Gnani. Check the connection and try again.", 502);
  } finally { inFlight = false; }
}
