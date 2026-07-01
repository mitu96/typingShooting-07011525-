/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Play, ShieldAlert, Cpu, Target, Keyboard } from 'lucide-react';

interface TitleScreenProps {
  onStartGame: (difficulty: 'EASY' | 'MEDIUM' | 'HARD') => void;
}

export default function TitleScreen({ onStartGame }: TitleScreenProps) {
  const [selectedDifficulty, setSelectedDifficulty] = React.useState<'EASY' | 'MEDIUM' | 'HARD'>('MEDIUM');

  return (
    <div id="title-screen-container" className="flex flex-col items-center justify-between min-h-[580px] p-8 bg-slate-950 rounded-xl border border-cyan-500/30 shadow-[0_0_40px_rgba(6,182,212,0.1)] relative overflow-hidden select-none">
      
      {/* ネオン装飾ライン */}
      <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_#00ffff]" />
      <div className="absolute bottom-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-fuchsia-500 to-transparent shadow-[0_0_15px_#ff00ff]" />

      {/* ヘッダー・ロゴ部分 */}
      <div className="text-center mt-6 w-full z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-950/40 border border-cyan-500/20 rounded-full mb-4">
          <Cpu className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
          <span className="font-mono text-[10px] text-cyan-400 tracking-widest uppercase">CYBER DRIVER NETWORK PROTOCAL</span>
        </div>
        
        {/* 輝くタイトル */}
        <h1 className="font-sans text-5xl font-black text-white tracking-tighter uppercase relative select-none">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-white to-fuchsia-400 filter drop-shadow-[0_0_15px_rgba(6,182,212,0.6)]">
            NEON BEAT SHOOTER
          </span>
          <span className="block text-[11px] font-mono tracking-[0.45em] text-cyan-300 mt-2">
            3D PERSPECTIVE SHOOTING RHYTHM ENGINE
          </span>
        </h1>
      </div>

      {/* チュートリアル / 遊び方解説 (ベゼル付の計器風) */}
      <div className="w-full max-w-xl bg-slate-900/40 border border-slate-800/80 rounded-lg p-5 my-4 z-10 backdrop-blur-sm">
        <h2 className="font-mono text-xs font-bold text-fuchsia-400 tracking-wider mb-3 flex items-center gap-1.5 uppercase">
          <ShieldAlert className="w-3.5 h-3.5" /> MISSION BRIEFING (遊び方)
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          <div className="flex flex-col items-center text-center p-2 rounded bg-slate-950/50 border border-slate-900">
            <div className="w-8 h-8 rounded-full bg-cyan-950 flex items-center justify-center mb-2 border border-cyan-500/30">
              <Target className="w-4 h-4 text-cyan-400" />
            </div>
            <span className="font-sans text-xs font-bold text-white mb-1">1. 照準(エイム)</span>
            <span className="font-sans text-[10px] text-slate-400 leading-normal">
              マウスを操作して、奥から飛んでくるノーツにカーソルを重ねてロックオンする。
            </span>
          </div>

          <div className="flex flex-col items-center text-center p-2 rounded bg-slate-950/50 border border-slate-900">
            <div className="w-8 h-8 rounded-full bg-fuchsia-950 flex items-center justify-center mb-2 border border-fuchsia-500/30">
              <Keyboard className="w-4 h-4 text-fuchsia-400" />
            </div>
            <span className="font-sans text-xs font-bold text-white mb-1">2. キー破壊</span>
            <span className="font-sans text-[10px] text-slate-400 leading-normal">
              ノーツが目前の判定リングに達する瞬間に、書かれているキーを入力して狙い撃つ！
            </span>
          </div>

          <div className="flex flex-col items-center text-center p-2 rounded bg-slate-950/50 border border-slate-900">
            <div className="w-8 h-8 rounded-full bg-yellow-950 flex items-center justify-center mb-2 border border-yellow-500/30">
              <span className="font-mono text-xs font-black text-yellow-400">20x</span>
            </div>
            <span className="font-sans text-xs font-bold text-white mb-1">3. フィーバー</span>
            <span className="font-sans text-[10px] text-slate-400 leading-normal">
              コンボを20回繋げるとフィーバー状態。BGMが激化しスコアが2倍になる！
            </span>
          </div>

        </div>
      </div>

      {/* 難易度選択 & スタートボタン */}
      <div className="flex flex-col items-center gap-6 w-full max-w-sm z-10 mb-6">
        
        {/* 難易度選択 */}
        <div className="w-full">
          <div className="text-center font-mono text-[10px] text-cyan-400 tracking-widest mb-2 uppercase">SELECT DIFFICULTY LEVEL</div>
          <div className="grid grid-cols-3 gap-2 bg-slate-900 p-1 rounded-md border border-slate-800">
            {(['EASY', 'MEDIUM', 'HARD'] as const).map((diff) => (
              <button
                key={diff}
                onClick={() => setSelectedDifficulty(diff)}
                className={`py-1.5 px-3 rounded text-xs font-mono font-bold tracking-wider transition-all duration-200 cursor-pointer ${
                  selectedDifficulty === diff
                    ? diff === 'EASY'
                      ? 'bg-emerald-500 text-slate-950 shadow-[0_0_10px_#10b981]'
                      : diff === 'MEDIUM'
                      ? 'bg-cyan-500 text-slate-950 shadow-[0_0_10px_#06b6d4]'
                      : 'bg-fuchsia-500 text-slate-950 shadow-[0_0_10px_#d946ef]'
                    : 'bg-transparent text-slate-400 hover:text-white hover:bg-slate-800/40'
                }`}
              >
                {diff}
              </button>
            ))}
          </div>
        </div>

        {/* 出撃ボタン */}
        <button
          onClick={() => onStartGame(selectedDifficulty)}
          className="group relative w-full py-4 px-6 bg-gradient-to-r from-cyan-500 via-indigo-500 to-fuchsia-500 rounded-lg font-sans font-black tracking-widest text-slate-950 text-sm hover:text-white uppercase overflow-hidden shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all duration-300 hover:shadow-[0_0_35px_rgba(217,70,239,0.5)] transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
        >
          {/* 光るアニメーションエフェクト */}
          <div className="absolute inset-0 w-1/2 h-full bg-white/20 skew-x-12 -translate-x-full group-hover:animate-shine" />
          
          <span className="flex items-center justify-center gap-2">
            <Play className="w-4 h-4 fill-current" /> START OPERATIONS (ゲーム開始)
          </span>
        </button>

      </div>

    </div>
  );
}
