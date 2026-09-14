import * as THREE from 'three';
import { GAME } from '../state';

export class WebShot {
  readonly origin = new THREE.Vector3();
  readonly target = new THREE.Vector3();
  readonly tip = new THREE.Vector3();
  flying = false;
  progress = 0;
  private duration = 0;
  private elapsed = 0;

  fire(origin: THREE.Vector3, target: THREE.Vector3): void {
    this.origin.copy(origin);
    this.target.copy(target);
    this.tip.copy(origin);
    this.duration = Math.max(GAME.webFlightMinTime, origin.distanceTo(target) / GAME.webFlightSpeed);
    this.elapsed = 0;
    this.progress = 0;
    this.flying = true;
  }

  step(dt: number): boolean {
    if (!this.flying) return false;
    this.elapsed += dt;
    this.progress = Math.min(1, this.elapsed / this.duration);
    this.tip.lerpVectors(this.origin, this.target, this.progress);
    if (this.progress < 1) return false;
    this.flying = false;
    return true;
  }

  cancel(): void {
    this.flying = false;
    this.progress = 0;
  }
}
