import React from 'react';

export default function Badge({ variant = 'blue', children }) {
  const map = {
    blue: 'badge-blue',
    green: 'badge-green',
    purple: 'badge-purple',
    amber: 'badge-amber',
    red: 'badge-red',
    gray: 'badge-gray'
  };

  return (
    <span className={`badge ${map[variant] || 'badge-blue'}`}>
      {children}
    </span>
  );
}
