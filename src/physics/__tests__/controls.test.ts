import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { Player } from '../../Player';
import { pullCharge, zipSpeedForCharge } from '../Zip';
import { loadMode } from '../../settings';

describe('control modes', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads friendly by default and spectacular when stored', () => {
    expect(loadMode({ getItem: () => null })).toBe('friendly');
    expect(loadMode({ getItem: () => 'invalid' })).toBe('friendly');
    expect(loadMode({ getItem: () => 'spectacular' })).toBe('spectacular');
  });

  it('maps charged zip speed and physical pull', () => {
    expect(zipSpeedForCharge(-1)).toBe(14);
    expect(zipSpeedForCharge(0.5)).toBe(31);
    expect(zipSpeedForCharge(2)).toBe(48);
    const press = new THREE.Vector3(0, 0, 0);
    const direction = new THREE.Vector3(0, 0, -1);
    expect(pullCharge(press, new THREE.Vector3(0, 0, -0.5), direction)).toBe(0);
    expect(pullCharge(press, new THREE.Vector3(0, 0, 0.5), direction)).toBe(1);
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
    expect(player.body.velocity.dot(player.wallRun.normal)).toBeGreaterThan(0);
    expect(player.body.velocity.y).toBe(10);
  });
});
