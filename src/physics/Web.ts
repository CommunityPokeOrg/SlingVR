import * as THREE from 'three';
import type { AABB } from './collision';
import { raycastAABB } from './collision';
import { GAME } from '../state';
import { PlayerBody } from './PlayerBody';

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

  step(dt: number, player: PlayerBody, buildings: AABB[], reel = false): void {
    if (!this.attached) return;
    if (reel) this.restLength = Math.max(2, this.restLength - GAME.ropeReelSpeed * dt);
    const ropeTarget = this.hasBend ? this.bend : this.anchor;
    this.offset.copy(player.position).sub(ropeTarget);
    const distance = this.offset.length();
    if (distance <= this.restLength) {
      this.tension = 0;
      return;
    }
    this.radial.copy(this.offset).normalize();
    const stretch = distance - this.restLength;
    this.tension = stretch * GAME.ropeStiffness;
    player.position.copy(ropeTarget).addScaledVector(this.radial, this.restLength);
    const outwardSpeed = player.velocity.dot(this.radial);
    if (outwardSpeed > 0) player.velocity.addScaledVector(this.radial, -outwardSpeed);
    player.velocity.addScaledVector(this.radial, (this.tension / GAME.playerMass) * dt);
    this.tangent.copy(player.velocity).addScaledVector(this.radial, -player.velocity.dot(this.radial));
    if (this.tangent.lengthSq() > 0.1) player.velocity.addScaledVector(this.tangent.normalize(), GAME.swingBoost * dt);

    if (!this.hasBend) {
      this.ray.copy(player.position).sub(this.anchor);
      const distanceToAnchor = this.ray.length();
      if (distanceToAnchor > 1) {
        this.ray.normalize();
        let closestDistance = Number.POSITIVE_INFINITY;
        for (const box of buildings) {
          const hit = raycastAABB(this.anchor, this.ray, box, distanceToAnchor - 0.5);
          if (hit && hit.distance < closestDistance) {
            closestDistance = hit.distance;
            this.closestPoint.copy(hit.point);
          }
        }
        if (closestDistance < Number.POSITIVE_INFINITY) {
          this.bend.copy(this.closestPoint).addScaledVector(this.ray, -0.15);
          this.hasBend = true;
        }
      }
    }
  }
}
