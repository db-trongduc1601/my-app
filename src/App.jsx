import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { ThemeProvider } from '@/lib/ThemeContext';
import Layout from '@/components/Layout';
import Home from '@/pages/Home';
import { useState, useEffect, lazy, Suspense } from 'react';
import { auth } from './firebase';
import Login from './pages/Login';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { useNotifications } from '@/hooks/useNotifications';

const Food = lazy(() => import('@/pages/Food'));
const Games = lazy(() => import('@/pages/Games'));
const LoveMap = lazy(() => import('@/pages/LoveMap'));
const Entertainment = lazy(() => import('@/pages/Entertainment'));

const AuthenticatedApp = () => {
  const { user, isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();
  useNotifications(user);

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-pink-200 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') return <UserNotRegisteredError />;
    if (authError.type === 'auth_required') { navigateToLogin(); return null; }
  }

  return (
    <Suspense fallback={
      <div className="fixed inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-50">
        <div className="w-8 h-8 border-4 border-pink-200 border-t-primary rounded-full animate-spin"></div>
      </div>
    }>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/food" element={<Food />} />
          <Route path="/games" element={<Games />} />
          <Route path="/lovemap" element={<LoveMap />} />
          <Route path="/entertainment" element={<Entertainment />} />
        </Route>
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </Suspense>
  );
};

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, []);
  const handleLogout = () => {
    signOut(auth).catch((error) => console.log("Lỗi đăng xuất:", error));
    };
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FFF0F5]">
        <div className="text-pink-400 font-medium">Đang tải không gian...</div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <ThemeProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <AuthenticatedApp />
          </Router>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;