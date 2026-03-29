---
title: 1. Basic ground mesh
description: Basic ground mesh
---

Let's start by creating a Godot project, use Forward+ renderer.

## Generating Simple Mesh

Godot allows you to procedurally generate meshes, by using the
[MeshInstance3D](https://docs.godotengine.org/en/stable/classes/class_meshinstance3d.html).
[Surface tool](https://docs.godotengine.org/en/stable/classes/class_surfacetool.html)
is used to generate mesh data for it with hight abstraction layer. In this
project we will be generating data without usign the 'Surface Tool'. This will
allow us to make terrain generation more efficient because we will utylize some
of the data generated in other places which would not be possible otherwise.

### Generating Mesh UVs and Vertices

Vertices are points of which the mesh will consits. We will be just placing them
in a square with a certain spacing defined by the size of our mesh and it's
resolution.

```cs
//GroundMeshGen.cs
using Godot;
[Tool]
public partial class GroundMeshGen : Node
{
        public class MeshData
        {
                public Vector3[] vertices;
                public Vector3[] vertices_padded;
                public int[] indices;
                public Vector3[] normals;
                public Vector2[] uvs;
                public float[] height_map;
                public float[] tangents;
                private Vector2I base_world_pos;
        }

        private int triangles_per_dimension;
        private float triangle_size;

        private void GenerateUVsAndVertexes(MeshData mesh_data)
        {
                mesh_data.vertices = new Vector3[triangles_per_dimension * triangles_per_dimension];
                for (int x = 0; x < triangles_per_dimension; x++)
                {
                        for (int z = 0; z < triangles_per_dimension; z++)
                        {
                                var relative_pos = new Vector2I(x, z);
                                Vector2 worldPos = (Vector2)relative_pos * triangle_size + mesh_data.base_world_pos;
                                float height = CalculateHeight(worldPos);
                                Vector3 vertex_pos = new(worldPos.X, height, worldPos.Y);
                                mesh_data.vertices[x + z  * triangles_per_dimension] = vertex_pos;
                        }
                }

        }
}
```

Height will be calculated by the `CalculateHeight()`. This function will be
taking vertex's position and return height for it. For now the height
calculation will be really simple but later we will make it more customizable.

```cs
//GroundMeshGen.cs
[Export] private FastNoiseLite noise;
[Export] private float noise_amplitude;
private float CalculateHeight(Vector2 world_pos)
{
        return noise.GetNoise2D(world_pos.X, world_pos.Y) * noise_amplitude;
}
```

We will later need to calculate a padding of 1 vertex outside of the current
mesh. This will be needed for calculating normals in a way that will result in a
seamless transitions between different chunks of the terrain.

Also we might as well store pure height as a height map. It will be useful for
many features that we will implement later.

```diff lang="cs"
//GroundMeshGen.cs

private void GenerateUVsAndVertexes(MeshData mesh_data)
 {
+        int paddedWidth = triangles_per_dimension + 2;
+        mesh_data.vertices_padded = new Vector3[paddedWidth * paddedWidth];
+        mesh_data.height_map = new float[triangles_per_dimension * triangles_per_dimension];
         vertices = new Vector3[triangles_per_dimension * triangles_per_dimension];

-        for (int x = 0; x < triangles_per_dimension; x++){
-                for (int z = 0; z < triangles_per_dimension; z++){
+        for (int x = -1; x < triangles_per_dimension + 1; x++)
+        {
+                for (int z = -1; z < triangles_per_dimension + 1; z++)
+                {
                         var relative_pos = new Vector2I(x, z);
                         Vector2 worldPos = (Vector2)relative_pos * triangle_size + mesh_data.base_world_pos;
                         float height = CalculateHeight(worldPos);

                         Vector3 vertex_pos = new(worldPos.X, height, worldPos.Y);
                         
-                        mesh_data.vertices[x + z  * triangles_per_dimension] = vertex_pos;
+                        mesh_data.vertices_padded[x + 1 + (z + 1) * paddedWidth] = vertex_pos;
+
+                        if (x < 0 || z < 0 || x >= triangles_per_dimension || z >= triangles_per_dimension)
+                                continue;
+
+                        int i = x + z * triangles_per_dimension;
+
+                        mesh_data.height_map[i] = height;
+                        mesh_data.vertices[i] = vertex_pos;
                 }
         }

 }
```

Next we will need to calculate the UV value for the current vertex. The
uv(Vector2 with each axis ∈ (0;1)) says at what % of the mesh the current vertex
is. So if we have a mesh made of 100x100 vertices than a vertex at a (20;30)
will have the UV of: (0.2;0.3).

```diff lang="cs"
//GroundMeshGen.cs

  private void GenerateUVsAndVertexes(MeshData mesh_data)
  {
          ...
+         mesh_data.uvs = new Vector2[triangles_per_dimension * triangles_per_dimension];
          for (int x = -1; x < triangles_per_dimension + 1; x++)
          {
                  for (int z = -1; z < triangles_per_dimension + 1; z++)
                  {
                          ...
                          mesh_data.height_map[i] = height;
                          mesh_data.vertices[i] = vertex_pos;
+                         mesh_data.uvs[i] = new Vector2(
+                             x / (float)(triangles_per_dimension - 1),
+                             z / (float)(triangles_per_dimension - 1)
+                         );
                  }
          }

  }
```

## Generating Indices

Another thing that eavery mesh has to have are indices. Indices tell gpu how to
create triangles form vertices so that we get a valid and facing the right way
mesh. For performance resons only one side of the triangle is drawn so it is
important to connect verteces in a counter-clockwise order so that the 'top'
side of them is drawn:
![How to draw a simple rectangle](./rectangle_drawing_ilustration.png)

So the order that we will connect our vertices will be:

1. top-left
1. top-right
1. bottom-left
1. bottom-right
1. bottom-left
1. top-right

Which for our mesh translates into those indices:

```cs
current_vertex_index;
current_vertex_index + 1;
current_vertex_index + triangles_per_dimension;

current_vertex_index + triangles_per_dimension + 1;
current_vertex_index + triangles_per_dimension;
current_vertex_index + 1;
```

Implementation:

```cs
//GroundMeshGen.cs

private void GenerateIndices(MeshData mesh_data)
{

        int vertex_count = triangles_per_dimension - 1;
        mesh_data.indices = new int[vertex_count * vertex_count * 6];
        int array_index = 0;

        for (int z = 0; z < vertex_count; z++)
        {
                for (int x = 0; x < vertex_count; x++)
                {
                        int vertex_idx = x + z * triangles_per_dimension;
                        // counter-clockwise order. 
                        mesh_data.indices[array_index++] = vertex_idx;
                        mesh_data.indices[array_index++] = vertex_idx + 1;
                        mesh_data.indices[array_index++] = vertex_idx + triangles_per_dimension;

                        mesh_data.indices[array_index++] = vertex_idx + triangles_per_dimension + 1;
                        mesh_data.indices[array_index++] = vertex_idx + triangles_per_dimension;
                        mesh_data.indices[array_index++] = vertex_idx + 1;
                }
        }

}
```

## Generating Normals

If you had any expirience with optics related physics you will definitly know
already what a normal is. It's just a object that is perpendicular to a given
object. In our case a vector that is perpendicular to the Surface of a mesh in a
triangle. We will use the code bellow to calculate it.

```cs
Vector3 normal = new Vector3(
    mesh_data.vertices_padded[left].Y - mesh_data.vertices_padded[right].Y,
    2.0f,
    mesh_data.vertices_padded[down].Y - mesh_data.vertices_padded[up].Y
).Normalized();
```

Implementation:

```cs
//GroundMeshGen.cs

//  padding is needed for generating normals to avoid any seems between chunks.
private void GenerateNormals(MeshData mesh_data)
{
        int paddedWidth = triangles_per_dimension + 2;
        mesh_data.normals = new Vector3[triangles_per_dimension * triangles_per_dimension];

        for (int x = 0; x < triangles_per_dimension; x++)
        {
                for (int z = 0; z < triangles_per_dimension; z++)
                {
                        // padded indices
                        int left = x + (z + 1) * paddedWidth;
                        int right = x + 2 + (z + 1) * paddedWidth;
                        int down = x + 1 + (z + 0) * paddedWidth;
                        int up = x + 1 + (z + 2) * paddedWidth;

                        // central difference for normal
                        Vector3 normal = new Vector3(
                           mesh_data.vertices_padded[left].Y - mesh_data.vertices_padded[right].Y,
                            2.0f,
                            mesh_data.vertices_padded[down].Y - mesh_data.vertices_padded[up].Y
                        ).Normalized();

                        mesh_data.normals[x + z * triangles_per_dimension] = normal;
                }
        }

}
```

## Generating Tangents

Tangent is value that describes: Let's say that we have a point that moves on
the triangles that our mesh is made of. This point always wants to move in
direction of the X axis. If the terrain is flat than the vector of his direction
will be: `(1;0;0)`. But if the terrain's Y possition is changing than the vector
describing his direction for each of his steps will look like this:
`(1; (step_size * delta_height)/(step_size * delta_x); 0).normalize()` So if he
moves by 1 meter each step and his terrain is really steep and he moved by a 0.5
meter in the X direction and by 0.5 meter in the Y direction than his tangent
will be:

```
step_size = 1
delta_height = 0.5
delta_x = 0.5
(step_size * delta_height)/(step_size * delta_x) = 1
un_normalized_tangent = (1;1;0)
normalized_tangent = (sqrt(2)/2;sqrt(2)/2;0)
```

I will not explain each part of the tangent calculation algorithm, because this
is not the goal of this tutorial.

```cs
//GroundMeshGen.cs

public void GenerateTangents(MeshData mesh_data)
{
        int vertexCount = vertices.Length;

        var raw_tangents = new Vector3[vertexCount];
        var raw_bitangents = new Vector3[vertexCount];

        // Accumulate tangents per triangle
        for (int i = 0; i < indices.Length; i += 3)
        {
                int idx0 = mesh_data.indices[i];
                int idx1 = mesh_data.indices[i + 1];
                int idx2 = mesh_data.indices[i + 2];

                Vector3 v0 = mesh_data.vertices[idx0];
                Vector3 v1 = mesh_data.vertices[idx1];
                Vector3 v2 = mesh_data.vertices[idx2];

                Vector2 uv0 = mesh_data.uvs[idx0];
                Vector2 uv1 = mesh_data.uvs[idx1];
                Vector2 uv2 = mesh_data.uvs[idx2];

                Vector3 edge_1 = v1 - v0;
                Vector3 edge_2 = v2 - v0;

                float uv_delta_x1 = uv1.X - uv0.X;
                float uv_delta_x2 = uv2.X - uv0.X;
                float uv_delta_y1 = uv1.Y - uv0.Y;
                float uv_delta_y2 = uv2.Y - uv0.Y;

                float signed_area_of_triangle = uv_delta_x1 * uv_delta_y2 - uv_delta_x2 * uv_delta_y1;
                // we check if the triangle is valid
                if (Mathf.Abs(signed_area_of_triangle) < 1e-8f)
                        continue;

                float inv_area_of_triangle = 1.0f / signed_area_of_triangle;

                Vector3 tangent_dir = (edge_1 * uv_delta_y2 - edge_2 * uv_delta_y1) * inv_area_of_triangle;
                Vector3 bitangent_dir = (edge_2 * uv_delta_x1 - edge_1 * uv_delta_x2) * inv_area_of_triangle;

                // sum up the tangents for tech vertex in the triangle. 
                // This will be later normalized and will result in smoother output.
                raw_tangents[idx0] += tangent_dir;
                raw_tangents[idx1] += tangent_dir;
                raw_tangents[idx2] += tangent_dir;


                raw_bitangents[idx0] += bitangent_dir;
                raw_bitangents[idx1] += bitangent_dir;
                raw_bitangents[idx2] += bitangent_dir;
        }


        mesh_data.tangents = new float[vertexCount * 4];
        for (int i = 0; i < vertexCount; i++)
        {
                Vector3 normal = mesh_data.normals[i];
                Vector3 raw_tangent = raw_tangents[i];

                // Gram-Schmidt orthogonalization -> https://en.wikipedia.org/wiki/Gram%E2%80%93Schmidt_process
                Vector3 normalized_tangent = (raw_tangent - normal * normal.Dot(raw_tangent)).Normalized();

                float handedness = (normal.Cross(raw_tangent).Dot(raw_bitangents[i]) < 0.0f) ? -1.0f : 1.0f;

                int baseIndex = i * 4;
                mesh_data.tangents[baseIndex + 0] = normalized_tangent.X;
                mesh_data.tangents[baseIndex + 1] = normalized_tangent.Y;
                mesh_data.tangents[baseIndex + 2] = normalized_tangent.Z;
                mesh_data.tangents[baseIndex + 3] = handedness;
        }

}
```

## Generating Mesh

Now let's combine all of the newly implemented functions to generate a mesh that
will repesent terrain.First implement the `Initialize` function it will
configure some very basic settings that will not change when generating terrain
mesh chunks at different positions.

```cs
//GroundMeshGen.cs
public void Initialize(int size)
{
        this.size = size;
        triangles_per_dimension = resolution + 1;
        triangle_size = size / (float)resolution;
}
```

Next implement a `GenerateChunkData` function that will take some basing terrain
parameters to generate data for the mesh.

```cs
//GroundMeshGen.cs

/// The 'Initialize' function needs to be called first
public MeshData GenerateChunkData(Vector2I base_world_pos)
{
        var mesh_data = new MeshData
        {
                base_world_pos = base_world_pos
        };

        GenerateUVsAndVertexes(mesh_data);
        GenerateIndices(mesh_data);
        GenerateNormals(mesh_data);
        GenerateTangents(mesh_data);
        return mesh_data;
}
```

Next We will implement a separate function to apply the generated data. This
separation is needed because later we will implement multithreading and in Godot
you can only create nodes on the main thread. This will allow us to run data
generation for multiple chunks on many threads and apply the data one at the
time on the main thread.

In this function we will pack data into a one array, and give it to the
`ArrayMesh`.\
We can also use the height map to generate collider for this terrain.
`HeightMapShape3D` can be used for this.

```cs
//GroundMeshGen.cs

/// Needs to be called after the `GenerateChunkData()`
public void ApplyData(MeshData data, MeshInstance3D mesh_instance, CollisionShape3D collider)
{
        var arrays = new Godot.Collections.Array();
        arrays.Resize((int)Mesh.ArrayType.Max);

        arrays[(int)Mesh.ArrayType.Vertex] = data.vertices;
        arrays[(int)Mesh.ArrayType.Index] = data.indices;
        arrays[(int)Mesh.ArrayType.Normal] = data.normals;
        arrays[(int)Mesh.ArrayType.TexUV] = data.uvs;
        arrays[(int)Mesh.ArrayType.Tangent] = data.tangents;

        HeightMapShape3D shape = new()
        {
                MapWidth = triangles_per_dimension,
                MapDepth = triangles_per_dimension,
                MapData = data.height_map
        };
        collider.Shape = shape;
        collider.Scale = new Vector3(triangle_size, 1, triangle_size);
        // `- size/2f` is needed because otherwise this will be the center point for the collider, and for mesh this will be the bottom left corner. 
        collider.Position = new(data.base_world_pos.X + size / 2f, 0, data.base_world_pos.Y + size / 2f);


        var mesh = new ArrayMesh();
        mesh.AddSurfaceFromArrays(Mesh.PrimitiveType.Triangles, arrays);

        mesh_instance.Mesh = mesh;
}
```

Now we need to implement script that will run the whole generation process. It
will get a lot more complex in the future but for now it will just look like
this:

```cs
// GenerationController.cs
using Godot;
[Tool]
public partial class GenerationController : Node
{
        [ExportToolButton("Run")] private Callable RunButton => Callable.From(Run);
        [Export] int terrain_chunk_size;

        [Export] GroundMeshGen ground_mesh_gen;
        [Export] MeshInstance3D mesh_instance;
        [Export] CollisionShape3D collider;
        private void Run()
        {
                Vector2I base_world_pos = new(0, 0);
                ground_mesh_gen.Initialize(terrain_chunk_size);
                var mesh_data = ground_mesh_gen.GenerateChunkData(base_world_pos);
                ground_mesh_gen.ApplyData(mesh_data, mesh_instance, collider);
        }

}
```

## End Resoult

Now you can add those scripts to nodes and run this code to generate a terrrain
mesh with collisions.\

TODO: Add a screen shot of editor.

:::tip

If you have a trouble running your script as tool, try following:

1. Click build project - Alt + B
2. Close Godot and launch it again

:::

:::tip

If you are on NixOS and have problem with Godot crashing try:

1. Download .net executable for Linux from Godot's website.
2. Run the executable file with `steam-run`

:::

This still doesn't look great because we lack any textures, so this is what we
will deal with next.

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
        data-term="basic ground mesh"
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
