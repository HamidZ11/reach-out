/** Where sign-in stands, as the server answers it. */
export type SignInState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "problem"; email: string; message: string; field?: "email" };

export const SIGN_IN_IDLE: SignInState = { status: "idle" };
