/*
 * 像素风 · 专属视觉组件 (8-bit pixel art / retro game)
 * ---------------------------------------------------------------
 * 追加到主 VISUALS 库之后加载，注册像素风专属组件。
 * 核心手法：有限调色板 + 方块像素 + 点阵精灵 + 硬边无抗锯齿 +
 *   逐帧跳动。强调「红白机 / 街机厅 / 复古游戏」怀旧像素感。
 * 与 synthwave(渐变霓虹) / cyber(仪表HUD) 区分：一切由方块像素格构成。
 *
 * 组件：
 *   pixelGrid   - 像素棋盘格地面 + 8-bit 底纹块（街机底纹）
 *   pixelSprite - 点阵精灵阵列：星星/爱心/蘑菇/金币逐帧弹出（游戏道具）
 *   pixelBars   - 8-bit 像素血条/能量槽 + 数值跳动（游戏HUD/数据）
 *   pixelRain   - 像素方块雨/掉落方块逐格下落（俄罗斯方块感）
 *   pixelScene  - 像素平台跳跃关卡：地面块+砖块+问号块+云+旗杆（游戏场景）
 *
 * 所有随机走确定性 rnd(i)，保证 seek 抓帧跨 worker 一致。
 * 一切绘制对齐整数像素格(PX)，关闭 imageSmoothing，动画基于 Date.now()（虚拟时钟），
 * 起始态即可读，不用 opacity:0 / 大 scale，避免 seek 抓帧固化脏帧。
 */
(function (global) {
  'use strict';
  function rnd(i) { var x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  // 有限调色板（NES/FC 感）
  var RED = '#e84242', YEL = '#ffd23f', CYA = '#3fd2e8', GRN = '#4ec94e',
      WHITE = '#f8f8f8', NAVY = '#151230', BRN = '#a85c2a', PUR = '#6a5ab5';
  var PAL = [RED, YEL, CYA, GRN, PUR];

  function setup(canvas) {
    var ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    return ctx;
  }
  // 像素方块绘制（对齐整数格）
  function px(ctx, x, y, w, h, col) {
    ctx.fillStyle = col;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  // 像素棋盘格地面 + 8-bit 底纹块，缓慢向上滚动
  function pixelGrid(canvas, opts, progress) {
    opts = opts || {};
    var ctx = setup(canvas), W = canvas.width, H = canvas.height;
    var cell = Math.round(opts.cell || 48);
    var start = Date.now(), raf;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = (Date.now() - start) / 1000;
      var off = Math.floor(t * 26) % (cell * 2);
      // 棋盘格方块，明灭两种紫
      for (var gy = -1; gy * cell < H + cell; gy++) {
        for (var gx = 0; gx * cell < W; gx++) {
          var on = (gx + gy) % 2 === 0;
          var y = gy * cell - off;
          px(ctx, gx * cell, y, cell - 3, cell - 3, on ? '#241c50' : '#1c1642');
        }
      }
      // 稀疏 8-bit 亮块点缀（呼吸显隐）
      for (var k = 0; k < 24; k++) {
        var sd = k + 1;
        var bx = Math.floor(rnd(sd * 3) * (W / cell)) * cell;
        var by = (Math.floor(rnd(sd * 5) * (H / cell)) * cell - off + H) % H;
        var col = PAL[sd % PAL.length];
        var on2 = ((Math.floor(t * 2) + k) % 5) < 2;
        if (on2) px(ctx, bx, by, cell - 3, cell - 3, col);
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // 点阵精灵：用 0/1 矩阵画出星星/爱心/蘑菇/金币，逐个弹出+上下跳动
  function pixelSprite(canvas, opts, progress) {
    opts = opts || {};
    var ctx = setup(canvas), W = canvas.width, H = canvas.height;
    var count = Math.round(opts.count || 7);
    // 8x8 点阵图（1=前景）
    var SPRITES = {
      star: ['00011000','00011000','11111111','01111110','00111100','01111110','11000011','10000001'],
      heart:['01100110','11111111','11111111','11111111','01111110','00111100','00011000','00000000'],
      mushroom:['00111100','01111110','11111111','11111111','01100110','01100110','01100110','00111100'],
      coin: ['00111100','01111110','11011011','11011011','11011011','11011011','01111110','00111100'],
      alien:['00100100','00011000','00111100','01111110','11011011','11111111','10100101','00100100']
    };
    var kinds = ['star','heart','mushroom','coin','alien'];
    var colors = [YEL, RED, RED, YEL, GRN];
    var start = Date.now(), raf;
    function drawSprite(mat, col, cx, cy, pix) {
      for (var r = 0; r < 8; r++) {
        for (var c = 0; c < 8; c++) {
          if (mat[r][c] === '1') px(ctx, cx + c * pix, cy + r * pix, pix, pix, col);
        }
      }
    }
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = (Date.now() - start) / 1000;
      for (var k = 0; k < count; k++) {
        var sd = k + 1;
        var kind = kinds[k % kinds.length];
        var col = colors[k % colors.length];
        var gx = Math.floor(rnd(sd * 3) * 4);      // 4 列网格
        var gy = Math.floor(rnd(sd * 5) * 6);      // 6 行网格
        var cx = W * (0.14 + gx * 0.19);
        var cy = H * (0.14 + gy * 0.12) + Math.round(Math.sin(t * 2 + sd) * 10);
        var appear = Math.min(1, Math.max(0, t * 1.8 - k * 0.14));
        var pix = Math.round((14 + rnd(sd * 7) * 8) * (0.7 + 0.3 * appear));
        drawSprite(SPRITES[kind], col, cx, cy, pix);
        // 硬黑描边效果：在精灵外圈画一个深色底（先画底再画精灵，这里用偏移方块模拟）
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // 8-bit 像素血条/能量槽 + 数值跳动
  function pixelBars(canvas, opts, progress) {
    opts = opts || {};
    var ctx = setup(canvas), W = canvas.width, H = canvas.height;
    var values = opts.values || [0.8, 0.55, 0.92, 0.68];
    var start = Date.now(), raf;
    var seg = 20, gap = 8;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = (Date.now() - start) / 1000;
      var n = values.length;
      var barW = Math.min(W * 0.62, 640);
      var totalSeg = Math.floor(barW / (seg + gap));
      var x0 = W * 0.5 - barW / 2;
      var y0 = H * 0.3;
      for (var b = 0; b < n; b++) {
        var y = y0 + b * (seg + 46);
        var col = [GRN, CYA, YEL, RED][b % 4];
        // 条槽外框（硬边）
        ctx.strokeStyle = WHITE; ctx.lineWidth = 4;
        ctx.strokeRect(Math.round(x0) - 6, Math.round(y) - 6, Math.round(barW) + 12, seg + 12);
        // 逐格填充：末格随数值 + 轻微跳动
        var v = Math.max(0, Math.min(1, values[b] + 0.04 * Math.sin(t * 2 + b * 1.5)));
        var filled = Math.round(totalSeg * v);
        for (var s = 0; s < totalSeg; s++) {
          var sx = x0 + s * (seg + gap);
          px(ctx, sx, y, seg, seg, s < filled ? col : '#2a2450');
          // 高光格
          if (s < filled && s % 4 === 0) px(ctx, sx + 3, y + 3, seg - 6, 4, 'rgba(255,255,255,.45)');
        }
        // 标签方块（HP/MP 感）
        px(ctx, x0 - 6 - 92, y - 2, 84, seg + 4, [RED, CYA, YEL, PUR][b % 4]);
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // 像素方块雨/掉落方块，逐格下落（俄罗斯方块感）
  function pixelRain(canvas, opts, progress) {
    opts = opts || {};
    var ctx = setup(canvas), W = canvas.width, H = canvas.height;
    var count = Math.round(opts.count || 26);
    var start = Date.now(), raf;
    // 预生成每列的尺寸/颜色/速度（确定性）
    var drops = [];
    for (var i = 0; i < count; i++) {
      drops.push({
        x: Math.floor(rnd(i * 3 + 1) * 20) * (W / 20),
        size: Math.round(16 + rnd(i * 5 + 2) * 34),
        col: PAL[i % PAL.length],
        speed: 60 + rnd(i * 7 + 3) * 140,
        y0: rnd(i * 11 + 4) * H
      });
    }
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = (Date.now() - start) / 1000;
      for (var i = 0; i < drops.length; i++) {
        var d = drops[i];
        var y = (d.y0 + t * d.speed) % (H + 120) - 60;
        px(ctx, d.x, y, d.size, d.size, d.col);
        // 内嵌暗块，做出俄罗斯方块的方格分层
        px(ctx, d.x + d.size * 0.25, y + d.size * 0.25, d.size * 0.5, d.size * 0.5, 'rgba(0,0,0,.25)');
      }
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  // 像素平台跳跃关卡：地面块+砖块+问号块+云+旗杆（游戏场景）
  function pixelScene(canvas, opts, progress) {
    opts = opts || {};
    var ctx = setup(canvas), W = canvas.width, H = canvas.height;
    var start = Date.now(), raf;
    var G = 64; // 格子尺寸
    function brick(x, y, s, col, dark) {
      px(ctx, x, y, s, s, col);
      px(ctx, x, y + s * 0.5, s, 3, dark || 'rgba(0,0,0,.3)');
      px(ctx, x + s * 0.5, y, 3, s * 0.5, dark || 'rgba(0,0,0,.3)');
    }
    function cloud(cx, cy, scale) {
      var s = 18 * scale;
      px(ctx, cx, cy + s, s * 5, s * 2, WHITE);
      px(ctx, cx + s, cy, s * 3, s * 2, WHITE);
      px(ctx, cx + s * 5, cy + s * 0.5, s * 2, s * 1.5, WHITE);
    }
    function frame() {
      ctx.clearRect(0, 0, W, H);
      var t = (Date.now() - start) / 1000;
      // 像素云（缓慢漂移）
      cloud(((W * 0.15 + t * 14) % (W + 300)) - 200, H * 0.18, 1.4);
      cloud(((W * 0.65 + t * 10) % (W + 300)) - 200, H * 0.1, 1.0);
      // 地面块（两行）
      var groundY = Math.floor(H * 0.74 / G) * G;
      for (var x = 0; x < W; x += G) {
        px(ctx, x, groundY, G - 2, G - 2, BRN);
        px(ctx, x, groundY, G - 2, 10, GRN);          // 草地顶
        px(ctx, x + G * 0.5, groundY + G * 0.5, 6, 6, '#7a3d1a');
        px(ctx, x, groundY + G, G - 2, G - 2, '#8a4a20');
      }
      // 悬浮砖块平台
      var platY = groundY - G * 3;
      for (var b = 0; b < 4; b++) brick(W * 0.18 + b * G, platY, G, BRN);
      // 问号块（闪烁）
      var qx = W * 0.62, qy = platY - G;
      var blink = (Math.floor(t * 2) % 2) === 0;
      px(ctx, qx, qy, G, G, YEL);
      ctx.fillStyle = blink ? '#7a4a10' : RED;
      ctx.font = 'bold ' + Math.floor(G * 0.7) + 'px "Courier New",monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('?', qx + G / 2, qy + G / 2 + 3);
      // 旗杆
      var fx = W * 0.85, fy = groundY - G * 5;
      px(ctx, fx, fy, 8, G * 5, WHITE);
      px(ctx, fx + 8, fy, G * 1.2, G * 0.8, GRN);   // 旗
      px(ctx, fx, groundY - G * 5 - 14, 30, 14, YEL); // 杆顶球
      raf = requestAnimationFrame(frame);
    }
    frame();
    return function () { cancelAnimationFrame(raf); };
  }

  var V = global.VISUALS || (global.VISUALS = {});
  V.pixelGrid = pixelGrid;
  V.pixelSprite = pixelSprite;
  V.pixelBars = pixelBars;
  V.pixelRain = pixelRain;
  V.pixelScene = pixelScene;
})(window);
