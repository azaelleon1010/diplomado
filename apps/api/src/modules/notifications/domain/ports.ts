/**
 * Notification ports — abstractions owned by the Domain.
 * Infrastructure provides the implementations.
 */

export interface WelcomeEmailInput {
  to: string;
  firstName?: string;
  companyName: string;
}

export interface IEmailProvider {
  sendWelcomeEmail(input: WelcomeEmailInput): Promise<void>;
}
