/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type GameStatus = 'TITLE' | 'PLAYING' | 'GAMEOVER' | 'RESULTS';

export interface Song {
  id: string;
  title: string;
  genre: string;
  bpm: number;
  duration: number; // 秒単位
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
}

export interface Note {
  id: string;
  key: string;       // ターゲットとなるアルファベット (A-Z)
  gridX: number;     // -200 〜 200 程度の3D空間上のX
  gridY: number;     // -150 〜 150 程度の3D空間上のY
  spawnTime: number;  // 出現するゲーム時間 (秒)
  targetTime: number; // 判定ジャストになるゲーム時間 (秒)
  active: boolean;    // まだ生きているか
  hit: boolean;       // 破壊されたか
  evaluated: boolean; // 判定が終了したか
  scoreResult?: 'PERFECT' | 'GREAT' | 'GOOD' | 'MISS';
}

export interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  color: string;
  size: number;
  life: number;     // 残りライフ (0〜1)
  decay: number;    // 減少率
}

export interface Laser {
  id: string;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  color: string;
  life: number;      // 0〜1
  maxLife: number;   // 秒数
}

export interface GameScore {
  score: number;
  combo: number;
  maxCombo: number;
  perfect: number;
  great: number;
  good: number;
  miss: number;
}
