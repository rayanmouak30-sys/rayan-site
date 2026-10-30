// Nuage de pollution animé (zone dangereuse).
// "warning" = 1 : cercle rouge clignotant qui annonce l'arrivée du nuage.
shader_type canvas_item;

uniform sampler2D noise_tex : repeat_enable, filter_linear;
uniform vec4 color_a : source_color = vec4(0.36, 0.30, 0.14, 1.0);
uniform vec4 color_b : source_color = vec4(0.55, 0.85, 0.12, 1.0);
uniform float intensity : hint_range(0.0, 1.0) = 1.0;
uniform float warning : hint_range(0.0, 1.0) = 0.0;
uniform float seed = 0.0;

void fragment() {
	vec2 uv = UV - 0.5;
	float d = length(uv) * 2.0;
	float t = TIME * 0.05;
	float n1 = texture(noise_tex, UV * 0.8 + vec2(t + seed, t * 0.6)).r;
	float n2 = texture(noise_tex, UV * 1.7 - vec2(t * 1.3, seed - t)).r;
	float n = n1 * 0.6 + n2 * 0.4;
	float edge = 1.0 - smoothstep(0.55 + n * 0.25, 1.0, d);
	float a = edge * (0.5 + n * 0.5) * intensity;
	vec3 col = mix(color_a.rgb, color_b.rgb, smoothstep(0.35, 0.8, n));
	float ang = atan(uv.y, uv.x);
	float ring = (1.0 - smoothstep(0.0, 0.05, abs(d - 0.93))) * step(0.0, sin(ang * 14.0 + TIME * 3.0));
	ring *= warning * (0.6 + 0.4 * sin(TIME * 12.0));
	COLOR = vec4(mix(col, vec3(1.0, 0.25, 0.2), ring), max(a, ring));
}
