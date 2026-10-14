// Les 20 personnages jouables de Neon Strike, en 5 catégories de 4.
// Tout est original : noms imposés, mais histoires, apparences et capacités inventées pour ce jeu.
// "apparence" décrit le modèle 3D construit par personnages.js ; "capacites" renvoie à capacites.js
// dans l'ordre des touches : capacité 1 (C), capacité 2 (A sur AZERTY / Q sur QWERTY), signature (E), ultime (X).

export const CATEGORIES = {
  assaut: { id: "assaut", nom: "Assaut", couleur: "#ff6a4d", texte: "Entrent les premiers et gagnent les duels." },
  defense: { id: "defense", nom: "Défense", couleur: "#4f9dff", texte: "Tiennent une zone et protègent l'équipe." },
  reconnaissance: { id: "reconnaissance", nom: "Reconnaissance", couleur: "#ffc845", texte: "Trouvent les ennemis avant le combat." },
  controle: { id: "controle", nom: "Contrôle", couleur: "#b07cff", texte: "Coupent les lignes de vue et ralentissent l'adversaire." },
  soutien: { id: "soutien", nom: "Soutien", couleur: "#4fe39a", texte: "Soignent, protègent et ravitaillent." },
};

export const ORDRE_CATEGORIES = ["assaut", "defense", "reconnaissance", "controle", "soutien"];

export const HEROS = {
  // ===================== ASSAUT =====================
  kael: {
    id: "kael", nom: "KAEL", categorie: "assaut", role: "Fer de lance", difficulte: 1, arme: "pulsar", pose: "garde",
    histoire: "Ancien pilote d'essai des Forges Halcyon, Kael a survécu au crash d'un prototype de propulseur dorsal… qu'il porte désormais en permanence. Il entre le premier, toujours, et ouvre la voie à son équipe.",
    personnalite: "Franc, impatient, protecteur avec les nouveaux. Déteste attendre le signal.",
    citation: "On y va. Maintenant.",
    capacites: ["kael_charge", "kael_eclat", "kael_propulsion", "kael_assaut"],
    apparence: {
      corps: "standard", taille: 1.02, peau: 0x8d5a3b, cheveux: 0x1b1512, yeux: 0x3a2618,
      tete: "visage", coiffure: "courte", barbe: "courte", accessoire: "oreillette",
      buste: "plastron", epaules: "lourdes", dos: "propulseurs", jambes: "cargo",
      couleurs: { armure: 0xd5d9de, tissu: 0x2b3346, secondaire: 0xff7a3a, accent: 0xff6b3d },
    },
  },
  vexa: {
    id: "vexa", nom: "VEXA", categorie: "assaut", role: "Acrobate", difficulte: 3, arme: "fusil", pose: "pret",
    histoire: "Championne de course libre sur les toits de Néo-Lyon, Vexa a été recrutée après avoir semé une escouade de drones de police pendant onze minutes. Son module vectoriel lui permet des sauts que personne d'autre n'ose tenter.",
    personnalite: "Moqueuse, imprévisible, perfectionniste dès qu'il s'agit de mouvement.",
    citation: "Essaie de me suivre.",
    capacites: ["vexa_saut", "vexa_voile", "vexa_pas", "vexa_frenesie"],
    apparence: {
      corps: "fin", taille: 1.01, peau: 0xe8c4a8, cheveux: 0xd23c8c, yeux: 0x4a2a3a,
      tete: "visage", coiffure: "queue", lunettes: "visiere", accessoire: "bandeau",
      buste: "combinaison", epaules: "aucune", dos: "lames", jambes: "moulantes",
      couleurs: { armure: 0x2a2b36, tissu: 0x1b1c24, secondaire: 0xd23c8c, accent: 0xff3fa0 },
    },
  },
  brax: {
    id: "brax", nom: "BRAX", categorie: "assaut", role: "Briseur de lignes", difficulte: 1, arme: "pompe", pose: "epaule",
    histoire: "Ancien démolisseur des chantiers orbitaux, Brax a gardé son exosquelette de chantier et l'a renforcé pour le combat. Là où il passe, les portes ne tiennent plus — et les lignes ennemies non plus.",
    personnalite: "Bruyant, loyal, éclate de rire au milieu des fusillades.",
    citation: "Brax ouvre la porte !",
    capacites: ["brax_commotion", "brax_plaques", "brax_belier", "brax_seisme"],
    apparence: {
      corps: "massif", taille: 1.06, peau: 0x5a3a28, cheveux: 0x15100c, yeux: 0x2a1a10,
      tete: "visage", coiffure: "rasee", barbe: "pleine", cicatrice: true,
      buste: "armureLourde", epaules: "asym", dos: "reservoirs", jambes: "blindees",
      couleurs: { armure: 0x4a4f58, tissu: 0x33302c, secondaire: 0xffb020, accent: 0xffa62b },
    },
  },
  nyra: {
    id: "nyra", nom: "NYRA", categorie: "assaut", role: "Pyromancienne", difficulte: 2, arme: "pulsar", pose: "inspection",
    histoire: "Ingénieure en fusion, Nyra a quitté le consortium Sol après l'accident du réacteur 9. Le plasma qu'elle canalise dans ses gantelets vient de la cellule qu'elle a arrachée à la catastrophe.",
    personnalite: "Passionnée, colérique, mais d'une précision redoutable quand elle se calme.",
    citation: "Ça va chauffer.",
    capacites: ["nyra_plasma", "nyra_flare", "nyra_coeur", "nyra_supernova"],
    apparence: {
      corps: "standard", taille: 0.98, peau: 0xb98a62, cheveux: 0xd8461e, yeux: 0xff8a2a, yeuxLumineux: true,
      tete: "visage", coiffure: "carre",
      buste: "veste", epaules: "legeres", dos: "reservoirs", jambes: "cargo",
      couleurs: { armure: 0x7a1f1f, tissu: 0x2a2526, secondaire: 0xffb347, accent: 0xff8a2a },
    },
  },

  // ===================== DÉFENSE =====================
  titan: {
    id: "titan", nom: "TITAN", categorie: "defense", role: "Forteresse", difficulte: 1, arme: "pulsar", pose: "garde",
    histoire: "Sous les 140 kg d'armure se trouve Matéo Ruiz, ancien pompier des tours de Port-Ciel. Le jour où une tour s'est effondrée, il a tenu une poutre pendant neuf minutes. Il a juré que personne ne tomberait plus derrière lui.",
    personnalite: "Calme, patient, parle peu. Ses blagues arrivent toujours trois secondes trop tard.",
    citation: "Derrière moi.",
    capacites: ["titan_plaque", "titan_bouclier", "titan_barriere", "titan_rempart"],
    apparence: {
      corps: "massif", taille: 1.08, peau: 0x9a6a48, cheveux: 0x1a1410, yeux: 0x5ab4ff, yeuxLumineux: true,
      tete: "casque", buste: "armureLourde", epaules: "lourdes", dos: "generateur", jambes: "blindees",
      couleurs: { armure: 0x3f5d86, tissu: 0x2a2f38, secondaire: 0x9aa6b8, accent: 0x5ab4ff },
    },
  },
  aegis: {
    id: "aegis", nom: "AEGIS", categorie: "defense", role: "Gardienne", difficulte: 2, arme: "fusil", pose: "garde",
    histoire: "Capitaine de la garde des Archives de Verre, Aegis a protégé la dernière bibliothèque libre du continent pendant le Long Hiver. Son mur d'énergie est fabriqué à partir des boucliers de la bibliothèque.",
    personnalite: "Posée, exigeante, très attachée aux règles… qu'elle applique surtout aux autres.",
    citation: "Personne ne passe.",
    capacites: ["aegis_champ", "aegis_repulsion", "aegis_mur", "aegis_egide"],
    apparence: {
      corps: "standard", taille: 1.0, peau: 0x7b4b32, cheveux: 0x1a1412, yeux: 0x2a1a10,
      tete: "visage", coiffure: "tresses", accessoire: "diademe",
      buste: "plastron", epaules: "legeres", dos: "bouclier", jambes: "cargo",
      couleurs: { armure: 0xe2e5ea, tissu: 0x2e3a52, secondaire: 0xd4a43a, accent: 0x8ab4ff },
    },
  },
  rokan: {
    id: "rokan", nom: "ROKAN", categorie: "defense", role: "Ingénieur", difficulte: 2, arme: "fusil", pose: "inspection",
    histoire: "Mécanicien de la flotte minière d'Hadès, Rokan construit ses tourelles avec des pièces récupérées sur les épaves. Chacune porte le nom d'un ami perdu dans les mines.",
    personnalite: "Bougon, méthodique, ne fait confiance qu'à ce qu'il a soudé lui-même.",
    citation: "Ma tourelle s'en occupe.",
    capacites: ["rokan_mine", "rokan_frag", "rokan_tourelle", "rokan_barrage"],
    apparence: {
      corps: "standard", taille: 0.99, peau: 0xc99a73, cheveux: 0x8a8a86, yeux: 0x9cff3a, yeuxLumineux: false,
      tete: "visage", coiffure: "meche", barbe: "bouc", lunettes: "monocle",
      buste: "harnais", epaules: "asym", dos: "antenne", jambes: "cargo",
      couleurs: { armure: 0x8a6a3a, tissu: 0x4a5236, secondaire: 0x30343c, accent: 0x9cff3a },
    },
  },
  frost: {
    id: "frost", nom: "FROST", categorie: "defense", role: "Tireuse cryo", difficulte: 3, arme: "sniper", pose: "pret",
    histoire: "Seule survivante de la station polaire Borée, Frost a appris à tirer par moins soixante degrés. Ses projectiles cryogéniques viennent du cœur de la station qu'elle a refusé d'abandonner.",
    personnalite: "Froide en apparence, d'une loyauté absolue. N'oublie jamais un anniversaire.",
    citation: "Restez au chaud.",
    capacites: ["frost_fil", "frost_givre", "frost_mur", "frost_blizzard"],
    apparence: {
      corps: "fin", taille: 1.0, peau: 0xf0d9c8, cheveux: 0xdfe8f2, yeux: 0x9fe8ff, yeuxLumineux: true,
      tete: "visage", coiffure: "longue", masque: "foulard",
      buste: "manteau", epaules: "fourrure", dos: "reservoirs", jambes: "moulantes",
      couleurs: { armure: 0xcfe0ee, tissu: 0x3b4a5c, secondaire: 0x7fb8e0, accent: 0x9fe8ff },
    },
  },

  // ===================== RECONNAISSANCE =====================
  echo: {
    id: "echo", nom: "ECHO", categorie: "reconnaissance", role: "Sonar vivant", difficulte: 2, arme: "fusil", pose: "decontracte",
    histoire: "Ancien ingénieur du son des clubs souterrains, Echo entend des pas à travers trois murs. Sa flèche sonar est une enceinte miniaturisée qu'il a bricolée lui-même.",
    personnalite: "Bavard, curieux, fredonne sans arrêt. Silencieux comme une tombe en mission.",
    citation: "Je les entends.",
    capacites: ["echo_fleche", "echo_onde", "echo_ecoute", "echo_resonance"],
    apparence: {
      corps: "fin", taille: 1.0, peau: 0xa86f4c, cheveux: 0x2a1a12, yeux: 0x2a1a10,
      tete: "visage", coiffure: "boucles", accessoire: "casqueAudio",
      buste: "veste", epaules: "legeres", dos: "antenne", jambes: "cargo",
      couleurs: { armure: 0x2f6f73, tissu: 0x2a2f36, secondaire: 0xffd166, accent: 0x5affd1 },
    },
  },
  ghost: {
    id: "ghost", nom: "GHOST", categorie: "reconnaissance", role: "Infiltrateur", difficulte: 3, arme: "fusil", pose: "pret",
    histoire: "Personne ne connaît son vrai nom. Ghost est apparu dans les fichiers de l'agence le jour où il les a piratés. Sa combinaison à réfraction optique est un prototype qu'il a lui-même dérobé.",
    personnalite: "Laconique, ironique, toujours une longueur d'avance — ou c'est ce qu'il laisse croire.",
    citation: "Vous ne m'avez pas vu.",
    capacites: ["ghost_camo", "ghost_flash", "ghost_drone", "ghost_ombre"],
    apparence: {
      corps: "fin", taille: 1.02, peau: 0xd2a07e, cheveux: 0x101014, yeux: 0xb8c8ff, yeuxLumineux: true,
      tete: "capuche", masque: "demi",
      buste: "combinaison", epaules: "aucune", dos: "cape", jambes: "moulantes",
      couleurs: { armure: 0x2a2f3a, tissu: 0x1c1f26, secondaire: 0x3a4150, accent: 0xb8c8ff },
    },
  },
  orion: {
    id: "orion", nom: "ORION", categorie: "reconnaissance", role: "Pisteur", difficulte: 2, arme: "sniper", pose: "epaule",
    histoire: "Guide de chasse dans les forêts mortes de l'Ancien Continent, Orion piste ses cibles avec Lyra, son drone de reconnaissance. Il ne tire jamais deux fois.",
    personnalite: "Patient, observateur, parle à son drone comme à un vieux chien.",
    citation: "Lyra, cherche.",
    capacites: ["orion_drone", "orion_balise", "orion_marque", "orion_chasse"],
    apparence: {
      corps: "standard", taille: 1.04, peau: 0x6b4630, cheveux: 0x231812, yeux: 0x2a1a10,
      tete: "visage", coiffure: "courte", barbe: "courte", lunettes: "monocle",
      buste: "veste", epaules: "legeres", dos: "drone", jambes: "cargo",
      couleurs: { armure: 0x6a4a2e, tissu: 0x3a3a2e, secondaire: 0x8a7a5a, accent: 0xffc845 },
    },
  },
  kira: {
    id: "kira", nom: "KIRA", categorie: "reconnaissance", role: "Éclaireuse", difficulte: 2, arme: "fusil", pose: "pret",
    histoire: "Messagère la plus rapide du réseau clandestin de Sendai-Bas, Kira n'a jamais perdu un colis. Ses lames traqueuses transmettent ce qu'elles voient avant même de toucher le sol.",
    personnalite: "Énergique, compétitive, se lance des défis à elle-même en plein combat.",
    citation: "Déjà là !",
    capacites: ["kira_flash", "kira_lame", "kira_pas", "kira_tempete"],
    apparence: {
      corps: "fin", taille: 0.96, peau: 0xf1c7a0, cheveux: 0x14141a, yeux: 0x2a2018,
      tete: "visage", coiffure: "chignon", lunettes: "visiere",
      buste: "combinaison", epaules: "legeres", dos: "carquois", jambes: "moulantes",
      couleurs: { armure: 0xe8ecf2, tissu: 0x2a2d36, secondaire: 0xffd166, accent: 0xfff07a },
    },
  },

  // ===================== CONTRÔLE =====================
  nexus: {
    id: "nexus", nom: "NEXUS", categorie: "controle", role: "Gravitationniste", difficulte: 3, arme: "pulsar", pose: "decontracte",
    histoire: "Physicienne du projet Horizon, Nexus était dans la chambre de confinement quand la singularité s'est ouverte. Elle en est ressortie six minutes plus tard… trois jours après.",
    personnalite: "Distante, brillante, parle du temps comme d'une matière qu'on peut plier.",
    citation: "Le temps est de mon côté.",
    capacites: ["nexus_puits", "nexus_voile", "nexus_distorsion", "nexus_trouNoir"],
    apparence: {
      corps: "standard", taille: 1.03, peau: 0x3f2a22, cheveux: 0x0e0b0a, yeux: 0xb07cff, yeuxLumineux: true,
      tete: "visage", coiffure: "rasee", accessoire: "couronne",
      buste: "manteau", epaules: "legeres", dos: "generateur", jambes: "moulantes",
      couleurs: { armure: 0x2a2438, tissu: 0x1e1a2a, secondaire: 0x3b2a5c, accent: 0xb07cff },
    },
  },
  mist: {
    id: "mist", nom: "MIST", categorie: "controle", role: "Alchimiste", difficulte: 1, arme: "fusil", pose: "decontracte",
    histoire: "Chimiste de quartier dans les bas-fonds de Brume-sur-Seine, Mist distillait des fumées pour couvrir la fuite des réfugiés. Son masque filtre tout… sauf son humour.",
    personnalite: "Détendu, pince-sans-rire, a toujours un plan de repli.",
    citation: "On ne voit plus rien, parfait.",
    capacites: ["mist_nuage", "mist_toxine", "mist_rideau", "mist_brouillard"],
    apparence: {
      corps: "standard", taille: 1.0, peau: 0xc48d6a, cheveux: 0x2a2018, yeux: 0x7cffb0, yeuxLumineux: true,
      tete: "capuche", masque: "respirateur",
      buste: "veste", epaules: "legeres", dos: "reservoirs", jambes: "cargo",
      couleurs: { armure: 0x56685e, tissu: 0x2e3530, secondaire: 0x8fa08a, accent: 0x7cffb0 },
    },
  },
  volt: {
    id: "volt", nom: "VOLT", categorie: "controle", role: "Électrocinéticien", difficulte: 2, arme: "pulsar", pose: "pret",
    histoire: "Ancien coursier du réseau électrique de Mégapole-Est, Volt a encaissé 40 000 volts pendant une panne générale. Depuis, son corps stocke l'énergie comme une batterie vivante.",
    personnalite: "Hyperactif, drôle, incapable de rester en place plus de trois secondes.",
    citation: "Ça va secouer !",
    capacites: ["volt_iem", "volt_arc", "volt_ruee", "volt_surcharge"],
    apparence: {
      corps: "fin", taille: 0.99, peau: 0xe0b090, cheveux: 0xbfe8ff, yeux: 0x7cffd4, yeuxLumineux: true,
      tete: "visage", coiffure: "pics", lunettes: "lunettes",
      buste: "combinaison", epaules: "legeres", dos: "bobines", jambes: "moulantes",
      couleurs: { armure: 0x22303a, tissu: 0x1c2228, secondaire: 0x3a4a56, accent: 0x7cffd4 },
    },
  },
  sable: {
    id: "sable", nom: "SABLE", categorie: "controle", role: "Nomade des dunes", difficulte: 2, arme: "pompe", pose: "epaule",
    histoire: "Nomade des Dunes Rouges, Sable a grandi dans les tempêtes qui engloutissent les convois. Elle commande au sable grâce à un essaim de nanites hérité de sa grand-mère.",
    personnalite: "Sage, patiente, cite des proverbes que personne ne connaît.",
    citation: "Le vent tourne.",
    capacites: ["sable_tempete", "sable_mouvants", "sable_mur", "sable_simoun"],
    apparence: {
      corps: "standard", taille: 1.0, peau: 0xa0663f, cheveux: 0x2a1a10, yeux: 0xffb347, yeuxLumineux: false,
      tete: "visage", coiffure: "longue", masque: "foulard",
      buste: "manteau", epaules: "legeres", dos: "cape", jambes: "cargo",
      couleurs: { armure: 0xc9a46a, tissu: 0x6a5236, secondaire: 0x8a3a24, accent: 0xffb347 },
    },
  },

  // ===================== SOUTIEN =====================
  seraph: {
    id: "seraph", nom: "SERAPH", categorie: "soutien", role: "Médecin de guerre", difficulte: 1, arme: "fusil", pose: "garde",
    histoire: "Médecin de guerre augmentée, Seraph a été déclarée morte deux fois. Ses ailes-drones lui permettent d'atteindre les blessés là où personne d'autre ne va.",
    personnalite: "Douce, inébranlable, d'un humour noir surprenant.",
    citation: "Personne ne reste à terre.",
    capacites: ["seraph_orbe", "seraph_lueur", "seraph_regen", "seraph_resurrection"],
    apparence: {
      corps: "fin", taille: 1.02, peau: 0xf3d2b8, cheveux: 0xf0d27a, yeux: 0x3a5a7a,
      tete: "visage", coiffure: "longue", accessoire: "halo",
      buste: "plastron", epaules: "legeres", dos: "ailes", jambes: "moulantes",
      couleurs: { armure: 0xf0f0f2, tissu: 0x8a92a4, secondaire: 0xe0b84a, accent: 0xfff0b0 },
    },
  },
  pulse: {
    id: "pulse", nom: "PULSE", categorie: "soutien", role: "Rythmicien", difficulte: 2, arme: "pulsar", pose: "decontracte",
    histoire: "DJ des fêtes clandestines de Bas-Néon, Pulse a découvert que certaines fréquences accélèrent la régénération des tissus. Ses enceintes dorsales font le reste.",
    personnalite: "Charismatique, bruyant, transforme chaque victoire en fête.",
    citation: "Montez le son !",
    capacites: ["pulse_stim", "pulse_onde", "pulse_battement", "pulse_crescendo"],
    apparence: {
      corps: "standard", taille: 1.01, peau: 0x6e4530, cheveux: 0xff3f7f, yeux: 0x2a1a10,
      tete: "visage", coiffure: "crete", lunettes: "lunettes",
      buste: "veste", epaules: "aucune", dos: "enceintes", jambes: "cargo",
      couleurs: { armure: 0x1e1e26, tissu: 0x2a2a34, secondaire: 0xff3f7f, accent: 0x3fd0ff },
    },
  },
  bloom: {
    id: "bloom", nom: "BLOOM", categorie: "soutien", role: "Botaniste", difficulte: 2, arme: "fusil", pose: "inspection",
    histoire: "Botaniste de la serre orbitale Éden-4, Bloom a sauvé le dernier jardin quand la station est tombée. Les plantes de son réservoir dorsal soignent plus vite que n'importe quel médicament.",
    personnalite: "Rêveuse, bienveillante… et terrifiante quand on abîme une plante.",
    citation: "Tout repousse.",
    capacites: ["bloom_spore", "bloom_lianes", "bloom_ecorce", "bloom_jardin"],
    apparence: {
      corps: "fin", taille: 0.97, peau: 0x8a5a3c, cheveux: 0x3d2a1a, yeux: 0x6abf3a,
      tete: "visage", coiffure: "boucles", accessoire: "fleurs",
      buste: "combinaison", epaules: "aucune", dos: "vrilles", jambes: "moulantes",
      couleurs: { armure: 0x3f7a4a, tissu: 0x2e3a2a, secondaire: 0xd9a0c8, accent: 0x9cff6a },
    },
  },
  atlas: {
    id: "atlas", nom: "ATLAS", categorie: "soutien", role: "Logisticien", difficulte: 1, arme: "pompe", pose: "epaule",
    histoire: "Logisticien en chef de la 7e brigade, Atlas a porté sur son dos le ravitaillement de toute une compagnie pendant le siège de Kessel. Pour lui, le poids, ça se partage.",
    personnalite: "Bienveillant, organisé, paternel. Compte les munitions de tout le monde.",
    citation: "Servez-vous.",
    capacites: ["atlas_caisse", "atlas_fumee", "atlas_bouclier", "atlas_renouveau"],
    apparence: {
      corps: "massif", taille: 1.05, peau: 0x9a6a48, cheveux: 0x2a2018, yeux: 0x2a1a10,
      tete: "casqueVisiere", barbe: "pleine",
      buste: "armureLourde", epaules: "lourdes", dos: "caisse", jambes: "blindees",
      couleurs: { armure: 0x5d6b3a, tissu: 0x3a3d30, secondaire: 0xe0e0d0, accent: 0x7cffa0 },
    },
  },
};

export const LISTE_HEROS = ORDRE_CATEGORIES.flatMap((c) => Object.values(HEROS).filter((h) => h.categorie === c));

// Anciens agents (profils déjà enregistrés) -> nouveaux personnages
const ANCIENS = { rempart: "aegis", faucon: "orion", aube: "seraph" };
export function herosValide(id) {
  if (HEROS[id]) return id;
  return ANCIENS[id] || "kael";
}

export const NOMS_DIFFICULTE = ["", "Facile", "Moyen", "Difficile"];
