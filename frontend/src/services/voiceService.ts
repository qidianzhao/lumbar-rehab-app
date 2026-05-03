import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { api } from '@/src/api/client';

const TTS_URL = '/voice/tts';
const ASR_URL = '/voice/asr';

let _recording: Audio.Recording | null = null;
let _sound: Audio.Sound | null = null;
let _bgMusic: Audio.Sound | null = null;
let _speaking = false;
let _recognizing = false; // 防止并发识别

async function _ensureAudioMode(recording: boolean) {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: recording,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
  });
}

export async function startBgMusic(uri: string): Promise<void> {
  await stopBgMusic();
  await _ensureAudioMode(false);
  const { sound } = await Audio.Sound.createAsync(
    { uri },
    { shouldPlay: true, isLooping: true, volume: 0.4 }
  );
  _bgMusic = sound;
}

export async function stopBgMusic(): Promise<void> {
  if (_bgMusic) {
    await _bgMusic.stopAsync().catch(() => {});
    await _bgMusic.unloadAsync().catch(() => {});
    _bgMusic = null;
  }
}

export async function pauseBgMusic(): Promise<void> {
  if (_bgMusic) await _bgMusic.pauseAsync().catch(() => {});
}

export async function resumeBgMusic(): Promise<void> {
  if (_bgMusic) await _bgMusic.playAsync().catch(() => {});
}

// 降低背景音乐音量（用于TTS播放时）
export async function duckBgMusic(): Promise<void> {
  if (_bgMusic) await _bgMusic.setVolumeAsync(0.1).catch(() => {});
}

// 恢复背景音乐音量
export async function unduckBgMusic(): Promise<void> {
  if (_bgMusic) await _bgMusic.setVolumeAsync(0.4).catch(() => {});
}

export async function startRecording(): Promise<void> {
  if (_recording || _recognizing) return; // 防止在识别过程中开始新录音
  const { status } = await Audio.requestPermissionsAsync();
  if (status !== 'granted') throw new Error('麦克风权限未授权');

  await pauseBgMusic();
  await _ensureAudioMode(true);

  const { recording } = await Audio.Recording.createAsync(
    Audio.RecordingOptionsPresets.HIGH_QUALITY
  );
  console.log('开始录音');
  _recording = recording;
}

export async function stopRecordingAndRecognize(): Promise<string> {
  if (!_recording || _recognizing) return '';
  _recognizing = true; // 设置识别锁
  try {
    await _recording.stopAndUnloadAsync();
    const uri = _recording.getURI();
    _recording = null;

    if (!uri) { console.log('录音 URI 为空'); return ''; }
    console.log('录音文件路径:', uri);

    const ext = uri.split('.').pop()?.toLowerCase() ?? 'm4a';
    const mimeMap: Record<string, string> = {
      wav: 'audio/wav', m4a: 'audio/m4a', aac: 'audio/aac',
      mp4: 'audio/mp4', caf: 'audio/x-caf',
    };
    const mimeType = mimeMap[ext] ?? 'audio/m4a';
    console.log('录音格式:', ext, mimeType);

    const formData = new FormData();
    formData.append('audio', { uri, name: `audio.${ext}`, type: mimeType } as any);

    // 添加10秒超时
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await api.post<{ code: number; data: { text: string } }>(
        ASR_URL,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          signal: controller.signal as any
        }
      );
      clearTimeout(timeoutId);
      console.log('ASR 响应:', JSON.stringify(res.data));
      const text = res.data?.data?.text ?? '';
      console.log('ASR 识别文字:', text);
      return text;
    } catch (e: any) {
      clearTimeout(timeoutId);
      if (e.name === 'AbortError' || e.message?.includes('timeout')) {
        console.log('ASR 超时');
        throw new Error('语音识别超时，请重试');
      }
      throw e;
    }
  } catch (e) {
    console.log('ASR 错误:', e);
    _recording = null;
    throw e;
  } finally {
    _recognizing = false; // 释放识别锁
    await _ensureAudioMode(false);
  }
}

export async function speakText(text: string): Promise<void> {
  if (!text.trim()) return;
  stopSpeaking();
  await duckBgMusic(); // 降低背景音乐音量而不是暂停

  try {
    const token = (api.defaults.headers.common['Authorization'] as string) ?? '';
    console.log('TTS 请求:', text.slice(0, 30));
    const response = await fetch(`${api.defaults.baseURL}${TTS_URL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: token },
      body: JSON.stringify({ text }),
    });
    console.log('TTS 响应状态:', response.status, 'content-type:', response.headers.get('content-type'));
    if (!response.ok) { console.log('TTS 失败'); await unduckBgMusic(); return; }

    const arrayBuffer = await response.arrayBuffer();
    console.log('TTS 音频大小:', arrayBuffer.byteLength);
    if (arrayBuffer.byteLength === 0) { console.log('TTS 音频为空'); await unduckBgMusic(); return; }

    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    const base64 = btoa(binary);
    const tmpPath = FileSystem.cacheDirectory + `tts_${Date.now()}.mp3`;
    await FileSystem.writeAsStringAsync(tmpPath, base64, { encoding: 'base64' as any });
    console.log('TTS 文件写入:', tmpPath);

    await _ensureAudioMode(false);

    const { sound } = await Audio.Sound.createAsync(
      { uri: tmpPath },
      { shouldPlay: true, volume: 1.0 }
    );
    _sound = sound;
    _speaking = true;
    console.log('TTS 开始播放');

    await new Promise<void>((resolve) => {
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          console.log('TTS 播放完成');
          _speaking = false;
          sound.unloadAsync().catch(() => {});
          FileSystem.deleteAsync(tmpPath, { idempotent: true }).catch(() => {});
          resolve();
        }
      });
    });
  } catch (e) {
    console.log('TTS 错误:', e);
    _speaking = false;
  } finally {
    await unduckBgMusic(); // 恢复背景音乐音量
  }
}

export function stopSpeaking(): void {
  if (_sound) {
    _sound.stopAsync().catch(() => {});
    _sound.unloadAsync().catch(() => {});
    _sound = null;
  }
  _speaking = false;
}

export function isSpeaking(): boolean {
  return _speaking;
}
