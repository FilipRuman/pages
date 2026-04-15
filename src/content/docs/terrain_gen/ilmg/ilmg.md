---
title: Improving landmass generation
description: Implementing a realistic landmass generation algorithm utilizng terrain aspects for a procedural terrain generation project made in Godot with C#.
---

Currently, the terrain shape is generated using a single noise function. This
does not align with the generated biome data and results in visually
uninteresting terrain.

To improve this, we will use the previously computed terrain aspects to
influence the terrain shape. Specifically, aspect values will modulate the
amplitude of multiple noise layers at different frequencies.

In earlier sections, we implemented several terrain aspects. These will now be
used to control terrain generation. To achieve this, we introduce a class that
adjusts noise amplitudes based on terrain aspect values.

Additionally, we allow direct modification of the base height. For flexible
configuration in the Godot editor, we use the `Curve` class to define how each
terrain aspect influences noise amplitude.

```cs
//TerrainAspectEffectOnMesh.cs
using Godot;
[GlobalClass, Tool]
public partial class TerrainAspectEffectOnMesh : Resource
{
        [Export] Curve base_height;

        [Export] Curve low_freq_noise_amplitude;
        [Export] Curve medium_freq_noise_amplitude;
        [Export] Curve high_freq_noise_amplitude;
        public void AddEffectToOutput(float value, ref OutputData output)
        {
                output.high_freq_noise_amplitude += high_freq_noise_amplitude.Sample(value);
                output.medium_freq_noise_amplitude += medium_freq_noise_amplitude.Sample(value);
                output.low_freq_noise_amplitude += low_freq_noise_amplitude.Sample(value);
                output.base_height += base_height.Sample(value);
        }
        public class OutputData
        {
                public float low_freq_noise_amplitude;
                public float medium_freq_noise_amplitude;
                public float high_freq_noise_amplitude;
                public float base_height;
        }
}
```

In the `GroundMeshGen` class, we define:

- `TerrainAspectEffectOnMesh` instance for each terrain aspect
- Set of `NoiseComponent` instances representing noise layers at different
  frequencies

```cs
//GroundMeshGen.cs
[Export] private NoiseComponent high_frequency_noise;
[Export] private NoiseComponent medium_frequency_noise;
[Export] private NoiseComponent low_frequency_noise;
[Export] private TerrainAspectEffectOnMesh moisture_effect;
[Export] private TerrainAspectEffectOnMesh elevation_effect;
[Export] private TerrainAspectEffectOnMesh temperature_effect;
[Export] private TerrainAspectEffectOnMesh roughness_effect;
```

Next, we update the `CalculateHeight` function to incorporate these effects. The
function will also return the computed terrain aspects, allowing other systems
to reuse this data without recalculating it.

```cs
//GroundMeshGen.cs
public float CalculateHeight(Vector2 world_position, out TerrainAspectsSolver.TerrainAspects terrain_aspects)
{
        terrain_aspects = terrain_aspects_solver.SolveForPos(world_position);

        TerrainAspectEffectOnMesh.OutputData noise_amplitude_data = new();
        moisture_effect.AddEffectToOutput(terrain_aspects.moisture, ref noise_amplitude_data);
        elevation_effect.AddEffectToOutput(terrain_aspects.elevation, ref noise_amplitude_data);
        temperature_effect.AddEffectToOutput(terrain_aspects.temperature, ref noise_amplitude_data);
        roughness_effect.AddEffectToOutput(terrain_aspects.roughness, ref noise_amplitude_data);

        float output_height
             = high_frequency_noise.Sample(world_position) * noise_amplitude_data.high_freq_noise_amplitude
             + medium_frequency_noise.Sample(world_position) * noise_amplitude_data.medium_freq_noise_amplitude
             + low_frequency_noise.Sample(world_position) * noise_amplitude_data.low_freq_noise_amplitude
             + noise_amplitude_data.base_height;


        return output_height;
}
```

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
        data-term="improved landmass generation"
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
