import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Alert, useStyles2 } from '@grafana/ui';
import type { QueryResult } from '../api/types';

// Themed table for SPL query results, shared by the Query and Data store pages.
export function QueryResultTable({ result }: { result: QueryResult }) {
  const styles = useStyles2(getStyles);
  if (!result.rows?.length) {
    return <Alert title="No rows" severity="info" />;
  }
  const cols = result.columns?.length ? result.columns : Object.keys(result.rows[0] ?? {});
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row, i) => (
            <tr key={i}>
              {cols.map((c) => (
                <td key={c}>{renderCell(row[c])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderCell(v: unknown): string {
  if (v === null || v === undefined) {
    return '';
  }
  if (typeof v === 'object') {
    return JSON.stringify(v);
  }
  return String(v);
}

const getStyles = (theme: GrafanaTheme2) => ({
  tableWrap: css`
    overflow: auto;
    max-height: 60vh;
    border: 1px solid ${theme.colors.border.weak};
    border-radius: ${theme.shape.radius.default};
  `,
  table: css`
    width: 100%;
    border-collapse: collapse;
    font-size: ${theme.typography.bodySmall.fontSize};
    th,
    td {
      text-align: left;
      padding: ${theme.spacing(0.5, 1)};
      border-bottom: 1px solid ${theme.colors.border.weak};
      white-space: nowrap;
    }
    th {
      position: sticky;
      top: 0;
      background: ${theme.colors.background.secondary};
    }
  `,
});
