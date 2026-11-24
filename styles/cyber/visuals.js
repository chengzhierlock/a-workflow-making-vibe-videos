/*
 * 赛博朋克 HUD 风格 · 专属视觉组件 (cyberpunk HUD visuals)
 * ---------------------------------------------------------------
 * 追加到主 VISUALS 库之后加载，注册赛博朋克 HUD 专属组件。
 * 核心手法：深色底 + 霓虹青/品红 + 扫描线 + 准星/雷达/数据条/示波器，
 * 像透过战术目镜看世界，强调「界面感、数据感、故障感」。
 * 与线条动画（发光描边生长）区分：这里是 HUD 仪表盘，是叠在视野上的界面。
 *
 * 组件：
 *   hudGrid   - 透视网格地面 + 上下移动的扫描线（赛博空间底纹）
 *   hudRadar  - 圆形雷达 + 旋转扫描扇形 + 闪烁光点（搜索/扫描）
 *   hudBars   - HUD 数据条 + 刻度 + 数值跳动（数据/监控）
 *   hudTarget - 四角锁定准星 + 六边形 + 锁定动画（聚焦/目标）
 *   hudWave   - 示波器波形 + 数字字符流（信号/声音）
 */
(function (global) {
  'use strict';
  var TAU = Math.PI * 2;
  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
  function ease(v) { return v * v * (3 - 2 * v); }
  // 确定性伪随机：同一 index 永远同值，保证 seek 抓帧跨 worker 一致
  function rnd(i) { var x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

  var CYAN = '#00f0ff', MAGENTA = '#ff2e97', YELLOW = '#ffe600', GREEN = '#39ff9e';

  function glowLine(ctx, color, blur) {
    ctx.shadowColor = color; ctx.shadowBlur = blur == null ? 16 : blur;
  }
  function noGlow(ctx) { ctx.shadowBlur = 0; }
  function stroke(ctx, color, w, blur) {
    ctx.strokeStyle = color; ctx.lineWidth = w || 2;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (blur) glowLine(ctx, color, blur);
  }
  function poly(ctx, pts, close) {
    ctx.beginPath();
    for (var i = 0; i < pts.length; i++) {
      if (i === 0) ctx.moveTo(pts[i].x, pts[i].y); else ctx.lineTo(pts[i].x, pts[i].y);
    }
    if (close !== false) ctx.closePath();
  }
  function hexPts(cx, cy, r, rot) {
    var a = [];
    for (var i = 0; i < 6; i++) {
      var t = (rot || 0) - Math.PI / 2 + i * TAU / 6;
      a.push({ x: cx + Math.cos(t) * r, y: cy + Math.sin(t) * r });
    }
    return a;
  }
  // 四角括号（准星框）
  function corners(ctx, x, y, w, h, len) {
    var l = len || Math.min(w, h) * 0.22;
    ctx.beginPath();
    ctx.moveTo(x, y + l); ctx.lineTo(x, y); ctx.lineTo(x + l, y);
    ctx.moveTo(x + w - l, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + l);
    ctx.moveTo(x + w, y + h - l); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - l, y + h);
    ctx.moveTo(x + l, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - l);
  }
  // 扫描线纹理（CRT 感）——覆盖整个画面
  function scanlines(ctx, W, H, t) {
    ctx.save(); noGlow(ctx);
    ctx.fillStyle = 'rgba(0,240,255,.025)';
    for (var y = 0; y < H; y += 6) ctx.fillRect(0, y, W, 2);
    var sy = (t * 90) % (H + 200) - 100;
    var g = ctx.createLinearGradient(0, sy - 40, 0, sy + 40);
    g.addColorStop(0, 'rgba(0,240,255,0)');
    g.addColorStop(0.5, 'rgba(0,240,255,.07)');
    g.addColorStop(1, 'rgba(0,240,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, sy - 40, W, 80);
    ctx.restore();
  }

  // ============ 组件 1：透视网格 + 扫描线 ============
  function hudGrid(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var color = opts.color || CYAN;
    var horizon = H * (opts.horizon || 0.46);
    var start = Date.now(), raf;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = (Date.now() - start) / 1000;
      noGlow(ctx);
      // 地平线
      stroke(ctx, color, 2, 12);
      ctx.beginPath(); ctx.moveTo(0, horizon); ctx.lineTo(W, horizon); ctx.stroke();
      noGlow(ctx);
      // 透视纵线：从消失点向底部发散
      var vanX = W / 2;
      stroke(ctx, color, 1.5);
      for (var i = -10; i <= 10; i++) {
        ctx.beginPath(); ctx.moveTo(vanX, horizon);
        ctx.lineTo(vanX + i * (W / 9), H); ctx.stroke();
      }
      // 横向线：随透视加密，向下滚动
      var scroll = (t * 0.55) % 1;
      for (var j = 0; j < 14; j++) {
        var f = (j + scroll) / 14;
        var y = horizon + (H - horizon) * (f * f);
        ctx.globalAlpha = clamp01(f * 1.6) * 0.7;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      scanlines(ctx, W, H, t);
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // ============ 组件 2：圆形雷达扫描 ============
  function hudRadar(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var cx = W / 2, cy = H * (opts.oy || 0.44);
    var R = Math.min(W, H) * (opts.radius || 0.19);
    var color = opts.color || GREEN;
    var dots = [];
    for (var i = 0; i < 7; i++) {
      var a = rnd(i * 3 + 1) * TAU, rr = (0.2 + rnd(i * 3 + 2) * 0.7) * R;
      dots.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr, phase: rnd(i * 5 + 4) * TAU });
    }
    var start = Date.now(), raf;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = (Date.now() - start) / 1000;
      // 同心圆 + 十字
      stroke(ctx, color, 2, 10);
      for (var k = 1; k <= 3; k++) {
        ctx.globalAlpha = k === 3 ? 0.9 : 0.4;
        ctx.beginPath(); ctx.arc(cx, cy, R * k / 3, 0, TAU); ctx.stroke();
      }
      ctx.globalAlpha = 0.4;
      ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();
      ctx.globalAlpha = 1;
      // 旋转扫描扇形
      var a0 = t * 1.5 % TAU;
      var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      g.addColorStop(0, 'rgba(57,255,158,.42)');
      g.addColorStop(1, 'rgba(57,255,158,0)');
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, a0 - 0.5, a0); ctx.closePath();
      ctx.fillStyle = g; ctx.fill();
      glowLine(ctx, color, 14);
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a0) * R, cy + Math.sin(a0) * R); ctx.stroke();
      noGlow(ctx);
      // 光点：被扫描线扫到时闪亮
      for (var i = 0; i < dots.length; i++) {
        var d = dots[i];
        var da = Math.atan2(d.y - cy, d.x - cx);
        var diff = Math.abs(((a0 - da + Math.PI * 3) % TAU) - Math.PI);
        var hit = clamp01(1 - diff / 0.6);
        var pulse = 0.3 + 0.7 * hit;
        ctx.globalAlpha = pulse;
        stroke(ctx, MAGENTA, 2, 10);
        ctx.beginPath(); ctx.arc(d.x, d.y, 6 + hit * 6, 0, TAU); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      scanlines(ctx, W, H, t);
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // ============ 组件 3：HUD 数据条 ============
  function hudBars(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var vals = opts.values || [0.72, 0.48, 0.91, 0.63, 0.85];
    var n = vals.length;
    var x0 = W * 0.14, x1 = W * 0.86;
    var y0 = H * 0.36, rowH = Math.min(H * 0.09, (H * 0.5) / n);
    var colors = [CYAN, MAGENTA, YELLOW, GREEN, CYAN];
    var start = Date.now(), raf;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = (Date.now() - start) / 1000;
      var cyc = (t % 6) / 6;
      for (var i = 0; i < n; i++) {
        var y = y0 + i * rowH;
        var c = colors[i % colors.length];
        var grow = ease(clamp01((cyc - i * 0.06) / 0.5));
        var val = vals[i] * grow * (0.96 + 0.04 * Math.sin(t * 4 + i * 2));
        var barW = (x1 - x0) * val;
        noGlow(ctx);
        // 标签块
        ctx.strokeStyle = c; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.6;
        ctx.strokeRect(x0 - 2, y - 12, 34, 24);
        ctx.globalAlpha = 1;
        ctx.fillStyle = c; ctx.font = 'bold 18px monospace';
        ctx.fillText(String(i + 1).padStart(2, '0'), x0 + 4, y + 6);
        // 轨道（刻度）
        ctx.strokeStyle = 'rgba(0,240,255,.18)'; ctx.lineWidth = 2;
        ctx.strokeRect(x0 + 42, y - 12, x1 - x0 - 42, 24);
        for (var k = 1; k < 10; k++) {
          var kx = x0 + 42 + (x1 - x0 - 42) * (k / 10);
          ctx.beginPath(); ctx.moveTo(kx, y - 12); ctx.lineTo(kx, y - 6); ctx.stroke();
        }
        // 数据条 + 发光
        glowLine(ctx, c, 16);
        ctx.fillStyle = c; ctx.globalAlpha = 0.85;
        ctx.fillRect(x0 + 42, y - 12, Math.max(0, barW - 42), 24);
        ctx.globalAlpha = 1; noGlow(ctx);
        // 条尾高亮
        if (barW > 42) {
          ctx.fillStyle = '#fff';
          ctx.fillRect(x0 + 42 + barW - 44, y - 12, 3, 24);
        }
        // 数值跳动
        ctx.fillStyle = c; ctx.font = 'bold 20px monospace';
        ctx.fillText(Math.round(val * 100) + '%', x1 + 8, y + 7);
      }
      scanlines(ctx, W, H, t);
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // ============ 组件 4：锁定准星 + 六边形 ============
  function hudTarget(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var cx = W / 2, cy = H * 0.46;
    var R = Math.min(W, H) * (opts.radius || 0.17);
    var color = opts.color || MAGENTA;
    var start = Date.now(), raf;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = (Date.now() - start) / 1000;
      var cyc = (t % 7) / 7;
      var lock = clamp01((cyc - 0.25) / 0.3);
      var pulse = 1 + 0.03 * Math.sin(t * 6);
      // 六边形（缓慢自转）
      stroke(ctx, CYAN, 3, 14);
      poly(ctx, hexPts(cx, cy, R * pulse, t * 0.3));
      ctx.stroke();
      ctx.globalAlpha = 0.4;
      poly(ctx, hexPts(cx, cy, R * 0.78, -t * 0.2)); ctx.stroke();
      ctx.globalAlpha = 1;
      // 四角准星框：锁定后收拢
      var bw = R * 1.9 - lock * R * 0.3, bh = bw;
      stroke(ctx, color, 4, 16);
      corners(ctx, cx - bw, cy - bh, bw * 2, bh * 2, R * 0.32);
      ctx.stroke();
      // 中心十字 + 点
      stroke(ctx, color, 2, 12);
      ctx.beginPath();
      ctx.moveTo(cx - R * 0.3, cy); ctx.lineTo(cx - 8, cy);
      ctx.moveTo(cx + 8, cy); ctx.lineTo(cx + R * 0.3, cy);
      ctx.moveTo(cx, cy - R * 0.3); ctx.lineTo(cx, cy - 8);
      ctx.moveTo(cx, cy + 8); ctx.lineTo(cx, cy + R * 0.3);
      ctx.stroke();
      ctx.fillStyle = color; glowLine(ctx, color, 20);
      ctx.beginPath(); ctx.arc(cx, cy, 5, 0, TAU); ctx.fill();
      noGlow(ctx);
      // 锁定标签
      ctx.fillStyle = lock > 0.5 ? GREEN : YELLOW;
      ctx.font = 'bold 22px monospace';
      ctx.fillText(lock > 0.5 ? 'TARGET LOCKED' : 'SCANNING...', cx - 90, cy - R * 1.9 - 16);
      scanlines(ctx, W, H, t);
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // ============ 组件 5：示波器 + 数字字符流 ============
  function hudWave(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var color = opts.color || CYAN;
    var chars = '01ABCDEF#@$%';
    var streams = [];
    for (var i = 0; i < 10; i++) streams.push({ x: (i + 0.5) * W / 10, speed: 40 + rnd(i * 3) * 90, len: 8 + Math.floor(rnd(i * 7) * 10) });
    var start = Date.now(), raf;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = (Date.now() - start) / 1000;
      var cy = H * 0.48;
      // 中轴虚线
      noGlow(ctx); ctx.strokeStyle = 'rgba(0,240,255,.25)'; ctx.lineWidth = 1;
      ctx.setLineDash([8, 10]);
      ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(W, cy); ctx.stroke();
      ctx.setLineDash([]);
      // 示波器波形
      stroke(ctx, color, 3, 18);
      ctx.beginPath();
      for (var x = 0; x <= W; x += 6) {
        var env = Math.sin(Math.PI * x / W);
        var y = cy + (Math.sin(x * 0.035 + t * 6) * 0.6 + Math.sin(x * 0.09 - t * 9) * 0.4) * H * 0.1 * env;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke(); noGlow(ctx);
      // 数字字符雨（坠落）
      ctx.font = '15px monospace';
      for (var i = 0; i < streams.length; i++) {
        var s = streams[i];
        var head = ((t * s.speed) % (H + s.len * 20)) - s.len * 20;
        for (var j = 0; j < s.len; j++) {
          var yy = head - j * 20;
          if (yy < 0 || yy > H) continue;
          ctx.globalAlpha = (1 - j / s.len) * 0.55;
          ctx.fillStyle = j === 0 ? '#fff' : color;
          var ch = chars.charAt(Math.floor(rnd(i * 100 + j + Math.floor(t * 6)) * chars.length));
          ctx.fillText(ch, s.x, yy);
        }
      }
      ctx.globalAlpha = 1;
      scanlines(ctx, W, H, t);
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  var V = global.VISUALS || (global.VISUALS = {});
  V.hudGrid = hudGrid;
  V.hudRadar = hudRadar;
  V.hudBars = hudBars;
  V.hudTarget = hudTarget;
  V.hudWave = hudWave;
})(window);
