import * as THREE from 'three';
import type { WebGLRenderer } from 'three';
import { Player, type FrameInput } from '../Player';
import { GAME } from '../state';

interface VisualInputs {
  left: THREE.Vector3;
  right: THREE.Vector3;
  aimOrigin: THREE.Vector3;
  aimDirection: THREE.Vector3;
}

export class XRInput {
  private readonly renderer: WebGLRenderer;
  private readonly camera: THREE.Camera;
  private readonly player: Player;
  private readonly scene: THREE.Scene;
  private readonly rig = new THREE.Group();
  private readonly controllers: THREE.Group[] = [];
  private readonly hands: [THREE.Vector3, THREE.Vector3] = [new THREE.Vector3(), new THREE.Vector3()];
  private readonly aimOrigin = new THREE.Vector3();
  private readonly aimDirection = new THREE.Vector3();
  private readonly steer = new THREE.Vector3();
  private readonly headForward = new THREE.Vector3();
  private readonly headRight = new THREE.Vector3();
  private readonly frameInput: FrameInput = { steer: this.steer, runHeld: false, wallAlong: 0, reelLeft: false, reelRight: false };
  private buttonHeld = false;
  private dashHeld = false;
  private readonly controllerQuaternions: [THREE.Quaternion, THREE.Quaternion] = [new THREE.Quaternion(), new THREE.Quaternion()];
  private active = false;

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
      const side = index === 0 ? 'left' : 'right';
      this.controllers.push(controller);
      controller.addEventListener('selectstart', () => this.shoot(side));
      controller.addEventListener('selectend', () => this.player.releaseWeb(side));
      controller.addEventListener('squeezestart', () => this.zip(index));
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
    const leftX = this.axis(leftGamepad, 2, 0);
    const leftY = this.axis(leftGamepad, 3, 1);
    this.steer.set(leftX, 0, leftY);
    this.headForward.set(0, 0, -1).applyQuaternion(this.camera.getWorldQuaternion(this.controllerQuaternions[0]));
    this.headForward.y = 0;
    if (this.headForward.lengthSq() > 0) this.headForward.normalize();
    this.headRight.set(-this.headForward.z, 0, this.headForward.x);
    const localX = this.steer.x;
    const localZ = this.steer.z;
    this.steer.copy(this.headRight).multiplyScalar(localX).addScaledVector(this.headForward, -localZ);
    const rightX = this.axis(rightGamepad, 2, 0);
    const rightY = this.axis(rightGamepad, 3, 1);
    const rightMagnitude = Math.hypot(rightX, rightY);
    this.frameInput.wallAlong = -rightY;
    this.frameInput.runHeld = rightY < -0.5 && rightMagnitude > 0.5;
    this.frameInput.reelLeft = this.triggerValue(leftGamepad) > 0.15;
    this.frameInput.reelRight = this.triggerValue(rightGamepad) > 0.15;
    this.handleButtonEdges(leftGamepad, rightGamepad);
    return this.frameInput;
  }

  updateRig(): void {
    if (this.active) this.rig.position.set(this.player.body.position.x, this.player.body.position.y - GAME.playerRadius, this.player.body.position.z);
  }

  getVisualInputs(): VisualInputs {
    this.controllerPosition(0, this.hands[0]);
    this.controllerPosition(1, this.hands[1]);
    this.controllerRay(0, this.aimOrigin, this.aimDirection);
    return { left: this.hands[0], right: this.hands[1], aimOrigin: this.aimOrigin, aimDirection: this.aimDirection };
  }

  private readonly onSessionStart = (): void => {
    this.active = true;
    this.rig.visible = true;
    this.rig.position.set(this.player.body.position.x, this.player.body.position.y - GAME.playerRadius, this.player.body.position.z);
    this.rig.add(this.camera);
    this.camera.position.set(0, 0, 0);
    this.camera.rotation.set(0, 0, 0);
  };

  private readonly onSessionEnd = (): void => {
    this.active = false;
    this.rig.visible = false;
    this.rig.remove(this.camera);
    this.scene.add(this.camera);
  };

  private shoot(side: 'left' | 'right'): void {
    const index = side === 'left' ? 0 : 1;
    this.controllerRay(index, this.aimOrigin, this.aimDirection);
    this.player.shootWeb(side, this.aimOrigin, this.aimDirection);
  }

  private zip(index: number): void {
    this.controllerRay(index, this.aimOrigin, this.aimDirection);
    this.player.zipToward(this.aimOrigin, this.aimDirection);
  }

  private controllerPosition(index: number, target: THREE.Vector3): void {
    this.controllers[index]?.getWorldPosition(target);
  }

  private controllerRay(index: number, origin: THREE.Vector3, direction: THREE.Vector3): void {
    const controller = this.controllers[index];
    if (!controller) return;
    controller.getWorldPosition(origin);
    direction.set(0, 0, -1).applyQuaternion(controller.getWorldQuaternion(this.controllerQuaternions[index] ?? new THREE.Quaternion())).normalize();
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

  private handleButtonEdges(left: Gamepad | undefined, right: Gamepad | undefined): void {
    const jumpPressed = (left?.buttons[4]?.pressed ?? false) || (right?.buttons[4]?.pressed ?? false);
    const dashPressed = (left?.buttons[5]?.pressed ?? false) || (right?.buttons[5]?.pressed ?? false);
    if (jumpPressed && !this.buttonHeld) this.player.jumpOrRelease();
    if (dashPressed && !this.dashHeld) this.player.dash(this.headForward);
    this.buttonHeld = jumpPressed;
    this.dashHeld = dashPressed;
  }
}
