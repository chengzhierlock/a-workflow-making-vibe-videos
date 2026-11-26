// capture_seek.js — 确定性帧级抓帧（替代实时播放抓帧）
// 原理：页面加载 ?render=1 进入确定性模式，逐帧调用 window.__seek(tMs) 把页面
//       还原到该时刻，再用 CDP captureScreenshot 直接出图。无需等待真实时间流逝。
// 支持多浏览器分片：--workers N 时按帧号取模分配，每个 worker 独立浏览器。
// 用法: node capture_seek.js <htmlPath> <frameDir> <totalMs> [--workers N]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// 进度日志：默认固定文件；可用 CAPTURE_LOG 覆盖，避免并发/残留句柄导致 EPERM 锁冲突
const LOG = process.env.CAPTURE_LOG || path.join(__dirname, '_capture_progress.log');
function plog(msg) {
  const line = '[' + new Date().toISOString() + '] ' + msg + '\n';
  try { fs.appendFileSync(LOG, line); } catch (e) {}
  console.log(msg);
}

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

(async () => {
  const args = process.argv.slice(2);
  const htmlPath = args[0];
  const frameDir = args[1];
  const totalMs = Number(args[2]);
  let workers = 6;
  const wi = args.indexOf('--workers');
  if (wi >= 0) workers = parseInt(args[wi + 1], 10) || 6;

  fs.writeFileSync(LOG, '');
  plog('START html=' + htmlPath + ' totalMs=' + totalMs + ' workers=' + workers);

  // 准备输出目录（不逐帧删除旧文件：本机删小文件极慢；用新目录名即可）
  if (!fs.existsSync(frameDir)) fs.mkdirSync(frameDir, { recursive: true });

  const fps = 30;
  const totalFrames = Math.round(totalMs / 1000 * fps);
  const url = 'file:///' + htmlPath.replace(/\\/g, '/') + (htmlPath.includes('?') ? '&' : '?') + 'render=1';

  const t0 = Date.now();

  // 连续分段：每个 worker 负责一段连续帧，避免取模交错导致每个 worker 都从头 seek。
  // 这样每个浏览器只需从本段起点追一次，之后每帧只 seek 增量 1 帧，大幅降低 tick 成本。
  async function runShard(shardId, shardCount) {
    const segSize = Math.ceil(totalFrames / shardCount);
    const start = shardId * segSize;
    const end = Math.min(totalFrames, start + segSize);

    const browser = await chromium.launch({
      executablePath: CHROME, headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage']
    });
    const ctx = await browser.newContext({ viewport: { width: 1080, height: 1920 } });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction('window.__ready === true', { timeout: 30000 });
    plog('shard ' + shardId + ' ready, range [' + start + ',' + end + ')');

    let done = 0;
    for (let i = start; i < end; i++) {
      const tMs = i * 1000 / fps;
      // fast 模式：O(1) seek；不 await 返回的 flush Promise，CDP 截图自带合成保证。
      await page.evaluate((t) => { window.__seek(t, true); }, tMs);
      const shot = await cdp.send('Page.captureScreenshot', {
        format: 'jpeg', quality: 92, captureBeyondViewport: false
      });
      fs.writeFileSync(path.join(frameDir, 'f' + String(i).padStart(5, '0') + '.jpg'),
        Buffer.from(shot.data, 'base64'));
      done++;
      if (done % 500 === 0) plog('shard ' + shardId + ' done ' + done);
    }
    await browser.close();
    plog('shard ' + shardId + ' finished, frames=' + done);
    return done;
  }

  const shards = [];
  for (let k = 0; k < workers; k++) shards.push(runShard(k, workers));
  const counts = await Promise.all(shards);
  const total = counts.reduce((a, b) => a + b, 0);

  // 完整性检查
  let missing = 0;
  for (let i = 0; i < totalFrames; i++) {
    if (!fs.existsSync(path.join(frameDir, 'f' + String(i).padStart(5, '0') + '.jpg'))) missing++;
  }
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  plog('DONE frames=' + total + '/' + totalFrames + ' missing=' + missing + ' elapsed=' + secs + 's');
  if (missing > 0) process.exit(2);
  process.exit(0);
})().catch(e => { plog('ERROR ' + e.stack); process.exit(1); });
