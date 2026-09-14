import * as THREE from 'three';
import type { AABB } from './collision';
import { raycastAABB } from './collision';
import { GAME } from '../state';
import { PlayerBody } from './PlayerBody';
import { WebShot } from './WebShot';

const leftRadial = new THREE.Vector3();
const rightRadial = new THREE.Vector3();
const sharedTangent = new THREE.Vector3();

export class Web {
  readonly shot = new WebShot();
  readonly anchor = new THREE.Vector3();
  readonly bend = new THREE.Vector3();
  restLength = 0;
  attached = false;
  tension = 0;
  reelSpeed = 0;
  private hasBend = false;
  private previousLength = 0;
  private pendingReel = 0;
  private readonly offset = new THREE.Vector3();
  private readonly radial = new THREE.Vector3();
  private readonly ray = new THREE.Vector3();
  private readonly closestPoint = new THREE.Vector3();
  private readonly correction = new THREE.Vector3();

  fire(origin: THREE.Vector3, anchor: THREE.Vector3): void {
    this.release();
    this.anchor.copy(anchor);
    this.shot.fire(origin, anchor);
  }

  stepFlight(dt: number, player: PlayerBody): void {
    if (this.shot.step(dt)) this.attach(this.shot.target, player);
  }

  attach(anchor: THREE.Vector3, player: PlayerBody): void {
    this.shot.cancel();
    this.anchor.copy(anchor);
    this.restLength = Math.max(2, player.position.distanceTo(anchor));
    this.attached = true;
    this.tension = 0;
    this.reelSpeed = 0;
    this.pendingReel = 0;
    this.hasBend = false;
  }

  release(): void {
    this.shot.cancel();
    this.attached = false;
    this.tension = 0;
    this.reelSpeed = 0;
    this.pendingReel = 0;
    this.hasBend = false;
  }

  get lineEnd(): THREE.Vector3 {
    return this.hasBend ? this.bend : this.anchor;
  }

  get wrappedLength(): number {
    return this.hasBend ? this.bend.distanceTo(this.anchor) : 0;
  }

  step(dt: number, player: PlayerBody, buildings: AABB[], reelMetres = 0, _assist = true): void {
    this.prepare(player, buildings, reelMetres, dt);
    this.constrain(dt, player, buildings);
  }

  prepare(player: PlayerBody, buildings: AABB[], reelMetres: number, dt: number): void {
    if (!this.attached) return;
    this.tension = 0;
    this.previousLength = this.restLength;
    this.pendingReel = Math.min(GAME.ropeReelBuffer, this.pendingReel + Math.max(0, reelMetres));
    const targetSpeed = Math.min(GAME.ropeMaxReelSpeed, this.pendingReel / dt);
    this.reelSpeed = targetSpeed > 0 ? Math.min(targetSpeed, this.reelSpeed + GAME.ropeReelAcceleration * dt) : 0;
    this.restLength = Math.max(2, this.restLength - this.reelSpeed * dt);
    this.pendingReel = Math.max(0, this.pendingReel - this.reelSpeed * dt);
    if (this.restLength === 2) this.pendingReel = 0;
    this.updateBend(player, buildings);
  }

  constrain(dt: number, player: PlayerBody, buildings: AABB[]): void {
    if (!this.attached) return;
    const ropeTarget = this.hasBend ? this.bend : this.anchor;
    const freeLength = Math.max(0.5, this.restLength - this.wrappedLength);
    this.offset.copy(player.position).sub(ropeTarget);
    const distance = this.offset.length();
    if (distance < freeLength - 1e-6 || distance < 1e-6) return;
    this.radial.copy(this.offset).normalize();
    const stretch = Math.max(0, distance - freeLength);
    this.correction.copy(this.radial).multiplyScalar(-stretch);
    player.move(this.correction, buildings);
    const inwardSpeed = Math.max(0, this.previousLength - this.restLength) / dt;
    const impulse = Math.max(0, player.velocity.dot(this.radial) + inwardSpeed);
    this.tension = Math.max(this.tension, impulse * GAME.playerMass / dt);
    player.velocity.addScaledVector(this.radial, -impulse);
  }

  private updateBend(player: PlayerBody, buildings: AABB[]): void {
    this.ray.copy(player.position).sub(this.anchor);
    const distanceToAnchor = this.ray.length();
    if (distanceToAnchor <= 1) {
      this.hasBend = false;
      return;
    }
    this.ray.normalize();
    let closestDistance = Number.POSITIVE_INFINITY;
    for (const box of buildings) {
      const hit = raycastAABB(this.anchor, this.ray, box, distanceToAnchor - 0.5);
      if (hit && hit.distance > 0.05 && hit.distance < closestDistance) {
        closestDistance = hit.distance;
        this.closestPoint.copy(hit.point);
      }
    }
    if (!Number.isFinite(closestDistance)) this.hasBend = false;
    else if (!this.hasBend) {
      this.bend.copy(this.closestPoint).addScaledVector(this.ray, -0.15);
      this.hasBend = true;
    }
  }
}

export function stepWebs(
  dt: number,
  player: PlayerBody,
  buildings: AABB[],
  left: Web,
  right: Web,
  leftReel: number,
  rightReel: number,
  _assist: boolean,
): void {
  left.prepare(player, buildings, leftReel, dt);
  right.prepare(player, buildings, rightReel, dt);
  const both = left.attached && right.attached;
  if (both) {
    const minimum = left.lineEnd.distanceTo(right.lineEnd) + left.wrappedLength + right.wrappedLength + 0.05;
    const deficit = Math.max(0, minimum - left.restLength - right.restLength);
    left.restLength += deficit / 2;
    right.restLength += deficit / 2;
  }
  for (let iteration = 0; iteration < (both ? 4 : 1); iteration += 1) {
    left.constrain(dt, player, buildings);
    right.constrain(dt, player, buildings);
  }
  if (both && left.tension > 0 && right.tension > 0) {
    leftRadial.copy(player.position).sub(left.lineEnd).normalize();
    rightRadial.copy(player.position).sub(right.lineEnd).normalize();
    if (player.velocity.dot(leftRadial) > 1e-6 && player.velocity.dot(rightRadial) >= -1e-6) {
      sharedTangent.crossVectors(leftRadial, rightRadial);
      if (sharedTangent.lengthSq() > 1e-10) player.velocity.projectOnVector(sharedTangent);
    }
  }
}
