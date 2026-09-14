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
    const offset = player.position.clone().sub(ropeTarget);
    const distance = offset.length();
    if (distance <= this.restLength) {
      this.tension = 0;
      return;
    }
    const radial = offset.normalize();
    const stretch = distance - this.restLength;
    this.tension = stretch * GAME.ropeStiffness;
    player.position.copy(ropeTarget).addScaledVector(radial, this.restLength);
    const outwardSpeed = player.velocity.dot(radial);
    if (outwardSpeed > 0) player.velocity.addScaledVector(radial, -outwardSpeed);
    player.velocity.addScaledVector(radial, (this.tension / GAME.playerMass) * dt);
    const tangent = player.velocity.clone().addScaledVector(radial, -player.velocity.dot(radial));
    if (tangent.lengthSq() > 0.1) player.velocity.addScaledVector(tangent.normalize(), GAME.swingBoost * dt);

    if (!this.hasBend) {
      const ray = player.position.clone().sub(this.anchor);
      const distanceToAnchor = ray.length();
      if (distanceToAnchor > 1) {
        ray.normalize();
        let closestHit: { point: THREE.Vector3; distance: number } | null = null;
        for (const box of buildings) {
          const hit = raycastAABB(this.anchor, ray, box, distanceToAnchor - 0.5);
          if (hit && (!closestHit || hit.distance < closestHit.distance)) closestHit = hit;
        }
        if (closestHit) {
          this.bend.copy(closestHit.point).addScaledVector(ray, -0.15);
          this.hasBend = true;
        }
      }
    }
  }
}
