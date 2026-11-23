/*
 * 扁平矢量风格 · 专属视觉组件 (flat vector visuals)
 * ---------------------------------------------------------------
 * 追加到主 VISUALS 库之后加载，注册扁平矢量专属组件。
 * 核心手法：纯色填充 + 深墨粗描边 + 基础几何形状 + 硬边偏移投影（flat 2.0），
 * 不用渐变、不用模糊阴影。明亮撞色，杂志插画感，与等轴立体风格刻意拉开距离。
 *
 * 组件：
 *   flatShapes - 漂浮几何形状（圆/方/三角/胶囊）缓慢浮动，做底纹或主视觉
 *   flatBars   - 扁平圆角柱图，纯色块按数值生长（数据）
 *   flatNodes  - 扁平节点网络：大圆点 + 粗连线 + 流动圆点（流程/关系）
 *   flatBlob   - 有机波浪色块，贝塞尔曲线缓慢变形（背景/情绪）
 *   flatIcons  - 基础几何图标阵列逐个弹出（构成/拆解）
 */
(function (global) {
  'use strict';
  var TAU = Math.PI * 2;
  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (a == null ? 1 : a) + ')'; }
  // 确定性伪随机：同一 index 永远同值，保证 seek 抓帧跨 worker 画面一致
  function rnd(i) { var x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

  var INK = [29, 36, 51];                       // 深墨描边色
  var PALETTE = [
    [255, 107, 107], // 珊瑚红
    [255, 209, 102], // 明黄
    [6, 214, 160],   // 青绿
    [77, 150, 255],  // 亮蓝
    [155, 93, 229],  // 紫
    [255, 159, 67]   // 橙
  ];
  function colOf(c, i) { return c && c.length ? c[i % c.length] : PALETTE[i % PALETTE.length]; }

  // ---- 基础形状路径 ----
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function polygon(ctx, cx, cy, r, sides, rot) {
    ctx.beginPath();
    for (var i = 0; i < sides; i++) {
      var a = rot - Math.PI / 2 + i * TAU / sides;
      var x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }
  function starPath(ctx, cx, cy, ro, ri, rot, points) {
    ctx.beginPath();
    for (var i = 0; i < points * 2; i++) {
      var r = i % 2 ? ri : ro;
      var a = rot - Math.PI / 2 + i * Math.PI / points;
      var x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }
  // 用二次贝塞尔把离散点连成平滑有机形状
  function blobPath(ctx, cx, cy, r, pts, t, amp) {
    var arr = [];
    for (var i = 0; i < pts; i++) {
      var a = i / pts * TAU;
      var rr = r * (1 + amp * Math.sin(a * 3 + t * 1.3) + amp * 0.6 * Math.sin(a * 5 - t * 0.9));
      arr.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr });
    }
    ctx.beginPath();
    ctx.moveTo((arr[pts - 1].x + arr[0].x) / 2, (arr[pts - 1].y + arr[0].y) / 2);
    for (var j = 0; j < pts; j++) {
      var cur = arr[j], nxt = arr[(j + 1) % pts];
      ctx.quadraticCurveTo(cur.x, cur.y, (cur.x + nxt.x) / 2, (cur.y + nxt.y) / 2);
    }
    ctx.closePath();
  }
  // 扁平 2.0 手法：先画硬边偏移投影，再画主体
  function flatFill(ctx, drawPath, fill, shadow, off) {
    if (shadow) {
      ctx.save(); ctx.translate(off, off);
      ctx.fillStyle = shadow; drawPath(); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = fill; drawPath(); ctx.fill();
    ctx.strokeStyle = rgba(INK, 0.92); ctx.lineWidth = 5; ctx.lineJoin = 'round';
    drawPath(); ctx.stroke();
  }

  // ============ 组件 1：漂浮几何形状 ============
  function flatShapes(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var n = Math.round(opts.count || 9);
    var speed = opts.speed == null ? 0.5 : opts.speed;
    var shapes = [];
    for (var i = 0; i < n; i++) {
      shapes.push({
        x: (0.10 + rnd(i * 3 + 1) * 0.80) * W,
        y: (0.14 + rnd(i * 3 + 2) * 0.72) * H,
        r: (0.045 + rnd(i * 3 + 3) * 0.075) * W,
        type: i % 4,                       // 0圆 1方 2三角 3胶囊
        color: colOf(opts.colors, i),
        phase: rnd(i * 7 + 5) * TAU,
        spin: (rnd(i * 11 + 2) - 0.5) * 0.5
      });
    }
    var start = Date.now(), raf;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = (Date.now() - start) / 1000 * speed;
      for (var i = 0; i < shapes.length; i++) {
        var s = shapes[i];
        var dy = Math.sin(t * 1.6 + s.phase) * 26;
        var rot = s.spin * Math.sin(t + s.phase);
        ctx.save();
        ctx.translate(s.x, s.y + dy);
        ctx.rotate(rot);
        if (s.type === 0) {
          flatFill(ctx, function () { ctx.beginPath(); ctx.arc(0, 0, s.r, 0, TAU); },
            rgba(s.color), rgba(INK, 0.9), 9);
        } else if (s.type === 1) {
          flatFill(ctx, function () { roundRect(ctx, -s.r, -s.r, s.r * 2, s.r * 2, s.r * 0.28); },
            rgba(s.color), rgba(INK, 0.9), 9);
        } else if (s.type === 2) {
          flatFill(ctx, function () { polygon(ctx, 0, 0, s.r * 1.15, 3, 0); },
            rgba(s.color), rgba(INK, 0.9), 9);
        } else {
          flatFill(ctx, function () { roundRect(ctx, -s.r * 1.3, -s.r * 0.5, s.r * 2.6, s.r, s.r * 0.5); },
            rgba(s.color), rgba(INK, 0.9), 9);
        }
        ctx.restore();
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // ============ 组件 2：扁平圆角柱图 ============
  function flatBars(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var vals = opts.values || [0.55, 0.82, 0.64, 0.95, 0.72, 0.88];
    var n = vals.length;
    var baseY = H * (opts.base || 0.73);
    var gap = W * 0.018, bw = (W * 0.78 - gap * (n - 1)) / n;
    var x0 = (W - (bw * n + gap * (n - 1))) / 2;
    var maxH = H * 0.34;
    var start = Date.now(), raf;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var cyc = ((Date.now() - start) / 1000 % 6) / 6;
      // 基线
      ctx.strokeStyle = rgba(INK, 0.85); ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(W * 0.08, baseY); ctx.lineTo(W * 0.92, baseY); ctx.stroke();
      for (var i = 0; i < n; i++) {
        var grow = clamp01((cyc - i * 0.06) / 0.5);
        if (grow <= 0) continue;
        var h = vals[i] * maxH * grow * (0.97 + 0.03 * Math.sin(cyc * TAU * 2 + i));
        var x = x0 + i * (bw + gap);
        var c = colOf(opts.colors, i);
        // 硬边偏移投影 + 纯色柱体 + 深墨描边
        ctx.save();
        ctx.translate(10, 10);
        ctx.fillStyle = rgba(INK, 0.92);
        roundRect(ctx, x, baseY - h, bw, h, bw * 0.22); ctx.fill();
        ctx.restore();
        ctx.fillStyle = rgba(c);
        roundRect(ctx, x, baseY - h, bw, h, bw * 0.22); ctx.fill();
        ctx.strokeStyle = rgba(INK, 0.92); ctx.lineWidth = 5;
        roundRect(ctx, x, baseY - h, bw, h, bw * 0.22); ctx.stroke();
        // 柱顶圆点（撞色点缀）
        ctx.fillStyle = rgba(INK);
        ctx.beginPath(); ctx.arc(x + bw / 2, baseY - h - bw * 0.18, bw * 0.14, 0, TAU); ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // ============ 组件 3：扁平节点网络 ============
  function flatNodes(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var n = Math.round(opts.nodes || 5);
    var pts = [];
    for (var i = 0; i < n; i++) {
      pts.push({
        x: W * (0.18 + 0.64 * (i / Math.max(1, n - 1))),
        y: H * (0.40 + 0.22 * Math.sin(i * 1.9 + 0.6)),
        c: colOf(opts.colors, i)
      });
    }
    var start = Date.now(), raf;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = (Date.now() - start) / 1000;
      var cyc = (t % 6) / 6;
      // 粗连线
      ctx.strokeStyle = rgba(INK, 0.9); ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      for (var i = 0; i < pts.length; i++) {
        if (i === 0) ctx.moveTo(pts[i].x, pts[i].y); else ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.stroke();
      // 沿连线跑的撞色圆点
      var segs = pts.length - 1;
      for (var s = 0; s < segs; s++) {
        var f = clamp01((cyc * 1.35 - s * 0.16) / 0.45);
        if (f <= 0 || f >= 1) continue;
        var px = pts[s].x + (pts[s + 1].x - pts[s].x) * f;
        var py = pts[s].y + (pts[s + 1].y - pts[s].y) * f;
        ctx.fillStyle = rgba(PALETTE[3]);
        ctx.beginPath(); ctx.arc(px, py, 16, 0, TAU); ctx.fill();
        ctx.strokeStyle = rgba(INK); ctx.lineWidth = 4; ctx.stroke();
      }
      // 节点圆：硬边投影 + 纯色 + 描边
      for (var j = 0; j < pts.length; j++) {
        var appear = clamp01((cyc - j * 0.1) / 0.3);
        if (appear <= 0) continue;
        var r = 44 * (0.6 + 0.4 * appear);
        ctx.save(); ctx.translate(pts[j].x, pts[j].y);
        ctx.fillStyle = rgba(INK, 0.9);
        ctx.beginPath(); ctx.arc(9, 9, r, 0, TAU); ctx.fill();
        ctx.fillStyle = rgba(pts[j].c);
        ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
        ctx.strokeStyle = rgba(INK); ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
        ctx.restore();
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // ============ 组件 4：有机波浪色块 ============
  function flatBlob(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var blobs = (opts.blobs || [
      { x: 0.42, y: 0.44, r: 0.30, c: [255, 107, 107] },
      { x: 0.62, y: 0.60, r: 0.24, c: [77, 150, 255] },
      { x: 0.50, y: 0.70, r: 0.17, c: [255, 209, 102] }
    ]);
    var speed = opts.speed == null ? 0.65 : opts.speed;
    var start = Date.now(), raf;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = (Date.now() - start) / 1000 * speed;
      for (var i = 0; i < blobs.length; i++) {
        var b = blobs[i];
        var cx = W * (b.x + 0.02 * Math.sin(t * 0.8 + i));
        var cy = H * (b.y + 0.025 * Math.cos(t * 0.7 + i * 1.4));
        ctx.save();
        ctx.translate(10, 12);
        ctx.fillStyle = rgba(INK, 0.88);
        blobPath(ctx, cx, cy, Math.min(W, H) * b.r, 8, t + i, 0.09); ctx.fill();
        ctx.restore();
        ctx.fillStyle = rgba(b.c);
        blobPath(ctx, cx, cy, Math.min(W, H) * b.r, 8, t + i, 0.09); ctx.fill();
        ctx.strokeStyle = rgba(INK, 0.92); ctx.lineWidth = 5;
        blobPath(ctx, cx, cy, Math.min(W, H) * b.r, 8, t + i, 0.09); ctx.stroke();
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // ============ 组件 5：基础几何图标阵列 ============
  function flatIcons(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var n = Math.round(opts.count || 9);
    var cols = Math.round(opts.cols || 3);
    var rows = Math.ceil(n / cols);
    var start = Date.now(), raf;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var cyc = ((Date.now() - start) / 1000 % 7) / 7;
      var cw = W * 0.72 / cols, ch = H * 0.46 / rows;
      var ox = W * 0.14, oy = H * 0.30;
      for (var i = 0; i < n; i++) {
        var appear = clamp01((cyc - i * 0.055) / 0.28);
        if (appear <= 0) continue;
        var col = i % cols, row = Math.floor(i / cols);
        var cx = ox + cw * (col + 0.5), cy = oy + ch * (row + 0.5);
        var r = Math.min(cw, ch) * 0.30 * (0.5 + 0.5 * appear) * (1 + 0.05 * Math.sin(cyc * TAU * 2 + i));
        var c = colOf(opts.colors, i);
        var type = i % 5;
        ctx.save(); ctx.translate(cx, cy);
        var path;
        if (type === 0) path = function () { ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); };
        else if (type === 1) path = function () { roundRect(ctx, -r, -r, r * 2, r * 2, r * 0.25); };
        else if (type === 2) path = function () { polygon(ctx, 0, 0, r * 1.15, 3, 0); };
        else if (type === 3) path = function () { starPath(ctx, 0, 0, r * 1.15, r * 0.5, 0, 5); };
        else path = function () {
          ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU);
          ctx.moveTo(r * 0.45, 0);
          ctx.arc(0, 0, r * 0.45, 0, TAU, true);
        };
        flatFill(ctx, path, rgba(c), rgba(INK, 0.9), 8);
        ctx.restore();
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  var V = global.VISUALS || (global.VISUALS = {});
  V.flatShapes = flatShapes;
  V.flatBars = flatBars;
  V.flatNodes = flatNodes;
  V.flatBlob = flatBlob;
  V.flatIcons = flatIcons;
})(window);
