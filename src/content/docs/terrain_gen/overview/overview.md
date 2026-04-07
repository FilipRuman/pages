---
title: Overview of the whole procedural terrain generation tutorial.
description: Overview of the project in whitch i implement a procedural terrain generation for Godot in C#.
---

In this tutorial I will tell you how to set up a high quality terrain
generation. I tried to implement features that aren't well known but, in my
opinion, are really useful. Here are the main choices that I've done for this
project:

- I want to make the terrain generation as customizable as it can get while
  being reasonably performant and good looking.

- Generate biomes based on the procedurally generated terrain aspects. Store
  biome data textures on textures and use this for the ground shader. This
  allows for more realistic and customizable and biome generation.
- Most of the terrain generation process is multi-threaded by design.
- I skip over implementing dynamic LOD(level of details) for the terrain mesh
  because the whole tutorial is long enough. If you want to implement it
  yourself than I highly recommend looking at this series form
  [Sebastian Lague](https://www.youtube.com/watch?v=417kJGPKwDg&list=PLFt_AvWsXl0eBW2EiBtl_sxmDtSgZBxB3&index=6)

- I implement a way to generate small objects(trees, grass, rocks, etc.) and big
  structures(buildings).
- I specially don't go over implementing any interactions with the terrain
  because this tutorial is long enough. The design should allow to reasonably
  easily implement this.
- Implementation will allow for generation of infinite maps and there for the
  terrain will be split into chunks. This will allow for efficient run-time map
  generation.

You can find source code for all the pages of this tutorial on the
[GitHub repo for this project](https://github.com/FilipRuman/procedural_terrain_generationV2)
by looking at the appropriate branch.

## Additional Learning Resources

There are a lot of different learning resources in the internet about procedural
terrain generation but here are some ones that I've used myself and really
liked.

- [OG Sebastian Lague's tutorial for procedural terrain
  generation](https://www.youtube.com/watch?v=wbpMiKiSKm8&list=PLFt_AvWsXl0eBW2EiBtl_sxmDtSgZBxB3)
- [Better Mountain Generators That Aren't Perlin Noise or Erosion](https://www.youtube.com/watch?v=gsJHzBTPG0Y)
- [Paper about stochastic textures sampling](https://eheitzresearch.wordpress.com/722-2/)
- [The Problem With Procedural Generation](https://www.youtube.com/watch?v=_4DtmRcTbhk)
- [How Games Fake Water](https://www.youtube.com/watch?v=PH9q0HNBjT4)

#### Bugs

If you find anything to improve in this project's code, please create an issue
describing it on the
[GitHub repository for this project](https://github.com/FilipRuman/procedural_terrain_generationV2/issues).
For website-related issues, create an issue
[here](https://github.com/FilipRuman/pages/issues).

#### Support

All pages on this site are written by a human, and you can access everything for
free without ads. If you find this work valuable, please give a star to the
[GitHub repository for this project](https://github.com/FilipRuman/procedural_terrain_generationV2).

<script src="https://giscus.app/client.js"
        data-repo="FilipRuman/procedural_terrain_generationV2"
        data-repo-id="R_kgDOQlnCIA"
        data-category="Announcements"
        data-category-id="DIC_kwDOQlnCIM4C4CHB"
        data-mapping="specific"
        data-term="overview"
        data-strict="0"
        data-reactions-enabled="1"
        data-emit-metadata="0"
        data-input-position="top"
        data-theme="preferred_color_scheme"
        data-lang="en"
        data-loading="lazy"
        crossorigin="anonymous"
        async>
</script>
