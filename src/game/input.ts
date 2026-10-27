export type Actions = {
  moveX: number;
  moveY: number;
  lookX: number;
  lookY: number;
  jump: boolean;
  sprint: boolean;
  crouch: boolean;
  fire: boolean;
  interact: boolean;
  reload: boolean;
  dodge: boolean;
  block: boolean;
  wheel: number;
};

export class Input {
  keys = new Set<string>();
  injected: Set<string> | null = null;
  lookX = 0;
  lookY = 0;
  fireHeld = false;
  fireClick = false;
  interactClick = false;
  jumpClick = false;
  dodgeClick = false;
  blockHeld = false;
  wheel = 0;
  touchMoveX = 0;
  touchMoveY = 0;
  touchLookX = 0;
  touchLookY = 0;
  isTouch = false;
  private leftId = -1;
  private rightId = -1;
  private leftOrigin = { x: 0, y: 0 };
  private rightLast = { x: 0, y: 0 };
  private canvas: HTMLCanvasElement;
  private onLock: () => void;
  private onUnlock: () => void;
  private prevent = new Set([
    "Space",
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "Tab",
    "KeyI",
    "KeyC",
    "KeyB",
    "KeyM",
    "KeyE",
    "KeyQ",
    "KeyF",
    "KeyR",
  ]);

  constructor(canvas: HTMLCanvasElement, onLock: () => void, onUnlock: () => void) {
    this.canvas = canvas;
    this.onLock = onLock;
    this.onUnlock = onUnlock;
    this.isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  }

  attach() {
    window.addEventListener("keydown", this.kd);
    window.addEventListener("keyup", this.ku);
    window.addEventListener("blur", this.clear);
    document.addEventListener("visibilitychange", this.vis);
    document.addEventListener("pointerlockchange", this.plc);
    this.canvas.addEventListener("mousemove", this.mm);
    this.canvas.addEventListener("mousedown", this.md);
    window.addEventListener("mouseup", this.mu);
    this.canvas.addEventListener("contextmenu", this.ctx);
    this.canvas.addEventListener("wheel", this.wh, { passive: false });
    this.canvas.addEventListener("pointerdown", this.pd);
    window.addEventListener("pointermove", this.pm);
    window.addEventListener("pointerup", this.pu);
    window.addEventListener("pointercancel", this.pu);
  }

  detach() {
    window.removeEventListener("keydown", this.kd);
    window.removeEventListener("keyup", this.ku);
    window.removeEventListener("blur", this.clear);
    document.removeEventListener("visibilitychange", this.vis);
    document.removeEventListener("pointerlockchange", this.plc);
    this.canvas.removeEventListener("mousemove", this.mm);
    this.canvas.removeEventListener("mousedown", this.md);
    window.removeEventListener("mouseup", this.mu);
    this.canvas.removeEventListener("contextmenu", this.ctx);
    this.canvas.removeEventListener("wheel", this.wh);
    this.canvas.removeEventListener("pointerdown", this.pd);
    window.removeEventListener("pointermove", this.pm);
    window.removeEventListener("pointerup", this.pu);
    window.removeEventListener("pointercancel", this.pu);
    if (document.pointerLockElement) document.exitPointerLock();
  }

  requestLock() {
    if (this.isTouch) return;
    const el = this.canvas as HTMLElement & {
      requestPointerLock: (opts?: { unadjustedMovement?: boolean }) => Promise<void> | void;
    };
    const p = el.requestPointerLock({ unadjustedMovement: true });
    if (p && typeof (p as Promise<void>).catch === "function") {
      (p as Promise<void>).catch(() => {
        el.requestPointerLock();
      });
    }
  }

  private plc = () => {
    if (document.pointerLockElement === this.canvas) this.onLock();
    else this.onUnlock();
  };

  flush() {
    this.keys.clear();
    this.fireHeld = false;
    this.blockHeld = false;
    this.fireClick = false;
    this.dodgeClick = false;
    this.jumpClick = false;
    this.interactClick = false;
    this.lookX = 0;
    this.lookY = 0;
  }

  private kd = (e: KeyboardEvent) => {
    const el = e.target as HTMLElement | null;
    if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
    if (e.repeat) return;
    if (this.prevent.has(e.code) || /^Digit[1-8]$/.test(e.code)) e.preventDefault();
    this.keys.add(e.code);
    if (e.code === "KeyE") this.interactClick = true;
    if (e.code === "Space") this.jumpClick = true;
    if (e.code === "KeyQ") this.dodgeClick = true;
  };
  private ku = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };
  private clear = () => {
    this.keys.clear();
    this.fireHeld = false;
    this.blockHeld = false;
  };
  private vis = () => {
    if (document.hidden) this.clear();
  };
  private mm = (e: MouseEvent) => {
    if (document.pointerLockElement !== this.canvas) return;
    this.lookX += e.movementX;
    this.lookY += e.movementY;
  };
  private md = (e: MouseEvent) => {
    if (e.button === 0) {
      this.fireHeld = true;
      this.fireClick = true;
    } else if (e.button === 2) {
      this.blockHeld = true;
    }
  };
  private mu = (e: MouseEvent) => {
    if (e.button === 0) this.fireHeld = false;
    if (e.button === 2) this.blockHeld = false;
  };
  private ctx = (e: Event) => e.preventDefault();
  private wh = (e: WheelEvent) => {
    e.preventDefault();
    this.wheel += e.deltaY > 0 ? 1 : e.deltaY < 0 ? -1 : 0;
  };

  private pd = (e: PointerEvent) => {
    if (!this.isTouch) return;
    const r = this.canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const mid = r.width * 0.42;
    if (x < mid && this.leftId < 0) {
      this.leftId = e.pointerId;
      this.leftOrigin = { x: e.clientX, y: e.clientY };
    } else if (x >= mid && this.rightId < 0) {
      this.rightId = e.pointerId;
      this.rightLast = { x: e.clientX, y: e.clientY };
    }
  };
  private pm = (e: PointerEvent) => {
    if (!this.isTouch) return;
    if (e.pointerId === this.leftId) {
      const dx = (e.clientX - this.leftOrigin.x) / 52;
      const dy = (e.clientY - this.leftOrigin.y) / 52;
      const m = Math.hypot(dx, dy);
      const s = m > 1 ? 1 / m : 1;
      this.touchMoveX = dx * s;
      this.touchMoveY = dy * s;
    } else if (e.pointerId === this.rightId) {
      this.touchLookX += e.clientX - this.rightLast.x;
      this.touchLookY += e.clientY - this.rightLast.y;
      this.rightLast = { x: e.clientX, y: e.clientY };
    }
  };
  private pu = (e: PointerEvent) => {
    if (e.pointerId === this.leftId) {
      this.leftId = -1;
      this.touchMoveX = 0;
      this.touchMoveY = 0;
    }
    if (e.pointerId === this.rightId) {
      this.rightId = -1;
    }
  };

  down(code: string) {
    const src = this.injected ?? this.keys;
    return src.has(code);
  }

  setKeys(codes: string[]) {
    this.injected = new Set(codes);
  }

  sample(): Actions {
    const src = this.injected ?? this.keys;
    let x = 0;
    let y = 0;
    if (src.has("KeyA") || src.has("ArrowLeft")) x -= 1;
    if (src.has("KeyD") || src.has("ArrowRight")) x += 1;
    if (src.has("KeyW") || src.has("ArrowUp")) y += 1;
    if (src.has("KeyS") || src.has("ArrowDown")) y -= 1;
    x += this.touchMoveX;
    y -= this.touchMoveY;
    const m = Math.hypot(x, y);
    if (m > 1) {
      x /= m;
      y /= m;
    }
    const lx = this.lookX + this.touchLookX;
    const ly = this.lookY + this.touchLookY;
    this.lookX = 0;
    this.lookY = 0;
    this.touchLookX = 0;
    this.touchLookY = 0;
    const fire = this.fireHeld || this.fireClick || src.has("Mouse0");
    const interact = this.interactClick || src.has("KeyE");
    const jump = this.jumpClick || src.has("Space");
    const dodge = this.dodgeClick;
    this.fireClick = false;
    this.interactClick = false;
    this.jumpClick = false;
    this.dodgeClick = false;
    const wheel = this.wheel;
    this.wheel = 0;
    return {
      moveX: x,
      moveY: y,
      lookX: lx,
      lookY: ly,
      jump,
      sprint: src.has("ShiftLeft") || src.has("ShiftRight"),
      crouch: src.has("KeyC") && !src.has("ControlLeft"),
      fire,
      interact,
      reload: src.has("KeyR"),
      dodge,
      block: this.blockHeld || src.has("KeyF"),
      wheel,
    };
  }
}
