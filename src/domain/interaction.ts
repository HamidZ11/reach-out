import { z } from "zod";
import { MeetingFormatSchema, MessageChannelSchema } from "./channels";
import { InteractionIdSchema, OpportunityIdSchema, PersonIdSchema, UserIdSchema } from "./ids";
import { InstantSchema } from "./time";

/**
 * Something that happened between the user and a person: the correspondence
 * history. Interactions are facts about the past; scheduled future work is a
 * NextAction, not an Interaction.
 */
const InteractionBase = z.object({
  id: InteractionIdSchema,
  userId: UserIdSchema,
  personId: PersonIdSchema,
  /** The opportunity this exchange was about, when there was one. */
  opportunityId: OpportunityIdSchema.optional(),
  occurredAt: InstantSchema,
  /** User-authored (or, later, provider-derived) account of what was said. */
  summary: z.string().trim().min(1),
  createdAt: InstantSchema,
  updatedAt: InstantSchema,
});

const MessageFields = {
  channel: MessageChannelSchema,
  subject: z.string().trim().min(1).optional(),
  body: z.string().trim().min(1).optional(),
};

export const MessageSentSchema = InteractionBase.extend({
  kind: z.literal("message_sent"),
  ...MessageFields,
});
export type MessageSent = z.infer<typeof MessageSentSchema>;

export const MessageReceivedSchema = InteractionBase.extend({
  kind: z.literal("message_received"),
  ...MessageFields,
});
export type MessageReceived = z.infer<typeof MessageReceivedSchema>;

export const MeetingSchema = InteractionBase.extend({
  kind: z.literal("meeting"),
  format: MeetingFormatSchema,
});
export type Meeting = z.infer<typeof MeetingSchema>;

/** A dated timeline entry written by the user. Not an exchange with the person. */
export const NoteSchema = InteractionBase.extend({
  kind: z.literal("note"),
});
export type Note = z.infer<typeof NoteSchema>;

export const InteractionSchema = z.discriminatedUnion("kind", [
  MessageSentSchema,
  MessageReceivedSchema,
  MeetingSchema,
  NoteSchema,
]);
export type Interaction = z.infer<typeof InteractionSchema>;
export type InteractionKind = Interaction["kind"];

/** An exchange is contact in either direction. Notes are not exchanges. */
export type Exchange = MessageSent | MessageReceived | Meeting;

export function isExchange(interaction: Interaction): interaction is Exchange {
  return interaction.kind !== "note";
}
