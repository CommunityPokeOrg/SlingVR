import * as THREE from 'three';
import type { AABB } from './collision';
import { raycastAABB } from './collision';
import { GAME } from '../state';
import { PlayerBody } from './PlayerBody';

const leftRadial = new THREE.Vector3();
const rightRadial = new THREE.Vector3();
const sharedTangent = new THREE.Vector3();

export class Web {
  readonly anchor = new THREE.Vector3();
  readonly bend = new THREE.Vector3();
  restLength = 0;
  attached = false;
  tension = 0;
  private hasBend = false;
  private readonly offset = new THREE.Vector3();
  private readonly radial = new THREE.Vector3();
  private readonly tangent = new THREE.Vector3();
  private readonly ray = new THREE.Vector3();
  private readonly closestPoint = new THREE.Vector3();
  private readonly correction = new THREE.Vector3();

  attach(anchor: THREE.Vector3, player: PlayerBody): void {
    this.anchor.copy(anchor);
    this.restLength = Math.max(2, player.position.distanceTo(anchor) - 0.8);
    this.attached = true;
    this.tension = 0;
    this.hasBend = false;
  }

  release(): void {
    this.attached = false;
    this.tension = 0;
    this.hasBend = false;
  }

  get lineEnd(): THREE.Vector3 {
    return this.hasBend ? this.bend : this.anchor;
  }

  get wrappedLength(): number {
    return this.hasBend ? this.bend.distanceTo(this.anchor) : 0;
  }

  step(dt: number, player: PlayerBody, buildings: AABB[], reelMetres = 0, assist = true): void {
    this.prepare(player, buildings, reelMetres);
    this.constrain(dt, player, buildings, assist);
  }

  prepare(player: PlayerBody, buildings: AABB[], reelMetres: number): void {
    if (!this.attached) return;
    this.restLength = Math.max(2, this.restLength - Math.max(0, reelMetres));
    this.updateBend(player, buildings);
  }

  constrain(dt: number, player: PlayerBody, buildings: AABB[], assist: boolean): void {
    if (!this.attached) return;
    const ropeTarget = this.hasBend ? this.bend : this.anchor;
    const freeLength = Math.max(0.5, this.restLength - this.wrappedLength);
    this.offset.copy(player.position).sub(ropeTarget);
    const distance = this.offset.length();
    if (distance <= freeLength) {
      this.tension = 0;
      return;
    }
    this.radial.copy(this.offset).normalize();
    const stretch = distance - freeLength;
    this.tension = stretch * GAME.ropeStiffness + Math.max(0, player.velocity.dot(this.radial)) * GAME.playerMass / dt;
    this.correction.copy(this.radial).multiplyScalar(-stretch);
    player.move(this.correction, buildings);
    const outwardSpeed = player.velocity.dot(this.radial);
    if (outwardSpeed > 0) player.velocity.addScaledVector(this.radial, -outwardSpeed);
    this.tangent.copy(player.velocity).addScaledVector(this.radial, -player.velocity.dot(this.radial));
    if (assist && this.tangent.lengthSq() > 0.1) player.velocity.addScaledVector(this.tangent.normalize(), GAME.swingBoost * dt);
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
  assist: boolean,
): void {
  left.prepare(player, buildings, leftReel);
  right.prepare(player, buildings, rightReel);
  const both = left.attached && right.attached;
  if (both) {
    const minimum = left.lineEnd.distanceTo(right.lineEnd) + left.wrappedLength + right.wrappedLength + 0.05;
    const deficit = Math.max(0, minimum - left.restLength - right.restLength);
    left.restLength += deficit / 2;
    right.restLength += deficit / 2;
  }
  for (let iteration = 0; iteration < (both ? 4 : 1); iteration += 1) {
    left.constrain(dt, player, buildings, assist && iteration === 0);
    right.constrain(dt, player, buildings, assist && iteration === 0);
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
