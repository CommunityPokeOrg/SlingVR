import type { Web } from '../physics/Web';
import type { PlayerBody } from '../physics/PlayerBody';
import type { AirTricks } from '../physics/AirTricks';
import type { WallRun } from '../physics/WallRun';
import type { Zip } from '../physics/Zip';
import type { ControlMode } from '../settings';
import { effectiveMode } from '../settings';
import type { TravelState } from '../state';

export class Hud {
  private readonly root: HTMLElement;
  private readonly debug: HTMLElement;
  private readonly help: HTMLElement;
  private lastFrame = performance.now();
  private frames = 0;
  private fps = 60;
  private mode: ControlMode = effectiveMode();
  private readonly toast: HTMLElement;

  constructor() {
    this.root = document.querySelector<HTMLElement>('#hud') ?? document.body;
    this.debug = document.createElement('div');
    this.debug.className = 'debug';
    this.help = document.createElement('div');
    this.help.className = 'help-panel hidden';
    this.toast = document.createElement('div');
    this.toast.className = 'mode-toast hidden';
    this.renderHelp();
    this.root.append(this.help, this.debug, this.toast);
    window.addEventListener('slingvr:mode', this.onMode);
  }

  toggleHelp(): void {
    this.help.classList.toggle('hidden');
  }

  update(
    player: PlayerBody,
    state: TravelState,
    tricks: AirTricks,
    left: Web,
    right: Web,
    zip: Zip,
    wallRun: WallRun,
    mode: ControlMode,
    charge: number,
    charging: boolean,
    punchSpeed: number,
    leftReel: number,
    rightReel: number,
    zipCooldown = 0,
  ): void {
    this.frames += 1;
    const now = performance.now();
    if (now - this.lastFrame > 500) {
      this.fps = Math.round((this.frames * 1000) / (now - this.lastFrame));
      this.frames = 0;
      this.lastFrame = now;
    }
    const speed = player.velocity.length() * 3.6;
    this.mode = mode;
    const chargeLabel = charging ? `<span>ZIP ${Math.round(charge * 100)}%</span>`
      : zipCooldown > 0 ? `<span>WEB ZIP ${zipCooldown.toFixed(1)}s</span>` : '';
    this.root.innerHTML = `<div class="stats"><span class="brand">SLING<span>VR</span></span><span class="mode-badge ${mode}">MODE: ${mode === 'friendly' ? 'FRIENDLY NEIGHBORHOOD' : 'SPECTACULAR'}</span><span>${speed.toFixed(0)} km/h</span><span>${player.position.y.toFixed(0)} m ALT</span><span class="state">${state}</span>${chargeLabel}<span>STYLE ${tricks.style}</span>${tricks.lastTrick ? `<b>${tricks.lastTrick}</b>` : ''}<span>${this.fps} FPS</span></div>`;
    this.root.append(this.help, this.debug, this.toast);
    if (!this.debug.classList.contains('hidden')) {
      this.debug.textContent = `L ${left.restLength.toFixed(1)}m / ${left.tension.toFixed(0)}N · R ${right.restLength.toFixed(1)}m / ${right.tension.toFixed(0)}N\nREEL ${leftReel.toFixed(3)}m / ${rightReel.toFixed(3)}m · PUNCH ${punchSpeed.toFixed(2)}m/s\n${zip.active ? 'ZIP TARGET LOCKED' : ''} ${wallRun.active ? `WALL RUN ${player.wallNormal.x.toFixed(1)},${player.wallNormal.z.toFixed(1)}` : ''}`;
    }
  }

  toggleDebug(): void {
    this.debug.classList.toggle('hidden');
  }

  private readonly onMode = (event: Event): void => {
    const mode = (event as CustomEvent<ControlMode>).detail;
    if (mode === this.mode) return;
    this.mode = mode;
    this.renderHelp();
    this.toast.textContent = `Switched to ${mode === 'friendly' ? 'Friendly Neighborhood' : 'Spectacular'}`;
    this.toast.classList.remove('hidden');
    window.setTimeout(() => this.toast.classList.add('hidden'), 2000);
  };

  private renderHelp(): void {
    const friendly = this.mode === 'friendly';
    this.help.innerHTML = `<strong>DESKTOP</strong><br>WASD run · Mouse look · LMB/RMB shoot + reel webs<br>E / MMB zip: green ledge = zip-to-point, yellow wall = web pull<br>Webs pull only after attaching · Web zip has a cooldown<br>Touch wall + hold Shift: WASD along wall, look up to climb<br>Space: look away / run to leave wall, look up while running to boost<br>Jump near the roof while moving to clear the lip<br>Space jump/release · Space on landing = slingshot · Shift air dash<br>R reset · H help · F debug<br><br><strong>VR · ${friendly ? 'FRIENDLY NEIGHBORHOOD' : 'SPECTACULAR'}</strong><br>Triggers shoot webs · ${friendly ? 'Grip zips · Left stick steers · right stick turns' : 'Aim both hands at one ledge + both triggers to zip<br>Grip + pull back + release for surface zip · Left stick steers · head turns'}<br>Touch wall + ${friendly ? 'right' : 'left'} stick forward to run · Left stick steers along wall<br>Look up to climb · A/X: away jump, upward boost, or roof clearance<br>${friendly ? 'B/Y air dash' : 'Physical punch air dash'} · Left stick click toggles mode`;
  }
}
