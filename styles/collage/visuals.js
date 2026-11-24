/*
 * 拼贴剪纸风格 · 专属视觉组件 (collage / paper-cut)
 * ---------------------------------------------------------------
 * 追加到主 VISUALS 库之后加载，注册拼贴剪纸专属组件。
 * 核心手法：不规则剪裁多边形（边缘略歪）+ 偏移硬阴影（纸张厚度）
 * + 轻微旋转错落 + 白模切边贴纸 + 半透明胶带 + 手撕毛边 + 图钉连线。
 * 强调「一张张纸片剪下来、贴上去、层层叠叠」的手工拼贴质感。
 *
 * 组件：
 *   collagePaper  - 撞色纸片错落堆叠（不规则剪裁 + 硬阴影 + 旋转）
 *   collageTape   - 半透明胶带斜贴（撕裂锯齿两端 + 条纹纹理）
 *   collageTorn   - 手撕毛边色带（上下边缘不规则锯齿，层层叠）
 *   collageStickers - 白模切边贴纸（星星/爱心/圆形逐个弹出）
 *   collagePins   - 图钉 + 麻绳虚线连接（标注关系/结构）
 */
(function (global) {
  'use strict';
  var TAU = Math.PI * 2;
  // 确定性伪随机：同一 index 永远同值，保证 seek 抓帧跨 worker 一致
  function rnd(i) { var x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function rgba(hex, a) {
    var h = String(hex).replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function drawPts(ctx, pts) {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  }
  // 手剪多边形：每顶点半径带随机扰动，边缘不齐才有剪纸感
  function cutPoly(cx, cy, R, sides, seed, jitter, rot) {
    var pts = [], base = (rot || 0) - Math.PI / 2 + rnd(seed + 99) * 0.6;
    for (var i = 0; i < sides; i++) {
      var a = base + i * TAU / sides;
      var rr = R * (1 - jitter * 0.5 + rnd(seed * 7 + i) * jitter);
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    return pts;
  }
  var PAPER = ['#e8453c', '#f5c518', '#2b8cde', '#3ea85c', '#ee6c9a', '#8b5cf6', '#ff8a4c'];

  // 撞色纸片错落堆叠：不规则剪裁 + 偏移硬阴影 + 轻微旋转，逐个贴上
  function collagePaper(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
    var count = Math.round(opts.count || 7);
    var colors = opts.colors || PAPER;
    var start = Date.now(), raf;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = (Date.now() - start) / 1000;
      for (var k = 0; k < count; k++) {
        var sd = k + 1;
        var cx = W * (0.16 + rnd(sd * 3) * 0.68);
        var cy = H * (0.18 + rnd(sd * 5 + 1) * 0.6);
        var R = Math.min(W, H) * (0.085 + rnd(sd * 11) * 0.07);
        var rot = (rnd(sd * 13) - 0.5) * 0.9;
        var appear = Math.min(1, Math.max(0, t * 1.5 - k * 0.17));
        var sc = 0.62 + 0.38 * appear;
        ctx.save();
        ctx.translate(cx, cy); ctx.rotate(rot); ctx.scale(sc, sc);
        var pts = cutPoly(0, 0, R, 4 + (k % 3), sd, 0.3, 0);
        // 偏移硬阴影（纸张厚度）
        ctx.save(); ctx.translate(8, 10);
        drawPts(ctx, pts); ctx.fillStyle = 'rgba(58,38,22,.26)'; ctx.fill();
        ctx.restore();
        // 纸片主体
        drawPts(ctx, pts); ctx.fillStyle = colors[k % colors.length]; ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(42,31,26,.6)'; ctx.stroke();
        // 折角高光
        ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
        ctx.lineTo(pts[0][0] * 0.55, pts[0][1] * 0.55);
        ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2; ctx.stroke();
        ctx.restore();
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // 半透明胶带：斜着贴，两端撕裂锯齿，带竖向条纹纹理
  function collageTape(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
    var count = Math.round(opts.count || 4);
    var start = Date.now(), raf;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = (Date.now() - start) / 1000;
      for (var k = 0; k < count; k++) {
        var sd = k + 1;
        var cx = W * (0.22 + rnd(sd * 3) * 0.56);
        var cy = H * (0.16 + rnd(sd * 7) * 0.68);
        var len = Math.min(W, H) * (0.17 + rnd(sd * 11) * 0.13);
        var h = len * 0.19;
        var rot = (rnd(sd * 5) - 0.5) * 1.7;
        var drift = Math.sin(t * 0.5 + sd) * 3;
        ctx.save(); ctx.translate(cx + drift, cy); ctx.rotate(rot);
        ctx.beginPath();
        ctx.moveTo(-len / 2, -h / 2);
        ctx.lineTo(len / 2, -h / 2);
        ctx.lineTo(len / 2 + 7, -h * 0.15); ctx.lineTo(len / 2 + 3, h * 0.2); ctx.lineTo(len / 2, h / 2);
        ctx.lineTo(-len / 2, h / 2);
        ctx.lineTo(-len / 2 - 6, h * 0.12); ctx.lineTo(-len / 2 - 3, -h * 0.22);
        ctx.closePath();
        ctx.fillStyle = 'rgba(224,208,164,.6)'; ctx.fill();
        ctx.strokeStyle = 'rgba(120,95,50,.35)'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.save(); ctx.clip();
        ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 2;
        for (var s = -len / 2; s < len / 2; s += 13) {
          ctx.beginPath(); ctx.moveTo(s, -h / 2); ctx.lineTo(s, h / 2); ctx.stroke();
        }
        ctx.restore();
        ctx.restore();
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // 手撕毛边色带：上下边缘不规则锯齿，多层错位叠放
  function collageTorn(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
    var bands = Math.round(opts.bands || 4);
    var colors = opts.colors || ['#e8453c', '#f5c518', '#2b8cde', '#3ea85c'];
    var oy = opts.oy || 0.62;
    var start = Date.now(), raf;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = (Date.now() - start) / 1000;
      for (var b = 0; b < bands; b++) {
        var yBase = H * (oy - 0.09) + b * H * 0.082;
        var drift = Math.sin(t * 0.6 + b) * 4;
        var bh = H * 0.058;
        ctx.beginPath();
        for (var x = 0; x <= W; x += 13) {
          var yy = yBase + drift + (rnd(x * 0.13 + b * 31) - 0.5) * 11;
          if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
        }
        for (var x2 = W; x2 >= 0; x2 -= 13) {
          var yy2 = yBase + bh + drift + (rnd(x2 * 0.13 + b * 31 + 9) - 0.5) * 11;
          ctx.lineTo(x2, yy2);
        }
        ctx.closePath();
        ctx.fillStyle = rgba(colors[b % colors.length], 0.94); ctx.fill();
        ctx.strokeStyle = 'rgba(42,31,26,.42)'; ctx.lineWidth = 2; ctx.stroke();
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // 白模切边贴纸：星星/爱心/圆形逐个弹出，带白边与投影
  function collageStickers(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
    var count = Math.round(opts.count || 6);
    var colors = opts.colors || ['#f5c518', '#e8453c', '#2b8cde', '#3ea85c', '#ee6c9a', '#8b5cf6'];
    var start = Date.now(), raf;
    function starPath(ctx, R) {
      ctx.beginPath();
      for (var i = 0; i < 10; i++) {
        var a = -Math.PI / 2 + i * Math.PI / 5;
        var r = (i % 2 === 0) ? R : R * 0.45;
        var x = Math.cos(a) * r, y = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
    }
    function heartPath(ctx, R) {
      ctx.beginPath();
      ctx.moveTo(0, R * 0.78);
      ctx.bezierCurveTo(-R * 1.4, -R * 0.3, -R * 0.55, -R * 1.1, 0, -R * 0.36);
      ctx.bezierCurveTo(R * 0.55, -R * 1.1, R * 1.4, -R * 0.3, 0, R * 0.78);
      ctx.closePath();
    }
    function shapePath(ctx, shape, R) {
      if (shape === 0) starPath(ctx, R);
      else if (shape === 1) heartPath(ctx, R);
      else { ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); }
    }
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = (Date.now() - start) / 1000;
      for (var k = 0; k < count; k++) {
        var sd = k + 1;
        var cx = W * (0.14 + rnd(sd * 3) * 0.72);
        var cy = H * (0.17 + rnd(sd * 5) * 0.64);
        var R = Math.min(W, H) * (0.042 + rnd(sd * 7) * 0.032);
        var rot = (rnd(sd * 11) - 0.5) * 1.3;
        var shape = k % 3;
        var appear = Math.min(1, Math.max(0, t * 1.7 - k * 0.15));
        var pop = appear < 1 ? (0.7 + 0.5 * Math.sin(appear * Math.PI)) : 1;
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.scale(pop, pop);
        // 投影
        ctx.save(); ctx.translate(4, 5); shapePath(ctx, shape, R * 1.2);
        ctx.fillStyle = 'rgba(58,38,22,.28)'; ctx.fill(); ctx.restore();
        // 白色模切边
        shapePath(ctx, shape, R * 1.2); ctx.fillStyle = '#fffaf0'; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(42,31,26,.5)'; ctx.stroke();
        // 彩色主体
        shapePath(ctx, shape, R); ctx.fillStyle = colors[k % colors.length]; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(42,31,26,.62)'; ctx.stroke();
        ctx.restore();
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // 图钉 + 麻绳虚线连接：标注关系/结构
  function collagePins(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
    var count = Math.round(opts.count || 5);
    var colors = opts.colors || ['#e8453c', '#f5c518', '#2b8cde', '#3ea85c', '#8b5cf6'];
    var start = Date.now(), raf;
    var pts = [];
    for (var k = 0; k < count; k++) {
      pts.push({ x: W * (0.17 + rnd(k * 3 + 1) * 0.66), y: H * (0.2 + rnd(k * 5 + 2) * 0.6) });
    }
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = (Date.now() - start) / 1000;
      ctx.setLineDash([9, 7]); ctx.lineWidth = 2.6; ctx.strokeStyle = 'rgba(92,62,36,.5)';
      for (var i = 0; i < pts.length - 1; i++) {
        ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y);
        var mx = (pts[i].x + pts[i + 1].x) / 2 + Math.sin(t * 0.8 + i) * 9;
        var my = (pts[i].y + pts[i + 1].y) / 2 + Math.cos(t * 0.8 + i) * 9;
        ctx.quadraticCurveTo(mx, my, pts[i + 1].x, pts[i + 1].y); ctx.stroke();
      }
      ctx.setLineDash([]);
      for (var k2 = 0; k2 < pts.length; k2++) {
        var p = pts[k2], R = Math.min(W, H) * 0.028;
        ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, TAU);
        ctx.fillStyle = colors[k2 % colors.length]; ctx.fill();
        ctx.lineWidth = 2.6; ctx.strokeStyle = 'rgba(42,31,26,.62)'; ctx.stroke();
        ctx.beginPath(); ctx.arc(p.x - R * 0.32, p.y - R * 0.32, R * 0.3, 0, TAU);
        ctx.fillStyle = 'rgba(255,255,255,.78)'; ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  var V = global.VISUALS || (global.VISUALS = {});
  V.collagePaper = collagePaper;
  V.collageTape = collageTape;
  V.collageTorn = collageTorn;
  V.collageStickers = collageStickers;
  V.collagePins = collagePins;
})(window);
