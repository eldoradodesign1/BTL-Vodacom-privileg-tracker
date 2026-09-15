# Audit multi-campagnes — 2026-09-15

## Accès Supabase

Projet confirmé : `upkzlppvwckriuidnyvq` — BTL Deployment Tracker - By Eldo — ACTIVE_HEALTHY.

## Utilisateurs par catégorie et rôle

- `brand_ambassador` / `agent` : 6
- `brand_ambassador_youth` / `agent` : 29
- `hostess` / `agent` : 20
- `operations` / `admin` : 2
- `operations` / `sub_admin` : 3
- `operations` / `super_admin` : 2
- `operations` / `supervisor` : 2

## Campagnes et affectations actives

- Merchant Educational Campaign (`f0f10615-b31f-4241-8333-b1a51d2d761a`) : 0 affectation dans `user_campaign_assignments`.
- Vodacom Privilège (`d0676666-99ad-46fc-9b88-d058097fe69d`) : 0 affectation dans `user_campaign_assignments`.
- Youth F2F (`d6dfdf1b-5593-4ce2-8feb-11fbdc9f3f35`) : 29 affectations actives.

## Conséquence

La production s’appuie encore partiellement sur les anciens mécanismes de catégorie/fallback pour Merchant et Privilège. Il faut donc compléter les affectations Merchant et Privilège avant de supprimer `brand_ambassador_youth` ou de rendre `user_campaign_assignments` obligatoire pour les agents. La migration devra être idempotente, contrôlée par catégorie et campagne, et ne devra supprimer aucune donnée historique.

## Code concerné

- `src/types.ts` contient encore `brand_ambassador_youth`.
- `src/components/LoginScreen.tsx` utilise la catégorie comme fallback de campagne.
- `src/components/Modals/UserModal.tsx` propose déjà seulement Hôtesse et Brand Ambassador dans le formulaire, ainsi que plusieurs campagnes.
- `src/utils/youthCampaign.ts`, `src/utils/storage.ts`, `src/components/AdminView.tsx` et `src/components/SupervisorView.tsx` contiennent encore des filtres `brand_ambassador_youth`.
- Les migrations de base incluent les campagnes et la table d’affectation, mais Youth a été ajouté avec la catégorie historique `brand_ambassador_youth`.
