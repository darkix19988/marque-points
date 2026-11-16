# Marque-points

Compteurs de points pour jeux de société et partage des dépenses entre amis, en ligne avec GitHub Pages. Le site est statique, sans dépendance ni étape de build, et il fonctionne hors ligne une fois chargé.

## Jeux

### Skull King

- **Éditions** : édition actuelle (Grandpa Beck's, 2021 et après) et ancienne édition (Schmidt, Scary Mary).
- **Décomptes** : Skull King (classique) et Rascal, avec l'option Mitraille / Boulet de canon.
- **Règles avancées** : Kraken, Baleine blanche, Butin, pouvoirs des pirates (Harry le Géant, Rascal of Roatan).
- **Expansion Pack (2025)** : 7 / 8 / 0-14, Wild 15, Mary Thorne, First Mate Con, Coffre de Davy Jones, Raie tachetée, La Planche, Dernière salve.
- **Manches** : classique, variantes officielles (Even Keeled, Skip to the Brawl, Whirlpool…) ou personnalisées. Avec beaucoup de joueurs, le nombre de cartes est plafonné à ce que permet le paquet.
- **Joueurs** : dès 2, sans limite. Au-delà du nombre conseillé par la règle, le site prévient et plafonne les cartes par manche.
- **Bonus** : on compte les cartes capturées (le site calcule), ou on tape directement les points, plus rapide pour les habitués. On peut changer de mode en cours de partie.
- **Contrôles** : total des plis, plis détruits, bonus impossibles (cartes en double, bonus sans pli), pouvoirs utilisés sans pli.

Thème clair, sombre ou automatique (suit le téléphone), au choix.

Les parties sont enregistrées dans le navigateur (`localStorage`). Rien n'est envoyé sur Internet.

### Dépenses

Partage des frais d'un groupe (week-end, coloc, soirée), sur un seul téléphone.

- Dépenses à parts égales, par parts (un couple = 2 parts) ou en montants précis, avec catégories.
- Soldes de chacun et remboursements proposés avec le moins de virements possible ; « Fait ✓ » enregistre le remboursement.
- Résumé à partager par message, export / import d'un groupe en fichier pour changer de téléphone.
- Montants calculés en centimes : aucun centime perdu dans les arrondis.

## Structure

```
index.html            accueil, liste des jeux
assets/               styles et icônes partagés
skull-king/rules.js   règles et calcul des points (sans DOM, testé)
skull-king/app.js     interface
depenses/money.js     calculs du partage des dépenses (sans DOM, testé)
depenses/app.js       interface des dépenses
assets/js/update.js   détection des mises à jour (bandeau « Mettre à jour »)
assets/js/shell.js    fenêtre <dialog>, zone de messages, focus conservé
sw.js                 cache hors ligne
tests/                tests du décompte (node --test tests/)
```

**À chaque mise à jour**, incrémenter le même numéro partout : `version.json`, les `data-version` et `?v=` des pages HTML, les `?v=` des imports dans les `app.js` et `CACHE` dans `sw.js`. Les fichiers d'une page sont ainsi toujours chargés dans la même version, et le bandeau « Nouvelle version disponible » apparaît chez ceux qui ont installé le site en web app.

Pour ajouter un jeu : créer un dossier `nom-du-jeu/` sur le modèle de `skull-king/`, puis l'ajouter à `index.html` et à la liste `SHELL` de `sw.js`.

## Développement

```bash
python3 -m http.server 8000
node --test tests/
```
