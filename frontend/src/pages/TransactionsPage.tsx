import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  Ban,
  CircleDollarSign,
  Edit3,
  Filter,
  Plus,
  ReceiptText,
  Search,
  SlidersHorizontal,
  Wallet,
  X,
} from 'lucide-react';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ApiError,
  createTransaction,
  getAccounts,
  getCategories,
  getTransactions,
  updateTransaction,
  voidTransaction,
} from '../lib/api';

import {
  formatCurrency,
  toNumber,
} from '../lib/format';

import {
  useAppShell,
} from '../hooks/useAppShell';

import type {
  Account,
  Category,
  EditableTransactionType,
  FinancialTransaction,
} from '../types/api';

import './TransactionsPage.css';

type TypeFilter =
  | 'ALL'
  | 'INCOME'
  | 'EXPENSE'
  | 'OTHER';

interface TransactionFormState {
  type: EditableTransactionType;
  description: string;
  amount: string;
  accountId: string;
  categoryId: string;
  transactionDate: string;
}

function getTodayInputValue() {
  const date =
    new Date();

  const timezoneOffset =
    date.getTimezoneOffset() *
    60 *
    1000;

  return new Date(
    date.getTime() -
      timezoneOffset,
  )
    .toISOString()
    .slice(0, 10);
}

function createEmptyForm():
  TransactionFormState {
  return {
    type: 'EXPENSE',
    description: '',
    amount: '',
    accountId: '',
    categoryId: '',
    transactionDate:
      getTodayInputValue(),
  };
}

function getTransactionAmount(
  transaction:
    FinancialTransaction,
) {
  const entry =
    transaction.entries[0];

  if (!entry) {
    return 0;
  }

  return toNumber(
    entry.amount,
  );
}

function getTransactionCurrency(
  transaction:
    FinancialTransaction,
) {
  return (
    transaction.entries[0]
      ?.account.currency ??
    'BRL'
  );
}

function getAccountNames(
  transaction:
    FinancialTransaction,
) {
  const names = [
    ...new Set(
      transaction.entries.map(
        (entry) =>
          entry.account.name,
      ),
    ),
  ];

  return names.length > 0
    ? names.join(' • ')
    : 'Sem conta';
}

function getTypeLabel(
  type: string,
) {
  if (type === 'INCOME') {
    return 'Receita';
  }

  if (type === 'EXPENSE') {
    return 'Despesa';
  }

  if (type === 'TRANSFER') {
    return 'Transferência';
  }

  if (type === 'ADJUSTMENT') {
    return 'Ajuste';
  }

  if (
    type === 'CREDIT_CARD_PAYMENT'
  ) {
    return 'Pagamento de cartão';
  }

  if (
    type === 'CREDIT_CARD_PURCHASE'
  ) {
    return 'Compra no cartão';
  }

  if (type === 'REFUND') {
    return 'Reembolso';
  }

  return type
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(
      /^\w/,
      (letter) =>
        letter.toUpperCase(),
    );
}

function getTransactionTone(
  type: string,
) {
  if (type === 'INCOME') {
    return 'income';
  }

  if (type === 'EXPENSE') {
    return 'expense';
  }

  if (type === 'TRANSFER') {
    return 'transfer';
  }

  if (type === 'ADJUSTMENT') {
    return 'adjustment';
  }

  return 'neutral';
}

function parseMoneyInput(
  value: string,
) {
  const sanitized = value
    .trim()
    .replace(/R\$/gi, '')
    .replace(/\s/g, '')
    .replace(/[^\d,.-]/g, '');

  if (!sanitized) {
    return Number.NaN;
  }

  const normalized =
    sanitized.includes(',')
      ? sanitized
          .replace(/\./g, '')
          .replace(',', '.')
      : sanitized;

  return Number(normalized);
}

function getDateKey(
  transactionDate: string,
) {
  return transactionDate.slice(
    0,
    10,
  );
}

function getDateGroupLabel(
  dateKey: string,
) {
  const today =
    getTodayInputValue();

  const todayDate =
    new Date(`${today}T12:00:00`);

  const yesterdayDate =
    new Date(todayDate);

  yesterdayDate.setDate(
    yesterdayDate.getDate() - 1,
  );

  const yesterday =
    `${yesterdayDate.getFullYear()}-${String(
      yesterdayDate.getMonth() + 1,
    ).padStart(2, '0')}-${String(
      yesterdayDate.getDate(),
    ).padStart(2, '0')}`;

  if (dateKey === today) {
    return 'Hoje';
  }

  if (dateKey === yesterday) {
    return 'Ontem';
  }

  const date =
    new Date(
      `${dateKey}T12:00:00`,
    );

  return new Intl.DateTimeFormat(
    'pt-BR',
    {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    },
  ).format(date);
}

function TransactionsPage() {
  const {
    token,
    workspace,
    onLogout,
  } = useAppShell();

  const [
    transactions,
    setTransactions,
  ] = useState<
    FinancialTransaction[]
  >([]);

  const [
    accounts,
    setAccounts,
  ] = useState<Account[]>([]);

  const [
    categories,
    setCategories,
  ] = useState<Category[]>([]);

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
    search,
    setSearch,
  ] = useState('');

  const [
    typeFilter,
    setTypeFilter,
  ] =
    useState<TypeFilter>(
      'ALL',
    );

  const [
    accountFilter,
    setAccountFilter,
  ] = useState('ALL');

  const [
    categoryFilter,
    setCategoryFilter,
  ] = useState('ALL');

  const [
    includeVoided,
    setIncludeVoided,
  ] = useState(false);

  const [
    modalOpen,
    setModalOpen,
  ] = useState(false);

  const [
    editingTransaction,
    setEditingTransaction,
  ] =
    useState<
      FinancialTransaction | null
    >(null);

  const [
    form,
    setForm,
  ] =
    useState<TransactionFormState>(
      createEmptyForm,
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
    voidTarget,
    setVoidTarget,
  ] =
    useState<
      FinancialTransaction | null
    >(null);

  const [
    voiding,
    setVoiding,
  ] = useState(false);

  const canManage =
    workspace.role ===
      'OWNER' ||
    workspace.role ===
      'ADMIN' ||
    workspace.role ===
      'FINANCE';

  const eligibleAccounts =
    useMemo(
      () =>
        accounts.filter(
          (account) =>
            account.status ===
              'ACTIVE' &&
            account.type !==
              'CREDIT_CARD',
        ),
      [accounts],
    );

  const formCategories =
    useMemo(
      () =>
        categories.filter(
          (category) =>
            category.type ===
            form.type,
        ),
      [
        categories,
        form.type,
      ],
    );

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError('');

      try {
        const [
          transactionData,
          accountData,
          categoryData,
        ] =
          await Promise.all([
            getTransactions(
              token,
              workspace.id,
              includeVoided,
            ),

            getAccounts(
              token,
              workspace.id,
            ),

            getCategories(
              token,
              workspace.id,
            ),
          ]);

        if (cancelled) {
          return;
        }

        setTransactions(
          transactionData,
        );

        setAccounts(
          accountData,
        );

        setCategories(
          categoryData,
        );
      } catch (caughtError) {
        if (cancelled) {
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

        setError(
          caughtError instanceof
              Error
            ? caughtError.message
            : 'Não foi possível carregar as transações.',
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [
    token,
    workspace.id,
    includeVoided,
    onLogout,
  ]);

  const filteredTransactions =
    useMemo(() => {
      const normalizedSearch =
        search
          .trim()
          .toLowerCase();

      return transactions
        .filter(
          (transaction) => {
            const matchesSearch =
              !normalizedSearch ||
              transaction.description
                .toLowerCase()
                .includes(
                  normalizedSearch,
                ) ||
              transaction.category
                ?.name
                .toLowerCase()
                .includes(
                  normalizedSearch,
                ) ||
              transaction.entries.some(
                (entry) =>
                  entry.account.name
                    .toLowerCase()
                    .includes(
                      normalizedSearch,
                    ),
              );

            const matchesType =
              typeFilter ===
                'ALL' ||
              (typeFilter ===
                'OTHER'
                ? transaction.type !==
                    'INCOME' &&
                  transaction.type !==
                    'EXPENSE'
                : transaction.type ===
                  typeFilter);

            const matchesAccount =
              accountFilter ===
                'ALL' ||
              transaction.entries.some(
                (entry) =>
                  entry.accountId ===
                  accountFilter,
              );

            const matchesCategory =
              categoryFilter ===
                'ALL' ||
              (categoryFilter ===
                'NONE'
                ? transaction.categoryId ===
                  null
                : transaction.categoryId ===
                  categoryFilter);

            return (
              matchesSearch &&
              matchesType &&
              matchesAccount &&
              matchesCategory
            );
          },
        )
        .sort(
          (first, second) =>
            new Date(
              second.transactionDate,
            ).getTime() -
            new Date(
              first.transactionDate,
            ).getTime(),
        );
    }, [
      transactions,
      search,
      typeFilter,
      accountFilter,
      categoryFilter,
    ]);

  const stats =
    useMemo(() => {
      const currencies =
        new Set<
          ReturnType<
            typeof getTransactionCurrency
          >
        >();

      let incomeAmount = 0;
      let expenseAmount = 0;
      let incomeCount = 0;
      let expenseCount = 0;
      let voided = 0;

      for (
        const transaction of
          filteredTransactions
      ) {
        if (
          transaction.status ===
          'VOIDED'
        ) {
          voided += 1;
          continue;
        }

        if (
          transaction.type !==
            'INCOME' &&
          transaction.type !==
            'EXPENSE'
        ) {
          continue;
        }

        currencies.add(
          getTransactionCurrency(
            transaction,
          ),
        );

        const amount =
          getTransactionAmount(
            transaction,
          );

        if (
          transaction.type ===
          'INCOME'
        ) {
          incomeCount += 1;
          incomeAmount += amount;
        } else {
          expenseCount += 1;
          expenseAmount += amount;
        }
      }

      const currency =
        currencies.values().next()
          .value ?? 'BRL';

      return {
        total:
          filteredTransactions.length,
        voided,
        incomeCount,
        expenseCount,
        incomeAmount,
        expenseAmount,
        netAmount:
          incomeAmount -
          expenseAmount,
        currency,
        mixedCurrencies:
          currencies.size > 1,
      };
    }, [
      filteredTransactions,
    ]);

  const groupedTransactions =
    useMemo(() => {
      const groups =
        new Map<
          string,
          FinancialTransaction[]
        >();

      for (
        const transaction of
          filteredTransactions
      ) {
        const dateKey =
          getDateKey(
            transaction.transactionDate,
          );

        const current =
          groups.get(dateKey) ?? [];

        current.push(transaction);
        groups.set(
          dateKey,
          current,
        );
      }

      return Array.from(
        groups.entries(),
      ).map(
        ([dateKey, items]) => ({
          dateKey,
          label:
            getDateGroupLabel(
              dateKey,
            ),
          items,
        }),
      );
    }, [
      filteredTransactions,
    ]);

  function formatSummaryAmount(
    amount: number,
  ) {
    if (stats.mixedCurrencies) {
      return 'Várias moedas';
    }

    return formatCurrency(
      amount,
      stats.currency,
    );
  }

  async function refreshTransactions() {
    const data =
      await getTransactions(
        token,
        workspace.id,
        includeVoided,
      );

    setTransactions(data);
  }

  function handleApiError(
    caughtError: unknown,
    fallback: string,
  ) {
    if (
      caughtError instanceof
        ApiError &&
      caughtError.statusCode ===
        401
    ) {
      onLogout();

      return;
    }

    setError(
      caughtError instanceof
          Error
        ? caughtError.message
        : fallback,
    );
  }

  function openCreateModal() {
    if (
      !canManage ||
      eligibleAccounts.length ===
        0
    ) {
      return;
    }

    setEditingTransaction(null);

    setForm({
      ...createEmptyForm(),
      accountId:
        eligibleAccounts[0]
          ?.id ?? '',
    });

    setFormError('');
    setModalOpen(true);
  }

  function canEditTransaction(
    transaction:
      FinancialTransaction,
  ) {
    const entry =
      transaction.entries[0];

    return (
      canManage &&
      transaction.status ===
        'POSTED' &&
      (transaction.type ===
        'INCOME' ||
        transaction.type ===
          'EXPENSE') &&
      transaction.entries.length ===
        1 &&
      transaction.invoiceId ===
        null &&
      transaction.installmentPurchaseId ===
        null &&
      transaction
        .refundForInstallmentPurchaseId ===
        null &&
      entry?.account.type !==
        'CREDIT_CARD'
    );
  }

  function openEditModal(
    transaction:
      FinancialTransaction,
  ) {
    if (
      !canEditTransaction(
        transaction,
      )
    ) {
      return;
    }

    const entry =
      transaction.entries[0];

    if (!entry) {
      return;
    }

    setEditingTransaction(
      transaction,
    );

    setForm({
      type:
        transaction.type as
          EditableTransactionType,

      description:
        transaction.description,

      amount:
        String(
          toNumber(
            entry.amount,
          ),
        ),

      accountId:
        entry.account.id,

      categoryId:
        transaction.categoryId ??
        '',

      transactionDate:
        transaction.transactionDate.slice(
          0,
          10,
        ),
    });

    setFormError('');
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) {
      return;
    }

    setModalOpen(false);
    setEditingTransaction(null);
    setFormError('');
  }

  async function handleSubmit(
    event:
      React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setFormError('');
    setError('');
    setSuccess('');

    const amount =
      parseMoneyInput(
        form.amount,
      );

    if (
      !form.description.trim()
    ) {
      setFormError(
        'Informe a descrição.',
      );

      return;
    }

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      setFormError(
        'Informe um valor maior que zero.',
      );

      return;
    }

    if (!form.accountId) {
      setFormError(
        'Selecione uma conta.',
      );

      return;
    }

    if (
      !form.transactionDate
    ) {
      setFormError(
        'Informe a data.',
      );

      return;
    }

    setSaving(true);

    try {
      if (
        editingTransaction
      ) {
        await updateTransaction(
          token,
          workspace.id,
          editingTransaction.id,
          {
            type: form.type,
            description:
              form.description.trim(),
            amount,
            accountId:
              form.accountId,

            categoryId:
              form.categoryId ||
              null,

            transactionDate:
              form.transactionDate,
          },
        );

        setSuccess(
          'Transação atualizada com sucesso.',
        );
      } else {
        await createTransaction(
          token,
          workspace.id,
          {
            type: form.type,
            description:
              form.description.trim(),
            amount,
            accountId:
              form.accountId,

            ...(form.categoryId
              ? {
                  categoryId:
                    form.categoryId,
                }
              : {}),

            transactionDate:
              form.transactionDate,
          },
        );

        setSuccess(
          'Transação criada com sucesso.',
        );
      }

      await refreshTransactions();

      setModalOpen(false);
      setEditingTransaction(null);
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

      setFormError(
        caughtError instanceof
            Error
          ? caughtError.message
          : 'Não foi possível salvar a transação.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function confirmVoid() {
    if (!voidTarget) {
      return;
    }

    setVoiding(true);
    setError('');
    setSuccess('');

    try {
      await voidTransaction(
        token,
        workspace.id,
        voidTarget.id,
      );

      await refreshTransactions();

      setVoidTarget(null);

      setSuccess(
        'Transação estornada com sucesso.',
      );
    } catch (caughtError) {
      handleApiError(
        caughtError,
        'Não foi possível estornar a transação.',
      );
    } finally {
      setVoiding(false);
    }
  }

  function clearFilters() {
    setSearch('');
    setTypeFilter('ALL');
    setAccountFilter('ALL');
    setCategoryFilter('ALL');
    setIncludeVoided(false);
  }

  const hasFilters =
    Boolean(search) ||
    typeFilter !== 'ALL' ||
    accountFilter !==
      'ALL' ||
    categoryFilter !==
      'ALL' ||
    includeVoided;

  return (
    <main className="dashboard-content transactions-page">
      <section className="dashboard-heading transactions-heading">
        <div>
          <h2>
            Transações
          </h2>

          <p>
            Visualize e organize todas
            as movimentações do seu
            workspace.
          </p>
        </div>

        <div className="transactions-heading-actions">
          {!canManage && (
            <span className="readonly-badge">
              Somente leitura
            </span>
          )}

          <button
            type="button"
            className="transaction-primary-button"
            onClick={
              openCreateModal
            }
            disabled={
              !canManage ||
              eligibleAccounts.length ===
                0
            }
            title={
              eligibleAccounts.length ===
                0
                ? 'Crie uma conta antes de adicionar transações'
                : undefined
            }
          >
            <Plus size={18} />
            Nova transação
          </button>
        </div>
      </section>

      {success && (
        <div className="transaction-success-message">
          {success}

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
        <div className="error-message transaction-page-error">
          {error}
        </div>
      )}

      <section className="transaction-stats-grid">
        <article className="transaction-stat-card">
          <span className="transaction-stat-icon total">
            <CircleDollarSign
              size={20}
            />
          </span>

          <div className="transaction-stat-content">
            <span>
              Movimentações
            </span>

            <strong>
              {stats.total}
            </strong>

            <small>
              {stats.voided > 0
                ? `${stats.voided} estornada${stats.voided === 1 ? '' : 's'}`
                : 'No filtro atual'}
            </small>
          </div>
        </article>

        <article className="transaction-stat-card">
          <span className="transaction-stat-icon income">
            <ArrowDownRight
              size={20}
            />
          </span>

          <div className="transaction-stat-content">
            <span>
              Entradas
            </span>

            <strong>
              {formatSummaryAmount(
                stats.incomeAmount,
              )}
            </strong>

            <small>
              {stats.incomeCount}{' '}
              {stats.incomeCount === 1
                ? 'receita'
                : 'receitas'}
            </small>
          </div>
        </article>

        <article className="transaction-stat-card">
          <span className="transaction-stat-icon expense">
            <ArrowUpRight
              size={20}
            />
          </span>

          <div className="transaction-stat-content">
            <span>
              Saídas
            </span>

            <strong>
              {formatSummaryAmount(
                stats.expenseAmount,
              )}
            </strong>

            <small>
              {stats.expenseCount}{' '}
              {stats.expenseCount === 1
                ? 'despesa'
                : 'despesas'}
            </small>
          </div>
        </article>

        <article className="transaction-stat-card">
          <span className="transaction-stat-icon balance">
            <Wallet size={20} />
          </span>

          <div className="transaction-stat-content">
            <span>
              Resultado
            </span>

            <strong
              className={
                stats.netAmount < 0
                  ? 'negative'
                  : undefined
              }
            >
              {formatSummaryAmount(
                stats.netAmount,
              )}
            </strong>

            <small>
              Receitas menos despesas
            </small>
          </div>
        </article>
      </section>

      <section className="panel transaction-filters-panel">
        <div className="transaction-search">
          <Search size={17} />

          <input
            type="search"
            placeholder="Buscar por descrição, categoria ou conta..."
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value,
              )
            }
          />
        </div>

        <div className="transaction-filter-controls">
          <div className="transaction-filter-select">
            <Filter size={15} />

            <select
              value={typeFilter}
              onChange={(event) =>
                setTypeFilter(
                  event.target
                    .value as
                    TypeFilter,
                )
              }
            >
              <option value="ALL">
                Todos os tipos
              </option>

              <option value="INCOME">
                Receitas
              </option>

              <option value="EXPENSE">
                Despesas
              </option>

              <option value="OTHER">
                Outros
              </option>
            </select>
          </div>

          <select
            className="transaction-simple-select"
            value={accountFilter}
            onChange={(event) =>
              setAccountFilter(
                event.target.value,
              )
            }
          >
            <option value="ALL">
              Todas as contas
            </option>

            {accounts.map(
              (account) => (
                <option
                  key={account.id}
                  value={account.id}
                >
                  {account.name}
                </option>
              ),
            )}
          </select>

          <select
            className="transaction-simple-select"
            value={
              categoryFilter
            }
            onChange={(event) =>
              setCategoryFilter(
                event.target.value,
              )
            }
          >
            <option value="ALL">
              Todas as categorias
            </option>

            <option value="NONE">
              Sem categoria
            </option>

            {categories.map(
              (category) => (
                <option
                  key={category.id}
                  value={
                    category.id
                  }
                >
                  {category.name}
                </option>
              ),
            )}
          </select>

          <label className="transaction-checkbox">
            <input
              type="checkbox"
              checked={
                includeVoided
              }
              onChange={(event) =>
                setIncludeVoided(
                  event.target
                    .checked,
                )
              }
            />

            <span>
              Incluir estornadas
            </span>
          </label>

          {hasFilters && (
            <button
              type="button"
              className="transaction-clear-button"
              onClick={
                clearFilters
              }
            >
              Limpar filtros
            </button>
          )}
        </div>
      </section>

      <section className="panel transaction-list-panel">
        <div className="transaction-list-header">
          <div>
            <h3>
              Histórico
            </h3>

            <p>
              {filteredTransactions.length}{' '}
              {filteredTransactions.length ===
              1
                ? 'movimentação encontrada'
                : 'movimentações encontradas'}
            </p>
          </div>

          <span className="transaction-list-hint">
            Mais recentes primeiro
          </span>
        </div>

        {loading ? (
          <div className="transaction-loading-state">
            <div className="transaction-spinner" />

            <strong>
              Carregando transações
            </strong>

            <span>
              Sincronizando seus
              lançamentos...
            </span>
          </div>
        ) : filteredTransactions.length ===
          0 ? (
          <div className="empty-state transaction-empty-state">
            <ReceiptText
              size={34}
            />

            <strong>
              Nenhuma transação encontrada
            </strong>

            <span>
              {hasFilters
                ? 'Tente ajustar os filtros da busca.'
                : 'Suas movimentações aparecerão aqui.'}
            </span>

            {!hasFilters &&
              canManage &&
              eligibleAccounts.length >
                0 && (
                <button
                  type="button"
                  className="transaction-empty-button"
                  onClick={
                    openCreateModal
                  }
                >
                  <Plus
                    size={16}
                  />
                  Criar primeira transação
                </button>
              )}
          </div>
        ) : (
          <div className="transaction-groups">
            {groupedTransactions.map(
              (group) => (
                <section
                  className="transaction-date-group"
                  key={group.dateKey}
                >
                  <div className="transaction-date-group-header">
                    <strong>
                      {group.label}
                    </strong>

                    <span>
                      {group.items.length}{' '}
                      {group.items.length ===
                      1
                        ? 'movimentação'
                        : 'movimentações'}
                    </span>
                  </div>

                  <div className="transaction-list">
                    {group.items.map(
                      (transaction) => {
                        const income =
                          transaction.type ===
                          'INCOME';

                        const expense =
                          transaction.type ===
                          'EXPENSE';

                        const tone =
                          getTransactionTone(
                            transaction.type,
                          );

                        const amount =
                          getTransactionAmount(
                            transaction,
                          );

                        const currency =
                          getTransactionCurrency(
                            transaction,
                          );

                        const editable =
                          canEditTransaction(
                            transaction,
                          );

                        const voided =
                          transaction.status ===
                          'VOIDED';

                        return (
                          <article
                            className={`transaction-list-item ${voided ? 'voided' : ''}`}
                            key={
                              transaction.id
                            }
                          >
                            <div className="transaction-item-main">
                              <span
                                className={`transaction-list-icon ${tone}`}
                              >
                                {income ? (
                                  <ArrowDownRight
                                    size={18}
                                  />
                                ) : expense ? (
                                  <ArrowUpRight
                                    size={18}
                                  />
                                ) : transaction.type ===
                                  'TRANSFER' ? (
                                  <ArrowLeftRight
                                    size={18}
                                  />
                                ) : (
                                  <SlidersHorizontal
                                    size={18}
                                  />
                                )}
                              </span>

                              <div className="transaction-item-copy">
                                <div className="transaction-item-title-row">
                                  <strong>
                                    {
                                      transaction.description
                                    }
                                  </strong>

                                  <span
                                    className={`transaction-type-pill ${tone}`}
                                  >
                                    {getTypeLabel(
                                      transaction.type,
                                    )}
                                  </span>

                                  {voided && (
                                    <span className="transaction-status-pill">
                                      Estornada
                                    </span>
                                  )}
                                </div>

                                <div className="transaction-item-meta">
                                  <span>
                                    {transaction
                                      .category
                                      ?.name ??
                                      'Sem categoria'}
                                  </span>

                                  <i />

                                  <span>
                                    {getAccountNames(
                                      transaction,
                                    )}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="transaction-item-value-area">
                              <strong
                                className={`transaction-value ${voided ? 'voided' : tone}`}
                              >
                                {income
                                  ? '+ '
                                  : expense
                                    ? '- '
                                    : ''}

                                {formatCurrency(
                                  amount,
                                  currency,
                                )}
                              </strong>

                              <span>
                                {voided
                                  ? 'Sem efeito no saldo'
                                  : getTypeLabel(
                                      transaction.type,
                                    )}
                              </span>
                            </div>

                            <div className="transaction-item-actions">
                              {editable && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openEditModal(
                                        transaction,
                                      )
                                    }
                                    title="Editar transação"
                                    aria-label="Editar transação"
                                  >
                                    <Edit3
                                      size={15}
                                    />
                                  </button>

                                  <button
                                    type="button"
                                    className="danger"
                                    onClick={() =>
                                      setVoidTarget(
                                        transaction,
                                      )
                                    }
                                    title="Estornar transação"
                                    aria-label="Estornar transação"
                                  >
                                    <Ban
                                      size={15}
                                    />
                                  </button>
                                </>
                              )}
                            </div>
                          </article>
                        );
                      },
                    )}
                  </div>
                </section>
              ),
            )}
          </div>
        )}
      </section>

      {modalOpen && (
        <div className="transaction-modal-backdrop">
          <section
            className="transaction-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="transaction-modal-title"
          >
            <div className="transaction-modal-header">
              <div>
                <span className="transaction-modal-kicker">
                  {editingTransaction
                    ? 'EDITAR LANÇAMENTO'
                    : 'NOVO LANÇAMENTO'}
                </span>

                <h2 id="transaction-modal-title">
                  {editingTransaction
                    ? 'Editar transação'
                    : 'Nova transação'}
                </h2>

                <p>
                  {editingTransaction
                    ? 'Atualize os dados desta movimentação.'
                    : 'Registre uma nova receita ou despesa.'}
                </p>
              </div>

              <button
                type="button"
                className="transaction-modal-close"
                onClick={
                  closeModal
                }
                aria-label="Fechar"
              >
                <X size={20} />
              </button>
            </div>

            <form
              className="transaction-form"
              onSubmit={
                handleSubmit
              }
            >
              <div className="transaction-type-selector">
                <button
                  type="button"
                  className={
                    form.type ===
                    'INCOME'
                      ? 'active income'
                      : ''
                  }
                  onClick={() =>
                    setForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        type: 'INCOME',
                        categoryId:
                          '',
                      }),
                    )
                  }
                >
                  <ArrowDownRight
                    size={17}
                  />

                  Receita
                </button>

                <button
                  type="button"
                  className={
                    form.type ===
                    'EXPENSE'
                      ? 'active expense'
                      : ''
                  }
                  onClick={() =>
                    setForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        type: 'EXPENSE',
                        categoryId:
                          '',
                      }),
                    )
                  }
                >
                  <ArrowUpRight
                    size={17}
                  />

                  Despesa
                </button>
              </div>

              <label className="transaction-form-field">
                <span>
                  Descrição
                </span>

                <input
                  type="text"
                  value={
                    form.description
                  }
                  onChange={(
                    event,
                  ) =>
                    setForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        description:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                  placeholder="Ex.: Salário, aluguel, mercado..."
                  minLength={2}
                  required
                />
              </label>

              <div className="transaction-form-grid">
                <label className="transaction-form-field">
                  <span>
                    Valor
                  </span>

                  <div className="transaction-money-input">
                    <span>
                      R$
                    </span>

                    <input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
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
                              event
                                .target
                                .value,
                          }),
                        )
                      }
                      placeholder="0,00"
                      required
                    />
                  </div>
                </label>

                <label className="transaction-form-field">
                  <span>
                    Data
                  </span>

                  <input
                    type="date"
                    value={
                      form.transactionDate
                    }
                    onChange={(
                      event,
                    ) =>
                      setForm(
                        (
                          current,
                        ) => ({
                          ...current,
                          transactionDate:
                            event
                              .target
                              .value,
                        }),
                      )
                    }
                    required
                  />
                </label>
              </div>

              <label className="transaction-form-field">
                <span>
                  Conta
                </span>

                <select
                  value={
                    form.accountId
                  }
                  onChange={(
                    event,
                  ) =>
                    setForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        accountId:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                  required
                >
                  <option value="">
                    Selecione uma conta
                  </option>

                  {eligibleAccounts.map(
                    (account) => (
                      <option
                        key={
                          account.id
                        }
                        value={
                          account.id
                        }
                      >
                        {account.name}{' '}
                        •{' '}
                        {
                          account.currency
                        }
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label className="transaction-form-field">
                <span>
                  Categoria
                  <small>
                    opcional
                  </small>
                </span>

                <select
                  value={
                    form.categoryId
                  }
                  onChange={(
                    event,
                  ) =>
                    setForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        categoryId:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                >
                  <option value="">
                    Sem categoria
                  </option>

                  {formCategories.map(
                    (category) => (
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

              {formError && (
                <div className="error-message">
                  {formError}
                </div>
              )}

              <div className="transaction-form-actions">
                <button
                  type="button"
                  className="transaction-secondary-button"
                  onClick={
                    closeModal
                  }
                  disabled={saving}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="transaction-primary-button"
                  disabled={saving}
                >
                  {saving
                    ? 'Salvando...'
                    : editingTransaction
                      ? 'Salvar alterações'
                      : 'Criar transação'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {voidTarget && (
        <div className="transaction-modal-backdrop">
          <section
            className="transaction-confirm-modal"
            role="dialog"
            aria-modal="true"
          >
            <span className="transaction-confirm-icon">
              <Ban size={23} />
            </span>

            <h2>
              Estornar transação?
            </h2>

            <p>
              A movimentação{' '}
              <strong>
                {
                  voidTarget.description
                }
              </strong>{' '}
              será marcada como
              estornada. O histórico
              financeiro será mantido.
            </p>

            <div className="transaction-confirm-actions">
              <button
                type="button"
                className="transaction-secondary-button"
                onClick={() =>
                  setVoidTarget(
                    null,
                  )
                }
                disabled={voiding}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="transaction-danger-button"
                onClick={() =>
                  void confirmVoid()
                }
                disabled={voiding}
              >
                {voiding
                  ? 'Estornando...'
                  : 'Confirmar estorno'}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default TransactionsPage;