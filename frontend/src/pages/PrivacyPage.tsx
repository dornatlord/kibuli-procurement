import { Link } from "react-router-dom";
import LegalLayout, { Bullets, type LegalSection } from "../components/LegalLayout";

const sections: LegalSection[] = [
  {
    id: "who-we-are",
    title: "Who we are",
    body: (
      <>
        <p>
          Kibuli Secondary School runs this system to raise, approve and record procurement requests, local purchase
          orders (LPOs), deliveries, invoices, contracts and disposals, and to prepare the returns the Public
          Procurement and Disposal of Public Assets Authority (PPDA) asks for.
        </p>
        <p>
          The school is responsible for the personal data in the system (the data controller) under Uganda's Data
          Protection and Privacy Act, 2019. The system is built, hosted and maintained for the school by its developer,
          who handles the data only to run the system for the school.
        </p>
      </>
    ),
  },
  {
    id: "whose-data",
    title: "Whose information this covers",
    body: (
      <Bullets>
        <li>Staff and officials who have an account.</li>
        <li>
          People named in procurement and disposal records: suppliers' and contractors' contact people and owners,
          buyers of disposed assets, and staff and committee members named on requests, approvals and forms.
        </li>
      </Bullets>
    ),
  },
  {
    id: "what-we-collect",
    title: "What we collect",
    body: (
      <>
        <Bullets>
          <li>
            <strong className="font-medium text-gray-800">Your account:</strong> your name, work email address,
            department, role and whether the account is active. Your password is stored only in scrambled (hashed)
            form, so nobody, including the administrator, can read it.
          </li>
          <li>
            <strong className="font-medium text-gray-800">Sign-ins:</strong> when you last signed in and, for each
            computer you're signed in on, the browser and operating system it reported and when you signed in. The
            system doesn't record your location or IP address.
          </li>
          <li>
            <strong className="font-medium text-gray-800">Your work in the system:</strong> the requests, approvals,
            LPOs, deliveries, invoices and other records you create or change, and an audit trail of who did what and
            when.
          </li>
          <li>
            <strong className="font-medium text-gray-800">Suppliers and buyers:</strong> business names, contact
            people, phone numbers, email and postal addresses, TIN and registration numbers, owners' names, and their
            dealings with the school, such as prices, orders, contracts and payments.
          </li>
        </Bullets>
        <p>
          The system isn't meant for information about students, or for sensitive personal data such as health
          records.
        </p>
      </>
    ),
  },
  {
    id: "why",
    title: "Why we use it",
    body: (
      <>
        <Bullets>
          <li>To run the school's procurement and disposal process, as the PPDA Act and its regulations require.</li>
          <li>To give each person the access their role needs, keep accounts secure and spot misuse.</li>
          <li>To keep a reliable record of approvals and changes, for audits and accountability.</li>
          <li>
            To prepare reports for the school's management, the PPDA and other authorities entitled to receive them.
          </li>
        </Bullets>
        <p>
          The school uses this information because it needs it to carry out its legal duties as a procuring and
          disposing entity. It isn't used for marketing, and it isn't sold.
        </p>
      </>
    ),
  },
  {
    id: "who-sees-it",
    title: "Who can see it",
    body: (
      <>
        <Bullets>
          <li>
            <strong className="font-medium text-gray-800">School staff</strong>, only as far as their role allows. For
            example, department members see their own requests and heads of department see their department's, while
            the Accounting Officer, the Procurement and Disposal Unit and administrators see more.
          </li>
          <li>
            <strong className="font-medium text-gray-800">The companies that run the system</strong> for the school:
            Render hosts the application, and Supabase stores the database. Both keep short-lived technical logs, such
            as IP addresses, to run and protect their services. The developer who maintains the system can reach the
            data to keep it working. Google Fonts supplies the typeface, and receives your computer's IP address when
            it's downloaded.
          </li>
          <li>
            <strong className="font-medium text-gray-800">Authorities</strong>, where the law requires or allows it:
            for example the PPDA and the Auditor General during audits or investigations.
          </li>
        </Bullets>
      </>
    ),
  },
  {
    id: "where-stored",
    title: "Where it's stored",
    body: (
      <>
        <p>
          The database is kept by Supabase in Mumbai, India, and the application runs on Render's servers, also outside
          Uganda. Information is encrypted while it travels between your computer and the system, and Supabase
          encrypts the stored database.
        </p>
        <p>
          The Data Protection and Privacy Act allows personal data to be kept outside Uganda where it is adequately
          protected. The school uses providers that encrypt the data and restrict who can reach it.
        </p>
      </>
    ),
  },
  {
    id: "on-your-computer",
    title: "What's kept on your computer",
    body: (
      <>
        <p>So that the system opens and lets you work without internet, it keeps on the computer you use:</p>
        <Bullets>
          <li>the system's own files;</li>
          <li>the name, role and permissions of the last person who signed in;</li>
          <li>
            copies of what you've opened, and of the lists needed to raise requests (requests, budget lines, the price
            list and baskets);
          </li>
          <li>requests filled in offline that are still waiting to be sent.</li>
        </Bullets>
        <p>
          Signing out deletes the saved copies and the remembered sign-in. Requests waiting to be sent stay until
          they're sent or you remove them. The system uses a single cookie, which keeps you signed in; there are no
          tracking or advertising cookies.
        </p>
        <p>
          Anyone who uses the computer while you're signed in can see what you can see. Lock the computer when you
          step away, and don't leave the system signed in on a shared computer.
        </p>
      </>
    ),
  },
  {
    id: "how-long",
    title: "How long we keep it",
    body: (
      <Bullets>
        <li>
          Procurement and disposal records, and the audit trail, are public records. They're kept for as long as the
          PPDA Act, its regulations and the school's records policy require.
        </li>
        <li>
          When someone no longer needs access, their account is deactivated rather than deleted, so the record of what
          was done and by whom stays complete.
        </li>
        <li>A sign-in lasts 30 days unless you sign out sooner.</li>
      </Bullets>
    ),
  },
  {
    id: "security",
    title: "How we protect it",
    body: (
      <Bullets>
        <li>Passwords are stored only in hashed form.</li>
        <li>Each role sees and does only what it needs, and every change is recorded.</li>
        <li>All connections to the system are encrypted.</li>
        <li>
          You can see where you're signed in, and sign out of other computers, from{" "}
          <Link to="/profile" className="font-medium text-green-700 underline underline-offset-2">
            your profile
          </Link>
          .
        </li>
      </Bullets>
    ),
  },
  {
    id: "your-rights",
    title: "Your rights",
    body: (
      <>
        <p>Under the Data Protection and Privacy Act, 2019 you can:</p>
        <Bullets>
          <li>ask what personal information the school holds about you, and for a copy of it;</li>
          <li>ask for information that is wrong or incomplete to be corrected;</li>
          <li>
            object to how your information is used, or ask for it to be deleted. Records the law requires the school
            to keep can't be deleted;
          </li>
          <li>
            complain to the Personal Data Protection Office (pdpo.go.ug) if you're unhappy with how the school handles
            your information.
          </li>
        </Bullets>
        <p>
          Your account details are on your profile page. For anything else, contact the school using the details
          below.
        </p>
      </>
    ),
  },
  {
    id: "breaches",
    title: "If something goes wrong",
    body: (
      <p>
        If personal information is lost, or seen by someone who shouldn't see it, the school will act to contain it,
        and will notify the Personal Data Protection Office and, where required, the people affected.
      </p>
    ),
  },
  {
    id: "changes-contact",
    title: "Changes and contact",
    body: (
      <>
        <p>
          The school will update this policy when the system or the law changes, and the date at the top will show
          when. Significant changes will be announced to the people who use the system.
        </p>
        <p>
          Questions, or requests about your information: Kibuli Secondary School, P.O. Box 4216, Kampala, Uganda.
          Telephone 0414 257339. Ask for the system administrator.
        </p>
      </>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      updated="17 September 2026"
      intro={
        <p>
          This policy explains what information the Kibuli Secondary School Procurement System holds, why, who can see
          it, and the choices and rights you have.
        </p>
      }
      sections={sections}
    />
  );
}
