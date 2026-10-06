"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";
import * as Icon from "@/components/icons";
import type { Goals, Objective, User } from "@/domain/user";
import { GoalsSchema, OBJECTIVES, UserSchema } from "@/domain/user";
import { SettingsLink } from "@/features/people/people-phone";
import pp from "@/features/people/people.module.css";
import { SECTIONS } from "@/features/sections";
import { useAnnouncer } from "@/features/today/item-actions";
import t from "@/features/today/today.module.css";
import { OBJECTIVE_OPTIONS } from "@/features/workspace/goals";
import { problemMessage } from "@/features/workspace/outcome";
import type { Workspace } from "@/features/workspace/records";
import type { GmailActions, GmailOutcome, GmailSettings } from "./gmail";
import type { SettingsActions, SettingsOutcome } from "./operations";
import k from "./settings.module.css";

/**
 * Settings: your profile and what you're aiming for. Things Reachout can't do
 * yet are marked plainly rather than shown as controls that do nothing.
 *
 * Changes are saved to your account before Settings says so.
 */

const SAVED = "Saved.";

/** Who is signed in, and how to sign out (absent in the development seed session). */
export type Account = { email: string; signOut?: () => Promise<void> };

/** Both layouts render; ids are prefixed per layout so each stays unique. */
const IdPrefix = createContext("");
const usePrefixed = (id: string) => `${useContext(IdPrefix)}${id}`;

function Section({
  id,
  title,
  description,
  marker,
  children,
}: {
  id: string;
  title: string;
  description: string;
  marker?: ReactNode;
  children: ReactNode;
}) {
  const headingId = usePrefixed(id);
  return (
    <section className={k.setSection} aria-labelledby={headingId}>
      <div className={k.setIntro}>
        <h2 id={headingId} className={k.setTitle}>
          {title}
          {marker}
        </h2>
        <p className={k.setDescription}>{description}</p>
      </div>
      <div className={k.setBody}>{children}</div>
    </section>
  );
}

function Later({ children = "Not available yet" }: { children?: ReactNode }) {
  return (
    <span className={k.later}>
      <Icon.Clock size={13} weight={2} />
      {children}
    </span>
  );
}

function Problem({ id, text }: { id: string; text?: string }) {
  if (!text) return null;
  return (
    <p id={id} className={k.problem}>
      <span className={t.dot} data-tone="now" aria-hidden="true" />
      {text}
    </p>
  );
}

/* ——— Profile ——— */

type ProfileForm = {
  name: string;
  email: string;
  institution: string;
  course: string;
  graduationYear: string;
  timeZone: string;
};

const PROFILE_HELP: Record<string, string> = {
  name: "Add your name.",
  education: "Add your university, course and graduation year, or leave all three empty.",
  graduationYear: "Use a year, like 2028.",
  timeZone: "Choose a time zone.",
};

function profileOf(user: User): ProfileForm {
  return {
    name: user.name,
    email: user.email,
    institution: user.education?.institution ?? "",
    course: user.education?.course ?? "",
    graduationYear: user.education ? String(user.education.graduationYear) : "",
    timeZone: user.timeZone,
  };
}

const NO_ZONES: readonly string[] = [];
let zones: readonly string[] | undefined;

/** The browser's own list of zones. Runtimes differ, so the server never renders it. */
function browserZones(): readonly string[] {
  if (!zones) {
    try {
      zones = Intl.supportedValuesOf("timeZone");
    } catch {
      zones = NO_ZONES;
    }
  }
  return zones;
}

const unchanging = () => () => {};

/** Empty while hydrating, then the full list: server and client agree on first paint. */
function useZones(): readonly string[] {
  return useSyncExternalStore(unchanging, browserZones, () => NO_ZONES);
}

function ProfileSection({
  user,
  onSave,
}: {
  user: User;
  /** Resolves once saved, or not. */
  onSave: (user: User) => Promise<boolean>;
}) {
  const [form, setForm] = useState<ProfileForm>(() => profileOf(user));
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(profileOf(user));
  const known = useZones();
  const zoneOptions = known.includes(form.timeZone) ? known : [form.timeZone, ...known];
  const prefix = useContext(IdPrefix);
  const idOf = (key: string) => `${prefix}set-${key}`;

  const save = () => {
    const anyEducation = [form.institution, form.course, form.graduationYear].some((v) => v.trim());
    const result = UserSchema.safeParse({
      ...user,
      name: form.name,
      timeZone: form.timeZone,
      education: anyEducation
        ? {
            institution: form.institution,
            course: form.course,
            graduationYear: Number(form.graduationYear),
          }
        : undefined,
    });
    if (!result.success) {
      const found: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const [head, field] = issue.path;
        const key =
          head === "education"
            ? field === "graduationYear"
              ? "graduationYear"
              : "education"
            : String(head);
        found[key] ??= PROFILE_HELP[key] ?? issue.message;
      }
      setProblems(found);
      return;
    }
    setProblems({});
    setSaving(true);
    void onSave(result.data).finally(() => setSaving(false));
  };

  const field = (
    key: keyof ProfileForm,
    label: string,
    props: {
      type?: string;
      inputMode?: "numeric" | "email";
      autoComplete?: string;
      readOnly?: boolean;
      "aria-describedby"?: string;
    } = {},
    problemKey: string = key,
  ) => (
    <div className={k.field}>
      <label className={k.fieldLabel} htmlFor={idOf(key)}>
        {label}
      </label>
      <input
        id={idOf(key)}
        className={k.input}
        value={form[key]}
        aria-invalid={problems[problemKey] ? true : undefined}
        aria-describedby={problems[problemKey] ? idOf(`${problemKey}-problem`) : undefined}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        {...props}
      />
      {props["aria-describedby"] && (
        <p id={props["aria-describedby"]} className={k.fieldHint}>
          You sign in with this address.
        </p>
      )}
    </div>
  );

  return (
    <Section
      id="settings-profile"
      title="Profile"
      description="Your name, university and time zone."
    >
      <div className={k.fields}>
        {field("name", "Name", { autoComplete: "name" })}
        <Problem id={idOf("name-problem")} text={problems.name} />
        {field("email", "Email", {
          type: "email",
          autoComplete: "email",
          readOnly: true,
          "aria-describedby": idOf("email-hint"),
        })}
        <div className={k.pair}>
          {field("institution", "University", { autoComplete: "organization" }, "education")}
          {field("course", "Course", {}, "education")}
        </div>
        {field("graduationYear", "Graduating", { inputMode: "numeric" }, "graduationYear")}
        <Problem id={idOf("education-problem")} text={problems.education} />
        <Problem id={idOf("graduationYear-problem")} text={problems.graduationYear} />
        <div className={k.field}>
          <label className={k.fieldLabel} htmlFor={idOf("timeZone")}>
            Time zone
          </label>
          <select
            id={idOf("timeZone")}
            className={k.input}
            value={form.timeZone}
            onChange={(e) => setForm({ ...form, timeZone: e.target.value })}
          >
            {zoneOptions.map((z) => (
              <option key={z} value={z}>
                {z.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <p className={k.fieldHint}>Today starts at midnight here.</p>
        </div>
      </div>
      {dirty && (
        <div className={k.saveBar}>
          <button
            type="button"
            className={`${t.primary} ${t.small}`}
            onClick={save}
            disabled={saving}
          >
            Save changes
          </button>
          <button
            type="button"
            className={`${t.text} ${t.small}`}
            onClick={() => {
              setForm(profileOf(user));
              setProblems({});
            }}
          >
            Discard
          </button>
        </div>
      )}
    </Section>
  );
}

/* ——— What you're aiming for ——— */

type ListKey = "targetRoles" | "targetSectors" | "targetLocations";

const LISTS: { key: ListKey; label: string; add: string }[] = [
  { key: "targetRoles", label: "Roles", add: "Add a role" },
  { key: "targetSectors", label: "Industries", add: "Add an industry" },
  { key: "targetLocations", label: "Places", add: "Add a place" },
];

function TargetEditor({
  label,
  add,
  values,
  onDone,
}: {
  label: string;
  add: string;
  values: string[];
  onDone: (values: string[]) => void;
}) {
  const [list, setList] = useState(values);
  const [own, setOwn] = useState("");
  const [problem, setProblem] = useState<string>();
  const problemId = usePrefixed(`${label}-problem`);
  const append = () => {
    const value = own.trim();
    if (value && !list.some((v) => v.toLowerCase() === value.toLowerCase())) {
      setList([...list, value]);
    }
    setOwn("");
  };
  return (
    <div className={k.editor}>
      <ul className={k.targets} aria-label={label}>
        {list.map((v) => (
          <li key={v} className={k.target}>
            <span>{v}</span>
            <button
              type="button"
              className={k.remove}
              aria-label={`Remove ${v}`}
              onClick={() => setList(list.filter((x) => x !== v))}
            >
              <Icon.Close size={14} weight={2} />
            </button>
          </li>
        ))}
      </ul>
      <div className={k.addRow}>
        <input
          className={k.input}
          aria-label={add}
          placeholder={`${add}…`}
          value={own}
          onChange={(e) => setOwn(e.target.value)}
          onKeyDown={(e) => {
            // Enter in this field adds what you typed, as a form would: not a shortcut.
            if (e.key !== "Enter") return;
            e.preventDefault();
            append();
          }}
        />
        <button
          type="button"
          className={`${t.secondary} ${t.small}`}
          onClick={append}
          disabled={!own.trim()}
        >
          Add
        </button>
      </div>
      <Problem id={problemId} text={problem} />
      <div className={k.saveBar}>
        <button
          type="button"
          className={`${t.primary} ${t.small}`}
          onClick={() => {
            if (list.length === 0) setProblem("Keep at least one.");
            else onDone(list);
          }}
        >
          Done
        </button>
      </div>
    </div>
  );
}

function GoalsSection({
  user,
  onSave,
}: {
  user: User;
  onSave: (goals: Goals) => Promise<boolean>;
}) {
  const goals = user.goals;
  const [editing, setEditing] = useState<ListKey | "objective" | null>(null);
  if (!goals) {
    return (
      <Section
        id="settings-goals"
        title="What you're aiming for"
        description="Set during onboarding."
      >
        <p className={pp.muted}>You haven&apos;t set this yet. Onboarding asks for it first.</p>
      </Section>
    );
  }

  const commit = (patch: Partial<Goals>) => {
    const result = GoalsSchema.safeParse({ ...goals, ...patch });
    if (!result.success) return;
    // The editor stays open until the change is saved.
    void onSave(result.data).then((saved) => {
      if (saved) setEditing(null);
    });
  };
  const objective = OBJECTIVE_OPTIONS.find((o) => o.value === goals.objective);

  return (
    <Section
      id="settings-goals"
      title="What you're aiming for"
      description="What you told onboarding. Change it as your search changes."
    >
      <dl className={k.defs}>
        <div className={k.def}>
          <dt className={k.defTerm}>Aiming for</dt>
          <dd className={k.defValue}>
            {editing === "objective" ? (
              <select
                className={k.input}
                aria-label="Aiming for"
                value={goals.objective}
                onChange={(e) => commit({ objective: e.target.value as Objective })}
              >
                {OBJECTIVES.map((o) => (
                  <option key={o} value={o}>
                    {OBJECTIVE_OPTIONS.find((x) => x.value === o)?.label ?? o}
                  </option>
                ))}
              </select>
            ) : (
              objective?.label
            )}
          </dd>
          {editing !== "objective" && (
            <button
              type="button"
              className={`${t.text} ${t.small}`}
              aria-label="Change what you're aiming for"
              onClick={() => setEditing("objective")}
            >
              Change
            </button>
          )}
        </div>
        {LISTS.map((list) => (
          <div key={list.key} className={k.def}>
            <dt className={k.defTerm}>{list.label}</dt>
            <dd className={k.defValue}>
              {editing === list.key ? (
                <TargetEditor
                  label={list.label}
                  add={list.add}
                  values={goals[list.key]}
                  onDone={(values) => {
                    const patch: Partial<Goals> = {};
                    patch[list.key] = values;
                    commit(patch);
                  }}
                />
              ) : (
                goals[list.key].join(" · ")
              )}
            </dd>
            {editing !== list.key && (
              <button
                type="button"
                className={`${t.text} ${t.small}`}
                aria-label={`Change ${list.label.toLowerCase()}`}
                onClick={() => setEditing(list.key)}
              >
                Change
              </button>
            )}
          </div>
        ))}
      </dl>
    </Section>
  );
}

/* ——— Not built yet, said plainly ——— */

/** "Last checked 14:32, Tue 6 Oct", in the user's time zone. */
function checkedAt(at: string, timeZone: string): string {
  const when = new Date(at);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit" });
  const day = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  return `Last checked ${time.format(when)}, ${day.format(when)}`;
}

/**
 * Gmail, said plainly (D-031): what it does (reads message details to notice
 * what you sent and who replied; never sends, changes or deletes), whether it
 * is connected, and when it last looked.
 */
function GmailRow({ gmail, timeZone }: { gmail: GmailControl; timeZone: string }) {
  const { settings, actions, busy, run } = gmail;
  const connection = settings.connection;
  const reads =
    "Reachout notices what you send to, and receive from, people you track. It only reads message details: it never sends, changes or deletes mail.";

  if (!settings.available) {
    return (
      <div className={k.def}>
        <dt className={k.defTerm}>Gmail</dt>
        <dd className={k.defValue}>
          <Later />
          <span className={k.plain}>{reads} It isn&apos;t set up on this site yet.</span>
        </dd>
      </div>
    );
  }

  if (!connection) {
    return (
      <div className={k.def}>
        <dt className={k.defTerm}>Gmail</dt>
        <dd className={k.defValue}>
          <span className={k.plain}>Not connected. {reads}</span>
        </dd>
        <button
          type="button"
          className={`${t.text} ${t.small}`}
          disabled={busy}
          onClick={() => run(() => actions.connect())}
        >
          Connect
        </button>
      </div>
    );
  }

  const stalled = connection.status === "needs_reconnect";
  return (
    <div className={k.def}>
      <dt className={k.defTerm}>Gmail</dt>
      <dd className={k.defValue}>
        <span>{connection.emailAddress}</span>
        {stalled ? (
          <span className={k.plain}>
            Reconnect needed: Google stopped letting Reachout read this account, so nothing new is
            noticed until you reconnect.
          </span>
        ) : (
          <span className={k.plain}>
            {connection.lastSyncedAt
              ? checkedAt(connection.lastSyncedAt, timeZone)
              : "Connected. Not checked yet."}
            {connection.lastError === "unavailable" && " Gmail couldn't be reached last time."}
          </span>
        )}
        <span>
          <button
            type="button"
            className={`${t.text} ${t.small}`}
            disabled={busy}
            onClick={() => run(() => (stalled ? actions.disconnect() : actions.check()))}
          >
            {stalled ? "Disconnect" : "Check now"}
          </button>
        </span>
      </dd>
      <button
        type="button"
        className={`${t.text} ${t.small}`}
        disabled={busy}
        onClick={() => run(() => (stalled ? actions.connect() : actions.disconnect()))}
      >
        {stalled ? "Reconnect" : "Disconnect"}
      </button>
    </div>
  );
}

/** Gmail's state and actions, shared by both layouts. */
type GmailControl = {
  settings: GmailSettings;
  actions: GmailActions;
  busy: boolean;
  run: (action: () => Promise<GmailOutcome | { ok: false; message: string } | void>) => void;
};

function Boundaries({ gmail, timeZone }: { gmail: GmailControl; timeZone: string }) {
  return (
    <>
      <Section
        id="settings-notifications"
        title="Notifications"
        description="Reminders outside Reachout."
        marker={<Later />}
      >
        <p className={k.plain}>
          Reachout doesn&apos;t send notifications yet. Everything that needs you is in Today.
        </p>
      </Section>

      <Section
        id="settings-accounts"
        title="Connected accounts"
        description="Where your messages go."
      >
        <dl className={k.defs}>
          <GmailRow gmail={gmail} timeZone={timeZone} />
          <div className={k.def}>
            <dt className={k.defTerm}>LinkedIn</dt>
            <dd className={k.defValue}>
              <span className={k.plain}>
                Never connected. Reachout doesn&apos;t automate or read LinkedIn: you send those
                messages yourself and mark them as sent.
              </span>
            </dd>
          </div>
        </dl>
      </Section>

      <Section id="settings-data" title="Your data" description="What you keep here.">
        <dl className={k.defs}>
          <div className={k.def}>
            <dt className={k.defTerm}>People you add</dt>
            <dd className={k.defValue}>
              <span className={k.plain}>
                Stored for you alone. Reachout never enriches, scrapes or shares information about
                them.
              </span>
            </dd>
          </div>
          <div className={k.def}>
            <dt className={k.defTerm}>Delete your account</dt>
            <dd className={k.defValue}>
              <Later />
            </dd>
          </div>
        </dl>
      </Section>
    </>
  );
}

/** Signed in as you; sign out here. In the development seed session there is no sign-in. */
function AccountSection({ account }: { account: Account }) {
  const [leaving, setLeaving] = useState(false);
  const { signOut } = account;
  return (
    <Section id="settings-account" title="Account" description="How you sign in.">
      <dl className={k.defs}>
        <div className={k.def}>
          <dt className={k.defTerm}>Signed in as</dt>
          <dd className={k.defValue}>
            {signOut ? (
              account.email
            ) : (
              <span className={k.plain}>
                The development seed session. Nothing here is saved for good.
              </span>
            )}
          </dd>
          {signOut && (
            <button
              type="button"
              className={`${t.text} ${t.small}`}
              disabled={leaving}
              onClick={() => {
                setLeaving(true);
                void signOut().finally(() => setLeaving(false));
              }}
            >
              Sign out
            </button>
          )}
        </div>
      </dl>
    </Section>
  );
}

function SettingsBody({
  user,
  account,
  actions,
  gmail,
  save,
}: {
  user: User;
  account: Account;
  actions: SettingsActions;
  gmail: GmailControl;
  /** Saves, then says how it went. Resolves true once saved. */
  save: (change: () => Promise<SettingsOutcome>) => Promise<boolean>;
}) {
  return (
    <>
      <ProfileSection
        user={user}
        onSave={(next) =>
          save(() =>
            actions.saveProfile({
              name: next.name,
              timeZone: next.timeZone,
              education: next.education ?? null,
              expected: user.updatedAt,
            }),
          )
        }
      />
      <GoalsSection
        user={user}
        onSave={(goals) => save(() => actions.saveGoals({ goals, expected: user.updatedAt }))}
      />
      <Boundaries gmail={gmail} timeZone={user.timeZone} />
      <AccountSection account={account} />
    </>
  );
}

/**
 * Settings, as approved: a page at the foot of the desktop rail, opened from
 * your avatar on a phone (never a tab). Both compositions render and CSS shows
 * the one that fits; they share the profile and one announcer.
 */
export function Settings({
  workspace,
  actions,
  account,
  gmail: gmailSettings,
  gmailActions,
  notice,
}: {
  workspace: Workspace;
  /** Server Actions in production. */
  actions: SettingsActions;
  account: Account;
  gmail: GmailSettings;
  gmailActions: GmailActions;
  /** Said once on arrival, such as how connecting Gmail went. */
  notice?: string;
}) {
  const { announce, view: toast } = useAnnouncer(undefined, notice);
  const [connection, setConnection] = useState(gmailSettings.connection);
  const [gmailBusy, setGmailBusy] = useState(false);
  // A notice belongs to this arrival only: a reload shouldn't say it again.
  useEffect(() => {
    if (notice && window.location.search)
      window.history.replaceState(null, "", SECTIONS.settings.href);
  }, [notice]);
  const gmail: GmailControl = {
    settings: { available: gmailSettings.available, connection },
    actions: gmailActions,
    busy: gmailBusy,
    run(action) {
      if (gmailBusy) return;
      setGmailBusy(true);
      void action()
        .then((result) => {
          if (!result) return;
          if ("connection" in result) setConnection(result.connection);
          announce(result.message, { undoable: false });
        })
        .catch(() => announce("That didn't work. Try again in a moment.", { undoable: false }))
        .finally(() => setGmailBusy(false));
    },
  };
  const [user, setUser] = useState(workspace.user);
  // A save in one layout resets the other's form to what was saved.
  const [version, setVersion] = useState(0);

  const save = async (change: () => Promise<SettingsOutcome>) => {
    let result: SettingsOutcome;
    try {
      result = await change();
    } catch {
      result = { ok: false, problem: "unavailable" };
    }
    if (!result.ok) {
      announce(problemMessage(result.problem), { undoable: false });
      return false;
    }
    setUser(result.user);
    setVersion((v) => v + 1);
    announce(SAVED);
    return true;
  };

  return (
    <>
      <div className={t.desktopLayout} data-layout="desktop">
        <IdPrefix.Provider value="d-">
          <div className={`${k.settings} ${t.scroll}`}>
            <header className={t.pageHead}>
              <h1 className={t.pageTitle}>Settings</h1>
              <span className={t.pageSub}>Your profile and what you&apos;re aiming for</span>
            </header>
            <SettingsBody
              key={version}
              user={user}
              account={account}
              actions={actions}
              gmail={gmail}
              save={save}
            />
            {toast}
          </div>
        </IdPrefix.Provider>
      </div>
      <div className={`${t.phoneLayout} ${t.mobile} ${pp.mShell}`} data-layout="phone">
        <IdPrefix.Provider value="m-">
          <div className={t.mTop}>
            <Link href={SECTIONS.today.href} className={pp.mBack} aria-label="Back to Today">
              <Icon.ArrowLeft size={18} weight={2} />
              Today
            </Link>
            <SettingsLink name={user.name} />
          </div>
          <header className={t.mHeading}>
            <div className={pp.mHeadingText}>
              <h1 className={t.mTitle}>Settings</h1>
            </div>
          </header>
          <div className={t.mBody}>
            <div className={k.mSettings}>
              <SettingsBody
                key={version}
                user={user}
                account={account}
                actions={actions}
                gmail={gmail}
                save={save}
              />
            </div>
          </div>
          {toast}
        </IdPrefix.Provider>
      </div>
    </>
  );
}
