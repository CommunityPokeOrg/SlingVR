import * as THREE from 'three';
import { Player, type FrameInput } from '../Player';
import { GAME } from '../state';

const MOUSE_SENSITIVITY = 0.0021;
const MAX_PITCH = 1.45;

/**
 * Keyboard/mouse adapter. Always drives the Friendly control set: Spectacular's physical pulls,
 * charged zips and punches only exist in XR.
 */
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
  private readonly head = new THREE.Vector3();
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
    addEventListener('blur', this.onBlur);
    addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('mousedown', this.onMouseDown);
    canvas.addEventListener('mouseup', this.onMouseUp);
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    canvas.addEventListener('click', () => this.requestLock());
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
  }

  requestLock(): void {
    void this.canvas.requestPointerLock().catch(() => undefined);
  }

  get locked(): boolean {
    return document.pointerLockElement === this.canvas;
  }

  getFrameInput(dt = GAME.fixedStep): FrameInput {
    this.updateCamera();
    this.updateHandOrigins();
    this.forward.set(Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this.right.set(Math.cos(this.yaw), 0, Math.sin(this.yaw));
    this.steer.set(0, 0, 0);
    if (this.keys.has('KeyW')) this.steer.add(this.forward);
    if (this.keys.has('KeyS')) this.steer.addScaledVector(this.forward, -1);
    if (this.keys.has('KeyD')) this.steer.add(this.right);
    if (this.keys.has('KeyA')) this.steer.addScaledVector(this.right, -1);
    if (this.steer.lengthSq() > 0) this.steer.normalize();
    const reel = GAME.ropeReelSpeed * dt;
    return {
      steer: this.steer,
      head: this.head,
      leftHand: this.leftOrigin,
      rightHand: this.rightOrigin,
      runHeld: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'),
      wallAlong: this.keys.has('KeyW') ? 1 : this.keys.has('KeyS') ? -1 : 0,
      leftReel: this.leftHeld ? reel : 0,
      rightReel: this.rightHeld ? reel : 0,
      turn: 0,
    };
  }

  updateCamera(): void {
    this.camera.position.copy(this.player.body.position);
    this.camera.position.y += GAME.eyeHeight;
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  getVisualInputs(): { left: THREE.Vector3; right: THREE.Vector3; aimOrigin: THREE.Vector3; aimDirection: THREE.Vector3 } {
    this.updateCamera();
    this.updateHandOrigins();
    return { left: this.leftOrigin, right: this.rightOrigin, aimOrigin: this.camera.position, aimDirection: this.getAimDirection() };
  }

  private readonly onMouseMove = (event: MouseEvent): void => {
    if (!this.locked) return;
    this.yaw -= event.movementX * MOUSE_SENSITIVITY;
    this.pitch = THREE.MathUtils.clamp(this.pitch - event.movementY * MOUSE_SENSITIVITY, -MAX_PITCH, MAX_PITCH);
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    this.keys.add(event.code);
    if (event.code === 'Space') event.preventDefault();
    if (event.repeat) return;
    switch (event.code) {
      case 'Space':
        this.player.jumpOrRelease();
        break;
      case 'KeyE':
        this.zip();
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.player.dash(this.getAimDirection());
        break;
      case 'KeyR':
        this.player.reset();
        break;
      case 'KeyH':
        this.player.hud.toggleHelp();
        break;
      case 'KeyF':
        this.player.hud.toggleDebug();
        break;
      default:
        break;
    }
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };

  private readonly onBlur = (): void => {
    this.keys.clear();
    this.releaseHeldWebs();
  };

  private readonly onPointerLockChange = (): void => {
    if (!this.locked) {
      this.keys.clear();
      this.releaseHeldWebs();
    }
  };

  private readonly onMouseDown = (event: MouseEvent): void => {
    if (!this.locked) return;
    const direction = this.getAimDirection();
    if (event.button === 1) {
      event.preventDefault();
      this.zip();
    } else if (event.button === 0) this.leftHeld = this.player.shootWeb('left', this.camera.position, direction);
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

  private zip(): void {
    this.updateCamera();
    this.updateHandOrigins();
    this.player.zipToward(this.camera.position, this.getAimDirection(), this.rightOrigin, 'right', false);
  }

  private releaseHeldWebs(): void {
    if (this.leftHeld) this.player.releaseWeb('left');
    if (this.rightHeld) this.player.releaseWeb('right');
    this.leftHeld = false;
    this.rightHeld = false;
  }

  private getAimDirection(): THREE.Vector3 {
    return this.aimDirection.set(0, 0, -1).applyEuler(this.camera.rotation).normalize();
  }

  private updateHandOrigins(): void {
    this.head.copy(this.camera.position);
    this.leftOrigin.set(-0.28, -0.16, -0.5).applyEuler(this.camera.rotation).add(this.camera.position);
    this.rightOrigin.set(0.28, -0.16, -0.5).applyEuler(this.camera.rotation).add(this.camera.position);
  }
}
