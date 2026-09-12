import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  CreditCard,
  FileText,
  Pencil,
  Plus,
  ReceiptText,
  RotateCcw,
  WalletCards,
  X,
} from 'lucide-react';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import type { FormEvent } from 'react';

import {
  ApiError,
  archiveAccount,
  closeCreditCardInvoice,
  createAccount,
  createCreditCard,
  createCreditCardPurchase,
  getAccounts,
  getCategories,
  getCreditCard,
  getCreditCardInvoices,
  getCreditCardLimit,
  getTransactions,
  payCreditCardInvoice,
  updateCreditCardPurchase,
  voidCreditCardPurchase,
} from '../lib/api';

import {
  formatCurrency,
  formatDate,
  toNumber,
} from '../lib/format';

import { useAppShell } from '../hooks/useAppShell';

import type {
  Account,
  Category,
  CreditCard as CreditCardData,
  CreditCardInvoice,
  CreditCardLimit,
  Currency,
  FinancialTransaction,
} from '../types/api';

import './CreditCardsPage.css';

interface CreditCardView {
  account: Account;
  card: CreditCardData;
  limit: CreditCardLimit;
  invoices: CreditCardInvoice[];
}

interface CardFormState {
  name: string;
  currency: Currency;
  creditLimit: string;
  closingDay: string;
  dueDay: string;
}

interface PurchaseFormState {
  description: string;
  amount: string;
  transactionDate: string;
  categoryId: string;
}

interface PaymentFormState {
  paymentAccountId: string;
  paymentDate: string;
}

function getTodayInputValue() {
  const date = new Date();

  const timezoneOffset =
    date.getTimezoneOffset() * 60 * 1000;

  return new Date(
    date.getTime() - timezoneOffset,
  )
    .toISOString()
    .slice(0, 10);
}

function createEmptyCardForm(): CardFormState {
  return {
    name: '',
    currency: 'BRL',
    creditLimit: '',
    closingDay: '10',
    dueDay: '17',
  };
}

function createEmptyPurchaseForm(): PurchaseFormState {
  return {
    description: '',
    amount: '',
    transactionDate: getTodayInputValue(),
    categoryId: '',
  };
}

function createEmptyPaymentForm(): PaymentFormState {
  return {
    paymentAccountId: '',
    paymentDate: getTodayInputValue(),
  };
}

function getInvoiceStatusLabel(
  status: CreditCardInvoice['status'],
) {
  const labels = {
    OPEN: 'Aberta',
    CLOSED: 'Fechada',
    OVERDUE: 'Vencida',
    PAID: 'Paga',
  };

  return labels[status];
}

function getMonthLabel(
  month: number,
  year: number,
) {
  const date = new Date(
    Date.UTC(year, month - 1, 1),
  );

  const monthName =
    new Intl.DateTimeFormat(
      'pt-BR',
      {
        month: 'long',
        timeZone: 'UTC',
      },
    ).format(date);

  return `${monthName
    .charAt(0)
    .toUpperCase()}${monthName.slice(1)} ${year}`;
}

function CreditCardsPage() {
  const {
    token,
    workspace,
    onLogout,
  } = useAppShell();

  const [cards, setCards] =
    useState<CreditCardView[]>([]);

  const [accounts, setAccounts] =
    useState<Account[]>([]);

  const [categories, setCategories] =
    useState<Category[]>([]);

  const [transactions, setTransactions] =
    useState<FinancialTransaction[]>([]);

  const [
    selectedAccountId,
    setSelectedAccountId,
  ] = useState('');

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  const [success, setSuccess] =
    useState('');

  const [
    cardModalOpen,
    setCardModalOpen,
  ] = useState(false);

  const [cardForm, setCardForm] =
    useState<CardFormState>(
      createEmptyCardForm,
    );

  const [
    cardFormError,
    setCardFormError,
  ] = useState('');

  const [
    creatingCard,
    setCreatingCard,
  ] = useState(false);

  const [
    purchaseModalOpen,
    setPurchaseModalOpen,
  ] = useState(false);

  const [
    editingPurchase,
    setEditingPurchase,
  ] =
    useState<FinancialTransaction | null>(
      null,
    );

  const [
    purchaseForm,
    setPurchaseForm,
  ] =
    useState<PurchaseFormState>(
      createEmptyPurchaseForm,
    );

  const [
    purchaseFormError,
    setPurchaseFormError,
  ] = useState('');

  const [
    savingPurchase,
    setSavingPurchase,
  ] = useState(false);

  const [
    voidTarget,
    setVoidTarget,
  ] =
    useState<FinancialTransaction | null>(
      null,
    );

  const [
    voidingPurchase,
    setVoidingPurchase,
  ] = useState(false);

  const [
    closeTarget,
    setCloseTarget,
  ] =
    useState<CreditCardInvoice | null>(
      null,
    );

  const [
    closingInvoice,
    setClosingInvoice,
  ] = useState(false);

  const [
    paymentTarget,
    setPaymentTarget,
  ] =
    useState<CreditCardInvoice | null>(
      null,
    );

  const [
    paymentForm,
    setPaymentForm,
  ] =
    useState<PaymentFormState>(
      createEmptyPaymentForm,
    );

  const [
    paymentError,
    setPaymentError,
  ] = useState('');

  const [
    payingInvoice,
    setPayingInvoice,
  ] = useState(false);

  const canManage =
    workspace.role === 'OWNER' ||
    workspace.role === 'ADMIN' ||
    workspace.role === 'FINANCE';

  const handleUnauthorized =
    useCallback(
      (caughtError: unknown) => {
        if (
          caughtError instanceof ApiError &&
          caughtError.statusCode === 401
        ) {
          onLogout();

          return true;
        }

        return false;
      },
      [onLogout],
    );

  const loadData =
    useCallback(async () => {
      const [
        accountData,
        categoryData,
        transactionData,
      ] = await Promise.all([
        getAccounts(
          token,
          workspace.id,
        ),

        getCategories(
          token,
          workspace.id,
          'EXPENSE',
        ),

        getTransactions(
          token,
          workspace.id,
          true,
        ),
      ]);

      const cardAccounts =
        accountData.filter(
          (account) =>
            account.type ===
              'CREDIT_CARD' &&
            account.status ===
              'ACTIVE',
        );

      const cardResults =
        await Promise.all(
          cardAccounts.map(
            async (account) => {
              try {
                const [
                  card,
                  limit,
                  invoices,
                ] = await Promise.all([
                  getCreditCard(
                    token,
                    workspace.id,
                    account.id,
                  ),

                  getCreditCardLimit(
                    token,
                    workspace.id,
                    account.id,
                  ),

                  getCreditCardInvoices(
                    token,
                    workspace.id,
                    account.id,
                  ),
                ]);

                return {
                  account,
                  card,
                  limit,
                  invoices,
                } satisfies CreditCardView;
              } catch (caughtError) {
                if (
                  caughtError instanceof
                    ApiError &&
                  caughtError.statusCode ===
                    404
                ) {
                  return null;
                }

                throw caughtError;
              }
            },
          ),
        );

      const configuredCards =
        cardResults.filter(
          (
            item,
          ): item is CreditCardView =>
            item !== null,
        );

      setAccounts(accountData);
      setCategories(categoryData);
      setTransactions(transactionData);
      setCards(configuredCards);

      setSelectedAccountId(
        (current) => {
          if (
            configuredCards.some(
              (item) =>
                item.account.id ===
                current,
            )
          ) {
            return current;
          }

          return (
            configuredCards[0]
              ?.account.id ?? ''
          );
        },
      );
    }, [
      token,
      workspace.id,
    ]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setLoading(true);
      setError('');

      try {
        await loadData();
      } catch (caughtError) {
        if (cancelled) {
          return;
        }

        if (
          handleUnauthorized(
            caughtError,
          )
        ) {
          return;
        }

        setError(
          caughtError instanceof Error
            ? caughtError.message
            : 'Não foi possível carregar os cartões.',
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
    loadData,
    handleUnauthorized,
  ]);

  const selectedCard =
    useMemo(
      () =>
        cards.find(
          (item) =>
            item.account.id ===
            selectedAccountId,
        ) ?? null,
      [
        cards,
        selectedAccountId,
      ],
    );

  const selectedPurchases =
    useMemo(() => {
      if (!selectedCard) {
        return [];
      }

      return transactions.filter(
        (transaction) =>
          transaction.type ===
            'EXPENSE' &&
          transaction.entries.some(
            (entry) =>
              entry.accountId ===
              selectedCard.account.id,
          ),
      );
    }, [
      selectedCard,
      transactions,
    ]);

  const selectedInvoices =
    useMemo(
      () =>
        selectedCard
          ? selectedCard.invoices
          : [],
      [selectedCard],
    );

  const paymentAccounts =
    useMemo(() => {
      if (!selectedCard) {
        return [];
      }

      return accounts.filter(
        (account) =>
          account.status ===
            'ACTIVE' &&
          account.type !==
            'CREDIT_CARD' &&
          account.currency ===
            selectedCard.account
              .currency,
      );
    }, [
      accounts,
      selectedCard,
    ]);

  /*
   * Fatura atual deve representar
   * somente uma obrigação ainda ativa.
   *
   * Faturas PAGAS continuam aparecendo
   * no histórico, mas não entram mais
   * no card "Fatura atual".
   */
  const currentInvoice =
    useMemo(() => {
      return (
        selectedInvoices.find(
          (invoice) =>
            invoice.status ===
            'OPEN',
        ) ??
        selectedInvoices.find(
          (invoice) =>
            invoice.status ===
              'CLOSED' ||
            invoice.status ===
              'OVERDUE',
        ) ??
        null
      );
    }, [selectedInvoices]);

  function showError(
    caughtError: unknown,
    fallback: string,
  ) {
    if (
      handleUnauthorized(
        caughtError,
      )
    ) {
      return;
    }

    setError(
      caughtError instanceof Error
        ? caughtError.message
        : fallback,
    );
  }

  async function refresh() {
    await loadData();
  }

  function openCardModal() {
    if (!canManage) {
      return;
    }

    setCardForm(
      createEmptyCardForm(),
    );

    setCardFormError('');
    setCardModalOpen(true);
  }

  function closeCardModal() {
    if (creatingCard) {
      return;
    }

    setCardModalOpen(false);
    setCardFormError('');
  }

  async function handleCreateCard(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setCardFormError('');
    setError('');
    setSuccess('');

    const name =
      cardForm.name.trim();

    const creditLimit =
      Number(
        cardForm.creditLimit,
      );

    const closingDay =
      Number(
        cardForm.closingDay,
      );

    const dueDay =
      Number(
        cardForm.dueDay,
      );

    if (name.length < 2) {
      setCardFormError(
        'Informe um nome válido para o cartão.',
      );

      return;
    }

    if (
      !Number.isFinite(
        creditLimit,
      ) ||
      creditLimit <= 0
    ) {
      setCardFormError(
        'O limite deve ser maior que zero.',
      );

      return;
    }

    if (
      !Number.isInteger(
        closingDay,
      ) ||
      closingDay < 1 ||
      closingDay > 31
    ) {
      setCardFormError(
        'O dia de fechamento deve estar entre 1 e 31.',
      );

      return;
    }

    if (
      !Number.isInteger(
        dueDay,
      ) ||
      dueDay < 1 ||
      dueDay > 31
    ) {
      setCardFormError(
        'O dia de vencimento deve estar entre 1 e 31.',
      );

      return;
    }

    setCreatingCard(true);

    let createdAccount:
      | Account
      | null = null;

    try {
      createdAccount =
        await createAccount(
          token,
          workspace.id,
          {
            name,
            type: 'CREDIT_CARD',
            currency:
              cardForm.currency,
            initialBalance: 0,
          },
        );

      await createCreditCard(
        token,
        workspace.id,
        {
          accountId:
            createdAccount.id,
          creditLimit,
          closingDay,
          dueDay,
        },
      );

      await refresh();

      setCardModalOpen(false);

      setSuccess(
        'Cartão criado com sucesso.',
      );
    } catch (caughtError) {
      if (createdAccount) {
        try {
          await archiveAccount(
            token,
            workspace.id,
            createdAccount.id,
          );
        } catch {
          /*
           * O erro principal da criação
           * continua sendo o relevante.
           */
        }
      }

      if (
        handleUnauthorized(
          caughtError,
        )
      ) {
        return;
      }

      setCardFormError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Não foi possível criar o cartão.',
      );
    } finally {
      setCreatingCard(false);
    }
  }

  function openPurchaseModal() {
    if (
      !canManage ||
      !selectedCard
    ) {
      return;
    }

    setEditingPurchase(null);

    setPurchaseForm(
      createEmptyPurchaseForm(),
    );

    setPurchaseFormError('');
    setPurchaseModalOpen(true);
  }

  function getPurchaseInvoice(
    transaction:
      FinancialTransaction,
  ) {
    if (
      !transaction.invoiceId ||
      !selectedCard
    ) {
      return null;
    }

    return (
      selectedCard.invoices.find(
        (invoice) =>
          invoice.id ===
          transaction.invoiceId,
      ) ?? null
    );
  }

  function canEditPurchase(
    transaction:
      FinancialTransaction,
  ) {
    const invoice =
      getPurchaseInvoice(
        transaction,
      );

    return (
      canManage &&
      transaction.status ===
        'POSTED' &&
      transaction.type ===
        'EXPENSE' &&
      transaction.entries.length ===
        1 &&
      transaction.entries[0]
        ?.account.type ===
        'CREDIT_CARD' &&
      invoice?.status ===
        'OPEN'
    );
  }

  function openEditPurchase(
    transaction:
      FinancialTransaction,
  ) {
    if (
      !canEditPurchase(
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

    setEditingPurchase(
      transaction,
    );

    setPurchaseForm({
      description:
        transaction.description,

      amount: String(
        toNumber(
          entry.amount,
        ),
      ),

      transactionDate:
        transaction.transactionDate.slice(
          0,
          10,
        ),

      categoryId:
        transaction.categoryId ??
        '',
    });

    setPurchaseFormError('');
    setPurchaseModalOpen(true);
  }

  function closePurchaseModal() {
    if (savingPurchase) {
      return;
    }

    setPurchaseModalOpen(false);
    setEditingPurchase(null);
    setPurchaseFormError('');
  }

  async function handlePurchaseSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!selectedCard) {
      return;
    }

    setPurchaseFormError('');
    setError('');
    setSuccess('');

    const description =
      purchaseForm.description.trim();

    const amount =
      Number(
        purchaseForm.amount,
      );

    if (!description) {
      setPurchaseFormError(
        'Informe a descrição da compra.',
      );

      return;
    }

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      setPurchaseFormError(
        'Informe um valor maior que zero.',
      );

      return;
    }

    if (
      !purchaseForm.transactionDate
    ) {
      setPurchaseFormError(
        'Informe a data da compra.',
      );

      return;
    }

    setSavingPurchase(true);

    try {
      const transactionDate =
        `${purchaseForm.transactionDate}T12:00:00.000Z`;

      if (editingPurchase) {
        await updateCreditCardPurchase(
          token,
          workspace.id,
          editingPurchase.id,
          {
            description,
            amount,

            categoryId:
              purchaseForm.categoryId ||
              null,

            transactionDate,
          },
        );

        setSuccess(
          'Compra atualizada com sucesso.',
        );
      } else {
        await createCreditCardPurchase(
          token,
          workspace.id,
          selectedCard.account.id,
          {
            description,
            amount,

            ...(purchaseForm.categoryId
              ? {
                  categoryId:
                    purchaseForm.categoryId,
                }
              : {}),

            transactionDate,
          },
        );

        setSuccess(
          'Compra registrada com sucesso.',
        );
      }

      await refresh();

      setPurchaseModalOpen(false);
      setEditingPurchase(null);
    } catch (caughtError) {
      if (
        handleUnauthorized(
          caughtError,
        )
      ) {
        return;
      }

      setPurchaseFormError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Não foi possível salvar a compra.',
      );
    } finally {
      setSavingPurchase(false);
    }
  }

  async function confirmVoidPurchase() {
    if (!voidTarget) {
      return;
    }

    setVoidingPurchase(true);
    setError('');
    setSuccess('');

    try {
      await voidCreditCardPurchase(
        token,
        workspace.id,
        voidTarget.id,
      );

      await refresh();

      setVoidTarget(null);

      setSuccess(
        'Compra estornada com sucesso.',
      );
    } catch (caughtError) {
      showError(
        caughtError,
        'Não foi possível estornar a compra.',
      );
    } finally {
      setVoidingPurchase(false);
    }
  }

  async function confirmCloseInvoice() {
    if (!closeTarget) {
      return;
    }

    setClosingInvoice(true);
    setError('');
    setSuccess('');

    try {
      await closeCreditCardInvoice(
        token,
        workspace.id,
        closeTarget.id,
      );

      await refresh();

      setCloseTarget(null);

      setSuccess(
        'Fatura fechada com sucesso.',
      );
    } catch (caughtError) {
      showError(
        caughtError,
        'Não foi possível fechar a fatura.',
      );
    } finally {
      setClosingInvoice(false);
    }
  }

  function openPaymentModal(
    invoice:
      CreditCardInvoice,
  ) {
    if (!selectedCard) {
      return;
    }

    const eligibleAccounts =
      accounts.filter(
        (account) =>
          account.status ===
            'ACTIVE' &&
          account.type !==
            'CREDIT_CARD' &&
          account.currency ===
            selectedCard.account
              .currency,
      );

    setPaymentTarget(invoice);

    setPaymentForm({
      paymentAccountId:
        eligibleAccounts[0]
          ?.id ?? '',

      paymentDate:
        getTodayInputValue(),
    });

    setPaymentError('');
  }

  async function handlePaymentSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!paymentTarget) {
      return;
    }

    if (
      !paymentForm.paymentAccountId
    ) {
      setPaymentError(
        'Selecione uma conta para pagar a fatura.',
      );

      return;
    }

    if (
      !paymentForm.paymentDate
    ) {
      setPaymentError(
        'Informe a data do pagamento.',
      );

      return;
    }

    setPayingInvoice(true);
    setPaymentError('');
    setError('');
    setSuccess('');

    try {
      await payCreditCardInvoice(
        token,
        workspace.id,
        paymentTarget.id,
        {
          paymentAccountId:
            paymentForm.paymentAccountId,

          paymentDate:
            `${paymentForm.paymentDate}T12:00:00.000Z`,
        },
      );

      await refresh();

      setPaymentTarget(null);

      setSuccess(
        'Fatura paga com sucesso.',
      );
    } catch (caughtError) {
      if (
        handleUnauthorized(
          caughtError,
        )
      ) {
        return;
      }

      setPaymentError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Não foi possível pagar a fatura.',
      );
    } finally {
      setPayingInvoice(false);
    }
  }

  if (loading) {
    return (
      <main className="dashboard-content credit-cards-page">
        <section className="panel credit-card-loading">
          <div className="credit-card-spinner" />

          <strong>
            Carregando cartões
          </strong>

          <span>
            Consultando limites,
            compras e faturas...
          </span>
        </section>
      </main>
    );
  }

  return (
    <main className="dashboard-content credit-cards-page">
      <section className="dashboard-heading credit-cards-heading">
        <div>
          <h2>
            Cartões de crédito
          </h2>

          <p>
            Controle seus limites,
            compras e faturas em um
            único lugar.
          </p>
        </div>

        <div className="credit-cards-heading-actions">
          {!canManage && (
            <span className="readonly-badge">
              Somente leitura
            </span>
          )}

          <button
            type="button"
            className="card-primary-button"
            onClick={
              openCardModal
            }
            disabled={
              !canManage
            }
          >
            <Plus size={18} />
            Novo cartão
          </button>
        </div>
      </section>

      {success && (
        <div className="card-success-message">
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
        <div className="error-message card-page-error">
          {error}
        </div>
      )}

      {cards.length === 0 ? (
        <section className="panel">
          <div className="empty-state card-empty-state">
            <CreditCard
              size={38}
            />

            <strong>
              Nenhum cartão cadastrado
            </strong>

            <span>
              Cadastre seu primeiro
              cartão para acompanhar
              limite, compras e faturas.
            </span>

            {canManage && (
              <button
                type="button"
                className="card-empty-button"
                onClick={
                  openCardModal
                }
              >
                <Plus size={16} />
                Cadastrar primeiro cartão
              </button>
            )}
          </div>
        </section>
      ) : (
        <>
          <section className="credit-card-selector">
            {cards.map(
              (item) => {
                const active =
                  item.account.id ===
                  selectedAccountId;

                const creditLimit =
                  toNumber(
                    item.limit
                      .creditLimit,
                  );

                const usedLimit =
                  toNumber(
                    item.limit
                      .usedLimit,
                  );

                const percentage =
                  creditLimit > 0
                    ? Math.min(
                        100,
                        Math.max(
                          0,
                          (usedLimit /
                            creditLimit) *
                            100,
                        ),
                      )
                    : 0;

                return (
                  <button
                    type="button"
                    className={
                      active
                        ? 'credit-card-option active'
                        : 'credit-card-option'
                    }
                    key={
                      item.account.id
                    }
                    onClick={() =>
                      setSelectedAccountId(
                        item.account.id,
                      )
                    }
                  >
                    <div className="credit-card-option-top">
                      <span className="credit-card-chip" />

                      <CreditCard
                        size={20}
                      />
                    </div>

                    <div className="credit-card-option-copy">
                      <span>
                        {
                          item.account
                            .currency
                        }
                      </span>

                      <strong>
                        {
                          item.account
                            .name
                        }
                      </strong>
                    </div>

                    <div className="credit-card-option-limit">
                      <span>
                        Limite disponível
                      </span>

                      <strong>
                        {formatCurrency(
                          item.limit
                            .availableLimit,
                          item.account
                            .currency,
                        )}
                      </strong>
                    </div>

                    <div className="credit-card-option-progress">
                      <span
                        style={{
                          width:
                            `${percentage}%`,
                        }}
                      />
                    </div>
                  </button>
                );
              },
            )}
          </section>

          {selectedCard && (
            <>
              <section className="card-summary-grid">
                <article className="card-summary-item">
                  <span className="card-summary-icon total">
                    <CircleDollarSign
                      size={20}
                    />
                  </span>

                  <div>
                    <span>
                      Limite total
                    </span>

                    <strong>
                      {formatCurrency(
                        selectedCard
                          .limit
                          .creditLimit,
                        selectedCard
                          .account
                          .currency,
                      )}
                    </strong>
                  </div>
                </article>

                <article className="card-summary-item">
                  <span className="card-summary-icon used">
                    <ArrowUpRight
                      size={20}
                    />
                  </span>

                  <div>
                    <span>
                      Limite utilizado
                    </span>

                    <strong>
                      {formatCurrency(
                        selectedCard
                          .limit
                          .usedLimit,
                        selectedCard
                          .account
                          .currency,
                      )}
                    </strong>
                  </div>
                </article>

                <article className="card-summary-item">
                  <span className="card-summary-icon available">
                    <WalletCards
                      size={20}
                    />
                  </span>

                  <div>
                    <span>
                      Disponível
                    </span>

                    <strong>
                      {formatCurrency(
                        selectedCard
                          .limit
                          .availableLimit,
                        selectedCard
                          .account
                          .currency,
                      )}
                    </strong>
                  </div>
                </article>

                <article className="card-summary-item">
                  <span className="card-summary-icon invoice">
                    <FileText
                      size={20}
                    />
                  </span>

                  <div>
                    <span>
                      Fatura atual
                    </span>

                    <strong>
                      {currentInvoice
                        ? formatCurrency(
                            currentInvoice.totalAmount,
                            selectedCard
                              .account
                              .currency,
                          )
                        : formatCurrency(
                            0,
                            selectedCard
                              .account
                              .currency,
                          )}
                    </strong>
                  </div>
                </article>
              </section>

              <section className="card-detail-grid">
                <article className="panel card-overview-panel">
                  <div className="panel-header">
                    <div>
                      <h3>
                        {
                          selectedCard
                            .account
                            .name
                        }
                      </h3>

                      <p>
                        Detalhes e uso do
                        cartão
                      </p>
                    </div>

                    {canManage && (
                      <button
                        type="button"
                        className="card-primary-button compact"
                        onClick={
                          openPurchaseModal
                        }
                      >
                        <Plus
                          size={16}
                        />
                        Nova compra
                      </button>
                    )}
                  </div>

                  <div className="premium-credit-card">
                    <div className="premium-credit-card-top">
                      <span className="premium-card-chip" />

                      <CreditCard
                        size={27}
                      />
                    </div>

                    <div className="premium-credit-card-name">
                      <span>
                        FINPILOT CARD
                      </span>

                      <strong>
                        {
                          selectedCard
                            .account
                            .name
                        }
                      </strong>
                    </div>

                    <div className="premium-credit-card-bottom">
                      <div>
                        <span>
                          FECHAMENTO
                        </span>

                        <strong>
                          Dia{' '}
                          {
                            selectedCard
                              .card
                              .closingDay
                          }
                        </strong>
                      </div>

                      <div>
                        <span>
                          VENCIMENTO
                        </span>

                        <strong>
                          Dia{' '}
                          {
                            selectedCard
                              .card
                              .dueDay
                          }
                        </strong>
                      </div>

                      <div>
                        <span>
                          MOEDA
                        </span>

                        <strong>
                          {
                            selectedCard
                              .account
                              .currency
                          }
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div className="card-limit-section">
                    <div
                      className="card-limit-heading"
                      key={`${selectedCard.limit.usedLimit}-${selectedCard.limit.availableLimit}`}
                    >
                      <div>
                        <span>
                          Uso do limite
                        </span>

                        <strong>
                          {formatCurrency(
                            selectedCard
                              .limit
                              .usedLimit,
                            selectedCard
                              .account
                              .currency,
                          )}{' '}
                          de{' '}
                          {formatCurrency(
                            selectedCard
                              .limit
                              .creditLimit,
                            selectedCard
                              .account
                              .currency,
                          )}
                        </strong>
                      </div>

                      <span className="card-limit-percentage">
                        {toNumber(
                          selectedCard
                            .limit
                            .creditLimit,
                        ) > 0
                          ? `${Math.min(
                              100,
                              Math.max(
                                0,
                                (toNumber(
                                  selectedCard
                                    .limit
                                    .usedLimit,
                                ) /
                                  toNumber(
                                    selectedCard
                                      .limit
                                      .creditLimit,
                                  )) *
                                  100,
                              ),
                            ).toFixed(
                              1,
                            )}%`
                          : '0%'}
                      </span>
                    </div>

                    <div className="card-limit-track">
                      <span
                        style={{
                          width:
                            `${
                              toNumber(
                                selectedCard
                                  .limit
                                  .creditLimit,
                              ) > 0
                                ? Math.min(
                                    100,
                                    Math.max(
                                      0,
                                      (toNumber(
                                        selectedCard
                                          .limit
                                          .usedLimit,
                                      ) /
                                        toNumber(
                                          selectedCard
                                            .limit
                                            .creditLimit,
                                        )) *
                                        100,
                                    ),
                                  )
                                : 0
                            }%`,
                        }}
                      />
                    </div>
                  </div>
                </article>

                <article className="panel current-invoice-panel">
                  <div className="panel-header">
                    <div>
                      <h3>
                        Fatura em destaque
                      </h3>

                      <p>
                        Situação mais
                        recente
                      </p>
                    </div>
                  </div>

                  {currentInvoice ? (
                    <div className="current-invoice-content">
                      <span
                        className={`invoice-status-pill ${currentInvoice.status.toLowerCase()}`}
                      >
                        {getInvoiceStatusLabel(
                          currentInvoice.status,
                        )}
                      </span>

                      <div className="current-invoice-value">
                        <span>
                          Valor da fatura
                        </span>

                        <strong>
                          {formatCurrency(
                            currentInvoice.totalAmount,
                            selectedCard
                              .account
                              .currency,
                          )}
                        </strong>
                      </div>

                      <div className="current-invoice-dates">
                        <div>
                          <CalendarDays
                            size={16}
                          />

                          <span>
                            Fecha em
                          </span>

                          <strong>
                            {formatDate(
                              currentInvoice.closingDate,
                            )}
                          </strong>
                        </div>

                        <div>
                          <CalendarDays
                            size={16}
                          />

                          <span>
                            Vence em
                          </span>

                          <strong>
                            {formatDate(
                              currentInvoice.dueDate,
                            )}
                          </strong>
                        </div>
                      </div>

                      {canManage &&
                        currentInvoice.status ===
                          'OPEN' && (
                          <button
                            type="button"
                            className="card-secondary-action"
                            onClick={() =>
                              setCloseTarget(
                                currentInvoice,
                              )
                            }
                          >
                            <FileText
                              size={16}
                            />
                            Fechar fatura
                          </button>
                        )}

                      {canManage &&
                        (currentInvoice.status ===
                          'CLOSED' ||
                          currentInvoice.status ===
                            'OVERDUE') && (
                          <button
                            type="button"
                            className="card-primary-button full"
                            onClick={() =>
                              openPaymentModal(
                                currentInvoice,
                              )
                            }
                          >
                            <CheckCircle2
                              size={16}
                            />
                            Pagar fatura
                          </button>
                        )}
                    </div>
                  ) : (
                    <div className="empty-state compact card-current-empty">
                      <FileText
                        size={28}
                      />

                      <strong>
                        Nenhuma fatura pendente
                      </strong>

                      <span>
                        Você não possui
                        uma fatura aberta,
                        fechada ou vencida
                        neste cartão.
                      </span>
                    </div>
                  )}
                </article>
              </section>

              <section className="panel card-purchases-panel">
                <div className="panel-header">
                  <div>
                    <h3>
                      Compras do cartão
                    </h3>

                    <p>
                      Histórico de
                      lançamentos no
                      crédito
                    </p>
                  </div>

                  <span className="card-result-count">
                    {
                      selectedPurchases.length
                    }{' '}
                    {selectedPurchases.length ===
                    1
                      ? 'compra'
                      : 'compras'}
                  </span>
                </div>

                {selectedPurchases.length ===
                0 ? (
                  <div className="empty-state card-section-empty">
                    <ReceiptText
                      size={31}
                    />

                    <strong>
                      Nenhuma compra
                    </strong>

                    <span>
                      Registre uma compra
                      para começar a usar
                      este cartão.
                    </span>
                  </div>
                ) : (
                  <div className="card-purchase-table-wrapper">
                    <table className="card-purchase-table">
                      <thead>
                        <tr>
                          <th>
                            Compra
                          </th>

                          <th>
                            Categoria
                          </th>

                          <th>
                            Data
                          </th>

                          <th>
                            Fatura
                          </th>

                          <th className="card-table-value">
                            Valor
                          </th>

                          <th className="card-table-actions">
                            Ações
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {selectedPurchases.map(
                          (
                            transaction,
                          ) => {
                            const entry =
                              transaction.entries.find(
                                (
                                  item,
                                ) =>
                                  item.accountId ===
                                  selectedCard
                                    .account
                                    .id,
                              );

                            const invoice =
                              getPurchaseInvoice(
                                transaction,
                              );

                            const editable =
                              canEditPurchase(
                                transaction,
                              );

                            return (
                              <tr
                                key={
                                  transaction.id
                                }
                                className={
                                  transaction.status ===
                                  'VOIDED'
                                    ? 'card-purchase-voided'
                                    : undefined
                                }
                              >
                                <td>
                                  <div className="card-purchase-description">
                                    <span className="card-purchase-icon">
                                      <CreditCard
                                        size={16}
                                      />
                                    </span>

                                    <div>
                                      <strong>
                                        {
                                          transaction.description
                                        }
                                      </strong>

                                      <span>
                                        {transaction.status ===
                                        'VOIDED'
                                          ? 'Compra estornada'
                                          : 'Compra no crédito'}
                                      </span>
                                    </div>
                                  </div>
                                </td>

                                <td>
                                  {transaction
                                    .category
                                    ?.name ??
                                    'Sem categoria'}
                                </td>

                                <td>
                                  {formatDate(
                                    transaction.transactionDate,
                                  )}
                                </td>

                                <td>
                                  {invoice
                                    ? getMonthLabel(
                                        invoice.referenceMonth,
                                        invoice.referenceYear,
                                      )
                                    : '—'}
                                </td>

                                <td className="card-table-value">
                                  <strong>
                                    {formatCurrency(
                                      entry
                                        ?.amount ??
                                        0,
                                      selectedCard
                                        .account
                                        .currency,
                                    )}
                                  </strong>
                                </td>

                                <td className="card-table-actions">
                                  {editable ? (
                                    <div className="card-row-actions">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          openEditPurchase(
                                            transaction,
                                          )
                                        }
                                        title="Editar compra"
                                        aria-label="Editar compra"
                                      >
                                        <Pencil
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
                                        title="Estornar compra"
                                        aria-label="Estornar compra"
                                      >
                                        <RotateCcw
                                          size={15}
                                        />
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="card-no-actions">
                                      —
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          },
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className="panel card-invoices-panel">
                <div className="panel-header">
                  <div>
                    <h3>
                      Histórico de faturas
                    </h3>

                    <p>
                      Fechamentos e
                      pagamentos do
                      cartão
                    </p>
                  </div>
                </div>

                {selectedInvoices.length ===
                0 ? (
                  <div className="empty-state card-section-empty">
                    <FileText
                      size={31}
                    />

                    <strong>
                      Nenhuma fatura
                    </strong>

                    <span>
                      As faturas
                      aparecerão aqui
                      conforme o cartão
                      for utilizado.
                    </span>
                  </div>
                ) : (
                  <div className="invoice-history-grid">
                    {selectedInvoices.map(
                      (invoice) => (
                        <article
                          className="invoice-history-card"
                          key={
                            invoice.id
                          }
                        >
                          <div className="invoice-history-top">
                            <div>
                              <span>
                                Fatura
                              </span>

                              <strong>
                                {getMonthLabel(
                                  invoice.referenceMonth,
                                  invoice.referenceYear,
                                )}
                              </strong>
                            </div>

                            <span
                              className={`invoice-status-pill ${invoice.status.toLowerCase()}`}
                            >
                              {getInvoiceStatusLabel(
                                invoice.status,
                              )}
                            </span>
                          </div>

                          <strong className="invoice-history-value">
                            {formatCurrency(
                              invoice.totalAmount,
                              selectedCard
                                .account
                                .currency,
                            )}
                          </strong>

                          <div className="invoice-history-meta">
                            <span>
                              Fechamento{' '}
                              <strong>
                                {formatDate(
                                  invoice.closingDate,
                                )}
                              </strong>
                            </span>

                            <span>
                              Vencimento{' '}
                              <strong>
                                {formatDate(
                                  invoice.dueDate,
                                )}
                              </strong>
                            </span>
                          </div>

                          {canManage &&
                            invoice.status ===
                              'OPEN' && (
                              <button
                                type="button"
                                className="invoice-card-action"
                                onClick={() =>
                                  setCloseTarget(
                                    invoice,
                                  )
                                }
                              >
                                Fechar fatura
                              </button>
                            )}

                          {canManage &&
                            (invoice.status ===
                              'CLOSED' ||
                              invoice.status ===
                                'OVERDUE') && (
                              <button
                                type="button"
                                className="invoice-card-action primary"
                                onClick={() =>
                                  openPaymentModal(
                                    invoice,
                                  )
                                }
                              >
                                Pagar fatura
                              </button>
                            )}
                        </article>
                      ),
                    )}
                  </div>
                )}
              </section>
            </>
          )}
        </>
      )}

      {cardModalOpen && (
        <div className="card-modal-backdrop">
          <section
            className="card-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-card-title"
          >
            <div className="card-modal-header">
              <div>
                <span>
                  NOVO CARTÃO
                </span>

                <h2 id="new-card-title">
                  Adicionar cartão
                </h2>

                <p>
                  Cadastre o cartão e
                  configure seu limite,
                  fechamento e
                  vencimento.
                </p>
              </div>

              <button
                type="button"
                onClick={
                  closeCardModal
                }
                className="card-modal-close"
                aria-label="Fechar"
              >
                <X size={20} />
              </button>
            </div>

            <form
              className="card-form"
              onSubmit={
                handleCreateCard
              }
            >
              <label className="card-form-field">
                <span>
                  Nome do cartão
                </span>

                <input
                  type="text"
                  value={
                    cardForm.name
                  }
                  onChange={(
                    event,
                  ) =>
                    setCardForm(
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
                  placeholder="Ex.: Nubank Ultravioleta"
                  required
                  minLength={2}
                />
              </label>

              <div className="card-form-grid">
                <label className="card-form-field">
                  <span>
                    Moeda
                  </span>

                  <select
                    value={
                      cardForm.currency
                    }
                    onChange={(
                      event,
                    ) =>
                      setCardForm(
                        (
                          current,
                        ) => ({
                          ...current,

                          currency:
                            event.target
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

                <label className="card-form-field">
                  <span>
                    Limite
                  </span>

                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={
                      cardForm.creditLimit
                    }
                    onChange={(
                      event,
                    ) =>
                      setCardForm(
                        (
                          current,
                        ) => ({
                          ...current,

                          creditLimit:
                            event.target
                              .value,
                        }),
                      )
                    }
                    placeholder="5000,00"
                    required
                  />
                </label>
              </div>

              <div className="card-form-grid">
                <label className="card-form-field">
                  <span>
                    Dia de fechamento
                  </span>

                  <input
                    type="number"
                    min="1"
                    max="31"
                    step="1"
                    value={
                      cardForm.closingDay
                    }
                    onChange={(
                      event,
                    ) =>
                      setCardForm(
                        (
                          current,
                        ) => ({
                          ...current,

                          closingDay:
                            event.target
                              .value,
                        }),
                      )
                    }
                    required
                  />
                </label>

                <label className="card-form-field">
                  <span>
                    Dia de vencimento
                  </span>

                  <input
                    type="number"
                    min="1"
                    max="31"
                    step="1"
                    value={
                      cardForm.dueDay
                    }
                    onChange={(
                      event,
                    ) =>
                      setCardForm(
                        (
                          current,
                        ) => ({
                          ...current,

                          dueDay:
                            event.target
                              .value,
                        }),
                      )
                    }
                    required
                  />
                </label>
              </div>

              <div className="card-form-preview">
                <div className="card-form-preview-top">
                  <span className="premium-card-chip" />

                  <CreditCard
                    size={23}
                  />
                </div>

                <div>
                  <span>
                    FINPILOT CARD
                  </span>

                  <strong>
                    {cardForm.name.trim() ||
                      'Nome do cartão'}
                  </strong>
                </div>

                <div className="card-form-preview-footer">
                  <span>
                    Fecha dia{' '}
                    {
                      cardForm.closingDay
                    }
                  </span>

                  <span>
                    Vence dia{' '}
                    {
                      cardForm.dueDay
                    }
                  </span>

                  <span>
                    {
                      cardForm.currency
                    }
                  </span>
                </div>
              </div>

              {cardFormError && (
                <div className="error-message">
                  {cardFormError}
                </div>
              )}

              <div className="card-form-actions">
                <button
                  type="button"
                  className="card-secondary-button"
                  onClick={
                    closeCardModal
                  }
                  disabled={
                    creatingCard
                  }
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="card-primary-button"
                  disabled={
                    creatingCard
                  }
                >
                  {creatingCard
                    ? 'Criando...'
                    : 'Criar cartão'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {purchaseModalOpen &&
        selectedCard && (
          <div className="card-modal-backdrop">
            <section
              className="card-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="purchase-modal-title"
            >
              <div className="card-modal-header">
                <div>
                  <span>
                    {editingPurchase
                      ? 'EDITAR COMPRA'
                      : 'NOVA COMPRA'}
                  </span>

                  <h2 id="purchase-modal-title">
                    {editingPurchase
                      ? 'Editar compra'
                      : 'Registrar compra'}
                  </h2>

                  <p>
                    {
                      selectedCard
                        .account
                        .name
                    }
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    closePurchaseModal
                  }
                  className="card-modal-close"
                  aria-label="Fechar"
                >
                  <X size={20} />
                </button>
              </div>

              <form
                className="card-form"
                onSubmit={
                  handlePurchaseSubmit
                }
              >
                <label className="card-form-field">
                  <span>
                    Descrição
                  </span>

                  <input
                    type="text"
                    value={
                      purchaseForm.description
                    }
                    onChange={(
                      event,
                    ) =>
                      setPurchaseForm(
                        (
                          current,
                        ) => ({
                          ...current,

                          description:
                            event.target
                              .value,
                        }),
                      )
                    }
                    placeholder="Ex.: Supermercado, restaurante..."
                    required
                  />
                </label>

                <div className="card-form-grid">
                  <label className="card-form-field">
                    <span>
                      Valor
                    </span>

                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={
                        purchaseForm.amount
                      }
                      onChange={(
                        event,
                      ) =>
                        setPurchaseForm(
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
                      required
                    />
                  </label>

                  <label className="card-form-field">
                    <span>
                      Data
                    </span>

                    <input
                      type="date"
                      value={
                        purchaseForm.transactionDate
                      }
                      onChange={(
                        event,
                      ) =>
                        setPurchaseForm(
                          (
                            current,
                          ) => ({
                            ...current,

                            transactionDate:
                              event.target
                                .value,
                          }),
                        )
                      }
                      required
                    />
                  </label>
                </div>

                <label className="card-form-field">
                  <span>
                    Categoria
                  </span>

                  <select
                    value={
                      purchaseForm.categoryId
                    }
                    onChange={(
                      event,
                    ) =>
                      setPurchaseForm(
                        (
                          current,
                        ) => ({
                          ...current,

                          categoryId:
                            event.target
                              .value,
                        }),
                      )
                    }
                  >
                    <option value="">
                      Sem categoria
                    </option>

                    {categories.map(
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

                <div className="card-purchase-limit-info">
                  <span>
                    Limite disponível
                  </span>

                  <strong>
                    {formatCurrency(
                      selectedCard
                        .limit
                        .availableLimit,
                      selectedCard
                        .account
                        .currency,
                    )}
                  </strong>
                </div>

                {purchaseFormError && (
                  <div className="error-message">
                    {
                      purchaseFormError
                    }
                  </div>
                )}

                <div className="card-form-actions">
                  <button
                    type="button"
                    className="card-secondary-button"
                    onClick={
                      closePurchaseModal
                    }
                    disabled={
                      savingPurchase
                    }
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    className="card-primary-button"
                    disabled={
                      savingPurchase
                    }
                  >
                    {savingPurchase
                      ? 'Salvando...'
                      : editingPurchase
                        ? 'Salvar alterações'
                        : 'Registrar compra'}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}

      {voidTarget && (
        <div className="card-modal-backdrop">
          <section className="card-confirm-modal">
            <span className="card-confirm-icon danger">
              <RotateCcw
                size={23}
              />
            </span>

            <h2>
              Estornar compra?
            </h2>

            <p>
              A compra{' '}
              <strong>
                {
                  voidTarget.description
                }
              </strong>{' '}
              será estornada e o
              limite correspondente
              será atualizado.
            </p>

            <div className="card-confirm-actions">
              <button
                type="button"
                className="card-secondary-button"
                onClick={() =>
                  setVoidTarget(
                    null,
                  )
                }
                disabled={
                  voidingPurchase
                }
              >
                Cancelar
              </button>

              <button
                type="button"
                className="card-danger-button"
                onClick={() =>
                  void confirmVoidPurchase()
                }
                disabled={
                  voidingPurchase
                }
              >
                {voidingPurchase
                  ? 'Estornando...'
                  : 'Confirmar estorno'}
              </button>
            </div>
          </section>
        </div>
      )}

      {closeTarget && (
        <div className="card-modal-backdrop">
          <section className="card-confirm-modal">
            <span className="card-confirm-icon warning">
              <FileText
                size={23}
              />
            </span>

            <h2>
              Fechar fatura?
            </h2>

            <p>
              A fatura de{' '}
              <strong>
                {getMonthLabel(
                  closeTarget.referenceMonth,
                  closeTarget.referenceYear,
                )}
              </strong>{' '}
              será fechada. Depois
              disso, compras dessa
              fatura não poderão mais
              ser alteradas.
            </p>

            <div className="card-confirm-actions">
              <button
                type="button"
                className="card-secondary-button"
                onClick={() =>
                  setCloseTarget(
                    null,
                  )
                }
                disabled={
                  closingInvoice
                }
              >
                Cancelar
              </button>

              <button
                type="button"
                className="card-primary-button"
                onClick={() =>
                  void confirmCloseInvoice()
                }
                disabled={
                  closingInvoice
                }
              >
                {closingInvoice
                  ? 'Fechando...'
                  : 'Fechar fatura'}
              </button>
            </div>
          </section>
        </div>
      )}

      {paymentTarget &&
        selectedCard && (
          <div className="card-modal-backdrop">
            <section
              className="card-modal card-payment-modal"
              role="dialog"
              aria-modal="true"
            >
              <div className="card-modal-header">
                <div>
                  <span>
                    PAGAMENTO
                  </span>

                  <h2>
                    Pagar fatura
                  </h2>

                  <p>
                    {getMonthLabel(
                      paymentTarget.referenceMonth,
                      paymentTarget.referenceYear,
                    )}
                  </p>
                </div>

                <button
                  type="button"
                  className="card-modal-close"
                  onClick={() =>
                    setPaymentTarget(
                      null,
                    )
                  }
                  aria-label="Fechar"
                >
                  <X size={20} />
                </button>
              </div>

              <form
                className="card-form"
                onSubmit={
                  handlePaymentSubmit
                }
              >
                <div className="payment-invoice-summary">
                  <span>
                    Valor da fatura
                  </span>

                  <strong>
                    {formatCurrency(
                      paymentTarget.totalAmount,
                      selectedCard
                        .account
                        .currency,
                    )}
                  </strong>
                </div>

                {paymentAccounts.length ===
                0 ? (
                  <div className="card-payment-warning">
                    <AlertTriangle
                      size={18}
                    />

                    <div>
                      <strong>
                        Nenhuma conta compatível
                      </strong>

                      <span>
                        Você precisa de
                        uma conta ativa
                        em{' '}
                        {
                          selectedCard
                            .account
                            .currency
                        }{' '}
                        para pagar esta
                        fatura.
                      </span>
                    </div>
                  </div>
                ) : (
                  <>
                    <label className="card-form-field">
                      <span>
                        Conta de pagamento
                      </span>

                      <select
                        value={
                          paymentForm.paymentAccountId
                        }
                        onChange={(
                          event,
                        ) =>
                          setPaymentForm(
                            (
                              current,
                            ) => ({
                              ...current,

                              paymentAccountId:
                                event
                                  .target
                                  .value,
                            }),
                          )
                        }
                        required
                      >
                        {paymentAccounts.map(
                          (
                            account,
                          ) => (
                            <option
                              key={
                                account.id
                              }
                              value={
                                account.id
                              }
                            >
                              {
                                account.name
                              }{' '}
                              •{' '}
                              {
                                account.currency
                              }
                            </option>
                          ),
                        )}
                      </select>
                    </label>

                    <label className="card-form-field">
                      <span>
                        Data do pagamento
                      </span>

                      <input
                        type="date"
                        value={
                          paymentForm.paymentDate
                        }
                        onChange={(
                          event,
                        ) =>
                          setPaymentForm(
                            (
                              current,
                            ) => ({
                              ...current,

                              paymentDate:
                                event
                                  .target
                                  .value,
                            }),
                          )
                        }
                        required
                      />
                    </label>
                  </>
                )}

                {paymentError && (
                  <div className="error-message">
                    {paymentError}
                  </div>
                )}

                <div className="card-form-actions">
                  <button
                    type="button"
                    className="card-secondary-button"
                    onClick={() =>
                      setPaymentTarget(
                        null,
                      )
                    }
                    disabled={
                      payingInvoice
                    }
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    className="card-primary-button"
                    disabled={
                      payingInvoice ||
                      paymentAccounts.length ===
                        0
                    }
                  >
                    {payingInvoice
                      ? 'Pagando...'
                      : 'Confirmar pagamento'}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}
    </main>
  );
}

export default CreditCardsPage;