import { callLedger } from "@/lib/server/call-ledger";
import { callOwner, extractCallDecisions } from "@/lib/server/gnani-calls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
const reply = (error: string, status: number) => Response.json({ error }, { status, headers });

export function GET() {
  return Response.json({ transport: "livekit-browser" }, { headers });
}

export async function POST(request: Request) {
  const expected = new URL(request.url);
  if (request.headers.get("host")) expected.host = request.headers.get("host")!;
  if (request.headers.get("origin") !== expected.origin) return reply("Only requests from this app are allowed.", 403);
  if (Number(request.headers.get("content-length") || 0) > 32768) return reply("The call proposal is too large.", 413);
  try {
    const owner = callOwner(request.headers.get("x-kaamparchi-browser"));
    const text = await request.text();
    if (text.length > 24000) return reply("The call proposal is too large.", 413);
    const body = JSON.parse(text);
    if (!body || typeof body !== "object") return reply("Choose a call action.", 400);
    if (body.action === "list") {
      if (typeof body.jobId !== "string" || !/^[a-f0-9-]{36}$/i.test(body.jobId)) return reply("A saved job is required.", 400);
      return Response.json({ calls: callLedger().list(body.jobId, owner) }, { headers });
    }
    if (typeof body.id !== "string" || !/^[a-f0-9-]{36}$/i.test(body.id)) return reply("A valid call reference is required.", 400);
    if (body.action === "refresh") {
      const saved = callLedger().get(body.id, owner);
      return Response.json({ call: saved }, { headers });
    }
    if (body.action === "extract") {
      if (body.consent !== true) return reply("Confirm permission to send the call transcript to Gemini.", 400);
      return Response.json({ call: await extractCallDecisions(body.id, owner) }, { headers });
    }
    if (body.action === "review") {
      const call = callLedger().get(body.id, owner);
      if (call.status !== "finished" || !call.decisions || body.confirmed !== true) return reply("Review the transcript and each suggested decision first.", 400);
      return Response.json({ call: callLedger().patch(body.id, owner, {
        reviewedAt: call.reviewedAt || new Date().toISOString(),
        message: "The shop reviewed these decisions against the recorded proposal and transcript. Unclear items still require clarification.",
      }) }, { headers });
    }
    return reply("Unknown call action.", 400);
  } catch (error) {
    return reply(error instanceof Error ? error.message : "The call action could not be completed.", 400);
  }
}
