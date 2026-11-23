/*
 * 等轴 2.5D 风格 · 专属视觉组件 (isometric visuals)
 * ---------------------------------------------------------------
 * 追加到主 VISUALS 库之后加载，注册等轴风格专属组件。
 * 核心手法：等轴投影 iso(x,y,z)，把 3D 方块画成「顶面 + 左面 + 右面」三个面，
 * 配落地阴影 + 顶面高光，形成干净的 2.5D 立体感。
 *
 * 组件：
 *   isoGrid   - 等轴网格地面（缓慢流动），适合做底纹
 *   isoBlocks - 立体方块群，逐个升起（模块/系统/概念）
 *   isoChart  - 等轴柱状图，按 values 生长（数据）
 *   isoFlow   - 等轴节点 + 连线 + 流动粒子（流程/关系）
 *   isoTower  - 中心数据塔，逐层堆叠（增长/积累）
 */
(function (global) {
  'use strict';
  var TAU = Math.PI * 2;
  function rand(a, b) { return a + Math.random() * (b - a); }
  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

  // 等轴投影：3D 网格坐标 -> 2D 屏幕坐标
  // x: 右下方向, z: 左下方向, y: 高度(向上)
  function iso(x, y, z, ox, oy, s) {
    return {
      x: ox + (x - z) * 0.8660254 * s,
      y: oy + (x + z) * 0.5 * s - y * s
    };
  }
  function poly(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
  }
  function shade(c, k) {
    return 'rgb(' + Math.round(c[0] * k) + ',' + Math.round(c[1] * k) + ',' + Math.round(c[2] * k) + ')';
  }

  // 画一个等轴立方体：返回屏幕坐标集
  function cube(ctx, g, box, col, edge) {
    var x = box.x, y = box.y, z = box.z, w = box.w, h = box.h, d = box.d;
    var A = iso(x, y + h, z, g.ox, g.oy, g.s);       // 顶 后角
    var B = iso(x + w, y + h, z, g.ox, g.oy, g.s);   // 顶 右角
    var C = iso(x + w, y + h, z + d, g.ox, g.oy, g.s); // 顶 前角
    var D = iso(x, y + h, z + d, g.ox, g.oy, g.s);   // 顶 左角
    var C0 = iso(x + w, y, z + d, g.ox, g.oy, g.s);  // 底 前角
    var B0 = iso(x + w, y, z, g.ox, g.oy, g.s);      // 底 右角
    var D0 = iso(x, y, z + d, g.ox, g.oy, g.s);      // 底 左角
    ctx.lineWidth = edge || Math.max(1.5, g.s * 0.018);
    ctx.lineJoin = 'round';
    // 左面(+z)：较暗
    ctx.fillStyle = shade(col, 0.55); poly(ctx, [D, C, C0, D0]); ctx.fill(); ctx.stroke();
    // 右面(+x)：中
    ctx.fillStyle = shade(col, 0.78); poly(ctx, [B, C, C0, B0]); ctx.fill(); ctx.stroke();
    // 顶面：最亮
    ctx.fillStyle = shade(col, 1.08); poly(ctx, [A, B, C, D]); ctx.fill(); ctx.stroke();
    // 顶面高光斜线
    ctx.save(); poly(ctx, [A, B, C, D]); ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = Math.max(1, g.s * 0.01);
    ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(C.x, C.y); ctx.stroke();
    ctx.restore();
    return { top: { x: C.x, y: (A.y + C.y) / 2 }, bottom: iso(x + w / 2, y, z + d / 2, g.ox, g.oy, g.s) };
  }

  // 地面菱形阴影
  function groundShadow(ctx, g, gx, gz, w, d, alpha) {
    var p1 = iso(gx, 0, gz, g.ox, g.oy, g.s);
    var p2 = iso(gx + w, 0, gz, g.ox, g.oy, g.s);
    var p3 = iso(gx + w, 0, gz + d, g.ox, g.oy, g.s);
    var p4 = iso(gx, 0, gz + d, g.ox, g.oy, g.s);
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,' + (alpha == null ? 0.28 : alpha) + ')';
    ctx.translate(g.s * 0.12, g.s * 0.14);
    poly(ctx, [p1, p2, p3, p4]); ctx.fill();
    ctx.restore();
  }

  function gridOrigin(canvas, opts) {
    var W = canvas.width, H = canvas.height;
    return {
      ox: W * (opts.ox || 0.5),
      oy: H * (opts.oy || 0.66),
      s: Math.min(W, H) * (opts.scale || 0.115)
    };
  }

  var BASE = [0, 200, 255];

  // ============ 组件 1：等轴网格地面 ============
  function isoGrid(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height, g = gridOrigin(canvas, opts);
    var col = opts.color || BASE;
    var N = Math.round(opts.cells || 9);
    var speed = opts.speed == null ? 0.35 : opts.speed;
    var start = Date.now(), raf;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = ((Date.now() - start) / 1000) * speed;
      var shift = (t % 1);
      ctx.lineWidth = Math.max(1, g.s * 0.012);
      for (var i = -N; i <= N; i++) {
        var a = iso(i + shift, 0, -N, g.ox, g.oy, g.s);
        var b = iso(i + shift, 0, N, g.ox, g.oy, g.s);
        var c = iso(-N, 0, i + shift, g.ox, g.oy, g.s);
        var d = iso(N, 0, i + shift, g.ox, g.oy, g.s);
        var fade = 1 - Math.abs(i) / (N + 2);
        ctx.strokeStyle = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + (0.10 + 0.22 * fade) + ')';
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.stroke();
      }
      // 网格交点发光
      for (var m = -2; m <= 2; m++) for (var n = -2; n <= 2; n++) {
        var p = iso(m + shift, 0, n + shift, g.ox, g.oy, g.s);
        var pulse = 0.35 + 0.35 * Math.sin(t * 3 + m * 1.7 + n * 2.3);
        ctx.fillStyle = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + pulse + ')';
        ctx.beginPath(); ctx.arc(p.x, p.y, g.s * 0.035, 0, TAU); ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // ============ 组件 2：立体方块群 ============
  function isoBlocks(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height, g = gridOrigin(canvas, opts);
    var col = opts.color || BASE;
    var n = Math.round(opts.count || 7);
    var boxes = [];
    for (var i = 0; i < n; i++) {
      boxes.push({
        x: -3 + (i % 4) * 1.5,
        z: -2 + Math.floor(i / 4) * 1.8,
        w: rand(0.75, 1.15), d: rand(0.75, 1.15),
        hMax: rand(1.1, 2.6),
        delay: i / n * 0.55,
        k: rand(0.85, 1.15)
      });
    }
    var start = Date.now(), raf;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var cyc = ((Date.now() - start) / 1000 % 7) / 7; // 7秒一轮
      for (var i = 0; i < boxes.length; i++) {
        var b = boxes[i];
        var rise = clamp01((cyc - b.delay) / 0.4);
        if (rise <= 0) continue;
        // 轻微呼吸
        var h = b.hMax * rise * (0.94 + 0.06 * Math.sin(cyc * TAU * 2 + i));
        groundShadow(ctx, g, b.x, b.z, b.w, b.d, 0.3 * rise);
        cube(ctx, g, { x: b.x, y: 0, z: b.z, w: b.w, d: b.d, h: h },
          [col[0] * b.k, col[1] * b.k, col[2] * b.k]);
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // ============ 组件 3：等轴柱状图 ============
  function isoChart(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height, g = gridOrigin(canvas, opts);
    var col = opts.color || BASE;
    var vals = opts.values || [0.5, 0.8, 0.62, 0.95, 0.74, 0.88];
    var acc = opts.accent || [255, 120, 90];
    var start = Date.now(), raf;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var cyc = ((Date.now() - start) / 1000 % 6) / 6;
      // 地面
      ctx.strokeStyle = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',0.18)';
      ctx.lineWidth = Math.max(1, g.s * 0.012);
      var a = iso(-3.5, 0, -1.4, g.ox, g.oy, g.s), b = iso(vals.length * 1.1 - 3.5, 0, -1.4, g.ox, g.oy, g.s);
      var c = iso(-3.5, 0, 1.6, g.ox, g.oy, g.s), d = iso(vals.length * 1.1 - 3.5, 0, 1.6, g.ox, g.oy, g.s);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.stroke();
      for (var i = 0; i < vals.length; i++) {
        var grow = clamp01((cyc - i * 0.07) / 0.5);
        if (grow <= 0) continue;
        var h = vals[i] * 3.0 * grow * (0.97 + 0.03 * Math.sin(cyc * TAU * 2 + i));
        var x = -3 + i * 1.15;
        var isAcc = (i === vals.indexOf(Math.max.apply(null, vals))) || i % 3 === 0;
        groundShadow(ctx, g, x, -0.6, 0.72, 0.72, 0.26 * grow);
        cube(ctx, g, { x: x, y: 0, z: -0.6, w: 0.72, d: 0.72, h: h },
          isAcc ? acc : col);
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // ============ 组件 4：等轴流程节点 ============
  function isoFlow(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height, g = gridOrigin(canvas, opts);
    var col = opts.color || BASE;
    var n = Math.round(opts.nodes || 4);
    var nodes = [];
    for (var i = 0; i < n; i++) {
      nodes.push({ x: -3.2 + i * (6.4 / Math.max(1, n - 1)), z: 0 - (i % 2) * 0.6 });
    }
    var start = Date.now(), raf;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = (Date.now() - start) / 1000;
      var cyc = (t % 6) / 6;
      // 连线
      ctx.strokeStyle = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',0.45)';
      ctx.lineWidth = Math.max(2, g.s * 0.03);
      ctx.beginPath();
      for (var i = 0; i < nodes.length; i++) {
        var p = iso(nodes[i].x, 0.6, nodes[i].z, g.ox, g.oy, g.s);
        if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      // 流动光点沿连线
      var segs = nodes.length - 1;
      for (var s = 0; s < segs; s++) {
        var f = clamp01((cyc * 1.4 - s * 0.18) / 0.5);
        if (f <= 0 || f >= 1) continue;
        var x = nodes[s].x + (nodes[s + 1].x - nodes[s].x) * f;
        var z = nodes[s].z + (nodes[s + 1].z - nodes[s].z) * f;
        var pp = iso(x, 0.6, z, g.ox, g.oy, g.s);
        ctx.fillStyle = 'rgba(255,255,255,.9)';
        ctx.beginPath(); ctx.arc(pp.x, pp.y, g.s * 0.07, 0, TAU); ctx.fill();
      }
      // 节点方块
      for (var j = 0; j < nodes.length; j++) {
        var rise = clamp01((cyc - j * 0.12) / 0.35);
        if (rise <= 0) continue;
        groundShadow(ctx, g, nodes[j].x - 0.4, nodes[j].z - 0.4, 0.8, 0.8, 0.3 * rise);
        cube(ctx, g, { x: nodes[j].x - 0.4, y: 0, z: nodes[j].z - 0.4, w: 0.8, d: 0.8, h: 1.2 * rise }, col);
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // ============ 组件 5：中心数据塔 ============
  function isoTower(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height, g = gridOrigin(canvas, opts);
    var col = opts.color || BASE;
    var acc = opts.accent || [255, 200, 90];
    var layers = Math.round(opts.layers || 6);
    var start = Date.now(), raf;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var cyc = ((Date.now() - start) / 1000 % 7) / 7;
      groundShadow(ctx, g, -1.4, -1.4, 2.8, 2.8, 0.34);
      for (var i = 0; i < layers; i++) {
        var appear = clamp01((cyc - i * 0.1) / 0.35);
        if (appear <= 0) continue;
        var size = (2.6 - i * 0.28);
        var h = 0.55 * appear;
        var y0 = i * 0.55;
        var spin = (i % 2 ? 1 : -1) * 0.06 * Math.sin(cyc * TAU + i);
        ctx.save();
        cube(ctx, g, { x: -size / 2, y: y0, z: -size / 2, w: size, d: size, h: h },
          i % 2 ? col : acc);
        ctx.restore();
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  var V = global.VISUALS || (global.VISUALS = {});
  V.isoGrid = isoGrid;
  V.isoBlocks = isoBlocks;
  V.isoChart = isoChart;
  V.isoFlow = isoFlow;
  V.isoTower = isoTower;
})(window);
