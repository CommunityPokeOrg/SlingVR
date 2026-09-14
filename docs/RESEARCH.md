# Traversal research

SlingVR borrows broad traversal ideas from superhero games without using proprietary assets or code. The implementation is an original, intentionally small WebXR experiment.

## MSM2 traversal mechanics: basic to advanced

### Web swing

Insomniac describes swinging as a physics-based pendulum whose feel is improved by steering and by tuning web-line connections. Sideward lines can turn the player, while more vertical lines preserve forward motion. The practical design target is accessibility first, with room for mastery through timing and routing.[^gdc][^gamedesigner]

SlingVR uses unilateral distance constraints, outward radial velocity removal, air drag, reel-in, and a small Friendly tangent boost. Two active ropes share a feasible length budget and iteratively constrain the body. Position corrections pass through building collision resolution. Releasing near the bottom of an arc preserves the simulated velocity rather than granting a scripted launch.

### Web zip and point launch

Web zip is a quick directional change, while point/perch zips move the player to a marked environmental target. Insomniac's design interview specifically calls out zipping to points such as lamp posts and water towers, then springing off to change traversal rhythm.[^gamedesigner] A contemporary Spider-Man 2 guide documents aiming first and then zipping to a chosen wall or ceiling surface.[^zip]

SlingVR snaps the web aimer to continuous rooftop edges within 45 m, a 7-degree cone, and 2.5 m of the aim ray, otherwise falling back to the analytic building raycast. Ledge zips travel at 35 m/s through an outside approach point before landing over the lip. Spectacular requires both controller rays to agree on the same ledge, followed by both triggers; grips remain charged surface zips.

### Corner tether

Spider-Man 2's traversal language supports routing webs around dense architecture. SlingVR implements a deliberately simplified version: when an attached rope segment intersects a building, `Web` keeps one bend near the first intersection. The original anchor remains fixed; the bend clears when direct line of sight returns. There is no multi-bend routing.

### Wall run

Wall running is a near-wall, directional traversal mode in which the player keeps momentum along a vertical surface and can jump away for a boost. The public control reference lists wall run and wall-run boost as distinct actions.[^controls]

`WallRun.ts` requires hitbox contact with a finite AABB face, run input, and upward look. It locks the body to that face and moves upward or sideways without gravity. Releasing run pauses movement but retains contact; jumping adds an outward impulse and temporarily prevents reattachment.

### Air tricks and Web Wings

The Spider-Man 2 control reference exposes air tricks, web zip, wall run, and point zip as separate traversal verbs.[^controls] Web Wings are a sustained glide state that can be entered in the air, can dodge, and can transition back into swing or zip.[^wings] SlingVR does not attempt a wing simulation; its `AirTricks` air dash is a short horizontal impulse as a comfort-friendly analogue that can be chained into a style score.

### Loop-de-loop and slingshot

Loop-de-loops and more elaborate slingshot routes are intentionally future work. The current rope model has enough velocity preservation to make their eventual addition possible, but it does not yet model multiple wraps, camera banking, or controlled inversion.

## Mapping to SlingVR

| Mechanic | Implementation | Simplification |
| --- | --- | --- |
| Shared player traversal | `Player.ts` | One player owns body, webs, zip, wall run, tricks, visuals, and HUD |
| Pendulum swing | `physics/Web.ts` | One point mass, unilateral constraints for one or two webs |
| Reel-in | `Web.prepare` | Constant Friendly reel speed or Spectacular hand pulls; both ropes retain a feasible combined length |
| Corner tether | `Web.prepare` | One first-hit bend, cleared on direct line of sight |
| Web zip | `Zip.applyWebZip` | One line to a surface inside `webZipRange`, then a forward impulse that keeps momentum along the pull and caps at `webZipMaxSpeed`; works grounded or airborne |
| Point launch (zip-to-point) | `Ledge.ts` + `Zip.launch`/`Zip.step` | Both lines target a visible rooftop edge within `zipRange`; collision-aware travel clears the lip before mounting; a jump buffered near landing or pressed within `mountGraceTime` slingshots along the arrival direction |
| Grounded footing | `PlayerBody.steer`/`applyGroundFriction` | Exponential friction with a stop threshold when not steering; steering drives toward `groundMaxSpeed`, air steering only adds up to `airControlSpeed` |
| Wall run | `physics/WallRun.ts` | AABB faces only, no camera banking |
| Air tricks | `physics/AirTricks.ts` | Dash impulse and cosmetic score |
| Web Wings | Not implemented | Air dash is a small analogue |

The desktop and XR adapters translate device state into `Player.FrameInput` and action calls. In Friendly XR, triggers shoot and reel webs, grips zip immediately, the left stick steers, and the right stick starts a wall run or turns smoothly. In Spectacular XR, triggers shoot without assistance or jointly zip to a ledge, physical pulls reel, the left stick steers and starts wall runs, grips charge surface zips, and punches dash. Wall runs require contact and upward head look in either mode. A/X jumps or releases, while B/Y remains the Friendly dash. Controller sources are mapped by handedness; their rays use simple procedural meshes.

## Design notes: two-mode controls

The two control modes separate accessibility from expressiveness. **Friendly Neighborhood**, the default, keeps assisted swinging, guided zips, and smooth turning approachable for new or seated players. **Spectacular** removes those assists so standing players can turn with their bodies, pull webs with their arms, charge a zip, and punch into an air dash. The concept was suggested by **Spacedouut** as a community distinction between comfortable traversal and a mastery-oriented mode.

| Spectacular gesture | MSM2 mechanic it mirrors | SlingVR implementation |
| --- | --- | --- |
| Pull a hand back while webbed | Pumping a swing and converting body motion into speed | Project changes in `(hand − head)` onto the anchor direction; only backward motion reels the rope, scaled by `pullGain = 1.6` |
| Pull back while gripping a zip | Charged web zip | Track the maximum headset-relative pull distance, clamp it to `zipPullDistance = 0.45m`, then map charge to an `8–36m/s` impulse |
| Punch forward | Air dash / Web Wings-like traversal burst | Exponentially smooth headset-relative controller velocity, require `3.2m/s` and a horizontal direction within 40° of head-forward |
| Turn physically | Expressive VR traversal without a comfort turn assist | Spectacular sets smooth turn to zero and leaves orientation to headset tracking |

Spectacular is VR-only. Playtesting showed that keyboard stand-ins for arm pulls and hold-to-charge zips read as a worse Friendly mode rather than a mastery mode, so the desktop adapter always drives the Friendly control set and the stored Spectacular preference only takes effect while an XR session is presenting (`effectiveMode()`).

## VR-specific considerations

Three.js's WebXR guidance recommends enabling `renderer.xr`, adding `VRButton`, and using `setAnimationLoop`; it also notes that the XR system supplies headset view direction and display projection.[^threevr] SlingVR follows that lifecycle and originates web rays from controller poses rather than the head. A production version should add a dynamic comfort vignette during fast swings, snap-turn or smooth-turn preferences, seated-height calibration, haptics, and a larger reticle/target affordance for hand aiming.

[^gdc]: [GDC Vault — “Marvel's Spider-Man”: A Technical Postmortem](https://www.gdcvault.com/play/1026496/)
[^gamedesigner]: [Game Developer — Don't mean a thing if you ain't got that swing... in Spider-Man](https://www.gamedeveloper.com/design/don-t-mean-a-thing-if-you-ain-t-got-that-swing-in-i-spider-man-i-)
[^zip]: [Prima Games — Marvel's Spider-Man 2: How to Web Zip to Any Surface](https://primagames.com/tips/marvels-spider-man-2-web-zip-any-surface)
[^controls]: [Marvel's Spider-Man 2 controls — Marvel's Spider-Man Wiki](https://marvels-spider-man.fandom.com/wiki/Marvel%27s_Spider-Man_2_controls)
[^wings]: [GameSkinny — How to Use Web Wings](https://www.gameskinny.com/tips/how-to-use-web-wings-in-spider-man-2/)
[^threevr]: [Three.js manual — WebXR basics](https://threejs.org/manual/en/webxr-basics.html)
