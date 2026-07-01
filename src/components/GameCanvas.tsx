/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { audio } from '../audio';
import { GameScore, GameStatus, Laser, Note, Particle } from '../types';

interface GameCanvasProps {
  status: GameStatus;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  onGameOver: (score: GameScore) => void;
  onGameClear: (score: GameScore) => void;
  onExit: () => void;
}

export default function GameCanvas({
  status,
  difficulty,
  onGameOver,
  onGameClear,
  onExit,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // ゲームステート
  const [score, setScore] = useState<GameScore>({
    score: 0,
    combo: 0,
    maxCombo: 0,
    perfect: 0,
    great: 0,
    good: 0,
    miss: 0,
  });
  const [hp, setHp] = useState<number>(100);
  const [fever, setFever] = useState<boolean>(false);
  const [feverValue, setFeverValue] = useState<number>(0); // 100でMAX

  // ゲームの各種リアルタイムパラメータ（ミュータブルな状態はRefで保持して高頻度描画を維持するわ）
  const stateRef = useRef({
    isPlaying: false,
    gameTime: 0,
    lastFrameTime: 0,
    hp: 100,
    score: 0,
    combo: 0,
    maxCombo: 0,
    perfect: 0,
    great: 0,
    good: 0,
    miss: 0,
    fever: false,
    feverValue: 0,
    notes: [] as Note[],
    particles: [] as Particle[],
    lasers: [] as Laser[],
    beatPump: 0, // ビート時の振動値 (0〜1)
    mouse: { x: 0, y: 0 }, // 画面中央を (0,0) とした座標
    clientMouse: { x: 0, y: 0 }, // Canvas上の実際の座標
    lockedNoteId: null as string | null,
    gridOffset: 0,
    stars: [] as { x: number; y: number; z: number; brightness: number }[],
    feedbackText: null as { text: string; color: string; scale: number; life: number } | null,
    totalDuration: 60.0, // 1曲 60秒
    lastNoteSpawnTime: 0,
  });

  // レティクル（照準）のエイム感度
  const AIM_LOCK_RADIUS = 60; // 60px以内でエイムロック

  // 設定値の読み込み
  const bpm = difficulty === 'EASY' ? 120 : difficulty === 'MEDIUM' ? 130 : 142;
  const beatInterval = 60 / bpm; // 1拍の秒数

  useEffect(() => {
    stateRef.current.totalDuration = difficulty === 'EASY' ? 45.0 : difficulty === 'MEDIUM' ? 60.0 : 75.0;
  }, [difficulty]);

  // スターフィールド（3Dの星くず背景）の初期化
  const initStars = () => {
    const stars = [];
    for (let i = 0; i < 150; i++) {
      stars.push({
        x: (Math.random() * 2 - 1) * 800,
        y: (Math.random() * 2 - 1) * 600,
        z: Math.random() * 2000,
        brightness: 0.2 + Math.random() * 0.8,
      });
    }
    stateRef.current.stars = stars;
  };

  // 3D透視投影 (Perspective Projection)
  const project = (x: number, y: number, z: number, width: number, height: number) => {
    const fov = 400; // 焦点距離
    if (z <= 10) return { x: 0, y: 0, scale: 0, visible: false };

    // キック（ビートパンプ）に合わせて少しカメラが前後に揺れる演出
    const dynamicFov = fov + stateRef.current.beatPump * 25;

    const scale = dynamicFov / z;
    const screenX = width / 2 + x * scale;
    const screenY = height / 2 + y * scale;

    return {
      x: screenX,
      y: screenY,
      scale: scale,
      visible: screenX >= 0 && screenX <= width && screenY >= 0 && screenY <= height,
    };
  };

  // 3D空間の3軸回転ヘルパー
  const rotateY = (x: number, y: number, z: number, angle: number) => {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return [x * cos + z * sin, y, -x * sin + z * cos];
  };

  const rotateX = (x: number, y: number, z: number, angle: number) => {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return [x, y * cos - z * sin, y * sin + z * cos];
  };

  // ゲームの開始
  const startGame = () => {
    initStars();
    
    // スコア初期化
    stateRef.current = {
      ...stateRef.current,
      isPlaying: true,
      gameTime: 0,
      lastFrameTime: performance.now(),
      hp: 100,
      score: 0,
      combo: 0,
      maxCombo: 0,
      perfect: 0,
      great: 0,
      good: 0,
      miss: 0,
      fever: false,
      feverValue: 0,
      notes: [],
      particles: [],
      lasers: [],
      beatPump: 0,
      lockedNoteId: null,
      feedbackText: null,
      lastNoteSpawnTime: 0,
    };

    setHp(100);
    setFever(false);
    setFeverValue(0);
    setScore({
      score: 0,
      combo: 0,
      maxCombo: 0,
      perfect: 0,
      great: 0,
      good: 0,
      miss: 0,
    });

    // Web Audio BGM演奏の開始
    // 各ビートのタイミングでキックに合わせてbeatPumpをトリガー
    audio.start(bpm, (beatCount, time) => {
      stateRef.current.beatPump = 1.0; // 振動MAX
    });
  };

  // ゲームの終了
  const stopGame = () => {
    stateRef.current.isPlaying = false;
    audio.stop();
  };

  useEffect(() => {
    startGame();
    return () => {
      stopGame();
    };
  }, [difficulty]);

  // マウス移動イベントハンドラ
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    stateRef.current.clientMouse = { x, y };
    // 画面中央を原点(0,0)とした座標に変換
    stateRef.current.mouse = {
      x: x - canvas.width / 2,
      y: y - canvas.height / 2,
    };
  };

  // キーボードイベントハンドラ
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!stateRef.current.isPlaying) return;

      const pressedKey = e.key.toUpperCase();
      // アルファベットキー (A-Z) のみ処理
      if (pressedKey.length !== 1 || pressedKey < 'A' || pressedKey > 'Z') {
        return;
      }

      // 1. レーザーショット音を鳴らす（空撃ちでも音が鳴るのが最高に気持ちいい）
      audio.playLaser();

      // 現在ロックオンしているノーツがあるか確認
      const lockedNoteId = stateRef.current.lockedNoteId;
      let lockedNote = stateRef.current.notes.find((n) => n.id === lockedNoteId && n.active);

      // マウス位置からキャンバス中心
      const canvas = canvasRef.current;
      const width = canvas ? canvas.width : 800;
      const height = canvas ? canvas.height : 600;

      // --- ロックオン救済（アシスト）判定 ---
      // もし手ブレなどで一瞬ロックオンが外れていた場合でも、カーソル下近辺に一致するキーのノーツがあれば強制ヒット扱いにする
      if (!lockedNote) {
        let bestAssistNote: Note | null = null;
        let minAssistDist = Infinity;

        stateRef.current.notes.forEach((note) => {
          if (!note.active || note.key !== pressedKey) return;

          const duration = note.targetTime - note.spawnTime;
          const progress = Math.max(0, Math.min(1.0, (stateRef.current.gameTime - note.spawnTime) / duration));
          const curZ = 1400 * (1 - progress) + 100 * progress;

          if (curZ > 1150) return; // 奥すぎるノーツは対象外

          const noteProjected = project(note.gridX, note.gridY, curZ, width, height);
          if (!noteProjected.visible) return;

          const dx = noteProjected.x - stateRef.current.clientMouse.x;
          const dy = noteProjected.y - stateRef.current.clientMouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          const dynamicLockRadius = Math.max(50, 45 * noteProjected.scale);

          if (dist < dynamicLockRadius && dist < minAssistDist) {
            minAssistDist = dist;
            bestAssistNote = note;
          }
        });

        if (bestAssistNote) {
          lockedNote = bestAssistNote;
          stateRef.current.lockedNoteId = (bestAssistNote as Note).id;
        }
      }

      if (lockedNote && lockedNote.key === pressedKey) {
        // ロックオンしているノーツのキーと一致したら、タイミング評価！
        const diff = Math.abs(stateRef.current.gameTime - lockedNote.targetTime);
        let result: 'PERFECT' | 'GREAT' | 'GOOD' | 'MISS' = 'MISS';
        let scoreAdd = 0;
        let color = '#ff00ff';
        let feedback = '';

        if (diff <= 0.09) {
          result = 'PERFECT';
          scoreAdd = 100;
          color = '#00ffff'; // シアン
          feedback = 'PERFECT';
        } else if (diff <= 0.18) {
          result = 'GREAT';
          scoreAdd = 75;
          color = '#ff00ff'; // マゼンタ
          feedback = 'GREAT';
        } else if (diff <= 0.28) {
          result = 'GOOD';
          scoreAdd = 50;
          color = '#ffff00'; // イエロー
          feedback = 'GOOD';
        } else {
          result = 'MISS';
          feedback = 'LATE MISS';
          color = '#ff3333'; // レッド
        }

        // 評価に基づく処理
        lockedNote.active = false;
        lockedNote.hit = true;
        lockedNote.evaluated = true;
        lockedNote.scoreResult = result;

        // 音響爆発
        if (result !== 'MISS') {
          audio.playExplosion(result);
        } else {
          audio.playMiss();
        }

        // スコア更新
        const isFeverActive = stateRef.current.fever;
        const multiplier = isFeverActive ? 2 : 1;
        const finalScoreAdd = scoreAdd * multiplier;

        stateRef.current.score += finalScoreAdd;

        if (result !== 'MISS') {
          stateRef.current.combo++;
          if (stateRef.current.combo > stateRef.current.maxCombo) {
            stateRef.current.maxCombo = stateRef.current.combo;
          }
          // HP回復
          stateRef.current.hp = Math.min(100, stateRef.current.hp + (result === 'PERFECT' ? 5 : result === 'GREAT' ? 3 : 1));
          
          // フィーバーゲージ蓄積
          if (!isFeverActive) {
            stateRef.current.feverValue = Math.min(100, stateRef.current.feverValue + (result === 'PERFECT' ? 6 : result === 'GREAT' ? 4 : 2));
            if (stateRef.current.feverValue >= 100) {
              stateRef.current.fever = true;
              audio.setFever(true);
            }
          }
        } else {
          // MISSの場合
          stateRef.current.combo = 0;
          stateRef.current.hp = Math.max(0, stateRef.current.hp - 12);
          if (isFeverActive) {
            stateRef.current.fever = false;
            stateRef.current.feverValue = 0;
            audio.setFever(false);
          }
        }

        // 統計更新
        if (result === 'PERFECT') stateRef.current.perfect++;
        if (result === 'GREAT') stateRef.current.great++;
        if (result === 'GOOD') stateRef.current.good++;
        if (result === 'MISS') stateRef.current.miss++;

        // UI用状態を更新
        setScore({
          score: stateRef.current.score,
          combo: stateRef.current.combo,
          maxCombo: stateRef.current.maxCombo,
          perfect: stateRef.current.perfect,
          great: stateRef.current.great,
          good: stateRef.current.good,
          miss: stateRef.current.miss,
        });
        setHp(stateRef.current.hp);
        setFever(stateRef.current.fever);
        setFeverValue(stateRef.current.feverValue);

        // フィードバックテキスト設定
        stateRef.current.feedbackText = {
          text: feedback,
          color: color,
          scale: 1.5,
          life: 0.4, // 0.4秒間表示
        };

        // レーザーを引く（照準からノーツ座標）
        const projected = project(lockedNote.gridX, lockedNote.gridY, 100, width, height);
        const laserColor = result === 'PERFECT' ? '#00ffff' : result === 'GREAT' ? '#ff00ff' : '#ffff00';
        stateRef.current.lasers.push({
          id: Math.random().toString(),
          startX: stateRef.current.clientMouse.x,
          startY: stateRef.current.clientMouse.y,
          targetX: projected.x,
          targetY: projected.y,
          targetZ: 100,
          color: laserColor,
          life: 1.0,
          maxLife: 0.15,
        });

        // 3Dパーティクル爆発を大量放出
        const pCount = result === 'PERFECT' ? 25 : result === 'GREAT' ? 18 : 10;
        for (let i = 0; i < pCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          const pitch = (Math.random() * 2 - 1) * Math.PI;
          const speed = 5 + Math.random() * 8;
          stateRef.current.particles.push({
            x: lockedNote.gridX,
            y: lockedNote.gridY,
            z: 100,
            vx: Math.cos(angle) * Math.cos(pitch) * speed,
            vy: Math.sin(pitch) * speed,
            vz: Math.sin(angle) * Math.cos(pitch) * speed,
            color: laserColor,
            size: 2 + Math.random() * 4,
            life: 1.0,
            decay: 0.03 + Math.random() * 0.04,
          });
        }

        // ロックオン解除
        stateRef.current.lockedNoteId = null;

      } else {
        // 空撃ち、またはエイム外、キーミス
        // ペナルティとして空撃ちミス（コンボのみリセット、HPは減らさない）
        audio.playMiss();
        stateRef.current.combo = 0;
        
        setScore((prev) => ({ ...prev, combo: 0 }));

        // ミスエフェクトとして、照準周りに赤いパーティクルを散らす
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2;
          stateRef.current.particles.push({
            x: stateRef.current.mouse.x * (100 / 400), // 適当な3D空間座標にマッピング
            y: stateRef.current.mouse.y * (100 / 400),
            z: 110,
            vx: Math.cos(angle) * 3,
            vy: Math.sin(angle) * 3,
            vz: -1,
            color: '#ff3333',
            size: 3,
            life: 1.0,
            decay: 0.06,
          });
        }

        // フィードバックテキスト設定
        stateRef.current.feedbackText = {
          text: 'BAD AIM',
          color: '#ff3333',
          scale: 1.2,
          life: 0.3,
        };
      }

      // HP 0 ならゲームオーバー
      if (stateRef.current.hp <= 0) {
        stopGame();
        onGameOver({
          score: stateRef.current.score,
          combo: stateRef.current.combo,
          maxCombo: stateRef.current.maxCombo,
          perfect: stateRef.current.perfect,
          great: stateRef.current.great,
          good: stateRef.current.good,
          miss: stateRef.current.miss,
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // ゲームのメインアニメーションループ
  useEffect(() => {
    let animationId: number;

    const gameLoop = (timestamp: number) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        animationId = requestAnimationFrame(gameLoop);
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animationId = requestAnimationFrame(gameLoop);
        return;
      }

      // レスポンシブにCanvasサイズをリサイズ
      const width = canvas.width;
      const height = canvas.height;

      // デルタタイム（フレーム間の経過時間（秒））の計算
      const delta = (timestamp - stateRef.current.lastFrameTime) / 1000;
      stateRef.current.lastFrameTime = timestamp;

      if (stateRef.current.isPlaying) {
        stateRef.current.gameTime += delta;
      }

      const curTime = stateRef.current.gameTime;

      // ゲーム時間終了によるクリア判定
      if (curTime >= stateRef.current.totalDuration) {
        stopGame();
        onGameClear({
          score: stateRef.current.score,
          combo: stateRef.current.combo,
          maxCombo: stateRef.current.maxCombo,
          perfect: stateRef.current.perfect,
          great: stateRef.current.great,
          good: stateRef.current.good,
          miss: stateRef.current.miss,
        });
        return;
      }

      // --- 1. ノーツの自動生成ロジック (BPM完全同期) ---
      if (stateRef.current.isPlaying) {
        // 次のノーツを出現させるべきかを判定
        // 一定の拍タイミング（1拍または0.5拍ごと）で出現
        const beatsSinceStart = curTime / beatInterval;
        const currentBeatIndex = Math.floor(beatsSinceStart * 2); // 8分音符(0.5拍)単位

        const lastSpawnBeatIndex = Math.floor(stateRef.current.lastNoteSpawnTime / beatInterval * 2);

        if (currentBeatIndex > lastSpawnBeatIndex) {
          stateRef.current.lastNoteSpawnTime = curTime;

          // 難易度に応じた出現確率
          let spawnProbability = 0.3; // EASY (基本1拍か2拍に1個)
          if (difficulty === 'MEDIUM') spawnProbability = 0.45;
          if (difficulty === 'HARD') spawnProbability = 0.65;

          // 小節の頭(1拍目)は確実にノーツを生成してリズム感を出しやすく
          const isOnMainBeat = (currentBeatIndex % 8) === 0;

          if (isOnMainBeat || Math.random() < spawnProbability) {
            // ノーツの生成
            // Z=1400から出現し、4拍かけてZ=100（判定位置）に到達させる
            const beatsToTravel = difficulty === 'EASY' ? 4 : difficulty === 'MEDIUM' ? 4 : 3; // HARDは速い
            const travelDuration = beatsToTravel * beatInterval;
            
            const targetTime = curTime + travelDuration;
            const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            const randomChar = alphabet.charAt(Math.floor(Math.random() * alphabet.length));

            // 完全3D空間のランダム配置（画面外すぎないように）
            const gridX = (Math.random() * 2 - 1) * 220;
            const gridY = (Math.random() * 2 - 1) * 150;

            stateRef.current.notes.push({
              id: Math.random().toString(),
              key: randomChar,
              gridX,
              gridY,
              spawnTime: curTime,
              targetTime,
              active: true,
              hit: false,
              evaluated: false,
            });
          }
        }
      }

      // --- 2. 状態の更新 (物理計算など) ---

      // ビートパンプ（振動）の減衰
      stateRef.current.beatPump = Math.max(0, stateRef.current.beatPump - delta * 4);

      // グリッドをスクロール
      const scrollSpeed = 500 * delta * (stateRef.current.fever ? 2.0 : 1.0);
      stateRef.current.gridOffset = (stateRef.current.gridOffset + scrollSpeed) % 150;

      // 星くずの更新（手前に流れる）
      stateRef.current.stars.forEach((star) => {
        star.z -= 600 * delta * (stateRef.current.fever ? 2.5 : 1.0);
        if (star.z <= 10) {
          star.z = 2000;
          star.x = (Math.random() * 2 - 1) * 800;
          star.y = (Math.random() * 2 - 1) * 600;
        }
      });

      // レーザーの更新
      stateRef.current.lasers = stateRef.current.lasers.filter((laser) => {
        laser.life -= delta / laser.maxLife;
        return laser.life > 0;
      });

      // パーティクルの更新
      stateRef.current.particles = stateRef.current.particles.filter((p) => {
        p.x += p.vx * delta * 60;
        p.y += p.vy * delta * 60;
        p.z += p.vz * delta * 60;
        p.life -= p.decay;
        return p.life > 0;
      });

      // フィードバックテキストの更新
      if (stateRef.current.feedbackText) {
        stateRef.current.feedbackText.life -= delta;
        if (stateRef.current.feedbackText.life <= 0) {
          stateRef.current.feedbackText = null;
        }
      }

      // ノーツの更新と判定処理
      stateRef.current.notes.forEach((note) => {
        if (!note.active) return;

        // ノーツを通過してしまって一定時間（250ms）以上経ったら自動的にMISS評価
        if (curTime > note.targetTime + 0.25) {
          note.active = false;
          note.evaluated = true;
          note.scoreResult = 'MISS';
          
          audio.playMiss();
          stateRef.current.combo = 0;
          stateRef.current.hp = Math.max(0, stateRef.current.hp - 15);
          stateRef.current.miss++;

          // フィーバー中断
          if (stateRef.current.fever) {
            stateRef.current.fever = false;
            stateRef.current.feverValue = 0;
            audio.setFever(false);
          } else {
            // フィーバーゲージを少し減らす
            stateRef.current.feverValue = Math.max(0, stateRef.current.feverValue - 10);
          }

          setScore({
            score: stateRef.current.score,
            combo: 0,
            maxCombo: stateRef.current.maxCombo,
            perfect: stateRef.current.perfect,
            great: stateRef.current.great,
            good: stateRef.current.good,
            miss: stateRef.current.miss,
          });
          setHp(stateRef.current.hp);
          setFever(false);
          setFeverValue(stateRef.current.feverValue);

          stateRef.current.feedbackText = {
            text: 'MISS',
            color: '#ff3333',
            scale: 1.5,
            life: 0.4,
          };

          // HPが0になったらゲームオーバー
          if (stateRef.current.hp <= 0) {
            stopGame();
            onGameOver({
              score: stateRef.current.score,
              combo: stateRef.current.combo,
              maxCombo: stateRef.current.maxCombo,
              perfect: stateRef.current.perfect,
              great: stateRef.current.great,
              good: stateRef.current.good,
              miss: stateRef.current.miss,
            });
          }
        }
      });

      // 終了したノーツを配列から除去して肥大化を防ぐ
      stateRef.current.notes = stateRef.current.notes.filter(
        (note) => note.active || (curTime - note.targetTime < 1.0)
      );

      // --- 3. レンダー描画処理 ---

      // 画面のクリア (ネオンが美しくにじむように、完全な黒ではなく透明度の高い黒で少し軌跡をのこすことも可能)
      // ここではシャープなサイバー感を出すために、完全クリアした後に、ビートに合わせたフラッシュ背景を描画する
      ctx.fillStyle = '#05050d'; // 漆黒のサイバー空間
      ctx.fillRect(0, 0, width, height);

      // ビートキック時に、画面をうっすら明るく明滅させる
      if (stateRef.current.beatPump > 0.01) {
        const pumpColor = stateRef.current.fever ? 'rgba(255, 0, 255, 0.05)' : 'rgba(0, 255, 255, 0.03)';
        ctx.fillStyle = pumpColor;
        ctx.fillRect(0, 0, width, height);
      }

      // --- 3D背景の描画 ---
      
      // A. 星くず (Starfield)
      stateRef.current.stars.forEach((star) => {
        const projected = project(star.x, star.y, star.z, width, height);
        if (projected.visible) {
          const alpha = Math.min(1.0, (2000 - star.z) / 500) * star.brightness;
          ctx.fillStyle = stateRef.current.fever 
            ? `rgba(255, 100, 255, ${alpha})` 
            : `rgba(100, 255, 255, ${alpha})`;
          ctx.beginPath();
          ctx.arc(projected.x, projected.y, Math.max(1, 1.5 * projected.scale), 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // B. ネオングリッド (上下のサイバーパネル)
      ctx.lineWidth = 1;
      const gridZStep = 150;
      const gridCount = 12;
      const startGridZ = 1200;

      // フィーバー中はグリッドの色がマゼンタ、通常はシアン
      const gridColor = stateRef.current.fever ? 'rgba(255, 0, 150, ' : 'rgba(0, 180, 255, ';

      // 横ライン (奥から迫る)
      for (let i = 0; i < gridCount; i++) {
        const z = startGridZ - i * gridZStep - stateRef.current.gridOffset;
        if (z <= 10) continue;

        // グリッド上下を描画
        const pLeftTop = project(-400, -180, z, width, height);
        const pRightTop = project(400, -180, z, width, height);
        const pLeftBottom = project(-400, 180, z, width, height);
        const pRightBottom = project(400, 180, z, width, height);

        const alpha = Math.max(0, 1 - z / 1200);

        ctx.strokeStyle = `${gridColor}${alpha * 0.25})`;
        
        // 上のライン
        ctx.beginPath();
        ctx.moveTo(pLeftTop.x, pLeftTop.y);
        ctx.lineTo(pRightTop.x, pRightTop.y);
        ctx.stroke();

        // 下のライン
        ctx.beginPath();
        ctx.moveTo(pLeftBottom.x, pLeftBottom.y);
        ctx.lineTo(pRightBottom.x, pRightBottom.y);
        ctx.stroke();
      }

      // 縦ライン (放射状にのびる)
      const verticalXLines = [-400, -250, -100, 0, 100, 250, 400];
      verticalXLines.forEach((x) => {
        const pStartTop = project(x, -180, 1200, width, height);
        const pEndTop = project(x, -180, 10, width, height);
        const pStartBottom = project(x, 180, 1200, width, height);
        const pEndBottom = project(x, 180, 10, width, height);

        // グラデーション風に描画
        const gradTop = ctx.createLinearGradient(pStartTop.x, pStartTop.y, pEndTop.x, pEndTop.y);
        gradTop.addColorStop(0, `${gridColor}0)`);
        gradTop.addColorStop(1, `${gridColor}0.35)`);
        ctx.strokeStyle = gradTop;
        ctx.beginPath();
        ctx.moveTo(pStartTop.x, pStartTop.y);
        ctx.lineTo(pEndTop.x, pEndTop.y);
        ctx.stroke();

        const gradBottom = ctx.createLinearGradient(pStartBottom.x, pStartBottom.y, pEndBottom.x, pEndBottom.y);
        gradBottom.addColorStop(0, `${gridColor}0)`);
        gradBottom.addColorStop(1, `${gridColor}0.35)`);
        ctx.strokeStyle = gradBottom;
        ctx.beginPath();
        ctx.moveTo(pStartBottom.x, pStartBottom.y);
        ctx.lineTo(pEndBottom.x, pEndBottom.y);
        ctx.stroke();
      });

      // --- C. 手前の「判定リング（Timing Ring）」 ---
      // プレイヤーが狙うべきZ=100の判定面を仮想リング（シアンに光る八角形）としてうっすら描画
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = stateRef.current.fever ? 'rgba(255, 0, 255, 0.15)' : 'rgba(0, 255, 255, 0.12)';
      ctx.beginPath();
      const ringPoints = 8;
      const ringRadiusX = 220;
      const ringRadiusY = 150;
      for (let i = 0; i <= ringPoints; i++) {
        const angle = (i / ringPoints) * Math.PI * 2;
        const rx = Math.cos(angle) * ringRadiusX;
        const ry = Math.sin(angle) * ringRadiusY;
        const projected = project(rx, ry, 100, width, height);
        if (i === 0) {
          ctx.moveTo(projected.x, projected.y);
        } else {
          ctx.lineTo(projected.x, projected.y);
        }
      }
      ctx.stroke();

      // --- D. 3Dパーティクルの描画 ---
      stateRef.current.particles.forEach((p) => {
        const projected = project(p.x, p.y, p.z, width, height);
        if (projected.visible) {
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.life;
          ctx.beginPath();
          ctx.arc(projected.x, projected.y, p.size * projected.scale * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      ctx.globalAlpha = 1.0; // リセット

      // --- E. ノーツの3D描画 & エイム判定 ---
      let closestNoteId: string | null = null;
      let minDistanceToMouse = Infinity;

      // 判定距離を計算するために投影
      stateRef.current.notes.forEach((note) => {
        if (!note.active) return;

        // ノーツの現在のZ座標を計算 (spawnTimeからtargetTimeに向かって奥から移動)
        const duration = note.targetTime - note.spawnTime;
        const progress = Math.max(0, Math.min(1.0, (curTime - note.spawnTime) / duration));
        
        // Z座標は 1400 (奥) から 100 (手前判定)
        const curZ = 1400 * (1 - progress) + 100 * progress;

        // 3D透視投影
        const noteProjected = project(note.gridX, note.gridY, curZ, width, height);

        if (noteProjected.visible) {
          // 自転（回転）アニメーション
          const rotSpeed = curTime * 2.0;
          const rotatedVertices = [
            [-22, -22, -22], [22, -22, -22], [22, 22, -22], [-22, 22, -22],
            [-22, -22, 22], [22, -22, 22], [22, 22, 22], [-22, 22, 22]
          ].map(([vx, vy, vz]) => {
            // Y軸回転
            let [rx, ry, rz] = rotateY(vx, vy, vz, rotSpeed);
            // X軸回転
            [rx, ry, rz] = rotateX(rx, ry, rz, rotSpeed * 0.5);
            return [rx, ry, rz];
          });

          // 立方体の辺を定義 (0-1, 1-2, 2-3, 3-0,  4-5, 5-6, 6-7, 7-4,  0-4, 1-5, 2-6, 3-7)
          const edges = [
            [0, 1], [1, 2], [2, 3], [3, 0],
            [4, 5], [5, 6], [6, 7], [7, 4],
            [0, 4], [1, 5], [2, 6], [3, 7]
          ];

          // 判定リング位置(Z=100)に近づいている時のエフェクト
          // Z=100のジャストタイミングで外側のネオン枠線と同期させる
          const timeDiff = note.targetTime - curTime;
          const isClose = Math.abs(timeDiff) < 0.25;

          // エイム判定 (マウスのキャンバス座標との距離)
          const dx = noteProjected.x - stateRef.current.clientMouse.x;
          const dy = noteProjected.y - stateRef.current.clientMouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          // 3Dサイズ（縮尺）に応じた動的なロックオン判定半径（手前に来るほど広くなり、狙いやすくなる）
          const dynamicLockRadius = Math.max(50, 45 * noteProjected.scale);

          // まだ出現したばかりの奥すぎるノーツ (Z > 1150) はロックオン対象外にし、手前のノーツを優先的に狙えるようにする
          const isAimable = curZ <= 1150;

          // ロックオン可能判定
          if (isAimable && dist < dynamicLockRadius && dist < minDistanceToMouse) {
            minDistanceToMouse = dist;
            closestNoteId = note.id;
          }

          const isLocked = stateRef.current.lockedNoteId === note.id;

          // アシストライン (うっすら軌道をガイド)
          ctx.lineWidth = 1;
          ctx.strokeStyle = 'rgba(0, 255, 255, 0.04)';
          ctx.beginPath();
          const startProj = project(note.gridX, note.gridY, 1400, width, height);
          const endProj = project(note.gridX, note.gridY, 100, width, height);
          ctx.moveTo(startProj.x, startProj.y);
          ctx.lineTo(endProj.x, endProj.y);
          ctx.stroke();

          // 3D立方体を描画
          ctx.lineWidth = isLocked ? 2.5 : 1.5;
          
          // ノーツの色を決定 (進行度やコンボ、ロック状態によって変化)
          let noteColor = 'rgba(0, 255, 255, 0.8)'; // 通常：シアン
          if (isLocked) {
            noteColor = '#ff00ff'; // ロックオン：マゼンタ
          } else if (isClose) {
            // 判定ジャスト付近なら黄色く光る
            noteColor = '#ffff00';
          }

          ctx.strokeStyle = noteColor;

          // グロー効果
          ctx.shadowColor = noteColor;
          ctx.shadowBlur = isLocked ? 15 : 5;

          // 立方体の各エッジを投影して描画
          edges.forEach(([v1, v2]) => {
            const p1Raw = rotatedVertices[v1];
            const p2Raw = rotatedVertices[v2];

            const p1 = project(note.gridX + p1Raw[0], note.gridY + p1Raw[1], curZ + p1Raw[2], width, height);
            const p2 = project(note.gridX + p2Raw[0], note.gridY + p2Raw[1], curZ + p2Raw[2], width, height);

            if (p1.visible && p2.visible) {
              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.stroke();
            }
          });

          // シャドウをオフに戻す
          ctx.shadowBlur = 0;

          // 立方体の真ん中にアルファベットを大きく描画
          ctx.fillStyle = isLocked ? '#ffffff' : noteColor;
          ctx.font = `bold ${Math.max(16, 22 * noteProjected.scale)}px "JetBrains Mono", monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(note.key, noteProjected.x, noteProjected.y);

          // タイミングジャストを表す外部ターゲット枠線（判定縮小サークル）の描画
          // spawnTimeからtargetTimeにかけて縮小し、targetTimeでジャスト重なる
          if (progress < 1.0) {
            const ringScale = 1.0 + (1.0 - progress) * 2.5; // 3.5倍から1.0倍に縮小
            const outerRadius = 30 * noteProjected.scale * ringScale;
            ctx.lineWidth = 1;
            ctx.strokeStyle = isLocked ? 'rgba(255, 0, 255, 0.4)' : 'rgba(0, 255, 255, 0.3)';
            ctx.beginPath();
            ctx.arc(noteProjected.x, noteProjected.y, outerRadius, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      });

      // ロックオン対象を更新
      stateRef.current.lockedNoteId = closestNoteId;

      // --- F. 電子リンクライン（ロックオンビーム）の描画 ---
      if (stateRef.current.lockedNoteId) {
        const lockedNote = stateRef.current.notes.find((n) => n.id === stateRef.current.lockedNoteId && n.active);
        if (lockedNote) {
          const duration = lockedNote.targetTime - lockedNote.spawnTime;
          const progress = Math.max(0, Math.min(1.0, (curTime - lockedNote.spawnTime) / duration));
          const curZ = 1400 * (1 - progress) + 100 * progress;
          const projected = project(lockedNote.gridX, lockedNote.gridY, curZ, width, height);

          if (projected.visible) {
            // レティクルとターゲットを繋ぐ、うねる電子のエネルギーライン
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(255, 0, 255, 0.7)';
            ctx.shadowColor = '#ff00ff';
            ctx.shadowBlur = 8;
            
            ctx.beginPath();
            ctx.moveTo(stateRef.current.clientMouse.x, stateRef.current.clientMouse.y);
            
            // 中間に少しゆらぎ（サイン波）を加えて電撃っぽくする
            const midX = (stateRef.current.clientMouse.x + projected.x) / 2;
            const midY = (stateRef.current.clientMouse.y + projected.y) / 2;
            const waveAmp = 12 * Math.sin(curTime * 15);
            const perpX = -(projected.y - stateRef.current.clientMouse.y);
            const perpY = projected.x - stateRef.current.clientMouse.x;
            const len = Math.sqrt(perpX * perpX + perpY * perpY);
            
            if (len > 0) {
              const offsetX = (perpX / len) * waveAmp;
              const offsetY = (perpY / len) * waveAmp;
              ctx.quadraticCurveTo(midX + offsetX, midY + offsetY, projected.x, projected.y);
            } else {
              ctx.lineTo(projected.x, projected.y);
            }
            ctx.stroke();
            ctx.shadowBlur = 0;
          }
        }
      }

      // --- G. 極太レーザーエフェクトの描画 ---
      stateRef.current.lasers.forEach((laser) => {
        ctx.lineWidth = 10 * laser.life;
        ctx.strokeStyle = '#ffffff';
        ctx.shadowColor = laser.color;
        ctx.shadowBlur = 20 * laser.life;

        // メインの白い芯
        ctx.beginPath();
        ctx.moveTo(laser.startX, laser.startY);
        ctx.lineTo(laser.targetX, laser.targetY);
        ctx.stroke();

        // 周りの色のついた光輪
        ctx.lineWidth = 4 * laser.life;
        ctx.strokeStyle = laser.color;
        ctx.beginPath();
        ctx.moveTo(laser.startX, laser.startY);
        ctx.lineTo(laser.targetX, laser.targetY);
        ctx.stroke();

        ctx.shadowBlur = 0;
      });

      // --- H. クールなレティクル（マウス照準）の描画 ---
      const mouseX = stateRef.current.clientMouse.x;
      const mouseY = stateRef.current.clientMouse.y;
      const isLocking = stateRef.current.lockedNoteId !== null;

      ctx.save();
      ctx.translate(mouseX, mouseY);
      
      // キックのタイミングやロックオン状態で回転角を変える
      const retRot = curTime * 1.5;
      ctx.rotate(retRot);

      // 外側のサイバーサークル
      ctx.lineWidth = isLocking ? 2.5 : 1.5;
      ctx.strokeStyle = isLocking ? '#ff00ff' : '#00ffff';
      ctx.shadowColor = isLocking ? '#ff00ff' : '#00ffff';
      ctx.shadowBlur = isLocking ? 10 : 4;
      
      ctx.beginPath();
      ctx.arc(0, 0, isLocking ? 22 : 16, 0, Math.PI * 2);
      ctx.stroke();

      // コーナー爪 (十字のレティクル)
      const lineLen = isLocking ? 8 : 5;
      const innerGap = isLocking ? 10 : 7;
      ctx.beginPath();
      // 上
      ctx.moveTo(0, -innerGap);
      ctx.lineTo(0, -innerGap - lineLen);
      // 下
      ctx.moveTo(0, innerGap);
      ctx.lineTo(0, innerGap + lineLen);
      // 左
      ctx.moveTo(-innerGap, 0);
      ctx.lineTo(-innerGap - lineLen, 0);
      // 右
      ctx.moveTo(innerGap, 0);
      ctx.lineTo(innerGap + lineLen, 0);
      ctx.stroke();

      // ロックオン中の追加ゲージ (時計回りのチャージ円)
      if (isLocking) {
        ctx.rotate(-retRot * 2); // 逆回転
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, 26, 0, Math.PI * 2 * (0.3 + 0.7 * Math.sin(curTime * 10)));
        ctx.stroke();
      }

      ctx.restore();
      ctx.shadowBlur = 0;

      // 照準の中心点
      ctx.fillStyle = isLocking ? '#ff00ff' : '#00ffff';
      ctx.beginPath();
      ctx.arc(mouseX, mouseY, 3, 0, Math.PI * 2);
      ctx.fill();

      // --- I. 判定フィードバックテキストの表示 ---
      if (stateRef.current.feedbackText) {
        const fb = stateRef.current.feedbackText;
        ctx.save();
        ctx.fillStyle = fb.color;
        ctx.shadowColor = fb.color;
        ctx.shadowBlur = 15;
        ctx.font = `italic bold ${32 * fb.scale}px "Space Grotesk", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(fb.text, width / 2, height / 2 + 50); // 画面中央よりやや下
        ctx.restore();
        ctx.shadowBlur = 0;
      }

      // --- J. フィーバーモード演出テキスト ---
      if (stateRef.current.fever) {
        ctx.save();
        const fAlpha = 0.6 + 0.4 * Math.sin(curTime * 20);
        ctx.fillStyle = `rgba(255, 0, 255, ${fAlpha})`;
        ctx.shadowColor = '#ff00ff';
        ctx.shadowBlur = 10;
        ctx.font = 'bold 24px "Space Grotesk", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⚡ FEVER x2 SCORE ⚡', width / 2, 75);
        ctx.restore();
        ctx.shadowBlur = 0;
      }

      // タイムバー（プログレスバー）の描画
      const timeProgress = curTime / stateRef.current.totalDuration;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fillRect(width / 2 - 150, 20, 300, 4);
      ctx.fillStyle = stateRef.current.fever ? '#ff00ff' : '#00ffff';
      ctx.fillRect(width / 2 - 150, 20, 300 * Math.min(1.0, timeProgress), 4);

      animationId = requestAnimationFrame(gameLoop);
    };

    animationId = requestAnimationFrame(gameLoop);
    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [difficulty]);

  return (
    <div id="game-arena-container" className="relative w-full h-[600px] bg-slate-950 rounded-xl border border-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.15)] overflow-hidden">
      
      {/* リアルタイム3Dキャンバス */}
      <canvas
        id="game-render-canvas"
        ref={canvasRef}
        width={800}
        height={600}
        onMouseMove={handleMouseMove}
        className="block w-full h-full cursor-none"
      />

      {/* 画面上のHUD (ヘッドアップディスプレイ) */}
      <div id="game-hud" className="absolute inset-x-0 top-0 p-6 flex justify-between items-start pointer-events-none select-none">
        
        {/* 左側: スコア & コンボ */}
        <div id="hud-stats-left" className="flex flex-col gap-1">
          <div className="font-mono text-xs text-cyan-400 tracking-wider">SCORE</div>
          <div className="font-sans text-3xl font-bold text-white tracking-tight tabular-nums">
            {score.score.toLocaleString()}
          </div>
          
          {score.combo > 0 && (
            <div className="mt-2 flex items-baseline gap-1 animate-bounce">
              <span className="font-sans text-4xl font-black text-fuchsia-400 tracking-tighter tabular-nums">
                {score.combo}
              </span>
              <span className="font-mono text-xs font-semibold text-fuchsia-300 tracking-widest">
                COMBO
              </span>
            </div>
          )}
        </div>

        {/* 右側: ライフ & フィーバーゲージ */}
        <div id="hud-stats-right" className="flex flex-col items-end gap-3 w-48">
          
          {/* HPバー */}
          <div className="w-full">
            <div className="flex justify-between font-mono text-xs text-cyan-400 mb-1">
              <span>SYSTEM HP</span>
              <span className={hp < 30 ? 'text-red-500 animate-pulse' : 'text-white'}>{hp}%</span>
            </div>
            <div className="h-2 w-full bg-slate-900 border border-cyan-500/20 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-150 ${
                  hp < 30 ? 'bg-red-500 shadow-[0_0_10px_#ef4444]' : 'bg-cyan-400 shadow-[0_0_10px_#06b6d4]'
                }`}
                style={{ width: `${hp}%` }}
              />
            </div>
          </div>

          {/* FEVERゲージ */}
          <div className="w-full">
            <div className="flex justify-between font-mono text-xs text-fuchsia-400 mb-1">
              <span>FEVER ENERGY</span>
              <span className={fever ? 'text-white font-bold animate-pulse' : ''}>
                {fever ? 'MAX' : `${Math.floor(feverValue)}%`}
              </span>
            </div>
            <div className="h-2 w-full bg-slate-900 border border-fuchsia-500/20 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-150 ${
                  fever
                    ? 'bg-gradient-to-r from-fuchsia-500 to-pink-400 shadow-[0_0_12px_#d946ef] animate-pulse'
                    : 'bg-fuchsia-500'
                }`}
                style={{ width: `${feverValue}%` }}
              />
            </div>
          </div>
        </div>

      </div>

      {/* 画面下のシステムメッセージ */}
      <div id="hud-bottom-hint" className="absolute inset-x-0 bottom-4 text-center pointer-events-none select-none">
        <p className="font-mono text-[10px] text-cyan-400/40 tracking-widest">
          AIM LOCK & PRESS SHOWN KEY TO DESTROY TARGET
        </p>
      </div>

      {/* クイックエグジットボタン */}
      <button
        id="exit-game-btn"
        onClick={() => {
          stopGame();
          onExit();
        }}
        className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-slate-900/80 hover:bg-red-950 border border-cyan-500/30 hover:border-red-500/50 rounded text-[10px] font-mono text-cyan-400 hover:text-red-400 cursor-pointer transition-colors"
      >
        ABORT MISSION
      </button>
    </div>
  );
}
