import React, { useState } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2, type IconName } from '@grafana/data';
import { Badge, Button, Field, Input, Stack, Tab, TabsBar, useStyles2 } from '@grafana/ui';
import { MModelPage } from '../components/MModelPage';
import { QueryResultTable } from '../components/QueryResultTable';
import { useWorkspace } from '../context/WorkspaceContext';
import { notifyError } from '../utils/notify';
import type { QueryResult } from '../api/types';

type DataMode = 'entity' | 'topo';

const MODES: Array<{ value: DataMode; label: string; icon: IconName }> = [
  { value: 'entity', label: 'Entities', icon: 'list-ul' },
  { value: 'topo', label: 'Topology', icon: 'sitemap' },
];

export default function DataPage() {
  return (
    <MModelPage>
      <DataStore />
    </MModelPage>
  );
}

function DataStore() {
  const { workspace, api } = useWorkspace();
  const styles = useStyles2(getStyles);

  const [mode, setMode] = useState<DataMode>('entity');
  const [domain, setDomain] = useState('devops');
  const [name, setName] = useState('devops.service');
  const [queryText, setQueryText] = useState('checkout');
  const [seed, setSeed] = useState('10000000000000000000000000000101');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [busy, setBusy] = useState(false);

  // Gated by MModelPage, so a workspace exists; guard keeps types honest.
  if (!workspace) {
    return null;
  }

  const run = async () => {
    setBusy(true);
    try {
      const spl =
        mode === 'entity'
          ? `.entity with(domain='${escapeSPL(domain)}', name='${escapeSPL(name)}', query='${escapeSPL(queryText)}', topk=50) | limit 50`
          : `.topo | graph-call getDirectRelations([(:"devops@devops.service" {__entity_id__: '${escapeSPL(seed)}'})]) | limit 50`;
      setResult(await api.query(workspace, { query: spl, limit: 50 }));
    } catch (err) {
      notifyError('Query failed', err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack direction="column" gap={2}>
      <Stack direction="row" gap={1} alignItems="center" justifyContent="space-between">
        <TabsBar>
          {MODES.map((m) => (
            <Tab
              key={m.value}
              label={m.label}
              icon={m.icon}
              active={mode === m.value}
              onChangeTab={() => setMode(m.value)}
            />
          ))}
        </TabsBar>
        <Button variant="primary" icon="play" disabled={busy} onClick={run}>
          Run
        </Button>
      </Stack>

      {mode === 'entity' ? (
        <Stack direction="row" gap={1} wrap="wrap">
          <div className={styles.narrow}>
            <Field label="Domain">
              <Input value={domain} onChange={(e) => setDomain(e.currentTarget.value)} />
            </Field>
          </div>
          <div className={styles.medium}>
            <Field label="Entity set">
              <Input value={name} onChange={(e) => setName(e.currentTarget.value)} />
            </Field>
          </div>
          <div className={styles.grow}>
            <Field label="Search">
              <Input value={queryText} onChange={(e) => setQueryText(e.currentTarget.value)} />
            </Field>
          </div>
        </Stack>
      ) : (
        <Field label="Seed entity ID">
          <Input value={seed} onChange={(e) => setSeed(e.currentTarget.value)} />
        </Field>
      )}

      <Stack direction="row" gap={1} alignItems="center">
        <h5 className={styles.heading}>Result</h5>
        {result && <Badge text={String(result.rows.length)} color="darkgrey" />}
      </Stack>
      {result ? <QueryResultTable result={result} /> : <div className={styles.muted}>No result yet.</div>}
    </Stack>
  );
}

function escapeSPL(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

const getStyles = (theme: GrafanaTheme2) => ({
  heading: css`
    margin: 0;
  `,
  muted: css`
    color: ${theme.colors.text.secondary};
  `,
  narrow: css`
    width: 160px;
  `,
  medium: css`
    width: 220px;
  `,
  grow: css`
    flex: 1;
    min-width: 220px;
  `,
});
