// TODO: Replace mock with real API calls when backend is ready

import type {
  LoginRequest,
  SignUpRequest,
  AuthTokens,
  User,
  ApiResponse,
} from "@/types";
import { apiClient } from "@/api/client";
import { mockAuthService } from "@/mock/auth";

const USE_MOCK = true; // TODO: flip when backend is live

export const authApi = {
  login(data: LoginRequest): Promise<ApiResponse<{ user: User; tokens: AuthTokens }>> {
    if (USE_MOCK) return mockAuthService.login(data);
    return apiClient.post("/auth/login", data);
  },

  signUp(data: SignUpRequest): Promise<ApiResponse<{ user: User }>> {
    if (USE_MOCK) return mockAuthService.signUp(data);
    return apiClient.post("/auth/signup", data);
  },

  logout(): Promise<ApiResponse<null>> {
    if (USE_MOCK) return mockAuthService.logout();
    return apiClient.post("/auth/logout");
  },

  getMe(): Promise<ApiResponse<User>> {
    if (USE_MOCK) return mockAuthService.getMe();
    return apiClient.get("/auth/me");
  },

  verifyEmail(token: string): Promise<ApiResponse<null>> {
    if (USE_MOCK) return mockAuthService.verifyEmail(token);
    return apiClient.post("/auth/verify-email", { token });
  },

  forgotPassword(email: string): Promise<ApiResponse<null>> {
    if (USE_MOCK) return mockAuthService.forgotPassword(email);
    return apiClient.post("/auth/forgot-password", { email });
  },

  resetPassword(token: string, password: string): Promise<ApiResponse<null>> {
    if (USE_MOCK) return mockAuthService.resetPassword(token, password);
    return apiClient.post("/auth/reset-password", { token, password });
  },
};
