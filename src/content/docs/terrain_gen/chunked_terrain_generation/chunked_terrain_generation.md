---
title: Chunked terrain generation
description: TODO
---

TODO: Add More Headers TODO: Add script path

The current terrain generation works pretty nicely but the map that we can
generate currently is very limited. We can't generate a very big map because it
will take a lot of time and will be very resource expensive. The best way to fix
this will be splitting the map into chunks and generating data for chunks on
separate threads. This is what I will be implementing on this page.

## Generating Chunk Data

Godot doesn't allow you to create nodes on the main thread. We could
theoretically
[create colliders and nodes on other threads but we can't do this with mesh instances or textures](https://docs.godotengine.org/en/stable/tutorials/performance/thread_safe_apis.html#doc-thread-safe-apis).
That's why I've decided to move all of these operation to the main thread for
the consistency sake. So we will need to generate data for chunks on multiple
threads and apply it on the main thread. The code that we were implementing was
designed in a way that will work perfectly fine on threads other than the main
one. Thanks to this we will only need to change the `GenerationController`
script.

We will start by creating a `GenerateDataForChunks` funciton that will take
chunk postions for whitch it will generate data. It will do this on multiple
threads without blocking the main thread by using:
`System.Threading.Tasks.Parallel.ForEachAsync`. Inside of the async code we will
place code that will generate the needed data(in the exact same way as on the
previous pages of this tutorial) and store it in the `ChunkData` struct. Than
this struct will be stored in a `ConcurrentQueue`, we need to do this because
multiple threads might be writing to it at the same time, and the main thread
will be reading from it.

:::note

We need to put all the async code in a try-catch block because otherwise any
excpetions won't be displayed as a error message in the terrminal.

:::

```cs
// GenerationController.cs
public struct ChunkData(GroundMeshGen.MeshData mesh_data, BiomeGenerator.TextureData biome, Vector2I world_pos)
{
        public GroundMeshGen.MeshData mesh_data = mesh_data;
        public BiomeGenerator.TextureData biome = biome;
        public Vector2I world_pos = world_pos;
}


Task chunk_data_generation_task;
ConcurrentQueue<ChunkData> chunk_instantiation_que = new();
private void GenerateDataForChunks(Vector2I[] chunks_to_generate, Vector2I player_pos_snapped_to_chunk)
{
        chunk_data_generation_task = Parallel.ForEachAsync(Enumerable.Range(0, chunks_to_generate.Length), async (i, _) =>
             {
                     try
                     {
                             var chunk = chunks_to_generate[i];
                             Vector2I chunk_world_position = chunk + player_pos_snapped_to_chunk;

                             var biome_data = biome_generator.GenerateTextureData(new Vector2(chunk_world_position.X, chunk_world_position.Y), terrain_chunk_size + 1, biomes);
                             var mesh_data = ground_mesh_gen.GenerateChunkData(chunk_world_position);
                             chunk_instantiation_que.Enqueue(new(mesh_data, biome_data, chunk_world_position));
                     }
                     catch (Exception e)
                     {
                             GD.PrintErr($"GenerateDataForChunks failed: {e}");
                     }
             });
}
```

Now we need to implement functions that will call the previous function with
chunks to generate. Let's start with the easiest condition- we want to generate
all chunks in the view distance of the player.

```cs
private void GenerateDataForAllChunks()
{
        var chunks_to_generate = ChunkChangeCalculator.GetAllChunksInViewDistance();
        GenerateDataForChunks([.. chunks_to_generate], last_player_chunk_grid_pos * terrain_chunk_size);
}
```

To get all chunks inside of a players view distance we will implement a separate
function. Let's place that funciotn in a separate script that will handle that
sort of computation.

```cs
///ChunkChangeCalculator.cs
private static int view_distance_chunks;
private static int terrain_chunk_size;

public static List<Vector2I> GetAllChunksInViewDistance()
{
        List<Vector2I> output = [];

        // could be pre-calculated once
        for (int x = -view_distance_chunks; x <= view_distance_chunks; x++)
        {
                for (int y = -view_distance_chunks; y <= view_distance_chunks; y++)
                {
                        if (x * x + y * y >= view_distance_chunks * view_distance_chunks)
                                continue;

                        output.Add(new Vector2I(x * terrain_chunk_size, y * terrain_chunk_size));
                }
        }

        return output;
}
```

Generating all chunks in the view distance is fine for initial map generation or
if the view distance is really small. If we want to generate a high quality
infinite terrain than we will need to only generate the chunks that where not
visible, and therefore generated, previously. To do this efficiently we will
generate at whitch player relative possitions we need to generate and destroy
chunks for each possible player position change.

:::note[Example]

If the player moves 1 terrain chunk size in the right direction than:

- Destroy chunks at the left most position: new player position - view distance
  -1

- Spawn new chunks at the right most position: new player postion +
  view_distance

:::

We will store precomputed data for all possible directions.
`CalculateChunkChangeForPosChange` function will be responsible for generating
what changes should happen for a player position change.

```cs
///ChunkChangeCalculator.cs
public struct ChunkChange(Vector2I[] chunks_to_destroy_relative_positions, Vector2I[] chunks_to_instantiate)
{
        public Vector2I[] to_destroy_relative_pos = chunks_to_destroy_relative_positions;
        public Vector2I[] to_generate_relative_pos = chunks_to_instantiate;
}
private static ChunkChange CalculateChunkChangeForPosChange(Vector2I delta)
{
        delta *= terrain_chunk_size;

        HashSet<Vector2I> old_chunk_pos = [.. GetAllChunksInViewDistance()];
        HashSet<Vector2I> new_chunk_pos = [.. old_chunk_pos.Select(pos => pos + delta)];

        var to_destroy = old_chunk_pos.Except(new_chunk_pos).ToArray();

        List<Vector2I> to_generate = [];
        foreach (var chunk in old_chunk_pos)
        {
                var new_pos = chunk + delta;
                if (!old_chunk_pos.Contains(new_pos))
                {
                        to_generate.Add(chunk);
                }
        }

        return new ChunkChange(to_destroy, [.. to_generate]);
}
```

:::note

We will assume that a player can move by 1 terrain chunk size in each
direction(including diagonal), for performance sake. For this to be true we need
to ensure that:

- Chunks are big enough
- Chunk generation is fast enough
- Player speed is reasonable

:::

Then we will create an initialize function that will call the previos funciton
for each of the possible position charges and store it's output in a dictionary
for fast access. It will also store some configuration data that functions that
we've already implemented use.

```cs
//ChunkChangeCalculator.cs
public static Dictionary<Vector2I, ChunkChange> chunk_change_for_position_delta = [];

public static void Init(int _view_distance_chunks, int _terrain_chunk_size)
{
        view_distance_chunks = _view_distance_chunks;
        terrain_chunk_size = _terrain_chunk_size; chunk_change_for_position_delta = [];
        Vector2I delta = new(-1, 0);
        chunk_change_for_position_delta.Add(delta, CalculateChunkChangeForPosChange(delta));
        delta = new(-1, 1);
        chunk_change_for_position_delta.Add(delta, CalculateChunkChangeForPosChange(delta));
        delta = new(0, 1);
        chunk_change_for_position_delta.Add(delta, CalculateChunkChangeForPosChange(delta));
        delta = new(1, 1);
        chunk_change_for_position_delta.Add(delta, CalculateChunkChangeForPosChange(delta));
        delta = new(1, 0);
        chunk_change_for_position_delta.Add(delta, CalculateChunkChangeForPosChange(delta));
        delta = new(1, -1);
        chunk_change_for_position_delta.Add(delta, CalculateChunkChangeForPosChange(delta));
        delta = new(0, -1);
        chunk_change_for_position_delta.Add(delta, CalculateChunkChangeForPosChange(delta));
        delta = new(-1, -1);
        chunk_change_for_position_delta.Add(delta, CalculateChunkChangeForPosChange(delta));
}
```

<details>
<summary> Contents of the ChunkChangeCalculator.cs file </summary>

```cs
//ChunkChangeCalculator.cs
using System.Collections.Generic;
using System.Linq;
using Godot;
public static class ChunkChangeCalculator
{
        public struct ChunkChange(Vector2I[] chunks_to_destroy_relative_positions, Vector2I[] chunks_to_instantiate)
        {
                public Vector2I[] to_destroy_relative_pos = chunks_to_destroy_relative_positions;
                public Vector2I[] to_generate_relative_pos = chunks_to_instantiate;
        }
        private static ChunkChange CalculateChunkChangeForPosChange(Vector2I delta)
        {
                delta *= terrain_chunk_size;

                HashSet<Vector2I> old_chunk_pos = [.. GetAllChunksInViewDistance()];
                HashSet<Vector2I> new_chunk_pos = [.. old_chunk_pos.Select(pos => pos + delta)];

                var to_destroy = old_chunk_pos.Except(new_chunk_pos).ToArray();

                List<Vector2I> to_generate = [];
                foreach (var chunk in old_chunk_pos)
                {
                        var new_pos = chunk + delta;
                        if (!old_chunk_pos.Contains(new_pos))
                        {
                                to_generate.Add(chunk);
                        }
                }

                return new ChunkChange(to_destroy, [.. to_generate]);
        }

        private static int view_distance_chunks;
        private static int terrain_chunk_size;

        public static List<Vector2I> GetAllChunksInViewDistance()
        {
                List<Vector2I> output = [];

                // could be pre-calculated once
                for (int x = -view_distance_chunks; x <= view_distance_chunks; x++)
                {
                        for (int y = -view_distance_chunks; y <= view_distance_chunks; y++)
                        {
                                if (x * x + y * y >= view_distance_chunks * view_distance_chunks)
                                        continue;

                                output.Add(new Vector2I(x * terrain_chunk_size, y * terrain_chunk_size));
                        }
                }

                return output;
        }
        public static Dictionary<Vector2I, ChunkChange> chunk_change_for_position_delta = [];

        public static void Init(int _view_distance_chunks, int _terrain_chunk_size)
        {
                view_distance_chunks = _view_distance_chunks;
                terrain_chunk_size = _terrain_chunk_size; chunk_change_for_position_delta = [];
                Vector2I delta = new(-1, 0);
                chunk_change_for_position_delta.Add(delta, CalculateChunkChangeForPosChange(delta));
                delta = new(-1, 1);
                chunk_change_for_position_delta.Add(delta, CalculateChunkChangeForPosChange(delta));
                delta = new(0, 1);
                chunk_change_for_position_delta.Add(delta, CalculateChunkChangeForPosChange(delta));
                delta = new(1, 1);
                chunk_change_for_position_delta.Add(delta, CalculateChunkChangeForPosChange(delta));
                delta = new(1, 0);
                chunk_change_for_position_delta.Add(delta, CalculateChunkChangeForPosChange(delta));
                delta = new(1, -1);
                chunk_change_for_position_delta.Add(delta, CalculateChunkChangeForPosChange(delta));
                delta = new(0, -1);
                chunk_change_for_position_delta.Add(delta, CalculateChunkChangeForPosChange(delta));
                delta = new(-1, -1);
                chunk_change_for_position_delta.Add(delta, CalculateChunkChangeForPosChange(delta));
        }
}
```

</details>

Before implementing any othe funcitons we will need to implement funciotns that
will clean all of the debree and run initialize eaverything. We will need a
function for cleaning because if we encounter any errors during the runtime than
we can just clear eaverything and start from the beggining without trowing any
exceptions.

```cs
        /// When you want to change you need to also change the value in the ground shader 
        const int max_chunk_data_textures_count = 517;
        private void ClearAll()
        {
                free_biome_texture_slots = new(Enumerable.Range(0, max_chunk_data_textures_count));
                biome_textures_channel_1 = new ImageTexture[max_chunk_data_textures_count];
                biome_textures_channel_2 = new ImageTexture[max_chunk_data_textures_count];

                chunk_per_world_position = [];

                foreach (var child in GetChildren())
                {
                        child.QueueFree();
                }
        }
```

The `RunClean` funciton will use the clear all funciton and than initialize all
scritps that need initialization and than run the initiali terrain generation by
generating data for all visible chunks.

```cs
private void RunClean()
{
        ClearAll();
        if (max_chunk_data_textures_count != ChunkChangeCalculator.GetAllChunksInViewDistance().Count)
        {
                GD.PushWarning("The max amount of chunk data textures is not equal to the chunk data textures that are generated.\n" +
                        "This is not optimal and could cause chunks biomes to stop working:\n" +
                        $"current:{max_chunk_data_textures_count} optimal:{ChunkChangeCalculator.GetAllChunksInViewDistance().Count}");
        }

        ground_mesh_gen.Initialize(terrain_chunk_size);
        ground_shader_controller.SetShaderConfiguration(biomes);
        ChunkChangeCalculator.Init(view_distance_chunks, terrain_chunk_size);

        GenerateDataForAllChunks();
}
```

Next we will finally implement a fuction that will only generate chunks that
were not generated previously. We it will need to first check if it should run
at all:

- asyn generation task isn't already running in the background.
- all chunks have been instantiated from the que.

If all of the above is true than we can run the actuall code. This function will
also be a greate place to put call to the `ground_shader_controller` function.
Placeing it here will ensure that it will be run only when the data from the
previous generation task was applied. Than we just calculate the amout that the
player moved from the previous check. Knowing the position delta we can get
chunks that we need to change by accessing the:
`ChunkChangeCalculator.chunk_change_for_position_delta`.

:::warn

If there is not a value for the caluclated player position delta than this means
most likely that the player has moved by more the terrain chunk size from the
previous check. In this case we will regenerate the whole terrain in this
tutorial. This is not the most efficient way but this shouldn't ever happen
enyway so I've chosen the simplest way to fix this error.

:::

After we know what chunks changed we just use this knowlage to destroy chunks
that we don't need and generate data for the new chunks.

```cs
Vector2I WorldToTerrainChunkGridPos(Vector2 world_pos)
{
        return new Vector2I(Mathf.RoundToInt(world_pos.X / terrain_chunk_size), Mathf.RoundToInt(world_pos.Y / terrain_chunk_size));
}

Dictionary<Vector2I, Chunk> chunk_per_world_position;
Vector2I last_player_chunk_grid_pos;
private void ChunkDataGeneration()
{

        // This could happen after building the project in the godot editor while the generation  process is running
        if (chunk_data_generation_task == null)
        {
                ClearAll();
                GenerateDataForAllChunks();
        }

        if (!chunk_data_generation_task.IsCompleted || !chunk_instantiation_que.IsEmpty)
        {
                return;
        }

        // Update only once all chunks from the previous batch have been generated / destroyed  
        ground_shader_controller.UpdateTheBiomeTextures(biome_textures_channel_1, biome_textures_channel_2);

        Vector2 player_pos = new(player.Position.X, player.Position.Z);
        var current_player_chunk_grid_pos = WorldToTerrainChunkGridPos(player_pos);

        if (last_player_chunk_grid_pos == current_player_chunk_grid_pos)
        {
                return;
        }
        var grid_pos_delta = current_player_chunk_grid_pos - last_player_chunk_grid_pos;

        if (!ChunkChangeCalculator.chunk_change_for_position_delta.TryGetValue(grid_pos_delta, out var chunk_change))
        {
                GD.PushWarning("The position of player changed by more than a 1 chunk size which is not supported. Regenerating the whole terrain.");

                last_player_chunk_grid_pos = current_player_chunk_grid_pos;
                ClearAll();
                GenerateDataForAllChunks();
                return;
        }


        DestroyChunks(chunk_change.to_destroy_relative_pos);
        GenerateDataForChunks(chunk_change.to_generate_relative_pos, current_player_chunk_grid_pos * terrain_chunk_size);
        last_player_chunk_grid_pos = current_player_chunk_grid_pos;
}
```

To destroy a chunk we will need to:

1. Using the `chunk_per_world_position` access the chunk's node.
2. Remove the chunk posstion from the `free_biome_texture_slots`(I will write
   about it shortly) and `chunk_per_world_position`.
3. Destroy the node by using `QueueFree`.

```cs
        private void DestroyChunks(Vector2I[] chunks_to_destroy)
        {
                foreach (var chunk_relative_pos in chunks_to_destroy)
                {
                        Vector2I chunk_world_position = chunk_relative_pos + last_player_chunk_grid_pos * terrain_chunk_size;

                        if (!chunk_per_world_position.TryGetValue(chunk_world_position, out var chunk))
                        {
                                GD.PushWarning("There was already a chunk in the dictionary at this position. This either indicates a but in the logic of this program or the player did some crazy movements. Regenerating the whole terrain.");

                                ClearAll();
                                GenerateDataForAllChunks();
                                return;
                        }

                        free_biome_texture_slots.Enqueue(chunk.biome_map_index);
                        chunk.QueueFree();
                        chunk_per_world_position.Remove(chunk_world_position);
                }

        }
```

Now we need to implement code that will receve the generated chunk data and use
it to instantiate and configure new chunks. `InstantiateChunksFromQue` funciton
will deque chunk data and call the `InstantiateChunk` function. The maximal
amount of instantiated chunks per frame will be limited to avoid lag spikes when
generating new terrain. The `InstantiateChunk` function will instantiate chunks
in the same way as before but we will need to:

1. add it's possition to `chunk_per_world_position` dictionary so that we can
   later destroy/modify this chunk.
2. find free 'slot' for storing biome data texture for this chunk. To do this we
   will use the `free_biome_texture_slots` que. It will have all aviable
   indexes, and we will just deque the first aviable one. When a chunk gets
   destroyed we will just put it's slot index back in the que.

```cs
        [Export] int max_main_thread_chunk_instantiation_per_frame;

        private void InstantiateChunksFromQue()
        {
                int processed = 0;
                while (processed < max_main_thread_chunk_instantiation_per_frame && chunk_instantiation_que.TryDequeue(out var chunk_data))
                {
                        InstantiateChunk(chunk_data);
                        processed++;
                }
        }

        Queue<int> free_biome_texture_slots;
        ImageTexture[] biome_textures_channel_1;
        ImageTexture[] biome_textures_channel_2;
        private void InstantiateChunk(ChunkData chunk_data)
        {

                var chunk = (Chunk)chunk_prefab.Instantiate();
                chunk_per_world_position.Add(chunk_data.world_pos, chunk);

                AddChild(chunk);
                ground_mesh_gen.ApplyData(chunk_data.mesh_data, chunk.mesh_instance, chunk.collider);

                int map_index = free_biome_texture_slots.Dequeue();
                chunk.biome_map_index = map_index;
                biome_textures_channel_1[map_index] = chunk_data.biome.GetTexture(0);
                biome_textures_channel_2[map_index] = chunk_data.biome.GetTexture(1);
                chunk.mesh_instance.SetInstanceShaderParameter("biome_texture_index", map_index);
        }
```

At latst just call `ChunkDataGeneration` and `InstantiateChunksFromQue`
functions in the `_Process` function so they are run eavery frame. In the
`_Ready` funciton check if we are currently in the edditor, if not we need to
initialize the terrain generation by running the `RunClean` function.

```cs
        public override void _Ready()
        {
                if (!Engine.IsEditorHint())
                        RunClean();
        }

        public override void _Process(double delta)
        {
                ChunkDataGeneration();
                InstantiateChunksFromQue();
        }
```

### Final Resoults

TODO: ADD Photos of the generated terrain

<details>
<summary> Contents of the GenerationController.cs file </summary>

```cs
//GenerationController.cs
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Godot;
[Tool]
public partial class GenerationController : Node
{
        [ExportToolButton("Run")] private Callable RunButton => Callable.From(RunClean);
        [Export] int terrain_chunk_size;
        [Export] Biome[] biomes;
        [Export] int max_main_thread_chunk_instantiation_per_frame;

        [ExportGroup("player")]
        [Export] Vector2 player_pos_offset;
        [Export] Node3D player;
        [Export] int view_distance_chunks;

        [ExportCategory("references")]
        [Export] PackedScene chunk_prefab;
        [Export] GroundMeshGen ground_mesh_gen;
        [Export] BiomeGenerator biome_generator;
        [Export] GroundShaderController ground_shader_controller;


        public override void _Ready()
        {
                if (!Engine.IsEditorHint())
                        RunClean();
        }

        /// When you want to change you need to also change the value in the ground shader 
        const int max_chunk_data_textures_count = 517;
        public override void _Process(double delta)
        {
                ChunkDataGeneration();

                InstantiateChunksFromQue();
        }
        private void DestroyChunks(Vector2I[] chunks_to_destroy)
        {
                foreach (var chunk_relative_pos in chunks_to_destroy)
                {
                        Vector2I chunk_world_position = chunk_relative_pos + last_player_chunk_grid_pos * terrain_chunk_size;

                        if (!chunk_per_world_position.TryGetValue(chunk_world_position, out var chunk))
                        {
                                GD.PushWarning("There was already a chunk in the dictionary at this position. This either indicates a but in the logic of this program or the player did some crazy movements. Regenerating the whole terrain.");

                                ClearAll();
                                GenerateDataForAllChunks();
                                return;
                        }

                        free_biome_texture_slots.Enqueue(chunk.biome_map_index);
                        chunk.QueueFree();
                        chunk_per_world_position.Remove(chunk_world_position);
                }

        }

        private void RunClean()
        {
                ClearAll();
                if (max_chunk_data_textures_count != ChunkChangeCalculator.GetAllChunksInViewDistance().Count)
                {
                        GD.PushWarning("The max amount of chunk data textures is not equal to the chunk data textures that are generated.\n" +
                                "This is not optimal and could cause chunks biomes to stop working:\n" +
                                $"current:{max_chunk_data_textures_count} optimal:{ChunkChangeCalculator.GetAllChunksInViewDistance().Count}");
                }

                ground_mesh_gen.Initialize(terrain_chunk_size);
                ground_shader_controller.SetShaderConfiguration(biomes);
                ChunkChangeCalculator.Init(view_distance_chunks, terrain_chunk_size);

                GenerateDataForAllChunks();
        }

        public struct ChunkData(GroundMeshGen.MeshData mesh_data, BiomeGenerator.TextureData biome, Vector2I world_pos)
        {
                public GroundMeshGen.MeshData mesh_data = mesh_data;
                public BiomeGenerator.TextureData biome = biome;
                public Vector2I world_pos = world_pos;
        }

        Vector2I WorldToTerrainChunkGridPos(Vector2 world_pos)
        {
                return new Vector2I(Mathf.RoundToInt(world_pos.X / terrain_chunk_size), Mathf.RoundToInt(world_pos.Y / terrain_chunk_size));
        }
        Dictionary<Vector2I, Chunk> chunk_per_world_position;

        Vector2I last_player_chunk_grid_pos;
        private void ChunkDataGeneration()
        {

                // This could happen after building the project in the godot editor while the generation  process is running
                if (chunk_data_generation_task == null)
                {
                        ClearAll();
                        GenerateDataForAllChunks();
                }

                if (!chunk_data_generation_task.IsCompleted || !chunk_instantiation_que.IsEmpty)
                {
                        return;
                }

                // Update only once all chunks from the previous batch have been generated / destroyed  
                ground_shader_controller.UpdateTheBiomeTextures(biome_textures_channel_1, biome_textures_channel_2);

                Vector2 player_pos = new(player.Position.X, player.Position.Z);

                var current_player_chunk_grid_pos = WorldToTerrainChunkGridPos(player_pos);

                if (last_player_chunk_grid_pos == current_player_chunk_grid_pos)
                {
                        return;
                }
                var grid_pos_delta = current_player_chunk_grid_pos - last_player_chunk_grid_pos;

                if (!ChunkChangeCalculator.chunk_change_for_position_delta.TryGetValue(grid_pos_delta, out var chunk_change))
                {
                        GD.PushWarning("The position of player changed by more than a 1 chunk size which is not supported. Regenerating the whole terrain.");

                        last_player_chunk_grid_pos = current_player_chunk_grid_pos;
                        ClearAll();
                        GenerateDataForAllChunks();
                        return;
                }


                DestroyChunks(chunk_change.to_destroy_relative_pos);
                GenerateDataForChunks(chunk_change.to_generate_relative_pos, current_player_chunk_grid_pos * terrain_chunk_size);
                last_player_chunk_grid_pos = current_player_chunk_grid_pos;
        }
        private void GenerateDataForAllChunks()
        {
                var chunks_to_generate = ChunkChangeCalculator.GetAllChunksInViewDistance();
                GenerateDataForChunks([.. chunks_to_generate], last_player_chunk_grid_pos * terrain_chunk_size);
        }

        Task chunk_data_generation_task;
        ConcurrentQueue<ChunkData> chunk_instantiation_que = new();
        private void GenerateDataForChunks(Vector2I[] chunks_to_generate, Vector2I player_pos_snapped_to_chunk)
        {
                chunk_data_generation_task = Parallel.ForEachAsync(Enumerable.Range(0, chunks_to_generate.Length), async (i, _) =>
                     {
                             try
                             {
                                     var chunk = chunks_to_generate[i];
                                     Vector2I chunk_world_position = chunk + player_pos_snapped_to_chunk;

                                     var biome_data = biome_generator.GenerateTextureData(new Vector2(chunk_world_position.X, chunk_world_position.Y), terrain_chunk_size + 1, biomes);
                                     var mesh_data = ground_mesh_gen.GenerateChunkData(chunk_world_position);
                                     chunk_instantiation_que.Enqueue(new(mesh_data, biome_data, chunk_world_position));
                             }
                             catch (Exception e)
                             {
                                     GD.PrintErr($"GenerateDataForChunks failed: {e}");
                             }
                     });
        }
        private void InstantiateChunksFromQue()
        {
                int processed = 0;
                while (processed < max_main_thread_chunk_instantiation_per_frame && chunk_instantiation_que.TryDequeue(out var chunk_data))
                {
                        InstantiateChunk(chunk_data);
                        processed++;
                }
        }

        Queue<int> free_biome_texture_slots;
        ImageTexture[] biome_textures_channel_1;
        ImageTexture[] biome_textures_channel_2;
        private void InstantiateChunk(ChunkData chunk_data)
        {

                var chunk = (Chunk)chunk_prefab.Instantiate();
                chunk_per_world_position.Add(chunk_data.world_pos, chunk);

                AddChild(chunk);
                ground_mesh_gen.ApplyData(chunk_data.mesh_data, chunk.mesh_instance, chunk.collider);

                int map_index = free_biome_texture_slots.Dequeue();
                chunk.biome_map_index = map_index;
                biome_textures_channel_1[map_index] = chunk_data.biome.GetTexture(0);
                biome_textures_channel_2[map_index] = chunk_data.biome.GetTexture(1);
                chunk.mesh_instance.SetInstanceShaderParameter("biome_texture_index", map_index);
        }
        private void ClearAll()
        {
                free_biome_texture_slots = new(Enumerable.Range(0, max_chunk_data_textures_count));
                biome_textures_channel_1 = new ImageTexture[max_chunk_data_textures_count];
                biome_textures_channel_2 = new ImageTexture[max_chunk_data_textures_count];

                chunk_per_world_position = [];

                foreach (var child in GetChildren())
                {
                        child.QueueFree();
                }
        }
}
```

</details>

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
        data-term="chunked terrain generation"
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
