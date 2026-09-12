import {
  BarChart3,
  Bell,
  ChevronDown,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  PiggyBank,
  ReceiptText,
  Settings,
  Target,
  WalletCards,
  X,
} from 'lucide-react';

import {
  useState,
} from 'react';

import {
  Outlet,
  useLocation,
  useNavigate,
} from 'react-router-dom';

import type {
  User,
  Workspace,
} from '../types/api';

interface AppLayoutProps {
  token: string;
  user: User;
  workspace: Workspace;
  workspaces: Workspace[];

  onWorkspaceChange:
    (workspaceId: string) => void;

  onUserUpdate:
    (user: User) => void;

  onLogout: () => void;
}

function AppLayout({
  token,
  user,
  workspace,
  workspaces,
  onWorkspaceChange,
  onUserUpdate,
  onLogout,
}: AppLayoutProps) {
  const navigate =
    useNavigate();

  const location =
    useLocation();

  const [
    sidebarOpen,
    setSidebarOpen,
  ] = useState(false);

  const firstName =
    user.name
      .trim()
      .split(' ')[0] ||
    user.name;

  function navigateTo(
    path: string,
  ) {
    navigate(path);
    setSidebarOpen(false);
  }

  function isActive(
    path: string,
  ) {
    return (
      location.pathname === path ||
      location.pathname.startsWith(
        `${path}/`,
      )
    );
  }

  const section =
    location.pathname
      .split('/')[1] ||
    'dashboard';

  const sectionTitles:
    Record<
      string,
      {
        kicker: string;
        title: string;
      }
    > = {
      dashboard: {
        kicker: 'VISÃO GERAL',
        title: `Olá, ${firstName}`,
      },

      transactions: {
        kicker: 'MOVIMENTAÇÕES',
        title: 'Transações',
      },

      accounts: {
        kicker: 'PATRIMÔNIO',
        title: 'Contas',
      },

      cards: {
        kicker: 'CRÉDITO',
        title: 'Cartões',
      },

      budgets: {
        kicker: 'PLANEJAMENTO',
        title: 'Orçamentos',
      },

      goals: {
        kicker: 'OBJETIVOS',
        title: 'Metas',
      },

      reports: {
        kicker: 'ANÁLISES',
        title: 'Relatórios',
      },

      settings: {
        kicker: 'FINPILOT',
        title: 'Configurações',
      },
    };

  const currentSection =
    sectionTitles[section] ??
    sectionTitles.dashboard;

  return (
    <div className="app-shell">
      <aside
        className={
          sidebarOpen
            ? 'sidebar sidebar-open'
            : 'sidebar'
        }
      >
        <div className="sidebar-header">
          <div className="app-logo">
            <span className="app-logo-mark">
              F
            </span>

            <div>
              <strong>
                FinPilot
              </strong>

              <span>
                Finance OS
              </span>
            </div>
          </div>

          <button
            type="button"
            className="sidebar-close"
            onClick={() =>
              setSidebarOpen(false)
            }
            aria-label="Fechar menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">
          <p className="sidebar-label">
            PRINCIPAL
          </p>

          <button
            type="button"
            className={
              isActive('/dashboard')
                ? 'nav-item active'
                : 'nav-item'
            }
            onClick={() =>
              navigateTo(
                '/dashboard',
              )
            }
          >
            <LayoutDashboard
              size={19}
            />
            Visão geral
          </button>

          <button
            type="button"
            className={
              isActive(
                '/transactions',
              )
                ? 'nav-item active'
                : 'nav-item'
            }
            onClick={() =>
              navigateTo(
                '/transactions',
              )
            }
          >
            <ReceiptText
              size={19}
            />
            Transações
          </button>

          <button
            type="button"
            className={
              isActive('/accounts')
                ? 'nav-item active'
                : 'nav-item'
            }
            onClick={() =>
              navigateTo(
                '/accounts',
              )
            }
          >
            <WalletCards
              size={19}
            />
            Contas
          </button>

          <button
            type="button"
            className={
              isActive('/cards')
                ? 'nav-item active'
                : 'nav-item'
            }
            onClick={() =>
              navigateTo(
                '/cards',
              )
            }
          >
            <CreditCard
              size={19}
            />
            Cartões
          </button>

          <p className="sidebar-label sidebar-label-spaced">
            PLANEJAMENTO
          </p>

          <button
            type="button"
            className={
              isActive('/budgets')
                ? 'nav-item active'
                : 'nav-item'
            }
            onClick={() =>
              navigateTo(
                '/budgets',
              )
            }
          >
            <PiggyBank
              size={19}
            />
            Orçamentos
          </button>

          <button
            type="button"
            className={
              isActive('/goals')
                ? 'nav-item active'
                : 'nav-item'
            }
            onClick={() =>
              navigateTo(
                '/goals',
              )
            }
          >
            <Target size={19} />
            Metas
          </button>

          <button
            type="button"
            className={
              isActive('/reports')
                ? 'nav-item active'
                : 'nav-item'
            }
            onClick={() =>
              navigateTo(
                '/reports',
              )
            }
          >
            <BarChart3
              size={19}
            />
            Relatórios
          </button>
        </nav>

        <div className="sidebar-bottom">
          <button
            type="button"
            className={
              isActive('/settings')
                ? 'nav-item active'
                : 'nav-item'
            }
            onClick={() =>
              navigateTo(
                '/settings',
              )
            }
          >
            <Settings size={19} />
            Configurações
          </button>

          <div className="sidebar-user">
            <div className="avatar">
              {firstName
                .charAt(0)
                .toUpperCase()}
            </div>

            <div className="sidebar-user-copy">
              <strong>
                {user.name}
              </strong>

              <span>
                {user.email}
              </span>
            </div>

            <button
              type="button"
              className="icon-button"
              onClick={
                onLogout
              }
              title="Sair"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <button
          type="button"
          className="sidebar-overlay"
          onClick={() =>
            setSidebarOpen(false)
          }
          aria-label="Fechar menu"
        />
      )}

      <div className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="mobile-menu-button"
              onClick={() =>
                setSidebarOpen(true)
              }
              aria-label="Abrir menu"
            >
              <Menu size={22} />
            </button>

            <div>
              <p className="topbar-kicker">
                {
                  currentSection.kicker
                }
              </p>

              <h1>
                {
                  currentSection.title
                }
              </h1>
            </div>
          </div>

          <div className="topbar-actions">
            <div className="workspace-select-wrapper">
              <span>
                Workspace
              </span>

              <div className="select-container">
                <select
                  value={
                    workspace.id
                  }
                  onChange={(
                    event,
                  ) =>
                    onWorkspaceChange(
                      event.target
                        .value,
                    )
                  }
                >
                  {workspaces.map(
                    (item) => (
                      <option
                        key={
                          item.id
                        }
                        value={
                          item.id
                        }
                      >
                        {
                          item.name
                        }
                      </option>
                    ),
                  )}
                </select>

                <ChevronDown
                  size={16}
                />
              </div>
            </div>

            <button
              type="button"
              className="notification-button"
              aria-label="Notificações"
            >
              <Bell size={20} />

              <span className="notification-dot" />
            </button>

            <div className="topbar-avatar">
              {firstName
                .charAt(0)
                .toUpperCase()}
            </div>
          </div>
        </header>

        <Outlet
          context={{
            token,
            user,
            workspace,
            workspaces,
            onWorkspaceChange,
            onUserUpdate,
            onLogout,
          }}
        />
      </div>
    </div>
  );
}

export default AppLayout;