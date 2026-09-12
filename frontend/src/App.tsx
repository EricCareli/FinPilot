import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import type {
  FormEvent,
} from 'react';

import {
  Navigate,
  Route,
  Routes,
  useNavigate,
} from 'react-router-dom';

import {
  ApiError,
  getCurrentUser,
  getWorkspaces,
  login,
} from './lib/api';

import type {
  User,
  Workspace,
} from './types/api';

import AppLayout from './components/AppLayout';
import AccountsPage from './pages/AccountsPage';
import CreditCardsPage from './pages/CreditCardsPage';
import DashboardPage from './pages/DashboardPage';
import PlaceholderPage from './pages/PlaceholderPage';
import TransactionsPage from './pages/TransactionsPage';

import './App.css';

const TOKEN_KEY =
  'finpilot_token';

const WORKSPACE_KEY =
  'finpilot_workspace_id';

function App() {
  const navigate =
    useNavigate();

  const [
    token,
    setToken,
  ] = useState<string | null>(
    () =>
      localStorage.getItem(
        TOKEN_KEY,
      ),
  );

  const [
    email,
    setEmail,
  ] = useState('');

  const [
    password,
    setPassword,
  ] = useState('');

  const [
    loginError,
    setLoginError,
  ] = useState('');

  const [
    loggingIn,
    setLoggingIn,
  ] = useState(false);

  const [
    user,
    setUser,
  ] = useState<User | null>(
    null,
  );

  const [
    workspaces,
    setWorkspaces,
  ] = useState<Workspace[]>(
    [],
  );

  const [
    workspace,
    setWorkspace,
  ] =
    useState<Workspace | null>(
      null,
    );

  const [
    loadingApp,
    setLoadingApp,
  ] = useState(
    Boolean(token),
  );

  const [
    appError,
    setAppError,
  ] = useState('');

  const logout =
    useCallback(() => {
      localStorage.removeItem(
        TOKEN_KEY,
      );

      localStorage.removeItem(
        WORKSPACE_KEY,
      );

      setToken(null);
      setUser(null);
      setWorkspace(null);
      setWorkspaces([]);
      setPassword('');
      setAppError('');
      setLoadingApp(false);
    }, []);

  const handleApiError =
    useCallback(
      (error: unknown) => {
        if (
          error instanceof
            ApiError &&
          error.statusCode ===
            401
        ) {
          logout();

          return;
        }

        setAppError(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar os dados.',
        );
      },
      [logout],
    );

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    async function bootstrap() {
      setLoadingApp(true);
      setAppError('');

      try {
        const [
          currentUser,
          availableWorkspaces,
        ] =
          await Promise.all([
            getCurrentUser(
              token!,
            ),

            getWorkspaces(
              token!,
            ),
          ]);

        if (cancelled) {
          return;
        }

        setUser(
          currentUser,
        );

        setWorkspaces(
          availableWorkspaces,
        );

        if (
          availableWorkspaces.length ===
          0
        ) {
          setAppError(
            'Nenhum workspace disponível.',
          );

          return;
        }

        const savedWorkspaceId =
          localStorage.getItem(
            WORKSPACE_KEY,
          );

        const selectedWorkspace =
          availableWorkspaces.find(
            (item) =>
              item.id ===
              savedWorkspaceId,
          ) ??
          availableWorkspaces[0];

        setWorkspace(
          selectedWorkspace,
        );

        localStorage.setItem(
          WORKSPACE_KEY,
          selectedWorkspace.id,
        );
      } catch (error) {
        if (!cancelled) {
          handleApiError(
            error,
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingApp(
            false,
          );
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [
    token,
    handleApiError,
  ]);

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setLoginError('');
    setLoggingIn(true);

    try {
      const response =
        await login(
          email.trim(),
          password,
        );

      localStorage.setItem(
        TOKEN_KEY,
        response.token,
      );

      setToken(
        response.token,
      );

      navigate(
        '/dashboard',
        {
          replace: true,
        },
      );
    } catch (error) {
      setLoginError(
        error instanceof Error
          ? error.message
          : 'Não foi possível entrar.',
      );
    } finally {
      setLoggingIn(false);
    }
  }

  function handleWorkspaceChange(
    workspaceId: string,
  ) {
    const nextWorkspace =
      workspaces.find(
        (item) =>
          item.id ===
          workspaceId,
      );

    if (!nextWorkspace) {
      return;
    }

    setWorkspace(
      nextWorkspace,
    );

    localStorage.setItem(
      WORKSPACE_KEY,
      nextWorkspace.id,
    );
  }

  if (!token) {
    return (
      <main className="login-page">
        <section className="login-presentation">
          <div className="brand-wrapper">
            <span className="brand-mark">
              F
            </span>

            <span className="brand">
              FinPilot
            </span>
          </div>

          <div className="presentation-content">
            <p className="eyebrow">
              CONTROLE FINANCEIRO
            </p>

            <h1>
              Sua vida financeira,
              <br />
              sob controle.
            </h1>

            <p className="description">
              Organize suas contas,
              acompanhe seus gastos
              e tome decisões com
              mais clareza.
            </p>

            <div className="login-feature-grid">
              <div>
                <strong>
                  360°
                </strong>

                <span>
                  visão das finanças
                </span>
              </div>

              <div>
                <strong>
                  Real-time
                </strong>

                <span>
                  dados atualizados
                </span>
              </div>

              <div>
                <strong>
                  Smart
                </strong>

                <span>
                  planejamento
                </span>
              </div>
            </div>
          </div>

          <p className="footer-copy">
            FinPilot © 2026
          </p>
        </section>

        <section className="login-panel">
          <div className="login-card">
            <p className="mobile-brand">
              FinPilot
            </p>

            <div className="login-heading">
              <span className="login-badge">
                ACESSO SEGURO
              </span>

              <h2>
                Bem-vindo de volta
              </h2>

              <p>
                Entre na sua conta
                para acessar seu
                painel financeiro.
              </p>
            </div>

            <form
              className="login-form"
              onSubmit={
                handleSubmit
              }
            >
              <label>
                E-mail

                <input
                  type="email"
                  value={email}
                  onChange={(
                    event,
                  ) =>
                    setEmail(
                      event.target
                        .value,
                    )
                  }
                  placeholder="seu@email.com"
                  autoComplete="email"
                  required
                />
              </label>

              <label>
                Senha

                <input
                  type="password"
                  value={password}
                  onChange={(
                    event,
                  ) =>
                    setPassword(
                      event.target
                        .value,
                    )
                  }
                  placeholder="Sua senha"
                  autoComplete="current-password"
                  required
                />
              </label>

              {loginError && (
                <div
                  className="error-message"
                  role="alert"
                >
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                className="primary-button"
                disabled={
                  loggingIn
                }
              >
                {loggingIn
                  ? 'Entrando...'
                  : 'Entrar no FinPilot'}
              </button>
            </form>

            <p className="security-text">
              Ambiente protegido por
              autenticação segura.
            </p>
          </div>
        </section>
      </main>
    );
  }

  if (loadingApp) {
    return (
      <main className="app-loading-screen">
        <div className="loading-logo">
          F
        </div>

        <strong>
          FinPilot
        </strong>

        <span>
          Preparando seu painel...
        </span>
      </main>
    );
  }

  if (
    appError &&
    (!user || !workspace)
  ) {
    return (
      <main className="app-error-screen">
        <div className="error-card">
          <span className="brand">
            FinPilot
          </span>

          <h1>
            Não foi possível carregar
            sua conta
          </h1>

          <p>
            {appError}
          </p>

          <button
            type="button"
            className="primary-button"
            onClick={() =>
              window.location.reload()
            }
          >
            Tentar novamente
          </button>

          <button
            type="button"
            className="secondary-button"
            onClick={
              logout
            }
          >
            Sair da conta
          </button>
        </div>
      </main>
    );
  }

  if (
    !user ||
    !workspace
  ) {
    return (
      <main className="app-loading-screen">
        <div className="loading-logo">
          F
        </div>

        <strong>
          FinPilot
        </strong>

        <span>
          Carregando dados...
        </span>
      </main>
    );
  }

  return (
    <Routes>
      <Route
        element={
          <AppLayout
            token={token}
            user={user}
            workspace={
              workspace
            }
            workspaces={
              workspaces
            }
            onWorkspaceChange={
              handleWorkspaceChange
            }
            onLogout={
              logout
            }
          />
        }
      >
        <Route
          path="/dashboard"
          element={
            <DashboardPage />
          }
        />

        <Route
          path="/transactions"
          element={
            <TransactionsPage />
          }
        />

        <Route
          path="/accounts"
          element={
            <AccountsPage />
          }
        />

        <Route
          path="/cards"
          element={
            <CreditCardsPage />
          }
        />

        <Route
          path="/budgets"
          element={
            <PlaceholderPage
              title="Orçamentos"
              description="Planeje seus gastos e acompanhe seus limites mensais."
            />
          }
        />

        <Route
          path="/goals"
          element={
            <PlaceholderPage
              title="Metas"
              description="Transforme seus objetivos financeiros em planos acompanháveis."
            />
          }
        />

        <Route
          path="/reports"
          element={
            <PlaceholderPage
              title="Relatórios"
              description="Analise sua evolução financeira com mais profundidade."
            />
          }
        />

        <Route
          path="/settings"
          element={
            <PlaceholderPage
              title="Configurações"
              description="Personalize sua experiência no FinPilot."
            />
          }
        />
      </Route>

      <Route
        path="/"
        element={
          <Navigate
            to="/dashboard"
            replace
          />
        }
      />

      <Route
        path="*"
        element={
          <Navigate
            to="/dashboard"
            replace
          />
        }
      />
    </Routes>
  );
}

export default App;