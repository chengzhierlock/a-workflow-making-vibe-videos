/*
 * 逐帧手绘风格 · 专属视觉组件 (sketch visuals)
 * ---------------------------------------------------------------
 * 追加到主 VISUALS 库之后加载，注册手绘风格专属组件。
 * 核心手法：用 path 的描边进度（模拟铅笔逐笔勾勒）+ 轻微抖动 + 纸感颜色。
 *
 * 组件：
 *   sketchDoodle  - 手写线稿涂鸦背景（多个简笔图标逐笔浮现）
 *   sketchArrows  - 手绘箭头/流程线逐条画出
 *   sketchBulb    - 手绘灯泡（灵感）
 *   sketchGear    - 手绘齿轮（机制/系统）
 *   sketchChart   - 手绘柱状图/折线（数据）
 */
(function (global) {
  'use strict';
  var TAU = Math.PI * 2;
  function rand(a, b) { return a + Math.random() * (b - a); }
  var INK = '#4a3524';        // 铅笔墨色
  var INK2 = '#a8562f';       // 红墨强调
  var PAPER = 'rgba(244,236,216,';

  // 铅笔线质感：双线轻微错位 + 末端毛糙
  function penStroke(ctx, drawPath, color, width, alpha) {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    drawPath();
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // 让一段 path 按 progress 逐笔描出（用 dash 技巧：给一个超大 dash，offset 按比例）
  function strokePath(ctx, drawPath, progress, color, width, alpha, rough) {
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    var len = 3000; // 足够大的虚拟长度
    ctx.setLineDash([len, len]);
    ctx.lineDashOffset = len * (1 - Math.min(1, Math.max(0, progress)));
    // 轻微抖动：整个画布位移一点，制造手绘"活"的感觉
    if (rough) ctx.translate(Math.sin(Date.now() / 260) * 1.2, Math.cos(Date.now() / 300) * 1.0);
    drawPath(); ctx.stroke();
    ctx.restore();
  }

  // ---- 简笔图标：每个是一组 path 绘制函数，接收 (ctx, cx, cy, r) ----
  function iconBulb(ctx, cx, cy, r) {
    ctx.beginPath(); ctx.arc(cx, cy - r * .15, r * .62, Math.PI * .15, Math.PI * .85);
    ctx.moveTo(cx - r * .5, cy + r * .35); ctx.lineTo(cx - r * .35, cy + r * .35);
    ctx.lineTo(cx - r * .28, cy + r * .62); ctx.lineTo(cx + r * .28, cy + r * .62);
    ctx.lineTo(cx + r * .35, cy + r * .35); ctx.lineTo(cx + r * .5, cy + r * .35);
    ctx.moveTo(cx - r * .18, cy + r * .78); ctx.lineTo(cx + r * .18, cy + r * .78);
    ctx.moveTo(cx, cy - r * .15); ctx.lineTo(cx, cy - r * .78);
  }
  function iconGear(ctx, cx, cy, r) {
    ctx.beginPath();
    for (var i = 0; i < 12; i++) {
      var a = i / 12 * TAU, rr = (i % 2 ? r * .78 : r);
      var x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.moveTo(cx + r * .34, cy); ctx.arc(cx, cy, r * .34, 0, TAU);
  }
  function iconCloud(ctx, cx, cy, r) {
    ctx.beginPath();
    ctx.moveTo(cx - r, cy + r * .3);
    ctx.bezierCurveTo(cx - r * 1.3, cy - r * .3, cx - r * .4, cy - r * .6, cx - r * .1, cy - r * .15);
    ctx.bezierCurveTo(cx + r * .2, cy - r * .9, cx + r * 1.2, cy - r * .5, cx + r * .95, cy + r * .15);
    ctx.bezierCurveTo(cx + r * 1.4, cy + r * .5, cx + r * .6, cy + r * .7, cx - r, cy + r * .3);
  }
  function iconArrow(ctx, cx, cy, r) {
    ctx.beginPath();
    ctx.moveTo(cx - r, cy + r * .2);
    ctx.quadraticCurveTo(cx, cy - r * .6, cx + r, cy - r * .1);
    ctx.moveTo(cx + r * .55, cy - r * .45); ctx.lineTo(cx + r, cy - r * .1); ctx.lineTo(cx + r * .6, cy + r * .3);
  }
  function iconStar(ctx, cx, cy, r) {
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var a = -Math.PI / 2 + i / 10 * TAU, rr = (i % 2 ? r * .42 : r);
      var x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }
  function iconChat(ctx, cx, cy, r) {
    ctx.beginPath();
    ctx.moveTo(cx - r, cy - r * .6); ctx.lineTo(cx + r, cy - r * .6);
    ctx.lineTo(cx + r, cy + r * .4); ctx.lineTo(cx - r * .2, cy + r * .4);
    ctx.lineTo(cx - r * .6, cy + r * .85); ctx.lineTo(cx - r * .6, cy + r * .4);
    ctx.lineTo(cx - r, cy + r * .4); ctx.closePath();
  }
  var ICONS = [iconBulb, iconGear, iconCloud, iconArrow, iconStar, iconChat];

  // ============ 组件 1：手绘线稿涂鸦背景 ============
  // 多个简笔图标散布画面，每个按不同进度逐笔浮现，带纸张铅笔质感。
  function sketchDoodle(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var count = opts.count || 7;
    var color = opts.color || INK;
    var accent = opts.accent || INK2;
    var items = [];
    for (var i = 0; i < count; i++) {
      items.push({
        x: rand(W * .15, W * .85), y: rand(H * .2, H * .86),
        r: rand(W * .09, W * .16),
        icon: ICONS[i % ICONS.length],
        delay: rand(0, .55),          // 出现延迟
        tilt: rand(-.25, .25),
        acc: i % 3 === 0
      });
    }
    var start = Date.now();
    var raf;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = (Date.now() - start) / 1000;
      var cycle = (t % 6) / 6;         // 6 秒一轮，循环重画
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        var p = Math.min(1, Math.max(0, (cycle - it.delay) / .5)); // 0~1 描边进度
        if (p <= 0) continue;
        ctx.save();
        ctx.translate(it.x, it.y);
        ctx.rotate(it.tilt + Math.sin(t * .7 + i) * .02);
        strokePath(ctx, function () { it.icon(ctx, 0, 0, it.r); }, p,
          it.acc ? accent : color, Math.max(2, W / 320), .5 + .32 * Math.sin(p * Math.PI),
          true);
        ctx.restore();
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // ============ 组件 2：手绘箭头流程线 ============
  function sketchArrows(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var n = opts.arrows || 3;
    var paths = [];
    for (var i = 0; i < n; i++) {
      var y = H * (.22 + i * .28);
      paths.push({
        d: [
          [W * .1, y], [W * .4, y - rand(-40, 40)], [W * .7, y + rand(-40, 40)], [W * .9, y]
        ],
        delay: i * .22, acc: i === 1
      });
    }
    var start = Date.now(), raf;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var cycle = ((Date.now() - start) / 1000 % 5) / 5;
      for (var i = 0; i < paths.length; i++) {
        var pa = paths[i];
        var p = Math.min(1, Math.max(0, (cycle - pa.delay) / .5));
        if (p <= 0) continue;
        var pts = pa.d;
        // 分段描出
        var total = pts.length - 1;
        var upto = p * total;
        ctx.save();
        ctx.strokeStyle = pa.acc ? INK2 : INK; ctx.lineWidth = Math.max(2.5, W / 280);
        ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalAlpha = .72;
        ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
        for (var s = 1; s <= Math.floor(upto); s++) ctx.lineTo(pts[s][0], pts[s][1]);
        // 当前段按比例插值
        var seg = Math.floor(upto), frac = upto - seg;
        if (seg < total) {
          var a = pts[seg], b = pts[seg + 1];
          ctx.lineTo(a[0] + (b[0] - a[0]) * frac, a[1] + (b[1] - a[1]) * frac);
        }
        ctx.stroke();
        // 箭头
        if (p > .92) {
          var end = pts[total], prev = pts[total - 1];
          var ang = Math.atan2(end[1] - prev[1], end[0] - prev[0]);
          ctx.beginPath();
          ctx.moveTo(end[0] - Math.cos(ang - .5) * 26, end[1] - Math.sin(ang - .5) * 26);
          ctx.lineTo(end[0], end[1]);
          ctx.lineTo(end[0] - Math.cos(ang + .5) * 26, end[1] - Math.sin(ang + .5) * 26);
          ctx.stroke();
        }
        ctx.restore();
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // ============ 组件 3：手绘柱状图逐笔画出 ============
  function sketchChart(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var vals = opts.values || [.45, .7, .55, .85, .68];
    var baseY = H * .8, x0 = W * .14, areaW = W * .72;
    var bw = areaW / vals.length * .6, gap = areaW / vals.length;
    var start = Date.now(), raf;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var cycle = ((Date.now() - start) / 1000 % 5) / 5;
      var p = Math.min(1, cycle / .75);
      // 手绘坐标轴
      ctx.save();
      ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2.5, W / 300); ctx.globalAlpha = .75;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x0 - 14, baseY); ctx.lineTo(x0 + areaW + 18, baseY);
      ctx.moveTo(x0 - 14, baseY); ctx.lineTo(x0 - 14, baseY - areaW * .62); ctx.stroke();
      ctx.restore();
      // 柱子：手绘空心矩形 + 斜线阴影，逐根画出
      for (var i = 0; i < vals.length; i++) {
        var local = Math.min(1, Math.max(0, (p - i * .08) / .4));
        if (local <= 0) continue;
        var h = vals[i] * areaW * .6 * local;
        var x = x0 + i * gap + (gap - bw) / 2, y = baseY - h;
        ctx.save();
        ctx.strokeStyle = i % 2 ? INK2 : INK; ctx.lineWidth = Math.max(2.5, W / 300);
        ctx.globalAlpha = .8; ctx.lineJoin = 'round';
        // 轻微手绘抖动（不闭合完美）
        ctx.beginPath();
        ctx.moveTo(x, baseY); ctx.lineTo(x + 2, y + 3); ctx.lineTo(x + bw, y); ctx.lineTo(x + bw - 1, baseY);
        ctx.stroke();
        // 斜线阴影填充
        if (local > .6) {
          ctx.save(); ctx.beginPath(); ctx.rect(x, y, bw, h); ctx.clip();
          ctx.globalAlpha = .28; ctx.strokeStyle = i % 2 ? INK2 : INK; ctx.lineWidth = 1.5;
          for (var k = -h; k < bw; k += 12) { ctx.beginPath(); ctx.moveTo(x + k, baseY); ctx.lineTo(x + k + h, y); ctx.stroke(); }
          ctx.restore();
        }
        ctx.restore();
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // ============ 组件 4：手绘灯泡（灵感） ============
  function sketchBulb(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var cx = W / 2, cy = H * .46, r = Math.min(W, H) * (opts.size || .18);
    var start = Date.now(), raf;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var cycle = ((Date.now() - start) / 1000 % 5) / 5;
      var p = Math.min(1, cycle / .7);
      // 灯泡主体逐笔画出
      strokePath(ctx, function () { iconBulb(ctx, cx, cy, r); }, p, INK, Math.max(3, W / 190), .85, true);
      // 光芒线：画完主体后依次放射
      if (p > .6) {
        var rp = (p - .6) / .4;
        for (var i = 0; i < 8; i++) {
          var lp = Math.min(1, Math.max(0, rp * 1.6 - i * .08));
          if (lp <= 0) continue;
          var a = i / 8 * TAU;
          var r0 = r * 1.15, r1 = r * 1.42;
          ctx.save(); ctx.globalAlpha = .7 * lp;
          ctx.strokeStyle = INK2; ctx.lineWidth = Math.max(2.5, W / 260); ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * r0 * (0.4 + .6 * lp), cy + Math.sin(a) * r0 * (0.4 + .6 * lp));
          ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
          ctx.stroke(); ctx.restore();
        }
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // 注册（覆盖式添加到全局 VISUALS）
  var V = global.VISUALS || (global.VISUALS = {});
  V.sketchDoodle = sketchDoodle;
  V.sketchArrows = sketchArrows;
  V.sketchChart = sketchChart;
  V.sketchBulb = sketchBulb;
})(window);
