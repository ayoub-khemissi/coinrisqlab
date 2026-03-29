-- Migration: User Space Tables
-- Date: 2026-03-29
-- Description: Add tables for user accounts, portfolios, transactions, alerts, and snapshots
-- Impact: Additive only (CREATE TABLE IF NOT EXISTS) — zero downtime

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

-- ============================================================================
-- 1. USERS — Public user accounts (separate from admins)
-- ============================================================================
CREATE TABLE IF NOT EXISTS `users` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `email` VARCHAR(255) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `display_name` VARCHAR(100) NOT NULL DEFAULT '',
    `plan` ENUM('free', 'pro') NOT NULL DEFAULT 'free',
    `plan_expires_at` TIMESTAMP NULL COMMENT 'NULL for free plan, expiry date for pro',
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `email_verified` TINYINT(1) NOT NULL DEFAULT 0,
    `last_login_at` TIMESTAMP NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `idx_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 2. USER_SESSIONS — JWT session tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS `user_sessions` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT UNSIGNED NOT NULL,
    `token_hash` VARCHAR(64) NOT NULL COMMENT 'SHA-256 hash of JWT token',
    `expires_at` TIMESTAMP NOT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY `fk_user_sessions_user_idx` (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    KEY `idx_expires_at` (`expires_at`),
    UNIQUE KEY `idx_token_hash` (`token_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 3. USER_PORTFOLIOS — User portfolio containers (1 for free, unlimited for pro)
-- ============================================================================
CREATE TABLE IF NOT EXISTS `user_portfolios` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT UNSIGNED NOT NULL,
    `name` VARCHAR(100) NOT NULL DEFAULT 'My Portfolio',
    `description` VARCHAR(500) NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY `fk_user_portfolios_user_idx` (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 4. USER_PORTFOLIO_HOLDINGS — Positions in a portfolio
--    crypto_id links to cryptocurrencies → all risk metrics tables
-- ============================================================================
CREATE TABLE IF NOT EXISTS `user_portfolio_holdings` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `portfolio_id` INT UNSIGNED NOT NULL,
    `crypto_id` INT UNSIGNED NOT NULL,
    `quantity` DECIMAL(30, 18) NOT NULL COMMENT 'Amount of crypto held',
    `avg_buy_price` DECIMAL(30, 18) NOT NULL DEFAULT 0 COMMENT 'Average purchase price in USD',
    `first_buy_date` DATE NULL COMMENT 'Date of first purchase',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY `fk_holdings_portfolio_idx` (`portfolio_id`) REFERENCES `user_portfolios`(`id`) ON DELETE CASCADE,
    FOREIGN KEY `fk_holdings_crypto_idx` (`crypto_id`) REFERENCES `cryptocurrencies`(`id`) ON DELETE CASCADE,
    UNIQUE KEY `idx_portfolio_crypto` (`portfolio_id`, `crypto_id`),
    KEY `idx_crypto_id` (`crypto_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 5. USER_TRANSACTIONS — Buy/sell/transfer history
-- ============================================================================
CREATE TABLE IF NOT EXISTS `user_transactions` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `portfolio_id` INT UNSIGNED NOT NULL,
    `crypto_id` INT UNSIGNED NOT NULL,
    `type` ENUM('buy', 'sell', 'transfer') NOT NULL,
    `quantity` DECIMAL(30, 18) NOT NULL COMMENT 'Amount of crypto transacted',
    `price_usd` DECIMAL(30, 18) NOT NULL COMMENT 'Price per unit at time of transaction',
    `fee_usd` DECIMAL(20, 8) NOT NULL DEFAULT 0 COMMENT 'Transaction fee in USD',
    `timestamp` DATETIME NOT NULL COMMENT 'When the transaction occurred',
    `notes` VARCHAR(500) NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY `fk_transactions_portfolio_idx` (`portfolio_id`) REFERENCES `user_portfolios`(`id`) ON DELETE CASCADE,
    FOREIGN KEY `fk_transactions_crypto_idx` (`crypto_id`) REFERENCES `cryptocurrencies`(`id`) ON DELETE CASCADE,
    KEY `idx_portfolio_timestamp` (`portfolio_id`, `timestamp`),
    KEY `idx_crypto_id` (`crypto_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 6. USER_ALERTS — Price and risk alerts
-- ============================================================================
CREATE TABLE IF NOT EXISTS `user_alerts` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT UNSIGNED NOT NULL,
    `crypto_id` INT UNSIGNED NOT NULL,
    `alert_type` ENUM('price', 'volatility', 'drawdown', 'var_breach', 'rebalancing') NOT NULL,
    `threshold_value` DECIMAL(30, 18) NOT NULL COMMENT 'Threshold to trigger alert',
    `direction` ENUM('above', 'below') NOT NULL DEFAULT 'above',
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `last_triggered_at` TIMESTAMP NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY `fk_alerts_user_idx` (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    FOREIGN KEY `fk_alerts_crypto_idx` (`crypto_id`) REFERENCES `cryptocurrencies`(`id`) ON DELETE CASCADE,
    KEY `idx_user_active` (`user_id`, `is_active`),
    KEY `idx_crypto_id` (`crypto_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 7. USER_PORTFOLIO_SNAPSHOTS — Daily portfolio value history (for charts)
-- ============================================================================
CREATE TABLE IF NOT EXISTS `user_portfolio_snapshots` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `portfolio_id` INT UNSIGNED NOT NULL,
    `total_value_usd` DECIMAL(40, 8) NOT NULL COMMENT 'Total portfolio value at snapshot time',
    `total_pnl_usd` DECIMAL(40, 8) NOT NULL DEFAULT 0 COMMENT 'Total unrealized PnL at snapshot time',
    `snapshot_date` DATE NOT NULL COMMENT 'Date of the snapshot',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY `fk_snapshots_portfolio_idx` (`portfolio_id`) REFERENCES `user_portfolios`(`id`) ON DELETE CASCADE,
    UNIQUE KEY `idx_portfolio_date` (`portfolio_id`, `snapshot_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

COMMIT;
