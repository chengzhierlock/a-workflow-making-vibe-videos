/*
 * 贴纸风科普 · 专属视觉组件 (die-cut sticker / kawaii explainer)
 * ---------------------------------------------------------------
 * 追加到主 VISUALS 库之后加载，注册贴纸风专属组件。
 * 核心手法：白色模切边(先画放大白底层) + 柔和投影 + 椭圆高光 +
 *   马卡龙配色 + 科普引线标注 + 圆润卡通。强调「手账上贴的可爱科普贴纸」。
 * 与拼贴剪纸(牛皮纸毛边杂乱)/扁平矢量(撞色杂志插画)区分。
 *
 * 组件：
 *   stickerBlob   - 白模切边贴纸群：云/星/心/气泡逐个弹出（主角/亮点）
 *   stickerLabels - 科普引线标注：中心图形 + 引线指向圆点小标签（图解）
 *   stickerOrbit  - 科普模型：中心圆 + 环绕贴纸 + 虚线轨道（太阳系/细胞）
 *   stickerBars   - 马卡龙圆角柱图 + 白模切边 + 高光（数据科普）
 *   stickerSteps  - 步骤贴纸：编号圆贴 + 曲线箭头连接（流程科普）
 *
 * 所有随机走确定性 rnd(i)，保证 seek 抓帧跨 worker 一致。
 * 动画基于 Date.now()（虚拟时钟），起始态即可读，不用 opacity:0 / 大 scale。
 */
(function (global) {
  'use strict';
  var TAU = Math.PI * 2;
  function rnd(i) { var x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  // 马卡龙配色
  var PINK = '#ff9ebb', MINT = '#7fd8c4', BLUE = '#8ec9f5', CREAM = '#ffd98e',
      LILAC = '#c4a6f0', WHITE = '#ffffff', INK = '#2d2b4a';
  var MACA = [PINK, MINT, BLUE, CREAM, LILAC];

  function setup(canvas) { return canvas.getContext('2d'); }

  // 柔和投影（贴纸浮在纸上的厚度感）
  function shadow(ctx, on) {
    if (on) { ctx.shadowColor = 'rgba(120,90,120,.22)'; ctx.shadowBlur = 22; ctx.shadowOffsetY = 10; }
    else { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; }
  }
  // 椭圆高光（塑料贴纸质感）
  function gloss(ctx, x, y, rx, ry) {
    ctx.save();
    ctx.globalAlpha = .5; ctx.fillStyle = WHITE;
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, -0.5, 0, TAU); ctx.fill();
    ctx.restore();
  }

  // 画一个带白模切边的圆（白底放大 + 彩色主体 + 高光）
  function stickerCircle(ctx, cx, cy, r, col, outline) {
    shadow(ctx, true);
    ctx.fillStyle = WHITE; ctx.beginPath(); ctx.arc(cx, cy, r + outline, 0, TAU); ctx.fill();
    shadow(ctx, false);
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
    gloss(ctx, cx - r * .3, cy - r * .35, r * .32, r * .18);
  }
  // 圆角矩形路径
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
  // 星形路径
  function starPath(ctx, cx, cy, R, r, n) {
    ctx.beginPath();
    for (var i = 0; i < n * 2; i++) {
      var a = -Math.PI / 2 + i * Math.PI / n;
      var rad = i % 2 === 0 ? R : r;
      var x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }
  // 心形路径
  function heartPath(ctx, cx, cy, s) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + s * 0.85);
    ctx.bezierCurveTo(cx - s * 1.6, cy - s * 0.3, cx - s * 0.6, cy - s * 1.3, cx, cy - s * 0.45);
    ctx.bezierCurveTo(cx + s * 0.6, cy - s * 1.3, cx + s * 1.6, cy - s * 0.3, cx, cy + s * 0.85);
    ctx.closePath();
  }

  // 白模切边贴纸群：云/星/心/气泡逐个弹出 + 高光投影
  function stickerBlob(canvas, opts, progress) {
    opts = opts || {};
    var ctx = setup(canvas), W = canvas.width, H = canvas.height;
    var count = Math.round(opts.count || 6);
    var start = Date.now(), raf;
    var kinds = ['circle', 'star', 'heart', 'cloud', 'bubble'];
    function cloudPath(ctx, cx, cy, s) {
      ctx.beginPath();
      ctx.arc(cx - s * 0.7, cy, s * 0.55, 0, TAU);
      ctx.arc(cx, cy - s * 0.35, s * 0.7, 0, TAU);
      ctx.arc(cx + s * 0.75, cy, s * 0.5, 0, TAU);
      ctx.rect(cx - s * 0.7, cy, s * 1.45, s * 0.55);
      ctx.closePath();
    }
    function drawShape(kind, cx, cy, s, col) {
      shadow(ctx, true);
      ctx.fillStyle = WHITE;
      if (kind === 'circle') { ctx.beginPath(); ctx.arc(cx, cy, s + 14, 0, TAU); ctx.fill(); }
      else if (kind === 'star') { starPath(ctx, cx, cy, s + 14, (s + 14) * .45, 5); ctx.fill(); }
      else if (kind === 'heart') { heartPath(ctx, cx, cy, s * .72 + 10); ctx.fill(); }
      else if (kind === 'cloud') { cloudPath(ctx, cx, cy, s * .9 + 8); ctx.fill(); }
      else { roundRect(ctx, cx - s - 12, cy - s * .7 - 12, (s + 12) * 2, (s * .7 + 12) * 2, s * .6); ctx.fill(); }
      shadow(ctx, false);
      ctx.fillStyle = col;
      if (kind === 'circle') { ctx.beginPath(); ctx.arc(cx, cy, s, 0, TAU); ctx.fill(); }
      else if (kind === 'star') { starPath(ctx, cx, cy, s, s * .45, 5); ctx.fill(); }
      else if (kind === 'heart') { heartPath(ctx, cx, cy, s * .72); ctx.fill(); }
      else if (kind === 'cloud') { cloudPath(ctx, cx, cy, s * .9); ctx.fill(); }
      else { roundRect(ctx, cx - s, cy - s * .7, s * 2, s * .7 * 2, s * .6); ctx.fill(); }
      gloss(ctx, cx - s * .25, cy - s * .35, s * .28, s * .14);
    }
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = (Date.now() - start) / 1000;
      for (var k = 0; k < count; k++) {
        var sd = k + 1;
        var kind = kinds[k % kinds.length];
        var col = MACA[k % MACA.length];
        var gx = Math.floor(rnd(sd * 3) * 3);
        var gy = Math.floor(rnd(sd * 5) * 6);
        var cx = W * (0.2 + gx * 0.3) + Math.sin(t * 0.8 + sd) * 8;
        var cy = H * (0.14 + gy * 0.12) + Math.cos(t * 0.7 + sd) * 10;
        var s = 44 + rnd(sd * 7) * 40;
        var appear = Math.min(1, Math.max(0, t * 1.5 - k * 0.12));
        ctx.save();
        ctx.translate(cx, cy);
        var sc = 0.80 + 0.20 * appear;   // 起始态可读，不做 opacity:0
        ctx.scale(sc, sc);
        drawShape(kind, 0, 0, s, col);
        ctx.restore();
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // 科普引线标注：中心图形 + 引线指向圆点小标签
  function stickerLabels(canvas, opts, progress) {
    opts = opts || {};
    var ctx = setup(canvas), W = canvas.width, H = canvas.height;
    var count = Math.round(opts.count || 4);
    var start = Date.now(), raf;
    var cx = W * 0.5, cy = H * 0.45;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = (Date.now() - start) / 1000;
      // 中心贴纸图形（圆 + 白边 + 高光）
      var pulse = 1 + 0.03 * Math.sin(t * 1.2);
      stickerCircle(ctx, cx, cy, 120 * pulse, PINK, 16);
      // 中心简笔：三个小圆点（像细胞/结构）
      ctx.fillStyle = WHITE;
      for (var i = 0; i < 3; i++) {
        var a = t * 0.5 + i * TAU / 3;
        ctx.beginPath(); ctx.arc(cx + Math.cos(a) * 45, cy + Math.sin(a) * 45, 12, 0, TAU); ctx.fill();
      }
      // 引线 + 圆点标签
      for (var k = 0; k < count; k++) {
        var sd = k + 1;
        var ang = -Math.PI / 2 + k * TAU / count + 0.35;
        var lx = cx + Math.cos(ang) * (W * 0.34);
        var ly = cy + Math.sin(ang) * (H * 0.3);
        // 引线：中心边缘 → 折点 → 标签
        var ex = cx + Math.cos(ang) * 132, ey = cy + Math.sin(ang) * 132;
        var mx = (ex + lx) / 2;
        ctx.strokeStyle = '#b9aec6'; ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(mx, ly); ctx.lineTo(lx - 26, ly); ctx.stroke();
        // 起点小圆点
        ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(ex, ey, 7, 0, TAU); ctx.fill();
        // 标签贴纸（白边圆角条 + 马卡龙色点）
        var col = MACA[k % MACA.length];
        shadow(ctx, true);
        ctx.fillStyle = WHITE; roundRect(ctx, lx - 26, ly - 26, 150, 52, 26); ctx.fill();
        shadow(ctx, false);
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(lx, ly, 14, 0, TAU); ctx.fill();
        gloss(ctx, lx - 4, ly - 5, 6, 3);
        ctx.fillStyle = '#d6ccda'; roundRect(ctx, lx + 22, ly - 6, 88, 12, 6); ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // 科普模型：中心圆 + 环绕贴纸 + 虚线轨道（太阳系/细胞结构）
  function stickerOrbit(canvas, opts, progress) {
    opts = opts || {};
    var ctx = setup(canvas), W = canvas.width, H = canvas.height;
    var nodes = Math.round(opts.nodes || 5);
    var start = Date.now(), raf;
    var cx = W * 0.5, cy = H * 0.46, R = Math.min(W, H) * 0.3;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = (Date.now() - start) / 1000;
      // 虚线轨道（多个椭圆）
      ctx.setLineDash([10, 14]); ctx.lineWidth = 4; ctx.strokeStyle = '#d7cddd';
      for (var r = 1; r <= 3; r++) {
        ctx.beginPath(); ctx.ellipse(cx, cy, R * (0.4 + r * 0.24), R * (0.4 + r * 0.24) * 0.62, 0, 0, TAU); ctx.stroke();
      }
      ctx.setLineDash([]);
      // 中心贴纸
      stickerCircle(ctx, cx, cy, 86, CREAM, 16);
      gloss(ctx, cx - 26, cy - 30, 26, 13);
      // 环绕小贴纸
      for (var k = 0; k < nodes; k++) {
        var sd = k + 1;
        var orbit = 0.4 + (k % 3 + 1) * 0.24;
        var a = t * (0.3 + (k % 3) * 0.08) + sd * 1.3;
        var ox = cx + Math.cos(a) * R * orbit;
        var oy = cy + Math.sin(a) * R * orbit * 0.62;
        var rr = 26 + rnd(sd * 5) * 18;
        stickerCircle(ctx, ox, oy, rr, MACA[k % MACA.length], 10);
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // 马卡龙圆角柱图 + 白模切边 + 高光
  function stickerBars(canvas, opts, progress) {
    opts = opts || {};
    var ctx = setup(canvas), W = canvas.width, H = canvas.height;
    var values = opts.values || [0.62, 0.85, 0.7, 0.94, 0.78];
    var start = Date.now(), raf;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = (Date.now() - start) / 1000;
      var n = values.length;
      var baseY = H * 0.72;
      var gap = W * 0.78 / n;
      var startX = W * 0.11;
      for (var k = 0; k < n; k++) {
        var v = Math.max(0.1, Math.min(1, values[k] + 0.04 * Math.sin(t * 1.5 + k)));
        var h = (H * 0.44) * v;
        var w = gap * 0.6;
        var x = startX + k * gap + (gap - w) / 2;
        var y = baseY - h;
        var col = MACA[k % MACA.length];
        // 白模切边（放大白底）
        shadow(ctx, true);
        ctx.fillStyle = WHITE; roundRect(ctx, x - 12, y - 12, w + 24, h + 24, (w + 24) / 2); ctx.fill();
        shadow(ctx, false);
        // 彩色主体
        ctx.fillStyle = col; roundRect(ctx, x, y, w, h, w / 2); ctx.fill();
        // 高光条
        ctx.save(); ctx.globalAlpha = .45; ctx.fillStyle = WHITE;
        roundRect(ctx, x + w * 0.22, y + 14, w * 0.2, h * 0.5, w * 0.1); ctx.fill();
        ctx.restore();
        // 顶部圆点
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x + w / 2, y - 2, 12, 0, TAU); ctx.fill();
      }
      // 基线（虚线）
      ctx.strokeStyle = '#e0d6de'; ctx.lineWidth = 3; ctx.setLineDash([8, 10]);
      ctx.beginPath(); ctx.moveTo(startX - 20, baseY); ctx.lineTo(startX + gap * n + 10, baseY); ctx.stroke();
      ctx.setLineDash([]);
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // 步骤贴纸：编号圆贴 + 曲线箭头连接
  function stickerSteps(canvas, opts, progress) {
    opts = opts || {};
    var ctx = setup(canvas), W = canvas.width, H = canvas.height;
    var count = Math.round(opts.count || 4);
    var start = Date.now(), raf;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = (Date.now() - start) / 1000;
      var pts = [];
      for (var k = 0; k < count; k++) {
        var sd = k + 1;
        // 沿 S 形分布
        var x = W * (0.28 + (k % 2) * 0.42);
        var y = H * (0.16 + k * 0.22) + Math.sin(t * 1 + k) * 7;
        pts.push([x, y]);
      }
      // 曲线箭头连接
      ctx.strokeStyle = '#cdbfd4'; ctx.lineWidth = 6; ctx.lineCap = 'round';
      for (var i = 0; i < pts.length - 1; i++) {
        var a = pts[i], b = pts[i + 1];
        ctx.beginPath(); ctx.moveTo(a[0], a[1] + 60);
        ctx.quadraticCurveTo((a[0] + b[0]) / 2 + 40, (a[1] + b[1]) / 2, b[0], b[1] - 60);
        ctx.stroke();
      }
      // 编号圆贴
      for (var m = 0; m < pts.length; m++) {
        var col = MACA[m % MACA.length];
        var appear = Math.min(1, Math.max(0, t * 1.5 - m * 0.16));
        var r = 74 * (0.82 + 0.18 * appear);
        stickerCircle(ctx, pts[m][0], pts[m][1], r, col, 14);
        ctx.fillStyle = WHITE;
        ctx.font = '900 ' + Math.floor(r * 0.95) + 'px "Trebuchet MS",Arial,sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(m + 1), pts[m][0], pts[m][1] + 3);
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  var V = global.VISUALS || (global.VISUALS = {});
  V.stickerBlob = stickerBlob;
  V.stickerLabels = stickerLabels;
  V.stickerOrbit = stickerOrbit;
  V.stickerBars = stickerBars;
  V.stickerSteps = stickerSteps;
})(window);
