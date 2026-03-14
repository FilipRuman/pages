---
title: 4. general_imporvements
description: general_imporvements
---

# W

## Adding different terrain characteristics for biomes

Each biome type should have different properties for their terrain, for example:

- Highlands -> a lot of hills of different sizes.
- Flatlands -> mostly flat terrain.
- Desert -> has dunes of alternating heights.
- Mountains -> Have 'bumpy' terrain with rappid Height changes and big clifs,
  with valleys scatered around.

```cs
using Godot;
[Tool, GlobalClass]
public partial class Biome : Resource
{
    [Export] public NoiseComponent terrain_mesh_noise;
...
}
```

Now we will need to

```cs
///GroundMeshGen.cs

    private float CalculateHeight(Vector2 uv, Vector2 world_position, Biome[] biomes, BiomeGenerator.OutputData biome_data)
    {
        List<BiomeGenerator.OutputData.BiomeInfluenceOutput> biome_influences = biome_data.SampleBiomeDataForMesh(uv);
        var output = 0f;
        foreach (var biome_influence_data in biome_influences)
        {
            var biome = biomes[biome_influence_data.biome_type_index];
            output += biome.terrain_mesh_noise.Sample(world_position) * biome_influence_data.influence;
        }
        return output;
    }

    public void Run(Biome[] biomes, BiomeGenerator.OutputData biome_data, int size, Vector2 base_world_position, int resolution)
{

...
        var arrayMesh = GenerateTerrainMesh(biomes, biome_data, base_world_position, resolution);
...
}
    private ArrayMesh GenerateTerrainMesh(Biome[] biomes, BiomeGenerator.OutputData biome_data, Vector2 base_world_position, int resolution)
    {
...
        GenerateVertexes(st, biomes, biome_data, base_world_position, resolution);
...
    }

    private void GenerateVertexes(SurfaceTool st, Biome[] biomes, BiomeGenerator.OutputData biome_data, Vector2 base_world_position, int resolution)
    {
        for (uint relative_x = 0; relative_x < triangle_count_per_dimension; relative_x++)
        {
            for (uint relative_z = 0; relative_z < triangle_count_per_dimension; relative_z++)
            {

...
                float height = CalculateHeight(uv, world_pos, biomes, biome_data);

                st.AddVertex(new(world_pos.X, height, world_pos.Y));
            }
        }

    }
```

And now we need to just update the call to the mesh generator's function.

```cs
///TerrainGen.cs
    private void GenerateAll()
    {
        foreach (Vector2 chunk_relative_pos in chunk_relative_positions)
        {
...
            mesh_gen.Run(biomes, biome_data, chunk_size, chunk_world_position, ground_mesh_resolution);
....
        }
    }
```

## Biome Generation Rules
