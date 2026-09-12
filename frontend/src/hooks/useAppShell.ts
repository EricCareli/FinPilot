import {
  useOutletContext,
} from 'react-router-dom';

import type {
  User,
  Workspace,
} from '../types/api';

export interface AppShellContext {
  token: string;
  user: User;
  workspace: Workspace;
  workspaces: Workspace[];

  onWorkspaceChange:
    (workspaceId: string) => void;

  onUserUpdate:
    (user: User) => void;

  onTokenUpdate:
    (token: string) => void;

  onLogout: () => void;
}

export function useAppShell() {
  return useOutletContext<
    AppShellContext
  >();
}
