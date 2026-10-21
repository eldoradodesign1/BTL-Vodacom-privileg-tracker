import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BottomNav } from '../src/components/BottomNav';
import type { UserRole } from '../src/types';

const renderNav = (role: UserRole, context: Record<string, boolean> = {}) => renderToStaticMarkup(
  <BottomNav userRole={role} activeTab="home" onTabChange={() => {}} unreadChatCount={3} {...context} />,
);

test('agents gardent tous leurs menus, avec Mes POS uniquement pour Merchant', () => {
  for (const context of [{}, { youthContext: true }, { mikiliContext: true }]) {
    const html = renderNav('agent', context);
    for (const label of ['Accueil', 'Mes Clients', 'Archives', 'Chat']) assert.ok(html.includes(`>${label}<`));
    assert.ok(!html.includes('>Mes POS<'));
    assert.ok(!html.includes('>Gestion<'));
    assert.ok(html.includes('dock-chat-badge'));
    assert.equal((html.match(/id="agent-dock-action-slot"/g) || []).length, 1);
  }
  const merchant = renderNav('agent', { merchantContext: true });
  for (const label of ['Accueil', 'Mes Transactions', 'Mes POS', 'Archives', 'Chat']) assert.ok(merchant.includes(`>${label}<`));
});

test('tous les opérateurs conservent Monitoring, Archives, Chat et Gestion', () => {
  for (const role of ['supervisor', 'sub_admin', 'admin', 'super_admin'] as UserRole[]) {
    for (const context of [{}, { merchantContext: true }, { youthContext: true }, { mikiliContext: true }]) {
      const html = renderNav(role, context);
      for (const label of ['Accueil', 'Monitoring', 'Archives', 'Chat', 'Gestion']) assert.ok(html.includes(`>${label}<`));
      assert.ok(!html.includes('>Mes POS<'));
      assert.ok(!html.includes('>Mes Clients<'));
    }
  }
});

test('les Events restent limités à Accueil et à Gestion pour les opérateurs', () => {
  const agent = renderNav('agent', { eventContext: true });
  assert.equal((agent.match(/<button /g) || []).length, 1);
  assert.ok(!agent.includes('>Archives<'));
  assert.ok(!agent.includes('>Mes Clients<'));
  const manager = renderNav('supervisor', { eventContext: true });
  assert.equal((manager.match(/<button /g) || []).length, 2);
  assert.ok(manager.includes('>Gestion<'));
});
