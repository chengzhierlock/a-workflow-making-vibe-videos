#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
lib_ffmpeg.py — 定位 ffmpeg / ffprobe 可执行文件（跨机器通用）

不写死任何绝对路径或用户名，按以下顺序探测：
  1. 环境变量 FFMPEG_BIN / FFPROBE_BIN（手动指定时优先）
  2. 系统 PATH
  3. WinGet 默认安装目录（用 LOCALAPPDATA 动态拼出，不含用户名）
  4. Program Files 常见位置
都找不到时返回命令名，交给 subprocess 从 PATH 兜底。
"""
import os
import shutil


def _find(exe: str, env_key: str) -> str:
    override = os.environ.get(env_key)
    if override and os.path.exists(override):
        return override
    found = shutil.which(exe)
    if found:
        return found
    local = os.environ.get("LOCALAPPDATA", "")
    if local:
        cand = os.path.join(local, "Microsoft", "WinGet", "Links", exe + ".exe")
        if os.path.exists(cand):
            return cand
    for key in ("ProgramFiles", "ProgramFiles(x86)"):
        base = os.environ.get(key, "")
        if base:
            cand = os.path.join(base, exe + ".exe")
            if os.path.exists(cand):
                return cand
    return exe


FFMPEG = _find("ffmpeg", "FFMPEG_BIN")
FFPROBE = _find("ffprobe", "FFPROBE_BIN")
