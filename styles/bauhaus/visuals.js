/*
 * 包豪斯风格 · 专属视觉组件 (bauhaus / geometric constructivism)
 * ---------------------------------------------------------------
 * 追加到主 VISUALS 库之后加载，注册包豪斯专属组件。
 * 核心手法：红黄蓝三原色 + 黑粗线 + 基本几何形(圆/方/三角) + 网格对齐 +
 * 同心圆/半圆构成 + 无衬线大字排版。强调「严谨、秩序、功能主义」的几何构成感。
 * 与扁平矢量区分：这里全是直角硬边、三原色克制配色、网格对齐，不做圆角插画。
 *
 * 组件：
 *   bauhausGrid   - 网格构成底纹 + 三原色色块（秩序/底纹）
 *   bauhausShapes - 圆/方/三角原色几何构成，逐个就位（基本形）
 *   bauhausBars   - 粗细不一的原色竖条/柱图（数据/节奏）
 *   bauhausCircle - 同心圆/半圆扇形构成（包豪斯经典眼睛）
 *   bauhausType   - 无衬线大号数字/字母排版漂浮（文字构成）
 */
(function (global) {
  'use strict';
  var TAU = Math.PI * 2;
  // 确定性伪随机：同一 index 永远同值，保证 seek 抓帧跨 worker 一致
  function rnd(i) { var x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  var RED = '#d62828', YELLOW = '#f4a300', BLUE = '#1d4e9c', INK = '#1a1a1a', PAPER = '#f4f1e6';
  var TRI = [RED, YELLOW, BLUE];

  // 网格构成底纹：黑色细网格 + 少量三原色方块点缀
  function bauhausGrid(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
    var cell = Math.round(opts.cell || (Math.min(W, H) * 0.11));
    var start = Date.now(), raf;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = (Date.now() - start) / 1000;
      // 网格线
      ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(26,26,26,.16)';
      for (var x = 0; x <= W; x += cell) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (var y = 0; y <= H; y += cell) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      // 三原色方块：缓慢呼吸显隐
      for (var gy = 0; gy * cell < H; gy++) {
        for (var gx = 0; gx * cell < W; gx++) {
          var h = (gx * 31 + gy * 17) % 23;
          if (h > 3) continue; // 稀疏点缀
          var sd = gx * 13 + gy * 7 + 1;
          var col = TRI[sd % 3];
          var a = 0.32 + 0.24 * Math.sin(t * 0.7 + sd);
          ctx.globalAlpha = Math.max(0.08, a);
          ctx.fillStyle = col;
          ctx.fillRect(gx * cell, gy * cell, cell, cell);
          ctx.globalAlpha = 1;
          // 粗黑边
          ctx.strokeStyle = 'rgba(26,26,26,.55)'; ctx.lineWidth = 2;
          ctx.strokeRect(gx * cell, gy * cell, cell, cell);
        }
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // 圆/方/三角原色几何构成：网格对齐，逐个就位
  function bauhausShapes(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
    var count = Math.round(opts.count || 6);
    var start = Date.now(), raf;
    function triPath(x, y, R, rot) {
      ctx.beginPath();
      for (var i = 0; i < 3; i++) {
        var a = rot - Math.PI / 2 + i * TAU / 3;
        var px = x + Math.cos(a) * R, py = y + Math.sin(a) * R;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
    }
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = (Date.now() - start) / 1000;
      var unit = Math.min(W, H) * 0.13;
      for (var k = 0; k < count; k++) {
        var sd = k + 1;
        var col = TRI[k % 3];
        // 网格化落点
        var gx = Math.round(rnd(sd * 3) * 5);
        var gy = Math.round(rnd(sd * 5) * 6);
        var x = W * (0.14 + gx * 0.145);
        var y = H * (0.16 + gy * 0.115);
        var R = unit * (0.8 + rnd(sd * 7) * 0.7);
        var shape = k % 3;
        // 逐个就位：缩放弹出（起始态可读的倍数，不做 opacity:0）
        var appear = Math.min(1, Math.max(0, t * 1.6 - k * 0.16));
        var sc = 0.6 + 0.4 * appear;
        ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
        ctx.fillStyle = col; ctx.strokeStyle = INK; ctx.lineWidth = 4;
        if (shape === 0) { ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill(); ctx.stroke(); }
        else if (shape === 1) { ctx.fillRect(-R, -R, R * 2, R * 2); ctx.strokeRect(-R, -R, R * 2, R * 2); }
        else { triPath(0, 0, R * 1.15, Math.PI / 6); ctx.fill(); ctx.stroke(); }
        ctx.restore();
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // 粗细不一的原色竖条：按数值生长，硬朗直角 + 黑边
  function bauhausBars(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
    var count = Math.round(opts.count || 7);
    var start = Date.now(), raf;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = (Date.now() - start) / 1000;
      var baseY = H * 0.82;
      var gap = W * 0.75 / count;
      var startX = W * 0.12;
      // 基线
      ctx.strokeStyle = INK; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(startX - 10, baseY); ctx.lineTo(startX + gap * count + 10, baseY); ctx.stroke();
      for (var k = 0; k < count; k++) {
        var sd = k + 1;
        var bw = gap * (0.45 + rnd(sd * 3) * 0.3);
        var targetH = H * (0.15 + rnd(sd * 5) * 0.4);
        var grow = Math.min(1, Math.max(0, t * 1.3 - k * 0.09));
        var bh = targetH * grow;
        var x = startX + k * gap + (gap - bw) / 2;
        ctx.fillStyle = TRI[k % 3];
        ctx.fillRect(x, baseY - bh, bw, bh);
        ctx.strokeStyle = INK; ctx.lineWidth = 3.5;
        ctx.strokeRect(x, baseY - bh, bw, bh);
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // 同心圆/半圆扇形构成：包豪斯经典眼睛图案，缓慢旋转
  function bauhausCircle(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
    var rings = Math.round(opts.rings || 4);
    var start = Date.now(), raf;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = (Date.now() - start) / 1000;
      var cx = W * 0.5, cy = H * 0.46;
      var R = Math.min(W, H) * 0.26;
      var rot = t * 0.25;
      // 由外到内的同心色环，用半圆扇形交错（眼睛图案）
      for (var i = 0; i < rings; i++) {
        var r = R * (1 - i / rings);
        var col = TRI[i % 3];
        var a0 = rot + i * 0.9;
        ctx.beginPath();
        ctx.arc(cx, cy, r, a0, a0 + Math.PI);
        ctx.lineTo(cx, cy); ctx.closePath();
        ctx.fillStyle = col; ctx.fill();
        ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
        // 另一半留白描边
        ctx.beginPath();
        ctx.arc(cx, cy, r, a0 + Math.PI, a0 + TAU);
        ctx.lineTo(cx, cy); ctx.closePath();
        ctx.fillStyle = PAPER; ctx.fill();
        ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
      }
      // 中心实心圆
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.08, 0, TAU);
      ctx.fillStyle = INK; ctx.fill();
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // 无衬线大号数字/字母排版漂浮：包豪斯重文字构成
  function bauhausType(canvas, opts, progress) {
    opts = opts || {};
    var ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
    var count = Math.round(opts.count || 4);
    var chars = opts.chars || ['A', 'B', '3', '6', '◐', '△'];
    var start = Date.now(), raf;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = (Date.now() - start) / 1000;
      for (var k = 0; k < count; k++) {
        var sd = k + 1;
        var x = W * (0.16 + rnd(sd * 3) * 0.68);
        var y = H * (0.2 + rnd(sd * 5) * 0.6) + Math.sin(t * 0.5 + sd) * 12;
        var sz = Math.min(W, H) * (0.14 + rnd(sd * 7) * 0.1);
        ctx.save(); ctx.translate(x, y); ctx.rotate((rnd(sd * 9) - 0.5) * 0.3);
        ctx.font = '900 ' + sz + 'px "Helvetica Neue",Arial,sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 6; ctx.strokeStyle = INK;
        ctx.strokeText(chars[k % chars.length], 0, 0);
        ctx.fillStyle = TRI[k % 3];
        ctx.fillText(chars[k % chars.length], 0, 0);
        ctx.restore();
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  var V = global.VISUALS || (global.VISUALS = {});
  V.bauhausGrid = bauhausGrid;
  V.bauhausShapes = bauhausShapes;
  V.bauhausBars = bauhausBars;
  V.bauhausCircle = bauhausCircle;
  V.bauhausType = bauhausType;
})(window);
