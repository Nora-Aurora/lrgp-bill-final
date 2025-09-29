
import React, { useState, useEffect } from 'react';

interface HeaderProps {
  title: string;
}

const Header: React.FC<HeaderProps> = ({ title }) => {
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000); // Update every second

    return () => {
      clearInterval(timer); // Cleanup on component unmount
    };
  }, []);

  const formattedDateTime = currentDateTime.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  return (
    <header className="flex h-14 items-center gap-4 border-b bg-card px-4 lg:h-[60px] lg:px-6">
      <h1 className="text-xl font-semibold">{title}</h1>
      <div className="w-full flex-1">
        {/* Can add search bar here later */}
      </div>
      <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground font-medium">
              {formattedDateTime}
          </div>
          <button className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
            <img
              className="h-8 w-8 rounded-full"
              src="https://picsum.photos/32/32"
              alt="User avatar"
            />
          </button>
      </div>
    </header>
  );
};

export default Header;
