import * as THREE from 'three';
import { PlayerBody } from './PlayerBody';

export class AirTricks {
  dashAvailable = true;
  style = 0;
  lastTrick = '';
  private trickTimer = 0;

  reset(): void {
    this.dashAvailable = true;
  }

  step(dt: number): void {
    this.trickTimer = Math.max(0, this.trickTimer - dt);
    if (this.trickTimer === 0) this.lastTrick = '';
  }

  dash(player: PlayerBody, look: THREE.Vector3): boolean {
    if (!this.dashAvailable || player.grounded) return false;
    const horizontal = look.clone().setY(0);
    if (horizontal.lengthSq() < 1e-4) return false;
    player.push(horizontal.normalize(), 15);
    this.dashAvailable = false;
    this.style += 100;
    this.lastTrick = 'AIR DASH';
    this.trickTimer = 2.5;
    return true;
  }

  combo(name: string): void {
    this.style += 50;
    this.lastTrick = name;
    this.trickTimer = 2.5;
  }
}
