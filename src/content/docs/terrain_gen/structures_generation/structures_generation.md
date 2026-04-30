---
title: Structures generation
description: structures generation
---

TODO: Add title TODO: Update code

## Implementation Considerations

On the previous page we've implemented a way to generate small objects like
trees or grass.That code works great to quickly generate larege amounts for
small objects. To generate large structures we will need to take may different
choices while implementing the structures generation algorightm than when
implementing it for small objects.

1. Implement a way to check during generation, if an object collides with a
   structure. This will be needed for all types of objects.
2. Ensure that structures only generate on flat enough terrain

## Implementing Data Structures Needed for Generation

First of all we need a class that will allow us to configure structure
generation in the editor. It needs some basic generation data, model's
`PackedScene` as well as the structure's shapes array.

The strucutre's shapes will be needed for declearing at what distance from the
structure any objects shouldn't be generated. The space inside of the shapes
will also be sampled for height differences, if the terrain is too uneven then
the structure may not be generated there.

This implementation will use a `IStructureShape` interface to allow to easily
implement many different structures shapes without changing any code.

We only need to decleare 2 fucntions in it. They will take a class named
`StructureInstanceData` that will hold data about the instance of the structure
that this shape is for. This is needed becuase the transform data of this shape
will afect the area that this shape covers.

```cs
using System.Collections.Generic;
using Godot;

public interface IStructureShape
{
        public List<Vector2> GetSampleWorldPosPointsInsideTheShape(StructureInstanceData instance_data);
        public bool IsPointWithinTheShape(Vector2 point, StructureInstanceData instance_data);
}
```

Sadly the Godot's editor doesn't allow you to export classes by implementation
of the interface. This means that we will just export a
`[Export] public Resource[] shapes;` and later convert it's values into the
needed interface. This is slightly inconvenient because the Godot editor will
show us all public types implementing the `Resource` interface when selecting a
shape class in the editor, but this implementation will give us the most
customization.

```cs
using Godot;
[Tool, GlobalClass]
public partial class StructureType : Resource
{
        /// all should implement: IStructureShape
        [Export] public Resource[] shapes;
        [Export] public float maximal_height_delta_inside_the_shapes;
        [Export(PropertyHint.Range, "0,1,0.001")] public float spawn_chance;
        [Export] public PackedScene model;
        [Export] public float base_scale;
        [Export] public float scale_change_amplitude;
        [Export] public int min_distance_from_grid_border_in_mesh_chunks;
        [Export] public int generation_attempts_per_structure_chunk;
}
```

Rectangle shape is both really usefull and hard to implement that's why I've
chosen it as an example for this tutorial. We need to apply scaleing and
rotation from the parent structure instance to this rectangle.

```cs
using System.Collections.Generic;
using Godot;
[GlobalClass, Tool]
public partial class RectangleStructureShape : Resource, IStructureShape
{
        [Export] public Vector2 base_size;
        [Export] public float base_rotation_y;
        [Export] public Vector2 base_offset;
        [Export] public float sample_points_spacing;

        public List<Vector2> GetSampleWorldPosPointsInsideTheShape(StructureInstanceData instance_data)
        {
                var points = new List<Vector2>();

                // Get actual size and rotation from instance data
                Vector2 size = base_size * instance_data.scale;
                float rotation_rad = Mathf.DegToRad(base_rotation_y + instance_data.rotation_y);
                Vector2 offset = base_offset + instance_data.base_world_pos;

                // Calculate how many samples we need in each dimension
                int countX = Mathf.Max(1, Mathf.CeilToInt(size.X / sample_points_spacing));
                int countY = Mathf.Max(1, Mathf.CeilToInt(size.Y / sample_points_spacing));

                // Adjust spacing to fit evenly
                float actualSpacingX = size.X / countX;
                float actualSpacingY = size.Y / countY;

                // Generate points in local space
                for (int x = 0; x <= countX; x++)
                {
                        for (int y = 0; y <= countY; y++)
                        {
                                // Local point centered at origin
                                Vector2 localPoint = new(
                                    x * actualSpacingX - size.X / 2f,
                                    y * actualSpacingY - size.Y / 2f
                                );

                                // Apply rotation
                                Vector2 rotatedPoint = localPoint.Rotated(rotation_rad);

                                // Apply offset
                                points.Add(rotatedPoint + offset);
                        }
                }

                return points;
        }

        public bool IsPointWithinTheShape(Vector2 world_pos, StructureInstanceData instance_data)
        {
                // Get actual size and rotation from instance data
                Vector2 size = base_size * instance_data.scale;
                float rotation_rad = Mathf.DegToRad(base_rotation_y + instance_data.rotation_y);
                Vector2 offset = base_offset + instance_data.base_world_pos;

                // Transform point to local space (inverse of the rectangle's transform)
                Vector2 localPoint = (world_pos - offset).Rotated(-rotation_rad);

                // Check if point is within the axis-aligned bounds
                return Mathf.Abs(localPoint.X) <= size.X / 2f &&
                       Mathf.Abs(localPoint.Y) <= size.Y / 2f;
        }
}
```

`StructureInstanceData` class was used many times before and now it's the time
to implement it. This class will need to hold it's `StructureType`, and
transform- separated into convenient variables. It will also have couple
convenient functions using the structure type's shaped and a functions to
Instantiate this instance as a Godot node.

```cs
using System.Collections.Generic;
using Godot;
public class StructureInstanceData(Vector2 base_world_pos, float scale, float rotation_y, StructureType structure_type)
{
        public Vector2 base_world_pos = base_world_pos;
        public float base_height;
        public float scale = scale;
        public float rotation_y = rotation_y;
        public StructureType structure_type = structure_type;

        public void Instantiate(Node3D parent)
        {
                var node = (Node3D)structure_type.model.Instantiate();
                parent.AddChild(node);
                node.Scale = Vector3.One * scale;
                node.RotationDegrees = new Vector3(0, rotation_y, 0);
                node.Position = new(base_world_pos.X, base_height, base_world_pos.Y);
        }

        public HashSet<Vector2I> MeshChunksThisStructureSitsOnWorldPos(int mesh_chunk_size)
        {
                HashSet<Vector2I> chunks = [];
                foreach (var shape in structure_type.shapes)
                {
                        foreach (var point in ((IStructureShape)shape).GetSampleWorldPosPointsInsideTheShape(this))
                        {

                                Vector2I chunk = new(Mathf.RoundToInt(point.X / mesh_chunk_size) + 1, Mathf.FloorToInt(point.Y / mesh_chunk_size) + 1);
                                Vector2I chunk_world_pos = chunk * mesh_chunk_size;
                                chunks.Add(chunk_world_pos);
                        }
                }
                return chunks;
        }
        public bool IsObjectColliding(Vector2I world_pos)
        {
                foreach (var shape in structure_type.shapes)
                {
                        if (((IStructureShape)shape).IsPointWithinTheShape(world_pos, this))
                                return true;
                }
                return false;
        }
        public List<Vector2> GetSampleWorldPosPointsInsideThisStructure()
        {
                List<Vector2> output = [];
                foreach (var shape in structure_type.shapes)
                {
                        output.AddRange(((IStructureShape)shape).GetSampleWorldPosPointsInsideTheShape(this));
                }

                return output;
        }

        public bool IsValid(GroundMeshGen mesh_gen)
        {
                var min_height = float.MaxValue;
                var max_height = float.MinValue;
                foreach (var shape in structure_type.shapes)
                {
                        var i_structure_shape = (IStructureShape)shape;
                        var test_points = i_structure_shape.GetSampleWorldPosPointsInsideTheShape(this);


                        foreach (var point in test_points)
                        {
                                var height = mesh_gen.CalculateHeight(point, out _);
                                min_height = Mathf.Min(height, min_height);
                                max_height = Mathf.Max(height, max_height);
                        }
                        if (max_height - min_height > structure_type.maximal_height_delta_inside_the_shapes)
                                return false;
                }

                return true;
        }

}
```

## Generating Structure Data

Because we are implementing an infinite terrain we will need to implement a grid
strucutre to store the strucutre generation data. Each `StructureChunk` will
hold data for several terrain chunks. it will hold separate data for structure
instantiation, and collisions because one structure might collide with
objects/structures on multiple terrain chunks depending on it's transform, and
the terrain chunk size.

```cs
/// StructureGen.cs
public class StructureChunk(Dictionary<Vector2I, StructureInstanceData> structure_collision_dict_terrain_chunk_world_pos, Dictionary<Vector2I, StructureInstanceData> structure_instantiation_dict_terrain_chunk_world_pos)
{
        public Dictionary<Vector2I, StructureInstanceData> structure_collision_dict_terrain_chunk_world_pos = structure_collision_dict_terrain_chunk_world_pos;
        public Dictionary<Vector2I, StructureInstanceData> structure_instantiation_dict_terrain_chunk_world_pos = structure_instantiation_dict_terrain_chunk_world_pos;
}
```

a strucutre Grid class will hold a grid of `StructureChunk`s and update it upon
player movement.

```cs
/// StructureGen.cs
public class StructureGrid
{
        const int grid_width = 3;
        readonly StructureChunk[] grid;
        private Vector2I current_player_grid_pos;

        private readonly int grid_cell_size;
        private readonly StructureGen structure_gen;
        private readonly GroundMeshGen mesh_gen;
        private readonly int mesh_chunk_size;
}
```

To generate a `StructureChunk` we will need to do this for each structure type
that we want to generate:

```cs
if (structure_type.spawn_chance < GD.Randf())
        continue;
```

1. Randomly discard some structures based on the spawn chance

```cs
Vector2I base_chunk_world_pos;
{
        var mesh_chunk_x = GD.RandRange(structure_type.min_distance_from_grid_border_in_mesh_chunks,
        structure_gen.mesh_chunks_per_structure_grid_cell - structure_type.min_distance_from_grid_border_in_mesh_chunks);
        var mesh_chunk_y = GD.RandRange(structure_type.min_distance_from_grid_border_in_mesh_chunks,
        structure_gen.mesh_chunks_per_structure_grid_cell - structure_type.min_distance_from_grid_border_in_mesh_chunks);
        base_chunk_world_pos = new Vector2I(mesh_chunk_x, mesh_chunk_y) * mesh_chunk_size + base_world_pos;
}
```

2. Generate a random position in the structure chunk

```cs
private StructureInstanceData GenerateRandomStructureInstance(StructureType structure_type, Vector2I base_chunk_world_pos)
{
        var structure_world_pos = new Vector2(GD.Randf(), GD.Randf()) * mesh_chunk_size + base_chunk_world_pos;
        var structure_rotation = GD.Randf() * 360f;
        var structure_scale = structure_type.base_scale + (GD.Randf() * 2 - 1) * structure_type.scale_change_amplitude;
        var base_height = mesh_gen.CalculateHeight(structure_world_pos, out _);

        return new StructureInstanceData(structure_world_pos, structure_scale, structure_rotation, base_height, structure_type);
}
```

3. Create a new structure instance with random transform data

```cs
var collision_chunks = structure_instance.MeshChunksThisStructureSitsOnWorldPos(mesh_chunk_size);
```

4. Calculate at what terrain chunks this structure will sit on and using this
   data:
   - Check if there is a structure on one of the chunks already- if so discard
     this positon
   - Register in a dictionary that a structure is sitting on those chunks

5. Add a new structure instance to special dictionary
6. Repeat previous steps `StructureType.generation_attempts_per_structure_chunk`
   times
7. Finally collect all the data into a `StructureChunk`

```cs
//StructureGen.cs
        public class StructureGrid
        {
        ...

                private StructureInstanceData GenerateRandomStructureInstance(StructureType structure_type, Vector2I base_chunk_world_pos)
                {
                        var structure_world_pos = new Vector2(GD.Randf(), GD.Randf()) * mesh_chunk_size + base_chunk_world_pos;
                        var structure_rotation = GD.Randf() * 360f;
                        var structure_scale = structure_type.base_scale + (GD.Randf() * 2 - 1) * structure_type.scale_change_amplitude;
                        var base_height = mesh_gen.CalculateHeight(structure_world_pos, out _);

                        return new StructureInstanceData(structure_world_pos, structure_scale, structure_rotation, base_height, structure_type);
                }
                private bool IsStructureValid(StructureInstanceData structure_instance, HashSet<Vector2I> collision_chunks,
                    Dictionary<Vector2I, StructureInstanceData> structure_collision_dict_terrain_chunk_world_pos)
                {

                        if (!structure_instance.IsValid(mesh_gen))
                                return false;
                        bool there_already_was_struct_on_one_of_the_chunks = false;
                        foreach (var chunk_world_pos in collision_chunks)
                        {
                                if (structure_collision_dict_terrain_chunk_world_pos.ContainsKey(chunk_world_pos))
                                {
                                        there_already_was_struct_on_one_of_the_chunks = true;
                                        break;
                                }
                        }
                        return there_already_was_struct_on_one_of_the_chunks;
                }

                public StructureChunk GenerateStructureChunk(Vector2I base_world_pos)
                {
                        Dictionary<Vector2I, StructureInstanceData> structure_instantiation_dict_terrain_chunk_world_pos = [];
                        Dictionary<Vector2I, StructureInstanceData> structure_collision_dict_terrain_chunk_world_pos = [];
                        RNG.SetGDRandomSeed(base_world_pos);
                        foreach (var structure_type in structure_gen.structure_pool)
                        {
                                if (structure_gen.mesh_chunks_per_structure_grid_cell < 2 * structure_type.min_distance_from_grid_border_in_mesh_chunks)
                                        GD.PrintErr("structure_gen.mesh_chunks_per_structure_grid_cell has to ge at least 2x the structure_type.min_distance_from_grid_border_in_mesh_chunks.");

                                for (int i = 0; i < structure_type.generation_attempts_per_structure_chunk; i++)
                                {

                                        if (structure_type.spawn_chance < GD.Randf())
                                                continue;

                                        Vector2I base_chunk_world_pos;
                                        {
                                                var mesh_chunk_x = GD.RandRange(structure_type.min_distance_from_grid_border_in_mesh_chunks,
                                                    structure_gen.mesh_chunks_per_structure_grid_cell - structure_type.min_distance_from_grid_border_in_mesh_chunks);
                                                var mesh_chunk_y = GD.RandRange(structure_type.min_distance_from_grid_border_in_mesh_chunks,
                                                    structure_gen.mesh_chunks_per_structure_grid_cell - structure_type.min_distance_from_grid_border_in_mesh_chunks);
                                                base_chunk_world_pos = new Vector2I(mesh_chunk_x, mesh_chunk_y) * mesh_chunk_size + base_world_pos;
                                        }

                                        var structure_instance = GenerateRandomStructureInstance(structure_type, base_chunk_world_pos);
                                        var collision_chunks = structure_instance.MeshChunksThisStructureSitsOnWorldPos(mesh_chunk_size);
                                        if (!IsStructureValid(structure_instance, collision_chunks, structure_collision_dict_terrain_chunk_world_pos))
                                                continue;
                                        foreach (var chunk_world_pos in collision_chunks)
                                        {
                                                structure_collision_dict_terrain_chunk_world_pos.Add(chunk_world_pos, structure_instance);
                                        }

                                        structure_instantiation_dict_terrain_chunk_world_pos.Add(base_chunk_world_pos, structure_instance);

                                }
                        }
                        return new(structure_collision_dict_terrain_chunk_world_pos, structure_instantiation_dict_terrain_chunk_world_pos);
                }
        }
```

`StructureGrid[]` will be used to get a `StructureChunk` from the
`StructureGrid` by inputting a world position.

```cs
//StructureGen.cs

public class StructureGrid
{
        public StructureChunk this[Vector2I world_pos]
        {
                get
                {
                        var global_grid_pos = world_pos / grid_cell_size;
                        var relative_grid_pos = global_grid_pos - current_player_grid_pos;
                        return grid[relative_grid_pos.X + 1 + (relative_grid_pos.Y + 1) * grid_width];
                }
        
        }
}
```

`StructureGrid` clss will implement a handy function that will use it's data to
tell wether a object can be placed at a certain point or will it collide with a
structure. It will ues `this[]` to get a structure chunk that this point lies on
and next it will get a structure that in placed on the needed terrain chunk.
Having the sturecture instance we can just call the
`StructureInstanceData.IsObjectColliding`

```cs
        public class StructureGrid
        {
                public bool IsObjectValid(Vector2 world_pos_f)
                {
                        Vector2I world_pos = (Vector2I)world_pos_f;
                        var chunk_pos = world_pos / mesh_chunk_size;
                        var chunk_world_pos = chunk_pos * mesh_chunk_size;



                        if (!this[world_pos].structure_collision_dict_terrain_chunk_world_pos.TryGetValue(chunk_world_pos, out var structure))
                                return true;

                        return !structure.IsObjectColliding(world_pos);
                }
        }
```

The `StructureGrid` will nedd to be updated upon player movement. If the player
moves to a neightbouring sturcure cell some of the cell will need to be
destroyed and some new will need to be generated. `StructureGrid` will expose a
`UpdatePlayerPos` function that will handle this.

```cs
//StructureGen.cs

public class StructureGrid
{
        public void UpdatePlayerPos(Vector2 player_world_pos)
        {
                var new_player_grid_pos = new Vector2I((int)player_world_pos.X / grid_cell_size, (int)player_world_pos.Y / grid_cell_size);
                var delta = current_player_grid_pos - new_player_grid_pos;
                if (delta == Vector2I.Zero)
                {
                        return;
                }
                current_player_grid_pos = new_player_grid_pos;
        
                // this is expensive, but allows for really fast access of the data 
                var grid_copy = (StructureChunk[])grid.Clone();
                for (int x = 0; x < grid_width; x++)
                {
                        for (int y = 0; y < grid_width; y++)
                        {
                                var new_x = x - delta.X;
                                var new_y = y - delta.Y;
                                if (new_x < 0 || new_y < 0 || new_x >= grid_width || new_y >= grid_width)
                                {
                                        continue;
                                }
                                if (new_x == 1 || new_y == 1)
                                {
                                        //Generate new cell data
                                        var world_x = (x - 1 + new_player_grid_pos.X) * grid_cell_size;
                                        var world_y = (y - 1 + new_player_grid_pos.Y) * grid_cell_size;
                                        grid[x + y * grid_width] = GenerateStructureChunk(new(world_x, world_y));
                                }
        
                                grid[new_x + new_y * grid_width] = grid_copy[x + y * grid_width];
                        }
                }
        
        }
}
```

When initializing the `StructureGrid` we will need to set needed properties and
generate data for the whole grid the same way as before.

```cs
//StructureGen.cs
using System.Collections.Generic;
using Godot;
[Tool]
public partial class StructureGen : Node
{

        [Export] StructureType[] structure_pool;
        [Export] public int mesh_chunks_per_structure_grid_cell;
        
        public class StructureGrid
        {
        ...
                public StructureGrid(StructureGen structure_gen, GroundMeshGen mesh_gen, int mesh_chunk_size, Vector2 player_world_pos)
                {
                        grid_cell_size = structure_gen.mesh_chunks_per_structure_grid_cell * mesh_chunk_size;
                        this.structure_gen = structure_gen;
                        this.mesh_gen = mesh_gen;
                        this.mesh_chunk_size = mesh_chunk_size;
                
                        current_player_grid_pos = new Vector2I((int)player_world_pos.X / grid_cell_size, (int)player_world_pos.Y / grid_cell_size);
                        grid = new StructureChunk[grid_width * grid_width];
                        for (int x = 0; x < grid_width; x++)
                        {
                                for (int y = 0; y < grid_width; y++)
                                {
                                        //Generate new cell data
                                        var world_x = (x - 1 + current_player_grid_pos.X) * grid_cell_size;
                                        var world_y = (y - 1 + current_player_grid_pos.Y) * grid_cell_size;
                                        grid[x + y * grid_width] = GenerateStructureChunk(new(world_x, world_y));
                                }
                        }
                }
        }
}
```

<details>
<summary> whole StructureGen.cs file </summary>

```cs
using System.Collections.Generic;
using Godot;
[Tool]
public partial class StructureGen : Node
{
        [Export] StructureType[] structure_pool;
        [Export] public int mesh_chunks_per_structure_grid_cell;

        public class StructureChunk(Dictionary<Vector2I, StructureInstanceData> structure_collision_dict_terrain_chunk_world_pos, Dictionary<Vector2I, StructureInstanceData> structure_instantiation_dict_terrain_chunk_world_pos)
        {
                public Dictionary<Vector2I, StructureInstanceData> structure_collision_dict_terrain_chunk_world_pos = structure_collision_dict_terrain_chunk_world_pos;
                public Dictionary<Vector2I, StructureInstanceData> structure_instantiation_dict_terrain_chunk_world_pos = structure_instantiation_dict_terrain_chunk_world_pos;
        }
        public class StructureGrid
        {
                const int grid_width = 3;
                readonly StructureChunk[] grid;
                private Vector2I current_player_grid_pos;

                private readonly int grid_cell_size;
                private readonly StructureGen structure_gen;
                private readonly GroundMeshGen mesh_gen;
                private readonly int mesh_chunk_size;
                public bool IsObjectValid(Vector2 world_pos_f)
                {
                        Vector2I world_pos = (Vector2I)world_pos_f;
                        var chunk_pos = world_pos / mesh_chunk_size;
                        var chunk_world_pos = chunk_pos * mesh_chunk_size;



                        if (!this[world_pos].structure_collision_dict_terrain_chunk_world_pos.TryGetValue(chunk_world_pos, out var structure))
                                return true;

                        return !structure.IsObjectColliding(world_pos);
                }
                public StructureChunk this[Vector2I world_pos]
                {
                        get
                        {
                                var global_grid_pos = world_pos / grid_cell_size;
                                var relative_grid_pos = global_grid_pos - current_player_grid_pos;
                                return grid[relative_grid_pos.X + 1 + (relative_grid_pos.Y + 1) * grid_width];
                        }

                }

                public void UpdatePlayerPos(Vector2 player_world_pos)
                {
                        var new_player_grid_pos = new Vector2I((int)player_world_pos.X / grid_cell_size, (int)player_world_pos.Y / grid_cell_size);
                        var delta = current_player_grid_pos - new_player_grid_pos;
                        if (delta == Vector2I.Zero)
                        {
                                return;
                        }
                        current_player_grid_pos = new_player_grid_pos;

                        // this is expensive, but allows for really fast access of the data 
                        var grid_copy = (StructureChunk[])grid.Clone();
                        for (int x = 0; x < grid_width; x++)
                        {
                                for (int y = 0; y < grid_width; y++)
                                {
                                        var new_x = x - delta.X;
                                        var new_y = y - delta.Y;
                                        if (new_x < 0 || new_y < 0 || new_x >= grid_width || new_y >= grid_width)
                                        {
                                                continue;
                                        }
                                        if (new_x == 1 || new_y == 1)
                                        {
                                                //Generate new cell data
                                                var world_x = (x - 1 + new_player_grid_pos.X) * grid_cell_size;
                                                var world_y = (y - 1 + new_player_grid_pos.Y) * grid_cell_size;
                                                grid[x + y * grid_width] = GenerateStructureChunk(new(world_x, world_y));
                                        }

                                        grid[new_x + new_y * grid_width] = grid_copy[x + y * grid_width];
                                }
                        }

                }

                public StructureGrid(StructureGen structure_gen, GroundMeshGen mesh_gen, int mesh_chunk_size, Vector2 player_world_pos)
                {
                        grid_cell_size = structure_gen.mesh_chunks_per_structure_grid_cell * mesh_chunk_size;
                        this.structure_gen = structure_gen;
                        this.mesh_gen = mesh_gen;
                        this.mesh_chunk_size = mesh_chunk_size;

                        current_player_grid_pos = new Vector2I((int)player_world_pos.X / grid_cell_size, (int)player_world_pos.Y / grid_cell_size);
                        grid = new StructureChunk[grid_width * grid_width];
                        for (int x = 0; x < grid_width; x++)
                        {
                                for (int y = 0; y < grid_width; y++)
                                {
                                        //Generate new cell data
                                        var world_x = (x - 1 + current_player_grid_pos.X) * grid_cell_size;
                                        var world_y = (y - 1 + current_player_grid_pos.Y) * grid_cell_size;
                                        grid[x + y * grid_width] = GenerateStructureChunk(new(world_x, world_y));
                                }
                        }
                }

                private StructureInstanceData GenerateRandomStructureInstance(StructureType structure_type, Vector2I base_chunk_world_pos)
                {
                        var structure_world_pos = new Vector2(GD.Randf(), GD.Randf()) * mesh_chunk_size + base_chunk_world_pos;
                        var structure_rotation = GD.Randf() * 360f;
                        var structure_scale = structure_type.base_scale + (GD.Randf() * 2 - 1) * structure_type.scale_change_amplitude;
                        var base_height = mesh_gen.CalculateHeight(structure_world_pos, out _);

                        return new StructureInstanceData(structure_world_pos, structure_scale, structure_rotation, base_height, structure_type);
                }
                private bool IsStructureValid(StructureInstanceData structure_instance, HashSet<Vector2I> collision_chunks, Dictionary<Vector2I, StructureInstanceData> structure_collision_dict_terrain_chunk_world_pos)
                {

                        if (!structure_instance.IsValid(mesh_gen))
                                return false;
                        bool there_already_was_struct_on_one_of_the_chunks = false;
                        foreach (var chunk_world_pos in collision_chunks)
                        {
                                if (structure_collision_dict_terrain_chunk_world_pos.ContainsKey(chunk_world_pos))
                                {
                                        there_already_was_struct_on_one_of_the_chunks = true;
                                        break;
                                }
                        }
                        return there_already_was_struct_on_one_of_the_chunks;
                }
                public StructureChunk GenerateStructureChunk(Vector2I base_world_pos)
                {
                        Dictionary<Vector2I, StructureInstanceData> structure_instantiation_dict_terrain_chunk_world_pos = [];
                        Dictionary<Vector2I, StructureInstanceData> structure_collision_dict_terrain_chunk_world_pos = [];
                        RNG.SetGDRandomSeed(base_world_pos);
                        foreach (var structure_type in structure_gen.structure_pool)
                        {
                                if (structure_gen.mesh_chunks_per_structure_grid_cell < 2 * structure_type.min_distance_from_grid_border_in_mesh_chunks)
                                        GD.PrintErr("structure_gen.mesh_chunks_per_structure_grid_cell has to ge at least 2x the structure_type.min_distance_from_grid_border_in_mesh_chunks.");

                                for (int i = 0; i < structure_type.generation_attempts_per_structure_chunk; i++)
                                {

                                        if (structure_type.spawn_chance < GD.Randf())
                                                continue;

                                        Vector2I base_chunk_world_pos;
                                        {
                                                var mesh_chunk_x = GD.RandRange(structure_type.min_distance_from_grid_border_in_mesh_chunks, structure_gen.mesh_chunks_per_structure_grid_cell - structure_type.min_distance_from_grid_border_in_mesh_chunks);
                                                var mesh_chunk_y = GD.RandRange(structure_type.min_distance_from_grid_border_in_mesh_chunks, structure_gen.mesh_chunks_per_structure_grid_cell - structure_type.min_distance_from_grid_border_in_mesh_chunks);
                                                base_chunk_world_pos = new Vector2I(mesh_chunk_x, mesh_chunk_y) * mesh_chunk_size + base_world_pos;
                                        }

                                        var structure_instance = GenerateRandomStructureInstance(structure_type, base_chunk_world_pos);
                                        var collision_chunks = structure_instance.MeshChunksThisStructureSitsOnWorldPos(mesh_chunk_size);
                                        if (!IsStructureValid(structure_instance, collision_chunks, structure_collision_dict_terrain_chunk_world_pos))
                                                continue;
                                        foreach (var chunk_world_pos in collision_chunks)
                                        {
                                                structure_collision_dict_terrain_chunk_world_pos.Add(chunk_world_pos, structure_instance);
                                        }

                                        structure_instantiation_dict_terrain_chunk_world_pos.Add(base_chunk_world_pos, structure_instance);

                                }
                        }
                        return new(structure_collision_dict_terrain_chunk_world_pos, structure_instantiation_dict_terrain_chunk_world_pos);

                }
        }
}
```

</details>

## Avoiding Overlapping Structures and Objects

When we generate objects we need to make sure if the position that we spawn
objecs on is free from structures. To do this we can use a convenient function
that we've already implemented-`StructureGen.StructureGrid.IsObjectValid`.

```diff lang="cs"
[Tool]
public partial class ObjectsGenerator : Node
{

...
        public ObjectTypeSpawnData[] GenerateObjectsData(int chunk_size,
-                BiomeGenerator.TextureData biome_data, Vector2 base_world_position)
+                BiomeGenerator.TextureData biome_data, StructureGen.StructureGrid structure_grid, Vector2 base_world_position)
        {
                chunk_size -= 2;

                RNG.SetGDRandomSeed(base_world_position);
                Dictionary<TerrainObject, List<ObjectInstantiationData>> object_instances_dictionary = [];


-                TreeObjectsGenerator.GenerateObjectsForMeshChunk(base_tree_spawn_chance, minimal_tree_spacing, chunk_size,
-                                  ground_mesh_gen, biome_data, base_world_position, ref object_instances_dictionary);
-
-                GenerateObjectsWithoutSpacing(BiomeObjectsGenData.GetterType.grass, grass_spawn_attempts_per_mesh_chunk, chunk_size,
-                                        biome_data, base_world_position, ref object_instances_dictionary);
-
-                GenerateObjectsWithoutSpacing(BiomeObjectsGenData.GetterType.rock, rock_spawn_attempts_per_mesh_chunk, chunk_size,
-                                        biome_data, base_world_position, ref object_instances_dictionary);

+                TreeObjectsGenerator.GenerateObjectsForMeshChunk(base_tree_spawn_chance, minimal_tree_spacing, chunk_size,
+                                  ground_mesh_gen, biome_data, base_world_position, structure_grid, ref object_instances_dictionary);
+
+                GenerateObjectsWithoutSpacing(BiomeObjectsGenData.GetterType.grass, grass_spawn_attempts_per_mesh_chunk, chunk_size,
+                                        biome_data, base_world_position, structure_grid, ref object_instances_dictionary);
+
+                GenerateObjectsWithoutSpacing(BiomeObjectsGenData.GetterType.rock, rock_spawn_attempts_per_mesh_chunk, chunk_size,
+                                        biome_data, base_world_position, structure_grid, ref object_instances_dictionary);


                var output = new ObjectTypeSpawnData[object_instances_dictionary.Count];
                int i = 0;
                foreach (var instances_for_type in object_instances_dictionary)
                {
                        output[i] = new(instances_for_type.Key.mesh, instances_for_type.Key.collision_shape, instances_for_type.Value);
                        i++;
                }

                return output;
        }
        public void GenerateObjectsWithoutSpacing(BiomeObjectsGenData.GetterType object_type, int spawn_attempts, int chunk_size,
-                BiomeGenerator.TextureData biome_data, Vector2 base_world_position,
+                BiomeGenerator.TextureData biome_data, Vector2 base_world_position, StructureGen.StructureGrid structure_grid,
                ref Dictionary<TerrainObject, List<ObjectInstantiationData>> object_instances_dictionary)
        {
                for (int i = 0; i < spawn_attempts; i++)
                {
                        Vector2 uv = new(GD.Randf(), GD.Randf());
                        var world_pos_2d = uv * chunk_size + base_world_position;
+                        if (!structure_grid.IsObjectValid(world_pos_2d))
+                                continue;

                        var height = ground_mesh_gen.CalculateHeight(world_pos_2d, out var terrain_aspects);
                        var biomes_influence = biome_data.GetBiomeInfluenceForUV(uv);
                        Vector3 world_pos_3d = new(world_pos_2d.X, height, world_pos_2d.Y);

                        foreach (var biome_influence in biomes_influence)
                        {
                                // it gives better results - objects from different biomes overlap less
                                var influence_cubed = biome_influence.influence * biome_influence.influence * biome_influence.influence;
                                if (GD.Randf() > influence_cubed)
                                        continue;
                                var object_inst_data = biome_influence.biome.objects_data.GetObjectOfType(object_type, world_pos_3d, terrain_aspects);

                                if (object_inst_data == null)
                                        continue;

                                if (object_instances_dictionary.TryGetValue(object_inst_data.Value.obj, out var list_of_instances))
                                        list_of_instances.Add(object_inst_data.Value);
                                else
                                        object_instances_dictionary.Add(object_inst_data.Value.obj, [object_inst_data.Value]);

                                break;
                        }
                }
        }
```

```diff lang="cs"
public static class TreeObjectsGenerator
{
        public static void GenerateObjectsForMeshChunk(float base_object_spawn_chance, float minimal_object_spacing_sqrt, int mesh_chunk_size, GroundMeshGen ground_mesh_gen,
-                BiomeGenerator.TextureData biome_data, Vector2 base_world_position,
+                BiomeGenerator.TextureData biome_data, Vector2 base_world_position, StructureGen.StructureGrid structure_grid,
                ref Dictionary<TerrainObject, List<ObjectInstantiationData>> object_instances_dictionary)
        {

                float grid_cell_width = GridCellWidth(minimal_object_spacing_sqrt);
                var grid_cells_count_per_dimension = Mathf.CeilToInt(mesh_chunk_size / grid_cell_width) + grid_padding;
                var grid = new ObjectsSpacingGrid(grid_cells_count_per_dimension);
                for (int x = -1; x < grid_cells_count_per_dimension - 1; x++)
                {
                        for (int y = -1; y < grid_cells_count_per_dimension - 1; y++)
                        {
                                if (GD.Randf() > base_object_spawn_chance)
                                        continue;
                                var base_cell_world_pos = base_world_position + new Vector2(x, y) * grid_cell_width;
                                bool is_margin = x == -1 || y == -1 || x == grid_cells_count_per_dimension - 2 || y == grid_cells_count_per_dimension - 2;

                                GenerateObjectForGridCell(minimal_object_spacing_sqrt, base_cell_world_pos, new(x, y), grid_cell_width, is_margin,
-                                        ground_mesh_gen, biome_data, ref grid, ref object_instances_dictionary);
+                                        ground_mesh_gen, biome_data, structure_grid, ref grid, ref object_instances_dictionary);
                        }
                }
        }

        private static void GenerateObjectForGridCell(float minimal_object_spacing_sqrt, Vector2 base_cell_world_pos, Vector2I grid_pos, float grid_cell_width, bool is_margin,
-             GroundMeshGen ground_mesh_gen, BiomeGenerator.TextureData biome_data,
+             GroundMeshGen ground_mesh_gen, BiomeGenerator.TextureData biome_data, StructureGen.StructureGrid structure_grid,
             ref ObjectsSpacingGrid grid, ref Dictionary<TerrainObject, List<ObjectInstantiationData>> instances_data_for_object_type)
        {

                Vector2 uv = new(GD.Randf(), GD.Randf());
                var world_pos_2d = uv * grid_cell_width + base_cell_world_pos;
-                if (!IsPosValid(world_pos_2d, minimal_object_spacing_sqrt, grid_pos, grid))
+                if (!IsPosValid(world_pos_2d, minimal_object_spacing_sqrt, grid_pos, grid) || !structure_grid.IsObjectValid(world_pos_2d))
                {
                        return;
                }

                var height = ground_mesh_gen.CalculateHeight(world_pos_2d, out var terrain_aspects);
                var biomes_influence = biome_data.GetBiomeInfluenceForUV(uv);
                Vector3 world_pos_3d = new(world_pos_2d.X, height, world_pos_2d.Y);

                foreach (var biome_influence in biomes_influence)
                {
                        var influence_cubed = biome_influence.influence * biome_influence.influence * biome_influence.influence;
                        if (GD.Randf() > influence_cubed)
                                continue;
                        var object_inst_data = biome_influence.biome.objects_data.GetObjectOfType(BiomeObjectsGenData.GetterType.tree, world_pos_3d, terrain_aspects);

                        if (object_inst_data == null)
                                continue;

                        if (!is_margin)
                        {
                                if (instances_data_for_object_type.TryGetValue(object_inst_data.Value.obj, out var object_type_array))
                                {
                                        object_type_array.Add(object_inst_data.Value);
                                }
                                else
                                {
                                        instances_data_for_object_type.Add(object_inst_data.Value.obj, [object_inst_data.Value]);
                                }
                        }

                        grid[grid_pos] = new(world_pos_2d, minimal_object_spacing_sqrt);
                        break;
                }


        }
}
```

## Modifying the Generation Controller

At last we need to modify the `GenerationController.cs` file so that it uses the
structure generation code.

```diff lang="cs"
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Godot;
[Tool]
public partial class GenerationController : Node
{
...
+       [Export] StructureGen structure_gen;
+       StructureGen.StructureGrid structure_grid;
        [Export] Node3D TestPoint;
...
        private void RunClean()
        {
                ClearAll();

                ChunkChangeCalculator.Init(view_distance_chunks, terrain_chunk_size);

                if (max_chunk_data_textures_count != ChunkChangeCalculator.GetAllChunksInViewDistance().Count)
                {
                        GD.PushWarning("The max amount of chunk data textures is not equal to the chunk data textures that are generated.\n" +
                                "This is not optimal and could cause chunks biomes to stop working:\n" +
                                $"current:{max_chunk_data_textures_count} optimal:{ChunkChangeCalculator.GetAllChunksInViewDistance().Count}");
                }

                ground_mesh_gen.Initialize(terrain_chunk_size);
                ground_shader_controller.SetShaderConfiguration(biomes);
+               structure_grid = new StructureGen.StructureGrid(structure_gen, ground_mesh_gen, terrain_chunk_size, new(player.Position.X, player.Position.Z));

                GenerateDataForAllChunks();
        }
...
        private void GenerateDataForChunks(Vector2I[] chunks_to_generate, Vector2I player_pos_snapped_to_chunk)
        {
                chunk_data_generation_task = Parallel.ForEachAsync(Enumerable.Range(0, chunks_to_generate.Length), async (i, _) =>
                     {
                             try
                             {
                                     var chunk = chunks_to_generate[i];
                                     Vector2I chunk_world_position = chunk + player_pos_snapped_to_chunk;

                                     var biome_data = biome_generator.GenerateTextureData(chunk_world_position, terrain_chunk_size + 1, biomes);

-                                    var objects_data = objects_generator.GenerateObjectsData(terrain_chunk_size, biome_data, chunk_world_position);
+                                    var objects_data = objects_generator.GenerateObjectsData(terrain_chunk_size, biome_data, structure_grid, chunk_world_position);
                                     var mesh_data = ground_mesh_gen.GenerateChunkData(chunk_world_position);
+                                    structure_grid[chunk_world_position].structure_instantiation_dict_terrain_chunk_world_pos.TryGetValue(chunk_world_position, out var chunk_structure_data);
-                                    chunk_instantiation_que.Enqueue(new(mesh_data, biome_data, chunk_world_position, objects_data));
+                                    chunk_instantiation_que.Enqueue(new(mesh_data, biome_data, chunk_world_position, objects_data, chunk_structure_data));
                             }
                             catch (Exception e)
                             {
                                     GD.PrintErr($"GenerateDataForChunks failed: {e}");
                             }
                     });
        }
}
```

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
        data-term="structures generation"
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
