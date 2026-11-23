/*
 * visuals.js — 可复用视觉动画组件库
 * ---------------------------------------------------------------
 * 每个组件是一个函数：function(canvas, opts, progress) -> cleanup
 *   canvas   : <canvas> 元素，尺寸已按 1080x1920（或缩放后）设置
 *   opts     : content.json 里 visual.opts 的参数
 *   progress : 函数，返回当前页播放进度 0~1（由主时间轴驱动，可选使用）
 *   返回值   : 清理函数，切页/重播时调用，用于取消 rAF
 *
 * 注册方式：在 VISUALS 对象里加一个 key，key 即 content.json 里 visual.name 的值。
 * 新增动画只需在此文件加函数 + 注册，无需改动 lib_html.py / pipeline.py。
 */
(function (global) {
  'use strict';

  var TAU = Math.PI * 2;
  function rand(a, b) { return a + Math.random() * (b - a); }

  // ---------- 通用：星空球 ----------
  // 一个缓慢自转、带辉光和网格线的球体，适合"星球/宇宙/全球/地球/市场"等意象
  function planet(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var cx = W / 2, cy = H / 2;
    var R = Math.min(W, H) * (opts.size || 0.30);
    var color = opts.color || [0, 212, 255];
    var accent = opts.accent || [176, 38, 255];
    var speed = opts.speed || 0.0035;
    var dots = opts.dots || 150;
    var angle = 0, raf;

    // 球面均匀采样点
    var pts = [];
    for (var i = 0; i < dots; i++) {
      var y = 1 - (i / (dots - 1)) * 2;
      var r = Math.sqrt(Math.max(0, 1 - y * y));
      var theta = Math.PI * (3 - Math.sqrt(5)) * i;
      pts.push({ x: Math.cos(theta) * r, y: y, z: Math.sin(theta) * r });
    }

    function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }

    function frame() {
      ctx.clearRect(0, 0, W, H);
      angle += speed;

      // 外层辉光
      var glow = ctx.createRadialGradient(cx, cy, R * 0.6, cx, cy, R * 1.5);
      glow.addColorStop(0, rgba(color, 0.20));
      glow.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(cx, cy, R * 1.5, 0, TAU); ctx.fill();

      // 球体底色（暗面）
      var body = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.1, cx, cy, R);
      body.addColorStop(0, rgba(accent, 0.28));
      body.addColorStop(1, 'rgba(6,9,28,0.9)');
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();

      // 经线纬线（网格）
      ctx.lineWidth = Math.max(1, W / 900);
      var cosA = Math.cos(angle), sinA = Math.sin(angle);
      for (var lat = -60; lat <= 60; lat += 30) {
        var phi = lat * Math.PI / 180;
        var ry = Math.sin(phi) * R, rr = Math.cos(phi) * R;
        ctx.beginPath();
        for (var t = 0; t <= 64; t++) {
          var a = t / 64 * TAU;
          var x = Math.cos(a) * rr;
          var z = Math.sin(a) * rr;
          var X = cx + x * cosA - z * sinA;
          var depth = x * sinA + z * cosA;
          var Y = cy + ry;
          if (t === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
        }
        ctx.strokeStyle = rgba(color, 0.13); ctx.stroke();
      }

      // 球面上的点，按深度排序做遮挡
      var proj = [];
      for (var j = 0; j < pts.length; j++) {
        var p = pts[j];
        var X = p.x * cosA - p.z * sinA;
        var Z = p.x * sinA + p.z * cosA;
        proj.push({ x: cx + X * R, y: cy + p.y * R, z: Z });
      }
      proj.sort(function (a, b) { return a.z - b.z; });
      for (var k = 0; k < proj.length; k++) {
        var q = proj[k];
        var front = (q.z + 1) / 2;             // 0 背面 1 正面
        if (front < 0.15) continue;             // 背面点淡出
        var rad = Math.max(1, W / 620) * (0.6 + front);
        ctx.fillStyle = rgba(k % 7 === 0 ? accent : color, 0.25 + front * 0.75);
        ctx.beginPath(); ctx.arc(q.x, q.y, rad, 0, TAU); ctx.fill();
      }

      // 赤道亮环
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1, 0.24 + Math.abs(Math.sin(angle)) * 0.10);
      ctx.beginPath(); ctx.arc(0, 0, R * 1.02, 0, TAU);
      ctx.strokeStyle = rgba(color, 0.5);
      ctx.lineWidth = Math.max(1.5, W / 650);
      ctx.stroke();
      ctx.restore();

      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // ---------- 通用：漂浮星尘 ----------
  // 缓慢上浮的发光粒子，作为背景氛围层，百搭
  function particles(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var n = opts.count || 90;
    var color = opts.color || [120, 180, 255];
    var speed = opts.speed || 0.25;
    var ps = [];
    for (var i = 0; i < n; i++) {
      ps.push({ x: rand(0, W), y: rand(0, H), r: rand(1, 3.2), v: rand(0.3, 1) * speed, a: rand(0.15, 0.7), ph: rand(0, TAU) });
    }
    var raf;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < ps.length; i++) {
        var p = ps[i];
        p.y -= p.v;
        if (p.y < -10) { p.y = H + 10; p.x = rand(0, W); }
        var twinkle = 0.6 + 0.4 * Math.sin(Date.now() / 700 + p.ph);
        ctx.fillStyle = 'rgba(' + color[0] + ',' + color[1] + ',' + color[2] + ',' + (p.a * twinkle) + ')';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // ---------- 数据/科技：矩阵数字雨 ----------
  // 竖直下落的字符流，适合"数据/代码/黑客/AI/算法"意象
  function matrix(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var size = opts.fontSize || Math.round(W / 42);
    var cols = Math.ceil(W / size);
    var chars = opts.chars || '01アイウエオカキクケコサシスセソ<>/{}[]';
    var drops = [], speeds = [];
    for (var i = 0; i < cols; i++) { drops.push(rand(-50, 0)); speeds.push(rand(0.4, 1.2)); }
    var raf, last = 0;
    function frame(ts) {
      raf = requestAnimationFrame(frame);
      if (ts - last < 45) return;      // 控制下落帧率
      last = ts;
      ctx.fillStyle = 'rgba(6,9,28,0.16)';
      ctx.fillRect(0, 0, W, H);
      ctx.font = size + 'px monospace';
      for (var i = 0; i < cols; i++) {
        var ch = chars[Math.floor(Math.random() * chars.length)];
        var y = drops[i] * size;
        ctx.fillStyle = 'rgba(0,212,255,' + rand(0.35, 0.9) + ')';
        ctx.fillText(ch, i * size, y);
        drops[i] += speeds[i] * 0.6;
        if (y > H && Math.random() > 0.975) drops[i] = rand(-20, 0);
      }
    }
    raf = requestAnimationFrame(frame);
    return function () { cancelAnimationFrame(raf); };
  }

  // ---------- 连接：神经网络 ----------
  // 节点与连线构成的网络，脉冲沿线流动，适合"关系/连接/生态/网络/链路"意象
  function network(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var n = opts.nodes || 40;
    var linkDist = opts.linkDist || (Math.min(W, H) * 0.28);
    var nodes = [], edges = [], raf;
    for (var i = 0; i < n; i++) {
      nodes.push({ x: rand(W * 0.08, W * 0.92), y: rand(H * 0.12, H * 0.88), vx: rand(-0.25, 0.25), vy: rand(-0.25, 0.25), ph: rand(0, TAU) });
    }
    for (var a = 0; a < n; a++) for (var b = a + 1; b < n; b++) {
      var dx = nodes[a].x - nodes[b].x, dy = nodes[a].y - nodes[b].y;
      if (Math.hypot(dx, dy) < linkDist) edges.push([a, b]);
    }
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = Date.now() / 1000;
      for (var e = 0; e < edges.length; e++) {
        var p = nodes[edges[e][0]], q = nodes[edges[e][1]];
        var dx = p.x - q.x, dy = p.y - q.y, d = Math.hypot(dx, dy);
        var alpha = Math.max(0, 1 - d / linkDist) * 0.5;
        ctx.strokeStyle = 'rgba(90,140,255,' + alpha + ')';
        ctx.lineWidth = Math.max(0.8, W / 1000);
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
        // 流动光点
        var f = (t * 0.35 + e * 0.13) % 1;
        ctx.fillStyle = 'rgba(0,212,255,' + (0.35 + 0.5 * Math.sin(f * Math.PI)) + ')';
        ctx.beginPath(); ctx.arc(p.x + (q.x - p.x) * f, p.y + (q.y - p.y) * f, Math.max(1.4, W / 700), 0, TAU); ctx.fill();
      }
      for (var i = 0; i < n; i++) {
        var nd = nodes[i];
        nd.x += nd.vx; nd.y += nd.vy;
        if (nd.x < W * 0.05 || nd.x > W * 0.95) nd.vx *= -1;
        if (nd.y < H * 0.08 || nd.y > H * 0.92) nd.vy *= -1;
        var pulse = 0.55 + 0.45 * Math.sin(t * 1.6 + nd.ph);
        ctx.fillStyle = 'rgba(176,38,255,' + (0.4 + pulse * 0.5) + ')';
        ctx.beginPath(); ctx.arc(nd.x, nd.y, Math.max(1.8, W / 620) * pulse, 0, TAU); ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // ---------- 冲击：扩散涟漪 ----------
  // 从中心扩散的同心圆，适合"冲击/引爆/震动/影响力"意象
  function ripple(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var cx = W / 2, cy = H / 2;
    var maxR = Math.min(W, H) * (opts.maxSize || 0.48);
    var color = opts.color || [0, 212, 255];
    var rings = opts.rings || 4;
    var raf;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = Date.now() / 1400;
      for (var i = 0; i < rings; i++) {
        var f = (t + i / rings) % 1;
        var r = f * maxR;
        ctx.strokeStyle = 'rgba(' + color[0] + ',' + color[1] + ',' + color[2] + ',' + (1 - f) * 0.5 + ')';
        ctx.lineWidth = Math.max(1.5, W / 600) * (1 - f * 0.6);
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // ---------- 增长：上升柱状图 ----------
  // 从底部生长的柱条，适合"增长/数据/营收/趋势"意象；cols 可给数值
  function bars(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var vals = opts.values || [0.4, 0.65, 0.5, 0.8, 0.72, 1.0];
    var n = vals.length;
    var baseY = H * (opts.baseY || 0.78);
    var areaW = W * 0.78, x0 = W * 0.11;
    var bw = areaW / n * 0.62, gap = areaW / n;
    var start = Date.now();
    var dur = opts.growMs || 1100;
    var raf;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var p = Math.min(1, (Date.now() - start) / dur);
      var ease = 1 - Math.pow(1 - p, 3);
      for (var i = 0; i < n; i++) {
        var h = vals[i] * (baseY - H * 0.18) * ease;
        var x = x0 + i * gap + (gap - bw) / 2;
        var g = ctx.createLinearGradient(0, baseY - h, 0, baseY);
        g.addColorStop(0, 'rgba(0,212,255,0.95)');
        g.addColorStop(1, 'rgba(176,38,255,0.35)');
        ctx.fillStyle = g;
        ctx.fillRect(x, baseY - h, bw, h);
        ctx.fillStyle = 'rgba(0,212,255,0.9)';
        ctx.fillRect(x, baseY - h - Math.max(2, W/500), bw, Math.max(2, W/500));
      }
      ctx.strokeStyle = 'rgba(120,160,255,0.25)';
      ctx.lineWidth = Math.max(1, W/1000);
      ctx.beginPath(); ctx.moveTo(x0, baseY); ctx.lineTo(x0 + areaW, baseY); ctx.stroke();
      if (p < 1) raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // ---------- 扫描：雷达扇形 ----------
  // 旋转扫描线，适合"搜索/监控/筛选/雷达/侦测"意象
  function radar(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var cx = W / 2, cy = H / 2, R = Math.min(W, H) * (opts.size || 0.36);
    var color = opts.color || [0, 212, 255];
    var raf, a = 0;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      a += opts.speed || 0.03;
      ctx.strokeStyle = 'rgba(' + color[0] + ',' + color[1] + ',' + color[2] + ',0.22)';
      ctx.lineWidth = Math.max(1, W/1000);
      for (var i = 1; i <= 3; i++) { ctx.beginPath(); ctx.arc(cx, cy, R * i / 3, 0, TAU); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();
      // 扫描扇形
      var grad = ctx.createConicGradient ? ctx.createConicGradient(a - 0.5, cx, cy) : null;
      if (grad) {
        grad.addColorStop(0, 'rgba(' + color[0] + ',' + color[1] + ',' + color[2] + ',0)');
        grad.addColorStop(0.08, 'rgba(' + color[0] + ',' + color[1] + ',' + color[2] + ',0.32)');
        grad.addColorStop(0.12, 'rgba(' + color[0] + ',' + color[1] + ',' + color[2] + ',0)');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
      } else {
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
        ctx.fillStyle = 'rgba(' + color[0] + ',' + color[1] + ',' + color[2] + ',0.15)';
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, -0.4, 0); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      ctx.strokeStyle = 'rgba(' + color[0] + ',' + color[1] + ',' + color[2] + ',0.8)';
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.stroke();
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  var VISUALS = {
    planet: planet,
    particles: particles,
    matrix: matrix,
    network: network,
    ripple: ripple,
    bars: bars,
    radar: radar
  };

  global.VISUALS = VISUALS;
})(window);
