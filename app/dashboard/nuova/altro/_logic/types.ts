// FILE: app/dashboard/nuova/altro/_logic/types.ts
export type Suggestion = {
  id: string;
  main: string;
  secondary?: string;
};

export type AddressParts = {
  indirizzo: string;
  citta: string;
  cap: string;
  paese: string;
};
