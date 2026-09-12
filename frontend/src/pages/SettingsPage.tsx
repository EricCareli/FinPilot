import {
  BadgeCheck,
  Building2,
  CheckCircle2,
  Copy,
  Database,
  Download,
  House,
  KeyRound,
  LogOut,
  Mail,
  Save,
  ShieldCheck,
  Trash2,
  UserPlus,
  UserRound,
  Users,
  X,
} from 'lucide-react';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import type {
  ChangeEvent,
  FormEvent,
  MouseEvent,
} from 'react';

import {
  ApiError,
  addWorkspaceMember,
  changeUserPassword,
  getAccounts,
  getBudgets,
  getCategories,
  getDashboard,
  getGoals,
  getTransactions,
  getWorkspaceMembers,
  removeWorkspaceMember,
  updateWorkspace,
  updateWorkspaceMemberRole,
} from '../lib/api';

import {
  useAppShell,
} from '../hooks/useAppShell';

import type {
  WorkspaceMember,
  WorkspaceRole,
  WorkspaceType,
} from '../types/api';

import './SettingsPage.css';

const ROLE_LABELS: Record<
  WorkspaceRole,
  string
> = {
  OWNER: 'Proprietário',
  ADMIN: 'Administrador',
  FINANCE: 'Financeiro',
  VIEWER: 'Visualizador',
};

const ROLE_DESCRIPTIONS: Record<
  WorkspaceRole,
  string
> = {
  OWNER:
    'Controle total do workspace e das permissões.',
  ADMIN:
    'Gerencia o workspace e a equipe, com restrições sobre proprietários.',
  FINANCE:
    'Pode operar dados financeiros, sem administrar a equipe.',
  VIEWER:
    'Acesso somente para consulta.',
};

const WORKSPACE_TYPE_LABELS: Record<
  WorkspaceType,
  string
> = {
  PERSONAL: 'Pessoal',
  BUSINESS: 'Empresarial',
};

const MANAGE_ROLES: WorkspaceRole[] = [
  'OWNER',
  'ADMIN',
  'FINANCE',
  'VIEWER',
];

function getInitials(
  name: string,
) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return 'FP';
  }

  return parts
    .map((part) =>
      part.charAt(0).toUpperCase(),
    )
    .join('');
}

function getWorkspaceSlug(
  name: string,
) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'workspace';
}

function SettingsPage() {
  const {
    token,
    user,
    workspace,
    workspaces,
    onWorkspaceChange,
    onLogout,
  } = useAppShell();

  const [
    workspaceName,
    setWorkspaceName,
  ] = useState(
    workspace.name,
  );

  const [
    workspaceType,
    setWorkspaceType,
  ] = useState<WorkspaceType>(
    workspace.type,
  );

  const [
    members,
    setMembers,
  ] = useState<WorkspaceMember[]>(
    [],
  );

  const [
    loadingMembers,
    setLoadingMembers,
  ] = useState(true);

  const [
    membersError,
    setMembersError,
  ] = useState('');

  const [
    pageError,
    setPageError,
  ] = useState('');

  const [
    success,
    setSuccess,
  ] = useState('');

  const [
    savingWorkspace,
    setSavingWorkspace,
  ] = useState(false);

  const [
    inviteEmail,
    setInviteEmail,
  ] = useState('');

  const [
    inviteRole,
    setInviteRole,
  ] = useState<WorkspaceRole>(
    'VIEWER',
  );

  const [
    addingMember,
    setAddingMember,
  ] = useState(false);

  const [
    memberActionId,
    setMemberActionId,
  ] = useState<string | null>(
    null,
  );

  const [
    removeTarget,
    setRemoveTarget,
  ] = useState<WorkspaceMember | null>(
    null,
  );

  const [
    exporting,
    setExporting,
  ] = useState(false);

  const [
    currentPassword,
    setCurrentPassword,
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
    changingPassword,
    setChangingPassword,
  ] = useState(false);

  const [
    passwordSuccess,
    setPasswordSuccess,
  ] = useState('');

  const [
    passwordError,
    setPasswordError,
  ] = useState('');

  const canManageWorkspace =
    workspace.role === 'OWNER' ||
    workspace.role === 'ADMIN';

  const canAssignOwner =
    workspace.role === 'OWNER';

  const availableInviteRoles =
    useMemo(
      () =>
        canAssignOwner
          ? MANAGE_ROLES
          : MANAGE_ROLES.filter(
              (role) =>
                role !== 'OWNER',
            ),
      [canAssignOwner],
    );

  const workspaceChanged =
    workspaceName.trim() !==
      workspace.name ||
    workspaceType !==
      workspace.type;

  const handleRequestError =
    useCallback(
      (
        caughtError: unknown,
        fallback: string,
      ) => {
        if (
          caughtError instanceof
            ApiError &&
          caughtError.statusCode ===
            401
        ) {
          onLogout();
          return true;
        }

        setPageError(
          caughtError instanceof Error
            ? caughtError.message
            : fallback,
        );

        return false;
      },
      [onLogout],
    );

  const loadMembers =
    useCallback(async () => {
      setLoadingMembers(true);
      setMembersError('');

      try {
        const workspaceMembers =
          await getWorkspaceMembers(
            token,
            workspace.id,
          );

        setMembers(
          workspaceMembers,
        );
      } catch (caughtError) {
        if (
          caughtError instanceof
            ApiError &&
          caughtError.statusCode ===
            401
        ) {
          onLogout();
          return;
        }

        setMembersError(
          caughtError instanceof Error
            ? caughtError.message
            : 'Não foi possível carregar os membros do workspace.',
        );
      } finally {
        setLoadingMembers(false);
      }
    }, [
      token,
      workspace.id,
      onLogout,
    ]);

  useEffect(() => {
    const timeoutId =
      window.setTimeout(
        () => {
          setWorkspaceName(
            workspace.name,
          );
          setWorkspaceType(
            workspace.type,
          );
          setInviteEmail('');
          setInviteRole(
            'VIEWER',
          );
          setPageError('');
          setSuccess('');
          setRemoveTarget(
            null,
          );

          void loadMembers();
        },
        0,
      );

    return () => {
      window.clearTimeout(
        timeoutId,
      );
    };
  }, [
    workspace.id,
    workspace.name,
    workspace.type,
    loadMembers,
  ]);

  function clearMessages() {
    setPageError('');
    setSuccess('');
    setPasswordError('');
    setPasswordSuccess('');
  }

  async function copyText(
    value: string,
    label: string,
  ) {
    clearMessages();

    try {
      await navigator.clipboard.writeText(
        value,
      );

      setSuccess(
        `${label} copiado com sucesso.`,
      );
    } catch {
      setPageError(
        `Não foi possível copiar ${label.toLowerCase()}.`,
      );
    }
  }

  async function handleWorkspaceSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    clearMessages();

    if (!canManageWorkspace) {
      setPageError(
        'Seu perfil não pode alterar as configurações deste workspace.',
      );
      return;
    }

    const normalizedName =
      workspaceName.trim();

    if (
      normalizedName.length < 2
    ) {
      setPageError(
        'O nome do workspace deve ter pelo menos 2 caracteres.',
      );
      return;
    }

    if (!workspaceChanged) {
      setSuccess(
        'Nenhuma alteração para salvar.',
      );
      return;
    }

    setSavingWorkspace(true);

    try {
      await updateWorkspace(
        token,
        workspace.id,
        {
          name: normalizedName,
          type: workspaceType,
        },
      );

      setSuccess(
        'Workspace atualizado. Atualizando a interface...',
      );

      window.setTimeout(
        () => {
          window.location.reload();
        },
        650,
      );
    } catch (caughtError) {
      handleRequestError(
        caughtError,
        'Não foi possível atualizar o workspace.',
      );
    } finally {
      setSavingWorkspace(false);
    }
  }

  async function handleAddMember(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    clearMessages();

    if (!canManageWorkspace) {
      setPageError(
        'Seu perfil não pode adicionar membros.',
      );
      return;
    }

    if (
      workspace.type !== 'BUSINESS'
    ) {
      setPageError(
        'Workspaces pessoais não aceitam membros adicionais. Altere o tipo para Empresarial primeiro.',
      );
      return;
    }

    const normalizedEmail =
      inviteEmail
        .trim()
        .toLowerCase();

    if (
      !normalizedEmail.includes('@')
    ) {
      setPageError(
        'Digite um e-mail válido para o novo membro.',
      );
      return;
    }

    setAddingMember(true);

    try {
      await addWorkspaceMember(
        token,
        workspace.id,
        {
          email: normalizedEmail,
          role: inviteRole,
        },
      );

      setInviteEmail('');
      setInviteRole('VIEWER');
      setSuccess(
        'Membro adicionado com sucesso.',
      );

      await loadMembers();
    } catch (caughtError) {
      handleRequestError(
        caughtError,
        'Não foi possível adicionar o membro.',
      );
    } finally {
      setAddingMember(false);
    }
  }

  function canManageMember(
    member: WorkspaceMember,
  ) {
    if (!canManageWorkspace) {
      return false;
    }

    if (
      member.user.id === user.id
    ) {
      return false;
    }

    if (
      workspace.role === 'ADMIN' &&
      member.role === 'OWNER'
    ) {
      return false;
    }

    return true;
  }

  async function handleRoleChange(
    member: WorkspaceMember,
    role: WorkspaceRole,
  ) {
    clearMessages();

    if (
      !canManageMember(member) ||
      role === member.role
    ) {
      return;
    }

    setMemberActionId(
      member.id,
    );

    try {
      await updateWorkspaceMemberRole(
        token,
        workspace.id,
        member.id,
        role,
      );

      setSuccess(
        `Permissão de ${member.user.name} atualizada.`,
      );

      await loadMembers();
    } catch (caughtError) {
      handleRequestError(
        caughtError,
        'Não foi possível atualizar a permissão do membro.',
      );
    } finally {
      setMemberActionId(null);
    }
  }

  async function handleRemoveMember() {
    if (!removeTarget) {
      return;
    }

    clearMessages();
    setMemberActionId(
      removeTarget.id,
    );

    try {
      await removeWorkspaceMember(
        token,
        workspace.id,
        removeTarget.id,
      );

      const removedName =
        removeTarget.user.name;

      setRemoveTarget(null);
      setSuccess(
        `${removedName} foi removido do workspace.`,
      );

      await loadMembers();
    } catch (caughtError) {
      handleRequestError(
        caughtError,
        'Não foi possível remover o membro.',
      );
    } finally {
      setMemberActionId(null);
    }
  }

  async function handlePasswordChange(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setPageError('');
    setSuccess('');
    setPasswordError('');
    setPasswordSuccess('');

    if (!currentPassword) {
      setPasswordError(
        'Digite sua senha atual.',
      );
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError(
        'A nova senha deve ter pelo menos 8 caracteres.',
      );
      return;
    }

    if (
      newPassword !==
      confirmNewPassword
    ) {
      setPasswordError(
        'A confirmação da nova senha não confere.',
      );
      return;
    }

    if (
      currentPassword ===
      newPassword
    ) {
      setPasswordError(
        'A nova senha deve ser diferente da senha atual.',
      );
      return;
    }

    setChangingPassword(true);

    try {
      await changeUserPassword(
        token,
        currentPassword,
        newPassword,
      );

      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');

      setPasswordSuccess(
        'Senha alterada com sucesso.',
      );
    } catch (caughtError) {
      if (
        caughtError instanceof
          ApiError &&
        caughtError.statusCode ===
          401 &&
        caughtError.message ===
          'Current password is incorrect'
      ) {
        setPasswordError(
          'A senha atual está incorreta.',
        );
        return;
      }

      if (
        caughtError instanceof
          ApiError &&
        caughtError.statusCode ===
          401
      ) {
        onLogout();
        return;
      }

      setPasswordError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Não foi possível alterar sua senha.',
      );
    } finally {
      setChangingPassword(false);
    }
  }

  async function handleExportData() {
    clearMessages();
    setExporting(true);

    try {
      const [
        accounts,
        transactions,
        categories,
        budgets,
        goals,
        dashboard,
        workspaceMembers,
      ] = await Promise.all([
        getAccounts(
          token,
          workspace.id,
          true,
        ),
        getTransactions(
          token,
          workspace.id,
          true,
        ),
        getCategories(
          token,
          workspace.id,
        ),
        getBudgets(
          token,
          workspace.id,
        ),
        getGoals(
          token,
          workspace.id,
        ),
        getDashboard(
          token,
          workspace.id,
        ),
        getWorkspaceMembers(
          token,
          workspace.id,
        ),
      ]);

      const payload = {
        format:
          'finpilot-workspace-backup',
        version: 1,
        exportedAt:
          new Date().toISOString(),
        exportedBy: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
        workspace: {
          id: workspace.id,
          name: workspace.name,
          type: workspace.type,
          role: workspace.role,
        },
        data: {
          accounts,
          transactions,
          categories,
          budgets,
          goals,
          dashboard,
          members:
            workspaceMembers,
        },
      };

      const blob = new Blob(
        [
          JSON.stringify(
            payload,
            null,
            2,
          ),
        ],
        {
          type: 'application/json',
        },
      );

      const url =
        URL.createObjectURL(blob);

      const anchor =
        document.createElement('a');

      const date = new Date()
        .toISOString()
        .slice(0, 10);

      anchor.href = url;
      anchor.download =
        `finpilot-${getWorkspaceSlug(
          workspace.name,
        )}-${date}.json`;

      document.body.appendChild(
        anchor,
      );
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      setSuccess(
        'Backup do workspace exportado com sucesso.',
      );
    } catch (caughtError) {
      handleRequestError(
        caughtError,
        'Não foi possível exportar os dados.',
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="settings-page">
      <header className="settings-hero">
        <div>
          <span className="settings-eyebrow">
            CONFIGURAÇÕES
          </span>

          <h1>
            Controle da sua conta e workspace
          </h1>

          <p>
            Gerencie identidade, equipe, permissões, dados e sessão em um só lugar.
          </p>
        </div>

        <div className="settings-role-pill">
          <ShieldCheck size={17} />
          <span>
            {ROLE_LABELS[
              workspace.role
            ]}
          </span>
        </div>
      </header>

      {(success || pageError) && (
        <div
          className={`settings-feedback ${
            pageError
              ? 'error'
              : 'success'
          }`}
          role="status"
        >
          {pageError ? (
            <X size={18} />
          ) : (
            <CheckCircle2
              size={18}
            />
          )}

          <span>
            {pageError || success}
          </span>
        </div>
      )}

      <div className="settings-overview-grid">
        <section className="settings-panel settings-profile-panel">
          <div className="settings-panel-heading">
            <div>
              <span className="settings-panel-kicker">
                CONTA
              </span>

              <h2>
                Seu perfil
              </h2>

              <p>
                Informações da conta autenticada no FinPilot.
              </p>
            </div>

            <UserRound size={21} />
          </div>

          <div className="settings-profile-card">
            <div className="settings-avatar">
              {getInitials(
                user.name,
              )}
            </div>

            <div className="settings-profile-copy">
              <strong>
                {user.name}
              </strong>

              <span>
                <Mail size={14} />
                {user.email}
              </span>
            </div>

            <span className="settings-account-status">
              <BadgeCheck size={15} />
              Ativa
            </span>
          </div>

          <div className="settings-readonly-row">
            <div>
              <span>
                ID do usuário
              </span>
              <code>
                {user.id}
              </code>
            </div>

            <button
              type="button"
              className="settings-copy-button"
              onClick={() =>
                void copyText(
                  user.id,
                  'ID do usuário',
                )
              }
              aria-label="Copiar ID do usuário"
            >
              <Copy size={16} />
            </button>
          </div>

          <div className="settings-info-note">
            <KeyRound size={16} />
            <p>
              Nome e e-mail permanecem disponíveis para consulta. Sua senha pode ser alterada com segurança na seção Segurança.
            </p>
          </div>
        </section>

        <section className="settings-panel">
          <div className="settings-panel-heading">
            <div>
              <span className="settings-panel-kicker">
                WORKSPACE
              </span>

              <h2>
                Espaço ativo
              </h2>

              <p>
                Escolha onde trabalhar e ajuste as informações do workspace.
              </p>
            </div>

            <Building2 size={21} />
          </div>

          <label className="settings-field">
            <span>
              Workspace ativo
            </span>

            <select
              value={workspace.id}
              onChange={(
                event: ChangeEvent<HTMLSelectElement>,
              ) =>
                onWorkspaceChange(
                  event.target.value,
                )
              }
            >
              {workspaces.map(
                (item) => (
                  <option
                    key={item.id}
                    value={item.id}
                  >
                    {item.name}
                  </option>
                ),
              )}
            </select>
          </label>

          <form
            className="settings-workspace-form"
            onSubmit={
              handleWorkspaceSubmit
            }
          >
            <label className="settings-field">
              <span>
                Nome
              </span>

              <input
                type="text"
                value={workspaceName}
                onChange={(
                  event: ChangeEvent<HTMLInputElement>,
                ) =>
                  setWorkspaceName(
                    event.target.value,
                  )
                }
                disabled={
                  !canManageWorkspace
                }
                maxLength={80}
              />
            </label>

            <label className="settings-field">
              <span>
                Tipo
              </span>

              <select
                value={workspaceType}
                onChange={(
                  event: ChangeEvent<HTMLSelectElement>,
                ) =>
                  setWorkspaceType(
                    event.target
                      .value as WorkspaceType,
                  )
                }
                disabled={
                  !canManageWorkspace
                }
              >
                <option value="PERSONAL">
                  Pessoal
                </option>
                <option value="BUSINESS">
                  Empresarial
                </option>
              </select>
            </label>

            <div className="settings-workspace-meta">
              <div>
                {workspace.type ===
                'BUSINESS' ? (
                  <Building2
                    size={16}
                  />
                ) : (
                  <House
                    size={16}
                  />
                )}

                <span>
                  {
                    WORKSPACE_TYPE_LABELS[
                      workspace.type
                    ]
                  }
                </span>
              </div>

              <div>
                <ShieldCheck
                  size={16}
                />
                <span>
                  {
                    ROLE_LABELS[
                      workspace.role
                    ]
                  }
                </span>
              </div>
            </div>

            {canManageWorkspace ? (
              <button
                type="submit"
                className="settings-primary-button"
                disabled={
                  savingWorkspace ||
                  !workspaceChanged
                }
              >
                <Save size={16} />
                {savingWorkspace
                  ? 'Salvando...'
                  : 'Salvar workspace'}
              </button>
            ) : (
              <div className="settings-permission-note">
                <ShieldCheck
                  size={16}
                />
                Somente proprietários e administradores podem alterar estas informações.
              </div>
            )}
          </form>
        </section>
      </div>

      <section className="settings-panel settings-team-panel">
        <div className="settings-panel-heading settings-team-heading">
          <div>
            <span className="settings-panel-kicker">
              EQUIPE E ACESSO
            </span>

            <h2>
              Membros do workspace
            </h2>

            <p>
              Controle quem participa e o nível de acesso de cada pessoa.
            </p>
          </div>

          <div className="settings-team-count">
            <Users size={17} />
            <strong>
              {members.length}
            </strong>
            <span>
              {members.length === 1
                ? 'membro'
                : 'membros'}
            </span>
          </div>
        </div>

        {canManageWorkspace &&
          workspace.type ===
            'BUSINESS' && (
          <form
            className="settings-invite-form"
            onSubmit={
              handleAddMember
            }
          >
            <label className="settings-field settings-invite-email">
              <span>
                Adicionar por e-mail
              </span>

              <input
                type="email"
                value={inviteEmail}
                onChange={(
                  event: ChangeEvent<HTMLInputElement>,
                ) =>
                  setInviteEmail(
                    event.target.value,
                  )
                }
                placeholder="pessoa@email.com"
                autoComplete="email"
                required
              />
            </label>

            <label className="settings-field settings-invite-role">
              <span>
                Permissão
              </span>

              <select
                value={inviteRole}
                onChange={(
                  event: ChangeEvent<HTMLSelectElement>,
                ) =>
                  setInviteRole(
                    event.target
                      .value as WorkspaceRole,
                  )
                }
              >
                {availableInviteRoles.map(
                  (role) => (
                    <option
                      key={role}
                      value={role}
                    >
                      {
                        ROLE_LABELS[
                          role
                        ]
                      }
                    </option>
                  ),
                )}
              </select>
            </label>

            <button
              type="submit"
              className="settings-primary-button settings-invite-button"
              disabled={addingMember}
            >
              <UserPlus size={16} />
              {addingMember
                ? 'Adicionando...'
                : 'Adicionar membro'}
            </button>
          </form>
        )}

        {workspace.type ===
          'PERSONAL' && (
          <div className="settings-business-note">
            <House size={18} />
            <div>
              <strong>
                Workspace pessoal
              </strong>
              <span>
                Para adicionar outras pessoas, altere o tipo do workspace para Empresarial.
              </span>
            </div>
          </div>
        )}

        {membersError && (
          <div className="settings-inline-error">
            {membersError}
          </div>
        )}

        {loadingMembers ? (
          <div className="settings-loading-list">
            <span />
            <span />
            <span />
          </div>
        ) : members.length === 0 ? (
          <div className="settings-empty-state">
            <Users size={25} />
            <strong>
              Nenhum membro encontrado
            </strong>
            <span>
              O workspace ainda não possui membros disponíveis para exibição.
            </span>
          </div>
        ) : (
          <div className="settings-member-list">
            {members.map(
              (member) => {
                const manageable =
                  canManageMember(
                    member,
                  );

                const actionRunning =
                  memberActionId ===
                  member.id;

                const roleOptions =
                  canAssignOwner
                    ? MANAGE_ROLES
                    : MANAGE_ROLES.filter(
                        (role) =>
                          role !==
                          'OWNER',
                      );

                return (
                  <article
                    className="settings-member-row"
                    key={member.id}
                  >
                    <div className="settings-member-identity">
                      <div className="settings-member-avatar">
                        {getInitials(
                          member.user.name,
                        )}
                      </div>

                      <div>
                        <div className="settings-member-name-line">
                          <strong>
                            {
                              member.user
                                .name
                            }
                          </strong>

                          {member.user.id ===
                            user.id && (
                            <span className="settings-you-badge">
                              Você
                            </span>
                          )}
                        </div>

                        <span>
                          {
                            member.user
                              .email
                          }
                        </span>
                      </div>
                    </div>

                    <div className="settings-member-role-copy">
                      <strong>
                        {
                          ROLE_LABELS[
                            member.role
                          ]
                        }
                      </strong>

                      <span>
                        {
                          ROLE_DESCRIPTIONS[
                            member.role
                          ]
                        }
                      </span>
                    </div>

                    <div className="settings-member-actions">
                      <select
                        value={member.role}
                        disabled={
                          !manageable ||
                          actionRunning
                        }
                        onChange={(
                          event: ChangeEvent<HTMLSelectElement>,
                        ) =>
                          void handleRoleChange(
                            member,
                            event.target
                              .value as WorkspaceRole,
                          )
                        }
                        aria-label={`Permissão de ${member.user.name}`}
                      >
                        {!roleOptions.includes(
                          member.role,
                        ) && (
                          <option
                            value={
                              member.role
                            }
                          >
                            {
                              ROLE_LABELS[
                                member.role
                              ]
                            }
                          </option>
                        )}

                        {roleOptions.map(
                          (role) => (
                            <option
                              key={role}
                              value={role}
                            >
                              {
                                ROLE_LABELS[
                                  role
                                ]
                              }
                            </option>
                          ),
                        )}
                      </select>

                      <button
                        type="button"
                        className="settings-danger-icon-button"
                        disabled={
                          !manageable ||
                          actionRunning
                        }
                        onClick={() =>
                          setRemoveTarget(
                            member,
                          )
                        }
                        aria-label={`Remover ${member.user.name}`}
                      >
                        <Trash2
                          size={16}
                        />
                      </button>
                    </div>
                  </article>
                );
              },
            )}
          </div>
        )}
      </section>

      <div className="settings-bottom-grid">
        <section className="settings-panel">
          <div className="settings-panel-heading">
            <div>
              <span className="settings-panel-kicker">
                DADOS
              </span>

              <h2>
                Backup do workspace
              </h2>

              <p>
                Exporte uma cópia JSON dos principais dados financeiros e configurações disponíveis.
              </p>
            </div>

            <Database size={21} />
          </div>

          <div className="settings-feature-row">
            <div className="settings-feature-icon">
              <Download size={20} />
            </div>

            <div>
              <strong>
                Exportar dados
              </strong>
              <span>
                Inclui contas, transações, categorias, orçamentos, metas, dashboard e membros.
              </span>
            </div>
          </div>

          <button
            type="button"
            className="settings-secondary-button"
            onClick={() =>
              void handleExportData()
            }
            disabled={exporting}
          >
            <Download size={16} />
            {exporting
              ? 'Preparando backup...'
              : 'Baixar backup JSON'}
          </button>
        </section>

        <section className="settings-panel">
          <div className="settings-panel-heading">
            <div>
              <span className="settings-panel-kicker">
                SEGURANÇA
              </span>

              <h2>
                Segurança da conta
              </h2>

              <p>
                Atualize sua senha e controle o acesso desta sessão ao FinPilot.
              </p>
            </div>

            <ShieldCheck size={21} />
          </div>

          <form
            className="settings-workspace-form"
            onSubmit={
              handlePasswordChange
            }
          >
            <label className="settings-field">
              <span>
                Senha atual
              </span>

              <input
                type="password"
                value={
                  currentPassword
                }
                onChange={(
                  event: ChangeEvent<HTMLInputElement>,
                ) =>
                  setCurrentPassword(
                    event.target.value,
                  )
                }
                placeholder="Digite sua senha atual"
                autoComplete="current-password"
                required
              />
            </label>

            <label className="settings-field">
              <span>
                Nova senha
              </span>

              <input
                type="password"
                value={newPassword}
                onChange={(
                  event: ChangeEvent<HTMLInputElement>,
                ) =>
                  setNewPassword(
                    event.target.value,
                  )
                }
                placeholder="Mínimo de 8 caracteres"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>

            <label className="settings-field">
              <span>
                Confirmar nova senha
              </span>

              <input
                type="password"
                value={
                  confirmNewPassword
                }
                onChange={(
                  event: ChangeEvent<HTMLInputElement>,
                ) =>
                  setConfirmNewPassword(
                    event.target.value,
                  )
                }
                placeholder="Digite a nova senha novamente"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>

            <button
              type="submit"
              className="settings-primary-button"
              disabled={
                changingPassword
              }
            >
              <KeyRound size={16} />
              {changingPassword
                ? 'Alterando senha...'
                : 'Alterar senha'}
            </button>
          </form>

          {(passwordSuccess ||
            passwordError) && (
            <div
              className={`settings-feedback ${
                passwordError
                  ? 'error'
                  : 'success'
              }`}
              role="status"
            >
              {passwordError ? (
                <X size={18} />
              ) : (
                <CheckCircle2
                  size={18}
                />
              )}

              <span>
                {passwordError ||
                  passwordSuccess}
              </span>
            </div>
          )}

          <div className="settings-info-note">
            <ShieldCheck size={16} />
            <p>
              Ao alterar sua senha, códigos e autorizações de recuperação pendentes deixam de funcionar.
            </p>
          </div>

          <div className="settings-session-card">
            <div className="settings-session-icon">
              <KeyRound size={20} />
            </div>

            <div>
              <strong>
                Sessão autenticada
              </strong>
              <span>
                {user.email}
              </span>
            </div>

            <span className="settings-session-status">
              Ativa
            </span>
          </div>

          <button
            type="button"
            className="settings-logout-button"
            onClick={onLogout}
          >
            <LogOut size={16} />
            Encerrar sessão
          </button>
        </section>
      </div>

      <footer className="settings-footer-card">
        <div>
          <strong>
            FinPilot
          </strong>
          <span>
            Gestão financeira pessoal e colaborativa.
          </span>
        </div>

        <div className="settings-workspace-id">
          <span>
            Workspace ID
          </span>
          <code>
            {workspace.id}
          </code>
          <button
            type="button"
            onClick={() =>
              void copyText(
                workspace.id,
                'Workspace ID',
              )
            }
            aria-label="Copiar Workspace ID"
          >
            <Copy size={15} />
          </button>
        </div>
      </footer>

      {removeTarget && (
        <div
          className="settings-modal-backdrop"
          role="presentation"
          onMouseDown={(
            event: MouseEvent<HTMLDivElement>,
          ) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setRemoveTarget(
                null,
              );
            }
          }}
        >
          <div
            className="settings-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-member-title"
          >
            <div className="settings-modal-icon danger">
              <Trash2 size={21} />
            </div>

            <h2 id="remove-member-title">
              Remover membro?
            </h2>

            <p>
              <strong>
                {
                  removeTarget.user
                    .name
                }
              </strong>{' '}
              perderá o acesso a este workspace. Os dados financeiros do workspace não serão excluídos.
            </p>

            <div className="settings-modal-actions">
              <button
                type="button"
                className="settings-secondary-button"
                onClick={() =>
                  setRemoveTarget(
                    null,
                  )
                }
                disabled={
                  memberActionId ===
                  removeTarget.id
                }
              >
                Cancelar
              </button>

              <button
                type="button"
                className="settings-danger-button"
                onClick={() =>
                  void handleRemoveMember()
                }
                disabled={
                  memberActionId ===
                  removeTarget.id
                }
              >
                <Trash2 size={16} />
                {memberActionId ===
                removeTarget.id
                  ? 'Removendo...'
                  : 'Remover acesso'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SettingsPage;
