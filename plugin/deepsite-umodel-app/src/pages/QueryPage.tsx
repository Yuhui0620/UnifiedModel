import React, { useState } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Alert, Button, Field, Input, Stack, TextArea, useStyles2 } from '@grafana/ui';
import { MModelPage } from '../components/MModelPage';
import { QueryResultTable } from '../components/QueryResultTable';
import { useWorkspace } from '../context/WorkspaceContext';
import { formatError, stringify } from '../lib/json';
import { notifyError } from '../utils/notify';
import type { QueryExplain, QueryResult } from '../api/types';

export default function QueryPage() {
  return (
    <MModelPage>
      <QueryConsole />
    </MModelPage>
  );
}

function QueryConsole() {
  const { workspace, api } = useWorkspace();
  const styles = useStyles2(getStyles);
  const [spl, setSpl] = useState('.mmodel | sort name | limit 50');
  const [limit, setLimit] = useState(100);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [explain, setExplain] = useState<QueryExplain | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Rendering is gated by MModelPage, so a workspace exists; guard keeps types honest.
  if (!workspace) {
    return null;
  }

  const run = async () => {
    setRunning(true);
    setError(null);
    setExplain(null);
    try {
      const res = await api.query(workspace, { query: spl, limit });
      setResult(res);
    } catch (err) {
      setError(formatError(err));
      notifyError('Query failed', err);
    } finally {
      setRunning(false);
    }
  };

  const doExplain = async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await api.explain(workspace, { query: spl, limit });
      setExplain(res);
    } catch (err) {
      setError(formatError(err));
      notifyError('Explain failed', err);
    } finally {
      setRunning(false);
    }
  };

  return (
    <Stack direction="column" gap={2}>
      <Field label="SPL query" description="Public query over .mmodel, .entity and .topo sources.">
        <TextArea value={spl} onChange={(e) => setSpl(e.currentTarget.value)} rows={5} className={styles.mono} />
      </Field>

      <Stack direction="row" gap={1} alignItems="flex-end">
        <Field label="Limit">
          <Input
            type="number"
            width={12}
            value={limit}
            onChange={(e) => setLimit(Number(e.currentTarget.value) || 0)}
          />
        </Field>
        <Button icon="play" onClick={run} disabled={running}>
          Run
        </Button>
        <Button variant="secondary" icon="info-circle" onClick={doExplain} disabled={running}>
          Explain
        </Button>
      </Stack>

      {error && (
        <Alert title="Error" severity="error">
          {error}
        </Alert>
      )}

      {explain && (
        <Field label="Explain">
          <pre className={styles.pre}>{stringify(explain)}</pre>
        </Field>
      )}

      {result && <QueryResultTable result={result} />}
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  mono: css`
    font-family: ${theme.typography.fontFamilyMonospace};
  `,
  pre: css`
    margin: 0;
    padding: ${theme.spacing(1)};
    background: ${theme.colors.background.secondary};
    border: 1px solid ${theme.colors.border.weak};
    border-radius: ${theme.shape.radius.default};
    overflow: auto;
    max-height: 40vh;
    font-family: ${theme.typography.fontFamilyMonospace};
    font-size: ${theme.typography.bodySmall.fontSize};
  `,
});
