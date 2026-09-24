import { Link, useLocation } from "react-router-dom";
import { InboxIcon } from "../components/icons";

/** An address inside the app that doesn't exist, rather than a silent redirect. */
export default function NotFoundPage() {
  const { pathname } = useLocation();
  return (
    <div className="card mx-auto max-w-md px-6 py-12 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-gray-100 text-gray-400">
        <InboxIcon className="h-6 w-6" />
      </span>
      <h1 className="mt-4 text-lg font-semibold text-gray-900">Page not found</h1>
      <p className="mt-1 text-sm text-gray-500">
        Nothing lives at <span className="font-mono text-gray-700">{pathname}</span>. It may have been moved, or the
        link may be wrong.
      </p>
      <Link to="/dashboard" className="btn btn-primary btn-sm mt-5">
        Back to the dashboard
      </Link>
    </div>
  );
}
