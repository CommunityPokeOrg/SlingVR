import * as THREE from 'three';
import { GAME } from '../state';
import type { CityData } from '../city/CityGenerator';
import { raycastAABBs } from './collision';
import { PlayerBody } from './PlayerBody';

export class Zip {
  active = false;
  target = new THREE.Vector3();
  targetNormal = new THREE.Vector3(0, 1, 0);
  targetIsPerch = false;
  private readonly travel = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private readonly offset = new THREE.Vector3();

  launch(origin: THREE.Vector3, direction: THREE.Vector3, city: CityData): boolean {
    this.look.copy(direction).normalize();
    let best: THREE.Vector3 | null = null;
    let bestDistance: number = GAME.zipRange;
    for (const perch of city.perches) {
      this.offset.copy(perch).sub(origin);
      const distance = this.offset.length();
      if (distance > GAME.zipRange) continue;
      const angle = this.offset.normalize().dot(this.look);
      if (angle > Math.cos(THREE.MathUtils.degToRad(20)) && distance < bestDistance) {
        best = perch;
        bestDistance = distance;
      }
    }
    const hit = raycastAABBs(origin, this.look, city.buildings, GAME.zipRange);
    if (best) {
      this.target.copy(best);
      this.targetNormal.set(0, 1, 0);
      this.targetIsPerch = true;
    } else if (hit) {
      this.target.copy(hit.point);
      this.targetNormal.copy(hit.normal);
      this.targetIsPerch = false;
    }
    else return false;
    this.active = true;
    return true;
  }

  step(dt: number, player: PlayerBody): boolean {
    if (!this.active) return false;
    this.travel.copy(this.target).sub(player.position);
    const distance = this.travel.length();
    if (distance < 2) {
      player.position.copy(this.target);
      if (this.targetIsPerch) {
        player.position.y += 0.7;
        player.velocity.set(0, 0, 0);
        player.grounded = true;
      } else {
        player.position.addScaledVector(this.targetNormal, 0.8);
        player.velocity.set(this.targetNormal.x * 2, 6, this.targetNormal.z * 2);
        player.grounded = false;
      }
      this.active = false;
      return true;
    }
    player.velocity.copy(this.travel.normalize().multiplyScalar(GAME.zipSpeed));
    player.position.addScaledVector(player.velocity, dt);
    return false;
  }
}
