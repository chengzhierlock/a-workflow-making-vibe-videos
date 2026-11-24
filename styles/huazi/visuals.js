/*
 * 综艺花字风格 · 专属视觉组件 (variety-show caption FX)
 * ---------------------------------------------------------------
 * 追加到主 VISUALS 库之后加载，注册综艺花字专属组件。
 * 核心手法：高饱和撞色 + 粗描边 + 立体厚度 + 爆炸放射线 + 星星闪烁 + 彩带，
 * 模仿综艺节目里那种扑面而来、热闹夸张的花字特效。字幕本身是主角。
 *
 * 组件：
 *   huaziBurst    - 爆炸放射线 + 星芒（强调/爆发）
 *   huaziStars    - 四角星/十字星光闪烁点缀（亮点/闪耀）
 *   huaziArrows   - 手绘粗箭头指向（引导/指示）
 *   huaziSpeech   - 彩色对话框气泡弹出（吐槽/旁白）
 *   huaziConfetti - 彩带纸屑飘落（热闹/庆祝）
 */
(function (global) {
  'use strict';
  var TAU = Math.PI * 2;
  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
  function ease(v) { return v * v * (3 - 2 * v); }
  // 确定性伪随机：同一 index 永远同值，保证 seek 抓帧跨 worker 一致
  function rnd(i) { var x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

  var PINK = '#ff4d94', YELLOW = '#ffe234', ORANGE = '#ff8c1a', CYAN = '#00e5ff', PURPLE = '#b967ff';
  var COLORS = [PINK, YELLOW, ORANGE, CYAN, PURPLE];
  var INK = '#3a1236'; // 深棕描边色（综艺描边偏暖深色）

  function strokePath(ctx, color, w) {
    ctx.strokeStyle = color; ctx.lineWidth = w || 6;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  }
  // 四角星（十字星光）
  function sparkle(ctx, cx, cy, r, ratio, rot) {
    var inner = r * (ratio == null ? 0.28 : ratio);
    ctx.beginPath();
    for (var i = 0; i < 8; i++) {
      var rr = i % 2 ? inner : r;
      var a = (rot || 0) - Math.PI / 2 + i * TAU / 8;
      var x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }
  // 带描边填充的图形
  function fillStroke(ctx, color, sw) {
    ctx.fillStyle = color; ctx.fill();
    strokePath(ctx, INK, sw || 5); ctx.stroke();
  }

  // ============ 组件 1：爆炸放射线 + 星芒 ============
  function huaziBurst(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var cx = W / 2, cy = H * (opts.oy || 0.44);
    var R = Math.min(W, H) * (opts.radius || 0.20);
    var n = Math.round(opts.rays || 16);
    var start = Date.now(), raf;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = (Date.now() - start) / 1000;
      var cyc = (t % 5) / 5;
      var grow = ease(clamp01((cyc - 0.05) / 0.3));
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * 0.25);
      // 放射三角（长短交替）
      for (var i = 0; i < n; i++) {
        var a = i * TAU / n;
        var long = i % 2 === 0;
        var outer = R * (long ? 1.0 : 0.66) * grow;
        var spread = TAU / n * 0.32;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a - spread) * R * 0.32, Math.sin(a - spread) * R * 0.32);
        ctx.lineTo(Math.cos(a) * outer, Math.sin(a) * outer);
        ctx.lineTo(Math.cos(a + spread) * R * 0.32, Math.sin(a + spread) * R * 0.32);
        ctx.closePath();
        fillStroke(ctx, COLORS[i % COLORS.length], 4);
      }
      ctx.restore();
      // 中心星芒
      var pulse = 1 + 0.12 * Math.sin(t * 5);
      sparkle(ctx, cx, cy, R * 0.42 * grow * pulse, 0.3, t * 0.5);
      fillStroke(ctx, YELLOW, 5);
      sparkle(ctx, cx, cy, R * 0.22 * grow * pulse, 0.3, -t * 0.7);
      fillStroke(ctx, '#fff', 4);
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // ============ 组件 2：闪烁星星/十字星光 ============
  function huaziStars(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var n = Math.round(opts.count || 12);
    var stars = [];
    for (var i = 0; i < n; i++) {
      stars.push({
        x: (0.08 + rnd(i * 3 + 1) * 0.84) * W,
        y: (0.16 + rnd(i * 3 + 2) * 0.68) * H,
        r: (0.018 + rnd(i * 3 + 3) * 0.032) * W,
        phase: rnd(i * 7 + 5) * TAU,
        speed: 2 + rnd(i * 5 + 1) * 3,
        c: COLORS[i % COLORS.length]
      });
    }
    var start = Date.now(), raf;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = (Date.now() - start) / 1000;
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        var twinkle = 0.35 + 0.65 * Math.abs(Math.sin(t * s.speed + s.phase));
        var r = s.r * (0.6 + 0.4 * twinkle);
        ctx.save(); ctx.translate(s.x, s.y); ctx.globalAlpha = twinkle;
        sparkle(ctx, 0, 0, r, 0.3, t * 0.4 + s.phase);
        fillStroke(ctx, s.c, 3);
        ctx.restore();
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // ============ 组件 3：手绘粗箭头 ============
  function huaziArrows(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var n = Math.round(opts.count || 3);
    var arrows = [];
    for (var i = 0; i < n; i++) {
      arrows.push({
        x: (0.25 + rnd(i * 4 + 1) * 0.5) * W,
        y: (0.30 + i * (0.16) + rnd(i * 3 + 2) * 0.05) * H,
        len: (0.10 + rnd(i * 5 + 3) * 0.08) * W,
        dir: i % 2 ? 1 : -1,
        c: COLORS[i % COLORS.length],
        delay: i * 0.18
      });
    }
    var start = Date.now(), raf;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var cyc = ((Date.now() - start) / 1000 % 5) / 5;
      for (var i = 0; i < arrows.length; i++) {
        var a = arrows[i];
        var draw = ease(clamp01((cyc - a.delay) / 0.3));
        if (draw <= 0) continue;
        var L = a.len * draw;
        ctx.save(); ctx.translate(a.x, a.y); ctx.scale(a.dir, 1);
        // 弯曲的箭身
        ctx.beginPath();
        ctx.moveTo(-L, -L * 0.28);
        ctx.quadraticCurveTo(-L * 0.4, L * 0.12, 0, 0);
        strokePath(ctx, '#fff', 16); ctx.stroke();
        strokePath(ctx, a.c, 11); ctx.stroke();
        strokePath(ctx, INK, 3); ctx.stroke();
        // 箭头
        ctx.beginPath();
        ctx.moveTo(-L * 0.16, -L * 0.16);
        ctx.lineTo(4, 0);
        ctx.lineTo(-L * 0.16, L * 0.16);
        ctx.closePath();
        fillStroke(ctx, a.c, 3);
        ctx.restore();
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // ============ 组件 4：彩色对话框气泡 ============
  function huaziSpeech(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var n = Math.round(opts.count || 3);
    var start = Date.now(), raf;
    var bubbles = [];
    for (var i = 0; i < n; i++) {
      bubbles.push({
        x: (0.3 + rnd(i * 5 + 1) * 0.4) * W,
        y: (0.32 + i * 0.20) * H,
        w: (0.34 + rnd(i * 3 + 2) * 0.12) * W,
        h: H * 0.075,
        c: COLORS[i % COLORS.length],
        delay: i * 0.3
      });
    }
    function roundRect(ctx, x, y, w, h, r) {
      r = Math.min(r, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var cyc = ((Date.now() - start) / 1000 % 6) / 6;
      for (var i = 0; i < bubbles.length; i++) {
        var b = bubbles[i];
        var pop = ease(clamp01((cyc - b.delay) / 0.2));
        if (pop <= 0) continue;
        var fade = 1 - clamp01((cyc - b.delay - 0.55) / 0.25);
        ctx.save(); ctx.globalAlpha = fade;
        ctx.translate(b.x, b.y); ctx.scale(pop, pop);
        var x = -b.w / 2, y = -b.h / 2;
        // 气泡尾巴
        ctx.beginPath();
        ctx.moveTo(b.w * 0.18, y + b.h - 2);
        ctx.lineTo(b.w * 0.28, y + b.h + b.h * 0.5);
        ctx.lineTo(b.w * 0.30, y + b.h - 2);
        ctx.closePath();
        fillStroke(ctx, b.c, 4);
        // 气泡主体
        roundRect(ctx, x, y, b.w, b.h, b.h * 0.34);
        ctx.fillStyle = '#fff'; ctx.fill();
        strokePath(ctx, INK, 5); ctx.stroke();
        // 顶部色条
        roundRect(ctx, x + 4, y + 4, b.w - 8, b.h * 0.30, b.h * 0.16);
        ctx.fillStyle = b.c; ctx.fill();
        ctx.restore();
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // ============ 组件 5：彩带纸屑飘落 ============
  function huaziConfetti(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var n = Math.round(opts.count || 40);
    var bits = [];
    for (var i = 0; i < n; i++) {
      bits.push({
        x: rnd(i * 3 + 1) * W,
        y: rnd(i * 3 + 2) * H,
        w: 8 + rnd(i * 5 + 3) * 14,
        h: 12 + rnd(i * 7 + 1) * 20,
        speed: 40 + rnd(i * 11 + 2) * 90,
        sway: rnd(i * 13 + 4) * TAU,
        spin: (rnd(i * 17 + 5) - 0.5) * 4,
        c: COLORS[i % COLORS.length]
      });
    }
    var start = Date.now(), raf;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = (Date.now() - start) / 1000;
      for (var i = 0; i < bits.length; i++) {
        var b = bits[i];
        var y = (b.y + t * b.speed) % (H + 60) - 30;
        var x = b.x + Math.sin(t * 1.6 + b.sway) * 22;
        ctx.save(); ctx.translate(x, y); ctx.rotate(t * b.spin);
        ctx.fillStyle = b.c; ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
        strokePath(ctx, INK, 2); ctx.strokeRect(-b.w / 2, -b.h / 2, b.w, b.h);
        ctx.restore();
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  var V = global.VISUALS || (global.VISUALS = {});
  V.huaziBurst = huaziBurst;
  V.huaziStars = huaziStars;
  V.huaziArrows = huaziArrows;
  V.huaziSpeech = huaziSpeech;
  V.huaziConfetti = huaziConfetti;
})(window);
