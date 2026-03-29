// Backend Cloud Run URL
export const API_BASE_URL = 'https://arenai-backend-20167629382.us-central1.run.app';

export const getApiUrl = (endpoint: string) => {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${API_BASE_URL}${cleanEndpoint}`;
};
