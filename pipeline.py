#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
pipeline.py — 文章 → 口播视频 全链路流水线

用法:
  python pipeline.py content/xxx.json [输出名] [--music 音乐文件]

流程:
  1. 逐句 TTS + 精确测时  (lib_tts)
  2. 渲染时长驱动的动态 HTML + 逐句字幕  (lib_html)
  3. Chrome CDP 抓帧 → 30fps 帧序列  (capture.js)
  4. ffmpeg 合成无声视频
  5. 人声时间轴拼接 + 氛围垫乐混流  (compose_audio)
  6. mux 成最终 MP4

所有缓存/临时文件都在 D 盘，不碰已满的 C 盘。
"""
import json
import os
import subprocess
import sys
import shutil

BASE = os.path.dirname(os.path.abspath(__file__))
D = r"D:\自媒体"
FFMPEG = r"C:\Users\21734\AppData\Local\Microsoft\WinGet\Links\ffmpeg.exe"
NODE_MODULES = os.path.join(D, "_tools", "node_modules")
TMPDIR = os.path.join(D, "_tmp")

sys.path.insert(0, BASE)
import lib_tts
import lib_html
import compose_audio


def run(cmd, env=None, **kw):
    e = os.environ.copy()
    e["TEMP"] = TMPDIR
    e["TMP"] = TMPDIR
    e["NODE_PATH"] = NODE_MODULES
    if env:
        e.update(env)
    print("  >", " ".join(str(x) for x in cmd[:4]), "...")
    return subprocess.run(cmd, env=e, check=True, capture_output=True, text=True, **kw)


def main():
    if len(sys.argv) < 2:
        print("用法: python pipeline.py content/xxx.json [输出名] [--music 音乐文件]")
        sys.exit(1)

    content_path = sys.argv[1]
    if not os.path.isabs(content_path):
        content_path = os.path.join(BASE, content_path)

    out_name = None
    music_src = None
    resume = False
    capture_mode = "seek"          # 默认帧级步进（快）；--capture realtime 回退到实时播放抓帧
    capture_workers = 6
    args = sys.argv[2:]
    for i, a in enumerate(args):
        if a == "--music" and i + 1 < len(args):
            music_src = args[i + 1]
        elif a == "--resume":
            resume = True
        elif a == "--capture" and i + 1 < len(args):
            capture_mode = args[i + 1]
        elif a == "--workers" and i + 1 < len(args):
            capture_workers = int(args[i + 1])
        elif not a.startswith("--") and out_name is None:
            out_name = a

    with open(content_path, "r", encoding="utf-8") as f:
        content = json.load(f)

    if out_name is None:
        out_name = content.get("title", "output")
    out_name = out_name.replace("\\", "_").replace("/", "_").strip()

    work = os.path.join(BASE, "_work", out_name)
    out_dir = os.path.join(BASE, "output")
    os.makedirs(work, exist_ok=True)
    os.makedirs(out_dir, exist_ok=True)

    print("\n=== 1/6 逐句配音 + 测时 ===")
    timeline_path = os.path.join(work, "timeline.json")
    if resume and os.path.exists(timeline_path):
        with open(timeline_path, "r", encoding="utf-8") as f:
            meta = json.load(f)
        slides, audio_files, total = meta["slides"], meta["audio_files"], meta["total"]
        print("  跳过配音，复用已有时间轴")
    else:
        slides, audio_files, total = lib_tts.build_audio(content, work)
        with open(timeline_path, "w", encoding="utf-8") as f:
            json.dump({"slides": slides, "audio_files": audio_files, "total": total},
                      f, ensure_ascii=False, indent=2)
    total_ms = int(total * 1000)
    print(f"  总时长 {total}s / {len(slides)} 页 / {len(audio_files)} 句")

    print("\n=== 2/6 渲染动态 HTML ===")
    html = lib_html.render_html(content, slides, total_ms)
    html_path = os.path.join(work, "play.html")
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"  {html_path}")

    print("\n=== 3/6 Chrome 抓帧 ===")
    frame_dir = os.path.join(work, "_frames")
    if capture_mode == "seek":
        # 帧级步进：页面 __seek(t) 确定性还原 + 多浏览器并行，无需等真实时间
        print(f"  帧级步进模式（{capture_workers} 浏览器并行）")
        r = run(["node", os.path.join(BASE, "capture_seek.js"), html_path, frame_dir,
                 str(total_ms), "--workers", str(capture_workers)])
    else:
        print("  实时播放模式（兼容旧版）")
        r = run(["node", os.path.join(BASE, "capture.js"), html_path, frame_dir, str(total_ms)])
    for line in r.stdout.strip().splitlines():
        print("  " + line)

    print("\n=== 4/6 合成无声视频 ===")
    silent = os.path.join(work, "_silent.mp4")
    run([
        FFMPEG, "-y", "-framerate", "30", "-i", os.path.join(frame_dir, "f%05d.jpg"),
        "-vf", "unsharp=5:5:0.5:5:5:0.2", "-c:v", "libx264", "-preset", "medium",
        "-crf", "17", "-pix_fmt", "yuv420p", "-movflags", "+faststart", silent,
    ])

    print("\n=== 5/6 人声 + 音乐混流 ===")
    final_audio = compose_audio.compose(
        audio_files, total, work, music_src,
        float(content.get("music_volume", 0.16))
    )

    print("\n=== 6/6 封装成品 ===")
    final = os.path.join(out_dir, out_name + ".mp4")
    run([
        FFMPEG, "-y", "-i", silent, "-i", final_audio,
        "-map", "0:v:0", "-map", "1:a:0",
        "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
        "-shortest", "-movflags", "+faststart", final,
    ])

    # 帧序列保留在工作目录（不自动批量删除，避免触发系统批量删除保护）
    # 需要清理时手动删除 work/_frames 即可
    frame_count = len([f for f in os.listdir(frame_dir) if f.endswith('.jpg')]) if os.path.isdir(frame_dir) else 0
    print(f"  (帧序列保留在 {frame_dir}，共 {frame_count} 帧，可手动清理)")

    size = os.path.getsize(final) / 1024 / 1024
    print(f"\n完成: {final}  ({size:.2f} MB / {total}s)")


if __name__ == "__main__":
    main()
