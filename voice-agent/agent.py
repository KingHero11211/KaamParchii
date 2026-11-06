"""Run with .venv/Scripts/python.exe voice-agent/agent.py start."""

import asyncio
import json
import logging
import os
import re
from pathlib import Path

import aiohttp
from dotenv import load_dotenv
from livekit.agents import Agent, AgentServer, AgentSession, APIConnectOptions, SessionConnectOptions, cli
from livekit.agents.voice.room_io import RoomOptions
from livekit.plugins import google, silero

from gnani_speech import PrismaSTT, TimbreTTS

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env.local")
APP_URL = os.environ.get("KAAMPARCHI_APP_URL", "http://127.0.0.1:3000").rstrip("/")
OUTBOX = ROOT / "data" / "voice-reports"
logger = logging.getLogger("kaamparchi.voice")
server = AgentServer(num_idle_processes=0, initialize_process_timeout=30, log_level="INFO")


async def deliver_report(path):
    payload = json.loads(path.read_text(encoding="utf-8"))
    async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=15)) as http:
        for attempt in range(3):
            try:
                async with http.post(
                    APP_URL + "/api/browser-voice",
                    headers={"Authorization": "Bearer " + payload["token"]},
                    json={"action": "report", "id": payload["id"], "turns": payload["turns"]},
                ) as response:
                    if response.status == 200:
                        path.unlink(missing_ok=True)
                        return
                    if response.status in (400, 403, 413):
                        break
            except (aiohttp.ClientError, asyncio.TimeoutError):
                pass
            await asyncio.sleep(attempt + 1)
    logger.warning("A voice report is pending in the local outbox.")


@server.rtc_session(agent_name="kaamparchi-approval")
async def approval_session(ctx):
    metadata = json.loads(ctx.job.metadata or "{}")
    session_id = metadata.get("sessionId", "")
    token = metadata.get("reportToken", "")
    prompt = metadata.get("prompt", "")
    if not re.fullmatch(r"[a-f0-9-]{36}", session_id) or not re.fullmatch(r"[a-f0-9]{64}", token):
        raise ValueError("Invalid session dispatch.")
    if not isinstance(prompt, str) or not prompt or len(prompt) > 20000:
        raise ValueError("Invalid session proposal.")

    OUTBOX.mkdir(parents=True, exist_ok=True)
    for path in OUTBOX.glob("report-*.json"):
        await deliver_report(path)

    model = os.environ.get("GEMINI_MODEL", "gemini-3.1-flash-lite")
    session = AgentSession(
        stt=PrismaSTT(),
        tts=TimbreTTS(),
        llm=google.LLM(
            model=model,
            api_key=os.environ["GEMINI_API_KEY"],
            temperature=0.2,
            max_output_tokens=512,
            thinking_config={"thinking_level": "LOW"} if model.startswith("gemini-3.") else {},
        ),
        vad=silero.VAD.load(max_buffered_speech=30.0),
        turn_handling={
            "endpointing": {"min_delay": 0.8, "max_delay": 3.0},
            "interruption": {"enabled": True},
        },
        conn_options=SessionConnectOptions(
            stt_conn_options=APIConnectOptions(max_retry=0, timeout=45),
            tts_conn_options=APIConnectOptions(max_retry=0, timeout=60),
            llm_conn_options=APIConnectOptions(max_retry=0, timeout=45),
            max_unrecoverable_errors=1,
        ),
    )

    async def save_transcript():
        await session.aclose()
        turns = []
        for item in session.history.items:
            if getattr(item, "role", None) in ("user", "assistant") and item.text_content:
                turns.append({
                    "role": item.role,
                    "content": item.text_content,
                    "interrupted": bool(getattr(item, "interrupted", False)),
                })
        report = OUTBOX / ("report-" + session_id + ".json")
        report.write_text(json.dumps({"id": session_id, "token": token, "turns": turns}, ensure_ascii=False), encoding="utf-8")
        await deliver_report(report)

    ctx.add_shutdown_callback(save_transcript)
    await ctx.connect()
    try:
        participant = await asyncio.wait_for(ctx.wait_for_participant(), timeout=40)
    except asyncio.TimeoutError:
        ctx.shutdown(reason="No customer joined the voice session.")
        return
    await session.start(
        room=ctx.room,
        agent=Agent(instructions=prompt +
            "\nThis is a spoken conversation. Never use markdown, bullets, numbered lists, or parenthetical translations. "
            "Use two or three short sentences per turn. Ask exactly ONE question, about ONE proposal item, then wait. "
            "After identity confirmation, state original and revised total and ask ONLY about the revised price. "
            "In subsequent turns ask about each action individually, explaining data loss before asking about reset. "
            "Do not combine price, replacement and reset approval in one question. "
            "After all individual answers, read the entire decision summary and ask for confirmation. "
            "Say rupee amounts as Hindi words when speaking Hindi. The customer can end with the on-screen End voice session button."),
        room_options=RoomOptions(
            participant_identity=participant.identity,
            text_input=False,
            video_input=False,
            close_on_disconnect=True,
            delete_room_on_close=True,
        ),
    )

    async def session_limit():
        await asyncio.sleep(300)
        session.shutdown(drain=False)
        ctx.shutdown(reason="Five-minute prototype session limit.")

    limit = asyncio.create_task(session_limit())
    session.on("close", lambda event: (limit.cancel(), ctx.shutdown(reason="Conversation closed.")))
    failure_task = None

    async def explain_model_failure():
        try:
            await session.say(
                "Maaf kijiye, conversation service abhi available nahi hai. "
                "Is adhuri baat ko repair ki permission mat samajhiye. Shop se dobara confirm karein.",
                allow_interruptions=False,
            )
        finally:
            session.shutdown(drain=False)

    def on_error(event):
        nonlocal failure_task
        if getattr(event.error, "type", "") == "llm_error" and failure_task is None:
            failure_task = asyncio.create_task(explain_model_failure())

    session.on("error", on_error)
    name = str(metadata.get("customerName", "customer"))[:160].replace("<", " ").replace(">", " ")
    await session.say(
        "Namaste. Main Nukkad Mobile Care ki automated assistant KaamParchi hoon. Kya meri baat " + name +
        " se ho rahi hai? Kya abhi repair ke baare mein baat karna theek rahega?",
        allow_interruptions=True,
    )


if __name__ == "__main__":
    cli.run_app(server)
