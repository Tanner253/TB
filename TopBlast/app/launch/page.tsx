'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { FlywheelTokenomics } from '@/components/platform/FlywheelTokenomics'
import {
  LaunchAfterSubmitFlow,
  LaunchSetupChecklist,
  LaunchSkippedCyclesNote,
} from '@/components/tenant/LaunchHowTo'
import { ForCreatorsSection } from '@/components/platform/ForCreatorsSection'
import { ChartVolumeExplainer } from '@/components/platform/ChartVolumeExplainer'
import { DynamicPotExplainer } from '@/components/platform/DynamicPotExplainer'
import { EligibilityRequirements } from '@/components/tenant/EligibilityRequirements'
import { AppHeader } from '@/components/platform/AppHeader'
import { LaunchStepNav, LaunchTabBar, LaunchTabPanel, useLaunchTabs } from '@/components/launch/LaunchTabs'
import { DEV_HERO, TRUST_FOOTER } from '@/lib/marketing/devValueProp'
import { appHostname } from '@/lib/marketing/urls'
import {
  DEFAULT_PAYOUT_INTERVAL_MINUTES,
  PAYOUT_INTERVAL_OPTIONS,
} from '@/lib/platform/payoutIntervals'
import { DEFAULT_MIN_TOKEN_HOLDING } from '@/lib/platform/minTokenHolding'
import { LAUNCH_KEY_HELP, formatWinnerCountPreview } from '@/lib/tenant/launchHelp'
import { DEFAULT_WINNER_COUNT, WINNER_COUNT_OPTIONS } from '@/lib/payout/winnerCount'
import { RECOMMENDED_LISTING, RECOMMENDED_LISTING_WHY } from '@/lib/platform/recommendedListing'
import { ChainDepositNotice } from '@/components/ui/ChainDepositNotice'
import { isListingFormValid, validateListingForm } from '@/lib/platform/listingFormValidation'

export default function LaunchPage() {
  const router = useRouter()
  // Starts on the setup guide: listing hands over an encrypted key and locks
  // rules that cannot be changed afterwards, so the form is the last step.
  const wizard = useLaunchTabs('setup')
  const { activeTab, setActiveTab } = wizard
  const [form, setForm] = useState({
    slug: '',
    symbol: '',
    mint: '',
    payoutWalletPrivateKey: '',
    payoutIntervalMinutes: DEFAULT_PAYOUT_INTERVAL_MINUTES,
    minTokenHolding: DEFAULT_MIN_TOKEN_HOLDING,
    winnerCount: DEFAULT_WINNER_COUNT,
    payoutMode: 'token' as 'token' | 'sol',
  })
  const [submitting, setSubmitting] = useState(false)
  // Show a field's problem once it has been left, not while it is being typed.
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const fieldErrors = validateListingForm(form)
  const formValid = isListingFormValid(form)
  const markTouched = (name: string) => setTouched(t => (t[name] ? t : { ...t, [name]: true }))
  const FieldError = ({ name }: { name: keyof typeof fieldErrors }) =>
    touched[name] && fieldErrors[name] ? (
      <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors[name]}</p>
    ) : null
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          minTokenHolding: form.minTokenHolding || DEFAULT_MIN_TOKEN_HOLDING,
        }),
      })
      const json = await res.json()
      if (!json.success) {
        throw new Error(json.error || 'Listing failed')
      }
      setForm(f => ({ ...f, payoutWalletPrivateKey: '' }))
      router.push(`/${json.data.slug}/leaderboard`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Listing failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <AppHeader active="launch" />

      <main className="max-w-3xl mx-auto px-6 py-10 md:py-12">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <header className="mb-8">
            <p className="text-sol-purple text-xs font-semibold uppercase tracking-[0.14em] mb-2">Self-serve listing</p>
            <h1 className="text-3xl font-bold mb-2">{DEV_HERO.cta}</h1>
            <p className="text-ink-2 text-sm md:text-base max-w-2xl">{DEV_HERO.subhead}</p>
          </header>

          <div className="mb-8">
            <LaunchTabBar
              activeTab={activeTab}
              onTabChange={setActiveTab}
              seen={wizard.seen}
              canCreate={wizard.canCreate}
            />
          </div>

          <LaunchTabPanel tabId="create" activeTab={activeTab}>
            <form onSubmit={handleSubmit} className="glass-panel rounded-2xl p-6 md:p-8 border-rh-green/20 space-y-5">
              <p className="text-sm text-ink-3">
                Fill in your token details below. Want to re-read anything?{' '}
                <button
                  type="button"
                  onClick={() => setActiveTab('setup')}
                  className="text-sol-purple hover:text-sol-purple-dark underline underline-offset-2"
                >
                  Back to the setup guide
                </button>
                .
              </p>

              <div className="rounded-xl border border-sol-purple/25 bg-sol-purple/[0.06] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-sol-purple">Recommended setup</p>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, ...RECOMMENDED_LISTING }))}
                    className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-on-accent hover:bg-accent-hover transition-colors"
                  >
                    Use recommended
                  </button>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-2">{RECOMMENDED_LISTING_WHY}</p>
              </div>

              <label className="block">
                <span className="text-sm text-ink-2">URL slug</span>
                <input
                  required
                  value={form.slug}
                  onChange={e =>
                    setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))
                  }
                  onBlur={() => markTouched('slug')
                  }
                  placeholder="my-token"
                  className="mt-1 w-full rounded-lg bg-card/70 border border-line px-4 py-3 font-mono text-sm focus:border-rh-green/50 outline-none"
                />
                <p className="text-xs text-ink-3 mt-1">
                  Session URL: {appHostname()}/{form.slug || 'your-slug'}
                </p>
                <FieldError name="slug" />
              </label>

              <label className="block">
                <span className="text-sm text-ink-2">Ticker symbol</span>
                <input
                  required
                  value={form.symbol}
                  onChange={e => setForm(f => ({ ...f, symbol: e.target.value.toUpperCase() }))
                  }
                  onBlur={() => markTouched('symbol')}
                  placeholder="BLAST"
                  maxLength={12}
                  className="mt-1 w-full rounded-lg bg-card/70 border border-line px-4 py-3 focus:border-rh-green/50 outline-none"
                />
                <FieldError name="symbol" />
              </label>

              <label className="block">
                <span className="text-sm text-ink-2">Pons token contract address</span>
                <span className="mt-1 block text-xs text-ink-3">
                  Must be an <strong className="text-sol-purple">ETH-paired</strong> Pons launch on
                  Robinhood Chain. Pons lets you pair with any token, but the reward pot, the loss
                  rankings and the buyback are all priced in ETH — a launch paired with anything else
                  can&rsquo;t be serviced here.
                </span>
                <FieldError name="mint" />
                <input
                  required
                  value={form.mint}
                  onChange={e => setForm(f => ({ ...f, mint: e.target.value.trim() }))
                  }
                  onBlur={() => markTouched('mint')}
                  placeholder="0x…"
                  className="mt-1 w-full rounded-lg bg-card/70 border border-line px-4 py-3 font-mono text-sm focus:border-rh-green/50 outline-none"
                />
              </label>

              <label className="block">
                <span className="text-sm text-ink-2">{LAUNCH_KEY_HELP.payoutInterval.title}</span>
                <select
                  value={form.payoutIntervalMinutes}
                  onChange={e => setForm(f => ({ ...f, payoutIntervalMinutes: Number(e.target.value) }))}
                  className="mt-1 w-full rounded-lg bg-card/70 border border-line px-4 py-3 text-sm focus:border-rh-green/50 outline-none"
                >
                  {PAYOUT_INTERVAL_OPTIONS.map(opt => (
                    <option key={opt.minutes} value={opt.minutes}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-ink-3 mt-2">{LAUNCH_KEY_HELP.payoutInterval.body}</p>
              </label>

              <label className="block">
                <span className="text-sm text-ink-2">{LAUNCH_KEY_HELP.winnerCount.title}</span>
                <select
                  value={form.winnerCount}
                  onChange={e => setForm(f => ({ ...f, winnerCount: Number(e.target.value) }))}
                  className="mt-1 w-full rounded-lg bg-card/70 border border-line px-4 py-3 text-sm focus:border-rh-green/50 outline-none"
                >
                  {WINNER_COUNT_OPTIONS.map(n => (
                    <option key={n} value={n}>
                      {formatWinnerCountPreview(n)}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-ink-3 mt-2">{LAUNCH_KEY_HELP.winnerCount.body}</p>
              </label>

              <fieldset>
                <legend className="text-sm text-ink-2">{LAUNCH_KEY_HELP.payoutMode.title}</legend>
                <div className="mt-1 grid gap-3 sm:grid-cols-2">
                  {(['token', 'sol'] as const).map(mode => {
                    const opt = LAUNCH_KEY_HELP.payoutMode.options[mode]
                    const selected = form.payoutMode === mode
                    return (
                      <label
                        key={mode}
                        className={`cursor-pointer rounded-xl border p-4 transition-colors ${
                          selected
                            ? 'border-sol-purple/60 bg-sol-purple/[0.07] ring-1 ring-sol-purple/40'
                            : 'border-line bg-card/70 hover:border-sol-purple/30'
                        }`}
                      >
                        <input
                          type="radio"
                          name="payoutMode"
                          value={mode}
                          checked={selected}
                          onChange={() => setForm(f => ({ ...f, payoutMode: mode }))}
                          className="sr-only"
                        />
                        <span className="flex items-center justify-between gap-2">
                          <span className={`text-sm font-bold ${selected ? 'text-sol-purple' : 'text-ink'}`}>
                            {mode === 'token' ? '📈 ' : '◎ '}
                            {opt.label}
                          </span>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide ${
                              mode === 'token'
                                ? 'bg-sol-mint/10 text-sol-mint'
                                : 'bg-ink/[0.06] text-ink-2'
                            }`}
                          >
                            {opt.tag}
                          </span>
                        </span>
                        <span className="mt-2 block text-xs leading-relaxed text-ink-2">{opt.body}</span>
                      </label>
                    )
                  })}
                </div>
                <p className="text-xs text-ink-3 mt-2">{LAUNCH_KEY_HELP.payoutMode.body}</p>
              </fieldset>

              <label className="block">
                <span className="text-sm text-ink-2">{LAUNCH_KEY_HELP.minTokenHolding.title}</span>
                <input
                  required
                  type="text"
                  inputMode="numeric"
                  min={1}
                  value={String(form.minTokenHolding)}
                  onChange={e => {
                    const cleaned = e.target.value.replace(/,/g, '').replace(/[^\d]/g, '')
                    setForm(f => ({
                      ...f,
                      minTokenHolding: cleaned ? Number(cleaned) : DEFAULT_MIN_TOKEN_HOLDING,
                    }))
                  }}
                  placeholder={String(DEFAULT_MIN_TOKEN_HOLDING)}
                  className="mt-1 w-full rounded-lg bg-card/70 border border-line px-4 py-3 font-mono text-sm focus:border-rh-green/50 outline-none"
                />
                <p className="text-xs text-ink-3 mt-2">{LAUNCH_KEY_HELP.minTokenHolding.body}</p>
              </label>

              <label className="block">
                <span className="text-sm text-ink-2">{LAUNCH_KEY_HELP.payoutWalletPrivateKey.title}</span>
                <input
                  required
                  type="password"
                  autoComplete="off"
                  value={form.payoutWalletPrivateKey}
                  onChange={e => setForm(f => ({ ...f, payoutWalletPrivateKey: e.target.value.trim() }))
                  }
                  onBlur={() => markTouched('payoutWalletPrivateKey')}
                  placeholder="EVM private key (0x…) — fund with ETH on Robinhood Chain"
                  className="mt-1 w-full rounded-lg bg-card/70 border border-line px-4 py-3 font-mono text-sm focus:border-rh-green/50 outline-none"
                />
                <p className="text-xs text-ink-3 mt-2">{LAUNCH_KEY_HELP.payoutWalletPrivateKey.body}</p>
                <FieldError name="payoutWalletPrivateKey" />
                <ChainDepositNotice className="mt-2" />
              </label>

              {error ? <p className="text-red-600 dark:text-red-400 text-sm">{error}</p> : null}

              <button
                type="submit"
                disabled={submitting || !formValid}
                title={formValid ? undefined : 'Complete every field above first'}
                className="w-full py-3 bg-sol-gradient text-on-accent rounded-xl font-bold disabled:opacity-50"
              >
                {submitting
                  ? 'Creating listing…'
                  : formValid
                    ? 'Create listing & start TopBlast'
                    : 'Complete the form to continue'}
              </button>

              <p className="text-xs text-ink-3 text-center">
                Keys are encrypted at rest.{' '}
                <button
                  type="button"
                  onClick={() => setActiveTab('fees')}
                  className="text-ink-2 hover:text-sol-purple underline underline-offset-2"
                >
                  Platform fee details
                </button>
              </p>
            </form>
          </LaunchTabPanel>

          <LaunchTabPanel tabId="setup" activeTab={activeTab}>
            <div className="space-y-6">
              <LaunchSetupChecklist />
              <LaunchAfterSubmitFlow />
              <LaunchStepNav wizard={wizard} nextLabel="Next: payout rules →" />
            </div>
          </LaunchTabPanel>

          <LaunchTabPanel tabId="payouts" activeTab={activeTab}>
            <div className="space-y-6">
              <ChartVolumeExplainer compact showCatalogLink={false} />
              <DynamicPotExplainer compact hideTimer winnerCount={form.winnerCount} />
              <section className="rounded-2xl border border-line bg-card/70 p-6">
                <h2 className="text-lg font-bold mb-4">Eligibility requirements</h2>
                <EligibilityRequirements variant="compact" />
              </section>
              <LaunchSkippedCyclesNote className="rounded-2xl border border-amber-500/20 bg-amber-950/10 p-6" />
              <LaunchStepNav wizard={wizard} nextLabel="Next: fees & trust →" />
            </div>
          </LaunchTabPanel>

          <LaunchTabPanel tabId="fees" activeTab={activeTab}>
            <div className="space-y-6">
              <ForCreatorsSection
                compact
                hideHero
                showLaunchCta={false}
                showBenefits={false}
                showTrustFooter={false}
              />
              <FlywheelTokenomics compact />
              <p className="text-xs text-ink-3 rounded-xl border border-line bg-ink/[0.02] p-4">
                {TRUST_FOOTER}
              </p>
              <LaunchStepNav wizard={wizard} nextLabel="I've read this — create my listing →" />
            </div>
          </LaunchTabPanel>
        </motion.div>
      </main>
    </div>
  )
}
