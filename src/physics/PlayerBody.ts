import * as THREE from 'three';
import { nearestWall, type AABB } from './collision';
import { GAME } from '../state';

export class PlayerBody {
  readonly position = new THREE.Vector3(0, 8, 12);
  readonly velocity = new THREE.Vector3();
  grounded = false;
  wallNormal = new THREE.Vector3();
  private readonly nextPosition = new THREE.Vector3();

  reset(position = new THREE.Vector3(0, 8, 12)): void {
    this.position.copy(position);
    this.velocity.set(0, 0, 0);
    this.grounded = false;
  }

  step(dt: number, buildings: AABB[], force = new THREE.Vector3()): void {
    this.velocity.addScaledVector(force, dt / GAME.playerMass);
    this.velocity.y += GAME.gravity * dt;
    this.velocity.multiplyScalar(Math.max(0, 1 - GAME.airDrag * dt));
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

  jump(strength = 10): void {
    if (this.grounded) {
      this.velocity.y = strength;
      this.grounded = false;
    }
  }

  push(direction: THREE.Vector3, amount: number): void {
    this.velocity.addScaledVector(direction, amount);
  }

  nearestWall(buildings: AABB[]) {
    return nearestWall(this.position, buildings, GAME.wallDistance);
  }

  private resolveAABB(box: AABB): void {
    const radius = GAME.playerRadius;
    const closest = new THREE.Vector3(
      THREE.MathUtils.clamp(this.nextPosition.x, box.min.x, box.max.x),
      THREE.MathUtils.clamp(this.nextPosition.y, box.min.y, box.max.y),
      THREE.MathUtils.clamp(this.nextPosition.z, box.min.z, box.max.z),
    );
    const delta = this.nextPosition.clone().sub(closest);
    const distance = delta.length();
    if (distance >= radius) return;
    if (distance > 1e-5) {
      delta.multiplyScalar((radius - distance) / distance);
      this.nextPosition.add(delta);
      if (Math.abs(delta.x) > Math.abs(delta.y) && Math.abs(delta.x) > Math.abs(delta.z)) this.velocity.x = 0;
      else if (Math.abs(delta.y) > Math.abs(delta.z)) {
        if (delta.y > 0) this.grounded = true;
        this.velocity.y = 0;
      } else this.velocity.z = 0;
      return;
    }
    const choices = [
      { amount: this.nextPosition.x - box.min.x + radius, axis: 'x', sign: 1 },
      { amount: box.max.x - this.nextPosition.x + radius, axis: 'x', sign: -1 },
      { amount: this.nextPosition.y - box.min.y + radius, axis: 'y', sign: 1 },
      { amount: box.max.y - this.nextPosition.y + radius, axis: 'y', sign: -1 },
      { amount: this.nextPosition.z - box.min.z + radius, axis: 'z', sign: 1 },
      { amount: box.max.z - this.nextPosition.z + radius, axis: 'z', sign: -1 },
    ];
    choices.sort((a, b) => a.amount - b.amount);
    const best = choices[0];
    if (!best) return;
    if (best.axis === 'x') {
      this.nextPosition.x += best.amount * best.sign;
      this.velocity.x = 0;
    } else if (best.axis === 'y') {
      this.nextPosition.y += best.amount * best.sign;
      this.velocity.y = 0;
      this.grounded = best.sign > 0;
    } else {
      this.nextPosition.z += best.amount * best.sign;
      this.velocity.z = 0;
    }
  }
}
