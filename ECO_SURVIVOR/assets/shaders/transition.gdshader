// Transition entre les scènes : des bulles qui grossissent depuis les bords.
shader_type canvas_item;

uniform float progress : hint_range(0.0, 1.0) = 0.0;
uniform vec4 color_a : source_color = vec4(0.03, 0.09, 0.11, 1.0);
uniform vec4 color_b : source_color = vec4(0.05, 0.24, 0.19, 1.0);
uniform float cell = 56.0;

void fragment() {
	vec2 res = 1.0 / SCREEN_PIXEL_SIZE;
	vec2 p = FRAGCOORD.xy;
	vec2 id = floor(p / cell);
	vec2 f = fract(p / cell) - 0.5;
	vec2 center = (id + 0.5) * cell;
	float dist = length(center - res * 0.5) / length(res * 0.5);
	float local = clamp(progress * 1.6 - (1.0 - dist) * 0.6, 0.0, 1.0);
	float r = local * 0.72;
	float a = 1.0 - smoothstep(r - 0.04, r, length(f));
	vec3 col = mix(color_a.rgb, color_b.rgb, clamp(UV.y + 0.2 * sin(UV.x * 3.0), 0.0, 1.0));
	COLOR = vec4(col, a * step(0.001, r));
}
