export function getApiBaseUrl(): string {
  const value = import.meta.env.VITE_API_BASE_URL;

  if (!value || typeof value !== "string") {
    throw new Error("VITE_API_BASE_URL is missing.");
  }

  return value.replace(/\/+$/, "");
}
