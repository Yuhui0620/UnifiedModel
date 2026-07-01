import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import {
  Badge,
  Button,
  Combobox,
  type ComboboxOption,
  type Column,
  Field,
  Icon,
  InteractiveTable,
  Stack,
  TextArea,
  useStyles2,
} from '@grafana/ui';
import { MModelPage } from '../components/MModelPage';
import { useWorkspace } from '../context/WorkspaceContext';
import { parseJson, stringify } from '../lib/json';
import { notifyError } from '../utils/notify';
import type { AgentDiscovery, AgentNextAction, AgentResource } from '../api/types';

export default function AgentPage() {
  return (
    <MModelPage>
      <AgentGateway />
    </MModelPage>
  );
}

function AgentGateway() {
  const { workspace, api } = useWorkspace();
  const styles = useStyles2(getStyles);

  const [discovery, setDiscovery] = useState<AgentDiscovery | null>(null);
  const [selectedResource, setSelectedResource] = useState<AgentResource | null>(null);
  const [resourceResult, setResourceResult] = useState<unknown>(null);
  const [toolName, setToolName] = useState('query_spl_examples');
  const [toolArgs, setToolArgs] = useState('{}');
  const [toolResult, setToolResult] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!workspace) {
      return;
    }
    setBusy(true);
    try {
      const next = await api.discoverAgent(workspace);
      setDiscovery(next);
      setToolName(
        next.tools.find((t) => t.name === 'query_spl_examples')?.name || next.tools[0]?.name || 'query_spl_examples'
      );
      setSelectedResource(next.resources[0] || null);
    } catch (err) {
      notifyError('Discovery failed', err);
    } finally {
      setBusy(false);
    }
  }, [api, workspace]);

  useEffect(() => {
    // One-time discovery load on mount / workspace change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const toolOptions: Array<ComboboxOption<string>> = useMemo(
    () => (discovery?.tools || []).map((t) => ({ label: t.name, value: t.name })),
    [discovery]
  );

  const nextActionColumns = useMemo<Array<Column<AgentNextAction>>>(
    () => [
      { id: 'id', header: 'ID', cell: ({ row: { original } }) => <code>{original.id}</code> },
      { id: 'title', header: 'Title' },
      { id: 'tool', header: 'Tool' },
      { id: 'query', header: 'Query', cell: ({ row: { original } }) => <code>{original.query_api.body.query}</code> },
    ],
    []
  );

  const readResource = async (resource: AgentResource) => {
    if (!workspace) {
      return;
    }
    setBusy(true);
    try {
      setSelectedResource(resource);
      setResourceResult(await api.readAgentResource(workspace, resource.uri));
    } catch (err) {
      notifyError('Read resource failed', err);
    } finally {
      setBusy(false);
    }
  };

  const executeTool = async () => {
    if (!workspace) {
      return;
    }
    setBusy(true);
    setToolResult(null);
    try {
      const args = toolArgs.trim() ? parseJson<Record<string, unknown>>(toolArgs, 'Tool arguments JSON') : {};
      setToolResult(await api.executeAgentTool(workspace, toolName, args));
    } catch (err) {
      notifyError('Execute tool failed', err);
    } finally {
      setBusy(false);
    }
  };

  if (!workspace) {
    return null;
  }

  return (
    <Stack direction="column" gap={2}>
      <Stack direction="row" gap={1} alignItems="center" justifyContent="space-between">
        <h4 className={styles.heading}>Agent gateway</h4>
        <Button variant="secondary" fill="text" icon="sync" disabled={busy} onClick={() => load()}>
          Refresh
        </Button>
      </Stack>

      <Stack direction="row" gap={2} wrap="wrap">
        <div className={styles.col}>
          <Stack direction="row" gap={1} alignItems="center">
            <h5 className={styles.heading}>Tools</h5>
            {discovery && <Badge text={String(discovery.tools.length)} color="darkgrey" />}
          </Stack>
          {discovery?.tools.map((tool) => (
            <div key={tool.name} className={styles.row}>
              <div>
                <strong>{tool.name}</strong>
                <div className={styles.muted}>{tool.description}</div>
              </div>
              <Badge text={tool.enabled ? 'enabled' : 'disabled'} color={tool.enabled ? 'green' : 'orange'} />
            </div>
          ))}
          {!discovery && <div className={styles.muted}>No discovery loaded.</div>}
        </div>

        <div className={styles.col}>
          <h5 className={styles.heading}>Execute tool</h5>
          <Field label="Tool">
            <Combobox<string>
              options={toolOptions}
              value={toolName}
              onChange={(opt) => setToolName(opt?.value ?? '')}
            />
          </Field>
          <Field label="Arguments JSON">
            <TextArea
              rows={5}
              value={toolArgs}
              onChange={(e) => setToolArgs(e.currentTarget.value)}
              className={styles.mono}
            />
          </Field>
          <Button variant="primary" icon="play" disabled={busy || !toolName} onClick={executeTool}>
            Execute
          </Button>
          <pre className={styles.pre}>{toolResult ? stringify(toolResult) : 'No tool result yet.'}</pre>
        </div>
      </Stack>

      <Stack direction="row" gap={2} wrap="wrap">
        <div className={styles.col}>
          <Stack direction="row" gap={1} alignItems="center">
            <h5 className={styles.heading}>Resources</h5>
            {discovery && <Badge text={String(discovery.resources.length)} color="darkgrey" />}
          </Stack>
          {discovery?.resources.map((resource) => (
            <button
              key={resource.uri}
              className={styles.rowButton}
              type="button"
              onClick={() => readResource(resource)}
            >
              <div>
                <strong>{resource.name}</strong>
                <div className={styles.muted}>{resource.description}</div>
              </div>
              <Icon name="brackets-curly" />
            </button>
          ))}
        </div>

        <div className={styles.col}>
          <Stack direction="row" gap={1} alignItems="center">
            <h5 className={styles.heading}>Resource content</h5>
            {selectedResource && <Badge text={selectedResource.kind} color="darkgrey" />}
          </Stack>
          <pre className={styles.pre}>{resourceResult ? stringify(resourceResult) : 'Select a resource to read.'}</pre>
        </div>
      </Stack>

      {discovery?.next_actions && discovery.next_actions.length > 0 && (
        <Stack direction="column" gap={1}>
          <Stack direction="row" gap={1} alignItems="center">
            <h5 className={styles.heading}>Next actions</h5>
            <Badge text={String(discovery.next_actions.length)} color="darkgrey" />
          </Stack>
          <InteractiveTable columns={nextActionColumns} data={discovery.next_actions} getRowId={(a) => a.id} />
        </Stack>
      )}
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  col: css`
    flex: 1 1 360px;
    min-width: 300px;
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing(1)};
  `,
  heading: css`
    margin: 0;
  `,
  muted: css`
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.bodySmall.fontSize};
    margin-top: ${theme.spacing(0.5)};
  `,
  row: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${theme.spacing(1)};
    padding: ${theme.spacing(1)};
    border: 1px solid ${theme.colors.border.weak};
    border-radius: ${theme.shape.radius.default};
    background: ${theme.colors.background.secondary};
  `,
  rowButton: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${theme.spacing(1)};
    padding: ${theme.spacing(1)};
    border: 1px solid ${theme.colors.border.weak};
    border-radius: ${theme.shape.radius.default};
    background: ${theme.colors.background.secondary};
    text-align: left;
    cursor: pointer;
    &:hover {
      background: ${theme.colors.action.hover};
    }
  `,
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
