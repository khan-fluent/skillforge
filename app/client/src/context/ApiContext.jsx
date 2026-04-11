/**
 * ApiContext — provides the correct api object based on mode.
 * In normal mode: returns the real api from lib/api.js
 * In demo mode: returns the in-memory demoApi from DemoContext
 */

import { createContext, useContext } from "react";
import { api as realApi } from "../lib/api.js";
import { useDemo } from "./DemoContext.jsx";

const ApiCtx = createContext(null);

export function ApiProvider({ children }) {
  const demo = useDemo();
  const apiObj = demo?.isDemo ? demo.demoApi : realApi;

  return (
    <ApiCtx.Provider value={apiObj}>
      {children}
    </ApiCtx.Provider>
  );
}

export function useApi() {
  const ctx = useContext(ApiCtx);
  if (!ctx) return realApi; // Fallback for components outside provider
  return ctx;
}
