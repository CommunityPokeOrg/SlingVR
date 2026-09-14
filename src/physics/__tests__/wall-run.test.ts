import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { PlayerBody } from '../PlayerBody';
import { WallRun } from '../WallRun';
import { GAME } from '../../state';

const buildings = [{ min: new THREE.Vector3(0, 0, -10), max: new THREE.Vector3(10, 20, 10) }];
const start = new THREE.Vector3(-GAME.playerRadius, GAME.playerRadius, 0);

describe('contact-bound wall running', () => {
  it('starts from a standstill on the ground only with contact, run, and upward look', () => {
    const body = new PlayerBody(start);
    const wall = new WallRun();
    body.grounded = true;
    expect(wall.step(GAME.fixedStep, body, buildings, false, 1)).toBe(false);
    expect(wall.step(GAME.fixedStep, body, buildings, true, 0)).toBe(false);
    body.position.x = -1;
    expect(wall.step(GAME.fixedStep, body, buildings, true, 1)).toBe(false);
    body.position.copy(start);
    expect(wall.step(GAME.fixedStep, body, buildings, true, 1)).toBe(true);
    expect(body.position.y).toBeGreaterThan(start.y);
    expect(body.position.x).toBe(-GAME.playerRadius);
    expect(body.grounded).toBe(false);
  });

  it('stays attached when releasing Shift, looking away, or steering away', () => {
    const body = new PlayerBody(start);
    const wall = new WallRun();
    wall.step(GAME.fixedStep, body, buildings, true, 1);
    for (let i = 0; i < 120; i += 1) {
      wall.step(GAME.fixedStep, body, buildings, true, 0, new THREE.Vector3(-1, 0, 0));
    }
    const resting = body.position.clone();
    for (let i = 0; i < 120; i += 1) wall.step(GAME.fixedStep, body, buildings, false, 1);
    expect(wall.active).toBe(true);
    expect(body.position.distanceTo(resting)).toBeLessThan(1e-6);
    expect(body.position.x).toBe(-GAME.playerRadius);
  });

  it('stays on the finite wall at the roof and side edges until jumping', () => {
    const body = new PlayerBody(start);
    const wall = new WallRun();
    for (let i = 0; i < 600; i += 1) {
      wall.step(GAME.fixedStep, body, buildings, true, 1, new THREE.Vector3(0, 0, 1));
    }
    expect(wall.active).toBe(true);
    expect(body.position.y).toBeLessThan(20);
    expect(body.position.z).toBeLessThan(10);
    expect(body.position.x).toBe(-GAME.playerRadius);
    wall.jumpOff(body);
    expect(wall.active).toBe(false);
    expect(body.velocity.x).toBeLessThan(0);
    expect(body.velocity.y).toBe(10);
    expect(body.wallNormal.lengthSq()).toBe(0);
  });

  it('does not immediately reattach with Shift still held after jumping', () => {
    const body = new PlayerBody(start);
    const wall = new WallRun();
    wall.step(GAME.fixedStep, body, buildings, true, 1);
    wall.jumpOff(body);
    expect(wall.step(GAME.fixedStep, body, buildings, true, 1)).toBe(false);
    expect(wall.tryStart(body, buildings, true, 1)).toBe(false);
    for (let i = 0; i < 60; i += 1) {
      body.step(GAME.fixedStep, buildings);
      wall.step(GAME.fixedStep, body, buildings, true, 1);
    }
    expect(wall.active).toBe(false);
    expect(body.position.x).toBeLessThan(-2);
  });
});
