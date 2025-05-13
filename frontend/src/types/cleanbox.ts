// Central place for domain types.
// Extend or re‑export here so every layer uses the same shapes.

export interface Task {
  id: string;
  url?: string;
  status: 'pending' | 'success' | 'failed' | 'processing';
  createdAt: string;
  updatedAt: string;
}

export interface AppStats {
  totalAttempted: number;
  successful: number;
  failed: number;
  emailsAvoidedEstimate: number;
}

/* ------------------------------------------------------------------ */
/*  User shape returned by GET /users/me                              */
/* ------------------------------------------------------------------ */
export interface FetchedUser {
  id: string;
  name: string;
  email: string;                     
  activeGoogleAccount?: {              
    email: string;
  } | null;
}
