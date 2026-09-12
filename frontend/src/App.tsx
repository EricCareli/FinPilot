import {
  useState,
} from 'react';

import type {
  FormEvent,
} from 'react';

import {
  login,
} from './lib/api';

import './App.css';

function App() {
  const [
    email,
    setEmail,
  ] = useState('');

  const [
    password,
    setPassword,
  ] = useState('');

  const [
    error,
    setError,
  ] = useState('');

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    authenticated,
    setAuthenticated,
  ] = useState(
    () =>
      Boolean(
        localStorage.getItem(
          'finpilot_token',
        ),
      ),
  );

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError('');
    setLoading(true);

    try {
      const response =
        await login(
          email.trim(),
          password,
        );

      localStorage.setItem(
        'finpilot_token',
        response.token,
      );

      setAuthenticated(true);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Não foi possível entrar.',
      );
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem(
      'finpilot_token',
    );

    setAuthenticated(false);
    setPassword('');
  }

  if (authenticated) {
    return (
      <main className="authenticated-page">
        <section className="welcome-card">
          <span className="brand">
            FinPilot
          </span>

          <h1>
            Login realizado com sucesso
          </h1>

          <p>
            O frontend já está conectado
            à API do FinPilot.
          </p>

          <button
            type="button"
            className="primary-button"
            onClick={handleLogout}
          >
            Sair
          </button>
        </section>
      </main>
    );
  }

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
            acompanhe seus gastos e
            tome decisões financeiras
            com mais clareza.
          </p>
        </div>

        <p className="footer-copy">
          FinPilot © 2026
        </p>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <div>
            <p className="mobile-brand">
              FinPilot
            </p>

            <h2>
              Bem-vindo de volta
            </h2>

            <p className="login-subtitle">
              Entre na sua conta para
              acessar seu painel.
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
                onChange={(event) =>
                  setEmail(
                    event.target.value,
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
                onChange={(event) =>
                  setPassword(
                    event.target.value,
                  )
                }
                placeholder="Sua senha"
                autoComplete="current-password"
                required
              />
            </label>

            {error && (
              <div
                className="error-message"
                role="alert"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              className="primary-button"
              disabled={loading}
            >
              {loading
                ? 'Entrando...'
                : 'Entrar'}
            </button>
          </form>

          <p className="security-text">
            Seus dados são protegidos
            pelo FinPilot.
          </p>
        </div>
      </section>
    </main>
  );
}

export default App;