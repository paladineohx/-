
export enum GameStatus {
  START,
  PLAYING,
  WON,
  LOST,
  LEVEL_UP
}

export interface Point {
  x: number;
  y: number;
}

export interface Rocket {
  id: string;
  start: Point;
  current: Point;
  target: Point;
  speed: number;
  angle: number;
}

export interface Missile {
  id: string;
  start: Point;
  current: Point;
  target: Point;
  speed: number;
  angle: number;
  towerId: number;
}

export interface Explosion {
  id: string;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  growing: boolean;
}

export interface City {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  health: number;
  maxHealth: number;
  destroyed: boolean;
}

export interface Tower {
  id: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  ammo: number;
  maxAmmo: number;
  health: number;
  maxHealth: number;
  destroyed: boolean;
}

export type Language = 'zh' | 'en';

export interface Meteor {
  id: string;
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  angle: number;
}

export interface Plane {
  id: string;
  x: number;
  y: number;
  targetY: number;
  health: number;
  maxHealth: number;
  speed: number;
  direction: number; // 1 for right, -1 for left
  destroyed: boolean;
  lastFired: number;
}
