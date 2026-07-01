import React, { useEffect, useMemo } from 'react';
import { GrafanaTheme2 } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';
import './components.css';

// Maps the standalone web app's `--om-*` design tokens onto the active Grafana
// theme. Setting them as CSS custom properties on a wrapper lets the ported
// `om-*` / `ume-*` stylesheets follow Grafana's light/dark theme unchanged.
function buildThemeVars(theme: GrafanaTheme2): Record<string, string> {
  return {
    '--om-bg': theme.colors.background.canvas,
    '--om-surface': theme.colors.background.primary,
    '--om-surface-subtle': theme.colors.background.secondary,
    '--om-surface-raised': theme.colors.background.primary,
    '--om-text': theme.colors.text.primary,
    '--om-text-muted': theme.colors.text.secondary,
    '--om-text-faint': theme.colors.text.disabled,
    '--om-border': theme.colors.border.weak,
    '--om-border-strong': theme.colors.border.medium,
    '--om-accent': theme.colors.primary.main,
    '--om-accent-strong': theme.colors.primary.shade,
    '--om-accent-soft': theme.colors.primary.transparent,
    '--om-text-inverse': theme.colors.primary.contrastText,
    '--om-indigo': theme.colors.primary.main,
    '--om-indigo-soft': theme.colors.primary.transparent,
    '--om-coral': theme.colors.error.main,
    '--om-coral-soft': theme.colors.error.transparent,
    '--om-amber': theme.colors.warning.main,
    '--om-amber-soft': theme.colors.warning.transparent,
    '--om-red': theme.colors.error.main,
    '--om-red-soft': theme.colors.error.transparent,
    '--om-shadow-sm': theme.shadows.z1,
    '--om-shadow-md': theme.shadows.z3,
    '--om-shadow-panel': theme.shadows.z1,
    '--om-shadow-control': theme.shadows.z1,
    '--om-radius': theme.shape.radius.default,
    '--om-radius-panel': '18px',
    '--om-radius-sm': theme.shape.radius.default,
    '--om-radius-xs': '4px',
    '--om-panel-overlap': '18px',
    '--om-panel-border': theme.colors.border.weak,
    '--om-focus-ring': theme.colors.primary.transparent,
    '--om-sidebar-item-height': '38px',
    '--om-sidebar-item-font-size': '14px',
    '--om-sidebar-row-font-size': '13px',
    '--om-sidebar-meta-font-size': '12px',
    '--om-sidebar-section-font-size': '11px',
    '--om-sidebar-icon-size': '16px',
    '--om-mono': theme.typography.fontFamilyMonospace,
  };
}

// Themed wrapper providing the `--om-*` variables to ported MModel UI. Pages
// render their content inside it (see MModelPage).
export function UModelRoot({ children, className }: { children: React.ReactNode; className?: string }) {
  const theme = useTheme2();
  const vars = useMemo(() => buildThemeVars(theme), [theme]);

  // Also expose the tokens on <body> so content portaled out of this subtree
  // (the explorer's node-menu / focus-panel popovers render into document.body)
  // follows the active theme too. Only `--om-*` custom properties are set, which
  // Grafana's own styles never read, so this does not affect Grafana visuals.
  useEffect(() => {
    const { style } = document.body;
    const keys = Object.keys(vars);
    keys.forEach((k) => style.setProperty(k, vars[k]));
    return () => keys.forEach((k) => style.removeProperty(k));
  }, [vars]);

  return (
    <div className={`umodel-root${className ? ` ${className}` : ''}`} style={vars as React.CSSProperties}>
      {children}
    </div>
  );
}
