import {
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Edit3,
  Flag,
  PiggyBank,
  Plus,
  Target,
  Trash2,
  TrendingUp,
  Trophy,
  WalletCards,
  X,
} from 'lucide-react';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import type {
  FormEvent,
} from 'react';

import {
  ApiError,
  createGoal,
  deleteGoal,
  getGoalProgress,
  getGoals,
  updateGoal,
  updateGoalAmount,
} from '../lib/api';

import {
  formatCurrency,
  toNumber,
} from '../lib/format';

import {
  useAppShell,
} from '../hooks/useAppShell';

import type {
  Goal,
  GoalProgress,
} from '../types/api';

import './GoalsPage.css';

type GoalFilter =
  | 'ALL'
  | 'ACTIVE'
  | 'COMPLETED';

type GoalVisualStatus =
  | 'active'
  | 'attention'
  | 'overdue'
  | 'completed';

interface GoalFormState {
  name: string;
  targetAmount: string;
  deadline: string;
}

const DAY_IN_MS =
  24 * 60 * 60 * 1000;

function createEmptyGoalForm():
  GoalFormState {
  return {
    name: '',
    targetAmount: '',
    deadline: '',
  };
}

function parseBrazilianMoney(
  value: string,
) {
  const cleaned =
    value
      .replace(/[R$\s]/g, '')
      .replace(/[^\d,.-]/g, '');

  if (!cleaned) {
    return Number.NaN;
  }

  if (cleaned.includes(',')) {
    return Number(
      cleaned
        .replace(/\./g, '')
        .replace(',', '.'),
    );
  }

  const dotCount =
    (cleaned.match(/\./g) ?? [])
      .length;

  if (dotCount > 1) {
    return Number(
      cleaned.replace(/\./g, ''),
    );
  }

  if (dotCount === 1) {
    const [integerPart, decimalPart] =
      cleaned.split('.');

    if (
      decimalPart?.length === 3 &&
      integerPart
    ) {
      return Number(
        `${integerPart}${decimalPart}`,
      );
    }
  }

  return Number(cleaned);
}

function formatGoalDate(
  deadline: string | null,
) {
  if (!deadline) {
    return 'Sem prazo definido';
  }

  const datePart =
    deadline.slice(0, 10);

  const [year, month, day] =
    datePart
      .split('-')
      .map(Number);

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day,
      ),
    );

  return new Intl.DateTimeFormat(
    'pt-BR',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    },
  ).format(date);
}

function getDaysUntilDeadline(
  deadline: string | null,
) {
  if (!deadline) {
    return null;
  }

  const now =
    new Date();

  const todayUtc =
    Date.UTC(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );

  const [year, month, day] =
    deadline
      .slice(0, 10)
      .split('-')
      .map(Number);

  const deadlineUtc =
    Date.UTC(
      year,
      month - 1,
      day,
    );

  return Math.ceil(
    (deadlineUtc - todayUtc) /
      DAY_IN_MS,
  );
}

function getGoalVisualStatus(
  progress: GoalProgress,
): GoalVisualStatus {
  if (progress.completed) {
    return 'completed';
  }

  const daysLeft =
    getDaysUntilDeadline(
      progress.goal.deadline,
    );

  if (
    daysLeft !== null &&
    daysLeft < 0
  ) {
    return 'overdue';
  }

  if (
    daysLeft !== null &&
    daysLeft <= 30
  ) {
    return 'attention';
  }

  return 'active';
}

function getGoalStatusLabel(
  status: GoalVisualStatus,
) {
  if (status === 'completed') {
    return 'Concluída';
  }

  if (status === 'overdue') {
    return 'Prazo vencido';
  }

  if (status === 'attention') {
    return 'Prazo próximo';
  }

  return 'Em andamento';
}

function getDeadlineDetail(
  goal: Goal,
  completed: boolean,
) {
  if (completed) {
    return 'Objetivo alcançado';
  }

  const daysLeft =
    getDaysUntilDeadline(
      goal.deadline,
    );

  if (daysLeft === null) {
    return 'Sem prazo definido';
  }

  if (daysLeft < 0) {
    const overdueDays =
      Math.abs(daysLeft);

    return overdueDays === 1
      ? '1 dia em atraso'
      : `${overdueDays} dias em atraso`;
  }

  if (daysLeft === 0) {
    return 'Prazo termina hoje';
  }

  if (daysLeft === 1) {
    return '1 dia restante';
  }

  return `${daysLeft} dias restantes`;
}

function GoalsPage() {
  const {
    token,
    workspace,
    onLogout,
  } = useAppShell();

  const [
    goals,
    setGoals,
  ] = useState<Goal[]>([]);

  const [
    progressByGoalId,
    setProgressByGoalId,
  ] = useState<
    Record<string, GoalProgress>
  >({});

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState('');

  const [
    success,
    setSuccess,
  ] = useState('');

  const [
    filter,
    setFilter,
  ] = useState<GoalFilter>(
    'ALL',
  );

  const [
    modalOpen,
    setModalOpen,
  ] = useState(false);

  const [
    editingGoal,
    setEditingGoal,
  ] = useState<Goal | null>(
    null,
  );

  const [
    form,
    setForm,
  ] = useState<GoalFormState>(
    createEmptyGoalForm,
  );

  const [
    formError,
    setFormError,
  ] = useState('');

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    progressTarget,
    setProgressTarget,
  ] = useState<Goal | null>(
    null,
  );

  const [
    progressAmount,
    setProgressAmount,
  ] = useState('');

  const [
    progressError,
    setProgressError,
  ] = useState('');

  const [
    savingProgress,
    setSavingProgress,
  ] = useState(false);

  const [
    deleteTarget,
    setDeleteTarget,
  ] = useState<Goal | null>(
    null,
  );

  const [
    deleting,
    setDeleting,
  ] = useState(false);

  const canManage =
    workspace.role === 'OWNER' ||
    workspace.role === 'ADMIN' ||
    workspace.role === 'FINANCE';

  const handleRequestError =
    useCallback(
      (
        caughtError: unknown,
        fallback: string,
      ) => {
        if (
          caughtError instanceof
            ApiError &&
          caughtError.statusCode === 401
        ) {
          onLogout();
          return;
        }

        setError(
          caughtError instanceof Error
            ? caughtError.message
            : fallback,
        );
      },
      [onLogout],
    );

  const loadGoals =
    useCallback(async () => {
      setLoading(true);
      setError('');

      try {
        const goalData =
          await getGoals(
            token,
            workspace.id,
          );

        const progressData =
          await Promise.all(
            goalData.map(
              (goal) =>
                getGoalProgress(
                  token,
                  workspace.id,
                  goal.id,
                ),
            ),
          );

        const nextProgress =
          progressData.reduce<
            Record<
              string,
              GoalProgress
            >
          >(
            (
              result,
              progress,
            ) => {
              result[
                progress.goal.id
              ] = progress;

              return result;
            },
            {},
          );

        setGoals(goalData);
        setProgressByGoalId(
          nextProgress,
        );
      } catch (caughtError) {
        handleRequestError(
          caughtError,
          'Não foi possível carregar as metas.',
        );
      } finally {
        setLoading(false);
      }
    }, [
      token,
      workspace.id,
      handleRequestError,
    ]);

  useEffect(() => {
    const timeoutId =
      window.setTimeout(
        () => {
          void loadGoals();
        },
        0,
      );

    return () => {
      window.clearTimeout(
        timeoutId,
      );
    };
  }, [loadGoals]);

  const stats =
    useMemo(() => {
      let target = 0;
      let current = 0;
      let remaining = 0;
      let completed = 0;

      for (const goal of goals) {
        const progress =
          progressByGoalId[
            goal.id
          ];

        target +=
          toNumber(
            goal.targetAmount,
          );

        current +=
          toNumber(
            goal.currentAmount,
          );

        if (progress) {
          remaining +=
            toNumber(
              progress.remaining,
            );

          if (progress.completed) {
            completed += 1;
          }
        } else {
          remaining +=
            Math.max(
              0,
              toNumber(
                goal.targetAmount,
              ) -
                toNumber(
                  goal.currentAmount,
                ),
            );
        }
      }

      const percentage =
        target > 0
          ? (current / target) * 100
          : 0;

      return {
        count: goals.length,
        target,
        current,
        remaining,
        completed,
        percentage,
      };
    }, [
      goals,
      progressByGoalId,
    ]);

  const filteredGoals =
    useMemo(() => {
      const items =
        goals.filter((goal) => {
          const progress =
            progressByGoalId[
              goal.id
            ];

          if (!progress) {
            return filter !==
              'COMPLETED';
          }

          if (filter === 'ACTIVE') {
            return !progress.completed;
          }

          if (
            filter === 'COMPLETED'
          ) {
            return progress.completed;
          }

          return true;
        });

      return [...items].sort(
        (first, second) => {
          const firstProgress =
            progressByGoalId[
              first.id
            ];

          const secondProgress =
            progressByGoalId[
              second.id
            ];

          if (
            firstProgress?.completed !==
            secondProgress?.completed
          ) {
            return firstProgress
              ?.completed
              ? 1
              : -1;
          }

          if (
            first.deadline &&
            second.deadline
          ) {
            return first.deadline.localeCompare(
              second.deadline,
            );
          }

          if (first.deadline) {
            return -1;
          }

          if (second.deadline) {
            return 1;
          }

          return second.createdAt.localeCompare(
            first.createdAt,
          );
        },
      );
    }, [
      goals,
      progressByGoalId,
      filter,
    ]);

  function openCreateModal() {
    if (!canManage) {
      return;
    }

    setEditingGoal(null);
    setForm(
      createEmptyGoalForm(),
    );
    setFormError('');
    setModalOpen(true);
  }

  function openEditModal(
    goal: Goal,
  ) {
    if (!canManage) {
      return;
    }

    setEditingGoal(goal);
    setForm({
      name: goal.name,
      targetAmount: String(
        toNumber(
          goal.targetAmount,
        ),
      ),
      deadline:
        goal.deadline?.slice(
          0,
          10,
        ) ?? '',
    });
    setFormError('');
    setModalOpen(true);
  }

  function closeGoalModal() {
    if (saving) {
      return;
    }

    setModalOpen(false);
    setEditingGoal(null);
    setFormError('');
  }

  async function handleGoalSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const targetAmount =
      parseBrazilianMoney(
        form.targetAmount,
      );

    if (
      form.name.trim().length < 2
    ) {
      setFormError(
        'Informe um nome com pelo menos 2 caracteres.',
      );
      return;
    }

    if (
      !Number.isFinite(
        targetAmount,
      ) ||
      targetAmount <= 0
    ) {
      setFormError(
        'Informe um valor objetivo maior que zero.',
      );
      return;
    }

    setSaving(true);
    setFormError('');
    setError('');
    setSuccess('');

    try {
      if (editingGoal) {
        await updateGoal(
          token,
          workspace.id,
          editingGoal.id,
          {
            name:
              form.name.trim(),
            targetAmount,
            deadline:
              form.deadline ||
              null,
          },
        );

        setSuccess(
          'Meta atualizada com sucesso.',
        );
      } else {
        await createGoal(
          token,
          workspace.id,
          {
            name:
              form.name.trim(),
            targetAmount,
            ...(form.deadline
              ? {
                  deadline:
                    form.deadline,
                }
              : {}),
          },
        );

        setSuccess(
          'Meta criada com sucesso.',
        );
      }

      setModalOpen(false);
      setEditingGoal(null);
      await loadGoals();
    } catch (caughtError) {
      if (
        caughtError instanceof
          ApiError &&
        caughtError.statusCode === 401
      ) {
        onLogout();
        return;
      }

      setFormError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Não foi possível salvar a meta.',
      );
    } finally {
      setSaving(false);
    }
  }

  function openProgressModal(
    goal: Goal,
  ) {
    if (!canManage) {
      return;
    }

    setProgressTarget(goal);
    setProgressAmount(
      String(
        toNumber(
          goal.currentAmount,
        ),
      ),
    );
    setProgressError('');
  }

  function closeProgressModal() {
    if (savingProgress) {
      return;
    }

    setProgressTarget(null);
    setProgressError('');
  }

  async function handleProgressSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!progressTarget) {
      return;
    }

    const currentAmount =
      parseBrazilianMoney(
        progressAmount,
      );

    if (
      !Number.isFinite(
        currentAmount,
      ) ||
      currentAmount < 0
    ) {
      setProgressError(
        'Informe um valor acumulado válido.',
      );
      return;
    }

    setSavingProgress(true);
    setProgressError('');
    setError('');
    setSuccess('');

    try {
      await updateGoalAmount(
        token,
        workspace.id,
        progressTarget.id,
        {
          currentAmount,
        },
      );

      setProgressTarget(null);
      setSuccess(
        'Progresso atualizado com sucesso.',
      );
      await loadGoals();
    } catch (caughtError) {
      if (
        caughtError instanceof
          ApiError &&
        caughtError.statusCode === 401
      ) {
        onLogout();
        return;
      }

      setProgressError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Não foi possível atualizar o progresso.',
      );
    } finally {
      setSavingProgress(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) {
      return;
    }

    setDeleting(true);
    setError('');
    setSuccess('');

    try {
      await deleteGoal(
        token,
        workspace.id,
        deleteTarget.id,
      );

      setDeleteTarget(null);
      setSuccess(
        'Meta excluída com sucesso.',
      );
      await loadGoals();
    } catch (caughtError) {
      handleRequestError(
        caughtError,
        'Não foi possível excluir a meta.',
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main className="dashboard-content goals-page">
      <section className="dashboard-heading goals-heading">
        <div>
          <p className="goals-kicker">
            PLANEJAMENTO DE OBJETIVOS
          </p>

          <h2>
            Metas
          </h2>

          <p>
            Transforme objetivos em
            progresso financeiro
            mensurável.
          </p>
        </div>

        <div className="goals-heading-actions">
          {!canManage && (
            <span className="goal-readonly-badge">
              Somente leitura
            </span>
          )}

          <button
            type="button"
            className="goal-primary-button"
            onClick={
              openCreateModal
            }
            disabled={!canManage}
          >
            <Plus size={18} />
            Nova meta
          </button>
        </div>
      </section>

      {success && (
        <div className="goal-success-message">
          <span>
            <CheckCircle2
              size={17}
            />
            {success}
          </span>

          <button
            type="button"
            onClick={() =>
              setSuccess('')
            }
            aria-label="Fechar mensagem"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {error && (
        <div className="error-message goal-page-error">
          {error}
        </div>
      )}

      <section className="goal-summary-grid">
        <article className="goal-summary-card">
          <span className="goal-summary-icon target">
            <Target size={20} />
          </span>

          <div>
            <span>
              Objetivo total
            </span>

            <strong>
              {formatCurrency(
                stats.target,
                'BRL',
              )}
            </strong>

            <small>
              {stats.count}{' '}
              {stats.count === 1
                ? 'meta cadastrada'
                : 'metas cadastradas'}
            </small>
          </div>
        </article>

        <article className="goal-summary-card">
          <span className="goal-summary-icon saved">
            <PiggyBank size={20} />
          </span>

          <div>
            <span>
              Acumulado
            </span>

            <strong>
              {formatCurrency(
                stats.current,
                'BRL',
              )}
            </strong>

            <small>
              Valor já reservado
            </small>
          </div>
        </article>

        <article className="goal-summary-card">
          <span className="goal-summary-icon remaining">
            <WalletCards
              size={20}
            />
          </span>

          <div>
            <span>
              Falta alcançar
            </span>

            <strong>
              {formatCurrency(
                stats.remaining,
                'BRL',
              )}
            </strong>

            <small>
              Para concluir todas
            </small>
          </div>
        </article>

        <article className="goal-summary-card">
          <span className="goal-summary-icon completed">
            <Trophy size={20} />
          </span>

          <div>
            <span>
              Concluídas
            </span>

            <strong>
              {stats.completed}
            </strong>

            <small>
              de {stats.count}{' '}
              {stats.count === 1
                ? 'objetivo'
                : 'objetivos'}
            </small>
          </div>
        </article>
      </section>

      <section className="panel goal-overview-panel">
        <div className="goal-overview-copy">
          <span className="goal-overview-icon">
            <TrendingUp
              size={20}
            />
          </span>

          <div>
            <span>
              Progresso geral
            </span>

            <strong>
              {formatCurrency(
                stats.current,
                'BRL',
              )}{' '}
              de{' '}
              {formatCurrency(
                stats.target,
                'BRL',
              )}
            </strong>
          </div>
        </div>

        <div className="goal-overview-progress">
          <div className="goal-overview-progress-heading">
            <span>
              Evolução consolidada
            </span>

            <strong>
              {stats.percentage.toLocaleString(
                'pt-BR',
                {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                },
              )}%
            </strong>
          </div>

          <div className="goal-overview-track">
            <span
              style={{
                width: `${Math.min(
                  Math.max(
                    stats.percentage,
                    0,
                  ),
                  100,
                )}%`,
              }}
            />
          </div>
        </div>
      </section>

      <section className="goal-toolbar">
        <div>
          <h3>
            Seus objetivos
          </h3>

          <p>
            Acompanhe prazo, valor e
            evolução de cada meta.
          </p>
        </div>

        <div className="goal-filter-tabs">
          <button
            type="button"
            className={
              filter === 'ALL'
                ? 'active'
                : undefined
            }
            onClick={() =>
              setFilter('ALL')
            }
          >
            Todas
          </button>

          <button
            type="button"
            className={
              filter === 'ACTIVE'
                ? 'active'
                : undefined
            }
            onClick={() =>
              setFilter('ACTIVE')
            }
          >
            Em andamento
          </button>

          <button
            type="button"
            className={
              filter === 'COMPLETED'
                ? 'active'
                : undefined
            }
            onClick={() =>
              setFilter(
                'COMPLETED',
              )
            }
          >
            Concluídas
          </button>
        </div>
      </section>

      {loading ? (
        <section className="panel goal-loading-state">
          <div className="goal-spinner" />

          <strong>
            Carregando metas
          </strong>

          <span>
            Calculando seu progresso...
          </span>
        </section>
      ) : filteredGoals.length === 0 ? (
        <section className="panel empty-state goal-empty-state">
          <span className="goal-empty-icon">
            <Target size={34} />
          </span>

          <strong>
            {goals.length === 0
              ? 'Nenhuma meta criada ainda'
              : 'Nenhuma meta neste filtro'}
          </strong>

          <span>
            {goals.length === 0
              ? 'Crie um objetivo financeiro e acompanhe sua evolução por aqui.'
              : 'Escolha outro filtro para visualizar suas metas.'}
          </span>

          {goals.length === 0 &&
            canManage && (
              <button
                type="button"
                className="goal-empty-button"
                onClick={
                  openCreateModal
                }
              >
                <Plus size={16} />
                Criar primeira meta
              </button>
            )}
        </section>
      ) : (
        <section className="goal-card-grid">
          {filteredGoals.map(
            (goal) => {
              const progress =
                progressByGoalId[
                  goal.id
                ];

              const currentAmount =
                toNumber(
                  goal.currentAmount,
                );

              const targetAmount =
                toNumber(
                  goal.targetAmount,
                );

              const remaining =
                progress
                  ? toNumber(
                      progress.remaining,
                    )
                  : Math.max(
                      0,
                      targetAmount -
                        currentAmount,
                    );

              const percentage =
                progress
                  ? toNumber(
                      progress.percentage,
                    )
                  : targetAmount > 0
                    ? (currentAmount /
                        targetAmount) *
                      100
                    : 0;

              const completed =
                progress?.completed ??
                currentAmount >=
                  targetAmount;

              const status =
                progress
                  ? getGoalVisualStatus(
                      progress,
                    )
                  : completed
                    ? 'completed'
                    : 'active';

              return (
                <article
                  className={`goal-card ${status}`}
                  key={goal.id}
                >
                  <div className="goal-card-header">
                    <span className={`goal-card-icon ${status}`}>
                      {completed ? (
                        <Trophy
                          size={21}
                        />
                      ) : (
                        <Flag
                          size={21}
                        />
                      )}
                    </span>

                    <div className="goal-card-title">
                      <span className={`goal-status-badge ${status}`}>
                        {getGoalStatusLabel(
                          status,
                        )}
                      </span>

                      <h3>
                        {goal.name}
                      </h3>
                    </div>

                    {canManage && (
                      <div className="goal-card-actions">
                        <button
                          type="button"
                          onClick={() =>
                            openEditModal(
                              goal,
                            )
                          }
                          title="Editar meta"
                          aria-label="Editar meta"
                        >
                          <Edit3
                            size={15}
                          />
                        </button>

                        <button
                          type="button"
                          className="danger"
                          onClick={() =>
                            setDeleteTarget(
                              goal,
                            )
                          }
                          title="Excluir meta"
                          aria-label="Excluir meta"
                        >
                          <Trash2
                            size={15}
                          />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="goal-money-grid">
                    <div>
                      <span>
                        Acumulado
                      </span>

                      <strong>
                        {formatCurrency(
                          currentAmount,
                          'BRL',
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Objetivo
                      </span>

                      <strong>
                        {formatCurrency(
                          targetAmount,
                          'BRL',
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Falta
                      </span>

                      <strong>
                        {formatCurrency(
                          remaining,
                          'BRL',
                        )}
                      </strong>
                    </div>
                  </div>

                  <div className="goal-card-progress">
                    <div>
                      <span>
                        Progresso
                      </span>

                      <strong>
                        {percentage.toLocaleString(
                          'pt-BR',
                          {
                            minimumFractionDigits:
                              1,
                            maximumFractionDigits:
                              1,
                          },
                        )}%
                      </strong>
                    </div>

                    <div className="goal-progress-track">
                      <span
                        className={status}
                        style={{
                          width: `${Math.min(
                            Math.max(
                              percentage,
                              0,
                            ),
                            100,
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="goal-deadline-row">
                    <span>
                      <CalendarDays
                        size={16}
                      />

                      <span>
                        {formatGoalDate(
                          goal.deadline,
                        )}
                      </span>
                    </span>

                    <strong>
                      {getDeadlineDetail(
                        goal,
                        completed,
                      )}
                    </strong>
                  </div>

                  {canManage && (
                    <button
                      type="button"
                      className="goal-progress-button"
                      onClick={() =>
                        openProgressModal(
                          goal,
                        )
                      }
                    >
                      <CircleDollarSign
                        size={16}
                      />
                      Atualizar progresso
                    </button>
                  )}
                </article>
              );
            },
          )}
        </section>
      )}

      {modalOpen && (
        <div className="goal-modal-backdrop">
          <section
            className="goal-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="goal-modal-title"
          >
            <div className="goal-modal-header">
              <div>
                <span className="goal-modal-kicker">
                  {editingGoal
                    ? 'EDITAR META'
                    : 'NOVA META'}
                </span>

                <h2 id="goal-modal-title">
                  {editingGoal
                    ? 'Editar objetivo'
                    : 'Planejar objetivo'}
                </h2>

                <p>
                  Defina o valor que
                  deseja alcançar e, se
                  quiser, uma data limite.
                </p>
              </div>

              <button
                type="button"
                className="goal-modal-close"
                onClick={
                  closeGoalModal
                }
                aria-label="Fechar"
              >
                <X size={20} />
              </button>
            </div>

            <form
              className="goal-form"
              onSubmit={
                handleGoalSubmit
              }
            >
              <label className="goal-form-field">
                <span>
                  Nome da meta
                </span>

                <input
                  type="text"
                  value={form.name}
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        name:
                          event.target
                            .value,
                      }),
                    )
                  }
                  placeholder="Ex.: Reserva de emergência"
                  minLength={2}
                  required
                />
              </label>

              <label className="goal-form-field">
                <span>
                  Valor objetivo
                </span>

                <div className="goal-money-input">
                  <span>
                    R$
                  </span>

                  <input
                    type="text"
                    inputMode="decimal"
                    value={
                      form.targetAmount
                    }
                    onChange={(event) =>
                      setForm(
                        (current) => ({
                          ...current,
                          targetAmount:
                            event.target
                              .value,
                        }),
                      )
                    }
                    placeholder="10.000,00"
                    required
                  />
                </div>
              </label>

              <label className="goal-form-field">
                <span>
                  Prazo
                  <small>
                    opcional
                  </small>
                </span>

                <input
                  type="date"
                  value={
                    form.deadline
                  }
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        deadline:
                          event.target
                            .value,
                      }),
                    )
                  }
                />
              </label>

              <div className="goal-form-preview">
                <span className="goal-form-preview-icon">
                  <Target size={18} />
                </span>

                <div>
                  <span>
                    Objetivo planejado
                  </span>

                  <strong>
                    {Number.isFinite(
                      parseBrazilianMoney(
                        form.targetAmount,
                      ),
                    ) &&
                    parseBrazilianMoney(
                      form.targetAmount,
                    ) > 0
                      ? formatCurrency(
                          parseBrazilianMoney(
                            form.targetAmount,
                          ),
                          'BRL',
                        )
                      : 'R$ 0,00'}
                  </strong>
                </div>
              </div>

              {formError && (
                <div className="error-message">
                  {formError}
                </div>
              )}

              <div className="goal-form-actions">
                <button
                  type="button"
                  className="goal-secondary-button"
                  onClick={
                    closeGoalModal
                  }
                  disabled={saving}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="goal-primary-button"
                  disabled={saving}
                >
                  {saving
                    ? 'Salvando...'
                    : editingGoal
                      ? 'Salvar alterações'
                      : 'Criar meta'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {progressTarget && (
        <div className="goal-modal-backdrop">
          <section
            className="goal-progress-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="goal-progress-modal-title"
          >
            <div className="goal-progress-modal-icon">
              <PiggyBank
                size={24}
              />
            </div>

            <span className="goal-modal-kicker">
              ATUALIZAR PROGRESSO
            </span>

            <h2 id="goal-progress-modal-title">
              {progressTarget.name}
            </h2>

            <p>
              Informe o valor total já
              acumulado para esta meta.
              Você pode aumentar ou
              corrigir o saldo atual.
            </p>

            <form
              onSubmit={
                handleProgressSubmit
              }
            >
              <label className="goal-form-field">
                <span>
                  Valor acumulado
                </span>

                <div className="goal-money-input">
                  <span>
                    R$
                  </span>

                  <input
                    type="text"
                    inputMode="decimal"
                    value={
                      progressAmount
                    }
                    onChange={(event) =>
                      setProgressAmount(
                        event.target.value,
                      )
                    }
                    placeholder="0,00"
                    autoFocus
                    required
                  />
                </div>
              </label>

              <div className="goal-progress-modal-reference">
                <span>
                  Objetivo
                </span>

                <strong>
                  {formatCurrency(
                    toNumber(
                      progressTarget.targetAmount,
                    ),
                    'BRL',
                  )}
                </strong>
              </div>

              {progressError && (
                <div className="error-message">
                  {progressError}
                </div>
              )}

              <div className="goal-form-actions">
                <button
                  type="button"
                  className="goal-secondary-button"
                  onClick={
                    closeProgressModal
                  }
                  disabled={
                    savingProgress
                  }
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="goal-primary-button"
                  disabled={
                    savingProgress
                  }
                >
                  {savingProgress
                    ? 'Atualizando...'
                    : 'Salvar progresso'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {deleteTarget && (
        <div className="goal-modal-backdrop">
          <section
            className="goal-confirm-modal"
            role="dialog"
            aria-modal="true"
          >
            <span className="goal-confirm-icon">
              <Trash2 size={23} />
            </span>

            <h2>
              Excluir meta?
            </h2>

            <p>
              A meta{' '}
              <strong>
                {deleteTarget.name}
              </strong>{' '}
              será removida. Essa ação
              não altera contas ou
              transações financeiras.
            </p>

            <div className="goal-confirm-actions">
              <button
                type="button"
                className="goal-secondary-button"
                onClick={() =>
                  setDeleteTarget(null)
                }
                disabled={deleting}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="goal-danger-button"
                onClick={() =>
                  void confirmDelete()
                }
                disabled={deleting}
              >
                {deleting
                  ? 'Excluindo...'
                  : 'Excluir meta'}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default GoalsPage;
