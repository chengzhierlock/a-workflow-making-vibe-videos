#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
lib_html.py — 把结构化内容 + 语音时间轴渲染成动态 HTML

版式类型：cover / content / timeline / stat / end
功能：逐句字幕条（跟语音同步）、页内进度、粒子装饰、平滑转场
      Canvas 视觉动画（在文字下层）、真实图片背景（带暗色遮罩）、每页主题配色
"""
import json
import os
import base64

ASSETS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets")

CSS = r"""
*{box-sizing:border-box;margin:0;padding:0}
:root{--cyan:#00d4ff;--purple:#b026ff;--blue:#5a8cff;--bg0:#06091c;--bg1:#1a1040;--ink:#f2f8ff}
html,body{height:100%;background:#05070f;overflow:hidden;font-family:"Microsoft YaHei","PingFang SC",sans-serif}
.stage{height:100vh;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 40%,#0d1230,#04060e 70%)}
.screen{position:relative;height:100vh;aspect-ratio:9/16;max-width:100vw;overflow:hidden;background:linear-gradient(160deg,var(--bg1),var(--bg0) 65%);color:var(--ink);transition:background .6s}
.screen::before{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:44px 44px;-webkit-mask-image:radial-gradient(circle at 50% 45%,#000,transparent 75%);mask-image:radial-gradient(circle at 50% 45%,#000,transparent 75%);z-index:1}
/* 真实图片背景：最底层，自带暗色渐变遮罩保证文字可读 */
.photo{position:absolute;inset:0;z-index:0;background-size:cover;background-position:center;opacity:0;transition:opacity .6s;transform:scale(1.02)}
.photo::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,8,20,.55) 0%,rgba(5,8,20,.7) 42%,rgba(5,8,20,.9) 100%)}
.photo.on{opacity:.92}
.glow{position:absolute;border-radius:50%;filter:blur(70px);opacity:.4;pointer-events:none;z-index:1}
.g1{width:60%;height:30%;background:var(--purple);top:-8%;left:-10%}
.g2{width:55%;height:28%;background:var(--cyan);bottom:-6%;right:-12%}
.dot{position:absolute;width:3px;height:3px;border-radius:50%;background:var(--cyan);opacity:.5;box-shadow:0 0 8px var(--cyan);z-index:1}
.hd{position:absolute;top:4%;left:6%;right:6%;display:flex;align-items:center;gap:10px;z-index:3}
.logo{width:34px;height:34px;border:2px solid var(--cyan);border-radius:50%;position:relative;box-shadow:0 0 18px rgba(0,212,255,.5)}
.logo::after{content:"";position:absolute;inset:7px;border:2px solid var(--purple);border-radius:50%;transform:rotate(45deg)}
.hd .name{font-size:20px;font-weight:800;letter-spacing:2px}
.hd .tag{margin-left:auto;font-size:12px;color:#dbe6f5;border:1px solid rgba(255,255,255,.35);background:rgba(0,0,0,.25);padding:4px 10px;border-radius:20px}
.slide{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:flex-start;padding:16% 7% 0;z-index:2;opacity:0;transform:scale(.985);transition:opacity .45s,transform .45s}
.slide.on{opacity:1;transform:none}
.eyebrow,.big,.sub,.follow,.item,.tl-item,.stat{opacity:0}
.slide.on .eyebrow{animation:rise .6s .05s cubic-bezier(.2,.8,.2,1) forwards}
.slide.on .big{animation:rise .7s .15s cubic-bezier(.2,.8,.2,1) forwards}
.slide.on .sub{animation:rise .7s .4s cubic-bezier(.2,.8,.2,1) forwards}
.slide.on .follow{animation:rise .7s .7s cubic-bezier(.2,.8,.2,1) forwards}
.slide.on .item,.slide.on .tl-item,.slide.on .stat{animation:rise .65s cubic-bezier(.2,.8,.2,1) forwards}
@keyframes rise{from{opacity:0;transform:translateY(34px)}to{opacity:1;transform:none}}
.eyebrow{color:var(--cyan);font-size:17px;letter-spacing:3px;margin-bottom:14px;font-weight:700;text-shadow:0 2px 10px rgba(0,0,0,.6)}
/* 静态标题压缩为页眉，给中部大字让出空间 */
.big{font-size:48px;line-height:1.16;font-weight:900;letter-spacing:1px;text-shadow:0 6px 30px rgba(0,0,0,.7),0 2px 8px rgba(0,0,0,.5)}
.big em{font-style:normal;background:linear-gradient(90deg,var(--cyan),var(--purple));-webkit-background-clip:text;background-clip:text;color:transparent}
.sub{margin-top:16px;font-size:19px;color:#d3e0f2;line-height:1.5;text-shadow:0 2px 12px rgba(0,0,0,.7)}
.items{margin-top:22px;display:flex;flex-direction:column;gap:12px}
.item{display:flex;gap:16px;align-items:flex-start;background:rgba(8,12,28,.5);backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,.14);border-left:4px solid var(--cyan);border-radius:14px;padding:14px 18px}
.item .n{font-size:22px;font-weight:900;color:var(--cyan);min-width:32px}
.item h3{font-size:23px;margin-bottom:5px;line-height:1.25;color:#fff}
.item p{font-size:16px;color:#cfdcf0;line-height:1.5}
.tl{position:relative;margin-top:22px;padding-left:28px}
.tl::before{content:"";position:absolute;left:7px;top:10px;bottom:10px;width:3px;background:linear-gradient(var(--cyan),var(--purple))}
.tl-item{position:relative;margin-bottom:18px}
.tl-item::before{content:"";position:absolute;left:-25px;top:7px;width:13px;height:13px;border-radius:50%;background:var(--bg0);border:3px solid var(--cyan);box-shadow:0 0 12px var(--cyan)}
.tl-date{font-size:17px;color:var(--cyan);font-weight:800;letter-spacing:1px}
.tl-text{font-size:20px;color:#fff;margin-top:4px;line-height:1.5;text-shadow:0 2px 8px rgba(0,0,0,.5)}
.stats{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:24px}
.stat{background:rgba(8,12,28,.5);backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,.14);border-radius:16px;padding:20px 18px}
.stat .num{font-size:44px;font-weight:900;line-height:1;background:linear-gradient(90deg,var(--cyan),var(--purple));-webkit-background-clip:text;background-clip:text;color:transparent}
.stat .lbl{font-size:16px;color:#cfdcf0;margin-top:10px;line-height:1.45}
.end .big{font-size:56px}
.follow{margin-top:24px;display:inline-flex;align-items:center;gap:12px;font-size:21px;color:#04121a;background:linear-gradient(90deg,var(--cyan),var(--blue));padding:15px 28px;border-radius:44px;font-weight:800;box-shadow:0 10px 40px rgba(0,0,0,.35)}
/* ===== 动态大字字幕：占据画面中部 34%-86%，大小错落、逐块弹出 ===== */
.caption{position:absolute;left:7%;right:7%;top:34%;bottom:14%;z-index:5;display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:6px 18px;align-content:center;pointer-events:none}
.kin{opacity:0;line-height:1.14;font-weight:900;letter-spacing:2px;text-align:center;color:#fff;text-shadow:0 4px 28px rgba(0,0,0,.9),0 0 50px rgba(0,0,0,.7);transform:translateY(30px) scale(.9);transition:none}
.kin.on{animation:kinPop .42s cubic-bezier(.16,1.1,.3,1) forwards}
.kin.hl{background:linear-gradient(100deg,var(--cyan),var(--purple));-webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:0 4px 30px rgba(0,0,0,.55)}
.kin.sm{opacity:.9;font-weight:700;letter-spacing:1px;color:#e8f1ff}
@keyframes kinPop{0%{opacity:0;transform:translateY(34px) scale(.82)}60%{opacity:1;transform:translateY(-4px) scale(1.04)}100%{opacity:1;transform:translateY(0) scale(1)}}
.ft{position:absolute;left:6%;right:6%;bottom:4%;z-index:4}
.bar{height:4px;background:rgba(255,255,255,.2);border-radius:4px;overflow:hidden}
.bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--cyan),var(--purple))}
.bar i.run{animation:grow linear forwards}
@keyframes grow{to{width:100%}}
.meta{display:flex;justify-content:space-between;margin-top:10px;font-size:12px;color:#dbe6f5;letter-spacing:1px;text-shadow:0 1px 6px rgba(0,0,0,.8)}
.hint{position:absolute;bottom:1.2%;left:0;right:0;text-align:center;font-size:11px;color:#c9d6ea;z-index:6;transition:opacity 1s;text-shadow:0 1px 6px rgba(0,0,0,.8)}
/* 视觉动画画布层：位于图片和文字之间，不遮挡内容 */
.vfx{position:absolute;inset:0;z-index:1;pointer-events:none;opacity:0;transition:opacity .5s}
.vfx.on{opacity:1}
.vfx canvas{width:100%;height:100%;display:block}
"""

JS = r"""
const DATA = __DATA__;
const THEMES = {
  ice:    {c:'#00d4ff', p:'#4d7cff', b:'#5a8cff', bg0:'#061422', bg1:'#0c2540'},
  sunset: {c:'#ff8a4c', p:'#ffb84d', b:'#ff6b6b', bg0:'#2a1008', bg1:'#4a2010'},
  violet: {c:'#b07cff', p:'#ff6ec7', b:'#7c6bff', bg0:'#180b2e', bg1:'#2d1550'},
  amber:  {c:'#ffc94d', p:'#ff9e3d', b:'#ffd77a', bg0:'#2a1f08', bg1:'#4a3410'},
  vine:   {c:'#00e5a8', p:'#7ee06a', b:'#4ad6c0', bg0:'#06221b', bg1:'#0d3a2c'},
  rose:   {c:'#ff5fa2', p:'#c864ff', b:'#ff8cc4', bg0:'#280a1c', bg1:'#481436'},
  steel:  {c:'#7dd3fc', p:'#a5b4fc', b:'#60a5fa', bg0:'#0a1622', bg1:'#1a2c44'}
};
const account = DATA.account || '内容便利店';
const tagText = DATA.tag || '自动放映';
const box=document.getElementById('slides'),bar=document.getElementById('bar'),cnt=document.getElementById('cnt'),capBox=document.getElementById('caption'),vfxBox=document.getElementById('vfx'),photoBox=document.getElementById('photo'),scr=document.querySelector('.screen');
let idx=0,timer=null,capTimers=[],paused=false,remain=0,startAt=0,cleanupVfx=null,vfxStartAt=0;
function fmt(t){return String(t).replace(/<>(.*?)<\/>/g,'<em>$1</em>');}
function nl(t){return String(t).replace(/\\n/g,'<br>');}
function applyTheme(name){
  const th=THEMES[name]||THEMES.ice;
  scr.style.setProperty('--cyan',th.c);
  scr.style.setProperty('--purple',th.p);
  scr.style.setProperty('--blue',th.b);
  scr.style.setProperty('--bg0',th.bg0);
  scr.style.setProperty('--bg1',th.bg1);
}
function applyPhoto(src){
  if(src){photoBox.style.backgroundImage="url('"+src+"')";photoBox.classList.add('on');}
  else{photoBox.style.backgroundImage='';photoBox.classList.remove('on');}
}
function tpl(s){
  if(s.type==='cover'||s.type==='end'){
    return '<div class="slide '+(s.type==='end'?'end':'')+'"><div class="eyebrow">'+(s.eyebrow||'')+'</div><div class="big">'+fmt(s.title)+'</div><div class="sub">'+(s.sub||'')+'</div>'+(s.type==='end'?'<div class="follow">＋ 关注 · 不错过每一页</div>':'')+'</div>';
  }
  if(s.type==='timeline'){
    const items=(s.items||[]).map((it,i)=>'<div class="tl-item" style="animation-delay:'+(0.3+i*0.22)+'s"><div class="tl-date">'+it.d+'</div><div class="tl-text">'+it.t+'</div></div>').join('');
    return '<div class="slide"><div class="eyebrow">'+(s.eyebrow||'')+'</div><div class="big">'+fmt(s.title)+'</div><div class="tl">'+items+'</div></div>';
  }
  if(s.type==='stat'){
    const items=(s.items||[]).map((it,i)=>'<div class="stat" style="animation-delay:'+(0.3+i*0.16)+'s"><div class="num">'+it.n+'</div><div class="lbl">'+nl(it.l)+'</div></div>').join('');
    return '<div class="slide"><div class="eyebrow">'+(s.eyebrow||'')+'</div><div class="big">'+fmt(s.title)+'</div><div class="stats">'+items+'</div></div>';
  }
  const items=(s.items||[]).map((it,i)=>'<div class="item" style="animation-delay:'+(0.3+i*0.2)+'s"><div class="n">0'+(i+1)+'</div><div><h3>'+it.h+'</h3><p>'+it.p+'</p></div></div>').join('');
  return '<div class="slide"><div class="eyebrow">'+(s.eyebrow||'')+'</div><div class="big">'+fmt(s.title)+'</div><div class="items">'+items+'</div></div>';
}
function clearCaps(){capTimers.forEach(clearTimeout);capTimers=[];capBox.innerHTML='';}
/* 把一句话切成错落的大字块：先按标点切，再对长块二次切分 */
function splitKin(text){
  const byPunc=String(text).split(/[，。！？、；：,.!?;:—～\s]+/).map(s=>s.trim()).filter(s=>s.length>0);
  const out=[];
  byPunc.forEach(seg=>{
    // 长句按 4-6 字切成短块，保证错落节奏
    if(seg.length>7){
      let cur='';
      for(const ch of seg){
        cur+=ch;
        if(cur.length>=5){out.push(cur);cur='';}
      }
      if(cur)out.push(cur);
    } else if(seg.length){
      out.push(seg);
    }
  });
  return out;
}
function setupCaps(s){
  clearCaps();
  const list=s.sentences||[];
  list.forEach((sent,i)=>{
    const t=setTimeout(()=>{
      let chunks=splitKin(sent.text);
      if(!chunks.length){capBox.innerHTML='';return;}
      // 限制块数不超过7，超出则合并尾部，避免刷屏
      if(chunks.length>7){chunks=chunks.slice(0,6).concat([chunks.slice(6).join('')]);}
      // 含数字/英文的块做主题色高亮，否则高亮最长块
      let hi=-1, longest=0;
      chunks.forEach((c,k)=>{
        if(/[0-9A-Za-z]/.test(c)&&hi<0)hi=k;
        if(c.length>chunks[longest].length)longest=k;
      });
      if(hi<0)hi=longest;
      // 字号节奏：大小交替制造错落（大字76-88，小字48-56）
      const sizes=[86,52,78,54,84,50,72];
      capBox.innerHTML=chunks.map((c,k)=>{
        const sz=sizes[k%sizes.length];
        const cls='kin'+(k===hi?' hl':'')+(sz<=56?' sm':'');
        const delay=(k*0.10).toFixed(2);
        return '<span class="'+cls+'" style="font-size:'+sz+'px;animation-delay:'+delay+'s">'+c+'</span>';
      }).join('');
      requestAnimationFrame(()=>{capBox.querySelectorAll('.kin').forEach(el=>el.classList.add('on'));});
    }, Math.max(0,(sent.start||0)*1000));
    capTimers.push(t);
  });
}
/* ---- 视觉动画生命周期 ---- */
function stopVfx(){
  if(cleanupVfx){try{cleanupVfx();}catch(e){}cleanupVfx=null;}
  vfxBox.innerHTML='';vfxBox.classList.remove('on');
}
function startVfx(s){
  stopVfx();
  const v=s&&s.visual;
  if(!v||!v.name||!globalThis.VISUALS||!VISUALS[v.name]){
    vfxStartAt=Date.now();return;
  }
  const canvas=document.createElement('canvas');
  canvas.width=1080;canvas.height=1920;
  vfxBox.appendChild(canvas);
  const progress=()=>Math.min(1,(Date.now()-vfxStartAt)/(s.duration||1000));
  vfxStartAt=Date.now();
  try{cleanupVfx=VISUALS[v.name](canvas,v.opts||{},progress)||null;}catch(e){cleanupVfx=null;}
  requestAnimationFrame(()=>vfxBox.classList.add('on'));
}
function show(i){
  idx=(i+DATA.slides.length)%DATA.slides.length;
  const s=DATA.slides[idx];
  applyTheme(s.theme);
  applyPhoto(s.image);
  box.innerHTML=tpl(s);
  requestAnimationFrame(()=>box.firstChild.classList.add('on'));
  cnt.textContent=String(idx+1).padStart(2,'0')+' / '+String(DATA.slides.length).padStart(2,'0');
  bar.classList.remove('run');void bar.offsetWidth;
  bar.style.animationDuration=(s.duration/1000)+'s';bar.classList.add('run');
  setupCaps(s);
  startVfx(s);
  remain=s.duration;startAt=Date.now();clearTimeout(timer);
  if(!paused)timer=setTimeout(()=>show(idx+1),s.duration);
}
function pause(){if(paused)return;paused=true;clearTimeout(timer);capTimers.forEach(t=>clearTimeout(t));remain-=Date.now()-startAt;bar.style.animationPlayState='paused';}
function resume(){if(!paused)return;paused=false;bar.style.animationPlayState='running';timer=setTimeout(()=>show(idx+1),Math.max(200,remain));startAt=Date.now();}
document.addEventListener('keydown',e=>{
  if(e.code==='Space'){e.preventDefault();paused?resume():pause();}
  if(e.key==='r'||e.key==='R'){paused=false;show(0);}
});
window.addEventListener('load',()=>{
  document.querySelector('.name').textContent=account;
  document.querySelector('.hd .tag').textContent=tagText;
  const dots=document.createElement('div');
  for(let i=0;i<14;i++){const d=document.createElement('i');d.className='dot';d.style.left=(6+Math.random()*88)+'%';d.style.top=(8+Math.random()*80)+'%';d.style.animation='rise 3s '+(Math.random()*2)+'s infinite alternate';dots.appendChild(d);}
  document.querySelector('.screen').appendChild(dots);
  show(0);
  setTimeout(()=>{document.getElementById('hint').style.opacity=0;},4000);
});
"""


def _load_visuals() -> str:
    """读取视觉组件库源码；不存在时返回空串（降级为无动画，不影响出片）。"""
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "visuals.js")
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    return ""


def _load_style(style_name: str):
    """加载风格分支皮肤：返回 (style_css, style_visuals_js)。

    约定目录结构 styles/<style_name>/{style.css, visuals.js, meta.json}。
    未指定或目录不存在时返回 ('','')，行为与默认风格完全一致。
    新增风格 = 建一个这样的文件夹 + content 顶层填 "style": "<名字>"。
    """
    if not style_name:
        return "", ""
    root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "styles", style_name)
    css, vjs = "", ""
    css_path = os.path.join(root, "style.css")
    if os.path.exists(css_path):
        with open(css_path, "r", encoding="utf-8") as f:
            css = f.read()
    vjs_path = os.path.join(root, "visuals.js")
    if os.path.exists(vjs_path):
        with open(vjs_path, "r", encoding="utf-8") as f:
            vjs = f.read()
    return css, vjs


def _img_uri(name: str) -> str:
    """把 assets 目录下的图片转成 base64 data URI（自包含，不依赖相对路径）。"""
    if not name:
        return ""
    path = os.path.join(ASSETS_DIR, name)
    if not os.path.exists(path):
        return ""
    with open(path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("ascii")
    return "data:image/jpeg;base64," + b64


def render_html(content: dict, slides: list, total_ms: int) -> str:
    # 深拷贝 slide 并把图片名替换为 data URI，不改动调用方数据
    out_slides = []
    for s in slides:
        d = dict(s)
        if d.get("image"):
            d["image"] = _img_uri(d["image"])
        out_slides.append(d)
    data = {
        "account": content.get("account", "内容便利店"),
        "tag": content.get("tag", "自动放映"),
        "slides": out_slides,
    }
    payload = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    js = JS.replace("__DATA__", payload)
    visual_js = _load_visuals()
    # 风格分支：追加皮肤 CSS（覆盖默认）+ 风格专属动画组件（追加注册）
    style_css, style_visuals = _load_style(content.get("style", ""))
    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{content.get('title','内容便利店')}</title>
<style>{CSS}
{style_css}</style>
</head>
<body>
<div class="stage"><div class="screen">
  <div class="photo" id="photo"></div>
  <div class="glow g1"></div><div class="glow g2"></div>
  <div class="hd"><div class="logo"></div><div class="name">内容便利店</div><div class="tag">自动放映</div></div>
  <div class="vfx" id="vfx"></div>
  <div id="slides"></div>
  <div class="caption" id="caption"></div>
  <div class="ft"><div class="bar"><i id="bar"></i></div><div class="meta"><span id="cnt">01 / 0{len(slides)}</span><span>{content.get('account','内容便利店')} · 每天一页</span></div></div>
  <div class="hint" id="hint">空格 暂停/继续 · R 重播 · F11 全屏录制</div>
</div></div>
<script>{visual_js}</script>
<script>{style_visuals}</script>
<script>{js}</script>
</body>
</html>
"""


if __name__ == "__main__":
    import sys
    with open(sys.argv[1], "r", encoding="utf-8") as f:
        c = json.load(f)
    with open(sys.argv[2], "r", encoding="utf-8") as f:
        s = json.load(f)
    html = render_html(c, s, int(sys.argv[3]))
    with open(sys.argv[4], "w", encoding="utf-8") as f:
        f.write(html)
    print("HTML", sys.argv[4], len(html))
