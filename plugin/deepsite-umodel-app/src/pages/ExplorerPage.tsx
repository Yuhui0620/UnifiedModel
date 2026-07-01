import React from 'react';
import { MModelPage } from '../components/MModelPage';
import { useWorkspace } from '../context/WorkspaceContext';
import { ExplorerPage as ExplorerFeature } from '../features/explorer/ExplorerPage';

export default function ExplorerPage() {
  return (
    <MModelPage>
      <ExplorerContent />
    </MModelPage>
  );
}

function ExplorerContent() {
  const { workspace, api } = useWorkspace();
  // Gated by MModelPage, so a workspace exists; guard keeps types honest.
  if (!workspace) {
    return null;
  }
  return <ExplorerFeature api={api} workspaceId={workspace} refreshToken={0} />;
}
