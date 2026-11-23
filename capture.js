// capture.js — 用 Chrome CDP 抓取 HTML 页面帧，按时间轴重采样为 30fps 序列
// 用法: node capture.js <htmlPath> <frameDir> <totalMs>
// 优化：抓帧时边抓边写临时文件，内存只存轻量元数据，避免长视频 OOM
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const LOG = path.join(__dirname, '_capture_progress.log');
function plog(msg) {
  const line = '[' + new Date().toISOString() + '] ' + msg + '\n';
  try { fs.appendFileSync(LOG, line); } catch (e) {}
  console.log(msg);
}
try { fs.writeFileSync(LOG, ''); } catch (e) {}

(async () => {
  const htmlPath = process.argv[2];
  const frameDir = process.argv[3];
  const totalMs = Number(process.argv[4]);
  const rawDir = frameDir + '_raw';
  plog('STEP 0 start. html=' + htmlPath + ' frameDir=' + frameDir + ' totalMs=' + totalMs);

  // 清理旧目录（输出到新目录，raw 用独立目录）
  if (fs.existsSync(frameDir)) {
    fs.readdirSync(frameDir).forEach(f => {
      try { fs.unlinkSync(path.join(frameDir, f)); } catch (e) {}
    });
  } else {
    fs.mkdirSync(frameDir, { recursive: true });
  }
  if (fs.existsSync(rawDir)) {
    fs.readdirSync(rawDir).forEach(f => {
      try { fs.unlinkSync(path.join(rawDir, f)); } catch (e) {}
    });
  } else {
    fs.mkdirSync(rawDir, { recursive: true });
  }

  plog('STEP 1 dirs cleaned, launching browser...');
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--no-sandbox']
  });
  const context = await browser.newContext({ viewport: { width: 1080, height: 1920 } });
  const page = await context.newPage();

  const session = await context.newCDPSession(page);
  // 内存只存 {file, ts}，base64 数据即时写盘
  const frames = [];
  let seq = 0;
  let writing = 0;
  session.on('Page.screencastFrame', (evt) => {
    const n = seq++;
    const file = path.join(rawDir, 'r' + String(n).padStart(6, '0') + '.jpg');
    writing++;
    fs.writeFile(file, Buffer.from(evt.data, 'base64'), (err) => {
      writing--;
      if (err) console.error('write err', err.message);
    });
    frames.push({
      file: file,
      ts: (evt.metadata && evt.metadata.timestamp) ? evt.metadata.timestamp : Date.now() / 1000
    });
    session.send('Page.screencastFrameAck', { sessionId: evt.sessionId }).catch(() => {});
  });

  plog('STEP 2 browser ready, goto page...');
  await page.goto('file:///' + htmlPath.replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 30000 });
  plog('STEP 3 page loaded, screencast start, capturing ' + (totalMs / 1000) + 's ...');
  await session.send('Page.startScreencast', {
    format: 'jpeg', quality: 92, everyNthFrame: 1
  });
  await page.waitForTimeout(totalMs + 400);
  plog('STEP 4 capture window done, raw frames=' + frames.length + ', stopping...');
  await session.send('Page.stopScreencast');
  await browser.close();

  // 等待所有异步写盘完成
  while (writing > 0) { await new Promise(r => setTimeout(r, 50)); }

  if (frames.length < 5) { console.error('ERROR too few frames: ' + frames.length); process.exit(2); }

  const fps = 30;
  const totalFrames = Math.round(totalMs / 1000 * fps);
  const startTs = frames[0].ts;
  let fi = 0;
  for (let i = 0; i < totalFrames; i++) {
    if (i % 1000 === 0) plog('  resample ' + i + '/' + totalFrames);
    const t = startTs + i / fps;
    while (fi < frames.length - 1 && frames[fi + 1].ts <= t) fi++;
    try {
      fs.copyFileSync(frames[fi].file, path.join(frameDir, 'f' + String(i).padStart(5, '0') + '.jpg'));
    } catch (e) {
      // 若该帧尚未写完，回退找前一帧
      let bk = fi;
      while (bk > 0) {
        bk--;
        try { fs.copyFileSync(frames[bk].file, path.join(frameDir, 'f' + String(i).padStart(5, '0') + '.jpg')); break; }
        catch (e2) {}
      }
    }
  }
  plog('FRAMES raw=' + frames.length + ' resampled=' + totalFrames);
  // 注意：不再逐个删除 raw 临时帧（本机删上万小文件极慢，会卡住进程）。
  // 重采样帧已写入 frameDir，raw 目录保留即可，下次用新目录名绕开。
  plog('DONE, raw dir kept at ' + rawDir);
  process.exit(0);
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
