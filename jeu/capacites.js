// Les 80 capacités des personnages (4 par personnage), décrites par des données.
// Chaque capacité appartient à une "famille" d'effet programmée dans competences.js (grenade, mur, soin...)
// et règle ses propres valeurs (dégâts, durée, rayon, recharge, prix). Ajouter une capacité = ajouter une entrée.
//
// Emplacements : C et A/Q s'achètent en Spike/Élimination (charges), E se recharge seule, X demande des points d'ultime.
// En Deathmatch, au stand et en ligne, C et A/Q se rechargent aussi avec le temps.
import { HEROS } from "./heros.js";

export const EMPLACEMENTS = ["c", "q", "e", "x"];
// Actions de controles.js correspondant à chaque emplacement (les identifiants historiques sont gardés)
export const ACTIONS_EMPLACEMENTS = { c: "fumee", q: "flash", e: "signature", x: "ultime" };

export const CAPACITES = {
  // ---------- KAEL ----------
  kael_charge: { nom: "Charge à fragmentation", famille: "grenade", effet: "explosion", icone: "explosion", fusee: 1.5, degats: 90, rayon: 4.5, prix: 200, charges: 1, recharge: 35,
    texte: "Grenade qui rebondit puis explose après 1,5 s : jusqu'à 90 dégâts dans 4,5 m." },
  kael_eclat: { nom: "Éclat aveuglant", famille: "grenade", effet: "flash", icone: "flash", fusee: 0.6, prix: 200, charges: 2, recharge: 25,
    texte: "Flash à détonation rapide (0,6 s). Aveugle tous ceux qui la regardent." },
  kael_propulsion: { nom: "Propulsion", famille: "ruee", icone: "ruee", vitesse: 30, duree: 0.27, charges: 1, recharge: 9,
    texte: "Les propulseurs dorsaux projettent Kael de 6 m dans la direction du mouvement." },
  kael_assaut: { nom: "Assaut total", famille: "buff", icone: "surcharge", points: 6, duree: 10, cadence: 0.25, vitesse: 0.15, rechargeRapide: true,
    texte: "10 s : cadence +25 %, vitesse +15 % et rechargement deux fois plus rapide." },

  // ---------- VEXA ----------
  vexa_saut: { nom: "Saut vectoriel", famille: "saut", icone: "saut", impulsion: 8.8, prix: 150, charges: 2, recharge: 12,
    texte: "Bond vertical de près de 4 m pour prendre un angle en hauteur." },
  vexa_voile: { nom: "Voile éclair", famille: "grenade", effet: "fumee", icone: "fumee", vitesse: 9, duree: 6, couleur: 0xc89ab8, prix: 100, charges: 2, recharge: 20,
    texte: "Petite fumée lancée à courte portée : bloque la vue pendant 6 s." },
  vexa_pas: { nom: "Pas de l'ombre", famille: "blink", icone: "blink", portee: 8, charges: 1, recharge: 12,
    texte: "Téléportation instantanée jusqu'à 8 m devant soi (jamais à travers un mur)." },
  vexa_frenesie: { nom: "Frénésie", famille: "frenesie", icone: "frenesie", points: 7, duree: 14, vitesse: 0.1,
    texte: "14 s : chaque élimination rend 50 PV et recharge Pas de l'ombre. Vitesse +10 %." },

  // ---------- BRAX ----------
  brax_commotion: { nom: "Grenade sonique", famille: "grenade", effet: "commotion", icone: "commotion", fusee: 1.1, rayon: 5, duree: 3, prix: 200, charges: 1, recharge: 30,
    texte: "Onde de choc : ralentit et dérègle la visée des ennemis touchés pendant 3 s." },
  brax_plaques: { nom: "Plaques réactives", famille: "buff", icone: "armure", armure: 40, prix: 300, charges: 1, recharge: 40,
    texte: "Ajoute 40 de bouclier (sans dépasser 100)." },
  brax_belier: { nom: "Charge du bélier", famille: "charge", icone: "charge", duree: 0.45, vitesse: 15, degats: 45, commotion: 1.5, charges: 1, recharge: 14,
    texte: "Fonce sur 7 m : 45 dégâts et commotion aux ennemis percutés." },
  brax_seisme: { nom: "Onde sismique", famille: "seisme", icone: "seisme", points: 7, rayon: 9, degats: 65, ralenti: 3, delai: 0.45,
    texte: "Frappe le sol : 65 dégâts et ralentissement de 3 s dans un rayon de 9 m." },

  // ---------- NYRA ----------
  nyra_plasma: { nom: "Cocktail plasma", famille: "grenade", effet: "feu", icone: "feu", dps: 35, rayon: 3.2, duree: 5, couleur: 0xff7a2a, prix: 250, charges: 1, recharge: 35,
    texte: "Zone de plasma au sol pendant 5 s : 35 dégâts par seconde aux ennemis dedans." },
  nyra_flare: { nom: "Fusée éclairante", famille: "grenade", effet: "flash", icone: "flash", fusee: 0.5, vitesse: 19, prix: 200, charges: 2, recharge: 25,
    texte: "Flash très rapide (0,5 s) lancée loin." },
  nyra_coeur: { nom: "Cœur ardent", famille: "buff", icone: "soin", soin: 40, dureeSoin: 2, cadence: 0.15, duree: 5, condition: "blesse", charges: 1, recharge: 25,
    texte: "Rend 40 PV en 2 s et augmente la cadence de 15 % pendant 5 s." },
  nyra_supernova: { nom: "Supernova", famille: "cible", effet: "frappe", icone: "frappe", points: 7, portee: 40, degats: 150, rayon: 6, delai: 1.6, nombre: 1, dispersion: 0, couleur: 0xff8a2a,
    texte: "Une bombe de plasma tombe sur le point visé (40 m) et explose 1,6 s plus tard : 150 dégâts au centre." },

  // ---------- TITAN ----------
  titan_plaque: { nom: "Plaque d'acier", famille: "buff", icone: "armure", armure: 50, prix: 300, charges: 1, recharge: 40,
    texte: "Ajoute 50 de bouclier (sans dépasser 100)." },
  titan_bouclier: { nom: "Bouclier déployable", famille: "mur", icone: "mur", longueur: 2.2, vie: 450, duree: 20, couleur: 0x7fb8ff, prix: 200, charges: 1, recharge: 30,
    texte: "Petit bouclier de 2,2 m pendant 20 s, idéal pour couvrir un angle." },
  titan_barriere: { nom: "Barrière titan", famille: "mur", icone: "mur", longueur: 6, vie: 900, duree: 14, couleur: 0x6aa8ff, charges: 1, recharge: 35,
    texte: "Grand mur d'énergie de 6 m pendant 14 s (900 points de résistance)." },
  titan_rempart: { nom: "Rempart vivant", famille: "equipe", icone: "bastion", points: 7, rayon: 0, armure: 50, soin: 50,
    texte: "Toute l'équipe reçoit 50 de bouclier et 50 PV." },

  // ---------- AEGIS ----------
  aegis_champ: { nom: "Champ réparateur", famille: "grenade", effet: "soin", icone: "soinZone", rayon: 3.6, hps: 15, duree: 6, couleur: 0x8ab4ff, prix: 200, charges: 1, recharge: 35,
    texte: "Zone qui soigne les alliés de 15 PV par seconde pendant 6 s." },
  aegis_repulsion: { nom: "Pulsion répulsive", famille: "grenade", effet: "commotion", icone: "commotion", fusee: 0.9, rayon: 4.5, duree: 2.5, prix: 200, charges: 1, recharge: 30,
    texte: "Commotion de 2,5 s dans un rayon de 4,5 m." },
  aegis_mur: { nom: "Mur des Archives", famille: "mur", icone: "mur", longueur: 4.5, vie: 650, duree: 14, couleur: 0xa8c8ff, charges: 1, recharge: 35,
    texte: "Mur d'énergie de 4,5 m pendant 14 s." },
  aegis_egide: { nom: "Égide", famille: "equipe", icone: "bastion", points: 7, rayon: 0, armure: 75, soin: 25,
    texte: "Toute l'équipe reçoit 75 de bouclier et 25 PV." },

  // ---------- ROKAN ----------
  rokan_mine: { nom: "Mine sismique", famille: "piege", icone: "piege", declencheur: 2.2, ralenti: 3, revele: 4, degats: 25, couleur: 0x9cff3a, prix: 200, charges: 2, recharge: 25,
    texte: "Mine posée devant soi : l'ennemi qui passe prend 25 dégâts, est ralenti 3 s et révélé 4 s." },
  rokan_frag: { nom: "Grenade frag", famille: "grenade", effet: "explosion", icone: "explosion", fusee: 1.7, degats: 80, rayon: 4.5, prix: 250, charges: 1, recharge: 35,
    texte: "Grenade classique : jusqu'à 80 dégâts dans 4,5 m." },
  rokan_tourelle: { nom: "Tourelle automatique", famille: "tourelle", icone: "tourelle", duree: 25, degats: 9, cadence: 0.24, portee: 28, vie: 160, charges: 1, recharge: 40,
    texte: "Tourelle qui tire sur les ennemis visibles à 28 m pendant 25 s. On peut la détruire." },
  rokan_barrage: { nom: "Barrage d'artillerie", famille: "cible", effet: "frappe", icone: "frappe", points: 7, portee: 45, degats: 70, rayon: 3.5, delai: 1.2, nombre: 6, dispersion: 5, couleur: 0xffd166,
    texte: "Six obus tombent autour du point visé (45 m) : 70 dégâts chacun." },

  // ---------- FROST ----------
  frost_fil: { nom: "Fil glacé", famille: "piege", icone: "piege", declencheur: 2.4, ralenti: 4, revele: 4, degats: 0, couleur: 0x9fe8ff, prix: 150, charges: 2, recharge: 25,
    texte: "Piège invisible pour l'ennemi : celui qui passe est gelé (ralenti 4 s) et révélé." },
  frost_givre: { nom: "Grenade givrante", famille: "grenade", effet: "ralenti", icone: "glace", rayon: 4.5, duree: 6, facteur: 0.45, dps: 6, couleur: 0x9fe8ff, prix: 200, charges: 1, recharge: 30,
    texte: "Zone de givre de 6 s : les ennemis dedans avancent à 45 % de leur vitesse." },
  frost_mur: { nom: "Mur de glace", famille: "mur", icone: "mur", longueur: 5, vie: 1000, duree: 16, couleur: 0xcff4ff, charges: 1, recharge: 40,
    texte: "Mur de glace de 5 m très résistant (1000) pendant 16 s." },
  frost_blizzard: { nom: "Blizzard", famille: "cible", effet: "ralenti", icone: "glace", points: 7, portee: 45, rayon: 9, duree: 7, facteur: 0.4, dps: 10, couleur: 0xcff4ff,
    texte: "Tempête de 9 m sur le point visé pendant 7 s : ennemis ralentis à 40 % et 10 dégâts/s." },

  // ---------- ECHO ----------
  echo_fleche: { nom: "Flèche sonar", famille: "grenade", effet: "sonar", icone: "fleche", vitesse: 24, rayon: 14, pulses: 2, couleur: 0x5affd1, prix: 150, charges: 2, recharge: 25,
    texte: "Flèche qui se plante et envoie 2 impulsions : révèle les ennemis à 14 m en vue directe." },
  echo_onde: { nom: "Onde de choc", famille: "grenade", effet: "commotion", icone: "commotion", fusee: 1, rayon: 5, duree: 3, prix: 200, charges: 1, recharge: 30,
    texte: "Commotion de 3 s dans un rayon de 5 m." },
  echo_ecoute: { nom: "Écoute", famille: "sonar", icone: "sonar", rayon: 22, duree: 3, charges: 1, recharge: 25,
    texte: "Révèle à travers les murs tous les ennemis à moins de 22 m pendant 3 s." },
  echo_resonance: { nom: "Résonance totale", famille: "sonar", icone: "sonar", points: 7, rayon: 0, duree: 7,
    texte: "Révèle tous les ennemis de la carte pendant 7 s." },

  // ---------- GHOST ----------
  ghost_camo: { nom: "Camouflage", famille: "camo", icone: "camo", duree: 6, prix: 300, charges: 1, recharge: 35,
    texte: "Invisible pendant 6 s (tirer révèle brièvement). Les ennemis ne te repèrent qu'à bout portant." },
  ghost_flash: { nom: "Éclipse", famille: "grenade", effet: "flash", icone: "flash", fusee: 0.75, prix: 200, charges: 2, recharge: 25,
    texte: "Grenade aveuglante." },
  ghost_drone: { nom: "Drone furtif", famille: "drone", icone: "drone", duree: 7, charges: 1, recharge: 30,
    texte: "Drone qui avance 7 s et révèle les ennemis qu'il voit." },
  ghost_ombre: { nom: "Ombre totale", famille: "camo", icone: "camo", points: 7, duree: 12, vitesse: 0.2,
    texte: "Invisible pendant 12 s et vitesse +20 %." },

  // ---------- ORION ----------
  orion_drone: { nom: "Lyra", famille: "drone", icone: "drone", duree: 6, prix: 300, charges: 1, recharge: 35,
    texte: "Le drone Lyra part en éclaireur et révèle les ennemis qu'il voit." },
  orion_balise: { nom: "Balise traqueuse", famille: "grenade", effet: "sonar", icone: "fleche", vitesse: 22, rayon: 10, pulses: 3, couleur: 0xffc845, prix: 150, charges: 1, recharge: 25,
    texte: "Balise qui envoie 3 impulsions : révèle les ennemis à 10 m en vue directe." },
  orion_marque: { nom: "Marque du chasseur", famille: "cone", icone: "cone", portee: 40, angle: 50, duree: 4, charges: 1, recharge: 22,
    texte: "Révèle à travers les murs les ennemis devant toi (cône de 50°, 40 m) pendant 4 s." },
  orion_chasse: { nom: "Chasse ouverte", famille: "sonar", icone: "sonar", points: 7, rayon: 0, duree: 8, vitesse: 0.1,
    texte: "Révèle tous les ennemis pendant 8 s et +10 % de vitesse." },

  // ---------- KIRA ----------
  kira_flash: { nom: "Flash ricochet", famille: "grenade", effet: "flash", icone: "flash", fusee: 0.8, prix: 200, charges: 2, recharge: 25,
    texte: "Flash qui rebondit sur les murs avant d'exploser." },
  kira_lame: { nom: "Lame traqueuse", famille: "grenade", effet: "sonar", icone: "fleche", vitesse: 26, rayon: 9, pulses: 1, degats: 15, couleur: 0xfff07a, prix: 150, charges: 1, recharge: 25,
    texte: "Lame lancée qui révèle les ennemis à 9 m de son impact." },
  kira_pas: { nom: "Pas de lumière", famille: "ruee", icone: "ruee", vitesse: 30, duree: 0.27, charges: 2, recharge: 10,
    texte: "Ruée de 6 m. Deux charges." },
  kira_tempete: { nom: "Tempête d'éclats", famille: "cible", effet: "multiFlash", icone: "flash", points: 6, portee: 35, nombre: 3, couleur: 0xfff07a,
    texte: "Trois flashs éclatent autour du point visé et révèlent la zone." },

  // ---------- NEXUS ----------
  nexus_puits: { nom: "Puits gravitationnel", famille: "grenade", effet: "ralenti", icone: "ralenti", rayon: 4.5, duree: 5, facteur: 0.5, dps: 0, couleur: 0xb07cff, prix: 200, charges: 1, recharge: 30,
    texte: "Zone de gravité de 5 s : les ennemis dedans avancent à moitié vitesse." },
  nexus_voile: { nom: "Voile du vide", famille: "cible", effet: "fumee", icone: "fumee", portee: 35, duree: 14, couleur: 0x6a4a9a, prix: 150, charges: 2, recharge: 30,
    texte: "Fait apparaître une fumée violette sur le point visé (35 m) pendant 14 s." },
  nexus_distorsion: { nom: "Distorsion", famille: "blink", icone: "blink", portee: 10, charges: 1, recharge: 14,
    texte: "Téléportation jusqu'à 10 m devant soi." },
  nexus_trouNoir: { nom: "Trou noir", famille: "cible", effet: "trouNoir", icone: "trouNoir", points: 8, portee: 40, rayon: 7, duree: 3.5, degats: 70, couleur: 0xb07cff,
    texte: "Singularité sur le point visé : aspire les ennemis pendant 3,5 s puis inflige 70 dégâts." },

  // ---------- MIST ----------
  mist_nuage: { nom: "Nuage", famille: "grenade", effet: "fumee", icone: "fumee", duree: 15, couleur: 0xa9b4c6, prix: 100, charges: 2, recharge: 25,
    texte: "Fumée classique : bloque la vue pendant 15 s." },
  mist_toxine: { nom: "Brume toxique", famille: "grenade", effet: "feu", icone: "toxique", dps: 20, rayon: 3.6, duree: 6, couleur: 0x7cff6a, prix: 200, charges: 1, recharge: 35,
    texte: "Nuage nocif au sol : 20 dégâts par seconde pendant 6 s." },
  mist_rideau: { nom: "Rideau de brume", famille: "murFumee", icone: "murFumee", nombre: 5, espacement: 2.6, duree: 12, couleur: 0x9fb2a8, charges: 1, recharge: 40,
    texte: "Ligne de 5 fumées devant toi pendant 12 s." },
  mist_brouillard: { nom: "Brouillard total", famille: "cible", effet: "brouillard", icone: "brouillard", points: 7, portee: 40, nombre: 5, duree: 14, facteur: 0.7, rayon: 6, couleur: 0x9fb2a8,
    texte: "Cinq fumées autour du point visé ; les ennemis dedans sont ralentis." },

  // ---------- VOLT ----------
  volt_iem: { nom: "Grenade IEM", famille: "grenade", effet: "emp", icone: "emp", fusee: 1.2, rayon: 6, duree: 6, degats: 20, prix: 250, charges: 1, recharge: 35,
    texte: "Impulsion électrique : 20 dégâts et capacités ennemies coupées pendant 6 s (rayon 6 m)." },
  volt_arc: { nom: "Arc électrique", famille: "grenade", effet: "flash", icone: "flash", fusee: 0.7, prix: 200, charges: 2, recharge: 25,
    texte: "Flash électrique." },
  volt_ruee: { nom: "Ruée électrique", famille: "ruee", icone: "ruee", vitesse: 30, duree: 0.27, charges: 1, recharge: 8,
    texte: "Ruée de 6 m dans la direction du mouvement." },
  volt_surcharge: { nom: "Surcharge", famille: "buff", icone: "surcharge", points: 6, duree: 10, cadence: 0.25, vitesse: 0.15,
    texte: "10 s : cadence de tir +25 % et vitesse +15 %." },

  // ---------- SABLE ----------
  sable_tempete: { nom: "Tempête de sable", famille: "grenade", effet: "fumee", icone: "fumee", duree: 15, couleur: 0xc9a46a, prix: 100, charges: 2, recharge: 25,
    texte: "Fumée de sable de 15 s." },
  sable_mouvants: { nom: "Sables mouvants", famille: "grenade", effet: "ralenti", icone: "ralenti", rayon: 4, duree: 6, facteur: 0.5, dps: 0, couleur: 0xd8a85a, prix: 200, charges: 1, recharge: 30,
    texte: "Zone de 6 s où les ennemis s'enlisent (moitié vitesse)." },
  sable_mur: { nom: "Mur de sable", famille: "mur", icone: "mur", longueur: 5, vie: 700, duree: 12, couleur: 0xe0b878, charges: 1, recharge: 35,
    texte: "Mur de sable compacté de 5 m pendant 12 s." },
  sable_simoun: { nom: "Simoun", famille: "murFumee", icone: "murFumee", points: 7, nombre: 8, espacement: 2.8, duree: 14, couleur: 0xc9a46a, commotion: 2.5,
    texte: "Longue muraille de sable (8 fumées) : les ennemis pris dedans subissent une commotion." },

  // ---------- SERAPH ----------
  seraph_orbe: { nom: "Orbe de soin", famille: "grenade", effet: "soin", icone: "soinZone", rayon: 4, hps: 18, duree: 6, couleur: 0xfff0b0, prix: 200, charges: 1, recharge: 30,
    texte: "Zone qui soigne les alliés de 18 PV par seconde pendant 6 s." },
  seraph_lueur: { nom: "Lueur sacrée", famille: "grenade", effet: "flash", icone: "flash", fusee: 0.75, prix: 200, charges: 2, recharge: 25,
    texte: "Flash lumineuse." },
  seraph_regen: { nom: "Régénération", famille: "buff", icone: "soin", soin: 50, dureeSoin: 2.5, condition: "blesse", charges: 1, recharge: 30,
    texte: "Rend 50 PV en 2,5 s." },
  seraph_resurrection: { nom: "Résurrection", famille: "resurrection", icone: "resurrection", points: 8, rayon: 30, soin: 50,
    texte: "Ramène à la vie les alliés éliminés à moins de 30 m et soigne l'équipe de 50 PV." },

  // ---------- PULSE ----------
  pulse_stim: { nom: "Stimulant", famille: "equipe", icone: "stim", rayon: 9, duree: 8, cadence: 0.15, vitesse: 0.1, prix: 200, charges: 1, recharge: 35,
    texte: "Toi et tes alliés à moins de 9 m : cadence +15 % et vitesse +10 % pendant 8 s." },
  pulse_onde: { nom: "Onde basse", famille: "grenade", effet: "commotion", icone: "commotion", fusee: 1, rayon: 5, duree: 3, prix: 200, charges: 1, recharge: 30,
    texte: "Commotion de 3 s dans un rayon de 5 m." },
  pulse_battement: { nom: "Battement", famille: "buff", icone: "soin", soin: 30, dureeSoin: 2, vitesse: 0.15, duree: 4, charges: 1, recharge: 20,
    texte: "Rend 30 PV en 2 s et +15 % de vitesse pendant 4 s." },
  pulse_crescendo: { nom: "Crescendo", famille: "equipe", icone: "stim", points: 7, rayon: 0, duree: 10, cadence: 0.25, vitesse: 0.15,
    texte: "Toute l'équipe : cadence +25 % et vitesse +15 % pendant 10 s." },

  // ---------- BLOOM ----------
  bloom_spore: { nom: "Spore de soin", famille: "grenade", effet: "soin", icone: "soinZone", rayon: 4, hps: 14, duree: 7, couleur: 0x9cff6a, prix: 200, charges: 1, recharge: 30,
    texte: "Spore qui soigne les alliés de 14 PV par seconde pendant 7 s." },
  bloom_lianes: { nom: "Lianes", famille: "piege", icone: "piege", declencheur: 2.2, ralenti: 4, revele: 3, degats: 15, couleur: 0x9cff6a, prix: 150, charges: 2, recharge: 25,
    texte: "Graine posée au sol : l'ennemi qui passe est entravé 4 s, révélé et prend 15 dégâts." },
  bloom_ecorce: { nom: "Peau d'écorce", famille: "buff", icone: "armure", armure: 40, charges: 1, recharge: 35,
    texte: "Ajoute 40 de bouclier (sans dépasser 100)." },
  bloom_jardin: { nom: "Jardin sacré", famille: "cible", effet: "soin", icone: "soinZone", points: 7, portee: 30, rayon: 8, hps: 20, duree: 10, ralentiEnnemis: 0.6, couleur: 0x9cff6a,
    texte: "Jardin de 8 m pendant 10 s : soigne les alliés de 20 PV/s et ralentit les ennemis." },

  // ---------- ATLAS ----------
  atlas_caisse: { nom: "Caisse de ravitaillement", famille: "equipe", icone: "caisse", rayon: 8, munitions: true, armure: 25, prix: 200, charges: 1, recharge: 40,
    texte: "Toi et tes alliés à moins de 8 m : munitions remplies et +25 de bouclier." },
  atlas_fumee: { nom: "Fumigène", famille: "grenade", effet: "fumee", icone: "fumee", duree: 15, couleur: 0xa9b0a0, prix: 100, charges: 2, recharge: 25,
    texte: "Fumée de 15 s." },
  atlas_bouclier: { nom: "Bouclier portatif", famille: "mur", icone: "mur", longueur: 2.6, vie: 500, duree: 18, couleur: 0x9fffc0, charges: 1, recharge: 30,
    texte: "Bouclier de 2,6 m pendant 18 s." },
  atlas_renouveau: { nom: "Renouveau", famille: "equipe", icone: "renouveau", points: 7, rayon: 0, soin: 100, armure: 25,
    texte: "Toute l'équipe est entièrement soignée et reçoit 25 de bouclier." },
};

// Familles qui ne touchent que le lanceur : autorisées en ligne (les autres ne sont pas synchronisées)
export const FAMILLES_PERSONNELLES = new Set(["ruee", "saut", "blink", "buff"]);

export function capacitesDe(heroId) {
  const h = HEROS[heroId] || HEROS.kael;
  return { c: h.capacites[0], q: h.capacites[1], e: h.capacites[2], x: h.capacites[3] };
}

// État des capacités d'un combattant (charges et recharges)
export function nouvelEtatCapacites(heroId, economie) {
  const ids = capacitesDe(heroId);
  const etat = { heros: heroId, economie };
  for (const s of ["c", "q", "e"]) {
    const def = CAPACITES[ids[s]];
    const max = def.charges || 1;
    etat[s] = { id: ids[s], charges: s === "e" || !economie ? max : 0, max, t: 0 };
  }
  etat.x = { id: ids.x, points: CAPACITES[ids.x].points || 7 };
  return etat;
}

// Recharge au fil du temps : toujours pour E, et pour C/A hors économie (Deathmatch, stand, en ligne)
export function majRecharges(etat, dt) {
  if (!etat) return;
  for (const s of ["c", "q", "e"]) {
    const e = etat[s];
    if (e.charges >= e.max || (etat.economie && s !== "e")) { e.t = 0; continue; }
    e.t += dt;
    const r = CAPACITES[e.id].recharge || 30;
    if (e.t >= r) { e.t = 0; e.charges++; }
  }
}

// Début de manche (économie) : la signature est rechargée, les charges achetées sont gardées
export function nouvelleMancheCapacites(etat) {
  if (!etat) return;
  etat.e.charges = etat.e.max;
  etat.e.t = 0;
}

// ----- Icônes (SVG 24×24) : un pictogramme par type d'effet -----
const S = (d, extra = "") => `<svg viewBox="0 0 24 24">${d}${extra}</svg>`;
const T = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
export const ICONES = {
  fumee: S(`<path d="M7 18a4 4 0 0 1-.5-8 5.5 5.5 0 0 1 10.6 1.4A3.5 3.5 0 0 1 17 18z" ${T}/>`),
  flash: S(`<path d="M12 2v5M12 17v5M2 12h5M17 12h5M5 5l3.5 3.5M15.5 15.5 19 19M5 19l3.5-3.5M15.5 8.5 19 5" ${T}/><circle cx="12" cy="12" r="2.5" fill="currentColor"/>`),
  ruee: S(`<path d="M3 12h11l-4-4m4 4-4 4M15 6l5 6-5 6" ${T}/>`),
  mur: S(`<path d="M3 6h18v12H3zM3 12h18M9 6v6M15 12v6" ${T}/>`),
  drone: S('<circle cx="6" cy="6" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="18" cy="6" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="6" cy="18" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="18" cy="18" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor"/>'),
  soin: S('<path d="M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z" fill="currentColor"/>'),
  soinZone: S(`<ellipse cx="12" cy="17" rx="9" ry="3.5" ${T}/><path d="M11 4h2v4h4v2h-4v4h-2v-4H7V8h4z" fill="currentColor"/>`),
  surcharge: S('<path d="M13 2 4 14h7l-1 8 9-12h-7z" fill="currentColor"/>'),
  bastion: S('<path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5z" fill="currentColor"/>'),
  sonar: S('<circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.5" opacity=".6"/>'),
  renouveau: S('<path d="M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6-8 11-8 11z" fill="currentColor"/>'),
  explosion: S('<path d="M12 2l2 5 5-3-2 5 5 2-5 2 2 5-5-3-2 5-2-5-5 3 2-5-5-2 5-2-2-5 5 3z" fill="currentColor"/>'),
  feu: S('<path d="M12 22c-4 0-7-3-7-7 0-4 3-6 4-10 1 2 2 3 3 3 0-2 1-4 3-6 0 5 4 7 4 13 0 4-3 7-7 7zm0-2c2 0 3-1.5 3-3.5S13 13 12 11c-1 2-3 3.5-3 5.5S10 20 12 20z" fill="currentColor"/>'),
  toxique: S(`<circle cx="12" cy="12" r="2.5" fill="currentColor"/><path d="M12 3a9 9 0 0 1 4.5 1.2L14 8.5M3.5 15.5A9 9 0 0 1 3 12h5M20.5 15.5A9 9 0 0 1 16 20l-2.5-4.3M7.5 4.2 10 8.5M3 12M8 20l2.5-4.3" ${T}/>`),
  glace: S(`<path d="M12 2v20M3.3 7l17.4 10M3.3 17l17.4-10M9 4l3 2 3-2M9 20l3-2 3 2" ${T}/>`),
  ralenti: S(`<path d="M12 12m-1 0a1 1 0 1 0 2 0 3 3 0 1 0-6 0 5 5 0 1 0 10 0 7 7 0 1 0-14 0 9 9 0 1 0 18 0" ${T}/>`),
  commotion: S(`<path d="M5 12a7 7 0 0 1 7-7M19 12a7 7 0 0 1-7 7M2 12a10 10 0 0 1 10-10M22 12a10 10 0 0 1-10 10" ${T}/><circle cx="12" cy="12" r="3" fill="currentColor"/>`),
  emp: S(`<circle cx="12" cy="12" r="9.5" ${T}/><path d="M13 4.5 7.5 13h4l-1 6.5L16 11h-4z" fill="currentColor"/>`),
  fleche: S(`<path d="M4 20 16 8M16 8l-1-4 5 1-1 4zM8 16l-3-1M8 16l1 3" ${T}/><circle cx="17.5" cy="6.5" r="5" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".6"/>`),
  blink: S(`<path d="M3 12h2M7 12h2M11 12h2" ${T}/><path d="M15 6l6 6-6 6" ${T}/><circle cx="5" cy="6" r="1.5" fill="currentColor"/><circle cx="5" cy="18" r="1.5" fill="currentColor"/>`),
  saut: S(`<path d="M12 21V5M5 11l7-7 7 7M7 21h10" ${T}/>`),
  camo: S(`<path d="M2 12s3.5-7 10-7c2.3 0 4.2.9 5.7 2M22 12s-3.5 7-10 7c-2.3 0-4.2-.9-5.7-2M3 21 21 3" ${T}/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="2 2"/>`),
  tourelle: S(`<path d="M6 21h12l-2-6H8zM9 15V11h6v4M12 11V9h8" ${T}/><circle cx="12" cy="9" r="2" fill="currentColor"/>`),
  piege: S(`<path d="M3 18h18M7 18l2-6h6l2 6M12 12V7" ${T}/><circle cx="12" cy="5" r="2" fill="currentColor"/>`),
  frappe: S(`<circle cx="12" cy="14" r="7" ${T}/><circle cx="12" cy="14" r="2" fill="currentColor"/><path d="M12 1v6M9 4l3 3 3-3" ${T}/>`),
  trouNoir: S(`<circle cx="12" cy="12" r="3.5" fill="currentColor"/><path d="M12 3a9 9 0 0 1 9 9M21 12a9 9 0 0 1-9 9M12 21a9 9 0 0 1-9-9M3 12a9 9 0 0 1 9-9" ${T} stroke-dasharray="5 3"/>`),
  seisme: S(`<path d="M2 20h20M5 20l3-6 3 3 2-7 3 5 3-2 2 7" ${T}/>`),
  charge: S(`<path d="M3 15h6l2-4h5l3 4h2M6 15v4M18 15v4M14 7l3-3M17 9l4-1" ${T}/>`),
  cone: S(`<path d="M3 12 21 4v16z" ${T}/><circle cx="8" cy="12" r="2" fill="currentColor"/>`),
  resurrection: S(`<path d="M12 3v18M7 8h10" ${T}/><path d="M4 14c2-1 3-3 3-6M20 14c-2-1-3-3-3-6" ${T}/>`),
  frenesie: S(`<path d="M5 20 15 4M9 20 19 4M13 20 21 8" ${T}/>`),
  caisse: S(`<path d="M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10" ${T}/>`),
  stim: S(`<path d="M6 14l6-6 6 6M6 20l6-6 6 6" ${T}/><path d="M12 2v2" ${T}/>`),
  armure: S('<path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5zm0 3 5 2v4c0 3.4-2.2 6.3-5 7.8z" fill="currentColor"/>'),
  brouillard: S(`<path d="M4 10a3 3 0 0 1 5-2.5A4 4 0 0 1 16.5 9 3 3 0 0 1 17 15H6a2.5 2.5 0 0 1-2-5zM5 19h14M8 22h8" ${T}/>`),
  murFumee: S(`<path d="M2 14a2.5 2.5 0 0 1 3-4 3 3 0 0 1 5.5 0A3 3 0 0 1 16 10a2.5 2.5 0 0 1 4 1 2.5 2.5 0 0 1 0 5H4a2 2 0 0 1-2-2z" ${T}/>`),
};

export const iconeCapacite = (id) => ICONES[(CAPACITES[id] && CAPACITES[id].icone) || "soin"] || ICONES.soin;

// Petit résumé chiffré pour les menus : "Recharge 25 s · 2 charges · 200 crédits"
export function detailsCapacite(id, emplacement) {
  const d = CAPACITES[id];
  const p = [];
  if (emplacement === "x") p.push(`${d.points || 7} points d'ultime`);
  else {
    if (d.charges > 1) p.push(`${d.charges} charges`);
    if (d.prix && emplacement !== "e") p.push(`${d.prix} crédits`);
    p.push(`recharge ${d.recharge || 30} s`);
  }
  return p.join(" · ");
}
