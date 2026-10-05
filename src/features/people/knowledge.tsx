import type { ReactNode } from "react";
import * as Icon from "@/components/icons";
import type { Person } from "@/domain/person";
import type { Interpretation, SourceFact } from "@/domain/research";
import { PROVENANCE_LABEL } from "@/features/workspace/records";
import type { WorkspaceState } from "@/features/workspace/use-workspace";
import p from "./people.module.css";

/**
 * Three kinds of knowledge, three treatments (DESIGN.md › People): source
 * facts are numbered with where they came from; your notes are in your words;
 * a generated interpretation is labelled, dashed and cites facts by number.
 */

/** What is known about a person and their company, numbered across both. */
export function knowledgeOf(person: Person, day: WorkspaceState) {
  const company = day.index.companyOf(person);
  const personFacts = day.index.factsAbout({ type: "person", id: person.id });
  const companyFacts = company ? day.index.factsAbout({ type: "company", id: company.id }) : [];
  const number = new Map<string, number>(
    [...personFacts, ...companyFacts].map((f, i) => [f.id, i + 1]),
  );
  const readings = day.index.interpretationsAbout({ type: "person", id: person.id });
  return { company, personFacts, companyFacts, number, readings };
}

const PROVENANCE_ICON: Record<SourceFact["provenance"]["kind"], ReactNode> = {
  public_profile: <Icon.People size={13} weight={2} />,
  company_website: <Icon.Building size={13} weight={2} />,
  university_website: <Icon.Building size={13} weight={2} />,
  publication: <Icon.Note size={13} weight={2} />,
  event: <Icon.Calendar size={13} weight={2} />,
  correspondence: <Icon.Chat size={13} weight={2} />,
  other: <Icon.ArrowUpRight size={13} weight={2} />,
};

export function FactList({ facts, first = 1 }: { facts: SourceFact[]; first?: number }) {
  return (
    <ol className={p.facts}>
      {facts.map((f, i) => (
        <li key={f.id} className={p.fact}>
          <span className={p.badge} aria-label={`Fact ${first + i}`}>
            {first + i}
          </span>
          <span>
            {f.statement}
            <span className={p.source}>
              {PROVENANCE_ICON[f.provenance.kind]}
              {f.provenance.url ? (
                <a href={f.provenance.url} target="_blank" rel="noreferrer">
                  {PROVENANCE_LABEL[f.provenance.kind]}
                </a>
              ) : (
                PROVENANCE_LABEL[f.provenance.kind]
              )}
              {f.provenance.detail ? ` · ${f.provenance.detail}` : ""}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Generated, never dressed as fact: each reading cites the facts it was inferred from. */
export function Readings({
  readings,
  number,
}: {
  readings: Interpretation[];
  number: Map<string, number>;
}) {
  return readings.map((r) => (
    <div key={r.id} className={p.generated}>
      {r.text}
      <span className={p.genMeta}>
        <Icon.Inferred size={13} weight={1.75} />
        Inferred from
        {r.basedOnFactIds.map((id) => (
          <span key={id} className={p.badge} aria-label={`fact ${number.get(id) ?? "?"}`}>
            {number.get(id) ?? "?"}
          </span>
        ))}
        ·{" "}
        {r.review === "accepted"
          ? "you kept it"
          : r.review === "dismissed"
            ? "dismissed"
            : "not reviewed"}
      </span>
    </div>
  ));
}
