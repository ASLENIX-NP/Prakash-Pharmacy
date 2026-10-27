import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('App root element is missing');
}

const root = createRoot(rootElement);

root.render(
  <main
    className="flex min-h-[100svh] items-center justify-center p-6 text-base font-medium text-slate-700"
    role="status"
  >
    Opening Prakash Pharmacy…
  </main>
);

void import('./App')
  .then(({ default: App }) => {
    root.render(<App />);
  })
  .catch((error: unknown) => {
    console.error('Failed to load the pharmacy app:', error);
    root.render(
      <main className="flex min-h-[100svh] flex-col items-center justify-center gap-4 p-6 text-center text-slate-700">
        <h1 className="text-xl font-bold">Unable to open Prakash Pharmacy</h1>
        <p>Please check that the frontend server is running, then refresh this page.</p>
        <button
          className="rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white"
          onClick={() => window.location.reload()}
          type="button"
        >
          Refresh
        </button>
      </main>
    );
  });
