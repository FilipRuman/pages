---
title: Overview of the whole procedural terrain generation tutorial.
description: Overview of the project in whitch i implement a procedural terrain generation for Godot in C#.
---

In this tutorial I describe how to implement a high quality terrain generation
system using Godot + C# and gdshader. The implementation focuses on several
techniques that are less common but, in my opinion, are useful.

The main design decisions for this project are:

- Provide high customization while delivering reasonable performance and
  graphics.
- Generate biome data based on the procedurally generated terrain aspects (e.g.,
  elevation, slope, temperature). Store biome data on textures and use this for
  the ground shader. This allows for more realistic and customizable and biome
  generation.
- Most of the terrain generation process is multi-threaded.
- Skip implementing dynamic LOD(Level Of Detail) for the terrain mesh to keep
  the scope of this tutorial manageable. If you want to implement it yourself,
  the series by
  [Sebastian Lague](https://www.youtube.com/watch?v=417kJGPKwDg&list=PLFt_AvWsXl0eBW2EiBtl_sxmDtSgZBxB3&index=6)
  is a useful resource.
- Implement a way to generate small objects(trees, grass, rocks, etc.) as well
  as big structures(e.g. buildings).
- Deliberately avoid implementing any interactions with the terrain to once
  again keep the scope of this project reasonable. Design of the code should
  allow you to easily implement this yourself.
- Implementation will allow for generation of infinite maps and therefore the
  terrain will need to be split into chunks. This will allow for efficient
  real-time map generation.

You can find source code for all the pages of this tutorial on the
[GitHub repo for this project](https://github.com/FilipRuman/procedural_terrain_generationV2)
by looking at the appropriate branches.

## Additional Learning Resources

There are lots of different, online learning resources about procedural terrain
generation but not all of them are useful. Here is a small list of useful ones.

- [OG Sebastian Lague's tutorial for procedural terrain
  generation](https://www.youtube.com/watch?v=wbpMiKiSKm8&list=PLFt_AvWsXl0eBW2EiBtl_sxmDtSgZBxB3)
- [Better Mountain Generators That Aren't Perlin Noise or Erosion](https://www.youtube.com/watch?v=gsJHzBTPG0Y)
- [Paper about stochastic textures sampling](https://eheitzresearch.wordpress.com/722-2/)
- [The Problem With Procedural Generation](https://www.youtube.com/watch?v=_4DtmRcTbhk)
- [How Games Fake Water](https://www.youtube.com/watch?v=PH9q0HNBjT4)

---

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
