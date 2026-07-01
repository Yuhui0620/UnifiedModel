import React, { useState } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2, type IconName, type SelectableValue } from '@grafana/data';
import { Button, Field, Input, RadioButtonGroup, Stack, Tab, TabsBar, TextArea, useStyles2 } from '@grafana/ui';
import { MModelPage } from '../components/MModelPage';
import { useWorkspace } from '../context/WorkspaceContext';
import { asArray, parseJson, stringify } from '../lib/json';
import { notifyError, notifySuccess } from '../utils/notify';
import { parseMModelElementsFromJson } from '../features/explorer/ExplorerPage';

type ImportMode = 'path' | 'mmodel' | 'entity' | 'expire';

const MODES: Array<{ value: ImportMode; label: string; icon: IconName }> = [
  { value: 'path', label: 'Path', icon: 'file-alt' },
  { value: 'mmodel', label: 'MModel', icon: 'upload' },
  { value: 'entity', label: 'EntityStore', icon: 'database' },
  { value: 'expire', label: 'Expire', icon: 'check-circle' },
];

const sampleElement = `[
  {
    "kind": "entity_set",
    "domain": "devops",
    "name": "devops.service",
    "spec": { "fields": {} }
  }
]`;

const sampleEntity = `[
  {
    "__domain__": "devops",
    "__entity_type__": "devops.service",
    "__entity_id__": "10000000000000000000000000000101",
    "__method__": "Update",
    "__first_observed_time__": 100,
    "__last_observed_time__": 200,
    "display_name": "checkout-service"
  }
]`;

const sampleRelation = `[
  {
    "__src_domain__": "devops",
    "__src_entity_type__": "devops.service",
    "__src_entity_id__": "10000000000000000000000000000101",
    "__dest_domain__": "devops",
    "__dest_entity_type__": "devops.service",
    "__dest_entity_id__": "10000000000000000000000000000102",
    "__relation_type__": "calls",
    "__method__": "Update",
    "__first_observed_time__": 100,
    "__last_observed_time__": 200
  }
]`;

const expireKindOptions: Array<SelectableValue<'entity' | 'relation'>> = [
  { label: 'entity', value: 'entity' },
  { label: 'relation', value: 'relation' },
];

export default function ImportsPage() {
  return (
    <MModelPage>
      <ImportsForm />
    </MModelPage>
  );
}

function ImportsForm() {
  const { workspace, api } = useWorkspace();
  const styles = useStyles2(getStyles);

  const [mode, setMode] = useState<ImportMode>('path');
  const [path, setPath] = useState('examples/quickstart-multidomain');
  const [commonPacks, setCommonPacks] = useState('[]');
  const [elementsJson, setElementsJson] = useState(sampleElement);
  const [entityJson, setEntityJson] = useState(sampleEntity);
  const [relationJson, setRelationJson] = useState(sampleRelation);
  const [expireKind, setExpireKind] = useState<'entity' | 'relation'>('entity');
  const [expireIds, setExpireIds] = useState('["devops/devops.service/10000000000000000000000000000101"]');
  const [result, setResult] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  // Gated by MModelPage, so a workspace exists; guard keeps types honest.
  if (!workspace) {
    return null;
  }

  const run = async (action: 'validate' | 'write' | 'import' | 'sample' | 'expire') => {
    setBusy(true);
    setResult(null);
    try {
      if (action === 'sample') {
        setResult(await api.importSampleData(workspace));
      } else if (action === 'import') {
        setResult(
          await api.importMModel(workspace, {
            path,
            common_schema_packs: commonPacks.trim()
              ? parseJson<string[]>(commonPacks, 'Common schema packs JSON')
              : undefined,
          })
        );
      } else if (mode === 'mmodel') {
        const elements = parseMModelElementsFromJson(elementsJson);
        setResult(
          action === 'validate'
            ? await api.validateMModel(workspace, elements)
            : await api.putMModel(workspace, elements)
        );
      } else if (mode === 'entity') {
        const entities = asArray(
          parseJson<Record<string, unknown> | Array<Record<string, unknown>>>(entityJson, 'Entity JSON')
        );
        const relations = asArray(
          parseJson<Record<string, unknown> | Array<Record<string, unknown>>>(relationJson, 'Relation JSON')
        );
        setResult({
          entities: entities.length > 0 ? await api.writeEntities(workspace, { entities }) : null,
          relations: relations.length > 0 ? await api.writeRelations(workspace, { relations }) : null,
        });
      } else {
        const ids = parseJson<string[]>(expireIds, 'IDs JSON');
        setResult(
          expireKind === 'entity'
            ? await api.expireEntities(workspace, { ids })
            : await api.expireRelations(workspace, { ids })
        );
      }
      notifySuccess('Done');
    } catch (err) {
      notifyError('Request failed', err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack direction="row" gap={2} wrap="wrap">
      <div className={styles.col}>
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

        {mode === 'path' && (
          <>
            <Field label="Server-side path">
              <Input value={path} onChange={(e) => setPath(e.currentTarget.value)} />
            </Field>
            <Field label="Common schema packs JSON">
              <TextArea
                rows={3}
                value={commonPacks}
                onChange={(e) => setCommonPacks(e.currentTarget.value)}
                className={styles.mono}
              />
            </Field>
            <Stack direction="row" gap={1}>
              <Button variant="primary" icon="file-alt" disabled={busy || !path.trim()} onClick={() => run('import')}>
                Import from path
              </Button>
              <Button variant="secondary" icon="star" disabled={busy} onClick={() => run('sample')}>
                Import quickstart sample data
              </Button>
            </Stack>
          </>
        )}

        {mode === 'mmodel' && (
          <>
            <Field label="MModel elements JSON">
              <TextArea
                rows={16}
                value={elementsJson}
                onChange={(e) => setElementsJson(e.currentTarget.value)}
                className={styles.mono}
              />
            </Field>
            <Stack direction="row" gap={1}>
              <Button variant="secondary" icon="check-circle" disabled={busy} onClick={() => run('validate')}>
                Validate
              </Button>
              <Button variant="primary" icon="arrow-up" disabled={busy} onClick={() => run('write')}>
                Put elements
              </Button>
            </Stack>
          </>
        )}

        {mode === 'entity' && (
          <>
            <Field label="Entities JSON">
              <TextArea
                rows={9}
                value={entityJson}
                onChange={(e) => setEntityJson(e.currentTarget.value)}
                className={styles.mono}
              />
            </Field>
            <Field label="Relations JSON">
              <TextArea
                rows={9}
                value={relationJson}
                onChange={(e) => setRelationJson(e.currentTarget.value)}
                className={styles.mono}
              />
            </Field>
            <Button variant="primary" icon="database" disabled={busy} onClick={() => run('write')}>
              Write entity and relation data
            </Button>
          </>
        )}

        {mode === 'expire' && (
          <>
            <Field label="Kind">
              <RadioButtonGroup
                options={expireKindOptions}
                value={expireKind}
                onChange={(v) => setExpireKind(v ?? 'entity')}
              />
            </Field>
            <Field label="IDs JSON">
              <TextArea
                rows={6}
                value={expireIds}
                onChange={(e) => setExpireIds(e.currentTarget.value)}
                className={styles.mono}
              />
            </Field>
            <Button variant="primary" icon="check-circle" disabled={busy} onClick={() => run('expire')}>
              Expire
            </Button>
          </>
        )}
      </div>

      <div className={styles.col}>
        <h4 className={styles.heading}>Response</h4>
        <pre className={styles.pre}>{result ? stringify(result) : 'No response yet.'}</pre>
      </div>
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  col: css`
    flex: 1 1 420px;
    min-width: 320px;
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing(1)};
  `,
  heading: css`
    margin: 0;
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
    max-height: 70vh;
    font-family: ${theme.typography.fontFamilyMonospace};
    font-size: ${theme.typography.bodySmall.fontSize};
  `,
});
