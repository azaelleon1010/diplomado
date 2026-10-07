/**
 * Notification ports — abstractions owned by the Domain.
 * Infrastructure provides the implementations.
 */

export interface WelcomeEmailInput {
  to: string;
  firstName?: string;
  companyName: string;
}

export interface PasswordResetEmailInput {
  to: string;
  firstName?: string;
  /** Full link to the Web reset-password screen, including rid + token. */
  resetUrl: string;
  ttlMinutes: number;
}

export interface IEmailProvider {
  sendWelcomeEmail(input: WelcomeEmailInput): Promise<void>;
  sendPasswordResetEmail(input: PasswordResetEmailInput): Promise<void>;
}
