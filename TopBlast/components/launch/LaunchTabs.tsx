'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export type LaunchTabId = 'create' | 'setup' | 'payouts' | 'fees'

const TABS: { id: LaunchTabId; label: string; short: string }[] = [
  { id: 'create', label: 'Create listing', short: 'Create' },
  { id: 'setup', label: 'Setup guide', short: 'Setup' },
  { id: 'payouts', label: 'Payout rules', short: 'Rules' },
  { id: 'fees', label: 'Fees & trust', short: 'Fees' },
]

interface LaunchTabsProps {
  activeTab: LaunchTabId
  onTabChange: (tab: LaunchTabId) => void
}

export function LaunchTabBar({ activeTab, onTabChange }: LaunchTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Launch information"
      className="flex gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/10 overflow-x-auto"
    >
      {TABS.map(tab => {
        const selected = activeTab === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onTabChange(tab.id)}
            className={`shrink-0 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              selected
                ? 'bg-sol-mint/15 text-sol-mint border border-sol-mint/25'
                : 'text-gray-400 hover:text-white border border-transparent'
            }`}
          >
            <span className="hidden sm:inline">{tab.label}</span>
            <span className="sm:hidden">{tab.short}</span>
          </button>
        )
      })}
    </div>
  )
}

interface LaunchTabPanelProps {
  tabId: LaunchTabId
  activeTab: LaunchTabId
  children: React.ReactNode
}

export function LaunchTabPanel({ tabId, activeTab, children }: LaunchTabPanelProps) {
  if (activeTab !== tabId) return null

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={tabId}
        role="tabpanel"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.2 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

export function useLaunchTabs(initial: LaunchTabId = 'create') {
  return useState<LaunchTabId>(initial)
}
