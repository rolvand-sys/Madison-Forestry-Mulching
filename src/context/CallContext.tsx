import React, { createContext, useContext, useState } from 'react';

interface CallContextValue {
  isCallModalOpen: boolean;
  openCallModal: () => void;
  closeCallModal: () => void;
}

const CallContext = createContext<CallContextValue | undefined>(undefined);

export function CallProvider({ children }: { children: React.ReactNode }) {
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);

  const openCallModal = () => setIsCallModalOpen(true);
  const closeCallModal = () => setIsCallModalOpen(false);

  return (
    <CallContext.Provider value={{ isCallModalOpen, openCallModal, closeCallModal }}>
      {children}
    </CallContext.Provider>
  );
}

export function useCallModal(): CallContextValue {
  const ctx = useContext(CallContext);
  if (!ctx) {
    throw new Error('useCallModal must be used within a CallProvider');
  }
  return ctx;
}
