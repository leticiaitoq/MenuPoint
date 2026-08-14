// src/shared/emails/templates.ts

// Templates HTML dos e-mails enviados pelo sistema
// Centralizados aqui para fácil manutenção e personalização

export function templateRecuperacaoSenha(
  nomeUsuario: string,
  codigo: string,
  expiracaoMinutos: number
): string {
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Recuperação de Senha</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          background-color: #f4f4f4;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 40px auto;
          background-color: #ffffff;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .header {
          background-color: #1A1A2E;
          padding: 32px;
          text-align: center;
        }
        .header h1 {
          color: #ffffff;
          margin: 0;
          font-size: 24px;
        }
        .body {
          padding: 32px;
          color: #333333;
          line-height: 1.6;
        }
        .body p {
          margin: 0 0 16px;
        }
        .codigo-container {
          text-align: center;
          margin: 32px 0;
        }
        .codigo {
          display: inline-block;
          background-color: #EFF6FF;
          border: 2px dashed #2563EB;
          color: #1E3A8A;
          letter-spacing: 8px;
          padding: 16px 24px;
          border-radius: 8px;
          font-size: 32px;
          font-weight: bold;
          font-family: monospace;
        }
        .footer {
          background-color: #f4f4f4;
          padding: 20px 32px;
          text-align: center;
          font-size: 12px;
          color: #999999;
        }
        .warning {
          background-color: #FEF3C7;
          border-left: 4px solid #D97706;
          padding: 12px 16px;
          border-radius: 4px;
          font-size: 14px;
          color: #92400E;
          margin: 16px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🍽️ Menupoint</h1>
        </div>
        <div class="body">
          <p>Olá, <strong>${nomeUsuario}</strong>!</p>
          <p>
            Recebemos uma solicitação para redefinir a senha da sua conta.
            Use o código abaixo para continuar:
          </p>
          <div class="codigo-container">
            <span class="codigo">${codigo}</span>
          </div>
          <div class="warning">
            ⏰ Este código expira em <strong>${expiracaoMinutos} minutos</strong>.
            Após esse prazo você precisará solicitar um novo código.
          </div>
          <p>
            Se você não solicitou a redefinição de senha, ignore este e-mail.
            Sua senha permanece a mesma e nenhuma alteração foi feita.
          </p>
        </div>
        <div class="footer">
          <p>Este é um e-mail automático, não responda.</p>
          <p>© ${new Date().getFullYear()} Menupoint. Todos os direitos reservados.</p>
        </div>
      </div>
    </body>
    </html>
  `
}

export function templateSenhaRedefinida(nomeUsuario: string): string {
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Senha Redefinida</title>
      <style>
        body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .header { background-color: #1A1A2E; padding: 32px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 24px; }
        .body { padding: 32px; color: #333333; line-height: 1.6; }
        .body p { margin: 0 0 16px; }
        .success { background-color: #DCFCE7; border-left: 4px solid #16A34A; padding: 12px 16px; border-radius: 4px; font-size: 14px; color: #166534; margin: 16px 0; }
        .footer { background-color: #f4f4f4; padding: 20px 32px; text-align: center; font-size: 12px; color: #999999; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🍽️ Menupoint</h1>
        </div>
        <div class="body">
          <p>Olá, <strong>${nomeUsuario}</strong>!</p>
          <div class="success">
            ✅ Sua senha foi redefinida com sucesso!
          </div>
          <p>
            Você já pode fazer login com sua nova senha.
          </p>
          <p>
            Se você não fez essa alteração, entre em contato com o suporte
            imediatamente.
          </p>
        </div>
        <div class="footer">
          <p>Este é um e-mail automático, não responda.</p>
          <p>© ${new Date().getFullYear()} Menupoint. Todos os direitos reservados.</p>
        </div>
      </div>
    </body>
    </html>
  `
}

export function templateConfirmacaoEmail(
  nomeUsuario: string,
  codigo: string,
  expiracaoMinutos: number
): string {
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Confirme seu e-mail</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          background-color: #f4f4f4;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 40px auto;
          background-color: #ffffff;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .header {
          background-color: #1A1A2E;
          padding: 32px;
          text-align: center;
        }
        .header h1 {
          color: #ffffff;
          margin: 0;
          font-size: 24px;
        }
        .body {
          padding: 32px;
          color: #333333;
          line-height: 1.6;
        }
        .body p {
          margin: 0 0 16px;
        }
        .codigo-container {
          text-align: center;
          margin: 32px 0;
        }
        .codigo {
          display: inline-block;
          background-color: #F0FDF4;
          border: 2px dashed #16A34A;
          color: #14532D;
          letter-spacing: 8px;
          padding: 16px 24px;
          border-radius: 8px;
          font-size: 32px;
          font-weight: bold;
          font-family: monospace;
        }
        .footer {
          background-color: #f4f4f4;
          padding: 20px 32px;
          text-align: center;
          font-size: 12px;
          color: #999999;
        }
        .warning {
          background-color: #FEF3C7;
          border-left: 4px solid #D97706;
          padding: 12px 16px;
          border-radius: 4px;
          font-size: 14px;
          color: #92400E;
          margin: 16px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🍽️ Menupoint</h1>
        </div>
        <div class="body">
          <p>Olá, <strong>${nomeUsuario}</strong>!</p>
          <p>
            Falta só um passo para ativar sua conta no Menupoint.
            Digite o código abaixo na tela de confirmação:
          </p>
          <div class="codigo-container">
            <span class="codigo">${codigo}</span>
          </div>
          <div class="warning">
            ⏰ Este código expira em <strong>${expiracaoMinutos} minutos</strong>.
            Após esse prazo você pode solicitar o reenvio dentro do sistema.
          </div>
          <p>
            Se você não criou uma conta no Menupoint, pode ignorar este e-mail com segurança.
          </p>
        </div>
        <div class="footer">
          <p>Este é um e-mail automático, não responda.</p>
          <p>© ${new Date().getFullYear()} Menupoint. Todos os direitos reservados.</p>
        </div>
      </div>
    </body>
    </html>
  `
}
