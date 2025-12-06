---
title: 1. basic setup
description: terrain_gen
---
Let's start by creating a godot project, use Forward+ renderer.

## How drawing meshes actually works?
Gpu can only draw triangles, so any complex geometry must consist of a bunch of triangles.
To tell how to draw our triangles we just use arrays of numbers.

![./rectangle_drawing_ilustration.png]
* Vertices: Array of 3d vectors-> positions of points in 3d space.
* Indices: Array of unsigned int-> indexes of vertices.

The gpu:
1. reads 3 next indices
2. uses them as a corners of a triangle
3. draws this triangle
4. repeat x times

## Generating simple mesh

Godot allows you to procedurally generate meshes, by using the `MeshInstance3D`https://docs.godotengine.org/en/stable/classes/class_meshinstance3d.html.
And a surface tool https://docs.godotengine.org/en/stable/classes/class_surfacetool.html
It gives you nice to work with abstraction layer.

:::tip
If you have a trouble running your script as tool, try following:
1. click build project - Alt + B
2. close godot and launch it again
:::

:::tip
If you are on nixos and have problem with godot crashing try:
1. download normal comipled version for .Net for linux from godot website.
2. run the executable file with steam-run
:::

``` cs
/// ground_gen.cs
using Godot;
[Tool]
public partial class ground_gen : MeshInstance3D
{

    [Export] bool generate;

    public override void _Process(double delta)
    {
        if (generate)
        {
            GD.Print("generating!");
            generate = false;
            var arrayMesh = GenerateTerrainMesh();
            Mesh = arrayMesh;
        }
        base._Process(delta);
    }


    private ArrayMesh GenerateTerrainMesh()
    {
        var st = new SurfaceTool();
        st.Begin(Mesh.PrimitiveType.Triangles);


        GenerateVertexes(st);
        GenerateIndexes(st);

        return st.Commit();
    }

    private static void GenerateIndexes(SurfaceTool st)
    {
        st.AddIndex(0);
        st.AddIndex(2);
        st.AddIndex(1);

        st.AddIndex(1);
        st.AddIndex(2);
        st.AddIndex(3);
    }

    private void GenerateMeshData(SurfaceTool st)
    {
        st.AddVertex(new(0, 1, 0));
        st.AddVertex(new(1, 1, 0));
        st.AddVertex(new(0, 0, 0));
        st.AddVertex(new(1, 0, 0));
    }
}
```

And if we run this code we should see a nice little square that is see through on one side.
It is see through because godot- like any other game engine, draws triangles form only one site- for performance reasons. 

![./editor1.png]

One small square won't do much for us.
We will generate a big square consisting of a series of triangles.
The technique is the same as before:
* Vertexes: x by x points separated by y distance
* Indexes: we do the same thing as before but for each vertex point in x by x grid
```cs
/// ground_gen.cs

    ...
    [Export] float triangle_size;
    [Export] int triangle_count_per_dimension;
    private void GenerateIndexes(SurfaceTool st)
    {
        for (int x = 0; x < triangle_count_per_dimension -1; x++)
        {
            for (int z = 0; z < triangle_count_per_dimension -1; z++)
            {
                int i = x + z * triangle_count_per_dimension;
                st.AddIndex(i); // 0,0
                st.AddIndex(i + triangle_count_per_dimension); // 0,1
                st.AddIndex(i + 1); //1,0

                st.AddIndex(i + 1);//1,0
                st.AddIndex(i + triangle_count_per_dimension); //0,1
                st.AddIndex(i + 1 + triangle_count_per_dimension);//1,1
            }
        }
    }

    private void GenerateVertexes(SurfaceTool st)
    {
        for (uint x = 0; x < triangle_count_per_dimension; x++)
        {
            for (uint z = 0; z < triangle_count_per_dimension; z++)
            {
                st.AddVertex(new(x * triangle_size, z * triangle_size, 0));
            }
        }
    }
```

Now let's make it bumpy like a real life terrain.
We will be using a `FastNoiseLite` resource because it is amazing!

```cs
///NoiseComponent.cs
using Godot;
[Tool, GlobalClass]
public partial class NoiseComponent : Resource
{

    [Export] public FastNoiseLite noise;
    [Export] public float amplitude;
    [Export] public float frequency = 1f;
    public float GetHeight(Vector2 pos)
    {
        return noise.GetNoise2Dv(pos * frequency) * amplitude;
    }
}
```

I've separated the noise generation class, because we will be later combining multiple noises to generate better looking terrain.
Now we just sample the noise for each vertex and we should get some nice terrain.

```cs
/// ground_gen.cs
    ...

    private Vector2 RealPosition(uint x, uint z)
    {
        return new(x * triangle_size, z * triangle_size);
    }

    private void GenerateVertexes(SurfaceTool st)
    {
        for (uint x = 0; x < triangle_count_per_dimension; x++)
        {
            for (uint z = 0; z < triangle_count_per_dimension; z++)
            {
                Vector2 real_pos = RealPosition(x, z);
                float height = noise_component.GetHeight(real_pos);
                st.AddVertex(new(real_pos.X, height , real_pos.Y));

            }
        }

    }
```

Now build this and set the noise component.
Use just simple fast noise light with simplex noise, set amplitude to 30 and frequency to 50 and run generate... 

![./editor2.png]

And we see trash...
This is because we have no light, so we cant see the terrain height changes.
If we add directional light, we should see some difference... 
But we don't, this is because we don't have normals on our mesh.
Normals or rather normal map tells renderer the direction that our mesh triangles are facing.
I will be talking about generating normals later in this tutorial.

But thankfully surface tool has a nice function to generate them.
But for this we need to first generate uv-s for our mesh.
Uv value is just a vector that goes from 0-1 and tells us in what percent of the mesh this vertex is located 

and than we just run to generate everything needed for light to work with our mesh:
```cs
        st.GenerateNormals();
        st.GenerateTangents();
```

``` cs
/// ground_gen.cs

    ...
    private void GenerateVertexes(SurfaceTool st)
    {

                ...
                var uv = new Vector2(x / triangle_count_per_dimension, z / triangle_count_per_dimension);
                st.SetUV(uv);

                Vector2 real_pos = RealPosition(x, z);
                ...
    }
```
Now if we regenerate the mesh now we should see a nice terrain with shadows(if we enable it in the light settings) and light working:

![./editor3.png]

This still doesn't look great because we lack any textures, so this is what we will deal with next.
