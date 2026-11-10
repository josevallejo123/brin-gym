# Artwork licence

The drawings in this folder are licensed under the Creative Commons Attribution-ShareAlike 4.0 International licence (CC BY-SA 4.0): https://creativecommons.org/licenses/by-sa/4.0/

This licence covers the artwork in this folder only. It is separate from the app's code.

## Credits

The exercise drawings are adapted from two open sets, both CC BY-SA 4.0:

- **Workout Guide** by Bryl Lim, https://github.com/bryllim/workout-guide, at commit `aac599224bb9780305239607ef98540b7e0ce389`. It supplies 44 of the 46 exercises. Workout Guide builds on Everkinetic's artwork.
- **Everkinetic**, created by Greg Priday and continued as the Everkinetic open data project, https://github.com/everkinetic/data, at commit `446bb9a3d0c3beb6b84f7c9d77dfc8af707a2ab6`. It supplies two exercises directly: the dumbbell upright row and the dumbbell walking lunge.

## What was changed

- For each exercise, two or three of the source frames were chosen and put in playing order: frame 1 is the start of the movement and the highest number is the finish.
- Every frame was resized so the figure fills the canvas, moved where needed so the figure stays in place between frames, and redrawn at one line weight. Source frames traced as double lines were joined into single lines.
- Weight-stack cable machines were removed from the cable pull-through, cable face pull, overhead rope triceps extension and wide-grip lat pulldown (weight stack only), and the machine base from the leg extension. In the cable hip abduction, one frame's machine is reused in the other.
- "Plate around the world" uses Workout Guide's plate front raise, as no free drawing of that movement exists.
- The white lines were made colour-neutral (`fill="currentColor"`) so the app can colour them.

`tools/content/art-map.json` records which source frames each exercise uses and what was done to each, and `tools/content/prepare-art.mjs` makes these files from the sources.

`app-icon.svg` is an original drawing made for this app by `tools/content/draw-app-icon.mjs`. It is released under the same licence.

Under CC BY-SA 4.0 you may share and adapt these drawings, including commercially, as long as you give credit, link the licence, say what you changed, and share your version under the same licence.
