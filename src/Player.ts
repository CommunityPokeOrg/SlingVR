import * as THREE from 'three';
import type { CityData } from './city/CityGenerator';
import { AirTricks } from './physics/AirTricks';
import { PlayerBody } from './physics/PlayerBody';
import { WallRun } from './physics/WallRun';
import { stepWebs, Web } from './physics/Web';
import { pullCharge, Zip, type ZipTarget } from './physics/Zip';
import { WebZip } from './physics/WebZip';
import { raycastAABBs } from './physics/collision';
import { findDualLedge, findLedge } from './physics/Ledge';
import { Reticle } from './render/Reticle';
import { WebLine } from './render/WebLine';
import { effectiveMode } from './settings';
import { Hud } from './ui/Hud';
import { GAME, type TravelState } from './state';

export interface FrameInput {
  steer: THREE.Vector3;
  look?: THREE.Vector3;
  head: THREE.Vector3;
  leftHand: THREE.Vector3;
  rightHand: THREE.Vector3;
  runHeld: boolean;
  wallAlong: number;
  leftReel: number;
  rightReel: number;
  turn: number;
}

export type Side = 'left' | 'right';

export class Player {
  readonly body: PlayerBody;
  readonly leftWeb = new Web();
  readonly rightWeb = new Web();
  readonly zip = new Zip();
  readonly webZip = new WebZip();
  readonly wallRun = new WallRun();
  readonly tricks = new AirTricks();
  readonly leftLine: WebLine;
  readonly rightLine: WebLine;
  readonly zipLine: WebLine;
  readonly reticle: Reticle;
  readonly hud: Hud;
  private readonly city: CityData;
  private readonly rayDirection = new THREE.Vector3();
  private readonly chargeDirection = new THREE.Vector3();
  private readonly chargePressHand = new THREE.Vector3();
  private readonly chargeHand = new THREE.Vector3();
  private readonly handOffset = new THREE.Vector3();
  private readonly previousLeftHand = new THREE.Vector3();
  private readonly previousRightHand = new THREE.Vector3();
  private readonly handPull = new THREE.Vector3();
  private readonly slingshotDirection = new THREE.Vector3();
  private readonly lookDirection = new THREE.Vector3(0, 0, -1);
  private chargingTarget: ZipTarget | null = null;
  private chargingSide: Side = 'right';
  private chargeFromPull = false;
  private chargeTime = 0;
  private charge = 0;
  private webZipSide: Side = 'right';
  private mountGrace = 0;
  private jumpBuffer = 0;
  private lastLeftReel = 0;
  private lastRightReel = 0;
  private leftPullReady = false;
  private rightPullReady = false;
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
    if (input.look) this.lookDirection.copy(input.look);
    this.lastLeftReel = 0;
    this.lastRightReel = 0;
    this.mountGrace = Math.max(0, this.mountGrace - dt);
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    if (effectiveMode() === 'friendly') this.cancelZipCharge();
    if (this.chargingTarget) {
      this.chargeTime += dt;
      this.chargeDirection.copy(this.chargingTarget.point).sub(input.head);
      if (this.chargeDirection.lengthSq() > 0) {
        this.chargeDirection.normalize();
        if (this.chargeFromPull) {
          const hand = this.chargingSide === 'left' ? input.leftHand : input.rightHand;
          this.chargeHand.copy(hand).sub(input.head);
          this.charge = Math.max(this.charge, pullCharge(this.chargePressHand, this.chargeHand, this.chargeDirection));
        } else {
          this.charge = Math.max(this.charge, THREE.MathUtils.clamp(this.chargeTime / 0.8, 0, 1));
        }
      }
    }
    this.webZip.step(dt, this.body, this.city.buildings);
    if (this.zip.active) {
      if (this.zip.flying) this.body.steer(input.steer, dt);
      if (this.zip.step(dt, this.body, this.city.buildings)) this.onMounted();
    } else if (this.wallRun.step(dt, this.body, this.city.buildings, input.runHeld, input.wallAlong, input.steer)) {
      this.clearWebsForWall();
    } else {
      this.body.steer(input.steer, dt);
      this.body.step(dt, this.city.buildings, this.webZip.force);
      this.leftWeb.stepFlight(dt, this.body);
      this.rightWeb.stepFlight(dt, this.body);
      const assist = effectiveMode() === 'friendly';
      const leftReel = assist ? input.leftReel : this.physicalReel(this.leftWeb, input.leftHand, input.head, true);
      const rightReel = assist ? input.rightReel : this.physicalReel(this.rightWeb, input.rightHand, input.head, false);
      this.lastLeftReel = leftReel;
      this.lastRightReel = rightReel;
      stepWebs(dt, this.body, this.city.buildings, this.leftWeb, this.rightWeb, leftReel, rightReel, assist);
      if (this.wallRun.tryStart(this.body, this.city.buildings, input.runHeld, input.wallAlong, input.steer)) this.clearWebsForWall();
    }
    this.tricks.step(dt);
    if (this.body.grounded) this.tricks.reset();
  }

  shootWeb(side: Side, origin: THREE.Vector3, direction: THREE.Vector3, hand = origin): boolean {
    if (this.wallRun.active || this.zip.active || this.webZip.active) return false;
    this.rayDirection.copy(direction).normalize();
    const ledge = effectiveMode() === 'spectacular' ? findLedge(origin, this.rayDirection, this.city.buildings) : null;
    const hit = ledge ?? raycastAABBs(origin, this.rayDirection, this.city.buildings, GAME.webRange);
    if (!hit) return false;
    (side === 'left' ? this.leftWeb : this.rightWeb).fire(hand, hit.point);
    if (side === 'left') this.leftPullReady = false;
    else this.rightPullReady = false;
    return true;
  }

  releaseWeb(side: Side): void {
    (side === 'left' ? this.leftWeb : this.rightWeb).release();
  }

  zipToward(origin: THREE.Vector3, direction: THREE.Vector3, hand = origin, side: Side = 'right', physicalPull = false, head = this.body.position, otherHand = hand): boolean {
    if (this.zip.active || this.webZip.active || this.wallRun.active) return false;
    const target = this.zip.aim(origin, direction, this.city, effectiveMode() === 'friendly');
    if (!target) return false;
    if (effectiveMode() === 'friendly') {
      return this.fireZip(target, side, side === 'left' ? hand : otherHand, side === 'right' ? hand : otherHand);
    }
    if (!this.webZip.shoot(hand, target.point, true)) return false;
    this.leftWeb.release();
    this.rightWeb.release();
    this.webZipSide = side;
    this.chargingTarget = target;
    this.chargingSide = side;
    this.chargePressHand.copy(hand).sub(head);
    this.chargeHand.copy(hand);
    this.chargeFromPull = physicalPull;
    this.chargeTime = 0;
    this.charge = 0;
    return true;
  }

  aimDualZip(leftOrigin: THREE.Vector3, leftDirection: THREE.Vector3, rightOrigin: THREE.Vector3, rightDirection: THREE.Vector3): ZipTarget | null {
    const target = findDualLedge(leftOrigin, leftDirection, rightOrigin, rightDirection, this.city.buildings);
    return target ? { ...target, normal: target.ledge.normal, kind: 'perch' } : null;
  }

  zipWithBothHands(leftOrigin: THREE.Vector3, leftDirection: THREE.Vector3, rightOrigin: THREE.Vector3, rightDirection: THREE.Vector3): boolean {
    if (effectiveMode() !== 'spectacular' || this.zip.active || this.webZip.active || this.wallRun.active) return false;
    const target = this.aimDualZip(leftOrigin, leftDirection, rightOrigin, rightDirection);
    return target !== null && this.fireZip(target, 'right', leftOrigin, rightOrigin);
  }

  releaseZip(side?: Side): void {
    if (!this.chargingTarget) return;
    if (side && side !== this.chargingSide) return;
    const charge = this.charge;
    this.chargingTarget = null;
    this.charge = 0;
    this.chargeTime = 0;
    this.webZip.release(charge);
    if (charge > 0.8) this.tricks.combo('CHARGED ZIP');
  }

  cancelZipCharge(): void {
    if (this.chargingTarget) this.webZip.cancel();
    this.chargingTarget = null;
    this.charge = 0;
    this.chargeTime = 0;
  }

  /** True during the short window after mounting a perch in which jump becomes a slingshot. */
  get canSlingshot(): boolean {
    return this.mountGrace > 0 && this.body.grounded;
  }

  dash(direction: THREE.Vector3, requireFree = false): boolean {
    if (this.zip.active || this.webZip.active || this.wallRun.active || this.body.nearestWall(this.city.buildings)) return false;
    if (requireFree && (this.leftWeb.attached || this.rightWeb.attached || this.leftWeb.shot.flying || this.rightWeb.shot.flying)) return false;
    return this.tricks.dash(this.body, direction);
  }

  jumpOrRelease(look = this.lookDirection): void {
    if (this.zip.active) {
      this.jumpBuffer = GAME.mountJumpBufferTime;
      return;
    }
    if (this.wallRun.active) this.wallRun.jumpOff(this.body, look);
    else if (this.canSlingshot) this.slingshot();
    else if (this.body.grounded) this.body.jump();
    else {
      this.leftWeb.release();
      this.rightWeb.release();
      this.cancelZipCharge();
      this.webZip.cancel();
    }
  }

  reset(): void {
    this.body.reset();
    this.leftWeb.release();
    this.rightWeb.release();
    this.zip.cancel();
    this.chargingTarget = null;
    this.charge = 0;
    this.chargeTime = 0;
    this.webZip.reset();
    this.mountGrace = 0;
    this.jumpBuffer = 0;
    this.wallRun.reset(this.body);
    this.tricks.reset();
    this.leftPullReady = false;
    this.rightPullReady = false;
  }

  state(): TravelState {
    if (this.zip.flying || this.webZip.shot.flying || this.leftWeb.shot.flying || this.rightWeb.shot.flying) return 'Firing Web';
    if (this.zip.active || this.webZip.pulling) return 'Zipping';
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
    dualTarget?: ZipTarget | null,
  ): void {
    const friendly = effectiveMode() === 'friendly';
    const target = friendly ? this.zip.aim(aimOrigin, aimDirection, this.city)
      : dualTarget ?? this.zip.aim(aimOrigin, aimDirection, this.city, false);
    this.reticle.update(target?.point ?? null, target?.kind === 'perch', aimOrigin);

    if (this.zip.active) {
      this.leftLine.updateShot(leftHandOrigin, this.zip.leftShot);
      this.rightLine.updateShot(rightHandOrigin, this.zip.rightShot);
    } else {
      this.leftLine.update(leftHandOrigin, this.leftWeb);
      this.rightLine.update(rightHandOrigin, this.rightWeb);
    }

    if (this.webZip.active) {
      const hand = this.webZipSide === 'left' ? leftHandOrigin : rightHandOrigin;
      this.zipLine.updateShot(hand, this.webZip.shot, this.charge);
    } else {
      this.zipLine.hide();
    }
    this.hud.update(this.body, this.state(), this.tricks, this.leftWeb, this.rightWeb, this.zip, this.wallRun, effectiveMode(), this.charge, this.chargingTarget !== null, this.lastPunchSpeed, this.lastLeftReel, this.lastRightReel, this.webZip.cooldown);
  }

  setPunchSpeed(speed: number): void {
    this.lastPunchSpeed = speed;
  }

  private fireZip(target: ZipTarget, side: Side, leftOrigin: THREE.Vector3, rightOrigin: THREE.Vector3): boolean {
    if (this.wallRun.active) return false;
    if (target.kind === 'perch') {
      if (!this.zip.shoot(target, this.body, leftOrigin, rightOrigin)) return false;
      this.leftWeb.release();
      this.rightWeb.release();
      this.wallRun.reset(this.body);
      this.mountGrace = 0;
      this.cancelZipCharge();
      return true;
    }
    if (this.body.position.distanceTo(target.point) > GAME.webZipRange) return false;
    if (!this.webZip.shoot(side === 'left' ? leftOrigin : rightOrigin, target.point)) return false;
    const airborne = !this.body.grounded;
    this.leftWeb.release();
    this.rightWeb.release();
    this.mountGrace = 0;
    this.webZipSide = side;
    if (airborne) this.tricks.combo('WEB ZIP');
    return true;
  }

  private onMounted(): void {
    if (this.jumpBuffer > 0) {
      this.slingshot();
      return;
    }
    this.mountGrace = GAME.mountGraceTime;
  }

  private clearWebsForWall(): void {
    this.leftWeb.release();
    this.rightWeb.release();
    this.cancelZipCharge();
    this.webZip.cancel();
    this.mountGrace = 0;
  }

  /** Reuses the zip's arrival direction as a forward launch off the perch. */
  private slingshot(): void {
    this.slingshotDirection.set(this.zip.arrivalVelocity.x, 0, this.zip.arrivalVelocity.z);
    this.mountGrace = 0;
    this.jumpBuffer = 0;
    if (this.slingshotDirection.lengthSq() < 1e-6) {
      this.body.jump();
      return;
    }
    this.slingshotDirection.normalize();
    this.body.velocity.set(
      this.slingshotDirection.x * GAME.mountSlingshotSpeed,
      GAME.mountSlingshotLift,
      this.slingshotDirection.z * GAME.mountSlingshotSpeed,
    );
    this.body.grounded = false;
    this.tricks.combo('SLINGSHOT');
  }

  private physicalReel(web: Web, hand: THREE.Vector3, head: THREE.Vector3, left: boolean): number {
    if (!web.attached) {
      if (left) this.leftPullReady = false;
      else this.rightPullReady = false;
      return 0;
    }
    this.chargeDirection.copy(web.lineEnd).sub(head);
    if (this.chargeDirection.lengthSq() === 0) return 0;
    this.chargeDirection.normalize();
    this.handOffset.copy(hand).sub(head);
    const previous = left ? this.previousLeftHand : this.previousRightHand;
    const ready = left ? this.leftPullReady : this.rightPullReady;
    const pull = this.handPull.copy(previous).sub(this.handOffset).dot(this.chargeDirection);
    previous.copy(this.handOffset);
    if (left) this.leftPullReady = true;
    else this.rightPullReady = true;
    return ready ? Math.max(0, pull * GAME.pullGain) : 0;
  }
}
