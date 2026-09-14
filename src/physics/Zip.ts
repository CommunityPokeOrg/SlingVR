import * as THREE from 'three';
import { GAME } from '../state';
import type { CityData } from '../city/CityGenerator';
import { raycastAABBs } from './collision';
import { PlayerBody } from './PlayerBody';

export type ZipKind = 'perch' | 'surface';

export interface ZipTarget {
  point: THREE.Vector3;
  normal: THREE.Vector3 | null;
  kind: ZipKind;
  distance: number;
}

export function zipSpeedForCharge(charge: number): number {
  return THREE.MathUtils.lerp(GAME.zipMinSpeed, GAME.zipMaxSpeed, THREE.MathUtils.clamp(charge, 0, 1));
}

export function webZipImpulseForCharge(charge: number): number {
  return THREE.MathUtils.lerp(GAME.webZipMinImpulse, GAME.webZipMaxImpulse, THREE.MathUtils.clamp(charge, 0, 1));
}

export function pullCharge(pressHand: THREE.Vector3, hand: THREE.Vector3, dirToTarget: THREE.Vector3): number {
  return THREE.MathUtils.clamp(pressHand.clone().sub(hand).dot(dirToTarget), 0, GAME.zipPullDistance) / GAME.zipPullDistance;
}

const perchOffset = new THREE.Vector3();

/** Nearest perch inside the aim cone and within the strict zip-to-point range, or null. */
export function findPerch(origin: THREE.Vector3, direction: THREE.Vector3, perches: THREE.Vector3[]): ZipTarget | null {
  const cone = Math.cos(THREE.MathUtils.degToRad(GAME.zipConeDegrees));
  let best: THREE.Vector3 | null = null;
  let bestDistance: number = GAME.zipRange;
  for (const perch of perches) {
    perchOffset.copy(perch).sub(origin);
    const distance = perchOffset.length();
    if (distance > GAME.zipRange || distance >= bestDistance) continue;
    if (perchOffset.normalize().dot(direction) > cone) {
      best = perch;
      bestDistance = distance;
    }
  }
  return best ? { point: best, normal: null, kind: 'perch', distance: bestDistance } : null;
}

/**
 * Web zip: one line to a surface, then an impulse toward it. Works grounded or airborne.
 * Keeps existing momentum along the pull, but caps the resulting speed so chained zips stay controllable.
 */
export function applyWebZip(player: PlayerBody, target: THREE.Vector3, impulse: number, direction = new THREE.Vector3()): void {
  direction.copy(target).sub(player.position);
  if (direction.lengthSq() < 1e-6) return;
  direction.normalize();
  const along = player.velocity.dot(direction);
  if (along < 0) player.velocity.addScaledVector(direction, -along);
  const add = Math.min(impulse, Math.max(0, GAME.webZipMaxSpeed - Math.max(0, along)));
  player.velocity.addScaledVector(direction, add);
  if (player.grounded) {
    player.velocity.y = Math.max(player.velocity.y, GAME.webZipLift);
    player.grounded = false;
  }
}

export class Zip {
  active = false;
  target = new THREE.Vector3();
  readonly arrivalVelocity = new THREE.Vector3();
  private speed: number = GAME.zipSpeed;
  private readonly travel = new THREE.Vector3();
  private readonly look = new THREE.Vector3();

  /** Perch inside the zip-to-point range wins; otherwise a building surface inside web-zip range. */
  aim(origin: THREE.Vector3, direction: THREE.Vector3, city: CityData): ZipTarget | null {
    this.look.copy(direction).normalize();
    const perch = findPerch(origin, this.look, city.perches);
    if (perch) return perch;
    const hit = raycastAABBs(origin, this.look, city.buildings, GAME.webZipRange);
    if (hit) return { point: hit.point, normal: hit.normal, kind: 'surface', distance: hit.distance };
    return null;
  }

  /** Starts a zip-to-point. Rejects anything that is not a perch inside `GAME.zipRange`. */
  launch(target: ZipTarget, player: PlayerBody, speed: number = GAME.zipSpeed): boolean {
    if (target.kind !== 'perch') return false;
    if (player.position.distanceTo(target.point) > GAME.zipRange) return false;
    this.target.copy(target.point);
    this.speed = speed;
    this.active = true;
    return true;
  }

  /** Returns true on the step the player mounts the perch. */
  step(dt: number, player: PlayerBody): boolean {
    if (!this.active) return false;
    this.travel.copy(this.target).sub(player.position);
    const distance = this.travel.length();
    if (distance < Math.max(1.2, this.speed * dt * 1.5)) {
      this.arrivalVelocity.copy(player.velocity);
      player.position.copy(this.target);
      player.position.y += 0.7;
      player.velocity.set(0, 0, 0);
      player.grounded = true;
      this.active = false;
      return true;
    }
    player.velocity.copy(this.travel.normalize().multiplyScalar(this.speed));
    player.position.addScaledVector(player.velocity, dt);
    return false;
  }

  cancel(): void {
    this.active = false;
  }
}
