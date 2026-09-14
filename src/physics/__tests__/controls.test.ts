import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { Player } from '../../Player';
import { pullCharge } from '../Zip';
import { WebZip } from '../WebZip';
import { PlayerBody } from '../PlayerBody';
import { loadMode } from '../../settings';
import { GAME } from '../../state';

describe('control modes', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads friendly by default and spectacular when stored', () => {
    expect(loadMode({ getItem: () => null })).toBe('friendly');
    expect(loadMode({ getItem: () => 'invalid' })).toBe('friendly');
    expect(loadMode({ getItem: () => 'spectacular' })).toBe('spectacular');
  });

  it('maps physical hand pull to clamped charge', () => {
    const press = new THREE.Vector3(0, 0, 0);
    const direction = new THREE.Vector3(0, 0, -1);
    expect(pullCharge(press, new THREE.Vector3(0, 0, -0.5), direction)).toBe(0);
    expect(pullCharge(press, new THREE.Vector3(0, 0, 0.5), direction)).toBe(1);
    expect(pullCharge(press, new THREE.Vector3(0, 0, GAME.zipPullDistance / 2), direction)).toBeCloseTo(0.5);
  });

  it.each([-1, 0, 0.5, 1, 2])('clamps charge %s when setting the pull motor speed', (charge) => {
    const body = new PlayerBody(new THREE.Vector3(0, 50, 0));
    const zip = new WebZip();
    const clamped = THREE.MathUtils.clamp(charge, 0, 1);
    const speed = THREE.MathUtils.lerp(GAME.webZipMinSpeed, GAME.webZipMaxSpeed, clamped);
    zip.shoot(body.position, new THREE.Vector3(0, 50, -60), true);
    while (zip.shot.flying) zip.step(GAME.fixedStep, body, []);
    zip.release(charge);
    body.velocity.z = -speed;
    zip.step(GAME.fixedStep, body, []);
    expect(zip.force.lengthSq()).toBe(0);
    body.velocity.z += 0.25;
    zip.step(GAME.fixedStep, body, []);
    expect(-zip.force.z).toBeCloseTo(0.25 * GAME.playerMass / GAME.fixedStep);
  });

  it('jumps off a wall through Player.jumpOrRelease', () => {
    const element = (): Record<string, unknown> => ({
      className: '',
      innerHTML: '',
      append: vi.fn(),
      classList: { add: vi.fn(), remove: vi.fn(), toggle: vi.fn(), contains: vi.fn(() => false) },
    });
    vi.stubGlobal('window', { addEventListener: vi.fn(), setTimeout: vi.fn() });
    vi.stubGlobal('document', {
      body: element(),
      createElement: element,
      querySelector: () => null,
    });
    const player = new Player({ buildings: [], perches: [], spawn: new THREE.Vector3() }, new THREE.Scene());
    player.wallRun.active = true;
    player.wallRun.normal.set(1, 0, 0);
    player.jumpOrRelease();
    expect(player.wallRun.active).toBe(true);
    expect(player.body.velocity.lengthSq()).toBe(0);
    player.jumpOrRelease(new THREE.Vector3(1, 0, 0));
    expect(player.wallRun.active).toBe(false);
    expect(player.body.velocity.dot(player.wallRun.normal)).toBeGreaterThan(0);
    expect(player.body.velocity.y).toBe(10);
  });
});
