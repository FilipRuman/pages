---
title: Generating realistic looking biomes
description: Generating realisticly behaving biomes for procedural terrain in Godot using C#.
---

On this page, I explain how to generate biome textures, which among others will
be used as input data for the terrain shader implemented in the previous
section.

## Terrain Aspects

To determine which biome should be assigned to a given point on a terrain chunk,
we define a set of **terrain aspects**. In this tutorial we will use: moisture,
temperature, elevation, ruggedness, slope. These are continuous fields
describing environmental properties at each point.

In this tutorial, the following aspects are used:

- moisture
- temperature
- elevation
- roughness
- slope

Additional aspects can be introduced depending on the desired level of realism
or control.

```cs
public class TerrainAspects(float moisture, float temperature, float elevation, float slope, float roughness)
{
        // all values should be within a 0..1 range
        public float moisture = moisture;
        public float temperature = temperature;
        public float elevation = elevation;
        public float roughness = roughness;
        public float slope = slope;
}
```

Most terrain aspects are generated using noise functions with different
frequencies and offsets. This allows for large-scale variation combined with
fine detail.

The slope aspect is computed differently. It is derived from the rate of change
of the elevation field. This value can later be used to restrict object
placement-for example, preventing trees from spawning on steep terrain.

```cs
private float CalculateSlope(Vector2 pos)
{
        var current_elevation = elevation_noise.SampleNormalized(pos);

        var elevation_right = elevation_noise.SampleNormalized(pos + Vector2.Right * slope_calculation_step_size);
        var delta_right = (elevation_right - current_elevation) / slope_calculation_step_size;

        var elevation_up = elevation_noise.SampleNormalized(pos + Vector2.Up * slope_calculation_step_size);
        var delta_up = (elevation_up - current_elevation) / slope_calculation_step_size;

        return Mathf.Sqrt(delta_right * delta_right + delta_up * delta_up);
}
```

Whole script implementing this:

```cs
//TerrainAspectsSolver.cs
using Godot;
[GlobalClass, Tool]
public partial class TerrainAspectsSolver : Node
{

        [Export] public NoiseComponent elevation_noise;
        [Export] public NoiseComponent temperature_noise;
        [Export] public NoiseComponent moisture_noise;

        [Export] public float slope_calculation_step_size;

        [Export] public float moisture_roughness_effect;
        [Export] public float elevation_roughness_effect;
        [Export] public float slope_roughness_effect;



        public class TerrainAspects(float moisture, float temperature, float elevation, float slope, float roughness)
        {
                // all values should be within a 0..1 range
                public float moisture = moisture;
                public float temperature = temperature;
                public float elevation = elevation;
                public float roughness = roughness;
                public float slope = slope;
        }
        public TerrainAspects SolveForPos(Vector2 pos)
        {
                var elevation = elevation_noise.SampleNormalized(pos);
                var temperature = temperature_noise.SampleNormalized(pos);
                var moisture = moisture_noise.SampleNormalized(pos);
                var slope = CalculateSlope(pos);
                var roughness = Mathf.Clamp(elevation_roughness_effect * elevation + moisture_roughness_effect * moisture + slope_roughness_effect * slope, 0, 1);

                return new(moisture, temperature, elevation, slope, roughness);
        }
        private float CalculateSlope(Vector2 pos)
        {
                var current_elevation = elevation_noise.SampleNormalized(pos);

                var elevation_right = elevation_noise.SampleNormalized(pos + Vector2.Right * slope_calculation_step_size);
                var delta_right = (elevation_right - current_elevation) / slope_calculation_step_size;

                var elevation_up = elevation_noise.SampleNormalized(pos + Vector2.Up * slope_calculation_step_size);
                var delta_up = (elevation_up - current_elevation) / slope_calculation_step_size;

                return Mathf.Sqrt(delta_right * delta_right + delta_up * delta_up);
        }
}
```

A custom `NoiseComponent` class is used to simplify noise generation. It allows
multiple noise layers to be combined with different amplitudes and parameters
directly within the Godot editor.

```cs
// NoiseComponent.cs
using Godot;
using System.Linq;
[Tool, GlobalClass]
public partial class NoiseComponent : Resource
{
        [Export] NoisePart[] noises;
        /// returns noise in a -Amplitude..Amplitude range
        public float Sample(Vector2 pos)
        {
                return noises.Sum(part => { return part.Sample(pos); });
        }
        public float Amplitude
        {
                get { return noises.Sum(part => { return part.amplitude; }); }
        }
        /// output is within a 0..1 range 
        public float SampleNormalized(Vector2 pos)
        {
                var amplitude = Amplitude;
                return (Sample(pos) + amplitude) / (amplitude * 2);
        }
}
```

```cs
// NoisePart.cs
using Godot;
[GlobalClass, Tool]
public partial class NoisePart : Resource
{
        [Export] public FastNoiseLite noise;
        [Export] public float amplitude;
        [Export] public float frequency = 1f;

        public float Sample(Vector2 pos)
        {
                return noise.GetNoise2Dv(pos * frequency) * amplitude;
        }
}
```

## Biome Data Structure

Next, a data structure for storing biome information needs to be defined. This
structure should be easily configurable from the editor and contain all data
required by the terrain shader.

Each biome will define its preferred ranges for terrain aspects (e.g.,
temperature, moisture) using a `FloatRange` . These values will later be used to
compute biome influence.

```cs
// Biome.cs
using Godot;
[Tool, GlobalClass]
public partial class Biome : Resource
{
        public byte index_in_biomes_array;

        [ExportGroup("Preferred terrain aspects")]
        [Export] public FloatRange preferred_moisture;
        [Export] public FloatRange preferred_elevation;
        [Export] public FloatRange preferred_temperature;

        [ExportGroup("Ground texture")]
        [Export] public Texture albedo;
        [Export] public Texture normal;
        [Export] public Texture roughness;
        [Export(PropertyHint.ColorNoAlpha)] public Color tint;
        [Export] public float color_offset;
        [Export] public float scale;


}
```

`FloatRange` will be a simple data structure that stores a minimum and maximum
value and allows for convenient editing in the inspector.

```cs
//FloatRange.cs
using Godot;
[Tool, GlobalClass]
public partial class FloatRange : Resource
{
        [Export] public float min;
        [Export] public float max;
}
```

## Generating Biome Data

To determine biome influence at a given point, we first compute the terrain
aspects. Then, for each biome, we evaluate how well the current terrain values
match its preferred ranges.

Each biome is assigned an influence value based on this match. These influence
values are then normalized to ensure consistent blending between biomes.

```cs
[Export] float biome_transitions_smoothness;
private float GetInfluenceForTerrainAspect(FloatRange preferred, float value)
{
        return Mathf.SmoothStep(preferred.min - biome_transitions_smoothness, preferred.max, value)
                 * (1 - Mathf.SmoothStep(preferred.min, preferred.max + biome_transitions_smoothness, value));
}
```

The resulting data is stored in a `BiomeInfluence` structure.

```cs
public class BiomeInfluence(Biome biome, float influence)
{
        public Biome biome = biome;
        public float influence = influence;
}

[Export] int backup_biome_index;
private List<BiomeInfluence> GetBiomeInfluences(TerrainAspectsSolver.TerrainAspects terrain_aspects, Biome[] biomes)
{
        float sum_of_influences = 0;
        List<BiomeInfluence> output = [];

        foreach (var biome in biomes)
        {
                float influence =
                            GetInfluenceForTerrainAspect(biome.preferred_moisture, terrain_aspects.moisture) *
                            GetInfluenceForTerrainAspect(biome.preferred_elevation, terrain_aspects.elevation) *
                            GetInfluenceForTerrainAspect(biome.preferred_temperature, terrain_aspects.temperature);
                if (influence == 0)
                {
                        continue;
                }
                sum_of_influences += influence;
                output.Add(new(biome, influence));
        }
        if (sum_of_influences == 0)
        {
                GD.PushWarning($"There is no valid biome for this terrain, using the backup biome! terrain aspects:\n" +
                                "moisture:{MathF.Round(terrain_aspects.moisture, 2)}\n" + "elevation:{MathF.Round(terrain_aspects.elevation, 2)}\n" +
                                "temperature:{MathF.Round(terrain_aspects.temperature, 2)}");
                return [new BiomeInfluence(biomes[backup_biome_index], influence: 1)];
        }
        var normalization_factor = 1f / sum_of_influences;
        foreach (var biome in output)
        {
                biome.influence *= normalization_factor;
        }

        return output;
}
```

The biome influence data must be converted into textures for use in the terrain
shader. To handle this, a `TextureData` class is introduced. This class is
responsible for encoding biome influence values into texture channels and
providing access to this data for later use.

```c
public class TextureData(int texture_resolution, byte[][] biome_maps, Biome[] biomes)
{
        // biome_maps[biome texture index][x pixel inside the texture + y pixel * map map_resolution]
        readonly byte[][] biome_textures = biome_maps;
        readonly int texture_resolution = texture_resolution;
        readonly Biome[] biomes = biomes;

        public List<BiomeInfluence> GetBiomeInfluenceForUV(Vector2 uv)
        {
                int x = Mathf.FloorToInt(texture_resolution * uv.X);// uv to pixel pos
                int y = Mathf.FloorToInt(texture_resolution * uv.Y);

                int base_pixel_index = x + y * texture_resolution;
                List<BiomeInfluence> output = [];
                for (int biome_index = 0; biome_index < biomes.Length; biome_index++)
                {
                        HandleBiomeInfluenceSampling(base_pixel_index, biome_index, ref output);
                }
                return output;

        }
        private void HandleBiomeInfluenceSampling(int base_pixel_index, int biome_index, ref List<BiomeInfluence> output)
        {
                int biome_texture = biome_index / COLOR_CHANNELS;
                int index_inside_biome_texture = base_pixel_index + biome_index % COLOR_CHANNELS;
                float influence = FloatConversions.ByteToFloat(biome_textures[biome_texture][index_inside_biome_texture]);
                if (influence < 0.1f)
                {
                        return;
                }
                output.Add(new(biomes[biome_index], influence));
        }


        public ImageTexture GetTexture(int texture_index)
        {
                if (texture_index >= biome_textures.Length)
                {
                        GD.PushWarning($"The requested biome texture index was outside of the array, returning blank texture\n " +
                                        " requested-{texture_index} length- {biome_textures.Length}");
                        var image = Image.CreateEmpty(texture_resolution, texture_resolution, false, Image.Format.Rgba8);
                        return ImageTexture.CreateFromImage(image);
                }
                else
                {
                        var data = biome_textures[texture_index];
                        var image = Image.CreateFromData(texture_resolution, texture_resolution, false, Image.Format.Rgba8, data);
                        return ImageTexture.CreateFromImage(image);
                }
        }
}
```

The `GenerateTextureData` function combines the previous steps:

- Generate terrain aspects at a given resolution
- Compute biome influences for each point
- Store the results in an array
- Construct a `TextureData` object from the generated data

```cs
private const int COLOR_CHANNELS = 4;
[Export] int biome_map_resolution;
[Export] TerrainAspectsSolver terrain_aspects_solver;
private static byte[][] InitializeBiomeTexturesArray(int textures_count, int pixels_per_axis)
{

        int texture_size = pixels_per_axis * pixels_per_axis * COLOR_CHANNELS;
        byte[][] biome_textures = new byte[textures_count][];

        for (int i = 0; i < textures_count; i++)
        {
                biome_textures[i] = new byte[texture_size];
        }

        return biome_textures;
}
public TextureData GenerateTextureData(Vector2 base_world_position, int terrain_chunk_size, Biome[] biomes)
{

        float pixel_size = terrain_chunk_size / biome_map_resolution;

        var biome_textures_count = Mathf.CeilToInt((float)biomes.Length / COLOR_CHANNELS);
        byte[][] biome_textures = InitializeBiomeTexturesArray(biome_textures_count, biome_map_resolution);

        for (int x = 0; x < biome_map_resolution; x++)
        {
                for (int y = 0; y < biome_map_resolution; y++)
                {
                        Vector2 world_pos = new Vector2(x, y) * pixel_size + base_world_position;
                        List<BiomeInfluence> biome_influences = GetBiomeInfluences(terrain_aspects_solver.SolveForPos(world_pos), biomes);
                        int base_biome_texture_index = (x + y * biome_map_resolution) * COLOR_CHANNELS;

                        foreach (var biome_influence in biome_influences)
                        {
                                var texture_index = biome_influence.biome.index_in_biomes_array / COLOR_CHANNELS;
                                int color_channel_index = biome_influence.biome.index_in_biomes_array % COLOR_CHANNELS;
                                biome_textures[texture_index][base_biome_texture_index + color_channel_index] = FloatConversions.FloatToByte(biome_influence.influence);
                        }
                }
        }

        return new(biome_map_resolution, biome_textures, biomes);
}
```

<details>
<summary> Whole implementation of the BiomeGenerator.cs  </summary>

```cs
// BiomeGenerator.cs
using System.Collections.Generic;
using Godot;
[Tool]
public partial class BiomeGenerator : Node
{

        private const int COLOR_CHANNELS = 4;
        [Export] int biome_map_resolution;
        [Export] TerrainAspectsSolver terrain_aspects_solver;

        public class TextureData(int texture_resolution, byte[][] biome_maps, Biome[] biomes)
        {
                // biome_maps[biome texture index][x pixel inside the texture + y pixel * map map_resolution]
                readonly byte[][] biome_textures = biome_maps;
                readonly int texture_resolution = texture_resolution;
                readonly Biome[] biomes = biomes;

                public List<BiomeInfluence> GetBiomeInfluenceForUV(Vector2 uv)
                {
                        int x = Mathf.FloorToInt(texture_resolution * uv.X);// uv to pixel pos
                        int y = Mathf.FloorToInt(texture_resolution * uv.Y);

                        int base_pixel_index = x + y * texture_resolution;
                        List<BiomeInfluence> output = [];
                        for (int biome_index = 0; biome_index < biomes.Length; biome_index++)
                        {
                                HandleBiomeInfluenceSampling(base_pixel_index, biome_index, ref output);
                        }
                        return output;

                }
                private void HandleBiomeInfluenceSampling(int base_pixel_index, int biome_index, ref List<BiomeInfluence> output)
                {
                        int biome_texture = biome_index / COLOR_CHANNELS;
                        int index_inside_biome_texture = base_pixel_index + biome_index % COLOR_CHANNELS;
                        float influence = FloatConversions.ByteToFloat(biome_textures[biome_texture][index_inside_biome_texture]);
                        if (influence < 0.1f)
                        {
                                return;
                        }
                        output.Add(new(biomes[biome_index], influence));
                }


                public ImageTexture GetTexture(int texture_index)
                {
                        if (texture_index >= biome_textures.Length)
                        {
                                GD.PushWarning($"The requested biome texture index was outside of the array, returning blank texture\n " +
                                                " requested-{texture_index} length- {biome_textures.Length}");
                                var image = Image.CreateEmpty(texture_resolution, texture_resolution, false, Image.Format.Rgba8);
                                return ImageTexture.CreateFromImage(image);
                        }
                        else
                        {
                                var data = biome_textures[texture_index];
                                var image = Image.CreateFromData(texture_resolution, texture_resolution, false, Image.Format.Rgba8, data);
                                return ImageTexture.CreateFromImage(image);
                        }
                }
        }
        public class BiomeInfluence(Biome biome, float influence)
        {
                public Biome biome = biome;
                public float influence = influence;
        }

        [Export] float biome_transitions_smoothness;
        private float GetInfluenceForTerrainAspect(FloatRange preferred, float value)
        {
                return Mathf.SmoothStep(preferred.min - biome_transitions_smoothness, preferred.max, value)
                         * (1 - Mathf.SmoothStep(preferred.min, preferred.max + biome_transitions_smoothness, value));
        }
        [Export] int backup_biome_index;
        private List<BiomeInfluence> GetBiomeInfluences(TerrainAspectsSolver.TerrainAspects terrain_aspects, Biome[] biomes)
        {
                float sum_of_influences = 0;
                List<BiomeInfluence> output = [];

                foreach (var biome in biomes)
                {
                        float influence =
                                    GetInfluenceForTerrainAspect(biome.preferred_moisture, terrain_aspects.moisture) *
                                    GetInfluenceForTerrainAspect(biome.preferred_elevation, terrain_aspects.elevation) *
                                    GetInfluenceForTerrainAspect(biome.preferred_temperature, terrain_aspects.temperature);
                        if (influence == 0)
                        {
                                continue;
                        }
                        sum_of_influences += influence;
                        output.Add(new(biome, influence));
                }
                if (sum_of_influences == 0)
                {
                        GD.PushWarning($"There is no valid biome for this terrain, using the backup biome! terrain aspects:\n" +
                                        "moisture:{MathF.Round(terrain_aspects.moisture, 2)}\n" + "elevation:{MathF.Round(terrain_aspects.elevation, 2)}\n" +
                                        "temperature:{MathF.Round(terrain_aspects.temperature, 2)}");
                        return [new BiomeInfluence(biomes[backup_biome_index], influence: 1)];
                }
                var normalization_factor = 1f / sum_of_influences;
                foreach (var biome in output)
                {
                        biome.influence *= normalization_factor;
                }

                return output;
        }
        private static byte[][] InitializeBiomeTexturesArray(int textures_count, int pixels_per_axis)
        {

                int texture_size = pixels_per_axis * pixels_per_axis * COLOR_CHANNELS;
                byte[][] biome_textures = new byte[textures_count][];

                for (int i = 0; i < textures_count; i++)
                {
                        biome_textures[i] = new byte[texture_size];
                }

                return biome_textures;
        }
        public TextureData GenerateTextureData(Vector2 base_world_position, int terrain_chunk_size, Biome[] biomes)
        {

                float pixel_size = terrain_chunk_size / biome_map_resolution;

                var biome_textures_count = Mathf.CeilToInt((float)biomes.Length / COLOR_CHANNELS);
                byte[][] biome_textures = InitializeBiomeTexturesArray(biome_textures_count, biome_map_resolution);

                for (int x = 0; x < biome_map_resolution; x++)
                {
                        for (int y = 0; y < biome_map_resolution; y++)
                        {
                                Vector2 world_pos = new Vector2(x, y) * pixel_size + base_world_position;
                                List<BiomeInfluence> biome_influences = GetBiomeInfluences(terrain_aspects_solver.SolveForPos(world_pos), biomes);
                                int base_biome_texture_index = (x + y * biome_map_resolution) * COLOR_CHANNELS;

                                foreach (var biome_influence in biome_influences)
                                {
                                        var texture_index = biome_influence.biome.index_in_biomes_array / COLOR_CHANNELS;
                                        int color_channel_index = biome_influence.biome.index_in_biomes_array % COLOR_CHANNELS;
                                        biome_textures[texture_index][base_biome_texture_index + color_channel_index] = FloatConversions.FloatToByte(biome_influence.influence);
                                }
                        }
                }

                return new(biome_map_resolution, biome_textures, biomes);
        }

}
```

</details>

## Assigning Data to the Ground Shader

Once the biome textures are generated, they must be passed to the terrain
shader. This is handled by a `GroundShaderController` class. Its
responsibilities include:

- Assigning biome textures to the shader
- Configuring shader parameters
- Organizing biome-related data into arrays required by the shader

```cs
using Godot;
[Tool]
public partial class GroundShaderController : Node
{

        [ExportGroup("rock")]
        [Export] Texture rock_texture;
        [Export] Texture rock_normal_map;
        [Export] Texture rock_roughness;
        [Export] float rock_scale;
        [Export] float rock_color_gain;


        [ExportGroup("post processing")]
        [Export] float global_color_gain;
        [Export] float global_color_offset;

        [Export] Texture post_processing_noise;
        [Export] float post_processing_noise_scale;
        [Export] float post_processing_albedo_influence;
        [Export] float metallic;
        [Export] float spectacular;
        [Export] ShaderMaterial ground_shader_material;


        public void SetShaderConfiguration(Biome[] biomes, ImageTexture[] biome_textures_1, ImageTexture[] biome_textures_2)
        {

                var biome_albedo_textures = new Texture[biomes.Length];
                var biome_normal_textures = new Texture[biomes.Length];
                var biome_roughness_textures = new Texture[biomes.Length];
                var biome_texture_tints = new Vector3[biomes.Length];
                var biome_texture_color_offsets = new float[biomes.Length];
                var biome_texture_scales = new float[biomes.Length];
                int i = 0;
                foreach (var biome in biomes)
                {

                        biome.index_in_biomes_array = (byte)i;
                        biome_albedo_textures[i] = biome.albedo;
                        biome_normal_textures[i] = biome.normal;
                        biome_roughness_textures[i] = biome.roughness;
                        biome_texture_tints[i] = new(biome.tint.R, biome.tint.G, biome.tint.B);
                        biome_texture_color_offsets[i] = biome.color_offset;
                        biome_texture_scales[i] = biome.scale;
                        i++;
                }
                ground_shader_material.SetShaderParameter("rock_color_gain", rock_color_gain);
                ground_shader_material.SetShaderParameter("rock_scale", rock_scale);
                ground_shader_material.SetShaderParameter("rock_normal_map", rock_normal_map);
                ground_shader_material.SetShaderParameter("rock_roughness", rock_roughness);
                ground_shader_material.SetShaderParameter("rock_texture", rock_texture);

                ground_shader_material.SetShaderParameter("metallic", metallic);
                ground_shader_material.SetShaderParameter("spectacular", spectacular);

                ground_shader_material.SetShaderParameter("biome_texture_tints", biome_texture_tints);
                ground_shader_material.SetShaderParameter("biome_texture_color_offsets", biome_texture_color_offsets);
                ground_shader_material.SetShaderParameter("biome_texture_scales", biome_texture_scales);

                ground_shader_material.SetShaderParameter("biome_albedo_textures", biome_albedo_textures);
                ground_shader_material.SetShaderParameter("biome_roughness_textures", biome_roughness_textures);
                ground_shader_material.SetShaderParameter("biome_normal_textures", biome_normal_textures);

                ground_shader_material.SetShaderParameter("post_processing_noise", post_processing_noise);
                ground_shader_material.SetShaderParameter("post_processing_albedo_influence", post_processing_albedo_influence);

                ground_shader_material.SetShaderParameter("post_processing_noise_scale", post_processing_noise_scale);


                ground_shader_material.SetShaderParameter("global_color_offset", global_color_offset);
                ground_shader_material.SetShaderParameter("global_color_gain", global_color_gain);

                ground_shader_material.SetShaderParameter("biome_textures_1", biome_textures_1);
                ground_shader_material.SetShaderParameter("biome_textures_2", biome_textures_2);
        }
}
```

## Integration

Finally, the `GenerationController` is updated to integrate the biome generator
and the shader controller, completing the terrain generation.

```diff lang="cs"
// GenerationController.cs
using Godot;
[Tool]
public partial class GenerationController : Node
{
        [ExportToolButton("Run")] private Callable RunButton => Callable.From(Run);
        [Export] int terrain_chunk_size;

        [Export] MeshInstance3D mesh_instance;
        [Export] CollisionShape3D collider;
        [Export] GroundMeshGen ground_mesh_gen;
+       [Export] BiomeGenerator biome_generator;
+       [Export] Biome[] biomes;
+       [Export] GroundShaderController ground_shader_controller;

        private void Run()
        {
                Vector2I base_world_pos = new(0, 0);
                ground_mesh_gen.Initialize(terrain_chunk_size);
                var mesh_data = ground_mesh_gen.GenerateChunkData(base_world_pos);
                ground_mesh_gen.ApplyData(mesh_data, mesh_instance, collider);
+               var biome_data = biome_generator.GenerateTextureData(base_world_pos, terrain_chunk_size, biomes);
+               ground_shader_controller.SetShaderConfiguration(biomes,[biome_data.GetTexture(0)],[biome_data.GetTexture(1)]);

        }

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
        data-term="generating biome data"
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
