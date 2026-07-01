import React from 'react';
import { MModelPage } from '../components/MModelPage';
import { useWorkspace } from '../context/WorkspaceContext';
import { EntityTopoPage } from '../features/entityTopo/EntityTopoPage';

export default function TopoPage() {
  return (
    <MModelPage>
      <TopoContent />
    </MModelPage>
  );
}

function TopoContent() {
  const { workspace, api } = useWorkspace();
  // Gated by MModelPage, so a workspace exists; guard keeps types honest.
  if (!workspace) {
    return null;
  }
  return <EntityTopoPage api={api} workspaceId={workspace} refreshToken={0} />;
}
