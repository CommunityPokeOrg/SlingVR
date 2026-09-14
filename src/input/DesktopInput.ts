import * as THREE from 'three';
import { Player, type FrameInput } from '../Player';
import { GAME } from '../state';

export class DesktopInput {
  private readonly player: Player;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly canvas: HTMLCanvasElement;
  private readonly keys = new Set<string>();
  private readonly steer = new THREE.Vector3();
  private readonly forward = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly aimDirection = new THREE.Vector3();
  private readonly leftOrigin = new THREE.Vector3();
  private readonly rightOrigin = new THREE.Vector3();
  private yaw = 0;
  private pitch = 0;
  private leftHeld = false;
  private rightHeld = false;

  constructor(player: Player, camera: THREE.PerspectiveCamera, canvas: HTMLCanvasElement) {
    this.player = player;
    this.camera = camera;
    this.canvas = canvas;
    addEventListener('keydown', this.onKeyDown);
    addEventListener('keyup', this.onKeyUp);
    addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('mousedown', this.onMouseDown);
    canvas.addEventListener('mouseup', this.onMouseUp);
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    canvas.addEventListener('click', () => this.requestLock());
  }

  requestLock(): void {
    void this.canvas.requestPointerLock().catch(() => undefined);
  }

  getFrameInput(): FrameInput {
    this.forward.set(Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this.right.set(Math.cos(this.yaw), 0, Math.sin(this.yaw));
    this.steer.set(0, 0, 0);
    if (this.keys.has('KeyW')) this.steer.add(this.forward);
    if (this.keys.has('KeyS')) this.steer.addScaledVector(this.forward, -1);
    if (this.keys.has('KeyD')) this.steer.add(this.right);
    if (this.keys.has('KeyA')) this.steer.addScaledVector(this.right, -1);
    if (this.steer.lengthSq() > 0) this.steer.normalize();
    return {
      steer: this.steer,
      runHeld: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'),
      wallAlong: this.keys.has('KeyW') ? 1 : this.keys.has('KeyS') ? -1 : 0,
      reelLeft: this.leftHeld,
      reelRight: this.rightHeld,
    };
  }

  updateCamera(): void {
    this.camera.position.copy(this.player.body.position);
    this.camera.position.y += GAME.eyeHeight;
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  getVisualInputs(): { left: THREE.Vector3; right: THREE.Vector3; aimOrigin: THREE.Vector3; aimDirection: THREE.Vector3 } {
    this.updateCamera();
    this.aimDirection.set(0, 0, -1).applyEuler(this.camera.rotation).normalize();
    this.leftOrigin.set(-0.28, -0.16, -0.5).applyEuler(this.camera.rotation).add(this.camera.position);
    this.rightOrigin.set(0.28, -0.16, -0.5).applyEuler(this.camera.rotation).add(this.camera.position);
    return { left: this.leftOrigin, right: this.rightOrigin, aimOrigin: this.camera.position, aimDirection: this.aimDirection };
  }

  private readonly onMouseMove = (event: MouseEvent): void => {
    if (document.pointerLockElement !== this.canvas) return;
    this.yaw -= event.movementX * 0.0023;
    this.pitch = THREE.MathUtils.clamp(this.pitch - event.movementY * 0.0023, -1.45, 1.45);
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    this.keys.add(event.code);
    if (event.code === 'Space') {
      event.preventDefault();
      this.player.jumpOrRelease();
    } else if (event.code === 'KeyE') {
      this.player.zipToward(this.camera.position, this.getAimDirection());
    } else if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
      this.player.dash(this.getAimDirection());
    } else if (event.code === 'KeyR') this.player.reset();
    else if (event.code === 'KeyH') this.player.hud.toggleHelp();
    else if (event.code === 'KeyF') this.player.hud.toggleDebug();
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };

  private readonly onMouseDown = (event: MouseEvent): void => {
    const direction = this.getAimDirection();
    if (event.button === 1) {
      this.player.zipToward(this.camera.position, direction);
      return;
    }
    if (event.button === 0) this.leftHeld = this.player.shootWeb('left', this.camera.position, direction);
    else if (event.button === 2) this.rightHeld = this.player.shootWeb('right', this.camera.position, direction);
  };

  private readonly onMouseUp = (event: MouseEvent): void => {
    if (event.button === 0) {
      this.leftHeld = false;
      this.player.releaseWeb('left');
    } else if (event.button === 2) {
      this.rightHeld = false;
      this.player.releaseWeb('right');
    }
  };

  private getAimDirection(): THREE.Vector3 {
    return this.aimDirection.set(0, 0, -1).applyEuler(this.camera.rotation).normalize();
  }
}
