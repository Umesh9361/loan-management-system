import { createContext, useContext } from "react";

interface DedicatedModeContextType {
  isDedicatedMode: boolean;
}

const DedicatedModeContext = createContext<DedicatedModeContextType>({ isDedicatedMode: false });

export function DedicatedModeProvider({ children, isDedicatedMode }: { children: any; isDedicatedMode: boolean }) {
  return (
    <DedicatedModeContext.Provider value={{ isDedicatedMode }}>
      {children}
    </DedicatedModeContext.Provider>
  );
}

export function useDedicatedMode() {
  return useContext(DedicatedModeContext);
}
