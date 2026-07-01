import pluginJson from './plugin.json';

export const PLUGIN_BASE_URL = `/a/${pluginJson.id}`;

// Route names; each maps to a plugin.json `includes` nav entry of the same path
// suffix (e.g. ROUTES.Explorer -> /a/<id>/explorer).
export enum ROUTES {
  Explorer = 'explorer',
  Topo = 'topo',
  Query = 'query',
  Data = 'data',
  Imports = 'imports',
  Agent = 'agent',
  Settings = 'settings',
  Docs = 'docs',
}

export const DEFAULT_ROUTE = ROUTES.Explorer;
