import React, { createContext, useState, useContext, useCallback, ReactNode, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { XIcon } from '../components/icons';

type SnackbarType = 'success' | 'error' | 'info';

interface SnackbarMessage {
  id: number;
  message: string;
  type: SnackbarType;
}

interface SnackbarContextType {
  showSnackbar: (message: string, type?: SnackbarType) => void;
}

const SnackbarContext = createContext<SnackbarContextType | undefined>(undefined);

export const useSnackbar = () => {
  const context = useContext(SnackbarContext);
  if (!context) {
    throw new Error('useSnackbar must be used within a SnackbarProvider');
  }
  return context;
};

const Snackbar: React.FC<{ message: SnackbarMessage; onDismiss: (id: number) => void }> = ({ message, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(message.id);
    }, 5000); // Auto-dismiss after 5 seconds

    return () => {
      clearTimeout(timer);
    };
  }, [message, onDismiss]);

  const typeClasses = {
    success: 'bg-green-100 border-green-500 text-green-700',
    error: 'bg-red-100 border-red-500 text-red-700',
    info: 'bg-blue-100 border-blue-500 text-blue-700',
  };

  return (
    <div
      className={`relative w-full max-w-sm p-4 pr-12 rounded-lg border shadow-lg animate-slide-in-right ${typeClasses[message.type]}`}
      role="alert"
    >
      <p className="font-bold">{message.type.charAt(0).toUpperCase() + message.type.slice(1)}</p>
      <p className="text-sm">{message.message}</p>
      <button
        onClick={() => onDismiss(message.id)}
        className="absolute top-0 bottom-0 right-0 px-4 py-3"
        aria-label="Close"
      >
        <XIcon className="h-4 w-4" />
      </button>
    </div>
  );
};

const SnackbarContainer: React.FC<{ snackbars: SnackbarMessage[]; dismissSnackbar: (id: number) => void }> = ({ snackbars, dismissSnackbar }) => {
  return ReactDOM.createPortal(
    <div className="fixed top-5 right-5 z-[100] space-y-2">
      {snackbars.map((snackbar) => (
        <Snackbar key={snackbar.id} message={snackbar} onDismiss={dismissSnackbar} />
      ))}
    </div>,
    document.body
  );
};

export const SnackbarProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [snackbars, setSnackbars] = useState<SnackbarMessage[]>([]);

  const showSnackbar = useCallback((message: string, type: SnackbarType = 'info') => {
    const newSnackbar: SnackbarMessage = {
      id: Date.now(),
      message,
      type,
    };
    setSnackbars((prevSnackbars) => [...prevSnackbars, newSnackbar]);
  }, []);

  const dismissSnackbar = useCallback((id: number) => {
    setSnackbars((prevSnackbars) => prevSnackbars.filter((snackbar) => snackbar.id !== id));
  }, []);

  const contextValue = {
    showSnackbar,
  };

  return (
    <SnackbarContext.Provider value={contextValue}>
      {children}
      <SnackbarContainer snackbars={snackbars} dismissSnackbar={dismissSnackbar} />
    </SnackbarContext.Provider>
  );
};
