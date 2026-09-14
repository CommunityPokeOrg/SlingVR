import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { PlayerBody } from '../PlayerBody';
import { Web } from '../Web';
import { GAME } from '../../state';

describe('web rope physics', () => {
  it('attaches with a slightly shortened rest length', () => {
    const player = new PlayerBody();
    player.position.set(0, 5, 0);
    const web = new Web();
    web.attach(new THREE.Vector3(0, 10, 0), player);
    expect(web.restLength).toBeCloseTo(4.2);
  });

  it('corrects an overstretched rope', () => {
    const player = new PlayerBody();
    player.position.set(0, 0, 0);
    const web = new Web();
    web.attach(new THREE.Vector3(0, 5, 0), player);
    player.position.set(0, 0, 0);
    web.step(1 / 120, player, []);
    expect(player.position.distanceTo(web.anchor)).toBeLessThanOrEqual(web.restLength + 0.01);
  });

  it('reels in while held', () => {
    const player = new PlayerBody();
    player.position.set(0, 5, 0);
    const web = new Web();
    web.attach(new THREE.Vector3(0, 10, 0), player);
    const before = web.restLength;
    web.step(0.5, player, [], GAME.ropeReelSpeed * 0.5, true);
    expect(web.restLength).toBeLessThan(before);
  });

  it('clamps reel length and skips assisted boost in spectacular mode', () => {
    const player = new PlayerBody();
    player.position.set(0, 0, 0);
    player.velocity.set(1, 0, 0);
    const web = new Web();
    web.attach(new THREE.Vector3(0, 0, 5), player);
    web.step(1 / 120, player, [], 100, false);
    expect(web.restLength).toBe(2);
    expect(player.velocity.length()).toBeLessThanOrEqual(1.001);
  });

  it('does not tension a slack rope', () => {
    const player = new PlayerBody();
    player.position.set(0, 9, 0);
    const web = new Web();
    web.attach(new THREE.Vector3(0, 10, 0), player);
    web.step(1 / 120, player, []);
    expect(web.tension).toBe(0);
  });

  it('releases cleanly', () => {
    const web = new Web();
    web.release();
    expect(web.attached).toBe(false);
    expect(web.tension).toBe(0);
  });

  it('wraps the line around the first building corner', () => {
    const player = new PlayerBody();
    player.position.set(0, 5, 8);
    const web = new Web();
    web.attach(new THREE.Vector3(0, 5, 0), player);
    web.step(1 / 120, player, [{
      min: new THREE.Vector3(-1, 0, 2),
      max: new THREE.Vector3(1, 10, 3),
    }], 0, true);
    expect(web.lineEnd).not.toBe(web.anchor);
    expect(web.lineEnd.z).toBeLessThan(3);
  });
});
