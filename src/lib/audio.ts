export const MAX_AUDIO_BYTES = 8 * 1024 * 1024;
export const MAX_AUDIO_SECONDS = 30;

/** Encode PCM as mono 16-bit WAV, supported by Prisma REST across browsers. */
export function encodeWav(channels: Float32Array[], sampleRate: number): ArrayBuffer {
  if (!channels.length || !Number.isFinite(sampleRate) || sampleRate <= 0) throw new Error("Invalid audio samples.");
  const frames = channels[0].length;
  if (channels.some(channel => channel.length !== frames)) throw new Error("Audio channel lengths do not match.");
  const result = new ArrayBuffer(44 + frames * 2);
  const view = new DataView(result);
  const text = (offset: number, value: string) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)); };
  text(0, "RIFF"); view.setUint32(4, result.byteLength - 8, true); text(8, "WAVE");
  text(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  text(36, "data"); view.setUint32(40, frames * 2, true);
  for (let frame = 0; frame < frames; frame++) {
    const sample = Math.max(-1, Math.min(1, channels.reduce((sum, channel) => sum + channel[frame], 0) / channels.length));
    view.setInt16(44 + frame * 2, sample < 0 ? sample * 32768 : sample * 32767, true);
  }
  return result;
}

/** Browser recorder formats (often WebM) are converted, not relabelled as WAV. */
export async function prepareAudio(blob: Blob): Promise<{ file: File; duration: number }> {
  if (!blob.size) throw new Error("The recording is empty. Record again or choose another file.");
  if (blob.size > MAX_AUDIO_BYTES) throw new Error("Choose a clip smaller than 8 MB.");
  const context = new AudioContext();
  try {
    let decoded: AudioBuffer;
    try { decoded = await context.decodeAudioData(await blob.arrayBuffer()); }
    catch { throw new Error("This browser could not decode the audio. Try a WAV or MP3 file, or record a new clip."); }
    if (decoded.duration > MAX_AUDIO_SECONDS) throw new Error("This clip is longer than 30 seconds. Trim it or record a shorter segment.");
    if (decoded.duration < 0.1) throw new Error("The clip is too short. Record a few seconds of speech.");
    const channels = Array.from({ length: decoded.numberOfChannels }, (_, i) => decoded.getChannelData(i));
    const wav = encodeWav(channels, decoded.sampleRate);
    if (wav.byteLength > MAX_AUDIO_BYTES) throw new Error("Converted audio is too large. Use a shorter clip.");
    return { file: new File([wav], "intake.wav", { type: "audio/wav" }), duration: decoded.duration };
  } finally { await context.close(); }
}
