import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  PiggyBank,
  Printer,
  ReceiptText,
  Sparkles,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from 'lucide-react';

import {
  useCallback,
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
  toNumber,
} from '../lib/format';

import {
  useAppShell,
} from '../hooks/useAppShell';

import type {
  Currency,
  DashboardData,
  DashboardMonth,
} from '../types/api';

import './ReportsPage.css';

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
] as const;

const SHORT_MONTHS = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
] as const;

interface AnnualMonth {
  month: number;
  income: number;
  expense: number;
  netResult: number;
}

function getCurrentPeriod() {
  const now = new Date();

  return {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  };
}

function normalizeCurrency(
  value: string,
): Currency {
  if (
    value === 'USD' ||
    value === 'EUR'
  ) {
    return value;
  }

  return 'BRL';
}

function formatPercent(
  value: number | null,
) {
  if (
    value === null ||
    !Number.isFinite(value)
  ) {
    return '—';
  }

  return `${value.toFixed(1)}%`;
}

function getTransactionAmount(
  entries: Array<{
    amount: string | number;
  }>,
) {
  return entries.reduce(
    (total, entry) =>
      total + toNumber(entry.amount),
    0,
  );
}

function ReportsPage() {
  const {
    token,
    workspace,
    onLogout,
  } = useAppShell();

  const currentPeriod =
    useMemo(
      () => getCurrentPeriod(),
      [],
    );

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
    periodData,
    setPeriodData,
  ] = useState<
    DashboardData | null
  >(null);

  const [
    overviewData,
    setOverviewData,
  ] = useState<
    DashboardData | null
  >(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState('');

  const handleRequestError =
    useCallback(
      (requestError: unknown) => {
        if (
          requestError instanceof
            ApiError &&
          requestError.statusCode ===
            401
        ) {
          onLogout();
          return;
        }

        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Não foi possível carregar os relatórios.',
        );
      },
      [onLogout],
    );

  const loadReports =
    useCallback(async () => {
      setLoading(true);
      setError('');

      try {
        const [
          selectedPeriod,
          overview,
        ] = await Promise.all([
          getDashboard(
            token,
            workspace.id,
            {
              month,
              year,
            },
          ),
          getDashboard(
            token,
            workspace.id,
          ),
        ]);

        setPeriodData(
          selectedPeriod,
        );
        setOverviewData(
          overview,
        );
      } catch (requestError) {
        handleRequestError(
          requestError,
        );
      } finally {
        setLoading(false);
      }
    }, [
      token,
      workspace.id,
      month,
      year,
      handleRequestError,
    ]);

  useEffect(() => {
    const timeoutId =
      window.setTimeout(
        () => {
          void loadReports();
        },
        0,
      );

    return () => {
      window.clearTimeout(
        timeoutId,
      );
    };
  }, [loadReports]);

  const yearOptions =
    useMemo(() => {
      const years = new Set<number>([
        currentPeriod.year,
        year,
      ]);

      for (
        const item of
        overviewData?.monthlyEvolution ?? []
      ) {
        years.add(item.year);
      }

      return Array.from(years)
        .sort((a, b) => b - a);
    }, [
      overviewData,
      currentPeriod.year,
      year,
    ]);

  const annualMonths =
    useMemo<AnnualMonth[]>(() => {
      const byMonth = new Map<
        number,
        DashboardMonth
      >();

      for (
        const item of
        overviewData?.monthlyEvolution ?? []
      ) {
        if (item.year === year) {
          byMonth.set(
            item.month,
            item,
          );
        }
      }

      return Array.from(
        { length: 12 },
        (_, index) => {
          const monthNumber =
            index + 1;
          const item =
            byMonth.get(
              monthNumber,
            );

          const income =
            item
              ? toNumber(
                  item.income,
                )
              : 0;
          const expense =
            item
              ? toNumber(
                  item.expense,
                )
              : 0;

          return {
            month: monthNumber,
            income,
            expense,
            netResult:
              income - expense,
          };
        },
      );
    }, [overviewData, year]);

  const annualStats =
    useMemo(() => {
      const income =
        annualMonths.reduce(
          (total, item) =>
            total + item.income,
          0,
        );

      const expense =
        annualMonths.reduce(
          (total, item) =>
            total + item.expense,
          0,
        );

      const netResult =
        income - expense;

      const savingsRate =
        income > 0
          ? (netResult / income) *
            100
          : null;

      return {
        income,
        expense,
        netResult,
        savingsRate,
      };
    }, [annualMonths]);

  const chartMax =
    useMemo(() => {
      const values =
        annualMonths.flatMap(
          (item) => [
            item.income,
            item.expense,
          ],
        );

      return Math.max(
        ...values,
        1,
      );
    }, [annualMonths]);

  const periodStats =
    useMemo(() => {
      if (!periodData) {
        return null;
      }

      return {
        income: toNumber(
          periodData.totalIncome,
        ),
        expense: toNumber(
          periodData.totalExpense,
        ),
        netResult: toNumber(
          periodData.netResult,
        ),
        savingsRate:
          periodData.savingsRate ===
          null
            ? null
            : toNumber(
                periodData.savingsRate,
              ),
      };
    }, [periodData]);

  const topCategories =
    useMemo(() => {
      return [
        ...(periodData
          ?.expenseByCategory ?? []),
      ]
        .sort(
          (a, b) =>
            toNumber(b.amount) -
            toNumber(a.amount),
        )
        .slice(0, 6);
    }, [periodData]);

  const activeAccounts =
    useMemo(() => {
      return (
        overviewData?.accounts ?? []
      )
        .filter(
          (account) =>
            account.type !==
            'CREDIT_CARD',
        )
        .sort(
          (a, b) =>
            toNumber(b.balance) -
            toNumber(a.balance),
        )
        .slice(0, 6);
    }, [overviewData]);

  const insights =
    useMemo(() => {
      if (!periodStats) {
        return [];
      }

      const category =
        topCategories[0];

      const items = [
        {
          title:
            'Resultado do período',
          description:
            periodStats.netResult >= 0
              ? `Você fechou ${MONTHS[month - 1].toLowerCase()} com saldo positivo de ${formatCurrency(periodStats.netResult, 'BRL')}.`
              : `As despesas superaram as receitas em ${formatCurrency(Math.abs(periodStats.netResult), 'BRL')} neste período.`,
          tone:
            periodStats.netResult >= 0
              ? 'positive'
              : 'negative',
        },
        {
          title:
            'Taxa de economia',
          description:
            periodStats.savingsRate ===
            null
              ? 'Não houve receita suficiente no período para calcular a taxa de economia.'
              : `A taxa de economia ficou em ${formatPercent(periodStats.savingsRate)} das receitas do mês.`,
          tone:
            periodStats.savingsRate !==
              null &&
            periodStats.savingsRate >=
              20
              ? 'positive'
              : 'neutral',
        },
        {
          title:
            'Maior categoria',
          description:
            category
              ? `${category.categoryName} concentrou ${formatPercent(toNumber(category.percentage))} das despesas, totalizando ${formatCurrency(toNumber(category.amount), 'BRL')}.`
              : 'Ainda não há despesas categorizadas neste período.',
          tone: 'neutral',
        },
      ];

      return items;
    }, [
      periodStats,
      topCategories,
      month,
    ]);

  function movePeriod(
    direction: -1 | 1,
  ) {
    const next = new Date(
      Date.UTC(
        year,
        month - 1 + direction,
        1,
      ),
    );

    setMonth(
      next.getUTCMonth() + 1,
    );
    setYear(
      next.getUTCFullYear(),
    );
  }

  function goToCurrentMonth() {
    setMonth(
      currentPeriod.month,
    );
    setYear(
      currentPeriod.year,
    );
  }

  const isCurrentPeriod =
    month === currentPeriod.month &&
    year === currentPeriod.year;

  if (
    loading &&
    !periodData
  ) {
    return (
      <section className="reports-page reports-loading-state">
        <div className="reports-loading-card">
          <span className="reports-loading-icon">
            <BarChart3 size={22} />
          </span>
          <strong>
            Preparando relatórios...
          </strong>
          <p>
            Consolidando receitas,
            despesas e evolução financeira.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="reports-page">
      <header className="reports-hero">
        <div>
          <span className="reports-eyebrow">
            VISÃO ANALÍTICA
          </span>

          <h1>
            Relatórios financeiros
          </h1>

          <p>
            Entenda para onde seu dinheiro
            está indo e acompanhe a evolução
            das suas finanças ao longo do
            tempo.
          </p>
        </div>

        <div className="reports-hero-actions">
          <button
            type="button"
            className="reports-print-button"
            onClick={() =>
              window.print()
            }
          >
            <Printer size={17} />
            Imprimir relatório
          </button>
        </div>
      </header>

      <div className="reports-period-card">
        <div className="reports-period-title">
          <CalendarDays size={18} />
          <div>
            <span>
              Período analisado
            </span>
            <strong>
              {MONTHS[month - 1]} de {year}
            </strong>
          </div>
        </div>

        <div className="reports-period-controls">
          <button
            type="button"
            className="reports-icon-button"
            aria-label="Mês anterior"
            onClick={() =>
              movePeriod(-1)
            }
          >
            <ChevronLeft size={18} />
          </button>

          <select
            aria-label="Mês"
            value={month}
            onChange={(event) =>
              setMonth(
                Number(
                  event.target.value,
                ),
              )
            }
          >
            {MONTHS.map(
              (monthName, index) => (
                <option
                  key={monthName}
                  value={index + 1}
                >
                  {monthName}
                </option>
              ),
            )}
          </select>

          <select
            aria-label="Ano"
            value={year}
            onChange={(event) =>
              setYear(
                Number(
                  event.target.value,
                ),
              )
            }
          >
            {yearOptions.map(
              (yearOption) => (
                <option
                  key={yearOption}
                  value={yearOption}
                >
                  {yearOption}
                </option>
              ),
            )}
          </select>

          <button
            type="button"
            className="reports-icon-button"
            aria-label="Próximo mês"
            onClick={() =>
              movePeriod(1)
            }
          >
            <ChevronRight size={18} />
          </button>

          <button
            type="button"
            className="reports-current-button"
            disabled={isCurrentPeriod}
            onClick={
              goToCurrentMonth
            }
          >
            Mês atual
          </button>
        </div>
      </div>

      {error && (
        <div
          className="reports-error"
          role="alert"
        >
          {error}
        </div>
      )}

      {periodStats && (
        <div className="reports-stat-grid">
          <article className="reports-stat-card income">
            <span className="reports-stat-icon">
              <ArrowUpRight size={19} />
            </span>
            <div>
              <span>Receitas</span>
              <strong>
                {formatCurrency(
                  periodStats.income,
                  'BRL',
                )}
              </strong>
              <small>
                Entradas no período
              </small>
            </div>
          </article>

          <article className="reports-stat-card expense">
            <span className="reports-stat-icon">
              <ArrowDownRight size={19} />
            </span>
            <div>
              <span>Despesas</span>
              <strong>
                {formatCurrency(
                  periodStats.expense,
                  'BRL',
                )}
              </strong>
              <small>
                Saídas no período
              </small>
            </div>
          </article>

          <article
            className={`reports-stat-card result ${
              periodStats.netResult < 0
                ? 'negative'
                : 'positive'
            }`}
          >
            <span className="reports-stat-icon">
              <CircleDollarSign
                size={19}
              />
            </span>
            <div>
              <span>Resultado</span>
              <strong>
                {formatCurrency(
                  periodStats.netResult,
                  'BRL',
                )}
              </strong>
              <small>
                Receitas menos despesas
              </small>
            </div>
          </article>

          <article className="reports-stat-card savings">
            <span className="reports-stat-icon">
              <PiggyBank size={19} />
            </span>
            <div>
              <span>
                Taxa de economia
              </span>
              <strong>
                {formatPercent(
                  periodStats.savingsRate,
                )}
              </strong>
              <small>
                Percentual poupado
              </small>
            </div>
          </article>
        </div>
      )}

      <div className="reports-main-grid">
        <article className="reports-panel reports-evolution-panel">
          <div className="reports-panel-heading">
            <div>
              <span className="reports-panel-kicker">
                EVOLUÇÃO ANUAL
              </span>
              <h2>
                Receitas x despesas em {year}
              </h2>
              <p>
                Compare mês a mês o comportamento
                das suas entradas e saídas.
              </p>
            </div>

            <div className="reports-chart-legend">
              <span>
                <i className="income" />
                Receitas
              </span>
              <span>
                <i className="expense" />
                Despesas
              </span>
            </div>
          </div>

          <div className="reports-annual-summary">
            <div>
              <span>
                Receitas no ano
              </span>
              <strong>
                {formatCurrency(
                  annualStats.income,
                  'BRL',
                )}
              </strong>
            </div>
            <div>
              <span>
                Despesas no ano
              </span>
              <strong>
                {formatCurrency(
                  annualStats.expense,
                  'BRL',
                )}
              </strong>
            </div>
            <div>
              <span>
                Resultado anual
              </span>
              <strong
                className={
                  annualStats.netResult < 0
                    ? 'negative'
                    : 'positive'
                }
              >
                {formatCurrency(
                  annualStats.netResult,
                  'BRL',
                )}
              </strong>
            </div>
            <div>
              <span>
                Economia anual
              </span>
              <strong>
                {formatPercent(
                  annualStats.savingsRate,
                )}
              </strong>
            </div>
          </div>

          <div className="reports-chart-shell">
            <div className="reports-chart-gridlines">
              <span />
              <span />
              <span />
              <span />
            </div>

            <div className="reports-chart-bars">
              {annualMonths.map(
                (item) => {
                  const incomeHeight =
                    item.income > 0
                      ? Math.max(
                          (item.income /
                            chartMax) *
                            100,
                          4,
                        )
                      : 0;

                  const expenseHeight =
                    item.expense > 0
                      ? Math.max(
                          (item.expense /
                            chartMax) *
                            100,
                          4,
                        )
                      : 0;

                  return (
                    <div
                      className={`reports-chart-month ${
                        item.month === month
                          ? 'selected'
                          : ''
                      }`}
                      key={item.month}
                    >
                      <div className="reports-chart-bar-area">
                        <span
                          className="reports-chart-bar income"
                          title={`Receitas: ${formatCurrency(item.income, 'BRL')}`}
                          style={{
                            height:
                              `${incomeHeight}%`,
                          }}
                        />
                        <span
                          className="reports-chart-bar expense"
                          title={`Despesas: ${formatCurrency(item.expense, 'BRL')}`}
                          style={{
                            height:
                              `${expenseHeight}%`,
                          }}
                        />
                      </div>

                      <span className="reports-chart-label">
                        {SHORT_MONTHS[
                          item.month - 1
                        ]}
                      </span>
                    </div>
                  );
                },
              )}
            </div>
          </div>
        </article>

        <article className="reports-panel reports-category-panel">
          <div className="reports-panel-heading compact">
            <div>
              <span className="reports-panel-kicker">
                DESPESAS
              </span>
              <h2>
                Por categoria
              </h2>
              <p>
                Onde você mais gastou em {MONTHS[month - 1].toLowerCase()}.
              </p>
            </div>
          </div>

          {topCategories.length === 0 ? (
            <div className="reports-empty-state small">
              <ReceiptText size={26} />
              <strong>
                Sem despesas no período
              </strong>
              <span>
                As categorias aparecerão aqui
                quando houver movimentações.
              </span>
            </div>
          ) : (
            <div className="reports-category-list">
              {topCategories.map(
                (category, index) => {
                  const percentage =
                    toNumber(
                      category.percentage,
                    );

                  return (
                    <div
                      className="reports-category-item"
                      key={
                        category.categoryId ??
                        `uncategorized-${index}`
                      }
                    >
                      <div className="reports-category-copy">
                        <div>
                          <span className="reports-category-rank">
                            {String(
                              index + 1,
                            ).padStart(
                              2,
                              '0',
                            )}
                          </span>
                          <strong>
                            {
                              category.categoryName
                            }
                          </strong>
                        </div>

                        <div>
                          <strong>
                            {formatCurrency(
                              toNumber(
                                category.amount,
                              ),
                              'BRL',
                            )}
                          </strong>
                          <span>
                            {percentage.toFixed(
                              1,
                            )}%
                          </span>
                        </div>
                      </div>

                      <div className="reports-category-track">
                        <span
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
                  );
                },
              )}
            </div>
          )}
        </article>
      </div>

      <div className="reports-secondary-grid">
        <article className="reports-panel">
          <div className="reports-panel-heading compact">
            <div>
              <span className="reports-panel-kicker">
                LEITURAS RÁPIDAS
              </span>
              <h2>
                Insights do período
              </h2>
            </div>
            <Sparkles size={19} />
          </div>

          <div className="reports-insights-list">
            {insights.map(
              (insight) => (
                <div
                  className={`reports-insight ${insight.tone}`}
                  key={insight.title}
                >
                  <span className="reports-insight-icon">
                    {insight.tone ===
                    'positive' ? (
                      <TrendingUp
                        size={18}
                      />
                    ) : insight.tone ===
                      'negative' ? (
                      <TrendingDown
                        size={18}
                      />
                    ) : (
                      <BarChart3
                        size={18}
                      />
                    )}
                  </span>
                  <div>
                    <strong>
                      {insight.title}
                    </strong>
                    <p>
                      {
                        insight.description
                      }
                    </p>
                  </div>
                </div>
              ),
            )}
          </div>
        </article>

        <article className="reports-panel">
          <div className="reports-panel-heading compact">
            <div>
              <span className="reports-panel-kicker">
                PATRIMÔNIO
              </span>
              <h2>
                Posição das contas
              </h2>
              <p>
                Saldos atuais das suas principais contas.
              </p>
            </div>
            <WalletCards size={19} />
          </div>

          {activeAccounts.length === 0 ? (
            <div className="reports-empty-state small">
              <WalletCards size={26} />
              <strong>
                Nenhuma conta disponível
              </strong>
            </div>
          ) : (
            <div className="reports-account-list">
              {activeAccounts.map(
                (account) => {
                  const balance =
                    toNumber(
                      account.balance,
                    );

                  return (
                    <div
                      className="reports-account-item"
                      key={account.id}
                    >
                      <span className="reports-account-icon">
                        <WalletCards
                          size={17}
                        />
                      </span>

                      <div className="reports-account-copy">
                        <strong>
                          {account.name}
                        </strong>
                        <span>
                          {account.type}
                        </span>
                      </div>

                      <strong
                        className={
                          balance < 0
                            ? 'negative'
                            : undefined
                        }
                      >
                        {formatCurrency(
                          balance,
                          normalizeCurrency(
                            account.currency,
                          ),
                        )}
                      </strong>
                    </div>
                  );
                },
              )}
            </div>
          )}
        </article>
      </div>

      <article className="reports-panel reports-transactions-panel">
        <div className="reports-panel-heading compact">
          <div>
            <span className="reports-panel-kicker">
              MOVIMENTAÇÕES
            </span>
            <h2>
              Transações recentes do período
            </h2>
            <p>
              Últimas receitas e despesas registradas em {MONTHS[month - 1].toLowerCase()}.
            </p>
          </div>
          <ReceiptText size={19} />
        </div>

        {(
          periodData?.recentTransactions ?? []
        ).length === 0 ? (
          <div className="reports-empty-state">
            <ReceiptText size={28} />
            <strong>
              Nenhuma movimentação encontrada
            </strong>
            <span>
              Quando houver transações neste
              período, elas aparecerão aqui.
            </span>
          </div>
        ) : (
          <div className="reports-transaction-list">
            {periodData?.recentTransactions.map(
              (transaction) => {
                const amount =
                  getTransactionAmount(
                    transaction.entries,
                  );
                const currency =
                  normalizeCurrency(
                    transaction.entries[0]
                      ?.account.currency ??
                      'BRL',
                  );
                const isIncome =
                  transaction.type ===
                  'INCOME';

                return (
                  <div
                    className="reports-transaction-item"
                    key={transaction.id}
                  >
                    <span
                      className={`reports-transaction-icon ${
                        isIncome
                          ? 'income'
                          : 'expense'
                      }`}
                    >
                      {isIncome ? (
                        <ArrowUpRight
                          size={17}
                        />
                      ) : (
                        <ArrowDownRight
                          size={17}
                        />
                      )}
                    </span>

                    <div className="reports-transaction-copy">
                      <strong>
                        {
                          transaction.description
                        }
                      </strong>
                      <span>
                        {transaction.category
                          ?.name ??
                          'Sem categoria'}
                        {' • '}
                        {new Intl.DateTimeFormat(
                          'pt-BR',
                          {
                            day: '2-digit',
                            month: 'short',
                            timeZone: 'UTC',
                          },
                        ).format(
                          new Date(
                            transaction.transactionDate,
                          ),
                        )}
                      </span>
                    </div>

                    <strong
                      className={`reports-transaction-value ${
                        isIncome
                          ? 'income'
                          : 'expense'
                      }`}
                    >
                      {isIncome
                        ? '+ '
                        : '- '}
                      {formatCurrency(
                        amount,
                        currency,
                      )}
                    </strong>
                  </div>
                );
              },
            )}
          </div>
        )}
      </article>

      <div className="reports-footer-note">
        <CircleDollarSign size={17} />
        <span>
          Os relatórios consideram apenas transações efetivadas. Movimentações estornadas não entram nos totais.
        </span>
      </div>
    </section>
  );
}

export default ReportsPage;
