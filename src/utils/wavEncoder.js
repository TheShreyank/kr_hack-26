/**
 * 16 kHz Mono PCM WAV Encoder & Recorder
 * Strictly complies with Modalapada 2.0 Hackathon specification:
 * Audio: 16 kHz mono WAV (16-bit PCM, 16000 Hz, 1 channel)
 */

const TARGET_SAMPLE_RATE = 16000;

/**
 * Downsamples or resamples a Float32Array audio buffer to 16,000 Hz Mono
 */
export function resampleTo16kHzMono(float32Samples, sourceSampleRate) {
  if (sourceSampleRate === TARGET_SAMPLE_RATE) {
    return float32Samples;
  }
  const ratio = sourceSampleRate / TARGET_SAMPLE_RATE;
  const newLength = Math.round(float32Samples.length / ratio);
  const result = new Float32Array(newLength);

  for (let i = 0; i < newLength; i++) {
    const srcIndex = i * ratio;
    const low = Math.floor(srcIndex);
    const high = Math.min(Math.ceil(srcIndex), float32Samples.length - 1);
    const weight = srcIndex - low;
    result[i] = float32Samples[low] * (1 - weight) + float32Samples[high] * weight;
  }
  return result;
}

/**
 * Encodes Float32Array [-1, 1] mono samples into a 16-bit PCM WAV Blob at 16 kHz
 */
export function encode16kHzMonoWAV(samples) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = TARGET_SAMPLE_RATE * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true);  // AudioFormat (1 = PCM)
  view.setUint16(22, numChannels, true); // NumChannels = 1 (Mono)
  view.setUint32(24, TARGET_SAMPLE_RATE, true); // SampleRate = 16000 Hz
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }

  return new Blob([buffer], { type: "audio/wav" });
}

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Converts a Blob into a Base64 string (without data URI prefix) for Gemini API inlineData
 */
export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result;
      const base64 = dataUrl.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Generates a valid 16 kHz Mono WAV sample tone envelope for seed items when exporting
 */
export function createSeedReferenceWavBlob(durationSec = 1.8) {
  const numSamples = Math.floor(TARGET_SAMPLE_RATE * durationSec);
  const samples = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / TARGET_SAMPLE_RATE;
    const envelope = Math.sin((Math.PI * i) / numSamples);
    samples[i] = 0.2 * envelope * (Math.sin(2 * Math.PI * 220 * t) + 0.5 * Math.sin(2 * Math.PI * 330 * t));
  }
  return encode16kHzMonoWAV(samples);
}

/**
 * Live Microphone Recorder that outputs 16 kHz Mono WAV
 */
export class Wav16kRecorder {
  constructor(onLevelChange) {
    this.audioContext = null;
    this.mediaStream = null;
    this.processor = null;
    this.source = null;
    this.chunks = [];
    this.isRecording = false;
    this.onLevelChange = onLevelChange;
  }

  async start() {
    this.chunks = [];
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: TARGET_SAMPLE_RATE,
        echoCancellation: true,
        noiseSuppression: true
      }
    });

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    this.audioContext = new AudioCtx();
    this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (event) => {
      if (!this.isRecording) return;
      const inputData = event.inputBuffer.getChannelData(0);
      this.chunks.push(new Float32Array(inputData));

      if (this.onLevelChange) {
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);
        this.onLevelChange(Math.min(1, rms * 4.5));
      }
    };

    this.source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
    this.isRecording = true;
  }

  async stop() {
    if (!this.isRecording) return null;
    this.isRecording = false;

    const sourceRate = this.audioContext ? this.audioContext.sampleRate : TARGET_SAMPLE_RATE;

    if (this.processor) this.processor.disconnect();
    if (this.source) this.source.disconnect();
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
    }
    if (this.audioContext) {
      await this.audioContext.close();
    }

    const totalLength = this.chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const merged = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of this.chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    const resampled16k = resampleTo16kHzMono(merged, sourceRate);
    const wavBlob = encode16kHzMonoWAV(resampled16k);
    const durationSec = (resampled16k.length / TARGET_SAMPLE_RATE).toFixed(2);

    return {
      wavBlob,
      durationSec,
      sampleRate: TARGET_SAMPLE_RATE,
      channels: 1,
      byteLength: wavBlob.size
    };
  }
}
