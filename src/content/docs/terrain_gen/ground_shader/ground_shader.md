---
title: 2. Ground shader
description: Ground shader
---

:::note

code formatting might be messed up in this one because I couldn't manage to make
any code formatter to work the way that i want with gdshader.

:::

Currently our terrain mesh looks very boring - it is just white. This chapter
will explain each part of an AAA quality ground shader.

## Basic Setup

Shaders are a type of code that can run on a GPU instead of a CPU. Writing
shaders is simillar to sriting standard code, so if you don't have previous
expirience with shaders don't worry. I will be trying to explain each part of
creating this shader, but this shader will be preety complex because it has to
avoid many issues that you could encounter while writing a ground shader.

First create a `.gdshader` file and put this code in it:

```gdshader
//ground.gdshader

shader_type spatial;

uniform sampler2D albedo;
void fragment(){
	ALBEDO = texture(albedo,UV).rgb;
}
```

This code will just sample the `albedo` texture and will use it across the whole
mesh. Now open the mesh instance for your terrain mesh and set the surface
material override with a shader material. Now place the created shader inside of
the shader material and fill the `albedo` texture with a test texture.

![basic test](./BasicShaderTest.png)

## Triplanar Mapping

Currently if we were to make another chunk of mesh and place them adjacent to
each other we would see that the texture on one of the chunks wouldn't mach the
texure on the other chunk. This is because our current implementation uses uv
coodinates for the texture sampling. This is a big issue because the uv will not
transition smoothily beetween our chunks, and seems will occure. There is a
really easy way to avoid this- we need to use world position instead.

```diff lang="gdshader"
//ground.gdshader
shader_type spatial;

uniform sampler2D albedo;
+uniform float scale;
void fragment(){
+	vec3 world_pos = (INV_VIEW_MATRIX * vec4(VERTEX, 1.0)).xyz;
-   ALBEDO = texture(albedo,UV).rgb;
+	ALBEDO = texture(albedo,world_pos.xz * scale).rgb;
}
```

This will fix our seem issue, but it has introduced another one. If we were to
rotate our terrain or would look at the hilly parts of the terrain, we would see
that the textures are streached. This is caused because we are sampling the
texture using only the x and z coordinates. to fix this we will use a technique
called 'Triplanar sampling'. Triplanar sampling will also allow us to display
rock texture for steep parts of the terrain.

To implement triplanar sampling we will do this:

```gdshader
uniform float rock_scale;
uniform sampler2D rock_texture;
vec3 triplanar (vec3 position, float biome_scale,vec3 normal, sampler2D biome_texture){
	vec3 weights = normal / (normal.x + normal.y + normal.z) * 3.0;


	vec2 uv_x = position.zy;
	vec2 uv_y = position.xz;
	vec2 uv_z = position.xy;

	vec3 output = vec3(0,0,0);
	if (weights.x > 0.01){
		output +=  texture(rock_texture, uv_x * rock_scale).rgb * weights.x;
	}
	if (weights.y > 0.01){
		output +=  texture(biome_texture, uv_y * biome_scale).rgb * weights.y;
	}
	if (weights.z > 0.01){
		output +=  texture(rock_texture, uv_z * rock_scale).rgb * weights.z;
	}

	return output;
}
```

To calculate the value of normal at that point we will use this:

```gdshader
vec3 world_normal = normalize((INV_VIEW_MATRIX * vec4(NORMAL, 0.0)).xyz);
```

Combined code:

```diff lang="gdshader"
//ground.gdshader
shader_type spatial;

uniform sampler2D albedo;
uniform float scale;

+uniform float rock_scale;
+uniform sampler2D rock_texture;
+vec3 triplanar (vec3 position, float biome_scale,vec3 normal, sampler2D biome_texture){
+	vec3 weights = adjusted_normal / (adjusted_normal.x + adjusted_normal.y + adjusted_normal.z) * 3.0;
+
+	vec2 uv_x = position.zy;
+	vec2 uv_y = position.xz;
+	vec2 uv_z = position.xy;
+
+	vec3 output = vec3(0,0,0);
+	if (weights.x > 0.01){
+		output +=  texture(rock_texture, uv_x * rock_scale).rgb * weights.x;
+	}
+	if (weights.y > 0.01){
+		output +=  texture(biome_texture, uv_y * biome_scale).rgb * weights.y;
+	}
+	if (weights.z > 0.01){
+		output +=  texture(rock_texture, uv_x * rock_scale).rgb * weights.z;
+	}
+
+	return output;
+}


void fragment(){
	vec3 world_pos = (INV_VIEW_MATRIX * vec4(VERTEX, 1.0)).xyz;
+	vec3 world_normal = normalize((INV_VIEW_MATRIX * vec4(NORMAL, 0.0)).xyz);


-	ALBEDO = texture(albedo,world_pos.xz * scale).rgb;
+	ALBEDO = triplanar(world_pos, scale, world_normal, albedo);
}
```

If we now look at the results we shouldn't see any streached texutres. But the
main issue with the current implementation is that transition beetween the rock
and grass texutres will be very slow. This results in blended textures which
doesn't look great. But there is a very simple fix for this. We can just do
this:

```diff lang="gdshader"
//ground.gdshader
void fragment(){
	vec3 world_pos = (INV_VIEW_MATRIX * vec4(VERTEX, 1.0)).xyz;
	vec3 world_normal = normalize((INV_VIEW_MATRIX * vec4(NORMAL, 0.0)).xyz);
+	vec3 adjusted_normal = pow(abs(world_normal), vec3(8.0));

-	ALBEDO = triplanar(world_pos, scale, world_normal, albedo);
+	ALBEDO = triplanar(world_pos, scale, adjusted_normal, albedo);
}
```

![Ground with triplanar](./Triplanar.png)

## Fixing Main Issues with the Current Implementation

The current implementation looks really good, but it doesn't have that AAA
quality that we are looking for. It mainly lacks:

- Normal and roughness textures support
- We can easily see texture repetition.
- Support for more than one biome.

### Fixing Texture Repetition

The c

Les's discus how we are going to fix texture repetition. There are many options
to accomplish this but they all have many problems. But in my opinion the best
way by far, to do this is to use something called stochastic sampling. I won't
go into details, in this tutorial so if you want to know how this works look at
those resources:

TODO: Add titles

- https://www.youtube.com/watch?v=yV4-MopMuMo
- https://eheitzresearch.wordpress.com/722-2/

Honesty implementing this right would take a lot of trial and error, but
thankfully there is a
![really really nice godot implementation that we can use](https://github.com/acegiak/Godot4TerrainShader/tree/main?tab=readme-ov-file).
And it is based on this ![unity implementation](https://pastebin.com/sDrnzYxB).
That is in in fact based on the paper that I've linked before. Go and give some
support to those people, this shader function works so great that it honestly
feels like magic.

```gdshader
//ground.gdshader
vec2 hash( vec2 p )
{
	return fract( sin( p * mat2( vec2( 127.1, 311.7 ), vec2( 269.5, 183.3 ) ) ) * 43758.5453 );
}
vec3  stochastic_sample(sampler2D albedo_texture, vec2 uv){
	vec2 skewV = mat2(vec2(1.0,1.0),vec2(-0.57735027 , 1.15470054))*uv * 3.464;

	vec2 vxID = floor(skewV);
	vec2 fracV = fract(skewV);
	vec3 barry = vec3(fracV.x,fracV.y,1.0-fracV.x-fracV.y);

	mat4 bw_vx = barry.z>0.0?
		mat4(vec4(vxID,0.0,0.0),vec4((vxID+vec2(0.0,1.0)),0.0,0.0),vec4(vxID+vec2(1.0,0.0),0,0),vec4(barry.zyx,0)):
		mat4(vec4(vxID+vec2(1.0,1.0),0.0,0.0),vec4((vxID+vec2(1.0,0.0)),0.0,0.0),vec4(vxID+vec2(0.0,1.0),0,0),vec4(-barry.z,1.0-barry.y,1.0-barry.x,0));

	vec2 ddx = dFdx(uv);
	vec2 ddy = dFdy(uv);


	vec2 uv_x = uv+hash(bw_vx[0].xy);
	vec2 uv_y = uv+hash(bw_vx[1].xy);
	vec2 uv_z = uv+hash(bw_vx[2].xy);

	return (textureGrad(albedo_texture,uv_x,ddx,ddy)*bw_vx[3].x) +
	(textureGrad(albedo_texture,uv_y,ddx,ddy)*bw_vx[3].y) +
	(textureGrad(albedo_texture,uv_z,ddx,ddy)*bw_vx[3].z);
}
```

Now we can use it in our code like this:

```diff lang="gdshader"
//ground.gdshader
...
+ vec2 hash( vec2 p )
+ {
+ 	return fract( sin( p * mat2( vec2( 127.1, 311.7 ), vec2( 269.5, 183.3 ) ) ) * 43758.5453 );
+ }
+ vec3  stochastic_sample(sampler2D albedo_texture, vec2 uv){
+ 	vec2 skewV = mat2(vec2(1.0,1.0),vec2(-0.57735027 , 1.15470054))*uv * 3.464;
+ 
+ 	vec2 vxID = floor(skewV);
+ 	vec2 fracV = fract(skewV);
+ 	vec3 barry = vec3(fracV.x,fracV.y,1.0-fracV.x-fracV.y);
+ 
+ 	mat4 bw_vx = barry.z>0.0?
+ 		mat4(vec4(vxID,0.0,0.0),vec4((vxID+vec2(0.0,1.0)),0.0,0.0),vec4(vxID+vec2(1.0,0.0),0,0),vec4(barry.zyx,0)):
+ 		mat4(vec4(vxID+vec2(1.0,1.0),0.0,0.0),vec4((vxID+vec2(1.0,0.0)),0.0,0.0),vec4(vxID+vec2(0.0,1.0),0,0),vec4(-barry.z,1.0-barry.y,1.0-barry.x,0));
+ 
+ 	vec2 ddx = dFdx(uv);
+ 	vec2 ddy = dFdy(uv);
+ 
+ 
+ 	vec2 uv_x = uv+hash(bw_vx[0].xy);
+ 	vec2 uv_y = uv+hash(bw_vx[1].xy);
+ 	vec2 uv_z = uv+hash(bw_vx[2].xy);
+ 
+ 	return (textureGrad(albedo_texture,uv_x,ddx,ddy)*bw_vx[3].x) +
+ 	(textureGrad(albedo_texture,uv_y,ddx,ddy)*bw_vx[3].y) +
+ 	(textureGrad(albedo_texture,uv_z,ddx,ddy)*bw_vx[3].z);
+ }

vec3 triplanar (vec3 position, float biome_scale,vec3 normal, sampler2D biome_texture){
	vec3 weights = normal / (normal.x + normal.y + normal.z) * 3.0;

	vec2 uv_x = position.zy;
	vec2 uv_y = position.xz;
	vec2 uv_z = position.xy;

	vec3 output = vec3(0,0,0);
	if (weights.x > 0.01){
-		output +=  texture(rock_texture, uv_x * rock_scale).rgb * weights.x;
+       output += stochastic_sample(rock_texture, uv_x * rock_scale).rgb * weights.x;
	}
	if (weights.y > 0.01){
-		output +=  texture(biome_texture, uv_y * biome_scale).rgb * weights.y;
+       output += stochastic_sample(biome_texture, uv_y * biome_scale).rgb * weights.y;
	}
	if (weights.z > 0.01){
-		output +=  texture(rock_texture, uv_z * rock_scale).rgb * weights.z;
+       output += stochastic_sample(rock_texture, uv_z * rock_scale).rgb * weights.z;
	}

	return output;
}
```

### Support for Normal and Roughness Textures

First we need to declear a data structure that will store all data at once.

```gdshader
struct NormalAlbedoRoughness{
	vec3 normal;
	vec3 albedo;
	vec3 roughness;
};
```

Than we need to modify some of the functions

```diff lang="gdshader"
- vec3  stochastic_sample(sampler2D albedo_texture, vec2 uv){
+ NormalAlbedoRoughness triple_stochastic_sample(sampler2D normal_texture,sampler2D albedo_texture,sampler2D roughness_texture, vec2 uv){
	vec2 skewV = mat2(vec2(1.0,1.0),vec2(-0.57735027 , 1.15470054))*uv * 3.464;

	vec2 vxID = floor(skewV);
	vec2 fracV = fract(skewV);
	vec3 barry = vec3(fracV.x,fracV.y,1.0-fracV.x-fracV.y);

	mat4 bw_vx = barry.z>0.0?
		mat4(vec4(vxID,0.0,0.0),vec4((vxID+vec2(0.0,1.0)),0.0,0.0),vec4(vxID+vec2(1.0,0.0),0,0),vec4(barry.zyx,0)):
		mat4(vec4(vxID+vec2(1.0,1.0),0.0,0.0),vec4((vxID+vec2(1.0,0.0)),0.0,0.0),vec4(vxID+vec2(0.0,1.0),0,0),vec4(-barry.z,1.0-barry.y,1.0-barry.x,0));

	vec2 ddx = dFdx(uv);
	vec2 ddy = dFdy(uv);


	vec2 uv_x = uv+hash(bw_vx[0].xy);
	vec2 uv_y = uv+hash(bw_vx[1].xy);
	vec2 uv_z = uv+hash(bw_vx[2].xy);

- 	return (textureGrad(albedo_texture,uv_x,ddx,ddy)*bw_vx[3].x) +
- 	(textureGrad(albedo_texture,uv_y,ddx,ddy)*bw_vx[3].y) +
- 	(textureGrad(albedo_texture,uv_z,ddx,ddy)*bw_vx[3].z);

+	vec4 normal = (textureGrad(normal_texture,uv_x,ddx,ddy)*bw_vx[3].x) +
+	(textureGrad(normal_texture,uv_y,ddx,ddy)*bw_vx[3].y) +
+	(textureGrad(normal_texture,uv_z,ddx,ddy)*bw_vx[3].z);
+
+	vec4 albedo = (textureGrad(albedo_texture,uv_x,ddx,ddy)*bw_vx[3].x) +
+	(textureGrad(albedo_texture,uv_y,ddx,ddy)*bw_vx[3].y) +
+	(textureGrad(albedo_texture,uv_z,ddx,ddy)*bw_vx[3].z);
+
+	vec4 roughness = (textureGrad(roughness_texture,uv_x,ddx,ddy)*bw_vx[3].x) +
+	(textureGrad(roughness_texture,uv_y,ddx,ddy)*bw_vx[3].y) +
+	(textureGrad(roughness_texture,uv_z,ddx,ddy)*bw_vx[3].z);
+
+	return NormalAlbedoRoughness(normal.xyz,albedo.xyz,roughness.xyz);

}
```

```diff lag="gdshader"
+uniform sampler2D rock_texture;
+uniform sampler2D rock_normal_map;
+uniform sampler2D rock_roughness;
-vec3 triplanar (vec3 position, float biome_scale,vec3 normal, sampler2D biome_texture){
+NormalAlbedoRoughness triple_stochastic_triplanar (vec3 position, vec3 worldNormal, vec3 adjusted_normal, float biome_scale,
+ sampler2D biome_normal_map, sampler2D biome_texture, sampler2D biome_roughness){
	vec3 weights = adjusted_normal / (adjusted_normal.x + adjusted_normal.y + adjusted_normal.z) * 3.0;

	vec2 uv_x = position.zy;
	vec2 uv_y = position.xz;
	vec2 uv_z = position.xy;

- vec3 output = vec3(0,0,0);
+	NormalAlbedoRoughness output = NormalAlbedoRoughness(vec3(0), vec3(0), vec3(0));
+	NormalAlbedoRoughness partial;
	if (weights.x > 0.01){

-      output += stochastic_sample(rock_texture, uv_x * rock_scale).rgb * weights.x;
+		partial = triple_stochastic_sample(rock_normal_map, rock_texture, rock_roughness, uv_x * rock_scale);
+		output.normal += partial.normal * weights.x;
+		output.albedo += partial.albedo * rock_saturation * weights.x;
+		output.roughness += partial.roughness * weights.x;
	}
	if (weights.y > 0.01){
-       output += stochastic_sample(biome_texture, uv_y * biome_scale).rgb * weights.y;
+		partial = triple_stochastic_sample(biome_normal_map, biome_texture, biome_roughness, uv_y * biome_scale);
+		output.normal += partial.normal * weights.y;
+		output.albedo += partial.albedo * rock_saturation * weights.y;
+		output.roughness += partial.roughness * weights.y;
	}
	if (weights.z > 0.01){
-       output += stochastic_sample(rock_texture, uv_z * rock_scale).rgb * weights.z;
+		partial = triple_stochastic_sample(rock_normal_map, rock_texture, rock_roughness, uv_z * rock_scale);
+		output.normal += partial.normal * weights.z;
+		output.albedo += partial.albedo * rock_saturation * weights.z;
+		output.roughness += partial.roughness * weights.z;
	}

	return output;
}
```

To make this work we would also have to change the `fragment()` function's
contents but we will be changing them with the next improvements so I will
ignore this part.

### Types of Biome Generation

One of the main goals of this project is implementing a code that will support
generating different biomes, that can have different properties, in a semi
realistic way.

There are many ways to acomplish this but these two are the most popular ones:

- Selecting biome based on the height.
- Generating biomes based on aspects that change across the map in a semi
  realistic way.

Height based generation is the easiest and the most popular, but the second
option gives us a lot more customization and makes the terrain feel a lot more
realistic. Also there are a lot of
[tutorials](https://www.youtube.com/watch?v=wbpMiKiSKm8&list=PLFt_AvWsXl0eBW2EiBtl_sxmDtSgZBxB3)
for the height based generation so feel free to explore this way of generating
the terrain.

In this tutorial I will be implementing terrain that will genetate biomes, and
based on them the whole terrain, based on generated terrain aspects. I will
explain the details of the implementation in depth later.

### Support for Multiple Biomes

Because of the choice of biome generation type, we need a way to read biome data
in the ground shader.\
We will do this by creating a texture containing that data . We will need to
create a separate texture for each of the terrain chunks. Each texture will
store biome data by assigning one color channel to one biome and using the value
of that color as the influence of that biome. This means that, for example, if
we want to use 10 biomes we will need to assign 3 textures for each biome
chunk.\
This is fine for small amount of biomes because the data doesn't have to have a
high resolution.\
This will be really easy to implement, and other ways of encoding the biome data
could face many difficulties.

That's enough of divagation, let's go back to implementing the shader.

#### Storing the Biome's Ground Textures

```gdshader
const int BIOMES_COUNT = 8;
uniform vec3[BIOMES_COUNT] texture_tint;
uniform float[BIOMES_COUNT] texture_color_gain;
uniform float[BIOMES_COUNT] texture_scale;
uniform sampler2D[BIOMES_COUNT] biome_albedo_textures;
uniform sampler2D[BIOMES_COUNT] biome_normal_textures;
uniform sampler2D[BIOMES_COUNT] biome_roughness_textures;
```

Each biome has to have separate data.

#### Using the Biome Data

Firs we need to implement a function that will take the biome's influence and
sample the needed textures. It will add to the output multiplied by the
influence of that biome.

```gdshader
void handle_biome(int biome, float influence, vec3 position, vec3 worldNormal, vec3 adjusted_normal, inout vec3 output_color, inout vec3 output_normal, inout vec3 output_roughness){
	if (influence < 0.01){
		return ;
	}

	NormalAlbedoRoughness output = triple_stochastic_triplanar(position, worldNormal, adjusted_normal, texture_scale[biome],biome_normal_textures[biome], biome_albedo_textures[biome],biome_roughness_textures[biome]);

	output_color += (output.albedo + texture_tint[biome] - vec3(1) * texture_color_gain[biome]) * influence;
	output_normal += output.normal * influence;
	output_roughness += output.roughness * influence;
}
```

Next we will need to collect the output of the previously implemented function
for each of the biomes.

```gdshader
NormalAlbedoRoughness collect_biome_data(vec4 biome_data_1, vec4 biome_data_2,vec3 world_pos, vec3 world_normal, vec3 adjusted_normal){
	vec3 output_color = vec3(0, 0, 0);
	vec3 output_normal = vec3(0, 0, 0);
	vec3 output_roughness = vec3(0, 0, 0);

	handle_biome(0, biome_data_1.r, world_pos, world_normal, adjusted_normal, output_color, output_normal, output_roughness);
	handle_biome(1, biome_data_1.g, world_pos, world_normal, adjusted_normal, output_color, output_normal, output_roughness);
	handle_biome(2, biome_data_1.b, world_pos, world_normal, adjusted_normal, output_color, output_normal, output_roughness);
	handle_biome(3, biome_data_1.a, world_pos, world_normal, adjusted_normal, output_color, output_normal, output_roughness);
	handle_biome(4, biome_data_2.r, world_pos, world_normal, adjusted_normal, output_color, output_normal, output_roughness);
	handle_biome(5, biome_data_2.g, world_pos, world_normal, adjusted_normal, output_color, output_normal, output_roughness);
	handle_biome(6, biome_data_2.b, world_pos, world_normal, adjusted_normal, output_color, output_normal, output_roughness);
	handle_biome(7, biome_data_2.a, world_pos, world_normal, adjusted_normal, output_color, output_normal, output_roughness);

	return NormalAlbedoRoughness(output_normal, output_color, output_roughness);
}
```

```diff lang="gdshader"
void fragment(){
	vec3 world_pos = (INV_VIEW_MATRIX * vec4(VERTEX, 1.0)).xyz;
	vec3 world_normal = normalize((INV_VIEW_MATRIX * vec4(NORMAL, 0.0)).xyz);
	vec3 adjusted_normal = pow(world_normal, vec3(8.0));


-	ALBEDO = triplanar(world_pos, scale, adjusted_normal, albedo);
+	vec4 biome_data_1 =texture(chunk_data_map_1[chunk_data_map_index],UV);
+	vec4 biome_data_2 =texture(chunk_data_map_2[chunk_data_map_index],UV);
+	NormalAlbedoRoughness output = collect_biome_data(biome_data_1, biome_data_2, world_pos, world_normal, adjusted_normal);
+	ALBEDO = output.albedo;
+	NORMAL_MAP = output.normal;
+	ROUGHNESS  = output.roughness.r;
}
```

## Some Final Processing

To give a bit more realistic output we can add a bit of final processing to the
output. Just use a noise texture to modify the albedo 'brightness', metalic, and
spectacular. Additionally we can change ganin and offset the final color.

```diff lang="gdshader"
+uniform sampler2D final_processing_noise;
+uniform float metallic;
+uniform float spectacular;
+uniform float global_brightness;
+uniform float global_saturation;

void fragment(){
	vec3 world_pos = (INV_VIEW_MATRIX * vec4(VERTEX, 1.0)).xyz;
	vec3 world_normal = normalize((INV_VIEW_MATRIX * vec4(NORMAL, 0.0)).xyz);
	vec3 adjusted_normal = pow(world_normal, vec3(8.0));


	vec4 biome_data_1 =texture(chunk_data_map_1[chunk_data_map_index],UV);
	vec4 biome_data_2 =texture(chunk_data_map_2[chunk_data_map_index],UV);
	NormalAlbedoRoughness output = collect_biome_data(biome_data_1, biome_data_2, world_pos, world_normal, adjusted_normal);
	ALBEDO = output.albedo;
	NORMAL_MAP = output.normal;
	ROUGHNESS = output.roughness.r;

+	ALBEDO *= global_color_gain;
+	ALBEDO *= mix(0.8, 1.2, texture(post_processing_noise, world_pos.xz).r);
+	ALBEDO -= vec3(1) * global_color_offset;
+	METALLIC = texture(post_processing_noise, world_pos.xz + vec2(1230,3210)).r * metallic;
+	SPECULAR = texture(post_processing_noise, world_pos.xz + vec2(4560,6540)).r* spectacular;
}
```

## Final Result

<details>

```gdshader
shader_type spatial;

struct NormalAlbedoRoughness{ vec3 normal; vec3 albedo; vec3 roughness; };

// Under the appache license
https://github.com/acegiak/Godot4TerrainShader/tree/main?tab=Apache-2.0-1-ov-file#readme
// Taken from the
https://github.com/acegiak/Godot4TerrainShader/blob/main/addons/terrain-shader/StochasticTexture.gdshader.
// Modified so that it works with multiple textures. '-' vec2 hash( vec2 p ) {
return fract( sin( p * mat2( vec2( 127.1, 311.7 ), vec2( 269.5, 183.3 ) ) ) *
43758.5453 ); } // 3 birds with one stone NormalAlbedoRoughness
triple_stochastic_sample(sampler2D normal_texture,sampler2D
albedo_texture,sampler2D roughness_texture, vec2 uv){ vec2 skewV =
mat2(vec2(1.0,1.0),vec2(-0.57735027 , 1.15470054))*uv * 3.464;

    vec2 vxID = floor(skewV);
    vec2 fracV = fract(skewV);
    vec3 barry = vec3(fracV.x,fracV.y,1.0-fracV.x-fracV.y);

    mat4 bw_vx = barry.z>0.0?
    	mat4(vec4(vxID,0.0,0.0),vec4((vxID+vec2(0.0,1.0)),0.0,0.0),vec4(vxID+vec2(1.0,0.0),0,0),vec4(barry.zyx,0)):
    	mat4(vec4(vxID+vec2(1.0,1.0),0.0,0.0),vec4((vxID+vec2(1.0,0.0)),0.0,0.0),vec4(vxID+vec2(0.0,1.0),0,0),vec4(-barry.z,1.0-barry.y,1.0-barry.x,0));

    vec2 ddx = dFdx(uv);
    vec2 ddy = dFdy(uv);


    vec2 uv_x = uv+hash(bw_vx[0].xy);
    vec2 uv_y = uv+hash(bw_vx[1].xy);
    vec2 uv_z = uv+hash(bw_vx[2].xy);

    vec4 normal = (textureGrad(normal_texture,uv_x,ddx,ddy)*bw_vx[3].x) +
    (textureGrad(normal_texture,uv_y,ddx,ddy)*bw_vx[3].y) +
    (textureGrad(normal_texture,uv_z,ddx,ddy)*bw_vx[3].z);

    vec4 albedo = (textureGrad(albedo_texture,uv_x,ddx,ddy)*bw_vx[3].x) +
    (textureGrad(albedo_texture,uv_y,ddx,ddy)*bw_vx[3].y) +
    (textureGrad(albedo_texture,uv_z,ddx,ddy)*bw_vx[3].z);

    vec4 roughness = (textureGrad(roughness_texture,uv_x,ddx,ddy)*bw_vx[3].x) +
    (textureGrad(roughness_texture,uv_y,ddx,ddy)*bw_vx[3].y) +
    (textureGrad(roughness_texture,uv_z,ddx,ddy)*bw_vx[3].z);

    return NormalAlbedoRoughness(normal.xyz,albedo.xyz,roughness.xyz);

} // Rest is written by me, _FR_.

const int BIOMES_COUNT = 8;

uniform float global_color_gain; uniform float global_color_offset;

uniform float rock_saturation; uniform float rock_scale; uniform sampler2D
rock_texture; uniform sampler2D rock_normal_map; uniform sampler2D
rock_roughness;

//WARN: this value HAS TO BE THE SAME as the one in the TerrianGen.cs !!! const
int chunk_data_maps_count = 517; instance uniform int chunk_data_map_index; //
repeat is disabled, so that the data from one end of the chunk doesn't influence
data form the other end of the chunk uniform sampler2D[chunk_data_maps_count]
chunk_data_map_1:repeat_disable; uniform
sampler2D[chunk_data_maps_count]chunk_data_map_2:repeat_disable;

uniform vec3[BIOMES_COUNT] texture_tint; uniform float[BIOMES_COUNT]
texture_color_gain; uniform float[BIOMES_COUNT] texture_scale; uniform
sampler2D[BIOMES_COUNT] biome_albedo_textures; uniform sampler2D[BIOMES_COUNT]
biome_normal_textures; uniform sampler2D[BIOMES_COUNT] biome_roughness_textures;

uniform int biome_texture_resolution;

uniform sampler2D post_processing_noise; uniform float metallic; uniform float
spectacular;

NormalAlbedoRoughness triple_stochastic_triplanar (vec3 position, vec3
worldNormal, vec3 adjusted_normal, float biome_scale, sampler2D
biome_normal_map, sampler2D biome_texture, sampler2D biome_roughness){ vec3
weights = adjusted_normal / (adjusted_normal.x + adjusted_normal.y +
adjusted_normal.z) * 3.0;

    vec2 uv_x = position.zy;
    vec2 uv_y = position.xz;
    vec2 uv_z = position.xy;

    NormalAlbedoRoughness output = NormalAlbedoRoughness(vec3(0), vec3(0), vec3(0));
    NormalAlbedoRoughness partial;
    if (weights.x > 0.01){
    	partial = triple_stochastic_sample(rock_normal_map, rock_texture, rock_roughness, uv_x * rock_scale);
    	output.normal += partial.normal * weights.x;
    	output.albedo += partial.albedo * rock_saturation * weights.x;
    	output.roughness += partial.roughness * weights.x;
    }
    if (weights.y > 0.01){
    	partial = triple_stochastic_sample(biome_normal_map, biome_texture, biome_roughness, uv_y * biome_scale);
    	output.normal += partial.normal * weights.y;
    	output.albedo += partial.albedo * rock_saturation * weights.y;
    	output.roughness += partial.roughness * weights.y;
    }
    if (weights.z > 0.01){
    	partial = triple_stochastic_sample(rock_normal_map, rock_texture, rock_roughness, uv_z * rock_scale);
    	output.normal += partial.normal * weights.z;
    	output.albedo += partial.albedo * rock_saturation * weights.z;
    	output.roughness += partial.roughness * weights.z;
    }

    return output;

}

void handle_biome(int biome, float influence, vec3 position, vec3 worldNormal,
vec3 adjusted_normal, inout vec3 output_color, inout vec3 output_normal, inout
vec3 output_roughness){ if (influence < 0.01){ return ; }

    NormalAlbedoRoughness output = triple_stochastic_triplanar(position, worldNormal, adjusted_normal, texture_scale[biome],biome_normal_textures[biome], biome_albedo_textures[biome],biome_roughness_textures[biome]);

    output_color += (output.albedo + texture_tint[biome] - vec3(1) * texture_color_gain[biome]) * influence;
    output_normal += output.normal * influence;
    output_roughness += output.roughness * influence;

}

NormalAlbedoRoughness collect_biome_data(vec4 biome_data_1, vec4
biome_data_2,vec3 world_pos, vec3 world_normal, vec3 adjusted_normal){ vec3
output_color = vec3(0, 0, 0); vec3 output_normal = vec3(0, 0, 0); vec3
output_roughness = vec3(0, 0, 0);

    handle_biome(0, biome_data_1.r, world_pos, world_normal, adjusted_normal, output_color, output_normal, output_roughness);
    handle_biome(1, biome_data_1.g, world_pos, world_normal, adjusted_normal, output_color, output_normal, output_roughness);
    handle_biome(2, biome_data_1.b, world_pos, world_normal, adjusted_normal, output_color, output_normal, output_roughness);
    handle_biome(3, biome_data_1.a, world_pos, world_normal, adjusted_normal, output_color, output_normal, output_roughness);
    handle_biome(4, biome_data_2.r, world_pos, world_normal, adjusted_normal, output_color, output_normal, output_roughness);
    handle_biome(5, biome_data_2.g, world_pos, world_normal, adjusted_normal, output_color, output_normal, output_roughness);
    handle_biome(6, biome_data_2.b, world_pos, world_normal, adjusted_normal, output_color, output_normal, output_roughness);
    handle_biome(7, biome_data_2.a, world_pos, world_normal, adjusted_normal, output_color, output_normal, output_roughness);

    return NormalAlbedoRoughness(output_normal, output_color, output_roughness);

}

void fragment(){ vec3 world_pos = (INV_VIEW_MATRIX * vec4(VERTEX, 1.0)).xyz;
vec3 world_normal = normalize((INV_VIEW_MATRIX * vec4(NORMAL, 0.0)).xyz); vec3
adjusted_normal = pow(world_normal, vec3(8.0));

    vec4 biome_data_1 =texture(chunk_data_map_1[chunk_data_map_index],UV);
    vec4 biome_data_2 =texture(chunk_data_map_2[chunk_data_map_index],UV);
    NormalAlbedoRoughness output = collect_biome_data(biome_data_1, biome_data_2, world_pos, world_normal, adjusted_normal);
    ALBEDO = output.albedo;
    NORMAL_MAP = output.normal;
    ROUGHNESS  = output.roughness.r;


    //apply processing

    ALBEDO *= global_color_gain;
    ALBEDO *= mix(0.8, 1.2, texture(post_processing_noise, world_pos.xz).r);
    ALBEDO -= vec3(1) * global_color_offset;
    METALLIC = texture(post_processing_noise, world_pos.xz + vec2(1230,3210)).r * metallic;
    SPECULAR = texture(post_processing_noise, world_pos.xz + vec2(4560,6540)).r* spectacular;

}
```

</details>

---

#### Bugs

If you find anything to improve in this project's code, please create an issue
describing it on the
[GitHub repository for this project](https://github.com/FilipRuman/procedural_terrain_generationV/2issues).
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
        data-term="ground shader"
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
