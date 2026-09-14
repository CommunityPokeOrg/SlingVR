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
  private readonly displacement = new THREE.Vector3();
  private readonly moveStep = new THREE.Vector3();
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
    this.wallNormal.set(0, 0, 0);
  }

  step(dt: number, buildings: AABB[], force = this.zeroForce): void {
    if (this.grounded) {
      if (!this.steering) {
        if (force.x * force.x + force.z * force.z > 1e-6) {
          const speed = Math.hypot(this.velocity.x, this.velocity.z);
          const scale = speed > 0 ? Math.max(0, 1 - GAME.groundPullFriction * dt / speed) : 0;
          this.velocity.x *= scale;
          this.velocity.z *= scale;
        } else this.applyGroundFriction(dt);
      }
    } else {
      const drag = Math.exp(-GAME.airDrag * dt);
      this.velocity.x *= drag;
      this.velocity.z *= drag;
    }
    this.velocity.addScaledVector(force, dt / GAME.playerMass);
    this.steering = false;
    this.velocity.y += GAME.gravity * dt;
    this.velocity.y = Math.max(this.velocity.y, -GAME.terminalVelocity);
    this.move(this.displacement.copy(this.velocity).multiplyScalar(dt), buildings);
  }

  move(displacement: THREE.Vector3, buildings: AABB[]): void {
    const steps = Math.max(1, Math.ceil(displacement.length() / (GAME.playerRadius * 0.5)));
    this.moveStep.copy(displacement).divideScalar(steps);
    for (let step = 0; step < steps; step += 1) {
      this.position.add(this.moveStep);
      this.resolveCollisions(buildings);
    }
  }

  resolveCollisions(buildings: AABB[]): void {
    this.nextPosition.copy(this.position);
    this.grounded = false;
    if (this.nextPosition.y <= GAME.playerRadius) {
      this.nextPosition.y = GAME.playerRadius;
      if (this.velocity.y < 0) this.velocity.y = 0;
      this.grounded = true;
    }
    for (let pass = 0; pass < 3; pass += 1) {
      for (const box of buildings) this.resolveAABB(box);
    }
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
    const magnitude = Math.hypot(direction.x, direction.z);
    if (magnitude < 1e-6) return;
    this.horizontal.set(direction.x / magnitude, 0, direction.z / magnitude);
    const input = Math.min(1, magnitude);
    const along = this.velocity.dot(this.horizontal);
    const speed = GAME.airControlSpeed * input;
    if (along >= speed) return;
    const add = Math.min(GAME.airAcceleration * input * dt, speed - along);
    this.velocity.addScaledVector(this.horizontal, add);
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
    return nearestWall(this.position, buildings, GAME.playerRadius + GAME.wallContactTolerance);
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
    if (distance > radius + 1e-6) return;
    if (distance > 1e-5) {
      this.delta.divideScalar(distance);
      this.nextPosition.addScaledVector(this.delta, Math.max(0, radius - distance));
      const inwardSpeed = this.velocity.dot(this.delta);
      if (inwardSpeed < 0) this.velocity.addScaledVector(this.delta, -inwardSpeed);
      if (this.delta.y > 0.7 && this.velocity.y <= 1e-5) this.grounded = true;
      return;
    }
    let bestAmount = this.nextPosition.x - box.min.x + radius;
    let bestAxis = 0;
    let bestSign = -1;
    let amount = box.max.x - this.nextPosition.x + radius;
    if (amount < bestAmount) { bestAmount = amount; bestSign = 1; }
    amount = this.nextPosition.y - box.min.y + radius;
    if (amount < bestAmount) { bestAmount = amount; bestAxis = 1; bestSign = -1; }
    amount = box.max.y - this.nextPosition.y + radius;
    if (amount < bestAmount) { bestAmount = amount; bestAxis = 1; bestSign = 1; }
    amount = this.nextPosition.z - box.min.z + radius;
    if (amount < bestAmount) { bestAmount = amount; bestAxis = 2; bestSign = -1; }
    amount = box.max.z - this.nextPosition.z + radius;
    if (amount < bestAmount) { bestAmount = amount; bestAxis = 2; bestSign = 1; }
    if (bestAxis === 0) {
      this.nextPosition.x += bestAmount * bestSign;
      if (this.velocity.x * bestSign < 0) this.velocity.x = 0;
    } else if (bestAxis === 1) {
      this.nextPosition.y += bestAmount * bestSign;
      if (this.velocity.y * bestSign < 0) this.velocity.y = 0;
      this.grounded = bestSign > 0;
    } else {
      this.nextPosition.z += bestAmount * bestSign;
      if (this.velocity.z * bestSign < 0) this.velocity.z = 0;
    }
  }
}
