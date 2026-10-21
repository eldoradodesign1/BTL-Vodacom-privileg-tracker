import test from 'node:test';
import assert from 'node:assert/strict';
import { getAdjacentTab, getBottomNavTabs } from '../src/components/BottomNav';

test('le balayage suit exactement l’ordre affiché pour un agent Privilège', () => {
  const tabs = getBottomNavTabs({ userRole: 'agent' });
  assert.deepEqual(tabs.map(({ tab }) => tab), ['home', 'tab2', 'tab3', 'chat']);
  assert.equal(getAdjacentTab(tabs, 'home', 'next'), 'tab2');
  assert.equal(getAdjacentTab(tabs, 'tab2', 'previous'), 'home');
  assert.equal(getAdjacentTab(tabs, 'tab2', 'next'), 'tab3');
  assert.equal(getAdjacentTab(tabs, 'chat', 'next'), null);
});

test('le balayage Merchant conserve le menu Mes POS entre transactions et archives', () => {
  const tabs = getBottomNavTabs({ userRole: 'agent', merchantContext: true });
  assert.deepEqual(tabs.map(({ tab }) => tab), ['home', 'tab2', 'pos', 'tab3', 'chat']);
  assert.equal(getAdjacentTab(tabs, 'tab2', 'next'), 'pos');
  assert.equal(getAdjacentTab(tabs, 'pos', 'previous'), 'tab2');
  assert.equal(getAdjacentTab(tabs, 'pos', 'next'), 'tab3');
});

test('le balayage des opérateurs couvre monitoring, archives, chat et gestion', () => {
  const tabs = getBottomNavTabs({ userRole: 'supervisor', youthContext: true });
  assert.deepEqual(tabs.map(({ tab }) => tab), ['home', 'tab2', 'tab3', 'chat', 'admin']);
  assert.equal(getAdjacentTab(tabs, 'home', 'previous'), null);
  assert.equal(getAdjacentTab(tabs, 'tab3', 'next'), 'chat');
  assert.equal(getAdjacentTab(tabs, 'chat', 'next'), 'admin');
});

test('un Event garde son périmètre réduit et ne peut pas balayer vers un écran inexistant', () => {
  const agentTabs = getBottomNavTabs({ userRole: 'agent', eventContext: true });
  const supervisorTabs = getBottomNavTabs({ userRole: 'supervisor', eventContext: true });
  assert.deepEqual(agentTabs.map(({ tab }) => tab), ['home']);
  assert.equal(getAdjacentTab(agentTabs, 'home', 'next'), null);
  assert.deepEqual(supervisorTabs.map(({ tab }) => tab), ['home', 'admin']);
  assert.equal(getAdjacentTab(supervisorTabs, 'home', 'next'), 'admin');
});
