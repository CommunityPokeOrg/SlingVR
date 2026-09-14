export const GAME = {
  gravity: -20,
  playerMass: 80,
  playerRadius: 0.5,
  eyeHeight: 1.6,
  fixedStep: 1 / 120,
  maxSubsteps: 4,
  airDrag: 0.12,
  terminalVelocity: 72,
  ropeStiffness: 95,
  ropeDamping: 10,
  ropeReelSpeed: 5,
  swingBoost: 5,
  zipSpeed: 35,
  zipRange: 120,
  wallDistance: 1.2,
  wallOffset: 0.6,
  wallRunSpeed: 12,
} as const;

export type TravelState =
  | 'Grounded'
  | 'Airborne'
  | 'Swinging L'
  | 'Swinging R'
  | 'Swinging Both'
  | 'Zipping'
  | 'WallRunning';
