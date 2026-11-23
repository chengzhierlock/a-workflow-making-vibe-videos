#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
compose_audio.py — 人声时间轴拼接 + 氛围垫乐 + 混流

人声：每句 mp3 按 start(秒) 用 adelay 放到时间轴，amix 合成
音乐：默认用 numpy 程序化生成柔和和弦 pad（零依赖）；也可传 --music 用现成文件
输出：一条完整音轨 final_audio.m4a，供视频合成直接 mux
"""
import os
import subprocess
import sys
import math

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib_ffmpeg import FFMPEG
SR = 44100


def make_pad(path: str, duration: float, seed: int = 7):
    """程序化生成 4 和弦循环的柔和氛围垫乐（Am - F - C - G）"""
    rng = np.random.default_rng(seed)
    t = np.arange(int(duration * SR)) / SR
    out = np.zeros_like(t)

    # 和弦频率（低八度铺底 + 高八度泛音）
    chords = [
        [220.00, 261.63, 329.63],  # Am
        [174.61, 220.00, 261.63],  # F
        [261.63, 329.63, 392.00],  # C
        [196.00, 246.94, 293.66],  # G
    ]
    bar = 4.0
    for bi, chord in enumerate(chords):
        start = bi * bar
        idx = (t >= start) & (t < start + bar + 0.6)
        if not idx.any():
            continue
        lt = t[idx] - start
        # attack 0.8s / release 1.2s 的柔和包络
        env = np.clip(lt / 0.8, 0, 1) * np.clip((bar + 0.6 - lt) / 1.2, 0, 1)
        tone = np.zeros_like(lt)
        for f in chord:
            # 主音 + 轻微失谐 chorus
            tone += np.sin(2 * np.pi * f * lt) * 0.6
            tone += np.sin(2 * np.pi * (f + 0.6) * lt) * 0.25
            tone += np.sin(2 * np.pi * f * 2 * lt) * 0.08
        out[idx] += tone * env / len(chord)

    # 低频呼吸感（缓慢 LFO 调制音量）
    lfo = 0.86 + 0.14 * np.sin(2 * np.pi * 0.14 * t)
    out *= lfo
    # 轻微噪声纹理
    out += rng.normal(0, 0.004, len(out))
    out = out / (np.max(np.abs(out)) + 1e-9) * 0.9

    # 写 16-bit PCM wav
    pcm = (out * 32767).astype("<i2")
    import wave
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    return path


def build_voice(audio_files, total, out_path):
    """按 start 时间把每句语音放到时间轴并合成"""
    inputs = []
    filters = []
    labels = []
    for i, a in enumerate(audio_files):
        inputs += ["-i", a["path"]]
        delay = int(round(a["start"] * 1000))
        filters.append(f"[{i}:a]adelay={delay}|{delay}[a{i}]")
        labels.append(f"[a{i}]")
    mix = "".join(labels) + f"amix=inputs={len(audio_files)}:duration=longest:normalize=0"
    filters.append(mix + "[v]")
    fc = ";".join(filters)
    cmd = [FFMPEG, "-y"] + inputs + [
        "-filter_complex", fc,
        "-map", "[v]", "-t", str(total),
        "-ac", "1", "-ar", "44100", out_path,
    ]
    subprocess.run(cmd, capture_output=True, check=True)
    return out_path


def mix_final(voice_path, music_path, out_path, music_volume=0.16):
    cmd = [
        FFMPEG, "-y", "-i", voice_path, "-i", music_path,
        "-filter_complex",
        f"[0:a]volume=1.0[v];[1:a]volume={music_volume}[m];[v][m]amix=inputs=2:duration=first:normalize=0[a]",
        "-map", "[a]", "-c:a", "aac", "-b:a", "192k", out_path,
    ]
    subprocess.run(cmd, capture_output=True, check=True)
    return out_path


def compose(audio_files, total, work_dir, music_src=None, music_volume=0.16):
    voice = os.path.join(work_dir, "_voice.wav")
    build_voice(audio_files, total, voice)
    print(f"  人声时间轴合成完成: {total}s")

    if music_src and os.path.exists(music_src):
        music = music_src
        print(f"  使用指定音乐: {os.path.basename(music_src)}")
    else:
        music = os.path.join(work_dir, "_pad.wav")
        make_pad(music, total + 2)
        print("  程序化氛围垫乐生成完成 (Am-F-C-G)")

    final = os.path.join(work_dir, "_final_audio.m4a")
    mix_final(voice, music, final, music_volume)
    print(f"  混流完成: {os.path.basename(final)}")
    return final


if __name__ == "__main__":
    import json
    with open(sys.argv[1], "r", encoding="utf-8") as f:
        meta = json.load(f)
    compose(meta["audio_files"], meta["total"], sys.argv[2],
            sys.argv[3] if len(sys.argv) > 3 else None)
