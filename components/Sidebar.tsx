
import React from 'react';
import type { Page } from '../types';
import { DashboardIcon, SalesIcon, PurchasesIcon, InventoryIcon, ReportsIcon, ContactsIcon, SettingsIcon, PackageIcon } from './icons';

interface SidebarProps {
  activePage: Page;
  setActivePage: (page: Page) => void;
}

const NavLink: React.FC<{
  icon: React.ReactNode;
  label: Page;
  activePage: Page;
  onClick: (page: Page) => void;
}> = ({ icon, label, activePage, onClick }) => (
  <button
    onClick={() => onClick(label)}
    className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors
      ${
        activePage === label
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
      }`}
  >
    {icon}
    <span className="ml-3">{label}</span>
  </button>
);

const Sidebar: React.FC<SidebarProps> = ({ activePage, setActivePage }) => {
  return (
    <div className="flex h-full max-h-screen flex-col gap-2 bg-card border-r border-border">
      <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
        <a href="/" className="flex items-center gap-2 font-semibold">
          <PackageIcon />
          <span className="">LRGP</span>
        </a>
      </div>
      <div className="flex-1">
        <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
          <NavLink icon={<DashboardIcon />} label="Dashboard" activePage={activePage} onClick={setActivePage} />
          <NavLink icon={<SalesIcon />} label="Sales" activePage={activePage} onClick={setActivePage} />
          <NavLink icon={<PurchasesIcon />} label="Purchases" activePage={activePage} onClick={setActivePage} />
          <NavLink icon={<InventoryIcon />} label="Inventory" activePage={activePage} onClick={setActivePage} />
          <NavLink icon={<ContactsIcon />} label="Contacts" activePage={activePage} onClick={setActivePage} />
          <NavLink icon={<ReportsIcon />} label="Reports" activePage={activePage} onClick={setActivePage} />
        </nav>
      </div>
      <div className="mt-auto p-4 border-t">
         <button
            onClick={() => setActivePage('Settings')}
            className={`w-full flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors
              ${
                activePage === 'Settings'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              }`}
          >
            <SettingsIcon />
            <span className="ml-3">Settings</span>
          </button>
      </div>
    </div>
  );
};

export default Sidebar;