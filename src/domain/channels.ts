import { z } from "zod";

/** How a message travels. Provider-independent: "email" covers Gmail, Outlook or anything else. */
export const MESSAGE_CHANNELS = ["email", "linkedin", "other"] as const;
export const MessageChannelSchema = z.enum(MESSAGE_CHANNELS);
export type MessageChannel = z.infer<typeof MessageChannelSchema>;

export const MEETING_FORMATS = ["in_person", "video", "phone"] as const;
export const MeetingFormatSchema = z.enum(MEETING_FORMATS);
export type MeetingFormat = z.infer<typeof MeetingFormatSchema>;
