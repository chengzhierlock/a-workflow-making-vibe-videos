/*
 * 线条动画风格 · 专属视觉组件 (line animation visuals)
 * ---------------------------------------------------------------
 * 追加到主 VISUALS 库之后加载，注册线条动画专属组件。
 * 核心手法：深色底 + 发光描边 + 描边生长（stroke 一笔笔画出）+ 沿线流动光点。
 * 强调「线在被画出来、在流动、在形变」的过程感，与手绘纸感/立体块/扁平色块区分。
 *
 * 组件：
 *   lineDraw  - 一笔画出几何图形（圆/方/星/多边形），笔尖发光，描边生长
 *   lineFlow  - 多条贝塞尔曲线 + 沿线流动光点（流程/数据流向）
 *   lineGraph - 坐标轴 + 折线逐段画出 + 数据点（数据趋势）
 *   lineMorph - 形状顶点线性插值，一个形变成另一个（演变/变换）
 *   lineWave  - 多条正弦波叠加流动（底纹/情绪/声音）
 */
(function (global) {
  'use strict';
  var TAU = Math.PI * 2;
  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
  function ease(v) { return v * v * (3 - 2 * v); }
  // 确定性伪随机：同一 index 永远同值，保证 seek 抓帧跨 worker 画面一致
  function rnd(i) { var x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

  // 按累计长度画折线的一部分，返回笔尖坐标（null 表示还没开始）
  function partialPath(ctx, pts, p, close) {
    if (p <= 0) return null;
    var segs = [], total = 0, i;
    for (i = 0; i < pts.length - 1; i++) {
      var len = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
      segs.push(len); total += len;
    }
    if (close) {
      var cl = Math.hypot(pts[pts.length - 1].x - pts[0].x, pts[pts.length - 1].y - pts[0].y);
      segs.push(cl); total += cl;
    }
    var target = total * clamp01(p);
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    var acc = 0;
    for (i = 0; i < segs.length; i++) {
      var a = pts[i], b = pts[(i + 1) % pts.length];
      if (acc + segs[i] <= target) { ctx.lineTo(b.x, b.y); acc += segs[i]; }
      else {
        var f = (target - acc) / segs[i];
        var tip = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
        ctx.lineTo(tip.x, tip.y);
        return tip;
      }
    }
    return pts[(pts.length - 1) % pts.length];
  }
  function glow(ctx, color, blur) {
    ctx.shadowColor = color; ctx.shadowBlur = blur == null ? 18 : blur;
  }
  function noGlow(ctx) { ctx.shadowBlur = 0; }
  function tipDot(ctx, p, color, r) {
    if (!p) return;
    ctx.save(); glow(ctx, color, 26);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p.x, p.y, r || 8, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function lineStyle(ctx, color, w) {
    ctx.strokeStyle = color; ctx.lineWidth = w || 5;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  }
  // 生成正多边形顶点
  function polyPts(cx, cy, r, sides, rot) {
    var a = [];
    for (var i = 0; i < sides; i++) {
      var t = rot - Math.PI / 2 + i * TAU / sides;
      a.push({ x: cx + Math.cos(t) * r, y: cy + Math.sin(t) * r });
    }
    return a;
  }
  function starPts(cx, cy, ro, ri, rot) {
    var a = [];
    for (var i = 0; i < 10; i++) {
      var r = i % 2 ? ri : ro, t = rot - Math.PI / 2 + i * Math.PI / 5;
      a.push({ x: cx + Math.cos(t) * r, y: cy + Math.sin(t) * r });
    }
    return a;
  }

  var CYAN = '#5fe0ff', PINK = '#ff6ec7', GOLD = '#ffd166', MINT = '#06d6a0';

  // ============ 组件 1：一笔画出几何图形 ============
  function lineDraw(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var cx = W / 2, cy = H * (opts.oy || 0.46);
    var R = Math.min(W, H) * (opts.radius || 0.17);
    var color = opts.color || CYAN;
    var start = Date.now(), raf;
    // 图形序列：圆、方、三角、星、六边形
    var kinds = ['circle', 'square', 'triangle', 'star', 'hex'];
    function shapePts(kind) {
      if (kind === 'circle') return null;
      if (kind === 'square') return polyPts(cx, cy, R * 1.15, 4, Math.PI / 4);
      if (kind === 'triangle') return polyPts(cx, cy, R * 1.3, 3, 0);
      if (kind === 'star') return starPts(cx, cy, R * 1.25, R * 0.55, 0);
      return polyPts(cx, cy, R * 1.1, 6, 0);
    }
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = (Date.now() - start) / 1000;
      var cyc = (t % 8) / 8;                       // 8 秒一轮
      var k = Math.floor(t / 8) % kinds.length;
      var drawP = ease(clamp01((cyc - 0.05) / 0.5));
      var hold = clamp01((cyc - 0.62) / 0.16);     // 画完后整体淡出
      var kind = kinds[k];
      var pts = shapePts(kind);
      ctx.save(); ctx.globalAlpha = 1 - hold;
      glow(ctx, color, 20);
      lineStyle(ctx, color, 6);
      var tip = null;
      if (kind === 'circle') {
        ctx.beginPath(); ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + TAU * drawP);
        ctx.stroke();
        tip = { x: cx + Math.cos(-Math.PI / 2 + TAU * drawP) * R, y: cy + Math.sin(-Math.PI / 2 + TAU * drawP) * R };
      } else {
        tip = partialPath(ctx, pts, drawP, true); ctx.stroke();
      }
      tipDot(ctx, drawP < 1 ? tip : null, color, 9);
      // 画完瞬间的一次呼吸高亮
      if (drawP >= 1 && hold < 0.4) {
        noGlow(ctx);
        ctx.globalAlpha = (0.4 - hold) * 1.6;
        lineStyle(ctx, '#fff', 2);
        if (kind === 'circle') { ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke(); }
        else { partialPath(ctx, pts, 1, true); ctx.stroke(); }
      }
      ctx.restore(); noGlow(ctx);
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // ============ 组件 2：流动曲线 + 沿线光点 ============
  function lineFlow(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var n = Math.round(opts.lines || 5);
    var curves = [];
    for (var i = 0; i < n; i++) {
      curves.push({
        y0: H * (0.30 + i * (0.40 / Math.max(1, n - 1))),
        amp: H * (0.04 + rnd(i * 5 + 2) * 0.06),
        phase: rnd(i * 9 + 3) * TAU,
        color: [CYAN, MINT, PINK, GOLD, '#7aa8ff'][i % 5]
      });
    }
    function bezier(c, t, W) {
      var x = W * t;
      var y = c.y0 + Math.sin(t * TAU * 1.5 + c.phase) * c.amp * Math.sin(Math.PI * t);
      return { x: x, y: y };
    }
    var start = Date.now(), raf;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = (Date.now() - start) / 1000;
      var cyc = (t % 7) / 7;
      for (var i = 0; i < curves.length; i++) {
        var c = curves[i];
        var drawP = ease(clamp01((cyc - i * 0.05) / 0.45));
        if (drawP <= 0) continue;
        // 曲线本体：逐点描出
        ctx.beginPath();
        var STEPS = 60, last = null;
        for (var s = 0; s <= STEPS * drawP; s++) {
          var p = bezier(c, s / STEPS, W);
          if (s === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
          last = p;
        }
        glow(ctx, c.color, 14);
        lineStyle(ctx, c.color, 4);
        ctx.stroke(); noGlow(ctx);
        // 沿线跑的光点
        var f = (cyc * 1.2 - i * 0.12) % 1;
        if (f >= 0 && f <= drawP) {
          var dp = bezier(c, f, W);
          tipDot(ctx, dp, c.color, 10);
        }
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // ============ 组件 3：折线图逐段画出 ============
  function lineGraph(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var vals = opts.values || [0.35, 0.62, 0.48, 0.85, 0.70, 0.95];
    var x0 = W * 0.12, x1 = W * 0.88, y0 = H * 0.62, y1 = H * 0.32;
    var pts = vals.map(function (v, i) {
      return { x: x0 + (x1 - x0) * (i / (vals.length - 1)), y: y0 - (y0 - y1) * v };
    });
    var color = opts.color || CYAN;
    var start = Date.now(), raf;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var cyc = ((Date.now() - start) / 1000 % 7) / 7;
      // 坐标轴
      noGlow(ctx); lineStyle(ctx, 'rgba(160,200,255,.35)', 3);
      ctx.beginPath(); ctx.moveTo(x0, y0 + 30); ctx.lineTo(x1, y0 + 30); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x0 - 20, y1 - 10); ctx.lineTo(x0 - 20, y0 + 30); ctx.stroke();
      // 网格横线
      ctx.strokeStyle = 'rgba(160,200,255,.12)'; ctx.lineWidth = 2;
      for (var g = 0; g <= 3; g++) {
        var gy = y1 + (y0 - y1) * (g / 3);
        ctx.beginPath(); ctx.moveTo(x0, gy); ctx.lineTo(x1, gy); ctx.stroke();
      }
      // 折线逐段画出
      var drawP = ease(clamp01((cyc - 0.06) / 0.5));
      var seg = drawP * (pts.length - 1);
      var full = Math.floor(seg), frac = seg - full;
      ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
      var tip = pts[0];
      for (var i = 1; i <= full && i < pts.length; i++) { ctx.lineTo(pts[i].x, pts[i].y); tip = pts[i]; }
      if (full < pts.length - 1 && frac > 0) {
        var a = pts[full], b = pts[full + 1];
        var nx = a.x + (b.x - a.x) * frac, ny = a.y + (b.y - a.y) * frac;
        ctx.lineTo(nx, ny); tip = { x: nx, y: ny };
      }
      glow(ctx, color, 18); lineStyle(ctx, color, 6); ctx.stroke(); noGlow(ctx);
      // 数据点（画到哪亮到哪）
      for (var j = 0; j < pts.length; j++) {
        if (j > full) continue;
        ctx.fillStyle = '#0a1020'; ctx.beginPath(); ctx.arc(pts[j].x, pts[j].y, 9, 0, TAU); ctx.fill();
        ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.stroke();
      }
      tipDot(ctx, drawP < 1 ? tip : null, color, 10);
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // ============ 组件 4：形状形变 morph ============
  function lineMorph(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var cx = W / 2, cy = H * 0.46, R = Math.min(W, H) * 0.16;
    var color = opts.color || PINK;
    var shapes = [polyPts(cx, cy, R * 1.1, 4, Math.PI / 4),
                  polyPts(cx, cy, R * 1.2, 6, 0),
                  starPts(cx, cy, R * 1.25, R * 0.55, 0),
                  polyPts(cx, cy, R * 1.3, 3, 0)];
    var start = Date.now(), raf;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = (Date.now() - start) / 1000;
      var cyc = (t % 8) / 8;
      var phase = cyc * shapes.length;
      var i = Math.floor(phase) % shapes.length;
      var f = ease(phase - Math.floor(phase));
      var a = shapes[i], b = shapes[(i + 1) % shapes.length];
      var N = Math.max(a.length, b.length);
      var pts = [];
      for (var k = 0; k < N; k++) {
        var pa = a[k % a.length], pb = b[k % b.length];
        pts.push({ x: pa.x + (pb.x - pa.x) * f, y: pa.y + (pb.y - pa.y) * f });
      }
      ctx.save(); glow(ctx, color, 22); lineStyle(ctx, color, 6);
      partialPath(ctx, pts, 1, true); ctx.stroke();
      ctx.restore(); noGlow(ctx);
      // 顶点小圆点
      for (var j = 0; j < pts.length; j++) {
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(pts[j].x, pts[j].y, 6, 0, TAU); ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // ============ 组件 5：正弦波流动 ============
  function lineWave(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var n = Math.round(opts.lines || 7);
    var colors = opts.colors || [CYAN, MINT, PINK, GOLD, '#7aa8ff'];
    var start = Date.now(), raf;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = (Date.now() - start) / 1000 * (opts.speed == null ? 1 : opts.speed);
      for (var i = 0; i < n; i++) {
        var baseY = H * (0.28 + i * (0.44 / Math.max(1, n - 1)));
        var amp = H * (0.035 + rnd(i * 4 + 1) * 0.04);
        var c = colors[i % colors.length];
        ctx.beginPath();
        for (var x = 0; x <= W; x += 12) {
          var y = baseY + Math.sin(x / W * TAU * (1.5 + i * 0.15) + t * 1.6 + i) * amp
                        + Math.sin(x / W * TAU * 0.6 - t) * amp * 0.5;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        glow(ctx, c, 10); lineStyle(ctx, c, 3); ctx.stroke(); noGlow(ctx);
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  var V = global.VISUALS || (global.VISUALS = {});
  V.lineDraw = lineDraw;
  V.lineFlow = lineFlow;
  V.lineGraph = lineGraph;
  V.lineMorph = lineMorph;
  V.lineWave = lineWave;
})(window);
