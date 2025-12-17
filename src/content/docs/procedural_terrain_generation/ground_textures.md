---
title: 2. ground textures
description: terrain_gen
---


Right now our terrain looks boring, let's change it.
We will be utilizing shaders for this. 

So let's start by setting material on the ground mesh to be a shader material.
Now create a gdshader and drag it onto the shader material.

![Shader material](./ground_textures_1.png)

For test I will write a simple shader that will set all ground color to one that we can select by hand in the editor. 

![Shader material](./ground_textures_2.png)

## What a ground shader needs to have for an procedurally generated terrain? 

Ground in read world looks different in different places. In the high mountains there in only ice and snow, in Europe you mainly have beautiful grassy terrain and a lot of trees. 
We can achieve this diversity in a couple different ways:

#### Reading biome data from a texture
This is the most versatile approach, so I will be using it in this project.
It allows you to easily generate biomes with different structures and vegetation, by just once generating a pseudo random texture saying what kind of biome this is.
#### Generating biomes by reading the height of the current mesh
You can just read at what height the current mesh is, and than just say that at eg. 1000m this is a mountain - rocks / snow and at eg. 100 m this is a dessert.
This is not as versatile because 

## Writing the final shader 

Let's start by reading biome map from a texture. Biome data will be split between a color channels on a 2 or more textures. 
This will allow for easy implementation of smooth transition between the biomes, and makes extending this system to allow more biomes as easy as using another texture.
Using a separate textures for biome influence and biome type selection would allow for efficient usage of many biome types, but would require a high resolution of input textures and would make implementation a lot harder.
### Example
* Texture1, Red: Dessert texture influence.
* Texture1, Blue: High mountain texture influence.
...
* Texture2, Red: Forest texture influence.
...
* Texture2, Alpha:  texture influence.


```gdshader
uniform sampler2D map_1;
uniform sampler2D map_2;
void fragment(){
vec4 biome_types = texture(biome_type_map,UV);
vec4 biome_influences = texture(biome_influence_map,UV);
}
```
Next we will need to calculate world position and normals, this will be needed for Triplanar mapping - technique that will allow for smooth textures and drawing rock textures on slopes. 
Also I've added 'adjusted_normal' variable for normal map that will give better results for triplanar mapping.
```gdshader
void fragment(){
	vec3 world_pos = (INV_VIEW_MATRIX * vec4(VERTEX, 1.0)).xyz;
	vec3 world_normal = normalize((INV_VIEW_MATRIX * vec4(NORMAL, 0.0)).xyz);
	vec3 adjusted_normal = pow(abs(world_normal), vec3(8.0));
}
```


To implement triplanar mapping we will use data that we've callculated, and a rock texture.
We will read texture 3 times so with apropriate weights for each uv direction so that the texutres don't get streached in one of the orientation like in normal linear mapping.
Also we need to apply some scaling so that we can later modify scale of our textures. This is as easy as multiplying the uv vector.  
To Draw rock texture on the slopes we will replace the standard texture with the rock texture for the faces that don't face up - X and Z;

```gdshader
uniform float rock_saturation;
uniform float rock_scale;
uniform sampler2D rock_texture; 
vec3 triplanar (vec3 position, vec3 worldNormal,vec3 adjusted_normal, sampler2D sampler,float scale){
	vec3 weights = adjusted_normal / (adjusted_normal.x + adjusted_normal.y + adjusted_normal.z) * 3.0;
	
	vec2 uv_x = position.zy;
	vec2 uv_y = position.xz;
	vec2 uv_z = position.xy;
	
	vec3 color = vec3(0,0,0); 
	if (weights.x > 0.01){
		color += texture(rock_texture, uv_x * rock_scale).rgb * weights.x  * rock_saturation;
	}
	if (weights.y > 0.01){
		color += texture(sampler, uv_y * scale).rgb * weights.y;
	}	
	if (weights.z > 0.01){
		color += texture(rock_texture, uv_z * rock_scale).rgb * weights.z  * rock_saturation;
	}	
	
	return color / 3.0;
}
```

Now we need a function that will actually utilize this.
It will be adding calculated color to the input color.
We will be sampling texture of ground on a specified biome, using the Triplanar function, than applying some basic processing and adding it onto the input color with specified influence.    
``` gdshader

const int BIOMES_COUNT = 8;
uniform vec3[BIOMES_COUNT] texture_tint;
uniform float[BIOMES_COUNT] texture_saturation; 
uniform float[BIOMES_COUNT] texture_scale;
uniform sampler2D[BIOMES_COUNT] biome_textures;

vec3 handle_biome_color(vec3 input_color, float type_float, float influence, vec3 position, vec3 worldNormal, vec3 adjusted_normal){
	int type = int(type_float * 255.0);

	if (type == 0){
	return input_color;
	}

	int biome = type - 1;
	vec3 texture_color = triplanar(position, worldNormal, adjusted_normal, biome_textures[biome], texture_scale[biome]);
	vec3 biome_color = (texture_color + texture_tint[biome] - vec3(1) * texture_saturation[biome]) * influence;
	
	return input_color + biome_color;
}
```

now let's combine all of the things that we wrote. 
We will call the `handle_biome_color` function for each biome type input color, and collect their output.   
Then set the output color as albedo and apply some basic processing to get the final output.
``` gdshader

uniform float global_brightness;
uniform float global_saturation;
void fragment(){
	vec3 world_pos = (INV_VIEW_MATRIX * vec4(VERTEX, 1.0)).xyz;
	vec3 world_normal = normalize((INV_VIEW_MATRIX * vec4(NORMAL, 0.0)).xyz);
	vec3 adjusted_normal = pow(abs(world_normal), vec3(8.0));
	
	vec4 biome_types = texture(biome_type_map,UV);
	vec4 biome_influences = texture(biome_influence_map,UV);

	vec4 color_1 = texture(map_1,UV);
	vec4 color_2 = texture(map_2,UV);

	vec3 output_color = vec3(0,0,0);
	output_color = handle_biome_color(output_color, 0, color_1.r, world_pos, world_normal, adjusted_normal);
	output_color = handle_biome_color(output_color, 1, color_1.g, world_pos, world_normal, adjusted_normal);
	output_color = handle_biome_color(output_color, 2, color_1.b, world_pos, world_normal, adjusted_normal);
	output_color = handle_biome_color(output_color, 3, color_1.a, world_pos, world_normal, adjusted_normal);
	output_color = handle_biome_color(output_color, 4, color_2.r, world_pos, world_normal, adjusted_normal);
	output_color = handle_biome_color(output_color, 5, color_2.g, world_pos, world_normal, adjusted_normal);
	output_color = handle_biome_color(output_color, 6, color_2.b, world_pos, world_normal, adjusted_normal);
	output_color = handle_biome_color(output_color, 7, color_2.a, world_pos, world_normal, adjusted_normal);
	ALBEDO =output_color;

	ALBEDO *= global_brightness;
	ALBEDO -= vec3(1) * global_saturation;
}
```
## Testing this shader
We don't yet have a way to generate biome data textures, so we will need to improvise.
In the editor we will just use a simple gradient texture with each one of the RGBA colors representing influence of one of the biomes.

![ground](./ground_textures_biome_maps_config.png)


Next we need to set the textures - set 4 first texture slots in the Textures field and remember to set the rock texture.

![ground](./ground_textures_4.png)


The last thing we need to do is to set the global and biome texture specific: Saturation, tint and scale.
You need to chose them by experimentation, because different values will look good for different textures, but for me those values worked best:

Global brightness: 0.6
Global saturation: 0.0
Rock saturation: 0.5
Rock scale: 0.4

Tint: all textures to black - no tint
Texture saturation: 0.1 -> 0.3 
Texture scale: 0.2 -> 0.8 

Result:
![ground](./ground_textures_6.png)


![ground](./ground_textures_result_without_noise.png)


The terrain looks nice, but we can easily see repetition on some of the textures, and the transitions between the biomes don't tool real enough. 

## Adding noise
Adding some simple noise will make our terrain look more random - like real life terrain.
So we will add it to:
* Texture color- Multiply the output color by a tiny bit to make the textures just a tiny bit more interesting.
* UV- Add some offset to the current UV, this is needed to make texture transitions look more random.
* Texture sampling position- Add some offset to the `world_pos` variable to stop the terrain textures from having obvious patterns, that repeat.
* Roughness- Change the roughness a tiny bit with the noise, to make the terrain look more 'wet' at some spots.

```cs
uniform sampler2D uv_noise_texture;
uniform sampler2D texture_repetition_noise;
uniform vec2 uv_noise_strength; 
uniform vec3 texture_noise_strenght;

uniform sampler2D roughness_gradient;
uniform sampler2D noise;

void fragment(){
...
	world_pos += texture(texture_repetition_noise,UV).r * texture_noise_strenght;

	float uv_noise = texture(uv_noise_texture,UV).r;
	
	vec2 noisy_uv = UV+uv_noise* uv_noise_strength;
	vec4 color_1 = texture(map_1,noisy_uv);
	vec4 color_2 = texture(map_2,noisy_uv);

..
	ALBEDO *= mix(0.9, 1.1, texture(noise,UV).r);
	ROUGHNESS =texture(roughness_gradient,texture(noise,UV).rg).r ;
	METALLIC = 0.0;
}
```

The change is that simple, but it will make a **HUGE** difference.

I have used Vornoi diagram like noise for both the texture and uv noise, because it seamed to give the best results, but feel free to experiment, with noise types, yourself.

![Uv noise](./ground_textures_uv_noise.png)

![Texture noise](./ground_textures_texture_noise.png)


![Noise](./ground_textures_noise.png)
 

![Roughness](./ground_textures_roughness.png)


## Results


![Result1](./ground_textures_result_1.png)


![Result2](./ground_textures_result_2.png)

## Final code

And in the end we should have something like this:
```gdshader
shader_type spatial;
const int BIOMES_COUNT = 8;

uniform float global_brightness;
uniform float global_saturation;

uniform float rock_saturation;
uniform float rock_scale;
uniform sampler2D rock_texture;
uniform sampler2D uv_noise_texture;
uniform sampler2D texture_repetition_noise;
uniform vec2 uv_noise_strength; 
uniform vec3 texture_noise_strenght;

uniform sampler2D roughness_gradient;
uniform sampler2D noise;
uniform sampler2D map_1;
uniform sampler2D map_2;

uniform vec3[BIOMES_COUNT] texture_tint;
uniform float[BIOMES_COUNT] texture_saturation;
uniform float[BIOMES_COUNT] texture_scale;
uniform sampler2D[BIOMES_COUNT] biome_textures;

vec3 triplanar (vec3 position, vec3 worldNormal,vec3 adjusted_normal, sampler2D sampler,float scale){
	vec3 weights = adjusted_normal / (adjusted_normal.x + adjusted_normal.y + adjusted_normal.z) * 3.0;

	vec2 uv_x = position.zy;
	vec2 uv_y = position.xz;
	vec2 uv_z = position.xy;

	vec3 color = vec3(0,0,0);
	if (weights.x > 0.01)
		color += texture(rock_texture, uv_x * rock_scale).rgb * weights.x  * rock_saturation;
	if (weights.y > 0.01)
		color += texture(sampler, uv_y * scale).rgb * weights.y;
	if (weights.z > 0.01)
		color += texture(rock_texture, uv_z * rock_scale).rgb * weights.z  * rock_saturation;

	return color / 3.0;
}

vec3 handle_biome_color(vec3 input_color, int type, float influence, vec3 position, vec3 worldNormal, vec3 adjusted_normal){

	if (type == 0 || influence < 0.01) return input_color;
	

	int biome = type - 1;
	vec3 texture_color = triplanar(position, worldNormal, adjusted_normal, biome_textures[biome], texture_scale[biome]);
	vec3 biome_color = (texture_color + texture_tint[biome] - vec3(1) * texture_saturation[biome]) * influence;

	return input_color + biome_color;
}

void fragment(){
	vec3 world_pos = (INV_VIEW_MATRIX * vec4(VERTEX, 1.0)).xyz;
	vec3 world_normal = normalize((INV_VIEW_MATRIX * vec4(NORMAL, 0.0)).xyz);
	vec3 adjusted_normal = pow(abs(world_normal), vec3(8.0));
	world_pos += texture(texture_repetition_noise,UV).r * texture_noise_strenght;

	float uv_noise = texture(uv_noise_texture,UV).r;
	
	vec2 noisy_uv = UV+uv_noise* uv_noise_strength;
	vec4 color_1 = texture(map_1,noisy_uv);
	vec4 color_2 = texture(map_2,noisy_uv);

	vec3 output_color = vec3(0,0,0);
	output_color = handle_biome_color(output_color, 0, color_1.r, world_pos, world_normal, adjusted_normal);
	output_color = handle_biome_color(output_color, 1, color_1.g, world_pos, world_normal, adjusted_normal);
	output_color = handle_biome_color(output_color, 2, color_1.b, world_pos, world_normal, adjusted_normal);
	output_color = handle_biome_color(output_color, 3, color_1.a, world_pos, world_normal, adjusted_normal);
	output_color = handle_biome_color(output_color, 4, color_2.r, world_pos, world_normal, adjusted_normal);
	output_color = handle_biome_color(output_color, 5, color_2.g, world_pos, world_normal, adjusted_normal);
	output_color = handle_biome_color(output_color, 6, color_2.b, world_pos, world_normal, adjusted_normal);
	output_color = handle_biome_color(output_color, 7, color_2.a, world_pos, world_normal, adjusted_normal);
	ALBEDO =output_color;

	ALBEDO *= global_brightness;

	ALBEDO *= mix(0.9, 1.1, texture(noise,UV).r);
	ALBEDO -= vec3(1) * global_saturation; 
	ROUGHNESS =texture(roughness_gradient,texture(noise,UV).rg).r ;
	METALLIC = 0.0;
}
```

