# 内容便利店 · 口播视频工作流

文章 → 口播稿 → 逐句配音 → 动态 HTML（逐句字幕）→ 抓帧 → 人声+音乐混流 → 成品 MP4。
一条命令出片，画面和字幕跟着语音时长精确同步。

## 仓库结构

```text
a-workflow-making-vibe-videos/
├── README.md              # 本说明：用法 / 内容格式 / 视觉 / 扩展
├── VISUAL_PROMPT.md       # 视觉选型提示词：改写稿件时按意象给每页挑动画
├── requirements.txt       # Python 依赖 + 外部环境依赖说明
├── .gitignore             # 排除运行产物（帧图/成品/日志/缓存）
│
├── ── 核心流水线（6 步）──────────────────────
├── pipeline.py            # 主入口，串起全部 6 步
├── lib_tts.py             # ① 逐句配音 + 精确测时
├── lib_html.py            # ② 内容 + 时间轴 → 动态 HTML（逐句字幕 + 动画/风格注入）
├── capture_seek.js        # ③ 帧级步进抓帧（默认）：__seek(t) 确定性还原 + 多浏览器并行（Node）
├── capture.js             # ③ 实时播放抓帧（旧版，--capture realtime 时回退）
├── compose_audio.py       # ⑤ 人声时间轴拼接 + 氛围垫乐 + 混流
├── visuals.js             # 默认动画组件库（星球/粒子/矩阵雨/网络/涟漪/柱状图/雷达）
│
├── ── 可扩展资源 ─────────────────────────
├── content/               # 内容脚本示例（每期一个 json，含大字版/手绘版）
├── styles/                # 动画风格分支，一种风格一个文件夹
│   └── sketch/            #   逐帧手绘：style.css + visuals.js + meta.json
├── assets/                # 素材：图片背景 + 背景音乐（Mixkit 免费可商用）
│
└── （以下为本地运行产物，已 .gitignore，不入库）
    ├── _work/<输出名>/    # 中间产物：分句音频/帧图/HTML/timeline/静音视频
    └── output/            # 成品 MP4
```

## 怎么用

### 常规出片
```bash
python "D:\自媒体\_workflow\pipeline.py" "D:\自媒体\_workflow\content\文章名.json" "输出名"
```

### 复用已有配音（改了画面、不想重新配音）
```bash
python "D:\自媒体\_workflow\pipeline.py" "D:\自媒体\_workflow\content\文章名.json" "输出名" --resume
```
> `--resume` 会读取工作目录里的 `timeline.json`，跳过最耗时的配音步骤。

### 抓帧模式（默认帧级步进，快）
默认用 `capture_seek.js`：页面注入确定性渲染模式（URL 带 `?render=1`），逐帧 `__seek(t)` 把
页面还原到该时刻后直接截图，**不等真实时间流逝**，并用多浏览器并行。实测 2 分半的视频
从实时抓帧约 150 秒降到约 90 秒，且不会因中断卡在半途。可调并行数：
```bash
python "...\pipeline.py" "...\文章名.json" "输出名" --workers 8
```
如需回退到旧的实时播放抓帧（兼容性兜底）：`--capture realtime`。
> 帧级模式的确定性逻辑在 `lib_html.py` 的 `RENDER_JS` 常量；普通放映页面无 `render=1` 参数时
> 这段是死代码，放映/预览行为零变化。canvas 装饰动画的相位允许差几帧，肉眼无感。

### 指定自己的音乐
```bash
python "D:\自媒体\_workflow\pipeline.py" "...\文章名.json" "输出名" --music "D:\自媒体\music.mp3"
```

> 注意：PowerShell 里直接运行即可，**不要**在命令后加 `2>&1 | Select-Object` 之类的管道——
> 管道处理中文 stderr 会误报 NativeCommandError。

## 内容脚本格式（content.json）

```json
{
  "account": "内容便利店",
  "title": "本期标题",
  "tag": "热点速览",
  "voice": "zh-CN-YunxiNeural",
  "rate": "+8%",
  "volume": "+0%",
  "gap": 0.32,          // 页间停顿（秒）
  "lead": 0.30,         // 翻页到人声开始的缓冲（秒）
  "inner_gap": 0.10,    // 句间停顿（秒）
  "music_volume": 0.16, // 背景音乐音量（无人声时可调到 0.3）
  "music": null,        // 填音频路径则用指定音乐，null 用程序化垫乐
  "slides": [
    {
      "type": "cover",           // cover / content / timeline / stat / end
      "eyebrow": "小标题",
      "title": "主标题，用 <>高亮</> 渐变色",
      "sub": "副标题，<br> 换行",
      "narration": "这一页要念的话。支持整段字符串（按标点自动分句），也支持数组手动分句。"
    },
    {
      "type": "content",
      "eyebrow": "01 / 小标题",
      "title": "标题",
      "items": [ {"h": "要点标题", "p": "要点说明"} ],
      "narration": ["第一句。", "第二句。"]
    },
    {
      "type": "timeline",
      "eyebrow": "时间线",
      "title": "标题",
      "items": [ {"d": "11.12", "t": "发生了什么"} ],
      "narration": "……"
    },
    {
      "type": "stat",
      "eyebrow": "数字",
      "title": "标题",
      "items": [ {"n": "2万亿", "l": "说明"} ],
      "narration": "……"
    }
  ]
}
```

### 关键规则
- **narration 是配音稿，也是字幕源**：一句话一个句子节点，字幕和语音严格对齐。
- **标题里的 `<>文字</>`** 会渲染成蓝紫渐变高亮。
- **每页时长 = 该页所有句子语音时长 + 句间停顿 + 页尾 gap**，全自动算，不用手填。
- 程序化分句按 `。！？；` 切；想精确控制断句就把 narration 写成数组。

## 视觉动画（画面跟稿子的意象走）

每页可选配一个 Canvas 动画，**在文字下层播放，不遮挡内容**。用法是在 page 里加
`visual` 字段：

```json
"visual": { "name": "planet", "opts": { "size": 0.34, "speed": 0.004 } }
```

- **不写 `visual`** = 该页纯版式（密集文字页建议留空）
- **7 个内置组件**：`planet` 自转星球、`particles` 星尘、`matrix` 数字雨、
  `network` 节点网络、`ripple` 扩散涟漪、`bars` 增长柱图、`radar` 扫描雷达
- **怎么挑**：改写稿件时读 `VISUAL_PROMPT.md`——里面有"意象 → 组件"映射表
  （讲到星球配 planet、讲到数据配 bars…）和参数说明，照着给每页填即可
- **加新动画**：在 `visuals.js` 里加一个函数并在 `VISUALS` 注册，全部脚本自动可用，
  不用改 `lib_html.py` / `pipeline.py`（详见 VISUAL_PROMPT.md 第五节）

### 真实图片背景 + 每页主题配色（2026-11-20 新增，解决"配色太统一"）
每页可再加两个字段，画面从"全片一个蓝紫色"变成"每页不同色 + 真实照片"：

```json
"image": "alone_window.jpg",   ← assets 目录下的图片文件名
"theme": "ice"                 ← 主题色名，见下表
```
- **图片**：放一张图到 `assets\`，填文件名；渲染时自动转 base64 内嵌（自包含、不依赖路径），
  作为背景铺满并叠加暗色遮罩保证文字可读。不填则纯色背景。
- **图片来源**：Unsplash 免费可商用（`images.unsplash.com/photo-xxx?w=720&h=1280&fit=crop&q=80`）。
  下载要加 `curl --noproxy '*'`（系统代理会 502，直连正常）。
- **主题色 7 选**：`ice` 冰蓝 / `sunset` 暖橙 / `violet` 紫 / `amber` 琥珀金 /
  `vine` 青绿 / `rose` 玫红 / `steel` 钢蓝。**相邻页用不同色**，视觉才有节奏。
- 主题色会驱动：主色/辅色、背景渐变、标题高亮、卡片描边、字幕强调、进度条，全片统一切换。

已端到端验证：
- `output\视觉组件样片.mp4`（纯动画：星球→网络→涟漪→星尘）
- `output\微信社交_口播版.mp4`（图片+配色：冰蓝→紫→琥珀→钢蓝→玫红→青绿→暖橙→冰蓝，8页8色）

## 动画风格分支（一视频一风格，可扩展）

在默认科技风之上，用 **风格皮肤** 派生不同美术风格，核心代码（pipeline/lib_html）不用改。
启用方式：content.json **顶层加 `"style": "<风格id>"`**；不填 = 默认科技风（老视频全部兼容）。

```
styles\
  sketch\            ← 逐帧手绘（已实现）
    style.css        ← 覆盖默认 CSS：纸张背景/手写体/手绘卡片/圈注字幕
    visuals.js       ← 风格专属 Canvas 组件，追加注册到 VISUALS
    meta.json        ← 风格说明、可用动画、配色建议
```

**加一个新风格的步骤**（14 种待做风格都照此办理）：
1. 在 `styles\` 下建 `<风格id>\` 文件夹，放 `style.css`（用 `!important` 覆盖默认类）、
   `visuals.js`（可选，注册新组件到 `global.VISUALS`）、`meta.json`（说明）。
2. content.json 顶层 `"style": "<风格id>"`，页面 `visual.name` 用该风格组件。
3. 渲染器 `lib_html.py` 的 `_load_style()` 会自动加载并注入，无需改代码。

**已实现风格**：
- `sketch` 逐帧手绘：米黄纸感 + 楷体手写 + 铅笔线稿逐笔勾勒。组件：
  `sketchDoodle`（简笔图标浮现）、`sketchArrows`（手绘箭头）、
  `sketchChart`（手绘柱图）、`sketchBulb`（手绘灯泡）。样片：`output\手绘样片.mp4`。

**待做风格清单**（按用户规划）：等轴2.5D、扁平矢量、线条动画、3D渲染、形变动画、
贴纸风科普、赛博朋克HUD、拼贴剪纸、弥散渐变玻璃拟态、几何构成包豪斯、
复古synthwave、像素风、液态流动、综艺花字。

## 配音音色（edge-tts 微软在线神经语音）

| 音色 | voice 值 | 特点 |
|------|---------|------|
| 云希 | `zh-CN-YunxiNeural` | 年轻有活力，自媒体解说，当前默认 |
| 云扬 | `zh-CN-YunyangNeural` | 沉稳新闻播报风 |
| 晓晓 | `zh-CN-XiaoxiaoNeural` | 温暖亲和，泛内容 |
| 晓伊 | `zh-CN-XiaoyiNeural` | 娇俏年轻 |
| 云健 | `zh-CN-YunjianNeural` | 浑厚男声 |

语速用 `rate` 调，如 `"+8%"` 加快、`"-5%"` 放慢。

## 音乐三种方案

1. **程序化垫乐（默认，零依赖）**：numpy 合成的 Am-F-C-G 柔和和弦循环，全自动、无版权问题。
2. **自己的音乐**：`--music` 传 mp3/wav，适合已有心仪 BGM。
3. **AI 生成音乐**：先生成好音频文件，再走 `--music` 接入（需自己提供 API Key）。

## 环境依赖与坑

- Python：`C:\Program Files\Python311\python.exe`（edge-tts 7.3.1 装在这个环境）
- ffmpeg / ffprobe：`C:\Users\21734\AppData\Local\Microsoft\WinGet\Links\`
- Playwright：装在 `D:\自媒体\_tools`，用系统 Chrome，抓帧走 CDP（不依赖 playwright 自带 ffmpeg）
- **C 盘已满**：所有缓存、临时文件都导向 `D:\自媒体\_tmp`，脚本内已固化
- **批量删帧**：`_work\<输出名>\_frames` 有近 3000 张 jpg，一次性删会触发系统批量删除保护，需分批
- **抓帧每帧必须 ACK**：`capture.js` 里 `Page.screencastFrameAck` 不能节流，否则帧流会断
