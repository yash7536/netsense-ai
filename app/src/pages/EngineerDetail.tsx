import { Link, useParams } from "react-router-dom";
import { getEngineer } from "../data/engineers";
import { getLink } from "../data/links";
import { getIncident } from "../data/incidents";
import { cityName } from "../data/cities";
import { dutyStatusTone, TONE_BG, TONE_TEXT } from "../lib/status";
import NotFound from "./NotFound";

// Reuses the same hairline / editorial-caption / telemetry-hero primitives
// used throughout the rest of the app — there is no dedicated Engineer
// Detail screen in the approved Stitch export, so this composes only
// components already established elsewhere rather than inventing new ones.
export default function EngineerDetail() {
  const { engineerId } = useParams();
  const engineer = engineerId ? getEngineer(engineerId) : undefined;
  if (!engineer) return <NotFound label="engineer" backTo="/engineers" backLabel="Back to Engineers" />;

  const link = engineer.assignedLinkId ? getLink(engineer.assignedLinkId) : undefined;
  const incident = engineer.assignedIncidentId ? getIncident(engineer.assignedIncidentId) : undefined;
  const tone = dutyStatusTone(engineer.status);

  return (
    <div className="flex flex-col w-full">
      <Link to="/engineers" className="type-caption uppercase tracking-wider text-outline hover:text-primary transition-colors w-fit inline-block mb-6">
        ← All Engineers
      </Link>

      <section className="w-full pb-10 border-b border-primary">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="type-caption uppercase tracking-wider text-outline mb-3">{engineer.badge}</div>
            <h1 className="type-display-xl text-4xl md:text-5xl lg:text-[56px] leading-[1.05] text-primary">{engineer.name}</h1>
            <p className="type-body-lg text-on-surface-variant mt-4 max-w-xl">
              {engineer.specialisation} · {cityName(engineer.city)} ({engineer.nodeCode})
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${TONE_BG[tone]}`} />
            <span className={`type-caption uppercase tracking-wider font-medium ${TONE_TEXT[tone]}`}>
              {engineer.status === "on-shift" ? "On Shift" : engineer.status === "standby" ? "Standby" : "Off Shift"}
            </span>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-8 py-10 border-b border-outline-variant/60">
        <Field label="Region" value={cityName(engineer.city)} />
        <Field label="Node" value={engineer.nodeCode} mono />
        <Field label="Current Workload" value={engineer.workloadLabel} />
        <Field label="Workload Level" value={`${engineer.workloadPct}%`} mono />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-12 py-10">
        <div>
          <span className="type-caption uppercase tracking-wider text-outline block mb-4">Assigned Corridor</span>
          {link ? (
            <Link to={`/links/${link.id}`} className="group block py-3 border-t border-outline-variant/40">
              <div className="type-headline-md text-primary group-hover:text-secondary transition-colors">{link.name}</div>
              <div className="mt-2 flex items-center gap-2 type-telemetry-code text-outline group-hover:text-primary">
                <span>{link.asn}</span>
                <span className="material-symbols-outlined text-[16px] group-hover:translate-x-0.5 transition-transform">arrow_forward</span>
              </div>
            </Link>
          ) : (
            <p className="type-body-md text-outline pt-3 border-t border-outline-variant/40">No corridor currently assigned.</p>
          )}
        </div>
        <div>
          <span className="type-caption uppercase tracking-wider text-outline block mb-4">Assigned Incident</span>
          {incident ? (
            <Link to={`/incidents/${incident.id}`} className="group block py-3 border-t border-outline-variant/40">
              <div className="type-headline-md text-primary group-hover:text-secondary transition-colors">
                {incident.id} <span className="type-body-md text-on-surface-variant font-normal">— {incident.faultLabel}</span>
              </div>
              <div className="mt-2 flex items-center gap-2 type-telemetry-code text-outline group-hover:text-primary">
                <span className="uppercase">{incident.status}</span>
                <span className="material-symbols-outlined text-[16px] group-hover:translate-x-0.5 transition-transform">arrow_forward</span>
              </div>
            </Link>
          ) : (
            <p className="type-body-md text-outline pt-3 border-t border-outline-variant/40">No incident currently assigned.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="type-caption uppercase tracking-wider text-outline">{label}</span>
      <span className={mono ? "type-telemetry-md text-primary" : "type-body-md text-primary font-medium"}>{value}</span>
    </div>
  );
}
