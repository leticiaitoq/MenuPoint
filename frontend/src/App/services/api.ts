import axios from 'axios'

const api = axios.create({
  baseURL: `${process.env.REACT_APP_API_URL}/api/v1`,

  timeout: 10000,

  headers: {
    'Content-Type': 'application/json',
  },
})

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

  // Se der erro, trata aq
  (error) => {
    // '401' não autorizado ou inválido
    if (error.response?.status === 401) {
      localStorage.removeItem('@menupoint:token')
      localStorage.removeItem('@menupoint:usuario')
      
      window.location.href = '/login'
    }

    return Promise.reject(error)
  }
)

export default api