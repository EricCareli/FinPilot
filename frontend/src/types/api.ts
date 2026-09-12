export type WorkspaceType =
  | 'PERSONAL'
  | 'BUSINESS';

export type WorkspaceRole =
  | 'OWNER'
  | 'ADMIN'
  | 'FINANCE'
  | 'VIEWER';

export type AccountType =
  | 'CHECKING'
  | 'SAVINGS'
  | 'CASH'
  | 'CREDIT_CARD'
  | 'INVESTMENT'
  | 'OTHER';

export type AccountStatus =
  | 'ACTIVE'
  | 'ARCHIVED';

export type Currency =
  | 'BRL'
  | 'USD'
  | 'EUR';

export type EditableTransactionType =
  | 'INCOME'
  | 'EXPENSE';

export type LedgerEntryType =
  | 'CREDIT'
  | 'DEBIT';

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  type: WorkspaceType;
  role: WorkspaceRole;
  createdAt: string;
  updatedAt: string;
}

export type MoneyValue =
  | string
  | number;

export interface Account {
  id: string;
  workspaceId: string;
  name: string;
  type: AccountType;
  status: AccountStatus;
  currency: Currency;
  initialBalance: MoneyValue;
  createdAt: string;
  updatedAt: string;
}

export interface AccountBalance {
  accountId: string;
  currency: Currency;
  balance: MoneyValue;
}

export interface CreateAccountInput {
  name: string;
  type: AccountType;
  currency: Currency;
  initialBalance: number;
}

export interface UpdateAccountInput {
  name?: string;
  type?: AccountType;
  currency?: Currency;
}

export interface Category {
  id: string;
  workspaceId: string;
  name: string;
  type: EditableTransactionType;
  createdAt: string;
  updatedAt: string;
}

export interface LedgerEntry {
  id: string;
  transactionId: string;
  accountId: string;
  type: LedgerEntryType;
  amount: MoneyValue;
  createdAt: string;
  account: Account;
}

export interface FinancialTransaction {
  id: string;
  workspaceId: string;
  categoryId: string | null;
  invoiceId: string | null;

  installmentPurchaseId:
    | string
    | null;

  refundForInstallmentPurchaseId:
    | string
    | null;

  installmentNumber:
    | number
    | null;

  type: string;
  status: string;
  description: string;
  transactionDate: string;
  createdAt: string;
  updatedAt: string;

  category:
    | Category
    | null;

  entries: LedgerEntry[];

  invoice:
    | {
        id: string;
      }
    | null;
}

export interface CreateTransactionInput {
  accountId: string;
  categoryId?: string;
  type: EditableTransactionType;
  amount: number;
  description: string;
  transactionDate: string;
}

export interface UpdateTransactionInput {
  accountId?: string;

  categoryId?:
    | string
    | null;

  type?: EditableTransactionType;
  amount?: number;
  description?: string;
  transactionDate?: string;
}

export interface DashboardAccount {
  id: string;
  name: string;
  type: string;
  currency: string;
  balance: MoneyValue;
}

export interface DashboardCategoryExpense {
  categoryId: string | null;
  categoryName: string;
  amount: MoneyValue;
  percentage: MoneyValue;
}

export interface DashboardMonth {
  month: number;
  year: number;
  income: MoneyValue;
  expense: MoneyValue;
  netResult: MoneyValue;
}

export interface DashboardBudget {
  id: string;
  categoryId: string;
  categoryName: string;
  month: number;
  year: number;
  budget: MoneyValue;
  spent: MoneyValue;
  remaining: MoneyValue;
  percentageUsed: MoneyValue;

  status:
    | 'ON_TRACK'
    | 'WARNING'
    | 'EXCEEDED';
}

export interface DashboardCreditCard {
  id: string;
  accountId: string;
  name: string;
  currency: string;
  creditLimit: MoneyValue;
  usedLimit: MoneyValue;
  availableLimit: MoneyValue;
  closingDay: number;
  dueDay: number;
}

export interface DashboardRecentTransaction {
  id: string;

  type:
    | 'INCOME'
    | 'EXPENSE';

  description: string;
  transactionDate: string;

  category: {
    id: string;
    name: string;
    type: string;
  } | null;

  entries: Array<{
    amount: MoneyValue;

    account: {
      id: string;
      name: string;
      type: string;
      currency: string;
    };
  }>;
}

export interface DashboardData {
  period: {
    month: number;
    year: number;
  } | null;

  totalBalance: MoneyValue;
  totalIncome: MoneyValue;
  totalExpense: MoneyValue;
  netResult: MoneyValue;

  savingsRate:
    | MoneyValue
    | null;

  expenseByCategory:
    DashboardCategoryExpense[];

  monthlyEvolution:
    DashboardMonth[];

  budgets:
    DashboardBudget[];

  accountCount: number;

  accounts:
    DashboardAccount[];

  creditCards: {
    count: number;
    totalCreditLimit: MoneyValue;
    totalCreditUsed: MoneyValue;
    totalCreditAvailable: MoneyValue;

    cards:
      DashboardCreditCard[];
  };

  recentTransactions:
    DashboardRecentTransaction[];
}