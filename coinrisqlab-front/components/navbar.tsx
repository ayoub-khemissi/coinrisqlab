"use client";

import { useState } from "react";
import {
  Navbar as HeroUINavbar,
  NavbarContent,
  NavbarBrand,
  NavbarItem,
  NavbarMenuToggle,
  NavbarMenu,
  NavbarMenuItem,
} from "@heroui/navbar";
import { Link } from "@heroui/link";
import NextLink from "next/link";

import { siteConfig } from "@/config/site";
import { ThemeSwitch } from "@/components/theme-switch";

const menuItems = [
  {
    label: "Home",
    href: "/",
  },
  {
    label: "CoinRisqLab 80 Index",
    href: "/index-coinrisqlab",
  },
  {
    label: "Portfolio Risk",
    href: "/portfolio-risk",
  },
  {
    label: "Methodology",
    href: "/methodology",
  },
];

export const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <HeroUINavbar
      shouldHideOnScroll
      isMenuOpen={isMenuOpen}
      maxWidth="xl"
      position="sticky"
      onMenuOpenChange={setIsMenuOpen}
    >
      {/* Mobile menu toggle */}
      <NavbarContent className="sm:hidden" justify="start">
        <NavbarMenuToggle
          aria-label={isMenuOpen ? "Close menu" : "Open menu"}
        />
      </NavbarContent>

      {/* Mobile brand (centered) */}
      <NavbarContent className="sm:hidden pr-3" justify="center">
        <NavbarBrand>
          <NextLink className="flex justify-start items-center gap-2" href="/">
            <p className="font-bold text-xl text-inherit">{siteConfig.name}</p>
          </NextLink>
        </NavbarBrand>
      </NavbarContent>

      {/* Desktop brand and menu items */}
      <NavbarContent className="hidden sm:flex gap-4" justify="start">
        <NavbarBrand as="li" className="gap-3 max-w-fit">
          <NextLink className="flex justify-start items-center gap-2" href="/">
            <p className="font-bold text-xl text-inherit">{siteConfig.name}</p>
          </NextLink>
        </NavbarBrand>
        <NavbarItem>
          <Link as={NextLink} color="foreground" href="/index-coinrisqlab">
            CoinRisqLab 80 Index
          </Link>
        </NavbarItem>
        <NavbarItem>
          <Link as={NextLink} color="foreground" href="/portfolio-risk">
            Portfolio Risk
          </Link>
        </NavbarItem>
        <NavbarItem>
          <Link as={NextLink} color="foreground" href="/methodology">
            Methodology
          </Link>
        </NavbarItem>
      </NavbarContent>

      {/* Theme switch (always visible) */}
      <NavbarContent justify="end">
        <ThemeSwitch />
      </NavbarContent>

      {/* Mobile menu */}
      <NavbarMenu>
        {menuItems.map((item, index) => (
          <NavbarMenuItem key={`${item.label}-${index}`}>
            <Link
              className="w-full"
              color="foreground"
              href={item.href}
              size="lg"
              onPress={() => setIsMenuOpen(false)}
            >
              {item.label}
            </Link>
          </NavbarMenuItem>
        ))}
      </NavbarMenu>
    </HeroUINavbar>
  );
};
