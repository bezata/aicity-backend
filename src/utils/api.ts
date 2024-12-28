const API_KEY = process.env.NEXT_PUBLIC_BACKEND_API_KEY;
const API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

// Client-side fetch function
export async function fetchFromAPI(
  endpoint: string,
  options: RequestInit = {}
) {
  const url = `${API_BASE_URL}${
    endpoint.startsWith("/") ? endpoint : `/${endpoint}`
  }`;

  const defaultHeaders = {
    "Content-Type": "application/json",
    "x-api-key": API_KEY as string,
  };

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.message || "An error occurred while fetching the data"
    );
  }

  return response.json();
}

// Server Actions fetch function
export async function serverAction(
  endpoint: string,
  options: RequestInit = {}
) {
  "use server";

  const url = `${API_BASE_URL}${
    endpoint.startsWith("/") ? endpoint : `/${endpoint}`
  }`;

  const defaultHeaders = {
    "Content-Type": "application/json",
    "x-api-key": API_KEY as string,
  };

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.message || "An error occurred while fetching the data"
    );
  }

  return response.json();
}
