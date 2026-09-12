/*
 * eIsland - A sleek, Apple Dynamic Island inspired floating widget for Windows, built with Electron.
 * https://github.com/JNTMTMTM/eIsland
 *
 * Copyright (C) 2026 JNTMTMTM
 * Copyright (C) 2026 pyisland.com
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 */

/**
 * @file useAgentVoiceInputRuntime.ts
 * @description 语音输入球运行时（汐月本地化版）
 * @description 录音→PCM16 本地累积→结束拼 wav→window.api.xiyueTranscribe
 *   （faster-whisper 本地转写），替代原腾讯实时语音识别（已删除）。
 */

import { useEffect } from 'react';
import useIslandStore from '../../../../store/isLandStore';
import {
  AGENT_VOICE_AUDIO_CONSTRAINTS,
  AGENT_VOICE_FRAME_SIZE,
  AGENT_VOICE_MAX_RECORDING_MS,
  AGENT_VOICE_RMS_SILENCE_THRESHOLD,
  AGENT_VOICE_SILENCE_STOP_MS,
} from '../config/agentVoiceInputConfig';
import { getAudioContextCtor } from '../utils/agentVoiceInputAudio';
import { pushFloat32Frames } from '../utils/agentVoiceInputPcm';
import { readEffectiveAudioVolume } from '../../../../utils/audio/volume';
import { stopXiyueTtsPlayback } from '../../../../api/ai/xiyueLocalAgent';

interface UseAgentVoiceInputRuntimeOptions {
  setStatusText: React.Dispatch<React.SetStateAction<string>>;
  setTranscript: React.Dispatch<React.SetStateAction<string>>;
  transcriptRef: React.MutableRefObject<string>;
}

/** 16k mono 16bit PCM → WAV base64（供侧车 /transcribe） */
function buildWavBase64(pcm16: Int16Array): string {
  const sampleRate = 16000;
  const dataSize = pcm16.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeStr = (offset: number, s: string): void => {
    for (let i = 0; i < s.length; i += 1) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);
  new Int16Array(buffer, 44).set(pcm16);
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
  }
  return btoa(binary);
}

let moduleSttCleanup: (() => void) | null = null;

export function useAgentVoiceInputRuntime(options: UseAgentVoiceInputRuntimeOptions): void {
  const { setStatusText, setTranscript, transcriptRef } = options;

  useEffect(() => {
    let active = true;
    let mediaStream: MediaStream | null = null;
    let audioContext: AudioContext | null = null;
    let sourceNode: MediaStreamAudioSourceNode | null = null;
    let processorNode: ScriptProcessorNode | null = null;
    let pending = new Float32Array(0) as Float32Array<ArrayBufferLike>;
    let pcmBuffer: Int16Array[] = [];
    let hasError = false;
    let autoCutoffTimer: ReturnType<typeof setTimeout> | null = null;
    /** 连续静音起始时间戳；听到语音时清零。0 = 尚未检测到静音段 */
    let silenceStartedAt = 0;
    /** 是否已听到过语音（避免开麦即静音被误停） */
    let speechSeen = false;

    const stopAll = (): void => {
      active = false;
      processorNode?.disconnect();
      sourceNode?.disconnect();
      if (audioContext) {
        void audioContext.close().catch(() => {});
        audioContext = null;
      }
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
        mediaStream = null;
      }
      if (moduleSttCleanup === stopAll) moduleSttCleanup = null;
    };

    /** 停止录音并退出语音态：卸载组件后 useEffect cleanup 会做转写 */
    const finishRecording = (): void => {
      if (!active) return;
      stopAll();
      requestAnimationFrame(() => {
        useIslandStore.getState().setIdle();
      });
    };

    if (moduleSttCleanup) {
      moduleSttCleanup();
      moduleSttCleanup = null;
    }
    moduleSttCleanup = stopAll;

    const start = async (): Promise<void> => {
      /** 语音打断：开麦时先停掉正在播的 TTS */
      stopXiyueTtsPlayback();
      const targetVolume = await readEffectiveAudioVolume('effect').catch(() => 1);
      const triggerSound = new Audio('./audio/AGENT.wav');
      triggerSound.volume = targetVolume;
      void triggerSound.play().catch(() => {
        triggerSound.src = './public/audio/AGENT.wav';
        triggerSound.volume = targetVolume;
        void triggerSound.play().catch(() => {});
      });

      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: AGENT_VOICE_AUDIO_CONSTRAINTS,
          video: false,
        });
        if (!active) return;
        const AudioContextCtor = getAudioContextCtor();
        if (!AudioContextCtor) {
          setStatusText('当前环境不支持音频采集');
          return;
        }
        audioContext = new AudioContextCtor({ sampleRate: 16000 });
        sourceNode = audioContext.createMediaStreamSource(mediaStream);
        processorNode = audioContext.createScriptProcessor(1024, 1, 1);
        processorNode.onaudioprocess = (event: AudioProcessingEvent) => {
          if (!active) return;
          const input = event.inputBuffer.getChannelData(0);
          if (!input || input.length === 0) return;

          // RMS 端点检测：说完约 1.5s 自动停止（零新依赖，帧级计算）
          let sumSq = 0;
          for (let i = 0; i < input.length; i += 1) {
            sumSq += input[i] * input[i];
          }
          const rms = Math.sqrt(sumSq / input.length);
          if (rms >= AGENT_VOICE_RMS_SILENCE_THRESHOLD) {
            speechSeen = true;
            silenceStartedAt = 0;
          } else if (speechSeen) {
            if (silenceStartedAt === 0) {
              silenceStartedAt = performance.now();
            } else if (performance.now() - silenceStartedAt >= AGENT_VOICE_SILENCE_STOP_MS) {
              setStatusText('已捕捉到完整语音');
              finishRecording();
              return;
            }
          }

          const samples = new Float32Array(input.length) as Float32Array<ArrayBufferLike>;
          samples.set(input);
          pending = pushFloat32Frames({
            input: samples,
            pending,
            frameSize: AGENT_VOICE_FRAME_SIZE,
            onFrame: (pcm16) => {
              pcmBuffer.push(pcm16);
            },
          });
        };
        sourceNode.connect(processorNode);
        processorNode.connect(audioContext.destination);
        setStatusText('正在聆听…');
        autoCutoffTimer = setTimeout(() => {
          if (!active) return;
          setStatusText('已达最大录音时长（1分钟）');
          finishRecording();
        }, AGENT_VOICE_MAX_RECORDING_MS);
      } catch {
        setStatusText('麦克风权限被拒绝或不可用');
      }
    };

    void start();
    useIslandStore.getState().setAgentMood('listening');

    return () => {
      if (autoCutoffTimer) clearTimeout(autoCutoffTimer);
      stopAll();
      useIslandStore.getState().setAgentMood('happy');

      // 结束：把积累的 PCM 拼成 wav，交给本地 faster-whisper 转写
      void (async () => {
        let finalText = transcriptRef.current?.trim() ?? '';
        if (!finalText && pcmBuffer.length > 0) {
          const total = pcmBuffer.reduce((sum, f) => sum + f.length, 0);
          if (total > 0) {
            setStatusText('识别中…');
            try {
              const merged = new Int16Array(total);
              let offset = 0;
              pcmBuffer.forEach((f) => {
                merged.set(f, offset);
                offset += f.length;
              });
              const res = await window.api.xiyueTranscribe(buildWavBase64(merged));
              const text = (res?.text ?? '').trim();
              if (text) {
                setTranscript(text);
                transcriptRef.current = text;
                finalText = text;
              } else if (!hasError) {
                setStatusText('没听清，再说一遍？');
              }
            } catch {
              if (!hasError) setStatusText('本地识别失败');
            }
          }
        }
        if (finalText) {
          requestAnimationFrame(() => {
            useIslandStore.getState().setStt(finalText);
          });
        }
      })();
    };
  }, [setStatusText, setTranscript, transcriptRef]);
}
