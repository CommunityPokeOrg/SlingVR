import * as THREE from 'three';
import { GAME } from '../state';
import { PlayerBody } from './PlayerBody';
import type { AABB } from './collision';

export class WallRun {
  active = false;
  normal = new THREE.Vector3();

  step(dt: number, player: PlayerBody, buildings: AABB[], runHeld: boolean, alongInput: number): boolean {
    const wall = player.nearestWall(buildings);
    if (!runHeld || player.grounded || !wall || player.velocity.length() < 2) {
      this.active = false;
      player.wallNormal.set(0, 0, 0);
      return false;
    }
    this.active = true;
    this.normal.copy(wall.normal);
    player.wallNormal.copy(wall.normal);
    player.position.copy(wall.point).addScaledVector(wall.normal, GAME.wallOffset);
    player.velocity.addScaledVector(wall.normal, -player.velocity.dot(wall.normal));
    const horizontalSpeed = Math.hypot(player.velocity.x, player.velocity.z);
    if (horizontalSpeed > GAME.wallRunSpeed) {
      const scale = GAME.wallRunSpeed / horizontalSpeed;
      player.velocity.x *= scale;
      player.velocity.z *= scale;
    }
    if (Math.abs(alongInput) > 0.01) player.velocity.y = alongInput * GAME.wallRunSpeed;
    else player.velocity.y = THREE.MathUtils.lerp(player.velocity.y, 0, Math.min(1, 5 * dt));
    player.velocity.y += GAME.gravity * 0.25 * dt;
    return true;
  }

  jumpOff(player: PlayerBody): void {
    if (!this.active) return;
    player.velocity.addScaledVector(this.normal, 8);
    player.velocity.y = 10;
    this.active = false;
  }
}
