
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Sales from './pages/Sales';
import Purchases from './pages/Purchases';
import Inventory from './pages/Inventory';
import Reports from './pages/Reports';
import Contacts from './pages/Contacts';
import Settings from './pages/Settings';
import Header from './components/Header';
import type { Page } from './types';
import { db } from './database';
import { SnackbarProvider } from './hooks/useSnackbar';

const App: React.FC = () => {
  const [activePage, setActivePage] = useState<Page>('Dashboard');
  const [dbLoaded, setDbLoaded] = useState(false);

  useEffect(() => {
    const initializeDb = async () => {
      await db.init();
      setDbLoaded(true);
    };
    initializeDb();
  }, []);

  const renderPage = () => {
    switch (activePage) {
      case 'Dashboard':
        return <Dashboard />;
      case 'Sales':
        return <Sales />;
      case 'Purchases':
        return <Purchases />;
      case 'Inventory':
        return <Inventory />;
      case 'Reports':
        return <Reports />;
      case 'Contacts':
        return <Contacts />;
      case 'Settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };
  
  if (!dbLoaded) {
    return (
        <div className="flex items-center justify-center h-screen bg-secondary/50">
            <div className="text-lg font-semibold text-primary">Loading Database...</div>
        </div>
    )
  }

  return (
    <SnackbarProvider>
      <div className="flex h-screen bg-secondary/50">
        <Sidebar activePage={activePage} setActivePage={setActivePage} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header title={activePage} />
          <main className="flex-1 overflow-x-hidden overflow-y-auto bg-secondary/50 p-6">
            {renderPage()}
          </main>
        </div>
      </div>
    </SnackbarProvider>
  );
};

export default App;