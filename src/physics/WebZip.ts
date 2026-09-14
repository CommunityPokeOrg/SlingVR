import * as THREE from 'three';
import { GAME } from '../state';
import { PlayerBody } from './PlayerBody';
import { WebShot } from './WebShot';
import { raycastAABBs, type AABB } from './collision';

export class WebZip {
  readonly shot = new WebShot();
  readonly force = new THREE.Vector3();
  active = false;
  pulling = false;
  cooldown = 0;
  private released = false;
  private charge = 1;
  private remaining = 0;
  private previousDistance = 0;
  private elapsed = 0;
  private readonly direction = new THREE.Vector3();

  shoot(origin: THREE.Vector3, target: THREE.Vector3, charged = false): boolean {
    if (this.active || this.cooldown > 0) return false;
    this.shot.fire(origin, target);
    this.active = true;
    this.pulling = false;
    this.released = !charged;
    this.charge = 1;
    this.force.set(0, 0, 0);
    return true;
  }

  release(charge: number): void {
    if (!this.active) return;
    this.charge = THREE.MathUtils.clamp(charge, 0, 1);
    this.released = true;
  }

  step(dt: number, player: PlayerBody, buildings: AABB[]): void {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.force.set(0, 0, 0);
    if (!this.active) return;
    if (this.shot.flying) {
      this.shot.step(dt);
      return;
    }
    if (!this.released) return;
    this.direction.copy(this.shot.target).sub(player.position);
    const distance = this.direction.length();
    if (distance < GAME.webZipStopDistance) {
      this.cancel();
      return;
    }
    this.direction.divideScalar(distance);
    const obstruction = raycastAABBs(player.position, this.direction, buildings, distance - 0.1);
    if (obstruction) {
      this.cancel();
      return;
    }
    if (!this.pulling) {
      this.remaining = Math.min(
        distance - GAME.webZipStopDistance,
        THREE.MathUtils.lerp(GAME.webZipMinPull, GAME.webZipPullDistance, this.charge),
      );
      this.previousDistance = distance;
      this.elapsed = 0;
      this.pulling = true;
    }
    this.remaining -= Math.max(0, this.previousDistance - distance);
    this.previousDistance = distance;
    this.elapsed += dt;
    if (this.remaining <= 0 || this.elapsed > GAME.webZipPullTime) {
      this.cancel();
      return;
    }
    const speed = THREE.MathUtils.lerp(GAME.webZipMinSpeed, GAME.webZipMaxSpeed, this.charge);
    const acceleration = Math.min(
      GAME.webZipAcceleration,
      Math.max(0, speed - player.velocity.dot(this.direction)) / dt,
    );
    this.force.copy(this.direction).multiplyScalar(acceleration * GAME.playerMass);
  }

  cancel(): void {
    if (this.active) this.cooldown = GAME.webZipCooldown;
    this.active = false;
    this.pulling = false;
    this.shot.cancel();
    this.force.set(0, 0, 0);
  }

  reset(): void {
    this.cancel();
    this.cooldown = 0;
  }
}
