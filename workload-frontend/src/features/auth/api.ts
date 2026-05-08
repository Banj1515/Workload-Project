import { http } from "../../lib/http";
import type { LoginRequest, LoginResponse } from "./types";

export async function login(data: LoginRequest): Promise<LoginResponse> {
    const response = await http.post<LoginResponse>("/api/auth/login", data);
    return response.data;
}

export async function logout(): Promise<void> {
    try {
        await http.post("/api/auth/logout");
    } catch { //meow
    }
}