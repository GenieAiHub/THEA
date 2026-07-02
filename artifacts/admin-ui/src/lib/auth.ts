export const getToken = () => localStorage.getItem("thea_admin_token");
export const setToken = (token: string) => localStorage.setItem("thea_admin_token", token);
export const clearToken = () => localStorage.removeItem("thea_admin_token");
