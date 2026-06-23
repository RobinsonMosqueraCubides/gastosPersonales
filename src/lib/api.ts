import axios from 'axios';

const api = axios.create({
  baseURL: '', // Vacío para usar la misma URL (se redirige mediante proxy en desarrollo o Vercel en producción)
});

// Interceptor para inyectar el token JWT en las cabeceras
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Interceptor para manejar el deslogueo automático si el token expira
api.interceptors.response.use((response) => {
  return response;
}, (error) => {
  if (error.response && error.response.status === 401) {
    localStorage.removeItem('token');
    window.location.reload();
  }
  return Promise.reject(error);
});

export default api;
