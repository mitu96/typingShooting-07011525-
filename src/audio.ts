/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class AudioEngine {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private isPlaying = false;
  private bpm = 130;
  private lookAhead = 25.0; // ミリ秒単位。どれくらい先までスケジュールするか
  private scheduleAheadTime = 0.1; // 秒単位。
  private nextNoteTime = 0.0; // 次の16分音符を鳴らすべき時間 (秒)
  private currentStep = 0; // 0〜15の16ステップ
  private timerId: any = null;

  private onBeatCallback: ((beatCount: number, time: number) => void) | null = null;
  private beatCount = 0;
  private isFever = false;

  // シンセサイザーのグローバルボリューム
  private masterGain: GainNode | null = null;

  constructor() {}

  init() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioContextClass();
    
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.4, this.ctx.currentTime); // 適度な音量
    this.masterGain.connect(this.ctx.destination);

    // ホワイトノイズの生成
    const bufferSize = this.ctx.sampleRate * 2; // 2秒分
    this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }

  start(bpm: number, onBeat: (beatCount: number, time: number) => void) {
    this.init();
    if (this.isPlaying) return;
    
    this.bpm = bpm;
    this.onBeatCallback = onBeat;
    this.isPlaying = true;
    this.currentStep = 0;
    this.beatCount = 0;
    this.isFever = false;

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    if (this.ctx) {
      this.nextNoteTime = this.ctx.currentTime + 0.05;
      this.scheduler();
    }
  }

  stop() {
    this.isPlaying = false;
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  setFever(fever: boolean) {
    this.isFever = fever;
    if (this.masterGain && this.ctx) {
      // フィーバー中はマスター音量を少しだけ上げて迫力を出す
      this.masterGain.gain.setTargetAtTime(fever ? 0.5 : 0.4, this.ctx.currentTime, 0.2);
    }
  }

  getCurrentTime(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  private scheduler() {
    if (!this.isPlaying || !this.ctx) return;

    while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
      this.scheduleStep(this.currentStep, this.nextNoteTime);
      this.advanceStep();
    }

    this.timerId = setTimeout(() => this.scheduler(), this.lookAhead);
  }

  private advanceStep() {
    if (!this.ctx) return;
    const secondsPerBeat = 60.0 / this.bpm;
    const secondsPerStep = secondsPerBeat / 4; // 16分音符
    this.nextNoteTime += secondsPerStep;

    this.currentStep = (this.currentStep + 1) % 16;
  }

  private scheduleStep(step: number, time: number) {
    if (!this.ctx) return;

    const is4thBeat = step % 4 === 0;

    // 1. キックドラムのトリガー (4つ打ち)
    if (is4thBeat) {
      this.playKickSynth(time);
      
      // ビートコールバックを実行 (画面のパンプ演出用)
      if (this.onBeatCallback) {
        // メインスレッドで安全に実行できるようにsetTimeoutでラップ
        setTimeout(() => {
          if (this.isPlaying && this.onBeatCallback) {
            this.onBeatCallback(this.beatCount, time);
            this.beatCount++;
          }
        }, 0);
      }
    }

    // 2. スネアドラムのトリガー (2拍目、4拍目のバックビート)
    if (step === 4 || step === 12) {
      this.playSnareSynth(time);
    }

    // 3. ハイハットのトリガー (裏打ちハット or 16ビートハット)
    // 偶数ステップ、特に裏（step%4 === 2）で強調
    if (step % 4 === 2) {
      this.playHihatSynth(time, 0.06); // オープン風
    } else if (step % 2 === 1) {
      this.playHihatSynth(time, 0.02); // クローズ風
    }

    // 4. ベースライン (16ビートサイバーアシッドベース)
    this.playBassSynth(step, time);

    // 5. メロディアルペジオ (フィーバー中、あるいは通常の特定のステップでメロディカルに)
    this.playMelodySynth(step, time);
  }

  // --- ドラム音響合成 ---

  private playKickSynth(time: number) {
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.masterGain);

    // キックはピッチが急速に下がるサイン波
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(45, time + 0.12);

    // 音量エンベロープ
    gain.gain.setValueAtTime(1.2, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.25);

    osc.start(time);
    osc.stop(time + 0.3);
  }

  private playSnareSynth(time: number) {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;

    // スネアはホワイトノイズと短いトーンの合体
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(1200, time);

    const noiseGain = this.ctx.createGain();
    
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    noiseGain.gain.setValueAtTime(0.5, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.18);

    // トーン成分
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, time);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);

    oscGain.gain.setValueAtTime(0.6, time);
    oscGain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);

    noise.start(time);
    noise.stop(time + 0.2);
    osc.start(time);
    osc.stop(time + 0.12);
  }

  private playHihatSynth(time: number, duration: number) {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;

    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(7000, time);

    const gain = this.ctx.createGain();

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    gain.gain.setValueAtTime(0.25, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + duration);

    source.start(time);
    source.stop(time + duration + 0.05);
  }

  // --- ベースライン合成 (アシッドテクノ) ---

  private playBassSynth(step: number, time: number) {
    if (!this.ctx || !this.masterGain) return;

    // 16ステップのベースライン譜面 (Cマイナー系サイバーベース)
    // 0:鳴らす, -1:休符
    const bassNotes = [
      36, 36, 48, 36,  // C1, C1, C2, C1
      39, 39, 51, 39,  // D#1, D#1, D#2, D#1
      41, 41, 53, 41,  // F1, F1, F2, F1
      46, 46, 43, 36   // A#1, A#1, G1, C1
    ];

    const midiNote = bassNotes[step];
    if (midiNote === -1) return;

    // フィーバー中は3連符のように細かくするか、全ステップで激しく鳴らす
    const shouldPlay = this.isFever || (step % 2 === 0 || step % 3 === 0);
    if (!shouldPlay) return;

    const freq = this.midiNoteToFreq(midiNote);

    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.type = 'sawtooth'; // 鋭いサイバーのこぎり波
    osc.frequency.setValueAtTime(freq, time);

    // フィルターのエンベロープ (アシッドベースっぽくうねる)
    filter.type = 'lowpass';
    const baseCutoff = this.isFever ? 1500 : 700;
    const peakCutoff = this.isFever ? 4500 : 2500;
    filter.frequency.setValueAtTime(peakCutoff, time);
    filter.frequency.exponentialRampToValueAtTime(baseCutoff, time + 0.08);
    filter.Q.setValueAtTime(this.isFever ? 8 : 4, time);

    // 音量エンベロープ (歯切れのいいベース)
    gain.gain.setValueAtTime(this.isFever ? 0.35 : 0.25, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.12);

    osc.start(time);
    osc.stop(time + 0.15);
  }

  // --- メロディ・アルペジオ合成 ---

  private playMelodySynth(step: number, time: number) {
    if (!this.ctx || !this.masterGain) return;

    // アルペジオフレーズ (C minorペンタトニック系)
    // 0: 無音
    const normalMelody = [
      60,  0, 63,  0, 65,  0, 67, 70, // C4, D#4, F4, G4, A#4
       0, 67,  0, 65,  0, 63, 60,  0
    ];

    const feverMelody = [
      72, 75, 79, 75, 77, 75, 72, 79, // 高音域で超高速サイバーアルペジオ！
      72, 75, 79, 75, 84, 82, 79, 77
    ];

    const midiNote = this.isFever ? feverMelody[step] : normalMelody[step];
    if (midiNote === 0) return;

    const freq = this.midiNoteToFreq(midiNote);

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const delay = this.ctx.createDelay();
    const delayGain = this.ctx.createGain();

    // デレイ効果をつけて広がりを出す
    delay.delayTime.setValueAtTime(0.15, time);
    delayGain.gain.setValueAtTime(0.3, time);

    osc.connect(gain);
    gain.connect(this.masterGain);

    // ディレイのフィードバックループ
    gain.connect(delay);
    delay.connect(delayGain);
    delayGain.connect(this.masterGain);
    delayGain.connect(delay); // ループ

    osc.type = 'triangle'; // 澄んだキラキラしたシンセ
    osc.frequency.setValueAtTime(freq, time);

    // ビブラート（ピッチ揺らし）
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.setValueAtTime(8, time);
    lfoGain.gain.setValueAtTime(5, time); // 5Hzずらす
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    lfo.start(time);
    lfo.stop(time + 0.2);

    // 音量
    gain.gain.setValueAtTime(this.isFever ? 0.15 : 0.08, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

    osc.start(time);
    osc.stop(time + 0.2);
  }

  // --- SE (効果音) 生成システム ---

  // 1. レーザーショット音 (キー入力時)
  playLaser() {
    this.init();
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    // サイバーレーザー。高速下降周波数
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1500, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.12);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1000, now);
    filter.Q.setValueAtTime(3, now);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.start(now);
    osc.stop(now + 0.18);
  }

  // 2. 爆発破壊音 (ノーツ破壊成功時)
  playExplosion(result: 'PERFECT' | 'GREAT' | 'GOOD') {
    this.init();
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;

    const now = this.ctx.currentTime;
    
    // ノイズ成分
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    
    const gain = this.ctx.createGain();

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    // 評価によってピッチや派手さを変える
    let noiseFreq = 800;
    let duration = 0.25;
    let volume = 0.4;

    if (result === 'PERFECT') {
      noiseFreq = 1600;
      duration = 0.4;
      volume = 0.6;
      
      // PERFECT時はキラキラした高音ベルを足す
      const bell = this.ctx.createOscillator();
      const bellGain = this.ctx.createGain();
      bell.type = 'sine';
      bell.frequency.setValueAtTime(2500, now);
      bell.frequency.exponentialRampToValueAtTime(1200, now + 0.2);
      bell.connect(bellGain);
      bellGain.connect(this.masterGain);
      bellGain.gain.setValueAtTime(0.2, now);
      bellGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      bell.start(now);
      bell.stop(now + 0.3);
    } else if (result === 'GREAT') {
      noiseFreq = 1200;
      duration = 0.3;
      volume = 0.45;
    } else {
      noiseFreq = 700;
      duration = 0.2;
      volume = 0.3;
    }

    filter.frequency.setValueAtTime(noiseFreq, now);
    filter.frequency.exponentialRampToValueAtTime(200, now + duration);

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.start(now);
    noise.stop(now + duration + 0.05);
  }

  // 3. ミス警告音
  playMiss() {
    this.init();
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.masterGain);

    // 低い不快な金属音 (ブブーッ)
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.setValueAtTime(115, now + 0.05);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.start(now);
    osc.stop(now + 0.18);
  }

  private midiNoteToFreq(note: number): number {
    return 440 * Math.pow(2, (note - 69) / 12);
  }
}

export const audio = new AudioEngine();
