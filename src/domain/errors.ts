export type DomainErrorCode =
  | "draft_not_awaiting_approval"
  | "draft_not_approved"
  | "draft_not_editable"
  | "email_subject_required"
  | "next_action_not_open"
  | "due_date_in_past"
  | "invalid_snooze";

/** A domain rule was violated. The code is stable; the message is for developers. */
export class DomainError extends Error {
  readonly code: DomainErrorCode;

  constructor(code: DomainErrorCode, message: string) {
    super(message);
    this.name = "DomainError";
    this.code = code;
  }
}
