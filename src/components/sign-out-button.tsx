"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

export function SignOutButton() {
  const router = useRouter();

  return (
    <div>
      <button
        type="button"
        className="button button--tertiary button--compact"
        onClick={async () => {
          try {
            const response = await fetch("/api/auth/logout", { method: "POST" });
            if (response.ok) {
              router.replace("/login");
              router.refresh();
              return;
            }
          } catch {
            // Fall through: the server could not revoke access, so say so.
          }
          window.alert("Sign-out didn’t finish. Check your connection and try again.");
        }}
      >
        <LogOut size={16} aria-hidden="true" />
        Sign out
      </button>
    </div>
  );
}
