"use client";

import { KeyRound, LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

export function LoginForm({
  configured,
  allowPreview,
  notice,
}: {
  configured: boolean;
  allowPreview: boolean;
  notice?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || !configured) return;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    if (!password) {
      setError("Enter your password.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (!response.ok) {
        if (response.status === 401) {
          setError("The email or password isn’t correct. Please try again.");
        } else if (response.status === 429) {
          setError("Too many attempts. Please try again in 15 minutes.");
        } else {
          setError("We couldn’t sign you in. Please try again shortly.");
        }
        setSubmitting(false);
        return;
      }

      router.replace("/feed");
      router.refresh();
      setSubmitting(false);
    } catch {
      setError("We couldn’t reach sign-in. Please check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate aria-busy={submitting}>
      {notice && <p className="field-error" role="status">{notice}</p>}
      {!configured && allowPreview && (
        <button
          type="button"
          className="button button--primary button--full"
          onClick={() => router.replace("/feed")}
        >
          <KeyRound size={18} aria-hidden="true" />
          Open frontend preview
        </button>
      )}
      {configured && (
        <>
          <label className="field">
            <span>Email address</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              disabled={submitting}
              required
              placeholder="you@example.com"
              aria-describedby={error ? "sign-in-error" : undefined}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              disabled={submitting}
              required
              placeholder="Enter your password"
              aria-describedby={error ? "sign-in-error" : undefined}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error && <p id="sign-in-error" className="field-error" role="alert">{error}</p>}
          <button type="submit" className="button button--primary button--full" disabled={submitting}>
            <KeyRound size={18} aria-hidden="true" />
            {submitting ? "Entering…" : "Enter Our Places"}
          </button>
        </>
      )}
      <p className="privacy-note">
        <LockKeyhole size={17} aria-hidden="true" />
        A private space, shared only with your invited partner.
      </p>
    </form>
  );
}
