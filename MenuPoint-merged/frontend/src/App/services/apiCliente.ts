import axios from 'axios'

/**
 * Cliente HTTP do CLIENTE do restaurante (consumidor).
 *
 * É separado do `api.ts` (restaurante) de propósito: cada um usa o próprio token
 * e o próprio destino quando a sessão expira. Assim o dono do restaurante e um
 * cliente podem estar logados no mesmo navegador sem se sobrescreverem.
 */
export const CHAVES_CLIENTE = {
  token: '@menupoint:cliente_token',
  refresh: '@menupoint:cliente_refresh_token',
  cliente: '@menupoint:cliente',
}

// 401 nestas rotas = "senha errada" / "código inválido", não "sessão expirada".
const ROTAS_DE_AUTENTICACAO =
  /\/?auth\/cliente\/(login|register|verificar-codigo|reenviar-codigo|esqueci-senha|redefinir-senha|refresh|logout)/

const apiCliente = axios.create({
  baseURL: `${process.env.REACT_APP_API_URL}/api/v1`,
     timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
})

apiCliente.interceptors.request.use((config) => {
  const token = localStorage.getItem(CHAVES_CLIENTE.token)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

apiCliente.interceptors.response.use(
  (response) => response,
  (error) => {
    const url: string = error.config?.url ?? ''

    if (error.response?.status === 401 && !ROTAS_DE_AUTENTICACAO.test(url)) {
      localStorage.removeItem(CHAVES_CLIENTE.token)
      localStorage.removeItem(CHAVES_CLIENTE.refresh)
      localStorage.removeItem(CHAVES_CLIENTE.cliente)

      if (window.location.pathname !== '/login/cliente') {
        window.location.href = '/login/cliente'
      }
    }

    return Promise.reject(error)
  }
)

export default apiCliente
