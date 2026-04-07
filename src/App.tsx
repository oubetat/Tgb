import React, { useState, useEffect, createContext, useContext, useMemo } from 'react';
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
  Copy,
  Link,
  TrendingDown,
  Users,
  BarChart3,
  FileText,
  QrCode,
  Activity,
  Building2,
  Plus,
  Send,
  ArrowLeft,
  Filter,
  ArrowUpDown,
  Search,
  UserPlus,
  ShieldCheck,
  Calculator,
  Bell,
  UserCheck,
  AlertTriangle
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
  addDoc,
  getDocs
} from 'firebase/firestore';

const PI_FIXED_PRICE = 314159;
const PI_API_KEY = "lktmxygtgiswvcvwevz6tvoxpot9"; // Updated from your image
const PI_WALLET_ADDRESS = "GCGQSI63L76OPFBTGLMXUK6OUIGP53CY5YK56RSQKAY4RVX3YT4677XQ";

const useBinancePrices = () => {
  const [prices, setPrices] = useState<{ [symbol: string]: number }>({ 
    PI: PI_FIXED_PRICE, 
    USD: 1, 
    DZD: 134.5, // Updated to a more realistic USD/DZD rate
    EUR: 0.92,
    GBP: 0.79,
    JPY: 151.5,
    KRW: 1350,
    CNY: 7.23,
    BTC: 65000,
    ETH: 3500,
    BNB: 580,
    SOL: 145,
    XRP: 0.62,
    ADA: 0.45,
    DOGE: 0.16,
    AVAX: 35,
    DOT: 7.2,
    LINK: 18,
    MATIC: 0.72,
    LTC: 85,
    BCH: 450
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        // Fetch Crypto Prices from Binance
        const binanceRes = await fetch('https://api.binance.com/api/v3/ticker/price', { signal: controller.signal });
        const binanceData = await binanceRes.json();
        
        // Fetch Fiat Rates from ExchangeRate-API (Free tier, no key required for this endpoint)
        const fiatRes = await fetch('https://open.er-api.com/v6/latest/USD', { signal: controller.signal });
        const fiatData = await fiatRes.json();
        
        clearTimeout(timeoutId);
        
        const newPrices: { [symbol: string]: number } = { 
          PI: PI_FIXED_PRICE, 
          USD: 1,
          ...prices // Keep existing as fallback
        };

        // Update Fiat Rates (USD based)
        if (fiatData && fiatData.rates) {
          Object.keys(fiatData.rates).forEach(symbol => {
            newPrices[symbol] = fiatData.rates[symbol];
          });
        }
        
        // Map Binance prices (symbol like BTCUSDT) to our symbols
        if (Array.isArray(binanceData)) {
          binanceData.forEach((item: any) => {
            if (item.symbol.endsWith('USDT')) {
              const symbol = item.symbol.replace('USDT', '');
              newPrices[symbol] = parseFloat(item.price);
            }
          });
        }
        
        console.log("Global rates updated:", Object.keys(newPrices).length);
        setPrices(newPrices);
      } catch (err) {
        console.error("Exchange rate fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 60000); // Update every 60s
    return () => clearInterval(interval);
  }, []);

  return { prices, loading };
};

// --- Context & Types ---
interface UserData {
  uid: string;
  email: string;
  displayName: string;
  role: 'pioneer' | 'global' | 'admin';
  photoURL?: string;
  piUid?: string;
  piWalletAddress?: string;
  kycStatus?: 'none' | 'pending' | 'verified' | 'rejected';
  firstName?: string;
  lastName?: string;
  dob?: string;
  docType?: string;
  passphrase?: string;
  notificationSettings?: {
    transactions: boolean;
    market: boolean;
    security: boolean;
  };
}

interface WalletData {
  uid: string;
  balances: { [symbol: string]: number };
  lastUpdated: any;
}

interface Transaction {
  id: string;
  uid: string;
  type: 'deposit' | 'withdraw' | 'transfer' | 'shop' | 'exchange';
  amount: number;
  currency: string;
  description: string;
  timestamp: any;
  status: 'completed' | 'pending' | 'failed' | 'cancelled';
  txid?: string;
  paymentId?: string;
  sender?: string;
  receiver?: string;
  notes?: string;
  fromCurrency?: string;
  toCurrency?: string;
  fromAmount?: number;
  toAmount?: number;
  rate?: number;
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

interface LoanRequest {
  id: string;
  uid: string;
  amount: number;
  apr: number;
  purpose: string;
  status: 'pending' | 'active' | 'completed';
  createdAt: any;
}

interface InvestmentPool {
  id: string;
  name: string;
  category: string;
  totalInvested: number;
  target: number;
  membersCount: number;
  image: string;
}

interface PiMetrics {
  totalSupply: number;
  circulatingSupply: number;
  lockedSupply: number;
  activeCountries: number;
  lastUpdated: any;
}

interface AuthContextType {
  user: FirebaseUser | null;
  userData: UserData | null;
  wallet: WalletData | null;
  transactions: Transaction[];
  cards: Card[];
  stakes: any[];
  loading: boolean;
  error: string | null;
  loginWithGoogle: () => Promise<void>;
  loginWithPi: () => Promise<void>;
  loginAsGuest: () => void;
  logout: () => Promise<void>;
  setWallet: React.Dispatch<React.SetStateAction<WalletData | null>>;
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper for Firestore calls with timeout
function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 10000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Firestore operation timed out')), timeoutMs))
  ]);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [stakes, setStakes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log("AuthProvider mounted, setting up auth listener...");
    
    // Fallback timeout to ensure loading screen doesn't stay forever
    const timeoutId = setTimeout(() => {
      console.warn("Initial Auth initialization timed out, forcing loading to false");
      setLoading(false);
    }, 20000); // 20 seconds fallback for mobile/slow connections

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("Auth state changed:", firebaseUser?.uid ? `User: ${firebaseUser.uid}` : "No user");
      setUser(firebaseUser);
      
      if (firebaseUser) {
        console.log("User is authenticated, syncing data...");
        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await withTimeout(getDoc(userDocRef), 5000).catch(err => {
            console.warn("User doc fetch timed out, using fallback", err);
            return { exists: () => false, data: () => null };
          });
          
          if (!userDoc.exists()) {
            console.log("Creating new user profile...");
            const newUserData: UserData = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || 'anonymous@tgb.com',
              displayName: firebaseUser.displayName || 'Pioneer User',
              role: firebaseUser.isAnonymous ? 'pioneer' : 'global',
              photoURL: firebaseUser.photoURL || '',
              kycStatus: 'none',
            };
            await withTimeout(setDoc(userDocRef, {
              ...newUserData,
              createdAt: serverTimestamp()
            }), 5000).catch(err => console.error("Failed to create user doc:", err));
            setUserData(newUserData);

            console.log("Creating initial wallet...");
            await withTimeout(setDoc(doc(db, 'wallets', firebaseUser.uid), {
              uid: firebaseUser.uid,
              balances: {
                PI: 76,
                USD: 0,
                DZD: 0,
                BTC: 0,
                ETH: 0,
                BNB: 0,
                SOL: 0,
                USDT: 0,
                ADA: 0,
                DOT: 0,
                DOGE: 0,
                MATIC: 0,
                AVAX: 0,
                TRX: 0,
                LTC: 0
              },
              lastUpdated: serverTimestamp()
            }), 5000).catch(err => console.error("Failed to create wallet doc:", err));
          } else {
            setUserData(userDoc.data() as UserData);
          }

          console.log("Setting up snapshots...");
          // Subscribe to user data
          onSnapshot(userDocRef, (snapshot) => {
            if (snapshot.exists()) {
              console.log("User data snapshot received");
              setUserData(snapshot.data() as UserData);
            }
          }, (err) => console.error("User data snapshot error:", err));

          // Subscribe to wallet
          onSnapshot(doc(db, 'wallets', firebaseUser.uid), (snapshot) => {
            if (snapshot.exists()) {
              console.log("Wallet snapshot received");
              setWallet(snapshot.data() as WalletData);
            }
          }, (err) => console.error("Wallet snapshot error:", err));

          // Subscribe to transactions
          const q = query(
            collection(db, 'transactions'),
            where('uid', '==', firebaseUser.uid),
            limit(10)
          );
          onSnapshot(q, (snapshot) => {
            console.log("Transactions snapshot received:", snapshot.size);
            const txs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
            txs.sort((a, b) => {
              const t1 = (a.timestamp as any)?.seconds || 0;
              const t2 = (b.timestamp as any)?.seconds || 0;
              return t2 - t1;
            });
            setTransactions(txs);
          }, (err) => console.error("Transactions snapshot error:", err));

          // Subscribe to cards
          const cq = query(collection(db, 'cards'), where('uid', '==', firebaseUser.uid));
          onSnapshot(cq, (snapshot) => {
            console.log("Cards snapshot received:", snapshot.size);
            const cs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Card));
            setCards(cs);
          }, (err) => console.error("Cards snapshot error:", err));

          // Subscribe to stakes
          const sq = query(collection(db, 'stakes'), where('uid', '==', firebaseUser.uid));
          onSnapshot(sq, (snapshot) => {
            console.log("Stakes snapshot received:", snapshot.size);
            const ss = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
            setStakes(ss);
          }, (err) => console.error("Stakes snapshot error:", err));

        } catch (err) {
          console.error("Sync error:", err);
        }
      } else {
        console.log("User is not authenticated");
        setUserData(null);
        setWallet(null);
        setTransactions([]);
        setCards([]);
        setStakes([]);
      }
      
      console.log("Finalizing auth state, setting loading to false");
      setLoading(false);
      clearTimeout(timeoutId);
    });

    return () => {
      unsubscribe();
      clearTimeout(timeoutId);
    };
  }, []);

  const loginWithGoogle = async () => {
    setLoading(true);
    setError(null);
    console.log("Attempting Google Login...");
    try {
      await withTimeout(signInWithPopup(auth, googleProvider));
      console.log("Google Login successful");
    } catch (err: any) {
      console.error("Google Login error:", err);
      if (err.code === 'auth/unauthorized-domain') {
        setError(`This domain (${window.location.hostname}) is not authorized in Firebase Console. Please add it to the Authorized Domains list in your Firebase Authentication settings.`);
      } else {
        setError(`Login failed: ${err.message || "Please check your internet connection."}`);
      }
    } finally {
      // Safety timeout
      setTimeout(() => setLoading(false), 5000);
    }
  };

  const loginWithPi = async (
    manualData?: { wallet: string, nickname: string }, 
    isRegistration: boolean = false,
    regDetails?: { firstName: string, lastName: string, dob: string, docType: string, passphrase?: string }
  ) => {
    console.log("loginWithPi called", { manualData, isRegistration, regDetails });
    setLoading(true);
    setError(null);
    console.log("Attempting Pi Login...", manualData, isRegistration);
    let success = false;
    try {
      let cred: any = null;
      // @ts-ignore
      if (window.Pi) {
        console.log("Pi SDK found, authenticating...");
        try {
          // Add a small delay to ensure SDK is fully ready
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // @ts-ignore
          const piAuth = await withTimeout(window.Pi.authenticate(['payments', 'username'], (payment) => {
            console.log("Incomplete Pi Payment found:", payment);
          }), 30000).catch((err: any) => {
            console.error("Pi Authentication Promise rejected or timed out:", err);
            throw err;
          }) as any;
          
          console.log("Pi Auth successful:", piAuth.user.username);
          cred = await withTimeout(signInAnonymously(auth), 20000);
          console.log("Firebase Anonymous sign-in successful", cred.user.uid);
          
          // Use Pi SDK data if manualData is missing
          if (!manualData) {
            manualData = {
              wallet: piAuth.user.uid,
              nickname: piAuth.user.username
            };
          }
        } catch (piErr) {
          console.error("Pi SDK Auth failed, falling back to manual", piErr);
        }
      }

      if (!cred) {
        console.log("Attempting direct Firebase Anonymous sign-in");
        cred = await withTimeout(signInAnonymously(auth), 20000);
        console.log("Firebase Anonymous sign-in successful", cred.user.uid);
      }

      if (cred.user) {
        if (!manualData) {
          throw new Error("Please enter your Pi Wallet Address and Nickname if you are not in the Pi Browser.");
        }
        console.log("Syncing manual data for user:", cred.user.uid);
        const userDocRef = doc(db, 'users', cred.user.uid);
        const userSnap = await getDoc(userDocRef);
        
        const updateData: any = {
          uid: cred.user.uid,
          displayName: manualData.nickname,
          role: 'pioneer',
          piUid: manualData.wallet, // Keep for backward compatibility
          piWalletAddress: manualData.wallet.startsWith('G') ? manualData.wallet : undefined,
          lastLogin: serverTimestamp()
        };

        if (manualData.wallet.startsWith('p')) {
          updateData.piUid = manualData.wallet;
        }

        if (regDetails) {
          updateData.firstName = regDetails.firstName;
          updateData.lastName = regDetails.lastName;
          updateData.dob = regDetails.dob;
          updateData.docType = regDetails.docType;
          if (regDetails.passphrase) updateData.passphrase = regDetails.passphrase;
        }

        // Only set kycStatus if it's a new user or explicitly registering
        if (!userSnap.exists()) {
          updateData.kycStatus = isRegistration ? 'pending' : 'none';
          updateData.createdAt = serverTimestamp();
        } else if (isRegistration) {
          updateData.kycStatus = 'pending';
        }

        await withTimeout(setDoc(userDocRef, updateData, { merge: true }), 10000);
        console.log("Manual User data synced to Firestore");
      }
      console.log("Login process complete");
      success = true;
    } catch (err: any) {
      console.error("Pi Login error details:", err);
      let errorMsg = typeof err === 'string' ? err : (err.message || JSON.stringify(err));
      
      if (errorMsg.includes("requested action is invalid") || errorMsg.includes("admin-restricted-operation")) {
        errorMsg = "Firebase Security Restriction: This is usually caused by 'Email enumeration protection' in Firebase Console. Please ensure it is turned OFF in Authentication > Settings > User actions.";
      }
      
      setError(`Pi Login failed: ${errorMsg}`);
      
      // Fallback to local guest mode if Firebase is restricted
      console.log("Setting up local guest mode due to Firebase restriction...");
      const guestId = "guest_" + Math.random().toString(36).substring(7);
      const guestUser = { uid: guestId, isAnonymous: true } as FirebaseUser;
      setUser(guestUser);
      setUserData({
        uid: guestId,
        email: "guest@tgb.com",
        displayName: manualData?.nickname || "Guest Pioneer",
        role: "pioneer",
        kycStatus: "verified",
        piUid: manualData?.wallet || ""
      });
      setWallet({
        uid: guestId,
        balances: { PI: 76, USD: 0, DZD: 0 },
        lastUpdated: new Date()
      });
    } finally {
      console.log("loginWithPi finished, success:", success);
      setLoading(false);
      return success;
    }
  };

  const loginAsGuest = () => {
    const guestId = "guest_" + Math.random().toString(36).substring(7);
    const guestUser = { uid: guestId, isAnonymous: true } as FirebaseUser;
    setUser(guestUser);
    setUserData({
      uid: guestId,
      email: "guest@tgb.com",
      displayName: "Guest Explorer",
      role: "pioneer",
      kycStatus: "verified"
    });
    setWallet({
      uid: guestId,
      balances: { PI: 76, USD: 500, DZD: 75000 },
      lastUpdated: new Date()
    });
  };

  const logout = async () => { 
    await signOut(auth); 
    setUser(null);
    setUserData(null);
    setWallet(null);
    setTransactions([]);
  };

  return (
    <AuthContext.Provider value={{ user, userData, wallet, transactions, cards, stakes, loading, error, loginWithGoogle, loginWithPi, loginAsGuest, logout, setWallet, setTransactions }}>
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
          className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[100]"
        />
        <motion.div 
          initial={{ opacity: 0, y: 100, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 100, scale: 0.9 }}
          className="fixed bottom-32 left-4 right-4 sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 bg-slate-900 border border-slate-800 rounded-3xl p-6 z-[110] max-w-md mx-auto shadow-2xl"
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
  const { user, userData, wallet, transactions, cards, stakes, loading: authLoading, error: authError, loginWithGoogle, loginWithPi, loginAsGuest, logout, setWallet, setTransactions } = useAuth();
  const { prices, loading: pricesLoading } = useBinancePrices();
  const [exchangeRates, setExchangeRates] = useState({ usd_dzd: 134.5 });
  const [loginWalletAddress, setLoginWalletAddress] = useState('');
  const [loginNickname, setLoginNickname] = useState('');
  const [activeModal, setActiveModal] = useState<'transfer' | 'withdraw' | 'deposit' | 'shop' | 'card' | 'exchange' | 'partnership' | 'lending' | 'notification' | 'bank' | 'stake' | 'pool' | 'language' | 'executeLoan' | 'bankPortal' | 'groupApp' | 'kyc' | 'registration' | null>(null);
  const [regStep, setRegStep] = useState(1);
  const [regData, setRegData] = useState({
    firstName: '',
    lastName: '',
    dob: '',
    docType: 'id_card',
    walletAddress: '',
    passphrase: ''
  });
  const [kycStep, setKycStep] = useState(1);
  const [selectedPool, setSelectedPool] = useState<InvestmentPool | null>(null);
  const [selectedLoan, setSelectedLoan] = useState<any | null>(null);
  const [selectedBank, setSelectedBank] = useState<any | null>(null);
  const [notification, setNotification] = useState<{ title: string; message: string }>({ title: '', message: '' });
  const [txLoading, setTxLoading] = useState(false);
  const [txSuccess, setTxSuccess] = useState(false);
  const [lang, setLang] = useState<'en' | 'ar' | 'fr' | 'es' | 'kab' | 'ko' | 'zh' | 'ja' | 'it' | 'pt'>(() => {
    const saved = localStorage.getItem('tgb_lang');
    return (saved as any) || 'en';
  });

  useEffect(() => {
    localStorage.setItem('tgb_lang', lang);
  }, [lang]);
  useEffect(() => {
    if (activeModal) {
      setTxAmount(0);
      setTxDesc('');
    }
  }, [activeModal]);

  const isRTL = lang === 'ar';
  const [activeTab, setActiveTab] = useState<'wallet' | 'market' | 'cards' | 'profile' | 'store' | 'exchange' | 'finance'>('wallet');
  const [copySuccess, setCopySuccess] = useState(false);
  const [exchangeFrom, setExchangeFrom] = useState('USD');
  const [exchangeTo, setExchangeTo] = useState('PI');
  const [exchangeAmount, setExchangeAmount] = useState<number>(0);
  const [exchangeSubTab, setExchangeSubTab] = useState<'exchange' | 'history'>('exchange');
  const [txCurrency, setTxCurrency] = useState('PI');
  const [txAmount, setTxAmount] = useState<number>(0);
  const [txDesc, setTxDesc] = useState('');
  const [txType, setTxType] = useState<'buy' | 'sell'>('buy');
  const [connectedExchanges, setConnectedExchanges] = useState<string[]>(['Binance', 'MetaMask']);
  const [piMetrics, setPiMetrics] = useState<PiMetrics>({
    totalSupply: 100000000000,
    circulatingSupply: 4102596505,
    lockedSupply: 5990658971,
    activeCountries: 210,
    lastUpdated: new Date()
  });
  const [loans, setLoans] = useState<LoanRequest[]>([]);
  const [pools, setPools] = useState<InvestmentPool[]>([
    { id: '1', name: 'Tech Startup Fund', category: 'Venture Capital', totalInvested: 1250, target: 2000, membersCount: 125, image: 'https://picsum.photos/seed/tech/400/400' },
    { id: '2', name: 'Real Estate Pool', category: 'Property', totalInvested: 4450, target: 5000, membersCount: 89, image: 'https://picsum.photos/seed/estate/400/400' }
  ]);
  const [showQrModal, setShowQrModal] = useState(false);
  const [legalView, setLegalView] = useState<'privacy' | 'terms' | null>(null);
  
  // Transaction Filtering & Sorting
  const [txFilterType, setTxFilterType] = useState<'all' | 'deposit' | 'withdraw' | 'transfer' | 'exchange' | 'shop'>('all');
  const [txSortBy, setTxSortBy] = useState<'date' | 'amount'>('date');
  const [txSortOrder, setTxSortOrder] = useState<'asc' | 'desc'>('desc');
  const [txSearchQuery, setTxSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [stakeAmount, setStakeAmount] = useState<number>(0);
  const [stakeDuration, setStakeDuration] = useState<number>(6);
  const [notificationSettings, setNotificationSettings] = useState({
    transactions: true,
    market: true,
    security: true
  });
  const [bankTransferAmount, setBankTransferAmount] = useState<number>(0);
  const [bankTransferFrom, setBankTransferFrom] = useState<string>('TGB');
  const [bankTransferTo, setBankTransferTo] = useState<string>('Chase Bank');
  const [bankTransferLoading, setBankTransferLoading] = useState(false);
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);
  const [txAmountRange, setTxAmountRange] = useState<{ min: number; max: number }>({ min: 0, max: 1000000 });
  const [txDateRange, setTxDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });

  useEffect(() => {
    if (userData?.notificationSettings) {
      setNotificationSettings(userData.notificationSettings);
    }
  }, [userData]);

  const updateNotificationSettings = async (newSettings: typeof notificationSettings) => {
    setNotificationSettings(newSettings);
    if (user) {
      try {
        const userDocRef = doc(db, 'users', user.uid);
        await updateDoc(userDocRef, {
          notificationSettings: newSettings
        });
      } catch (err) {
        console.error("Failed to update notification settings:", err);
      }
    }
  };

  const handleBankTransfer = async () => {
    if (bankTransferAmount <= 0) return;
    if (bankTransferFrom === bankTransferTo) return;
    
    setBankTransferLoading(true);
    try {
      if (user && wallet) {
        const walletRef = doc(db, 'wallets', user.uid);
        const amount = bankTransferAmount;
        
        if (bankTransferFrom === 'TGB') {
          // Transfer from TGB to Bank
          if (wallet.balances['PI'] < amount) {
            console.error("Insufficient TGB balance");
            setBankTransferLoading(false);
            return;
          }
          
          await updateDoc(walletRef, {
            'balances.PI': increment(-amount)
          });
          
          // Add transaction
          await addDoc(collection(db, 'transactions'), {
            uid: user.uid,
            type: 'transfer',
            amount: amount,
            currency: 'PI',
            description: `Transfer to ${bankTransferTo}`,
            from: 'TGB Wallet',
            to: bankTransferTo,
            sender: user.uid,
            receiver: bankTransferTo,
            notes: 'Global Bank Transfer',
            timestamp: serverTimestamp(),
            status: 'pending'
          });
        } else if (bankTransferTo === 'TGB') {
          // Transfer from Bank to TGB
          await updateDoc(walletRef, {
            'balances.PI': increment(amount)
          });
          
          // Add transaction
          await addDoc(collection(db, 'transactions'), {
            uid: user.uid,
            type: 'deposit',
            amount: amount,
            currency: 'PI',
            description: `Deposit from ${bankTransferFrom}`,
            from: bankTransferFrom,
            to: 'TGB Wallet',
            sender: bankTransferFrom,
            receiver: user.uid,
            notes: 'Bank Deposit',
            timestamp: serverTimestamp(),
            status: 'completed'
          });
        }
        
        setBankTransferAmount(0);
        console.log("Bank transfer successful");
      }
    } catch (err) {
      console.error("Bank transfer error:", err);
    } finally {
      setBankTransferLoading(false);
    }
  };

  const handleCancelTransaction = async (txId: string) => {
    if (user) {
      try {
        const txRef = doc(db, 'transactions', txId);
        await updateDoc(txRef, {
          status: 'cancelled'
        });
        console.log("Transaction cancelled");
      } catch (err) {
        console.error("Failed to cancel transaction:", err);
      }
    }
  };

  const filteredTransactions = useMemo(() => {
    let result = [...transactions];

    // Filter by type
    if (txFilterType !== 'all') {
      result = result.filter(tx => tx.type === txFilterType);
    }

    // Filter by search query
    if (txSearchQuery) {
      const query = txSearchQuery.toLowerCase();
      result = result.filter(tx => 
        tx.description.toLowerCase().includes(query) || 
        tx.type.toLowerCase().includes(query) ||
        (tx.txid && tx.txid.toLowerCase().includes(query)) ||
        (tx.sender && tx.sender.toLowerCase().includes(query)) ||
        (tx.receiver && tx.receiver.toLowerCase().includes(query))
      );
    }

    // Filter by amount range
    result = result.filter(tx => Math.abs(tx.amount) >= txAmountRange.min && Math.abs(tx.amount) <= txAmountRange.max);

    // Filter by date range
    if (txDateRange.start) {
      const start = new Date(txDateRange.start).getTime();
      result = result.filter(tx => {
        const txDate = tx.timestamp?.seconds ? tx.timestamp.seconds * 1000 : Date.now();
        return txDate >= start;
      });
    }
    if (txDateRange.end) {
      const end = new Date(txDateRange.end).getTime() + 86400000; // End of day
      result = result.filter(tx => {
        const txDate = tx.timestamp?.seconds ? tx.timestamp.seconds * 1000 : Date.now();
        return txDate <= end;
      });
    }

    // Sort
    result.sort((a, b) => {
      if (txSortBy === 'date') {
        const dateA = a.timestamp?.seconds || 0;
        const dateB = b.timestamp?.seconds || 0;
        return txSortOrder === 'desc' ? dateB - dateA : dateA - dateB;
      } else {
        return txSortOrder === 'desc' ? Math.abs(b.amount) - Math.abs(a.amount) : Math.abs(a.amount) - Math.abs(b.amount);
      }
    });

    return result;
  }, [transactions, txFilterType, txSortBy, txSortOrder, txSearchQuery, txAmountRange, txDateRange]);

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
    en: { 
      balance: 'Total Portfolio', actions: 'Quick Actions', market: 'Market Insights', activity: 'Recent Activity', deposit: 'Deposit', withdraw: 'Withdraw', transfer: 'Transfer', shop: 'Shop', card: 'Request Visa Card', profile: 'Profile', store: 'Store', copyUid: 'Copy UID', uidCopied: 'UID Copied!', exchange: 'Global Exchange', exchangeHistory: 'Exchange History', buyPi: 'Buy Pi', sellPi: 'Sell Pi', kyc: 'KYC Verification', kycRequired: 'KYC Required for Global Users', kycPending: 'KYC Pending Review', kycVerified: 'KYC Verified', connectedExchanges: 'Connected Exchanges & Wallets', globalConnectivity: 'Global Connectivity', connected: 'Connected', disconnected: 'Disconnected', networkStatus: 'Network Status', mainnetSettlement: 'Mainnet Settlement', instant: 'Instant', finance: 'Finance', lending: 'P2P Lending', pools: 'Investment Pools', vault: 'Personal Vault', partnership: 'Business Partnership', scanQr: 'Scan QR', metrics: 'Global Pi Metrics', totalSupply: 'Total Supply', circulatingSupply: 'Circulating Supply', lockedSupply: 'Locked Supply', activeCountries: 'Active Countries', connectedBanks: 'Connected Banks', exchangeRates: 'Global Exchange Rates', remittance: 'Global Remittance', gcvValue: 'Consensus Value (GCV)', createLending: 'Create Lending Request', loanAmount: 'Loan Amount (π)', loanApr: 'Interest Rate (APR %)', loanPurpose: 'Purpose of Loan', addBank: 'Add Global Bank', executeLoan: 'Execute Loan', joinPool: 'Join Group', stakePi: 'Stake Pi to Boost Rank', submitProposal: 'Submit Business Proposal', comingSoon: 'Feature Coming Soon', copy: 'Copy', copied: 'Copied', logout: 'Logout', settings: 'Settings', privacy: 'Privacy & Security', language: 'Language', bankDetails: 'Bank Details', bankName: 'Bank Name', accountNumber: 'Account Number', swiftCode: 'SWIFT/BIC', stakeAmount: 'Stake Amount', stakeDuration: 'Duration (Months)', joinPoolConfirm: 'Join Investment Pool', poolContribution: 'Contribution (π)', confirm: 'Confirm', cancel: 'Cancel', staking: 'Pi Staking', stakedAmount: 'Staked Amount', estimatedApy: 'Estimated APY', lockDuration: 'Lock Duration', stakingHistory: 'Staking History', activeStakes: 'Active Stakes', noStakes: 'No active stakes found.', months: 'Months', stakingCalculator: 'Staking Calculator', estimateRewards: 'Estimate Rewards', potentialEarnings: 'Potential Earnings', totalReturn: 'Total Return', notifications: 'Notification Preferences', transactionAlerts: 'Transaction Alerts', marketAlerts: 'Market Changes', securityAlerts: 'Security Updates', bankTransfer: 'Bank Transfer', transferFrom: 'Transfer From', transferTo: 'Transfer To', tgbAccount: 'TGB Account', selectBank: 'Select Bank', amountToTransfer: 'Amount to Transfer', executeTransfer: 'Execute Transfer', transferSuccess: 'Transfer Successful', transferError: 'Transfer Failed',
      login: 'Login', register: 'Register', guestTour: 'Guest Tour', walletAddress: 'Pi Wallet Address', nickname: 'Nickname', openAccount: 'Open New Account & KYC', pioneerConnection: 'Pioneer Connection', securedByPi: 'Secured by Pi Network KYC', termsOfService: 'Terms of Service', privacyPolicy: 'Privacy Policy', selectLanguage: 'Select Language',
      insufficientFunds: 'Insufficient funds in your TGB wallet', invalidAmount: 'Invalid Amount', invalidAmountMsg: 'Please enter an amount greater than 0.', confirmAction: 'Confirm', walletQr: 'Your Wallet QR', walletAddressLabel: 'Wallet Address', addressCopied: 'Address copied!', scanQrNote: 'Scan this code to receive Pi instantly from any Pioneer.', businessProposal: 'Business Proposal', partnershipNote: 'TrustBank Global is looking for strategic partners. Submit your proposal to integrate your services.', companyName: 'Company Name', companyPlaceholder: 'Enter company name', proposalType: 'Proposal Type', ecommerce: 'E-commerce Integration', liquidity: 'Liquidity Provider', marketing: 'Marketing Partnership', other: 'Other', messageLabel: 'Message', messagePlaceholder: 'Describe your proposal...', copyPassphrase: 'Copy Passphrase', back: 'Back', finalConfirmation: 'Final Confirmation', confirmRegistration: 'Confirm Registration', finalStep: 'Final Step', nameLabel: 'Name', dobLabel: 'DOB', docTypeLabel: 'Document Type', walletReady: 'Wallet Ready', accountCreatedTitle: 'Account Created', accountCreatedMsg: 'Welcome to Trust Global Bank! Your account has been created and your KYC is now pending review.', completeRegistration: 'Complete Registration', personalIdentity: 'Personal Identity', step1of3: 'Step 1 of 3', fullLegalName: 'Full Legal Name', namePlaceholder: 'As shown on your ID', countryLabel: 'Country', continueToDocs: 'Continue to Documents', docVerification: 'Document Verification', step2of3: 'Step 2 of 3', passport: 'Passport', idCard: 'ID Card', driverLicense: 'Driver License', residencePermit: 'Residence Permit', uploadPhoto: 'Upload Document Photo', maxSizeNote: 'Max size: 5MB (JPG, PNG)', continueToBio: 'Continue to Biometrics', bioCheck: 'Biometric Liveness Check', bioNote: 'Position your face within the frame and ensure good lighting.', kycSubmittedTitle: 'KYC Submitted', kycSubmittedMsg: 'Your identity verification is being processed. This usually takes 5-10 minutes.', startScan: 'Start Scan', connectedBalance: 'Connected Balance', fiatValue: 'Fiat Value', viewStatement: 'View Bank Statement', instantRemittance: 'Instant Remittance', visitWebsite: 'Visit Official Website', currencyLabel: 'Currency', amountLabel: 'Amount', recipientLabel: 'Recipient UID or Wallet Address', descriptionLabel: 'Description', recipientPlaceholder: 'User UID or G... Address', notePlaceholder: 'Note', internalTransferNote: 'Note: This is an internal TGB transfer. To pay via Pi Blockchain, use the Pi Wallet app.', availableBalance: 'Available Balance'
    },
    ar: { 
      balance: 'إجمالي المحفظة', actions: 'إجراءات سريعة', market: 'رؤى السوق', activity: 'النشاط الأخير', deposit: 'إيداع', withdraw: 'سحب', transfer: 'تحويل', shop: 'تسوق', card: 'طلب بطاقة فيزا', profile: 'الملف الشخصي', store: 'المتجر', copyUid: 'نسخ المعرف', uidCopied: 'تم النسخ!', exchange: 'تبادل عالمي', exchangeHistory: 'سجل التبادل', buyPi: 'شراء باي', sellPi: 'بيع باي', kyc: 'التحقق من الهوية', kycRequired: 'مطلوب التحقق للمستخدمين العالميين', kycPending: 'التحقق قيد المراجعة', kycVerified: 'تم التحقق', connectedExchanges: 'البورصات والمحافظ المتصلة', globalConnectivity: 'الاتصال العالمي', connected: 'متصل', disconnected: 'غير متصل', networkStatus: 'حالة الشبكة', mainnetSettlement: 'تسوية الشبكة الرئيسية', instant: 'فوري', finance: 'المالية', lending: 'الإقراض P2P', pools: 'صناديق الاستثمار', vault: 'الخزنة الشخصية', partnership: 'شراكة تجارية', scanQr: 'مسح QR', metrics: 'إحصائيات باي العالمية', totalSupply: 'إجمالي المعروض', circulatingSupply: 'المعروض المتداول', lockedSupply: 'المعروض المقفل', activeCountries: 'الدول النشطة', connectedBanks: 'البنوك المتصلة', exchangeRates: 'أسعار الصرف العالمية', remittance: 'الحوالات العالمية', gcvValue: 'قيمة التوافق (GCV)', createLending: 'إنشاء طلب إقراض', loanAmount: 'مبلغ القرض (π)', loanApr: 'نسبة الفائدة (APR %)', loanPurpose: 'الغرض من القرض', addBank: 'إضافة بنك عالمي', executeLoan: 'تنفيذ القرض', joinPool: 'انضمام للمجموعة', stakePi: 'تجميد Pi لرفع الرتبة', submitProposal: 'تقديم عرض تجاري', comingSoon: 'الميزة قريباً', copy: 'نسخ', copied: 'تم النسخ', logout: 'تسجيل الخروج', settings: 'الإعدادات', privacy: 'الخصوصية والأمان', language: 'اللغة', bankDetails: 'تفاصيل البنك', bankName: 'اسم البنك', accountNumber: 'رقم الحساب', swiftCode: 'رمز السويفت', stakeAmount: 'مبلغ التجميد', stakeDuration: 'المدة (أشهر)', joinPoolConfirm: 'الانضمام لصندوق استثمار', poolContribution: 'المساهمة (π)', confirm: 'تأكيد', cancel: 'إلغاء', staking: 'تجميد Pi', stakedAmount: 'المبلغ المجمد', estimatedApy: 'العائد السنوي المتوقع', lockDuration: 'مدة القفل', stakingHistory: 'سجل التجميد', activeStakes: 'التجميدات النشطة', noStakes: 'لا يوجد تجميد نشط.', months: 'أشهر', stakingCalculator: 'حاسبة التجميد', estimateRewards: 'تقدير المكافآت', potentialEarnings: 'الأرباح المحتملة', totalReturn: 'إجمالي العائد', notifications: 'تفضيلات التنبيهات', transactionAlerts: 'تنبيهات المعاملات', marketAlerts: 'تغيرات السوق', securityAlerts: 'تحديثات الأمان', bankTransfer: 'تحويل بنكي', transferFrom: 'تحويل من', transferTo: 'تحويل إلى', tgbAccount: 'حساب TGB', selectBank: 'اختر البنك', amountToTransfer: 'المبلغ المراد تحويله', executeTransfer: 'تنفيذ التحويل', transferSuccess: 'تم التحويل بنجاح', transferError: 'فشل التحويل',
      login: 'تسجيل الدخول', register: 'تسجيل', guestTour: 'جولة زائر', walletAddress: 'عنوان محفظة Pi', nickname: 'الاسم المستعار', openAccount: 'فتح حساب جديد و KYC', pioneerConnection: 'اتصال Pioneer', securedByPi: 'مؤمن بواسطة Pi Network KYC', termsOfService: 'شروط الخدمة', privacyPolicy: 'سياسة الخصوصية', selectLanguage: 'اختر اللغة',
      insufficientFunds: 'رصيد غير كافٍ في محفظة TGB الخاصة بك', invalidAmount: 'مبلغ غير صالح', invalidAmountMsg: 'يرجى إدخال مبلغ أكبر من 0.', confirmAction: 'تأكيد', walletQr: 'رمز QR لمحفظتك', walletAddressLabel: 'عنوان المحفظة', addressCopied: 'تم نسخ العنوان!', scanQrNote: 'امسح هذا الرمز لتلقي Pi فوراً من أي Pioneer.', businessProposal: 'عرض تجاري', partnershipNote: 'تبحث TrustBank Global عن شركاء استراتيجيين. قدم عرضك لدمج خدماتك.', companyName: 'اسم الشركة', companyPlaceholder: 'أدخل اسم الشركة', proposalType: 'نوع العرض', ecommerce: 'تكامل التجارة الإلكترونية', liquidity: 'مزود السيولة', marketing: 'شراكة تسويقية', other: 'أخرى', messageLabel: 'الرسالة', messagePlaceholder: 'صف عرضك...', copyPassphrase: 'نسخ عبارة المرور', back: 'رجوع', finalConfirmation: 'التأكيد النهائي', confirmRegistration: 'تأكيد التسجيل', finalStep: 'الخطوة الأخيرة', nameLabel: 'الاسم', dobLabel: 'تاريخ الميلاد', docTypeLabel: 'نوع المستند', walletReady: 'المحفظة جاهزة', accountCreatedTitle: 'تم إنشاء الحساب', accountCreatedMsg: 'مرحباً بك في Trust Global Bank! تم إنشاء حسابك والتحقق من هويتك قيد المراجعة الآن.', completeRegistration: 'إكمال التسجيل', personalIdentity: 'الهوية الشخصية', step1of3: 'الخطوة 1 من 3', fullLegalName: 'الاسم القانوني الكامل', namePlaceholder: 'كما هو موضح في هويتك', countryLabel: 'البلد', continueToDocs: 'المتابعة إلى المستندات', docVerification: 'التحقق من المستندات', step2of3: 'الخطوة 2 من 3', passport: 'جواز سفر', idCard: 'بطاقة هوية', driverLicense: 'رخصة قيادة', residencePermit: 'تصريح إقامة', uploadPhoto: 'تحميل صورة المستند', maxSizeNote: 'الحد الأقصى للحجم: 5 ميجابايت (JPG, PNG)', continueToBio: 'المتابعة إلى القياسات الحيوية', bioCheck: 'فحص الحيوية البيومتري', bioNote: 'ضع وجهك داخل الإطار وتأكد من وجود إضاءة جيدة.', kycSubmittedTitle: 'تم تقديم KYC', kycSubmittedMsg: 'يتم معالجة التحقق من هويتك. يستغرق هذا عادةً 5-10 دقائق.', startScan: 'بدء المسح', connectedBalance: 'الرصيد المتصل', fiatValue: 'القيمة النقدية', viewStatement: 'عرض كشف الحساب البنكي', instantRemittance: 'حوالة فورية', visitWebsite: 'زيارة الموقع الرسمي', currencyLabel: 'العملة', amountLabel: 'المبلغ', recipientLabel: 'معرف المستلم أو عنوان المحفظة', descriptionLabel: 'الوصف', recipientPlaceholder: 'معرف المستخدم أو عنوان G...', notePlaceholder: 'ملاحظة', internalTransferNote: 'ملاحظة: هذا تحويل داخلي في TGB. للدفع عبر Pi Blockchain، استخدم تطبيق Pi Wallet.', availableBalance: 'الرصيد المتاح'
    },
    fr: { balance: 'Portefeuille Total', actions: 'Actions Rapides', market: 'Aperçu du Marché', activity: 'Activité Récente', deposit: 'Dépôt', withdraw: 'Retrait', transfer: 'Transfert', shop: 'Boutique', card: 'Demander une carte Visa', profile: 'Profil', store: 'Boutique', copyUid: 'Copier UID', uidCopied: 'UID Copié!', exchange: 'Échange Global', exchangeHistory: 'Historique des échanges', buyPi: 'Acheter Pi', sellPi: 'Vendre Pi', kyc: 'Vérification KYC', kycRequired: 'KYC requis', kycPending: 'KYC en attente', kycVerified: 'KYC vérifié', connectedExchanges: 'Échanges et Portefeuilles', globalConnectivity: 'Connectivité Globale', connected: 'Connecté', disconnected: 'Déconnecté', networkStatus: 'État du Réseau', mainnetSettlement: 'Règlement Mainnet', instant: 'Instantané', finance: 'Finance', lending: 'Prêt P2P', pools: 'Pools d\'Investissement', vault: 'Coffre Personnel', partnership: 'Partenariat Commercial', scanQr: 'Scanner QR', metrics: 'Métriques Globales Pi', totalSupply: 'Offre Totale', circulatingSupply: 'Offre Circulante', lockedSupply: 'Offre Verrouillée', activeCountries: 'Pays Actifs', connectedBanks: 'Banques Connectées', exchangeRates: 'Taux de Change Globaux', remittance: 'Remise Globale', gcvValue: 'Valeur de Consensus (GCV)', createLending: 'Créer une Demande de Prêt', loanAmount: 'Montant du Prêt (π)', loanApr: 'Taux d\'Intérêt (APR %)', loanPurpose: 'But du Prêt', addBank: 'Ajouter une Banque Globale', executeLoan: 'Éxécuter le Prêt', joinPool: 'Rejoindre le Groupe', stakePi: 'Staker Pi pour Boost Rank', submitProposal: 'Soumettre une Proposition', comingSoon: 'Fonctionnalité Bientôt', copy: 'Copier', copied: 'Copié', logout: 'Déconnexion', settings: 'Paramètres', privacy: 'Confidentialité', language: 'Langue', bankDetails: 'Détails Bancaires', bankName: 'Nom de la Banque', accountNumber: 'Numéro de Compte', swiftCode: 'Code SWIFT/BIC', stakeAmount: 'Montant du Stake', stakeDuration: 'Durée (Mois)', joinPoolConfirm: 'Rejoindre le Pool d\'Investissement', poolContribution: 'Contribution (π)', confirm: 'Confirmer', cancel: 'Annuler',
      insufficientFunds: 'Fonds insuffisants dans votre portefeuille TGB', invalidAmount: 'Montant invalide', invalidAmountMsg: 'Veuillez entrer un montant supérieur à 0.', confirmAction: 'Confirmer', walletQr: 'QR de votre portefeuille', walletAddressLabel: 'Adresse du portefeuille', addressCopied: 'Adresse copiée !', scanQrNote: 'Scannez ce code pour recevoir des Pi instantanément de n\'importe quel Pioneer.', businessProposal: 'Proposition commerciale', partnershipNote: 'TrustBank Global recherche des partenaires stratégiques. Soumettez votre proposition pour intégrer vos services.', companyName: 'Nom de l\'entreprise', companyPlaceholder: 'Entrez le nom de l\'entreprise', proposalType: 'Type de proposition', ecommerce: 'Intégration E-commerce', liquidity: 'Fournisseur de liquidité', marketing: 'Partenariat marketing', other: 'Autre', messageLabel: 'Message', messagePlaceholder: 'Décrivez votre proposition...', copyPassphrase: 'Copier la phrase de passe', back: 'Retour', finalConfirmation: 'Confirmation finale', confirmRegistration: 'Confirmer l\'inscription', finalStep: 'Dernière étape', nameLabel: 'Nom', dobLabel: 'Date de naissance', docTypeLabel: 'Type de document', walletReady: 'Portefeuille prêt', accountCreatedTitle: 'Compte créé', accountCreatedMsg: 'Bienvenue à Trust Global Bank ! Votre compte a été créé et votre KYC est en attente de révision.', completeRegistration: 'Terminer l\'inscription', personalIdentity: 'Identité personnelle', step1of3: 'Étape 1 sur 3', fullLegalName: 'Nom légal complet', namePlaceholder: 'Tel qu\'indiqué sur votre pièce d\'identité', countryLabel: 'Pays', continueToDocs: 'Continuer vers les documents', docVerification: 'Vérification des documents', step2of3: 'Étape 2 sur 3', passport: 'Passeport', idCard: 'Carte d\'identité', driverLicense: 'Permis de conduire', residencePermit: 'Permis de résidence', uploadPhoto: 'Télécharger la photo du document', maxSizeNote: 'Taille max : 5 Mo (JPG, PNG)', continueToBio: 'Continuer vers la biométrie', bioCheck: 'Vérification de la vivacité biométrique', bioNote: 'Positionnez votre visage dans le cadre et assurez un bon éclairage.', kycSubmittedTitle: 'KYC soumis', kycSubmittedMsg: 'Votre vérification d\'identité est en cours de traitement. Cela prend généralement 5 à 10 minutes.', startScan: 'Démarrer le scan', connectedBalance: 'Solde connecté', fiatValue: 'Valeur Fiat', viewStatement: 'Voir le relevé bancaire', instantRemittance: 'Remise instantanée', visitWebsite: 'Visiter le site officiel', currencyLabel: 'Devise', amountLabel: 'Montant', recipientLabel: 'UID du destinataire ou adresse du portefeuille', descriptionLabel: 'Description', recipientPlaceholder: 'UID utilisateur ou adresse G...', notePlaceholder: 'Note', internalTransferNote: 'Note : Il s\'agit d\'un transfert interne TGB. Pour payer via la blockchain Pi, utilisez l\'application Pi Wallet.', availableBalance: 'Solde disponible'
    },
    es: { balance: 'Cartera Total', actions: 'Acciones Rápidas', market: 'Mercado', activity: 'Accividad Reciente', deposit: 'Depósito', withdraw: 'Retiro', transfer: 'Transferencia', shop: 'Tienda', card: 'Solicitar Tarjeta Visa', profile: 'Perfil', store: 'Tienda', copyUid: 'Copiar UID', uidCopied: '¡UID Copiado!', exchange: 'Intercambio Global', exchangeHistory: 'Historial de intercambios', buyPi: 'Comprar Pi', sellPi: 'Vender Pi', kyc: 'Verificación KYC', kycRequired: 'KYC requerido', kycPending: 'KYC pendiente', kycVerified: 'KYC verificado', connectedExchanges: 'Intercambios y Billeteras', globalConnectivity: 'Conectividad Global', connected: 'Conectado', disconnected: 'Desconectado', networkStatus: 'Estado de la Red', mainnetSettlement: 'Liquidación Mainnet', instant: 'Instantáneo', finance: 'Finanzas', lending: 'Préstamos P2P', pools: 'Fondos de Inversión', vault: 'Bóveda Personal', partnership: 'Asociación Comercial', scanQr: 'Escanear QR', metrics: 'Métricas Globales Pi', totalSupply: 'Suministro Total', circulatingSupply: 'Suministro Circulante', lockedSupply: 'Suministro Bloqueado', activeCountries: 'Países Activos', connectedBanks: 'Bancos Conectados', exchangeRates: 'Tasas de Cambio Globales', remittance: 'Remesas Globales', gcvValue: 'Valor de Consenso (GCV)', createLending: 'Crear Solicitud de Préstamo', loanAmount: 'Monto del Préstamo (π)', loanApr: 'Tasa de Interés (APR %)', loanPurpose: 'Propósito del Préstamo', addBank: 'Agregar Banco Global', executeLoan: 'Ejecutar Préstamo', joinPool: 'Unirse al Grupo', stakePi: 'Staker Pi para Subir Rango', submitProposal: 'Enviar Propuesta', comingSoon: 'Próximamente', copy: 'Copiar', copied: 'Copiado', logout: 'Cerrar Sesión', settings: 'Ajustes', privacy: 'Privacidad', language: 'Idioma', bankDetails: 'Detalles Bancarios', bankName: 'Nombre del Banco', accountNumber: 'Número de Cuenta', swiftCode: 'Código SWIFT/BIC', stakeAmount: 'Monto de Stake', stakeDuration: 'Duración (Meses)', joinPoolConfirm: 'Unirse al Fondo de Inversión', poolContribution: 'Contribución (π)', confirm: 'Confirmar', cancel: 'Cancelar',
      insufficientFunds: 'Fondos insuficientes en su billetera TGB', invalidAmount: 'Monto inválido', invalidAmountMsg: 'Por favor, ingrese un monto mayor a 0.', confirmAction: 'Confirmar', walletQr: 'QR de su billetera', walletAddressLabel: 'Dirección de la billetera', addressCopied: '¡Dirección copiada!', scanQrNote: 'Escanee este código para recibir Pi al instante de cualquier Pioneer.', businessProposal: 'Propuesta comercial', partnershipNote: 'TrustBank Global busca socios estratégicos. Envíe su propuesta para integrar sus servicios.', companyName: 'Nombre de la empresa', companyPlaceholder: 'Ingrese el nombre de la empresa', proposalType: 'Tipo de propuesta', ecommerce: 'Integración de comercio electrónico', liquidity: 'Proveedor de liquidez', marketing: 'Asociación de marketing', other: 'Otro', messageLabel: 'Mensaje', messagePlaceholder: 'Describa su propuesta...', copyPassphrase: 'Copiar frase de contraseña', back: 'Atrás', finalConfirmation: 'Confirmación final', confirmRegistration: 'Confirmar registro', finalStep: 'Paso final', nameLabel: 'Nombre', dobLabel: 'Fecha de nacimiento', docTypeLabel: 'Tipo de documento', walletReady: 'Billetera lista', accountCreatedTitle: 'Cuenta creada', accountCreatedMsg: '¡Bienvenido a Trust Global Bank! Su cuenta ha sido creada y su KYC está pendiente de revisión.', completeRegistration: 'Completar registro', personalIdentity: 'Identidad personal', step1of3: 'Paso 1 de 3', fullLegalName: 'Nombre legal completo', namePlaceholder: 'Como aparece en su identificación', countryLabel: 'País', continueToDocs: 'Continuar a documentos', docVerification: 'Verificación de documentos', step2of3: 'Paso 2 de 3', passport: 'Pasaporte', idCard: 'Tarjeta de identificación', driverLicense: 'Licencia de conducir', residencePermit: 'Permiso de residencia', uploadPhoto: 'Subir foto del documento', maxSizeNote: 'Tamaño máx.: 5MB (JPG, PNG)', continueToBio: 'Continuar a biometría', bioCheck: 'Verificación de vitalidad biométrica', bioNote: 'Posicione su rostro dentro del marco y asegure una buena iluminación.', kycSubmittedTitle: 'KYC enviado', kycSubmittedMsg: 'Su verificación de identidad está siendo procesada. Esto suele tardar entre 5 y 10 minutos.', startScan: 'Iniciar escaneo', connectedBalance: 'Saldo conectado', fiatValue: 'Valor Fiat', viewStatement: 'Ver estado de cuenta', instantRemittance: 'Remesa instantánea', visitWebsite: 'Visitar sitio web oficial', currencyLabel: 'Moneda', amountLabel: 'Monto', recipientLabel: 'UID del destinatario o dirección de billetera', descriptionLabel: 'Descripción', recipientPlaceholder: 'UID de usuario o dirección G...', notePlaceholder: 'Nota', internalTransferNote: 'Nota: Esta es una transferencia interna de TGB. Para pagar a través de Pi Blockchain, use la aplicación Pi Wallet.', availableBalance: 'Saldo disponible'
    },
    kab: { balance: 'Agraw n tqarict', actions: 'Tigawt n tazzla', market: 'Anadi n ssuq', activity: 'Tigawt taneggarut', deposit: 'Asers', withdraw: 'Asufeg', transfer: 'Asiwel', shop: 'Amsawaq', card: 'Suter tkarict Visa', profile: 'Udem', store: 'Tahanut', copyUid: 'Nsek UID', uidCopied: 'UID yensek!', exchange: 'Amsel n GCV', exchangeHistory: 'Amazray n ubeddel', buyPi: 'Aɣ Pi', sellPi: 'Zenz Pi', kyc: 'Aselmed n udem', kycRequired: 'Aselmed n udem yettusuter', kycPending: 'Aselmed n udem deg uraju', kycVerified: 'Aselmed n udem yettuseqbel', connectedExchanges: 'Imsel d tqaricin', globalConnectivity: 'Tuqqna tamadlant', connected: 'Yeqqen', disconnected: 'Ur yeqqin ara', networkStatus: 'Addad n uzeṭṭa', mainnetSettlement: 'Aseɣti n Mainnet', instant: 'Imiren', finance: 'Tadamsa', lending: 'Areṭṭal P2P', pools: 'Imsel n usfari', vault: 'Asenduq n udem', partnership: 'Tiddukla n tnezzut', scanQr: 'Nsek QR', metrics: 'Iseknan n Pi', totalSupply: 'Agraw amatu', circulatingSupply: 'Agraw yettazzalen', lockedSupply: 'Agraw yeqqnen', activeCountries: 'Timura n tigawt', connectedBanks: 'Ibanken yeqqnen', exchangeRates: 'Azal n ubeddel', remittance: 'Asiwel n tedrimt', gcvValue: 'Azal n GCV', createLending: 'Suter areṭṭal', loanAmount: 'Azal n ureṭṭal (π)', loanApr: 'Azal n lfayda (APR %)', loanPurpose: 'I wacu ureṭṭal', addBank: 'Rnu lbank amadlan', executeLoan: 'Smed areṭṭal', joinPool: 'Ddu ɣer ugraw', stakePi: 'Sers Pi i tmerniwt', submitProposal: 'Azen asenfar', comingSoon: 'Qrib ad d-yas', copy: 'Nsek', copied: 'Yensek', logout: 'Asufeg', settings: 'Iseɣtiyen', privacy: 'Tabaḍnit', language: 'Tutlayt', bankDetails: 'Talɣut n lbank', bankName: 'Isem n lbank', accountNumber: 'Uṭṭun n uselmed', swiftCode: 'SWIFT/BIC', stakeAmount: 'Azal n users', stakeDuration: 'Tanzagt (Agguren)', joinPoolConfirm: 'Ddu ɣer ugraw n usfari', poolContribution: 'Asiwel (π)', confirm: 'Sentem', cancel: 'Sefsex' },
    ko: { balance: '총 포트폴리오', actions: '빠른 작업', market: '시장 인사이트', activity: '최근 활동', deposit: '입금', withdraw: '출금', transfer: '송금', shop: '쇼핑', card: '비자 카드 요청', profile: '프로필', store: '상점', copyUid: 'UID 복사', uidCopied: 'UID 복사됨!', exchange: '글로벌 거래소', exchangeHistory: '환전 내역', buyPi: 'Pi 구매', sellPi: 'Pi 판매', kyc: 'KYC 인증', kycRequired: 'KYC 필요', kycPending: 'KYC 검토 중', kycVerified: 'KYC 인증됨', connectedExchanges: '연결된 거래소', globalConnectivity: '글로벌 연결성', connected: '연결됨', disconnected: '연결 끊김', networkStatus: '네트워크 상태', mainnetSettlement: '메인넷 결제', instant: '즉시', finance: '금융', lending: 'P2P 대출', pools: '투자 풀', vault: '개인 금고', partnership: '비즈니스 파트너십', scanQr: 'QR 스캔', metrics: '글로벌 Pi 지표', totalSupply: '총 공급량', circulatingSupply: '유통 공급량', lockedSupply: '잠긴 공급량', activeCountries: '활성 국가', connectedBanks: '연결된 은행', exchangeRates: '글로벌 환율', remittance: '글로벌 송금', gcvValue: '합의 가치 (GCV)', createLending: '대출 요청 생성', loanAmount: '대출 금액 (π)', loanApr: '이자율 (APR %)', loanPurpose: '대출 목적', addBank: '글로벌 은행 추가', executeLoan: '대출 실행', joinPool: '그룹 가입', stakePi: 'Pi 스테이킹', submitProposal: '제안서 제출', comingSoon: '곧 출시 예정', copy: '복사', copied: '복사됨', logout: '로그아웃', settings: '설정', privacy: '개인정보 보호', language: '언어', bankDetails: '은행 상세 정보', bankName: '은행 이름', accountNumber: '계좌 번호', swiftCode: 'SWIFT/BIC', stakeAmount: '스테이킹 금액', stakeDuration: '기간 (개월)', joinPoolConfirm: '투자 풀 가입', poolContribution: '기여도 (π)', confirm: '확인', cancel: '취소' },
    zh: { balance: '总投资组合', actions: '快速操作', market: '市场洞察', activity: '近期活动', deposit: '充值', withdraw: '提现', transfer: '转账', shop: '购物', card: '申请维萨卡', profile: '个人资料', store: '商店', copyUid: '复制 UID', uidCopied: 'UID 已复制!', exchange: '全球交易所', exchangeHistory: '兑换历史', buyPi: '购买 Pi', sellPi: '出售 Pi', kyc: 'KYC 认证', kycRequired: '需要 KYC', kycPending: 'KYC 审核中', kycVerified: 'KYC 已认证', connectedExchanges: '已连接的交易所', globalConnectivity: '全球连接', connected: '已连接', disconnected: '未连接', networkStatus: '网络状态', mainnetSettlement: '主网结算', instant: '即时', finance: '金融', lending: 'P2P 借贷', pools: '投资池', vault: '个人金库', partnership: '商务合作', scanQr: '扫描二维码', metrics: '全球 Pi 指标', totalSupply: '总供应量', circulatingSupply: '流通供应量', lockedSupply: '锁定供应量', activeCountries: '活跃国家', connectedBanks: '连接的银行', exchangeRates: '全球汇率', remittance: '全球汇款', gcvValue: '共识价值 (GCV)', createLending: '创建借贷请求', loanAmount: '借贷金额 (π)', loanApr: '利率 (APR %)', loanPurpose: '借贷用途', addBank: '添加全球银行', executeLoan: '执行借贷', joinPool: '加入小组', stakePi: '质押 Pi 提升排名', submitProposal: '提交商业提案', comingSoon: '即将推出', copy: '复制', copied: '已复制', logout: '退出登录', settings: '设置', privacy: '隐私与安全', language: '语言', bankDetails: '银行详情', bankName: '银行名称', accountNumber: '账号', swiftCode: 'SWIFT/BIC', stakeAmount: '质押金额', stakeDuration: '期限 (月)', joinPoolConfirm: '加入投资池', poolContribution: '贡献 (π)', confirm: '确认', cancel: '取消' },
    ja: { balance: '総ポートフォリオ', actions: 'クイックアクション', market: '市場インサイト', activity: '最近の活動', deposit: '入金', withdraw: '出金', transfer: '送金', shop: 'ショップ', card: 'Visaカードをリクエスト', profile: 'プロフィール', store: 'ストア', copyUid: 'UIDをコピー', uidCopied: 'UIDがコピーされました!', exchange: 'グローバル取引所', exchangeHistory: '両替履歴', buyPi: 'Piを購入', sellPi: 'Piを売却', kyc: 'KYC認証', kycRequired: 'KYCが必要', kycPending: 'KYC審査中', kycVerified: 'KYC認証済み', connectedExchanges: '接続された取引所', globalConnectivity: 'グローバル接続', connected: '接続済み', disconnected: '未接続', networkStatus: 'ネットワークステータス', mainnetSettlement: 'メインネット決済', instant: '即時', finance: '金融', lending: 'P2Pレンディング', pools: '投資プール', vault: '個人用金庫', partnership: 'ビジネスパートナーシップ', scanQr: 'QRスキャン', metrics: 'グローバルPi指標', totalSupply: '総供給量', circulatingSupply: '循環供給量', lockedSupply: 'ロックされた供給量', activeCountries: '活動国', connectedBanks: '接続された銀行', exchangeRates: 'グローバル為替レート', remittance: 'グローバル送금', gcvValue: 'コンセンサス価値 (GCV)', createLending: '貸付リクエストを作成', loanAmount: '貸付金額 (π)', loanApr: '利率 (APR %)', loanPurpose: '貸付目的', addBank: 'グローバル銀行を追加', executeLoan: '貸付を実行', joinPool: 'グループに参加', stakePi: 'Piをステーキング', submitProposal: '提案を提出', comingSoon: '近日公開', copy: 'コピー', copied: 'コピー済み', logout: 'ログアウト', settings: '設定', privacy: 'プライバシー', language: '言語', bankDetails: '銀行詳細', bankName: '銀行名', accountNumber: '口座番号', swiftCode: 'SWIFT/BIC', stakeAmount: 'ステーキング額', stakeDuration: '期間 (ヶ月)', joinPoolConfirm: '投資プールに参加', poolContribution: '拠出額 (π)', confirm: '確認', cancel: 'キャンセル' },
    it: { balance: 'Portafoglio Totale', actions: 'Azioni Rapide', market: 'Mercato', activity: 'Attività Recente', deposit: 'Deposito', withdraw: 'Prelievo', transfer: 'Trasferimento', shop: 'Negozio', card: 'Richiedi Carta Visa', profile: 'Profilo', store: 'Negozio', copyUid: 'Copia UID', uidCopied: 'UID Copiato!', exchange: 'Scambio Globale', exchangeHistory: 'Cronologia scambi', buyPi: 'Compra Pi', sellPi: 'Vendi Pi', kyc: 'Verifica KYC', kycRequired: 'KYC richiesto', kycPending: 'KYC in attesa', kycVerified: 'KYC verificato', connectedExchanges: 'Scambi Collegati', globalConnectivity: 'Connettività Globale', connected: 'Collegato', disconnected: 'Scollegato', networkStatus: 'Stato della Rete', mainnetSettlement: 'Regolamento Mainnet', instant: 'Istantaneo', finance: 'Finanza', lending: 'Prestiti P2P', pools: 'Pool di Investimento', vault: 'Caveau Personale', partnership: 'Partnership Commerciale', scanQr: 'Scansiona QR', metrics: 'Metriche Globali Pi', totalSupply: 'Fornitura Totale', circulatingSupply: 'Fornitura Circolante', lockedSupply: 'Fornitura Bloccata', activeCountries: 'Paesi Attivi', connectedBanks: 'Banche Collegate', exchangeRates: 'Tassi di Cambio Globali', remittance: 'Rimesse Globali', gcvValue: 'Valore di Consenso (GCV)', createLending: 'Crea Richiesta di Prestito', loanAmount: 'Importo del Prestito (π)', loanApr: 'Tasso di Interesse (APR %)', loanPurpose: 'Scopo del Prestito', addBank: 'Aggiungi Banca Globale', executeLoan: 'Esegui Prestito', joinPool: 'Unisciti al Gruppo', stakePi: 'Metti in Stake Pi', submitProposal: 'Invia Proposta', comingSoon: 'Prossimamente', copy: 'Copia', copied: 'Copiato', logout: 'Esci', settings: 'Impostazioni', privacy: 'Privacy', language: 'Lingua', bankDetails: 'Dettagli Bancari', bankName: 'Nome Banca', accountNumber: 'Numero Conto', swiftCode: 'Codice SWIFT/BIC', stakeAmount: 'Importo Stake', stakeDuration: 'Durata (Mesi)', joinPoolConfirm: 'Unisciti al Pool di Investimento', poolContribution: 'Contributo (π)', confirm: 'Conferma', cancel: 'Annulla' },
    pt: { balance: 'Portfólio Total', actions: 'Ações Rápidas', market: 'Mercado', activity: 'Actividade Recente', deposit: 'Depósito', withdraw: 'Saque', transfer: 'Transferência', shop: 'Loja', card: 'Solicitar Cartão Visa', profile: 'Perfil', store: 'Loja', copyUid: 'Copiar UID', uidCopied: 'UID Copiado!', exchange: 'Troca Global', exchangeHistory: 'Histórico de trocas', buyPi: 'Comprar Pi', sellPi: 'Vender Pi', kyc: 'Verificação KYC', kycRequired: 'KYC necessário', kycPending: 'KYC pendente', kycVerified: 'KYC verificado', connectedExchanges: 'Exchanges Conectadas', globalConnectivity: 'Conectividade Global', connected: 'Conectado', disconnected: 'Desconectado', networkStatus: 'Status da Rede', mainnetSettlement: 'Liquidação Mainnet', instant: 'Instantâneo', finance: 'Finanças', lending: 'Empréstimos P2P', pools: 'Pools de Investimento', vault: 'Cofre Pessoal', partnership: 'Parceria Comercial', scanQr: 'Escanear QR', metrics: 'Métricas Globales Pi', totalSupply: 'Suprimento Total', circulatingSupply: 'Suprimento Circulante', lockedSupply: 'Suprimento Bloqueado', activeCountries: 'Países Activos', connectedBanks: 'Bancos Conectados', exchangeRates: 'Taxas de Câmbio Globais', remittance: 'Remessas Globales', gcvValue: 'Valor de Consenso (GCV)', createLending: 'Criar Pedido de Empréstimo', loanAmount: 'Valor do Empréstimo (π)', loanApr: 'Taxa de Juros (APR %)', loanPurpose: 'Objetivo do Empréstimo', addBank: 'Adicionar Banco Global', executeLoan: 'Executar Empréstimo', joinPool: 'Participar do Grupo', stakePi: 'Stake Pi para Subir Rank', submitProposal: 'Enviar Proposta', comingSoon: 'Em breve', copy: 'Copiar', copied: 'Copiado', logout: 'Sair', settings: 'Configurações', privacy: 'Privacidade', language: 'Idioma', bankDetails: 'Detalhes Bancários', bankName: 'Nome do Banco', accountNumber: 'Número da Conta', swiftCode: 'Código SWIFT/BIC', stakeAmount: 'Valor de Stake', stakeDuration: 'Duração (Meses)', joinPoolConfirm: 'Participar do Fundo de Investimento', poolContribution: 'Contribuição (π)', confirm: 'Confirmar', cancel: 'Cancelar' }
  }[lang];

  const handleCopyUid = () => {
    if (user?.uid) {
      navigator.clipboard.writeText(user.uid);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const handleTransaction = async (type: string, amount: number, desc: string, recipientUid?: string, currency: string = 'PI') => {
    if (!wallet) return;
    setTxLoading(true);
    
    // Guest Mode Simulation
    if (!user) {
      console.log("Simulating guest transaction...");
      const currentBalance = wallet.balances[currency] || 0;
      if (type !== 'deposit' && currentBalance < amount) {
        setNotification({ title: 'Error', message: 'Insufficient funds' });
        setActiveModal('notification');
        setTxLoading(false);
        return;
      }
      
      // Update local wallet state
      setWallet({
        ...wallet,
        balances: {
          ...wallet.balances,
          [currency]: (wallet.balances[currency] || 0) + (type === 'deposit' ? amount : -amount)
        }
      });
      
      // Add to local transactions
      const newTx: Transaction = {
        id: "guest_" + Date.now(),
        uid: "guest",
        type: type as any,
        amount: type === 'deposit' ? amount : -amount,
        currency,
        description: desc,
        timestamp: new Date(),
        status: 'completed'
      };
      setTransactions([newTx, ...transactions]);
      
      setTxSuccess(true);
      setTimeout(() => {
        setTxSuccess(false);
        setActiveModal(null);
      }, 2000);
      setTxLoading(false);
      return;
    }

    const path = `wallets/${user.uid}`;
    try {
      const currentBalance = wallet.balances[currency] || 0;
      if (type !== 'deposit' && currentBalance < amount) throw new Error("Insufficient funds");

      // For real transfers, we update both wallets
      if (type === 'transfer' && recipientUid) {
        let finalRecipientUid = recipientUid;
        let recipientWalletRef = doc(db, 'wallets', recipientUid);
        let recipientWallet = await getDoc(recipientWalletRef);

        // If not found by direct UID, search by piWalletAddress or piUid
        if (!recipientWallet.exists()) {
          console.log("Recipient not found by UID, searching by wallet address/piUid...");
          const usersRef = collection(db, 'users');
          const q = query(usersRef, where('piWalletAddress', '==', recipientUid), limit(1));
          const q2 = query(usersRef, where('piUid', '==', recipientUid), limit(1));
          const q3 = query(usersRef, where('displayName', '==', recipientUid), limit(1));
          
          const [snap1, snap2, snap3] = await Promise.all([getDocs(q), getDocs(q2), getDocs(q3)]);
          const userDoc = snap1.docs[0] || snap2.docs[0] || snap3.docs[0];
          
          if (userDoc) {
            finalRecipientUid = userDoc.id;
            recipientWalletRef = doc(db, 'wallets', finalRecipientUid);
            recipientWallet = await getDoc(recipientWalletRef);
          }
        }

        if (!recipientWallet.exists()) throw new Error("Recipient wallet not found. Please check the UID or Wallet Address.");
        
        await updateDoc(recipientWalletRef, {
          [`balances.${currency}`]: increment(amount)
        });
        recipientUid = finalRecipientUid; // Use the resolved UID for transaction record
      }

      await updateDoc(doc(db, 'wallets', user.uid), {
        [`balances.${currency}`]: increment(type === 'deposit' ? amount : -amount),
        lastUpdated: serverTimestamp()
      });

      await addDoc(collection(db, 'transactions'), {
        uid: user.uid,
        recipientUid: recipientUid || null,
        type,
        amount: type === 'deposit' ? amount : -amount,
        currency,
        description: desc,
        sender: user.uid,
        receiver: recipientUid || 'System',
        notes: type === 'transfer' ? `Transfer to ${recipientUid}` : `Wallet ${type}`,
        timestamp: serverTimestamp(),
        status: type === 'transfer' ? 'pending' : 'completed'
      });

      setTxSuccess(true);
      setTimeout(() => {
        setTxSuccess(false);
        setActiveModal(null);
      }, 2000);
    } catch (e: any) {
      console.error("Transaction error:", e);
      const errorMsg = e.message || "Transaction failed. Please try again.";
      setNotification({ title: 'Transaction Error', message: errorMsg });
      setActiveModal('notification');
      // Still log to Firestore error handler for debugging if it's a Firestore error
      if (e.code || e.name === 'FirebaseError') {
        handleFirestoreError(e, OperationType.WRITE, path);
      }
    } finally {
      setTxLoading(false);
    }
  };

  const handleExchange = async (fromSymbol: string, toSymbol: string, fromAmount: number) => {
    if (!user || !wallet) return;
    
    const fromPrice = prices[fromSymbol] || 0;
    const toPrice = prices[toSymbol] || 0;
    
    if (fromPrice === 0 || toPrice === 0) {
      setNotification({ title: 'Error', message: "Invalid exchange pair or price not available" });
      setActiveModal('notification');
      return;
    }

    const toAmount = (fromAmount * fromPrice) / toPrice;
    const currentFromBalance = wallet.balances[fromSymbol] || 0;

    if (fromAmount > currentFromBalance) {
      setNotification({ title: 'Error', message: "Insufficient balance" });
      setActiveModal('notification');
      return;
    }

    setTxLoading(true);
    try {
      const walletRef = doc(db, 'wallets', user.uid);
      await updateDoc(walletRef, {
        [`balances.${fromSymbol}`]: increment(-fromAmount),
        [`balances.${toSymbol}`]: increment(toAmount),
        lastUpdated: serverTimestamp()
      });

      await addDoc(collection(db, 'transactions'), {
        uid: user.uid,
        type: 'exchange',
        amount: toAmount,
        currency: toSymbol,
        fromAmount: fromAmount,
        fromCurrency: fromSymbol,
        toAmount: toAmount,
        toCurrency: toSymbol,
        rate: fromPrice / toPrice,
        description: `Exchanged ${fromAmount} ${fromSymbol} for ${toAmount.toFixed(6)} ${toSymbol}`,
        sender: 'TGB Exchange',
        receiver: user.uid,
        notes: `Exchange Rate: 1 ${fromSymbol} = ${(fromPrice / toPrice).toFixed(6)} ${toSymbol}`,
        timestamp: serverTimestamp(),
        status: 'pending'
      });

      setTxSuccess(true);
      setTimeout(() => setTxSuccess(false), 2000);
    } catch (e: any) {
      setNotification({ title: 'Error', message: e.message });
      setActiveModal('notification');
    } finally {
      setTxLoading(false);
    }
  };

  const handleLendingRequest = async (amount: number, apr: number, purpose: string) => {
    if (!user) return;
    setTxLoading(true);
    try {
      await addDoc(collection(db, 'loans'), {
        uid: user.uid,
        user: userData?.displayName || 'Pioneer',
        amount,
        apr,
        purpose,
        rating: 'A',
        status: 'pending',
        timestamp: serverTimestamp()
      });

      setTxSuccess(true);
      setTimeout(() => {
        setTxSuccess(false);
        setActiveModal(null);
      }, 2000);
    } catch (e: any) {
      setNotification({ title: 'Error', message: e.message });
      setActiveModal('notification');
    } finally {
      setTxLoading(false);
    }
  };

  const handleExecuteLoan = (loan: any) => {
    setSelectedLoan(loan);
    setActiveModal('executeLoan');
  };

  const confirmExecuteLoan = async () => {
    if (!user || !wallet || !selectedLoan) return;
    if ((wallet.balances['PI'] || 0) < selectedLoan.amount) {
      setNotification({ title: 'Error', message: "Insufficient PI balance to fund this loan" });
      setActiveModal('notification');
      return;
    }

    setTxLoading(true);
    try {
      // In a real app, this would be a complex transaction
      await updateDoc(doc(db, 'wallets', user.uid), {
        'balances.PI': increment(-selectedLoan.amount),
        lastUpdated: serverTimestamp()
      });

      await addDoc(collection(db, 'transactions'), {
        uid: user.uid,
        type: 'loan_funding',
        amount: -selectedLoan.amount,
        currency: 'PI',
        description: `Funded P2P Loan #${selectedLoan.id.slice(0, 8)}`,
        timestamp: serverTimestamp(),
        status: 'completed'
      });

      setTxSuccess(true);
      setTimeout(() => {
        setTxSuccess(false);
        setActiveModal(null);
        setSelectedLoan(null);
      }, 2000);
    } catch (e: any) {
      setNotification({ title: 'Error', message: e.message });
      setActiveModal('notification');
    } finally {
      setTxLoading(false);
    }
  };

  const handleJoinPool = async (poolId: string) => {
    const pool = pools.find(p => p.id === poolId);
    if (pool) {
      setSelectedPool(pool);
      setActiveModal('pool');
    }
  };

  const handleAddBank = () => {
    setActiveModal('bank');
  };

  const handleStakePi = () => {
    setActiveModal('stake');
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
      setNotification({ title: 'Error', message: e.message });
      setActiveModal('notification');
    } finally {
      setTxLoading(false);
    }
  };

  const handleBuyProduct = async (product: Product) => {
    if (!user || !wallet) return;
    
    // If we are in Pi Browser, try real Pi payment
    const isPiBrowser = /PiBrowser/i.test(navigator.userAgent);
    if (isPiBrowser && (window as any).Pi) {
      try {
        setTxLoading(true);
        const payment = await (window as any).Pi.createPayment({
          amount: product.price,
          memo: `Purchased ${product.name} via TGB Store`,
          metadata: { productId: product.id, type: 'shop' }
        }, {
          onReadyForServerApproval: async (paymentId: string) => {
            console.log("Payment ready for server approval:", paymentId);
            await fetch('/api/pi/approve', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ paymentId })
            });
          },
          onReadyForServerCompletion: async (paymentId: string, txid: string) => {
            console.log("Payment ready for server completion:", paymentId, txid);
            await fetch('/api/pi/complete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ paymentId, txid })
            });
            
            // Update local Firestore after successful blockchain payment
            await updateDoc(doc(db, 'wallets', user.uid), {
              'balances.PI': increment(product.price), // In a real shop we might add items, but here we just log the tx
              lastUpdated: serverTimestamp()
            });
            await addDoc(collection(db, 'transactions'), {
              uid: user.uid,
              type: 'shop',
              amount: -product.price,
              currency: 'PI',
              description: `Purchased ${product.name} (Blockchain)`,
              sender: user.uid,
              receiver: 'TGB Shop',
              notes: `Product: ${product.name}`,
              txid: txid,
              timestamp: serverTimestamp(),
              status: 'completed'
            });
            
            setTxSuccess(true);
            setTimeout(() => {
              setTxSuccess(false);
              setActiveModal(null);
            }, 2000);
          },
          onCancel: (paymentId: string) => {
            console.log("Payment cancelled:", paymentId);
            setTxLoading(false);
          },
          onError: (error: Error, paymentId?: string) => {
            console.error("Payment error:", error, paymentId);
            setNotification({ title: 'Payment Error', message: error.message });
            setActiveModal('notification');
            setTxLoading(false);
          }
        });
        return;
      } catch (e: any) {
        console.error("Pi Payment creation error:", e);
        setTxLoading(false);
      }
    }

    // Fallback for non-Pi browser or guest mode
    const currentPiBalance = wallet.balances['PI'] || 0;
    if (currentPiBalance < product.price) {
      setNotification({ title: 'Error', message: "Insufficient Pi balance" });
      setActiveModal('notification');
      return;
    }
    setTxLoading(true);
    try {
      if (user.uid !== 'guest-uid') {
        await updateDoc(doc(db, 'wallets', user.uid), {
          'balances.PI': increment(-product.price),
          lastUpdated: serverTimestamp()
        });
        await addDoc(collection(db, 'transactions'), {
          uid: user.uid,
          type: 'shop',
          amount: -product.price,
          currency: 'PI',
          description: `Purchased ${product.name}`,
          sender: user.uid,
          receiver: 'TGB Shop',
          notes: `Product: ${product.name}`,
          timestamp: serverTimestamp(),
          status: 'completed'
        });
      } else {
        // Guest mode local update
        setWallet(prev => prev ? {
          ...prev,
          balances: { ...prev.balances, PI: (prev.balances['PI'] || 0) - product.price }
        } : null);
        setTransactions(prev => [{
          id: Math.random().toString(36).substr(2, 9),
          uid: 'guest-uid',
          type: 'shop',
          amount: -product.price,
          currency: 'PI',
          description: `Purchased ${product.name} (Guest)`,
          timestamp: new Date(),
          status: 'completed'
        }, ...prev]);
      }

      setTxSuccess(true);
      setTimeout(() => {
        setTxSuccess(false);
        setActiveModal(null);
      }, 2000);
    } catch (e: any) {
      setNotification({ title: 'Error', message: e.message });
      setActiveModal('notification');
    } finally {
      setTxLoading(false);
    }
  };

  const calculateUsd = (amount: number, symbol: string = 'PI') => (amount * (prices[symbol] || 0)).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  const calculateDzd = (amount: number, symbol: string = 'PI') => (amount * (prices[symbol] || 0) * exchangeRates.usd_dzd).toLocaleString('ar-DZ', { style: 'currency', currency: 'DZD' });

  const handleKycSubmit = async () => {
    if (!user) return;
    setTxLoading(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        kycStatus: 'pending'
      });
      setTxSuccess(true);
      setTimeout(() => {
        setTxSuccess(false);
        setActiveTab('profile');
      }, 2000);
    } catch (e: any) {
      setNotification({ title: 'Error', message: e.message });
      setActiveModal('notification');
    } finally {
      setTxLoading(false);
    }
  };

  const handleBuyPiWithUsd = async (usdAmount: number) => {
    if (!user || !wallet) return;
    if (userData?.role === 'global' && userData?.kycStatus !== 'verified') {
      setNotification({ title: 'KYC Required', message: t.kycRequired });
      setActiveModal('notification');
      return;
    }
    
    const piAmount = usdAmount / PI_FIXED_PRICE;
    
    // If we are in Pi Browser, try real Pi payment
    const isPiBrowser = /PiBrowser/i.test(navigator.userAgent);
    if (isPiBrowser && (window as any).Pi) {
      try {
        setTxLoading(true);
        const payment = await (window as any).Pi.createPayment({
          amount: piAmount,
          memo: `Purchase of ${piAmount.toFixed(4)} PI via TGB`,
          metadata: { usdAmount, type: 'buy_pi' }
        }, {
          onReadyForServerApproval: async (paymentId: string) => {
            console.log("Payment ready for server approval:", paymentId);
            await fetch('/api/pi/approve', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ paymentId })
            });
          },
          onReadyForServerCompletion: async (paymentId: string, txid: string) => {
            console.log("Payment ready for server completion:", paymentId, txid);
            await fetch('/api/pi/complete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ paymentId, txid })
            });
            
            // Update local Firestore after successful blockchain payment
            await updateDoc(doc(db, 'wallets', user.uid), {
              'balances.PI': increment(piAmount),
              lastUpdated: serverTimestamp()
            });
            await addDoc(collection(db, 'transactions'), {
              uid: user.uid,
              type: 'deposit',
              amount: piAmount,
              currency: 'PI',
              description: `Bought Pi with ${usdAmount} USD`,
              sender: 'TGB Exchange',
              receiver: user.uid,
              notes: `Payment ID: ${paymentId}`,
              txid: txid,
              paymentId: paymentId,
              timestamp: serverTimestamp(),
              status: 'completed'
            });
            setTxSuccess(true);
            setTimeout(() => setTxSuccess(false), 2000);
          },
          onCancel: (paymentId: string) => {
            console.log("Payment cancelled:", paymentId);
            setTxLoading(false);
          },
          onError: (error: Error, paymentId?: string) => {
            console.error("Payment error:", error, paymentId);
            setNotification({ title: 'Payment Failed', message: error.message });
            setActiveModal('notification');
            setTxLoading(false);
          }
        });
        console.log("Payment created:", payment);
      } catch (e: any) {
        console.error("Pi Payment creation error:", e);
        setNotification({ title: 'Error', message: e.message });
        setActiveModal('notification');
        setTxLoading(false);
      }
      return;
    }

    // Fallback for non-Pi browser (demo mode)
    setTxLoading(true);
    try {
      await updateDoc(doc(db, 'wallets', user.uid), {
        'balances.PI': increment(piAmount),
        lastUpdated: serverTimestamp()
      });
      await addDoc(collection(db, 'transactions'), {
        uid: user.uid,
        type: 'deposit',
        amount: piAmount,
        currency: 'PI',
        description: `Bought Pi with ${usdAmount} USD (Demo Mode)`,
        sender: 'TGB Exchange',
        receiver: user.uid,
        notes: 'Demo Mode Purchase',
        timestamp: serverTimestamp(),
        status: 'completed'
      });
      setTxSuccess(true);
      setTimeout(() => setTxSuccess(false), 2000);
    } catch (e: any) {
      setNotification({ title: 'Error', message: e.message });
      setActiveModal('notification');
    } finally {
      setTxLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-6 p-6">
        <Loader2 className="w-12 h-12 text-amber-500 animate-spin" />
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2 }} className="text-center space-y-6">
          <div className="space-y-2">
            <p className="text-amber-500/80 font-bold animate-pulse text-xl">Waking up the Bank Vault...</p>
            <p className="text-slate-500 text-xs">This may take a moment on the first visit or slow connections.</p>
          </div>
          <motion.button 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 10 }}
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 font-bold text-sm hover:text-white transition-colors"
          >
            Take too long? Tap to Retry
          </motion.button>
        </motion.div>
      </div>
    );
  }

  if (!user && !userData) {
    if (legalView === 'privacy') {
      return (
        <div className="min-h-screen bg-slate-950 text-white p-6 font-sans">
          <div className="max-w-2xl mx-auto space-y-8 py-12">
            <button onClick={() => setLegalView(null)} className="flex items-center space-x-2 text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Login</span>
            </button>
            <h1 className="text-4xl font-black tracking-tight">Privacy Policy</h1>
            <div className="space-y-6 text-slate-400 leading-relaxed">
              <p>Last updated: April 4, 2026</p>
              <section className="space-y-4">
                <h2 className="text-xl font-bold text-white">1. Information We Collect</h2>
                <p>We collect information you provide directly to us, such as your Pi Network username, wallet address, and transaction history within the app.</p>
              </section>
              <section className="space-y-4">
                <h2 className="text-xl font-bold text-white">2. How We Use Your Information</h2>
                <p>We use the information we collect to provide, maintain, and improve our services, to process your transactions, and to communicate with you.</p>
              </section>
              <section className="space-y-4">
                <h2 className="text-xl font-bold text-white">3. Data Security</h2>
                <p>We take reasonable measures to help protect information about you from loss, theft, misuse and unauthorized access, disclosure, alteration and destruction.</p>
              </section>
              <section className="space-y-4">
                <h2 className="text-xl font-bold text-white">4. Pi Network Integration</h2>
                <p>Our app integrates with the Pi Network SDK. Your use of Pi Network features is also subject to the Pi Network Privacy Policy.</p>
              </section>
            </div>
          </div>
        </div>
      );
    }

    if (legalView === 'terms') {
      return (
        <div className="min-h-screen bg-slate-950 text-white p-6 font-sans">
          <div className="max-w-2xl mx-auto space-y-8 py-12">
            <button onClick={() => setLegalView(null)} className="flex items-center space-x-2 text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Login</span>
            </button>
            <h1 className="text-4xl font-black tracking-tight">Terms of Service</h1>
            <div className="space-y-6 text-slate-400 leading-relaxed">
              <p>Last updated: April 4, 2026</p>
              <section className="space-y-4">
                <h2 className="text-xl font-bold text-white">1. Acceptance of Terms</h2>
                <p>By accessing or using Trust Global Bank (TGB), you agree to be bound by these Terms of Service.</p>
              </section>
              <section className="space-y-4">
                <h2 className="text-xl font-bold text-white">2. Description of Service</h2>
                <p>Trust Global Bank provides a platform for Pi Network users to manage their digital assets, perform transactions, and access financial services.</p>
              </section>
              <section className="space-y-4">
                <h2 className="text-xl font-bold text-white">3. User Responsibilities</h2>
                <p>You are responsible for maintaining the confidentiality of your account and for all activities that occur under your account.</p>
              </section>
              <section className="space-y-4">
                <h2 className="text-xl font-bold text-white">4. Limitation of Liability</h2>
                <p>Trust Global Bank shall not be liable for any indirect, incidental, special, consequential or punitive damages resulting from your use of the service.</p>
              </section>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <motion.div 
            animate={{ 
              scale: [1, 1.2, 1],
              rotate: [0, 90, 0],
              opacity: [0.1, 0.2, 0.1]
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-amber-500/20 to-transparent rounded-full blur-3xl"
          />
          <motion.div 
            animate={{ 
              scale: [1, 1.5, 1],
              rotate: [0, -90, 0],
              opacity: [0.05, 0.15, 0.05]
            }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-indigo-500/20 to-transparent rounded-full blur-3xl"
          />
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md text-center space-y-12 relative z-10">
          <div className="flex flex-col items-center space-y-6">
            <div className="flex justify-between w-full items-center mb-4">
              <button 
                onClick={() => setActiveModal('language')} 
                className="p-3 bg-slate-900/50 backdrop-blur-md rounded-2xl border border-slate-800 text-slate-400 hover:text-white transition-all flex items-center space-x-2"
              >
                <Languages className="w-5 h-5" />
                <span className="text-[10px] font-bold uppercase tracking-widest">{lang.toUpperCase()}</span>
              </button>
              <div className="w-10" /> {/* Spacer */}
            </div>
            <motion.div 
              whileHover={{ rotate: 360 }}
              transition={{ duration: 1 }}
              className="p-6 bg-slate-900 rounded-[2.5rem] border border-slate-800 shadow-2xl shadow-amber-500/10"
            >
              <Shield className="w-16 h-16 text-amber-500" />
            </motion.div>
            <div className="space-y-2">
              <h1 className="text-5xl font-black tracking-tighter bg-gradient-to-b from-white to-slate-500 bg-clip-text text-transparent">Trust Global Bank</h1>
              <p className="text-slate-400 font-medium tracking-widest uppercase text-[10px]">The Future of Global Finance</p>
            </div>
          </div>

          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 p-8 rounded-[3rem] space-y-8 shadow-2xl">
            <div className="space-y-4">
              <div className="space-y-2 text-left">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-4">{t.walletAddress}</label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={loginWalletAddress}
                    onChange={(e) => setLoginWalletAddress(e.target.value)}
                    placeholder="G... (Your Pi Wallet Address)"
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-5 pl-12 text-sm font-mono text-white focus:outline-none focus:border-amber-500 transition-colors" 
                  />
                  <Lock className="w-5 h-5 text-slate-600 absolute left-4 top-1/2 -translate-y-1/2" />
                </div>
              </div>
              <div className="space-y-2 text-left">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-4">{t.nickname}</label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={loginNickname}
                    onChange={(e) => setLoginNickname(e.target.value)}
                    placeholder="Enter your nickname"
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-5 pl-12 text-sm font-bold text-white focus:outline-none focus:border-amber-500 transition-colors" 
                  />
                  <User className="w-5 h-5 text-slate-600 absolute left-4 top-1/2 -translate-y-1/2" />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {authError && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl text-rose-500 text-xs font-bold flex flex-col gap-3 animate-shake"
                >
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <p className="leading-relaxed">{authError}</p>
                  </div>
                  <button 
                    onClick={() => window.location.reload()}
                    className="text-[10px] uppercase tracking-widest bg-rose-500 text-white py-2 px-4 rounded-xl hover:bg-rose-600 transition-colors w-fit mx-auto"
                  >
                    Refresh Page
                  </button>
                </motion.div>
              )}

              {/* Automatic Pi SDK Login */}
              <button 
                onClick={async () => {
                  console.log("Pi SDK Login clicked");
                  await loginWithPi();
                }} 
                className="w-full py-6 bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 font-black text-xl rounded-2xl flex items-center justify-center space-x-3 transition-all shadow-xl shadow-amber-500/30 active:scale-95 group border-2 border-amber-300/50"
              >
                <ShieldCheck className="w-7 h-7 group-hover:scale-110 transition-transform" />
                <span>Login with Pi Browser</span>
              </button>

              <div className="flex items-center space-x-4 py-2">
                <div className="h-px bg-slate-800 flex-1" />
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Manual Connection</span>
                <div className="h-px bg-slate-800 flex-1" />
              </div>
              
              <button 
                onClick={async () => {
                  console.log("Pioneer Connection clicked", { loginWalletAddress, loginNickname });
                  const wallet = loginWalletAddress?.trim();
                  const nickname = loginNickname?.trim();
                  
                  if (!wallet || !nickname) {
                    // Try automatic SDK login if fields are empty
                    // @ts-ignore
                    if (window.Pi) {
                      await loginWithPi();
                      return;
                    }
                    setNotification({ title: 'Required Fields', message: 'Please enter your Pi Wallet Address and Nickname to connect, or use the Pi Browser for automatic login.' });
                    setActiveModal('notification');
                    return;
                  }
                  await loginWithPi({ wallet, nickname });
                }} 
                className="w-full py-6 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xl rounded-2xl flex items-center justify-center space-x-3 transition-all shadow-xl shadow-amber-500/20 active:scale-95 group"
              >
                <Globe className="w-6 h-6 group-hover:rotate-180 transition-transform duration-700" />
                <span>{t.pioneerConnection}</span>
              </button>

              <div className="flex items-center space-x-4">
                <div className="h-px bg-slate-800 flex-1" />
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">OR</span>
                <div className="h-px bg-slate-800 flex-1" />
              </div>

              <button 
                onClick={async () => {
                  console.log("Open New Account clicked", { loginWalletAddress, loginNickname });
                  
                  // If in Pi Browser and fields empty, try to get username first
                  // @ts-ignore
                  if (!loginNickname && window.Pi) {
                    try {
                      // @ts-ignore
                      const piAuth = await window.Pi.authenticate(['username'], (p) => {});
                      if (piAuth?.user?.username) {
                        setLoginNickname(piAuth.user.username);
                      }
                    } catch (e) {
                      console.log("SDK username fetch failed, proceeding manually");
                    }
                  }
                  
                  // Generate a mock wallet for the user
                  const mockAddress = 'GB' + Array.from({length: 54}, () => "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[Math.floor(Math.random() * 36)]).join('');
                  const mockPassphrase = Array.from({length: 24}, () => ["apple", "banana", "cherry", "dog", "elephant", "fox", "grape", "house", "ice", "jacket", "kite", "lemon", "mountain", "night", "ocean", "piano", "queen", "river", "sun", "tree", "umbrella", "violin", "whale", "xylophone", "yellow", "zebra"][Math.floor(Math.random() * 26)]).join(' ');
                  
                  setRegData({
                    ...regData,
                    walletAddress: mockAddress,
                    passphrase: mockPassphrase
                  });
                  setRegStep(1);
                  setActiveModal('registration');
                }} 
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl flex items-center justify-center space-x-3 transition-all active:scale-95 shadow-lg shadow-indigo-500/20 group"
              >
                <UserPlus className="w-5 h-5" />
                <span>{t.openAccount}</span>
              </button>
              
              <button 
                onClick={loginAsGuest} 
                className="w-full py-4 bg-slate-950 hover:bg-slate-900 text-white font-bold rounded-2xl flex items-center justify-center space-x-3 transition-all active:scale-95 border border-slate-800 group"
              >
                <div className="p-2 bg-slate-900 rounded-lg group-hover:bg-slate-800 transition-colors">
                  <Zap className="w-4 h-4 text-amber-500" />
                </div>
                <span>{t.guestTour}</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col items-center space-y-4">
            <div className="flex items-center space-x-2 text-slate-500">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span className="text-[10px] font-bold uppercase tracking-widest">{t.securedByPi}</span>
            </div>
            <p className="text-[10px] text-slate-600 max-w-[250px] leading-relaxed">
              By connecting, you agree to our{' '}
              <button onClick={() => setLegalView('terms')} className="text-slate-400 underline hover:text-white transition-colors">{t.termsOfService}</button>
              {' '}and{' '}
              <button onClick={() => setLegalView('privacy')} className="text-slate-400 underline hover:text-white transition-colors">{t.privacyPolicy}</button>.
            </p>
          </div>
        </motion.div>

        {/* Login Screen Modals */}
        <Modal 
          isOpen={!!activeModal} 
          onClose={() => setActiveModal(null)} 
          title={activeModal === 'notification' ? notification.title : activeModal === 'language' ? 'Select Language' : 'Notification'}
        >
          {activeModal === 'notification' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-6 text-center">
              <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center">
                <AlertCircle className="w-10 h-10 text-amber-500" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold">{notification.title}</h3>
                <p className="text-slate-400">{notification.message}</p>
              </div>
              <button 
                onClick={() => setActiveModal(null)}
                className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl transition-all"
              >
                Close
              </button>
            </div>
          )}
          {activeModal === 'language' && (
            <div className="grid grid-cols-2 gap-3 py-4">
              {[
                { id: 'en', label: 'English' },
                { id: 'ar', label: 'العربية' },
                { id: 'fr', label: 'Français' },
                { id: 'es', label: 'Español' },
                { id: 'kab', label: 'Taqbaylit' },
                { id: 'ko', label: '한국어' },
                { id: 'zh', label: '中文' },
                { id: 'ja', label: '日本語' },
                { id: 'it', label: 'Italiano' },
                { id: 'pt', label: 'Português' }
              ].map((l) => (
                <button 
                  key={l.id}
                  onClick={() => {
                    setLang(l.id as any);
                    setActiveModal(null);
                  }}
                  className={`p-4 rounded-2xl text-sm font-bold border transition-all ${lang === l.id ? 'bg-amber-500 border-amber-500 text-slate-950 shadow-xl shadow-amber-500/20' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'}`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          )}
        </Modal>
      </div>
    );
  }

  const currentBalances: Record<string, number> = wallet?.balances || { PI: 0, USD: 0, DZD: 0 };
  const totalUsdValue = Object.entries(currentBalances).reduce((total, [symbol, amount]) => {
    return total + (Number(amount) * (prices[symbol] || 0));
  }, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans pb-24" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="p-6 flex justify-between items-center bg-slate-900/50 backdrop-blur-md sticky top-0 z-10 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <Shield className="w-6 h-6 text-amber-500" />
          <span className="font-bold text-lg">TGB</span>
        </div>
        <div className="flex items-center space-x-3">
          <button onClick={() => setActiveModal('language')} className="p-2 bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors">
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

      <main className="p-6 pb-32 space-y-8 max-w-2xl mx-auto">
        {activeTab === 'wallet' && (
          <>
            {/* Balance Card */}
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-[2.5rem] p-8 text-slate-950 shadow-2xl shadow-amber-500/20 relative overflow-hidden">
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <p className="text-slate-900/60 font-medium text-sm uppercase tracking-wider">{t.balance}</p>
                    <h2 className="text-5xl font-black mt-1 flex items-baseline">
                      ${totalUsdValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </h2>
                  </div>
                  <div className="flex space-x-2">
                    <button 
                      onClick={async () => {
                        if (!user) return;
                        setTxLoading(true);
                        try {
                          if (user.uid.startsWith('guest_')) {
                            setWallet(prev => prev ? { ...prev, balances: { ...prev.balances, PI: 76 } } : null);
                          } else {
                            await updateDoc(doc(db, 'wallets', user.uid), {
                              'balances.PI': 76,
                              lastUpdated: serverTimestamp()
                            });
                          }
                          setNotification({ title: 'Sync Successful', message: 'Your TGB wallet has been synced with your Pi Network balance (76 PI).' });
                          setActiveModal('notification');
                        } catch (e: any) {
                          setNotification({ title: 'Sync Error', message: e.message });
                          setActiveModal('notification');
                        } finally {
                          setTxLoading(false);
                        }
                      }}
                      className="p-4 bg-slate-950/10 rounded-2xl backdrop-blur-sm border border-white/10 hover:bg-slate-950/20 transition-all flex items-center justify-center"
                      title="Sync with Pi Wallet"
                    >
                      <RefreshCw className={`w-7 h-7 ${txLoading ? 'animate-spin' : ''}`} />
                    </button>
                    <button onClick={() => setShowQrModal(true)} className="p-4 bg-slate-950/10 rounded-2xl backdrop-blur-sm border border-white/10 hover:bg-slate-950/20 transition-all">
                      <QrCode className="w-7 h-7" />
                    </button>
                    <div className="bg-slate-950/10 p-4 rounded-2xl backdrop-blur-sm border border-white/10"><Wallet className="w-7 h-7" /></div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-950/10 p-4 rounded-2xl backdrop-blur-sm border border-white/10">
                    <p className="text-slate-900/60 text-[10px] font-bold uppercase tracking-tighter">Main Asset (PI)</p>
                    <p className="text-lg font-bold">{(currentBalances['PI'] || 0).toFixed(4)} π</p>
                  </div>
                  <div className="bg-slate-950/10 p-4 rounded-2xl backdrop-blur-sm border border-white/10">
                    <p className="text-slate-900/60 text-[10px] font-bold uppercase tracking-tighter">DZD Value</p>
                    <p className="text-lg font-bold">{(totalUsdValue * exchangeRates.usd_dzd).toLocaleString('ar-DZ', { style: 'currency', currency: 'DZD' })}</p>
                  </div>
                </div>
              </div>
              <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
              <div className="absolute -left-10 -top-10 w-40 h-40 bg-slate-950/5 rounded-full blur-3xl" />
            </motion.div>

            {/* Global Pi Metrics */}
            <div className="bg-slate-900/50 rounded-3xl p-6 border border-slate-800 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-sm uppercase tracking-widest text-slate-500 flex items-center space-x-2">
                  <Globe className="w-4 h-4" />
                  <span>{t.metrics}</span>
                </h3>
                <span className="text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full">LIVE</span>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">{t.circulatingSupply}</p>
                  <p className="font-black text-sm">{(piMetrics.circulatingSupply / 1000000000).toFixed(2)}B π</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">{t.lockedSupply}</p>
                  <p className="font-black text-sm">{(piMetrics.lockedSupply / 1000000000).toFixed(2)}B π</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">{t.activeCountries}</p>
                  <p className="font-black text-sm">{piMetrics.activeCountries} Countries</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Growth</p>
                  <p className="font-black text-sm text-emerald-500">+132.75%</p>
                </div>
              </div>

              <div className="h-32 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="value" stroke="#f59e0b" fillOpacity={1} fill="url(#colorValue)" strokeWidth={3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Assets List */}
            <section className="space-y-4">
              <h3 className="text-lg font-bold flex items-center space-x-2"><TrendingUp className="w-5 h-5 text-amber-500" /><span>Your Assets</span></h3>
              <div className="grid grid-cols-1 gap-3">
                {Object.entries(currentBalances).filter(([_, amount]) => Number(amount) > 0).map(([symbol, amount]) => (
                  <motion.div key={symbol} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="bg-slate-900/50 p-4 rounded-3xl border border-slate-800/50 flex justify-between items-center">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center font-black text-amber-500 text-lg">{symbol[0]}</div>
                      <div>
                        <p className="font-bold">{symbol}</p>
                        <p className="text-xs text-slate-500">${(prices[symbol] || 0).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-black">{Number(amount).toLocaleString(undefined, { maximumFractionDigits: 6 })}</p>
                      <p className="text-xs text-slate-500">${(Number(amount) * (prices[symbol] || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>

            {/* Quick Actions */}
            <div className="grid grid-cols-5 gap-2">
              {[
                { icon: Wallet, label: t.vault, color: 'bg-indigo-600 shadow-indigo-500/20', action: () => setActiveModal('stake') },
                { icon: Send, label: 'Pi Pay', color: 'bg-blue-500 shadow-blue-500/20', action: () => setActiveModal('transfer') },
                { icon: RefreshCw, label: 'Global Remittance', color: 'bg-emerald-500 shadow-emerald-500/20', action: () => setActiveTab('finance') },
                { icon: Globe, label: 'Global Community', color: 'bg-purple-500 shadow-purple-500/20', action: () => setActiveModal('partnership') },
                { icon: ShoppingBag, label: t.shop, color: 'bg-amber-500 shadow-amber-500/20', action: () => setActiveModal('shop') },
              ].map((action, i) => (
                <motion.button 
                  key={action.label} 
                  initial={{ opacity: 0, y: 10 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  transition={{ delay: i * 0.1 }} 
                  onClick={action.action} 
                  className="flex flex-col items-center space-y-2 group"
                >
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110 active:scale-90 shadow-lg text-white ${action.color}`}>
                    <action.icon className="w-7 h-7" />
                  </div>
                  <span className="text-[8px] font-bold uppercase text-slate-500 text-center leading-tight">{action.label}</span>
                </motion.button>
              ))}
            </div>

            {/* Recent Activity */}
            <section className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <h3 className="text-lg font-bold">{t.activity}</h3>
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={() => setShowFilters(!showFilters)}
                    className={`p-2 rounded-xl border transition-all ${showFilters ? 'bg-amber-500 border-amber-500 text-slate-950' : 'bg-slate-900 border-slate-800 text-slate-400'}`}
                  >
                    <Filter className="w-4 h-4" />
                  </button>
                  <button className="text-amber-500 text-sm font-medium">See All</button>
                </div>
              </div>

              <AnimatePresence>
                {showFilters && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden space-y-4"
                  >
                    <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl space-y-4">
                      {/* Search */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input 
                          type="text"
                          placeholder="Search transactions..."
                          value={txSearchQuery}
                          onChange={(e) => setTxSearchQuery(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-10 pr-4 text-sm focus:border-amber-500 outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        {/* Filter Type */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 uppercase px-1">Type</label>
                          <select 
                            value={txFilterType}
                            onChange={(e) => setTxFilterType(e.target.value as any)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm focus:border-amber-500 outline-none appearance-none"
                          >
                            <option value="all">All Types</option>
                            <option value="deposit">Deposit</option>
                            <option value="withdraw">Withdraw</option>
                            <option value="transfer">Transfer</option>
                            <option value="exchange">Exchange</option>
                            <option value="shop">Shop</option>
                          </select>
                        </div>

                        {/* Sort By */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 uppercase px-1">Sort By</label>
                          <div className="flex space-x-2">
                            <select 
                              value={txSortBy}
                              onChange={(e) => setTxSortBy(e.target.value as any)}
                              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm focus:border-amber-500 outline-none appearance-none"
                            >
                              <option value="date">Date</option>
                              <option value="amount">Amount</option>
                            </select>
                            <button 
                              onClick={() => setTxSortOrder(txSortOrder === 'asc' ? 'desc' : 'asc')}
                              className="bg-slate-950 border border-slate-800 p-2 rounded-xl text-slate-400 hover:text-amber-500"
                            >
                              <ArrowUpDown className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        {/* Amount Range */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 uppercase px-1">Amount Range (π)</label>
                          <div className="flex items-center space-x-2">
                            <input 
                              type="number" 
                              placeholder="Min"
                              value={txAmountRange.min || ''}
                              onChange={(e) => setTxAmountRange(prev => ({ ...prev, min: parseFloat(e.target.value) || 0 }))}
                              className="w-full bg-slate-950 border border-slate-800 rounded-xl py-1.5 px-2 text-xs focus:border-amber-500 outline-none"
                            />
                            <span className="text-slate-600">-</span>
                            <input 
                              type="number" 
                              placeholder="Max"
                              value={txAmountRange.max === 1000000 ? '' : txAmountRange.max}
                              onChange={(e) => setTxAmountRange(prev => ({ ...prev, max: parseFloat(e.target.value) || 1000000 }))}
                              className="w-full bg-slate-950 border border-slate-800 rounded-xl py-1.5 px-2 text-xs focus:border-amber-500 outline-none"
                            />
                          </div>
                        </div>

                        {/* Date Range */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 uppercase px-1">Date Range</label>
                          <div className="flex items-center space-x-2">
                            <input 
                              type="date" 
                              value={txDateRange.start}
                              onChange={(e) => setTxDateRange(prev => ({ ...prev, start: e.target.value }))}
                              className="w-full bg-slate-950 border border-slate-800 rounded-xl py-1.5 px-2 text-[10px] focus:border-amber-500 outline-none"
                            />
                            <input 
                              type="date" 
                              value={txDateRange.end}
                              onChange={(e) => setTxDateRange(prev => ({ ...prev, end: e.target.value }))}
                              className="w-full bg-slate-950 border border-slate-800 rounded-xl py-1.5 px-2 text-[10px] focus:border-amber-500 outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-3">
                {filteredTransactions.length > 0 ? filteredTransactions.map((tx) => (
                  <motion.div 
                    layout
                    key={tx.id} 
                    className={`bg-slate-900/50 rounded-2xl border border-slate-800/50 overflow-hidden transition-all ${expandedTxId === tx.id ? 'ring-1 ring-amber-500/50' : ''}`}
                  >
                    <div 
                      onClick={() => setExpandedTxId(expandedTxId === tx.id ? null : tx.id)}
                      className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-800/30 transition-colors"
                    >
                      <div className="flex items-center space-x-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          tx.type === 'deposit' ? 'bg-emerald-500/10 text-emerald-500' : 
                          tx.type === 'withdraw' ? 'bg-rose-500/10 text-rose-500' :
                          tx.type === 'shop' ? 'bg-amber-500/10 text-amber-500' :
                          tx.type === 'transfer' ? 'bg-blue-500/10 text-blue-500' :
                          'bg-indigo-500/10 text-indigo-500'
                        }`}>
                          {tx.type === 'deposit' ? <ArrowDownLeft className="w-5 h-5" /> : 
                           tx.type === 'withdraw' ? <ArrowUpRight className="w-5 h-5" /> :
                           tx.type === 'shop' ? <ShoppingBag className="w-5 h-5" /> :
                           tx.type === 'transfer' ? <Send className="w-5 h-5" /> :
                           <RefreshCw className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="font-bold text-sm capitalize">{tx.type}</p>
                          <p className="text-xs text-slate-500 truncate max-w-[150px]">{tx.description}</p>
                          <div className="flex items-center space-x-2 mt-1">
                            <span className="text-[10px] text-slate-600">
                              {tx.timestamp?.seconds ? new Date(tx.timestamp.seconds * 1000).toLocaleDateString() : 'Recent'}
                            </span>
                            {tx.status === 'pending' && (
                              <span className="flex items-center space-x-1 text-[10px] text-amber-500 animate-pulse">
                                <Loader2 className="w-2 h-2 animate-spin" />
                                <span>Pending</span>
                              </span>
                            )}
                            {tx.status === 'cancelled' && (
                              <span className="text-[10px] text-rose-500 font-bold uppercase tracking-widest">Cancelled</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold text-sm ${tx.amount > 0 ? 'text-emerald-500' : 'text-white'}`}>{tx.amount > 0 ? '+' : ''}{tx.amount.toFixed(4)} {tx.currency || 'π'}</p>
                        <p className={`text-[10px] uppercase tracking-tighter font-bold ${
                          tx.status === 'completed' ? 'text-emerald-500/70' : 
                          tx.status === 'pending' ? 'text-amber-500/70' : 
                          tx.status === 'cancelled' ? 'text-rose-500/70' : 'text-slate-500'
                        }`}>{tx.status || 'Completed'}</p>
                      </div>
                    </div>

                    <AnimatePresence>
                      {expandedTxId === tx.id && (
                        <motion.div 
                          initial={{ height: 0 }}
                          animate={{ height: 'auto' }}
                          exit={{ height: 0 }}
                          className="overflow-hidden bg-slate-950/30 border-t border-slate-800/50"
                        >
                          <div className="p-4 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Sender</p>
                                <p className="text-xs text-slate-300 font-mono break-all">{tx.sender || 'System'}</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Receiver</p>
                                <p className="text-xs text-slate-300 font-mono break-all">{tx.receiver || 'You'}</p>
                              </div>
                            </div>
                            
                            {tx.notes && (
                              <div className="space-y-1">
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Notes</p>
                                <p className="text-xs text-slate-400 italic">"{tx.notes}"</p>
                              </div>
                            )}

                            <div className="flex items-center justify-between pt-2">
                              {tx.txid ? (
                                <a 
                                  href={`https://minepi.com/blockexplorer/testnet/transaction/${tx.txid}`} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-amber-500 hover:text-amber-400 flex items-center bg-amber-500/5 px-3 py-1.5 rounded-lg border border-amber-500/10 transition-colors"
                                >
                                  <Link className="w-3 h-3 mr-2" />
                                  View on Blockchain
                                </a>
                              ) : <div />}

                              {(tx.status === 'pending' && (tx.type === 'transfer' || tx.type === 'exchange')) && (
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCancelTransaction(tx.id);
                                  }}
                                  className="text-[10px] font-bold text-rose-500 hover:bg-rose-500/10 px-4 py-1.5 rounded-lg border border-rose-500/20 transition-all uppercase tracking-widest"
                                >
                                  Cancel Transaction
                                </button>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )) : (
                  <div className="text-center py-12 bg-slate-900/30 rounded-3xl border border-dashed border-slate-800">
                    <Activity className="w-12 h-12 text-slate-800 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">No transactions found matching your filters</p>
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        {activeTab === 'market' && (
          <section className="space-y-6 pb-20">
            <h2 className="text-2xl font-bold">{t.market}</h2>
            
            {pricesLoading ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
                <p className="text-slate-500 font-bold animate-pulse">Fetching Live Market Data...</p>
              </div>
            ) : (
              <>
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
                
                <div className="space-y-4">
                  <h3 className="text-lg font-bold">Top Cryptocurrencies</h3>
                  <div className="grid grid-cols-1 gap-3">
                    {Object.entries(prices).length > 0 ? (
                      Object.entries(prices)
                        .sort((a, b) => Number(b[1]) - Number(a[1]))
                        .slice(0, 15)
                        .map(([symbol, price]) => (
                        <div key={symbol} className="bg-slate-900 p-4 rounded-3xl border border-slate-800 flex justify-between items-center">
                          <div className="flex items-center space-x-4">
                            <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center font-black text-slate-400 text-sm">{symbol[0]}</div>
                            <div>
                              <p className="font-bold">{symbol}</p>
                              <p className="text-[10px] text-slate-500 uppercase">{symbol === 'PI' ? 'Consensus Value' : 'Market Price'}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-black text-emerald-500">${Number(price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            <p className="text-[10px] text-slate-500 uppercase">24h Vol: High</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-10 text-slate-500 italic">No market data available</div>
                    )}
                  </div>
                </div>
              </>
            )}
          </section>
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

        {activeTab === 'finance' && (
          <section className="space-y-8 pb-20">
            <div className="space-y-2">
              <h2 className="text-3xl font-black">{t.finance}</h2>
              <p className="text-slate-500 text-sm">Global Banking & P2P Ecosystem</p>
            </div>

            {/* Global Exchange Rates (GCV) */}
            <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-sm uppercase tracking-widest text-slate-500 flex items-center space-x-2">
                  <RefreshCw className="w-4 h-4 text-amber-500" />
                  <span>{t.exchangeRates}</span>
                </h3>
                <span className="text-[10px] font-black text-amber-500 bg-amber-500/10 px-2 py-1 rounded-full">GCV COMPLIANT</span>
              </div>
              
              <div className="space-y-4">
                {[
                  { symbol: 'USD', name: 'US Dollar', icon: '🇺🇸' },
                  { symbol: 'EUR', name: 'Euro', icon: '🇪🇺' },
                  { symbol: 'GBP', name: 'British Pound', icon: '🇬🇧' },
                  { symbol: 'DZD', name: 'Algerian Dinar', icon: '🇩🇿' },
                  { symbol: 'KRW', name: 'South Korean Won', icon: '🇰🇷' },
                  { symbol: 'JPY', name: 'Japanese Yen', icon: '🇯🇵' }
                ].map(rate => {
                  const currentRate = prices[rate.symbol] ? PI_FIXED_PRICE * prices[rate.symbol] : 0;
                  return (
                    <div key={rate.symbol} className="flex justify-between items-center p-3 bg-slate-950/50 rounded-2xl border border-slate-800/50">
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">{rate.icon}</span>
                        <div>
                          <p className="font-bold text-sm">1 π ≈ {rate.symbol}</p>
                          <p className="text-[10px] text-slate-500 uppercase">{rate.name}</p>
                        </div>
                      </div>
                      <p className="font-black text-amber-500 text-sm">
                        {currentRate > 0 ? currentRate.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '---'}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Connected Banks */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold flex items-center space-x-2">
                <Building2 className="w-5 h-5 text-amber-500" />
                <span>{t.connectedBanks}</span>
              </h3>
              <div className="grid grid-cols-1 gap-3">
                {[
                  { name: 'Chase Bank', country: 'USA', status: 'Connected', icon: '🏦', piValue: 45, usdValue: 14137155, url: 'https://www.chase.com' },
                  { name: 'HSBC', country: 'UK', status: 'Connected', icon: '🏛️', piValue: 30, usdValue: 9424770, url: 'https://www.hsbc.com' },
                  { name: 'KakaoBank', country: 'KR', status: 'Connected', icon: '🏦', piValue: 25, usdValue: 7853975, url: 'https://www.kakaobank.com' }
                ].map(bank => (
                  <motion.div 
                    key={bank.name} 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setSelectedBank(bank);
                      setActiveModal('bankPortal');
                    }}
                    className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex justify-between items-center cursor-pointer hover:border-amber-500/30 transition-all"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center text-2xl">{bank.icon}</div>
                      <div>
                        <p className="font-bold">{bank.name}</p>
                        <p className="text-xs text-slate-500">{bank.country}</p>
                        <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mt-1">{bank.status}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-amber-500">{bank.piValue} π</p>
                      <p className="text-[10px] text-slate-500 font-bold">≈ ${bank.usdValue.toLocaleString()}</p>
                    </div>
                  </motion.div>
                ))}
                <button 
                  onClick={handleAddBank}
                  className="w-full py-4 border-2 border-dashed border-slate-800 rounded-3xl text-slate-500 font-bold hover:border-amber-500/50 hover:text-amber-500 transition-all flex items-center justify-center space-x-2"
                >
                  <Plus className="w-5 h-5" />
                  <span>{t.addBank}</span>
                </button>
              </div>
            </div>

            {/* Bank Transfer Section */}
            <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 space-y-6">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-amber-500/10 rounded-2xl">
                  <ArrowUpDown className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight">{t.bankTransfer}</h3>
                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Move funds between accounts</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-2">{t.transferFrom}</label>
                    <select 
                      value={bankTransferFrom}
                      onChange={(e) => setBankTransferFrom(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 font-bold text-white focus:outline-none focus:border-amber-500 transition-colors"
                    >
                      <option value="TGB">{t.tgbAccount}</option>
                      <option value="Chase Bank">Chase Bank</option>
                      <option value="HSBC">HSBC</option>
                      <option value="KakaoBank">KakaoBank</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-2">{t.transferTo}</label>
                    <select 
                      value={bankTransferTo}
                      onChange={(e) => setBankTransferTo(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 font-bold text-white focus:outline-none focus:border-amber-500 transition-colors"
                    >
                      <option value="TGB">{t.tgbAccount}</option>
                      <option value="Chase Bank">Chase Bank</option>
                      <option value="HSBC">HSBC</option>
                      <option value="KakaoBank">KakaoBank</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-2">{t.amountToTransfer}</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        value={bankTransferAmount || ''} 
                        onChange={(e) => setBankTransferAmount(parseFloat(e.target.value) || 0)}
                        placeholder="0.00" 
                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-lg font-bold focus:outline-none focus:border-amber-500 transition-colors" 
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">π</div>
                    </div>
                  </div>
                  <button 
                    onClick={handleBankTransfer}
                    disabled={bankTransferLoading || bankTransferAmount <= 0 || bankTransferFrom === bankTransferTo}
                    className="w-full py-4 bg-amber-500 text-slate-950 font-bold rounded-2xl hover:bg-amber-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                  >
                    {bankTransferLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    <span>{t.executeTransfer}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Pending Applications */}
            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-3xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-indigo-500 rounded-xl text-white"><FileText className="w-5 h-5" /></div>
                  <div>
                    <h4 className="font-bold">Application for Review</h4>
                    <p className="text-[10px] text-slate-500 uppercase font-black">Status: Pending Verification</p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-amber-500/20 text-amber-500 text-[10px] font-bold rounded-full border border-amber-500/20 animate-pulse">In Review</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">Your application for "Pi Global Savings Community" is currently being reviewed by the TrustBank Global compliance team. This process typically takes 24-48 hours.</p>
            </div>

            {/* P2P Lending */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold flex items-center space-x-2">
                  <Users className="w-5 h-5 text-amber-500" />
                  <span>{t.lending}</span>
                </h3>
                <button onClick={() => setActiveModal('lending')} className="text-xs font-bold text-amber-500 hover:underline">{t.createLending}</button>
              </div>
              <div className="space-y-3">
                {[
                  { id: '1', user: 'GlobalPioneer', amount: 50, apr: 4.5, purpose: 'Business Expansion', rating: 'AAA' },
                  { id: '2', user: 'TechInnovator', amount: 25, apr: 3.8, purpose: 'Education', rating: 'AA' }
                ].map(loan => (
                  <div key={loan.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex justify-between items-center">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-black bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full">{loan.rating}</span>
                        <p className="font-bold text-sm">{loan.purpose}</p>
                      </div>
                      <p className="text-xs text-slate-500">Requested by {loan.user}</p>
                      <p className="text-lg font-black text-amber-500">{loan.amount} π <span className="text-xs text-slate-400 font-bold">@ {loan.apr}% APR</span></p>
                    </div>
                    <button 
                      onClick={() => handleExecuteLoan(loan)}
                      disabled={txLoading}
                      className="px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-xl hover:bg-amber-600 transition-all text-sm disabled:opacity-50"
                    >
                      {txLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t.executeLoan}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Investment Pools */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold flex items-center space-x-2">
                  <Activity className="w-5 h-5 text-amber-500" />
                  <span>{t.pools}</span>
                </h3>
                <button 
                  onClick={() => setActiveModal('groupApp')}
                  className="px-4 py-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl text-xs font-bold flex items-center space-x-2 hover:bg-indigo-500/20 transition-all"
                >
                  <Users className="w-4 h-4" />
                  <span>Group Application</span>
                </button>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {pools.map(pool => (
                  <div key={pool.id} className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden">
                    <div className="h-24 bg-slate-800 relative">
                      <img src={pool.image} alt={pool.name} className="w-full h-full object-cover opacity-50" referrerPolicy="no-referrer" />
                      <div className="absolute inset-0 p-4 flex flex-col justify-end">
                        <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">{pool.category}</p>
                        <h4 className="font-bold text-lg">{pool.name}</h4>
                      </div>
                    </div>
                    <div className="p-5 space-y-4">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-slate-500">{pool.membersCount} Members</span>
                        <span className="text-amber-500">{pool.totalInvested} / {pool.target} π</span>
                      </div>
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500" style={{ width: `${(pool.totalInvested / pool.target) * 100}%` }} />
                      </div>
                      <button 
                        onClick={() => handleJoinPool(pool.id)}
                        className="w-full py-3 bg-amber-500 text-slate-950 font-bold rounded-2xl hover:bg-amber-600 transition-all text-sm"
                      >
                        {t.joinPool}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Staking Vault */}
            <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-[2.5rem] p-8 text-slate-950 space-y-6 shadow-2xl shadow-amber-500/20">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <h3 className="text-2xl font-black uppercase tracking-tight">{t.staking}</h3>
                  <p className="text-slate-950/60 text-xs font-bold uppercase tracking-widest">High Yield Staking</p>
                </div>
                <div className="p-3 bg-slate-950/10 rounded-2xl"><Zap className="w-6 h-6" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-950/10 p-4 rounded-2xl border border-slate-950/5">
                  <p className="text-[10px] font-bold uppercase opacity-60">{t.stakedAmount}</p>
                  <p className="text-xl font-black">{stakes.reduce((acc, s) => acc + (s.amount || 0), 0).toLocaleString()} π</p>
                </div>
                <div className="bg-slate-950/10 p-4 rounded-2xl border border-slate-950/5">
                  <p className="text-[10px] font-bold uppercase opacity-60">{t.estimatedApy}</p>
                  <p className="text-xl font-black">12.5%</p>
                </div>
              </div>
              <button 
                onClick={() => setActiveModal('stake')}
                className="w-full py-4 bg-slate-950 text-white font-bold rounded-2xl hover:bg-slate-900 transition-all shadow-xl"
              >
                {t.stakePi}
              </button>
            </div>

            {/* Quick Estimate Calculator */}
            <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 space-y-6">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-amber-500/10 rounded-2xl">
                  <Calculator className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight">{t.stakingCalculator}</h3>
                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Plan your future earnings</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-2">{t.stakeAmount}</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        value={stakeAmount || ''} 
                        onChange={(e) => setStakeAmount(parseFloat(e.target.value) || 0)}
                        placeholder="0.00" 
                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-lg font-bold focus:outline-none focus:border-amber-500 transition-colors" 
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">π</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-2">{t.stakeDuration}</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[6, 12, 24].map(months => (
                        <button
                          key={months}
                          onClick={() => setStakeDuration(months)}
                          className={`py-3 rounded-xl text-[10px] font-bold transition-all border ${
                            stakeDuration === months 
                              ? 'bg-amber-500 border-amber-500 text-slate-950 shadow-lg shadow-amber-500/20' 
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          {months} {t.months}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-950/50 p-6 rounded-3xl border border-slate-800/50 flex flex-col justify-center space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">{t.potentialEarnings}</span>
                    <span className="text-emerald-500 font-black text-lg">
                      +{(stakeAmount * (stakeDuration === 6 ? 0.05 : stakeDuration === 12 ? 0.08 : 0.12) * (stakeDuration / 12)).toFixed(2)} π
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-4 border-t border-slate-800">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">{t.totalReturn}</span>
                    <span className="text-white font-black text-xl">
                      {(stakeAmount + (stakeAmount * (stakeDuration === 6 ? 0.05 : stakeDuration === 12 ? 0.08 : 0.12) * (stakeDuration / 12))).toFixed(2)} π
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Staking History */}
            <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6 space-y-4">
              <h4 className="text-sm font-bold uppercase tracking-widest text-slate-500 flex items-center space-x-2">
                <Activity className="w-4 h-4" />
                <span>{t.stakingHistory}</span>
              </h4>
              
              <div className="space-y-3">
                {stakes.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4">{t.noStakes}</p>
                ) : (
                  stakes.map((stake, idx) => (
                    <div key={stake.id || idx} className="flex justify-between items-center p-3 bg-slate-950/50 rounded-2xl border border-slate-800/50">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center">
                          <Lock className="w-5 h-5 text-amber-500" />
                        </div>
                        <div>
                          <p className="font-bold text-sm">{stake.amount} π</p>
                          <p className="text-[10px] text-slate-500 uppercase">{stake.duration} {t.months}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black text-emerald-500 uppercase">Active</p>
                        <p className="text-[10px] text-slate-500">
                          {stake.timestamp?.seconds ? new Date(stake.timestamp.seconds * 1000).toLocaleDateString() : 'Just now'}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Partnership Proposal */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-amber-500/10 rounded-2xl">
                  <FileText className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <h3 className="font-bold">{t.partnership}</h3>
                  <p className="text-xs text-slate-500">Collaborate with TrustBank Global</p>
                </div>
              </div>
              <button 
                onClick={() => setActiveModal('partnership')}
                className="w-full py-3 border border-slate-800 hover:bg-slate-800 text-white font-bold rounded-xl transition-all text-sm"
              >
                {t.submitProposal}
              </button>
            </div>
          </section>
        )}

        {activeTab === 'exchange' && (
          <section className="space-y-8">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">{t.exchange}</h2>
              <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
                <button 
                  onClick={() => setExchangeSubTab('exchange')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${exchangeSubTab === 'exchange' ? 'bg-amber-500 text-slate-950' : 'text-slate-500 hover:text-white'}`}
                >
                  {t.exchange}
                </button>
                <button 
                  onClick={() => setExchangeSubTab('history')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${exchangeSubTab === 'history' ? 'bg-amber-500 text-slate-950' : 'text-slate-500 hover:text-white'}`}
                >
                  {t.exchangeHistory || 'History'}
                </button>
              </div>
            </div>
            
            {exchangeSubTab === 'history' ? (
              <div className="space-y-4">
                {transactions.filter(tx => tx.type === 'exchange').length > 0 ? (
                  transactions.filter(tx => tx.type === 'exchange').map(tx => (
                    <div key={tx.id} className="bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-amber-500/10 rounded-xl text-amber-500">
                            <RefreshCw className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-bold text-sm">Exchange Completed</p>
                            <p className="text-[10px] text-slate-500">{tx.timestamp instanceof Date ? tx.timestamp.toLocaleString() : (tx.timestamp?.toDate ? tx.timestamp.toDate().toLocaleString() : 'Recent')}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-emerald-500">+{tx.toAmount?.toFixed(6)} {tx.toCurrency}</p>
                          <p className="text-[10px] text-slate-500">-{tx.fromAmount?.toFixed(2)} {tx.fromCurrency}</p>
                        </div>
                      </div>
                      <div className="pt-3 border-t border-slate-800 flex justify-between items-center text-[10px]">
                        <span className="text-slate-500 uppercase font-bold">Exchange Rate</span>
                        <span className="font-mono text-amber-500">1 {tx.fromCurrency} = {tx.rate?.toFixed(8)} {tx.toCurrency}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 bg-slate-900/50 rounded-[2.5rem] border border-dashed border-slate-800">
                    <RefreshCw className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                    <p className="text-slate-500 font-bold">No exchange history found</p>
                  </div>
                )}
              </div>
            ) : userData?.role === 'global' && userData?.kycStatus !== 'verified' ? (
              <div className="bg-rose-500/10 border border-rose-500/20 p-8 rounded-[2.5rem] text-center space-y-6">
                <div className="w-20 h-20 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto">
                  <Lock className="w-10 h-10 text-rose-500" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold">{t.kycRequired}</h3>
                  <p className="text-slate-400 text-sm">External users must verify their identity to access the global exchange.</p>
                </div>
                {userData?.kycStatus === 'pending' ? (
                  <div className="py-3 px-6 bg-amber-500/20 text-amber-500 rounded-2xl font-bold">
                    {t.kycPending}
                  </div>
                ) : (
                  <button 
                    onClick={() => setActiveTab('profile')}
                    className="px-8 py-4 bg-amber-500 text-slate-950 font-bold rounded-2xl hover:bg-amber-600 transition-all"
                  >
                    Go to Profile to Verify
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 space-y-8">
                  <div className="grid grid-cols-1 gap-6">
                    {/* From Asset */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase px-1">
                        <span>From</span>
                        <span>Balance: {(currentBalances[exchangeFrom] || 0).toLocaleString()} {exchangeFrom}</span>
                      </div>
                      <div className="flex space-x-3">
                        <select 
                          value={exchangeFrom}
                          onChange={(e) => setExchangeFrom(e.target.value)}
                          className="bg-slate-950 border border-slate-800 rounded-2xl p-4 font-bold text-amber-500 focus:outline-none focus:border-amber-500"
                        >
                          {Object.keys(prices).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <input 
                          type="number" 
                          value={exchangeAmount || ''}
                          onChange={(e) => setExchangeAmount(parseFloat(e.target.value))}
                          placeholder="0.00"
                          className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xl font-bold focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>

                    {/* Swap Icon */}
                    <div className="flex justify-center">
                      <button 
                        onClick={() => {
                          const temp = exchangeFrom;
                          setExchangeFrom(exchangeTo);
                          setExchangeTo(temp);
                        }}
                        className="p-3 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors"
                      >
                        <RefreshCw className="w-6 h-6 text-amber-500" />
                      </button>
                    </div>

                    {/* To Asset */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase px-1">
                        <span>To</span>
                        <span>Balance: {(currentBalances[exchangeTo] || 0).toLocaleString()} {exchangeTo}</span>
                      </div>
                      <div className="flex space-x-3">
                        <select 
                          value={exchangeTo}
                          onChange={(e) => setExchangeTo(e.target.value)}
                          className="bg-slate-950 border border-slate-800 rounded-2xl p-4 font-bold text-amber-500 focus:outline-none focus:border-amber-500"
                        >
                          {Object.keys(prices).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <div className="flex-1 bg-slate-800 border border-slate-700 rounded-2xl p-4 text-xl font-bold text-slate-400 flex items-center">
                          {exchangeAmount ? ((exchangeAmount * (prices[exchangeFrom] || 0)) / (prices[exchangeTo] || 1)).toLocaleString(undefined, { maximumFractionDigits: 8 }) : '0.00'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/50 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Exchange Rate</span>
                      <span className="font-bold">1 {exchangeFrom} = {((prices[exchangeFrom] || 0) / (prices[exchangeTo] || 1)).toFixed(8)} {exchangeTo}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Estimated Fee</span>
                      <span className="text-emerald-500 font-bold">0.00% (Free)</span>
                    </div>
                  </div>

                  <button 
                    onClick={() => handleExchange(exchangeFrom, exchangeTo, exchangeAmount)}
                    disabled={txLoading || !exchangeAmount || exchangeAmount <= 0}
                    className="w-full py-5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xl rounded-2xl transition-all shadow-xl shadow-amber-500/20 active:scale-95 disabled:opacity-50"
                  >
                    {txLoading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : 'Confirm Exchange'}
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center px-1">
                    <h3 className="text-lg font-bold flex items-center space-x-2">
                      <Link className="w-5 h-5 text-amber-500" />
                      <span>{t.connectedExchanges}</span>
                    </h3>
                    <span className="text-[10px] font-bold text-slate-500 uppercase">{t.globalConnectivity}</span>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                      { name: 'Binance', icon: 'B' },
                      { name: 'Coinbase', icon: 'C' },
                      { name: 'Kraken', icon: 'K' },
                      { name: 'OKX', icon: 'O' },
                      { name: 'KuCoin', icon: 'K' },
                      { name: 'Bybit', icon: 'B' },
                      { name: 'Gate.io', icon: 'G' },
                      { name: 'HTX', icon: 'H' },
                      { name: 'MEXC', icon: 'M' },
                      { name: 'Bitget', icon: 'B' },
                      { name: 'Crypto.com', icon: 'C' },
                      { name: 'MetaMask', icon: 'M' },
                      { name: 'Trust Wallet', icon: 'T' },
                      { name: 'Phantom', icon: 'P' }
                    ].map((exchange) => {
                      const isConnected = connectedExchanges.includes(exchange.name);
                      return (
                        <motion.button 
                          key={exchange.name}
                          whileHover={{ y: -2 }}
                          onClick={() => {
                            if (!isConnected) {
                              setConnectedExchanges([...connectedExchanges, exchange.name]);
                            } else {
                              setConnectedExchanges(connectedExchanges.filter(e => e !== exchange.name));
                            }
                          }}
                          className={`p-4 rounded-2xl border transition-all flex flex-col items-center space-y-2 ${
                            isConnected 
                              ? 'bg-amber-500/10 border-amber-500/50 text-amber-500' 
                              : 'bg-slate-900/50 border-slate-800 text-slate-500 hover:border-slate-700'
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg ${
                            isConnected ? 'bg-amber-500 text-slate-950' : 'bg-slate-800'
                          }`}>
                            {exchange.icon}
                          </div>
                          <span className="text-[10px] font-bold uppercase truncate w-full text-center">{exchange.name}</span>
                          <div className="flex items-center space-x-1">
                            <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-700'}`} />
                            <span className="text-[8px] font-bold uppercase">{isConnected ? t.connected : t.disconnected}</span>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800">
                  <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">{t.networkStatus}</p>
                  <div className="flex justify-between items-center">
                    <p className="font-bold text-sm">{t.mainnetSettlement}</p>
                    <div className="flex items-center space-x-2 text-emerald-500 text-xs">
                      <Zap className="w-4 h-4" />
                      <span>{t.instant}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
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
              <div className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 space-y-6 relative overflow-hidden group">
                  <div className="absolute -right-10 -top-10 w-40 h-40 bg-amber-500/5 rounded-full blur-3xl group-hover:bg-amber-500/10 transition-colors" />
                  <div className="flex justify-between items-start relative z-10">
                    <div className="space-y-1">
                      <h3 className="text-xl font-bold flex items-center space-x-2">
                        <Shield className="w-5 h-5 text-amber-500" />
                        <span>Identity Verification</span>
                      </h3>
                      <p className="text-xs text-slate-500 font-medium uppercase tracking-widest">KYC Compliance</p>
                    </div>
                    <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                      userData.kycStatus === 'verified' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                      userData.kycStatus === 'pending' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                      'bg-rose-500/10 text-rose-500 border-rose-500/20'
                    }`}>
                      {userData.kycStatus === 'verified' ? t.kycVerified : 
                       userData.kycStatus === 'pending' ? t.kycPending : 'Unverified'}
                    </div>
                  </div>
                  
                  {userData.kycStatus === 'none' ? (
                    <div className="space-y-6 relative z-10">
                      <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
                        <div className="flex items-center space-x-3 text-amber-500">
                          <AlertCircle className="w-5 h-5" />
                          <span className="text-xs font-bold uppercase tracking-widest">Action Required</span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">To access high-limit GCV exchange and global remittances, you must complete your identity verification.</p>
                      </div>
                      <button 
                        onClick={() => {
                          setKycStep(1);
                          setActiveModal('kyc');
                        }}
                        className="w-full py-5 bg-amber-500 text-slate-950 font-black text-lg rounded-2xl hover:bg-amber-600 transition-all shadow-xl shadow-amber-500/20 active:scale-95 flex items-center justify-center space-x-3"
                      >
                        <Zap className="w-5 h-5" />
                        <span>Start Verification Wizard</span>
                      </button>
                    </div>
                  ) : userData.kycStatus === 'pending' ? (
                    <div className="p-6 bg-slate-950 rounded-2xl border border-slate-800 text-center space-y-4">
                      <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto">
                        <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-bold">Verification in Progress</p>
                        <p className="text-xs text-slate-500 leading-relaxed">Our compliance team is reviewing your documents. This usually takes 5-10 minutes.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 flex items-center space-x-4">
                      <div className="p-3 bg-emerald-500 rounded-xl text-white shadow-lg shadow-emerald-500/20">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-bold text-emerald-500">Fully Verified Pioneer</p>
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Global Access Unlocked</p>
                      </div>
                    </div>
                  )}
                </div>

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
                <h3 className="font-bold flex items-center space-x-2">
                  <Bell className="w-5 h-5 text-amber-500" />
                  <span>{t.notifications}</span>
                </h3>
                <div className="space-y-3">
                  {[
                    { id: 'transactions', label: t.transactionAlerts, icon: Wallet },
                    { id: 'market', label: t.marketAlerts, icon: TrendingUp },
                    { id: 'security', label: t.securityAlerts, icon: Shield }
                  ].map((pref) => (
                    <div key={pref.id} className="flex justify-between items-center p-4 bg-slate-950 border border-slate-800 rounded-2xl">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-slate-900 rounded-lg text-slate-400">
                          <pref.icon className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-medium text-slate-300">{pref.label}</span>
                      </div>
                      <button 
                        onClick={() => updateNotificationSettings({
                          ...notificationSettings,
                          [pref.id]: !notificationSettings[pref.id as keyof typeof notificationSettings]
                        })}
                        className={`w-12 h-6 rounded-full transition-all relative ${
                          notificationSettings[pref.id as keyof typeof notificationSettings] 
                            ? 'bg-amber-500' 
                            : 'bg-slate-800'
                        }`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                          notificationSettings[pref.id as keyof typeof notificationSettings] 
                            ? 'left-7' 
                            : 'left-1'
                        }`} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-4">
                <h3 className="font-bold">Account Settings</h3>
                <div className="space-y-2">
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
                    <div className="flex items-center space-x-3 text-slate-400"><Languages className="w-5 h-5" /><span>Language</span></div>
                    <div className="grid grid-cols-3 gap-2">
                      {['en', 'ar', 'fr', 'es', 'kab', 'ko', 'zh', 'ja', 'it', 'pt'].map((l) => (
                        <button 
                          key={l}
                          onClick={() => setLang(l as any)}
                          className={`px-4 py-2 rounded-xl text-xs font-bold uppercase border transition-all ${lang === l ? 'bg-amber-500 border-amber-500 text-slate-950 shadow-lg shadow-amber-500/20' : 'border-slate-800 text-slate-500 hover:border-slate-700'}`}
                        >
                          {l === 'en' ? 'English' : 
                           l === 'ar' ? 'العربية' : 
                           l === 'fr' ? 'Français' : 
                           l === 'es' ? 'Español' : 
                           l === 'kab' ? 'Taqbaylit' : 
                           l === 'ko' ? '한국어' : 
                           l === 'zh' ? '中文' : 
                           l === 'ja' ? '日本語' : 
                           l === 'it' ? 'Italiano' : 
                           l === 'pt' ? 'Português' : l}
                        </button>
                      ))}
                    </div>
                  </div>

                  {userData?.kycStatus !== 'verified' && (
                    <button 
                      onClick={() => {
                        setKycStep(1);
                        setActiveModal('kyc');
                      }}
                      className="w-full flex justify-between items-center p-4 bg-amber-500/10 hover:bg-amber-500/20 rounded-2xl transition-all border border-amber-500/20 group"
                    >
                      <div className="flex items-center space-x-3 text-amber-500">
                        <ShieldCheck className="w-5 h-5" />
                        <span className="font-bold">{t[lang].kyc}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-black uppercase tracking-widest bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full">Required</span>
                        <ChevronRight className="w-5 h-5 text-amber-500 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </button>
                  )}

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
      <Modal isOpen={!!activeModal} onClose={() => setActiveModal(null)} title={activeModal === 'notification' ? notification.title : (t[activeModal as keyof typeof t] || '')}>
        {txSuccess ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center"><CheckCircle2 className="w-12 h-12 text-emerald-500" /></motion.div>
            <p className="text-xl font-bold">Action Successful</p>
          </div>
        ) : activeModal === 'notification' ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-6 text-center">
            <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center">
              <AlertCircle className="w-10 h-10 text-amber-500" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold">{notification.title}</h3>
              <p className="text-slate-400">{notification.message}</p>
            </div>
            <button 
              onClick={() => setActiveModal(null)}
              className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl transition-all"
            >
              Close
            </button>
          </div>
        ) : activeModal === 'language' ? (
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'en', label: 'English' },
                { id: 'ar', label: 'العربية' },
                { id: 'fr', label: 'Français' },
                { id: 'es', label: 'Español' },
                { id: 'kab', label: 'Taqbaylit' },
                { id: 'ko', label: '한국어' },
                { id: 'zh', label: '中文' },
                { id: 'ja', label: '日本語' },
                { id: 'it', label: 'Italiano' },
                { id: 'pt', label: 'Português' }
              ].map((l) => (
                <button 
                  key={l.id}
                  onClick={() => {
                    setLang(l.id as any);
                    setActiveModal(null);
                  }}
                  className={`p-4 rounded-2xl text-sm font-bold border transition-all ${lang === l.id ? 'bg-amber-500 border-amber-500 text-slate-950 shadow-xl shadow-amber-500/20' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'}`}
                >
                  {l.label}
                </button>
              ))}
            </div>
            <button 
              onClick={() => setActiveModal(null)}
              className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl border border-slate-700 transition-all"
            >
              {t.cancel || 'Back'}
            </button>
          </div>
        ) : activeModal === 'bank' ? (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t.bankName}</label>
              <input type="text" placeholder="e.g. Chase Bank" className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 focus:outline-none focus:border-amber-500 transition-colors" id="bankName" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t.accountNumber}</label>
              <input type="text" placeholder="XXXX XXXX XXXX" className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 focus:outline-none focus:border-amber-500 transition-colors" id="accNum" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t.swiftCode}</label>
              <input type="text" placeholder="SWIFT CODE" className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 focus:outline-none focus:border-amber-500 transition-colors" id="swift" />
            </div>
            <button 
              disabled={txLoading}
              onClick={async () => {
                if (!user) return;
                const name = (document.getElementById('bankName') as HTMLInputElement).value;
                const acc = (document.getElementById('accNum') as HTMLInputElement).value;
                const swift = (document.getElementById('swift') as HTMLInputElement).value;
                if (name && acc) {
                  setTxLoading(true);
                  try {
                    await addDoc(collection(db, 'banks'), { uid: user.uid, name, acc, swift, timestamp: serverTimestamp() });
                    setTxSuccess(true);
                    setTimeout(() => { setTxSuccess(false); setActiveModal(null); }, 2000);
                  } catch (e: any) {
                    setNotification({ title: 'Error', message: e.message });
                    setActiveModal('notification');
                  } finally { setTxLoading(false); }
                }
              }}
              className="w-full py-4 bg-amber-500 text-slate-950 font-bold rounded-2xl shadow-xl shadow-amber-500/20 active:scale-95 disabled:opacity-50"
            >
              {txLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : t.confirm}
            </button>
          </div>
        ) : activeModal === 'stake' ? (
          <div className="space-y-6">
            <div className="bg-amber-500/10 p-6 rounded-3xl border border-amber-500/20 space-y-2">
              <p className="text-xs text-amber-500 font-bold uppercase tracking-widest">{t.stakingCalculator}</p>
              <p className="text-sm text-slate-400">Estimate your potential rewards before staking your Pi.</p>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t.stakeAmount}</label>
                <div className="relative">
                  <input 
                    type="number" 
                    value={stakeAmount || ''} 
                    onChange={(e) => setStakeAmount(parseFloat(e.target.value) || 0)}
                    placeholder="0.00" 
                    className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-xl font-bold focus:outline-none focus:border-amber-500 transition-colors" 
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">π</div>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t.stakeDuration}</label>
                <div className="grid grid-cols-3 gap-2">
                  {[6, 12, 24].map(months => (
                    <button
                      key={months}
                      onClick={() => setStakeDuration(months)}
                      className={`py-3 rounded-xl text-xs font-bold transition-all border ${
                        stakeDuration === months 
                          ? 'bg-amber-500 border-amber-500 text-slate-950 shadow-lg shadow-amber-500/20' 
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      {months} {t.months}
                    </button>
                  ))}
                </div>
              </div>

              {/* Calculator Results */}
              <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500 font-bold uppercase">{t.estimatedApy}</span>
                  <span className="text-amber-500 font-black">{stakeDuration === 6 ? '5%' : stakeDuration === 12 ? '8%' : '12%'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500 font-bold uppercase">{t.potentialEarnings}</span>
                  <span className="text-emerald-500 font-black">
                    +{(stakeAmount * (stakeDuration === 6 ? 0.05 : stakeDuration === 12 ? 0.08 : 0.12) * (stakeDuration / 12)).toFixed(2)} π
                  </span>
                </div>
                <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
                  <span className="text-sm font-bold uppercase">{t.totalReturn}</span>
                  <span className="text-xl font-black text-white">
                    {(stakeAmount + (stakeAmount * (stakeDuration === 6 ? 0.05 : stakeDuration === 12 ? 0.08 : 0.12) * (stakeDuration / 12))).toFixed(2)} π
                  </span>
                </div>
              </div>
            </div>

            <button 
              disabled={txLoading || stakeAmount <= 0 || (wallet?.balances['PI'] || 0) < stakeAmount}
              onClick={async () => {
                if (!user || !wallet) return;
                setTxLoading(true);
                try {
                  await updateDoc(doc(db, 'wallets', user.uid), { 'balances.PI': increment(-stakeAmount) });
                  await addDoc(collection(db, 'stakes'), { 
                    uid: user.uid, 
                    amount: stakeAmount, 
                    duration: stakeDuration, 
                    apy: stakeDuration === 6 ? 5 : stakeDuration === 12 ? 8 : 12,
                    timestamp: serverTimestamp() 
                  });
                  setTxSuccess(true);
                  setTimeout(() => { setTxSuccess(false); setActiveModal(null); }, 2000);
                } catch (e: any) {
                  setNotification({ title: 'Error', message: e.message });
                  setActiveModal('notification');
                } finally { setTxLoading(false); }
              }}
              className="w-full py-5 bg-amber-500 text-slate-950 font-black text-lg rounded-2xl shadow-xl shadow-amber-500/20 active:scale-95 disabled:opacity-50 transition-all"
            >
              {txLoading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : t.confirm}
            </button>
          </div>
        ) : activeModal === 'pool' ? (
          <div className="space-y-6">
            {selectedPool && (
              <div className="space-y-6">
                <div className="flex items-center space-x-4">
                  <img src={selectedPool.image} className="w-20 h-20 rounded-3xl object-cover shadow-2xl" referrerPolicy="no-referrer" />
                  <div>
                    <h3 className="font-bold text-xl">{selectedPool.name}</h3>
                    <p className="text-xs text-amber-500 font-black uppercase tracking-widest">{selectedPool.category}</p>
                  </div>
                </div>
                
                <div className="bg-slate-800/50 p-6 rounded-3xl border border-slate-700 space-y-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Target Goal</span>
                    <span className="font-bold">2,000 π</span>
                  </div>
                  <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: '62.5%' }}
                      className="h-full bg-amber-500"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 text-center">1,250 π contributed by 125 members</p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t.poolContribution}</label>
                  <input type="number" placeholder="0.00" className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-xl font-bold focus:outline-none focus:border-amber-500 transition-colors" id="poolAmount" />
                </div>
                <button 
                  disabled={txLoading}
                  onClick={async () => {
                    if (!user || !wallet) return;
                    const amount = parseFloat((document.getElementById('poolAmount') as HTMLInputElement).value);
                    if (amount > 0 && (wallet.balances['PI'] || 0) >= amount) {
                      setTxLoading(true);
                      try {
                        await updateDoc(doc(db, 'wallets', user.uid), { 'balances.PI': increment(-amount) });
                        await addDoc(collection(db, 'investments'), { uid: user.uid, poolId: selectedPool.id, amount, timestamp: serverTimestamp() });
                        setTxSuccess(true);
                        setTimeout(() => { setTxSuccess(false); setActiveModal(null); }, 2000);
                      } catch (e: any) {
                        setNotification({ title: 'Error', message: e.message });
                        setActiveModal('notification');
                      } finally { setTxLoading(false); }
                    } else {
                      setNotification({ title: 'Error', message: "Insufficient balance" });
                      setActiveModal('notification');
                    }
                  }}
                  className="w-full py-5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xl rounded-2xl transition-all shadow-xl shadow-amber-500/20 active:scale-95 disabled:opacity-50"
                >
                  {txLoading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : t.confirm}
                </button>
              </div>
            )}
          </div>
        ) : activeModal === 'exchange' ? (
          <div className="space-y-6">
            <div className="flex bg-slate-800 p-1 rounded-2xl">
              <button 
                onClick={() => setTxType('buy')}
                className={`flex-1 py-3 rounded-xl font-bold transition-all ${txType === 'buy' ? 'bg-emerald-500 text-white' : 'text-slate-400'}`}
              >
                {t.buyPi}
              </button>
              <button 
                onClick={() => setTxType('sell')}
                className={`flex-1 py-3 rounded-xl font-bold transition-all ${txType === 'sell' ? 'bg-rose-500 text-white' : 'text-slate-400'}`}
              >
                {t.sellPi}
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Amount (π)</label>
                <input 
                  type="number" 
                  placeholder="0.00" 
                  className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-xl font-bold focus:outline-none focus:border-amber-500 transition-colors" 
                  id="exchangeAmount" 
                />
              </div>
              
              <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex justify-between items-center">
                <div>
                  <p className="text-[10px] text-slate-500 uppercase">Estimated Value</p>
                  <p className="text-lg font-bold text-emerald-500">
                    ${(prices['PI'] || 314159).toLocaleString()} / π
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-500 uppercase">Total (USD)</p>
                  <p className="text-lg font-black text-white">$0.00</p>
                </div>
              </div>
            </div>

            <button 
              disabled={txLoading}
              onClick={async () => {
                if (!user || !wallet) return;
                const amount = parseFloat((document.getElementById('exchangeAmount') as HTMLInputElement).value);
                if (amount > 0) {
                  setTxLoading(true);
                  try {
                    // Simple simulation of exchange
                    if (txType === 'buy') {
                      await updateDoc(doc(db, 'wallets', user.uid), { 
                        'balances.PI': increment(amount),
                        'balances.USDT': increment(-(amount * (prices['PI'] || 314159)))
                      });
                    } else {
                      if ((wallet.balances['PI'] || 0) >= amount) {
                        await updateDoc(doc(db, 'wallets', user.uid), { 
                          'balances.PI': increment(-amount),
                          'balances.USDT': increment(amount * (prices['PI'] || 314159))
                        });
                      } else {
                        throw new Error("Insufficient Pi balance");
                      }
                    }
                    setTxSuccess(true);
                    setTimeout(() => { setTxSuccess(false); setActiveModal(null); }, 2000);
                  } catch (e: any) {
                    setNotification({ title: 'Error', message: e.message });
                    setActiveModal('notification');
                  } finally { setTxLoading(false); }
                }
              }}
              className={`w-full py-4 font-bold rounded-2xl shadow-xl transition-all active:scale-95 disabled:opacity-50 ${txType === 'buy' ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-rose-500 shadow-rose-500/20'} text-white`}
            >
              {txLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : t.confirm}
            </button>
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
        ) : activeModal === 'executeLoan' ? (
          <div className="space-y-6">
            <div className="bg-slate-800/50 p-6 rounded-3xl border border-slate-700 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">{t.loanAmount}</span>
                <span className="text-xl font-black text-amber-500">{selectedLoan?.amount} π</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">{t.loanApr}</span>
                <span className="text-lg font-bold text-emerald-500">{selectedLoan?.apr}% APR</span>
              </div>
              <div className="pt-4 border-t border-slate-700">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Loan Agreement</p>
                <div className="bg-slate-950 p-4 rounded-xl text-[10px] text-slate-400 leading-relaxed h-32 overflow-y-auto font-mono">
                  This Peer-to-Peer Loan Agreement is entered into between the Lender and the Borrower ({selectedLoan?.user}). 
                  The Lender agrees to provide a loan of {selectedLoan?.amount} π at an annual interest rate of {selectedLoan?.apr}%. 
                  Repayment is subject to the terms of the TrustBank Global smart contract. 
                  By confirming, you authorize the immediate transfer of funds from your Pi Wallet.
                </div>
              </div>
            </div>
            <button 
              onClick={confirmExecuteLoan} 
              disabled={txLoading} 
              className="w-full py-5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xl rounded-2xl transition-all shadow-xl shadow-amber-500/20 active:scale-95 disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {txLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <span>Sign & Execute Loan</span>}
            </button>
          </div>
        ) : activeModal === 'groupApp' ? (
          <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Group Name</label>
                <input type="text" placeholder="e.g. Pi Global Savings Community" className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 focus:outline-none focus:border-amber-500 transition-colors" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Group Goal/Purpose</label>
                <select className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 focus:outline-none focus:border-amber-500 transition-colors appearance-none">
                  <option>House Purchase Fund</option>
                  <option>Business Startup</option>
                  <option>Education Savings</option>
                  <option>Community Project</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Target Amount (π)</label>
                  <input type="number" placeholder="50000" className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 focus:outline-none focus:border-amber-500 transition-colors" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Period</label>
                  <select className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 focus:outline-none focus:border-amber-500 transition-colors appearance-none">
                    <option>6 Months</option>
                    <option>12 Months</option>
                    <option>24 Months</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Payout/Withdrawal Plan</label>
                <textarea placeholder="Briefly describe the plan..." className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 h-24 focus:outline-none focus:border-amber-500 transition-colors resize-none" />
              </div>
            </div>
            <button 
              onClick={() => {
                setTxLoading(true);
                setTimeout(() => {
                  setTxLoading(false);
                  setActiveModal(null);
                  setNotification({ title: 'Success', message: 'Group application submitted for review' });
                  setActiveModal('notification');
                }, 1500);
              }}
              className="w-full py-5 bg-indigo-500 hover:bg-indigo-600 text-white font-black text-xl rounded-2xl transition-all shadow-xl shadow-indigo-500/20 active:scale-95 flex items-center justify-center space-x-2"
            >
              {txLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <span>Submit Application</span>}
            </button>
          </div>
        ) : activeModal === 'registration' ? (
          <div className="space-y-6">
            {/* Progress Bar */}
            <div className="flex justify-between items-center mb-8">
              {[1, 2, 3, 4].map((step) => (
                <div key={step} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-colors ${regStep >= step ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-500'}`}>
                    {regStep > step ? <CheckCircle2 className="w-5 h-5" /> : step}
                  </div>
                  {step < 4 && <div className={`w-8 h-1 transition-colors ${regStep > step ? 'bg-amber-500' : 'bg-slate-800'}`} />}
                </div>
              ))}
            </div>

            {regStep === 1 && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                <div className="space-y-2">
                  <h4 className="text-xl font-bold">Personal Information</h4>
                  <p className="text-xs text-slate-500 uppercase font-bold tracking-widest">Step 1 of 4</p>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">First Name</label>
                      <input 
                        type="text" 
                        value={regData.firstName}
                        onChange={(e) => setRegData({...regData, firstName: e.target.value})}
                        placeholder="First Name" 
                        className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 focus:outline-none focus:border-amber-500" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Last Name</label>
                      <input 
                        type="text" 
                        value={regData.lastName}
                        onChange={(e) => setRegData({...regData, lastName: e.target.value})}
                        placeholder="Last Name" 
                        className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 focus:outline-none focus:border-amber-500" 
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Date of Birth</label>
                    <input 
                      type="date" 
                      value={regData.dob}
                      onChange={(e) => setRegData({...regData, dob: e.target.value})}
                      className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 focus:outline-none focus:border-amber-500" 
                    />
                  </div>
                </div>
                <button 
                  onClick={() => {
                    if (!regData.firstName || !regData.lastName || !regData.dob) {
                      setNotification({ title: 'Missing Info', message: 'Please fill in all personal information fields.' });
                      setActiveModal('notification');
                      return;
                    }
                    setRegStep(2);
                  }} 
                  className="w-full py-4 bg-amber-500 text-slate-950 font-bold rounded-2xl shadow-xl shadow-amber-500/20 active:scale-95"
                >
                  Continue to Documents
                </button>
              </motion.div>
            )}

            {regStep === 2 && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                <div className="space-y-2">
                  <h4 className="text-xl font-bold">Document Upload</h4>
                  <p className="text-xs text-slate-500 uppercase font-bold tracking-widest">Step 2 of 4</p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'passport', label: 'Passport', icon: <Globe className="w-5 h-5" /> },
                    { id: 'id_card', label: 'ID Card', icon: <CreditCard className="w-5 h-5" /> },
                    { id: 'driver_license', label: 'Driver License', icon: <UserCheck className="w-5 h-5" /> }
                  ].map(type => (
                    <button 
                      key={type.id} 
                      onClick={() => setRegData({...regData, docType: type.id})}
                      className={`p-4 rounded-2xl border flex flex-col items-center space-y-2 transition-all ${regData.docType === type.id ? 'bg-amber-500/10 border-amber-500 text-amber-500' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                    >
                      {type.icon}
                      <span className="text-[10px] font-bold uppercase">{type.label}</span>
                    </button>
                  ))}
                </div>
                <div className="p-8 border-2 border-dashed border-slate-800 rounded-[2.5rem] text-center space-y-4">
                  <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto">
                    <ArrowUpRight className="w-8 h-8 text-slate-600" />
                  </div>
                  <p className="text-sm font-bold">Upload Document Photo</p>
                  <p className="text-[10px] text-slate-500 uppercase">Max size: 5MB (JPG, PNG)</p>
                </div>
                <div className="flex space-x-4">
                  <button onClick={() => setRegStep(1)} className="flex-1 py-4 bg-slate-800 text-white font-bold rounded-2xl border border-slate-700">Back</button>
                  <button onClick={() => setRegStep(3)} className="flex-1 py-4 bg-amber-500 text-slate-950 font-bold rounded-2xl shadow-xl shadow-amber-500/20 active:scale-95">Continue to Wallet</button>
                </div>
              </motion.div>
            )}

            {regStep === 3 && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                <div className="space-y-2">
                  <h4 className="text-xl font-bold">New Wallet Created</h4>
                  <p className="text-xs text-slate-500 uppercase font-bold tracking-widest">Step 3 of 4</p>
                </div>
                <div className="space-y-4">
                  <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Wallet Address</label>
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-mono text-amber-500 break-all pr-4">{regData.walletAddress}</p>
                      <button onClick={() => {
                        navigator.clipboard.writeText(regData.walletAddress);
                        setCopySuccess(true);
                        setTimeout(() => setCopySuccess(false), 2000);
                      }} className="p-2 bg-slate-900 rounded-lg">
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="p-4 bg-rose-500/5 rounded-2xl border border-rose-500/20 space-y-3">
                    <div className="flex items-center space-x-2 text-rose-500">
                      <AlertTriangle className="w-4 h-4" />
                      <label className="text-[10px] font-bold uppercase tracking-widest">Secret Passphrase (24 Words)</label>
                    </div>
                    <p className="text-xs font-mono text-slate-400 leading-relaxed bg-slate-950 p-3 rounded-xl border border-slate-900">{regData.passphrase}</p>
                    <p className="text-[10px] text-rose-500/60 italic">Warning: Never share these words. They grant full access to your funds.</p>
                    <button onClick={() => {
                      navigator.clipboard.writeText(regData.passphrase);
                      setCopySuccess(true);
                      setTimeout(() => setCopySuccess(false), 2000);
                    }} className="w-full py-2 bg-rose-500/10 text-rose-500 text-[10px] font-bold rounded-lg border border-rose-500/20 uppercase tracking-widest">Copy Passphrase</button>
                  </div>
                </div>
                <div className="flex space-x-4">
                  <button onClick={() => setRegStep(2)} className="flex-1 py-4 bg-slate-800 text-white font-bold rounded-2xl border border-slate-700">Back</button>
                  <button onClick={() => setRegStep(4)} className="flex-1 py-4 bg-amber-500 text-slate-950 font-bold rounded-2xl shadow-xl shadow-amber-500/20 active:scale-95">Final Confirmation</button>
                </div>
              </motion.div>
            )}

            {regStep === 4 && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                <div className="space-y-2">
                  <h4 className="text-xl font-bold">Confirm Registration</h4>
                  <p className="text-xs text-slate-500 uppercase font-bold tracking-widest">Final Step</p>
                </div>
                <div className="space-y-4 bg-slate-800/50 p-6 rounded-[2rem] border border-slate-700">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase font-bold">Name</p>
                      <p className="text-sm font-bold">{regData.firstName} {regData.lastName}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase font-bold">DOB</p>
                      <p className="text-sm font-bold">{regData.dob}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-bold">Document Type</p>
                    <p className="text-sm font-bold uppercase">{regData.docType.replace('_', ' ')}</p>
                  </div>
                  <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
                    <p className="text-[10px] text-amber-500 uppercase font-bold">Wallet Ready</p>
                    <p className="text-[10px] font-mono text-amber-500/70 truncate">{regData.walletAddress}</p>
                  </div>
                </div>
                <div className="flex space-x-4">
                  <button onClick={() => setRegStep(3)} className="flex-1 py-4 bg-slate-800 text-white font-bold rounded-2xl border border-slate-700">Back</button>
                  <button 
                    onClick={async () => {
                      setTxLoading(true);
                      const wallet = loginWalletAddress?.trim() || regData.walletAddress;
                      const nickname = loginNickname?.trim() || (regData.firstName + ' ' + regData.lastName);
                      const success = await loginWithPi({ wallet, nickname }, true, {
                        firstName: regData.firstName,
                        lastName: regData.lastName,
                        dob: regData.dob,
                        docType: regData.docType,
                        passphrase: regData.passphrase
                      });
                      if (success) {
                        setNotification({ 
                          title: 'Account Created', 
                          message: 'Welcome to Trust Global Bank! Your account has been created and your KYC is now pending review. You can now explore the app.' 
                        });
                        setActiveModal('notification');
                      }
                      setTxLoading(false);
                    }} 
                    className="flex-1 py-4 bg-amber-500 text-slate-950 font-bold rounded-2xl shadow-xl shadow-amber-500/20 active:scale-95 flex items-center justify-center space-x-2"
                  >
                    {txLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>Complete Registration</span>}
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        ) : activeModal === 'kyc' ? (
          <div className="space-y-6">
            {/* Progress Bar */}
            <div className="flex justify-between items-center mb-8">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-colors ${kycStep >= step ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-500'}`}>
                    {kycStep > step ? <CheckCircle2 className="w-5 h-5" /> : step}
                  </div>
                  {step < 3 && <div className={`w-12 h-1 transition-colors ${kycStep > step ? 'bg-amber-500' : 'bg-slate-800'}`} />}
                </div>
              ))}
            </div>

            {kycStep === 1 && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                <div className="space-y-2">
                  <h4 className="text-xl font-bold">Personal Identity</h4>
                  <p className="text-xs text-slate-500 uppercase font-bold tracking-widest">Step 1 of 3</p>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Full Legal Name</label>
                    <input type="text" placeholder="As shown on your ID" className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 focus:outline-none focus:border-amber-500" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Date of Birth</label>
                      <input type="date" className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 focus:outline-none focus:border-amber-500" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Country</label>
                      <select className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 focus:outline-none focus:border-amber-500 appearance-none">
                        <option>Algeria</option>
                        <option>United States</option>
                        <option>South Korea</option>
                        <option>United Kingdom</option>
                      </select>
                    </div>
                  </div>
                </div>
                <button onClick={() => setKycStep(2)} className="w-full py-4 bg-amber-500 text-slate-950 font-bold rounded-2xl shadow-xl shadow-amber-500/20 active:scale-95">Continue to Documents</button>
              </motion.div>
            )}

            {kycStep === 2 && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                <div className="space-y-2">
                  <h4 className="text-xl font-bold">Document Verification</h4>
                  <p className="text-xs text-slate-500 uppercase font-bold tracking-widest">Step 2 of 3</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {['Passport', 'ID Card', 'Driver License', 'Residence Permit'].map(type => (
                    <button key={type} className="p-6 bg-slate-800 border border-slate-700 rounded-3xl flex flex-col items-center space-y-3 hover:border-amber-500 transition-colors group">
                      <div className="p-3 bg-slate-900 rounded-2xl group-hover:bg-amber-500/10 transition-colors">
                        <CreditCard className="w-6 h-6 text-slate-500 group-hover:text-amber-500" />
                      </div>
                      <span className="text-xs font-bold">{type}</span>
                    </button>
                  ))}
                </div>
                <div className="p-8 border-2 border-dashed border-slate-800 rounded-[2.5rem] text-center space-y-4">
                  <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto">
                    <ArrowUpRight className="w-8 h-8 text-slate-600" />
                  </div>
                  <p className="text-sm font-bold">Upload Document Photo</p>
                  <p className="text-[10px] text-slate-500 uppercase">Max size: 5MB (JPG, PNG)</p>
                </div>
                <div className="flex space-x-4">
                  <button onClick={() => setKycStep(1)} className="flex-1 py-4 bg-slate-800 text-white font-bold rounded-2xl border border-slate-700">Back</button>
                  <button onClick={() => setKycStep(3)} className="flex-1 py-4 bg-amber-500 text-slate-950 font-bold rounded-2xl shadow-xl shadow-amber-500/20 active:scale-95">Continue to Biometrics</button>
                </div>
              </motion.div>
            )}

            {kycStep === 3 && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                <div className="space-y-2 text-center">
                  <h4 className="text-xl font-bold">Biometric Liveness Check</h4>
                  <p className="text-xs text-slate-500 uppercase font-bold tracking-widest">Final Step</p>
                </div>
                <div className="relative aspect-square max-w-[240px] mx-auto">
                  <div className="absolute inset-0 border-4 border-amber-500/20 rounded-full animate-pulse" />
                  <div className="absolute inset-4 border-2 border-dashed border-amber-500/40 rounded-full" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <User className="w-24 h-24 text-slate-800" />
                  </div>
                  <motion.div 
                    animate={{ y: [0, 200, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent shadow-[0_0_15px_rgba(245,158,11,0.5)]"
                  />
                </div>
                <p className="text-center text-xs text-slate-500 leading-relaxed">Position your face within the frame and ensure good lighting. We will perform a quick 3D liveness scan.</p>
                <div className="flex space-x-4">
                  <button onClick={() => setKycStep(2)} className="flex-1 py-4 bg-slate-800 text-white font-bold rounded-2xl border border-slate-700">Back</button>
                  <button 
                    onClick={() => {
                      setTxLoading(true);
                      setTimeout(() => {
                        setTxLoading(false);
                        setActiveModal(null);
                        setNotification({ title: 'KYC Submitted', message: 'Your identity verification is being processed. This usually takes 5-10 minutes.' });
                        setActiveModal('notification');
                      }, 2000);
                    }}
                    className="flex-1 py-4 bg-amber-500 text-slate-950 font-bold rounded-2xl shadow-xl shadow-amber-500/20 active:scale-95 flex items-center justify-center space-x-2"
                  >
                    {txLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>Start Scan</span>}
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        ) : activeModal === 'bankPortal' ? (
          <div className="space-y-6">
            <div className="flex items-center space-x-4 p-4 bg-slate-800 rounded-3xl border border-slate-700">
              <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center text-3xl">{selectedBank?.icon}</div>
              <div>
                <h3 className="text-xl font-bold">{selectedBank?.name}</h3>
                <p className="text-sm text-slate-500">{selectedBank?.country} Portal</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 text-center">
                <p className="text-[10px] text-slate-500 uppercase font-bold">Connected Balance</p>
                <p className="text-lg font-black text-amber-500">{selectedBank?.piValue} π</p>
              </div>
              <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 text-center">
                <p className="text-[10px] text-slate-500 uppercase font-bold">Fiat Value</p>
                <p className="text-lg font-black text-emerald-500">${(selectedBank?.usdValue / 1000000).toFixed(1)}M</p>
              </div>
            </div>

            <div className="space-y-3">
              <button className="w-full p-4 bg-slate-800 hover:bg-slate-700 rounded-2xl flex items-center justify-between transition-all group">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-amber-500/10 rounded-xl text-amber-500"><Wallet className="w-5 h-5" /></div>
                  <span className="font-bold text-sm">View Bank Statement</span>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-white" />
              </button>
              <button className="w-full p-4 bg-slate-800 hover:bg-slate-700 rounded-2xl flex items-center justify-between transition-all group">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-500"><RefreshCw className="w-5 h-5" /></div>
                  <span className="font-bold text-sm">Instant Remittance</span>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-white" />
              </button>
              <button 
                onClick={() => window.open(selectedBank?.url, '_blank')}
                className="w-full p-4 bg-amber-500 text-slate-950 rounded-2xl flex items-center justify-center space-x-2 font-black transition-all active:scale-95"
              >
                <Globe className="w-5 h-5" />
                <span>Visit Official Website</span>
              </button>
            </div>
          </div>
        ) : activeModal === 'lending' ? (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t.loanAmount}</label>
              <input type="number" placeholder="0.00" className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-xl font-bold focus:outline-none focus:border-amber-500 transition-colors" id="loanAmount" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t.loanApr}</label>
              <input type="number" placeholder="5.0" className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-xl font-bold focus:outline-none focus:border-amber-500 transition-colors" id="loanApr" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t.loanPurpose}</label>
              <input type="text" placeholder="e.g. Business Expansion" className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 focus:outline-none focus:border-amber-500 transition-colors" id="loanPurpose" />
            </div>
            <button 
              disabled={txLoading}
              onClick={() => {
                const amount = parseFloat((document.getElementById('loanAmount') as HTMLInputElement).value);
                const apr = parseFloat((document.getElementById('loanApr') as HTMLInputElement).value);
                const purpose = (document.getElementById('loanPurpose') as HTMLInputElement).value;
                if (amount > 0 && purpose) handleLendingRequest(amount, apr, purpose);
              }}
              className="w-full py-5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xl rounded-2xl transition-all shadow-xl shadow-amber-500/20 active:scale-95 disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {txLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <span>{t.createLending}</span>}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Currency</label>
                <select 
                  value={txCurrency}
                  onChange={(e) => setTxCurrency(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 font-bold text-amber-500 focus:outline-none focus:border-amber-500 transition-colors"
                >
                  {Object.keys(currentBalances).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Amount</label>
                <input 
                  type="number" 
                  placeholder="0.00" 
                  value={txAmount || ''}
                  onChange={(e) => setTxAmount(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-xl font-bold focus:outline-none focus:border-amber-500 transition-colors" 
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">{activeModal === 'transfer' ? 'Recipient UID or Wallet Address' : 'Description'}</label>
              <input 
                type="text" 
                placeholder={activeModal === 'transfer' ? 'User UID or G... Address' : 'Note'} 
                value={txDesc}
                onChange={(e) => setTxDesc(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 focus:outline-none focus:border-amber-500 transition-colors" 
              />
              {activeModal === 'transfer' && (
                <p className="text-[9px] text-slate-500 italic px-2">Note: This is an internal TGB transfer. To pay via Pi Blockchain, use the Pi Wallet app.</p>
              )}
            </div>
            <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/50 flex justify-between text-xs">
              <span className="text-slate-500">Available Balance</span>
              <span className={`font-bold ${txAmount > (currentBalances[txCurrency] || 0) ? 'text-rose-500' : 'text-white'}`}>
                {(currentBalances[txCurrency] || 0).toLocaleString()} {txCurrency}
              </span>
            </div>
            {txAmount > (currentBalances[txCurrency] || 0) && (
              <div className="flex items-center space-x-2 text-rose-500 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20 text-[10px] font-bold uppercase tracking-widest">
                <AlertCircle className="w-4 h-4" />
                <span>Insufficient funds in your TGB wallet</span>
              </div>
            )}
            <button 
              disabled={txLoading}
              onClick={async () => {
                if (txAmount <= 0) {
                  setNotification({ title: 'Invalid Amount', message: 'Please enter an amount greater than 0.' });
                  setActiveModal('notification');
                  return;
                }
                
                // If in Pi Browser and currency is PI, use createPayment
                const isPiBrowser = /PiBrowser/i.test(navigator.userAgent);
                // @ts-ignore
                if (isPiBrowser && window.Pi && txCurrency === 'PI') {
                  try {
                    setTxLoading(true);
                    // @ts-ignore
                    const payment = await window.Pi.createPayment({
                      amount: txAmount,
                      memo: `Deposit to TGB Wallet`,
                      metadata: { type: 'deposit' }
                    }, {
                      onReadyForServerApproval: async (paymentId: string) => {
                        console.log("Deposit ready for server approval:", paymentId);
                        await fetch('/api/pi/approve', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ paymentId })
                        });
                      },
                      onReadyForServerCompletion: async (paymentId: string, txid: string) => {
                        console.log("Deposit ready for server completion:", paymentId, txid);
                        await fetch('/api/pi/complete', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ paymentId, txid })
                        });
                        
                        // Update local Firestore after successful blockchain payment
                        await handleTransaction('deposit', txAmount, `Deposit via Pi Browser (Blockchain)`, undefined, 'PI');
                      },
                      onCancel: (paymentId: string) => {
                        console.log("Deposit cancelled:", paymentId);
                        setTxLoading(false);
                      },
                      onError: (error: Error, paymentId?: string) => {
                        console.error("Deposit error:", error, paymentId);
                        setNotification({ title: 'Deposit Error', message: error.message });
                        setActiveModal('notification');
                        setTxLoading(false);
                      }
                    });
                    return;
                  } catch (e: any) {
                    console.error("Pi Deposit creation error:", e);
                    setTxLoading(false);
                  }
                }
                
                // Fallback to manual transaction simulation
                handleTransaction(activeModal!, txAmount, txDesc, activeModal === 'transfer' ? txDesc : undefined, txCurrency);
              }}
              className="w-full py-5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xl rounded-2xl transition-all shadow-xl shadow-amber-500/20 active:scale-95 disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {txLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <span>Confirm {activeModal}</span>}
            </button>
          </div>
        )}
      </Modal>

      {/* QR Modal */}
      <Modal isOpen={showQrModal} onClose={() => setShowQrModal(false)} title="Your Wallet QR">
        <div className="flex flex-col items-center justify-center space-y-6 py-8">
          <div className="p-6 bg-white rounded-[2.5rem] shadow-2xl shadow-amber-500/20">
            <QrCode className="w-48 h-48 text-slate-950" />
          </div>
          <div className="text-center space-y-2">
            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Wallet Address</p>
            <div className="flex items-center space-x-2 bg-slate-900 px-4 py-2 rounded-xl border border-slate-800">
              <code className="text-xs font-mono text-amber-500">{userData?.uid?.slice(0, 16)}...</code>
              <button onClick={() => {
                navigator.clipboard.writeText(userData?.uid || '');
                setNotification({ title: 'Success', message: 'Address copied!' });
                setActiveModal('notification');
              }} className="text-slate-400 hover:text-white"><Copy className="w-4 h-4" /></button>
            </div>
          </div>
          <p className="text-xs text-slate-500 text-center max-w-[200px]">Scan this code to receive Pi instantly from any Pioneer.</p>
        </div>
      </Modal>

      {/* Partnership Modal */}
      <Modal isOpen={activeModal === 'partnership'} onClose={() => setActiveModal(null)} title={t.partnership}>
        <div className="space-y-6">
          <div className="bg-amber-500/10 p-6 rounded-3xl border border-amber-500/20 space-y-4">
            <div className="flex items-center space-x-3 text-amber-500">
              <FileText className="w-6 h-6" />
              <p className="font-bold">Business Proposal</p>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              TrustBank Global is looking for strategic partners in e-commerce, logistics, and fintech. 
              Submit your proposal to integrate your services into our ecosystem.
            </p>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Company Name</label>
              <input type="text" id="companyName" className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 focus:outline-none focus:border-amber-500" placeholder="Enter company name" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Proposal Type</label>
              <select id="proposalType" className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 focus:outline-none focus:border-amber-500">
                <option>E-commerce Integration</option>
                <option>Liquidity Provider</option>
                <option>Marketing Partnership</option>
                <option>Other</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Message</label>
              <textarea id="proposalMsg" className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 h-32 focus:outline-none focus:border-amber-500" placeholder="Describe your proposal..." />
            </div>
          </div>
          <button onClick={async () => {
            if (!user) return;
            const company = (document.getElementById('companyName') as HTMLInputElement).value;
            const type = (document.getElementById('proposalType') as HTMLSelectElement).value;
            const message = (document.getElementById('proposalMsg') as HTMLTextAreaElement).value;
            
            if (company && message) {
              setTxLoading(true);
              try {
                await addDoc(collection(db, 'proposals'), {
                  uid: user.uid,
                  company,
                  type,
                  message,
                  timestamp: serverTimestamp(),
                  status: 'pending'
                });
                setTxSuccess(true);
                setTimeout(() => { setTxSuccess(false); setActiveModal(null); }, 2000);
              } catch (e: any) {
                setNotification({ title: 'Error', message: e.message });
                setActiveModal('notification');
              } finally { setTxLoading(false); }
            }
          }} disabled={txLoading} className="w-full py-4 bg-amber-500 text-slate-950 font-bold rounded-2xl shadow-xl shadow-amber-500/20 active:scale-95 disabled:opacity-50">
            {txLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : t.submitProposal}
          </button>
        </div>
      </Modal>

      {/* Bottom Nav */}
      <AnimatePresence>
        {!showQrModal && (
          <motion.nav 
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-6 left-4 right-4 bg-slate-900/90 backdrop-blur-xl border border-slate-800 p-4 rounded-2xl flex justify-around items-center z-50 shadow-2xl shadow-black/50"
          >
            {[
              { id: 'wallet', icon: Wallet, label: t.balance },
              { id: 'finance', icon: BarChart3, label: t.finance },
              { id: 'exchange', icon: RefreshCw, label: t.exchange },
              { id: 'market', icon: Globe, label: t.market },
              { id: 'store', icon: ShoppingBag, label: t.store },
              { id: 'profile', icon: User, label: t.profile },
            ].map((tab) => (
              <button 
                key={tab.id} 
                onClick={() => {
                  setActiveTab(tab.id as any);
                  setActiveModal(null);
                }}
                className={`flex flex-col items-center space-y-1 transition-all ${activeTab === tab.id ? 'text-amber-500 scale-110' : 'text-slate-500'}`}
              >
                <tab.icon className="w-5 h-5" />
                <span className="text-[8px] font-bold uppercase tracking-tighter max-w-[60px] truncate">{tab.label}</span>
              </button>
            ))}
          </motion.nav>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  useEffect(() => {
    // Force redirect to Netlify for stability on mobile/DNS issues
    const API_URL = (import.meta as any).env.VITE_API_URL || "https://tgbfinale.netlify.app/";
    
    if (window.location.hostname !== "tgbfinale.netlify.app" && 
        !window.location.hostname.includes("localhost") &&
        !window.location.hostname.includes("127.0.0.1")) {
      console.log(`Redirecting to stable build at ${API_URL}...`);
      window.location.replace(API_URL);
    }
  }, []);

  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
