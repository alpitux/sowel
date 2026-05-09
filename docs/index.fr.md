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

<p class="sowel-paragraph"><strong>Sowel prend le chemin inverse.</strong> Au lieu d'écrire des automatisations, vous <strong>choisissez une recette</strong> (<em>Motion Light</em>, <em>Presence Thermostat</em>, <em>Pool Pump Schedule</em>, <em>Sunset Shutters</em>) et vous l'<strong>appliquez à une zone</strong>. Chaque recette encode un schéma réfléchi et éprouvé pour un besoin précis : confort, sécurité ou efficacité énergétique. Vous configurez quelques réglages évidents (une durée, une température, une plage horaire), pas un langage de programmation.</p>

<p class="sowel-paragraph">Votre maison cesse d'être un projet annexe. Elle fonctionne, tout simplement.</p>

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

<p class="sowel-eyebrow">Ce qui rend Sowel singulier</p>

<p class="sowel-paragraph">Sowel structure votre maison en couches, depuis le réseau :</p>

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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
  </div>
  <h3>Équipements. Un vocabulaire standard pour votre maison.</h3>
  <p>Sowel transforme le câblage de votre maison en un petit catalogue bien défini : luminaires, volets, thermostats, détecteurs de mouvement, compteurs d'énergie. Trois interrupteurs et un détecteur de mouvement dans votre cuisine deviennent un seul équipement <em>Kitchen Lights</em>, quelque chose que vous pouvez nommer, regrouper et raisonner.</p>
</div>

<div class="sowel-card">
  <div class="sowel-card__icon">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
  </div>
  <h3>Des zones qui s'agrègent toutes seules</h3>
  <p>Regroupez les équipements en zones, par pièce, par étage, par usage. Une zone nommée <em>Ground Floor</em> vous donne la température moyenne, la pièce la plus lumineuse, l'humidité la plus élevée, automatiquement. Sans formules, sans code de glue, sans tableau de bord à câbler.</p>
</div>

<div class="sowel-card">
  <div class="sowel-card__icon">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
  </div>
  <h3>Des modes qui basculent toute la maison</h3>
  <p>Jour, Nuit, Vacances, Cocon. Un geste fait basculer votre maison : lumières tamisées, thermostats abaissés, volets fermés. Programmez-les ou déclenchez-les à la main.</p>
</div>

<div class="sowel-card">
  <div class="sowel-card__icon">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21a1 1 0 0 0 1-1v-5.35c0-.46.32-.84.73-1.04a4 4 0 0 0-2.13-7.59 5 5 0 0 0-9.2 0 4 4 0 0 0-2.13 7.59c.41.2.73.58.73 1.04V20a1 1 0 0 0 1 1z"/><path d="M6 17h12"/></svg>
  </div>
  <h3>Des recettes, pas des scripts</h3>
  <p>Posez un schéma d'automatisation sélectionné sur une zone (éclairage déclenché par mouvement, chauffage piloté par présence, irrigation programmée, volets au coucher du soleil), réglez quelques valeurs, et ça tourne. Pas de flows à câbler. Pas de programmation logique.</p>
</div>

</div>

</div>

<div class="sowel-section">

<p class="sowel-eyebrow">Déployez en quelques minutes. À vous dès le premier jour.</p>

<div class="sowel-pills">
  <div class="sowel-pill">
    <strong>Un seul conteneur Docker.</strong> <code>docker compose up -d</code>. C'est ça, l'installation.
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
  <h3>Pour les bâtisseurs</h3>
  <p>Architecture, développement de plugins, recettes, et modèle de données.</p>
  <p><a href="technical/">Guide technique →</a></p>
</div>

</div>

</div>

<p class="sowel-foot">Sowel est distribué sous licence <a href="https://github.com/mchacher/sowel/blob/main/LICENSE">AGPL-3.0</a> · <a href="https://github.com/mchacher/sowel">GitHub</a></p>
