import { useEffect, useState } from 'react';
import Site from './components/Site';
import Admin from './components/Admin';

const isAdmin = () => location.hash === '#admin';

export default function App() {
  const [admin, setAdmin] = useState(isAdmin);
  useEffect(() => {
    const on = () => setAdmin(isAdmin());
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return admin ? <Admin /> : <Site />;
}
