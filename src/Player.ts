import * as THREE from 'three';
import type { CityData } from './city/CityGenerator';
import { AirTricks } from './physics/AirTricks';
import { PlayerBody } from './physics/PlayerBody';
import { WallRun } from './physics/WallRun';
import { Web } from './physics/Web';
import { pullCharge, Zip, type ZipTarget, zipSpeedForCharge } from './physics/Zip';
import { raycastAABBs } from './physics/collision';
import { Reticle } from './render/Reticle';
import { WebLine } from './render/WebLine';
import { SETTINGS } from './settings';
import { Hud } from './ui/Hud';
import { GAME, type TravelState } from './state';

export interface FrameInput {
  steer: THREE.Vector3;
  head: THREE.Vector3;
  leftHand: THREE.Vector3;
  rightHand: THREE.Vector3;
  runHeld: boolean;
  wallAlong: number;
  leftReel: number;
  rightReel: number;
  turn: number;
}

export class Player {
  readonly body: PlayerBody;
  readonly leftWeb = new Web();
  readonly rightWeb = new Web();
  readonly zip = new Zip();
  readonly wallRun = new WallRun();
  readonly tricks = new AirTricks();
  readonly leftLine: WebLine;
  readonly rightLine: WebLine;
  readonly zipLine: WebLine;
  readonly reticle: Reticle;
  readonly hud: Hud;
  private readonly city: CityData;
  private readonly rayDirection = new THREE.Vector3();
  private readonly perchOffset = new THREE.Vector3();
  private readonly chargeDirection = new THREE.Vector3();
  private readonly chargePressHand = new THREE.Vector3();
  private readonly chargeHand = new THREE.Vector3();
  private readonly handOffset = new THREE.Vector3();
  private chargingTarget: ZipTarget | null = null;
  private chargingSide: 'left' | 'right' = 'right';
  private chargeFromPull = false;
  private chargeTime = 0;
  private charge = 0;
  private lastLeftReel = 0;
  private lastRightReel = 0;
  private prevLeftAlong = 0;
  private prevRightAlong = 0;
  private lastPunchSpeed = 0;

  constructor(city: CityData, scene: THREE.Scene) {
    this.city = city;
    this.body = new PlayerBody(city.spawn);
    this.leftLine = new WebLine();
    this.rightLine = new WebLine();
    this.zipLine = new WebLine();
    this.reticle = new Reticle(scene);
    this.hud = new Hud();
    scene.add(this.leftLine.group, this.rightLine.group, this.zipLine.group);
  }

  stepPhysics(dt: number, input: FrameInput): void {
    if (input.steer.lengthSq() > 0) this.body.push(input.steer, 22 * dt);
    this.lastLeftReel = 0;
    this.lastRightReel = 0;
    if (this.chargingTarget) {
      this.chargeTime += dt;
      this.chargeDirection.copy(this.chargingTarget.point).sub(input.head);
      if (this.chargeDirection.lengthSq() > 0) {
        this.chargeDirection.normalize();
        if (this.chargeFromPull) {
          const hand = this.chargingSide === 'left' ? input.leftHand : input.rightHand;
          this.charge = Math.max(this.charge, pullCharge(this.chargePressHand, hand, this.chargeDirection));
        } else {
          this.charge = Math.max(this.charge, THREE.MathUtils.clamp(this.chargeTime / 0.8, 0, 1));
        }
      }
    }
    if (this.zip.active) this.zip.step(dt, this.body);
    else {
      this.body.step(dt, this.city.buildings);
      const assist = SETTINGS.mode === 'friendly';
      const leftReel = assist ? input.leftReel : this.physicalReel(this.leftWeb, input.leftHand, input.head, true);
      const rightReel = assist ? input.rightReel : this.physicalReel(this.rightWeb, input.rightHand, input.head, false);
      this.lastLeftReel = leftReel;
      this.lastRightReel = rightReel;
      this.leftWeb.step(dt, this.body, this.city.buildings, leftReel, assist);
      this.rightWeb.step(dt, this.body, this.city.buildings, rightReel, assist);
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
    if (side === 'left') this.prevLeftAlong = 0;
    else this.prevRightAlong = 0;
    return true;
  }

  releaseWeb(side: 'left' | 'right'): void {
    (side === 'left' ? this.leftWeb : this.rightWeb).release();
  }

  zipToward(origin: THREE.Vector3, direction: THREE.Vector3, hand = origin, side: 'left' | 'right' = 'right', physicalPull = false): boolean {
    const target = this.zip.aim(origin, direction, this.city);
    if (!target) return false;
    if (SETTINGS.mode === 'friendly') {
      this.zip.launch(target);
      return true;
    }
    this.chargingTarget = target;
    this.chargingSide = side;
    this.chargePressHand.copy(hand);
    this.chargeHand.copy(hand);
    this.chargeFromPull = physicalPull;
    this.chargeTime = 0;
    this.charge = 0;
    return true;
  }

  releaseZip(): void {
    if (!this.chargingTarget) return;
    const charge = this.charge;
    this.zip.launch(this.chargingTarget, zipSpeedForCharge(charge));
    if (charge > 0.8) this.tricks.combo('CHARGED ZIP');
    this.chargingTarget = null;
    this.charge = 0;
    this.chargeTime = 0;
  }

  dash(direction: THREE.Vector3, requireFree = false): boolean {
    if (requireFree && (this.zip.active || this.leftWeb.attached || this.rightWeb.attached)) return false;
    return this.tricks.dash(this.body, direction);
  }

  jumpOrRelease(): void {
    if (this.wallRun.active) this.wallRun.jumpOff(this.body);
    else if (this.body.grounded) this.body.jump();
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
    this.chargingTarget = null;
    this.charge = 0;
    this.chargeTime = 0;
    this.wallRun.active = false;
    this.tricks.reset();
    this.prevLeftAlong = 0;
    this.prevRightAlong = 0;
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
    if (this.chargingTarget) {
      this.chargeHand.copy(this.chargingSide === 'left' ? leftHandOrigin : rightHandOrigin);
      this.zipLine.updateTarget(this.chargeHand, this.chargingTarget.point, this.charge);
    } else {
      this.zipLine.hide();
    }
    this.hud.update(this.body, this.state(), this.tricks, this.leftWeb, this.rightWeb, this.zip, this.wallRun, SETTINGS.mode, this.charge, this.chargingTarget !== null, this.lastPunchSpeed, this.lastLeftReel, this.lastRightReel);
  }

  setPunchSpeed(speed: number): void {
    this.lastPunchSpeed = speed;
  }

  private physicalReel(web: Web, hand: THREE.Vector3, head: THREE.Vector3, left: boolean): number {
    if (!web.attached) {
      if (left) this.prevLeftAlong = 0;
      else this.prevRightAlong = 0;
      return 0;
    }
    this.chargeDirection.copy(web.lineEnd).sub(head);
    if (this.chargeDirection.lengthSq() === 0) return 0;
    this.chargeDirection.normalize();
    const along = this.handOffset.copy(hand).sub(head).dot(this.chargeDirection);
    const previous = left ? this.prevLeftAlong : this.prevRightAlong;
    if (left) this.prevLeftAlong = along;
    else this.prevRightAlong = along;
    return Math.max(0, (previous - along) * GAME.pullGain);
  }
}
