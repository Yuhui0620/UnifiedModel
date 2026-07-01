import React, { useMemo } from 'react';
import { PluginPage } from '@grafana/runtime';
import { Badge, type Column, InteractiveTable, Stack, Text } from '@grafana/ui';

interface ApiBinding {
  surface: string;
  api: string;
  purpose: string;
}

// Static reference: which UI surface maps to which public MModel REST endpoint.
// The UI is built entirely on public contracts; this page makes no network calls.
const rows: ApiBinding[] = [
  { surface: 'Workspace chooser', api: 'GET /api/v1/workspaces', purpose: 'List selectable workspaces.' },
  { surface: 'Create workspace', api: 'POST /api/v1/workspaces', purpose: 'Create workspace metadata.' },
  { surface: 'Workspace shell', api: 'GET /api/v1/workspaces/{workspace}', purpose: 'Load selected workspace.' },
  {
    surface: 'Workspace settings',
    api: 'PUT /api/v1/workspaces/{workspace}',
    purpose: 'Update name, description, labels, config.',
  },
  {
    surface: 'Workspace delete',
    api: 'DELETE /api/v1/workspaces/{workspace}',
    purpose: 'Soft-delete workspace metadata.',
  },
  {
    surface: 'Explorer graph/table',
    api: 'POST /api/v1/query/{workspace}/execute',
    purpose: 'Run .mmodel queries.',
  },
  {
    surface: 'Element edit',
    api: 'POST /api/v1/mmodel/{workspace}/validate',
    purpose: 'Validate JSON editor payload.',
  },
  { surface: 'Element save', api: 'POST /api/v1/mmodel/{workspace}/elements', purpose: 'Write MModel elements.' },
  {
    surface: 'Element delete',
    api: 'DELETE /api/v1/mmodel/{workspace}/elements',
    purpose: 'Request deletion by IDs.',
  },
  {
    surface: 'Import by path',
    api: 'POST /api/v1/mmodel/{workspace}/import',
    purpose: 'Import YAML/JSON from server-readable path.',
  },
  {
    surface: 'Import sample data',
    api: 'POST /api/v1/samples/{workspace}/multi-domain-quickstart:import',
    purpose: 'Import bundled MModel, entities, and topology.',
  },
  {
    surface: 'Entity write',
    api: 'POST /api/v1/entitystore/{workspace}/entities:write',
    purpose: 'Write CMS 2.0 entities.',
  },
  {
    surface: 'Relation write',
    api: 'POST /api/v1/entitystore/{workspace}/relations:write',
    purpose: 'Write CMS 2.0 relations.',
  },
  {
    surface: 'Expire entities',
    api: 'POST /api/v1/entitystore/{workspace}/entities:expire',
    purpose: 'Expire entity IDs.',
  },
  {
    surface: 'Expire relations',
    api: 'POST /api/v1/entitystore/{workspace}/relations:expire',
    purpose: 'Expire relation IDs.',
  },
  {
    surface: 'Query console',
    api: 'POST /api/v1/query/{workspace}/execute',
    purpose: 'Execute .mmodel, .entity, or .topo SPL.',
  },
  {
    surface: 'Query explain',
    api: 'POST /api/v1/query/{workspace}/explain',
    purpose: 'Read provider plan and limits.',
  },
  {
    surface: 'Agent discovery',
    api: 'GET /api/v1/agent/{workspace}/discover',
    purpose: 'Read tools, resources, next actions.',
  },
  {
    surface: 'Agent resources',
    api: 'POST /api/v1/agent/{workspace}/resources:read',
    purpose: 'Read safe metadata resources.',
  },
  { surface: 'Agent tools', api: 'POST /api/v1/agent/{workspace}/tools:execute', purpose: 'Execute enabled tools.' },
];

export default function DocsPage() {
  const columns = useMemo<Array<Column<ApiBinding>>>(
    () => [
      { id: 'surface', header: 'UI surface' },
      { id: 'api', header: 'API', cell: ({ row: { original } }) => <code>{original.api}</code> },
      { id: 'purpose', header: 'Purpose' },
    ],
    []
  );

  return (
    <PluginPage>
      <Stack direction="column" gap={2}>
        <Stack direction="row" gap={1} alignItems="center">
          <Text element="h4">Frontend API map</Text>
          <Badge text={`${rows.length} bindings`} color="purple" />
        </Stack>
        <Text color="secondary">
          The UI is implemented entirely on public MModel REST contracts. No internal packages or cloud console APIs are
          required.
        </Text>
        <InteractiveTable columns={columns} data={rows} getRowId={(r) => `${r.surface}-${r.api}`} />
      </Stack>
    </PluginPage>
  );
}
