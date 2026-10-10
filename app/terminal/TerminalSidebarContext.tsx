"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface TerminalSidebarContextType {
  isCollapsed: boolean;
  setIsCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  toggleSidebar: () => void;
  hideHeader: boolean;
  setHideHeader: React.Dispatch<React.SetStateAction<boolean>>;
}

const TerminalSidebarContext = createContext<TerminalSidebarContextType>({
  isCollapsed: false,
  setIsCollapsed: () => {},
  toggleSidebar: () => {},
  hideHeader: false,
  setHideHeader: () => {},
});

export function TerminalSidebarProvider({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hideHeader, setHideHeader] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("omni_pos_sidebar_collapsed");
      if (saved !== null) {
        setIsCollapsed(saved === "true");
      }
    } catch {}
  }, []);

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("omni_pos_sidebar_collapsed", String(next));
      } catch {}
      return next;
    });
  };

  return (
    <TerminalSidebarContext.Provider
      value={{
        isCollapsed,
        setIsCollapsed,
        toggleSidebar,
        hideHeader,
        setHideHeader,
      }}
    >
      {children}
    </TerminalSidebarContext.Provider>
  );
}

export function useTerminalSidebar() {
  return useContext(TerminalSidebarContext);
}
