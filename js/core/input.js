// Entrada: teclado, mouse e controles de toque (joystick virtual + botões)
const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run', KeyE: 'interact', KeyF: 'lantern',
  Space: 'dodge', KeyI: 'inventory', KeyM: 'map', Escape: 'pause', KeyP: 'pause',
  KeyC: 'sneak', ControlLeft: 'sneak', KeyQ: 'aim', Digit1: 'use1', Digit2: 'use2', Digit3: 'use3',
  Enter: 'confirm', Tab: 'drawer',
};

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set();
    this.pressedSet = new Set();
    this.mouse = { x: 0, y: 0, moved: -1e9, inside: false };
    this.joy = { x: 0, y: 0, active: false, id: null };
    this.lastDevice = 'keyboard';
    this.listeners = [];

    window.addEventListener('keydown', (e) => {
      const a = KEYMAP[e.code];
      if (!a) return;
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (a !== 'pause' || true) e.preventDefault();
      this.lastDevice = 'keyboard';
      if (!e.repeat) { this.pressedSet.add(a); this.emit(a); }
      this.down.add(a);
    });
    window.addEventListener('keyup', (e) => {
      const a = KEYMAP[e.code];
      if (a) this.down.delete(a);
    });
    window.addEventListener('blur', () => this.down.clear());

    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left; this.mouse.y = e.clientY - r.top;
      this.mouse.moved = performance.now(); this.mouse.inside = true;
      this.lastDevice = 'mouse';
    });
    canvas.addEventListener('mouseleave', () => { this.mouse.inside = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 2) { this.down.add('aim'); this.pressedSet.add('aim'); }
      if (e.button === 0) { this.pressedSet.add('click'); this.emit('click'); }
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 2) this.down.delete('aim'); });
  }

  on(fn) { this.listeners.push(fn); }
  emit(a) { for (const f of this.listeners) f(a); }

  isDown(a) { return this.down.has(a); }
  pressed(a) { return this.pressedSet.has(a); }
  endFrame() { this.pressedSet.clear(); }

  axis() {
    if (this.joy.active) {
      const m = Math.hypot(this.joy.x, this.joy.y);
      if (m < 0.18) return { x: 0, y: 0, m: 0 };
      return { x: this.joy.x, y: this.joy.y, m: Math.min(1, m) };
    }
    let x = 0, y = 0;
    if (this.down.has('left')) x -= 1;
    if (this.down.has('right')) x += 1;
    if (this.down.has('up')) y -= 1;
    if (this.down.has('down')) y += 1;
    const m = Math.hypot(x, y);
    if (m > 0) { x /= m; y /= m; }
    return { x, y, m: m > 0 ? 1 : 0 };
  }

  bindTouch(root) {
    const joy = root.querySelector('#joy');
    const knob = root.querySelector('#joy-knob');
    const R = 46;
    const setKnob = (dx, dy) => { knob.style.transform = `translate(${dx}px, ${dy}px)`; };
    const start = (e) => {
      e.preventDefault();
      this.lastDevice = 'touch';
      this.joy.active = true; this.joy.id = e.pointerId;
      joy.setPointerCapture(e.pointerId);
      move(e);
    };
    const move = (e) => {
      if (!this.joy.active || e.pointerId !== this.joy.id) return;
      const r = joy.getBoundingClientRect();
      let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      const m = Math.hypot(dx, dy);
      if (m > R) { dx = dx / m * R; dy = dy / m * R; }
      this.joy.x = dx / R; this.joy.y = dy / R;
      setKnob(dx, dy);
    };
    const end = (e) => {
      if (e.pointerId !== this.joy.id) return;
      this.joy.active = false; this.joy.x = 0; this.joy.y = 0; setKnob(0, 0);
    };
    joy.addEventListener('pointerdown', start);
    joy.addEventListener('pointermove', move);
    joy.addEventListener('pointerup', end);
    joy.addEventListener('pointercancel', end);

    root.querySelectorAll('[data-act]').forEach((b) => {
      const a = b.dataset.act;
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.lastDevice = 'touch';
        this.down.add(a); this.pressedSet.add(a); this.emit(a);
        b.classList.add('on');
      });
      const up = () => { this.down.delete(a); b.classList.remove('on'); };
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('pointerleave', up);
    });
  }
}
