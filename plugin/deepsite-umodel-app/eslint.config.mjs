import { defineConfig } from 'eslint/config';
import baseConfig from './.config/eslint.config.mjs';

export default defineConfig([
  {
    ignores: [
      '**/logs',
      '**/*.log',
      '**/npm-debug.log*',
      '**/yarn-debug.log*',
      '**/yarn-error.log*',
      '**/.pnpm-debug.log*',
      '**/node_modules/',
      '.yarn/cache',
      '.yarn/unplugged',
      '.yarn/build-state.yml',
      '.yarn/install-state.gz',
      '**/.pnp.*',
      '**/pids',
      '**/*.pid',
      '**/*.seed',
      '**/*.pid.lock',
      '**/lib-cov',
      '**/coverage',
      '**/dist/',
      '**/artifacts/',
      '**/work/',
      '**/ci/',
      'test-results/',
      'playwright-report/',
      'blob-report/',
      'playwright/.cache/',
      'playwright/.auth/',
      '**/.idea',
      '**/.eslintcache',
    ],
  },
  ...baseConfig,
  {
    // Explorer and Topology are near-verbatim ports of the standalone web app's
    // graph editors. The newer, React-Compiler-aligned react-hooks rules
    // systematically flag legitimate imperative patterns there (reading a ref
    // during render for popover/canvas positioning, fetch/layout effects, WebGL
    // engine wiring) — too many to suppress inline. Relax only those rules, only
    // for the ported COMPONENT files (*.tsx; pure-logic *.ts stay fully strict).
    // exhaustive-deps stays an error: its few intentional violations carry a
    // targeted eslint-disable-next-line with a justification, so new stale-closure
    // bugs are still caught.
    // TODO: revisit during the @grafana/ui re-skin pass.
    files: ['src/features/explorer/**/*.tsx', 'src/features/entityTopo/**/*.tsx'],
    rules: {
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/use-memo': 'off',
      'react/display-name': 'off',
    },
  },
]);
