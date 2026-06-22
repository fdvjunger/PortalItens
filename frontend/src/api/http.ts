import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api',
  timeout: 300000,
});

api.interceptors.request.use((config) => {
  (config as any).metadata = { startTime: Date.now() };

  console.info('[FRONTEND][REQUEST]', {
    method: config.method,
    url: config.url,
    params: config.params,
    data: config.data instanceof FormData ? 'FormData' : config.data,
  });

  return config;
});

api.interceptors.response.use(
  (response) => {
    const startedAt = (response.config as any).metadata?.startTime;
    const durationMs = startedAt ? Date.now() - startedAt : null;

    console.info('[FRONTEND][RESPONSE]', {
      method: response.config.method,
      url: response.config.url,
      status: response.status,
      duration_ms: durationMs,
      request_id: response.headers['x-request-id'],
      data: response.data,
    });

    return response;
  },
  (error) => {
    const startedAt = (error.config as any)?.metadata?.startTime;
    const durationMs = startedAt ? Date.now() - startedAt : null;

    console.error('[FRONTEND][ERROR]', {
      method: error.config?.method,
      url: error.config?.url,
      status: error.response?.status,
      duration_ms: durationMs,
      request_id: error.response?.headers?.['x-request-id'],
      response: error.response?.data,
      message: error.message,
    });

    return Promise.reject(error);
  },
);

export const http = api;
export default api;
