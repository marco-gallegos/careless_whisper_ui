import { createContext, useCallback, useContext, useEffect, useState } from "react";
import PropTypes from "prop-types";
import * as api from "../services/api";

// Login is optional: without it the app works exactly as before (local only).

const TOKEN_KEY = "audioTranslator.token";
const STORE_KEY = "audioTranslator.storeOnRecord";

function read(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // storage unavailable: the session just won't survive a reload
  }
}

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => read(TOKEN_KEY));
  const [user, setUser] = useState(null);
  const [storeOnRecord, setStoreOnRecordState] = useState(
    () => read(STORE_KEY) === "1"
  );

  const logout = useCallback(() => {
    write(TOKEN_KEY, null);
    setToken(null);
    setUser(null);
  }, []);

  // Restore the user for a saved token; drop the token if the server rejects it
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api
      .me(token)
      .then((u) => !cancelled && setUser(u))
      .catch((e) => {
        if (!cancelled && e.status === 401) logout();
      });
    return () => {
      cancelled = true;
    };
  }, [token, logout]);

  const login = async (username, password) => {
    const { access_token } = await api.login(username, password);
    write(TOKEN_KEY, access_token);
    setToken(access_token);
  };

  const register = async (username, password) => {
    await api.register(username, password);
    await login(username, password);
  };

  const setStoreOnRecord = (value) => {
    write(STORE_KEY, value ? "1" : null);
    setStoreOnRecordState(!!value);
  };

  const value = {
    token,
    user,
    isLoggedIn: !!token,
    login,
    register,
    logout,
    // Only meaningful while logged in
    storeOnRecord: !!token && storeOnRecord,
    setStoreOnRecord,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

AuthProvider.propTypes = { children: PropTypes.node.isRequired };

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
