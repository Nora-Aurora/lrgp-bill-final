
import React from 'react';

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  description?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, description }) => {
  return (
    <div className="bg-card p-6 rounded-lg border border-border shadow-sm">
      <div className="flex flex-row items-center justify-between pb-2">
        <h3 className="text-sm font-medium tracking-tight text-muted-foreground">{title}</h3>
        {icon}
      </div>
      <div className="mt-2">
        <h2 className="text-2xl font-bold">{value}</h2>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
    </div>
  );
};

export default StatCard;
