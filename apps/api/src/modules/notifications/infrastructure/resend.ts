import { Resend } from 'resend';
import { getConfig } from '@erp/config';
import type { IEmailProvider, WelcomeEmailInput } from '../domain/ports';

export class ResendEmailProvider implements IEmailProvider {
  private readonly client: Resend;
  private readonly from: string;

  constructor() {
    const config = getConfig();

    if (!config.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is required to use ResendEmailProvider');
    }

    if (!config.RESEND_FROM_EMAIL) {
      throw new Error('RESEND_FROM_EMAIL is required to use ResendEmailProvider');
    }

    this.client = new Resend(config.RESEND_API_KEY);
    this.from = config.RESEND_FROM_EMAIL;
  }

  async sendWelcomeEmail(input: WelcomeEmailInput): Promise<void> {
    const displayName = input.firstName?.trim() || input.to;

    const { error } = await this.client.emails.send({
      from: this.from,
      to: input.to,
      subject: `Bienvenido a TramaTech ERP, ${displayName}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h1>Bienvenido a TramaTech ERP</h1>
          <p>Hola ${displayName},</p>
          <p>
            Tu empresa <strong>${input.companyName}</strong>
            ya está registrada en TramaTech ERP.
          </p>
          <p>
            Tu cuenta fue creada correctamente y ya puedes comenzar
            a configurar tu empresa.
          </p>
          <p>¡Bienvenido!</p>
          <p>El equipo de TramaTech ERP</p>
        </div>
      `,
    });

    if (error) {
      throw new Error(`Resend failed to send welcome email: ${error.message}`);
    }
  }
}