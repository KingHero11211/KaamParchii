import { AccessToken, AgentDispatchClient, RoomServiceClient } from "livekit-server-sdk";
import { TrackSource } from "@livekit/protocol";
import { createHash, randomBytes } from "node:crypto";
import { callPrompt, type CallProposal, type CustomerCall } from "../customer-calls";
import { callLedger } from "./call-ledger";

export const VOICE_AGENT_NAME = "kaamparchi-approval";
export function voiceConfiguration() {
  const missing = ["LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET", "GNANI_API_KEY", "GEMINI_API_KEY"]
    .filter(key => !process.env[key]?.trim());
  return { ready: missing.length === 0, missing };
}
function clients() {
  const url = new URL(process.env.LIVEKIT_URL!);
  if (url.protocol !== "wss:" || !url.hostname.endsWith(".livekit.cloud")) throw new Error("Use the wss LiveKit Cloud project URL.");
  const serverUrl = url.origin;
  url.protocol = "https:";
  return {
    serverUrl,
    rooms: new RoomServiceClient(url.origin, process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET),
    dispatch: new AgentDispatchClient(url.origin, process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET),
  };
}

export async function startBrowserVoice(proposal: CallProposal, owner: string, requestId: string) {
  if (!voiceConfiguration().ready) throw new Error("Configure LiveKit, Gnani and Gemini before starting a voice conversation.");
  const { rooms, dispatch, serverUrl } = clients();
  const ledger = callLedger();
  const reservation = ledger.reserve(proposal, "livekit:" + VOICE_AGENT_NAME, owner, false, requestId);
  let call = reservation.call;
  const roomName = "approval-" + call.id;
  if (reservation.created) {
    const reportToken = randomBytes(32).toString("hex");
    call = ledger.patch(call.id, owner, {
      transport: "livekit-browser", roomName,
      reportHash: createHash("sha256").update(reportToken).digest("hex"),
      message: "Starting the browser conversation.",
    });
    try {
      await rooms.createRoom({ name: roomName, emptyTimeout: 60, departureTimeout: 10, maxParticipants: 2 });
      await dispatch.createDispatch(roomName, VOICE_AGENT_NAME, {
        metadata: JSON.stringify({
          sessionId: call.id, reportToken, prompt: callPrompt({ ...proposal, phone: "" }),
          customerName: proposal.customerName,
        }),
      });
      call = ledger.patch(call.id, owner, { status: "queued", message: "Voice session ready. Join and allow microphone access to speak." });
    } catch {
      let stopped = false;
      try { await rooms.deleteRoom(roomName); stopped = true; } catch {}
      ledger.patch(call.id, owner, {
        status: stopped ? "failed" : "unknown",
        message: "LiveKit session setup failed. Use End voice session to clear this attempt before retrying.",
      });
      throw new Error("Could not start the LiveKit room. Check the voice worker and project connection. End this attempt before retrying.");
    }
  }
  if (call.status !== "queued" || call.transport !== "livekit-browser") throw new Error("This voice attempt is already ended or still being prepared.");
  const token = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, {
    identity: "customer-" + call.id, name: proposal.customerName, ttl: "10m",
  });
  token.addGrant({ roomJoin: true, room: roomName, canSubscribe: true, canPublish: true, canPublishSources: [TrackSource.MICROPHONE], canPublishData: false, canUpdateOwnMetadata: false });
  return { call, token: await token.toJwt(), serverUrl };
}

export async function endBrowserVoice(id: string, owner: string): Promise<CustomerCall | null> {
  const ledger = callLedger();
  // A start may fail before reservation. Ending that attempt still releases
  // the browser controls, without touching any other owner's session.
  let call: CustomerCall;
  try { call = ledger.get(id, owner); } catch { return null; }
  if (call.transport !== "livekit-browser" || !call.roomName) throw new Error("This is not a browser voice session.");
  const { rooms } = clients();
  const existing = await rooms.listRooms([call.roomName]);
  if (existing.length) await rooms.deleteRoom(call.roomName);
  const latest = ledger.get(id, owner);
  if (latest.transcript !== undefined || latest.status === "failed") return latest;
  return ledger.patch(id, owner, {
    status: "finished", callStatus: "NO ANSWER",
    message: "Voice room closed. Refresh history shortly for the worker’s final transcript.",
  });
}
