import React, { useState, useEffect, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Wallet, 
  ArrowUpRight, 
  ArrowDownLeft, 
  RefreshCw, 
  ShoppingBag, 
  Shield, 
  User, 
  Globe,
  ChevronRight,
  LogOut,
  CreditCard,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { 
  auth, 
  db, 
  googleProvider, 
  handleFirestoreError, 
  OperationType 
} from './lib/firebase';
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User as FirebaseUser,
  signInAnonymously
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot, 
  serverTimestamp,
  collection,
  query,
  where,
  orderBy,
  limit
} from 'firebase/firestore';

const PI_FIXED_PRICE = 314159;

// --- Context & Types ---
interface UserData {
  uid: string;
  email: string;
  displayName: string;
  role: 'pioneer' | 'global' | 'admin';
  photoURL?: string;
}

interface WalletData {
  pi: number;
  usd: number;
  dzd: number;
}

interface AuthContextType {
  user: FirebaseUser | null;
  userData: UserData | null;
  wallet: WalletData | null;
  loading: boolean;
  error: string | null;
  loginWithGoogle: () => Promise<void>;
  loginWithPi: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Fetch or create user data
        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (!userDoc.exists()) {
            // Create default user data if it doesn't exist
            const newUserData: UserData = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || 'anonymous@tgb.com',
              displayName: firebaseUser.displayName || 'Pioneer User',
              role: firebaseUser.isAnonymous ? 'pioneer' : 'global',
              photoURL: firebaseUser.photoURL || '',
            };
            await setDoc(userDocRef, {
              ...newUserData,
              createdAt: serverTimestamp()
            });
            setUserData(newUserData);

            // Create default wallet
            await setDoc(doc(db, 'wallets', firebaseUser.uid), {
              uid: firebaseUser.uid,
              pi: 1.25, // Starting bonus
              usd: 0,
              dzd: 0,
              lastUpdated: serverTimestamp()
            });
          } else {
            setUserData(userDoc.data() as UserData);
          }

          // Subscribe to wallet updates
          const walletUnsubscribe = onSnapshot(doc(db, 'wallets', firebaseUser.uid), (snapshot) => {
            if (snapshot.exists()) {
              setWallet(snapshot.data() as WalletData);
            }
          }, (err) => handleFirestoreError(err, OperationType.GET, `wallets/${firebaseUser.uid}`));

          return () => walletUnsubscribe();
        } catch (err) {
          console.error("Error syncing user data:", err);
          setError("Failed to sync account data.");
        }
      } else {
        setUserData(null);
        setWallet(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error("Google Login Error:", err);
      setError("Google login failed.");
    } finally {
      setLoading(false);
    }
  };

  const loginWithPi = async () => {
    setLoading(true);
    try {
      // @ts-ignore
      const piAuth = await window.Pi.authenticate(['payments', 'username'], (payment) => {
        console.log("Pi Payment callback", payment);
      });
      
      // After Pi Auth, we sign in anonymously to Firebase to have a session
      // In a real app, you'd verify the Pi token on the server and link it.
      await signInAnonymously(auth);
      
      // Update user data with Pi info if needed
      if (auth.currentUser) {
        const userDocRef = doc(db, 'users', auth.currentUser.uid);
        await setDoc(userDocRef, {
          displayName: piAuth.user.username,
          role: 'pioneer',
          piUid: piAuth.user.uid
        }, { merge: true });
      }
    } catch (err) {
      console.error("Pi Login Error:", err);
      // Fallback for demo if Pi SDK fails
      await signInAnonymously(auth);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, userData, wallet, loading, error, loginWithGoogle, loginWithPi, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// --- Main App Component ---
function AppContent() {
  const { user, userData, wallet, loading: authLoading, error: authError, loginWithGoogle, loginWithPi, logout } = useAuth();
  const [exchangeRates, setExchangeRates] = useState({ usd_dzd: 134.5 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Fetch rates
    const fetchRates = async () => {
      try {
        const res = await fetch('/api/exchange-rates');
        const data = await res.json();
        setExchangeRates({ usd_dzd: data.usd_dzd });
      } catch (e) {
        console.error("Failed to fetch rates", e);
      }
    };
    fetchRates();
  }, []);

  const calculateUsd = (pi: number) => (pi * PI_FIXED_PRICE).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  const calculateDzd = (pi: number) => (pi * PI_FIXED_PRICE * exchangeRates.usd_dzd).toLocaleString('ar-DZ', { style: 'currency', currency: 'DZD' });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-amber-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md text-center space-y-8"
        >
          <div className="flex flex-col items-center space-y-4">
            <div className="p-4 bg-amber-500/10 rounded-full border border-amber-500/20">
              <Shield className="w-12 h-12 text-amber-500" />
            </div>
            <h1 className="text-4xl font-bold tracking-tighter">Trust Global Bank</h1>
            <p className="text-slate-400">The Future of Encrypted Banking</p>
          </div>

          {authError && (
            <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl flex items-center space-x-3 text-rose-500 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p>{authError}</p>
            </div>
          )}

          <div className="space-y-4">
            <button 
              onClick={loginWithPi}
              disabled={loading}
              className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-2xl flex items-center justify-center space-x-3 transition-all active:scale-95 disabled:opacity-50"
            >
              <Globe className="w-5 h-5" />
              <span>{loading ? 'Connecting...' : 'Pioneer Connection'}</span>
            </button>

            <button 
              onClick={loginWithGoogle}
              disabled={loading}
              className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl flex items-center justify-center space-x-3 transition-all active:scale-95 border border-slate-700"
            >
              <User className="w-5 h-5" />
              <span>Global User Login</span>
            </button>
          </div>

          <p className="text-xs text-slate-500">
            By connecting, you agree to our Terms of Service and Privacy Policy.
          </p>
        </motion.div>
      </div>
    );
  }

  const currentBalance = wallet || { pi: 0, usd: 0, dzd: 0 };

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans pb-24">
      {/* Header */}
      <header className="p-6 flex justify-between items-center bg-slate-900/50 backdrop-blur-md sticky top-0 z-10 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <Shield className="w-6 h-6 text-amber-500" />
          <span className="font-bold text-lg">TGB</span>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-white">{userData?.displayName}</p>
            <p className="text-[10px] text-slate-500 uppercase">{userData?.role}</p>
          </div>
          <button onClick={logout} className="p-2 text-slate-400 hover:text-white transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="p-6 space-y-8 max-w-2xl mx-auto">
        {/* Balance Card */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-[2rem] p-8 text-slate-950 shadow-2xl shadow-amber-500/20 relative overflow-hidden"
        >
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-8">
              <div>
                <p className="text-slate-900/60 font-medium text-sm uppercase tracking-wider">Total Balance</p>
                <h2 className="text-5xl font-black mt-1 flex items-baseline">
                  {currentBalance.pi.toFixed(4)} <span className="text-2xl ml-2 font-bold">π</span>
                </h2>
              </div>
              <div className="bg-slate-950/10 p-3 rounded-2xl backdrop-blur-sm">
                <Wallet className="w-6 h-6" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-950/10 p-4 rounded-2xl backdrop-blur-sm border border-white/10">
                <p className="text-slate-900/60 text-xs font-bold uppercase">USD Value</p>
                <p className="text-xl font-bold">{calculateUsd(currentBalance.pi)}</p>
              </div>
              <div className="bg-slate-950/10 p-4 rounded-2xl backdrop-blur-sm border border-white/10">
                <p className="text-slate-900/60 text-xs font-bold uppercase">DZD Value</p>
                <p className="text-xl font-bold">{calculateDzd(currentBalance.pi)}</p>
              </div>
            </div>
          </div>
          
          {/* Decorative circles */}
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -left-10 -top-10 w-40 h-40 bg-slate-950/5 rounded-full blur-3xl" />
        </motion.div>

        {/* Quick Actions */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { icon: ArrowDownLeft, label: 'Deposit', color: 'bg-emerald-500/10 text-emerald-500' },
            { icon: ArrowUpRight, label: 'Withdraw', color: 'bg-rose-500/10 text-rose-500' },
            { icon: RefreshCw, label: 'Transfer', color: 'bg-blue-500/10 text-blue-500' },
            { icon: ShoppingBag, label: 'Shop', color: 'bg-amber-500/10 text-amber-500' },
          ].map((action, i) => (
            <motion.button
              key={action.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex flex-col items-center space-y-2 group"
            >
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110 active:scale-90 ${action.color}`}>
                <action.icon className="w-6 h-6" />
              </div>
              <span className="text-xs font-medium text-slate-400">{action.label}</span>
            </motion.button>
          ))}
        </div>

        {/* Market Info */}
        <section className="space-y-4">
          <h3 className="text-lg font-bold px-1">Market Insights</h3>
          <div className="bg-slate-900 rounded-3xl border border-slate-800 divide-y divide-slate-800">
            <div className="p-4 flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center">
                  <span className="text-amber-500 font-bold">π</span>
                </div>
                <div>
                  <p className="font-bold">Pi Network</p>
                  <p className="text-xs text-slate-500">Fixed GCV Rate</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-emerald-500">$314,159.00</p>
                <p className="text-xs text-slate-500">Stable</p>
              </div>
            </div>
            <div className="p-4 flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="font-bold">USD / DZD</p>
                  <p className="text-xs text-slate-500">Live Exchange</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-white">{exchangeRates.usd_dzd} DZD</p>
                <p className="text-xs text-emerald-500">+0.2%</p>
              </div>
            </div>
          </div>
        </section>

        {/* Recent Activity */}
        <section className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-lg font-bold">Recent Activity</h3>
            <button className="text-amber-500 text-sm font-medium">See All</button>
          </div>
          <div className="space-y-3">
            {[
              { type: 'Transfer', desc: 'To o-ecomarket1', amount: '-0.0004 π', time: '2h ago', icon: ShoppingBag },
              { type: 'Deposit', desc: 'From Pi Wallet', amount: '+1.2500 π', time: 'Yesterday', icon: ArrowDownLeft },
            ].map((tx, i) => (
              <div key={i} className="bg-slate-900/50 p-4 rounded-2xl flex items-center justify-between border border-slate-800/50">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center">
                    <tx.icon className="w-5 h-5 text-slate-400" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">{tx.type}</p>
                    <p className="text-xs text-slate-500">{tx.desc}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-bold text-sm ${tx.amount.startsWith('+') ? 'text-emerald-500' : 'text-white'}`}>{tx.amount}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-tighter">{tx.time}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-900/80 backdrop-blur-xl border-t border-slate-800 p-4 flex justify-around items-center z-20">
        <button className="text-amber-500 flex flex-col items-center space-y-1">
          <Wallet className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase">Wallet</span>
        </button>
        <button className="text-slate-500 flex flex-col items-center space-y-1">
          <Globe className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase">Market</span>
        </button>
        <button className="text-slate-500 flex flex-col items-center space-y-1">
          <ShoppingBag className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase">Store</span>
        </button>
        <button className="text-slate-500 flex flex-col items-center space-y-1">
          <User className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase">Profile</span>
        </button>
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
