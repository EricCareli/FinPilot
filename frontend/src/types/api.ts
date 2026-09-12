export type WorkspaceType =
  | 'PERSONAL'
  | 'BUSINESS';

export type WorkspaceRole =
  | 'OWNER'
  | 'ADMIN'
  | 'FINANCE'
  | 'VIEWER';

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