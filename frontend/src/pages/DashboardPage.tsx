import {
  ArrowDownRight,
  ArrowUpRight,
  CircleDollarSign,
  CreditCard,
  PiggyBank,
  ReceiptText,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ApiError,
  getDashboard,
} from '../lib/api';

import {
  formatCurrency,
  formatDate,
  formatPercentage,
  toNumber,
} from '../lib/format';

import {
  useAppShell,
} from '../hooks/useAppShell';

import type {
  DashboardData,
} from '../types/api';

const monthNames = [
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

function getCurrentPeriod() {
  const date =
    new Date();

  return {
    month:
      date.getMonth() + 1,
    year:
      date.getFullYear(),
  };
}

function DashboardPage() {
  const {
    token,
    workspace,
    onLogout,
  } = useAppShell();

  const currentPeriod =
    getCurrentPeriod();

  const [
    month,
    setMonth,
  ] = useState(
    currentPeriod.month,
  );

  const [
    year,
    setYear,
  ] = useState(
    currentPeriod.year,
  );

  const [
    dashboard,
    setDashboard,
  ] =
    useState<DashboardData | null>(
      null,
    );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      setLoading(true);
      setError('');

      try {
        const data =
          await getDashboard(
            token,
            workspace.id,
            {
              month,
              year,
            },
          );

        if (!cancelled) {
          setDashboard(data);
        }
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
            : 'Não foi possível carregar o dashboard.',
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [
    token,
    workspace.id,
    month,
    year,
    onLogout,
  ]);

  const maxMonthlyValue =
    useMemo(
      () =>
        Math.max(
          1,
          ...(
            dashboard
              ?.monthlyEvolution ??
            []
          ).flatMap(
            (item) => [
              toNumber(
                item.income,
              ),
              toNumber(
                item.expense,
              ),
            ],
          ),
        ),
      [dashboard],
    );

  if (
    !dashboard &&
    loading
  ) {
    return (
      <main className="dashboard-content">
        <section className="panel">
          <div className="empty-state">
            <div className="loading-logo">
              F
            </div>

            <strong>
              Carregando dashboard
            </strong>

            <span>
              Buscando seus dados
              financeiros...
            </span>
          </div>
        </section>
      </main>
    );
  }

  if (
    !dashboard &&
    error
  ) {
    return (
      <main className="dashboard-content">
        <section className="panel">
          <div className="empty-state">
            <strong>
              Não foi possível carregar
              o dashboard
            </strong>

            <span>
              {error}
            </span>
          </div>
        </section>
      </main>
    );
  }

  if (!dashboard) {
    return null;
  }

  const currentMonth =
    dashboard.monthlyEvolution[
      dashboard.monthlyEvolution.length -
        1
    ];

  return (
    <main
      className={
        loading
          ? 'dashboard-content dashboard-loading'
          : 'dashboard-content'
      }
    >
      <section className="dashboard-heading">
        <div>
          <h2>
            Seu painel financeiro
          </h2>

          <p>
            Acompanhe sua saúde
            financeira em tempo real.
          </p>
        </div>

        <div className="period-controls">
          <select
            value={month}
            onChange={(event) =>
              setMonth(
                Number(
                  event.target.value,
                ),
              )
            }
          >
            {monthNames.map(
              (
                monthName,
                index,
              ) => (
                <option
                  key={
                    monthName
                  }
                  value={
                    index + 1
                  }
                >
                  {
                    monthName
                  }
                </option>
              ),
            )}
          </select>

          <select
            value={year}
            onChange={(event) =>
              setYear(
                Number(
                  event.target.value,
                ),
              )
            }
          >
            {[
              year - 2,
              year - 1,
              year,
              year + 1,
            ].map(
              (optionYear) => (
                <option
                  key={
                    optionYear
                  }
                  value={
                    optionYear
                  }
                >
                  {
                    optionYear
                  }
                </option>
              ),
            )}
          </select>
        </div>
      </section>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <section className="summary-grid">
        <article className="summary-card">
          <div className="summary-card-header">
            <span className="summary-icon balance">
              <CircleDollarSign
                size={20}
              />
            </span>

            <span className="summary-label">
              Saldo total
            </span>
          </div>

          <strong className="summary-value">
            {formatCurrency(
              dashboard.totalBalance,
            )}
          </strong>

          <div className="summary-footer">
            <span className="neutral-pill">
              {
                dashboard.accountCount
              }{' '}
              {dashboard.accountCount ===
              1
                ? 'conta'
                : 'contas'}
            </span>

            <span>
              Disponível
            </span>
          </div>
        </article>

        <article className="summary-card">
          <div className="summary-card-header">
            <span className="summary-icon income">
              <TrendingUp
                size={20}
              />
            </span>

            <span className="summary-label">
              Receitas
            </span>
          </div>

          <strong className="summary-value">
            {formatCurrency(
              dashboard.totalIncome,
            )}
          </strong>

          <div className="summary-footer">
            <span className="positive-pill">
              <ArrowUpRight
                size={14}
              />

              {
                monthNames[
                  month - 1
                ]
              }
            </span>

            <span>
              Entradas
            </span>
          </div>
        </article>

        <article className="summary-card">
          <div className="summary-card-header">
            <span className="summary-icon expense">
              <TrendingDown
                size={20}
              />
            </span>

            <span className="summary-label">
              Despesas
            </span>
          </div>

          <strong className="summary-value">
            {formatCurrency(
              dashboard.totalExpense,
            )}
          </strong>

          <div className="summary-footer">
            <span className="negative-pill">
              <ArrowDownRight
                size={14}
              />

              {
                monthNames[
                  month - 1
                ]
              }
            </span>

            <span>
              Saídas
            </span>
          </div>
        </article>

        <article className="summary-card highlight">
          <div className="summary-card-header">
            <span className="summary-icon result">
              <PiggyBank
                size={20}
              />
            </span>

            <span className="summary-label">
              Resultado
            </span>
          </div>

          <strong className="summary-value">
            {formatCurrency(
              dashboard.netResult,
            )}
          </strong>

          <div className="summary-footer">
            <span className="positive-pill">
              {formatPercentage(
                dashboard.savingsRate,
              )}
            </span>

            <span>
              Taxa de economia
            </span>
          </div>
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="panel chart-panel">
          <div className="panel-header">
            <div>
              <h3>
                Evolução financeira
              </h3>

              <p>
                Receitas e despesas
                dos últimos 6 meses
              </p>
            </div>

            <div className="chart-legend">
              <span>
                <i className="legend-income" />
                Receitas
              </span>

              <span>
                <i className="legend-expense" />
                Despesas
              </span>
            </div>
          </div>

          <div className="bar-chart">
            {dashboard.monthlyEvolution.map(
              (item) => {
                const income =
                  toNumber(
                    item.income,
                  );

                const expense =
                  toNumber(
                    item.expense,
                  );

                const incomeHeight =
                  Math.max(
                    3,
                    (income /
                      maxMonthlyValue) *
                      100,
                  );

                const expenseHeight =
                  Math.max(
                    3,
                    (expense /
                      maxMonthlyValue) *
                      100,
                  );

                return (
                  <div
                    className="bar-group"
                    key={`${item.year}-${item.month}`}
                  >
                    <div className="bars">
                      <div
                        className="bar income-bar"
                        style={{
                          height:
                            `${incomeHeight}%`,
                        }}
                        title={`Receitas: ${formatCurrency(item.income)}`}
                      />

                      <div
                        className="bar expense-bar"
                        style={{
                          height:
                            `${expenseHeight}%`,
                        }}
                        title={`Despesas: ${formatCurrency(item.expense)}`}
                      />
                    </div>

                    <span>
                      {monthNames[
                        item.month -
                          1
                      ].slice(
                        0,
                        3,
                      )}
                    </span>
                  </div>
                );
              },
            )}
          </div>

          {currentMonth && (
            <div className="chart-summary">
              <div>
                <span>
                  Resultado do mês
                </span>

                <strong>
                  {formatCurrency(
                    currentMonth.netResult,
                  )}
                </strong>
              </div>

              <span className="chart-summary-badge">
                {
                  monthNames[
                    currentMonth.month -
                      1
                  ]
                }
              </span>
            </div>
          )}
        </article>

        <article className="panel expenses-panel">
          <div className="panel-header">
            <div>
              <h3>
                Gastos por categoria
              </h3>

              <p>
                Onde seu dinheiro
                está indo
              </p>
            </div>
          </div>

          <div className="category-list">
            {dashboard.expenseByCategory
              .slice(0, 5)
              .map(
                (
                  category,
                  index,
                ) => (
                  <div
                    className="category-row"
                    key={
                      category.categoryId ??
                      category.categoryName
                    }
                  >
                    <div className="category-rank">
                      {index +
                        1}
                    </div>

                    <div className="category-content">
                      <div className="category-copy">
                        <span>
                          {
                            category.categoryName
                          }
                        </span>

                        <strong>
                          {formatCurrency(
                            category.amount,
                          )}
                        </strong>
                      </div>

                      <div className="progress-track">
                        <span
                          style={{
                            width:
                              `${Math.min(
                                100,
                                toNumber(
                                  category.percentage,
                                ),
                              )}%`,
                          }}
                        />
                      </div>
                    </div>

                    <span className="category-percentage">
                      {formatPercentage(
                        category.percentage,
                      )}
                    </span>
                  </div>
                ),
              )}

            {dashboard.expenseByCategory
              .length ===
              0 && (
              <div className="empty-state compact">
                <PiggyBank
                  size={28}
                />

                <strong>
                  Nenhuma despesa
                </strong>

                <span>
                  Seus gastos do mês
                  aparecerão aqui.
                </span>
              </div>
            )}
          </div>
        </article>
      </section>

      <section className="dashboard-grid lower-grid">
        <article className="panel transactions-panel">
          <div className="panel-header">
            <div>
              <h3>
                Transações recentes
              </h3>

              <p>
                Últimas movimentações
                do período
              </p>
            </div>
          </div>

          <div className="transaction-list">
            {dashboard.recentTransactions
              .slice(0, 6)
              .map(
                (
                  transaction,
                ) => {
                  const amount =
                    transaction.entries.reduce(
                      (
                        total,
                        entry,
                      ) =>
                        total +
                        toNumber(
                          entry.amount,
                        ),
                      0,
                    );

                  const income =
                    transaction.type ===
                    'INCOME';

                  return (
                    <div
                      className="transaction-row"
                      key={
                        transaction.id
                      }
                    >
                      <div
                        className={
                          income
                            ? 'transaction-icon income'
                            : 'transaction-icon expense'
                        }
                      >
                        {income ? (
                          <ArrowDownRight
                            size={
                              18
                            }
                          />
                        ) : (
                          <ArrowUpRight
                            size={
                              18
                            }
                          />
                        )}
                      </div>

                      <div className="transaction-info">
                        <strong>
                          {
                            transaction.description
                          }
                        </strong>

                        <span>
                          {transaction
                            .category
                            ?.name ??
                            'Sem categoria'}
                          {' • '}
                          {formatDate(
                            transaction.transactionDate,
                          )}
                        </span>
                      </div>

                      <strong
                        className={
                          income
                            ? 'transaction-amount income-text'
                            : 'transaction-amount expense-text'
                        }
                      >
                        {income
                          ? '+ '
                          : '- '}
                        {formatCurrency(
                          amount,
                        )}
                      </strong>
                    </div>
                  );
                },
              )}

            {dashboard.recentTransactions
              .length ===
              0 && (
              <div className="empty-state">
                <ReceiptText
                  size={32}
                />

                <strong>
                  Nenhuma transação
                </strong>

                <span>
                  As movimentações
                  aparecerão aqui.
                </span>
              </div>
            )}
          </div>
        </article>

        <article className="panel credit-panel">
          <div className="panel-header">
            <div>
              <h3>
                Cartões de crédito
              </h3>

              <p>
                Visão consolidada dos
                seus limites
              </p>
            </div>
          </div>

          <div className="credit-summary">
            <span>
              Limite disponível
            </span>

            <strong>
              {formatCurrency(
                dashboard
                  .creditCards
                  .totalCreditAvailable,
              )}
            </strong>

            <div className="credit-limit-bar">
              <span
                style={{
                  width:
                    toNumber(
                      dashboard
                        .creditCards
                        .totalCreditLimit,
                    ) > 0
                      ? `${Math.min(
                          100,
                          (toNumber(
                            dashboard
                              .creditCards
                              .totalCreditUsed,
                          ) /
                            toNumber(
                              dashboard
                                .creditCards
                                .totalCreditLimit,
                            )) *
                            100,
                        )}%`
                      : '0%',
                }}
              />
            </div>

            <div className="credit-meta">
              <span>
                Usado{' '}
                <strong>
                  {formatCurrency(
                    dashboard
                      .creditCards
                      .totalCreditUsed,
                  )}
                </strong>
              </span>

              <span>
                Total{' '}
                <strong>
                  {formatCurrency(
                    dashboard
                      .creditCards
                      .totalCreditLimit,
                  )}
                </strong>
              </span>
            </div>
          </div>

          <div className="mini-card-list">
            {dashboard.creditCards.cards
              .slice(0, 3)
              .map(
                (card) => (
                  <div
                    className="mini-card"
                    key={
                      card.id
                    }
                  >
                    <div className="mini-card-icon">
                      <CreditCard
                        size={18}
                      />
                    </div>

                    <div>
                      <strong>
                        {card.name}
                      </strong>

                      <span>
                        Fecha dia{' '}
                        {
                          card.closingDay
                        }
                      </span>
                    </div>

                    <strong className="mini-card-value">
                      {formatCurrency(
                        card.availableLimit,
                        card.currency,
                      )}
                    </strong>
                  </div>
                ),
              )}

            {dashboard.creditCards
              .count === 0 && (
              <div className="empty-state compact">
                <CreditCard
                  size={28}
                />

                <strong>
                  Nenhum cartão
                </strong>

                <span>
                  Seus cartões
                  aparecerão aqui.
                </span>
              </div>
            )}
          </div>
        </article>
      </section>

      {dashboard.budgets.length >
        0 && (
        <section className="panel budgets-panel">
          <div className="panel-header">
            <div>
              <h3>
                Orçamentos do mês
              </h3>

              <p>
                Acompanhe seus limites
                planejados
              </p>
            </div>
          </div>

          <div className="budget-grid">
            {dashboard.budgets.map(
              (budget) => (
                <div
                  className="budget-card"
                  key={
                    budget.id
                  }
                >
                  <div className="budget-card-top">
                    <div>
                      <strong>
                        {
                          budget.categoryName
                        }
                      </strong>

                      <span>
                        {formatCurrency(
                          budget.spent,
                        )}{' '}
                        de{' '}
                        {formatCurrency(
                          budget.budget,
                        )}
                      </span>
                    </div>

                    <span
                      className={`budget-status ${budget.status.toLowerCase()}`}
                    >
                      {budget.status ===
                      'ON_TRACK'
                        ? 'No controle'
                        : budget.status ===
                            'WARNING'
                          ? 'Atenção'
                          : 'Excedido'}
                    </span>
                  </div>

                  <div className="budget-progress">
                    <span
                      style={{
                        width:
                          `${Math.min(
                            100,
                            toNumber(
                              budget.percentageUsed,
                            ),
                          )}%`,
                      }}
                    />
                  </div>

                  <div className="budget-footer">
                    <span>
                      {formatPercentage(
                        budget.percentageUsed,
                      )}{' '}
                      utilizado
                    </span>

                    <strong>
                      {formatCurrency(
                        budget.remaining,
                      )}{' '}
                      restante
                    </strong>
                  </div>
                </div>
              ),
            )}
          </div>
        </section>
      )}
    </main>
  );
}

export default DashboardPage;