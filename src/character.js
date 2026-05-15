/**
 * 角色类 - 负责单个捣蛋角色的渲染、物理移动和基础行为
 * 支持 Lerp / 二次贝塞尔平滑移动、三档速度、边界感知
 */
export class Character {
  /** 速度档位映射 (px/frame @ 60fps) */
  static SPEED = { slow: 1.5, mid: 3, fast: 6 };

  constructor(id, imageSrc, containerWidth, containerHeight) {
    this.id = id;
    this.imageSrc = imageSrc;
    this.containerWidth = containerWidth;
    this.containerHeight = containerHeight;

    // 位置
    this.x = -200;
    this.y = -200;
    this.targetX = this.x;
    this.targetY = this.y;

    // 贝塞尔控制点（null 时退化为 Lerp）
    this.ctrlX = null;
    this.ctrlY = null;
    this.pathT = 0;       // 0→1 曲线参数
    this.pathStartX = 0;
    this.pathStartY = 0;

    // 速度
    this.speedTier = 'mid';
    this.speed = Character.SPEED.mid;
    this.baseSpeed = Character.SPEED.mid;
    this.speedMultiplier = 1;

    // 视觉属性
    this.scale = 0.55;
    this.opacity = 1;
    this.rotation = 0;
    this.zIndex = 32; // 在 particle(10) 之上, hud/tray(50) 之下

    // 状态机
    this.state = 'idle';   // idle | move | disturb | hide
    this.stateTimer = 0;
    this.disturbType = null;

    // DOM
    this.element = null;
    this.image = null;
    this.bubble = null;
    this.bubbleText = null;
    this.bubbleTimer = null;
    this.loaded = false;

    // 浮动动画
    this.floatOffset = Math.random() * Math.PI * 2;
    this.floatSpeed = 0.02 + Math.random() * 0.02;

    // 抓取
    this.grabbedParticle = null;        // main.js 中 particle 对象引用
    this.grabbedOriginalXvw = 0;
    this.grabbedOriginalYvh = 0;

    this._createDOM();
    this._loadImage();
  }

  /* ---------- DOM 构建 ---------- */

  _createDOM() {
    this.element = document.createElement('div');
    this.element.className = 'game-character';
    this.element.style.cssText = `
      position: fixed;
      pointer-events: auto;
      cursor: pointer;
      transition: opacity 0.3s ease;
      z-index: ${this.zIndex};
      transform-origin: center bottom;
      will-change: transform, opacity;
    `;

    this.image = document.createElement('img');
    this.image.style.cssText = `
      width: 100%;
      height: 100%;
      object-fit: contain;
      pointer-events: none;
      filter: drop-shadow(0 4px 8px rgba(0,0,0,0.3));
    `;

    // 气泡
    this.bubble = document.createElement('div');
    this.bubble.className = 'character-bubble';
    this.bubble.style.cssText = `
      position: absolute;
      bottom: 100%;
      left: 50%;
      transform: translateX(-50%) translateY(-10px);
      background: rgba(255, 255, 255, 0.95);
      border: 2px solid #b87c3a;
      border-radius: 16px;
      padding: 8px 14px;
      font-family: "Source Han Serif SC", "Noto Serif SC", "STSong", "SimSun", serif;
      font-size: 14px;
      color: #3e2a1f;
      white-space: nowrap;
      opacity: 0;
      pointer-events: none;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      transition: opacity 0.3s ease;
      z-index: 10;
    `;

    this.bubbleText = document.createElement('span');
    this.bubble.appendChild(this.bubbleText);

    const tail = document.createElement('div');
    tail.style.cssText = `
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      width: 0;
      height: 0;
      border-left: 8px solid transparent;
      border-right: 8px solid transparent;
      border-top: 8px solid #b87c3a;
    `;
    this.bubble.appendChild(tail);

    this.element.appendChild(this.image);
    this.element.appendChild(this.bubble);

    this.element.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onClicked();
    });
  }

  _loadImage() {
    this.image.src = this.imageSrc;
    this.image.onload = () => {
      this.loaded = true;
      this._updateDOM();
    };
    this.image.onerror = () => {
      console.warn('Failed to load character image:', this.imageSrc, '— using fallback');
      // 图片加载失败时使用 emoji 占位
      this.image.style.display = 'none';
      const fallback = document.createElement('div');
      fallback.style.cssText = `
        width: 100%; height: 100%;
        display: flex; align-items: center; justify-content: center;
        font-size: 48px;
        filter: drop-shadow(0 4px 8px rgba(0,0,0,0.3));
        pointer-events: none;
      `;
      fallback.textContent = this.imageSrc.includes('女') ? '👧' : '👦';
      this.element.insertBefore(fallback, this.bubble);
      this.loaded = true;
      this._updateDOM();
    };
  }

  /* ---------- 公共接口 ---------- */

  /** 点击命中检测 (坐标 API) */
  checkClick(mouseX, mouseY) {
    if (this.state === 'hide' || !this.loaded || this.opacity < 0.1) return false;
    const size = 120 * this.scale;
    const left = this.x - size / 2;
    const top = this.y - size;
    return mouseX >= left && mouseX <= left + size && mouseY >= top && mouseY <= top + size;
  }

  /** 被点击 → 逃跑动画 */
  onClicked() {
    if (this.state === 'hide') return;
    this.state = 'hide';
    this.stateTimer = 3000 + Math.random() * 2000;
    this.releaseGrabbedParticle();
    this.hideBubble();

    // 快速逃跑动画：向最近的屏幕边缘冲
    const edgeX = this.x < this.containerWidth / 2 ? -150 : this.containerWidth + 150;
    const edgeY = this.y < this.containerHeight / 2 ? -150 : this.containerHeight + 150;
    // 选择更近的轴
    const dx = Math.abs(this.x - edgeX);
    const dy = Math.abs(this.y - edgeY);
    if (dx < dy) {
      this.targetX = edgeX;
      this.targetY = this.y + (Math.random() - 0.5) * 100;
    } else {
      this.targetX = this.x + (Math.random() - 0.5) * 100;
      this.targetY = edgeY;
    }
    this.speed = Character.SPEED.fast * 2;
    this.ctrlX = null;
    this.ctrlY = null;
    this.pathT = 0;
    this.pathStartX = this.x;
    this.pathStartY = this.y;

    // 半透明 → 消失
    this.opacity = 0.4;
    setTimeout(() => {
      this.opacity = 0;
      this._updateDOM();
    }, 300);
  }

  /** 显示气泡文本 */
  showBubble(text) {
    if (!this.bubbleText) return;
    this.bubbleText.textContent = text;
    this.bubble.style.opacity = '1';
    if (this.bubbleTimer) clearTimeout(this.bubbleTimer);
    this.bubbleTimer = setTimeout(() => this.hideBubble(), 2000 + Math.random() * 1000);
  }

  hideBubble() {
    if (this.bubble) this.bubble.style.opacity = '0';
    if (this.bubbleTimer) { clearTimeout(this.bubbleTimer); this.bubbleTimer = null; }
  }

  /** 设置速度档位 */
  setSpeedTier(tier) {
    this.speedTier = tier;
    this.baseSpeed = Character.SPEED[tier] || Character.SPEED.mid;
    this.speed = this.baseSpeed * this.speedMultiplier;
  }

  /**
   * 用 Lerp（直线）移动到目标
   */
  moveTo(x, y, speedTier) {
    this.targetX = x;
    this.targetY = y;
    this.ctrlX = null;
    this.ctrlY = null;
    this.pathT = 0;
    this.pathStartX = this.x;
    this.pathStartY = this.y;
    if (speedTier) this.setSpeedTier(speedTier);
    if (this.state !== 'disturb') this.state = 'move';
  }

  /**
   * 用二次贝塞尔曲线移动到目标
   */
  moveToQuadratic(x, y, ctrlX, ctrlY, speedTier) {
    this.targetX = x;
    this.targetY = y;
    this.ctrlX = ctrlX;
    this.ctrlY = ctrlY;
    this.pathT = 0;
    this.pathStartX = this.x;
    this.pathStartY = this.y;
    if (speedTier) this.setSpeedTier(speedTier);
    if (this.state !== 'disturb') this.state = 'move';
  }

  /** 移动到某个 DOM 元素中心附近 */
  moveToElement(element, offsetX = 0, offsetY = 0) {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    this.moveTo(rect.left + rect.width / 2 + offsetX, rect.top + rect.height / 2 + offsetY);
    return true;
  }

  /** 随机移动（Lerp）*/
  randomMove() {
    const margin = 120;
    const tiers = ['slow', 'mid', 'fast'];
    const tier = tiers[Math.floor(Math.random() * tiers.length)];
    this.moveTo(
      margin + Math.random() * (this.containerWidth - margin * 2),
      margin + Math.random() * (this.containerHeight - margin * 2),
      tier,
    );
  }

  /** 从屏幕边缘外闯入 */
  enterFromEdge() {
    const edge = Math.floor(Math.random() * 4);
    const tm = 150;
    switch (edge) {
      case 0: this.x = Math.random() * this.containerWidth; this.y = -100; break;
      case 1: this.x = this.containerWidth + 100; this.y = Math.random() * this.containerHeight; break;
      case 2: this.x = Math.random() * this.containerWidth; this.y = this.containerHeight + 100; break;
      case 3: this.x = -100; this.y = Math.random() * this.containerHeight; break;
    }
    this.targetX = tm + Math.random() * (this.containerWidth - tm * 2);
    this.targetY = tm + Math.random() * (this.containerHeight - tm * 2);
    // 贝塞尔入场 - 控制点略偏
    this.ctrlX = (this.x + this.targetX) / 2 + (Math.random() - 0.5) * 200;
    this.ctrlY = (this.y + this.targetY) / 2 + (Math.random() - 0.5) * 200;
    this.pathT = 0;
    this.pathStartX = this.x;
    this.pathStartY = this.y;
    this.state = 'move';
    this.opacity = 1;
    this.setSpeedTier('mid');
  }

  /* ---------- 抓取汉字粒子 ---------- */

  /** 抓取一个 particle 对象（来自 main.js 的 state.particles 数组元素） */
  grabParticle(particle) {
    if (!particle) return;
    this.grabbedParticle = particle;
    this.grabbedOriginalXvw = particle.xvw;
    this.grabbedOriginalYvh = particle.yvh;
  }

  /** 释放 */
  releaseGrabbedParticle() {
    if (this.grabbedParticle) {
      // 把汉字丢回原始位置附近
      this.grabbedParticle.xvw = this.grabbedOriginalXvw + (Math.random() - 0.5) * 10;
      this.grabbedParticle.yvh = this.grabbedOriginalYvh + (Math.random() - 0.5) * 10;
      this.grabbedParticle = null;
    }
  }

  /* ---------- 帧更新 ---------- */

  update(deltaTime) {
    if (!this.loaded) return;

    // 更新容器尺寸（处理 resize）
    this.containerWidth = window.innerWidth;
    this.containerHeight = window.innerHeight;

    // 状态计时器
    if (this.stateTimer > 0) {
      this.stateTimer -= deltaTime;
      if (this.stateTimer <= 0) {
        this.stateTimer = 0;
        if (this.state === 'hide') {
          this.enterFromEdge();
        } else if (this.state === 'disturb') {
          this.state = 'idle';
          this.disturbType = null;
          this.releaseGrabbedParticle();
        }
      }
    }

    // 移动：Lerp 或 Quadratic Bezier
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 2) {
      if (this.ctrlX !== null && this.ctrlY !== null) {
        // 贝塞尔
        const totalDist = Math.sqrt(
          (this.targetX - this.pathStartX) ** 2 + (this.targetY - this.pathStartY) ** 2
        );
        const step = totalDist > 0 ? (this.speed / totalDist) : 0.05;
        this.pathT = Math.min(1, this.pathT + step);
        const t = this.pathT;
        const it = 1 - t;
        this.x = it * it * this.pathStartX + 2 * it * t * this.ctrlX + t * t * this.targetX;
        this.y = it * it * this.pathStartY + 2 * it * t * this.ctrlY + t * t * this.targetY;
        if (this.pathT >= 1) {
          this.ctrlX = null;
          this.ctrlY = null;
          if (this.state === 'move') this.state = 'idle';
        }
      } else {
        // Lerp
        const lerpFactor = Math.min(1, this.speed / distance);
        this.x += dx * lerpFactor;
        this.y += dy * lerpFactor;
        if (Math.abs(this.targetX - this.x) < 2 && Math.abs(this.targetY - this.y) < 2) {
          this.x = this.targetX;
          this.y = this.targetY;
          if (this.state === 'move') this.state = 'idle';
        }
      }
    } else if (this.state === 'move') {
      this.state = 'idle';
    }

    // 边界：允许从外部进入，但到达后不超出可视区 ±80px
    if (this.state !== 'hide') {
      if (this.x > -80 && this.x < this.containerWidth + 80) {
        // 在合理范围内，不强制夹取
      } else if (this.state === 'idle') {
        // 闲置时拉回来
        this.x = Math.max(80, Math.min(this.containerWidth - 80, this.x));
      }
    }

    // 浮动
    this.floatOffset += this.floatSpeed;
    const floatY = Math.sin(this.floatOffset) * 5;

    // 抓取的粒子跟随
    if (this.grabbedParticle && this.state === 'disturb') {
      this.grabbedParticle.xvw = (this.x / this.containerWidth) * 100;
      this.grabbedParticle.yvh = ((this.y - 60) / this.containerHeight) * 100;
    }

    this._updateDOM(floatY);
  }

  /* ---------- DOM 同步 ---------- */

  _updateDOM(floatY = 0) {
    if (!this.element || !this.loaded) return;
    const size = 120 * this.scale;
    this.element.style.left = `${this.x - size / 2}px`;
    this.element.style.top = `${this.y - size + floatY}px`;
    this.element.style.width = `${size}px`;
    this.element.style.height = `${size}px`;
    this.element.style.opacity = this.opacity;
    this.element.style.transform = `rotate(${this.rotation}deg)`;
  }

  mount(container) {
    if (this.element && !this.element.parentNode) {
      container.appendChild(this.element);
    }
  }

  unmount() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }

  destroy() {
    this.releaseGrabbedParticle();
    this.hideBubble();
    this.unmount();
    this.element = null;
    this.image = null;
    this.bubble = null;
    this.bubbleText = null;
  }
}
