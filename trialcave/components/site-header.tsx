import { HeaderBar, type HeaderLink } from "@/components/header-bar";
import { getSessionUser } from "@/lib/auth";
import { currentLanguage } from "@/lib/site-language";
import { ROLE_HOME, type Role } from "@/lib/types";

const PUBLIC_LINKS: HeaderLink[] = [
  { href: "/trials", label: "Find a trial" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/#donate", label: "Data donation" },
  { href: "/#clinics", label: "For clinics" },
];

const HOME_LINKS: HeaderLink[] = [
  { href: "#find", label: "Find a trial" },
  { href: "#how", label: "How it works" },
  { href: "#donate", label: "Data donation" },
  { href: "#clinics", label: "For clinics" },
];

const AREA_LINKS: Record<Role, HeaderLink[]> = {
  patient: [
    { href: "/app", label: "Dashboard", exact: true },
    { href: "/app/matches", label: "Matches" },
    { href: "/app/records", label: "Records" },
    { href: "/app/inbox", label: "Inbox" },
    { href: "/app/profile", label: "Profile" },
    { href: "/app/donor", label: "Data Donor" },
    { href: "/app/settings", label: "Settings" },
  ],
  clinic: [
    { href: "/clinic", label: "Studies", exact: true },
    { href: "/clinic/studies/new", label: "New study" },
    { href: "/trials", label: "Trial library" },
  ],
  researcher: [
    { href: "/enclave", label: "Projects" },
    { href: "/how-it-works#enclave", label: "How the Enclave works" },
  ],
  admin: [{ href: "/admin", label: "Admin", exact: true }],
};

const ROLE_LABEL: Record<Role, string> = {
  patient: "",
  clinic: "Clinic",
  researcher: "Research partner",
  admin: "Admin",
};

/** Public marketing header. `home` is transparent over the homepage hero. */
export async function SiteHeader({ variant = "solid" }: { variant?: "home" | "solid" }) {
  const user = await getSessionUser().catch(() => null);
  const lang = await currentLanguage(user).catch(() => "en" as const);
  return (
    <HeaderBar
      variant={variant}
      links={variant === "home" ? HOME_LINKS : PUBLIC_LINKS}
      lang={lang}
      account={user ? { email: user.email, homeHref: ROLE_HOME[user.role], inArea: false } : null}
    />
  );
}

/** Signed-in area header for a role. */
export async function AreaHeader({ role, subtitle }: { role: Role; subtitle?: string }) {
  const user = await getSessionUser().catch(() => null);
  const lang = await currentLanguage(user).catch(() => "en" as const);
  return (
    <HeaderBar
      variant="solid"
      brandHref={ROLE_HOME[role]}
      links={AREA_LINKS[role]}
      lang={lang}
      roleLabel={subtitle ?? (ROLE_LABEL[role] || undefined)}
      account={user ? { email: user.email, homeHref: ROLE_HOME[user.role], inArea: true } : null}
    />
  );
}
