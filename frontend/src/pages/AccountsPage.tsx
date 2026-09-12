import {
  Archive,
  Banknote,
  Landmark,
  Pencil,
  PiggyBank,
  Plus,
  Search,
  TrendingUp,
  WalletCards,
  X,
} from 'lucide-react';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import type {
  FormEvent,
} from 'react';

import {
  ApiError,
  archiveAccount,
  createAccount,
  getAccountBalance,
  getAccounts,
  updateAccount,
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
  AccountBalance,
  AccountType,
  Currency,
} from '../types/api';

import './AccountsPage.css';

type AccountFormType =
  Exclude<
    AccountType,
    'CREDIT_CARD'
  >;

type AccountTypeFilter =
  | 'ALL'
  | AccountFormType;

type CurrencyFilter =
  | 'ALL'
  | Currency;

interface AccountFormState {
  name: string;
  type: AccountFormType;
  currency: Currency;
  initialBalance: string;
}

const accountTypeOptions: Array<{
  value: AccountFormType;
  label: string;
}> = [
  {
    value: 'CHECKING',
    label: 'Conta corrente',
  },
  {
    value: 'SAVINGS',
    label: 'Poupança',
  },
  {
    value: 'CASH',
    label: 'Dinheiro',
  },
  {
    value: 'INVESTMENT',
    label: 'Investimentos',
  },
  {
    value: 'OTHER',
    label: 'Outra',
  },
];

function createEmptyForm():
  AccountFormState {
  return {
    name: '',
    type: 'CHECKING',
    currency: 'BRL',
    initialBalance: '0',
  };
}

function getAccountTypeLabel(
  type: AccountType,
) {
  const labels:
    Record<AccountType, string> = {
      CHECKING:
        'Conta corrente',
      SAVINGS:
        'Poupança',
      CASH:
        'Dinheiro',
      CREDIT_CARD:
        'Cartão de crédito',
      INVESTMENT:
        'Investimentos',
      OTHER:
        'Outra',
    };

  return labels[type];
}

function AccountTypeIcon({
  type,
}: {
  type: AccountType;
}) {
  if (type === 'CASH') {
    return (
      <Banknote size={21} />
    );
  }

  if (type === 'SAVINGS') {
    return (
      <PiggyBank size={21} />
    );
  }

  if (
    type === 'INVESTMENT'
  ) {
    return (
      <TrendingUp size={21} />
    );
  }

  if (
    type === 'CHECKING'
  ) {
    return (
      <Landmark size={21} />
    );
  }

  return (
    <WalletCards size={21} />
  );
}

function AccountsPage() {
  const {
    token,
    workspace,
    onLogout,
  } = useAppShell();

  const [
    accounts,
    setAccounts,
  ] = useState<Account[]>(
    [],
  );

  const [
    balances,
    setBalances,
  ] = useState<
    Record<
      string,
      AccountBalance
    >
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
    search,
    setSearch,
  ] = useState('');

  const [
    typeFilter,
    setTypeFilter,
  ] =
    useState<AccountTypeFilter>(
      'ALL',
    );

  const [
    currencyFilter,
    setCurrencyFilter,
  ] =
    useState<CurrencyFilter>(
      'ALL',
    );

  const [
    modalOpen,
    setModalOpen,
  ] = useState(false);

  const [
    editingAccount,
    setEditingAccount,
  ] =
    useState<Account | null>(
      null,
    );

  const [
    form,
    setForm,
  ] =
    useState<AccountFormState>(
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
    archiveTarget,
    setArchiveTarget,
  ] =
    useState<Account | null>(
      null,
    );

  const [
    archiving,
    setArchiving,
  ] = useState(false);

  const canManage =
    workspace.role ===
      'OWNER' ||
    workspace.role ===
      'ADMIN' ||
    workspace.role ===
      'FINANCE';

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

  async function loadAccounts() {
    const accountData =
      await getAccounts(
        token,
        workspace.id,
      );

    const nextBalances:
      Record<
        string,
        AccountBalance
      > = {};

    await Promise.all(
      accountData.map(
        async (account) => {
          const balance =
            await getAccountBalance(
              token,
              workspace.id,
              account.id,
            );

          nextBalances[
            account.id
          ] = balance;
        },
      ),
    );

    setAccounts(accountData);

    setBalances(
      nextBalances,
    );
  }

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setLoading(true);
      setError('');

      try {
        const accountData =
          await getAccounts(
            token,
            workspace.id,
          );

        const nextBalances:
          Record<
            string,
            AccountBalance
          > = {};

        await Promise.all(
          accountData.map(
            async (account) => {
              const balance =
                await getAccountBalance(
                  token,
                  workspace.id,
                  account.id,
                );

              nextBalances[
                account.id
              ] = balance;
            },
          ),
        );

        if (cancelled) {
          return;
        }

        setAccounts(
          accountData,
        );

        setBalances(
          nextBalances,
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
            : 'Não foi possível carregar as contas.',
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [
    token,
    workspace.id,
    onLogout,
  ]);

  const currencyTotals =
    useMemo(() => {
      const totals = {
        BRL: 0,
        USD: 0,
        EUR: 0,
      };

      for (
        const account of accounts
      ) {
        const balance =
          balances[
            account.id
          ];

        if (!balance) {
          continue;
        }

        totals[
          account.currency
        ] +=
          toNumber(
            balance.balance,
          );
      }

      return totals;
    }, [
      accounts,
      balances,
    ]);

  const filteredAccounts =
    useMemo(() => {
      const normalizedSearch =
        search
          .trim()
          .toLowerCase();

      return accounts.filter(
        (account) => {
          const matchesSearch =
            !normalizedSearch ||
            account.name
              .toLowerCase()
              .includes(
                normalizedSearch,
              ) ||
            getAccountTypeLabel(
              account.type,
            )
              .toLowerCase()
              .includes(
                normalizedSearch,
              );

          const matchesType =
            typeFilter ===
              'ALL' ||
            account.type ===
              typeFilter;

          const matchesCurrency =
            currencyFilter ===
              'ALL' ||
            account.currency ===
              currencyFilter;

          return (
            matchesSearch &&
            matchesType &&
            matchesCurrency
          );
        },
      );
    }, [
      accounts,
      search,
      typeFilter,
      currencyFilter,
    ]);

  function openCreateModal() {
    if (!canManage) {
      return;
    }

    setEditingAccount(null);

    setForm(
      createEmptyForm(),
    );

    setFormError('');
    setModalOpen(true);
  }

  function openEditModal(
    account: Account,
  ) {
    if (!canManage) {
      return;
    }

    if (
      account.type ===
      'CREDIT_CARD'
    ) {
      return;
    }

    setEditingAccount(
      account,
    );

    setForm({
      name: account.name,

      type:
        account.type as
          AccountFormType,

      currency:
        account.currency,

      initialBalance:
        String(
          toNumber(
            account.initialBalance,
          ),
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
    setEditingAccount(null);
    setFormError('');
  }

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setFormError('');
    setError('');
    setSuccess('');

    const normalizedName =
      form.name.trim();

    if (
      normalizedName.length < 2
    ) {
      setFormError(
        'O nome deve ter pelo menos 2 caracteres.',
      );

      return;
    }

    const initialBalance =
      Number(
        form.initialBalance,
      );

    if (
      !editingAccount &&
      !Number.isFinite(
        initialBalance,
      )
    ) {
      setFormError(
        'Informe um saldo inicial válido.',
      );

      return;
    }

    setSaving(true);

    try {
      if (editingAccount) {
        await updateAccount(
          token,
          workspace.id,
          editingAccount.id,
          {
            name:
              normalizedName,
            type: form.type,
            currency:
              form.currency,
          },
        );

        setSuccess(
          'Conta atualizada com sucesso.',
        );
      } else {
        await createAccount(
          token,
          workspace.id,
          {
            name:
              normalizedName,
            type: form.type,
            currency:
              form.currency,
            initialBalance,
          },
        );

        setSuccess(
          'Conta criada com sucesso.',
        );
      }

      await loadAccounts();

      setModalOpen(false);
      setEditingAccount(null);
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
          : 'Não foi possível salvar a conta.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function confirmArchive() {
    if (!archiveTarget) {
      return;
    }

    setArchiving(true);
    setError('');
    setSuccess('');

    try {
      await archiveAccount(
        token,
        workspace.id,
        archiveTarget.id,
      );

      await loadAccounts();

      setArchiveTarget(null);

      setSuccess(
        'Conta arquivada com sucesso.',
      );
    } catch (caughtError) {
      handleApiError(
        caughtError,
        'Não foi possível arquivar a conta.',
      );
    } finally {
      setArchiving(false);
    }
  }

  function clearFilters() {
    setSearch('');
    setTypeFilter('ALL');
    setCurrencyFilter('ALL');
  }

  const hasFilters =
    Boolean(search) ||
    typeFilter !== 'ALL' ||
    currencyFilter !==
      'ALL';

  return (
    <main className="dashboard-content accounts-page">
      <section className="dashboard-heading accounts-heading">
        <div>
          <h2>
            Suas contas
          </h2>

          <p>
            Centralize bancos,
            dinheiro, poupança e
            investimentos.
          </p>
        </div>

        <div className="accounts-heading-actions">
          {!canManage && (
            <span className="readonly-badge">
              Somente leitura
            </span>
          )}

          <button
            type="button"
            className="account-primary-button"
            onClick={
              openCreateModal
            }
            disabled={
              !canManage
            }
          >
            <Plus size={18} />
            Nova conta
          </button>
        </div>
      </section>

      {success && (
        <div className="account-success-message">
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
        <div className="error-message account-page-error">
          {error}
        </div>
      )}

      <section className="account-summary-grid">
        <article className="account-summary-card">
          <span className="account-summary-icon accounts">
            <WalletCards
              size={20}
            />
          </span>

          <div>
            <span>
              Contas ativas
            </span>

            <strong>
              {accounts.length}
            </strong>
          </div>
        </article>

        <article className="account-summary-card">
          <span className="account-summary-icon brl">
            R$
          </span>

          <div>
            <span>
              Saldo em BRL
            </span>

            <strong>
              {formatCurrency(
                currencyTotals.BRL,
                'BRL',
              )}
            </strong>
          </div>
        </article>

        <article className="account-summary-card">
          <span className="account-summary-icon usd">
            $
          </span>

          <div>
            <span>
              Saldo em USD
            </span>

            <strong>
              {formatCurrency(
                currencyTotals.USD,
                'USD',
              )}
            </strong>
          </div>
        </article>

        <article className="account-summary-card">
          <span className="account-summary-icon eur">
            €
          </span>

          <div>
            <span>
              Saldo em EUR
            </span>

            <strong>
              {formatCurrency(
                currencyTotals.EUR,
                'EUR',
              )}
            </strong>
          </div>
        </article>
      </section>

      <section className="panel account-toolbar">
        <div className="account-search">
          <Search size={17} />

          <input
            type="search"
            placeholder="Buscar conta..."
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value,
              )
            }
          />
        </div>

        <div className="account-filter-group">
          <select
            value={typeFilter}
            onChange={(event) =>
              setTypeFilter(
                event.target
                  .value as
                  AccountTypeFilter,
              )
            }
          >
            <option value="ALL">
              Todos os tipos
            </option>

            {accountTypeOptions.map(
              (option) => (
                <option
                  key={
                    option.value
                  }
                  value={
                    option.value
                  }
                >
                  {
                    option.label
                  }
                </option>
              ),
            )}
          </select>

          <select
            value={currencyFilter}
            onChange={(event) =>
              setCurrencyFilter(
                event.target
                  .value as
                  CurrencyFilter,
              )
            }
          >
            <option value="ALL">
              Todas as moedas
            </option>

            <option value="BRL">
              BRL
            </option>

            <option value="USD">
              USD
            </option>

            <option value="EUR">
              EUR
            </option>
          </select>

          {hasFilters && (
            <button
              type="button"
              className="account-clear-filters"
              onClick={
                clearFilters
              }
            >
              Limpar filtros
            </button>
          )}
        </div>
      </section>

      {loading ? (
        <section className="panel account-loading">
          <div className="account-spinner" />

          <strong>
            Carregando contas
          </strong>

          <span>
            Calculando seus saldos...
          </span>
        </section>
      ) : filteredAccounts.length ===
        0 ? (
        <section className="panel">
          <div className="empty-state account-empty-state">
            <WalletCards
              size={36}
            />

            <strong>
              {hasFilters
                ? 'Nenhuma conta encontrada'
                : 'Você ainda não possui contas'}
            </strong>

            <span>
              {hasFilters
                ? 'Tente ajustar os filtros da busca.'
                : 'Crie sua primeira conta para começar a organizar suas finanças.'}
            </span>

            {!hasFilters &&
              canManage && (
                <button
                  type="button"
                  className="account-empty-button"
                  onClick={
                    openCreateModal
                  }
                >
                  <Plus
                    size={16}
                  />
                  Criar primeira conta
                </button>
              )}
          </div>
        </section>
      ) : (
        <section className="account-grid">
          {filteredAccounts.map(
            (account) => {
              const balance =
                balances[
                  account.id
                ];

              return (
                <article
                  className="account-card"
                  key={
                    account.id
                  }
                >
                  <div className="account-card-top">
                    <span
                      className={`account-type-icon ${account.type.toLowerCase()}`}
                    >
                      <AccountTypeIcon
                        type={
                          account.type
                        }
                      />
                    </span>

                    <div className="account-card-actions">
                      {canManage &&
                        account.type !==
                          'CREDIT_CARD' && (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                openEditModal(
                                  account,
                                )
                              }
                              aria-label="Editar conta"
                              title="Editar conta"
                            >
                              <Pencil
                                size={
                                  15
                                }
                              />
                            </button>

                            <button
                              type="button"
                              className="danger"
                              onClick={() =>
                                setArchiveTarget(
                                  account,
                                )
                              }
                              aria-label="Arquivar conta"
                              title="Arquivar conta"
                            >
                              <Archive
                                size={
                                  15
                                }
                              />
                            </button>
                          </>
                        )}
                    </div>
                  </div>

                  <div className="account-card-heading">
                    <span>
                      {getAccountTypeLabel(
                        account.type,
                      )}
                    </span>

                    <h3>
                      {account.name}
                    </h3>
                  </div>

                  <div className="account-balance">
                    <span>
                      Saldo atual
                    </span>

                    <strong>
                      {balance
                        ? formatCurrency(
                            balance.balance,
                            balance.currency,
                          )
                        : '—'}
                    </strong>
                  </div>

                  <div className="account-card-divider" />

                  <div className="account-card-footer">
                    <div>
                      <span>
                        Moeda
                      </span>

                      <strong>
                        {
                          account.currency
                        }
                      </strong>
                    </div>

                    <div>
                      <span>
                        Saldo inicial
                      </span>

                      <strong>
                        {formatCurrency(
                          account.initialBalance,
                          account.currency,
                        )}
                      </strong>
                    </div>

                    <span className="account-status-pill">
                      Ativa
                    </span>
                  </div>
                </article>
              );
            },
          )}
        </section>
      )}

      {modalOpen && (
        <div className="account-modal-backdrop">
          <section
            className="account-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-modal-title"
          >
            <div className="account-modal-header">
              <div>
                <span className="account-modal-kicker">
                  {editingAccount
                    ? 'EDITAR CONTA'
                    : 'NOVA CONTA'}
                </span>

                <h2 id="account-modal-title">
                  {editingAccount
                    ? 'Editar conta'
                    : 'Adicionar conta'}
                </h2>

                <p>
                  {editingAccount
                    ? 'Atualize as informações da sua conta.'
                    : 'Cadastre uma conta para começar a registrar suas movimentações.'}
                </p>
              </div>

              <button
                type="button"
                className="account-modal-close"
                onClick={
                  closeModal
                }
                aria-label="Fechar"
              >
                <X size={20} />
              </button>
            </div>

            <form
              className="account-form"
              onSubmit={
                handleSubmit
              }
            >
              <label className="account-form-field">
                <span>
                  Nome da conta
                </span>

                <input
                  type="text"
                  value={
                    form.name
                  }
                  onChange={(event) =>
                    setForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        name:
                          event.target
                            .value,
                      }),
                    )
                  }
                  placeholder="Ex.: Nubank, Itaú, Carteira..."
                  minLength={2}
                  required
                />
              </label>

              <div className="account-form-grid">
                <label className="account-form-field">
                  <span>
                    Tipo
                  </span>

                  <select
                    value={
                      form.type
                    }
                    onChange={(event) =>
                      setForm(
                        (
                          current,
                        ) => ({
                          ...current,

                          type:
                            event
                              .target
                              .value as
                              AccountFormType,
                        }),
                      )
                    }
                  >
                    {accountTypeOptions.map(
                      (
                        option,
                      ) => (
                        <option
                          key={
                            option.value
                          }
                          value={
                            option.value
                          }
                        >
                          {
                            option.label
                          }
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label className="account-form-field">
                  <span>
                    Moeda
                  </span>

                  <select
                    value={
                      form.currency
                    }
                    onChange={(event) =>
                      setForm(
                        (
                          current,
                        ) => ({
                          ...current,

                          currency:
                            event
                              .target
                              .value as
                              Currency,
                        }),
                      )
                    }
                  >
                    <option value="BRL">
                      Real brasileiro
                    </option>

                    <option value="USD">
                      Dólar americano
                    </option>

                    <option value="EUR">
                      Euro
                    </option>
                  </select>
                </label>
              </div>

              {!editingAccount && (
                <label className="account-form-field">
                  <span>
                    Saldo inicial
                  </span>

                  <div className="account-money-input">
                    <span>
                      {form.currency ===
                      'BRL'
                        ? 'R$'
                        : form.currency ===
                            'USD'
                          ? '$'
                          : '€'}
                    </span>

                    <input
                      type="number"
                      step="0.01"
                      value={
                        form.initialBalance
                      }
                      onChange={(event) =>
                        setForm(
                          (
                            current,
                          ) => ({
                            ...current,

                            initialBalance:
                              event
                                .target
                                .value,
                          }),
                        )
                      }
                      required
                    />
                  </div>

                  <small>
                    Esse valor será
                    registrado
                    automaticamente
                    como o saldo inicial
                    da conta.
                  </small>
                </label>
              )}

              {editingAccount && (
                <div className="account-edit-notice">
                  O saldo da conta é
                  calculado pelas
                  movimentações e não
                  pode ser alterado
                  diretamente nesta
                  edição.
                </div>
              )}

              <div className="account-card-preview">
                <span
                  className={`account-type-icon ${form.type.toLowerCase()}`}
                >
                  <AccountTypeIcon
                    type={
                      form.type
                    }
                  />
                </span>

                <div>
                  <span>
                    Prévia da conta
                  </span>

                  <strong>
                    {form.name.trim() ||
                      'Nome da conta'}
                  </strong>

                  <small>
                    {
                      getAccountTypeLabel(
                        form.type,
                      )
                    }{' '}
                    •{' '}
                    {
                      form.currency
                    }
                  </small>
                </div>
              </div>

              {formError && (
                <div className="error-message">
                  {formError}
                </div>
              )}

              <div className="account-form-actions">
                <button
                  type="button"
                  className="account-secondary-button"
                  onClick={
                    closeModal
                  }
                  disabled={saving}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="account-primary-button"
                  disabled={saving}
                >
                  {saving
                    ? 'Salvando...'
                    : editingAccount
                      ? 'Salvar alterações'
                      : 'Criar conta'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {archiveTarget && (
        <div className="account-modal-backdrop">
          <section
            className="account-confirm-modal"
            role="dialog"
            aria-modal="true"
          >
            <span className="account-confirm-icon">
              <Archive
                size={23}
              />
            </span>

            <h2>
              Arquivar conta?
            </h2>

            <p>
              A conta{' '}
              <strong>
                {
                  archiveTarget.name
                }
              </strong>{' '}
              deixará de aparecer entre
              as contas ativas. O
              histórico financeiro será
              preservado.
            </p>

            <div className="account-confirm-actions">
              <button
                type="button"
                className="account-secondary-button"
                onClick={() =>
                  setArchiveTarget(
                    null,
                  )
                }
                disabled={
                  archiving
                }
              >
                Cancelar
              </button>

              <button
                type="button"
                className="account-danger-button"
                onClick={() =>
                  void confirmArchive()
                }
                disabled={
                  archiving
                }
              >
                {archiving
                  ? 'Arquivando...'
                  : 'Arquivar conta'}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default AccountsPage;