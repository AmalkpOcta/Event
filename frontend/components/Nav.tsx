"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/lib/auth";
import { useAuthModal } from "@/lib/auth-modal";

import { UserAvatar } from "./UserAvatar";

const links = [
  { href: "/#events", label: "Events", id: "events" },
  { href: "/#about", label: "About", id: "about" },
  { href: "/#contact", label: "Contact", id: "contact" },
];

export function Nav() {
  const { user, loading, logout } = useAuth();
  const { openLogin } = useAuthModal();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const onHome = pathname === "/";

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (!menuRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function scrollToSection(id: string) {
    setMobileOpen(false);
    if (onHome) {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
      history.replaceState(null, "", `/#${id}`);
      return;
    }
    router.push(`/#${id}`);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-zinc-950/70 text-white backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="shrink-0 text-lg font-semibold tracking-tight">
          Event<span className="text-rose-500">Hive</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <button
              key={link.id}
              type="button"
              onClick={() => scrollToSection(link.id)}
              className="rounded-full px-3 py-1.5 text-sm text-zinc-300 transition hover:bg-white/10 hover:text-white"
            >
              {link.label}
            </button>
          ))}

          {!loading && user ? (
            <div className="relative ml-2" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                className="flex h-9 items-center gap-2 rounded-full border border-white/15 bg-white/5 py-0.5 pl-0.5 pr-2.5 transition hover:border-rose-300/40"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                aria-label="Account menu"
              >
                <UserAvatar name={user.name} email={user.email} size={32} />
                <span className="hidden max-w-[7rem] truncate text-sm font-medium lg:inline">
                  {user.name.split(" ")[0]}
                </span>
              </button>
              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-52 overflow-hidden rounded-2xl border border-zinc-200 bg-white py-1 text-zinc-900 shadow-lg"
                >
                  <div className="border-b border-zinc-200 px-3 py-2">
                    <p className="truncate text-sm font-medium">{user.name}</p>
                    <p className="truncate text-xs text-zinc-500">{user.email}</p>
                  </div>
                  <Link
                    href="/org"
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="block px-3 py-2 text-sm hover:bg-zinc-50"
                  >
                    Organizer dashboard
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      void logout();
                    }}
                    className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-rose-50"
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="ml-2 flex items-center gap-2">
              <button
                type="button"
                onClick={openLogin}
                className="rounded-full px-3 py-1.5 text-sm text-zinc-300 transition hover:text-white"
              >
                Log in
              </button>
              <Link
                href="/subscribe"
                className="rounded-full bg-rose-600 px-3.5 py-1.5 text-sm font-medium text-white transition hover:bg-rose-500"
              >
                Subscribe
              </Link>
            </div>
          )}
        </nav>

        <div className="flex items-center gap-2 md:hidden">
          {!loading && user ? (
            <Link href="/org" aria-label="Organizer dashboard">
              <UserAvatar name={user.name} email={user.email} size={32} />
            </Link>
          ) : (
            <Link
              href="/subscribe"
              className="rounded-full bg-rose-600 px-3 py-1.5 text-xs font-medium text-white"
            >
              Subscribe
            </Link>
          )}
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20"
            aria-label="Open menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((o) => !o)}
          >
            <span className="sr-only">Menu</span>
            {mobileOpen ? (
              <span className="text-lg leading-none">✕</span>
            ) : (
              <span className="flex flex-col gap-1.5" aria-hidden>
                <span className="block h-0.5 w-4 bg-white" />
                <span className="block h-0.5 w-4 bg-white" />
                <span className="block h-0.5 w-4 bg-white" />
              </span>
            )}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-white/10 bg-zinc-950 px-4 py-4 md:hidden">
          <div className="flex flex-col gap-1">
            {links.map((link) => (
              <button
                key={link.id}
                type="button"
                onClick={() => scrollToSection(link.id)}
                className="rounded-xl px-3 py-3 text-left text-sm text-zinc-200 hover:bg-white/10"
              >
                {link.label}
              </button>
            ))}
            {!loading && !user && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    openLogin();
                  }}
                  className="rounded-xl px-3 py-3 text-left text-sm text-zinc-200 hover:bg-white/10"
                >
                  Log in
                </button>
                <Link
                  href="/subscribe"
                  onClick={() => setMobileOpen(false)}
                  className="mt-1 rounded-full bg-rose-600 px-3 py-2.5 text-center text-sm font-medium text-white"
                >
                  Subscribe
                </Link>
              </>
            )}
            {!loading && user && (
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  void logout();
                }}
                className="rounded-xl px-3 py-3 text-left text-sm text-rose-400 hover:bg-white/10"
              >
                Log out
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
