/*
 * 弥散渐变玻璃拟态风格 · 专属视觉组件 (mesh gradient / glassmorphism)
 * ---------------------------------------------------------------
 * 追加到主 VISUALS 库之后加载，注册弥散玻璃专属组件。
 * 核心手法：多个大半径径向渐变光斑缓慢漂移叠加成弥散渐变(mesh gradient)，
 * 配合半透明磨砂玻璃卡片（细白边 + 内高光 + 柔和投影）、玻璃球高光弧、
 * 玻璃圆环与玻璃珠网格。强调「柔和、通透、轻盈」的质感。
 *
 * 组件：
 *   glassBlob  - 弥散渐变光斑漂移叠加（氛围底纹）
 *   glassCard  - 毛玻璃卡片层叠漂浮（面板/信息）
 *   glassOrb   - 玻璃球体：渐变填充 + 边缘高光弧 + 底部反射（主体）
 *   glassRing  - 玻璃圆环：渐变描边 + 流动高光弧（聚焦/节奏）
 *   glassMesh  - 玻璃珠网格：节点 + 柔和连线（结构/关系）
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
  var PALETTE = ['#7c6bff', '#ff6ec7', '#4d9dff', '#5eead4', '#b07cff', '#ff9ec7'];

  // 弥散渐变光斑：多个大半径径向渐变缓慢漂移、呼吸、叠加
  function glassBlob(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
    var count = Math.round(opts.count || 5);
    var colors = opts.colors || PALETTE;
    var start = Date.now(), raf;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = (Date.now() - start) / 1000;
      ctx.globalCompositeOperation = 'screen';
      for (var k = 0; k < count; k++) {
        var sd = k + 1;
        var bx = W * (0.15 + rnd(sd * 3) * 0.7) + Math.sin(t * (0.18 + rnd(sd) * 0.12) + sd) * W * 0.09;
        var by = H * (0.15 + rnd(sd * 5) * 0.7) + Math.cos(t * (0.14 + rnd(sd * 2) * 0.1) + sd * 1.3) * H * 0.08;
        var R = Math.min(W, H) * (0.28 + rnd(sd * 7) * 0.18) * (1 + Math.sin(t * 0.3 + sd) * 0.08);
        var g = ctx.createRadialGradient(bx, by, 0, bx, by, R);
        var col = colors[k % colors.length];
        g.addColorStop(0, rgba(col, 0.62));
        g.addColorStop(0.45, rgba(col, 0.28));
        g.addColorStop(1, rgba(col, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(bx, by, R, 0, TAU); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // 毛玻璃卡片：圆角半透明面板 + 细白边 + 内高光 + 柔和投影，层叠漂浮
  function glassCard(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
    var count = Math.round(opts.count || 4);
    var start = Date.now(), raf;
    function roundRect(x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = (Date.now() - start) / 1000;
      for (var k = 0; k < count; k++) {
        var sd = k + 1;
        var cw = W * (0.32 + rnd(sd * 3) * 0.18);
        var ch = H * (0.1 + rnd(sd * 5) * 0.07);
        var cx = W * (0.18 + rnd(sd * 7) * 0.5) + Math.sin(t * 0.4 + sd) * 10;
        var cy = H * (0.22 + rnd(sd * 11) * 0.55) + Math.cos(t * 0.35 + sd) * 8;
        var x = cx - cw / 2, y = cy - ch / 2, r = 22;
        // 柔和投影
        ctx.save(); ctx.shadowColor = 'rgba(40,20,80,.35)'; ctx.shadowBlur = 36; ctx.shadowOffsetY = 18;
        roundRect(x, y, cw, ch, r); ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fill();
        ctx.restore();
        // 玻璃填充（横向微渐变）
        var g = ctx.createLinearGradient(x, y, x + cw, y + ch);
        g.addColorStop(0, 'rgba(255,255,255,.26)');
        g.addColorStop(0.5, 'rgba(255,255,255,.1)');
        g.addColorStop(1, 'rgba(255,255,255,.18)');
        roundRect(x, y, cw, ch, r); ctx.fillStyle = g; ctx.fill();
        // 细白边 + 顶部内高光
        roundRect(x + 0.5, y + 0.5, cw - 1, ch - 1, r);
        ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + r, y + 2); ctx.lineTo(x + cw - r, y + 2);
        ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2; ctx.stroke();
        // 玻璃高光斜带
        ctx.save(); roundRect(x, y, cw, ch, r); ctx.clip();
        var hx = x + cw * (0.35 + Math.sin(t * 0.5 + sd) * 0.15);
        var hg = ctx.createLinearGradient(hx - 40, 0, hx + 40, 0);
        hg.addColorStop(0, 'rgba(255,255,255,0)');
        hg.addColorStop(0.5, 'rgba(255,255,255,.18)');
        hg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = hg; ctx.fillRect(x, y, cw, ch);
        ctx.restore();
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // 玻璃球体：径向渐变填充 + 边缘高光弧 + 底部反射 + 柔和投影
  function glassOrb(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
    var count = Math.round(opts.count || 3);
    var colors = opts.colors || PALETTE;
    var start = Date.now(), raf;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = (Date.now() - start) / 1000;
      for (var k = 0; k < count; k++) {
        var sd = k + 1;
        var cx = W * (0.28 + rnd(sd * 3) * 0.45) + Math.sin(t * 0.35 + sd) * 14;
        var cy = H * (0.3 + rnd(sd * 5) * 0.4) + Math.cos(t * 0.3 + sd) * 12;
        var R = Math.min(W, H) * (0.1 + rnd(sd * 7) * 0.06);
        var col = colors[k % colors.length];
        // 投影
        ctx.save(); ctx.shadowColor = rgba(col, 0.45); ctx.shadowBlur = 44; ctx.shadowOffsetY = 20;
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.fill();
        ctx.restore();
        // 玻璃主体：偏心径向渐变（透光感）
        var g = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
        g.addColorStop(0, 'rgba(255,255,255,.75)');
        g.addColorStop(0.28, rgba(col, 0.55));
        g.addColorStop(0.72, rgba(col, 0.32));
        g.addColorStop(1, rgba(col, 0.1));
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fillStyle = g; ctx.fill();
        // 细玻璃边
        ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.stroke();
        // 边缘高光弧
        ctx.beginPath(); ctx.arc(cx, cy, R * 0.88, Math.PI * 1.08, Math.PI * 1.62);
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineCap = 'round'; ctx.stroke();
        // 底部反射弧
        ctx.beginPath(); ctx.arc(cx, cy, R * 0.8, Math.PI * 0.18, Math.PI * 0.5);
        ctx.lineWidth = 2; ctx.strokeStyle = rgba(col, 0.7); ctx.stroke();
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // 玻璃圆环：渐变描边 + 流动高光弧（聚焦/节奏）
  function glassRing(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
    var count = Math.round(opts.count || 2);
    var colors = opts.colors || PALETTE;
    var start = Date.now(), raf;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = (Date.now() - start) / 1000;
      for (var k = 0; k < count; k++) {
        var sd = k + 1;
        var cx = W * (0.35 + rnd(sd * 3) * 0.3);
        var cy = H * (0.38 + rnd(sd * 5) * 0.24);
        var R = Math.min(W, H) * (0.16 + rnd(sd * 7) * 0.08);
        var col = colors[k % colors.length];
        // 环底
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU);
        ctx.lineWidth = 14;
        ctx.strokeStyle = 'rgba(255,255,255,.13)'; ctx.stroke();
        // 渐变描边环
        var g = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
        g.addColorStop(0, rgba(col, 0.85));
        g.addColorStop(0.5, 'rgba(255,255,255,.7)');
        g.addColorStop(1, rgba(PALETTE[(k + 2) % PALETTE.length], 0.85));
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU);
        ctx.lineWidth = 8; ctx.strokeStyle = g; ctx.stroke();
        // 流动高光弧
        var a0 = t * 0.9 + sd;
        ctx.beginPath(); ctx.arc(cx, cy, R, a0, a0 + 1.1);
        ctx.lineWidth = 8; ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.stroke();
        // 细外圈
        ctx.beginPath(); ctx.arc(cx, cy, R + 13, 0, TAU);
        ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.stroke();
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // 玻璃珠网格：半透明节点 + 柔和连线，缓慢起伏
  function glassMesh(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
    var cols = Math.round(opts.cols || 7), rows = Math.round(opts.rows || 9);
    var color = opts.color || '#b39cff';
    var start = Date.now(), raf;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = (Date.now() - start) / 1000;
      var cw = W / (cols - 1), ch = H / (rows - 1);
      var pts = [];
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          var x = c * cw;
          var y = r * ch + Math.sin(t * 0.8 + c * 0.6 + r * 0.4) * 12;
          pts.push({ x: x, y: y });
        }
      }
      // 柔和连线
      ctx.lineWidth = 1.2; ctx.strokeStyle = rgba(color, 0.22);
      for (var r2 = 0; r2 < rows; r2++) {
        for (var c2 = 0; c2 < cols; c2++) {
          var i = r2 * cols + c2;
          if (c2 < cols - 1) { ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[i + 1].x, pts[i + 1].y); ctx.stroke(); }
          if (r2 < rows - 1) { ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[i + cols].x, pts[i + cols].y); ctx.stroke(); }
        }
      }
      // 玻璃珠节点
      for (var n = 0; n < pts.length; n++) {
        var rr = 4 + rnd(n) * 3 + Math.sin(t * 1.2 + n) * 1.2;
        var g = ctx.createRadialGradient(pts[n].x - 1, pts[n].y - 1, 0, pts[n].x, pts[n].y, rr);
        g.addColorStop(0, 'rgba(255,255,255,.95)');
        g.addColorStop(0.5, rgba(color, 0.7));
        g.addColorStop(1, rgba(color, 0.15));
        ctx.beginPath(); ctx.arc(pts[n].x, pts[n].y, rr, 0, TAU);
        ctx.fillStyle = g; ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  var V = global.VISUALS || (global.VISUALS = {});
  V.glassBlob = glassBlob;
  V.glassCard = glassCard;
  V.glassOrb = glassOrb;
  V.glassRing = glassRing;
  V.glassMesh = glassMesh;
})(window);
