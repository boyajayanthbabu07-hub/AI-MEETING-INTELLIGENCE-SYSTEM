
import axios from "axios";

const getBaseURL = () => {
  // If explicitly configured in .env, respect that:
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (typeof window !== "undefined" && window.location.hostname.includes("vercel.app")) {
    return "https://ai-meeting-intelligence-system-hevd.onrender.com";
  }
  return "";
};

const api = axios.create({
  baseURL: getBaseURL(),
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(
  (config) => {
    config.baseURL = getBaseURL();
    const token = localStorage.getItem("access_token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const msg = error.response.data?.msg || error.response.data?.message || "";
      if (
        msg.toLowerCase().includes("expired") ||
        msg.toLowerCase().includes("token") ||
        msg.toLowerCase().includes("signature") ||
        msg.toLowerCase().includes("unauthorized")
      ) {
        localStorage.removeItem("access_token");
        if (typeof window !== "undefined" && !window.location.pathname.includes("/login")) {
          window.location.href = "/login?expired=1";
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
