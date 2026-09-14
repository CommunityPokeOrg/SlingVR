# SlingVR

SlingVR is a compact WebXR traversal playground inspired by superhero swinging games: shoot two physical-feeling web lines, swing between a procedural city, zip to rooftops, wall-run, and chain air tricks from either desktop or VR.

**[Play the live demo](https://communitypokeorg.github.io/SlingVR/)**

## Features

- Fixed-timestep, tension-only rope constraints with smooth reel-in, slack, momentum-preserving releases, and a simplified single-corner tether wrap.
- Seeded low-poly city with instanced buildings, continuous rooftop ledges, analytic ray/AABB collision, and a readable HUD.
- Animated web shots for swings, one-line **Web Zip** pulls, and two-line **Zip-to-Point**. Traversal forces wait for attachment.
- Horizontal wall runs, upward wall boosts, rooftop clearance jumps, mount-and-slingshot jumps, air dash, and desktop or WebXR controller input.
- Grounded friction so the player stops when you stop steering, with a capped run speed and momentum-preserving air control.
- Vite + Three.js + TypeScript build that deploys to GitHub Pages.

## Control modes

SlingVR opens in **Friendly Neighborhood** mode for assisted, comfortable traversal. **Spectacular** is strictly VR-only: it is offered on the start overlay only when an immersive-vr session is supported, can be toggled with a left-thumbstick click in XR, and the stored preference resolves back to Friendly whenever the app is not presenting in XR (`effectiveMode()` in `src/settings.ts`). Keyboard/mouse always runs the Friendly control set.

| Feature | Friendly Neighborhood (desktop + VR) | Spectacular (VR only) |
| --- | --- | --- |
| Turning | Mouse look / head plus smooth right-stick turn | Head-only turning |
| Web swing | Held mouse buttons or triggers smoothly reel the rope | Physical hand pulls reel and build momentum |
| Web Zip | Aim at a wall, tap zip: shoot, attach, then pull the rope | Grip fires the web; pull the hand back to charge, release for a longer, faster pull after attachment |
| Zip-to-Point | Aim near a rooftop ledge, tap zip: both lines carry you over its lip | Aim both controllers at the same nearby ledge, then hold both triggers |
| Wall run | Touch a wall, hold Shift (desktop) or push right stick forward (VR); steer along it or look up to climb | Touch a wall, push left stick forward; steer along it or look up to climb |
| Wall jump / boost | Space or A/X: look away or run to jump off; look up while running to boost; jump near the roof while moving to clear the lip | A/X, with the same direction rules |
| Air dash | B/Y or Shift | Physical forward punch |

### Zip rules

- **Web firing**: the tip travels from the firing hand to a fixed target at 160 m/s, with a minimum 0.1-second flight. Gravity and existing momentum continue during flight. Swing constraints wait for attachment; point zips wait for both hands. Releasing a swing before arrival cancels it. Charged surface zips wait for both attachment and grip release.
- **Web Zip** (`GAME.webZipRange`, 85 m): an attached strand pulls toward its anchor with up to 95 m/s² acceleration over a 16–34 m pull, lasting at most 1.15 seconds. The motor stops adding force at 28–52 m/s along the strand, depending on charge. Friendly uses the full pull. Existing sideways and opposing velocity are preserved; there is no instant velocity replacement or artificial upward kick. Gravity, ground contact, and collisions still apply. The strand releases when the pull completes, gets close to its anchor, or is obstructed. A 0.85-second cooldown begins on completion/cancellation, and cannot be bypassed by alternating hands. The HUD displays it. Existing swing ropes release before a zip.
- **Zip-to-Point** (`GAME.zipRange`, 45 m): aim within the 7° cone and 2.5 m of a visible rooftop edge. The green web aimer snaps along the continuous ledge without rotating the camera. Both lines carry you outside the wall, over the lip, and onto the roof with collision checks. Spectacular requires both controller rays to snap to the same edge within 2.5 m of each other; a single grip always charges a surface web zip. Targets beyond range are rejected at aim and launch.
- **Mount slingshot**: pressing jump in the final `GAME.mountJumpBufferTime` of flight buffers it; pressing within `GAME.mountGraceTime` after landing on the ledge reuses the arrival direction as a forward launch (`mountSlingshotSpeed` / `mountSlingshotLift`).
- **Wall run**: the player's hitbox must touch a finite wall face. Hold run and steer along the wall, arrive with along-wall momentum, or look up to climb. Entry removes only the velocity into the wall. Runs accelerate toward 24 m/s along the wall or 16 m/s upward; faster incoming tangential momentum is retained. Releasing run brakes to an attached rest. Web shots, zips, and dashes do not detach you.
- **Wall jumps**: at rest, jump only leaves the wall when looking away. While running, a level gaze jumps outward and upward; looking up gives an attached upward boost (0.75-second cooldown). Within 2.5 m of the roof, a moving jump instead lifts straight up, then carries you inward after the hitbox clears the lip. Departure has a short reattachment cooldown.

### Movement tuning

Distances are metres and velocities are metres per second. This is a superhero traversal model: gravity is deliberately tuned to 30 m/s² rather than Earth gravity to shorten airtime at the city/game scale. A standing jump reaches its apex in about 0.28 seconds. Ground running reaches 14 m/s, air steering adds speed up to 28 m/s along the requested direction, and weak horizontal drag preserves most swing momentum. Vertical motion follows gravity with a 90 m/s falling-speed limit.

Unpowered ropes only pull when taut and never grant a passive speed boost. Attaching measures the current rope length without snapping the body toward the anchor. Reeling has a bounded acceleration and speed, adds inward rope velocity, and buffers physical hand pulls across physics substeps. Slack lines sag; loaded lines straighten, and wrapped lines render both legs.

## Controls

| Action | Desktop | VR |
| --- | --- | --- |
| Look / steer | Mouse + WASD | Head + thumbstick (mode-dependent) |
| Shoot web | LMB / RMB (hold) | Controller trigger (hold) |
| Jump / release / wall jump-off | Space | A / X |
| Web Zip / Zip-to-Point | E or middle mouse | Grip; Spectacular ledge zip uses both triggers |
| Wall run / dash | Hold Shift / tap Shift | Thumbsticks + jump or physical punch |
| Reset / help / debug | R / H / F | — |
| Toggle mode | — (desktop is always Friendly) | Left-stick click |

### XR controls

| Input | Action |
| --- | --- |
| Left/right trigger | Shoot and hold the corresponding web; Spectacular: both triggers zip when both rays agree on a ledge |
| Left/right grip | Friendly: zip toward that controller's ray; Spectacular: pull back to charge a surface zip, then release |
| Left stick | Friendly: steer; Spectacular: steer and wall-run |
| Right stick | Friendly: push forward at a contacted wall to run, look up to climb, X smooth turn; Spectacular: unused |
| A/X | Jump when grounded, release webs while airborne, directional wall jump/boost while attached |
| B/Y | Friendly air dash along head-forward |
| Punch | Spectacular air dash when a forward hand punch is detected |
| Left-stick click | Toggle Friendly Neighborhood / Spectacular |

## Local development

```bash
npm i
npm run dev
npm run typecheck
npm test
npm run build
npm run preview
```

The Vite base path is `/SlingVR/` for Pages. For local preview, open `http://localhost:4173/SlingVR/`.

## Deploy

Pushes to `main` run the GitHub Actions Pages workflow. In repository Settings → Pages, choose **GitHub Actions** as the source.

## Architecture

| Area | Files |
| --- | --- |
| Bootstrap | `src/main.ts`, `src/state.ts`, `src/Player.ts` |
| City | `src/city/CityGenerator.ts` |
| Physics | `src/physics/PlayerBody.ts`, `Web.ts`, `Ledge.ts`, `Zip.ts`, `WallRun.ts`, `AirTricks.ts`, `collision.ts` |
| Input | `src/input/DesktopInput.ts`, `XRInput.ts` (thin adapters over the shared `Player`) |
| Rendering/UI | `src/render/*`, `src/ui/Hud.ts`, `index.html` |
| Tests | `src/physics/__tests__/*` (physics, ledges, wall contact, player actions, XR controller events) |

## Limitations and future work

This is a deliberately small prototype: it uses custom physics rather than a physics engine, box-only city geometry, no hand tracking, audio, animation/IK, or MSM2 assets, and performance has not been tuned on a standalone Quest. VR play should use a comfort vignette in a future pass; this prototype intentionally keeps the camera free of a vignette. Future experiments could add corner unwrap/multi-segment ropes, loop-de-loops, web wings, better comfort options, richer city materials, and haptics.

The XR adapter maps connected input sources by handedness. Spectacular's punch and pull detection use controller motion relative to the headset, so translating the rig does not count as a gesture. These remain pose heuristics rather than hand tracking. Spectacular has no turn assistance, so standing players should turn physically.

## License

MIT. See [LICENSE](LICENSE). Copyright © CommunityPoke contributors.
WebXR / web-based swinging prototype with procedural Three.js city and physics-based traversal mechanics.
