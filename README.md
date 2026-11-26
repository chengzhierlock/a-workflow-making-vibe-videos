# 口播视频工作流

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
python pipeline.py content/文章名.json "输出名"
```

### 复用已有配音（改了画面、不想重新配音）
```bash
python pipeline.py content/文章名.json "输出名" --resume
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
python pipeline.py "...\文章名.json" "输出名" --music "music.mp3"
```

> 注意：PowerShell 里直接运行即可，**不要**在命令后加 `2>&1 | Select-Object` 之类的管道——
> 管道处理中文 stderr 会误报 NativeCommandError。

## 内容脚本格式（content.json）

```json
{
  "account": "我的频道",
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
  iso\               ← 等轴2.5D（已实现）
  flat\              ← 扁平矢量（已实现）
  line\              ← 线条动画（已实现）
  cyber\             ← 赛博朋克HUD（已实现）
  huazi\             ← 综艺花字（已实现）
  render3d\          ← 3D渲染（已实现）
  morph\             ← 形变动画（已实现）
  collage\           ← 拼贴剪纸（已实现）
  glass\             ← 弥散渐变玻璃拟态（已实现）
  bauhaus\           ← 包豪斯（已实现）
  synthwave\         ← 复古Synthwave（已实现）
  pixel\             ← 像素风（已实现）
  sticker\           ← 贴纸风科普（已实现）
  liquid\            ← 液态流动（已实现）
    style.css        ← 覆盖默认 CSS：纸张/等轴/扁平/线条/赛博/综艺/3D/形变/拼贴/玻璃/包豪斯/synthwave/像素/贴纸/液态皮肤、字体、卡片、字幕
    visuals.js       ← 风格专属 Canvas 组件，追加注册到 VISUALS
    meta.json        ← 风格说明、可用动画、配色建议
```

**加一个新风格的步骤**（待做风格都照此办理）：
1. 在 `styles\` 下建 `<风格id>\` 文件夹，放 `style.css`（用 `!important` 覆盖默认类）、
   `visuals.js`（可选，注册新组件到 `global.VISUALS`）、`meta.json`（说明）。
2. content.json 顶层 `"style": "<风格id>"`，页面 `visual.name` 用该风格组件。
3. 渲染器 `lib_html.py` 的 `_load_style()` 会自动加载并注入，无需改代码。

**已实现风格**：
- `sketch` 逐帧手绘：米黄纸感 + 楷体手写 + 铅笔线稿逐笔勾勒。组件：
  `sketchDoodle`（简笔图标浮现）、`sketchArrows`（手绘箭头）、
  `sketchChart`（手绘柱图）、`sketchBulb`（手绘灯泡）。样片：`output\手绘样片.mp4`。
- `iso` 等轴2.5D：菱形网格地面 + 三面立方体（顶/左/右）+ 落地阴影 + 立体厚度大字。组件：
  `isoGrid`（流动网格）、`isoBlocks`（方块群升起）、`isoChart`（等轴柱图）、
  `isoFlow`（节点+流动光点）、`isoTower`（数据塔堆叠）。样片：`output\等轴2.5D样片.mp4`。
- `flat` 扁平矢量：浅底 + 纯色块 + 深墨粗描边 + 硬边偏移阴影 + 撞色，杂志插画感。组件：
  `flatShapes`（漂浮几何）、`flatBars`（撞色圆角柱图）、`flatNodes`（节点+粗连线）、
  `flatBlob`（有机波浪色块）、`flatIcons`（几何图标阵列弹出）。样片：`output\扁平矢量样片.mp4`。
- `line` 线条动画：深色底 + 发光描边 + 描边生长 + 空心描边字，强调「线被画出来」的过程感。组件：
  `lineDraw`（一笔画出几何形）、`lineFlow`（曲线+流动光点）、`lineGraph`（折线逐段生长）、
  `lineMorph`（形状形变）、`lineWave`（正弦波流动）。样片：`output\线条动画样片.mp4`。
- `cyber` 赛博朋克HUD：深色底 + 霓虹青品红 + 扫描线 + 故障抖动 + 切角面板。组件：
  `hudGrid`（透视网格）、`hudRadar`（雷达扫描）、`hudBars`（数据条）、
  `hudTarget`（锁定准星）、`hudWave`（示波器+字符雨）。样片：`output\赛博朋克HUD样片.mp4`。
- `huazi` 综艺花字：亮色暖底 + 彩色粗描边立体字 + 倾斜弹出 + 爆炸高亮，字幕即主角。组件：
  `huaziBurst`（爆炸放射线）、`huaziStars`（闪烁星星）、`huaziArrows`（手绘箭头）、
  `huaziSpeech`（对话气泡）、`huaziConfetti`（彩带纸屑）。样片：`output\综艺花字样片.mp4`。
- `render3d` 3D渲染：深空底 + 光照明暗 + 球面高光 + 金属渐变字 + 透视景深 + 玻璃卡片，
  与等轴2.5D的纯色硬边三面区分开。组件：
  `renderSphere`（光照球体）、`renderCube`（透视旋转立方体）、`renderTorus`（3D环面点云）、
  `renderFloor`（透视网格地面）、`renderParticles`（3D粒子场）。样片：`output\3D渲染样片.mp4`。
- `morph` 形变动画：深渐变底 + 无缝形状插值 + 有机流体 + 液态色带 + 柔和呼吸，
  强调「一个形状平滑变成另一个」的过程感。组件：
  `morphShape`（多形状无缝形变）、`morphBlob`（有机流体呼吸）、`morphRing`（环形波浪）、
  `morphWave`（液态色带）、`morphGrid`（网格波纹扭曲）。样片：`output\形变动画样片.mp4`。
- `collage` 拼贴剪纸：牛皮纸暖底 + 撞色不规则剪裁纸片 + 偏移硬阴影 + 手撕毛边 + 胶带图钉，
  白纸片字幕（深墨字压白底，亮色组件铺上来也清晰），与综艺花字的立体砸屏字区分。组件：
  `collagePaper`（撞色纸片堆叠）、`collageTape`（半透明胶带）、`collageTorn`（手撕毛边色带）、
  `collageStickers`（白模切贴纸弹出）、`collagePins`（图钉+麻绳连线）。样片：`output\拼贴剪纸样片.mp4`。
- `glass` 弥散渐变玻璃拟态：深色底 + 紫粉蓝青弥散光斑流动 + 毛玻璃面板 + 细白边柔光 + 玻璃球/圆环，
  白玻璃片字幕（不透明白底+深墨字，亮光斑铺上来也清晰）。组件：
  `glassBlob`（弥散光斑漂移）、`glassCard`（毛玻璃卡片）、`glassOrb`（玻璃球高光弧）、
  `glassRing`（玻璃圆环流光）、`glassMesh`（玻璃珠网格）。样片：`output\弥散玻璃拟态样片.mp4`。
- `bauhaus` 包豪斯：米白网格纸底 + 红黄蓝三原色 + 直角黑粗边 + 几何构成（圆/方/三角/同心圆眼睛图案），
  白底深墨字配原色错落块，功能主义秩序感，与扁平矢量的圆角插画区分。组件：
  `bauhausGrid`（网格色块底纹）、`bauhausShapes`（三原色基本形）、`bauhausBars`（原色柱图）、
  `bauhausCircle`（同心圆眼睛图案）、`bauhausType`（无衬线大字排版）。样片：`output\包豪斯样片.mp4`。
- `synthwave` 复古Synthwave：紫粉渐变夜空 + 横纹切割落日 + 透视网格地面 + 棕榈剪影 + CRT 扫描线 +
  霓虹辉光字，强调 80 年代夜晚公路 / 赛博浪漫氛围，与赛博朋克HUD的仪表雷达感区分。组件：
  `synthSun`（横纹落日）、`synthGrid`（透视网格地面）、`synthPalms`（棕榈剪影）、
  `synthMountains`（霓虹线框山脉）、`synthStars`（星空+光射线+流星）。样片：`output\复古synthwave样片.mp4`。
- `pixel` 像素风：有限调色板 + 方块像素 + 点阵精灵 + 硬边无抗锯齿 + CRT扫描线 + 台阶阴影字，
  红白机/街机复古感，与 synthwave 渐变霓虹、赛博HUD 仪表界面区分。组件：
  `pixelGrid`（像素棋盘格底纹）、`pixelSprite`（点阵精灵弹出）、`pixelBars`（8-bit血条）、
  `pixelRain`（掉落方块）、`pixelScene`（像素平台关卡）。样片：`output\像素风样片.mp4`。
- `sticker` 贴纸风科普：奶油手账纸底 + 白模切边贴纸 + 马卡龙配色 + 科普引线标注 + 塑料高光，
  与拼贴剪纸的牛皮纸毛边、扁平矢量的撞色插画区分。组件：
  `stickerBlob`（贴纸群弹出）、`stickerLabels`（引线标注）、`stickerOrbit`（太阳系/细胞模型）、
  `stickerBars`（马卡龙柱图）、`stickerSteps`（编号步骤贴）。样片：`output\贴纸风科普样片.mp4`。
- `liquid` 液态流动：液滴融合metaball + 墨滴入水晕开 + 黏稠拉丝倾倒 + 虹彩油膜 + 涟漪扩散，
  强调真实液体物理质感，与 morph 的形状插值区分。组件：
  `liquidMetaball`（液滴融合）、`liquidInk`（墨滴晕开）、`liquidPour`（黏稠倾倒）、
  `liquidIridescent`（虹彩油膜）、`liquidRipple`（水滴涟漪）。样片：`output\液态流动样片.mp4`。

**待做风格清单**（按用户规划）：无（15种规划风格全部完成）。

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

## 环境依赖与注意事项

- **Python 3.10+**：安装 `requirements.txt`（edge-tts 7.3.1）。
- **ffmpeg / ffprobe**：需在 `PATH` 中；或设环境变量 `FFMPEG_BIN` / `FFPROBE_BIN` 指定可执行文件。
  脚本会自动按顺序探测：环境变量 → PATH → WinGet 安装目录 → Program Files。
- **Node.js + playwright-core**：用系统已安装的 Chrome 抓帧，走 CDP（不依赖 playwright 自带 ffmpeg）。
- **工作目录**：默认脚本上一级为工作根，中间产物落在 `_work/`、成品在 `output/`。
  可用环境变量 `WORK_ROOT` 改工作根、`WORK_TMP` 改临时目录、`NODE_MODULES` 改依赖路径。
- **电源/存储**：一期视频约 3000 张中间帧图，请预留磁盘空间；批量清理时注意系统删除保护。
- **抓帧每帧必须 ACK**：`capture.js` 里 `Page.screencastFrameAck` 不能节流，否则帧流会断。
