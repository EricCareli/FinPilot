import { resend } from '../lib/resend.js';

function getRequiredEnv(
  name: string,
): string {
  const value =
    process.env[name];

  if (!value) {
    throw new Error(
      `${name} is not configured`,
    );
  }

  return value;
}

const EMAIL_FROM =
  getRequiredEnv('EMAIL_FROM');

interface SendVerificationCodeInput {
  email: string;
  name: string;
  code: string;
}

interface SendPasswordResetCodeInput {
  email: string;
  name: string;
  code: string;
}

interface SendEmailChangeCodeInput {
  email: string;
  name: string;
  code: string;
}

export async function sendVerificationCode({
  email,
  name,
  code,
}: SendVerificationCodeInput) {
  const { data, error } =
    await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject:
        'Confirme seu e-mail no FinPilot',
      text: `
Olá, ${name}!

Seu código de verificação do FinPilot é:

${code}

Este código expira em alguns minutos.

Se você não criou uma conta no FinPilot, ignore este e-mail.
      `.trim(),
      html: `
        <div
          style="
            font-family: Arial, sans-serif;
            max-width: 520px;
            margin: 0 auto;
          "
        >
          <h1
            style="
              color: #135846;
            "
          >
            FinPilot
          </h1>

          <p>
            Olá,
            <strong>${name}</strong>!
          </p>

          <p>
            Use o código abaixo para confirmar seu e-mail:
          </p>

          <div
            style="
              font-size: 32px;
              font-weight: bold;
              letter-spacing: 8px;
              padding: 20px;
              text-align: center;
              background: #f3f7f5;
              border-radius: 10px;
              color: #135846;
            "
          >
            ${code}
          </div>

          <p
            style="
              margin-top: 24px;
            "
          >
            Este código expira em alguns minutos.
          </p>

          <p
            style="
              color: #777;
            "
          >
            Se você não criou uma conta no FinPilot,
            ignore este e-mail.
          </p>
        </div>
      `,
    });

  if (error) {
    throw new Error(
      `Failed to send verification email: ${error.message}`,
    );
  }

  return data;
}

export async function sendPasswordResetCode({
  email,
  name,
  code,
}: SendPasswordResetCodeInput) {
  const { data, error } =
    await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject:
        'Redefina sua senha do FinPilot',
      text: `
Olá, ${name}!

Recebemos uma solicitação para redefinir a senha da sua conta FinPilot.

Seu código de recuperação é:

${code}

Este código expira em alguns minutos.

Se você não solicitou a redefinição da sua senha, ignore este e-mail.
      `.trim(),
      html: `
        <div
          style="
            font-family: Arial, sans-serif;
            max-width: 520px;
            margin: 0 auto;
          "
        >
          <h1
            style="
              color: #135846;
            "
          >
            FinPilot
          </h1>

          <p>
            Olá,
            <strong>${name}</strong>!
          </p>

          <p>
            Recebemos uma solicitação para redefinir
            a senha da sua conta.
          </p>

          <p>
            Use o código abaixo para continuar:
          </p>

          <div
            style="
              font-size: 32px;
              font-weight: bold;
              letter-spacing: 8px;
              padding: 20px;
              text-align: center;
              background: #f3f7f5;
              border-radius: 10px;
              color: #135846;
            "
          >
            ${code}
          </div>

          <p
            style="
              margin-top: 24px;
            "
          >
            Este código expira em alguns minutos.
          </p>

          <p
            style="
              color: #777;
            "
          >
            Se você não solicitou a redefinição da
            sua senha, ignore este e-mail.
          </p>
        </div>
      `,
    });

  if (error) {
    throw new Error(
      `Failed to send password reset email: ${error.message}`,
    );
  }

  return data;
}

export async function sendEmailChangeCode({
  email,
  name,
  code,
}: SendEmailChangeCodeInput) {
  const { data, error } =
    await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject:
        'Confirme seu novo e-mail no FinPilot',
      text: `
Olá, ${name}!

Recebemos uma solicitação para alterar o e-mail da sua conta FinPilot.

Seu código de confirmação é:

${code}

Este código expira em alguns minutos.

Se você não solicitou esta alteração, ignore este e-mail. O e-mail atual da sua conta continuará o mesmo.
      `.trim(),
      html: `
        <div
          style="
            font-family: Arial, sans-serif;
            max-width: 520px;
            margin: 0 auto;
          "
        >
          <h1
            style="
              color: #135846;
            "
          >
            FinPilot
          </h1>

          <p>
            Olá,
            <strong>${name}</strong>!
          </p>

          <p>
            Recebemos uma solicitação para alterar
            o e-mail da sua conta.
          </p>

          <p>
            Use o código abaixo para confirmar o
            novo endereço de e-mail:
          </p>

          <div
            style="
              font-size: 32px;
              font-weight: bold;
              letter-spacing: 8px;
              padding: 20px;
              text-align: center;
              background: #f3f7f5;
              border-radius: 10px;
              color: #135846;
            "
          >
            ${code}
          </div>

          <p
            style="
              margin-top: 24px;
            "
          >
            Este código expira em alguns minutos.
          </p>

          <p
            style="
              color: #777;
            "
          >
            Se você não solicitou esta alteração,
            ignore este e-mail. O endereço atual da
            sua conta continuará o mesmo.
          </p>
        </div>
      `,
    });

  if (error) {
    throw new Error(
      `Failed to send email change code: ${error.message}`,
    );
  }

  return data;
}
