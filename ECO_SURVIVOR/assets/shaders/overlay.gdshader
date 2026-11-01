// Filtre d'écran : vignette + brume de pollution (augmente avec le niveau)
// + teinte verte dans un nuage toxique + flash rouge quand le joueur est blessé.
shader_type canvas_item;

uniform sampler2D noise_tex : repeat_enable, filter_linear;
uniform float pollution : hint_range(0.0, 1.0) = 0.0;
uniform float damage : hint_range(0.0, 1.0) = 0.0;
uniform float toxic : hint_range(0.0, 1.0) = 0.0;

vec4 over(vec4 top, vec4 bottom) {
	float a = top.a + bottom.a * (1.0 - top.a);
	vec3 rgb = (top.rgb * top.a + bottom.rgb * bottom.a * (1.0 - top.a)) / max(a, 0.0001);
	return vec4(rgb, a);
}

void fragment() {
	vec2 c = UV - 0.5;
	float vig = smoothstep(0.3, 0.85, length(c * vec2(1.3, 1.0)));
	float n = texture(noise_tex, UV * vec2(1.6, 0.9) + vec2(TIME * 0.012, TIME * 0.007)).r;
	vec4 acc = vec4(0.01, 0.04, 0.05, vig * 0.5);
	acc = over(vec4(mix(vec3(0.45, 0.40, 0.22), vec3(0.32, 0.38, 0.16), n), pollution * (0.3 + 0.5 * n) * (0.5 + 0.5 * vig)), acc);
	acc = over(vec4(0.45, 0.85, 0.1, toxic * (0.15 + 0.5 * vig)), acc);
	acc = over(vec4(0.9, 0.05, 0.1, damage * (0.15 + 0.7 * vig)), acc);
	COLOR = acc;
}
