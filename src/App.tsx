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

const useBinancePrices = () => {
  const [prices, setPrices] = useState<{ [symbol: string]: number }>({ PI: PI_FIXED_PRICE, USD: 1, DZD: 0.0074 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const response = await fetch('https://api.binance.com/api/v3/ticker/price');
        const data = await response.json();
        const newPrices: { [symbol: string]: number } = { PI: PI_FIXED_PRICE, USD: 1, DZD: 0.0074 };
        
        // Map Binance prices (symbol like BTCUSDT) to our symbols
        data.forEach((item: any) => {
          if (item.symbol.endsWith('USDT')) {
            const symbol = item.symbol.replace('USDT', '');
            newPrices[symbol] = parseFloat(item.price);
          }
        });
        
        setPrices(newPrices);
      } catch (err) {
        console.error("Binance price error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 30000); // Update every 30s
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
  kycStatus?: 'none' | 'pending' | 'verified' | 'rejected';
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
    // Fallback timeout to ensure loading screen doesn't stay forever
    const timeoutId = setTimeout(() => {
      if (loading) {
        console.warn("Auth initialization timed out, forcing loading to false");
        setLoading(false);
      }
    }, 10000); // 10 seconds fallback

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
              kycStatus: firebaseUser.isAnonymous ? 'verified' : 'none',
            };
            await setDoc(userDocRef, {
              ...newUserData,
              createdAt: serverTimestamp()
            });
            setUserData(newUserData);

            await setDoc(doc(db, 'wallets', firebaseUser.uid), {
              uid: firebaseUser.uid,
              balances: {
                PI: 1.25,
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
            });
          } else {
            setUserData(userDoc.data() as UserData);
          }

          // Subscribe to wallet
          const walletUnsub = onSnapshot(doc(db, 'wallets', firebaseUser.uid), (snapshot) => {
            if (snapshot.exists()) setWallet(snapshot.data() as WalletData);
          }, (err) => console.error("Wallet snapshot error:", err));

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
          }, (err) => console.error("Transactions snapshot error:", err));

          // Subscribe to cards
          const cq = query(collection(db, 'cards'), where('uid', '==', firebaseUser.uid));
          const cardUnsub = onSnapshot(cq, (snapshot) => {
            const cs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Card));
            setCards(cs);
          }, (err) => console.error("Cards snapshot error:", err));

          // Cleanup subscriptions on auth change or unmount
          // We'll store these in a ref if needed, but for now, we just let them be
          // or we can handle them better.
        } catch (err) {
          console.error("Sync error:", err);
          setError("Failed to sync account data. Please check your connection.");
        }
      } else {
        setUserData(null);
        setWallet(null);
        setTransactions([]);
        setCards([]);
      }
      
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
      await signInWithPopup(auth, googleProvider);
      console.log("Google Login successful");
    } catch (err: any) {
      console.error("Google Login error:", err);
      if (err.code === 'auth/unauthorized-domain') {
        setError(`This domain (${window.location.hostname}) is not authorized in Firebase Console. Please add it to the Authorized Domains list in your Firebase Authentication settings.`);
      } else {
        setError("Login failed. Please use Pioneer Connection if in Pi Browser or check your internet connection.");
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
  const { prices, loading: pricesLoading } = useBinancePrices();
  const [exchangeRates, setExchangeRates] = useState({ usd_dzd: 134.5 });
  const [activeModal, setActiveModal] = useState<'transfer' | 'withdraw' | 'deposit' | 'shop' | 'card' | 'exchange' | null>(null);
  const [txLoading, setTxLoading] = useState(false);
  const [txSuccess, setTxSuccess] = useState(false);
  const [lang, setLang] = useState<'en' | 'ar' | 'fr' | 'es' | 'kab' | 'ko' | 'zh' | 'ja' | 'it' | 'pt'>('en');
  const [activeTab, setActiveTab] = useState<'wallet' | 'market' | 'cards' | 'profile' | 'store' | 'exchange'>('wallet');
  const [copySuccess, setCopySuccess] = useState(false);
  const [exchangeFrom, setExchangeFrom] = useState('USD');
  const [exchangeTo, setExchangeTo] = useState('PI');
  const [exchangeAmount, setExchangeAmount] = useState<number>(0);
  const [txCurrency, setTxCurrency] = useState('PI');

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
    en: { balance: 'Total Portfolio', actions: 'Quick Actions', market: 'Market Insights', activity: 'Recent Activity', deposit: 'Deposit', withdraw: 'Withdraw', transfer: 'Transfer', shop: 'Shop', card: 'Request Visa Card', profile: 'Profile', store: 'Store', copyUid: 'Copy UID', uidCopied: 'UID Copied!', exchange: 'Global Exchange', buyPi: 'Buy Pi', sellPi: 'Sell Pi', kyc: 'KYC Verification', kycRequired: 'KYC Required for Global Users', kycPending: 'KYC Pending Review', kycVerified: 'KYC Verified' },
    ar: { balance: 'إجمالي المحفظة', actions: 'إجراءات سريعة', market: 'رؤى السوق', activity: 'النشاط الأخير', deposit: 'إيداع', withdraw: 'سحب', transfer: 'تحويل', shop: 'تسوق', card: 'طلب بطاقة فيزا', profile: 'الملف الشخصي', store: 'المتجر', copyUid: 'نسخ المعرف', uidCopied: 'تم النسخ!', exchange: 'تبادل عالمي', buyPi: 'شراء باي', sellPi: 'بيع باي', kyc: 'التحقق من الهوية', kycRequired: 'مطلوب التحقق للمستخدمين العالميين', kycPending: 'التحقق قيد المراجعة', kycVerified: 'تم التحقق' },
    fr: { balance: 'Portefeuille Total', actions: 'Actions Rapides', market: 'Aperçu du Marché', activity: 'Activité Récente', deposit: 'Dépôt', withdraw: 'Retrait', transfer: 'Transfert', shop: 'Boutique', card: 'Demander une carte Visa', profile: 'Profil', store: 'Boutique', copyUid: 'Copier UID', uidCopied: 'UID Copié!', exchange: 'Échange Global', buyPi: 'Acheter Pi', sellPi: 'Vendre Pi', kyc: 'Vérification KYC', kycRequired: 'KYC requis pour les utilisateurs mondiaux', kycPending: 'KYC en attente', kycVerified: 'KYC vérifié' },
    es: { balance: 'Cartera Total', actions: 'Acciones Rápidas', market: 'Mercado', activity: 'Actividad Reciente', deposit: 'Depósito', withdraw: 'Retiro', transfer: 'Transferencia', shop: 'Tienda', card: 'Solicitar Tarjeta Visa', profile: 'Perfil', store: 'Tienda', copyUid: 'Copiar UID', uidCopied: '¡UID Copiado!', exchange: 'Intercambio Global', buyPi: 'Comprar Pi', sellPi: 'Vender Pi', kyc: 'Verificación KYC', kycRequired: 'KYC requerido para usuarios globales', kycPending: 'KYC pendiente', kycVerified: 'KYC verificado' },
    kab: { balance: 'Agraw n tqarict', actions: 'Tigawt n tazzla', market: 'Anadi n ssuq', activity: 'Tigawt taneggarut', deposit: 'Asers', withdraw: 'Asufeg', transfer: 'Asiwel', shop: 'Amsawaq', card: 'Suter tkarict Visa', profile: 'Udem', store: 'Tahanut', copyUid: 'Nsek UID', uidCopied: 'UID yensek!', exchange: 'Amsel n GCV', buyPi: 'Aɣ Pi', sellPi: 'Zenz Pi', kyc: 'Aselmed n udem', kycRequired: 'Aselmed n udem i yimseqdac n berra', kycPending: 'Aselmed n udem deg uraju', kycVerified: 'Aselmed n udem yettuseqbel' },
    ko: { balance: '총 포트폴리오', actions: '빠른 작업', market: '시장 인사이트', activity: '최근 활동', deposit: '입금', withdraw: '출금', transfer: '송금', shop: '쇼핑', card: '비자 카드 요청', profile: '프로필', store: '상점', copyUid: 'UID 복사', uidCopied: 'UID 복사됨!', exchange: '글로벌 거래소', buyPi: 'Pi 구매', sellPi: 'Pi 판매', kyc: 'KYC 인증', kycRequired: '글로벌 사용자를 위한 KYC 필요', kycPending: 'KYC 검토 중', kycVerified: 'KYC 인증됨' },
    zh: { balance: '总投资组合', actions: '快速操作', market: '市场洞察', activity: '近期活动', deposit: '充值', withdraw: '提现', transfer: '转账', shop: '购物', card: '申请维萨卡', profile: '个人资料', store: '商店', copyUid: '复制 UID', uidCopied: 'UID 已复制!', exchange: '全球交易所', buyPi: '购买 Pi', sellPi: '出售 Pi', kyc: 'KYC 认证', kycRequired: '全球用户需要 KYC', kycPending: 'KYC 审核中', kycVerified: 'KYC 已认证' },
    ja: { balance: '総ポートフォリオ', actions: 'クイックアクション', market: '市場インサイト', activity: '最近の活動', deposit: '入金', withdraw: '出金', transfer: '送金', shop: 'ショップ', card: 'Visaカードをリクエスト', profile: 'プロフィール', store: 'ストア', copyUid: 'UIDをコピー', uidCopied: 'UIDがコピーされました!', exchange: 'グローバル取引所', buyPi: 'Piを購入', sellPi: 'Piを売却', kyc: 'KYC認証', kycRequired: 'グローバルユーザーにはKYCが必要', kycPending: 'KYC審査中', kycVerified: 'KYC認証済み' },
    it: { balance: 'Portafoglio Totale', actions: 'Azioni Rapide', market: 'Mercato', activity: 'Attività Recente', deposit: 'Deposito', withdraw: 'Prelievo', transfer: 'Trasferimento', shop: 'Negozio', card: 'Richiedi Carta Visa', profile: 'Profilo', store: 'Negozio', copyUid: 'Copia UID', uidCopied: 'UID Copiato!', exchange: 'Scambio Globale', buyPi: 'Compra Pi', sellPi: 'Vendi Pi', kyc: 'Verifica KYC', kycRequired: 'KYC richiesto per utenti globali', kycPending: 'KYC in attesa', kycVerified: 'KYC verificato' },
    pt: { balance: 'Portfólio Total', actions: 'Ações Rápidas', market: 'Mercado', activity: 'Atividade Recente', deposit: 'Depósito', withdraw: 'Saque', transfer: 'Transferência', shop: 'Loja', card: 'Solicitar Cartão Visa', profile: 'Perfil', store: 'Loja', copyUid: 'Copiar UID', uidCopied: 'UID Copiado!', exchange: 'Troca Global', buyPi: 'Comprar Pi', sellPi: 'Vender Pi', kyc: 'Verificação KYC', kycRequired: 'KYC necessário para usuários globais', kycPending: 'KYC pendente', kycVerified: 'KYC verificado' }
  }[lang];

  const handleCopyUid = () => {
    if (user?.uid) {
      navigator.clipboard.writeText(user.uid);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const handleTransaction = async (type: string, amount: number, desc: string, recipientUid?: string, currency: string = 'PI') => {
    if (!user || !wallet) return;
    setTxLoading(true);
    const path = `wallets/${user.uid}`;
    try {
      const currentBalance = wallet.balances[currency] || 0;
      if (type !== 'deposit' && currentBalance < amount) throw new Error("Insufficient funds");

      // For real transfers, we update both wallets
      if (type === 'transfer' && recipientUid) {
        const recipientWalletRef = doc(db, 'wallets', recipientUid);
        const recipientWallet = await getDoc(recipientWalletRef);
        if (!recipientWallet.exists()) throw new Error("Recipient wallet not found");

        await updateDoc(recipientWalletRef, {
          [`balances.${currency}`]: increment(amount)
        });
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

  const handleExchange = async (fromSymbol: string, toSymbol: string, fromAmount: number) => {
    if (!user || !wallet) return;
    
    const fromPrice = prices[fromSymbol] || 0;
    const toPrice = prices[toSymbol] || 0;
    
    if (fromPrice === 0 || toPrice === 0) {
      alert("Invalid exchange pair or price not available");
      return;
    }

    const toAmount = (fromAmount * fromPrice) / toPrice;
    const currentFromBalance = wallet.balances[fromSymbol] || 0;

    if (fromAmount > currentFromBalance) {
      alert("Insufficient balance");
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
        amount: fromAmount,
        currency: fromSymbol,
        description: `Exchanged ${fromAmount} ${fromSymbol} for ${toAmount.toFixed(6)} ${toSymbol}`,
        timestamp: serverTimestamp(),
        status: 'completed'
      });

      setTxSuccess(true);
      setTimeout(() => setTxSuccess(false), 2000);
    } catch (e: any) {
      alert(e.message);
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
    const currentPiBalance = wallet.balances['PI'] || 0;
    if (currentPiBalance < product.price) {
      alert("Insufficient Pi balance");
      return;
    }
    setTxLoading(true);
    try {
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
      alert(e.message);
    } finally {
      setTxLoading(false);
    }
  };

  const handleBuyPiWithUsd = async (usdAmount: number) => {
    if (!user || !wallet) return;
    if (userData?.role === 'global' && userData?.kycStatus !== 'verified') {
      alert(t.kycRequired);
      return;
    }
    setTxLoading(true);
    try {
      const piAmount = usdAmount / PI_FIXED_PRICE;
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
        timestamp: serverTimestamp(),
        status: 'completed'
      });
      setTxSuccess(true);
      setTimeout(() => setTxSuccess(false), 2000);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setTxLoading(false);
    }
  };

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

  const currentBalances: Record<string, number> = wallet?.balances || { PI: 0, USD: 0, DZD: 0 };
  const totalUsdValue = Object.entries(currentBalances).reduce((total, [symbol, amount]) => {
    return total + (Number(amount) * (prices[symbol] || 0));
  }, 0);

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
                      ${totalUsdValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </h2>
                  </div>
                  <div className="bg-slate-950/10 p-4 rounded-2xl backdrop-blur-sm border border-white/10"><Wallet className="w-7 h-7" /></div>
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
            
            <div className="space-y-4">
              <h3 className="text-lg font-bold">Top Cryptocurrencies</h3>
              <div className="grid grid-cols-1 gap-3">
                {Object.entries(prices)
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
                ))}
              </div>
            </div>
          </section>
        )}

        {activeTab === 'exchange' && (
          <section className="space-y-8">
            <h2 className="text-2xl font-bold">{t.exchange}</h2>
            
            {userData?.role === 'global' && userData?.kycStatus !== 'verified' ? (
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

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800">
                    <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">External Wallet</p>
                    <p className="font-bold text-sm">Binance / MetaMask</p>
                    <div className="mt-4 flex items-center space-x-2 text-emerald-500 text-xs">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Connected</span>
                    </div>
                  </div>
                  <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800">
                    <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Network Fee</p>
                    <p className="font-bold text-sm">0.0001 π</p>
                    <div className="mt-4 flex items-center space-x-2 text-slate-500 text-xs">
                      <Zap className="w-4 h-4" />
                      <span>Instant Settlement</span>
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
              {userData?.role === 'global' && (
                <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold">{t.kyc}</h3>
                    <div className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase ${
                      userData.kycStatus === 'verified' ? 'bg-emerald-500/20 text-emerald-500' :
                      userData.kycStatus === 'pending' ? 'bg-amber-500/20 text-amber-500' :
                      'bg-rose-500/20 text-rose-500'
                    }`}>
                      {userData.kycStatus === 'verified' ? t.kycVerified : 
                       userData.kycStatus === 'pending' ? t.kycPending : t.kycRequired}
                    </div>
                  </div>
                  
                  {userData.kycStatus === 'none' && (
                    <div className="space-y-4">
                      <p className="text-xs text-slate-500">Upload your ID card or Passport to unlock GCV Exchange features.</p>
                      <div className="grid grid-cols-2 gap-3">
                        <button className="p-4 bg-slate-950 border border-slate-800 rounded-2xl text-xs font-bold hover:border-amber-500 transition-colors">ID Card</button>
                        <button className="p-4 bg-slate-950 border border-slate-800 rounded-2xl text-xs font-bold hover:border-amber-500 transition-colors">Passport</button>
                      </div>
                      <button 
                        onClick={handleKycSubmit}
                        disabled={txLoading}
                        className="w-full py-3 bg-amber-500 text-slate-950 font-bold rounded-xl hover:bg-amber-600 transition-all"
                      >
                        {txLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Submit for Review"}
                      </button>
                    </div>
                  )}
                </div>
              )}

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
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
                    <div className="flex items-center space-x-3 text-slate-400"><Languages className="w-5 h-5" /><span>Language</span></div>
                    <div className="grid grid-cols-3 gap-2">
                      {['en', 'ar', 'fr', 'es', 'kab', 'ko', 'zh', 'ja', 'it', 'pt'].map((l) => (
                        <button 
                          key={l}
                          onClick={() => setLang(l as any)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase border transition-all ${lang === l ? 'bg-amber-500 border-amber-500 text-slate-950' : 'border-slate-800 text-slate-500'}`}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
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
                <input type="number" placeholder="0.00" className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-xl font-bold focus:outline-none focus:border-amber-500 transition-colors" id="txAmount" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">{activeModal === 'transfer' ? 'Recipient UID' : 'Description'}</label>
              <input type="text" placeholder={activeModal === 'transfer' ? 'User UID' : 'Note'} className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 focus:outline-none focus:border-amber-500 transition-colors" id="txDesc" />
            </div>
            <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/50 flex justify-between text-xs">
              <span className="text-slate-500">Available Balance</span>
              <span className="font-bold">{(currentBalances[txCurrency] || 0).toLocaleString()} {txCurrency}</span>
            </div>
            <button 
              disabled={txLoading}
              onClick={() => {
                const amount = parseFloat((document.getElementById('txAmount') as HTMLInputElement).value);
                const desc = (document.getElementById('txDesc') as HTMLInputElement).value;
                if (amount > 0) handleTransaction(activeModal!, amount, desc, activeModal === 'transfer' ? desc : undefined, txCurrency);
              }}
              className="w-full py-5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xl rounded-2xl transition-all shadow-xl shadow-amber-500/20 active:scale-95 disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {txLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <span>Confirm {activeModal}</span>}
            </button>
          </div>
        )}
      </Modal>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-900/80 backdrop-blur-xl border-t border-slate-800 p-4 flex justify-around items-center z-50">
        {[
          { id: 'wallet', icon: Wallet, label: 'Wallet' },
          { id: 'exchange', icon: RefreshCw, label: 'Exchange' },
          { id: 'market', icon: Globe, label: 'Market' },
          { id: 'store', icon: ShoppingBag, label: 'Store' },
          { id: 'cards', icon: CreditCard, label: 'Cards' },
          { id: 'profile', icon: User, label: 'Profile' },
        ].map((tab) => (
          <button 
            key={tab.id} 
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex flex-col items-center space-y-1 transition-all ${activeTab === tab.id ? 'text-amber-500 scale-110' : 'text-slate-500'}`}
          >
            <tab.icon className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase">{tab.label}</span>
          </button>
        ))}
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
