# Vérification UI multi-campagnes — 2026-09-16

L’instance Vite locale charge correctement l’écran de connexion, puis la vue Superviseur avec `0812923941` / mot de passe de test. L’onglet Gestion Privilège affiche le bouton personnalisé `Agent`. La modale s’ouvre sans écran blanc et expose deux parcours : `Créer un agent` et `Affecter un agent`.

Le parcours d’affectation affiche l’agent local `Agent Test · 0821000001 · BA`. Les campagnes actives restent vides dans ce test local car l’instance Vite ne possède pas de configuration Supabase locale (`La configuration Supabase est indisponible.`). Ce point concerne uniquement l’environnement local de test ; la lecture réelle des affectations a été validée auparavant via Supabase MCP.

Aucune opération d’écriture métier n’a été déclenchée depuis l’interface durant le test.
