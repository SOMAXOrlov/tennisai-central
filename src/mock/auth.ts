// ============================================================
// Mock Auth Service — Replace with real API
// ============================================================

import type {
  LoginRequest,
  SignUpRequest,
  AuthTokens,
  User,
  ApiResponse,
  PlayerProfile,
  CoachProfile,
  ObserverProfile,
  AdminProfile,
} from "@/types";

const delay = (ms = 500) => new Promise((r) => setTimeout(r, ms));

const MOCK_USERS: Record<string, User & { password: string }> = {
  "player@test.com": {
    id: "p1",
    email: "player@test.com",
    role: "player",
    firstName: "Alex",
    lastName: "Rivera",
    emailVerified: true,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    password: "password123",
  } as PlayerProfile & { password: string },
  "coach@test.com": {
    id: "c1",
    email: "coach@test.com",
    role: "coach",
    firstName: "Jordan",
    lastName: "Smith",
    emailVerified: true,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    password: "password123",
  } as CoachProfile & { password: string },
  "observer@test.com": {
    id: "o1",
    email: "observer@test.com",
    role: "observer",
    firstName: "Morgan",
    lastName: "Lee",
    emailVerified: true,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    password: "password123",
  } as ObserverProfile & { password: string },
  "admin@test.com": {
    id: "a1",
    email: "admin@test.com",
    role: "admin",
    firstName: "Admin",
    lastName: "User",
    emailVerified: true,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    password: "password123",
  } as AdminProfile & { password: string },
};

let currentUser: User | null = null;

function makeTokens(): AuthTokens {
  return { accessToken: "mock-access-token", refreshToken: "mock-refresh-token" };
}

function stripPassword(u: User & { password: string }): User {
  const { password, ...rest } = u;
  return rest;
}

export const mockAuthService = {
  async login(data: LoginRequest): Promise<ApiResponse<{ user: User; tokens: AuthTokens }>> {
    await delay();
    const email = data.email.trim().toLowerCase();
    const found = MOCK_USERS[email];
    if (!found || found.password !== data.password) {
      throw { status: 401, message: "Invalid email or password" };
    }
    currentUser = stripPassword(found);
    return { data: { user: currentUser, tokens: makeTokens() } };
  },

  async signUp(data: SignUpRequest): Promise<ApiResponse<{ user: User }>> {
    await delay();
    const email = data.email.trim().toLowerCase();
    if (MOCK_USERS[email]) {
      throw { status: 409, message: "Email already registered" };
    }
    const newUser: User & { password: string } = {
      id: `u-${Date.now()}`,
      email,
      role: data.role,
      firstName: data.firstName,
      lastName: data.lastName,
      emailVerified: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      password: data.password,
    };
    // Persist the new account so the user can actually sign in afterwards.
    // (Previously the new user was discarded, so signup → login always failed.)
    MOCK_USERS[email] = newUser;
    return { data: { user: stripPassword(newUser) }, message: "Check your email to verify your account" };
  },

  async logout(): Promise<ApiResponse<null>> {
    await delay(200);
    currentUser = null;
    return { data: null };
  },

  async getMe(): Promise<ApiResponse<User>> {
    await delay(300);
    if (!currentUser) throw { status: 401, message: "Not authenticated" };
    return { data: currentUser };
  },

  async verifyEmail(_token: string): Promise<ApiResponse<null>> {
    await delay();
    return { data: null, message: "Email verified successfully" };
  },

  async forgotPassword(_email: string): Promise<ApiResponse<null>> {
    await delay();
    return { data: null, message: "If the email exists, a reset link was sent" };
  },

  async resetPassword(_token: string, _password: string): Promise<ApiResponse<null>> {
    await delay();
    return { data: null, message: "Password reset successfully" };
  },
};
