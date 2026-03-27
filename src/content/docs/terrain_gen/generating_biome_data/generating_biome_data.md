---
title: 3. Generating biome data
description: Generating biome data
---

On this page I will explain how to geneate biomes texture that, among others,
will be used as a data for a terrain ground shader that was implemented on the
previous page.

## Terrain Aspects

To decide what biome should we select for a ceratin point on a terrain chunk, we
will generate terrain aspects. In this tutorial we will use: moisture,
temperature, elevation, ruggedness, slope. You might add any other terrain
aspect that you find useful.

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

To generate most of the terrain aspects we will just use noise at different
frequences and offsets. The only one that we will use a different aproach for
will be the slope. To generate it we will messure how fast the elevation terrain
aspect chagnes. We will use it later to stop objects like trees from spawing
where terrain height is rapidly chaining.

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

I've used a `NoiseComponent` in there. It is a class that will allow us to
easily combine multiple nosies at different amplitudes in a godot editor.

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

Now we need to implement a data structure that will hold data for biomes. It
needs to be easily coustomized from the editor. It will hold some data that will
be later assinged to the ground shader by a funciton that we will later
implement. It will also hold what values of terrain aspects it preferes inside
of a `FloatRange`.

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

`FloatRange` is a simple data structure that holds the minimum and max value and
allows for simple customization in the editor.

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

## Generating Biomes Data

To generate the biomes for a ceratin point we will just generate terrain aspects
and decide based on them which biome should we chose.\
To do this we will go thru all biomes and give them influence based on their
preferences.

```cs
[Export] float biome_transitions_smoothness;
private float GetInfluenceForTerrainAspect(FloatRange preferred, float value)
{
        return Mathf.SmoothStep(preferred.min - biome_transitions_smoothness, preferred.max, value)
                 * (1 - Mathf.SmoothStep(preferred.min, preferred.max + biome_transitions_smoothness, value));
}
```

Biome influence will be than normalized to make ground textures look uniform.
The output influence data will than be stored in a `BiomeInfluence` class.

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

The biome data will need to be later converted into a texture that will be used
by the gorund shader. For this I will create a special class named `TextureData`
that will handle this. It will also allow for easy readding of this data by code
that we will implement later.

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

Next we will need to combine all of the code that we've implemented. In the
`GenerateTextureData` funciton we will be generating terrain aspects with a
certain resoulution and that using this to generate biomes. The generrated data
will than be stored in array. Later create the `TextureData` with all the needed
data for it to work.

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

Now that we have generated the biome data we will need to assing in to the
ground shader.\
To do this we will implement a `GroundShaderController` class. It will not only
assign the biome texutres but also configure the whole shader. It will readd all
the data off biomes and combine it into arrays that the ground shader requiers.

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

## Using Generated Biome Data

Now let's just modify the `GenerationController` a tiny bit ot use the biome
generator and ground shdader controller.

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
+       [Export] int ground_mesh_resolution;
+       [Export] Biome[] biomes;
+       [Export] GroundShaderController ground_shader_controller;

        private void Run()
        {
                Vector2I base_world_pos = new(0, 0);
                var mesh_data = ground_mesh_gen.GenerateChunkData(ground_mesh_resolution, terrain_chunk_size, base_world_pos);
                ground_mesh_gen.ApplyData(mesh_data, mesh_instance, collider);
+               var biome_data = biome_generator.GenerateTextureData(base_world_pos, terrain_chunk_size, biomes);
+               ground_shader_controller.SetShaderConfiguration(biomes,[biome_data.GetTexture(0)],[biome_data.GetTexture(1)]);

        }

}
```

## Results

TODO: Add photos

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
