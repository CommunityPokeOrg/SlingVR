import * as THREE from 'three';
import { nearestWall, type AABB } from './collision';
import { GAME } from '../state';

export class PlayerBody {
  readonly position = new THREE.Vector3(0, 8, 12);
  readonly velocity = new THREE.Vector3();
  grounded = false;
  wallNormal = new THREE.Vector3();
  private readonly nextPosition = new THREE.Vector3();
  private readonly closest = new THREE.Vector3();
  private readonly delta = new THREE.Vector3();
  private readonly zeroForce = new THREE.Vector3();
  private readonly horizontal = new THREE.Vector3();
  private readonly spawn = new THREE.Vector3(0, 8, 12);
  private steering = false;

  constructor(spawn?: THREE.Vector3) {
    if (spawn) this.spawn.copy(spawn);
    this.position.copy(this.spawn);
  }

  reset(position = this.spawn): void {
    this.position.copy(position);
    this.velocity.set(0, 0, 0);
    this.grounded = false;
  }

  step(dt: number, buildings: AABB[], force = this.zeroForce): void {
    this.velocity.addScaledVector(force, dt / GAME.playerMass);
    if (this.grounded) {
      if (!this.steering) this.applyGroundFriction(dt);
    } else this.velocity.multiplyScalar(Math.max(0, 1 - GAME.airDrag * dt));
    this.steering = false;
    this.velocity.y += GAME.gravity * dt;
    this.velocity.y = Math.max(this.velocity.y, -GAME.terminalVelocity);
    this.nextPosition.copy(this.position).addScaledVector(this.velocity, dt);
    this.grounded = false;
    if (this.nextPosition.y < GAME.playerRadius) {
      this.nextPosition.y = GAME.playerRadius;
      if (this.velocity.y < 0) this.velocity.y = 0;
      this.grounded = true;
    }
    for (const box of buildings) this.resolveAABB(box);
    this.position.copy(this.nextPosition);
  }

  jump(strength: number = GAME.jumpSpeed): void {
    if (this.grounded) {
      this.velocity.y = strength;
      this.grounded = false;
    }
  }

  push(direction: THREE.Vector3, amount: number): void {
    this.velocity.addScaledVector(direction, amount);
  }

  /** Grounded: drive toward a capped run speed. Airborne: gentle control that never robs swing/zip momentum. */
  steer(direction: THREE.Vector3, dt: number): void {
    if (direction.lengthSq() < 1e-6) return;
    if (this.grounded) {
      this.steering = true;
      const targetX = direction.x * GAME.groundMaxSpeed;
      const targetZ = direction.z * GAME.groundMaxSpeed;
      const blend = Math.min(1, (GAME.groundAcceleration / GAME.groundMaxSpeed) * dt);
      this.velocity.x += (targetX - this.velocity.x) * blend;
      this.velocity.z += (targetZ - this.velocity.z) * blend;
      return;
    }
    const along = this.velocity.x * direction.x + this.velocity.z * direction.z;
    if (along >= GAME.airControlSpeed) return;
    const add = Math.min(GAME.airAcceleration * dt, GAME.airControlSpeed - along);
    this.velocity.x += direction.x * add;
    this.velocity.z += direction.z * add;
  }

  private applyGroundFriction(dt: number): void {
    this.horizontal.set(this.velocity.x, 0, this.velocity.z);
    const speed = this.horizontal.length();
    if (speed < 1e-6) return;
    const damped = speed * Math.exp(-GAME.groundFriction * dt);
    const next = damped < GAME.groundStopSpeed ? 0 : damped;
    const scale = next / speed;
    this.velocity.x *= scale;
    this.velocity.z *= scale;
  }

  nearestWall(buildings: AABB[]) {
    return nearestWall(this.position, buildings, GAME.wallDistance);
  }

  private resolveAABB(box: AABB): void {
    const radius = GAME.playerRadius;
    this.closest.set(
      THREE.MathUtils.clamp(this.nextPosition.x, box.min.x, box.max.x),
      THREE.MathUtils.clamp(this.nextPosition.y, box.min.y, box.max.y),
      THREE.MathUtils.clamp(this.nextPosition.z, box.min.z, box.max.z),
    );
    this.delta.copy(this.nextPosition).sub(this.closest);
    const distance = this.delta.length();
    if (distance >= radius) return;
    if (distance > 1e-5) {
      this.delta.multiplyScalar((radius - distance) / distance);
      this.nextPosition.add(this.delta);
      if (Math.abs(this.delta.x) > Math.abs(this.delta.y) && Math.abs(this.delta.x) > Math.abs(this.delta.z)) this.velocity.x = 0;
      else if (Math.abs(this.delta.y) > Math.abs(this.delta.z)) {
        if (this.delta.y > 0) this.grounded = true;
        this.velocity.y = 0;
      } else this.velocity.z = 0;
      return;
    }
    let bestAmount = this.nextPosition.x - box.min.x + radius;
    let bestAxis = 0;
    let bestSign = 1;
    let amount = box.max.x - this.nextPosition.x + radius;
    if (amount < bestAmount) { bestAmount = amount; bestSign = -1; }
    amount = this.nextPosition.y - box.min.y + radius;
    if (amount < bestAmount) { bestAmount = amount; bestAxis = 1; bestSign = 1; }
    amount = box.max.y - this.nextPosition.y + radius;
    if (amount < bestAmount) { bestAmount = amount; bestAxis = 1; bestSign = -1; }
    amount = this.nextPosition.z - box.min.z + radius;
    if (amount < bestAmount) { bestAmount = amount; bestAxis = 2; bestSign = 1; }
    amount = box.max.z - this.nextPosition.z + radius;
    if (amount < bestAmount) { bestAmount = amount; bestAxis = 2; bestSign = -1; }
    if (bestAxis === 0) {
      this.nextPosition.x += bestAmount * bestSign;
      this.velocity.x = 0;
    } else if (bestAxis === 1) {
      this.nextPosition.y += bestAmount * bestSign;
      this.velocity.y = 0;
      this.grounded = bestSign > 0;
    } else {
      this.nextPosition.z += bestAmount * bestSign;
      this.velocity.z = 0;
    }
  }
}
