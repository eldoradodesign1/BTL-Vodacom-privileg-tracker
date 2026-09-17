import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';

/**
 * Temporary compatibility patch while the campaign router is being migrated
 * from the original three-context model to the database-driven campaign model.
 * It keeps App.tsx backward-compatible without duplicating the whole shell.
 */
function multiCampaignContextPatch(): Plugin {
  return {
    name: 'btl-multi-campaign-context-patch',
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('/src/App.tsx') && !id.endsWith('/src/components/Header.tsx')) return null;

      let next = code;

      if (id.endsWith('/src/App.tsx')) {
        next = next
          .replace(
            "if (saved === 'merchant-educational' || saved === 'youth-f2f') return saved;",
            "if (saved === 'merchant-educational' || saved === 'youth-f2f' || saved === 'mpesa-mikili') return saved as CampaignContext;"
          )
          .replace(
            "const campaigns = await getCampaignsForUser(campaignSubjectId);",
            "const campaigns = currentUser?.role === 'super_admin' ? await getCampaigns() : await getCampaignsForUser(campaignSubjectId);"
          )
          .replace(
            "activeCampaign === 'youth-f2f'\n            ? campaign.code === 'youth-f2f'\n            : activeCampaign === 'merchant-educational'",
            "activeCampaign === 'mpesa-mikili'\n            ? campaign.code === 'mpesa-mikili'\n            : activeCampaign === 'youth-f2f'\n            ? campaign.code === 'youth-f2f'\n            : activeCampaign === 'merchant-educational'"
          )
          .replace(
            "const nextContext: CampaignContext = fallback.code === 'youth-f2f'\n            ? 'youth-f2f'\n            : fallback.code === 'merchant-educational-campaign'\n              ? 'merchant-educational'\n              : 'vodacom-privilege';",
            "const nextContext: CampaignContext = fallback.code === 'mpesa-mikili'\n            ? 'mpesa-mikili'\n            : fallback.code === 'youth-f2f'\n              ? 'youth-f2f'\n              : fallback.code === 'merchant-educational-campaign'\n                ? 'merchant-educational'\n                : 'vodacom-privilege';"
          )
          .replace(
            "key: (campaign.code === 'youth-f2f'\n      ? 'youth-f2f'\n      : campaign.code === 'merchant-educational-campaign'\n        ? 'merchant-educational'\n        : 'vodacom-privilege') as CampaignContext,",
            "key: (campaign.code === 'mpesa-mikili'\n      ? 'mpesa-mikili'\n      : campaign.code === 'youth-f2f'\n        ? 'youth-f2f'\n        : campaign.code === 'merchant-educational-campaign'\n          ? 'merchant-educational'\n          : 'vodacom-privilege') as CampaignContext,"
          );
      }

      if (id.endsWith('/src/components/Header.tsx')) {
        next = next
          .replace(
            "{ key: 'youth-f2f' as const, label: 'Youth F2F', note: 'Sensibilisation universitaire' },",
            "{ key: 'youth-f2f' as const, label: 'Youth F2F', note: 'Sensibilisation universitaire' },\n    { key: 'mpesa-mikili' as const, label: 'M-Pesa Mikili', note: 'Sensibilisation M-Pesa Mikili' },"
          )
          .replace(
            "onSetCampaign(campaign.key as 'vodacom-privilege' | 'merchant-educational');",
            "onSetCampaign(campaign.key);"
          );
      }

      return next === code ? null : {code: next, map: null};
    },
  };
}

export default defineConfig(() => {
  return {
    base: process.env.GITHUB_PAGES === 'true' ? '/BTL-Vodacom-privileg-tracker/' : '/',
    plugins: [multiCampaignContextPatch(), react(), tailwindcss()],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            if (id.includes('react')) return 'vendor-react';
            if (id.includes('@supabase')) return 'vendor-supabase';
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('recharts')) return 'vendor-charts';
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      allowedHosts: ['.manus.computer'],
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    preview: {
      allowedHosts: ['.manus.computer'],
    },
  };
});
