// ─── App Entry Point ─────────────────────────────────────────
import '../styles/globals.css';
import { AuthProvider } from '../hooks/useAuth';
import { ThemeProvider } from '../hooks/useTheme';
import Layout from '../components/Layout';
import { Toaster } from 'react-hot-toast';

export default function App({ Component, pageProps }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Layout>
          <Component {...pageProps} />
        </Layout>
        <Toaster
          position="bottom-right"
          toastOptions={{
            className: 'text-sm',
            style: { borderRadius: '10px', background: '#333', color: '#fff' },
          }}
        />
      </AuthProvider>
    </ThemeProvider>
  );
}
