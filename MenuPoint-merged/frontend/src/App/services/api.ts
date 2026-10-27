import axios from 'axios'

const api = axios.create({
  baseURL: `${process.env.REACT_APP_API_URL}/api/v1`,

  // 30s: o Azure Container Apps pode estar "dormindo" (cold start) e a primeira
  // requisição leva mais de 10s. Com 10s o login falhava na 1ª tentativa e só
  // funcionava na 2ª. NÃO diminuir (já regrediu em merges anteriores).
  timeout: 30000,

  headers: {
    'Content-Type': 'application/json',
  },
})

// Rotas de autenticação: um 401 aqui significa "senha errada" / "código inválido",
// não "sessão expirada". Nessas, a mensagem do servidor precisa chegar na tela.
const ROTAS_DE_AUTENTICACAO = /\/?auth\/(login|register|verificar-codigo|reenviar-codigo|esqueci-senha|redefinir-senha|refresh|logout)/

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('@menupoint:token')

    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

api.interceptors.response.use(
  (response) => response,

  (error) => {
    const url: string = error.config?.url ?? ''
    const ehRotaDeAuth = ROTAS_DE_AUTENTICACAO.test(url)

    // 401 fora das rotas de login/cadastro = sessão inválida ou expirada
    if (error.response?.status === 401 && !ehRotaDeAuth) {
      localStorage.removeItem('@menupoint:token')
      localStorage.removeItem('@menupoint:refresh_token')
      localStorage.removeItem('@menupoint:usuario')

      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }

    return Promise.reject(error)
  }
)

export default api
