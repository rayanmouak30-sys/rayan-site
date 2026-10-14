// Skins à effets (armes et personnages) : motifs calculés en 3D dans le repère de l'objet,
// donc sans coutures et sans dépendre des UV. Effets animés pour les skins rares.
shader_type spatial;
render_mode blend_mix, depth_draw_opaque, cull_back, diffuse_burley, specular_schlick_ggx;

uniform vec4 couleur : source_color = vec4(0.2, 0.22, 0.26, 1.0);
uniform vec4 couleur2 : source_color = vec4(0.35, 0.38, 0.44, 1.0);
uniform vec4 accent : source_color = vec4(0.48, 1.0, 0.83, 1.0);
uniform float metal : hint_range(0.0, 1.0) = 0.6;
uniform float rugosite : hint_range(0.0, 1.0) = 0.4;
// 0 aucun, 1 lignes, 2 magma, 3 carbone, 4 camo, 5 acide, 6 or, 7 holo, 8 écailles, 9 galaxie, 10 chrome, 11 cristal, 12 néon
uniform int effet = 0;
uniform float echelle = 10.0;
uniform float force_emission = 1.0;
uniform float usure = 0.35;

varying vec3 p_obj;
varying vec3 n_obj;

void vertex() {
	p_obj = VERTEX;
	n_obj = NORMAL;
}

float hash(vec3 p) {
	p = fract(p * 0.3183099 + 0.1);
	p *= 17.0;
	return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float bruit(vec3 x) {
	vec3 i = floor(x);
	vec3 f = fract(x);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(mix(hash(i + vec3(0, 0, 0)), hash(i + vec3(1, 0, 0)), f.x),
				   mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
			   mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x),
				   mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}

float fbm(vec3 p) {
	float v = 0.0;
	float a = 0.5;
	for (int i = 0; i < 5; i++) {
		v += a * bruit(p);
		p = p * 2.03 + vec3(1.7, 9.2, 3.1);
		a *= 0.5;
	}
	return v;
}

// Cellules (voronoï) : distance au point le plus proche
float cellules(vec3 p) {
	vec3 i = floor(p);
	vec3 f = fract(p);
	float d = 1.0;
	for (int x = -1; x <= 1; x++)
	for (int y = -1; y <= 1; y++)
	for (int z = -1; z <= 1; z++) {
		vec3 o = vec3(float(x), float(y), float(z));
		vec3 c = o + vec3(hash(i + o), hash(i + o + 7.1), hash(i + o + 13.7)) - f;
		d = min(d, dot(c, c));
	}
	return sqrt(d);
}

vec3 arc_en_ciel(float t) {
	return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67)));
}

void fragment() {
	vec3 p = p_obj * echelle;
	vec3 n = normalize(n_obj);
	float t = TIME;
	vec3 alb = couleur.rgb;
	vec3 emi = vec3(0.0);
	float met = metal;
	float rug = rugosite;
	// Usure commune : rayures et bords polis
	float u = fbm(p * 2.5);
	float rayures = smoothstep(0.62, 0.7, fbm(vec3(p.x * 9.0, p.y * 0.6, p.z * 9.0)));
	rug = clamp(rug + (u - 0.5) * 0.25 - rayures * 0.2 * usure, 0.04, 1.0);

	if (effet == 1) { // lignes néon qui parcourent l'arme
		float l = abs(fract(p.y * 0.8 + p.z * 0.3 - t * 0.35) - 0.5);
		float ligne = smoothstep(0.03, 0.0, l - 0.01);
		emi = accent.rgb * ligne * 2.5;
		alb = mix(couleur.rgb, couleur2.rgb, step(0.5, fract(p.x * 0.5 + p.y * 0.25)) * 0.4);
	} else if (effet == 2) { // magma : croûte sombre et fissures incandescentes
		float c = cellules(p * 0.9);
		float fissure = smoothstep(0.12, 0.0, abs(c - 0.55) - 0.02 + (fbm(p * 1.5) - 0.5) * 0.08);
		float pulse = 0.75 + 0.25 * sin(t * 2.0 + fbm(p) * 6.0);
		alb = mix(couleur.rgb, couleur2.rgb, fbm(p * 0.7));
		emi = accent.rgb * fissure * 3.0 * pulse;
		rug = mix(0.85, rug, fissure);
		met = 0.2;
	} else if (effet == 3) { // fibre de carbone tissée
		vec3 q = p * 3.0;
		float tissage = step(0.5, fract(q.x + q.z)) * step(0.5, fract(q.y));
		float fil = sin(q.x * 6.2832 + q.y * 6.2832) * 0.5 + 0.5;
		alb = mix(couleur.rgb, couleur2.rgb, mix(tissage, fil, 0.35) * 0.6);
		rug = 0.22 + fil * 0.1;
		met = 0.35;
	} else if (effet == 4) { // camouflage numérique
		vec3 q = floor(p * 1.5) / 1.5;
		float v = fbm(q * 0.6);
		alb = v < 0.45 ? couleur.rgb : (v < 0.58 ? couleur2.rgb : mix(couleur2.rgb, accent.rgb, 0.35));
		rug = 0.6;
		met = 0.15;
	} else if (effet == 5) { // acide : flaques lumineuses qui bougent
		float v = fbm(p * 0.8 + vec3(0.0, t * 0.25, t * 0.1));
		float flaque = smoothstep(0.55, 0.62, v);
		alb = mix(couleur.rgb, couleur2.rgb, v);
		emi = accent.rgb * flaque * (1.5 + 0.8 * sin(t * 3.0 + v * 10.0));
	} else if (effet == 6) { // or gravé
		float grav = smoothstep(0.08, 0.0, abs(sin(p.y * 3.0 + sin(p.z * 4.0) * 0.8 + sin(p.x * 3.0)) ) - 0.02);
		alb = mix(couleur.rgb, couleur2.rgb, grav * 0.8 + (u - 0.5) * 0.3);
		met = 1.0;
		rug = 0.18 + grav * 0.3;
	} else if (effet == 7) { // holographique : irisation selon l'angle de vue
		float f = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 1.5);
		vec3 iris = arc_en_ciel(f * 1.3 + p.y * 0.08 + t * 0.06);
		alb = mix(couleur.rgb, iris, 0.55);
		emi = iris * f * 0.6 + accent.rgb * smoothstep(0.96, 1.0, sin(p.y * 2.0 - t * 2.0)) * 1.2;
		met = 0.9;
		rug = 0.12;
	} else if (effet == 8) { // écailles de dragon
		vec3 q = p * 1.4;
		float c = cellules(vec3(q.x, q.y + floor(q.x) * 0.5, q.z));
		float bord = smoothstep(0.42, 0.5, c);
		alb = mix(couleur2.rgb, couleur.rgb, bord);
		emi = accent.rgb * smoothstep(0.55, 0.62, c) * (0.8 + 0.6 * sin(t * 1.5 + q.y));
		met = 0.7;
		rug = mix(0.25, 0.5, bord);
	} else if (effet == 9) { // galaxie : nébuleuse et étoiles qui défilent
		vec3 q = p * 0.6 + vec3(t * 0.04, 0.0, 0.0);
		float neb = fbm(q * 1.2);
		alb = mix(couleur.rgb, couleur2.rgb, neb);
		float etoile = step(0.985, hash(floor(p * 6.0 + vec3(0.0, 0.0, t * 0.5))));
		emi = mix(couleur2.rgb, accent.rgb, neb) * smoothstep(0.45, 0.8, neb) * 1.6 + vec3(etoile) * 2.0;
		met = 0.4;
		rug = 0.2;
	} else if (effet == 10) { // chrome poli
		met = 1.0;
		rug = 0.06 + rayures * 0.08;
		alb = mix(couleur.rgb, vec3(0.95), 0.25);
	} else if (effet == 11) { // cristal / glace
		float f = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 2.0);
		float facettes = cellules(p * 0.8);
		alb = mix(couleur.rgb, couleur2.rgb, facettes);
		emi = accent.rgb * (f * 1.2 + smoothstep(0.08, 0.0, abs(facettes - 0.5) - 0.01) * 0.6);
		met = 0.3;
		rug = 0.05;
	} else if (effet == 12) { // néon : base sombre et contours lumineux pulsés
		float bord = smoothstep(0.55, 0.62, cellules(p * 0.5));
		emi = accent.rgb * (bord * 2.2 + 0.25) * (0.8 + 0.2 * sin(t * 4.0));
		met = 0.5;
	}
	ALBEDO = alb;
	METALLIC = met;
	ROUGHNESS = rug;
	EMISSION = emi * force_emission;
}
