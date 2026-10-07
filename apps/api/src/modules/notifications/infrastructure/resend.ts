import { Resend } from 'resend';
import { getConfig } from '@erp/config';
import type { IEmailProvider, PasswordResetEmailInput, WelcomeEmailInput } from '../domain/ports';

export class ResendEmailProvider implements IEmailProvider {
  private readonly client: Resend;
  private readonly from: string;
  /**
   * Resend's shared test domain (onboarding@resend.dev) only delivers to the
   * account's own verified address. When set, every email is redirected
   * here instead of the real recipient, with a banner noting who it was
   * really for — lets the product work end to end without a custom domain.
   */
  private readonly sandboxTo?: string;

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
    this.sandboxTo = config.RESEND_SANDBOX_TO;
  }

  /** Resolves the real send-to address and an optional banner for sandbox redirects. */
  private recipientFor(intendedTo: string): { to: string; banner: string } {
    if (!this.sandboxTo || this.sandboxTo.toLowerCase() === intendedTo.toLowerCase()) {
      return { to: intendedTo, banner: '' };
    }
    return {
      to: this.sandboxTo,
      banner: `
        <p style="background:#FEF3C7;color:#92400E;padding:10px 14px;border-radius:8px;font-size:13px;">
          Modo de prueba de Resend: este correo iba dirigido a <strong>${intendedTo}</strong>
          y se redirigió aquí porque el remitente todavía no tiene un dominio propio verificado.
        </p>
      `,
    };
  }

  async sendWelcomeEmail(input: WelcomeEmailInput): Promise<void> {
    const displayName = input.firstName?.trim() || input.to;
    const { to, banner } = this.recipientFor(input.to);

    const { error } = await this.client.emails.send({
      from: this.from,
      to,
      subject: `Bienvenido a TramaTech ERP, ${displayName}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          ${banner}
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

  async sendPasswordResetEmail(input: PasswordResetEmailInput): Promise<void> {
    const displayName = input.firstName?.trim() || input.to;
    const { to, banner } = this.recipientFor(input.to);

    const { error } = await this.client.emails.send({
      from: this.from,
      to,
      subject: 'Restablece tu contraseña — TramaTech ERP',
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          ${banner}
          <h1>Restablece tu contraseña</h1>
          <p>Hola ${displayName},</p>
          <p>
            Recibimos una solicitud para restablecer la contraseña de tu cuenta
            en TramaTech ERP. Si no fuiste tú, puedes ignorar este correo.
          </p>
          <p>
            <a href="${input.resetUrl}" style="display:inline-block;padding:12px 20px;background:#0047AB;color:#ffffff;text-decoration:none;border-radius:8px;">
              Restablecer contraseña
            </a>
          </p>
          <p>
            Este enlace es válido durante ${input.ttlMinutes} minutos y solo
            puede usarse una vez. Si el botón no funciona, copia y pega esta
            dirección en tu navegador:
          </p>
          <p style="word-break: break-all;">${input.resetUrl}</p>
          <p>El equipo de TramaTech ERP</p>
        </div>
      `,
    });

    if (error) {
      throw new Error(`Resend failed to send password reset email: ${error.message}`);
    }
  }
}
