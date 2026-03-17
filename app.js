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
    const n = Math.random() < 0.5 ? 80 : 40; // 爱心也分大小
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
    const m = Math.random() < 0.5 ? 150 : 60; // 50%概率产生大爆炸
    const rgb = paletteList[(Math.random() * paletteList.length) | 0];
    for (let i = 0; i < m; i++) {
      const a = (i / m) * Math.PI * 2 + rand(-0.12, 0.12);
      const s = rand(2.0, 8.5); // 增加爆炸范围上限
      sparks.push({
        x: cx,
        y: cy,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        r: rand(1.2, 2.0),
        a: rand(0.6, 0.9),
        rgb,
        life: rand(40, 70),
        age: 0,
        gravity: rand(0.02, 0.05),
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
    ctx.beginPath();
    ctx.fillStyle = rgba(p.rgb, p.a);
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
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
    
    // 使用 emoji 绘制玫瑰
    const size = Math.floor(r.scale * 30);
    ctx.font = `${size}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🌹", 0, 0);
    
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
      p.x += p.vx;
      p.y += p.vy;
      p.age++;
      p.vy += p.gravity ?? 0;
      p.a *= 0.985;
      p.r *= 0.995;
      
      if (p.age >= p.life) {
        sparks.splice(i, 1);
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
        hearts.splice(i, 1);
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
        roses.splice(i, 1);
        continue;
      }
      
      drawRose(r);
    }

    // subtle vignette
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    const g = ctx.createRadialGradient(w * 0.5, h * 0.35, Math.min(w, h) * 0.2, w * 0.5, h * 0.45, Math.min(w, h) * 0.7);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.40)");
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

    // 必定绽放 1-2 个烟花
    burstFirework(rand(w * 0.1, w * 0.9), rand(h * 0.15, h * 0.85));
    if (Math.random() < 0.6) {
      burstFirework(rand(w * 0.1, w * 0.9), rand(h * 0.15, h * 0.85));
    }
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
  const startBtn = document.getElementById("startBtn");
  const startOverlay = document.getElementById("startOverlay");
  const muteBtn = document.getElementById("muteBtn");
  const bgm = document.getElementById("bgm");
  const lines = Array.from(document.querySelectorAll("[data-line]"));
  const proposalWrap = document.querySelector(".proposal-wrap");

  let started = false;
  let muted = false;
  let fireworksStopped = false; // 新增状态：烟花是否已停止
  let revealTimer = null;
  let burstTimer = null;

  function setMute(nextMuted) {
    muted = nextMuted;
    muteBtn.setAttribute("aria-pressed", String(muted));
    bgm.muted = muted;
  }

  async function tryPlayBgm() {
    if (!bgm) return false;
    try {
      await bgm.play();
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
      }
    }, 2800); // 节奏放慢到 2.8 秒，更深情
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

  async function onStart() {
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
        if (!started) onStart();
      },
      { passive: true }
    );
  }

  function init() {
    FX.init();
    setMute(false);

    if (startBtn) startBtn.addEventListener("click", onStart);
    if (muteBtn) muteBtn.addEventListener("click", onMute);
    bindCanvasTap();
    bindWeChatAudioFix();

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        clearInterval(burstTimer);
        burstTimer = null;
      } else if (started && !fireworksStopped && !burstTimer) {
        burstTimer = window.setInterval(() => FX.romanticBurst(), 1200);
      }
    });
  }

  return { init };
})();

window.addEventListener("DOMContentLoaded", () => {
  App.init();
});
