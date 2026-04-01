---
title: Godot debugging
description:Practical NixOS tips: screen recording with gpu-screen-recorder, fast screenshots via Grimblast in Hyprland, and importing local fonts into flakes.
---

TODO: Add some beginign TODO: Fix the title TODO: Fix the description

## [Debug Draw 3D](https://github.com/DmitriySalnikov/godot_debug_draw_3d?tab=readme-ov-file)

Sometimes you need to quickly visualize something like a vector, collider,
direction etc. This can allow you to easily spot an issue that would not be easy
to find otherwise. I had the same issue while developing my
[flight simulator](https://github.com/FilipRuman/Flight-sim). I had a problem
that the simulation was unstable at certain angles or that it felt just a tiny
bit 'wrong'. Showing things like vector of forces(drag,lift,thrust,torque)
allowed me to discover issues in logic of my code that would be hard to spot
otherwise.
![debugging flight sim](https://github.com/user-attachments/assets/4150a717-f7ae-4a64-a4b1-4cc51c1720a6)
To do this I used the `Debug Draw 3D` package\
It is open-source and very easy to setup and use. You can easily install it in
the 'AssetLib' tab of the Godot editor.

## Using Simple Mesh Instances as a Visual Indicator

Sometimes a thing like the 'Debug Draw 3D' would be too complex and big for the
job or you just don't want to use external code in your project.\
In those cases you can just create a simple script for instantiating a simple
mesh instance in a specified position. This can be used as a simple visual
indicator.

To instantiate a simple sphere with some basic settings you can just use this:

```cs
public static void Spawn(Vector3 world_pos, Color color, float size = 1)
{

        var mesh_inst = new MeshInstance3D
        {
                Position = world_pos,
                Scale = Vector3.One * size
        };
        var mesh = new SphereMesh()
        {
                Rings = 5,
                Radius = 5,
                Height = 5
        };
        mesh_inst.Mesh = mesh;
        material = new StandardMaterial3D
        {
                AlbedoColor = color
        };
        mesh_inst.MaterialOverride = material;
        parent.CallDeferred("add_child", mesh_inst);
}
```

But for a node to be visible in godot you need to add it as a child to a node.
This means that we need to add reference to it from a non static script.

The final code:

```cs
using Godot;
[Tool]
public partial class DebugSpheresController : Node3D
{
        public override void _Ready()
        {
                DebugSpheresStatic.parent = this;
                base._Ready();
        }
}
public static class DebugSpheresStatic
{
        public static Node3D parent;

        public static void Spawn(Vector3 world_pos, Color color, float size = 1)
        {

                var mesh_inst = new MeshInstance3D
                {
                        Position = world_pos,
                        Scale = Vector3.One * size
                };
                var mesh = new SphereMesh()
                {
                        Rings = 5,
                        Radius = 5,
                        Height = 5
                };
                mesh_inst.Mesh = mesh;
                material = new StandardMaterial3D
                {
                        AlbedoColor = color
                };
                mesh_inst.MaterialOverride = material;
                parent.CallDeferred("add_child", mesh_inst);
        }
}
```

## Using Try-Catch Blocks in Multi-Threaded C# Code

With Godot if you run any code on the main thread that throws an exception it
will be automatically cached and displayed as a error message in your terminal.
If you run any code async code you need to remember to put a try-chatch block
your self and print and error message. Otherwise you will see no indicator of a
exception other than your code not working.

```cs
Parallel.ForEachAsync(Enumerable.Range(0, lenght), async (i, _) =>
    {
            try
            {
                    DoSomething();
            }
            catch (Exception e)
            {
                    GD.PrintErr($"Parallel code failed: {e}");
            }
    });
```

## Using Nullable Values in C#

The error handling in c# is not the best one. Rust's implementation when using
the [anyhow](https://github.com/dtolnay/anyhow) create beats c# easily, but we
can try to make it work anyway.\
You should practically never throw exceptions. To know that a funciton could
throw an error you would have to read the source of it and than to respond to a
exception you need to use a try-chatch block . This is very ineficient and error
prone, so you should avoid it .What you should do instead is return the function
with a null value(if it has a return value) and print an error message. But this
doesn't solve an issue with code that can result in error beginign clearly
marked. To fix this you can just a '?' after the type declaration in your
funciton or wrapp the whole type with`Nullable<T>`. This will make it clearly
visible that this code can return a null(error). This means that other functions
will have to check a null value and make a response for it when, calling that
function.

```cs
private int? DoSmth(int x, int y)
{
        if (y == 0)
                return 0;

        int z = x / y * 25;

        if (x < y)
                return null;

        if (!IsZValid(z))
                return null;

        var w = CalculateW();
        if (w == null)
                return 0;

        return w + z;
}
private int? CalculateW()
{
        try
        {
                DoSomethingThatCouldThrowAnException();
        }
        catch (Exception exc)
        {
                GD.PrintErr($"Encoutered exception while caluclating W: {exc}");
                return null;
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
        data-term="objects generation"
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
