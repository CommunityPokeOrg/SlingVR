import * as THREE from 'three';
import { GAME } from '../state';
import type { CityData } from '../city/CityGenerator';
import { raycastAABBs, type AABB } from './collision';
import { findLedge, type Ledge } from './Ledge';
import { PlayerBody } from './PlayerBody';
import { WebShot } from './WebShot';

export type ZipKind = 'perch' | 'surface';

export interface ZipTarget {
  point: THREE.Vector3;
  normal: THREE.Vector3 | null;
  kind: ZipKind;
  distance: number;
  ledge?: Ledge;
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

export class Zip {
  active = false;
  readonly leftShot = new WebShot();
  readonly rightShot = new WebShot();
  target = new THREE.Vector3();
  readonly arrivalVelocity = new THREE.Vector3();
  private speed: number = GAME.zipSpeed;
  private readonly travel = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private readonly approach = new THREE.Vector3();
  private readonly landing = new THREE.Vector3();
  private readonly displacement = new THREE.Vector3();
  private approaching = false;
  private pendingTarget: ZipTarget | null = null;

  get flying(): boolean {
    return this.pendingTarget !== null;
  }

  shoot(target: ZipTarget, player: PlayerBody, leftOrigin: THREE.Vector3, rightOrigin: THREE.Vector3, speed: number = GAME.zipSpeed): boolean {
    if (target.kind !== 'perch' || player.position.distanceTo(target.point) > GAME.zipRange) return false;
    this.pendingTarget = target;
    this.target.copy(target.point);
    this.speed = speed;
    this.leftShot.fire(leftOrigin, target.point);
    this.rightShot.fire(rightOrigin, target.point);
    this.active = true;
    return true;
  }

  aim(origin: THREE.Vector3, direction: THREE.Vector3, city: CityData, allowLedge = true): ZipTarget | null {
    this.look.copy(direction).normalize();
    const ledge = allowLedge ? findLedge(origin, this.look, city.buildings) : null;
    if (ledge) return { ...ledge, normal: ledge.ledge.normal, kind: 'perch' };
    const hit = raycastAABBs(origin, this.look, city.buildings, GAME.webZipRange);
    if (hit) return { point: hit.point.clone(), normal: hit.normal.clone(), kind: 'surface', distance: hit.distance };
    return null;
  }

  /** Starts a zip-to-point. Rejects anything that is not a perch inside `GAME.zipRange`. */
  launch(target: ZipTarget, player: PlayerBody, speed: number = GAME.zipSpeed): boolean {
    if (target.kind !== 'perch') return false;
    if (player.position.distanceTo(target.point) > GAME.zipRange) return false;
    this.target.copy(target.point);
    this.landing.copy(target.point);
    this.landing.y += GAME.playerRadius;
    this.approach.copy(this.landing);
    this.approaching = target.ledge !== undefined;
    if (target.ledge) {
      this.landing.addScaledVector(target.ledge.normal, -(GAME.playerRadius + 0.15));
      this.approach.addScaledVector(target.ledge.normal, GAME.playerRadius + 0.1);
      this.approach.y += 0.1;
    }
    this.speed = speed;
    this.arrivalVelocity.copy(this.approach).sub(player.position).normalize().multiplyScalar(speed);
    player.grounded = false;
    this.active = true;
    return true;
  }

  /** Returns true on the step the player mounts the perch. */
  step(dt: number, player: PlayerBody, buildings: AABB[] = []): boolean {
    if (!this.active) return false;
    if (this.pendingTarget) {
      player.step(dt, buildings);
      this.leftShot.step(dt);
      this.rightShot.step(dt);
      if (!this.leftShot.flying && !this.rightShot.flying) {
        const target = this.pendingTarget;
        this.pendingTarget = null;
        if (!this.launch(target, player, this.speed)) this.cancel();
      }
      return false;
    }
    let remaining = this.speed * dt;
    for (let segment = 0; segment < 2; segment += 1) {
      const destination = this.approaching ? this.approach : this.landing;
      this.travel.copy(destination).sub(player.position);
      const distance = this.travel.length();
      const advance = Math.min(remaining, distance);
      this.travel.normalize();
      player.velocity.copy(this.travel).multiplyScalar(this.speed);
      this.displacement.copy(this.travel).multiplyScalar(advance);
      player.move(this.displacement, buildings);
      const distanceLeft = player.position.distanceTo(destination);
      if (distanceLeft > distance - advance + 0.01) {
        this.cancel();
        return false;
      }
      if (distanceLeft > 1e-5) return false;
      remaining -= advance;
      if (this.approaching) {
        this.approaching = false;
        continue;
      }
      player.velocity.set(0, 0, 0);
      player.grounded = true;
      this.active = false;
      return true;
    }
    return false;
  }

  cancel(): void {
    this.active = false;
    this.pendingTarget = null;
    this.leftShot.cancel();
    this.rightShot.cancel();
  }
}
