# Kakeibo

Application de gestion de budget inspirée du **Kakeibo** japonais. PWA mobile : installable sur l'écran d'accueil, fonctionne hors-ligne, données stockées uniquement sur l'appareil (localStorage).

## Fonctionnalités
- **Premier lancement** : rentrées d'argent (avec jour de versement), dépenses fixes (avec jour de prélèvement), budgets mensuels, objectifs d'épargne (avec ou sans échéance).
- **Charges fixes catégorisées** (Indispensable, Loisirs, Temporaire — avec dernier mois optionnel) et catalogue d'idées rapides : Netflix, Spotify, salle de sport, assurance moto, mutuelle, crédit…
- **Budgets mensuels** par poste (courses, transport…) : liaison à chaque dépense, jauge et alertes à 80 % et en cas de dépassement.
- **Plaisirs par budget** : le budget choisi sur une dépense plaisir sert de catégorie ; le Bilan montre quel poste pèse le plus.
- **Calculs automatiques** : reste à vivre mensuel et par jour, épargne mensuelle nécessaire, répartition du revenu, notes et conseils.
- **Saisie rapide** : bouton `+` → montant → un tap sur **Besoin**, **Plaisir** ou **Imprévu** enregistre la dépense.
- **Prénom** demandé au premier lancement ; **anneau du reste du mois** qui inclut la part encore réservée aux budgets.
- **Comparaisons** dans le Bilan : mois contre mois précédent (au même jour si le mois est en cours) et vue annuelle (mois par mois, moyenne, mois le plus dépensier, comparaison avec l'année précédente).
- **Journal** par mois avec filtres, **Bilan** (anneau, rythme du mois, barres journalières, les 4 questions du Kakeibo), **Objectifs** avec versements.
- **Données protégées** : stockage persistant demandé au navigateur, copie de secours (IndexedDB) restaurée automatiquement si besoin, sauvegarde JSON vers Fichiers / Drive via la feuille de partage du téléphone, avec rappel mensuel.
- **Historique fidèle** : la situation (revenus, charges, budgets, épargne) est figée pour chaque mois ; modifier ton loyer ne change plus les anciens bilans.
- **Mois de paie** : le mois de budget peut commencer le jour de ton choix (ex. du 28 au 27).
- **Accueil simplifié** : un seul chiffre (ce qu'il reste à dépenser, avec la date limite), une barre « dépensé / disponible », le calcul du disponible écrit en clair, puis budgets, prélèvements et « où va ton revenu » avec une phrase par part.
- **Répartition du revenu en 4 parts** : prélèvements, budgets, épargne visée, reste libre. La partie déjà consommée est estompée ; l'épargne n'est pas retirée d'office du budget, elle n'est versée sur les objectifs (fin de mois) que si le budget est tenu, sinon les dépenses l'entament.
- **Prélèvements du mois** : charges fixes marquées « prélevées » à leur date, reste à prélever d'ici la fin du mois, rappel dans le journal.
- **Fin de mois** : le budget non dépensé peut être reporté au mois suivant ou versé dans une cagnotte (objectif).
- **Rappel quotidien** paramétrable : bandeau si rien n'est saisi à l'heure choisie, plus un fichier calendrier (.ics) pour une vraie notification récurrente.
- **Saisie sans clavier système** : pavé numérique intégré pour les montants (dépense, versement, fin de mois) ; les fenêtres apparaissent au centre et se calent sur la zone visible quand le clavier est ouvert.
- **Journal** : recherche, filtres par type et par budget, prélèvements passés, export CSV du mois.
- **Accessibilité (daltonisme)** : palette Okabe-Ito (bleu / orange / rose-violet), motifs (rayures, points, quadrillage) sur chaque catégorie des graphiques et légendes, symboles ▲ / ! / ✓ pour les alertes et variations ; motifs désactivables dans Réglages.
- Thème clair/sombre automatique, animations (respecte `prefers-reduced-motion`), export/import JSON.

## Lancer
Aucune dépendance ni build. Servir le dossier en HTTP :

```sh
python3 -m http.server 8000   # puis ouvrir http://localhost:8000
```

Pour l'installer sur téléphone, héberger le dossier en HTTPS (GitHub Pages, Netlify…) puis « Ajouter à l'écran d'accueil ».

## Structure
`index.html` · `css/style.css` · `js/calc.js` (calculs) · `js/store.js` (stockage) · `js/charts.js` (graphiques SVG) · `js/ui.js` (feuilles modales) · `js/app.js` (vues) · `sw.js` (hors-ligne)
