import { render, screen } from '@testing-library/react';
import { vi, test, expect } from 'vitest';
import { App } from './App';
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn().mockResolvedValue('Archivio pronto') }));
test('spiega lo stato vuoto e apre il database', async () => {
  render(<App />);
  expect(screen.getByText('Non hai ancora creato una campagna.')).toBeInTheDocument();
  expect(await screen.findByText('Archivio pronto')).toBeInTheDocument();
});
