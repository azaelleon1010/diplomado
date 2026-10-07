import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetConfigForTests } from '../../packages/config/src/index';
import { ResendEmailProvider } from '../../apps/api/src/modules/notifications/infrastructure/resend';

const sendMock = vi.fn(async () => ({ data: { id: 'email_1' }, error: null }));

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({ emails: { send: sendMock } })),
}));

describe('ResendEmailProvider sandbox redirect', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.RESEND_API_KEY = 'test-key';
    process.env.RESEND_FROM_EMAIL = 'onboarding@resend.dev';
    sendMock.mockClear();
    __resetConfigForTests();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    __resetConfigForTests();
  });

  it('sends to the real recipient when no sandbox address is configured', async () => {
    delete process.env.RESEND_SANDBOX_TO;
    __resetConfigForTests();
    const provider = new ResendEmailProvider();

    await provider.sendPasswordResetEmail({ to: 'user@tenant.mx', resetUrl: 'https://app.example/reset?rid=1&token=2', ttlMinutes: 60 });

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0]?.[0]).toMatchObject({ to: 'user@tenant.mx' });
    expect(sendMock.mock.calls[0]?.[0].html).not.toContain('Modo de prueba de Resend');
  });

  it('redirects every email to RESEND_SANDBOX_TO and notes the real recipient', async () => {
    process.env.RESEND_SANDBOX_TO = 'owner@resend-account.mx';
    __resetConfigForTests();
    const provider = new ResendEmailProvider();

    await provider.sendPasswordResetEmail({ to: 'user@tenant.mx', resetUrl: 'https://app.example/reset?rid=1&token=2', ttlMinutes: 60 });
    await provider.sendWelcomeEmail({ to: 'other@tenant.mx', companyName: 'Acme' });

    expect(sendMock).toHaveBeenCalledTimes(2);
    for (const call of sendMock.mock.calls) {
      expect(call[0]).toMatchObject({ to: 'owner@resend-account.mx' });
    }
    expect(sendMock.mock.calls[0]?.[0].html).toContain('user@tenant.mx');
    expect(sendMock.mock.calls[1]?.[0].html).toContain('other@tenant.mx');
  });

  it('does not add a banner or redirect when the sandbox address matches the real recipient', async () => {
    process.env.RESEND_SANDBOX_TO = 'owner@resend-account.mx';
    __resetConfigForTests();
    const provider = new ResendEmailProvider();

    await provider.sendPasswordResetEmail({ to: 'owner@resend-account.mx', resetUrl: 'https://app.example/reset?rid=1&token=2', ttlMinutes: 60 });

    expect(sendMock.mock.calls[0]?.[0]).toMatchObject({ to: 'owner@resend-account.mx' });
    expect(sendMock.mock.calls[0]?.[0].html).not.toContain('Modo de prueba de Resend');
  });

  it('throws when Resend reports an error', async () => {
    delete process.env.RESEND_SANDBOX_TO;
    __resetConfigForTests();
    sendMock.mockResolvedValueOnce({ data: null, error: { message: 'boom' } } as never);
    const provider = new ResendEmailProvider();

    await expect(
      provider.sendPasswordResetEmail({ to: 'user@tenant.mx', resetUrl: 'https://app.example/reset', ttlMinutes: 60 }),
    ).rejects.toThrow(/boom/);
  });
});
