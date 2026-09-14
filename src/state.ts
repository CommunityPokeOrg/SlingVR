export const GAME = {
  gravity: -20,
  playerMass: 80,
  playerRadius: 0.5,
  eyeHeight: 1.6,
  fixedStep: 1 / 120,
  maxSubsteps: 12,
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
  ropeReelSpeed: 5,
  pullGain: 1.6,
  swingBoost: 5,
  webRange: 120,
  webZipRange: 60,
  webZipImpulse: 28,
  webZipMinImpulse: 8,
  webZipMaxImpulse: 36,
  webZipLift: 6,
  webZipMaxSpeed: 42,
  webZipFlashTime: 0.28,
  zipSpeed: 35,
  zipMinSpeed: 14,
  zipMaxSpeed: 48,
  zipPullDistance: 0.45,
  zipRange: 45,
  zipConeDegrees: 7,
  zipSnapDistance: 2.5,
  zipDualAimDistance: 2.5,
  mountGraceTime: 0.35,
  mountJumpBufferTime: 0.3,
  mountSlingshotSpeed: 14,
  mountSlingshotLift: 8,
  punchSpeed: 3.2,
  wallContactTolerance: 0.03,
  wallRunSpeed: 12,
  wallLookThreshold: 0.25,
  wallJumpCooldown: 0.3,
} as const;

export type TravelState =
  | 'Grounded'
  | 'Airborne'
  | 'Swinging L'
  | 'Swinging R'
  | 'Swinging Both'
  | 'Zipping'
  | 'WallRunning';
