import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CustomerLayout from '../../../shared/components/layout/Customerlayout';
import { useClienteAuth } from '../../../shared/contexts/ClienteAuthContext';
import ClienteService, { ClientePerfil, mensagemDeErro } from '../../../services/cliente.service';
import './PerfilCliente.css';

// ── Utilitários ──────────────────────────────────────────────────────────────
const soDigitos = (v: string) => v.replace(/\D/g, '');

// Mesma máscara do cadastro: (11) 91234-5678
function mascaraTelefone(valor: string): string {
  const d = soDigitos(valor).slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

// Mesma regra do back-end (DDD válido; 10 dígitos fixo ou 11 com 9 no início)
function telefoneValido(valor: string): boolean {
  const d = soDigitos(valor);
  if (!/^[1-9][1-9]/.test(d)) return false;
  if (d.length === 10) return true;
  return d.length === 11 && d[2] === '9';
}

// O CPF é dado sensível: na tela só aparecem os 2 últimos dígitos
function mascararCpf(cpf: string | null): string {
  return cpf ? `•••.•••.•••-${cpf.slice(-2)}` : '—';
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  const primeira = partes[0][0];
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
  return (primeira + ultima).toUpperCase();
}

function clienteDesde(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return '';
  return data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

const PerfilCliente: React.FC = () => {
  const navigate = useNavigate();
  const { entrar, sair, atualizarCliente } = useClienteAuth();

  // ── Dados do perfil (vêm do back: GET /auth/cliente/me) ──
  const [perfil, setPerfil] = useState<ClientePerfil | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);

  // ── Edição de nome/telefone ──
  const [editando, setEditando] = useState(false);
  const [formNome, setFormNome] = useState('');
  const [formTelefone, setFormTelefone] = useState('');
  const [erroEdicao, setErroEdicao] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // ── Alterar senha ──
  const [alterandoSenha, setAlterandoSenha] = useState(false);
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [erroSenha, setErroSenha] = useState<string | null>(null);
  const [salvandoSenha, setSalvandoSenha] = useState(false);

  const [aviso, setAviso] = useState<string | null>(null);

  // Evita setState depois de sair da tela (ex.: logout no meio de uma requisição)
  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErroCarga(null);
    try {
      const dados = await ClienteService.me();
      if (montado.current) setPerfil(dados);
    } catch (err: any) {
      if (montado.current) {
        setErroCarga(mensagemDeErro(err, 'Não foi possível carregar o seu perfil.'));
      }
    } finally {
      if (montado.current) setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const mostrarAviso = (texto: string) => {
    setAviso(texto);
    window.setTimeout(() => {
      if (montado.current) setAviso(null);
    }, 5000);
  };

  // ── Editar dados ──
  const handleEditar = () => {
    if (!perfil) return;
    setFormNome(perfil.nome);
    setFormTelefone(mascaraTelefone(perfil.telefone));
    setErroEdicao(null);
    setEditando(true);
  };

  const handleSalvar = async () => {
    setErroEdicao(null);

    if (formNome.trim().length < 3) {
      setErroEdicao('Informe seu nome completo.');
      return;
    }
    if (!telefoneValido(formTelefone)) {
      setErroEdicao('Informe um telefone válido com DDD.');
      return;
    }

    setSalvando(true);
    try {
      const atualizado = await ClienteService.atualizarPerfil({
        nome: formNome.trim(),
        telefone: formTelefone,
      });
      setPerfil(atualizado);
      // Mantém o nome/telefone do contexto em dia (o resto do app lê de lá)
      atualizarCliente({
        id: atualizado.id,
        nome: atualizado.nome,
        email: atualizado.email,
        telefone: atualizado.telefone,
        email_verificado: atualizado.email_verificado,
      });
      setEditando(false);
      mostrarAviso('Dados atualizados com sucesso.');
    } catch (err: any) {
      setErroEdicao(mensagemDeErro(err, 'Não foi possível salvar. Tente novamente.'));
    } finally {
      if (montado.current) setSalvando(false);
    }
  };

  // ── Alterar senha ──
  const regrasSenha = [
    { label: 'Mínimo 8 caracteres', valido: novaSenha.length >= 8 },
    { label: 'Pelo menos 1 letra maiúscula', valido: /[A-Z]/.test(novaSenha) },
    { label: 'Pelo menos 1 letra minúscula', valido: /[a-z]/.test(novaSenha) },
    { label: 'Pelo menos 1 número', valido: /[0-9]/.test(novaSenha) },
  ];

  const fecharAlterarSenha = () => {
    setAlterandoSenha(false);
    setSenhaAtual('');
    setNovaSenha('');
    setConfirmarSenha('');
    setErroSenha(null);
  };

  const handleSalvarSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroSenha(null);

    if (!senhaAtual) {
      setErroSenha('Informe a senha atual.');
      return;
    }
    if (!regrasSenha.every((r) => r.valido)) {
      setErroSenha('A nova senha não atende aos requisitos mínimos.');
      return;
    }
    if (novaSenha !== confirmarSenha) {
      setErroSenha('As senhas não coincidem.');
      return;
    }
    if (novaSenha === senhaAtual) {
      setErroSenha('A nova senha deve ser diferente da atual.');
      return;
    }

    setSalvandoSenha(true);
    try {
      // O back encerra as outras sessões e devolve uma nova para este aparelho
      const sessao = await ClienteService.alterarSenha({
        senha_atual: senhaAtual,
        nova_senha: novaSenha,
        confirmar_senha: confirmarSenha,
      });
      entrar(sessao);
      fecharAlterarSenha();
      mostrarAviso('Senha alterada com sucesso.');
    } catch (err: any) {
      setErroSenha(mensagemDeErro(err, 'Não foi possível alterar a senha. Tente novamente.'));
    } finally {
      if (montado.current) setSalvandoSenha(false);
    }
  };

  // ── Sair ──
  const handleSair = () => {
    // Navega antes de limpar a sessão: assim a rota protegida não "lembra" o /perfil
    navigate('/login/cliente', { replace: true });
    sair();
  };

  // ── Estados de tela ──
  if (carregando && !perfil) {
    return (
      <CustomerLayout mode="logged">
        <div className="perfil">
          <div className="perfil__card">
            <p className="perfil__estado" role="status">Carregando seu perfil…</p>
          </div>
        </div>
      </CustomerLayout>
    );
  }

  if (!perfil) {
    return (
      <CustomerLayout mode="logged">
        <div className="perfil">
          <div className="perfil__card">
            <h1 className="perfil__nome">Não foi possível abrir o perfil</h1>
            <p className="perfil__estado" role="alert">{erroCarga}</p>
            <button className="perfil__btn-editar" onClick={carregar}>
              TENTAR NOVAMENTE
            </button>
          </div>
        </div>
      </CustomerLayout>
    );
  }

  const desde = clienteDesde(perfil.criado_em);

  return (
    <CustomerLayout mode="logged">
      <div className="perfil">

        {aviso && (
          <p className="perfil__aviso" role="status">{aviso}</p>
        )}

        {/* ── Dados pessoais ── */}
        <div className="perfil__card">
          <h1 className="perfil__nome">{perfil.nome}</h1>

          <div className="perfil__info">
            <div className="perfil__avatar" aria-hidden="true">{iniciais(perfil.nome)}</div>

            <div className="perfil__dados">
              {editando ? (
                <>
                  {erroEdicao && (
                    <p className="perfil__erro" role="alert">{erroEdicao}</p>
                  )}

                  <div className="perfil__campo">
                    <label className="perfil__label" htmlFor="perfilNome">Nome</label>
                    <input
                      id="perfilNome"
                      className="perfil__input"
                      value={formNome}
                      maxLength={100}
                      onChange={(e) => setFormNome(e.target.value)}
                    />
                  </div>

                  <div className="perfil__campo">
                    <label className="perfil__label" htmlFor="perfilTelefone">Telefone</label>
                    <input
                      id="perfilTelefone"
                      className="perfil__input"
                      type="tel"
                      inputMode="numeric"
                      placeholder="(11) 99999-9999"
                      value={formTelefone}
                      onChange={(e) => setFormTelefone(mascaraTelefone(e.target.value))}
                    />
                  </div>

                  <p className="perfil__detalhe">
                    <strong>E-mail:</strong> {perfil.email} 🔒
                  </p>
                  <p className="perfil__detalhe">
                    <strong>CPF:</strong> {mascararCpf(perfil.cpf)} 🔒
                  </p>
                  <p className="perfil__hint">
                    O e-mail e o CPF não podem ser alterados por aqui.
                  </p>

                  <div className="perfil__acoes-edicao">
                    <button
                      className="perfil__btn-cancelar"
                      onClick={() => setEditando(false)}
                      disabled={salvando}
                    >
                      Cancelar
                    </button>
                    <button
                      className="perfil__btn-salvar"
                      onClick={handleSalvar}
                      disabled={salvando}
                    >
                      {salvando ? 'Salvando…' : 'Salvar'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="perfil__detalhe">
                    <strong>Telefone:</strong> {perfil.telefone || 'adicione o telefone'}
                  </p>
                  <p className="perfil__detalhe">
                    <strong>E-mail:</strong> {perfil.email}
                    {perfil.email_verificado && (
                      <span className="perfil__selo" title="E-mail confirmado">✔ verificado</span>
                    )}
                  </p>
                  <p className="perfil__detalhe">
                    <strong>CPF:</strong> {mascararCpf(perfil.cpf)}
                  </p>
                  {desde && (
                    <p className="perfil__hint">Cliente desde {desde}</p>
                  )}

                  <button className="perfil__btn-editar" onClick={handleEditar}>
                    EDITAR
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Segurança ── */}
        <div className="perfil__secao">
          <h2 className="perfil__secao-titulo">SEGURANÇA</h2>

          {alterandoSenha ? (
            <form className="perfil__form-senha" onSubmit={handleSalvarSenha}>
              {erroSenha && <p className="perfil__erro" role="alert">{erroSenha}</p>}

              <div className="perfil__campo">
                <label className="perfil__label" htmlFor="perfilSenhaAtual">Senha atual</label>
                <input
                  id="perfilSenhaAtual"
                  className="perfil__input"
                  type="password"
                  autoComplete="current-password"
                  value={senhaAtual}
                  onChange={(e) => setSenhaAtual(e.target.value)}
                />
              </div>

              <div className="perfil__campo">
                <label className="perfil__label" htmlFor="perfilNovaSenha">Nova senha</label>
                <input
                  id="perfilNovaSenha"
                  className="perfil__input"
                  type="password"
                  autoComplete="new-password"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                />
                {novaSenha.length > 0 && (
                  <ul className="perfil__regras">
                    {regrasSenha.map((r) => (
                      <li
                        key={r.label}
                        className={r.valido ? 'perfil__regra perfil__regra--ok' : 'perfil__regra perfil__regra--erro'}
                      >
                        {r.valido ? '✔' : '✘'} {r.label}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="perfil__campo">
                <label className="perfil__label" htmlFor="perfilConfirmarSenha">Confirmar nova senha</label>
                <input
                  id="perfilConfirmarSenha"
                  className="perfil__input"
                  type="password"
                  autoComplete="new-password"
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                />
              </div>

              <div className="perfil__acoes-edicao">
                <button
                  type="button"
                  className="perfil__btn-cancelar"
                  onClick={fecharAlterarSenha}
                  disabled={salvandoSenha}
                >
                  Cancelar
                </button>
                <button type="submit" className="perfil__btn-salvar" disabled={salvandoSenha}>
                  {salvandoSenha ? 'Salvando…' : 'Alterar senha'}
                </button>
              </div>
            </form>
          ) : (
            <div className="perfil__secao-linha">
              <p className="perfil__secao-texto">
                Ao alterar a senha, os outros aparelhos conectados à sua conta são desconectados.
              </p>
              <button className="perfil__btn-editar" onClick={() => setAlterandoSenha(true)}>
                ALTERAR SENHA
              </button>
            </div>
          )}
        </div>

        {/* ── Endereços ── */}
        <div className="perfil__secao">
          <h2 className="perfil__secao-titulo">ENDEREÇOS DE ENTREGA</h2>
          <div className="perfil__secao-linha">
            <p className="perfil__secao-texto">Cadastre e gerencie onde você quer receber seus pedidos.</p>
            <button className="perfil__btn-editar" onClick={() => navigate('/endereço')}>
              GERENCIAR
            </button>
          </div>
        </div>

        {/* ── Sair ── */}
        <button className="perfil__btn-sair" onClick={handleSair}>
          SAIR DA CONTA
        </button>

      </div>
    </CustomerLayout>
  );
};

export default PerfilCliente;
