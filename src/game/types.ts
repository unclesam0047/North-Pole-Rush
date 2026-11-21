export type GameState = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';

export type PaceMode = 'leisurely' | 'standard' | 'blizzard';

export type CameraMode = 'oblique' | 'chase';

export type ObstacleKind = 'pine' | 'hurdle' | 'arch' | 'snowball';

export type CollectibleKind =
  | 'present_red'
  | 'present_gold'
  | 'present_emerald'
  | 'cookie_turbo'
  | 'aurora_magnet'
  | 'frost_shield';

export interface HudSnapshot {
  score: number;
  distance: number;
  presents: number;
  combo: number;
  maxCombo: number;
  multiplier: number;
  speedKmh: number;
  zoneName: string;
  shieldActive: boolean;
  magnetTimer: number;
  turboTimer: number;
  turboCharge: number;
  highScore: number;
  isNewHighScore: boolean;
  bannerText: string | null;
}

export const PACE_CONFIG: Record<
  PaceMode,
  {
    label: string;
    baseSpeed: number;
    maxSpeed: number;
    accel: number;
    scoreScale: number;
    description: string;
  }
> = {
  leisurely: {
    label: 'Leisurely',
    baseSpeed: 19,
    maxSpeed: 34,
    accel: 0.22,
    scoreScale: 0.85,
    description: 'Relaxed alpine cruise',
  },
  standard: {
    label: 'Standard',
    baseSpeed: 24,
    maxSpeed: 44,
    accel: 0.34,
    scoreScale: 1.0,
    description: 'Balanced arcade rush',
  },
  blizzard: {
    label: 'Blizzard',
    baseSpeed: 29,
    maxSpeed: 54,
    accel: 0.48,
    scoreScale: 1.35,
    description: 'High-speed storm sprint',
  },
};

export const ZONES: { minDistance: number; name: string }[] = [
  { minDistance: 0, name: 'Candy Cane Outskirts' },
  { minDistance: 450, name: 'Frostpine Gorge' },
  { minDistance: 1000, name: 'Aurora Ridge' },
  { minDistance: 1700, name: 'Starlight Summit' },
];
