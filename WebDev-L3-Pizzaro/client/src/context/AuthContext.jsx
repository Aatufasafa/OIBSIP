import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem("pizzaro-user");
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(() => {
    return localStorage.getItem("pizzaro-token");
  });

  const isAuthenticated = Boolean(token && user);

  useEffect(() => {
    if (user) {
      localStorage.setItem("pizzaro-user", JSON.stringify(user));
    } else {
      localStorage.removeItem("pizzaro-user");
    }

    if (token) {
      localStorage.setItem("pizzaro-token", token);
    } else {
      localStorage.removeItem("pizzaro-token");
    }
  }, [user, token]);

  function login(userData, userToken) {
    setUser(userData);
    setToken(userToken);
  }

  function logout() {
    setUser(null);
    setToken(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}