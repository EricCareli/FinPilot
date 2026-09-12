import type {
  DashboardData,
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

export class ApiError extends Error {
  statusCode: number;

  constructor(
    message: string,
    statusCode: number,
  ) {
    super(message);

    this.name = 'ApiError';
    this.statusCode = statusCode;
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

export async function login(
  email: string,
  password: string,
): Promise<LoginResponse> {
  const response =
    await fetch(
      `${API_URL}/auth/login`,
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',
        },

        body: JSON.stringify({
          email,
          password,
        }),
      },
    );

  return parseResponse<LoginResponse>(
    response,
  );
}

export async function getCurrentUser(
  token: string,
): Promise<User> {
  const response =
    await fetch(
      `${API_URL}/users/me`,
      {
        headers: {
          Authorization:
            `Bearer ${token}`,
        },
      },
    );

  const data =
    await parseResponse<UserResponse>(
      response,
    );

  return data.user;
}

export async function getWorkspaces(
  token: string,
): Promise<Workspace[]> {
  const response =
    await fetch(
      `${API_URL}/workspaces`,
      {
        headers: {
          Authorization:
            `Bearer ${token}`,
        },
      },
    );

  const data =
    await parseResponse<WorkspacesResponse>(
      response,
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

  const response =
    await fetch(
      `${API_URL}/dashboard${query}`,
      {
        headers: {
          Authorization:
            `Bearer ${token}`,

          'x-workspace-id':
            workspaceId,
        },
      },
    );

  const data =
    await parseResponse<DashboardResponse>(
      response,
    );

  return data.dashboard;
}