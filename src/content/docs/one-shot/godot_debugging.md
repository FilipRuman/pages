---
title: Practical tips for debugging godot code.
description:Practical tips for debbuining C# code anot only for Godot.
---

Much of a software developer’s time is spent debugging rather than implementing
new features. Clean code with high quality log information is the best way to
reduce that time. Nonetheless bugs are inevitable but there are way to speed up
the debugging process.

## [Debug Draw 3D](https://github.com/DmitriySalnikov/godot_debug_draw_3d?tab=readme-ov-file)

Sometimes you need to quickly visualize data. This can allow you to spot issues
that would not be obvious otherwise.

I had that kind of issue while developing my
[flight simulator](https://github.com/FilipRuman/Flight-sim). I had an issue
with the simulation stability at certain flight conditions. I tried displaying
flight data (drag, lift, thrust, torque, aoa, etc.) as graphics instead of
boring vector values. It allowed me to discover issues in the logic of my code
that would take a lot more time otherwise.
![debugging flight sim](https://github.com/user-attachments/assets/4150a717-f7ae-4a64-a4b1-4cc51c1720a6)
To accomplish this I've used the `Debug Draw 3D` package. It's an open-source
and very easy to package for displaying debug shapes. You can easily install it
in the 'AssetLib' tab of your Godot editor.

## Using Simple Mesh Instances as a Visual Indicator

Sometimes tools like the 'Debug Draw 3D' would be too complex for the job .\
In that case a simple script for instantiating a simple mesh instance in a
specified position will be a better fit.

Use this code to instantiate a simple sphere with some basic settings :

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

For a new node to be visible in Godot it needs to be added as a child to already
existing node. This means that a non-static class will have to supply a
reference to a parent node for the static class. Using a static class will allow
other any parts of your code to use it.

Final implementation:

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

In Godot, exceptions in main-thread code will be automatically cached and logged
as an error message in the console. While running any async code a manual
try-catch block is needed to log the exception's value. Without this, your async
code will fail silently.

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

Using exceptions is not the best way of error handling. To know whether a C#
function could throw an exception you would have to read its code. Additionally,
safely handling exceptions requires wrapping calls in try-catch blocks. It's
well known that this is very inefficient and error prone, so you should avoid it
like the plague.

Recommended approach is to return null form a function and print an error
message. But this doesn't clearly mark the code that can result in error. To fix
this apply the '?' operator (even for nullable data types) after the type
declaration in your function. This will make it explicit that this code can
return a null(error). This forces the caller to check whether the output value
is a null and handle all cases.

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
