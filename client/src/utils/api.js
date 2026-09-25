import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// One refresh at a time: the server rotates refresh tokens, so if two requests
// refreshed with the same token in parallel the second would fail and log the
// user out. Concurrent 401s all wait on the same in-flight refresh instead.
let refreshing = null;
export function refreshTokens() {
  if (!refreshing) {
    const refreshToken = localStorage.getItem('refreshToken');
    refreshing = (refreshToken
      ? axios.post('/api/auth/refresh', { refreshToken }).then(({ data }) => {
          localStorage.setItem('accessToken', data.accessToken);
          localStorage.setItem('refreshToken', data.refreshToken);
          return data.accessToken;
        })
      : Promise.reject(new Error('No refresh token'))
    ).finally(() => { refreshing = null; });
  }
  return refreshing;
}

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    // A 401 from login/register means bad credentials, not an expired session:
    // let the form show the error instead of redirecting (which reloads /login)
    const isAuthCall = original?.url?.startsWith('/auth/');
    if (error.response?.status === 401 && !original._retry && !isAuthCall) {
      original._retry = true;
      try {
        const accessToken = await refreshTokens();
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
