import { Link } from "react-router-dom";

interface NotFoundProps {
  label?: string;
  backTo?: string;
  backLabel?: string;
}

/** Minimal, typographic-only fallback for an unknown record id — kept in the
 *  same restrained voice as the rest of the interface, no illustration. */
export default function NotFound({ label = "record", backTo = "/", backLabel = "Back to Overview" }: NotFoundProps) {
  return (
    <div className="flex flex-col w-full py-24 border-b border-surface-container-highest">
      <span className="type-caption uppercase tracking-wider text-outline mb-4">Not found</span>
      <h1 className="type-headline-lg text-primary mb-4">This {label} doesn't exist.</h1>
      <p className="type-body-md text-on-surface-variant mb-8 max-w-lg">
        The identifier in the address doesn't match anything in the current dataset.
      </p>
      <Link to={backTo} className="type-body-md text-primary hover:text-secondary font-medium underline underline-offset-4 w-fit">
        {backLabel}
      </Link>
    </div>
  );
}
