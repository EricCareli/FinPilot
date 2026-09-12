const API_URL =
  import.meta.env.VITE_API_URL ??
  'http://localhost:3333';

interface ApiErrorResponse {
  status?: string;
  message?: string;
}

export interface LoginResponse {
  status: 'success';
  token: string;
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

  const data =
    (await response.json()) as
      | LoginResponse
      | ApiErrorResponse;

  if (!response.ok) {
    throw new Error(
      'message' in data &&
      data.message
        ? data.message
        : 'Não foi possível entrar.',
    );
  }

  return data as LoginResponse;
}