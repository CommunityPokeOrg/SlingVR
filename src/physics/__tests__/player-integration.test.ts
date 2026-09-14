import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { Player, type FrameInput } from '../../Player';
import { SETTINGS } from '../../settings';
import { GAME } from '../../state';

vi.mock('../../ui/Hud', () => ({ Hud: class { update = vi.fn(); } }));

const roof = { min: new THREE.Vector3(-10, 0, -30), max: new THREE.Vector3(10, 20, -10) };
const spawn = new THREE.Vector3(0, 10, 10);
const ledge = new THREE.Vector3(0, 20, -10);
const makePlayer = (): Player => new Player({ buildings: [roof], perches: [], spawn }, new THREE.Scene());
const frame = (player: Player): FrameInput => ({
  steer: new THREE.Vector3(),
  head: player.body.position.clone().add(new THREE.Vector3(0, GAME.eyeHeight, 0)),
  leftHand: player.body.position.clone().add(new THREE.Vector3(-0.3, 1.4, -0.5)),
  rightHand: player.body.position.clone().add(new THREE.Vector3(0.3, 1.4, -0.5)),
  runHeld: false, wallAlong: 0, leftReel: 0, rightReel: 0, turn: 0,
});

beforeEach(() => {
  SETTINGS.mode = 'friendly';
  SETTINGS.xrPresenting = false;
});

afterEach(() => {
  SETTINGS.mode = 'friendly';
  SETTINGS.xrPresenting = false;
});

describe('shared traversal actions', () => {
  it('Friendly selects a continuous ledge and buffers a slingshot on arrival', () => {
    const player = makePlayer();
    const input = frame(player);
    const direction = ledge.clone().sub(input.head).normalize();
    expect(player.zipToward(input.head, direction)).toBe(true);
    expect(player.zip.active).toBe(true);
    player.updateVisuals(input.leftHand, input.rightHand, input.head, direction);
    expect(player.leftLine.group.visible).toBe(true);
    expect(player.rightLine.group.visible).toBe(true);
    for (let i = 0; i < 300 && player.zip.active; i += 1) {
      player.jumpOrRelease();
      player.stepPhysics(GAME.fixedStep, frame(player));
    }
    expect(player.zip.active).toBe(false);
    expect(player.body.grounded).toBe(false);
    expect(player.body.velocity.y).toBe(GAME.mountSlingshotLift);
    expect(player.body.velocity.z).toBe(-GAME.mountSlingshotSpeed);
  });

  it('surface web zip releases swing constraints so the pull is not canceled', () => {
    const player = makePlayer();
    const input = frame(player);
    player.shootWeb('left', input.head, new THREE.Vector3(0, 0, -1));
    expect(player.leftWeb.shot.flying).toBe(true);
    expect(player.leftWeb.attached).toBe(false);
    for (let i = 0; i < 120 && player.leftWeb.shot.flying; i += 1) player.stepPhysics(GAME.fixedStep, input);
    expect(player.leftWeb.attached).toBe(true);
    const velocity = player.body.velocity.clone();
    expect(player.zipToward(input.head, new THREE.Vector3(0, 0, -1))).toBe(true);
    expect(player.leftWeb.attached).toBe(false);
    expect(player.leftWeb.shot.flying).toBe(false);
    expect(player.body.velocity.equals(velocity)).toBe(true);
    for (let i = 0; i < 120 && player.webZip.shot.flying; i += 1) player.stepPhysics(GAME.fixedStep, input);
    for (let i = 0; i < 12; i += 1) player.stepPhysics(GAME.fixedStep, input);
    expect(player.webZip.pulling).toBe(true);
    expect(player.body.velocity.z).toBeLessThan(-8);
  });

  it('keeps wall contact through web, zip, dash, and steering actions until jump', () => {
    const player = makePlayer();
    player.body.position.set(0, 5, -10 + GAME.playerRadius);
    const input = frame(player);
    input.runHeld = true;
    input.wallAlong = 1;
    player.stepPhysics(GAME.fixedStep, input);
    expect(player.wallRun.active).toBe(true);
    const direction = new THREE.Vector3(0, 0, -1);
    expect(player.shootWeb('left', input.head, direction)).toBe(false);
    expect(player.zipToward(input.head, direction)).toBe(false);
    expect(player.dash(direction)).toBe(false);
    input.steer.set(0, 0, 1);
    for (let i = 0; i < 30; i += 1) player.stepPhysics(GAME.fixedStep, input);
    expect(player.body.position.z).toBe(-10 + GAME.playerRadius);
    player.jumpOrRelease();
    expect(player.wallRun.active).toBe(false);
    expect(player.body.velocity.z).toBeGreaterThan(0);
    player.stepPhysics(GAME.fixedStep, input);
    expect(player.wallRun.active).toBe(false);
  });
});

describe('Spectacular gestures', () => {
  beforeEach(() => {
    SETTINGS.mode = 'spectacular';
    SETTINGS.xrPresenting = true;
  });

  it('only starts a ledge zip with both controller rays', () => {
    const player = makePlayer();
    const input = frame(player);
    const left = ledge.clone().sub(input.leftHand).normalize();
    const right = ledge.clone().sub(input.rightHand).normalize();
    player.shootWeb('left', input.leftHand, left);
    expect(player.zip.active).toBe(false);
    expect(player.zipWithBothHands(input.leftHand, left, input.rightHand, new THREE.Vector3(0, 0, 1))).toBe(false);
    expect(player.zipWithBothHands(input.leftHand, left, input.rightHand, right)).toBe(true);
    expect(player.zip.active).toBe(true);
    expect(player.leftWeb.attached).toBe(false);
  });

  it('keeps a single grip as surface web zip even while aiming at a ledge', () => {
    const player = makePlayer();
    const input = frame(player);
    expect(player.zipToward(input.rightHand, ledge.clone().sub(input.rightHand).normalize(), input.rightHand, 'right', true, input.head)).toBe(true);
    player.releaseZip('right');
    expect(player.zip.active).toBe(false);
    expect(player.webZip.active).toBe(true);
    expect(player.webZip.shot.flying).toBe(true);
    expect(player.body.velocity.lengthSq()).toBe(0);
    for (let i = 0; i < 120 && player.webZip.shot.flying; i += 1) player.stepPhysics(GAME.fixedStep, input);
    player.stepPhysics(GAME.fixedStep, input);
    expect(player.webZip.pulling).toBe(true);
    expect(player.body.velocity.z).toBeLessThan(0);
  });

  it('does not charge from whole-body translation, and ignores the other grip release', () => {
    const player = makePlayer();
    const input = frame(player);
    player.zipToward(input.rightHand, new THREE.Vector3(0, 0, -1), input.rightHand, 'right', true, input.head);
    const translation = new THREE.Vector3(0, 0, 3);
    input.head.add(translation);
    input.rightHand.add(translation);
    player.stepPhysics(GAME.fixedStep, input);
    player.body.velocity.set(0, 0, 0);
    player.releaseZip('left');
    expect(player.body.velocity.length()).toBe(0);
    for (let i = 0; i < 120 && player.webZip.shot.flying; i += 1) player.stepPhysics(GAME.fixedStep, input);
    player.stepPhysics(GAME.fixedStep, input);
    expect(player.webZip.pulling).toBe(false);
    expect(player.webZip.force.lengthSq()).toBe(0);
    const direction = player.webZip.shot.target.clone().sub(player.body.position).normalize();
    player.body.velocity.copy(direction).multiplyScalar(GAME.webZipMinSpeed);
    const before = player.body.velocity.clone();
    player.releaseZip('right');
    expect(player.body.velocity.equals(before)).toBe(true);
    player.stepPhysics(GAME.fixedStep, input);
    expect(player.webZip.pulling).toBe(true);
    expect(player.webZip.force.length()).toBeLessThan(1e-6);
  });

  it('does not reel on the first sample or charge after cancellation', () => {
    const player = makePlayer();
    const input = frame(player);
    input.leftHand.copy(input.head).add(new THREE.Vector3(-0.3, 0, 0.5));
    player.shootWeb('left', input.leftHand, new THREE.Vector3(0, 0, -1));
    for (let i = 0; i < 120 && player.leftWeb.shot.flying; i += 1) player.stepPhysics(GAME.fixedStep, input);
    expect(player.leftWeb.attached).toBe(true);
    expect(player.leftWeb.reelSpeed).toBe(0);
    const length = player.leftWeb.restLength;
    player.stepPhysics(GAME.fixedStep, input);
    expect(player.leftWeb.restLength).toBe(length);
    player.zipToward(input.rightHand, new THREE.Vector3(0, 0, -1), input.rightHand, 'right', true, input.head);
    player.cancelZipCharge();
    player.body.velocity.set(0, 0, 0);
    player.releaseZip('right');
    expect(player.body.velocity.length()).toBe(0);
    expect(player.webZip.active).toBe(false);
    expect(player.webZip.shot.flying).toBe(false);
  });

  it('reels only from relative hand movement, even when locomotion changes the rope direction', () => {
    const player = makePlayer();
    const input = frame(player);
    input.leftHand.copy(input.head).add(new THREE.Vector3(0, 0, -0.5));
    player.shootWeb('left', input.leftHand, new THREE.Vector3(0, 0, -1));
    for (let i = 0; i < 120 && player.leftWeb.shot.flying; i += 1) player.stepPhysics(GAME.fixedStep, input);
    expect(player.leftWeb.attached).toBe(true);
    const length = player.leftWeb.restLength;
    input.head.x += 5;
    input.leftHand.x += 5;
    player.stepPhysics(GAME.fixedStep, input);
    expect(player.leftWeb.restLength).toBeCloseTo(length);
    input.leftHand.z += 0.2;
    player.stepPhysics(GAME.fixedStep, input);
    expect(player.leftWeb.restLength).toBeGreaterThan(length - 0.01);
    for (let i = 0; i < 60; i += 1) player.stepPhysics(GAME.fixedStep, input);
    expect(player.leftWeb.restLength).toBeLessThan(length - 0.2);
  });
});
