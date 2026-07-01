/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { GameScore } from '../types';
import { RefreshCw, LogOut, Award, Trophy, Sparkles } from 'lucide-react';

interface ResultScreenProps {
  score: GameScore;
  cleared: boolean;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  onRetry: () => void;
  onExit: () => void;
}

export default function ResultScreen({
  score,
  cleared,
  difficulty,
  onRetry,
  onExit,
}: ResultScreenProps) {
  
  // ランクの算出
  const totalNotes = score.perfect + score.great + score.good + score.miss;
  const hitRatio = totalNotes > 0 ? (score.perfect + score.great + score.good) / totalNotes : 0;
  
  let rank = 'F';
  let rankColor = 'text-red-500';
  let rankShadow = 'shadow-[0_0_20px_rgba(239,68,68,0.3)]';

  if (cleared) {
    if (hitRatio >= 0.95 && score.miss === 0) {
      rank = 'S';
      rankColor = 'text-yellow-400 font-extrabold';
      rankShadow = 'shadow-[0_0_25px_rgba(234,179,8,0.5)]';
    } else if (hitRatio >= 0.9) {
      rank = 'A';
      rankColor = 'text-fuchsia-400 font-bold';
      rankShadow = 'shadow-[0_0_20px_rgba(217,70,239,0.4)]';
    } else if (hitRatio >= 0.75) {
      rank = 'B';
      rankColor = 'text-cyan-400';
      rankShadow = 'shadow-[0_0_15px_rgba(6,182,212,0.3)]';
    } else {
      rank = 'C';
      rankColor = 'text-indigo-400';
      rankShadow = 'shadow-[0_0_10px_rgba(99,102,241,0.2)]';
    }
  }

  return (
    <div id="result-screen-container" className="flex flex-col items-center justify-between min-h-[580px] p-8 bg-slate-950 rounded-xl border border-cyan-500/30 shadow-[0_0_40px_rgba(6,182,212,0.1)] relative overflow-hidden select-none">
      
      {/* ネオン装飾ライン */}
      <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_#00ffff]" />
      <div className="absolute bottom-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-fuchsia-500 to-transparent shadow-[0_0_15px_#ff00ff]" />

      {/* ヘッダー */}
      <div className="text-center mt-4 w-full z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-950/40 border border-cyan-500/20 rounded-full mb-3">
          <Trophy className="w-3.5 h-3.5 text-yellow-400" />
          <span className="font-mono text-[10px] text-cyan-400 tracking-widest uppercase">
            OPERATION RESULTS EVALUATION
          </span>
        </div>
        
        <h1 className="font-sans text-4xl font-black text-white tracking-tighter uppercase">
          {cleared ? (
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 filter drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]">
              MISSION COMPLETED
            </span>
          ) : (
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-pink-500 filter drop-shadow-[0_0_10px_rgba(239,68,68,0.5)] animate-pulse">
              SYSTEM SHUTDOWN
            </span>
          )}
        </h1>
        <p className="font-mono text-xs text-slate-400 mt-1 uppercase tracking-widest">
          DIFFICULTY: <span className="text-cyan-400">{difficulty}</span>
        </p>
      </div>

      {/* メインリザルトグリッド (ランク ＆ 基本スコア) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-2xl my-4 z-10 items-center justify-center">
        
        {/* 左: 特大ランクバッジ */}
        <div className="flex flex-col items-center justify-center p-6 bg-slate-900/40 border border-slate-800 rounded-lg relative overflow-hidden">
          <div className="absolute top-2 left-2 text-[10px] font-mono text-slate-500 uppercase tracking-widest">PERFORMANCE GRADE</div>
          
          <div className={`w-32 h-32 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center ${rankShadow} ${rankColor} text-7xl font-sans leading-none relative z-10`}>
            {rank}
            {rank === 'S' && (
              <Sparkles className="absolute -top-1 -right-1 w-6 h-6 text-yellow-400 animate-spin-slow" />
            )}
          </div>
          
          <div className="mt-4 text-center">
            <div className="font-mono text-[10px] text-slate-400 tracking-wider uppercase">FINAL SCORE</div>
            <div className="font-sans text-3xl font-black text-white tracking-tight tabular-nums">
              {score.score.toLocaleString()}
            </div>
          </div>
        </div>

        {/* 右: 判定内訳リスト */}
        <div className="flex flex-col gap-3 p-5 bg-slate-900/40 border border-slate-800 rounded-lg">
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1 flex justify-between">
            <span>JUDGEMENT BREAKDOWN</span>
            <span>COUNT</span>
          </div>
          
          <div className="flex flex-col gap-2.5">
            {/* PERFECT */}
            <div className="flex justify-between items-center bg-slate-950/40 px-3 py-1.5 rounded border border-cyan-500/10">
              <span className="font-mono text-xs font-bold text-cyan-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400" /> PERFECT
              </span>
              <span className="font-sans text-sm font-bold text-white tabular-nums">{score.perfect}</span>
            </div>

            {/* GREAT */}
            <div className="flex justify-between items-center bg-slate-950/40 px-3 py-1.5 rounded border border-fuchsia-500/10">
              <span className="font-mono text-xs font-bold text-fuchsia-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-fuchsia-400" /> GREAT
              </span>
              <span className="font-sans text-sm font-bold text-white tabular-nums">{score.great}</span>
            </div>

            {/* GOOD */}
            <div className="flex justify-between items-center bg-slate-950/40 px-3 py-1.5 rounded border border-yellow-500/10">
              <span className="font-mono text-xs font-bold text-yellow-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-yellow-400" /> GOOD
              </span>
              <span className="font-sans text-sm font-bold text-white tabular-nums">{score.good}</span>
            </div>

            {/* MISS */}
            <div className="flex justify-between items-center bg-slate-950/40 px-3 py-1.5 rounded border border-red-500/10">
              <span className="font-mono text-xs font-bold text-red-500 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500" /> MISS
              </span>
              <span className="font-sans text-sm font-bold text-white tabular-nums">{score.miss}</span>
            </div>

            {/* MAX COMBO */}
            <div className="flex justify-between items-center bg-slate-950/80 px-3 py-2 rounded border border-slate-800">
              <span className="font-mono text-xs text-slate-400 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-fuchsia-400" /> MAX COMBO
              </span>
              <span className="font-sans text-sm font-black text-fuchsia-400 tabular-nums">{score.maxCombo}</span>
            </div>
          </div>
        </div>

      </div>

      {/* アクションボタン */}
      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md z-10 mb-4">
        <button
          onClick={onRetry}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 px-6 bg-cyan-600 hover:bg-cyan-500 text-slate-950 hover:text-white rounded-lg font-sans font-black text-xs tracking-widest uppercase transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-[0_0_15px_rgba(6,182,212,0.2)]"
        >
          <RefreshCw className="w-4 h-4" /> RETRY MISSION (再挑戦)
        </button>
        
        <button
          onClick={onExit}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 px-6 bg-slate-900 hover:bg-slate-800 text-cyan-400 hover:text-white rounded-lg font-sans font-bold text-xs tracking-widest uppercase border border-slate-800 hover:border-cyan-500/30 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
        >
          <LogOut className="w-4 h-4" /> EXIT (タイトルに戻る)
        </button>
      </div>

    </div>
  );
}
