import { useEffect, useState } from 'react';
import Site from './components/Site';
import Admin from './components/Admin';

// /admin is the main address; #admin still works for links saved earlier.
const isAdmin = () => /^\/admin\/?$/.test(location.pathname) || location.hash === '#admin';

export default function App() {
  const [admin, setAdmin] = useState(isAdmin);
  useEffect(() => {
    const on = () => setAdmin(isAdmin());
    addEventListener('hashchange', on);
    addEventListener('popstate', on);
    return () => {
      removeEventListener('hashchange', on);
      removeEventListener('popstate', on);
    };
  }, []);
  return admin ? <Admin /> : <Site />;
}
