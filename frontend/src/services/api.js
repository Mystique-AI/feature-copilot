import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to handle 401 errors (expired/invalid token)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear stored auth data
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Redirect to login page (only if not already on login/register)
      const currentPath = window.location.pathname;
      if (currentPath !== '/login' && currentPath !== '/register') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

export const login = async (username, password) => {
  const formData = new FormData();
  formData.append('username', username);
  formData.append('password', password);
  const response = await api.post('/auth/token', formData);
  return response.data;
};

export const register = async (email, password, fullName) => {
  const response = await api.post('/users/', {
    email,
    password,
    full_name: fullName
  });
  return response.data;
};

export const getCurrentUser = async () => {
  const response = await api.get('/users/me');
  return response.data;
};

export const updateProfile = async (fullName) => {
  const response = await api.put('/users/me', {
    full_name: fullName
  });
  return response.data;
};

export const getFeatures = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.status) params.append('status', filters.status);
  if (filters.priority) params.append('priority', filters.priority);
  if (filters.search) params.append('search', filters.search);
  
  const response = await api.get(`/features/?${params.toString()}`);
  return response.data;
};

export const getFeature = async (featureId) => {
  const response = await api.get(`/features/${featureId}`);
  return response.data;
};

export const createFeature = async (featureData) => {
  const response = await api.post('/features/', featureData);
  return response.data;
};

export const updateFeature = async (featureId, featureData) => {
  const response = await api.put(`/features/${featureId}`, featureData);
  return response.data;
};

export const transitionFeature = async (featureId, status, reason = null) => {
  const response = await api.post(`/features/${featureId}/transition`, { status, reason });
  return response.data;
};

export const assignFeature = async (featureId, userId) => {
  const response = await api.post(`/features/${featureId}/assign?user_id=${userId}`);
  return response.data;
};

// Comments
export const getComments = async (featureId) => {
  const response = await api.get(`/features/${featureId}/comments`);
  return response.data;
};

export const addComment = async (featureId, content) => {
  const response = await api.post(`/features/${featureId}/comments`, { content });
  return response.data;
};

// AI
export const aiAssist = async (action, context, complexity = 'low') => {
  const response = await api.post('/features/ai-assist', { action, context, complexity });
  return response.data;
};

// Attachments
export const uploadAttachment = async (featureId, file) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post(`/features/${featureId}/attachments`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
};

export const getAttachments = async (featureId) => {
  const response = await api.get(`/features/${featureId}/attachments`);
  return response.data;
};

export const downloadAttachment = (attachmentId) => {
  const token = localStorage.getItem('token');
  const baseUrl = API_URL.startsWith('/') ? '' : API_URL;
  return `${baseUrl}/features/attachments/${attachmentId}/download?token=${token}`;
};

export const deleteAttachment = async (attachmentId) => {
  const response = await api.delete(`/features/attachments/${attachmentId}`);
  return response.data;
};

// Users
export const getUsers = async (role = null) => {
  const params = role ? `?role=${role}` : '';
  const response = await api.get(`/users/${params}`);
  return response.data;
};

export const getDevelopers = async () => {
  const response = await api.get('/users/developers');
  return response.data;
};

export const updateUserRole = async (userId, role) => {
  const response = await api.put(`/users/${userId}/role?role=${role}`);
  return response.data;
};

// Knowledge Base
export const getKnowledgeBases = async (domain = null) => {
  const params = domain ? `?domain=${domain}` : '';
  const response = await api.get(`/knowledge-base/${params}`);
  return response.data;
};

export const getKnowledgeBase = async (id) => {
  const response = await api.get(`/knowledge-base/${id}`);
  return response.data;
};

export const getKnowledgeDomains = async () => {
  const response = await api.get('/knowledge-base/domains');
  return response.data;
};

export const uploadKnowledgeBase = async (file, name = null, domain = null, description = null) => {
  const formData = new FormData();
  formData.append('file', file);
  if (name) formData.append('name', name);
  if (domain) formData.append('domain', domain);
  if (description) formData.append('description', description);
  
  const response = await api.post('/knowledge-base/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
};

export const updateKnowledgeBase = async (id, data) => {
  const response = await api.put(`/knowledge-base/${id}`, data);
  return response.data;
};

export const reprocessKnowledgeBase = async (id, file) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post(`/knowledge-base/${id}/reprocess`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
};

export const deleteKnowledgeBase = async (id) => {
  const response = await api.delete(`/knowledge-base/${id}`);
  return response.data;
};

export const getKnowledgeSection = async (kbId, address) => {
  const response = await api.get(`/knowledge-base/${kbId}/section/${address}`);
  return response.data;
};

export const downloadKnowledgeMarkdown = (id) => {
  const token = localStorage.getItem('token');
  const baseUrl = API_URL.startsWith('/') ? '' : API_URL;
  return `${baseUrl}/knowledge-base/${id}/download/markdown`;
};

export const downloadKnowledgeJson = (id) => {
  const token = localStorage.getItem('token');
  const baseUrl = API_URL.startsWith('/') ? '' : API_URL;
  return `${baseUrl}/knowledge-base/${id}/download/json`;
};
