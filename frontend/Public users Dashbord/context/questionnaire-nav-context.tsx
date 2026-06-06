"use client";

import React, { createContext, useContext, useState } from "react";

export interface IAQPerson {
  id: string;       // "main" | "spouse" | "child-0" | "acc-0" …
  label: string;    // display name shown in sidebar
  tabIndex: number; // step-2 tab index to jump to
}

interface IAQNavContextType {
  persons: IAQPerson[];
  setPersons: (persons: IAQPerson[]) => void;
}

const IAQNavContext = createContext<IAQNavContextType>({
  persons: [],
  setPersons: () => {},
});

export function IAQNavProvider({ children }: { children: React.ReactNode }) {
  const [persons, setPersons] = useState<IAQPerson[]>([]);
  return (
    <IAQNavContext.Provider value={{ persons, setPersons }}>
      {children}
    </IAQNavContext.Provider>
  );
}

export function useIAQNav() {
  return useContext(IAQNavContext);
}
