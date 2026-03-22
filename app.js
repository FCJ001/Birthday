const FX = (() => {
  /** @type {HTMLCanvasElement} */
  const canvas = document.getElementById("fx");
  /** @type {CanvasRenderingContext2D} */
  const ctx = canvas.getContext("2d", { alpha: true });

  const dpr = () => Math.min(2, window.devicePixelRatio || 1);
  let w = 0;
  let h = 0;
  let time = 0;
  let running = true;

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  const isLowEnd = /Mobi|Android/i.test(navigator.userAgent) ||
    (window.screen && Math.min(window.screen.width, window.screen.height) < 500);
  const MAX_SPARKS = isLowEnd ? 400 : 800;
  const MAX_HEARTS = isLowEnd ? 150 : 300;

  const palette = {
    pink: [255, 77, 141],
    rose: [255, 122, 168],
    violet: [122, 107, 255],
    gold: [255, 210, 122],
    white: [243, 244, 255],
  };
  const paletteList = [palette.pink, palette.rose, palette.violet, palette.gold, palette.white];

  const ambientParticles = [];
  const sparks = [];
  const hearts = [];
  const roses = [];
  let roseRain = false;

  function resize() {
    w = Math.floor(window.innerWidth);
    h = Math.floor(window.innerHeight);
    const ratio = dpr();
    canvas.width = Math.floor(w * ratio);
    canvas.height = Math.floor(h * ratio);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function rgba(rgb, a) {
    return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
  }

  function spawnAmbient() {
    const count = Math.round(clamp(w / 36, 10, 24)); // 减少背景光点
    for (let i = 0; i < count; i++) {
      ambientParticles.push({
        x: rand(0, w),
        y: rand(0, h),
        vx: rand(-0.15, 0.15),
        vy: rand(-0.25, -0.05),
        r: rand(0.6, 1.8),
        a: rand(0.08, 0.18),
        rgb: paletteList[(Math.random() * paletteList.length) | 0],
      });
    }
  }

  function heartPoint(t) {
    // Classic heart curve (scaled later)
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y =
      13 * Math.cos(t) -
      5 * Math.cos(2 * t) -
      2 * Math.cos(3 * t) -
      Math.cos(4 * t);
    return { x, y };
  }

  function burstHeart(cx, cy, scale = 10) {
    if (hearts.length >= MAX_HEARTS) return;
    const n = isLowEnd
      ? (Math.random() < 0.5 ? 40 : 24)
      : (Math.random() < 0.5 ? 80 : 40);
    const rgb = paletteList[(Math.random() * 3) | 0]; // lean pink/rose/violet
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      const p = heartPoint(t);
      const angle = Math.atan2(-p.y, p.x);
      const speed = rand(1.5, 5.0); // 增加爱心扩散范围
      hearts.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed + rand(-0.25, 0.25),
        vy: Math.sin(angle) * speed + rand(-0.25, 0.25),
        r: rand(1.0, 2.2), // 粒子变小一点
        life: rand(40, 70), // 寿命稍微缩短
        age: 0,
        rgb,
        scale: scale * rand(0.55, 0.9),
        ox: p.x,
        oy: -p.y,
      });
    }
  }

  function burstFirework(cx, cy) {
    if (sparks.length >= MAX_SPARKS) return;
    const m = isLowEnd
      ? (Math.random() < 0.5 ? 70 : 35)
      : (Math.random() < 0.5 ? 150 : 60);
    const rgb = paletteList[(Math.random() * paletteList.length) | 0];
    for (let i = 0; i < m; i++) {
      const a = (i / m) * Math.PI * 2 + rand(-0.12, 0.12);
      const s = rand(2.8, 11.2); // 拉大爆炸半径，更有“烟花感”
      sparks.push({
        x: cx,
        y: cy,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        px: cx,
        py: cy,
        r: rand(1.8, 3.8), // 粒子更粗
        a: rand(0.82, 1.0), // 初始更亮
        rgb,
        life: rand(48, 86),
        age: 0,
        gravity: rand(0.028, 0.058),
      });
    }
  }

  function clear() {
    ctx.clearRect(0, 0, w, h);
  }

  function drawAmbient(p) {
    ctx.beginPath();
    ctx.fillStyle = rgba(p.rgb, p.a);
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawSpark(p) {
    ctx.strokeStyle = rgba(p.rgb, p.a * 0.45);
    ctx.lineWidth = Math.max(1, p.r * 0.55);
    ctx.beginPath();
    ctx.moveTo(p.px, p.py);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();

    if (!isLowEnd) {
      ctx.beginPath();
      ctx.fillStyle = rgba(p.rgb, p.a * 0.34);
      ctx.arc(p.x, p.y, p.r * 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.beginPath();
    ctx.fillStyle = rgba(p.rgb, Math.min(1, p.a));
    ctx.arc(p.x, p.y, isLowEnd ? p.r * 1.4 : p.r, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawHeart(hp) {
    const t = hp.age / hp.life;
    const fade = 1 - t;
    const x = hp.x + hp.ox * (hp.scale / 18);
    const y = hp.y + hp.oy * (hp.scale / 18);
    
    ctx.fillStyle = rgba(hp.rgb, 0.22 * fade);
    ctx.beginPath();
    ctx.arc(x, y, hp.r * 2.4, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = rgba(hp.rgb, 0.35 * fade);
    ctx.beginPath();
    ctx.arc(x, y, hp.r, 0, Math.PI * 2);
    ctx.fill();
  }

  function spawnRose() {
    // 玫瑰花雨：从屏幕上方随机生成
    if (!roseRain) return;
    if (Math.random() > 0.15) return; // 降低生成密度

    roses.push({
      x: rand(0, w),
      y: -50,
      vx: rand(-1, 1),
      vy: rand(1.5, 3.5),
      rotation: rand(0, Math.PI * 2),
      rotationSpeed: rand(-0.02, 0.02),
      scale: rand(0.6, 1.2),
      opacity: 0,
      life: rand(300, 600),
      age: 0
    });
  }

  function drawRose(r) {
    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.rotate(r.rotation);
    ctx.globalAlpha = Math.min(1, r.age / 40); // 淡入效果

    const size = Math.floor(r.scale * 30);
    ctx.font = `${size}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // 下落玫瑰：压暗 + 高饱和，和背景拉开层次
    ctx.filter = "saturate(1.55) contrast(1.2) brightness(0.68)";
    ctx.fillText("🌹", 0, 0);
    ctx.filter = "none";

    ctx.restore();
  }

  function tick() {
    if (!running) return;
    time++;

    clear();
    
    // 随机生成玫瑰
    spawnRose();

    // 1. Draw Ambient (source-over)
    ctx.globalCompositeOperation = "source-over";
    for (let i = ambientParticles.length - 1; i >= 0; i--) {
      const p = ambientParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      
      if (p.y < -20) p.y = h + 20;
      if (p.x < -20) p.x = w + 20;
      if (p.x > w + 20) p.x = -20;
      
      drawAmbient(p);
    }

    // 2. Draw Fireworks & Hearts (lighter)
    ctx.globalCompositeOperation = "lighter";
    
    // Sparks
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.px = p.x;
      p.py = p.y;
      p.x += p.vx;
      p.y += p.vy;
      p.age++;
      p.vy += p.gravity ?? 0;
      p.a *= 0.989;
      p.r *= 0.997;
      
      if (p.age >= p.life) {
        sparks[i] = sparks[sparks.length - 1];
        sparks.pop();
        continue;
      }
      
      drawSpark(p);
    }
    
    // Hearts
    for (let i = hearts.length - 1; i >= 0; i--) {
      const hp = hearts[i];
      hp.age++;
      hp.x += hp.vx;
      hp.y += hp.vy;
      hp.vx *= 0.985;
      hp.vy *= 0.985;
      
      if (hp.age >= hp.life) {
        hearts[i] = hearts[hearts.length - 1];
        hearts.pop();
        continue;
      }
      
      drawHeart(hp);
    }
    
    // 3. Draw Roses (source-over)
    ctx.globalCompositeOperation = "source-over";

    for (let i = roses.length - 1; i >= 0; i--) {
      const r = roses[i];
      r.age++;
      r.x += r.vx;
      r.y += r.vy;
      r.x += Math.sin(time * 0.02 + r.age * 0.01) * 0.5; // 左右摇摆
      r.rotation += r.rotationSpeed;

      if (r.age >= r.life || r.y > h + 50) {
        roses[i] = roses[roses.length - 1];
        roses.pop();
        continue;
      }

      drawRose(r);
    }

    // subtle vignette
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    const g = ctx.createRadialGradient(w * 0.5, h * 0.35, Math.min(w, h) * 0.25, w * 0.5, h * 0.45, Math.min(w, h) * 0.75);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.25)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    requestAnimationFrame(tick);
  }

  function start() {
    running = true;
    requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
  }

  function init() {
    resize();
    spawnAmbient();
    start();
    window.addEventListener("resize", resize, { passive: true });
  }

  function romanticBurst() {
    const cx = rand(w * 0.1, w * 0.9);
    const cy = rand(h * 0.15, h * 0.85);
    // 随机绽放 1-2 个心形
    burstHeart(cx, cy, rand(12, 20));
    if (Math.random() < 0.4) {
      burstHeart(rand(w * 0.1, w * 0.9), rand(h * 0.15, h * 0.85), rand(10, 16));
    }

    // 必定绽放 2-3 个烟花，确保可见
    burstFirework(rand(w * 0.1, w * 0.9), rand(h * 0.15, h * 0.85));
    burstFirework(rand(w * 0.1, w * 0.9), rand(h * 0.15, h * 0.85));
    if (Math.random() < 0.78) burstFirework(rand(w * 0.1, w * 0.9), rand(h * 0.15, h * 0.85));
  }

  function tapBurst(x, y) {
    burstHeart(x, y, rand(12, 22));
    burstFirework(x, y);
  }

  function startRoseRain() {
    roseRain = true;
  }

  function stopRoseRain() {
    roseRain = false;
  }

  return { init, stop, romanticBurst, tapBurst, startRoseRain, stopRoseRain };
})();

const App = (() => {
  const startOverlay = document.getElementById("startOverlay");
  const introCountdown = document.getElementById("introCountdown");
  const cdDots = Array.from(document.querySelectorAll(".cd-dot"));
  const goBtn = document.getElementById("goBtn");
  const muteBtn = document.getElementById("muteBtn");
  const bgm = document.getElementById("bgm");
  const lines = Array.from(document.querySelectorAll("[data-line]"));
  const proposalWrap = document.querySelector(".proposal-wrap");

  const cakeScene = document.getElementById("cakeScene");
  const blowCountdown = document.getElementById("blowCountdown");
  const countdownNum = document.getElementById("countdownNum");
  const replayBtn = document.getElementById("replayBtn");

  let started = false;
  let muted = false;
  let fireworksStopped = false;
  let revealTimer = null;
  let burstTimer = null;
  let photoTimer = null;
  let photosShown = 0;
  let animAppearanceCount = 0;

  /** 中文文件名需编码，避免部分环境加载失败 */
  function imageSrc(path) {
    const i = path.lastIndexOf("/");
    if (i < 0) return encodeURI(path);
    return path.slice(0, i + 1) + encodeURIComponent(path.slice(i + 1));
  }

  function getPhotoMaxEdge() {
    const vw = window.innerWidth || 1080;
    const vh = window.innerHeight || 1920;
    // 以屏幕长边约 1.8 倍作为上限，保证清晰同时减少解码/内存压力
    return Math.min(2200, Math.round(Math.max(vw, vh) * 1.8));
  }

  function getDisplayPhotoUrl(index) {
    const raw = photoUrls[index];
    return optimizedPhotoUrls.get(raw) || imageSrc(raw);
  }

  async function optimizePhoto(url) {
    const src = imageSrc(url);
    const img = new Image();
    img.decoding = "async";
    img.src = src;
    await img.decode();

    const w = img.naturalWidth || 0;
    const h = img.naturalHeight || 0;
    if (!w || !h) return src;

    const maxEdge = getPhotoMaxEdge();
    const longEdge = Math.max(w, h);
    if (longEdge <= maxEdge) return src;

    const scale = maxEdge / longEdge;
    const tw = Math.max(1, Math.round(w * scale));
    const th = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement("canvas");
    canvas.width = tw;
    canvas.height = th;
    const ctx = canvas.getContext("2d");
    if (!ctx) return src;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, tw, th);

    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.92);
    });
    if (!blob) return src;
    const objUrl = URL.createObjectURL(blob);
    generatedObjectUrls.push(objUrl);
    return objUrl;
  }

  // 新增图片排在最前，再接 1.jpg … 20.jpg
  const PHOTOS_FIRST = [
    "./assets/images/微信图片_20260321225952_183_177.jpg",
    "./assets/images/微信图片_20260321230042_184_177.jpg",
    "./assets/images/微信图片_20260321230125_185_177.jpg",
  ];
  const photoUrls = [
    ...PHOTOS_FIRST,
    ...Array.from({ length: 20 }, (_, i) => `./assets/images/${i + 1}.jpg`),
  ];
  const optimizedPhotoUrls = new Map();
  const generatedObjectUrls = [];
  let currentPhotoIndex = 0;
  const photoAlbum = document.getElementById("photoAlbum");
  const slide1 = document.getElementById("albumSlide1");
  const slide2 = document.getElementById("albumSlide2");
  const textElements = document.getElementById("textElements");

  function setMute(nextMuted) {
    muted = nextMuted;
    muteBtn.setAttribute("aria-pressed", String(muted));
    bgm.muted = muted;
    if (muted) {
      muteBtn.classList.remove("playing");
    } else if (!bgm.paused) {
      muteBtn.classList.add("playing");
    }
  }

  async function tryPlayBgm() {
    if (!bgm) return false;
    try {
      await bgm.play();
      if (!muted) muteBtn.classList.add("playing");
      return true;
    } catch {
      return false;
    }
  }

  function bindWeChatAudioFix() {
    document.addEventListener(
      "WeixinJSBridgeReady",
      () => {
        if (!muted) tryPlayBgm();
      },
      false
    );
  }

  function revealLines() {
    let i = 0;
    lines.forEach((el) => el.classList.remove("show"));
    clearInterval(revealTimer);
    revealTimer = window.setInterval(() => {
      const el = lines[i];
      if (el) el.classList.add("show");
      i++;
      if (i >= lines.length) {
        clearInterval(revealTimer);
        
        // 停止烟花
        fireworksStopped = true;
        clearInterval(burstTimer);
        burstTimer = null;
        
        // 文字全部显示完毕后，开始玫瑰花雨
        FX.startRoseRain();
        // 显示求婚动画
        if (proposalWrap) proposalWrap.classList.add("show");

        // 文字结束后稍作停留，再开始播放照片（缩短等待）
        setTimeout(() => {
          startPhotoSlideshow();
        }, 3200);
      }
    }, 2800); // 节奏放慢到 2.8 秒，更深情
  }

  function positionProposalBelowPhoto() {
    if (!proposalWrap || !photoAlbum || !proposalWrap.classList.contains("photo-mode")) return;
    const rect = photoAlbum.getBoundingClientRect();
    const vh = window.innerHeight;
    const pH = proposalWrap.getBoundingClientRect().height || 150;
    const top = Math.min(rect.bottom + 10, vh - pH - 8);
    proposalWrap.style.top = Math.round(top) + "px";
  }

  function getSceneForAppearance(count) {
    const totalSlots = Math.ceil(photoUrls.length / 2);
    const proposalSlots = Math.ceil(totalSlots / 3);
    const embraceSlots = Math.ceil((totalSlots - proposalSlots) / 2);
    if (count < proposalSlots) return "proposal";
    if (count < proposalSlots + embraceSlots) return "embrace";
    return "walk";
  }

  function replayProposalAnimation() {
    if (!proposalWrap) return;
    const scene = getSceneForAppearance(animAppearanceCount);
    proposalWrap.setAttribute("data-scene", scene);
    animAppearanceCount++;

    proposalWrap.style.transition = "none";
    proposalWrap.style.opacity = "1";
    proposalWrap.classList.remove("show");
    void proposalWrap.offsetWidth;
    proposalWrap.classList.add("show");
    requestAnimationFrame(() => {
      proposalWrap.style.transition = "";
      proposalWrap.style.opacity = "";
    });
  }

  function startPhotoSlideshow() {
    if (!photoAlbum || photoUrls.length === 0) return;

    // 隐去文字内容
    if (textElements) {
      textElements.classList.add("fade-out");
    }

    // 等待文字消失后，显示相册并开始轮播
    setTimeout(() => {
      photoAlbum.classList.add("show");
      
      // 第一张照片：保留底部求婚动画，隐藏顶部心跳
      photoAlbum.classList.add("hide-heartbeat");
      if (proposalWrap) {
        document.body.appendChild(proposalWrap);
        proposalWrap.classList.remove("hide");
        proposalWrap.classList.add("photo-mode");
        animAppearanceCount = 0;
        positionProposalBelowPhoto();
        replayProposalAnimation();
        window.addEventListener("resize", positionProposalBelowPhoto);
      }
      
      // 设置第一张图片
      slide1.style.backgroundImage = `url('${getDisplayPhotoUrl(currentPhotoIndex)}')`;

      let isSlide1Active = true;
      let isHeartbeatTurn = false;
      photosShown = 1;

      photoTimer = window.setInterval(() => {
        currentPhotoIndex++;
        photosShown++;

        if (currentPhotoIndex >= photoUrls.length) {
          clearInterval(photoTimer);
          photoTimer = null;
          showCakeScene();
          return;
        }

        const nextImageUrl = `url('${getDisplayPhotoUrl(currentPhotoIndex)}')`;

        if (isSlide1Active) {
          slide2.style.backgroundImage = nextImageUrl;
          slide2.classList.add("active");
          slide1.classList.remove("active");
        } else {
          slide1.style.backgroundImage = nextImageUrl;
          slide1.classList.add("active");
          slide2.classList.remove("active");
        }
        isSlide1Active = !isSlide1Active;

        isHeartbeatTurn = !isHeartbeatTurn;
        if (isHeartbeatTurn) {
          if (proposalWrap) proposalWrap.classList.add("hide");
          photoAlbum.classList.remove("hide-heartbeat");
          photoAlbum.classList.remove("show-heartbeat");
          void photoAlbum.offsetWidth;
          photoAlbum.classList.add("show-heartbeat");
        } else {
          photoAlbum.classList.remove("show-heartbeat");
          photoAlbum.classList.add("hide-heartbeat");
          if (proposalWrap) {
            proposalWrap.classList.remove("hide");
            replayProposalAnimation();
          }
        }

      }, 5000);
    }, 2000);
  }

  function showCakeScene() {
    // 淡出相册和求婚动画
    if (photoAlbum) {
      photoAlbum.style.transition = "opacity 2s ease-in-out";
      photoAlbum.style.opacity = "0";
    }
    if (proposalWrap) {
      proposalWrap.style.transition = "opacity 2s ease-in-out";
      proposalWrap.style.opacity = "0";
    }
    FX.stopRoseRain();

    setTimeout(() => {
      if (photoAlbum) photoAlbum.style.display = "none";
      if (proposalWrap) proposalWrap.style.display = "none";

      // 淡入蛋糕场景，停止烟花，安静等待吹蜡烛
      if (cakeScene) cakeScene.classList.add("show");
      clearInterval(burstTimer);
      burstTimer = null;

      // 蛋糕展示 5 秒后，开始吹蜡烛倒计时
      setTimeout(() => startBlowCountdown(), 5000);
    }, 2200);
  }

  function startBlowCountdown() {
    if (!blowCountdown || !countdownNum) return;
    blowCountdown.classList.add("show");
    let count = 5;
    countdownNum.textContent = count;

    const cdTimer = setInterval(() => {
      count--;
      if (count > 0) {
        countdownNum.textContent = count;
      } else {
        clearInterval(cdTimer);
        countdownNum.textContent = "🎂";
        blowCountdown.classList.remove("show");
        blowOutCandles();
      }
    }, 1000);
  }

  function blowOutCandles() {
    const flames = cakeScene.querySelectorAll(".flame");
    const candles = cakeScene.querySelectorAll(".candle");

    flames.forEach((flame, i) => {
      setTimeout(() => {
        flame.classList.add("out");
        // 加一缕烟
        const smoke = document.createElement("div");
        smoke.className = "smoke";
        candles[i].appendChild(smoke);
        requestAnimationFrame(() => smoke.classList.add("show"));
      }, i * 200);
    });

    // 全部熄灭后放庆祝烟花，再显示重播按钮
    const totalDelay = flames.length * 200 + 600;
    setTimeout(() => {
      FX.romanticBurst();
      setTimeout(() => FX.romanticBurst(), 300);
      setTimeout(() => FX.romanticBurst(), 600);
      setTimeout(() => FX.romanticBurst(), 1000);
      setTimeout(() => FX.romanticBurst(), 1800);

      burstTimer = window.setInterval(() => {
        FX.romanticBurst();
      }, 3000);
    }, totalDelay);

    setTimeout(() => {
      showReplayBtn();
    }, totalDelay + 4000);
  }

  function showReplayBtn() {
    if (!replayBtn) return;
    replayBtn.style.display = "";
    requestAnimationFrame(() => {
      requestAnimationFrame(() => replayBtn.classList.add("show"));
    });
  }

  function resetAll() {
    // 清除所有定时器
    clearInterval(revealTimer);
    clearInterval(burstTimer);
    clearInterval(photoTimer);
    revealTimer = null;
    burstTimer = null;
    photoTimer = null;

    // 重置状态
    started = false;
    fireworksStopped = false;
    photosShown = 0;
    currentPhotoIndex = 0;
    animAppearanceCount = 0;

    // 重置文字
    lines.forEach((el) => el.classList.remove("show"));
    if (textElements) {
      textElements.classList.remove("fade-out");
    }

    // 重置求婚动画（移回原始父容器）
    if (proposalWrap) {
      window.removeEventListener("resize", positionProposalBelowPhoto);
      proposalWrap.style.transition = "";
      proposalWrap.style.opacity = "";
      proposalWrap.style.display = "";
      proposalWrap.style.top = "";
      proposalWrap.classList.remove("show", "hide", "photo-mode");
      proposalWrap.setAttribute("data-scene", "proposal");
      const romanticContent = document.getElementById("textContent");
      if (romanticContent && proposalWrap.parentNode !== romanticContent) {
        romanticContent.appendChild(proposalWrap);
      }
    }

    // 重置相册
    if (photoAlbum) {
      photoAlbum.style.transition = "";
      photoAlbum.style.opacity = "";
      photoAlbum.style.display = "";
      photoAlbum.classList.remove("show", "show-heartbeat", "hide-heartbeat");
    }
    if (slide1) {
      slide1.style.backgroundImage = "";
      slide1.classList.add("active");
    }
    if (slide2) {
      slide2.style.backgroundImage = "";
      slide2.classList.remove("active");
    }

    // 重置蛋糕场景：立即隐藏，禁用渐变
    if (cakeScene) {
      cakeScene.style.transition = "none";
      cakeScene.classList.remove("show");
      cakeScene.offsetHeight; // 强制重绘使 transition:none 生效
      cakeScene.style.transition = "";
      cakeScene.querySelectorAll(".flame").forEach((f) => f.classList.remove("out"));
      cakeScene.querySelectorAll(".smoke").forEach((s) => s.remove());
    }

    // 隐藏倒计时和重播按钮
    if (blowCountdown) blowCountdown.classList.remove("show");
    if (replayBtn) {
      replayBtn.classList.remove("show");
      replayBtn.style.display = "none";
    }

    // 停止玫瑰雨
    FX.stopRoseRain();

    // 显示开始遮罩并重置倒计时
    if (startOverlay) startOverlay.classList.remove("hidden");
    if (introCountdown) {
      introCountdown.textContent = "5";
      introCountdown.classList.remove("go-text", "pop");
    }
    cdDots.forEach((d) => d.classList.remove("lit"));
    if (goBtn) {
      goBtn.style.display = "none";
      goBtn.classList.remove("show");
    }

    // 音乐回到开头
    muteBtn.classList.remove("playing");
    if (bgm) {
      bgm.currentTime = 0;
      bgm.pause();
    }
  }

  async function onReplay() {
    resetAll();
    await new Promise((r) => setTimeout(r, 600));
    runIntroCountdown();
  }

  function startRomance() {
    if (started) return;
    started = true;
    
    // 隐藏开始遮罩层
    if (startOverlay) startOverlay.classList.add("hidden");
    
    revealLines();

    // 持续放烟花，节奏加快
    burstTimer = window.setInterval(() => {
      FX.romanticBurst();
    }, 800);
    
    // 开场多放几个，大场面
    FX.romanticBurst();
    setTimeout(() => FX.romanticBurst(), 100);
    setTimeout(() => FX.romanticBurst(), 200);
    setTimeout(() => FX.romanticBurst(), 300);
    setTimeout(() => FX.romanticBurst(), 500);
  }

  function runIntroCountdown() {
    if (!introCountdown) return;
    let count = 5;
    introCountdown.textContent = count;

    cdDots.forEach((d) => d.classList.remove("lit"));
    if (goBtn) {
      goBtn.style.display = "none";
      goBtn.classList.remove("show");
    }

    const cdInterval = setInterval(() => {
      cdDots[5 - count]?.classList.add("lit");
      count--;

      if (count > 0) {
        introCountdown.textContent = count;
        introCountdown.classList.remove("pop");
        void introCountdown.offsetWidth;
        introCountdown.classList.add("pop");
      } else {
        clearInterval(cdInterval);
        cdDots[4]?.classList.add("lit");
        introCountdown.textContent = "🎉";
        introCountdown.classList.remove("pop");
        introCountdown.classList.add("go-text");
        void introCountdown.offsetWidth;
        introCountdown.classList.add("pop");

        setTimeout(() => showGoBtn(), 600);
      }
    }, 1000);
  }

  function showGoBtn() {
    if (!goBtn) return;
    goBtn.style.display = "flex";
    requestAnimationFrame(() => {
      requestAnimationFrame(() => goBtn.classList.add("show"));
    });
  }

  async function onGoClick() {
    await tryPlayBgm();
    startRomance();
  }

  function onMute() {
    setMute(!muted);
    if (!muted) {
      tryPlayBgm();
    }
  }

  function bindCanvasTap() {
    const canvas = document.getElementById("fx");
    canvas.addEventListener(
      "pointerdown",
      (e) => {
        const x = e.clientX;
        const y = e.clientY;
        FX.tapBurst(x, y);
      },
      { passive: true }
    );
  }

  function init() {
    FX.init();
    setMute(false);

    if (muteBtn) muteBtn.addEventListener("click", onMute);
    if (goBtn) goBtn.addEventListener("click", onGoClick);
    if (replayBtn) replayBtn.addEventListener("click", onReplay);
    bindCanvasTap();
    bindWeChatAudioFix();

    runIntroCountdown();

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        clearInterval(burstTimer);
        burstTimer = null;
      } else if (started && !fireworksStopped && !burstTimer) {
        burstTimer = window.setInterval(() => FX.romanticBurst(), 1200);
      }
    });

    window.addEventListener("beforeunload", () => {
      generatedObjectUrls.forEach((u) => URL.revokeObjectURL(u));
    });
  }

  // 预加载所有图片，防止切换时白屏
  async function preloadImages() {
    await Promise.all(
      photoUrls.map(async (url) => {
        try {
          const optimized = await optimizePhoto(url);
          optimizedPhotoUrls.set(url, optimized);
          const img = new Image();
          img.decoding = "async";
          img.src = optimized;
        } catch {
          const fallback = imageSrc(url);
          optimizedPhotoUrls.set(url, fallback);
          const img = new Image();
          img.decoding = "async";
          img.src = fallback;
        }
      })
    );
  }

  return { init, preloadImages };
})();

window.addEventListener("DOMContentLoaded", () => {
  App.preloadImages();
  App.init();
});
