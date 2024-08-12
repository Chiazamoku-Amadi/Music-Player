// Creating Utility Functions for Authentication
import api from "./api";

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const clientSecret = import.meta.env.VITE_SPOTIFY_CLIENT_SECRET;
const redirectUri = import.meta.env.VITE_SPOTIFY_REDIRECT_URI;
const authUrl = new URL("https://accounts.spotify.com/authorize");

// Create Code Verifier
const generateRandomString = (length: number) => {
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const values = crypto.getRandomValues(new Uint8Array(length));

  return values.reduce((acc, x) => acc + possible[x % possible.length], "");
};

// Code Challenge
const sha256 = async (plain: string) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);

  return window.crypto.subtle.digest("SHA-256", data);
};

const base64encode = (input: ArrayBuffer) => {
  return btoa(String.fromCharCode(...new Uint8Array(input)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
};

// Authorization Request: Creating the spotify auth url
export const getSpotifyAuthURL = async (): Promise<string> => {
  const existingCodeVerifier = window.localStorage.getItem("code_verifier");
  let codeVerifier;

  if (existingCodeVerifier) {
    codeVerifier = existingCodeVerifier;
  } else {
    codeVerifier = generateRandomString(64); // Generates a cryptographically sound random string of length 64
    window.localStorage.setItem("code_verifier", codeVerifier);
  }

  const scope =
    "user-read-private user-read-email user-read-recently-played user-library-read";
  const hashed = await sha256(codeVerifier); // Creates a SHA-256 hash of the code verifier. The resulting hashed value is an ArrayBuffer
  const codeChallenge = base64encode(hashed); // Encodes the hashed value using Base64 URL encoding

  window.localStorage.setItem("code_verifier", codeVerifier); // Store code verifier in local storage

  const params = {
    response_type: "code",
    client_id: clientId,
    scope,
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
    redirect_uri: redirectUri,
  };

  authUrl.search = new URLSearchParams(params).toString(); // Constructs the full authorization URL with the query parameters from the params object

  return authUrl.toString(); // Redirects the user's browser to this URL
};

// Access Token Request: Getting the access token - Exchanging the auth code for an access token
export const getAccessToken = async (code: string): Promise<TokenResponse> => {
  const codeVerifier = localStorage.getItem("code_verifier");

  if (!codeVerifier) {
    throw new Error("Code verifier not found in local storage");
  }

  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: codeVerifier,
  });

  console.log("Authorization Code:", code);
  console.log("Code Verifier:", codeVerifier);
  console.log("Params:", params.toString());

  const response = await api.post<TokenResponse>(
    "https://accounts.spotify.com/api/token",
    params,
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
    }
  );

  localStorage.setItem("access_token", response.data.access_token);
  localStorage.removeItem("code_verifier");

  return response.data;
};
