/*
 * 3D 渲染风格 · 专属视觉组件 (physically-lit 3D render)
 * ---------------------------------------------------------------
 * 追加到主 VISUALS 库之后加载，注册 3D 渲染专属组件。
 * 核心手法：透视投影 + 法线光照 + 径向渐变材质 + 高光/菲涅尔边 +
 * 柔和落地阴影 + 深度雾。与等轴2.5D的纯色三面不同，这里追求
 * 「有光照、有材质、有景深」的电影级立体感。
 *
 * 组件：
 *   renderSphere   - 带光照/高光/菲涅尔边/软阴影的球体（材质/主体）
 *   renderCube     - 透视旋转立方体，面法线光照 + 背面剔除（结构/系统）
 *   renderTorus    - 3D 环面点云，深度排序 + 高光（循环/连接）
 *   renderFloor    - 透视网格地面 + 地平线辉光（空间/场景）
 *   renderParticles- 3D 粒子场，近大远小 + 深度雾（氛围/数据流）
 */
(function (global) {
  'use strict';
  var TAU = Math.PI * 2;
  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
  // 确定性伪随机：同一 index 永远同值，保证 seek 抓帧跨 worker 一致
  function rnd(i) { var x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function rgba(hex, a) {
    var h = String(hex).replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  // 绕 X / Y 轴旋转
  function rot3(x, y, z, ax, ay) {
    var cx = Math.cos(ax), sx = Math.sin(ax), cy = Math.cos(ay), sy = Math.sin(ay);
    var y1 = y * cx - z * sx, z1 = y * sx + z * cx;
    return { x: x * cy + z1 * sy, y: y1, z: -x * sy + z1 * cy };
  }
  function softShadow(ctx, x, y, r, alpha) {
    var sh = ctx.createRadialGradient(x, y, 0, x, y, r);
    sh.addColorStop(0, 'rgba(0,0,0,' + (alpha || 0.42) + ')');
    sh.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.translate(0, y); ctx.scale(1, 0.28); ctx.translate(0, -y);
    ctx.fillStyle = sh;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.restore();
  }

  // ============ 组件 1：光照球体 ============
  function renderSphere(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
    var count = Math.round(opts.count || 3);
    var R = Math.min(W, H) * (opts.radius || 0.11);
    var palette = opts.colors || ['#5ad1ff', '#9d7bff', '#ff6ec7', '#7ce0ff'];
    var balls = [];
    for (var i = 0; i < count; i++) {
      balls.push({
        x: (rnd(i * 3 + 1) - 0.5) * W * 0.62,
        y: (rnd(i * 3 + 2) - 0.5) * H * 0.26 - H * 0.13,
        z: (rnd(i * 3 + 3) - 0.5) * 260,
        r: R * (0.55 + rnd(i * 7 + 4) * 0.65),
        c: palette[i % palette.length],
        ph: rnd(i * 5 + 6) * TAU,
        sp: 0.15 + rnd(i * 5 + 7) * 0.2
      });
    }
    var start = Date.now(), raf;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = (Date.now() - start) / 1000;
      balls.sort(function (a, b) { return b.z - a.z; });
      for (var i = 0; i < balls.length; i++) {
        var b = balls[i];
        var k = 900 / (900 + b.z + 400);
        var bx = W / 2 + b.x * k, by = H / 2 + b.y * k + Math.sin(t * b.sp + b.ph) * 14;
        var br = b.r * k;
        softShadow(ctx, bx, by + br * 1.3, br * 1.35, 0.42);
        // 球体主体：偏移高光点的径向渐变 = 光照材质
        var g = ctx.createRadialGradient(bx - br * 0.34, by - br * 0.42, br * 0.05, bx, by, br * 1.12);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.14, rgba(b.c, 1));
        g.addColorStop(0.55, rgba(b.c, 0.92));
        g.addColorStop(0.86, rgba(b.c, 0.32));
        g.addColorStop(1, 'rgba(3,7,20,.92)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(bx, by, br, 0, TAU); ctx.fill();
        // 底部环境反光
        var rg = ctx.createRadialGradient(bx + br * 0.2, by + br * 0.75, 0, bx + br * 0.2, by + br * 0.75, br * 0.85);
        rg.addColorStop(0, rgba(b.c, 0.38)); rg.addColorStop(1, rgba(b.c, 0));
        ctx.fillStyle = rg;
        ctx.beginPath(); ctx.arc(bx, by, br, 0, TAU); ctx.fill();
        // 菲涅尔边缘高光
        ctx.strokeStyle = rgba(b.c, 0.55); ctx.lineWidth = Math.max(1, br * 0.035);
        ctx.beginPath(); ctx.arc(bx, by, br * 0.985, 0, TAU); ctx.stroke();
        // 高光点
        var hg = ctx.createRadialGradient(bx - br * 0.38, by - br * 0.45, 0, bx - br * 0.38, by - br * 0.45, br * 0.32);
        hg.addColorStop(0, 'rgba(255,255,255,.95)'); hg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = hg;
        ctx.beginPath(); ctx.arc(bx - br * 0.38, by - br * 0.45, br * 0.32, 0, TAU); ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // ============ 组件 2：透视旋转立方体 ============
  function renderCube(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
    var S = Math.min(W, H) * (opts.size || 0.13);
    var count = Math.round(opts.count || 1);
    var base = opts.color || '#5ad1ff';
    var V = [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
    var F = [
      { i: [0,1,2,3], n: [0,0,-1] }, { i: [4,5,6,7], n: [0,0,1] },
      { i: [0,1,5,4], n: [0,-1,0] }, { i: [3,2,6,7], n: [0,1,0] },
      { i: [0,4,7,3], n: [-1,0,0] }, { i: [1,5,6,2], n: [1,0,0] }
    ];
    var start = Date.now(), raf;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = (Date.now() - start) / 1000;
      for (var c = 0; c < count; c++) {
        var ax = t * 0.35 + c * 1.1, ay = t * 0.55 + c * 0.9;
        var cx = W / 2 + (c - (count - 1) / 2) * S * 2.9;
        var cy = H * (opts.oy || 0.38);
        var pv = [];
        for (var i = 0; i < V.length; i++) {
          var q = rot3(V[i][0] * S, V[i][1] * S, V[i][2] * S, ax, ay);
          var k = 780 / (780 + q.z);
          pv.push({ x: cx + q.x * k, y: cy + q.y * k, z: q.z });
        }
        var vis = [];
        for (var f = 0; f < F.length; f++) {
          var n = rot3(F[f].n[0], F[f].n[1], F[f].n[2], ax, ay);
          if (n.z > 0) continue; // 背面剔除：法线 z>0 背向观察者
          var ix = F[f].i;
          var lit = clamp01(0.32 + Math.max(0, -n.z * 0.8 + n.x * 0.3 - n.y * 0.25));
          var zavg = (pv[ix[0]].z + pv[ix[1]].z + pv[ix[2]].z + pv[ix[3]].z) / 4;
          vis.push({ ix: ix, lit: lit, z: zavg });
        }
        vis.sort(function (a, b) { return b.z - a.z; }); // 远面先画
        for (var q2 = 0; q2 < vis.length; q2++) {
          var fc = vis[q2], ix2 = fc.ix, l = fc.lit;
          ctx.beginPath(); ctx.moveTo(pv[ix2[0]].x, pv[ix2[0]].y);
          for (var j = 1; j < 4; j++) ctx.lineTo(pv[ix2[j]].x, pv[ix2[j]].y);
          ctx.closePath();
          var g = ctx.createLinearGradient(pv[ix2[0]].x, pv[ix2[0]].y, pv[ix2[2]].x, pv[ix2[2]].y);
          g.addColorStop(0, rgba(base, 0.38 + l * 0.5));
          g.addColorStop(1, rgba('#0a1030', 0.92 - l * 0.4));
          ctx.fillStyle = g; ctx.fill();
          ctx.strokeStyle = rgba('#ffffff', 0.1 + l * 0.4); ctx.lineWidth = 1.6; ctx.stroke();
        }
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // ============ 组件 3：3D 环面点云 ============
  function renderTorus(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
    var R = Math.min(W, H) * (opts.radius || 0.16), r = R * (opts.tube || 0.34);
    var N = Math.round(opts.segments || 30), M = 14;
    var c1 = opts.color || '#00d4ff', c2 = opts.color2 || '#b07cff';
    var oy = opts.oy || 0.34;
    var start = Date.now(), raf;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = (Date.now() - start) / 1000;
      var ax = 0.95 + Math.sin(t * 0.35) * 0.22, ay = t * 0.5;
      var pts = [];
      for (var i = 0; i < N; i++) {
        var u = i / N * TAU;
        for (var j = 0; j < M; j++) {
          var v = j / M * TAU;
          var q = rot3((R + r * Math.cos(v)) * Math.cos(u), (R + r * Math.cos(v)) * Math.sin(u), r * Math.sin(v), ax, ay);
          var k = 900 / (900 + q.z);
          pts.push({ x: W / 2 + q.x * k, y: H * oy + q.y * k, z: q.z, k: k, mix: i / N, depth: (q.z + r * 2) / (4 * r) });
        }
      }
      pts.sort(function (a, b) { return b.z - a.z; });
      for (var p = 0; p < pts.length; p++) {
        var o = pts[p];
        var rad = Math.max(1.2, r * 0.16 * o.k);
        var dep = clamp01(o.depth);
        ctx.fillStyle = rgba(o.mix > 0.5 ? c2 : c1, 0.22 + 0.62 * (1 - dep));
        ctx.beginPath(); ctx.arc(o.x, o.y, rad, 0, TAU); ctx.fill();
        if (dep < 0.24) {
          ctx.fillStyle = 'rgba(255,255,255,.4)';
          ctx.beginPath(); ctx.arc(o.x, o.y, rad * 0.45, 0, TAU); ctx.fill();
        }
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // ============ 组件 4：透视网格地面 ============
  function renderFloor(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
    var horizon = H * (opts.horizon || 0.62);
    var col = opts.color || '#5ad1ff';
    var start = Date.now(), raf;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = (Date.now() - start) / 1000;
      var hg = ctx.createLinearGradient(0, horizon - 70, 0, horizon + 50);
      hg.addColorStop(0, rgba(col, 0)); hg.addColorStop(0.55, rgba(col, 0.2)); hg.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = hg; ctx.fillRect(0, horizon - 70, W, 120);
      ctx.strokeStyle = rgba(col, 0.28); ctx.lineWidth = 1.4;
      for (var i = -7; i <= 7; i++) {
        ctx.beginPath();
        ctx.moveTo(W / 2 + i * 14, horizon);
        ctx.lineTo(W / 2 + i * W * 0.14, H);
        ctx.stroke();
      }
      var speed = opts.speed || 0.32;
      for (var j = 0; j < 15; j++) {
        var z = (j + (t * speed) % 1) / 15;
        var y = horizon + Math.pow(z, 2.2) * (H - horizon);
        ctx.globalAlpha = clamp01(z * 1.5) * 0.55;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // ============ 组件 5：3D 粒子场 ============
  function renderParticles(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
    var count = Math.round(opts.count || 80);
    var pal = opts.colors || ['#ffffff', '#5ad1ff', '#b07cff', '#7ce0ff'];
    var ps = [];
    for (var i = 0; i < count; i++) {
      ps.push({
        x: (rnd(i * 3 + 1) - 0.5) * 1500,
        y: (rnd(i * 3 + 2) - 0.5) * 1800,
        z: rnd(i * 3 + 3) * 1600,
        s: 0.6 + rnd(i * 3 + 4) * 1.9,
        c: Math.floor(rnd(i * 3 + 5) * pal.length),
        ph: rnd(i * 3 + 6) * TAU
      });
    }
    var start = Date.now(), raf;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = (Date.now() - start) / 1000;
      for (var i = 0; i < ps.length; i++) {
        var p = ps[i];
        var zz = ((p.z - t * 120) % 1600 + 1600) % 1600;
        var k = 900 / (900 + zz);
        var x = W / 2 + p.x * k, y = H / 2 + p.y * k + Math.sin(t + p.ph) * 8;
        var rad = p.s * k * 1.7, a = (1 - zz / 1600) * 0.75;
        ctx.fillStyle = rgba(pal[p.c], a);
        ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  var V = global.VISUALS || (global.VISUALS = {});
  V.renderSphere = renderSphere;
  V.renderCube = renderCube;
  V.renderTorus = renderTorus;
  V.renderFloor = renderFloor;
  V.renderParticles = renderParticles;
})(window);
