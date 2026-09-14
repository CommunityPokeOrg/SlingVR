import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { Player } from '../../Player';
import { DesktopInput } from '../../input/DesktopInput';
import { GAME } from '../../state';

vi.mock('../../ui/Hud', () => ({ Hud: class { update = vi.fn(); } }));

function setup() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  const player = new Player({
    buildings: [{ min: new THREE.Vector3(-10, 0, -30), max: new THREE.Vector3(10, 20, -10) }],
    perches: [], spawn: new THREE.Vector3(0, 10, 10),
  }, scene);
  const browser = new EventTarget();
  const canvas = Object.assign(new EventTarget(), { requestPointerLock: vi.fn().mockResolvedValue(undefined) });
  const document = Object.assign(new EventTarget(), { pointerLockElement: canvas as EventTarget | null });
  vi.stubGlobal('addEventListener', browser.addEventListener.bind(browser));
  vi.stubGlobal('document', document);
  const input = new DesktopInput(player, camera, canvas as unknown as HTMLCanvasElement);
  const key = (code: string) => browser.dispatchEvent(Object.assign(new Event('keydown'), { code, repeat: false }));
  const look = (movementX: number, movementY: number) => browser.dispatchEvent(Object.assign(new Event('mousemove'), { movementX, movementY }));
  return { player, camera, input, browser, document, key, look };
}

afterEach(() => vi.unstubAllGlobals());

describe('desktop traversal input', () => {
  it('keeps forward and strafe movement aligned with the camera after turning', () => {
    const { input, browser, camera, key, look } = setup();
    look(500, -150);
    key('KeyW');
    const forward = input.getFrameInput().steer.clone();
    const cameraForward = camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize();
    expect(forward.dot(cameraForward)).toBeCloseTo(1);
    browser.dispatchEvent(Object.assign(new Event('keyup'), { code: 'KeyW' }));
    key('KeyD');
    const right = input.getFrameInput().steer;
    expect(right.dot(cameraForward)).toBeCloseTo(0);
    expect(right.dot(new THREE.Vector3().crossVectors(cameraForward, camera.up))).toBeCloseTo(1);
  });

  it('snaps the web aimer and zips to a ledge without changing camera rotation', () => {
    const { player, input, camera, key, look } = setup();
    const pitch = Math.atan2(20 - (10 + GAME.eyeHeight), 20) + 0.02;
    look(0, -pitch / 0.0021);
    const visual = input.getVisualInputs();
    const rotation = camera.quaternion.clone();
    player.updateVisuals(visual.left, visual.right, visual.aimOrigin, visual.aimDirection);
    expect(player.reticle.object.position.y).toBeCloseTo(20);
    expect(player.reticle.object.position.z).toBeCloseTo(-10);
    key('KeyE');
    expect(player.zip.active).toBe(true);
    expect(camera.quaternion.equals(rotation)).toBe(true);
  });

  it('requires upward look at wall contact and clears controls when pointer lock ends', () => {
    const { player, input, document, key, look } = setup();
    player.body.position.z = -10 + GAME.playerRadius;
    key('ShiftLeft');
    player.stepPhysics(GAME.fixedStep, input.getFrameInput());
    expect(player.wallRun.active).toBe(false);
    look(0, -250);
    player.stepPhysics(GAME.fixedStep, input.getFrameInput());
    expect(player.wallRun.active).toBe(true);
    document.pointerLockElement = null;
    document.dispatchEvent(new Event('pointerlockchange'));
    key('Space');
    expect(input.getFrameInput().runHeld).toBe(false);
    expect(player.wallRun.active).toBe(true);
  });
});
