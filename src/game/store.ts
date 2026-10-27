import { create } from "zustand";
import {
  COPY,
  HOTBAR,
  INV_SIZE,
  SERVERS,
  type ItemId,
  type Lang,
  type QuestId,
  type ServerId,
  type Slot,
  type Station,
} from "./data";

export type Screen = "menu" | "playing" | "paused" | "dead";
export type Overlay = "none" | "inventory" | "craft" | "map" | "chat" | "lock";

export type Prompt = { label: string; key: string } | null;

export type Toast = { id: number; text: string };

export type GameHud = {
  lang: Lang;
  screen: Screen;
  overlay: Overlay;
  training: boolean;
  outfit: number;
  hasSave: boolean;
  locked: boolean;
  health: number;
  hunger: number;
  thirst: number;
  stamina: number;
  armor: number;
  temp: number;
  timeOfDay: number;
  raining: boolean;
  fps: number;
  session: number;
  yaw: number;
  kills: number;
  score: number;
  inventory: Slot[];
  hotIndex: number;
  prompt: Prompt;
  toasts: Toast[];
  quests: Record<QuestId, number>;
  nearStation: Station;
  interactOpen: boolean;
  minimap: string;
  aimOk: boolean;
  hurt: number;
  hitMark: number;
  combo: number;
  blocking: boolean;
  serverId: ServerId;
  lockAsk: { id: number; mode: "set" | "open" } | null;
};

type Actions = {
  setLang: (l: Lang) => void;
  setServer: (id: ServerId) => void;
  setOutfit: (n: number) => void;
  setScreen: (s: Screen) => void;
  setOverlay: (o: Overlay) => void;
  patch: (p: Partial<GameHud>) => void;
  toast: (text: string) => void;
};

const emptyInv = (): Slot[] => Array.from({ length: INV_SIZE + HOTBAR }, () => null);

export const useGameStore = create<GameHud & Actions>((set, get) => ({
  lang: "ar",
  screen: "menu",
  overlay: "none",
  training: false,
  outfit: 0,
  hasSave: false,
  locked: false,
  health: 100,
  hunger: 100,
  thirst: 100,
  stamina: 100,
  armor: 0,
  temp: 58,
  timeOfDay: 0.28,
  raining: false,
  fps: 60,
  session: 0,
  yaw: 0,
  kills: 0,
  score: 0,
  inventory: emptyInv(),
  hotIndex: 0,
  prompt: null,
  toasts: [],
  quests: { wood: 0, axe: 0, tree: 0, hunt: 0, base: 0, raid: 0 },
  nearStation: "hand",
  interactOpen: false,
  minimap: "",
  aimOk: false,
  hurt: 0,
  hitMark: 0,
  combo: 0,
  blocking: false,
  serverId: SERVERS[0].id,
  lockAsk: null,
  setLang: (lang) => set({ lang }),
  setServer: (serverId) => set({ serverId }),
  setOutfit: (outfit) => set({ outfit }),
  setScreen: (screen) => set({ screen }),
  setOverlay: (overlay) => set({ overlay }),
  patch: (p) => set(p),
  toast: (text) => {
    const id = Date.now() + Math.random();
    set({ toasts: [...get().toasts.slice(-4), { id, text }] });
    setTimeout(() => {
      set({ toasts: get().toasts.filter((t) => t.id !== id) });
    }, 2800);
  },
}));

export function t() {
  return COPY[useGameStore.getState().lang];
}

export function freshInventory(training: boolean): Slot[] {
  const inv = emptyInv();
  const give = (i: number, id: ItemId, count: number) => {
    inv[i] = { id, count };
  };
  if (training) {
    give(INV_SIZE + 0, "axe", 1);
    give(INV_SIZE + 1, "pickaxe", 1);
    give(0, "wood", 20);
    give(1, "stone", 16);
    give(2, "berries", 8);
    give(3, "fiber", 12);
    give(4, "herbs", 6);
  } else {
    give(INV_SIZE + 0, "knife", 1);
    give(0, "berries", 4);
    give(1, "fiber", 4);
  }
  return inv;
}
