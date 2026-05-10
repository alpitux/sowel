---
hide:
  - navigation
  - toc
---

<div class="sowel-hero">

<svg class="sowel-logo" xmlns="http://www.w3.org/2000/svg" viewBox="25 15 150 155" aria-label="Logo Sowel">
  <path class="house"     d="M100 30 L160 90 Q165 95 160 100 L160 150 Q160 158 152 158 L48 158 Q40 158 40 150 L40 100 Q35 95 40 90 Z"/>
  <path class="smile"     d="M75 115 Q100 140 125 115"/>
  <path class="left-eye"  d="M78 95 Q83 87 88 95"/>
  <path class="right-eye" d="M112 95 Q117 87 122 95"/>
</svg>

<h1 class="sowel-wordmark">Sowel</h1>

<p class="sowel-lede"><strong>Ne programmez pas votre maison. <em>Appliquez-lui des recettes.</em></strong><br/>
Un moteur de domotique pour le <em>confort</em>, la <em>sécurité</em> et l'<em>efficacité énergétique</em>, sans écrire une seule ligne de code.</p>

<p class="sowel-cta">
  <a class="md-button md-button--primary" href="user/getting-started/">Commencer <span class="md-icon md-icon--arrow">→</span></a>
  <a class="md-button" href="https://github.com/mchacher/sowel">Voir sur GitHub</a>
</p>

</div>

<div class="sowel-section">

<p class="sowel-eyebrow">Une autre façon d'automatiser votre maison</p>

<p class="sowel-paragraph">La plupart des outils de domotique vous transforment en développeur à temps partiel : fichiers YAML, scripts, flows, conditions, cas particuliers. Le résultat est un plat de spaghettis fragile que seule une personne du foyer arrive à dépanner.</p>

<p class="sowel-paragraph"><strong>Sowel prend le chemin inverse.</strong> Au lieu d'écrire des automatisations, vous <strong>choisissez une recette</strong> (<em>Motion Light</em>, <em>Presence Thermostat</em>, <em>Pool Pump Schedule</em>, <em>Sunset Shutters</em>) et vous l'<strong>appliquez à une zone</strong>. Chaque recette encode un schéma réfléchi et éprouvé qui vise le juste équilibre entre confort, sécurité et efficacité énergétique. Vous configurez quelques réglages évidents (une durée, une température, une plage horaire), pas un langage de programmation.</p>

<p class="sowel-paragraph">La meilleure automatisation est celle qu'on oublie. Votre maison fonctionne, tout simplement.</p>

</div>

<div class="sowel-section">

<div class="sowel-story">

<p class="sowel-eyebrow">Une petite histoire</p>

<p class="sowel-paragraph">Prenez <em>Constant Light</em>. Une cuisine éclairée à une luminosité confortable toute la journée. Pour bien faire, il faut plusieurs détecteurs de mouvement qui prolongent le même minuteur sans se contrarier, une cible de luminosité qui s'adapte au lux naturel entrant par la fenêtre, et des exemptions pour les repas, la nuit, ou quand quelqu'un appuie sur l'interrupteur.</p>

<p class="sowel-paragraph">Ou prenez <em>Solar EV Charging</em>. Le chargeur doit monter en puissance exactement au rythme du surplus produit par vos panneaux, et redescendre dès qu'un nuage passe ou que le lave-vaisselle démarre. Le calcul tient sur une ligne ; l'orchestration, non.</p>

<ul class="sowel-bullets">
  <li>plusieurs entrées qui doivent rester synchronisées (capteurs, compteurs, plannings)</li>
  <li>des décisions en temps réel qui suivent les mesures live, pas des instantanés</li>
  <li>des replis sûrs pour chaque cas particulier (capteur hors ligne, coupure réseau, surcharge utilisateur)</li>
</ul>

<p class="sowel-paragraph">Chaque règle prise isolément est triviale. Le difficile, ce sont les <strong>combinaisons</strong>. Les règles à la IFTTT s'effondrent dès le premier chevauchement. Les automatisations faites maison se déboguent pendant une semaine, puis accumulent en silence des cas tordus que personne n'ose toucher.</p>

<p class="sowel-paragraph"><strong>Sowel encode cette complexité une fois pour toutes</strong>, éprouvée sur le terrain, et la livre sous forme de recette. Posez-la sur une zone, passez à la suite.</p>

</div>

</div>

<div class="sowel-section">

<p class="sowel-eyebrow">Là où tous les autres outils domotiques voient des déclencheurs, Sowel voit une maison.</p>

<p class="sowel-paragraph">La plupart des outils partent du câblage et vous laissent greffer des scripts par-dessus. Sowel part de la maison et laisse le câblage suivre. Cinq couches décrivent votre maison avec les mots que vous utiliseriez vous-même, chacune un peu moins abstraite que celle d'en dessous :</p>

<ul class="sowel-bullets">
  <li>Les <strong>devices</strong> sont auto-découverts et normalisés dans un seul modèle de données.</li>
  <li>Les <strong>équipements</strong> nomment ce que ces devices font réellement.</li>
  <li>Les <strong>zones</strong> regroupent les équipements par espace, avec des métriques agrégées automatiquement.</li>
  <li>Les <strong>modes</strong> font basculer toute la maison d'un seul geste.</li>
  <li>Les <strong>recettes</strong> la font fonctionner toute seule.</li>
</ul>

<p class="sowel-paragraph">Et la cerise sur le gâteau :</p>

<ul class="sowel-bullets">
  <li>Les intégrations et les recettes sont livrées comme des <strong>plugins</strong>, distribués depuis GitHub : <em>Zigbee2MQTT</em>, <em>Netatmo</em>, <em>Shelly</em>, <em>Panasonic Comfort Cloud</em>, <em>prévisions météo</em>, et bien d'autres. Installez ce dont vous avez besoin, ignorez le reste.</li>
  <li>Tout repose sur une <strong>API et un bus d'événements</strong> typés et compacts, donc étendre Sowel se fait en un seul fichier TypeScript, pas avec un fork.</li>
</ul>

<div class="sowel-cards">

<div class="sowel-card">
  <div class="sowel-card__icon">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 9h2"/><path d="M20 15h2"/><path d="M9 2v2"/><path d="M9 20v2"/></svg>
  </div>
  <h3>Devices. Ce qui est sur votre réseau.</h3>
  <p class="sowel-card__lead">Quelle que soit la marque, quel que soit le protocole, Sowel les modélise tous de la même façon.</p>
  <p>Une cinquantaine de catégories sémantiques correspondent à ce qu'une maison mesure vraiment : température, mouvement, luminosité, contact, énergie, eau, présence. Chaque plugin d'intégration (Zigbee, MQTT, une API cloud, une passerelle LoRa) traduit son protocole brut dans ce vocabulaire commun, pour que chaque device arrive avec la bonne catégorie, le bon type et la bonne unité, prêt à être lié.</p>
  <p class="sowel-card__example" data-label="Exemple">Une ampoule Zigbee, un relais Shelly et une station Netatmo exposent la <em>température</em> de la même façon — même catégorie, même unité, même liaison à un équipement.</p>
  <p class="sowel-card__more"><a href="user/devices/">En savoir plus →</a></p>
</div>

<div class="sowel-card">
  <div class="sowel-card__icon">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
  </div>
  <h3>Équipements. Ce qui est dans votre pièce.</h3>
  <p class="sowel-card__lead">Sowel standardise ce que toute maison contient — lumières, volets, thermostats, capteurs, portails, compteurs.</p>
  <p>Chaque équipement a un type connu, un nom et un jeu de contrôles prévisibles. Liez un device ou plusieurs — trois variateurs IKEA derrière un mur, une ampoule Zigbee, une pompe à chaleur pilotée par API cloud — et Sowel masque le câblage derrière une seule poignée que vous pouvez utiliser, regrouper et manipuler.</p>
  <p class="sowel-card__example" data-label="Exemple">Un variateur mural et les spots qu'il commande au plafond deviennent un seul équipement <em>Lumières Cuisine</em> que vous pilotez depuis un point unique.</p>
  <p class="sowel-card__more"><a href="user/equipments/">En savoir plus →</a></p>
</div>

<div class="sowel-card">
  <div class="sowel-card__icon">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
  </div>
  <h3>Zones. La topologie de votre maison.</h3>
  <p class="sowel-card__lead">Sowel transforme votre plan en carte pensante de votre maison.</p>
  <p>Regroupez les équipements en zones, par pièce, par étage, par usage. Sowel consolide leurs données automatiquement — moyennes, OU logique, maximum — pour qu'une zone connaisse en permanence son propre état. Sans formules, sans code de glue, sans tableau de bord à câbler.</p>
  <p class="sowel-card__example" data-label="Exemple">Trois détecteurs PIR dans votre <em>Salon</em> ne forment plus qu'un seul signal de présence — un seul se déclenche, la zone est occupée.</p>
  <p class="sowel-card__more"><a href="user/zones/">En savoir plus →</a></p>
</div>

<div class="sowel-card">
  <div class="sowel-card__icon">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
  </div>
  <h3>Modes. Les rythmes de votre maison.</h3>
  <p class="sowel-card__lead">Sowel fait basculer toute la maison au tempo de vos habitudes.</p>
  <p>Définissez des modes au rythme de votre vie — Jour, Soir, Nuit. Un geste (ou une planification) fait basculer chaque zone : niveaux de luminosité, comportement des détections, consignes de chauffage, recettes activées ou en pause.</p>
  <p class="sowel-card__example" data-label="Exemple">Au coucher du soleil, votre maison passe en <em>Soir</em> — les variateurs descendent à 40 %, la lumière se réchauffe, et les chambres des enfants cessent de réagir au mouvement.</p>
  <p class="sowel-card__more"><a href="user/modes/">En savoir plus →</a></p>
</div>

<div class="sowel-card">
  <div class="sowel-card__icon">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21a1 1 0 0 0 1-1v-5.35c0-.46.32-.84.73-1.04a4 4 0 0 0-2.13-7.59 5 5 0 0 0-9.2 0 4 4 0 0 0-2.13 7.59c.41.2.73.58.73 1.04V20a1 1 0 0 0 1 1z"/><path d="M6 17h12"/></svg>
  </div>
  <h3>Recettes. Les réflexes de votre maison.</h3>
  <p class="sowel-card__lead">Sowel les livre éprouvées. Posez-en une sur une zone, sans script.</p>
  <p>Choisissez dans un catalogue éprouvé : éclairage déclenché par mouvement, chauffage piloté par présence, irrigation programmée, volets au coucher du soleil. Réglez quelques valeurs, et ça tourne. Pas de flows à câbler, pas de programmation logique.</p>
  <p class="sowel-card__example" data-label="Exemple">La recette <em>Lumière dimmable sur mouvement</em> garde une pièce éclairée au bon niveau dès qu'on y entre — vif le jour, doux le soir, tamisé la nuit. Une seule recette, trois modes, zéro ligne de code.</p>
  <p class="sowel-card__more"><a href="user/recipes/">En savoir plus →</a></p>
</div>

</div>

</div>

<div class="sowel-section">

<p class="sowel-eyebrow">Déployez en quelques minutes. À vous dès le premier jour.</p>

<div class="sowel-pills">
  <div class="sowel-pill">
    <strong>Une seule commande.</strong> <code>curl ... | sh</code> sur n'importe quel hôte Docker — Linux, macOS, Raspberry Pi. Sowel et InfluxDB en moins d'une minute.
  </div>
  <div class="sowel-pill">
    <strong>Reste à la maison.</strong> Pas de cloud, pas de télémétrie, pas de compte tiers. Vos données vivent sur votre matériel : un Raspberry Pi, un vieux PC, une VM Proxmox, ce que vous avez sous la main.
  </div>
  <div class="sowel-pill">
    <strong>Branchez ce que vous avez.</strong> Zigbee, Panasonic, Netatmo, Shelly, Legrand, tout ce qui parle MQTT. Installez les intégrations comme vous installez des applications, ignorez ce dont vous n'avez pas besoin.
  </div>
  <div class="sowel-pill">
    <strong>Auto-mise à jour.</strong> Les plugins et le moteur se mettent à jour depuis GitHub. Pas de SSH, pas de bidouille, pas de redémarrage programmé à 3 h du matin.
  </div>
</div>

</div>

<div class="sowel-section">

<p class="sowel-eyebrow">Faites le tour</p>

<div class="sowel-cards sowel-cards--two">

<div class="sowel-card">
  <div class="sowel-card__icon">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
  </div>
  <h3>Pour les utilisateurs</h3>
  <p>Configurez votre maison, paramétrez vos équipements, et appliquez vos premières recettes.</p>
  <p><a href="user/getting-started/">Guide utilisateur →</a></p>
</div>

<div class="sowel-card">
  <div class="sowel-card__icon">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z"/></svg>
  </div>
  <h3>Pour les développeurs</h3>
  <p>Architecture, développement de plugins, recettes, et modèle de données.</p>
  <p><a href="technical/">Guide technique →</a></p>
</div>

</div>

</div>

<p class="sowel-foot">Sowel est distribué sous licence <a href="https://github.com/mchacher/sowel/blob/main/LICENSE">AGPL-3.0</a> · <a href="https://github.com/mchacher/sowel">GitHub</a></p>
