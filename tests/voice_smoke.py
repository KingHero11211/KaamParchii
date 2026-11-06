import asyncio, uuid, json, os, io, wave
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[1] / ".env.local")
import aiohttp
from livekit import rtc

async def main():
    origin='http://127.0.0.1:3000'
    sid=str(uuid.uuid4())
    headers={'Origin':origin, 'x-kaamparchi-browser':str(uuid.uuid4())}
    proposal={'jobId':str(uuid.uuid4()),'reference':'KP-VOICE-SMOKE','customerName':'Demo Customer','phone':'','device':'Demo phone','instructions':'Do not reset. Preserve data.','originalLimit':'600','total':'900','actions':['Replace motherboard','Reset phone, which may erase stored data']}
    audio_seen=asyncio.Event()
    room=rtc.Room()
    tasks=[]
    async def read_audio(track):
        async for event in rtc.AudioStream(track):
            if any(event.frame.data):
                audio_seen.set()
                return
    @room.on('track_subscribed')
    def subscribed(track, publication, participant):
        if track.kind == rtc.TrackKind.KIND_AUDIO:
            tasks.append(asyncio.create_task(read_audio(track)))
    async with aiohttp.ClientSession() as http:
        async with http.post(origin+'/api/browser-voice',headers=headers,json={'action':'start','id':sid,'consent':True,'proposal':proposal}) as response:
            data=await response.json()
            if response.status != 200:
                raise AssertionError('Start failed: '+str(response.status)+' '+str(data.get('error')))
        print('ROOM_CREATED')
        try:
            await room.connect(data['serverUrl'],data['token'])
            await asyncio.wait_for(audio_seen.wait(),timeout=85)
            print('GNANI_GREETING_AUDIO_RECEIVED', flush=True)
            await asyncio.sleep(18)
            async with http.post('https://api.vachana.ai/api/v1/tts/inference', headers={'X-API-Key-ID':os.environ['GNANI_API_KEY']}, json={
                'text':'Haan, main Demo Customer bol raha hoon. Bataiye repair mein kya badla hai?', 'model':'timbre-v3.0','voice':'Shivani','language':'hi-en','speed':1,
                'audio_config':{'sample_rate':24000,'num_channels':1,'sample_width':2,'encoding':'linear_pcm','container':'wav'}}) as response:
                clip=await response.read()
                assert response.status==200, 'Customer fixture generation failed'
            source=rtc.AudioSource(24000,1)
            track=rtc.LocalAudioTrack.create_audio_track('synthetic-customer',source)
            await room.local_participant.publish_track(track,rtc.TrackPublishOptions(source=rtc.TrackSource.SOURCE_MICROPHONE))
            with wave.open(io.BytesIO(clip),'rb') as audio:
                assert audio.getframerate()==24000 and audio.getnchannels()==1
                while pcm:=audio.readframes(480):
                    if len(pcm)<960: pcm+=b'\0'*(960-len(pcm))
                    await source.capture_frame(rtc.AudioFrame(pcm,24000,1,480))
            # Silence lets the voice detector close this utterance.
            for _ in range(100):
                await source.capture_frame(rtc.AudioFrame(b'\0'*960,24000,1,480))
            print('SYNTHETIC_CUSTOMER_TURN_SENT',flush=True)
            await asyncio.sleep(45)
        finally:
            await room.disconnect()
            for task in tasks: task.cancel()
            async with http.post(origin+'/api/browser-voice',headers=headers,json={'action':'end','id':sid}) as response:
                print('END_STATUS',response.status)
        for _ in range(8):
            await asyncio.sleep(2)
            async with http.post(origin+'/api/customer-calls',headers=headers,json={'action':'list','jobId':proposal['jobId']}) as response:
                records=(await response.json()).get('calls',[])
                if records and records[0].get('transcript'):
                    print('TRANSCRIPT_SAVED',len(records[0]['transcript']),'ROLES',[turn['role'] for turn in records[0]['transcript']]); assert any(turn['role']=='user' for turn in records[0]['transcript']), 'Customer transcription missing'; return
        raise AssertionError('Final transcript was not saved within the smoke check window')
asyncio.run(main())
