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
- Thème clair/sombre automatique, animations (respecte `prefers-reduced-motion`), export/import JSON.

## Lancer
Aucune dépendance ni build. Servir le dossier en HTTP :

```sh
python3 -m http.server 8000   # puis ouvrir http://localhost:8000
```

Pour l'installer sur téléphone, héberger le dossier en HTTPS (GitHub Pages, Netlify…) puis « Ajouter à l'écran d'accueil ».

## Structure
`index.html` · `css/style.css` · `js/calc.js` (calculs) · `js/store.js` (stockage) · `js/charts.js` (graphiques SVG) · `js/ui.js` (feuilles modales) · `js/app.js` (vues) · `sw.js` (hors-ligne)
