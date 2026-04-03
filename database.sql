-- Trust Global Bank Database Schema (PostgreSQL / Supabase)

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pioneer_id TEXT UNIQUE, -- Pi Network ID
    email TEXT UNIQUE NOT NULL,
    wallet_address TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Wallets Table
CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    currency TEXT NOT NULL, -- 'PI', 'USD', 'DZD'
    balance DECIMAL(20, 8) DEFAULT 0.00000000,
    UNIQUE(user_id, currency)
);

-- 3. Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID REFERENCES users(id),
    receiver_id UUID REFERENCES users(id),
    amount DECIMAL(20, 8) NOT NULL,
    currency TEXT NOT NULL,
    type TEXT CHECK (type IN ('deposit', 'withdrawal', 'transfer', 'payment')),
    reference TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Exchange Rates Table
CREATE TABLE IF NOT EXISTS exchange_rates (
    currency_pair TEXT PRIMARY KEY, -- 'PI/USD', 'USD/DZD'
    rate DECIMAL(20, 8) NOT NULL,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Initial Seed for Pi Fixed Price
INSERT INTO exchange_rates (currency_pair, rate) 
VALUES ('PI/USD', 314159.00000000)
ON CONFLICT (currency_pair) DO UPDATE SET rate = EXCLUDED.rate;
