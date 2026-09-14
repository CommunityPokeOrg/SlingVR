import * as THREE from 'three';
import type { CityData } from './city/CityGenerator';
import { AirTricks } from './physics/AirTricks';
import { PlayerBody } from './physics/PlayerBody';
import { WallRun } from './physics/WallRun';
import { Web } from './physics/Web';
import { Zip } from './physics/Zip';
import { raycastAABBs } from './physics/collision';
import { Reticle } from './render/Reticle';
import { WebLine } from './render/WebLine';
import { Hud } from './ui/Hud';
import { GAME, type TravelState } from './state';

export interface FrameInput {
  steer: THREE.Vector3;
  runHeld: boolean;
  wallAlong: number;
  reelLeft: boolean;
  reelRight: boolean;
}

export class Player {
  readonly body = new PlayerBody();
  readonly leftWeb = new Web();
  readonly rightWeb = new Web();
  readonly zip = new Zip();
  readonly wallRun = new WallRun();
  readonly tricks = new AirTricks();
  readonly leftLine: WebLine;
  readonly rightLine: WebLine;
  readonly reticle: Reticle;
  readonly hud: Hud;
  private readonly city: CityData;
  private readonly rayDirection = new THREE.Vector3();
  private readonly perchOffset = new THREE.Vector3();

  constructor(city: CityData, scene: THREE.Scene) {
    this.city = city;
    this.leftLine = new WebLine();
    this.rightLine = new WebLine();
    this.reticle = new Reticle(scene);
    this.hud = new Hud();
    scene.add(this.leftLine.group, this.rightLine.group);
  }

  stepPhysics(dt: number, input: FrameInput): void {
    if (input.steer.lengthSq() > 0) this.body.push(input.steer, 22 * dt);
    if (this.zip.active) this.zip.step(dt, this.body);
    else {
      this.body.step(dt, this.city.buildings);
      this.leftWeb.step(dt, this.body, this.city.buildings, input.reelLeft);
      this.rightWeb.step(dt, this.body, this.city.buildings, input.reelRight);
      this.wallRun.step(dt, this.body, this.city.buildings, input.runHeld, input.wallAlong);
    }
    this.tricks.step(dt);
    if (this.body.grounded) this.tricks.reset();
  }

  shootWeb(side: 'left' | 'right', origin: THREE.Vector3, direction: THREE.Vector3): boolean {
    this.rayDirection.copy(direction).normalize();
    const hit = raycastAABBs(origin, this.rayDirection, this.city.buildings, GAME.zipRange);
    if (!hit) return false;
    (side === 'left' ? this.leftWeb : this.rightWeb).attach(hit.point, this.body);
    return true;
  }

  releaseWeb(side: 'left' | 'right'): void {
    (side === 'left' ? this.leftWeb : this.rightWeb).release();
  }

  zipToward(origin: THREE.Vector3, direction: THREE.Vector3): boolean {
    return this.zip.launch(origin, direction, this.city);
  }

  dash(direction: THREE.Vector3): boolean {
    return this.tricks.dash(this.body, direction);
  }

  jumpOrRelease(): void {
    if (this.body.grounded) this.body.jump();
    else {
      this.leftWeb.release();
      this.rightWeb.release();
    }
  }

  reset(): void {
    this.body.reset();
    this.leftWeb.release();
    this.rightWeb.release();
    this.zip.active = false;
    this.wallRun.active = false;
    this.tricks.reset();
  }

  state(): TravelState {
    if (this.zip.active) return 'Zipping';
    if (this.wallRun.active) return 'WallRunning';
    if (this.leftWeb.attached && this.rightWeb.attached) return 'Swinging Both';
    if (this.leftWeb.attached) return 'Swinging L';
    if (this.rightWeb.attached) return 'Swinging R';
    return this.body.grounded ? 'Grounded' : 'Airborne';
  }

  updateVisuals(
    leftHandOrigin: THREE.Vector3,
    rightHandOrigin: THREE.Vector3,
    aimOrigin: THREE.Vector3,
    aimDirection: THREE.Vector3,
  ): void {
    const hit = raycastAABBs(aimOrigin, aimDirection, this.city.buildings, GAME.zipRange);
    let perch: THREE.Vector3 | null = null;
    let bestDistance: number = GAME.zipRange;
    for (const candidate of this.city.perches) {
      this.perchOffset.copy(candidate).sub(aimOrigin);
      const distance = this.perchOffset.length();
      if (distance < bestDistance && this.perchOffset.normalize().dot(aimDirection) > Math.cos(THREE.MathUtils.degToRad(20))) {
        bestDistance = distance;
        perch = candidate;
      }
    }
    this.reticle.update(perch ?? hit?.point ?? null, perch !== null);
    this.leftLine.update(leftHandOrigin, this.leftWeb);
    this.rightLine.update(rightHandOrigin, this.rightWeb);
    this.hud.update(this.body, this.state(), this.tricks, this.leftWeb, this.rightWeb, this.zip, this.wallRun);
  }
}
