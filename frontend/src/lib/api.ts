import type {
  Account,
  AccountBalance,
  Budget,
  BudgetProgress,
  Category,
  CreateAccountInput,
  CreateBudgetInput,
  CreateCreditCardInput,
  CreateCreditCardPurchaseInput,
  CreateTransactionInput,
  CreditCard,
  CreditCardInvoice,
  CreditCardLimit,
  CreditCardPaymentResult,
  CreditCardPurchaseResult,
  DashboardData,
  EditableTransactionType,
  FinancialTransaction,
  PayCreditCardInvoiceInput,
  UpdateAccountInput,
  UpdateBudgetInput,
  UpdateCreditCardPurchaseInput,
  UpdateTransactionInput,
  User,
  Workspace,
} from '../types/api';

const API_URL =
  import.meta.env.VITE_API_URL ??
  'http://localhost:3333';

interface ApiErrorResponse {
  status?: string;
  message?: string;
}

interface ApiRequestOptions {
  method?: string;
  token?: string;
  workspaceId?: string;
  body?: unknown;
}

interface LoginResponse {
  status: 'success';
  user: User;
  token: string;
}

interface UserResponse {
  status: 'success';
  user: User;
}

interface WorkspacesResponse {
  status: 'success';
  workspaces: Workspace[];
}

interface DashboardResponse {
  status: 'success';
  dashboard: DashboardData;
}

interface TransactionsResponse {
  status: 'success';

  transactions:
    FinancialTransaction[];
}

interface TransactionResponse {
  status: 'success';

  transaction:
    FinancialTransaction;
}

interface AccountsResponse {
  status: 'success';
  accounts: Account[];
}

interface AccountResponse {
  status: 'success';
  account: Account;
}

interface AccountBalanceResponse {
  status: 'success';

  balance:
    AccountBalance;
}

interface CategoriesResponse {
  status: 'success';

  categories:
    Category[];
}

interface CategoryResponse {
  status: 'success';

  category:
    Category;
}

interface CreditCardResponse {
  status: 'success';

  creditCard:
    CreditCard;
}

interface CreditCardLimitResponse {
  status: 'success';

  limit:
    CreditCardLimit;
}

interface CreditCardPurchaseResponse {
  status: 'success';

  transaction:
    CreditCardPurchaseResult['transaction'];

  invoice:
    CreditCardInvoice;
}

interface CreditCardPurchaseMutationResponse {
  status: 'success';

  purchase:
    FinancialTransaction;
}

interface CreditCardInvoicesResponse {
  status: 'success';

  invoices:
    CreditCardInvoice[];
}

interface CreditCardInvoiceResponse {
  status: 'success';

  invoice:
    CreditCardInvoice;
}

interface CreditCardPaymentResponse {
  status: 'success';

  payment:
    CreditCardPaymentResult;
}

interface BudgetsResponse {
  status: 'success';

  budgets:
    Budget[];
}

interface BudgetResponse {
  status: 'success';

  budget:
    Budget;
}

interface DeletedBudgetResponse {
  status: 'success';

  deletedBudget:
    Budget;
}

interface BudgetProgressResponse {
  status: 'success';

  progress:
    BudgetProgress;
}

export class ApiError extends Error {
  statusCode: number;

  constructor(
    message: string,
    statusCode: number,
  ) {
    super(message);

    this.name = 'ApiError';
    this.statusCode =
      statusCode;
  }
}

async function parseResponse<
  T extends object,
>(
  response: Response,
): Promise<T> {
  const data =
    (await response.json()) as
      | T
      | ApiErrorResponse;

  if (!response.ok) {
    const message =
      'message' in data &&
      typeof data.message ===
        'string'
        ? data.message
        : 'Não foi possível concluir a solicitação.';

    throw new ApiError(
      message,
      response.status,
    );
  }

  return data as T;
}

async function request<
  T extends object,
>(
  path: string,
  options:
    ApiRequestOptions = {},
): Promise<T> {
  const headers:
    Record<string, string> =
      {};

  if (options.token) {
    headers.Authorization =
      `Bearer ${options.token}`;
  }

  if (options.workspaceId) {
    headers[
      'x-workspace-id'
    ] = options.workspaceId;
  }

  if (
    options.body !== undefined
  ) {
    headers[
      'Content-Type'
    ] = 'application/json';
  }

  const response =
    await fetch(
      `${API_URL}${path}`,
      {
        method:
          options.method ??
          'GET',

        headers,

        ...(options.body !==
        undefined
          ? {
              body:
                JSON.stringify(
                  options.body,
                ),
            }
          : {}),
      },
    );

  return parseResponse<T>(
    response,
  );
}

export async function login(
  email: string,
  password: string,
): Promise<LoginResponse> {
  return request<LoginResponse>(
    '/auth/login',
    {
      method: 'POST',

      body: {
        email,
        password,
      },
    },
  );
}

export async function getCurrentUser(
  token: string,
): Promise<User> {
  const data =
    await request<UserResponse>(
      '/users/me',
      {
        token,
      },
    );

  return data.user;
}

export async function getWorkspaces(
  token: string,
): Promise<Workspace[]> {
  const data =
    await request<WorkspacesResponse>(
      '/workspaces',
      {
        token,
      },
    );

  return data.workspaces;
}

export async function getDashboard(
  token: string,
  workspaceId: string,
  period?: {
    month: number;
    year: number;
  },
): Promise<DashboardData> {
  const query =
    period
      ? `?month=${period.month}&year=${period.year}`
      : '';

  const data =
    await request<DashboardResponse>(
      `/dashboard${query}`,
      {
        token,
        workspaceId,
      },
    );

  return data.dashboard;
}

export async function getTransactions(
  token: string,
  workspaceId: string,
  includeVoided = false,
): Promise<
  FinancialTransaction[]
> {
  const query =
    includeVoided
      ? '?includeVoided=true'
      : '';

  const data =
    await request<TransactionsResponse>(
      `/transactions${query}`,
      {
        token,
        workspaceId,
      },
    );

  return data.transactions;
}

export async function createTransaction(
  token: string,
  workspaceId: string,
  input:
    CreateTransactionInput,
): Promise<
  FinancialTransaction
> {
  const data =
    await request<TransactionResponse>(
      '/transactions',
      {
        method: 'POST',
        token,
        workspaceId,
        body: input,
      },
    );

  return data.transaction;
}

export async function updateTransaction(
  token: string,
  workspaceId: string,
  transactionId: string,
  input:
    UpdateTransactionInput,
): Promise<
  FinancialTransaction
> {
  const data =
    await request<TransactionResponse>(
      `/transactions/${transactionId}`,
      {
        method: 'PATCH',
        token,
        workspaceId,
        body: input,
      },
    );

  return data.transaction;
}

export async function voidTransaction(
  token: string,
  workspaceId: string,
  transactionId: string,
): Promise<
  FinancialTransaction
> {
  const data =
    await request<TransactionResponse>(
      `/transactions/${transactionId}/void`,
      {
        method: 'POST',
        token,
        workspaceId,
      },
    );

  return data.transaction;
}

export async function getAccounts(
  token: string,
  workspaceId: string,
  includeArchived = false,
): Promise<Account[]> {
  const query =
    includeArchived
      ? '?includeArchived=true'
      : '';

  const data =
    await request<AccountsResponse>(
      `/accounts${query}`,
      {
        token,
        workspaceId,
      },
    );

  return data.accounts;
}

export async function createAccount(
  token: string,
  workspaceId: string,
  input:
    CreateAccountInput,
): Promise<Account> {
  const data =
    await request<AccountResponse>(
      '/accounts',
      {
        method: 'POST',
        token,
        workspaceId,
        body: input,
      },
    );

  return data.account;
}

export async function updateAccount(
  token: string,
  workspaceId: string,
  accountId: string,
  input:
    UpdateAccountInput,
): Promise<Account> {
  const data =
    await request<AccountResponse>(
      `/accounts/${accountId}`,
      {
        method: 'PATCH',
        token,
        workspaceId,
        body: input,
      },
    );

  return data.account;
}

export async function archiveAccount(
  token: string,
  workspaceId: string,
  accountId: string,
): Promise<Account> {
  const data =
    await request<AccountResponse>(
      `/accounts/${accountId}/archive`,
      {
        method: 'POST',
        token,
        workspaceId,
      },
    );

  return data.account;
}

export async function getAccountBalance(
  token: string,
  workspaceId: string,
  accountId: string,
): Promise<AccountBalance> {
  const data =
    await request<AccountBalanceResponse>(
      `/accounts/${accountId}/balance`,
      {
        token,
        workspaceId,
      },
    );

  return data.balance;
}

export async function createCategory(
  token: string,
  workspaceId: string,
  input: {
    name: string;
    type: EditableTransactionType;
  },
): Promise<Category> {
  const data =
    await request<CategoryResponse>(
      '/categories',
      {
        method: 'POST',
        token,
        workspaceId,
        body: input,
      },
    );

  return data.category;
}

export async function getCategories(
  token: string,
  workspaceId: string,
  type?:
    EditableTransactionType,
): Promise<Category[]> {
  const query =
    type
      ? `?type=${type}`
      : '';

  const data =
    await request<CategoriesResponse>(
      `/categories${query}`,
      {
        token,
        workspaceId,
      },
    );

  return data.categories;
}

export async function getBudgets(
  token: string,
  workspaceId: string,
  period?: {
    month: number;
    year: number;
  },
): Promise<Budget[]> {
  const query =
    period
      ? `?month=${period.month}&year=${period.year}`
      : '';

  const data =
    await request<BudgetsResponse>(
      `/budgets${query}`,
      {
        token,
        workspaceId,
      },
    );

  return data.budgets;
}

export async function createBudget(
  token: string,
  workspaceId: string,
  input:
    CreateBudgetInput,
): Promise<Budget> {
  const data =
    await request<BudgetResponse>(
      '/budgets',
      {
        method: 'POST',
        token,
        workspaceId,
        body: input,
      },
    );

  return data.budget;
}

export async function updateBudget(
  token: string,
  workspaceId: string,
  budgetId: string,
  input:
    UpdateBudgetInput,
): Promise<Budget> {
  const data =
    await request<BudgetResponse>(
      `/budgets/${budgetId}`,
      {
        method: 'PATCH',
        token,
        workspaceId,
        body: input,
      },
    );

  return data.budget;
}

export async function deleteBudget(
  token: string,
  workspaceId: string,
  budgetId: string,
): Promise<Budget> {
  const data =
    await request<DeletedBudgetResponse>(
      `/budgets/${budgetId}`,
      {
        method: 'DELETE',
        token,
        workspaceId,
      },
    );

  return data.deletedBudget;
}

export async function getBudgetProgress(
  token: string,
  workspaceId: string,
  budgetId: string,
): Promise<BudgetProgress> {
  const data =
    await request<BudgetProgressResponse>(
      `/budgets/${budgetId}/progress`,
      {
        token,
        workspaceId,
      },
    );

  return data.progress;
}

export async function createCreditCard(
  token: string,
  workspaceId: string,
  input:
    CreateCreditCardInput,
): Promise<CreditCard> {
  const data =
    await request<CreditCardResponse>(
      '/credit-cards',
      {
        method: 'POST',
        token,
        workspaceId,
        body: input,
      },
    );

  return data.creditCard;
}

export async function getCreditCard(
  token: string,
  workspaceId: string,
  accountId: string,
): Promise<CreditCard> {
  const data =
    await request<CreditCardResponse>(
      `/credit-cards/${accountId}`,
      {
        token,
        workspaceId,
      },
    );

  return data.creditCard;
}

export async function getCreditCardLimit(
  token: string,
  workspaceId: string,
  accountId: string,
): Promise<CreditCardLimit> {
  const data =
    await request<CreditCardLimitResponse>(
      `/credit-cards/${accountId}/limit`,
      {
        token,
        workspaceId,
      },
    );

  return data.limit;
}

export async function createCreditCardPurchase(
  token: string,
  workspaceId: string,
  accountId: string,
  input:
    CreateCreditCardPurchaseInput,
): Promise<CreditCardPurchaseResult> {
  const data =
    await request<CreditCardPurchaseResponse>(
      `/credit-cards/${accountId}/purchases`,
      {
        method: 'POST',
        token,
        workspaceId,
        body: input,
      },
    );

  return {
    transaction:
      data.transaction,

    invoice:
      data.invoice,
  };
}

export async function updateCreditCardPurchase(
  token: string,
  workspaceId: string,
  transactionId: string,
  input:
    UpdateCreditCardPurchaseInput,
): Promise<
  FinancialTransaction
> {
  const data =
    await request<CreditCardPurchaseMutationResponse>(
      `/credit-cards/purchases/${transactionId}`,
      {
        method: 'PATCH',
        token,
        workspaceId,
        body: input,
      },
    );

  return data.purchase;
}

export async function voidCreditCardPurchase(
  token: string,
  workspaceId: string,
  transactionId: string,
): Promise<
  FinancialTransaction
> {
  const data =
    await request<CreditCardPurchaseMutationResponse>(
      `/credit-cards/purchases/${transactionId}/void`,
      {
        method: 'POST',
        token,
        workspaceId,
      },
    );

  return data.purchase;
}

export async function createCreditCardInvoice(
  token: string,
  workspaceId: string,
  accountId: string,
  month: number,
  year: number,
): Promise<CreditCardInvoice> {
  const data =
    await request<CreditCardInvoiceResponse>(
      `/credit-cards/${accountId}/invoices`,
      {
        method: 'POST',
        token,
        workspaceId,

        body: {
          month,
          year,
        },
      },
    );

  return data.invoice;
}

export async function getCreditCardInvoices(
  token: string,
  workspaceId: string,
  accountId: string,
): Promise<
  CreditCardInvoice[]
> {
  const data =
    await request<CreditCardInvoicesResponse>(
      `/credit-cards/${accountId}/invoices`,
      {
        token,
        workspaceId,
      },
    );

  return data.invoices;
}

export async function closeCreditCardInvoice(
  token: string,
  workspaceId: string,
  invoiceId: string,
): Promise<CreditCardInvoice> {
  const data =
    await request<CreditCardInvoiceResponse>(
      `/credit-cards/invoices/${invoiceId}/close`,
      {
        method: 'POST',
        token,
        workspaceId,
      },
    );

  return data.invoice;
}

export async function payCreditCardInvoice(
  token: string,
  workspaceId: string,
  invoiceId: string,
  input:
    PayCreditCardInvoiceInput,
): Promise<
  CreditCardPaymentResult
> {
  const data =
    await request<CreditCardPaymentResponse>(
      `/credit-cards/invoices/${invoiceId}/pay`,
      {
        method: 'POST',
        token,
        workspaceId,
        body: input,
      },
    );

  return data.payment;
}