import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Base_URL from '../lib/config';
interface AuthContextType {
  isLoggedIn: boolean;
  user: any;
  token: string | null;
  login: (user: any, token: string) => void;
  logout: () => void;
  makeAuthenticatedRequest: (url: string, options?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);


 useEffect(() => {
  const checkLogin = async () => {
    const userData = await AsyncStorage.getItem('user');
    const tokenData = await AsyncStorage.getItem('token');
    if (userData && tokenData) {
      // Decode the token payload to check expiry
      try {
        const payload = JSON.parse(atob(tokenData.split('.')[1]));
        const isExpired = payload.exp * 1000 < Date.now();
        if (isExpired) {
          // Token expired — clear storage and force re-login
          await AsyncStorage.removeItem('user');
          await AsyncStorage.removeItem('token');
        } else {
          setUser(JSON.parse(userData));
          setToken(tokenData);
          setIsLoggedIn(true);
        }
      } catch {
        // Malformed token — clear it
        await AsyncStorage.removeItem('user');
        await AsyncStorage.removeItem('token');
      }
    }
    setLoading(false);
  };
  checkLogin();
}, []);

  const login = async (userData: any, tokenData: string) => {
    setUser(userData);
    setToken(tokenData);
    setIsLoggedIn(true);
    await AsyncStorage.setItem('user', JSON.stringify(userData));
    await AsyncStorage.setItem('token', tokenData);
  };

  const logout = async () => {
    setUser(null);
    setToken(null);
    setIsLoggedIn(false);
    await AsyncStorage.removeItem('user');
    await AsyncStorage.removeItem('token');
  };

  const makeAuthenticatedRequest = async (url: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers);

    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const cleanUrl = url.startsWith('/') ? url : `/${url}`;
    return fetch(`${Base_URL}${cleanUrl}`, {
      ...options,
      headers,
    });
  };

  if (loading) {
    return null; // Loading screen
  }

  return (
    <AuthContext.Provider value={{ isLoggedIn, user, token, login, logout, makeAuthenticatedRequest }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};