import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import type { WebXRSpaceEventMap } from 'three/src/renderers/webxr/WebXRController.js';
import type { WebXRManagerEventMap } from 'three/src/renderers/webxr/WebXRManager.js';
import { Player } from '../../Player';
import { XRInput } from '../../input/XRInput';
import { SETTINGS } from '../../settings';

vi.mock('../../ui/Hud', () => ({ Hud: class { update = vi.fn(); } }));

const makeSource = (handedness: 'left' | 'right'): XRInputSource => ({
  handedness, targetRayMode: 'tracked-pointer', profiles: [],
  targetRaySpace: {} as XRSpace, gripSpace: undefined, gamepad: undefined, hand: undefined,
});

function setup() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  const player = new Player({
    buildings: [{ min: new THREE.Vector3(-10, 0, -30), max: new THREE.Vector3(10, 20, -10) }],
    perches: [], spawn: new THREE.Vector3(0, 10, 10),
  }, scene);
  const controllers = [new THREE.Group<WebXRSpaceEventMap>(), new THREE.Group<WebXRSpaceEventMap>()] as const;
  const rightSource = makeSource('right');
  const leftSource = makeSource('left');
  const manager = Object.assign(new THREE.EventDispatcher<WebXRManagerEventMap>(), {
    getController: (index: number) => controllers[index],
    getSession: () => ({ inputSources: [rightSource, leftSource] }),
  });
  const input = new XRInput({ xr: manager } as unknown as THREE.WebGLRenderer, camera, player, scene);
  manager.dispatchEvent({ type: 'sessionstart' });
  camera.position.set(0, 1.6, 0);
  controllers[0].position.set(0.3, 1.4, -0.5);
  controllers[1].position.set(-0.3, 1.4, -0.5);
  controllers[0].dispatchEvent({ type: 'connected', data: rightSource });
  controllers[1].dispatchEvent({ type: 'connected', data: leftSource });
  scene.updateMatrixWorld(true);
  const target = new THREE.Vector3(0, 20, -10);
  for (const controller of controllers) {
    const direction = target.clone().sub(controller.getWorldPosition(new THREE.Vector3())).normalize();
    controller.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), direction);
  }
  return { player, input, manager, controllers, leftSource, rightSource };
}

beforeEach(() => {
  SETTINGS.mode = 'spectacular';
  SETTINGS.xrPresenting = true;
});

afterEach(() => {
  SETTINGS.mode = 'friendly';
  SETTINGS.xrPresenting = false;
});

describe('XR controller input', () => {
  it('maps controller events by handedness, including reversed connection order', () => {
    const { player, input, controllers, rightSource, leftSource } = setup();
    input.prepareFrame();
    controllers[0].dispatchEvent({ type: 'selectstart', data: rightSource });
    expect(player.rightWeb.attached).toBe(true);
    expect(player.leftWeb.attached).toBe(false);
    expect(player.zip.active).toBe(false);
    expect(input.getVisualInputs().dualTarget).not.toBeNull();
    controllers[1].dispatchEvent({ type: 'selectstart', data: leftSource });
    expect(player.zip.active).toBe(true);
  });

  it('does not zip with an untracked second controller and clears disconnected inputs', () => {
    const { player, input, controllers, leftSource, rightSource } = setup();
    controllers[0].visible = false;
    expect(input.getVisualInputs().dualTarget).toBeNull();
    controllers[1].dispatchEvent({ type: 'selectstart', data: leftSource });
    expect(player.zip.active).toBe(false);
    expect(player.leftWeb.attached).toBe(true);
    controllers[1].dispatchEvent({ type: 'disconnected', data: leftSource });
    expect(player.leftWeb.attached).toBe(false);
    controllers[0].visible = true;
    controllers[0].dispatchEvent({ type: 'selectstart', data: rightSource });
    expect(player.zip.active).toBe(false);
  });

  it('does not interpret locomotion of the rig as a physical punch', () => {
    const { player, input } = setup();
    input.prepareFrame();
    player.body.position.z -= 20;
    input.updateRig(1 / 60);
    input.prepareFrame();
    expect(player.tricks.dashAvailable).toBe(true);
    expect(player.body.velocity.length()).toBe(0);
  });

  it('cancels charged actions on session end without firing a zip', () => {
    const { player, controllers, manager, rightSource } = setup();
    controllers[0].quaternion.identity();
    controllers[0].dispatchEvent({ type: 'squeezestart', data: rightSource });
    manager.dispatchEvent({ type: 'sessionend' });
    expect(player.body.velocity.length()).toBe(0);
    expect(player.zip.active).toBe(false);
    expect(SETTINGS.xrPresenting).toBe(false);
  });
});
