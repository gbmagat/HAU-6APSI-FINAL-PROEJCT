"use client";

import { usePassport } from "@/components/passport-provider";

export function DataStatus() {
  const { storageError } = usePassport();
  return storageError ? <div className="preview-banner" role="alert">{storageError}</div> : null;
}
