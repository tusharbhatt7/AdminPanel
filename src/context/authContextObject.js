import { createContext } from 'react';

// Kept apart from the provider component so the module exports only a context,
// which keeps fast refresh working for AuthContext.jsx.
export const AuthContext = createContext(null);
