/*
 * 液态流动 · 专属视觉组件 (liquid flow / fluid motion)
 * ---------------------------------------------------------------
 * 追加到主 VISUALS 库之后加载，注册液态流动专属组件。
 * 核心手法：液滴融合metaball + 墨滴入水晕开 + 黏稠拉丝倾倒 +
 *   虹彩油膜 + 涟漪扩散 + 流动高光。强调真实液体物理质感。
 * 与 morph 的形状插值区分：这里是柔软黏稠会流动的液体本身。
 *
 * 组件：
 *   liquidMetaball  - 液滴融合球：靠近时融合、拉丝、分离（metaball）
 *   liquidInk       - 墨滴入水：彩色墨滴扩散成云雾缓慢晕开
 *   liquidPour      - 黏稠倾倒：液体流下拉丝、底部堆积
 *   liquidIridescent- 虹彩油膜：水面彩虹流动 + 肥皂泡光泽
 *   liquidRipple    - 水滴涟漪：同心波纹层层扩散
 *
 * 所有随机走确定性 rnd(i)，保证 seek 抓帧跨 worker 一致。
 * 动画基于 Date.now()（虚拟时钟），起始态即可读，不用 opacity:0 / 大 scale。
 */
(function (global) {
  'use strict';
  var TAU = Math.PI * 2;
  function rnd(i) { var x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  var TEAL = '#5eead4', PUR = '#a78bfa', PINK = '#f9a8d4', SKY = '#7dd3fc', LIME = '#a3e635';
  var LIQ = [TEAL, PUR, PINK, SKY, LIME];
  // 十六进制色 → rgb 数组
  function rgb(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgba(hex, a) { var c = rgb(hex); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }

  // 液滴融合球：多个径向渐变叠加，靠近时视觉上融合（metaball 近似）
  function liquidMetaball(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
    var count = Math.round(opts.count || 6);
    var start = Date.now(), raf;
    var balls = [];
    for (var i = 0; i < count; i++) {
      balls.push({
        r: 60 + rnd(i * 3 + 1) * 70,
        col: LIQ[i % LIQ.length],
        ph: rnd(i * 5 + 2) * TAU,
        sp: 0.25 + rnd(i * 7 + 3) * 0.35
      });
    }
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = (Date.now() - start) / 1000;
      var cx = W / 2, cy = H * 0.45;
      // 中心大液滴
      balls.forEach(function (b, k) {
        var a = t * b.sp + b.ph;
        var orbit = 70 + 34 * Math.sin(t * 0.6 + k);   // 轨道缓慢收缩/张开，产生融合分离
        var x = cx + Math.cos(a) * orbit * 1.5;
        var y = cy + Math.sin(a) * orbit;
        // 白色高光核心（metaball 融合靠渐变叠加近似）
        var g = ctx.createRadialGradient(x - b.r * .25, y - b.r * .3, b.r * .05, x, y, b.r);
        g.addColorStop(0, rgba(b.col, .95));
        g.addColorStop(.55, rgba(b.col, .8));
        g.addColorStop(1, rgba(b.col, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, b.r, 0, TAU); ctx.fill();
        // 高光点
        ctx.fillStyle = 'rgba(255,255,255,.7)';
        ctx.beginPath(); ctx.ellipse(x - b.r * .3, y - b.r * .35, b.r * .16, b.r * .1, -.5, 0, TAU); ctx.fill();
      });
      // 中心核
      var g0 = ctx.createRadialGradient(cx - 20, cy - 24, 10, cx, cy, 120);
      g0.addColorStop(0, rgba(TEAL, .9)); g0.addColorStop(.6, rgba(PUR, .7)); g0.addColorStop(1, rgba(PUR, 0));
      ctx.fillStyle = g0; ctx.beginPath(); ctx.arc(cx, cy, 120, 0, TAU); ctx.fill();
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // 墨滴入水：彩色墨滴从上方落下，扩散成半透明云雾缓慢晕开
  function liquidInk(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
    var count = Math.round(opts.count || 5);
    var start = Date.now(), raf;
    var inks = [];
    for (var i = 0; i < count; i++) {
      inks.push({
        x: W * (0.2 + rnd(i * 3 + 1) * 0.6),
        y0: H * (0.25 + rnd(i * 5 + 2) * 0.45),
        col: LIQ[i % LIQ.length],
        ph: rnd(i * 7 + 3) * TAU,
        speed: 0.18 + rnd(i * 11 + 4) * 0.2
      });
    }
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = (Date.now() - start) / 1000;
      inks.forEach(function (ink, k) {
        var cyc = (t * ink.speed + ink.ph / TAU) % 1;   // 0→1 一轮晕开
        var scale = 40 + cyc * 180;
        var alpha = 0.55 * (1 - cyc) + 0.06;           // 越晕越淡
        var wob = Math.sin(t + k) * 14;
        // 多层径向渐变云雾
        for (var layer = 0; layer < 3; layer++) {
          var g = ctx.createRadialGradient(ink.x + wob * layer, ink.y0 + cyc * 60, scale * .1,
                                           ink.x + wob * layer, ink.y0 + cyc * 60, scale * (1 + layer * .3));
          g.addColorStop(0, rgba(ink.col, alpha));
          g.addColorStop(.5, rgba(ink.col, alpha * .5));
          g.addColorStop(1, rgba(ink.col, 0));
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(ink.x + wob * layer, ink.y0 + cyc * 60, scale * (1 + layer * .3), 0, TAU); ctx.fill();
        }
        // 墨滴核心（未晕开时明显）
        if (cyc < .35) {
          ctx.fillStyle = rgba(ink.col, .9);
          ctx.beginPath(); ctx.arc(ink.x, ink.y0 + cyc * 60, 16 * (1 - cyc), 0, TAU); ctx.fill();
        }
      });
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // 黏稠倾倒：液体从上方流下、拉丝、底部堆积
  function liquidPour(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
    var strands = Math.round(opts.strands || 4);
    var start = Date.now(), raf;
    var cols = [TEAL, PUR, PINK, SKY];
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = (Date.now() - start) / 1000;
      // 底部堆积液池（起伏液面）
      var poolY = H * 0.74;
      for (var p = 0; p < 3; p++) {
        ctx.beginPath(); ctx.moveTo(0, H);
        for (var x = 0; x <= W; x += 24) {
          var y = poolY + p * 42 + Math.sin(x * 0.012 + t * 1.2 + p) * (16 - p * 3);
          ctx.lineTo(x, y);
        }
        ctx.lineTo(W, H); ctx.closePath();
        ctx.fillStyle = rgba(cols[p], .55 - p * .1); ctx.fill();
      }
      // 上方液滴源
      ctx.fillStyle = rgba(TEAL, .85);
      ctx.beginPath(); ctx.ellipse(W * .5, H * .12, 150, 46, 0, 0, TAU); ctx.fill();
      // 黏稠拉丝（贝塞尔曲线流下）
      for (var s = 0; s < strands; s++) {
        var sx = W * (.32 + s * .12);
        var col = cols[s % cols.length];
        var flow = (t * 0.5 + s * 0.25) % 1;
        var dropY = H * (.16 + flow * .56);
        ctx.strokeStyle = rgba(col, .8);
        ctx.lineWidth = 14 - s * 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(sx, H * .15);
        ctx.bezierCurveTo(sx - 20, dropY * .55, sx + 24, dropY * .8, sx, dropY);
        ctx.stroke();
        // 下落的液滴头
        ctx.fillStyle = rgba(col, .92);
        ctx.beginPath(); ctx.ellipse(sx, dropY, 18, 26, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.6)';
        ctx.beginPath(); ctx.arc(sx - 5, dropY - 7, 5, 0, TAU); ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // 虹彩油膜：多色相位偏移的流动色带 + 肥皂泡光泽
  function liquidIridescent(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
    var start = Date.now(), raf;
    var IRIS = ['#5eead4', '#7dd3fc', '#a78bfa', '#f9a8d4', '#fde68a'];
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = (Date.now() - start) / 1000;
      var cx = W * .5, cy = H * .46, R = Math.min(W, H) * .32;
      // 虹彩流动椭圆色带（多色相位偏移）
      ctx.save();
      ctx.beginPath(); ctx.ellipse(cx, cy, R * 1.5, R, 0, 0, TAU); ctx.clip();
      for (var b = 0; b < 7; b++) {
        var col = IRIS[b % IRIS.length];
        var ph = t * .5 + b * .7;
        var y = cy - R + (b / 7) * R * 2 + Math.sin(ph) * 26;
        var g = ctx.createLinearGradient(cx - R * 1.5, y - 60, cx + R * 1.5, y + 60);
        g.addColorStop(0, rgba(col, 0));
        g.addColorStop(.5, rgba(col, .55));
        g.addColorStop(1, rgba(col, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(cx, y, R * 1.5, 70, Math.sin(ph) * .15, 0, TAU); ctx.fill();
      }
      ctx.restore();
      // 肥皂泡外圈高光
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.ellipse(cx, cy, R * 1.5, R, 0, 0, TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      ctx.beginPath(); ctx.ellipse(cx - R * .7, cy - R * .5, R * .22, R * .12, -.6, 0, TAU); ctx.fill();
      // 漂浮小泡
      for (var k = 0; k < 5; k++) {
        var sd = k + 1;
        var bx = cx + Math.cos(t * .4 + sd) * R * (1.4 + rnd(sd * 3));
        var by = cy + Math.sin(t * .5 + sd * 2) * R * 1.1;
        var br = 14 + rnd(sd * 5) * 26;
        var bg = ctx.createRadialGradient(bx - br*.3, by - br*.3, br*.1, bx, by, br);
        bg.addColorStop(0, rgba(IRIS[k % IRIS.length], .7));
        bg.addColorStop(1, rgba(IRIS[k % IRIS.length], 0));
        ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(bx, by, br, 0, TAU); ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // 水滴涟漪：液滴落下激起同心波纹层层扩散
  function liquidRipple(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
    var count = Math.round(opts.count || 3);
    var start = Date.now(), raf;
    var centers = [];
    for (var i = 0; i < count; i++) {
      centers.push({
        x: W * (0.28 + rnd(i * 3 + 1) * 0.44),
        y: H * (0.32 + rnd(i * 5 + 2) * 0.36),
        col: LIQ[i % LIQ.length],
        ph: rnd(i * 7 + 3)
      });
    }
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = (Date.now() - start) / 1000;
      centers.forEach(function (c, k) {
        var R = Math.min(W, H) * .3;
        // 4 圈同心波纹，周期性扩散
        for (var ring = 0; ring < 4; ring++) {
          var cyc = (t * .45 + c.ph + ring * .25) % 1;
          var rr = 12 + cyc * R;
          var alpha = .75 * (1 - cyc);
          ctx.strokeStyle = rgba(c.col, alpha);
          ctx.lineWidth = 8 * (1 - cyc) + 2;
          ctx.beginPath(); ctx.ellipse(c.x, c.y, rr, rr * .68, 0, 0, TAU); ctx.stroke();
        }
        // 中心液滴
        var drop = .5 + .5 * Math.sin(t * 2 + k);
        ctx.fillStyle = rgba(c.col, .8);
        ctx.beginPath(); ctx.ellipse(c.x, c.y, 14 + drop * 5, 20 + drop * 6, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.7)';
        ctx.beginPath(); ctx.arc(c.x - 4, c.y - 6, 4, 0, TAU); ctx.fill();
      });
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  var V = global.VISUALS || (global.VISUALS = {});
  V.liquidMetaball = liquidMetaball;
  V.liquidInk = liquidInk;
  V.liquidPour = liquidPour;
  V.liquidIridescent = liquidIridescent;
  V.liquidRipple = liquidRipple;
})(window);
