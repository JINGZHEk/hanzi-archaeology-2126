import { Character } from './character.js';

/**
 * 角色管理器 - 负责角色资源加载、调度和干扰行为
 *
 * 接入点：
 *   manager.init()          — 加载角色并挂载 DOM
 *   manager.start()         — 开始干扰循环
 *   manager.stop()          — 暂停
 *   manager.destroy()       — 销毁
 *   manager.setDifficulty(n)— 外部调整难度
 *   manager.checkClick(x,y) — 外部点击检测
 *   manager.setGameState(s) — 传入 main.js 的 state 引用
 */
export class CharacterManager {
  constructor(container) {
    this.container = container;
    this.currentCharacter = null;
    this.enabled = false;

    // 干扰配置
    this.disturbInterval = 4000; // 初始 4 秒，更快出现
    this.minDisturbInterval = 2000;
    this.disturbTimer = 0;
    this.difficulty = 1;
    this.gameStartTime = 0;

    // main.js 的 state 引用（由外部传入）
    this.gameState = null;

    // 角色资源
    this.characterImages = [
      './character/女1.png',
      './character/男1.png',
    ];

    // 对话气泡文本
    this.bubbleTexts = [
      '让小生来看看~',
      '这个字不错喔',
      '嘿嘿，找到了！',
      '别急别急~',
      '让我帮你一把',
      '咦，这是什么？',
      '有意思有意思',
      '稍等片刻~',
      '好厉害的字！',
      '这个我认识~',
      '等等我看看',
      '嘻嘻嘻~',
    ];

    // 动画帧
    this.animationFrame = null;
    this.lastTime = 0;
  }

  /* ========== 生命周期 ========== */

  async init() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const img = this.characterImages[Math.floor(Math.random() * this.characterImages.length)];
    this.currentCharacter = new Character('char1', img, w, h);
    this.currentCharacter.mount(this.container);
    this.currentCharacter.enterFromEdge();
    this.gameStartTime = Date.now();
  }

  /** 传入 main.js 的 state，以便直接访问 particles / level 等 */
  setGameState(gameState) {
    this.gameState = gameState;
  }

  start() {
    if (!this.currentCharacter) return;
    this.enabled = true;
    this.disturbTimer = 1500; // 首次干扰快速触发
    this._startLoop();
    // 入场时立即显示气泡打招呼
    const greetings = ['来啦来啦~', '准备好了吗？', '嘿！开始咯~', '我来捣乱啦~'];
    const text = greetings[Math.floor(Math.random() * greetings.length)];
    this.currentCharacter.showBubble(text);
  }

  stop() {
    this.enabled = false;
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  destroy() {
    this.stop();
    if (this.currentCharacter) {
      this.currentCharacter.destroy();
      this.currentCharacter = null;
    }
  }

  /* ========== 外部 API ========== */

  /**
   * 外部调整难度 (1=初始, 2=中等, 3=高)
   * 影响出现频率、移动速度和干扰时间
   */
  setDifficulty(level) {
    this.difficulty = Math.max(1, level);
    // 缩短干扰间隔
    this.disturbInterval = Math.max(this.minDisturbInterval, 4000 - (this.difficulty - 1) * 800);
    // 增加角色速度
    if (this.currentCharacter) {
      this.currentCharacter.speedMultiplier = Math.min(2, 0.8 + this.difficulty * 0.3);
    }
  }

  /**
   * 坐标点击检测，供 main.js 在全局 pointerdown 中调用
   * @returns {boolean} 是否命中角色
   */
  checkClick(mouseX, mouseY) {
    if (!this.currentCharacter) return false;
    if (this.currentCharacter.checkClick(mouseX, mouseY)) {
      this.currentCharacter.onClicked();
      return true;
    }
    return false;
  }

  /* ========== 动画循环 ========== */

  _startLoop() {
    const animate = (t) => {
      if (!this.enabled) return;
      const dt = this.lastTime ? Math.min(t - this.lastTime, 50) : 16;
      this.lastTime = t;
      this._update(dt);
      this.animationFrame = requestAnimationFrame(animate);
    };
    this.animationFrame = requestAnimationFrame(animate);
  }

  _update(dt) {
    if (!this.currentCharacter) return;
    this.currentCharacter.update(dt);
    this._autoScaleDifficulty();

    // 干扰计时
    const ch = this.currentCharacter;
    if (ch.state !== 'hide' && ch.state !== 'disturb') {
      this.disturbTimer -= dt;
      if (this.disturbTimer <= 0) {
        this._triggerRandomDisturb();
        this.disturbTimer = this.disturbInterval + Math.random() * 3000;
      }
    }
  }

  _autoScaleDifficulty() {
    const elapsed = Date.now() - this.gameStartTime;
    const minutes = elapsed / 60000;
    // 每 30 秒增加 0.15 难度
    const autoLevel = 1 + minutes * 0.3;
    if (autoLevel > this.difficulty) {
      this.setDifficulty(autoLevel);
    }
  }

  /* ========== 干扰调度 ========== */

  _triggerRandomDisturb() {
    if (!this.currentCharacter || this.currentCharacter.state === 'hide') return;

    const behaviors = [
      { name: 'blockHint',     weight: 20 },
      { name: 'grabCharacter', weight: 25 },
      { name: 'glitchUI',      weight: 15 },
      { name: 'fakeMove',      weight: 20 },
      { name: 'randomChat',    weight: 20 },
    ];

    const total = behaviors.reduce((s, b) => s + b.weight, 0);
    let r = Math.random() * total;
    let pick = behaviors[0].name;
    for (const b of behaviors) {
      r -= b.weight;
      if (r <= 0) { pick = b.name; break; }
    }

    switch (pick) {
      case 'blockHint':     this._disturbBlockHint(); break;
      case 'grabCharacter': this._disturbGrabCharacter(); break;
      case 'glitchUI':      this._disturbGlitchUI(); break;
      case 'fakeMove':      this._disturbFakeMove(); break;
      case 'randomChat':    this._disturbRandomChat(); break;
    }
  }

  /* ========== 干扰 1：遮挡提示文字 ========== */

  _disturbBlockHint() {
    const ch = this.currentCharacter;

    // 优先遮挡 tray（提示槽位区域），其次 hud
    const tray = this.container.querySelector('.tray');
    const hud = document.getElementById('hud');
    const targets = [tray, hud].filter(Boolean).filter(el => {
      const st = window.getComputedStyle(el);
      return st.opacity !== '0' && st.display !== 'none';
    });

    if (targets.length === 0) { this._disturbRandomChat(); return; }

    const target = targets[Math.floor(Math.random() * targets.length)];
    ch.moveToElement(target, (Math.random() - 0.5) * 60, 20);
    ch.state = 'disturb';
    const dur = 1000 + Math.random() * 2000;
    ch.stateTimer = dur;
    ch.showBubble('让我看看~');

    setTimeout(() => {
      if (ch.state === 'disturb') ch.opacity = 0.8;
    }, 400);

    setTimeout(() => {
      if (ch) { ch.opacity = 1; ch.randomMove(); }
    }, dur);
  }

  /* ========== 干扰 2：抢夺汉字（直接修改 particle 数据） ========== */

  _disturbGrabCharacter() {
    const ch = this.currentCharacter;
    const particles = this.gameState?.particles;

    if (!particles || particles.length === 0) {
      this._disturbRandomChat();
      return;
    }

    // 随机选一个可见粒子
    const visible = particles.filter(p => p.el && p.yvh >= -10 && p.yvh <= 110);
    if (visible.length === 0) { this._disturbRandomChat(); return; }

    const target = visible[Math.floor(Math.random() * visible.length)];
    const rect = target.el.getBoundingClientRect();

    // 用贝塞尔冲向目标
    const midX = (ch.x + rect.left) / 2 + (Math.random() - 0.5) * 150;
    const midY = (ch.y + rect.top) / 2 + (Math.random() - 0.5) * 100;
    ch.moveToQuadratic(rect.left + rect.width / 2, rect.top + rect.height / 2, midX, midY, 'fast');
    ch.showBubble('这个字不错！');

    setTimeout(() => {
      if (!ch || ch.state === 'hide') return;
      ch.state = 'disturb';
      const grabDur = 500 + Math.random() * 500;
      ch.stateTimer = grabDur;

      // 抓取：直接修改 particle 的坐标，使其跟随角色
      ch.grabParticle(target);

      setTimeout(() => {
        if (ch) {
          ch.releaseGrabbedParticle();
          ch.randomMove();
        }
      }, grabDur);
    }, 800);
  }

  /* ========== 干扰 3：UI 破坏者（DOM 抖动 / Glitch） ========== */

  _disturbGlitchUI() {
    const ch = this.currentCharacter;
    const selectors = '.particle, .slot, .tray';
    const elements = this.container.querySelectorAll(selectors);
    const visible = Array.from(elements).filter(el => {
      const st = window.getComputedStyle(el);
      return st.opacity !== '0' && st.display !== 'none';
    });

    if (visible.length === 0) { this._disturbRandomChat(); return; }

    ch.showBubble('嘿嘿~');
    ch.state = 'disturb';
    ch.stateTimer = 1000;

    const count = 3 + Math.floor(Math.random() * 4);
    const picks = visible.sort(() => Math.random() - 0.5).slice(0, count);

    picks.forEach(el => {
      const origTr = el.style.transform || '';
      const origFi = el.style.filter || '';
      const origTs = el.style.transition || '';
      el.style.transition = 'none';

      let tick = 0;
      const iv = setInterval(() => {
        if (tick >= 10) {
          clearInterval(iv);
          el.style.transform = origTr;
          el.style.filter = origFi;
          el.style.transition = origTs;
          return;
        }
        const sx = (Math.random() - 0.5) * 8;
        const sy = (Math.random() - 0.5) * 8;
        const sr = (Math.random() - 0.5) * 15;
        const hue = Math.random() * 360;
        el.style.transform = `${origTr} translate(${sx}px, ${sy}px) rotate(${sr}deg)`;
        el.style.filter = `${origFi} hue-rotate(${hue}deg)`;
        tick++;
      }, 100);
    });

    setTimeout(() => { if (ch) ch.randomMove(); }, 1000);
  }

  /* ========== 干扰 4：假动作（迷惑玩家）========== */

  _disturbFakeMove() {
    const ch = this.currentCharacter;
    const actions = ['flash', 'zigzag', 'spin'];
    const action = actions[Math.floor(Math.random() * actions.length)];

    switch (action) {
      case 'flash': {
        // 快速从一侧闪现到另一侧
        ch.opacity = 0;
        ch._updateDOM();
        setTimeout(() => {
          if (!ch) return;
          const m = 100;
          ch.x = ch.x < ch.containerWidth / 2
            ? ch.containerWidth - m - Math.random() * 100
            : m + Math.random() * 100;
          ch.y = m + Math.random() * (ch.containerHeight - m * 2);
          ch.targetX = ch.x;
          ch.targetY = ch.y;
          ch.opacity = 1;
          ch._updateDOM();
          ch.showBubble('嘻嘻~');
          // 再闪一次
          setTimeout(() => {
            if (!ch) return;
            ch.opacity = 0;
            ch._updateDOM();
            setTimeout(() => {
              if (!ch) return;
              ch.randomMove();
              ch.opacity = 1;
              ch._updateDOM();
            }, 150);
          }, 400);
        }, 200);
        break;
      }
      case 'zigzag': {
        let step = 0;
        const zigzag = () => {
          if (step >= 3 || !ch) return;
          ch.moveTo(
            100 + Math.random() * (ch.containerWidth - 200),
            100 + Math.random() * (ch.containerHeight - 200),
            'fast',
          );
          step++;
          setTimeout(zigzag, 500);
        };
        zigzag();
        break;
      }
      case 'spin': {
        ch.state = 'disturb';
        ch.stateTimer = 1500;
        let rot = 0;
        const iv = setInterval(() => {
          if (!ch || rot >= 360) {
            clearInterval(iv);
            if (ch) { ch.rotation = 0; ch.randomMove(); }
            return;
          }
          rot += 30;
          ch.rotation = rot;
          ch._updateDOM();
        }, 50);
        break;
      }
    }
  }

  /* ========== 干扰 5：随机对话 ========== */

  _disturbRandomChat() {
    const text = this.bubbleTexts[Math.floor(Math.random() * this.bubbleTexts.length)];
    this.currentCharacter.showBubble(text);
    this.currentCharacter.randomMove();
  }

  /* ========== 手动触发（供外部调用）========== */

  triggerDisturb(type) {
    if (!this.currentCharacter || this.currentCharacter.state === 'hide') return;
    switch (type) {
      case 'block':  this._disturbBlockHint(); break;
      case 'grab':   this._disturbGrabCharacter(); break;
      case 'glitch': this._disturbGlitchUI(); break;
      case 'fake':   this._disturbFakeMove(); break;
      case 'chat':   this._disturbRandomChat(); break;
    }
  }
}
