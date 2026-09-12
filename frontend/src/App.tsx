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
  register,
  requestPasswordReset,
  resendVerificationEmail,
  resetPassword,
  verifyEmail,
  verifyPasswordResetCode,
} from './lib/api';

import type {
  User,
  Workspace,
} from './types/api';

import AppLayout from './components/AppLayout';
import AccountsPage from './pages/AccountsPage';
import BudgetsPage from './pages/BudgetsPage';
import CreditCardsPage from './pages/CreditCardsPage';
import DashboardPage from './pages/DashboardPage';
import GoalsPage from './pages/GoalsPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import TransactionsPage from './pages/TransactionsPage';

import './App.css';
import './AuthEnhancements.css';

const TOKEN_KEY =
  'finpilot_token';

const WORKSPACE_KEY =
  'finpilot_workspace_id';

type PasswordResetStep =
  | 'request'
  | 'code'
  | 'password';

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
    isRegistering,
    setIsRegistering,
  ] = useState(false);

  const [
    isVerifyingEmail,
    setIsVerifyingEmail,
  ] = useState(false);

  const [
    verificationCode,
    setVerificationCode,
  ] = useState('');

  const [
    resendingCode,
    setResendingCode,
  ] = useState(false);

  const [
    resendCooldown,
    setResendCooldown,
  ] = useState(0);

  const [
    verificationMessage,
    setVerificationMessage,
  ] = useState('');

  const [
    isResettingPassword,
    setIsResettingPassword,
  ] = useState(false);

  const [
    passwordResetStep,
    setPasswordResetStep,
  ] =
    useState<PasswordResetStep>(
      'request',
    );

  const [
    passwordResetCode,
    setPasswordResetCode,
  ] = useState('');

  const [
    passwordResetToken,
    setPasswordResetToken,
  ] = useState('');

  const [
    newPassword,
    setNewPassword,
  ] = useState('');

  const [
    confirmNewPassword,
    setConfirmNewPassword,
  ] = useState('');

  const [
    resettingPassword,
    setResettingPassword,
  ] = useState(false);

  const [
    passwordResetCooldown,
    setPasswordResetCooldown,
  ] = useState(0);

  const [
    passwordResetMessage,
    setPasswordResetMessage,
  ] = useState('');

  const [
    name,
    setName,
  ] = useState('');

  const [
    email,
    setEmail,
  ] = useState('');

  const [
    confirmPassword,
    setConfirmPassword,
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
      setConfirmPassword('');
      setName('');
      setIsRegistering(false);
      setIsVerifyingEmail(false);
      setVerificationCode('');
      setResendingCode(false);
      setResendCooldown(0);
      setVerificationMessage('');
      setIsResettingPassword(false);
      setPasswordResetStep(
        'request',
      );
      setPasswordResetCode('');
      setPasswordResetToken('');
      setNewPassword('');
      setConfirmNewPassword('');
      setResettingPassword(false);
      setPasswordResetCooldown(0);
      setPasswordResetMessage('');
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
    if (resendCooldown <= 0) {
      return;
    }

    const timeout =
      window.setTimeout(
        () => {
          setResendCooldown(
            (current) =>
              Math.max(
                current - 1,
                0,
              ),
          );
        },
        1000,
      );

    return () => {
      window.clearTimeout(
        timeout,
      );
    };
  }, [resendCooldown]);

  useEffect(() => {
    if (
      passwordResetCooldown <=
      0
    ) {
      return;
    }

    const timeout =
      window.setTimeout(
        () => {
          setPasswordResetCooldown(
            (current) =>
              Math.max(
                current - 1,
                0,
              ),
          );
        },
        1000,
      );

    return () => {
      window.clearTimeout(
        timeout,
      );
    };
  }, [passwordResetCooldown]);

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
    setPasswordResetMessage('');

    const normalizedEmail =
      email.trim().toLowerCase();

    if (isRegistering) {
      const normalizedName =
        name.trim();

      if (normalizedName.length < 2) {
        setLoginError(
          'Informe um nome com pelo menos 2 caracteres.',
        );
        return;
      }

      if (password.length < 8) {
        setLoginError(
          'A senha deve ter pelo menos 8 caracteres.',
        );
        return;
      }

      if (password !== confirmPassword) {
        setLoginError(
          'As senhas não coincidem.',
        );
        return;
      }
    }

    setLoggingIn(true);

    try {
      if (isRegistering) {
        await register(
          name.trim(),
          normalizedEmail,
          password,
        );

        setVerificationCode('');
        setVerificationMessage('');
        setResendCooldown(60);
        setIsVerifyingEmail(true);

        return;
      }

      const response =
        await login(
          normalizedEmail,
          password,
        );

      localStorage.setItem(
        TOKEN_KEY,
        response.token,
      );

      setToken(
        response.token,
      );

      setConfirmPassword('');

      navigate(
        '/dashboard',
        {
          replace: true,
        },
      );
    } catch (error) {
      if (
        isRegistering &&
        error instanceof ApiError &&
        error.statusCode === 409
      ) {
        setLoginError(
          'Este e-mail já está cadastrado. Entre com sua conta.',
        );
      } else if (
        !isRegistering &&
        error instanceof ApiError &&
        error.statusCode === 403 &&
        error.message ===
          'Email not verified'
      ) {
        setVerificationCode('');
        setVerificationMessage(
          'Seu e-mail ainda não foi confirmado. Digite o código enviado ou solicite um novo.',
        );
        setResendCooldown(0);
        setIsVerifyingEmail(true);
      } else {
        setLoginError(
          error instanceof Error
            ? error.message
            : isRegistering
              ? 'Não foi possível criar sua conta.'
              : 'Não foi possível entrar.',
        );
      }
    } finally {
      setLoggingIn(false);
    }
  }

  async function handleVerificationSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setLoginError('');
    setVerificationMessage('');

    const normalizedEmail =
      email.trim().toLowerCase();

    const normalizedCode =
      verificationCode.trim();

    if (
      !/^\d{6}$/.test(
        normalizedCode,
      )
    ) {
      setLoginError(
        'Digite o código de 6 dígitos enviado para o seu e-mail.',
      );

      return;
    }

    setLoggingIn(true);

    try {
      await verifyEmail(
        normalizedEmail,
        normalizedCode,
      );

      const response =
        await login(
          normalizedEmail,
          password,
        );

      localStorage.setItem(
        TOKEN_KEY,
        response.token,
      );

      setToken(
        response.token,
      );

      setVerificationCode('');
      setConfirmPassword('');
      setIsVerifyingEmail(false);

      navigate(
        '/dashboard',
        {
          replace: true,
        },
      );
    } catch (error) {
      if (
        error instanceof ApiError
      ) {
        if (
          error.message ===
          'Verification code expired'
        ) {
          setLoginError(
            'Este código expirou. Solicite um novo código.',
          );
        } else if (
          error.message ===
          'Too many verification attempts'
        ) {
          setLoginError(
            'Muitas tentativas incorretas. Solicite um novo código.',
          );
        } else if (
          error.message ===
            'Invalid verification code' ||
          error.message ===
            'Verification code not found'
        ) {
          setLoginError(
            'Código inválido. Confira os 6 dígitos e tente novamente.',
          );
        } else {
          setLoginError(
            error.message,
          );
        }
      } else {
        setLoginError(
          'Não foi possível confirmar seu e-mail.',
        );
      }
    } finally {
      setLoggingIn(false);
    }
  }

  async function handleResendVerification() {
    if (
      resendingCode ||
      resendCooldown > 0
    ) {
      return;
    }

    setLoginError('');
    setVerificationMessage('');
    setResendingCode(true);

    const normalizedEmail =
      email.trim().toLowerCase();

    try {
      await resendVerificationEmail(
        normalizedEmail,
      );

      setVerificationCode('');
      setResendCooldown(60);
      setVerificationMessage(
        'Novo código enviado. Confira seu e-mail.',
      );
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.statusCode === 429
      ) {
        const secondsMatch =
          error.message.match(
            /(\d+)\s+seconds?/i,
          );

        const remainingSeconds =
          secondsMatch
            ? Number(
                secondsMatch[1],
              )
            : 60;

        setResendCooldown(
          remainingSeconds,
        );

        setLoginError(
          `Aguarde ${remainingSeconds} ${
            remainingSeconds === 1
              ? 'segundo'
              : 'segundos'
          } para reenviar o código.`,
        );
      } else {
        setLoginError(
          error instanceof Error
            ? error.message
            : 'Não foi possível reenviar o código.',
        );
      }
    } finally {
      setResendingCode(false);
    }
  }

  function openPasswordReset() {
    setIsRegistering(false);
    setIsVerifyingEmail(false);
    setIsResettingPassword(true);
    setPasswordResetStep(
      'request',
    );
    setPasswordResetCode('');
    setPasswordResetToken('');
    setNewPassword('');
    setConfirmNewPassword('');
    setPasswordResetCooldown(0);
    setPasswordResetMessage('');
    setLoginError('');
    setPassword('');
    setConfirmPassword('');
  }

  function closePasswordReset() {
    setIsResettingPassword(false);
    setPasswordResetStep(
      'request',
    );
    setPasswordResetCode('');
    setPasswordResetToken('');
    setNewPassword('');
    setConfirmNewPassword('');
    setPasswordResetCooldown(0);
    setLoginError('');
  }

  async function handlePasswordResetRequest(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setLoginError('');
    setPasswordResetMessage('');

    const normalizedEmail =
      email.trim().toLowerCase();

    if (
      !normalizedEmail.includes(
        '@',
      )
    ) {
      setLoginError(
        'Informe um e-mail válido.',
      );

      return;
    }

    setResettingPassword(true);

    try {
      await requestPasswordReset(
        normalizedEmail,
      );

      setEmail(
        normalizedEmail,
      );

      setPasswordResetCode('');
      setPasswordResetCooldown(60);
      setPasswordResetMessage(
        'Se existir uma conta com esse e-mail, enviamos um código de 6 dígitos.',
      );
      setPasswordResetStep(
        'code',
      );
    } catch (error) {
      setLoginError(
        error instanceof Error
          ? error.message
          : 'Não foi possível solicitar a recuperação da senha.',
      );
    } finally {
      setResettingPassword(false);
    }
  }

  async function handlePasswordResetCodeSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setLoginError('');
    setPasswordResetMessage('');

    const normalizedEmail =
      email.trim().toLowerCase();

    const normalizedCode =
      passwordResetCode.trim();

    if (
      !/^\d{6}$/.test(
        normalizedCode,
      )
    ) {
      setLoginError(
        'Digite o código de 6 dígitos enviado para o seu e-mail.',
      );

      return;
    }

    setResettingPassword(true);

    try {
      const result =
        await verifyPasswordResetCode(
          normalizedEmail,
          normalizedCode,
        );

      setPasswordResetToken(
        result.resetToken,
      );
      setPasswordResetCode('');
      setNewPassword('');
      setConfirmNewPassword('');
      setPasswordResetMessage('');
      setPasswordResetStep(
        'password',
      );
    } catch (error) {
      if (
        error instanceof ApiError
      ) {
        if (
          error.message ===
          'Password reset code expired'
        ) {
          setLoginError(
            'Este código expirou. Solicite um novo código.',
          );
        } else if (
          error.message ===
          'Too many password reset attempts'
        ) {
          setLoginError(
            'Muitas tentativas incorretas. Solicite um novo código.',
          );
        } else if (
          error.message ===
          'Invalid password reset code'
        ) {
          setLoginError(
            'Código inválido. Confira os 6 dígitos e tente novamente.',
          );
        } else {
          setLoginError(
            error.message,
          );
        }
      } else {
        setLoginError(
          'Não foi possível validar o código.',
        );
      }
    } finally {
      setResettingPassword(false);
    }
  }

  async function handlePasswordResetResend() {
    if (
      resettingPassword ||
      passwordResetCooldown >
        0
    ) {
      return;
    }

    setLoginError('');
    setPasswordResetMessage('');
    setResettingPassword(true);

    const normalizedEmail =
      email.trim().toLowerCase();

    try {
      await requestPasswordReset(
        normalizedEmail,
      );

      setPasswordResetCode('');
      setPasswordResetCooldown(60);
      setPasswordResetMessage(
        'Se existir uma conta com esse e-mail, enviamos um novo código.',
      );
    } catch (error) {
      setLoginError(
        error instanceof Error
          ? error.message
          : 'Não foi possível reenviar o código.',
      );
    } finally {
      setResettingPassword(false);
    }
  }

  async function handleNewPasswordSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setLoginError('');
    setPasswordResetMessage('');

    if (
      newPassword.length < 8
    ) {
      setLoginError(
        'A nova senha deve ter pelo menos 8 caracteres.',
      );

      return;
    }

    if (
      newPassword !==
      confirmNewPassword
    ) {
      setLoginError(
        'As senhas não coincidem.',
      );

      return;
    }

    if (!passwordResetToken) {
      setLoginError(
        'A sessão de recuperação expirou. Solicite um novo código.',
      );

      return;
    }

    setResettingPassword(true);

    try {
      await resetPassword(
        email
          .trim()
          .toLowerCase(),
        passwordResetToken,
        newPassword,
      );

      setIsResettingPassword(false);
      setPasswordResetStep(
        'request',
      );
      setPasswordResetCode('');
      setPasswordResetToken('');
      setNewPassword('');
      setConfirmNewPassword('');
      setPasswordResetCooldown(0);
      setPassword('');
      setConfirmPassword('');
      setPasswordResetMessage(
        'Senha redefinida com sucesso. Entre com sua nova senha.',
      );
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.message ===
          'Password reset token expired'
      ) {
        setLoginError(
          'A sessão de recuperação expirou. Solicite um novo código.',
        );
      } else {
        setLoginError(
          error instanceof Error
            ? error.message
            : 'Não foi possível redefinir sua senha.',
        );
      }
    } finally {
      setResettingPassword(false);
    }
  }

  function switchAuthMode() {
    setIsRegistering(
      (current) => !current,
    );
    setIsVerifyingEmail(false);
    setVerificationCode('');
    setResendingCode(false);
    setResendCooldown(0);
    setVerificationMessage('');
    setIsResettingPassword(false);
    setPasswordResetStep(
      'request',
    );
    setPasswordResetCode('');
    setPasswordResetToken('');
    setNewPassword('');
    setConfirmNewPassword('');
    setPasswordResetCooldown(0);
    setPasswordResetMessage('');
    setLoginError('');
    setPassword('');
    setConfirmPassword('');
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
            {isResettingPassword ? (
              <>
                <p className="mobile-brand">
                  FinPilot
                </p>

                {passwordResetStep ===
                  'request' && (
                  <>
                    <div className="login-heading">
                      <span className="login-badge">
                        RECUPERAÇÃO
                      </span>

                      <h2>
                        Esqueceu sua senha?
                      </h2>

                      <p>
                        Informe o e-mail da sua conta para receber um código de recuperação.
                      </p>
                    </div>

                    <form
                      className="login-form"
                      onSubmit={
                        handlePasswordResetRequest
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
                          autoFocus
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
                          resettingPassword
                        }
                      >
                        {resettingPassword
                          ? 'Enviando...'
                          : 'Enviar código'}
                      </button>
                    </form>

                    <div className="auth-switch">
                      <span>
                        Lembrou sua senha?
                      </span>

                      <button
                        type="button"
                        onClick={
                          closePasswordReset
                        }
                        disabled={
                          resettingPassword
                        }
                      >
                        Voltar para o login
                      </button>
                    </div>

                    <p className="security-text">
                      Por segurança, não informamos se um e-mail possui uma conta cadastrada.
                    </p>
                  </>
                )}

                {passwordResetStep ===
                  'code' && (
                  <>
                    <div className="login-heading">
                      <span className="login-badge">
                        RECUPERAÇÃO
                      </span>

                      <h2>
                        Digite o código
                      </h2>

                      <p>
                        Informe o código de 6 dígitos enviado para <strong>{email.trim().toLowerCase()}</strong>.
                      </p>
                    </div>

                    <form
                      className="login-form"
                      onSubmit={
                        handlePasswordResetCodeSubmit
                      }
                    >
                      <label>
                        Código de recuperação

                        <input
                          type="text"
                          value={
                            passwordResetCode
                          }
                          onChange={(
                            event,
                          ) =>
                            setPasswordResetCode(
                              event.target.value
                                .replace(
                                  /\D/g,
                                  '',
                                )
                                .slice(
                                  0,
                                  6,
                                ),
                            )
                          }
                          placeholder="000000"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={6}
                          pattern="[0-9]{6}"
                          required
                          autoFocus
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
                          resettingPassword ||
                          passwordResetCode.length !==
                            6
                        }
                      >
                        {resettingPassword
                          ? 'Validando...'
                          : 'Validar código'}
                      </button>
                    </form>

                    {passwordResetMessage && (
                      <p
                        className="security-text"
                        role="status"
                      >
                        {passwordResetMessage}
                      </p>
                    )}

                    <div className="auth-switch">
                      <span>
                        Não recebeu o código?
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          void handlePasswordResetResend()
                        }
                        disabled={
                          resettingPassword ||
                          passwordResetCooldown >
                            0
                        }
                      >
                        {resettingPassword
                          ? 'Enviando...'
                          : passwordResetCooldown >
                              0
                            ? `Reenviar em ${passwordResetCooldown}s`
                            : 'Reenviar código'}
                      </button>
                    </div>

                    <div className="auth-switch">
                      <span>
                        E-mail incorreto?
                      </span>

                      <button
                        type="button"
                        onClick={() => {
                          setPasswordResetStep(
                            'request',
                          );
                          setPasswordResetCode(
                            '',
                          );
                          setPasswordResetCooldown(
                            0,
                          );
                          setPasswordResetMessage(
                            '',
                          );
                          setLoginError(
                            '',
                          );
                        }}
                        disabled={
                          resettingPassword
                        }
                      >
                        Alterar e-mail
                      </button>
                    </div>

                    <p className="security-text">
                      O código expira em 10 minutos.
                    </p>
                  </>
                )}

                {passwordResetStep ===
                  'password' && (
                  <>
                    <div className="login-heading">
                      <span className="login-badge">
                        NOVA SENHA
                      </span>

                      <h2>
                        Crie uma nova senha
                      </h2>

                      <p>
                        Escolha uma nova senha para sua conta FinPilot.
                      </p>
                    </div>

                    <form
                      className="login-form"
                      onSubmit={
                        handleNewPasswordSubmit
                      }
                    >
                      <label>
                        Nova senha

                        <input
                          type="password"
                          value={
                            newPassword
                          }
                          onChange={(
                            event,
                          ) =>
                            setNewPassword(
                              event.target
                                .value,
                            )
                          }
                          placeholder="Mínimo de 8 caracteres"
                          autoComplete="new-password"
                          minLength={8}
                          required
                          autoFocus
                        />
                      </label>

                      <label>
                        Confirmar nova senha

                        <input
                          type="password"
                          value={
                            confirmNewPassword
                          }
                          onChange={(
                            event,
                          ) =>
                            setConfirmNewPassword(
                              event.target
                                .value,
                            )
                          }
                          placeholder="Digite a senha novamente"
                          autoComplete="new-password"
                          minLength={8}
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
                          resettingPassword
                        }
                      >
                        {resettingPassword
                          ? 'Salvando...'
                          : 'Salvar nova senha'}
                      </button>
                    </form>

                    <p className="security-text">
                      A autorização para redefinir a senha expira em 10 minutos e só pode ser usada uma vez.
                    </p>
                  </>
                )}
              </>
            ) : isVerifyingEmail ? (
              <>
                <p className="mobile-brand">
                  FinPilot
                </p>

                <div className="login-heading">
                  <span className="login-badge">
                    VERIFICAÇÃO
                  </span>

                  <h2>
                    Confirme seu e-mail
                  </h2>

                  <p>
                    Enviamos um código de 6 dígitos para <strong>{email.trim().toLowerCase()}</strong>.
                  </p>
                </div>

                <form
                  className="login-form"
                  onSubmit={
                    handleVerificationSubmit
                  }
                >
                  <label>
                    Código de verificação

                    <input
                      type="text"
                      value={
                        verificationCode
                      }
                      onChange={(
                        event,
                      ) =>
                        setVerificationCode(
                          event.target.value
                            .replace(
                              /\D/g,
                              '',
                            )
                            .slice(
                              0,
                              6,
                            ),
                        )
                      }
                      placeholder="000000"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      pattern="[0-9]{6}"
                      required
                      autoFocus
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
                      loggingIn ||
                      verificationCode.length !==
                        6
                    }
                  >
                    {loggingIn
                      ? 'Confirmando...'
                      : 'Confirmar e continuar'}
                  </button>
                </form>

                {verificationMessage && (
                  <p
                    className="security-text"
                    role="status"
                  >
                    {verificationMessage}
                  </p>
                )}

                <div className="auth-switch">
                  <span>
                    Não recebeu o código?
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      void handleResendVerification()
                    }
                    disabled={
                      resendingCode ||
                      resendCooldown > 0
                    }
                  >
                    {resendingCode
                      ? 'Enviando...'
                      : resendCooldown > 0
                        ? `Reenviar em ${resendCooldown}s`
                        : 'Reenviar código'}
                  </button>
                </div>

                <p className="security-text">
                  O código expira em 10 minutos.
                </p>
              </>
            ) : (
              <>
            <p className="mobile-brand">
              FinPilot
            </p>

            <div className="login-heading">
              <span className="login-badge">
                {isRegistering
                  ? 'NOVA CONTA'
                  : 'ACESSO SEGURO'}
              </span>

              <h2>
                {isRegistering
                  ? 'Crie sua conta'
                  : 'Bem-vindo de volta'}
              </h2>

              <p>
                {isRegistering
                  ? 'Comece agora e organize sua vida financeira em um só lugar.'
                  : 'Entre na sua conta para acessar seu painel financeiro.'}
              </p>
            </div>

            <form
              className="login-form"
              onSubmit={
                handleSubmit
              }
            >
              {isRegistering && (
                <label>
                  Nome

                  <input
                    type="text"
                    value={name}
                    onChange={(
                      event,
                    ) =>
                      setName(
                        event.target
                          .value,
                      )
                    }
                    placeholder="Seu nome"
                    autoComplete="name"
                    minLength={2}
                    required
                  />
                </label>
              )}

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
                  placeholder={
                    isRegistering
                      ? 'Mínimo de 8 caracteres'
                      : 'Sua senha'
                  }
                  autoComplete={
                    isRegistering
                      ? 'new-password'
                      : 'current-password'
                  }
                  minLength={
                    isRegistering
                      ? 8
                      : undefined
                  }
                  required
                />
              </label>

              {isRegistering && (
                <label>
                  Confirmar senha

                  <input
                    type="password"
                    value={
                      confirmPassword
                    }
                    onChange={(
                      event,
                    ) =>
                      setConfirmPassword(
                        event.target
                          .value,
                      )
                    }
                    placeholder="Digite a senha novamente"
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </label>
              )}

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
                  ? isRegistering
                    ? 'Criando conta...'
                    : 'Entrando...'
                  : isRegistering
                    ? 'Criar minha conta'
                    : 'Entrar no FinPilot'}
              </button>
            </form>

            {passwordResetMessage && (
              <p
                className="security-text"
                role="status"
              >
                {passwordResetMessage}
              </p>
            )}

            {!isRegistering && (
              <div className="auth-switch">
                <span>
                  Esqueceu sua senha?
                </span>

                <button
                  type="button"
                  onClick={
                    openPasswordReset
                  }
                  disabled={
                    loggingIn
                  }
                >
                  Recuperar senha
                </button>
              </div>
            )}

            <div className="auth-switch">
              <span>
                {isRegistering
                  ? 'Já tem uma conta?'
                  : 'Ainda não tem uma conta?'}
              </span>

              <button
                type="button"
                onClick={
                  switchAuthMode
                }
                disabled={
                  loggingIn
                }
              >
                {isRegistering
                  ? 'Entrar'
                  : 'Criar conta'}
              </button>
            </div>

            <p className="security-text">
              {isRegistering
                ? 'Ao criar sua conta, um workspace pessoal é preparado para você.'
                : 'Ambiente protegido por autenticação segura.'}
            </p>
              </>
            )}
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
            <BudgetsPage />
          }
        />

        <Route
          path="/goals"
          element={
            <GoalsPage />
          }
        />

        <Route
          path="/reports"
          element={
            <ReportsPage />
          }
        />

        <Route
          path="/settings"
          element={
            <SettingsPage />
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