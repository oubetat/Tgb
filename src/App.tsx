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
  AlertCircle,
  TrendingUp,
  Lock,
  Zap,
  CheckCircle2,
  X,
  Languages,
  Copy
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
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
  limit,
  updateDoc,
  increment,
  addDoc
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

interface Transaction {
  id: string;
  type: 'deposit' | 'withdraw' | 'transfer' | 'shop';
  amount: number;
  currency: 'pi' | 'usd' | 'dzd';
  description: string;
  timestamp: any;
  status: 'completed' | 'pending' | 'failed';
}

interface Card {
  id: string;
  uid: string;
  cardNumber: string;
  expiry: string;
  cvv: string;
  type: 'visa' | 'mastercard';
  status: 'active' | 'pending' | 'blocked';
  balance: number;
}

interface AuthContextType {
  user: FirebaseUser | null;
  userData: UserData | null;
  wallet: WalletData | null;
  transactions: Transaction[];
  cards: Card[];
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
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (!userDoc.exists()) {
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

            await setDoc(doc(db, 'wallets', firebaseUser.uid), {
              uid: firebaseUser.uid,
              pi: 1.25,
              usd: 0,
              dzd: 0,
              lastUpdated: serverTimestamp()
            });
          } else {
            setUserData(userDoc.data() as UserData);
          }

          // Subscribe to wallet
          const walletUnsub = onSnapshot(doc(db, 'wallets', firebaseUser.uid), (snapshot) => {
            if (snapshot.exists()) setWallet(snapshot.data() as WalletData);
          });

          // Subscribe to transactions
          const q = query(
            collection(db, 'transactions'),
            where('uid', '==', firebaseUser.uid),
            orderBy('timestamp', 'desc'),
            limit(10)
          );
          const txUnsub = onSnapshot(q, (snapshot) => {
            const txs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
            setTransactions(txs);
          });

          // Subscribe to cards
          const cq = query(collection(db, 'cards'), where('uid', '==', firebaseUser.uid));
          const cardUnsub = onSnapshot(cq, (snapshot) => {
            const cs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Card));
            setCards(cs);
          });

          return () => {
            walletUnsub();
            txUnsub();
            cardUnsub();
          };
        } catch (err) {
          console.error("Sync error:", err);
          setError("Failed to sync account data.");
        }
      } else {
        setUserData(null);
        setWallet(null);
        setTransactions([]);
        setCards([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      if (err.code === 'auth/unauthorized-domain') {
        setError("This domain is not authorized in Firebase Console. Please add 'trustglobalbanktgb.netlify.app' to Authorized Domains.");
      } else {
        setError("Login failed. Please use Pioneer Connection if in Pi Browser.");
      }
    } finally {
      setLoading(false);
    }
  };

  const loginWithPi = async () => {
    setLoading(true);
    try {
      // @ts-ignore
      if (window.Pi) {
        // @ts-ignore
        const piAuth = await window.Pi.authenticate(['payments', 'username'], (payment) => {
          console.log("Pi Payment", payment);
        });
        await signInAnonymously(auth);
        if (auth.currentUser) {
          const userDocRef = doc(db, 'users', auth.currentUser.uid);
          await setDoc(userDocRef, {
            displayName: piAuth.user.username,
            role: 'pioneer',
            piUid: piAuth.user.uid
          }, { merge: true });
        }
      } else {
        await signInAnonymously(auth);
      }
    } catch (err) {
      await signInAnonymously(auth);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => { await signOut(auth); };

  return (
    <AuthContext.Provider value={{ user, userData, wallet, transactions, cards, loading, error, loginWithGoogle, loginWithPi, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

// --- Components ---

const Modal = ({ isOpen, onClose, title, children }: { isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode }) => (
  <AnimatePresence>
    {isOpen && (
      <>
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50"
        />
        <motion.div 
          initial={{ opacity: 0, y: 100, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 100, scale: 0.9 }}
          className="fixed bottom-0 left-0 right-0 sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-3xl p-6 z-50 max-w-md w-full shadow-2xl"
        >
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold">{title}</h3>
            <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
              <X className="w-6 h-6 text-slate-400" />
            </button>
          </div>
          {children}
        </motion.div>
      </>
    )}
  </AnimatePresence>
);

// --- Main App Content ---

interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  category: string;
  stock: number;
}

function AppContent() {
  const { user, userData, wallet, transactions, cards, loading: authLoading, error: authError, loginWithGoogle, loginWithPi, logout } = useAuth();
  const [exchangeRates, setExchangeRates] = useState({ usd_dzd: 134.5 });
  const [activeModal, setActiveModal] = useState<'transfer' | 'withdraw' | 'deposit' | 'shop' | 'card' | null>(null);
  const [txLoading, setTxLoading] = useState(false);
  const [txSuccess, setTxSuccess] = useState(false);
  const [lang, setLang] = useState<'en' | 'ar' | 'fr'>('en');
  const [activeTab, setActiveTab] = useState<'wallet' | 'market' | 'cards' | 'profile' | 'store'>('wallet');
  const [copySuccess, setCopySuccess] = useState(false);

  const products: Product[] = [
    { id: '1', name: 'iPhone 15 Pro', price: 0.0032, image: 'https://picsum.photos/seed/iphone/400/400', category: 'Electronics', stock: 5 },
    { id: '2', name: 'MacBook Air M2', price: 0.0045, image: 'https://picsum.photos/seed/macbook/400/400', category: 'Electronics', stock: 3 },
    { id: '3', name: 'Coffee Maker', price: 0.0005, image: 'https://picsum.photos/seed/coffee/400/400', category: 'Home', stock: 10 },
    { id: '4', name: 'Gaming Chair', price: 0.0012, image: 'https://picsum.photos/seed/chair/400/400', category: 'Furniture', stock: 8 },
  ];

  const chartData = [
    { name: 'Mon', value: 314159 },
    { name: 'Tue', value: 314165 },
    { name: 'Wed', value: 314150 },
    { name: 'Thu', value: 314172 },
    { name: 'Fri', value: 314159 },
    { name: 'Sat', value: 314180 },
    { name: 'Sun', value: 314159 },
  ];

  const t = {
    en: { balance: 'Total Balance', actions: 'Quick Actions', market: 'Market Insights', activity: 'Recent Activity', deposit: 'Deposit', withdraw: 'Withdraw', transfer: 'Transfer', shop: 'Shop', card: 'Request Visa Card', profile: 'Profile', store: 'Store', copyUid: 'Copy UID', uidCopied: 'UID Copied!' },
    ar: { balance: 'إجمالي الرصيد', actions: 'إجراءات سريعة', market: 'رؤى السوق', activity: 'النشاط الأخير', deposit: 'إيداع', withdraw: 'سحب', transfer: 'تحويل', shop: 'تسوق', card: 'طلب بطاقة فيزا', profile: 'الملف الشخصي', store: 'المتجر', copyUid: 'نسخ المعرف', uidCopied: 'تم النسخ!' },
    fr: { balance: 'Solde Total', actions: 'Actions Rapides', market: 'Aperçu du Marché', activity: 'Activité Récente', deposit: 'Dépôt', withdraw: 'Retrait', transfer: 'Transfert', shop: 'Boutique', card: 'Demander une carte Visa', profile: 'Profil', store: 'Boutique', copyUid: 'Copier UID', uidCopied: 'UID Copié!' }
  }[lang];

  const handleCopyUid = () => {
    if (user?.uid) {
      navigator.clipboard.writeText(user.uid);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const handleTransaction = async (type: string, amount: number, desc: string, recipientUid?: string) => {
    if (!user || !wallet) return;
    setTxLoading(true);
    const path = `wallets/${user.uid}`;
    try {
      const txAmount = type === 'deposit' ? amount : -amount;
      if (type !== 'deposit' && wallet.pi < amount) throw new Error("Insufficient funds");

      // For real transfers, we update both wallets
      if (type === 'transfer' && recipientUid) {
        const recipientWalletRef = doc(db, 'wallets', recipientUid);
        const recipientWallet = await getDoc(recipientWalletRef);
        if (!recipientWallet.exists()) throw new Error("Recipient wallet not found");

        await updateDoc(recipientWalletRef, { pi: increment(amount) });
      }

      await updateDoc(doc(db, 'wallets', user.uid), {
        pi: increment(txAmount),
        lastUpdated: serverTimestamp()
      });

      await addDoc(collection(db, 'transactions'), {
        uid: user.uid,
        recipientUid: recipientUid || null,
        type,
        amount: txAmount,
        currency: 'pi',
        description: desc,
        timestamp: serverTimestamp(),
        status: 'completed'
      });

      setTxSuccess(true);
      setTimeout(() => {
        setTxSuccess(false);
        setActiveModal(null);
      }, 2000);
    } catch (e: any) {
      handleFirestoreError(e, OperationType.WRITE, path);
    } finally {
      setTxLoading(false);
    }
  };

  const handleRequestCard = async () => {
    if (!user) return;
    setTxLoading(true);
    try {
      const cardNumber = `4532 ${Math.floor(1000 + Math.random() * 9000)} ${Math.floor(1000 + Math.random() * 9000)} ${Math.floor(1000 + Math.random() * 9000)}`;
      const expiry = "12/28";
      const cvv = Math.floor(100 + Math.random() * 900).toString();

      await addDoc(collection(db, 'cards'), {
        uid: user.uid,
        cardNumber,
        expiry,
        cvv,
        type: 'visa',
        status: 'pending',
        balance: 0,
        createdAt: serverTimestamp()
      });

      setTxSuccess(true);
      setTimeout(() => {
        setTxSuccess(false);
        setActiveModal(null);
      }, 2000);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setTxLoading(false);
    }
  };

  const handleBuyProduct = async (product: Product) => {
    if (!user || !wallet) return;
    if (wallet.pi < product.price) {
      alert("Insufficient Pi balance");
      return;
    }
    setTxLoading(true);
    try {
      await updateDoc(doc(db, 'wallets', user.uid), {
        pi: increment(-product.price),
        lastUpdated: serverTimestamp()
      });

      await addDoc(collection(db, 'transactions'), {
        uid: user.uid,
        type: 'shop',
        amount: -product.price,
        currency: 'pi',
        description: `Purchased ${product.name}`,
        timestamp: serverTimestamp(),
        status: 'completed'
      });

      setTxSuccess(true);
      setTimeout(() => {
        setTxSuccess(false);
        setActiveModal(null);
      }, 2000);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setTxLoading(false);
    }
  };

  const calculateUsd = (pi: number) => (pi * PI_FIXED_PRICE).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  const calculateDzd = (pi: number) => (pi * PI_FIXED_PRICE * exchangeRates.usd_dzd).toLocaleString('ar-DZ', { style: 'currency', currency: 'DZD' });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-6">
        <Loader2 className="w-12 h-12 text-amber-500 animate-spin" />
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 5 }} className="text-center space-y-2">
          <p className="text-amber-500/80 font-bold animate-pulse">Waking up the Bank Vault...</p>
          <p className="text-slate-500 text-xs">This may take up to 60 seconds on the first visit.</p>
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 font-sans">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md text-center space-y-8">
          <div className="flex flex-col items-center space-y-4">
            <div className="p-4 bg-amber-500/10 rounded-full border border-amber-500/20"><Shield className="w-12 h-12 text-amber-500" /></div>
            <h1 className="text-4xl font-bold tracking-tighter">Trust Global Bank</h1>
            <p className="text-slate-400">The Future of Encrypted Banking</p>
          </div>
          {authError && <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl flex items-center space-x-3 text-rose-500 text-sm"><AlertCircle className="w-5 h-5 flex-shrink-0" /><p>{authError}</p></div>}
          <div className="space-y-4">
            <button onClick={loginWithPi} className="w-full py-5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xl rounded-2xl flex flex-col items-center justify-center space-y-1 transition-all shadow-xl shadow-amber-500/20 active:scale-95">
              <div className="flex items-center space-x-3"><Globe className="w-6 h-6" /><span>Pioneer Connection</span></div>
              <span className="text-[10px] opacity-70 font-bold uppercase tracking-widest">Recommended for Pi Browser</span>
            </button>
            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800"></div></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-slate-950 px-2 text-slate-500 font-bold">Or</span></div>
            </div>
            <button onClick={loginWithGoogle} className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl flex items-center justify-center space-x-3 transition-all active:scale-95 border border-slate-800">
              <User className="w-5 h-5" /><span>Global User Login</span>
            </button>
          </div>
          <p className="text-xs text-slate-500">By connecting, you agree to our Terms of Service and Privacy Policy.</p>
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
        <div className="flex items-center space-x-3">
          <button onClick={() => setLang(l => l === 'en' ? 'ar' : l === 'ar' ? 'fr' : 'en')} className="p-2 bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors">
            <Languages className="w-5 h-5" />
          </button>
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-white">{userData?.displayName}</p>
            <p className="text-[10px] text-slate-500 uppercase">{userData?.role}</p>
          </div>
          <button onClick={logout} className="p-2 text-slate-400 hover:text-rose-500 transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="p-6 space-y-8 max-w-2xl mx-auto">
        {activeTab === 'wallet' && (
          <>
            {/* Balance Card */}
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-[2.5rem] p-8 text-slate-950 shadow-2xl shadow-amber-500/20 relative overflow-hidden">
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <p className="text-slate-900/60 font-medium text-sm uppercase tracking-wider">{t.balance}</p>
                    <h2 className="text-5xl font-black mt-1 flex items-baseline">
                      {currentBalance.pi.toFixed(4)} <span className="text-2xl ml-2 font-bold">π</span>
                    </h2>
                  </div>
                  <div className="bg-slate-950/10 p-4 rounded-2xl backdrop-blur-sm border border-white/10"><Wallet className="w-7 h-7" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-950/10 p-4 rounded-2xl backdrop-blur-sm border border-white/10">
                    <p className="text-slate-900/60 text-[10px] font-bold uppercase tracking-tighter">USD Value</p>
                    <p className="text-lg font-bold">{calculateUsd(currentBalance.pi)}</p>
                  </div>
                  <div className="bg-slate-950/10 p-4 rounded-2xl backdrop-blur-sm border border-white/10">
                    <p className="text-slate-900/60 text-[10px] font-bold uppercase tracking-tighter">DZD Value</p>
                    <p className="text-lg font-bold">{calculateDzd(currentBalance.pi)}</p>
                  </div>
                </div>
              </div>
              <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
              <div className="absolute -left-10 -top-10 w-40 h-40 bg-slate-950/5 rounded-full blur-3xl" />
            </motion.div>

            {/* Quick Actions */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { icon: ArrowDownLeft, label: t.deposit, color: 'bg-emerald-500/10 text-emerald-500', action: () => setActiveModal('deposit') },
                { icon: ArrowUpRight, label: t.withdraw, color: 'bg-rose-500/10 text-rose-500', action: () => setActiveModal('withdraw') },
                { icon: RefreshCw, label: t.transfer, color: 'bg-blue-500/10 text-blue-500', action: () => setActiveModal('transfer') },
                { icon: ShoppingBag, label: t.shop, color: 'bg-amber-500/10 text-amber-500', action: () => setActiveModal('shop') },
              ].map((action, i) => (
                <motion.button key={action.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} onClick={action.action} className="flex flex-col items-center space-y-2 group">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110 active:scale-90 ${action.color}`}><action.icon className="w-6 h-6" /></div>
                  <span className="text-[10px] font-bold uppercase text-slate-500">{action.label}</span>
                </motion.button>
              ))}
            </div>

            {/* Recent Activity */}
            <section className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <h3 className="text-lg font-bold">{t.activity}</h3>
                <button className="text-amber-500 text-sm font-medium">See All</button>
              </div>
              <div className="space-y-3">
                {transactions.length > 0 ? transactions.map((tx) => (
                  <div key={tx.id} className="bg-slate-900/50 p-4 rounded-2xl flex items-center justify-between border border-slate-800/50">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center">
                        {tx.type === 'deposit' ? <ArrowDownLeft className="w-5 h-5 text-emerald-500" /> : 
                         tx.type === 'withdraw' ? <ArrowUpRight className="w-5 h-5 text-rose-500" /> :
                         <RefreshCw className="w-5 h-5 text-blue-500" />}
                      </div>
                      <div><p className="font-bold text-sm capitalize">{tx.type}</p><p className="text-xs text-slate-500">{tx.description}</p></div>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold text-sm ${tx.amount > 0 ? 'text-emerald-500' : 'text-white'}`}>{tx.amount > 0 ? '+' : ''}{tx.amount.toFixed(4)} π</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-tighter">Completed</p>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-8 text-slate-600 italic">No recent activity</div>
                )}
              </div>
            </section>
          </>
        )}

        {activeTab === 'cards' && (
          <section className="space-y-8">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">My Cards</h2>
              <button onClick={() => setActiveModal('card')} className="p-2 bg-amber-500 rounded-xl text-slate-950 hover:bg-amber-600 transition-colors"><Zap className="w-5 h-5" /></button>
            </div>

            {cards.length > 0 ? cards.map(card => (
              <motion.div key={card.id} initial={{ opacity: 0, rotateY: -20 }} animate={{ opacity: 1, rotateY: 0 }} className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-8 border border-slate-700 shadow-2xl relative overflow-hidden aspect-[1.6/1] flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <Shield className="w-10 h-10 text-amber-500" />
                  <span className="text-xl font-black italic text-white/40 uppercase tracking-widest">{card.type}</span>
                </div>
                <div className="space-y-4">
                  <p className="text-2xl font-mono tracking-[0.3em]">{card.cardNumber}</p>
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase">Card Holder</p>
                      <p className="font-bold uppercase">{userData?.displayName}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase">Expires</p>
                      <p className="font-bold">{card.expiry}</p>
                    </div>
                    <div className="bg-emerald-500/20 px-3 py-1 rounded-lg border border-emerald-500/20">
                      <span className="text-[10px] font-bold text-emerald-500 uppercase">{card.status}</span>
                    </div>
                  </div>
                </div>
                <div className="absolute -right-20 -top-20 w-60 h-60 bg-amber-500/5 rounded-full blur-3xl" />
              </motion.div>
            )) : (
              <div className="bg-slate-900/50 border-2 border-dashed border-slate-800 rounded-[2.5rem] p-12 text-center space-y-4">
                <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto"><CreditCard className="w-8 h-8 text-slate-600" /></div>
                <div>
                  <p className="font-bold text-lg">No Virtual Cards</p>
                  <p className="text-slate-500 text-sm">Request your first Visa card to start global shopping.</p>
                </div>
                <button onClick={() => setActiveModal('card')} className="px-8 py-3 bg-amber-500 text-slate-950 font-bold rounded-2xl hover:bg-amber-600 transition-all">Request Card</button>
              </div>
            )}
          </section>
        )}

        {activeTab === 'market' && (
          <section className="space-y-6">
            <h2 className="text-2xl font-bold">{t.market}</h2>
            <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold flex items-center space-x-2"><TrendingUp className="w-5 h-5 text-amber-500" /><span>Pi Value Trend</span></h3>
                <span className="text-xs text-emerald-500 font-bold bg-emerald-500/10 px-2 py-1 rounded-lg">+0.05%</span>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="value" stroke="#f59e0b" fillOpacity={1} fill="url(#colorValue)" strokeWidth={3} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', fontSize: '12px' }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 flex justify-between items-center">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center font-black text-amber-500 text-xl">π</div>
                  <div><p className="font-bold">Pi Network (GCV)</p><p className="text-xs text-slate-500">Global Consensus Value</p></div>
                </div>
                <p className="text-xl font-black text-emerald-500">$314,159</p>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'store' && (
          <section className="space-y-6">
            <h2 className="text-2xl font-bold">{t.store}</h2>
            <div className="grid grid-cols-2 gap-4">
              {products.map(product => (
                <motion.div key={product.id} whileHover={{ y: -5 }} className="bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 flex flex-col">
                  <img src={product.image} alt={product.name} className="w-full aspect-square object-cover" referrerPolicy="no-referrer" />
                  <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">{product.category}</p>
                      <h4 className="font-bold text-sm line-clamp-1">{product.name}</h4>
                    </div>
                    <div className="flex justify-between items-center pt-2">
                      <p className="font-black text-amber-500">{product.price} π</p>
                      <button 
                        onClick={() => handleBuyProduct(product)}
                        disabled={txLoading}
                        className="p-2 bg-amber-500 rounded-lg text-slate-950 hover:bg-amber-600 transition-colors disabled:opacity-50"
                      >
                        <ShoppingBag className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'profile' && (
          <section className="space-y-8">
            <div className="flex flex-col items-center space-y-4 py-8">
              <div className="relative">
                <div className="w-24 h-24 bg-amber-500 rounded-full flex items-center justify-center text-slate-950 text-4xl font-black uppercase">
                  {userData?.displayName?.[0]}
                </div>
                <div className="absolute -bottom-2 -right-2 bg-emerald-500 p-2 rounded-full border-4 border-slate-950">
                  <Shield className="w-4 h-4 text-white" />
                </div>
              </div>
              <div className="text-center">
                <h2 className="text-2xl font-bold">{userData?.displayName}</h2>
                <p className="text-slate-500 text-sm">{userData?.email}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-xs font-bold text-slate-500 uppercase">Your Unique ID (UID)</p>
                  <button 
                    onClick={handleCopyUid}
                    className="flex items-center space-x-2 text-amber-500 hover:text-amber-400 transition-colors"
                  >
                    {copySuccess ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span className="text-xs font-bold uppercase">{copySuccess ? t.uidCopied : t.copyUid}</span>
                  </button>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 break-all font-mono text-xs text-slate-400">
                  {user?.uid}
                </div>
              </div>

              <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-4">
                <h3 className="font-bold">Account Settings</h3>
                <div className="space-y-2">
                  <button className="w-full flex justify-between items-center p-4 hover:bg-slate-800 rounded-2xl transition-colors">
                    <div className="flex items-center space-x-3 text-slate-400"><Languages className="w-5 h-5" /><span>Language</span></div>
                    <span className="text-amber-500 font-bold uppercase text-xs">{lang}</span>
                  </button>
                  <button className="w-full flex justify-between items-center p-4 hover:bg-slate-800 rounded-2xl transition-colors">
                    <div className="flex items-center space-x-3 text-slate-400"><Shield className="w-5 h-5" /><span>Privacy & Security</span></div>
                    <ChevronRight className="w-5 h-5 text-slate-600" />
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Modals */}
      <Modal isOpen={!!activeModal} onClose={() => setActiveModal(null)} title={t[activeModal as keyof typeof t] || ''}>
        {txSuccess ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center"><CheckCircle2 className="w-12 h-12 text-emerald-500" /></motion.div>
            <p className="text-xl font-bold">Action Successful</p>
          </div>
        ) : activeModal === 'card' ? (
          <div className="space-y-6">
            <div className="bg-amber-500/10 p-6 rounded-3xl border border-amber-500/20 space-y-4">
              <div className="flex items-center space-x-3 text-amber-500"><Shield className="w-6 h-6" /><p className="font-bold">Virtual Visa Card</p></div>
              <ul className="text-sm text-slate-400 space-y-2">
                <li className="flex items-center space-x-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /><span>Instant Activation</span></li>
                <li className="flex items-center space-x-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /><span>Global Acceptance</span></li>
                <li className="flex items-center space-x-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /><span>Secure 256-bit Encryption</span></li>
              </ul>
            </div>
            <button onClick={handleRequestCard} disabled={txLoading} className="w-full py-4 bg-amber-500 text-slate-950 font-bold rounded-2xl transition-all active:scale-95 disabled:opacity-50">
              {txLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Request Virtual Card"}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Amount (Pi)</label>
              <input type="number" placeholder="0.0000" className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-2xl font-bold focus:outline-none focus:border-amber-500 transition-colors" id="txAmount" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">{activeModal === 'transfer' ? 'Recipient UID' : 'Description'}</label>
              <input type="text" placeholder={activeModal === 'transfer' ? 'User UID' : 'Note'} className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 focus:outline-none focus:border-amber-500 transition-colors" id="txDesc" />
            </div>
            <button 
              disabled={txLoading}
              onClick={() => {
                const amount = parseFloat((document.getElementById('txAmount') as HTMLInputElement).value);
                const desc = (document.getElementById('txDesc') as HTMLInputElement).value;
                if (amount > 0) handleTransaction(activeModal!, amount, desc, activeModal === 'transfer' ? desc : undefined);
              }}
              className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-2xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {txLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>Confirm {activeModal}</span>}
            </button>
          </div>
        )}
      </Modal>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-900/80 backdrop-blur-xl border-t border-slate-800 p-4 flex justify-around items-center z-20">
        <button onClick={() => setActiveTab('wallet')} className={`${activeTab === 'wallet' ? 'text-amber-500' : 'text-slate-500'} flex flex-col items-center space-y-1`}><Wallet className="w-6 h-6" /><span className="text-[10px] font-bold uppercase">{t.balance.split(' ')[1]}</span></button>
        <button onClick={() => setActiveTab('market')} className={`${activeTab === 'market' ? 'text-amber-500' : 'text-slate-500'} flex flex-col items-center space-y-1`}><Globe className="w-6 h-6" /><span className="text-[10px] font-bold uppercase">{t.market.split(' ')[0]}</span></button>
        <button onClick={() => setActiveTab('store')} className={`${activeTab === 'store' ? 'text-amber-500' : 'text-slate-500'} flex flex-col items-center space-y-1`}><ShoppingBag className="w-6 h-6" /><span className="text-[10px] font-bold uppercase">{t.store}</span></button>
        <button onClick={() => setActiveTab('cards')} className={`${activeTab === 'cards' ? 'text-amber-500' : 'text-slate-500'} flex flex-col items-center space-y-1`}><CreditCard className="w-6 h-6" /><span className="text-[10px] font-bold uppercase">Cards</span></button>
        <button onClick={() => setActiveTab('profile')} className={`${activeTab === 'profile' ? 'text-amber-500' : 'text-slate-500'} flex flex-col items-center space-y-1`}><User className="w-6 h-6" /><span className="text-[10px] font-bold uppercase">{t.profile.split(' ')[0]}</span></button>
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
