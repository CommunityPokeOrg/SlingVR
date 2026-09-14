import * as THREE from 'three';
import type { CityData } from './city/CityGenerator';
import { AirTricks } from './physics/AirTricks';
import { PlayerBody } from './physics/PlayerBody';
import { WallRun } from './physics/WallRun';
import { Web } from './physics/Web';
import { applyWebZip, findPerch, pullCharge, webZipImpulseForCharge, Zip, type ZipTarget, zipSpeedForCharge } from './physics/Zip';
import { raycastAABBs } from './physics/collision';
import { Reticle } from './render/Reticle';
import { WebLine } from './render/WebLine';
import { effectiveMode } from './settings';
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

export type Side = 'left' | 'right';

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
  private readonly chargeDirection = new THREE.Vector3();
  private readonly chargePressHand = new THREE.Vector3();
  private readonly chargeHand = new THREE.Vector3();
  private readonly handOffset = new THREE.Vector3();
  private readonly webZipAnchor = new THREE.Vector3();
  private readonly webZipDirection = new THREE.Vector3();
  private readonly slingshotDirection = new THREE.Vector3();
  private chargingTarget: ZipTarget | null = null;
  private chargingSide: Side = 'right';
  private chargeFromPull = false;
  private chargeTime = 0;
  private charge = 0;
  private webZipTimer = 0;
  private webZipSide: Side = 'right';
  private mountGrace = 0;
  private jumpBuffer = 0;
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
    this.lastLeftReel = 0;
    this.lastRightReel = 0;
    this.webZipTimer = Math.max(0, this.webZipTimer - dt);
    this.mountGrace = Math.max(0, this.mountGrace - dt);
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
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
    if (this.zip.active) {
      if (this.zip.step(dt, this.body)) this.onMounted();
    } else {
      this.body.steer(input.steer, dt);
      this.body.step(dt, this.city.buildings);
      const assist = effectiveMode() === 'friendly';
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

  shootWeb(side: Side, origin: THREE.Vector3, direction: THREE.Vector3): boolean {
    this.rayDirection.copy(direction).normalize();
    const hit = raycastAABBs(origin, this.rayDirection, this.city.buildings, GAME.webRange);
    if (!hit) return false;
    (side === 'left' ? this.leftWeb : this.rightWeb).attach(hit.point, this.body);
    if (side === 'left') this.prevLeftAlong = 0;
    else this.prevRightAlong = 0;
    return true;
  }

  releaseWeb(side: Side): void {
    (side === 'left' ? this.leftWeb : this.rightWeb).release();
  }

  /**
   * Aims a zip. A perch inside `GAME.zipRange` becomes a two-line zip-to-point that mounts the
   * player; any other building surface inside `GAME.webZipRange` becomes a one-line web zip
   * impulse. Friendly fires immediately; Spectacular (XR only) starts a charge that `releaseZip`
   * fires.
   */
  zipToward(origin: THREE.Vector3, direction: THREE.Vector3, hand = origin, side: Side = 'right', physicalPull = false): boolean {
    if (this.zip.active) return false;
    const target = this.zip.aim(origin, direction, this.city);
    if (!target) return false;
    if (effectiveMode() === 'friendly') {
      return this.fireZip(target, side, null);
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
    const target = this.chargingTarget;
    this.chargingTarget = null;
    this.charge = 0;
    this.chargeTime = 0;
    if (this.fireZip(target, this.chargingSide, charge) && charge > 0.8) this.tricks.combo('CHARGED ZIP');
  }

  /** True during the short window after mounting a perch in which jump becomes a slingshot. */
  get canSlingshot(): boolean {
    return this.mountGrace > 0 && this.body.grounded;
  }

  dash(direction: THREE.Vector3, requireFree = false): boolean {
    if (requireFree && (this.zip.active || this.leftWeb.attached || this.rightWeb.attached)) return false;
    return this.tricks.dash(this.body, direction);
  }

  jumpOrRelease(): void {
    if (this.zip.active) {
      this.jumpBuffer = GAME.mountJumpBufferTime;
      return;
    }
    if (this.wallRun.active) this.wallRun.jumpOff(this.body);
    else if (this.canSlingshot) this.slingshot();
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
    this.zip.cancel();
    this.chargingTarget = null;
    this.charge = 0;
    this.chargeTime = 0;
    this.webZipTimer = 0;
    this.mountGrace = 0;
    this.jumpBuffer = 0;
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
    const perch = findPerch(aimOrigin, aimDirection, this.city.perches);
    const hit = perch ? null : raycastAABBs(aimOrigin, aimDirection, this.city.buildings, GAME.webZipRange);
    this.reticle.update(perch?.point ?? hit?.point ?? null, perch !== null);

    const zipTarget = this.zip.active ? this.zip.target : this.chargingTarget?.kind === 'perch' ? this.chargingTarget.point : null;
    if (zipTarget) {
      this.leftLine.updateTarget(leftHandOrigin, zipTarget, this.charge);
      this.rightLine.updateTarget(rightHandOrigin, zipTarget, this.charge);
    } else {
      this.leftLine.update(leftHandOrigin, this.leftWeb);
      this.rightLine.update(rightHandOrigin, this.rightWeb);
    }

    if (this.chargingTarget && this.chargingTarget.kind === 'surface') {
      this.chargeHand.copy(this.chargingSide === 'left' ? leftHandOrigin : rightHandOrigin);
      this.zipLine.updateTarget(this.chargeHand, this.chargingTarget.point, this.charge);
    } else if (this.webZipTimer > 0) {
      const hand = this.webZipSide === 'left' ? leftHandOrigin : rightHandOrigin;
      this.zipLine.updateTarget(hand, this.webZipAnchor, 0, this.webZipTimer / GAME.webZipFlashTime);
    } else {
      this.zipLine.hide();
    }
    this.hud.update(this.body, this.state(), this.tricks, this.leftWeb, this.rightWeb, this.zip, this.wallRun, effectiveMode(), this.charge, this.chargingTarget !== null, this.lastPunchSpeed, this.lastLeftReel, this.lastRightReel);
  }

  setPunchSpeed(speed: number): void {
    this.lastPunchSpeed = speed;
  }

  /** `charge` is null for Friendly's immediate zip, otherwise the 0..1 Spectacular charge. */
  private fireZip(target: ZipTarget, side: Side, charge: number | null): boolean {
    if (target.kind === 'perch') {
      if (!this.zip.launch(target, this.body, charge === null ? GAME.zipSpeed : zipSpeedForCharge(charge))) return false;
      this.leftWeb.release();
      this.rightWeb.release();
      this.wallRun.active = false;
      this.mountGrace = 0;
      return true;
    }
    const impulse = charge === null ? GAME.webZipImpulse : webZipImpulseForCharge(charge);
    const airborne = !this.body.grounded;
    applyWebZip(this.body, target.point, impulse, this.webZipDirection);
    this.webZipAnchor.copy(target.point);
    this.webZipSide = side;
    this.webZipTimer = GAME.webZipFlashTime;
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
