# Activation WEWA

Campagne d’adoption du paiement des courses à moto avec M-Pesa, dans les stations ENGEN de Kinshasa. Début provisoire : 20 octobre 2026. Horaires attendus : 08:00–17:00.

## Parcours livré

- BA : district puis station (ou station affectée par la supervision), photo et GPS d’arrivée, enregistrements des motards, clôture avec commentaire et GPS.
- Registre : nom, téléphone et/ou shortcode, compte M-Pesa et application déjà présents, compte marchand ouvert et application installée pendant l’intervention.
- Unicité des téléphones normalisés et des shortcodes par campagne. Les shortcodes gardent leurs zéros initiaux. Une application déjà présente ne compte pas comme nouvelle installation.
- Supervision : trois objectifs quotidiens par BA, critère du podium, mode d’identification, dates, stations ENGEN et affectations quotidiennes. Aucun objectif ni aucune station n’est inventé.
- Orbit : tableau de bord et courbe de progression, comparaison BA/stations, ratios d’ouverture et d’installation, présence incluant les journées sans enregistrement, exports Excel/PDF.
- Excel : synthèse et performances par formules, onglets Sources et Pointages masqués et réaffichables.

## Contrat de données

Migration `supabase/migrations/20261029175526_activation_wewa.sql`, appliquée au projet BTL. Tables propres à WEWA, sans modification des tables métier des autres campagnes. Les lectures directes anon/authenticated sont révoquées ; les RPC contrôlent les sessions et les affectations. Sessions de 12 h liées aux identifiants existants, invalidées en cas de changement du mot de passe ou de désactivation du compte. Photos chargées à la demande. La projection Orbit ne contient pas les noms/numéros des motards, photos ou coordonnées GPS.

Les avis « RLS sans politique » sont intentionnels : les tables ne sont pas accessibles directement. Les trois points d’entrée SECURITY DEFINER sont intentionnels et utilisent un search_path vide, des sessions vérifiées et une projection client réduite.

## État de livraison et publication

Le schéma est installé, les tables sont vides et la campagne n’est pas encore rendue visible. Le script `supabase/seeds/activation_wewa.sql` est prêt à créer la campagne et à affecter uniquement Agent Test, supervisé par Alpha Okito, Serge Kisend, Hervé Ntalu et Shekinah Sita.

Ordre de mise en service :

1. Relire les dernières versions distantes et intégrer les changements concurrents éventuels.
2. Publier Tracker (`docs/`) et Orbit (bundle construit puis copié à la racine avec son script habituel).
3. Attendre et vérifier les deux publications GitHub Pages, y compris les ressources JS/CSS.
4. Exécuter le seed WEWA une seule fois, puis vérifier campagne, affectation BA et quatre liens de supervision.
5. Ajouter ultérieurement la liste officielle des stations. Avant cette configuration, le pointage affiche « Stations ENGEN à venir ».

## Validation

- TypeScript et construction de production des deux applications.
- Six tests Node sur numéros, compteurs, classement, journées à zéro, formules Excel, sources masquées et UUID.
- Tests SQL réels : sessions, permissions, affectation de station, pointage obligatoire, idempotence, doublons, situation initiale, compteurs, visibilité client, accès des quatre superviseurs et clôture. Toute la transaction de test a été annulée ; aucun exemple ne reste en base.
- Vérification visuelle locale du parcours BA, des paramètres superviseur et du formulaire à 390 pixels, avec des données de démonstration isolées.

Tests locaux : `node --import tsx --test tests/wewa.test.ts`. Le fichier SQL `supabase/tests/wewa_invariants.sql` doit être exécuté dans une transaction avec le seed, puis ROLLBACK.
