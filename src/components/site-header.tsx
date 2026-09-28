"use client";

import {
  BookOpen,
  CircleUserRound,
  Heart,
  Map,
  Menu,
  Newspaper,
  X,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { BrandMark } from "@/components/brand-mark";

const primaryNavigation = [
  { href: "/feed", label: "Feed", icon: Newspaper },
  { href: "/map", label: "Map", icon: Map },
  { href: "/wishlist", label: "Wishlist", icon: Heart },
  { href: "/archive", label: "Archive", icon: BookOpen },
  { href: "/profile", label: "Profile", icon: CircleUserRound },
] as const;

const mobileNavigation = [
  { href: "/map", label: "Map", iconSrc: "/assets/nav-map-inactive.svg", activeIconSrc: "/assets/nav-map.svg" },
  { href: "/feed", label: "Feed", iconSrc: "/assets/nav-feed.svg", activeIconSrc: "/assets/nav-feed-active.svg" },
  { href: "/visits/new", label: "Add", iconSrc: "/assets/nav-add-inactive.svg", activeIconSrc: "/assets/nav-add.svg" },
  { href: "/archive", label: "Archive", iconSrc: "/assets/nav-archive.svg", activeIconSrc: "/assets/nav-archive-active.svg" },
] as const;

function isCurrentPath(pathname: string, href: string) {
  if (href === "/feed" && pathname.startsWith("/places/")) return true;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <header className="site-header">
        <div className="site-header__content">
          <Link href="/feed" className="brand-link">
            <BrandMark />
          </Link>

          <nav className="desktop-nav" aria-label="Primary navigation">
            {primaryNavigation.map(({ href, label }) => {
              const active = isCurrentPath(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={active ? "nav-link nav-link--active" : "nav-link"}
                  aria-current={active ? "page" : undefined}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          <button
            className="mobile-menu-button"
            type="button"
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>

        {menuOpen && (
          <nav className="mobile-menu" aria-label="Expanded navigation">
            {primaryNavigation.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={isCurrentPath(pathname, href) ? "is-active" : ""}
                onClick={() => setMenuOpen(false)}
              >
                <Icon size={18} aria-hidden="true" />
                {label}
              </Link>
            ))}
          </nav>
        )}
      </header>

      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        {mobileNavigation.map(({ href, label, iconSrc, activeIconSrc }) => {
          const active = isCurrentPath(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={active ? "mobile-tab is-active" : "mobile-tab"}
              aria-current={active ? "page" : undefined}
            >
              <Image src={active ? activeIconSrc : iconSrc} alt="" width={20} height={20} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
