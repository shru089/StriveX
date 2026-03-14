import axios from 'axios'

// In dev, Vite proxies /api/* → localhost:5001/api/*
// In production, same-origin /api/* (Vercel rewrites)
const API_URL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
})

// ── Request interceptor: attach JWT ──
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── Response interceptor: handle 401 & silent refresh ──
let isRefreshing = false
let failedQueue = []

const processQueue = (error, token = null) => {
  failedQueue.forEach(p => (error ? p.reject(error) : p.resolve(token)))
  failedQueue = []
}

api.interceptors.response.use(
  res => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then(token => {
          original.headers.Authorization = `Bearer ${token}`
          return api(original)
        })
      }
      original._retry = true
      isRefreshing = true
      const refreshToken = localStorage.getItem('refreshToken')
      if (!refreshToken) {
        localStorage.clear()
        window.location.href = '/'
        return Promise.reject(error)
      }
      try {
        const res = await axios.post(`${API_URL}/auth/refresh`, { refresh_token: refreshToken })
        const { access_token, refresh_token } = res.data
        localStorage.setItem('authToken', access_token)
        if (refresh_token) localStorage.setItem('refreshToken', refresh_token)
        processQueue(null, access_token)
        original.headers.Authorization = `Bearer ${access_token}`
        return api(original)
      } catch (e) {
        processQueue(e, null)
        localStorage.clear()
        window.location.href = '/'
        return Promise.reject(e)
      } finally {
        isRefreshing = false
      }
    }
    return Promise.reject(error)
  }
)

export default api
