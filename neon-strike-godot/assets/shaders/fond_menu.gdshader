// Fond animé des menus : dégradé sombre, grille en perspective qui défile, halo de la couleur du héros, vignette.
shader_type canvas_item;

uniform vec4 teinte : source_color = vec4(0.49, 1.0, 0.83, 1.0);
uniform float force = 1.0;

float ligne(float x, float l) {
	return smoothstep(l, 0.0, abs(fract(x) - 0.5) - 0.5 + l);
}

void fragment() {
	vec2 uv = UV;
	vec3 c = mix(vec3(0.02, 0.025, 0.04), vec3(0.05, 0.06, 0.09), uv.y);
	// Grille au sol en perspective (bas de l'écran)
	float h = uv.y - 0.62;
	if (h > 0.0) {
		float z = 0.18 / h;
		float x = (uv.x - 0.5) * z * 2.0;
		float g = max(ligne(x * 1.5, 0.03), ligne(z * 1.5 + TIME * 0.6, 0.03));
		c += teinte.rgb * g * 0.18 * smoothstep(0.0, 0.25, h) * force;
	}
	// Halo derrière le personnage
	float d = length((uv - vec2(0.5, 0.48)) * vec2(1.6, 1.0));
	c += teinte.rgb * 0.22 * exp(-d * d * 6.0) * force;
	// Rayures diagonales très légères
	c += vec3(0.012) * step(0.5, fract((uv.x + uv.y) * 60.0 + TIME * 0.2));
	// Vignette
	c *= 1.0 - 0.55 * pow(length(uv - 0.5) * 1.3, 2.0);
	COLOR = vec4(c, 1.0);
}
