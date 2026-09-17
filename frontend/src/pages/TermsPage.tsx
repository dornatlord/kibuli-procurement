import { Link } from "react-router-dom";
import LegalLayout, { Bullets, type LegalSection } from "../components/LegalLayout";

const sections: LegalSection[] = [
  {
    id: "about",
    title: "About these terms",
    body: (
      <>
        <p>
          These terms cover the use of the Kibuli Secondary School Procurement System. By signing in, you agree to
          them.
        </p>
        <p>
          They sit alongside the Public Procurement and Disposal of Public Assets Act, 2003 and its regulations, and
          the school's own policies and code of conduct. Where they differ, the law and the school's policies come
          first.
        </p>
      </>
    ),
  },
  {
    id: "who-may-use",
    title: "Who may use the system",
    body: (
      <p>
        Only people the school has given an account: staff and officials involved in procurement and disposal, and
        others the school authorises. The school decides each person's role, and can change, suspend or close an
        account at any time, for example when someone changes role or leaves.
      </p>
    ),
  },
  {
    id: "your-account",
    title: "Your account",
    body: (
      <Bullets>
        <li>Your account is for you alone. Don't share your password or let anyone else use your account.</li>
        <li>Everything done with your account is recorded as done by you.</li>
        <li>If the administrator set your password, change it the first time you sign in.</li>
        <li>Sign out when you finish on a shared computer, and lock your computer when you step away.</li>
        <li>
          If you think someone else knows your password, change it straight away, sign out of your other devices from{" "}
          <Link to="/profile" className="font-medium text-green-700 underline underline-offset-2">
            your profile
          </Link>
          , and tell the system administrator.
        </li>
      </Bullets>
    ),
  },
  {
    id: "proper-use",
    title: "Using the system properly",
    body: (
      <>
        <p>You agree to:</p>
        <Bullets>
          <li>
            enter information that is true, complete and up to date, including requests, quantities, prices, approvals,
            deliveries and invoices;
          </li>
          <li>approve, reject or record only the decisions you're authorised to make;</li>
          <li>
            follow the school's procurement procedures and the PPDA Act. The system supports the process, but it
            doesn't replace the approvals, signatures, committee meetings and documents the law requires;
          </li>
          <li>
            keep confidential information confidential, including reserve prices, bids, evaluations and suppliers'
            details.
          </li>
        </Bullets>
        <p>You must not:</p>
        <Bullets>
          <li>use someone else's account, or try to reach anything your role doesn't allow;</li>
          <li>enter false information, split a procurement to avoid a threshold, or alter records to hide the truth;</li>
          <li>copy, share or take procurement information for anything other than your work for the school;</li>
          <li>interfere with the system's security, its performance or its data.</li>
        </Bullets>
      </>
    ),
  },
  {
    id: "records",
    title: "Records and printed forms",
    body: (
      <>
        <p>
          The system's records, including its audit trail, are official school records. They can be used in audits,
          investigations, and disciplinary or legal proceedings.
        </p>
        <p>
          Printed forms such as TFORM 5, LPOs, price schedules and PPDA returns are produced from those records. A
          printed form becomes valid only once it has been signed, and stamped where required, under the school's
          procedures.
        </p>
      </>
    ),
  },
  {
    id: "offline",
    title: "Working without internet",
    body: (
      <Bullets>
        <li>
          The system can open, and let you prepare requests, without a connection. What it shows then is the copy
          saved on the computer, which may be out of date until you reconnect.
        </li>
        <li>
          A request filled in offline reaches the school only once the computer is back online. Check that it was sent,
          and then submit it for approval.
        </li>
        <li>You're responsible for keeping the computer you use, and the information saved on it, secure.</li>
      </Bullets>
    ),
  },
  {
    id: "availability",
    title: "Availability",
    body: (
      <p>
        The school aims to keep the system running, but can't promise it will always be available. It can take up to
        a minute to start after a quiet spell, and may be unavailable during maintenance or an outage. If a procurement
        is urgent and the system can't be reached, follow the school's alternative procedure.
      </p>
    ),
  },
  {
    id: "breaches",
    title: "If these terms are broken",
    body: (
      <p>
        Misuse can lead to an account being suspended or closed, and may be dealt with under the school's disciplinary
        procedures or reported to the relevant authorities.
      </p>
    ),
  },
  {
    id: "privacy",
    title: "Privacy",
    body: (
      <p>
        How the system handles personal information is explained in the{" "}
        <Link to="/privacy" className="font-medium text-green-700 underline underline-offset-2">
          Privacy Policy
        </Link>
        .
      </p>
    ),
  },
  {
    id: "changes-law-contact",
    title: "Changes, law and contact",
    body: (
      <>
        <p>
          The school may update these terms, and the date at the top will show when. Using the system after a change
          means you accept the updated terms.
        </p>
        <p>These terms are governed by the laws of Uganda.</p>
        <p>
          Questions: Kibuli Secondary School, P.O. Box 4216, Kampala, Uganda. Telephone 0414 257339. Ask for the system
          administrator.
        </p>
      </>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalLayout
      title="Terms of Use"
      updated="17 September 2026"
      intro={
        <p>
          The rules for using the Kibuli Secondary School Procurement System: who may use it, how to keep accounts safe,
          and what the school expects of everyone who works in it.
        </p>
      }
      sections={sections}
    />
  );
}
