import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Camera,
  Magnet,
  Pause,
  Play,
  RotateCcw,
  Shield,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { NorthPoleEngine } from './game/NorthPoleEngine';
import {
  PACE_CONFIG,
  type CameraMode,
  type GameState,
  type HudSnapshot,
  type PaceMode,
} from './game/types';
import { OfflineIndicator, PWAInstallButton } from './pwa/PWAInstallUI';

const INITIAL_HUD: HudSnapshot = {
  score: 0,
  distance: 0,
  presents: 0,
  combo: 0,
  maxCombo: 0,
  multiplier: 1,
  speedKmh: 0,
  zoneName: 'Candy Cane Outskirts',
  shieldActive: false,
  magnetTimer: 0,
  turboTimer: 0,
  turboCharge: 0,
  highScore: 0,
  isNewHighScore: false,
  bannerText: null,
};

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<NorthPoleEngine | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [paceMode, setPaceMode] = useState<PaceMode>('standard');
  const [cameraMode, setCameraMode] = useState<CameraMode>('oblique');
  const [muted, setMuted] = useState(false);
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [webglError, setWebglError] = useState(false);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const engine = new NorthPoleEngine(el, {
      onStateChange: (next) => setGameState(next),
      onHudUpdate: (snapshot) => setHud(snapshot),
      onWebGLError: () => setWebglError(true),
    });
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const handleStart = useCallback(() => {
    engineRef.current?.startRun();
  }, []);

  const handlePauseToggle = useCallback(() => {
    engineRef.current?.togglePause();
  }, []);

  const handleReturnTitle = useCallback(() => {
    engineRef.current?.returnToTitle();
  }, []);

  const handlePaceChange = useCallback((mode: PaceMode) => {
    setPaceMode(mode);
    engineRef.current?.setPaceMode(mode);
  }, []);

  const handleCameraToggle = useCallback(() => {
    setCameraMode((prev) => {
      const next: CameraMode = prev === 'oblique' ? 'chase' : 'oblique';
      engineRef.current?.setCameraMode(next);
      return next;
    });
  }, []);

  const handleMuteToggle = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.audio.unlock();
    const isNowMuted = engine.audio.toggleMute();
    setMuted(isNowMuted);
  }, []);

  // Keyboard controls
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const engine = engineRef.current;
      if (!engine) return;

      if (e.key === 'm' || e.key === 'M') {
        handleMuteToggle();
        return;
      }

      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        if (gameState === 'PLAYING' || gameState === 'PAUSED') {
          e.preventDefault();
          engine.togglePause();
        }
        return;
      }

      if (gameState === 'TITLE_MENU' || gameState === 'GAME_OVER') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          engine.startRun();
        }
        return;
      }

      if (gameState !== 'PLAYING') return;

      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        engine.moveLane(-1);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        engine.moveLane(1);
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') {
        e.preventDefault();
        engine.jump();
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        engine.duck();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [gameState, handleMuteToggle]);

  // Swipe gestures on gameplay canvas
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (gameState !== 'PLAYING') return;
    swipeStartRef.current = { x: e.clientX, y: e.clientY, time: performance.now() };
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (gameState !== 'PLAYING' || !swipeStartRef.current) return;
    const dx = e.clientX - swipeStartRef.current.x;
    const dy = e.clientY - swipeStartRef.current.y;
    swipeStartRef.current = null;

    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (Math.max(absX, absY) < 22) return;

    if (absX > absY) {
      engineRef.current?.moveLane(dx < 0 ? -1 : 1);
    } else if (dy < 0) {
      engineRef.current?.jump();
    } else {
      engineRef.current?.duck();
    }
  };

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-[#091426] text-slate-100"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      {/* Dedicated WebGL Mount Container */}
      <div ref={mountRef} className="absolute inset-0 z-0" />

      {/* Graceful WebGL Fallback */}
      {webglError && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#091426] p-6">
          <div className="max-w-md rounded-xl border border-white/15 bg-[#0e1d36] p-6 text-center shadow-2xl">
            <h1 className="font-display text-2xl font-bold text-white">North Pole Rush 2.5D</h1>
            <p className="mt-2 text-sm text-slate-300">
              Your browser could not initialize a 3D WebGL graphics context. Enable hardware acceleration or try a modern browser to launch the sleigh run.
            </p>
          </div>
        </div>
      )}

      {/* Top HUD Bar */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-4 px-4 py-3 sm:px-6 sm:py-4">
        <div className="pointer-events-auto flex items-center gap-3">
          <span className="font-display text-base font-bold tracking-tight text-white whitespace-nowrap shrink-0 sm:text-lg">
            North Pole Rush
          </span>
          {gameState === 'PLAYING' && (
            <span className="hidden text-xs font-medium text-sky-200/85 md:inline whitespace-nowrap">
              {hud.zoneName}
            </span>
          )}
        </div>

        {/* Live Score Telemetry during Play / Pause */}
        {gameState !== 'TITLE_MENU' && (
          <div className="flex items-center gap-4 rounded-xl border border-white/15 bg-[#0a162b]/90 px-4 py-2 text-xs shadow-lg sm:gap-6">
            <div>
              <div className="text-[11px] font-medium text-slate-400">Score</div>
              <div className="font-mono-num text-base font-bold text-white sm:text-lg">
                {hud.score.toLocaleString()}
              </div>
            </div>
            <div className="h-7 w-px bg-white/10" aria-hidden="true" />
            <div>
              <div className="text-[11px] font-medium text-slate-400">Distance</div>
              <div className="font-mono-num text-sm font-semibold text-sky-200 sm:text-base">
                {hud.distance}m
              </div>
            </div>
            <div className="hidden h-7 w-px bg-white/10 sm:block" aria-hidden="true" />
            <div className="hidden sm:block">
              <div className="text-[11px] font-medium text-slate-400">Presents</div>
              <div className="font-mono-num text-sm font-semibold text-amber-300 sm:text-base">
                {hud.presents}
              </div>
            </div>
            {hud.combo > 1 && (
              <>
                <div className="h-7 w-px bg-white/10" aria-hidden="true" />
                <div>
                  <div className="text-[11px] font-medium text-amber-300">Streak</div>
                  <div className="font-mono-num text-sm font-bold text-amber-300 sm:text-base">
                    x{hud.multiplier}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Right Controls */}
        <div className="pointer-events-auto flex items-center gap-2 shrink-0">
          {gameState === 'TITLE_MENU' && <PWAInstallButton variant="compact" />}
          <button
            type="button"
            onClick={handleMuteToggle}
            aria-label={muted ? 'Unmute audio' : 'Mute audio'}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 bg-[#0a162b]/90 text-slate-200 transition hover:bg-[#13284d] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 cursor-pointer"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          {(gameState === 'PLAYING' || gameState === 'PAUSED') && (
            <button
              type="button"
              onClick={handlePauseToggle}
              aria-label={gameState === 'PAUSED' ? 'Resume run' : 'Pause run'}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 bg-[#0a162b]/90 text-slate-200 transition hover:bg-[#13284d] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 cursor-pointer"
            >
              {gameState === 'PAUSED' ? (
                <Play className="h-4 w-4" />
              ) : (
                <Pause className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
      </header>

      {/* Zone / Power-Up Announcement Banner */}
      {gameState === 'PLAYING' && hud.bannerText && (
        <div className="pointer-events-none absolute inset-x-0 top-20 z-20 flex justify-center px-4">
          <div className="rounded-lg border border-amber-300/30 bg-[#0b182e]/90 px-4 py-1.5 text-sm font-semibold text-amber-200 shadow-lg">
            {hud.bannerText}
          </div>
        </div>
      )}

      {/* Title Screen Overlay */}
      {gameState === 'TITLE_MENU' && (
        <main className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center p-4">
          <section className="pointer-events-auto w-full max-w-lg rounded-2xl border border-white/15 bg-[#0a162b]/92 p-6 shadow-2xl sm:p-8">
            <div className="text-xs font-medium text-sky-300">
              <span>2.5D Alpine Sleigh Runner</span>
              <span aria-hidden="true" className="mx-2 text-slate-500">·</span>
              <span className="font-mono-num text-amber-300">
                Best {hud.highScore.toLocaleString()}
              </span>
            </div>

            <h1
              className="font-display mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl"
              style={{ textWrap: 'balance' }}
            >
              North Pole Rush 2.5D
            </h1>

            <p className="mt-2.5 text-sm leading-relaxed text-slate-300">
              Carve across three snowy lanes, leap candy-cane hurdles, duck under frosted timber arches, and gather presents beneath the aurora.
            </p>

            {/* Pace Selector */}
            <div className="mt-5">
              <div className="mb-2 text-xs font-semibold text-slate-300">Run Pace</div>
              <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-white/10 bg-[#061020] p-1">
                {(['leisurely', 'standard', 'blizzard'] as PaceMode[]).map((mode) => {
                  const active = paceMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => handlePaceChange(mode)}
                      className={`rounded-lg px-3 py-2 text-xs font-semibold transition cursor-pointer whitespace-nowrap min-h-[40px] ${
                        active
                          ? 'bg-red-600 text-white shadow-sm'
                          : 'text-slate-300 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      {PACE_CONFIG[mode].label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-xs text-slate-400">
                {PACE_CONFIG[paceMode].description}
              </p>
            </div>

            {/* Compact Controls Legend */}
            <div className="mt-5 grid grid-cols-3 gap-2 border-t border-white/10 pt-4 text-xs text-slate-300">
              <div>
                <div className="font-semibold text-white">Steer Lanes</div>
                <div className="mt-0.5 text-slate-400">← / → or Swipe</div>
              </div>
              <div>
                <div className="font-semibold text-white">Jump Hurdles</div>
                <div className="mt-0.5 text-slate-400">↑ / Space / Swipe</div>
              </div>
              <div>
                <div className="font-semibold text-white">Duck Arches</div>
                <div className="mt-0.5 text-slate-400">↓ / S / Swipe</div>
              </div>
            </div>

            {/* Primary Actions */}
            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
              <button
                type="button"
                onClick={handleStart}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-red-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400 whitespace-nowrap shrink-0 cursor-pointer min-h-[44px]"
              >
                <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                <span>Start Run</span>
              </button>
              <PWAInstallButton variant="prominent" />
            </div>
          </section>
        </main>
      )}

      {/* Pause Overlay */}
      {gameState === 'PAUSED' && (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center bg-black/65 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pause-title"
        >
          <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#0a162b] p-6 text-center shadow-2xl">
            <h2 id="pause-title" className="font-display text-2xl font-bold text-white">
              Run Paused
            </h2>
            <p className="mt-1.5 text-xs text-slate-400">
              {hud.zoneName} · {hud.distance}m · {hud.score.toLocaleString()} pts
            </p>
            <div className="mt-6 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={handlePauseToggle}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500 cursor-pointer min-h-[44px]"
              >
                <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                <span>Resume</span>
              </button>
              <button
                type="button"
                onClick={handleStart}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-[#122442] px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:bg-[#193259] cursor-pointer min-h-[44px]"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                <span>Restart Run</span>
              </button>
              <button
                type="button"
                onClick={handleReturnTitle}
                className="rounded-lg px-4 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/5 hover:text-white cursor-pointer min-h-[40px]"
              >
                Back to Title
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Game Over Overlay */}
      {gameState === 'GAME_OVER' && (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="gameover-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#0a162b] p-6 shadow-2xl sm:p-7">
            <div className="text-xs font-medium text-sky-300">
              <span>{hud.zoneName}</span>
              {hud.isNewHighScore && (
                <>
                  <span aria-hidden="true" className="mx-2 text-slate-500">·</span>
                  <span className="font-semibold text-amber-300">New High Score</span>
                </>
              )}
            </div>
            <h2 id="gameover-title" className="font-display mt-1 text-3xl font-bold text-white">
              Sleigh Run Complete
            </h2>

            <div className="mt-5 grid grid-cols-2 gap-3 rounded-xl border border-white/10 bg-[#071122] p-4">
              <div>
                <div className="text-xs text-slate-400">Final Score</div>
                <div className="font-mono-num mt-0.5 text-xl font-bold text-white">
                  {hud.score.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Best Score</div>
                <div className="font-mono-num mt-0.5 text-xl font-bold text-amber-300">
                  {hud.highScore.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Distance</div>
                <div className="font-mono-num mt-0.5 text-base font-semibold text-sky-200">
                  {hud.distance}m
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Presents · Best Streak</div>
                <div className="font-mono-num mt-0.5 text-base font-semibold text-emerald-300">
                  {hud.presents} · {hud.maxCombo}
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
              <button
                type="button"
                onClick={handleStart}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500 cursor-pointer min-h-[44px]"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                <span>Play Again</span>
              </button>
              <button
                type="button"
                onClick={handleReturnTitle}
                className="inline-flex items-center justify-center rounded-lg border border-white/15 bg-[#122442] px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:bg-[#193259] cursor-pointer min-h-[44px]"
              >
                Title Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Compact Gameplay Dock (Zero center viewport occlusion) */}
      {gameState === 'PLAYING' && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex flex-col items-center gap-2.5 px-4">
          {/* Touch D-Pad for Mobile / Tablet Convenience */}
          <div className="pointer-events-auto flex w-full max-w-md items-center justify-between gap-2 md:hidden">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => engineRef.current?.moveLane(-1)}
                aria-label="Move left lane"
                className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/20 bg-[#0a162b]/90 text-white active:scale-95"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => engineRef.current?.moveLane(1)}
                aria-label="Move right lane"
                className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/20 bg-[#0a162b]/90 text-white active:scale-95"
              >
                <ArrowRight className="h-5 w-5" />
              </button>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => engineRef.current?.duck()}
                aria-label="Duck under arch"
                className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/20 bg-[#0a162b]/90 text-white active:scale-95"
              >
                <ArrowDown className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => engineRef.current?.jump()}
                aria-label="Jump over hurdle"
                className="flex h-12 w-12 items-center justify-center rounded-xl border border-amber-300/35 bg-red-600/95 text-white active:scale-95"
              >
                <ArrowUp className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-4 rounded-xl border border-white/15 bg-[#0a162b]/90 px-4 py-2 text-xs shadow-lg">
            {/* Overdrive Meter */}
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
              <span className="font-medium text-slate-300 whitespace-nowrap">
                {hud.turboTimer > 0 ? 'Overdrive' : 'Starlight'}
              </span>
              <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full bg-amber-400 transition-transform duration-150"
                  style={{
                    width: '100%',
                    transformOrigin: 'left',
                    transform: `scaleX(${
                      hud.turboTimer > 0
                        ? Math.min(1, hud.turboTimer / 5.2)
                        : hud.turboCharge / 100
                    })`,
                  }}
                />
              </div>
              <span className="font-mono-num text-amber-300 w-9 text-right">
                {hud.turboTimer > 0 ? `${hud.turboTimer.toFixed(1)}s` : `${hud.turboCharge}%`}
              </span>
            </div>

            {hud.shieldActive && (
              <div className="flex items-center gap-1.5 text-sky-300 font-semibold whitespace-nowrap">
                <Shield className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Shield Ready</span>
              </div>
            )}

            {hud.magnetTimer > 0 && (
              <div className="flex items-center gap-1.5 text-cyan-300 font-semibold whitespace-nowrap">
                <Magnet className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="font-mono-num">Magnet {hud.magnetTimer.toFixed(1)}s</span>
              </div>
            )}

            <div className="hidden h-4 w-px bg-white/15 sm:block" aria-hidden="true" />

            <button
              type="button"
              onClick={handleCameraToggle}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-[#122442] px-2.5 py-1 text-xs font-medium text-slate-200 transition hover:bg-[#1a345e] cursor-pointer whitespace-nowrap"
            >
              <Camera className="h-3.5 w-3.5 text-sky-300" aria-hidden="true" />
              <span>{cameraMode === 'oblique' ? '2.5D Oblique' : 'Chase Cam'}</span>
            </button>

            <span className="hidden font-mono-num text-slate-400 sm:inline whitespace-nowrap">
              {hud.speedKmh} km/h
            </span>
          </div>
        </div>
      )}

      <OfflineIndicator />
    </div>
  );
}
