// Skin "Spectre" : arme d'énergie translucide, contours lumineux et lignes de balayage.
shader_type spatial;
render_mode blend_mix, depth_draw_always, cull_back, unshaded;

uniform vec4 couleur : source_color = vec4(0.5, 0.72, 1.0, 1.0);
uniform vec4 accent : source_color = vec4(0.75, 0.88, 1.0, 1.0);
uniform float echelle = 10.0;
varying vec3 p_obj;

void vertex() {
	p_obj = VERTEX;
}

void fragment() {
	float f = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 2.2);
	float balayage = smoothstep(0.9, 1.0, sin(p_obj.y * echelle * 3.0 - TIME * 5.0));
	float grille = smoothstep(0.96, 1.0, sin(p_obj.x * echelle * 8.0) * sin(p_obj.z * echelle * 8.0));
	ALBEDO = couleur.rgb * 0.25 + accent.rgb * (f * 1.4 + balayage * 0.8 + grille * 0.4);
	ALPHA = clamp(0.18 + f * 0.75 + balayage * 0.4, 0.0, 0.95);
}
