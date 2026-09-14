import * as THREE from 'three';
import type { WebGLRenderer } from 'three';
import { Player, type FrameInput, type Side } from '../Player';
import type { ZipTarget } from '../physics/Zip';
import { effectiveMode, setXrPresenting, toggleMode } from '../settings';
import { GAME } from '../state';

interface VisualInputs {
  left: THREE.Vector3;
  right: THREE.Vector3;
  aimOrigin: THREE.Vector3;
  aimDirection: THREE.Vector3;
  dualTarget: ZipTarget | null;
}

export class XRInput {
  private readonly renderer: WebGLRenderer;
  private readonly camera: THREE.Camera;
  private readonly player: Player;
  private readonly scene: THREE.Scene;
  private readonly rig = new THREE.Group();
  private readonly controllers: THREE.Group[] = [];
  private readonly sources: (XRInputSource | null)[] = [null, null];
  private readonly triggerHeld: [boolean, boolean] = [false, false];
  private readonly motionReady: [boolean, boolean] = [false, false];
  private readonly directions: [THREE.Vector3, THREE.Vector3] = [new THREE.Vector3(), new THREE.Vector3()];
  private readonly relativeHand = new THREE.Vector3();
  private readonly hands: [THREE.Vector3, THREE.Vector3] = [new THREE.Vector3(), new THREE.Vector3()];
  private readonly previousHands: [THREE.Vector3, THREE.Vector3] = [new THREE.Vector3(), new THREE.Vector3()];
  private readonly handVelocity: [THREE.Vector3, THREE.Vector3] = [new THREE.Vector3(), new THREE.Vector3()];
  private readonly smoothedVelocity: [THREE.Vector3, THREE.Vector3] = [new THREE.Vector3(), new THREE.Vector3()];
  private readonly head = new THREE.Vector3();
  private readonly aimOrigin = new THREE.Vector3();
  private readonly aimDirection = new THREE.Vector3();
  private readonly steer = new THREE.Vector3();
  private readonly headForward = new THREE.Vector3();
  private readonly headRight = new THREE.Vector3();
  private readonly cameraQuaternion = new THREE.Quaternion();
  private readonly frameInput: FrameInput = {
    steer: this.steer,
    head: this.head,
    leftHand: this.hands[0],
    rightHand: this.hands[1],
    runHeld: false,
    wallAlong: 0,
    leftReel: 0,
    rightReel: 0,
    turn: 0,
  };
  private readonly controllerQuaternions: [THREE.Quaternion, THREE.Quaternion] = [new THREE.Quaternion(), new THREE.Quaternion()];
  private readonly buttonHeld: [boolean, boolean] = [false, false];
  private leftStickClickHeld = false;
  private active = false;
  private previousTime = performance.now();

  constructor(renderer: WebGLRenderer, camera: THREE.Camera, player: Player, scene: THREE.Scene) {
    this.renderer = renderer;
    this.camera = camera;
    this.player = player;
    this.scene = scene;
    this.rig.visible = false;
    scene.add(this.rig);
    renderer.xr.addEventListener('sessionstart', this.onSessionStart);
    renderer.xr.addEventListener('sessionend', this.onSessionEnd);
    for (let index = 0; index < 2; index += 1) {
      const controller = renderer.xr.getController(index);
      this.controllers.push(controller);
      controller.addEventListener('connected', (event) => {
        this.sources[index] = event.data;
      });
      controller.addEventListener('disconnected', (event) => {
        const side = event.data.handedness;
        if (side === 'left' || side === 'right') {
          const handIndex = side === 'left' ? 0 : 1;
          this.triggerHeld[handIndex] = false;
          this.motionReady[handIndex] = false;
          this.smoothedVelocity[handIndex].set(0, 0, 0);
          this.player.releaseWeb(side);
        }
        this.player.cancelZipCharge();
        this.sources[index] = null;
      });
      controller.addEventListener('selectstart', (event) => {
        const side = event.data.handedness;
        if (side === 'left' || side === 'right') this.shoot(side);
      });
      controller.addEventListener('selectend', (event) => {
        const side = event.data.handedness;
        if (side === 'left' || side === 'right') {
          this.triggerHeld[side === 'left' ? 0 : 1] = false;
          this.player.releaseWeb(side);
        }
      });
      controller.addEventListener('squeezestart', (event) => {
        const side = event.data.handedness;
        if (side === 'left' || side === 'right') this.zip(side);
      });
      controller.addEventListener('squeezeend', (event) => {
        const side = event.data.handedness;
        if (side === 'left' || side === 'right') this.player.releaseZip(side);
      });
      this.addControllerVisual(controller);
      this.rig.add(controller);
    }
  }

  prepareFrame(): FrameInput {
    if (!this.active) return this.frameInput;
    const session = this.renderer.xr.getSession();
    let leftGamepad: Gamepad | undefined;
    let rightGamepad: Gamepad | undefined;
    for (const source of session?.inputSources ?? []) {
      if (source.handedness === 'left') leftGamepad = source.gamepad;
      if (source.handedness === 'right') rightGamepad = source.gamepad;
    }
    const now = performance.now();
    const dt = Math.max(1 / 240, Math.min(0.1, (now - this.previousTime) / 1000));
    this.previousTime = now;
    this.camera.getWorldPosition(this.head);
    this.controllerPosition('left', this.hands[0]);
    this.controllerPosition('right', this.hands[1]);
    this.updateHandVelocity(0, dt);
    this.updateHandVelocity(1, dt);
    this.camera.getWorldQuaternion(this.cameraQuaternion);
    this.headForward.set(0, 0, -1).applyQuaternion(this.cameraQuaternion);
    this.frameInput.wallAlong = Math.max(0, this.headForward.y);
    this.headForward.y = 0;
    if (this.headForward.lengthSq() > 0) this.headForward.normalize();
    this.headRight.set(-this.headForward.z, 0, this.headForward.x);
    const leftX = this.axis(leftGamepad, 2, 0);
    const leftY = this.axis(leftGamepad, 3, 1);
    const leftMagnitude = Math.hypot(leftX, leftY);
    this.steer.copy(this.headRight).multiplyScalar(leftX).addScaledVector(this.headForward, -leftY);
    if (leftMagnitude < 0.12) this.steer.set(0, 0, 0);
    else if (this.steer.lengthSq() > 1) this.steer.normalize();
    const rightX = this.axis(rightGamepad, 2, 0);
    const rightY = this.axis(rightGamepad, 3, 1);
    const rightMagnitude = Math.hypot(rightX, rightY);
    const spectacular = effectiveMode() === 'spectacular';
    if (!spectacular) {
      this.frameInput.runHeld = rightY < -0.5 && rightMagnitude > 0.5;
      this.frameInput.turn = THREE.MathUtils.clamp(rightX, -1, 1);
      this.frameInput.leftReel = this.triggerValue(leftGamepad) > 0.15 ? GAME.ropeReelSpeed * GAME.fixedStep : 0;
      this.frameInput.rightReel = this.triggerValue(rightGamepad) > 0.15 ? GAME.ropeReelSpeed * GAME.fixedStep : 0;
    } else {
      this.frameInput.runHeld = leftY < -0.5;
      this.frameInput.turn = 0;
      this.frameInput.leftReel = 0;
      this.frameInput.rightReel = 0;
    }
    this.handleButtonEdges(leftGamepad, rightGamepad, spectacular);
    if (spectacular) this.checkPunches();
    else this.player.setPunchSpeed(0);
    return this.frameInput;
  }

  updateRig(dt: number): void {
    if (!this.active) return;
    if (effectiveMode() === 'friendly') this.rig.rotation.y += this.frameInput.turn * Math.PI * 0.5 * dt;
    this.rig.position.set(this.player.body.position.x, this.player.body.position.y - GAME.playerRadius, this.player.body.position.z);
  }

  getVisualInputs(): VisualInputs {
    const dualTarget = this.updateDualAim();
    if (!this.controllerRay('right', this.aimOrigin, this.aimDirection)) {
      this.controllerRay('left', this.aimOrigin, this.aimDirection);
    }
    return { left: this.hands[0], right: this.hands[1], aimOrigin: this.aimOrigin, aimDirection: this.aimDirection, dualTarget };
  }

  private readonly onSessionStart = (): void => {
    this.active = true;
    setXrPresenting(true);
    this.rig.visible = true;
    this.rig.position.set(this.player.body.position.x, this.player.body.position.y - GAME.playerRadius, this.player.body.position.z);
    this.rig.add(this.camera);
    this.camera.position.set(0, 0, 0);
    this.camera.rotation.set(0, 0, 0);
    this.motionReady.fill(false);
    this.triggerHeld.fill(false);
    this.buttonHeld.fill(false);
    this.leftStickClickHeld = false;
    this.smoothedVelocity[0].set(0, 0, 0);
    this.smoothedVelocity[1].set(0, 0, 0);
    this.previousTime = performance.now();
  };

  private readonly onSessionEnd = (): void => {
    this.active = false;
    setXrPresenting(false);
    this.player.cancelZipCharge();
    this.player.releaseWeb('left');
    this.player.releaseWeb('right');
    this.triggerHeld.fill(false);
    this.motionReady.fill(false);
    this.rig.visible = false;
    this.rig.remove(this.camera);
    this.scene.add(this.camera);
  };

  private shoot(side: Side): void {
    if (!this.active) return;
    const index = side === 'left' ? 0 : 1;
    this.triggerHeld[index] = true;
    if (effectiveMode() === 'spectacular' && this.triggerHeld[0] && this.triggerHeld[1]) {
      const target = this.updateDualAim();
      if (target && this.player.zipWithBothHands(this.hands[0], this.directions[0], this.hands[1], this.directions[1])) return;
    }
    if (!this.controllerRay(side, this.aimOrigin, this.aimDirection)) return;
    this.player.shootWeb(side, this.aimOrigin, this.aimDirection);
  }

  private zip(side: Side): void {
    if (!this.active || !this.controllerRay(side, this.aimOrigin, this.aimDirection)) return;
    this.camera.getWorldPosition(this.head);
    this.player.zipToward(this.aimOrigin, this.aimDirection, this.aimOrigin, side, true, this.head);
  }

  private controllerPosition(side: Side, target: THREE.Vector3): void {
    const index = this.sources.findIndex((source) => source?.handedness === side);
    const controller = this.controllers[index];
    if (controller?.visible) controller.getWorldPosition(target);
    else target.copy(this.head);
  }

  private controllerRay(side: Side, origin: THREE.Vector3, direction: THREE.Vector3): boolean {
    const index = this.sources.findIndex((source) => source?.handedness === side);
    const controller = this.controllers[index];
    if (!controller?.visible) {
      origin.copy(this.head);
      direction.set(0, 0, 0);
      return false;
    }
    controller.getWorldPosition(origin);
    direction.set(0, 0, -1).applyQuaternion(controller.getWorldQuaternion(this.controllerQuaternions[index] ?? this.controllerQuaternions[0])).normalize();
    return true;
  }

  private updateDualAim(): ZipTarget | null {
    const left = this.controllerRay('left', this.hands[0], this.directions[0]);
    const right = this.controllerRay('right', this.hands[1], this.directions[1]);
    if (!left || !right || effectiveMode() !== 'spectacular') return null;
    return this.player.aimDualZip(this.hands[0], this.directions[0], this.hands[1], this.directions[1]);
  }

  private addControllerVisual(controller: THREE.Group): void {
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.16, 8), new THREE.MeshLambertMaterial({ color: '#8fe9ff' }));
    grip.rotation.x = Math.PI / 2;
    const ray = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -0.35)]),
      new THREE.LineBasicMaterial({ color: '#8fe9ff', transparent: true, opacity: 0.8 }),
    );
    controller.add(grip, ray);
  }

  private axis(gamepad: Gamepad | undefined, preferred: number, fallback: number): number {
    if (!gamepad) return 0;
    return gamepad.axes[preferred] ?? gamepad.axes[fallback] ?? 0;
  }

  private triggerValue(gamepad: Gamepad | undefined): number {
    return gamepad?.buttons[0]?.value ?? 0;
  }

  private handleButtonEdges(left: Gamepad | undefined, right: Gamepad | undefined, spectacular: boolean): void {
    const jumpPressed = (left?.buttons[4]?.pressed ?? false) || (right?.buttons[4]?.pressed ?? false);
    if (jumpPressed && !this.buttonHeld[0]) this.player.jumpOrRelease();
    this.buttonHeld[0] = jumpPressed;
    const dashPressed = (left?.buttons[5]?.pressed ?? false) || (right?.buttons[5]?.pressed ?? false);
    if (!spectacular && dashPressed && !this.buttonHeld[1]) this.player.dash(this.headForward);
    this.buttonHeld[1] = dashPressed;
    const leftStickClick = left?.buttons[3]?.pressed ?? false;
    if (leftStickClick && !this.leftStickClickHeld) toggleMode();
    this.leftStickClickHeld = leftStickClick;
  }

  private updateHandVelocity(index: number, dt: number): void {
    const hand = this.hands[index]!;
    const previous = this.previousHands[index]!;
    const velocity = this.handVelocity[index]!;
    const smoothed = this.smoothedVelocity[index]!;
    const sourceIndex = this.sources.findIndex((source) => source?.handedness === (index === 0 ? 'left' : 'right'));
    if (!this.controllers[sourceIndex]?.visible) {
      this.motionReady[index] = false;
      smoothed.set(0, 0, 0);
      return;
    }
    this.relativeHand.copy(hand).sub(this.head);
    if (this.motionReady[index]) {
      velocity.copy(this.relativeHand).sub(previous).multiplyScalar(1 / dt);
      smoothed.lerp(velocity, 1 - Math.exp(-25 * dt));
    } else {
      smoothed.set(0, 0, 0);
      this.motionReady[index] = true;
    }
    previous.copy(this.relativeHand);
  }

  private checkPunches(): void {
    let fastest = 0;
    for (let index = 0; index < 2; index += 1) {
      const velocity = this.smoothedVelocity[index]!;
      const speed = velocity.length();
      fastest = Math.max(fastest, speed);
      if (speed <= GAME.punchSpeed) continue;
      const direction = velocity.clone().setY(0);
      if (direction.lengthSq() === 0) continue;
      direction.normalize();
      if (direction.dot(this.headForward) < Math.cos(THREE.MathUtils.degToRad(40))) continue;
      this.player.dash(direction, true);
    }
    this.player.setPunchSpeed(fastest);
  }
}
