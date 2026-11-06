import { validateProposal, type CallTurn } from "@/lib/customer-calls";
import { callLedger } from "@/lib/server/call-ledger";
import { callOwner } from "@/lib/server/gnani-calls";
import { endBrowserVoice, startBrowserVoice, voiceConfiguration } from "@/lib/server/browser-voice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
const reply = (error: string, status: number) => Response.json({ error }, { status, headers });
export function GET() { return Response.json(voiceConfiguration(), { headers }); }

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") || 0) > 100000) return reply("Voice-session data is too large.", 413);
  try {
    const text = await request.text();
    if (text.length > 60000) return reply("Voice-session data is too large.", 413);
    const body = JSON.parse(text);
    if (!body || typeof body !== "object") return reply("Choose a voice-session action.", 400);
    if (body.action === "report") {
      const authorization = request.headers.get("authorization") || "";
      if (!/^Bearer [a-f0-9]{64}$/.test(authorization) || typeof body.id !== "string") return reply("Invalid worker report.", 403);
      if (!Array.isArray(body.turns) || body.turns.length > 200) return reply("Unsupported transcript.", 400);
      const turns: CallTurn[] = body.turns.map((turn: CallTurn) => {
        if (!turn || !["assistant", "user"].includes(turn.role) || typeof turn.content !== "string" || turn.content.length > 4000 ||
            (turn.interrupted !== undefined && typeof turn.interrupted !== "boolean")) throw new Error("Invalid transcript turn.");
        return { role: turn.role, content: turn.content, interrupted: turn.interrupted === true };
      });
      callLedger().report(body.id, authorization.slice(7), turns);
      return Response.json({ saved: true }, { headers });
    }
    const expected = new URL(request.url);
    if (request.headers.get("host")) expected.host = request.headers.get("host")!;
    if (request.headers.get("origin") !== expected.origin) return reply("Only requests from this app are allowed.", 403);
    const owner = callOwner(request.headers.get("x-kaamparchi-browser"));
    if (typeof body.id !== "string" || !/^[a-f0-9-]{36}$/i.test(body.id)) return reply("A valid session reference is required.", 400);
    if (body.action === "end") return Response.json({ call: await endBrowserVoice(body.id, owner) }, { headers });
    if (body.action === "start") {
      if (body.consent !== true) return reply("Review the proposal and confirm permission for the live conversation.", 400);
      const proposal = validateProposal(body.proposal, false);
      return Response.json(await startBrowserVoice(proposal, owner, body.id), { headers });
    }
    return reply("Unknown voice-session action.", 400);
  } catch {
    return reply("Could not complete the voice-session action. Check the worker and LiveKit configuration, then refresh history before retrying.", 400);
  }
}
