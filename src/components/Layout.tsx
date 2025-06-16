import React from 'react';
import { Outlet } from 'react-router-dom';
import NavBar from './NavBar';

export default function Layout() {
  return (
    <>
      <NavBar />
      <div style={{ padding: '1rem 2rem' }}>
        <Outlet />
      </div>
    </>
  );
}
