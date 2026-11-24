/*
 * 形变动画风格 · 专属视觉组件 (morphing / shape-shifting)
 * ---------------------------------------------------------------
 * 追加到主 VISUALS 库之后加载，注册形变动画专属组件。
 * 核心手法：把不同形状采样成「相同数量」的顶点，逐点插值实现无缝形变；
 * 叠加多频正弦扰动的有机流动、环形波浪扭曲、液态色带与网格变形。
 * 强调「一个形状平滑地变成另一个形状」的过程感。
 *
 * 组件：
 *   morphShape - 多形状无缝形变（圆↔方↔三角↔星↔六边形）
 *   morphBlob  - 有机流体呼吸变形（多频扰动色块）
 *   morphRing  - 环形点列波浪形变（花环/齿轮渐变）
 *   morphWave  - 液态色带层叠流动（彩色丝绸）
 *   morphGrid  - 网格顶点波纹扭曲（空间变形）
 */
(function (global) {
  'use strict';
  var TAU = Math.PI * 2;
  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
  function ease(v) { return v * v * (3 - 2 * v); }
  // 确定性伪随机：同一 index 永远同值，保证 seek 抓帧跨 worker 一致
  function rnd(i) { var x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rgba(hex, a) {
    var h = String(hex).replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  // 正多边形顶点（第一点在顶部 -π/2，逆时针排列，保证不同形状同起点可插值）
  function polygon(n, R, rot) {
    var pts = [];
    for (var i = 0; i < n; i++) {
      var a = (rot || 0) - Math.PI / 2 + i * TAU / n;
      pts.push({ x: Math.cos(a) * R, y: Math.sin(a) * R });
    }
    return pts;
  }
  // 星形：内外半径交替，第一点（外点）在顶部
  function starShp(n, rIn, rOut) {
    var pts = [];
    for (var i = 0; i < n * 2; i++) {
      var a = -Math.PI / 2 + i * Math.PI / n;
      var r = (i % 2 === 0) ? rOut : rIn;
      pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
    }
    return pts;
  }
  // 按周长把多边形均匀采样成 M 个点（点数固定才能逐点插值）
  function samplePolygon(pts, M) {
    var segs = [], total = 0;
    for (var i = 0; i < pts.length; i++) {
      var a = pts[i], b = pts[(i + 1) % pts.length];
      var len = Math.sqrt((b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y));
      segs.push(len); total += len;
    }
    var out = [];
    for (var k = 0; k < M; k++) {
      var target = total * k / M, acc = 0;
      for (var j = 0; j < segs.length; j++) {
        if (acc + segs[j] >= target || j === segs.length - 1) {
          var t = segs[j] > 0 ? (target - acc) / segs[j] : 0;
          var p = pts[j], q = pts[(j + 1) % pts.length];
          out.push({ x: lerp(p.x, q.x, t), y: lerp(p.y, q.y, t) });
          break;
        }
        acc += segs[j];
      }
    }
    return out;
  }

  // ============ 组件 1：多形状无缝形变 ============
  function morphShape(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
    var R = Math.min(W, H) * (opts.radius || 0.15);
    var cx = W / 2, cy = H * (opts.oy || 0.38);
    var M = 80;
    var shapes = [
      samplePolygon(polygon(64, R, 0), M),          // 圆
      samplePolygon(polygon(4, R * 1.08, 0), M),    // 方（顶点在顶部）
      samplePolygon(polygon(3, R * 1.2, 0), M),     // 三角
      samplePolygon(starShp(5, R * 0.5, R * 1.2), M), // 五角星
      samplePolygon(polygon(6, R, 0), M)            // 六边形
    ];
    var colors = opts.colors || ['#00d4ff', '#b07cff', '#ff5fa2', '#ffb84d', '#00e5a8'];
    var dur = opts.duration || 2.2;
    var start = Date.now(), raf;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = (Date.now() - start) / 1000;
      var phase = t / dur;
      var idx = Math.floor(phase) % shapes.length;
      var next = (idx + 1) % shapes.length;
      var local = phase - Math.floor(phase);
      var m = ease(clamp01((local - 0.5) / 0.5)); // 前一半停留，后一半过渡
      var A = shapes[idx], B = shapes[next];
      var rot = t * 0.14, cos = Math.cos(rot), sin = Math.sin(rot);
      ctx.save(); ctx.translate(cx, cy);
      ctx.beginPath();
      for (var i = 0; i < M; i++) {
        var x = lerp(A[i].x, B[i].x, m), y = lerp(A[i].y, B[i].y, m);
        var rx = x * cos - y * sin, ry = x * sin + y * cos;
        if (i === 0) ctx.moveTo(rx, ry); else ctx.lineTo(rx, ry);
      }
      ctx.closePath();
      var g = ctx.createLinearGradient(-R, -R, R, R);
      g.addColorStop(0, rgba(colors[idx % colors.length], 0.92));
      g.addColorStop(1, rgba(colors[next % colors.length], 0.92));
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = rgba('#ffffff', 0.72); ctx.lineWidth = 2.6; ctx.stroke();
      ctx.restore();
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // ============ 组件 2：有机流体呼吸变形 ============
  function morphBlob(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
    var count = Math.round(opts.count || 3);
    var R = Math.min(W, H) * (opts.radius || 0.13);
    var colors = opts.colors || ['#00d4ff', '#b07cff', '#ff5fa2'];
    var oy = opts.oy || 0.4;
    var blobs = [];
    for (var i = 0; i < count; i++) {
      blobs.push({
        x: W / 2 + (rnd(i * 3 + 1) - 0.5) * W * 0.5,
        y: H * oy + (rnd(i * 3 + 2) - 0.5) * H * 0.2,
        r: R * (0.7 + rnd(i * 3 + 3) * 0.6),
        ph: rnd(i * 5 + 4) * TAU,
        sp: 0.5 + rnd(i * 5 + 5) * 0.5,
        c: i % colors.length
      });
    }
    var start = Date.now(), raf;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = (Date.now() - start) / 1000;
      for (var b = 0; b < blobs.length; b++) {
        var o = blobs[b], N = 72;
        ctx.beginPath();
        for (var k = 0; k <= N; k++) {
          var a = k / N * TAU;
          var wob = 1 + 0.18 * Math.sin(a * 3 + t * o.sp + o.ph)
                      + 0.10 * Math.sin(a * 5 - t * o.sp * 1.3 + o.ph * 2)
                      + 0.06 * Math.sin(a * 2 + t * 0.7);
          var x = o.x + Math.cos(a) * o.r * wob, y = o.y + Math.sin(a) * o.r * wob;
          if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        var g = ctx.createRadialGradient(o.x - o.r * 0.3, o.y - o.r * 0.3, 0, o.x, o.y, o.r * 1.3);
        g.addColorStop(0, rgba(colors[o.c], 0.95));
        g.addColorStop(0.6, rgba(colors[o.c], 0.72));
        g.addColorStop(1, rgba(colors[o.c], 0.12));
        ctx.fillStyle = g; ctx.fill();
        ctx.strokeStyle = rgba('#ffffff', 0.42); ctx.lineWidth = 2; ctx.stroke();
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // ============ 组件 3：环形点列波浪形变 ============
  function morphRing(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
    var cx = W / 2, cy = H * (opts.oy || 0.38);
    var R = Math.min(W, H) * (opts.radius || 0.16);
    var layers = Math.round(opts.layers || 3);
    var color = opts.color || '#b07cff';
    var start = Date.now(), raf;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = (Date.now() - start) / 1000;
      for (var L = 0; L < layers; L++) {
        var N = 96, r0 = R * (0.5 + L * 0.28), lobes = 3 + L * 2;
        ctx.beginPath();
        for (var k = 0; k <= N; k++) {
          var a = k / N * TAU;
          var wob = 1 + 0.22 * Math.sin(a * lobes + t * (0.6 + L * 0.2) + L);
          var x = cx + Math.cos(a) * r0 * wob, y = cy + Math.sin(a) * r0 * wob;
          if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle = rgba(color, 0.78 - L * 0.15); ctx.lineWidth = 2.6 - L * 0.4; ctx.stroke();
        for (var p = 0; p < lobes; p++) {
          var a2 = p / lobes * TAU + t * (0.6 + L * 0.2) + L;
          var rr = r0 * 1.22;
          ctx.fillStyle = rgba('#ffffff', 0.85);
          ctx.beginPath(); ctx.arc(cx + Math.cos(a2) * rr, cy + Math.sin(a2) * rr, 3, 0, TAU); ctx.fill();
        }
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // ============ 组件 4：液态色带层叠流动 ============
  function morphWave(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
    var bands = Math.round(opts.bands || 4);
    var colors = opts.colors || ['#00d4ff', '#b07cff', '#ff5fa2', '#7ce0ff'];
    var oy = opts.oy || 0.68;
    var start = Date.now(), raf;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = (Date.now() - start) / 1000;
      for (var b = 0; b < bands; b++) {
        var baseY = H * (oy - 0.1) + b * H * 0.055;
        var amp = H * (0.04 + rnd(b + 1) * 0.03);
        ctx.beginPath();
        ctx.moveTo(0, H); ctx.lineTo(0, baseY);
        for (var x = 0; x <= W; x += 16) {
          var y = baseY + Math.sin(x / W * TAU * (1 + b * 0.4) + t * (0.8 + b * 0.2) + b) * amp
                        + Math.sin(x / W * TAU * 2.3 - t * 0.6 + b * 2) * amp * 0.4;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(W, H); ctx.closePath();
        var g = ctx.createLinearGradient(0, baseY - amp, 0, baseY + H * 0.25);
        g.addColorStop(0, rgba(colors[b % colors.length], 0.78));
        g.addColorStop(1, rgba(colors[b % colors.length], 0.05));
        ctx.fillStyle = g; ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // ============ 组件 5：网格顶点波纹扭曲 ============
  function morphGrid(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
    var cols = Math.round(opts.cols || 14), rows = Math.round(opts.rows || 10);
    var color = opts.color || '#00d4ff';
    var start = Date.now(), raf;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = (Date.now() - start) / 1000;
      var cw = W / (cols - 1), ch = H / (rows - 1);
      var cy = H * (opts.oy || 0.42);
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          var x0 = c * cw, y0 = r * ch * 0.9 + H * 0.05;
          var d = Math.sqrt((x0 - W / 2) * (x0 - W / 2) + (y0 - cy) * (y0 - cy));
          var wave = Math.sin(d * 0.008 - t * 1.5) * 22;
          var x = x0 + Math.cos(t * 0.3 + d * 0.002) * wave * 0.3;
          var y = y0 + wave;
          var alpha = clamp01(1 - d / (W * 0.6)) * 0.8;
          ctx.fillStyle = rgba(color, alpha);
          ctx.beginPath(); ctx.arc(x, y, 2.5, 0, TAU); ctx.fill();
        }
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  var V = global.VISUALS || (global.VISUALS = {});
  V.morphShape = morphShape;
  V.morphBlob = morphBlob;
  V.morphRing = morphRing;
  V.morphWave = morphWave;
  V.morphGrid = morphGrid;
})(window);
