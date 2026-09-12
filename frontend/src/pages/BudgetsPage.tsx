import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Gauge,
  Pencil,
  PiggyBank,
  Plus,
  Trash2,
  TrendingUp,
  Wallet,
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
  createBudget,
  createCategory,
  deleteBudget,
  getBudgetProgress,
  getBudgets,
  getCategories,
  updateBudget,
} from '../lib/api';

import {
  formatCurrency,
  toNumber,
} from '../lib/format';

import {
  useAppShell,
} from '../hooks/useAppShell';

import type {
  Budget,
  BudgetProgress,
  BudgetStatus,
  Category,
} from '../types/api';

import './BudgetsPage.css';

const MONTHS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

interface BudgetFormState {
  categoryId: string;
  amount: string;
  month: string;
  year: string;
}

function getCurrentPeriod() {
  const now = new Date();

  return {
    month:
      now.getMonth() + 1,

    year:
      now.getFullYear(),
  };
}

function createBudgetForm(
  month: number,
  year: number,
  categoryId = '',
): BudgetFormState {
  return {
    categoryId,
    amount: '',
    month: String(month),
    year: String(year),
  };
}

function parseMoneyInput(
  value: string,
): number {
  const cleaned = value
    .trim()
    .replace(/\s/g, '')
    .replace(/^R\$/i, '')
    .replace(/[^0-9,.-]/g, '');

  if (!cleaned) {
    return 0;
  }

  if (cleaned.includes(',')) {
    const commaIndex =
      cleaned.lastIndexOf(',');

    const integerPart = cleaned
      .slice(0, commaIndex)
      .replace(/[.,]/g, '');

    const decimalPart = cleaned
      .slice(commaIndex + 1)
      .replace(/[.,]/g, '');

    return Number(
      `${integerPart || '0'}.${decimalPart}`,
    );
  }

  if (
    /^-?\d{1,3}(\.\d{3})+$/.test(
      cleaned,
    )
  ) {
    return Number(
      cleaned.replace(/\./g, ''),
    );
  }

  return Number(cleaned);
}

function formatMoneyInput(
  value: number,
): string {
  return new Intl.NumberFormat(
    'pt-BR',
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  ).format(value);
}

function getStatusCopy(
  status: BudgetStatus,
) {
  if (status === 'EXCEEDED') {
    return {
      label: 'Excedido',
      description:
        'O limite planejado foi ultrapassado.',
      icon: AlertTriangle,
    };
  }

  if (status === 'WARNING') {
    return {
      label: 'Atenção',
      description:
        'O orçamento já está próximo do limite.',
      icon: TrendingUp,
    };
  }

  return {
    label: 'Dentro do orçamento',
    description:
      'Os gastos seguem dentro do planejado.',
    icon: CheckCircle2,
  };
}

function BudgetsPage() {
  const {
    token,
    workspace,
    onLogout,
  } = useAppShell();

  const initialPeriod =
    useMemo(
      () =>
        getCurrentPeriod(),
      [],
    );

  const [
    selectedMonth,
    setSelectedMonth,
  ] = useState(
    initialPeriod.month,
  );

  const [
    selectedYear,
    setSelectedYear,
  ] = useState(
    initialPeriod.year,
  );

  const [
    categories,
    setCategories,
  ] = useState<Category[]>(
    [],
  );

  const [
    budgets,
    setBudgets,
  ] = useState<Budget[]>(
    [],
  );

  const [
    progresses,
    setProgresses,
  ] = useState<
    BudgetProgress[]
  >([]);

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
    modalOpen,
    setModalOpen,
  ] = useState(false);

  const [
    editingBudget,
    setEditingBudget,
  ] = useState<
    Budget | null
  >(null);

  const [
    form,
    setForm,
  ] =
    useState<BudgetFormState>(
      () =>
        createBudgetForm(
          initialPeriod.month,
          initialPeriod.year,
        ),
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
    creatingCategory,
    setCreatingCategory,
  ] = useState(false);

  const [
    newCategoryName,
    setNewCategoryName,
  ] = useState('');

  const [
    categoryError,
    setCategoryError,
  ] = useState('');

  const [
    savingCategory,
    setSavingCategory,
  ] = useState(false);

  const [
    deleteTarget,
    setDeleteTarget,
  ] = useState<
    Budget | null
  >(null);

  const [
    deleting,
    setDeleting,
  ] = useState(false);

  const canManage =
    workspace.role === 'OWNER' ||
    workspace.role === 'ADMIN' ||
    workspace.role === 'FINANCE';

  const handleUnauthorized =
    useCallback(
      (
        caughtError:
          unknown,
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

        return false;
      },
      [onLogout],
    );

  const loadPeriodData =
    useCallback(
      async (
        month: number,
        year: number,
        showLoading = true,
      ) => {
        if (showLoading) {
          setLoading(true);
        }

        setError('');

        try {
          const [
            expenseCategories,
            periodBudgets,
          ] =
            await Promise.all([
              getCategories(
                token,
                workspace.id,
                'EXPENSE',
              ),

              getBudgets(
                token,
                workspace.id,
                {
                  month,
                  year,
                },
              ),
            ]);

          const progressData =
            await Promise.all(
              periodBudgets.map(
                (
                  budget,
                ) =>
                  getBudgetProgress(
                    token,
                    workspace.id,
                    budget.id,
                  ),
              ),
            );

          setCategories(
            expenseCategories,
          );

          setBudgets(
            periodBudgets,
          );

          setProgresses(
            progressData,
          );
        } catch (caughtError) {
          if (
            handleUnauthorized(
              caughtError,
            )
          ) {
            return;
          }

          setError(
            caughtError instanceof
              Error
              ? caughtError.message
              : 'Não foi possível carregar os orçamentos.',
          );
        } finally {
          if (showLoading) {
            setLoading(false);
          }
        }
      },
      [
        token,
        workspace.id,
        handleUnauthorized,
      ],
    );

  useEffect(() => {
    const timeoutId =
      window.setTimeout(
        () => {
          void loadPeriodData(
            selectedMonth,
            selectedYear,
          );
        },
        0,
      );

    return () => {
      window.clearTimeout(
        timeoutId,
      );
    };
  }, [
    selectedMonth,
    selectedYear,
    loadPeriodData,
  ]);

  const sortedProgresses =
    useMemo(() => {
      const severity: Record<
        BudgetStatus,
        number
      > = {
        EXCEEDED: 3,
        WARNING: 2,
        ON_TRACK: 1,
      };

      return [
        ...progresses,
      ].sort(
        (
          first,
          second,
        ) => {
          const statusDifference =
            severity[
              second.status
            ] -
            severity[
              first.status
            ];

          if (
            statusDifference !==
            0
          ) {
            return statusDifference;
          }

          return (
            toNumber(
              second.percentage,
            ) -
            toNumber(
              first.percentage,
            )
          );
        },
      );
    }, [progresses]);

  const totals =
    useMemo(() => {
      const planned =
        progresses.reduce(
          (
            total,
            item,
          ) =>
            total +
            toNumber(
              item.budget
                .amount,
            ),
          0,
        );

      const spent =
        progresses.reduce(
          (
            total,
            item,
          ) =>
            total +
            toNumber(
              item.spent,
            ),
          0,
        );

      const remaining =
        planned - spent;

      const percentage =
        planned > 0
          ? (spent /
              planned) *
            100
          : 0;

      return {
        planned,
        spent,
        remaining,
        percentage,
      };
    }, [progresses]);

  const warningCount =
    useMemo(
      () =>
        progresses.filter(
          (item) =>
            item.status ===
              'WARNING',
        ).length,
      [progresses],
    );

  const exceededCount =
    useMemo(
      () =>
        progresses.filter(
          (item) =>
            item.status ===
              'EXCEEDED',
        ).length,
      [progresses],
    );

  const usedCategoryIds =
    useMemo(
      () =>
        new Set(
          budgets.map(
            (budget) =>
              budget.categoryId,
          ),
        ),
      [budgets],
    );

  const availableCategories =
    useMemo(
      () =>
        categories.filter(
          (category) =>
            !usedCategoryIds.has(
              category.id,
            ) ||
            editingBudget
              ?.categoryId ===
              category.id,
        ),
      [
        categories,
        usedCategoryIds,
        editingBudget,
      ],
    );

  const yearOptions =
    useMemo(() => {
      const currentYear =
        new Date().getFullYear();

      const years:
        number[] = [];

      for (
        let year = 2000;
        year <=
        currentYear + 10;
        year++
      ) {
        years.push(year);
      }

      return years.reverse();
    }, []);

  const periodLabel =
    `${MONTHS[
      selectedMonth - 1
    ]} de ${selectedYear}`;

  function clearMessages() {
    setError('');
    setSuccess('');
  }

  function goToPreviousMonth() {
    clearMessages();

    if (
      selectedMonth === 1
    ) {
      setSelectedMonth(12);

      setSelectedYear(
        (
          current,
        ) =>
          current - 1,
      );

      return;
    }

    setSelectedMonth(
      (
        current,
      ) =>
        current - 1,
    );
  }

  function goToNextMonth() {
    clearMessages();

    if (
      selectedMonth === 12
    ) {
      setSelectedMonth(1);

      setSelectedYear(
        (
          current,
        ) =>
          current + 1,
      );

      return;
    }

    setSelectedMonth(
      (
        current,
      ) =>
        current + 1,
    );
  }

  function goToCurrentMonth() {
    const current =
      getCurrentPeriod();

    clearMessages();

    setSelectedMonth(
      current.month,
    );

    setSelectedYear(
      current.year,
    );
  }

  function openCreateModal() {
    if (!canManage) {
      return;
    }

    const firstCategory =
      availableCategories[0];

    setEditingBudget(null);

    setForm(
      createBudgetForm(
        selectedMonth,
        selectedYear,
        firstCategory?.id ??
          '',
      ),
    );

    setFormError('');
    setCreatingCategory(
      availableCategories.length === 0,
    );
    setNewCategoryName('');
    setCategoryError('');
    setModalOpen(true);
  }

  function openEditModal(
    budget: Budget,
  ) {
    if (!canManage) {
      return;
    }

    setEditingBudget(
      budget,
    );

    setForm({
      categoryId:
        budget.categoryId,

      amount:
        formatMoneyInput(
          toNumber(
            budget.amount,
          ),
        ),

      month:
        String(
          budget.month,
        ),

      year:
        String(
          budget.year,
        ),
    });

    setFormError('');
    setCreatingCategory(false);
    setNewCategoryName('');
    setCategoryError('');
    setModalOpen(true);
  }

  function closeModal() {
    if (
      saving ||
      savingCategory
    ) {
      return;
    }

    setModalOpen(false);
    setEditingBudget(null);
    setFormError('');
    setCreatingCategory(false);
    setNewCategoryName('');
    setCategoryError('');
  }

  async function handleCreateCategory() {
    if (
      !canManage ||
      savingCategory
    ) {
      return;
    }

    const name =
      newCategoryName.trim();

    if (name.length < 2) {
      setCategoryError(
        'Digite um nome com pelo menos 2 caracteres.',
      );

      return;
    }

    setCategoryError('');
    setFormError('');
    setSavingCategory(true);

    try {
      const category =
        await createCategory(
          token,
          workspace.id,
          {
            name,
            type: 'EXPENSE',
          },
        );

      setCategories(
        (current) =>
          [
            ...current.filter(
              (item) =>
                item.id !==
                category.id,
            ),
            category,
          ].sort((first, second) =>
            first.name.localeCompare(
              second.name,
              'pt-BR',
            ),
          ),
      );

      setForm((current) => ({
        ...current,
        categoryId: category.id,
      }));

      setNewCategoryName('');
      setCreatingCategory(false);
    } catch (caughtError) {
      if (
        handleUnauthorized(
          caughtError,
        )
      ) {
        return;
      }

      setCategoryError(
        caughtError instanceof
          Error
          ? caughtError.message
          : 'Não foi possível criar a categoria.',
      );
    } finally {
      setSavingCategory(false);
    }
  }

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setFormError('');
    clearMessages();

    const categoryId =
      form.categoryId.trim();

    const amount =
      parseMoneyInput(
        form.amount,
      );

    const month =
      Number(
        form.month,
      );

    const year =
      Number(
        form.year,
      );

    if (!categoryId) {
      setFormError(
        'Selecione uma categoria de despesa.',
      );

      return;
    }

    if (
      !Number.isFinite(
        amount,
      ) ||
      amount <= 0
    ) {
      setFormError(
        'Informe um valor maior que zero.',
      );

      return;
    }

    if (
      !Number.isInteger(
        month,
      ) ||
      month < 1 ||
      month > 12
    ) {
      setFormError(
        'Selecione um mês válido.',
      );

      return;
    }

    if (
      !Number.isInteger(
        year,
      ) ||
      year < 2000
    ) {
      setFormError(
        'Selecione um ano válido.',
      );

      return;
    }

    setSaving(true);

    try {
      if (editingBudget) {
        await updateBudget(
          token,
          workspace.id,
          editingBudget.id,
          {
            categoryId,
            amount,
            month,
            year,
          },
        );

        setSuccess(
          'Orçamento atualizado com sucesso.',
        );
      } else {
        await createBudget(
          token,
          workspace.id,
          {
            categoryId,
            amount,
            month,
            year,
          },
        );

        setSuccess(
          'Orçamento criado com sucesso.',
        );
      }

      setModalOpen(false);
      setEditingBudget(null);

      if (
        month !==
          selectedMonth ||
        year !==
          selectedYear
      ) {
        setSelectedMonth(
          month,
        );

        setSelectedYear(
          year,
        );
      } else {
        await loadPeriodData(
          selectedMonth,
          selectedYear,
          false,
        );
      }
    } catch (caughtError) {
      if (
        handleUnauthorized(
          caughtError,
        )
      ) {
        return;
      }

      setFormError(
        caughtError instanceof
          Error
          ? caughtError.message
          : 'Não foi possível salvar o orçamento.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) {
      return;
    }

    setDeleting(true);
    clearMessages();

    try {
      await deleteBudget(
        token,
        workspace.id,
        deleteTarget.id,
      );

      setDeleteTarget(
        null,
      );

      setSuccess(
        'Orçamento excluído com sucesso.',
      );

      await loadPeriodData(
        selectedMonth,
        selectedYear,
        false,
      );
    } catch (caughtError) {
      if (
        handleUnauthorized(
          caughtError,
        )
      ) {
        return;
      }

      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : 'Não foi possível excluir o orçamento.',
      );
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <main className="dashboard-content budgets-page">
        <section className="panel budget-loading">
          <div className="budget-spinner" />

          <strong>
            Carregando orçamentos
          </strong>

          <span>
            Analisando limites,
            gastos e categorias...
          </span>
        </section>
      </main>
    );
  }

  return (
    <main className="dashboard-content budgets-page">
      <section className="dashboard-heading budgets-heading">
        <div>
          <h2>
            Orçamentos
          </h2>

          <p>
            Planeje seus gastos por
            categoria e acompanhe o
            consumo do mês.
          </p>
        </div>

        <div className="budgets-heading-actions">
          {!canManage && (
            <span className="readonly-badge">
              Somente leitura
            </span>
          )}

          <button
            type="button"
            className="budget-primary-button"
            onClick={
              openCreateModal
            }
            disabled={!canManage}
          >
            <Plus size={18} />
            Novo orçamento
          </button>
        </div>
      </section>

      {success && (
        <div className="budget-success-message">
          <CheckCircle2
            size={18}
          />

          <span>
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
        <div className="error-message budget-page-error">
          {error}
        </div>
      )}

      <section className="panel budget-period-panel">
        <div className="budget-period-navigation">
          <button
            type="button"
            className="budget-period-arrow"
            onClick={
              goToPreviousMonth
            }
            aria-label="Mês anterior"
          >
            <ChevronLeft
              size={19}
            />
          </button>

          <div className="budget-period-title">
            <span>
              <CalendarDays
                size={17}
              />
              Período selecionado
            </span>

            <strong>
              {periodLabel}
            </strong>
          </div>

          <button
            type="button"
            className="budget-period-arrow"
            onClick={
              goToNextMonth
            }
            aria-label="Próximo mês"
          >
            <ChevronRight
              size={19}
            />
          </button>
        </div>

        <div className="budget-period-controls">
          <label>
            <span>
              Mês
            </span>

            <select
              value={
                selectedMonth
              }
              onChange={(
                event,
              ) => {
                clearMessages();

                setSelectedMonth(
                  Number(
                    event.target
                      .value,
                  ),
                );
              }}
            >
              {MONTHS.map(
                (
                  month,
                  index,
                ) => (
                  <option
                    key={
                      month
                    }
                    value={
                      index + 1
                    }
                  >
                    {month}
                  </option>
                ),
              )}
            </select>
          </label>

          <label>
            <span>
              Ano
            </span>

            <select
              value={
                selectedYear
              }
              onChange={(
                event,
              ) => {
                clearMessages();

                setSelectedYear(
                  Number(
                    event.target
                      .value,
                  ),
                );
              }}
            >
              {yearOptions.map(
                (year) => (
                  <option
                    key={
                      year
                    }
                    value={
                      year
                    }
                  >
                    {year}
                  </option>
                ),
              )}
            </select>
          </label>

          <button
            type="button"
            className="budget-current-period-button"
            onClick={
              goToCurrentMonth
            }
          >
            Mês atual
          </button>
        </div>
      </section>

      <section className="budget-summary-grid">
        <article className="budget-summary-card">
          <span className="budget-summary-icon planned">
            <PiggyBank
              size={21}
            />
          </span>

          <div>
            <span>
              Total planejado
            </span>

            <strong>
              {formatCurrency(
                totals.planned,
                'BRL',
              )}
            </strong>

            <small>
              {
                progresses.length
              }{' '}
              {progresses.length ===
              1
                ? 'categoria'
                : 'categorias'}
            </small>
          </div>
        </article>

        <article className="budget-summary-card">
          <span className="budget-summary-icon spent">
            <CircleDollarSign
              size={21}
            />
          </span>

          <div>
            <span>
              Total gasto
            </span>

            <strong>
              {formatCurrency(
                totals.spent,
                'BRL',
              )}
            </strong>

            <small>
              {totals.percentage.toFixed(
                1,
              )}
              % do planejado
            </small>
          </div>
        </article>

        <article className="budget-summary-card">
          <span className="budget-summary-icon remaining">
            <Wallet
              size={21}
            />
          </span>

          <div>
            <span>
              Saldo do período
            </span>

            <strong
              className={
                totals.remaining <
                0
                  ? 'negative'
                  : undefined
              }
            >
              {formatCurrency(
                totals.remaining,
                'BRL',
              )}
            </strong>

            <small>
              Planejado menos gasto
            </small>
          </div>
        </article>

        <article className="budget-summary-card">
          <span className="budget-summary-icon health">
            <Gauge
              size={21}
            />
          </span>

          <div>
            <span>
              Saúde do orçamento
            </span>

            <strong>
              {exceededCount >
              0
                ? `${exceededCount} excedido${exceededCount === 1 ? '' : 's'}`
                : warningCount >
                    0
                  ? `${warningCount} em atenção`
                  : progresses.length >
                      0
                    ? 'Tudo sob controle'
                    : 'Sem dados'}
            </strong>

            <small>
              Acompanhamento do mês
            </small>
          </div>
        </article>
      </section>

      {progresses.length >
      0 ? (
        <section className="panel budget-overall-panel">
          <div className="budget-overall-header">
            <div>
              <span>
                Visão geral do mês
              </span>

              <strong>
                {formatCurrency(
                  totals.spent,
                  'BRL',
                )}{' '}
                de{' '}
                {formatCurrency(
                  totals.planned,
                  'BRL',
                )}
              </strong>
            </div>

            <span className="budget-overall-percentage">
              {totals.percentage.toFixed(
                1,
              )}
              %
            </span>
          </div>

          <div className="budget-overall-track">
            <span
              className={
                totals.percentage >=
                100
                  ? 'exceeded'
                  : totals.percentage >=
                      80
                    ? 'warning'
                    : 'on-track'
              }
              style={{
                width:
                  `${Math.min(
                    Math.max(
                      totals.percentage,
                      0,
                    ),
                    100,
                  )}%`,
              }}
            />
          </div>

          <div className="budget-overall-footer">
            <span>
              <CheckCircle2
                size={15}
              />
              {
                progresses.filter(
                  (item) =>
                    item.status ===
                      'ON_TRACK',
                ).length
              }{' '}
              dentro do limite
            </span>

            <span>
              <TrendingUp
                size={15}
              />
              {warningCount}{' '}
              em atenção
            </span>

            <span>
              <AlertTriangle
                size={15}
              />
              {exceededCount}{' '}
              excedido
            </span>
          </div>
        </section>
      ) : null}

      <section className="panel budget-list-panel">
        <div className="panel-header budget-list-header">
          <div>
            <h3>
              Orçamentos por categoria
            </h3>

            <p>
              Acompanhe quanto já foi
              consumido em cada limite.
            </p>
          </div>

          <span className="budget-period-badge">
            {periodLabel}
          </span>
        </div>

        {sortedProgresses.length ===
        0 ? (
          <div className="budget-empty-state">
            <span className="budget-empty-icon">
              <PiggyBank
                size={32}
              />
            </span>

            <strong>
              Nenhum orçamento neste mês
            </strong>

            <p>
              Crie limites por categoria
              para planejar melhor seus
              gastos em{' '}
              {periodLabel.toLowerCase()}.
            </p>

            {canManage && (
              <button
                type="button"
                className="budget-primary-button"
                onClick={
                  openCreateModal
                }
              >
                <Plus
                  size={17}
                />
                Criar orçamento
              </button>
            )}

            {categories.length ===
              0 && (
              <span className="budget-empty-hint">
                Você pode criar uma
                categoria de despesa
                durante o cadastro do
                orçamento.
              </span>
            )}
          </div>
        ) : (
          <div className="budget-card-grid">
            {sortedProgresses.map(
              (progress) => {
                const status =
                  getStatusCopy(
                    progress.status,
                  );

                const StatusIcon =
                  status.icon;

                const spent =
                  toNumber(
                    progress.spent,
                  );

                const planned =
                  toNumber(
                    progress.budget
                      .amount,
                  );

                const remaining =
                  toNumber(
                    progress.remaining,
                  );

                const percentage =
                  toNumber(
                    progress.percentage,
                  );

                return (
                  <article
                    className={`budget-category-card ${progress.status.toLowerCase()}`}
                    key={
                      progress.budget
                        .id
                    }
                  >
                    <div className="budget-category-top">
                      <div className="budget-category-identity">
                        <span className="budget-category-icon">
                          <Wallet
                            size={19}
                          />
                        </span>

                        <div>
                          <span>
                            Categoria
                          </span>

                          <strong>
                            {
                              progress
                                .budget
                                .category
                                .name
                            }
                          </strong>
                        </div>
                      </div>

                      <span
                        className={`budget-status-badge ${progress.status.toLowerCase()}`}
                      >
                        <StatusIcon
                          size={14}
                        />

                        {
                          status.label
                        }
                      </span>
                    </div>

                    <div className="budget-category-values">
                      <div>
                        <span>
                          Planejado
                        </span>

                        <strong>
                          {formatCurrency(
                            planned,
                            'BRL',
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Gasto
                        </span>

                        <strong>
                          {formatCurrency(
                            spent,
                            'BRL',
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Saldo
                        </span>

                        <strong
                          className={
                            remaining <
                            0
                              ? 'negative'
                              : undefined
                          }
                        >
                          {formatCurrency(
                            remaining,
                            'BRL',
                          )}
                        </strong>
                      </div>
                    </div>

                    <div className="budget-progress-area">
                      <div className="budget-progress-copy">
                        <span>
                          Consumo do limite
                        </span>

                        <strong>
                          {percentage.toFixed(
                            1,
                          )}
                          %
                        </strong>
                      </div>

                      <div className="budget-progress-track">
                        <span
                          className={
                            progress.status.toLowerCase()
                          }
                          style={{
                            width:
                              `${Math.min(
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

                    <div className="budget-status-copy">
                      <StatusIcon
                        size={16}
                      />

                      <span>
                        {
                          status.description
                        }
                      </span>
                    </div>

                    {canManage && (
                      <div className="budget-card-actions">
                        <button
                          type="button"
                          onClick={() =>
                            openEditModal(
                              progress.budget,
                            )
                          }
                        >
                          <Pencil
                            size={15}
                          />
                          Editar
                        </button>

                        <button
                          type="button"
                          className="danger"
                          onClick={() =>
                            setDeleteTarget(
                              progress.budget,
                            )
                          }
                        >
                          <Trash2
                            size={15}
                          />
                          Excluir
                        </button>
                      </div>
                    )}
                  </article>
                );
              },
            )}
          </div>
        )}
      </section>

      {modalOpen && (
        <div className="budget-modal-backdrop">
          <section
            className="budget-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="budget-modal-title"
          >
            <div className="budget-modal-header">
              <div>
                <span>
                  {editingBudget
                    ? 'EDITAR ORÇAMENTO'
                    : 'NOVO ORÇAMENTO'}
                </span>

                <h2 id="budget-modal-title">
                  {editingBudget
                    ? 'Editar limite mensal'
                    : 'Planejar categoria'}
                </h2>

                <p>
                  Defina quanto você
                  pretende gastar em uma
                  categoria durante o
                  período.
                </p>
              </div>

              <button
                type="button"
                className="budget-modal-close"
                onClick={
                  closeModal
                }
                aria-label="Fechar"
              >
                <X size={20} />
              </button>
            </div>

            <form
              className="budget-form"
              onSubmit={
                handleSubmit
              }
            >
              <label className="budget-form-field">
                <span>
                  Categoria de despesa
                </span>

                <select
                  value={
                    form.categoryId
                  }
                  onChange={(
                    event,
                  ) => {
                    setForm((current) => ({
                      ...current,
                      categoryId:
                        event.target.value,
                    }));

                    setFormError('');
                    setCategoryError('');
                  }}
                  required
                >
                  <option value="">
                    Selecione uma categoria
                  </option>

                  {availableCategories.map(
                    (
                      category,
                    ) => (
                      <option
                        key={
                          category.id
                        }
                        value={
                          category.id
                        }
                      >
                        {
                          category.name
                        }
                      </option>
                    ),
                  )}
                </select>
              </label>

              <div className="budget-form-actions">
                <button
                  type="button"
                  className="budget-secondary-button"
                  onClick={() => {
                    setCreatingCategory(
                      (current) =>
                        !current,
                    );

                    setNewCategoryName('');
                    setCategoryError('');
                  }}
                  disabled={
                    saving ||
                    savingCategory
                  }
                >
                  <Plus size={15} />
                  {creatingCategory
                    ? 'Cancelar nova categoria'
                    : 'Criar nova categoria'}
                </button>
              </div>

              {creatingCategory && (
                <>
                  <label className="budget-form-field">
                    <span>
                      Nome da nova categoria
                    </span>

                    <input
                      type="text"
                      value={
                        newCategoryName
                      }
                      onChange={(event) => {
                        setNewCategoryName(
                          event.target.value,
                        );

                        setCategoryError('');
                      }}
                      placeholder="Ex.: Alimentação"
                      maxLength={80}
                      autoFocus
                      disabled={
                        savingCategory
                      }
                    />
                  </label>

                  {categoryError && (
                    <div className="error-message">
                      {categoryError}
                    </div>
                  )}

                  <div className="budget-form-actions">
                    <button
                      type="button"
                      className="budget-primary-button"
                      onClick={() =>
                        void handleCreateCategory()
                      }
                      disabled={
                        savingCategory ||
                        newCategoryName.trim()
                          .length < 2
                      }
                    >
                      {savingCategory
                        ? 'Criando categoria...'
                        : 'Criar e selecionar'}
                    </button>
                  </div>
                </>
              )}

              <label className="budget-form-field">
                <span>
                  Limite planejado
                </span>

                <div className="budget-money-input">
                  <span>
                    R$
                  </span>

                  <input
                    type="text"
                    inputMode="decimal"
                    value={
                      form.amount
                    }
                    onChange={(
                      event,
                    ) =>
                      setForm(
                        (
                          current,
                        ) => ({
                          ...current,
                          amount:
                            event.target
                              .value,
                        }),
                      )
                    }
                    placeholder="1500,00"
                    required
                  />
                </div>
              </label>

              <div className="budget-form-grid">
                <label className="budget-form-field">
                  <span>
                    Mês
                  </span>

                  <select
                    value={
                      form.month
                    }
                    onChange={(
                      event,
                    ) =>
                      setForm(
                        (
                          current,
                        ) => ({
                          ...current,
                          month:
                            event.target
                              .value,
                        }),
                      )
                    }
                  >
                    {MONTHS.map(
                      (
                        month,
                        index,
                      ) => (
                        <option
                          key={
                            month
                          }
                          value={
                            index + 1
                          }
                        >
                          {month}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label className="budget-form-field">
                  <span>
                    Ano
                  </span>

                  <select
                    value={
                      form.year
                    }
                    onChange={(
                      event,
                    ) =>
                      setForm(
                        (
                          current,
                        ) => ({
                          ...current,
                          year:
                            event.target
                              .value,
                        }),
                      )
                    }
                  >
                    {yearOptions.map(
                      (
                        year,
                      ) => (
                        <option
                          key={
                            year
                          }
                          value={
                            year
                          }
                        >
                          {year}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              </div>

              <div className="budget-form-preview">
                <span className="budget-form-preview-icon">
                  <PiggyBank
                    size={22}
                  />
                </span>

                <div>
                  <span>
                    Orçamento planejado
                  </span>

                  <strong>
                    {parseMoneyInput(
                      form.amount,
                    ) > 0
                      ? formatCurrency(
                          parseMoneyInput(
                            form.amount,
                          ),
                          'BRL',
                        )
                      : 'R$ 0,00'}
                  </strong>

                  <small>
                    {
                      MONTHS[
                        Number(
                          form.month,
                        ) - 1
                      ]
                    }{' '}
                    de {form.year}
                  </small>
                </div>
              </div>

              {formError && (
                <div className="error-message">
                  {formError}
                </div>
              )}

              <div className="budget-form-actions">
                <button
                  type="button"
                  className="budget-secondary-button"
                  onClick={
                    closeModal
                  }
                  disabled={
                    saving ||
                    savingCategory
                  }
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="budget-primary-button"
                  disabled={
                    saving ||
                    savingCategory ||
                    !form.categoryId
                  }
                >
                  {saving
                    ? 'Salvando...'
                    : editingBudget
                      ? 'Salvar alterações'
                      : 'Criar orçamento'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {deleteTarget && (
        <div className="budget-modal-backdrop">
          <section className="budget-confirm-modal">
            <span className="budget-confirm-icon danger">
              <Trash2
                size={23}
              />
            </span>

            <h2>
              Excluir orçamento?
            </h2>

            <p>
              O orçamento de{' '}
              <strong>
                {
                  deleteTarget
                    .category.name
                }
              </strong>{' '}
              será removido de{' '}
              {MONTHS[
                deleteTarget.month -
                  1
              ].toLowerCase()}{' '}
              de{' '}
              {deleteTarget.year}.
            </p>

            <div className="budget-confirm-warning">
              <AlertTriangle
                size={17}
              />

              <span>
                As transações da
                categoria não serão
                apagadas.
              </span>
            </div>

            <div className="budget-confirm-actions">
              <button
                type="button"
                className="budget-secondary-button"
                onClick={() =>
                  setDeleteTarget(
                    null,
                  )
                }
                disabled={
                  deleting
                }
              >
                Cancelar
              </button>

              <button
                type="button"
                className="budget-danger-button"
                onClick={() =>
                  void confirmDelete()
                }
                disabled={
                  deleting
                }
              >
                {deleting
                  ? 'Excluindo...'
                  : 'Excluir orçamento'}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default BudgetsPage;