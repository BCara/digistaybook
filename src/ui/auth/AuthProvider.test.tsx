import { act, render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthProvider';
const mocks = vi.hoisted(() => ({ start: vi.fn(), listen: vi.fn() }));
vi.mock('../../lib/firebaseConfig', () => ({ firebaseConfigured: true }));
vi.mock('../../lib/firebase', () => ({ getFirebaseAuth: mocks.start }));
vi.mock('firebase/auth', () => ({ onAuthStateChanged: mocks.listen }));
function State() { return <p>{useAuth().status}</p>; }
beforeEach(() => { vi.resetAllMocks(); });
afterEach(() => { vi.useRealTimers(); });
it('restores the host using only auth startup', async () => {
  mocks.start.mockResolvedValue({ auth: {} });
  mocks.listen.mockImplementation((_auth, next) => { next({ isAnonymous: false }); return vi.fn(); });
  render(<AuthProvider><State /></AuthProvider>);
  await waitFor(() => expect(screen.getByText('host')).toBeInTheDocument());
});
it('recovers from startup rejection instead of loading forever', async () => {
  mocks.start.mockRejectedValue(new Error('offline'));
  render(<AuthProvider><State /></AuthProvider>);
  await waitFor(() => expect(screen.getByText('error')).toBeInTheDocument());
});
it('offers recovery for stalled startup and accepts a later valid session', async () => {
  vi.useFakeTimers();
  let finish!: (value: unknown) => void;
  mocks.start.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  mocks.listen.mockImplementation((_auth, next) => { next({ isAnonymous: false }); return vi.fn(); });
  render(<AuthProvider><State /></AuthProvider>);
  await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
  expect(screen.getByText('error')).toBeInTheDocument();
  await act(async () => { finish({ auth: {} }); });
  expect(screen.getByText('host')).toBeInTheDocument();
});
