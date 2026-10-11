export type Quality = "low" | "med" | "high";

export type GameSettings = {
  sens: number;
  fov: number;
  headBob: boolean;
  particles: boolean;
  view: number;
  quality: Quality;
};

export const DEFAULT_SETTINGS: GameSettings = {
  sens: 1,
  fov: 78,
  headBob: true,
  particles: true,
  view: 210,
  quality: "med",
};

const KEY = "tribals-settings";

export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const p = JSON.parse(raw) as Partial<GameSettings>;
    const quality = p.quality === "low" || p.quality === "high" || p.quality === "med" ? p.quality : "med";
    return {
      sens: clamp(p.sens, 0.4, 2.2, 1),
      fov: clamp(p.fov, 60, 100, 78),
      headBob: p.headBob !== false,
      particles: p.particles !== false,
      view: clamp(p.view, 80, 280, 210),
      quality,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: GameSettings) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

function clamp(n: number | undefined, min: number, max: number, fallback: number) {
  if (typeof n !== "number" || Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
