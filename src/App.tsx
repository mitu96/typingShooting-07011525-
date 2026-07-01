/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import TitleScreen from './components/TitleScreen';
import GameCanvas from './components/GameCanvas';
import ResultScreen from './components/ResultScreen';
import { GameScore, GameStatus } from './types';
import { Headphones, Radio, Power } from 'lucide-react';

export default function App() {
  const [status, setStatus] = useState<GameStatus>('TITLE');
  const [difficulty, setDifficulty] = useState<'EASY' | 'MEDIUM' | 'HARD'>('MEDIUM');
  const [finalScore, setFinalScore] = useState<GameScore>({
    score: 0,
    combo: 0,
    maxCombo: 0,
    perfect: 0,
    great: 0,
    good: 0,
    miss: 0,
  });

  const handleStartGame = (diff: 'EASY' | 'MEDIUM' | 'HARD') => {
    setDifficulty(diff);
    setStatus('PLAYING');
  };

  const handleGameOver = (score: GameScore) => {
    setFinalScore(score);
    setStatus('GAMEOVER');
  };

  const handleGameClear = (score: GameScore) => {
    setFinalScore(score);
    setStatus('RESULTS');
  };

  const handleRetry = () => {
    setStatus('PLAYING');
  };

  const handleExitToTitle = () => {
    setStatus('TITLE');
  };

  return (
    <div id="cyber-app-root" className="min-h-screen bg-[#020205] text-slate-100 flex flex-col justify-between p-4 sm:p-6 md:p-8 font-sans antialiased">
      
      {/* トップグロー効果バックグラウンド */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-cyan-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* グローバルヘッダー */}
      <header id="app-header" className="w-full max-w-4xl mx-auto flex items-center justify-between border-b border-cyan-950/40 pb-4 mb-4 z-10 select-none">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
          <span className="font-mono text-xs font-semibold tracking-[0.2em] text-cyan-400 uppercase">
            NEON RHYTHM PROTOCOL v1.0.4
          </span>
        </div>
        
        <div className="flex items-center gap-4 text-slate-400 font-mono text-[10px]">
          <div className="flex items-center gap-1">
            <Headphones className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span className="hidden sm:inline">USE HEADPHONES FOR FULL EXPERIENCE</span>
          </div>
          <div className="flex items-center gap-1 border-l border-slate-800 pl-4">
            <Radio className="w-3.5 h-3.5 text-fuchsia-400" />
            <span className="text-fuchsia-400">AUDIO IN SYNC</span>
          </div>
        </div>
      </header>

      {/* メインステージ (ゲームビューポート) */}
      <main id="app-stage" className="flex-1 flex items-center justify-center w-full max-w-4xl mx-auto z-10 py-2">
        <div className="w-full">
          {status === 'TITLE' && (
            <TitleScreen onStartGame={handleStartGame} />
          )}

          {status === 'PLAYING' && (
            <GameCanvas
              status={status}
              difficulty={difficulty}
              onGameOver={handleGameOver}
              onGameClear={handleGameClear}
              onExit={handleExitToTitle}
            />
          )}

          {status === 'GAMEOVER' && (
            <ResultScreen
              score={finalScore}
              cleared={false}
              difficulty={difficulty}
              onRetry={handleRetry}
              onExit={handleExitToTitle}
            />
          )}

          {status === 'RESULTS' && (
            <ResultScreen
              score={finalScore}
              cleared={true}
              difficulty={difficulty}
              onRetry={handleRetry}
              onExit={handleExitToTitle}
            />
          )}
        </div>
      </main>

      {/* フッター */}
      <footer id="app-footer" className="w-full max-w-4xl mx-auto border-t border-slate-900 pt-4 mt-4 text-center z-10 select-none">
        <p className="font-mono text-[9px] text-slate-600 tracking-wider">
          SYSTEM ACCESS SECURED // OPERATOR_ID: USER_2026 // ALL CORES ONLINE
        </p>
      </footer>
    </div>
  );
}
