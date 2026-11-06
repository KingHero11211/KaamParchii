"""LiveKit adapters for the same Gnani v3 REST APIs used by the web app."""

import asyncio
import io
import os
import uuid
import wave

import aiohttp
from livekit import rtc
from livekit.agents import (
    APIConnectionError,
    APIStatusError,
    APITimeoutError,
    DEFAULT_API_CONNECT_OPTIONS,
    stt,
    tts,
    utils,
)


class PrismaSTT(stt.STT):
    def __init__(self):
        super().__init__(capabilities=stt.STTCapabilities(streaming=False, interim_results=False))
        self.key = os.environ["GNANI_API_KEY"].strip()

    @property
    def model(self):
        return "prisma-v3.0"

    @property
    def provider(self):
        return "gnani"

    async def _recognize_impl(self, buffer, *, language, conn_options):
        frame = rtc.combine_audio_frames(buffer)
        if frame.samples_per_channel / frame.sample_rate > 30:
            raise APIStatusError("Please speak in turns shorter than 30 seconds.", status_code=422)
        output = io.BytesIO()
        with wave.open(output, "wb") as audio:
            audio.setnchannels(frame.num_channels)
            audio.setsampwidth(2)
            audio.setframerate(frame.sample_rate)
            audio.writeframes(frame.data.tobytes())
        form = aiohttp.FormData()
        form.add_field("audio_file", output.getvalue(), filename="conversation.wav", content_type="audio/wav")
        form.add_field("model", self.model)
        form.add_field("language_code", "hi-IN,en-IN")
        form.add_field("format", "transcribe")
        form.add_field("topic", "Customer phone repair approval. Preserve corrections, prices, negations and conditions about reset, data and part replacement.")
        try:
            async with utils.http_context.http_session().post(
                "https://api.vachana.ai/stt/v3",
                data=form,
                headers={"X-API-Key-ID": self.key},
                timeout=aiohttp.ClientTimeout(total=45),
            ) as response:
                if response.status != 200:
                    raise APIStatusError("Gnani transcription unavailable.", status_code=response.status)
                data = await response.json()
                if not isinstance(data.get("transcript"), str) or data.get("truncated"):
                    raise APIStatusError("Transcription was incomplete. Please repeat a shorter answer.", status_code=422)
                return stt.SpeechEvent(
                    type=stt.SpeechEventType.FINAL_TRANSCRIPT,
                    alternatives=[stt.SpeechData(language="hi-IN", text=data["transcript"])],
                )
        except asyncio.TimeoutError as error:
            raise APITimeoutError("Gnani transcription timed out.") from error
        except aiohttp.ClientError as error:
            raise APIConnectionError("Could not reach Gnani transcription.") from error


class TimbreTTS(tts.TTS):
    def __init__(self):
        super().__init__(capabilities=tts.TTSCapabilities(streaming=False), sample_rate=24000, num_channels=1)
        self.key = os.environ["GNANI_API_KEY"].strip()

    @property
    def model(self):
        return "timbre-v3.0"

    @property
    def provider(self):
        return "gnani"

    def synthesize(self, text, *, conn_options=DEFAULT_API_CONNECT_OPTIONS):
        return TimbreStream(tts=self, input_text=text, conn_options=conn_options)


class TimbreStream(tts.ChunkedStream):
    async def _run(self, output_emitter):
        text = self._input_text.replace("<", " ").replace(">", " ")
        if len(text) > 6000:
            raise APIStatusError("The spoken response is too long.", status_code=422)
        try:
            async with utils.http_context.http_session().post(
                "https://api.vachana.ai/api/v1/tts/inference",
                headers={"X-API-Key-ID": self._tts.key},
                json={
                    "text": text,
                    "model": "timbre-v3.0",
                    "voice": "Shivani",
                    "language": "hi-en",
                    "speed": 1,
                    "audio_config": {
                        "sample_rate": 24000, "num_channels": 1, "sample_width": 2,
                        "encoding": "linear_pcm", "container": "wav",
                    },
                },
                timeout=aiohttp.ClientTimeout(total=60),
            ) as response:
                if response.status != 200:
                    raise APIStatusError("Gnani speech unavailable.", status_code=response.status)
                audio = await response.read()
                if len(audio) < 44 or len(audio) > 12 * 1024 * 1024 or audio[:4] != b"RIFF" or audio[8:12] != b"WAVE":
                    raise APIStatusError("Gnani returned unusable audio.", status_code=502)
                output_emitter.initialize(
                    request_id=uuid.uuid4().hex, sample_rate=24000,
                    num_channels=1, mime_type="audio/wav",
                )
                output_emitter.push(audio)
                output_emitter.flush()
        except asyncio.TimeoutError as error:
            raise APITimeoutError("Gnani speech timed out.") from error
        except aiohttp.ClientError as error:
            raise APIConnectionError("Could not reach Gnani speech.") from error
