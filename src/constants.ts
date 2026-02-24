
export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 600;

export const TOWER_POSITIONS = [
  { id: 0, x: 40, y: 560, maxAmmo: 300 },
  { id: 1, x: 220, y: 560, maxAmmo: 300 },
  { id: 2, x: 400, y: 560, maxAmmo: 300 },
  { id: 3, x: 580, y: 560, maxAmmo: 300 },
  { id: 4, x: 760, y: 560, maxAmmo: 300 },
];

export const CITY_POSITIONS = [
  { id: 0, x: 110, y: 570 },
  { id: 1, x: 160, y: 570 },
  { id: 2, x: 300, y: 570 },
  { id: 3, x: 500, y: 570 },
  { id: 4, x: 650, y: 570 },
  { id: 5, x: 700, y: 570 },
];

export const EXPLOSION_MAX_RADIUS = 70;
export const EXPLOSION_SPEED = 1.5;
export const MISSILE_SPEED = 8;
export const ROCKET_SPEED_MIN = 0.5;
export const ROCKET_SPEED_MAX = 1.5;
export const SPAWN_RATE = 0.015; // Probability per frame

export const SCORE_PER_ROCKET = 20;
export const WIN_SCORE = 5000;

export const TRANSLATIONS = {
  zh: {
    title: "新型防御",
    start: "开始游戏",
    restart: "再玩一次",
    win: "胜利！你成功保卫了地球",
    loss: "失败！所有炮台已被摧毁",
    score: "得分",
    ammo: "弹药",
    instructions: "点击屏幕拦截敌方火箭。保护城市和炮台！",
    targetScore: "目标分数",
    level: "关卡",
    nextLevel: "下一关",
  },
  en: {
    title: "New Defense",
    start: "Start Game",
    restart: "Play Again",
    win: "Victory! You defended the Earth",
    loss: "Defeat! All towers destroyed",
    score: "Score",
    ammo: "Ammo",
    instructions: "Click to intercept rockets. Protect cities and towers!",
    targetScore: "Target Score",
    level: "Level",
    nextLevel: "Next Level",
  }
};
