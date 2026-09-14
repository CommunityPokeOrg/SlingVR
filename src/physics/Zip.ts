import * as THREE from 'three';
import { GAME } from '../state';
import type { CityData } from '../city/CityGenerator';
import { raycastAABBs } from './collision';
import { PlayerBody } from './PlayerBody';

export class Zip {
  active = false;
  target = new THREE.Vector3();
  private readonly travel = new THREE.Vector3();

  launch(origin: THREE.Vector3, direction: THREE.Vector3, city: CityData): boolean {
    const look = direction.clone().normalize();
    let best: THREE.Vector3 | null = null;
    let bestDistance: number = GAME.zipRange;
    for (const perch of city.perches) {
      const offset = perch.clone().sub(origin);
      const distance = offset.length();
      if (distance > GAME.zipRange) continue;
      const angle = offset.normalize().dot(look);
      if (angle > Math.cos(THREE.MathUtils.degToRad(20)) && distance < bestDistance) {
        best = perch;
        bestDistance = distance;
      }
    }
    const hit = raycastAABBs(origin, look, city.buildings, GAME.zipRange);
    if (best) this.target.copy(best);
    else if (hit) this.target.copy(hit.point);
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
      player.position.y += 0.7;
      player.velocity.set(0, 0, 0);
      player.grounded = true;
      this.active = false;
      return true;
    }
    player.velocity.copy(this.travel.normalize().multiplyScalar(GAME.zipSpeed));
    player.position.addScaledVector(player.velocity, dt);
    return false;
  }
}
