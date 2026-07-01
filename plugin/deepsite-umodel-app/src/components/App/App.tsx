import React, { Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppRootProps } from '@grafana/data';
import { LoadingPlaceholder } from '@grafana/ui';
import { DEFAULT_ROUTE, ROUTES } from '../../constants';
import { WorkspaceProvider } from '../../context/WorkspaceContext';

const ExplorerPage = React.lazy(() => import('../../pages/ExplorerPage'));
const TopoPage = React.lazy(() => import('../../pages/TopoPage'));
const QueryPage = React.lazy(() => import('../../pages/QueryPage'));
const DataPage = React.lazy(() => import('../../pages/DataPage'));
const ImportsPage = React.lazy(() => import('../../pages/ImportsPage'));
const AgentPage = React.lazy(() => import('../../pages/AgentPage'));
const SettingsPage = React.lazy(() => import('../../pages/SettingsPage'));
const DocsPage = React.lazy(() => import('../../pages/DocsPage'));

function App(_props: AppRootProps) {
  return (
    <WorkspaceProvider>
      <Suspense fallback={<LoadingPlaceholder text="" />}>
        <Routes>
          <Route path={ROUTES.Explorer} element={<ExplorerPage />} />
          <Route path={ROUTES.Topo} element={<TopoPage />} />
          <Route path={ROUTES.Query} element={<QueryPage />} />
          <Route path={ROUTES.Data} element={<DataPage />} />
          <Route path={ROUTES.Imports} element={<ImportsPage />} />
          <Route path={ROUTES.Agent} element={<AgentPage />} />
          <Route path={ROUTES.Settings} element={<SettingsPage />} />
          <Route path={ROUTES.Docs} element={<DocsPage />} />
          {/* Default page */}
          <Route path="*" element={<Navigate to={DEFAULT_ROUTE} replace />} />
        </Routes>
      </Suspense>
    </WorkspaceProvider>
  );
}

export default App;
