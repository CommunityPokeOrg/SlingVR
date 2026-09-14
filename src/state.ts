export const GAME = {
  gravity: -20,
  playerMass: 80,
  playerRadius: 0.5,
  eyeHeight: 1.6,
  fixedStep: 1 / 120,
  maxSubsteps: 4,
  airDrag: 0.12,
  terminalVelocity: 72,
  groundFriction: 9,
  groundStopSpeed: 0.35,
  groundMaxSpeed: 7.5,
  groundAcceleration: 42,
  airAcceleration: 14,
  airControlSpeed: 9,
  jumpSpeed: 10,
  ropeStiffness: 95,
  ropeDamping: 10,
  ropeReelSpeed: 5,
  pullGain: 1.6,
  swingBoost: 5,
  webRange: 120,
  webZipRange: 60,
  webZipImpulse: 16,
  webZipMinImpulse: 8,
  webZipMaxImpulse: 26,
  webZipLift: 3,
  webZipMaxSpeed: 34,
  webZipFlashTime: 0.28,
  zipSpeed: 35,
  zipMinSpeed: 14,
  zipMaxSpeed: 48,
  zipPullDistance: 0.45,
  zipRange: 45,
  zipConeDegrees: 20,
  mountGraceTime: 0.35,
  mountJumpBufferTime: 0.3,
  mountSlingshotSpeed: 14,
  mountSlingshotLift: 8,
  punchSpeed: 3.2,
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
