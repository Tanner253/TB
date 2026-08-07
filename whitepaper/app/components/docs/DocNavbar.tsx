'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { APP_URL, DOC_SECTIONS, LINKS, NAV_MENU_GROUPS } from './config'

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  )
}

export function DocNavbar() {
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  return (
    <>
      <header className="doc-nav">
        <div className="doc-nav-bar">
          <a href="#" className="doc-nav-brand">
            <Image src="/logo.png" alt="" width={26} height={26} className="rounded-md" />
            <span className="doc-nav-wordmark">TopBlast</span>
          </a>

          <div className="doc-nav-end">
            <a
              href={LINKS.github}
              target="_blank"
              rel="noopener noreferrer"
              className="doc-nav-icon-btn hidden sm:inline-flex"
              aria-label="GitHub"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
            </a>
            <a
              href={LINKS.twitter}
              target="_blank"
              rel="noopener noreferrer"
              className="doc-nav-icon-btn hidden sm:inline-flex"
              aria-label="X / Twitter"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a href={APP_URL} target="_blank" rel="noopener noreferrer" className="doc-nav-text-link hidden md:inline">
              App
            </a>
            <a href={LINKS.launch} target="_blank" rel="noopener noreferrer" className="doc-nav-cta">
              Launch
            </a>
            <button
              type="button"
              className="doc-nav-icon-btn lg:hidden"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(v => !v)}
            >
              {menuOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>
      </header>

      {menuOpen ? (
        <div className="doc-nav-overlay lg:hidden" role="dialog" aria-modal="true">
          <button type="button" className="doc-nav-backdrop" aria-label="Close menu" onClick={() => setMenuOpen(false)} />
          <div className="doc-nav-drawer">
            <div className="doc-nav-drawer-head">
              <span className="doc-nav-drawer-title">Documentation</span>
              <button type="button" className="doc-nav-icon-btn" onClick={() => setMenuOpen(false)} aria-label="Close">
                <CloseIcon />
              </button>
            </div>
            <nav className="doc-nav-drawer-body">
              {NAV_MENU_GROUPS.map(group => (
                <div key={group.label} className="doc-nav-drawer-group">
                  <p className="doc-nav-drawer-label">{group.label}</p>
                  {group.items.map(item => (
                    <a
                      key={item.href}
                      href={item.href}
                      className="doc-nav-drawer-link"
                      onClick={() => setMenuOpen(false)}
                    >
                      {item.label}
                    </a>
                  ))}
                </div>
              ))}
            </nav>
            <div className="doc-nav-drawer-foot">
              <div className="flex flex-wrap gap-2 mb-3">
                <a href={LINKS.catalog} target="_blank" rel="noopener noreferrer" className="doc-nav-drawer-secondary">
                  Catalog
                </a>
                <a href={LINKS.github} target="_blank" rel="noopener noreferrer" className="doc-nav-drawer-secondary">
                  GitHub
                </a>
                <a href={LINKS.twitter} target="_blank" rel="noopener noreferrer" className="doc-nav-drawer-secondary">
                  X
                </a>
              </div>
              <a href={APP_URL} target="_blank" rel="noopener noreferrer" className="doc-nav-drawer-secondary">
                Open app
              </a>
              <a href={LINKS.launch} target="_blank" rel="noopener noreferrer" className="doc-nav-cta doc-nav-cta--block">
                Launch your token
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

export function DocSubnav() {
  return (
    <nav className="doc-subnav" aria-label="On this page">
      <div className="doc-subnav-scroll">
        {DOC_SECTIONS.map(item => (
          <a key={item.href} href={item.href} className="doc-subnav-pill">
            {item.label}
          </a>
        ))}
      </div>
    </nav>
  )
}
