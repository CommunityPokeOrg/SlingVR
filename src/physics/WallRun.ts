import * as THREE from 'three';
import { GAME } from '../state';
import { PlayerBody } from './PlayerBody';
import type { AABB } from './collision';

export class WallRun {
  active = false;
  running = false;
  readonly normal = new THREE.Vector3();
  private buildingIndex = -1;
  private cooldown = 0;
  private boostCooldown = 0;
  private boostTime = 0;
  private roofHeight = 0;
  private crestTime = 0;
  private readonly crestNormal = new THREE.Vector3();
  private readonly destination = new THREE.Vector3();
  private readonly displacement = new THREE.Vector3();
  private readonly noSteer = new THREE.Vector3();
  private readonly desired = new THREE.Vector3();

  tryStart(player: PlayerBody, buildings: AABB[], runHeld: boolean, alongInput: number, steer = this.noSteer): boolean {
    if (this.active) return true;
    if (this.cooldown > 0 || !runHeld) return false;
    const wall = player.nearestWall(buildings);
    if (!wall) return false;
    this.desired.copy(steer).addScaledVector(wall.normal, -steer.dot(wall.normal)).setY(0);
    const tangentSpeed = Math.abs(player.velocity.x * wall.normal.z - player.velocity.z * wall.normal.x);
    if (alongInput < GAME.wallLookThreshold && this.desired.lengthSq() < 0.01 && tangentSpeed < GAME.wallEntrySpeed) return false;
    this.active = true;
    this.running = true;
    this.buildingIndex = wall.buildingIndex;
    this.roofHeight = buildings[wall.buildingIndex]!.max.y;
    this.normal.copy(wall.normal);
    player.wallNormal.copy(wall.normal);
    player.position.copy(wall.point).addScaledVector(wall.normal, GAME.playerRadius);
    player.velocity.addScaledVector(this.normal, -player.velocity.dot(this.normal));
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
    this.boostCooldown = Math.max(0, this.boostCooldown - dt);
    this.boostTime = Math.max(0, this.boostTime - dt);
    if (this.crestTime > 0) {
      this.crestTime = Math.max(0, this.crestTime - dt);
      if (player.position.y > this.roofHeight + GAME.playerRadius + 0.05) {
        player.velocity.addScaledVector(this.crestNormal, -GAME.wallCrestSpeed);
        this.crestTime = 0;
      }
    }
    if (!this.tryStart(player, buildings, runHeld, alongInput, steer)) return false;
    const wall = buildings[this.buildingIndex];
    if (!wall) {
      this.reset(player);
      return false;
    }
    this.desired.copy(steer).addScaledVector(this.normal, -steer.dot(this.normal)).setY(0).multiplyScalar(GAME.wallRunSpeed);
    this.desired.y = Math.max(0, alongInput) * GAME.wallClimbSpeed;
    this.desired.clampLength(0, GAME.wallRunSpeed);
    this.running = runHeld && (this.desired.lengthSq() > 0.01 || Math.hypot(player.velocity.x, player.velocity.z) > GAME.wallEntrySpeed);
    if (!runHeld) {
      player.velocity.multiplyScalar(Math.exp(-GAME.wallBrake * dt));
      if (player.velocity.lengthSq() < 0.01) player.velocity.set(0, 0, 0);
    } else {
      this.displacement.copy(this.desired).sub(player.velocity);
      this.displacement.y = 0;
      const horizontalSpeed = Math.hypot(player.velocity.x, player.velocity.z);
      const alongDesired = player.velocity.x * this.desired.x + player.velocity.z * this.desired.z;
      if (horizontalSpeed > GAME.wallRunSpeed && alongDesired >= 0) {
        player.velocity.x *= Math.exp(-GAME.airDrag * dt);
        player.velocity.z *= Math.exp(-GAME.airDrag * dt);
      } else {
        this.displacement.clampLength(0, GAME.wallAcceleration * dt);
        player.velocity.add(this.displacement);
      }
      if (this.boostTime > 0) player.velocity.y = Math.max(this.desired.y, player.velocity.y + GAME.gravity * dt);
      else player.velocity.y += THREE.MathUtils.clamp(this.desired.y - player.velocity.y, -GAME.wallAcceleration * dt, GAME.wallAcceleration * dt);
    }
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

  jumpOff(player: PlayerBody, look = this.normal): boolean {
    if (!this.active) return false;
    const moving = this.running || player.velocity.lengthSq() > 1;
    if (moving && this.roofHeight - player.position.y <= GAME.wallCrestRange) {
      this.crestNormal.copy(this.normal);
      player.velocity.y = Math.max(player.velocity.y, GAME.wallCrestLift);
      this.detach(player);
      this.crestTime = 0.5;
      return true;
    }
    if (!this.running && look.dot(this.normal) < GAME.wallAwayThreshold) return false;
    if (this.running && look.y >= GAME.wallLookThreshold) {
      if (this.boostCooldown > 0) return false;
      player.velocity.y = Math.max(player.velocity.y, Math.min(GAME.wallBoostMaxSpeed, Math.max(0, player.velocity.y) + GAME.wallBoostLift));
      this.boostCooldown = GAME.wallBoostCooldown;
      this.boostTime = GAME.wallBoostTime;
      return true;
    }
    player.velocity.addScaledVector(this.normal, GAME.wallJumpPush);
    player.velocity.y = Math.max(player.velocity.y, GAME.wallJumpLift);
    this.detach(player);
    return true;
  }

  private detach(player: PlayerBody): void {
    player.grounded = false;
    this.active = false;
    this.running = false;
    this.buildingIndex = -1;
    this.boostTime = 0;
    player.wallNormal.set(0, 0, 0);
    this.cooldown = GAME.wallJumpCooldown;
  }

  reset(player: PlayerBody): void {
    this.active = false;
    this.running = false;
    this.buildingIndex = -1;
    this.cooldown = 0;
    this.boostCooldown = 0;
    this.boostTime = 0;
    this.crestTime = 0;
    player.wallNormal.set(0, 0, 0);
  }
}
