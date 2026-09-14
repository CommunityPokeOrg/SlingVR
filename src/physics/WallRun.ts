import * as THREE from 'three';
import { GAME } from '../state';
import { PlayerBody } from './PlayerBody';
import type { AABB } from './collision';

export class WallRun {
  active = false;
  readonly normal = new THREE.Vector3();
  private buildingIndex = -1;
  private cooldown = 0;
  private readonly destination = new THREE.Vector3();
  private readonly displacement = new THREE.Vector3();
  private readonly noSteer = new THREE.Vector3();

  tryStart(player: PlayerBody, buildings: AABB[], runHeld: boolean, alongInput: number): boolean {
    if (this.active) return true;
    if (this.cooldown > 0 || !runHeld || alongInput < GAME.wallLookThreshold) return false;
    const wall = player.nearestWall(buildings);
    if (!wall) return false;
    this.active = true;
    this.buildingIndex = wall.buildingIndex;
    this.normal.copy(wall.normal);
    player.wallNormal.copy(wall.normal);
    player.position.copy(wall.point).addScaledVector(wall.normal, GAME.playerRadius);
    player.velocity.set(0, 0, 0);
    player.grounded = false;
    return true;
  }

  step(
    dt: number,
    player: PlayerBody,
    buildings: AABB[],
    runHeld: boolean,
    alongInput: number,
    steer = this.noSteer,
  ): boolean {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (!this.tryStart(player, buildings, runHeld, alongInput)) return false;
    const wall = buildings[this.buildingIndex];
    if (!wall) {
      this.reset(player);
      return false;
    }
    player.velocity.copy(steer).addScaledVector(this.normal, -steer.dot(this.normal));
    player.velocity.y = Math.max(0, alongInput);
    if (!runHeld) player.velocity.set(0, 0, 0);
    player.velocity.clampLength(0, 1).multiplyScalar(GAME.wallRunSpeed);
    this.destination.copy(player.position).addScaledVector(player.velocity, dt);
    this.destination.y = THREE.MathUtils.clamp(this.destination.y, Math.max(GAME.playerRadius, wall.min.y), wall.max.y - 0.01);
    if (this.normal.x !== 0) {
      this.destination.x = (this.normal.x < 0 ? wall.min.x : wall.max.x) + this.normal.x * GAME.playerRadius;
      this.destination.z = THREE.MathUtils.clamp(this.destination.z, wall.min.z + 0.01, wall.max.z - 0.01);
    } else {
      this.destination.z = (this.normal.z < 0 ? wall.min.z : wall.max.z) + this.normal.z * GAME.playerRadius;
      this.destination.x = THREE.MathUtils.clamp(this.destination.x, wall.min.x + 0.01, wall.max.x - 0.01);
    }
    this.displacement.copy(this.destination).sub(player.position);
    player.velocity.copy(this.displacement).divideScalar(dt || 1);
    player.move(this.displacement, buildings);
    player.grounded = false;
    return true;
  }

  jumpOff(player: PlayerBody): void {
    if (!this.active) return;
    player.velocity.addScaledVector(this.normal, 8);
    player.velocity.y = 10;
    player.grounded = false;
    this.reset(player);
    this.cooldown = GAME.wallJumpCooldown;
  }

  reset(player: PlayerBody): void {
    this.active = false;
    this.buildingIndex = -1;
    this.cooldown = 0;
    player.wallNormal.set(0, 0, 0);
  }
}
