export const SERVERS = [
  { id: "eu-1", ar: "eu-1", en: "eu-1", blurbAr: "أوروبا", blurbEn: "Europe", adminOnly: false },
  { id: "na-1", ar: "na-1", en: "na-1", blurbAr: "أمريكا", blurbEn: "North America", adminOnly: false },
  { id: "as-1", ar: "as-1", en: "as-1", blurbAr: "آسيا", blurbEn: "Asia", adminOnly: false },
  { id: "czar", ar: "czar", en: "czar", blurbAr: "للأدمن فقط", blurbEn: "Admins only", adminOnly: true },
] as const;

export type ServerId = (typeof SERVERS)[number]["id"];

export type Lang = "ar" | "en";
export type ItemId =
  | "wood"
  | "stone"
  | "iron"
  | "sulfur"
  | "fiber"
  | "cloth"
  | "herbs"
  | "berries"
  | "meat"
  | "fish"
  | "gold"
  | "coal"
  | "ironIngot"
  | "cookedMeat"
  | "cookedFish"
  | "bandage"
  | "waterskin"
  | "axe"
  | "pickaxe"
  | "hammer"
  | "knife"
  | "bow"
  | "arrows"
  | "pistol"
  | "rifle"
  | "grenade"
  | "ammo"
  | "spear"
  | "campfire"
  | "foundation"
  | "wall"
  | "door"
  | "roof"
  | "stairs"
  | "window"
  | "crate"
  | "furnace"
  | "plant"
  | "armor"
  | "workbench";

export type Slot = { id: ItemId; count: number } | null;

export type WeaponKind = "melee" | "bow" | "gun" | "throw" | "tool" | "build" | "none";

export type ItemDef = {
  id: ItemId;
  icon: string;
  stack: number;
  kind: WeaponKind;
  damage?: number;
  range?: number;
  cooldown?: number;
  ammo?: ItemId;
  harvest?: "tree" | "rock" | "any";
  heal?: number;
  hunger?: number;
  thirst?: number;
  armor?: number;
  place?: ItemId;
};

export const ITEM: Record<ItemId, ItemDef> = {
  wood: { id: "wood", icon: "/icons/wood.png", stack: 60, kind: "none" },
  stone: { id: "stone", icon: "/icons/stone.png", stack: 60, kind: "none" },
  iron: { id: "iron", icon: "/icons/iron.png", stack: 40, kind: "none" },
  sulfur: { id: "sulfur", icon: "/icons/sulfur.png", stack: 40, kind: "none" },
  fiber: { id: "fiber", icon: "/icons/fiber.png", stack: 60, kind: "none" },
  cloth: { id: "cloth", icon: "/icons/cloth.png", stack: 40, kind: "none" },
  herbs: { id: "herbs", icon: "/icons/herbs.png", stack: 40, kind: "none", heal: 8 },
  berries: { id: "berries", icon: "/icons/berries.png", stack: 20, kind: "none", hunger: 12, thirst: 6 },
  meat: { id: "meat", icon: "/icons/meat.png", stack: 20, kind: "none", hunger: 10 },
  fish: { id: "fish", icon: "/icons/fish.png", stack: 20, kind: "none", hunger: 10 },
  gold: { id: "gold", icon: "/icons/gold.png", stack: 30, kind: "none" },
  coal: { id: "coal", icon: "/icons/coal.png", stack: 40, kind: "none" },
  ironIngot: { id: "ironIngot", icon: "/icons/ironIngot.png", stack: 40, kind: "none" },
  cookedMeat: { id: "cookedMeat", icon: "/icons/cookedMeat.png", stack: 20, kind: "none", hunger: 32, heal: 6 },
  cookedFish: { id: "cookedFish", icon: "/icons/cookedFish.png", stack: 20, kind: "none", hunger: 28, thirst: 4, heal: 4 },
  bandage: { id: "bandage", icon: "/icons/bandage.png", stack: 10, kind: "none", heal: 40 },
  waterskin: { id: "waterskin", icon: "/icons/waterskin.png", stack: 5, kind: "none", thirst: 45 },
  axe: { id: "axe", icon: "/icons/axe.png", stack: 1, kind: "tool", damage: 22, range: 2.6, cooldown: 0.55, harvest: "tree" },
  pickaxe: { id: "pickaxe", icon: "/icons/pickaxe.png", stack: 1, kind: "tool", damage: 20, range: 2.6, cooldown: 0.6, harvest: "rock" },
  hammer: { id: "hammer", icon: "/icons/hammer.png", stack: 1, kind: "build", damage: 16, range: 2.4, cooldown: 0.5 },
  knife: { id: "knife", icon: "/icons/knife.png", stack: 1, kind: "melee", damage: 18, range: 2.1, cooldown: 0.4 },
  bow: { id: "bow", icon: "/icons/bow.png", stack: 1, kind: "bow", damage: 34, range: 55, cooldown: 0.7, ammo: "arrows" },
  arrows: { id: "arrows", icon: "/icons/arrows.png", stack: 40, kind: "none" },
  pistol: { id: "pistol", icon: "/icons/pistol.png", stack: 1, kind: "gun", damage: 38, range: 70, cooldown: 0.28, ammo: "ammo" },
  rifle: { id: "rifle", icon: "/icons/rifle.png", stack: 1, kind: "gun", damage: 52, range: 95, cooldown: 0.12, ammo: "ammo" },
  grenade: { id: "grenade", icon: "/icons/grenade.png", stack: 8, kind: "throw", damage: 80, range: 28, cooldown: 0.9 },
  ammo: { id: "ammo", icon: "/icons/ammo.png", stack: 60, kind: "none" },
  spear: { id: "spear", icon: "/icons/spear.png", stack: 1, kind: "melee", damage: 28, range: 3.2, cooldown: 0.65 },
  campfire: { id: "campfire", icon: "/icons/campfire.png", stack: 8, kind: "build", place: "campfire" },
  foundation: { id: "foundation", icon: "/icons/foundation.png", stack: 20, kind: "build", place: "foundation" },
  wall: { id: "wall", icon: "/icons/wall.png", stack: 30, kind: "build", place: "wall" },
  door: { id: "door", icon: "/icons/door.png", stack: 12, kind: "build", place: "door" },
  roof: { id: "roof", icon: "/icons/roof.png", stack: 20, kind: "build", place: "roof" },
  stairs: { id: "stairs", icon: "/icons/stairs.png", stack: 16, kind: "build", place: "stairs" },
  window: { id: "window", icon: "/icons/window.png", stack: 16, kind: "build", place: "window" },
  crate: { id: "crate", icon: "/icons/crate.png", stack: 8, kind: "build", place: "crate" },
  furnace: { id: "furnace", icon: "/icons/furnace.png", stack: 4, kind: "build", place: "furnace" },
  plant: { id: "plant", icon: "/icons/plant.png", stack: 12, kind: "build", place: "plant" },
  armor: { id: "armor", icon: "/icons/armor.png", stack: 4, kind: "none", armor: 45 },
  workbench: { id: "workbench", icon: "/icons/workbench.png", stack: 4, kind: "build", place: "workbench" },
};

export type Station = "hand" | "fire" | "furnace" | "bench";

export type Recipe = {
  id: string;
  out: ItemId;
  count: number;
  station: Station;
  cost: Partial<Record<ItemId, number>>;
};

export const RECIPES: Recipe[] = [
  { id: "axe", out: "axe", count: 1, station: "hand", cost: { wood: 8, stone: 4 } },
  { id: "pickaxe", out: "pickaxe", count: 1, station: "hand", cost: { wood: 8, stone: 6 } },
  { id: "hammer", out: "hammer", count: 1, station: "hand", cost: { wood: 6, stone: 4 } },
  { id: "knife", out: "knife", count: 1, station: "hand", cost: { wood: 2, stone: 4 } },
  { id: "spear", out: "spear", count: 1, station: "hand", cost: { wood: 10, fiber: 4, stone: 2 } },
  { id: "bow", out: "bow", count: 1, station: "hand", cost: { wood: 10, fiber: 8 } },
  { id: "arrows", out: "arrows", count: 6, station: "hand", cost: { wood: 2, fiber: 2, stone: 1 } },
  { id: "cloth", out: "cloth", count: 1, station: "hand", cost: { fiber: 4 } },
  { id: "bandage", out: "bandage", count: 1, station: "hand", cost: { cloth: 1, herbs: 2 } },
  { id: "waterskin", out: "waterskin", count: 1, station: "hand", cost: { cloth: 2, fiber: 4 } },
  { id: "campfire", out: "campfire", count: 1, station: "hand", cost: { wood: 10, stone: 6 } },
  { id: "foundation", out: "foundation", count: 1, station: "hand", cost: { wood: 10 } },
  { id: "wall", out: "wall", count: 1, station: "hand", cost: { wood: 8 } },
  { id: "door", out: "door", count: 1, station: "hand", cost: { wood: 8, fiber: 2 } },
  { id: "roof", out: "roof", count: 1, station: "hand", cost: { wood: 8 } },
  { id: "stairs", out: "stairs", count: 1, station: "hand", cost: { wood: 10 } },
  { id: "window", out: "window", count: 1, station: "hand", cost: { wood: 6 } },
  { id: "crate", out: "crate", count: 1, station: "hand", cost: { wood: 12 } },
  { id: "furnace", out: "furnace", count: 1, station: "hand", cost: { stone: 20, wood: 5 } },
  { id: "workbench", out: "workbench", count: 1, station: "hand", cost: { wood: 20, stone: 8 } },
  { id: "plant", out: "plant", count: 1, station: "hand", cost: { wood: 4, fiber: 6, herbs: 2 } },
  { id: "armor", out: "armor", count: 1, station: "bench", cost: { cloth: 4, ironIngot: 3 } },
  { id: "pistol", out: "pistol", count: 1, station: "bench", cost: { ironIngot: 8, wood: 4, sulfur: 2 } },
  { id: "rifle", out: "rifle", count: 1, station: "bench", cost: { ironIngot: 12, wood: 6, sulfur: 4 } },
  { id: "ammo", out: "ammo", count: 8, station: "bench", cost: { ironIngot: 1, sulfur: 1, coal: 1 } },
  { id: "grenade", out: "grenade", count: 1, station: "bench", cost: { ironIngot: 2, sulfur: 4 } },
  { id: "cookedMeat", out: "cookedMeat", count: 1, station: "fire", cost: { meat: 1 } },
  { id: "cookedFish", out: "cookedFish", count: 1, station: "fire", cost: { fish: 1 } },
  { id: "ironIngot", out: "ironIngot", count: 1, station: "furnace", cost: { iron: 2, coal: 1 } },
];

export const INV_SIZE = 40;
export const HOTBAR = 8;
export const WORLD_SIZE = 220;
export const ISLAND_R = 96;
export const WATER_Y = 0.12;
export const EYE = 1.62;

export const NAME_COLORS = ["#ffffff", "#f2c14e", "#e23d3d", "#3ec6e0", "#7dce6a", "#d07adf"] as const;

export const OUTFITS = [
  { id: 0, arm: "#6b7a4a", accent: "#c9a227" },
  { id: 1, arm: "#4a5a3a", accent: "#8a6a3a" },
  { id: 2, arm: "#7a6a48", accent: "#d4b56a" },
  { id: 3, arm: "#5a4a3a", accent: "#c4a574" },
] as const;

export const COPY = {
  ar: {
    title: "TRIBALS",
    tag: "احمل · ابنِ · قاتل · كن الأفضل",
    survive: "بقاء",
    train: "تدريب",
    play: "ادخل الجزيرة",
    resume: "متابعة",
    newGame: "عالم جديد",
    settings: "إعدادات",
    lang: "English",
    click: "انقر للعب — WASD للحركة · الفأرة للنظر",
    paused: "إيقاف",
    dead: "سقطت",
    respawn: "العودة للشاطئ",
    inv: "المخزون",
    craft: "الحرف",
    build: "البناء",
    map: "الخريطة",
    missions: "المهام",
    health: "الصحة",
    hunger: "الجوع",
    thirst: "العطش",
    stamina: "الطاقة",
    armor: "الدرع",
    temp: "الحرارة",
    make: "صنع",
    sens: "حساسية الفأرة",
    fov: "مجال الرؤية",
    bob: "تمايل الرأس",
    particles: "المطر والجزيئات",
    viewDist: "مسافة الرؤية",
    qLow: "منخفض",
    qMed: "متوسط",
    qHigh: "عالٍ",
    need: "تحتاج",
    empty: "فارغ",
    outfit: "الزي",
    outfits: ["كشافة", "صياد", "جوال", "دليل"],
    stationHand: "يدوي",
    stationFire: "موقد",
    stationFurnace: "فرن",
    stationBench: "طاولة عمل",
    north: "ش",
    controls: "حركة WASD · قفز مسافة · ركض Shift · مراوغة Q · صد F · تفاعل E · مخزون Tab · حرف C · بناء B · خريطة M · دردشة T",
    drink: "اشرب من الماء",
    chop: "اقطع",
    mine: "عدّن",
    loot: "التقط",
    open: "افتح",
    cook: "اطبخ / صهر",
    place: "ضع",
    attack: "هاجم",
    pickup: "حصلت على",
    night: "الليل يسقط على الجزيرة",
    rain: "بدأ المطر",
    tutorial: "اجمع موارد، اصنع فأساً، وابنِ ملجأً قبل الليل. الحيوانات لا تهاجم إلا إذا ضربتها.",
    login: "تسجيل الدخول",
    signup: "حساب جديد",
    account: "الحساب",
    guest: "ضيف — العب محلياً",
    online: "أونلاين",
    chat: "الدردشة",
    players: "لاعبون",
    send: "إرسال",
    enterChat: "أدمن: /godmode · /staffmode · /kick اسم · /ban اسم",
    servers: "السيرفرات",
    czarOnly: "سيرفر czar للأدمن فقط",
    addAdmin: "إضافة أدمن",
    adminNames: "الأدمنز",
    adminAdded: "تمت إضافة الأدمن",
    playerMissing: "اللاعب غير موجود",
    founderOnly: "هذا لحساب sultan1v4 فقط",
    banned: "هذا الحساب محظور من السيرفر",
    kicked: "تم طردك من السيرفر",
    godOn: "وضع الإله: صحة لا نهائية",
    godOff: "وضع الإله متوقف",
    staffOn: "وضع الطاقم: مخفي وغير ظاهر أونلاين",
    staffOff: "ظهرت من جديد",
    kickedThem: "تم طرد",
    bannedThem: "تم حظر",
    unbannedThem: "رُفع الحظر عن",
    leaveTribe: "غادرت القبيلة",
    adminBadge: "أدمن",
    watchAd: "شاهد إعلاناً",
    adReward: "خشب ×8",
    adWait: "الإعلان",
    subPrice: "اشتراك 12$ شهرياً يلون اسمك ويزيل الإعلانات",
    subLater: "لا ترسل رقم البطاقة هنا. الدفع يتفعل لما تربط بوابة دفع.",
    nameColor: "لون الاسم",
    kills: "قتل",
    headshot: "ضربة رأس",
    blocked: "صد",
    combo: "كومبو",
    score: "نقاط",
    day: "نهار",
    dusk: "غروب",
    nightLabel: "ليل",
    storm: "مطر",
    quests: [
      { id: "wood", title: "اجمع 12 خشباً", target: 12 },
      { id: "axe", title: "اصنع فأساً", target: 1 },
      { id: "tree", title: "اقطع شجرة", target: 1 },
      { id: "hunt", title: "اصطد حيواناً", target: 1 },
      { id: "base", title: "ضع أساساً", target: 1 },
      { id: "raid", title: "اهزم مغيراً", target: 1 },
    ],
    items: {
      wood: "خشب",
      stone: "حجر",
      iron: "حديد",
      sulfur: "كبريت",
      fiber: "ألياف",
      cloth: "قماش",
      herbs: "أعشاب",
      berries: "توت",
      meat: "لحم",
      fish: "سمك",
      gold: "معدن نادر",
      coal: "فحم",
      ironIngot: "سبيكة حديد",
      cookedMeat: "لحم مشوي",
      cookedFish: "سمك مشوي",
      bandage: "ضمادة",
      waterskin: "قربة ماء",
      axe: "فأس",
      pickaxe: "معول",
      hammer: "مطرقة",
      knife: "سكين",
      bow: "قوس",
      arrows: "سهام",
      pistol: "مسدس",
      rifle: "بندقية",
      grenade: "قنبلة",
      ammo: "ذخيرة",
      spear: "رمح",
      campfire: "موقد",
      foundation: "أساس",
      wall: "جدار",
      door: "باب",
      roof: "سقف",
      stairs: "درج",
      window: "نافذة",
      crate: "مخزن",
      furnace: "فرن",
      plant: "شتلة",
      armor: "درع",
      workbench: "طاولة عمل",
    } as Record<ItemId, string>,
  },
  en: {
    title: "TRIBALS",
    tag: "Survive · Build · Fight · Be the best",
    survive: "Survive",
    train: "Training",
    play: "Enter the island",
    resume: "Continue",
    newGame: "New world",
    settings: "Settings",
    lang: "العربية",
    click: "Click to play — WASD move · mouse look",
    paused: "Paused",
    dead: "You fell",
    respawn: "Return to shore",
    inv: "Inventory",
    craft: "Crafting",
    build: "Build",
    map: "Map",
    missions: "Missions",
    health: "Health",
    hunger: "Hunger",
    thirst: "Thirst",
    stamina: "Stamina",
    armor: "Armor",
    temp: "Heat",
    make: "Craft",
    sens: "Mouse sensitivity",
    fov: "Field of view",
    bob: "Head bob",
    particles: "Rain particles",
    viewDist: "View distance",
    qLow: "Low",
    qMed: "Medium",
    qHigh: "High",
    need: "Need",
    empty: "Empty",
    outfit: "Outfit",
    outfits: ["Scout", "Hunter", "Ranger", "Guide"],
    stationHand: "Hands",
    stationFire: "Fire",
    stationFurnace: "Furnace",
    stationBench: "Workbench",
    north: "N",
    controls: "WASD move · Space jump · Shift sprint · Q dodge · F block · E interact · Tab inventory · C craft · B build · M map · T chat",
    drink: "Drink from water",
    chop: "Chop",
    mine: "Mine",
    loot: "Pick up",
    open: "Open",
    cook: "Cook / smelt",
    place: "Place",
    attack: "Attack",
    pickup: "Got",
    night: "Night falls over the island",
    rain: "Rain rolls in",
    tutorial: "Gather resources, craft an axe, and raise a shelter before night. Wildlife only fights back after you hit it.",
    login: "Sign in",
    signup: "Create account",
    account: "Account",
    guest: "Guest — play locally",
    online: "Online",
    chat: "Chat",
    players: "Players",
    send: "Send",
    enterChat: "Admin: /godmode · /staffmode · /kick name · /ban name",
    servers: "Servers",
    czarOnly: "czar is admins only",
    addAdmin: "Add admin",
    adminNames: "Admins",
    adminAdded: "Admin added",
    playerMissing: "Player not found",
    founderOnly: "Only sultan1v4 can do this",
    banned: "This account is banned",
    kicked: "You were kicked",
    godOn: "God mode: infinite health",
    godOff: "God mode off",
    staffOn: "Staff mode: invisible and hidden from online",
    staffOff: "You are visible again",
    kickedThem: "Kicked",
    bannedThem: "Banned",
    unbannedThem: "Unbanned",
    leaveTribe: "Left the tribe",
    adminBadge: "Admin",
    watchAd: "Watch an ad",
    adReward: "Wood ×8",
    adWait: "Ad",
    subPrice: "$12/month colors your name and removes ads",
    subLater: "Do not send a card number here. Checkout connects when a payment provider is linked.",
    nameColor: "Name color",
    kills: "Kills",
    headshot: "Headshot",
    blocked: "Block",
    combo: "Combo",
    score: "Score",
    day: "Day",
    dusk: "Dusk",
    nightLabel: "Night",
    storm: "Rain",
    quests: [
      { id: "wood", title: "Gather 12 wood", target: 12 },
      { id: "axe", title: "Craft an axe", target: 1 },
      { id: "tree", title: "Chop a tree", target: 1 },
      { id: "hunt", title: "Hunt an animal", target: 1 },
      { id: "base", title: "Place a foundation", target: 1 },
      { id: "raid", title: "Defeat a raider", target: 1 },
    ],
    items: {
      wood: "Wood",
      stone: "Stone",
      iron: "Iron ore",
      sulfur: "Sulfur",
      fiber: "Fiber",
      cloth: "Cloth",
      herbs: "Herbs",
      berries: "Berries",
      meat: "Meat",
      fish: "Fish",
      gold: "Rare ore",
      coal: "Coal",
      ironIngot: "Iron ingot",
      cookedMeat: "Cooked meat",
      cookedFish: "Cooked fish",
      bandage: "Bandage",
      waterskin: "Waterskin",
      axe: "Axe",
      pickaxe: "Pickaxe",
      hammer: "Hammer",
      knife: "Knife",
      bow: "Bow",
      arrows: "Arrows",
      pistol: "Pistol",
      rifle: "Rifle",
      grenade: "Grenade",
      ammo: "Ammo",
      spear: "Spear",
      campfire: "Campfire",
      foundation: "Foundation",
      wall: "Wall",
      door: "Door",
      roof: "Roof",
      stairs: "Stairs",
      window: "Window",
      crate: "Crate",
      furnace: "Furnace",
      plant: "Plant",
      armor: "Armor",
      workbench: "Workbench",
    } as Record<ItemId, string>,
  },
} as const;

export type QuestId = "wood" | "axe" | "tree" | "hunt" | "base" | "raid";
