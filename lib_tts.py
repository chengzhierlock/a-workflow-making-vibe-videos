#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
lib_tts.py — 逐句配音 + 精确时长驱动

设计要点：
  * narration 支持字符串（按标点自动分句）或字符串数组（手动分句）
  * 每一句单独生成 mp3、用 ffprobe 测真实时长
  * 输出：每页 sentences[{text,dur}] + 全局 audio_files[{path,start,dur}]
  * HTML 用同一份时间轴驱动「逐句字幕」和「翻页」，人声/画面/字幕三者同步
"""
import asyncio
import os
import re
import subprocess
import sys
import json

import edge_tts

FFMPEG = r"C:\Users\21734\AppData\Local\Microsoft\WinGet\Links\ffmpeg.exe"
FFPROBE = FFMPEG.replace("ffmpeg.exe", "ffprobe.exe")
_SENT_SPLIT = re.compile(r"(?<=[。！？!?；;])")


def split_sentences(narration):
    if isinstance(narration, list):
        parts = [str(x).strip() for x in narration if str(x).strip()]
    else:
        parts = [x.strip() for x in _SENT_SPLIT.split(str(narration)) if x.strip()]
    # 合并过短碎片（少于 4 字且不是最后一句）
    merged = []
    for p in parts:
        if merged and len(p) < 4:
            merged[-1] += p
        else:
            merged.append(p)
    return merged or [str(narration)]


def probe_duration(path: str) -> float:
    out = subprocess.run(
        [FFPROBE, "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", path],
        capture_output=True, text=True, check=True,
    )
    return float(out.stdout.strip())


async def synth_one(text, voice, rate, volume, out_path):
    await edge_tts.Communicate(text, voice, rate=rate, volume=volume).save(out_path)


def build_audio(content: dict, work_dir: str):
    audio_dir = os.path.join(work_dir, "_audio")
    os.makedirs(audio_dir, exist_ok=True)

    voice = content.get("voice", "zh-CN-YunxiNeural")
    rate = content.get("rate", "+8%")
    volume = content.get("volume", "+0%")
    gap = float(content.get("gap", 0.32))       # 页间停顿
    lead = float(content.get("lead", 0.30))     # 翻页后到人声开始的缓冲
    inner_gap = float(content.get("inner_gap", 0.10))  # 句间停顿

    slides = content["slides"]
    page_results = []
    audio_files = []
    cursor = 0.0  # 全局时间轴

    for i, slide in enumerate(slides):
        sentences = split_sentences(slide.get("narration", ""))
        if not sentences:
            raise ValueError(f"slide[{i}] 缺少 narration")

        page_start = cursor
        sent_res = []
        for j, text in enumerate(sentences):
            mp3 = os.path.join(audio_dir, f"s{i:02d}_{j:02d}.mp3")
            asyncio.run(synth_one(text, voice, rate, volume, mp3))
            dur = probe_duration(mp3)
            start = round(cursor + lead, 3)
            audio_files.append({"path": mp3, "start": start, "duration": round(dur, 3)})
            sent_res.append({"text": text, "start": round(start - page_start, 3),
                             "dur": round(dur, 3)})
            cursor += dur + inner_gap
            print(f"  [{i+1:02d}.{j+1:02d}] {dur:5.2f}s  {text[:26]}")

        tail = gap + (0.9 if slide.get("type") == "end" else 0)
        page_duration = round(cursor - page_start + tail, 3)
        cursor += tail

        s = dict(slide)
        s["sentences"] = sent_res
        s["duration"] = int(page_duration * 1000)
        page_results.append(s)

    total = round(cursor, 3)
    return page_results, audio_files, total


if __name__ == "__main__":
    content_path, work_dir = sys.argv[1], sys.argv[2]
    with open(content_path, "r", encoding="utf-8") as f:
        content = json.load(f)
    slides, audios, total = build_audio(content, work_dir)
    print(f"TOTAL {total}s / {len(slides)} pages / {len(audios)} sentences")
