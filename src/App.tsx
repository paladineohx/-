/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Target, Zap, Trophy, AlertTriangle, Globe } from 'lucide-react';
import { 
  GameStatus, 
  Rocket, 
  Missile, 
  Explosion, 
  City, 
  Tower, 
  Language,
  Meteor,
  Plane
} from './types';
import { 
  GAME_WIDTH, 
  GAME_HEIGHT, 
  TOWER_POSITIONS, 
  CITY_POSITIONS, 
  EXPLOSION_MAX_RADIUS, 
  EXPLOSION_SPEED, 
  MISSILE_SPEED, 
  ROCKET_SPEED_MIN, 
  ROCKET_SPEED_MAX, 
  SPAWN_RATE, 
  SCORE_PER_ROCKET, 
  WIN_SCORE, 
  TRANSLATIONS 
} from './constants';

export default function App() {
  const [status, setStatus] = useState<GameStatus>(GameStatus.START);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lang, setLang] = useState<Language>('zh');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Game state refs for the loop
  const rocketsRef = useRef<Rocket[]>([]);
  const missilesRef = useRef<Missile[]>([]);
  const explosionsRef = useRef<Explosion[]>([]);
  const citiesRef = useRef<City[]>([]);
  const towersRef = useRef<Tower[]>([]);
  const meteorsRef = useRef<Meteor[]>([]);
  const planesRef = useRef<Plane[]>([]);
  const formationTimerRef = useRef(0);
  const currentFormationRef = useRef(0);
  const scoreRef = useRef(0);
  const requestRef = useRef<number>(null);

const t = TRANSLATIONS[lang];

  const distToSegment = (p: {x: number, y: number}, v: {x: number, y: number}, w: {x: number, y: number}) => {
    const l2 = Math.pow(v.x - w.x, 2) + Math.pow(v.y - w.y, 2);
    if (l2 === 0) return Math.sqrt(Math.pow(p.x - v.x, 2) + Math.pow(p.y - v.y, 2));
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.sqrt(Math.pow(p.x - (v.x + t * (w.x - v.x)), 2) + Math.pow(p.y - (v.y + t * (w.y - v.y)), 2));
  };

  const initGame = useCallback((resetLevel = true, preserveAmmo = false) => {
    rocketsRef.current = [];
    missilesRef.current = [];
    explosionsRef.current = [];
    
    // Only reset cities/towers if starting a new game or if they were destroyed
    // Actually, Missile Command usually resets ammo but keeps destroyed cities.
    // But the user said "10 levels", so let's reset everything for a fresh level feel.
    citiesRef.current = CITY_POSITIONS.map(p => ({ 
      ...p, 
      width: 40, 
      height: 20, 
      health: 2, 
      maxHealth: 2, 
      destroyed: false 
    }));

    const currentTowers = [...towersRef.current];
    towersRef.current = TOWER_POSITIONS.map((p, i) => {
      const existingTower = currentTowers.find(t => t.id === p.id);
      return { 
        ...p, 
        targetX: p.x,
        targetY: p.y,
        ammo: (preserveAmmo && existingTower) ? existingTower.ammo : p.maxAmmo, 
        health: 5, 
        maxHealth: 5, 
        destroyed: false 
      };
    });

    meteorsRef.current = [];
    planesRef.current = [];
    formationTimerRef.current = 0;
    currentFormationRef.current = 0;
    
    // Score always resets every level as per user request
    setScore(0);
    scoreRef.current = 0;

    if (resetLevel) {
      setLevel(1);
    }
  }, []);

  const spawnRocket = useCallback(() => {
    const levelSpawnRate = SPAWN_RATE * (1 + (level - 1) * 0.2);
    if (Math.random() > levelSpawnRate) return;

    // Only fire from active planes
    const activePlanes = planesRef.current.filter(p => !p.destroyed);
    if (activePlanes.length === 0) return;

    const plane = activePlanes[Math.floor(Math.random() * activePlanes.length)];
    
    // Rate limit firing per plane
    const now = Date.now();
    const fireCooldown = Math.max(300, 1000 - (level - 1) * 100);
    if (now - plane.lastFired < fireCooldown) return;
    plane.lastFired = now;

    const targets = [...citiesRef.current.filter(c => !c.destroyed), ...towersRef.current.filter(t => !t.destroyed)];
    if (targets.length === 0) return;

    const target = targets[Math.floor(Math.random() * targets.length)];
    const targetX = target.x + (Math.random() * 20 - 10);
    const targetY = target.y;

    const angle = Math.atan2(targetY - plane.y, targetX - plane.x);
    const speedMultiplier = 1 + (level - 1) * 0.15;
    const speed = (ROCKET_SPEED_MIN + Math.random() * (ROCKET_SPEED_MAX - ROCKET_SPEED_MIN)) * speedMultiplier;

    rocketsRef.current.push({
      id: Math.random().toString(36).substr(2, 9),
      start: { x: plane.x, y: plane.y },
      current: { x: plane.x, y: plane.y },
      target: { x: targetX, y: targetY },
      speed,
      angle
    });
  }, [level]);

  const spawnPlanes = useCallback(() => {
    const maxPlanes = 5 + Math.floor(level / 2);
    if (planesRef.current.filter(p => !p.destroyed).length >= maxPlanes) return;
    
    const levelSpawnRate = 0.02 * (1 + (level - 1) * 0.1);
    if (Math.random() > levelSpawnRate) return;

    const formationType = Math.floor(Math.random() * 3); // 0: single, 1: V-shape, 2: line
    const direction = Math.random() < 0.5 ? 1 : -1;
    const startX = direction === 1 ? -50 : GAME_WIDTH + 50;
    const baseTargetY = 50 + Math.random() * 150;
    const speed = (1 + Math.random() * 1.5) * (1 + (level - 1) * 0.1);
    const planeHealth = 7 + (level - 1);

    if (formationType === 0) {
      planesRef.current.push({
        id: Math.random().toString(36).substr(2, 9),
        x: startX,
        y: baseTargetY,
        targetY: baseTargetY,
        health: planeHealth,
        maxHealth: planeHealth,
        speed,
        direction,
        destroyed: false,
        lastFired: 0
      });
    } else if (formationType === 1) {
      // V-shape (3 planes)
      for (let i = 0; i < 3; i++) {
        const offset = i === 0 ? 0 : (i === 1 ? -40 : 40);
        const xOffset = i === 0 ? 0 : -direction * 40;
        planesRef.current.push({
          id: Math.random().toString(36).substr(2, 9),
          x: startX + xOffset,
          y: baseTargetY + offset,
          targetY: baseTargetY + offset,
          health: planeHealth,
          maxHealth: planeHealth,
          speed,
          direction,
          destroyed: false,
          lastFired: 0
        });
      }
    } else {
      // Line (3 planes)
      for (let i = 0; i < 3; i++) {
        const xOffset = -direction * i * 60;
        planesRef.current.push({
          id: Math.random().toString(36).substr(2, 9),
          x: startX + xOffset,
          y: baseTargetY,
          targetY: baseTargetY,
          health: planeHealth,
          maxHealth: planeHealth,
          speed,
          direction,
          destroyed: false,
          lastFired: 0
        });
      }
    }
  }, [level]);

  const updatePlayerFormation = useCallback(() => {
    formationTimerRef.current++;
    if (formationTimerRef.current > 400) { // Change formation every ~7 seconds
      formationTimerRef.current = 0;
      currentFormationRef.current = (currentFormationRef.current + 1) % 3;
    }

    const formation = currentFormationRef.current;
    towersRef.current.forEach((tower, i) => {
      if (tower.destroyed) return;

      const basePos = TOWER_POSITIONS[i];
      let tx = basePos.x;
      let ty = basePos.y - 20; // Slightly above ground

      if (formation === 1) { // V-shape
        const mid = Math.floor(TOWER_POSITIONS.length / 2);
        const dist = Math.abs(i - mid);
        ty = basePos.y - 30 - dist * 40;
      } else if (formation === 2) { // Arc
        const mid = (TOWER_POSITIONS.length - 1) / 2;
        const offset = Math.pow(i - mid, 2) * 8;
        ty = basePos.y - 80 + offset;
      }

      tower.targetX = tx;
      tower.targetY = ty;

      // Smoothly move towards target
      tower.x += (tower.targetX - tower.x) * 0.03;
      tower.y += (tower.targetY - tower.y) * 0.03;
    });
  }, []);

  const handleCanvasClick = (e: React.MouseEvent | React.TouchEvent) => {
    if (status !== GameStatus.PLAYING) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    // Find closest tower with ammo
    let bestTower: Tower | null = null;
    let minDist = Infinity;

    towersRef.current.forEach(tower => {
      if (!tower.destroyed && tower.ammo > 0) {
        const dist = Math.abs(tower.x - x);
        if (dist < minDist) {
          minDist = dist;
          bestTower = tower;
        }
      }
    });

    if (bestTower) {
      const tower = bestTower as Tower;
      tower.ammo -= 1;
      
      const angle = Math.atan2(y - tower.y, x - tower.x);
      missilesRef.current.push({
        id: Math.random().toString(36).substr(2, 9),
        start: { x: tower.x, y: tower.y },
        current: { x: tower.x, y: tower.y },
        target: { x, y },
        speed: MISSILE_SPEED,
        angle,
        towerId: tower.id
      });
      
      // Update UI state for ammo
      setScore(scoreRef.current); // Just to trigger re-render if needed, though we use refs for performance
    }
  };

  const update = useCallback(() => {
    // Update Rockets
    rocketsRef.current.forEach((rocket, index) => {
      rocket.current.x += Math.cos(rocket.angle) * rocket.speed;
      rocket.current.y += Math.sin(rocket.angle) * rocket.speed;

      // Check if rocket hit target
      if (rocket.current.y >= rocket.target.y) {
        // Impact!
        explosionsRef.current.push({
          id: Math.random().toString(36).substr(2, 9),
          x: rocket.current.x,
          y: rocket.current.y,
          radius: 0,
          maxRadius: EXPLOSION_MAX_RADIUS,
          growing: true
        });

        // Damage cities or towers
        citiesRef.current.forEach(city => {
          if (!city.destroyed && Math.abs(city.x - rocket.current.x) < 30 && Math.abs(city.y - rocket.current.y) < 20) {
            city.health -= 1;
            if (city.health <= 0) city.destroyed = true;
          }
        });
        towersRef.current.forEach(tower => {
          if (!tower.destroyed && Math.abs(tower.x - rocket.current.x) < 30 && Math.abs(tower.y - rocket.current.y) < 20) {
            tower.health -= 1;
            if (tower.health <= 0) tower.destroyed = true;
          }
        });

        rocketsRef.current.splice(index, 1);
      }
    });

    // Update Missiles
    missilesRef.current.forEach((missile, index) => {
      missile.current.x += Math.cos(missile.angle) * missile.speed;
      missile.current.y += Math.sin(missile.angle) * missile.speed;

      // Laser damage logic: check collision with rockets and planes along the beam
      rocketsRef.current.forEach((rocket, rIndex) => {
        const dist = distToSegment(rocket.current, missile.start, missile.current);
        if (dist < 8) { // Laser hitbox
          rocketsRef.current.splice(rIndex, 1);
          scoreRef.current += SCORE_PER_ROCKET;
          setScore(scoreRef.current);
        }
      });

      planesRef.current.forEach((plane) => {
        if (!plane.destroyed) {
          const dist = distToSegment({ x: plane.x, y: plane.y }, missile.start, missile.current);
          if (dist < 12) {
            plane.health -= 0.03; // Continuous laser damage
            if (plane.health <= 0) {
              plane.destroyed = true;
              scoreRef.current += 10;
              setScore(scoreRef.current);
            }
          }
        }
      });

      const distToTarget = Math.sqrt(
        Math.pow(missile.target.x - missile.current.x, 2) + 
        Math.pow(missile.target.y - missile.current.y, 2)
      );

      if (distToTarget < missile.speed) {
        explosionsRef.current.push({
          id: Math.random().toString(36).substr(2, 9),
          x: missile.target.x,
          y: missile.target.y,
          radius: 0,
          maxRadius: EXPLOSION_MAX_RADIUS,
          growing: true
        });
        missilesRef.current.splice(index, 1);
      }
    });

    // Update Explosions
    explosionsRef.current.forEach((exp, index) => {
      if (exp.growing) {
        exp.radius += EXPLOSION_SPEED;
        if (exp.radius >= exp.maxRadius) exp.growing = false;
      } else {
        exp.radius -= EXPLOSION_SPEED;
        if (exp.radius <= 0) {
          explosionsRef.current.splice(index, 1);
        }
      }

      // Check collision with rockets
      rocketsRef.current.forEach((rocket, rIndex) => {
        const dist = Math.sqrt(Math.pow(rocket.current.x - exp.x, 2) + Math.pow(rocket.current.y - exp.y, 2));
        if (dist < exp.radius) {
          rocketsRef.current.splice(rIndex, 1);
          scoreRef.current += SCORE_PER_ROCKET;
          setScore(scoreRef.current);
        }
      });

      // Check collision with planes
      planesRef.current.forEach((plane) => {
        if (!plane.destroyed) {
          const dist = Math.sqrt(Math.pow(plane.x - exp.x, 2) + Math.pow(plane.y - exp.y, 2));
          if (dist < exp.radius) {
            // Use a simple hit cooldown or just reduce health once per explosion
            // To be simple and effective: reduce health by a small amount per frame
            // but since the user asked for 7 hits, let's make it 1 health per explosion hit
            // We can track which explosions have hit which planes
            plane.health -= 0.05; // Balanced for 7 "encounters" with explosions
            if (plane.health <= 0) {
              plane.destroyed = true;
              scoreRef.current += 10; // Bonus for destroying a plane (User requested 10)
              setScore(scoreRef.current);
            }
          }
        }
      });
    });

    // Check Win/Loss/LevelUp
    const levelTarget = level * 500;
    if (scoreRef.current >= levelTarget) {
      if (level >= 10) {
        setStatus(GameStatus.WON);
      } else {
        setStatus(GameStatus.LEVEL_UP);
      }
    }
    if (towersRef.current.every(t => t.destroyed)) {
      setStatus(GameStatus.LOST);
    }

    updatePlayerFormation();

    // Update Background Meteors
    if (Math.random() < 0.005) {
      const size = 20 + Math.random() * 40;
      const startX = Math.random() < 0.5 ? -size : GAME_WIDTH + size;
      const startY = Math.random() * (GAME_HEIGHT / 2);
      const targetX = startX < 0 ? GAME_WIDTH + size : -size;
      const targetY = startY + (Math.random() * 200 - 100);
      const angle = Math.atan2(targetY - startY, targetX - startX);
      const speed = 0.5 + Math.random() * 1.5;
      
      meteorsRef.current.push({
        id: Math.random().toString(36).substr(2, 9),
        x: startX,
        y: startY,
        size,
        speedX: Math.cos(angle) * speed,
        speedY: Math.sin(angle) * speed,
        angle
      });
    }

    meteorsRef.current.forEach((m, index) => {
      m.x += m.speedX;
      m.y += m.speedY;
      if (m.x < -200 || m.x > GAME_WIDTH + 200 || m.y < -200 || m.y > GAME_HEIGHT + 200) {
        meteorsRef.current.splice(index, 1);
      }
    });

    // Update Planes
    planesRef.current.forEach((p, index) => {
      if (!p.destroyed) {
        p.x += p.direction * p.speed;
        
        // Formation change: oscillate Y position
        p.y = p.targetY + Math.sin(p.x * 0.02) * 20;

        if (p.x < -100 || p.x > GAME_WIDTH + 100) {
          planesRef.current.splice(index, 1);
        }
      } else {
        // Falling animation for destroyed planes
        p.y += 3;
        p.x += p.direction * 0.5;
        if (p.y > GAME_HEIGHT) {
          planesRef.current.splice(index, 1);
        }
      }
    });

    spawnPlanes();
    spawnRocket();
  }, [spawnRocket, level]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Solar System Background
    // Deep space
    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Stars
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 100; i++) {
      const x = (Math.sin(i * 123.45) * 0.5 + 0.5) * GAME_WIDTH;
      const y = (Math.cos(i * 543.21) * 0.5 + 0.5) * GAME_HEIGHT;
      const size = Math.random() * 1.5;
      ctx.globalAlpha = 0.2 + Math.random() * 0.8;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // Distant Planets
    // Draw Background Meteors
    meteorsRef.current.forEach(m => {
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate(m.angle);
      
      // Meteor Body
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, m.size);
      grad.addColorStop(0, 'rgba(100, 80, 70, 0.4)');
      grad.addColorStop(1, 'rgba(40, 30, 20, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(0, 0, m.size, m.size * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Tail
      const tailGrad = ctx.createLinearGradient(-m.size, 0, -m.size * 4, 0);
      tailGrad.addColorStop(0, 'rgba(150, 100, 50, 0.2)');
      tailGrad.addColorStop(1, 'rgba(150, 100, 50, 0)');
      ctx.fillStyle = tailGrad;
      ctx.fillRect(-m.size * 4, -m.size * 0.3, m.size * 4, m.size * 0.6);
      
      ctx.restore();
    });

    // Saturn-like
    ctx.strokeStyle = 'rgba(200, 180, 150, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(100, 100, 40, 10, Math.PI / 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#d4af37';
    ctx.beginPath();
    ctx.arc(100, 100, 15, 0, Math.PI * 2);
    ctx.fill();

    // Mars-like
    ctx.fillStyle = '#c1440e';
    ctx.beginPath();
    ctx.arc(600, 150, 25, 0, Math.PI * 2);
    ctx.fill();

    // Draw Planes
    planesRef.current.forEach(p => {
      ctx.save();
      ctx.translate(p.x, p.y);
      if (p.direction === -1) ctx.scale(-1, 1);

      if (p.destroyed) {
        ctx.globalAlpha = 0.5;
        ctx.rotate(Math.PI / 4);
      }

      // Plane Body
      ctx.fillStyle = p.destroyed ? '#333' : '#555';
      ctx.beginPath();
      ctx.moveTo(-20, 0);
      ctx.lineTo(20, 0);
      ctx.lineTo(10, 10);
      ctx.lineTo(-10, 10);
      ctx.closePath();
      ctx.fill();

      // Cockpit
      ctx.fillStyle = '#88ccff';
      ctx.beginPath();
      ctx.arc(5, 0, 5, Math.PI, 0);
      ctx.fill();

      // Wings
      ctx.fillStyle = p.destroyed ? '#222' : '#444';
      ctx.beginPath();
      ctx.moveTo(-5, 0);
      ctx.lineTo(-15, -15);
      ctx.lineTo(5, -15);
      ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.fill();

      // Health bar for planes
      if (!p.destroyed) {
        const healthWidth = (p.health / p.maxHealth) * 30;
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(-15, -25, 30, 3);
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(-15, -25, healthWidth, 3);
      }

      ctx.restore();
    });

    // Earth-like (The target)
    ctx.fillStyle = '#2b65ec';
    ctx.beginPath();
    ctx.arc(400, 800, 300, 0, Math.PI * 2); // Large curve at bottom
    ctx.fill();
    ctx.fillStyle = '#4ecca3'; // Land
    ctx.beginPath();
    ctx.arc(350, 750, 100, 0, Math.PI * 2);
    ctx.fill();

    // Ground
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 580, GAME_WIDTH, 20);

    // Draw Cities (Buildings)
    citiesRef.current.forEach(city => {
      if (!city.destroyed) {
        ctx.fillStyle = '#4ecca3';
        // Main building body
        ctx.fillRect(city.x - 15, city.y - 35, 30, 45);
        // Side wings
        ctx.fillRect(city.x - 22, city.y - 20, 44, 30);
        
        // Roof detail
        ctx.fillStyle = '#3bb38d';
        ctx.fillRect(city.x - 5, city.y - 42, 10, 7);
        ctx.fillRect(city.x - 1, city.y - 50, 2, 8);

        // Windows
        ctx.fillStyle = '#f9ed69';
        for(let row = 0; row < 4; row++) {
          for(let col = 0; col < 2; col++) {
             ctx.fillRect(city.x - 10 + col * 12, city.y - 30 + row * 8, 4, 4);
          }
        }

        // Health bar
        const healthWidth = (city.health / city.maxHealth) * 30;
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(city.x - 15, city.y - 60, 30, 3);
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(city.x - 15, city.y - 60, healthWidth, 3);
      } else {
        ctx.fillStyle = '#393e46';
        ctx.fillRect(city.x - 20, city.y + 5, 40, 5);
      }
    });

    // Draw Towers (Player Planes)
    towersRef.current.forEach(tower => {
      if (!tower.destroyed) {
        ctx.save();
        ctx.translate(tower.x, tower.y);
        
        // Player Plane Body
        ctx.fillStyle = '#3490dc';
        ctx.beginPath();
        ctx.moveTo(-25, 0);
        ctx.lineTo(25, 0);
        ctx.lineTo(10, -12);
        ctx.lineTo(-10, -12);
        ctx.closePath();
        ctx.fill();

        // Cockpit
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, -4, 5, 0, Math.PI * 2);
        ctx.fill();

        // Wings
        ctx.fillStyle = '#1d4ed8';
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.lineTo(-30, 12);
        ctx.lineTo(30, 12);
        ctx.lineTo(10, 0);
        ctx.closePath();
        ctx.fill();
        
        // Ammo indicator
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(tower.ammo.toString(), 0, 30);

        // Health bar
        const healthWidth = (tower.health / tower.maxHealth) * 40;
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(-20, -25, 40, 4);
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(-20, -25, healthWidth, 4);
        
        ctx.restore();
      } else {
        ctx.fillStyle = '#393e46';
        ctx.fillRect(tower.x - 20, tower.y + 10, 40, 10);
      }
    });

    // Draw Rockets (Cannonball/Shell shape)
    rocketsRef.current.forEach(rocket => {
      // Trail
      ctx.strokeStyle = 'rgba(255, 75, 43, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(rocket.start.x, rocket.start.y);
      ctx.lineTo(rocket.current.x, rocket.current.y);
      ctx.stroke();

      ctx.save();
      ctx.translate(rocket.current.x, rocket.current.y);
      ctx.rotate(rocket.angle);

      // Shell body
      ctx.fillStyle = '#ff4b2b';
      ctx.beginPath();
      ctx.ellipse(0, 0, 5, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      // Tip
      ctx.fillStyle = '#ff9068';
      ctx.beginPath();
      ctx.arc(3, 0, 2, 0, Math.PI * 2);
      ctx.fill();

      // Flame/exhaust
      const grad = ctx.createLinearGradient(-5, 0, -12, 0);
      grad.addColorStop(0, '#ff4b2b');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(-4, -2);
      ctx.lineTo(-12, 0);
      ctx.lineTo(-4, 2);
      ctx.fill();

      ctx.restore();
    });

    // Draw Missiles (Laser effect)
    missilesRef.current.forEach(missile => {
      // Outer glow
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#3490dc';
      ctx.strokeStyle = 'rgba(52, 144, 220, 0.4)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(missile.start.x, missile.start.y);
      ctx.lineTo(missile.current.x, missile.current.y);
      ctx.stroke();

      // Inner core
      ctx.shadowBlur = 5;
      ctx.shadowColor = '#ffffff';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(missile.start.x, missile.start.y);
      ctx.lineTo(missile.current.x, missile.current.y);
      ctx.stroke();
      
      // Reset shadow
      ctx.shadowBlur = 0;

      // Target X
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(missile.target.x - 5, missile.target.y - 5);
      ctx.lineTo(missile.target.x + 5, missile.target.y + 5);
      ctx.moveTo(missile.target.x + 5, missile.target.y - 5);
      ctx.lineTo(missile.target.x - 5, missile.target.y + 5);
      ctx.stroke();
    });

    // Draw Explosions
    explosionsRef.current.forEach(exp => {
      const gradient = ctx.createRadialGradient(exp.x, exp.y, 0, exp.x, exp.y, exp.radius);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
      gradient.addColorStop(0.3, 'rgba(255, 200, 50, 0.6)');
      gradient.addColorStop(0.6, 'rgba(255, 50, 50, 0.4)');
      gradient.addColorStop(1, 'rgba(255, 50, 50, 0)');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(exp.x, exp.y, exp.radius, 0, Math.PI * 2);
      ctx.fill();
    });
  }, []);

  const gameLoop = useCallback(() => {
    if (status === GameStatus.PLAYING) {
      update();
      draw();
      requestRef.current = requestAnimationFrame(gameLoop);
    }
  }, [status, update, draw]);

  useEffect(() => {
    if (status === GameStatus.PLAYING) {
      requestRef.current = requestAnimationFrame(gameLoop);
    } else {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [status, gameLoop]);

  const startGame = () => {
    initGame(true);
    setStatus(GameStatus.PLAYING);
  };

  const nextLevel = () => {
    setLevel(prev => prev + 1);
    initGame(false, true);
    setStatus(GameStatus.PLAYING);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans flex flex-col items-center justify-center p-4 overflow-hidden">
      {/* Header */}
      <div className="w-full max-w-[800px] flex justify-between items-center mb-4 px-2">
        <div className="flex items-center gap-2">
          <Shield className="text-emerald-400 w-6 h-6" />
          <h1 className="text-xl font-bold tracking-tight uppercase">{t.title}</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-center px-3 py-1 bg-white/5 rounded-lg border border-white/10">
            <span className="text-[8px] uppercase opacity-50 font-mono leading-none mb-1">{t.level}</span>
            <span className="text-lg font-mono font-bold text-yellow-400">{level}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase opacity-50 font-mono">{t.score}</span>
            <span className="text-2xl font-mono font-bold text-emerald-400">{score.toString().padStart(5, '0')}</span>
          </div>
          <button 
            onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
            className="p-2 rounded-full border border-white/10 hover:bg-white/5 transition-colors"
          >
            <Globe className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Game Container */}
      <div className="relative w-full max-w-[800px] aspect-[4/3] bg-black rounded-2xl border border-white/10 shadow-2xl overflow-hidden cursor-crosshair">
        <canvas
          ref={canvasRef}
          width={GAME_WIDTH}
          height={GAME_HEIGHT}
          className="w-full h-full block"
          onMouseDown={handleCanvasClick}
          onTouchStart={handleCanvasClick}
        />

        {/* Overlays */}
        <AnimatePresence>
          {status === GameStatus.START && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center"
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <h2 className="text-5xl font-black mb-4 tracking-tighter uppercase italic">{t.title}</h2>
                <p className="text-white/60 mb-8 max-w-md">{t.instructions}</p>
                <button 
                  onClick={startGame}
                  className="px-12 py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-full transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2"
                >
                  <Zap className="w-5 h-5" />
                  {t.start}
                </button>
              </motion.div>
            </motion.div>
          )}

          {(status === GameStatus.WON || status === GameStatus.LOST || status === GameStatus.LEVEL_UP) && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center"
            >
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="flex flex-col items-center"
              >
                {status === GameStatus.WON ? (
                  <Trophy className="w-20 h-20 text-yellow-400 mb-4" />
                ) : status === GameStatus.LEVEL_UP ? (
                  <Zap className="w-20 h-20 text-emerald-400 mb-4" />
                ) : (
                  <AlertTriangle className="w-20 h-20 text-red-500 mb-4" />
                )}
                <h2 className={`text-4xl font-black mb-2 uppercase ${status === GameStatus.WON ? 'text-yellow-400' : status === GameStatus.LEVEL_UP ? 'text-emerald-400' : 'text-red-500'}`}>
                  {status === GameStatus.WON ? t.win : status === GameStatus.LEVEL_UP ? `${t.level} ${level} ${t.win}` : t.loss}
                </h2>
                <div className="mb-8">
                  <span className="text-white/50 uppercase text-xs font-mono">{t.score}</span>
                  <div className="text-6xl font-mono font-bold">{score}</div>
                </div>
                <button 
                  onClick={status === GameStatus.LEVEL_UP ? nextLevel : startGame}
                  className="px-12 py-4 bg-white text-black font-bold rounded-full transition-all transform hover:scale-105 active:scale-95"
                >
                  {status === GameStatus.LEVEL_UP ? t.nextLevel : t.restart}
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* In-game HUD overlay */}
        {status === GameStatus.PLAYING && (
          <div className="absolute top-4 left-4 pointer-events-none">
            <div className="bg-black/40 backdrop-blur-md border border-white/10 p-3 rounded-xl flex flex-col gap-1">
              <span className="text-[10px] uppercase opacity-50 font-mono leading-none">{t.targetScore}</span>
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-emerald-400" />
                <span className="text-xl font-mono font-bold">{level * 500}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="mt-8 grid grid-cols-3 gap-8 w-full max-w-[800px] px-4">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase opacity-40 font-bold tracking-widest mb-1">Mission</span>
          <p className="text-xs text-white/60 leading-relaxed">Protect the cities from incoming orbital strikes. Intercept with precision.</p>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] uppercase opacity-40 font-bold tracking-widest mb-1">Controls</span>
          <p className="text-xs text-white/60 leading-relaxed">Click/Tap anywhere to fire. Lead your shots to hit moving targets.</p>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] uppercase opacity-40 font-bold tracking-widest mb-1">Resources</span>
          <p className="text-xs text-white/60 leading-relaxed">Towers have limited ammo. Use them wisely. Middle tower has high capacity.</p>
        </div>
      </div>
    </div>
  );
}
