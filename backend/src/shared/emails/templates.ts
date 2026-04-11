// src/shared/emails/templates.ts

// Templates HTML dos e-mails enviados pelo sistema
// Centralizados aqui para fácil manutenção e personalização

export function templateRecuperacaoSenha(
  nomeUsuario: string,
  linkRedefinicao: string,
  expiracaoHoras: number
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
        .button-container {
          text-align: center;
          margin: 32px 0;
        }
        .button {
          display: inline-block;
          background-color: #2563EB;
          color: #ffffff;
          text-decoration: none;
          padding: 14px 32px;
          border-radius: 6px;
          font-size: 16px;
          font-weight: bold;
        }
        .link-fallback {
          word-break: break-all;
          color: #2563EB;
          font-size: 13px;
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
            Clique no botão abaixo para criar uma nova senha:
          </p>
          <div class="button-container">
            <a href="${linkRedefinicao}" class="button">
              Redefinir minha senha
            </a>
          </div>
          <div class="warning">
            ⏰ Este link expira em <strong>${expiracaoHoras} hora${expiracaoHoras > 1 ? 's' : ''}</strong>.
            Após esse prazo você precisará solicitar um novo link.
          </div>
          <p>
            Se o botão não funcionar, copie e cole o link abaixo no seu navegador:
          </p>
          <p class="link-fallback">${linkRedefinicao}</p>
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