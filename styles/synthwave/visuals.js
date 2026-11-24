/*
 * 复古 Synthwave 风格 · 专属视觉组件 (retro synthwave / retrowave / outrun)
 * ---------------------------------------------------------------
 * 追加到主 VISUALS 库之后加载，注册 Synthwave 专属组件。
 * 核心手法：紫粉渐变夜空 + 横纹落日 + 透视网格地面 + 棕榈剪影 +
 *   霓虹线框山脉 + 星空光射线。强调 80 年代复古未来主义 / 夜晚公路氛围。
 * 与赛博朋克 HUD 区分：这里没有雷达/准星/数据面板，是大片渐变天空氛围。
 *
 * 组件：
 *   synthSun        - 横纹切割落日 + 呼吸辉光（主视觉）
 *   synthGrid       - 透视网格地面 + 霓虹地平线（空间/公路）
 *   synthPalms      - 棕榈树剪影 + 轻微摇曳（度假/夜晚）
 *   synthMountains  - 霓虹线框山脉（远景/氛围）
 *   synthStars      - 星空 + 交叉光射线 + 流星（夜空/点缀）
 *
 * 所有随机走确定性 rnd(i)，保证 seek 抓帧跨 worker 一致。
 * 动画基于 Date.now()（虚拟时钟），起始态即可读，不用 opacity:0 / 大 scale，
 * 避免 seek 抓帧固化脏帧。
 */
(function (global) {
  'use strict';
  var TAU = Math.PI * 2;
  function rnd(i) { var x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  var PINK = '#ff3ca6', CYAN = '#00e5ff', PURPLE = '#b065ff', ORANGE = '#ff8a5b', YELLOW = '#ffd36b';

  // 横纹切割落日：渐变圆盘 + 由下往上渐密的横向切割条纹 + 呼吸辉光
  function synthSun(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
    var cx = W * (opts.cx || 0.5), cy = H * (opts.cy || 0.42), R = Math.min(W, H) * (opts.r || 0.24);
    var start = Date.now(), raf;
    // 落日渐变：底部橙 → 中粉 → 顶部黄
    var g = ctx.createLinearGradient(0, cy - R, 0, cy + R);
    g.addColorStop(0, '#ffe27a'); g.addColorStop(0.42, '#ff9a5b'); g.addColorStop(1, '#ff2e9a');
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = (Date.now() - start) / 1000;
      var pulse = 1 + 0.03 * Math.sin(t * 1.4);
      var r = R * pulse;
      // 外层辉光
      ctx.save();
      ctx.shadowColor = PINK; ctx.shadowBlur = 70 + 18 * Math.sin(t * 1.4);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
      ctx.restore();
      // 横向切割条纹：越靠下越粗越密（经典 synthwave sun）
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip();
      var bands = 9;
      for (var k = 0; k < bands; k++) {
        var f = k / (bands - 1);           // 0 顶 → 1 底
        var y = cy - r * 0.1 + f * r * 1.15;
        var h = 3 + f * f * 22;            // 底部条纹更粗
        ctx.clearRect(cx - r, y, r * 2, h * (0.45 + 0.25 * Math.sin(t * 0.8 + k)));
      }
      ctx.restore();
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // 透视网格地面：地平线以下的放射竖线 + 逐渐加密的横线（向远处收敛）+ 霓虹地平线
  function synthGrid(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
    var hy = H * (opts.horizon || 0.58);   // 地平线 y
    var rows = Math.round(opts.rows || 14);
    var start = Date.now(), raf;
    var vx = W * 0.5;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = (Date.now() - start) / 1000;
      ctx.save();
      // 地平线发光带
      ctx.shadowColor = CYAN; ctx.shadowBlur = 26;
      ctx.strokeStyle = CYAN; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, hy); ctx.lineTo(W, hy); ctx.stroke();
      ctx.shadowBlur = 0;
      // 地面区域裁剪
      ctx.beginPath(); ctx.rect(0, hy, W, H - hy); ctx.clip();
      // 放射竖线：从地平线消失点向底部发散
      ctx.strokeStyle = 'rgba(255,60,166,.85)'; ctx.lineWidth = 2;
      ctx.shadowColor = PINK; ctx.shadowBlur = 12;
      for (var i = -10; i <= 10; i++) {
        var bx = vx + i * (W * 0.16);
        ctx.beginPath(); ctx.moveTo(vx + i * 6, hy); ctx.lineTo(bx, H); ctx.stroke();
      }
      // 横向线：越靠近地平线越密，随时间向下流动（透视前进感）
      ctx.strokeStyle = 'rgba(0,229,255,.8)'; ctx.shadowColor = CYAN; ctx.shadowBlur = 10;
      var flow = (t * 0.35) % 1;
      for (var k = 0; k < rows; k++) {
        var f = (k + flow) / rows;          // 0 近地平线 → 1 近底
        var yy = hy + Math.pow(f, 2.2) * (H - hy);
        ctx.lineWidth = 1 + f * 2;
        ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.stroke();
      }
      ctx.restore();
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // 棕榈树剪影：黑色树干 + 放射状羽叶 + 轻微摇曳（左右各一）
  function synthPalms(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
    var count = Math.round(opts.count || 2);
    var start = Date.now(), raf;
    function palm(baseX, baseY, scale, sway, seed) {
      var topY = baseY - H * 0.34 * scale;
      // 树干（略弯）
      ctx.strokeStyle = '#080210'; ctx.lineCap = 'round';
      ctx.lineWidth = 16 * scale;
      ctx.beginPath();
      ctx.moveTo(baseX, baseY);
      ctx.quadraticCurveTo(baseX + sway * 12, baseY - H * 0.18 * scale, baseX + sway * 26, topY);
      ctx.stroke();
      // 树干霓虹描边一侧
      ctx.strokeStyle = 'rgba(255,60,166,.35)'; ctx.lineWidth = 3 * scale;
      ctx.beginPath();
      ctx.moveTo(baseX - 6 * scale, baseY);
      ctx.quadraticCurveTo(baseX + sway * 12 - 6 * scale, baseY - H * 0.18 * scale, baseX + sway * 26 - 6 * scale, topY);
      ctx.stroke();
      // 羽叶
      var crownX = baseX + sway * 26, crownY = topY;
      var fronds = 7;
      for (var i = 0; i < fronds; i++) {
        var a = Math.PI + (i / (fronds - 1)) * Math.PI;   // 上半圆展开
        var len = H * (0.11 + rnd(seed * 7 + i) * 0.06) * scale;
        var ex = crownX + Math.cos(a) * len;
        var ey = crownY + Math.sin(a) * len * 0.7;
        ctx.strokeStyle = '#070110'; ctx.lineWidth = 8 * scale;
        ctx.beginPath(); ctx.moveTo(crownX, crownY);
        ctx.quadraticCurveTo((crownX + ex) / 2, crownY - len * 0.35, ex, ey);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(0,229,255,.28)'; ctx.lineWidth = 2 * scale;
        ctx.beginPath(); ctx.moveTo(crownX, crownY);
        ctx.quadraticCurveTo((crownX + ex) / 2, crownY - len * 0.35, ex, ey);
        ctx.stroke();
      }
    }
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = (Date.now() - start) / 1000;
      if (count >= 1) palm(W * 0.1, H * 0.98, 1.0, Math.sin(t * 0.7) * 0.8, 1);
      if (count >= 2) palm(W * 0.9, H * 0.96, 0.86, Math.sin(t * 0.7 + 1.5) * 0.8, 2);
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // 霓虹线框山脉：地平线上起伏山峦 + 发光描边 + 淡填充
  function synthMountains(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
    var peaks = Math.round(opts.peaks || 9);
    var hy = H * 0.58;
    var start = Date.now(), raf;
    // 生成一层山脊点（确定性）
    function ridge(layer, seed) {
      var pts = [], n = peaks + 1;
      for (var i = 0; i <= n; i++) {
        var x = (i / n) * W;
        var base = hy - layer * H * 0.02;
        var h = H * (0.03 + rnd(seed * 31 + i * 5) * (0.14 - layer * 0.03));
        pts.push([x, base - h]);
      }
      return pts;
    }
    function drawRidge(pts, color, fill, lw, t, speed) {
      ctx.beginPath();
      ctx.moveTo(0, H);
      ctx.lineTo(pts[0][0], pts[0][1]);
      for (var i = 1; i < pts.length - 1; i++) {
        var mx = (pts[i][0] + pts[i + 1][0]) / 2;
        var my = (pts[i][1] + pts[i + 1][1]) / 2;
        ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
      }
      ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
      ctx.lineTo(W, H); ctx.closePath();
      ctx.fillStyle = fill; ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = lw;
      ctx.shadowColor = color; ctx.shadowBlur = 18;
      ctx.stroke(); ctx.shadowBlur = 0;
    }
    var far = ridge(0, 1), near = ridge(1, 2);
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = (Date.now() - start) / 1000;
      drawRidge(far, 'rgba(176,101,255,.85)', 'rgba(40,10,60,.5)', 2.5, t, 0);
      drawRidge(near, CYAN, 'rgba(8,6,30,.85)', 3, t, 0);
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // 星空 + 交叉光射线（镜头炫光）+ 偶尔划过的流星
  function synthStars(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
    var count = Math.round(opts.count || 60);
    var start = Date.now(), raf;
    // 预生成星星（确定性）
    var stars = [];
    for (var i = 0; i < count; i++) {
      stars.push({ x: rnd(i * 3 + 1) * W, y: rnd(i * 5 + 2) * H * 0.62,
                   r: 0.8 + rnd(i * 7 + 3) * 2.2, ph: rnd(i * 11 + 4) * TAU });
    }
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = (Date.now() - start) / 1000;
      // 星星闪烁
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        var a = 0.35 + 0.5 * (0.5 + 0.5 * Math.sin(t * 2 + s.ph));
        ctx.globalAlpha = a; ctx.fillStyle = i % 5 === 0 ? CYAN : '#fff';
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
      // 顶部交叉光射线（复古镜头炫光）
      var flX = W * 0.5, flY = H * 0.14;
      ctx.save(); ctx.translate(flX, flY); ctx.globalAlpha = 0.12;
      for (var k = 0; k < 8; k++) {
        ctx.rotate(TAU / 8);
        ctx.fillStyle = k % 2 ? PINK : CYAN;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-W * 0.02, -H * 0.5); ctx.lineTo(W * 0.02, -H * 0.5); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
      // 流星：周期性从右上划向左下
      var cyc = t % 5;
      if (cyc < 1.2) {
        var p = cyc / 1.2;
        var mx = W * (0.85 - 0.5 * p), my = H * (0.08 + 0.34 * p);
        var grd = ctx.createLinearGradient(mx, my, mx + W * 0.14, my - H * 0.1);
        grd.addColorStop(0, 'rgba(255,255,255,.95)'); grd.addColorStop(1, 'rgba(0,229,255,0)');
        ctx.strokeStyle = grd; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx + W * 0.14, my - H * 0.1); ctx.stroke();
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  var V = global.VISUALS || (global.VISUALS = {});
  V.synthSun = synthSun;
  V.synthGrid = synthGrid;
  V.synthPalms = synthPalms;
  V.synthMountains = synthMountains;
  V.synthStars = synthStars;
})(window);
