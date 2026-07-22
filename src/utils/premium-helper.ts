/**
 * Premium listing helper functions
 */

/**
 * Calculate premium expiration date (3 weeks from now)
 * @returns ISO date string when premium expires
 */
export const calculatePremiumExpiresAt = (): string => {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000) // 3 weeks = 21 days
  return expiresAt.toISOString()
}

/**
 * Check if a property has active premium status
 * @param premiumExpiresAt ISO date string
 * @returns true if premium is still active
 */
export const isPremiumActive = (premiumExpiresAt?: string): boolean => {
  if (!premiumExpiresAt) return false
  return new Date(premiumExpiresAt).getTime() > Date.now()
}

/**
 * Get remaining days for premium listing
 * @param premiumExpiresAt ISO date string
 * @returns number of days remaining (0 if expired)
 */
export const getPremiumRemainingDays = (premiumExpiresAt?: string): number => {
  if (!premiumExpiresAt || !isPremiumActive(premiumExpiresAt)) return 0
  const expiresAt = new Date(premiumExpiresAt).getTime()
  const now = Date.now()
  const daysRemaining = Math.ceil((expiresAt - now) / (24 * 60 * 60 * 1000))
  return Math.max(daysRemaining, 0)
}
