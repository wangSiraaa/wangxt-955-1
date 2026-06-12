import axios from 'axios';
import type { ApiResponse } from '../../shared/types.js';

const client = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export async function apiGet<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const response = await client.get<ApiResponse<T>>(url, { params });
  if (response.data.code === 200) {
    return response.data.data as T;
  }
  throw new Error(response.data.message || '请求失败');
}

export async function apiPost<T>(url: string, data?: unknown): Promise<T> {
  const response = await client.post<ApiResponse<T>>(url, data);
  if (response.data.code === 200) {
    return response.data.data as T;
  }
  throw new Error(response.data.message || '请求失败');
}

export async function apiPut<T>(url: string, data?: unknown): Promise<T> {
  const response = await client.put<ApiResponse<T>>(url, data);
  if (response.data.code === 200) {
    return response.data.data as T;
  }
  throw new Error(response.data.message || '请求失败');
}

export async function apiDelete<T>(url: string): Promise<T> {
  const response = await client.delete<ApiResponse<T>>(url);
  if (response.data.code === 200) {
    return response.data.data as T;
  }
  throw new Error(response.data.message || '请求失败');
}

export default client;
