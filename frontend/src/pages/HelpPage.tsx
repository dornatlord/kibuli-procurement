import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { ChatIcon, CheckIcon, ChevronDownIcon, CopyIcon, SearchIcon } from "../components/icons";

/** Help on WhatsApp: the number as it's dialled in Uganda, and in the form wa.me needs. */
const WHATSAPP_NUMBER = "0708175102";
const WHATSAPP_SHOWN = "0708 175 102";
const WHATSAPP_LINK = `https://wa.me/256708175102?text=${encodeURIComponent(
  "Hello, I need help with the Kibuli SS procurement system."
)}`;

interface Topic {
  id: string;
  title: string;
  intro?: string;
  /** Numbered steps for a guide; paragraphs for a question. **Bold** marks a button or page name. */
  steps: string[];
  tip?: string;
  link?: { to: string; label: string };
}

const GUIDES: Topic[] = [
  {
    id: "start",
    title: "Getting around",
    intro: "Everything you can use is in the green menu on the left. You only see the parts your role allows.",
    steps: [
      "**Dashboard** greets you with counts and quick actions.",
      "**New request** starts a TFORM 5 request.",
      "**Search** finds anything from any year: a reference, a subject, an item, a supplier, an LPO number.",
      "The menu's sections (Procurement, Providers & Contracts, Receiving & Payment, Reference, Reports & Administration) hold the rest. On a small screen, open the menu with the ☰ button at the top left.",
      "Your name at the bottom of the menu opens your **Profile**.",
      "**Help**, this page, is always at the bottom of the menu.",
    ],
    tip: "In Edge or Chrome, **Install the app** in the menu puts the system on your computer like any other program.",
  },
  {
    id: "request",
    title: "Raise a request (TFORM 5)",
    steps: [
      "Click **New request** in the menu.",
      "Choose **Micro Procurement** (below UGX 1,000,000) or **Macro Procurement** (UGX 1,000,000 and above).",
      "**Week** and **Term** are filled in with this week of the term. Change them if they're wrong: they print in a box beside the Procurement Reference Number.",
      "Fill in the subject, the budget line (vote, sub-programme and item) and the **Date required**. That date is printed as the delivery date on the LPO.",
      "The items are numbered straight through their vote, whatever their roman numeral: 2201-1 is Legal fees, 2212-13 the Generator. That number and the item's name print as the Project Code and Title.",
      "**Procurement Plan Reference** fills itself from the school's procurement plan once the budget line is chosen. If it picked the wrong line, or none, click the box and pick from the plan, or type the reference.",
      "Choosing the budget line opens the price list. Tick the items you need and press **Confirm**: each arrives with its unit and price, so you only type the quantity.",
      "Something not in the price list? Use **Pick from price list** to search all of it, or type it into an empty row.",
      "Press **Save Request**. It's saved as a draft with its reference number.",
      "When it's ready, open it and press **Submit to HoD**.",
    ],
    tip: "Buy the same things often, like weekly food? Save them once as a basket under **Saved Baskets**, then load them all from the price list's **Saved baskets** tab.",
    link: { to: "/requests/new", label: "Start a request" },
  },
  {
    id: "approvals",
    title: "How a request gets approved",
    intro: "A request moves one step at a time. The button for the next step appears only for the person whose turn it is.",
    steps: [
      "The department: **Submit to HoD**.",
      "Head of Department: **Approve → Accounting Officer**, or **Reject**.",
      "Accounting Officer: for a micro request, **Approve**, and it's approved. For a macro request, **Approve → Contracts Committee**. Or **Reject**.",
      "Contracts Committee, for macro requests only: **Approve** or **Reject**. The Procurement and Disposal Unit first prepares **Part II** on the request page: for each row, the method or the names, and separately, the justification. Click a justification box to type, or pick from the list that drops down.",
      "The request page shows every step with who did it and when. Those dates print on the form by themselves.",
    ],
  },
  {
    id: "printing",
    title: "Print the forms",
    steps: [
      "Open a request. At the top are **Print TFORM 5**, **Price schedule** and **Call-off order**.",
      "Open an LPO for **Print LPO** and **Completion certificate**.",
      "The **Monthly Report** and **Termly Report** pages have **Print FORM 2** and **Print FORM 27**.",
      "TFORM 5, the call-off order and the LPO first show the names, titles and dates they will print, filled in already. Change any that's wrong (click a box to pick another name in that office), then press **Print**.",
      "A print window opens. Choose the printer and A4 paper, then press Print. The layout, landscape for FORM 5, is set for you.",
      "Names, titles and dates print without a line under them; lines are left only where someone signs, or for something left blank to write in by hand. The school badge is on the first page only.",
    ],
    tip: "If nothing opens when you press a print button, the browser blocked it: click the blocked pop-up sign at the right of the address bar and choose to always allow pop-ups for this site.",
  },
  {
    id: "lpo",
    title: "Order from a supplier (LPO)",
    steps: [
      "Open the request and press **Create LPO**. The items, delivery date and delivery place come from the request.",
      "Choose the supplier, or add one there with **New supplier**, and save. The LPO gets the year's next number: numbers start again at 1 every year, like the LPO book.",
      "**Print LPO**, then **Issue to supplier**. An LPO can be issued once its request is approved.",
      "When the supplier confirms the order, press **Mark acknowledged**.",
      "To find an old LPO, open **LPOs** and choose the **Year**, or type in **Find**: 3 finds LPO 3, and 3/2025 finds LPO 3 of 2025.",
    ],
    link: { to: "/purchase-orders", label: "Open LPOs" },
  },
  {
    id: "receiving",
    title: "Deliveries, invoices and payment",
    steps: [
      "When goods arrive, open the LPO and press **Record goods received** (it appears once the LPO is acknowledged). Enter what came and its condition.",
      "On the delivery's page, whoever inspects the goods presses **Accept** or **Reject**.",
      "Record the supplier's invoice under **Invoices** with **+ New Invoice**, choosing its LPO. The list shows whether the goods were received.",
      "**Approve** the invoice, then **Mark Paid** once it's paid.",
      "For works and services, the LPO's **Completion certificate** prints the certificate, filled in from the LPO.",
    ],
  },
  {
    id: "reports",
    title: "Reports for PPDA",
    steps: [
      "**Monthly Report** is PPDA FORM 2 and **Termly Report** is FORM 27. Choose the year and month, or year and term.",
      "The form fills itself from what's recorded in the system. Correct any cell or add rows, then press **Save report**.",
      "**Print FORM 27** or **Print FORM 2** gives the official layout, with the Accounting Officer's declaration.",
      "Term 1 of 2026 holds the school's own return, entered from the paper copy.",
    ],
  },
  {
    id: "account",
    title: "Officials, passwords and your account",
    steps: [
      "**Officials**: type each office holder's name once and it prints wherever that office signs. When an office has more than one person, use **Add another name**: the first is filled in, and the others can be picked before printing. **Add official** adds an office the school needs. (Administrators only.)",
      "**Profile** shows your details and recent work. Change your password there with **Change password**.",
      "Left the system signed in somewhere else, like a shared computer? In **Profile**, sign out of the other devices, then change your password.",
      "Forgot your password? The system administrator can set a new one under **Users & Roles**.",
    ],
  },
  {
    id: "offline",
    title: "Working without internet",
    steps: [
      "Pages you've opened, and the copy the system keeps of recent requests, the price list, budget lines, baskets and LPOs, still open without internet. A notice at the top tells you you're offline.",
      "You can write a new request offline. It waits under **Waiting to send** on the Requests page and goes by itself when you're back online.",
      "Approvals, LPOs, deliveries, invoices and settings need the internet.",
    ],
  },
];

const QUESTIONS: Topic[] = [
  {
    id: "sign-in",
    title: "I can't sign in.",
    steps: [
      "Check the email address and the password; the eye button shows what you typed.",
      "After several wrong tries the system makes you wait 15 minutes before trying again.",
      "Forgotten password? Ask the system administrator to set a new one, then change it in your **Profile**.",
    ],
  },
  {
    id: "missing-button",
    title: "Why can't I see a button or a page?",
    steps: [
      "Each person sees what their role allows. Only the Head of Department sees **Approve → Accounting Officer**, for example. Your role is under your name at the bottom of the menu.",
      "If you need to do more, ask the system administrator.",
    ],
  },
  {
    id: "slow",
    title: "The system takes long to open.",
    steps: [
      "When nobody has used it for a while, the server rests, and it takes up to a minute to wake. The loading screen says so. Wait, and it opens.",
    ],
  },
  {
    id: "print-extra",
    title: "My printout shows the date, the page title or about:blank, or it's tiny.",
    steps: [
      "The forms are set up to print without these. In the print window, set paper size to A4 and leave Margins and Scale on Default.",
      "If you still see them, open More settings and untick Headers and footers.",
    ],
  },
  {
    id: "print-nothing",
    title: "Nothing happens when I press a print button.",
    steps: [
      "The browser blocked the print window. Click the blocked pop-up sign at the right of the address bar, choose to always allow pop-ups for this site, and press the button again.",
    ],
  },
  {
    id: "pto",
    title: "What does P.T.O mean on a printout?",
    steps: ["Please turn over: the list carries on on the next page, and the total is there."],
  },
  {
    id: "old-lpo",
    title: "How do I find LPO 1 from last year?",
    steps: ["Open **LPOs**, and under **Year** choose last year. Or type 1/2025 (the number, a slash, the year) in **Find**."],
    link: { to: "/purchase-orders", label: "Open LPOs" },
  },
  {
    id: "correct-mistake",
    title: "I found a mistake in a saved request or LPO.",
    steps: [
      "Administrators, and people ticked **Can correct records** on **Users & Roles**, see **Correct** on the request or LPO page. Change what's wrong, say what was wrong, and press **Save correction**.",
      "It works for any year. The Audit Trail keeps what changed and who changed it, the page lists its corrections, and printing shows the corrected version.",
      "Can't see **Correct**? Ask one of them.",
    ],
  },
  {
    id: "old-records",
    title: "How do I find something from an earlier year?",
    steps: [
      "Nothing is deleted when a year ends. **Search** in the menu looks through every year at once.",
      "Lists open on this year. At the top of each list, choose another **Year**, or **All years**.",
    ],
    link: { to: "/search", label: "Open Search" },
  },
  {
    id: "new-year-suppliers",
    title: "How do I start a new year's supplier list?",
    steps: [
      "Open **Suppliers** and choose the new year. It offers to carry everyone forward, to choose who to carry, or to start a fresh list.",
      "Taking a supplier off a year's list never touches its LPOs or contracts.",
    ],
  },
  {
    id: "new-year-budget",
    title: "How do I set next year's budget?",
    steps: [
      "Open **Budget** and choose next year. Press **Copy** to start from this year's amounts, then change what's different.",
      "Each year keeps its own amounts, and the reports read each year's own budget.",
    ],
  },
  {
    id: "delivery-date",
    title: "Where does the delivery date on the LPO come from?",
    steps: ["From the request's **Date required**, unless the LPO was given a delivery date of its own."],
  },
  {
    id: "project-code",
    title: "How is the Project Code on FORM 5 worked out?",
    steps: [
      "It's the vote, then the item's number in the school's budget. 2208-2 is item 2 under 2208 (Games & sports). 2212-4 is item 4 of Civil works under 2212 (Water repairs).",
    ],
  },
  {
    id: "not-in-list",
    title: "The item I need isn't in the price list.",
    steps: [
      "Type it into an empty row with its unit and price. The price list itself is kept under **Reserve Prices** by those allowed to change it.",
    ],
  },
  {
    id: "supplier",
    title: "How do I add a supplier?",
    steps: ["On the **Suppliers** page, press **+ Add Supplier**. Or, while creating an LPO, add one there with **New supplier**."],
  },
  {
    id: "lost-connection",
    title: "The internet went off while I was writing a request.",
    steps: [
      "Save it anyway. It waits under **Waiting to send** on the Requests page and is sent by itself when you're back online.",
    ],
  },
];

/** "Press **Save**" → "Press <strong>Save</strong>". */
function rich(text: string): ReactNode {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) =>
    i % 2 ? (
      <strong key={i} className="font-semibold text-gray-900">
        {part}
      </strong>
    ) : (
      part
    )
  );
}

const searchable = (t: Topic) => [t.title, t.intro, ...t.steps, t.tip].join(" ").replace(/\*\*/g, "").toLowerCase();

export default function HelpPage() {
  const [query, setQuery] = useState("");
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (t: Topic) => words.every((w) => searchable(t).includes(w));
  const guides = GUIDES.filter(matches);
  const questions = QUESTIONS.filter(matches);
  const searching = words.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Help"
        subtitle="Step-by-step guides and answers to common questions. Still stuck? Message us on WhatsApp."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="space-y-6">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search help, e.g. print, LPO, password"
              aria-label="Search help"
              className="input pl-9"
            />
          </div>

          {guides.length > 0 && (
            <section aria-labelledby="guides-title">
              <h2 id="guides-title" className="mb-2 text-sm font-semibold text-gray-900">
                Guides
              </h2>
              <div className="card divide-y divide-gray-100 overflow-hidden">
                {guides.map((t, i) => (
                  <TopicItem key={t.id} topic={t} numbered open={searching || i === 0} />
                ))}
              </div>
            </section>
          )}

          {questions.length > 0 && (
            <section aria-labelledby="questions-title">
              <h2 id="questions-title" className="mb-2 text-sm font-semibold text-gray-900">
                Common questions
              </h2>
              <div className="card divide-y divide-gray-100 overflow-hidden">
                {questions.map((t) => (
                  <TopicItem key={t.id} topic={t} open={searching} />
                ))}
              </div>
            </section>
          )}

          {guides.length === 0 && questions.length === 0 && (
            <div className="card px-6 py-10 text-center">
              <p className="text-sm font-medium text-gray-900">Nothing matches “{query.trim()}”</p>
              <p className="mt-1 text-sm text-gray-500">Try other words, or ask us on WhatsApp.</p>
            </div>
          )}
        </div>

        <WhatsAppCard />
      </div>
    </div>
  );
}

function TopicItem({ topic, numbered = false, open }: { topic: Topic; numbered?: boolean; open: boolean }) {
  return (
    // The key on `open` lets a new search open (or close) every match again.
    <details key={String(open)} id={topic.id} open={open} className="group scroll-mt-20">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-medium text-gray-900 hover:bg-gray-50 [&::-webkit-details-marker]:hidden">
        {topic.title}
        <ChevronDownIcon className="h-4 w-4 shrink-0 text-gray-400 transition group-open:rotate-180" />
      </summary>
      <div className="space-y-3 px-5 pb-5 text-sm leading-6 text-gray-600">
        {topic.intro && <p>{rich(topic.intro)}</p>}
        {numbered ? (
          <ol className="list-decimal space-y-1.5 pl-5 marker:text-gray-400">
            {topic.steps.map((s, i) => (
              <li key={i}>{rich(s)}</li>
            ))}
          </ol>
        ) : (
          topic.steps.map((s, i) => <p key={i}>{rich(s)}</p>)
        )}
        {topic.tip && (
          <p className="rounded-lg bg-green-50 px-3 py-2 text-green-900">
            <span className="font-semibold">Tip: </span>
            {rich(topic.tip)}
          </p>
        )}
        {topic.link && (
          <Link to={topic.link.to} className="inline-block font-medium text-green-700 hover:underline">
            {topic.link.label} →
          </Link>
        )}
      </div>
    </details>
  );
}

function WhatsAppCard() {
  const [copied, setCopied] = useState(false);

  async function copyNumber() {
    try {
      await navigator.clipboard.writeText(WHATSAPP_NUMBER);
    } catch {
      // Older browsers, or no permission: copy through a hidden text box.
      const box = document.createElement("textarea");
      box.value = WHATSAPP_NUMBER;
      box.setAttribute("readonly", "");
      box.style.position = "fixed";
      box.style.opacity = "0";
      document.body.appendChild(box);
      box.select();
      document.execCommand("copy");
      box.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  }

  return (
    // First on a narrow screen, so nobody scrolls past every guide to find it.
    <aside className="card order-first overflow-hidden lg:sticky lg:top-6 lg:order-none" aria-labelledby="whatsapp-title">
      <div className="bg-green-900 px-5 py-4 text-white">
        <div className="flex items-center gap-2">
          <ChatIcon className="h-5 w-5 text-green-300" />
          <h2 id="whatsapp-title" className="text-sm font-semibold">
            Need more help?
          </h2>
        </div>
        <p className="mt-1 text-sm text-green-100/90">Message us on WhatsApp and we'll help you through it.</p>
      </div>
      <div className="space-y-3 p-5">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-gray-500">WhatsApp</div>
          <div className="mt-0.5 text-2xl font-semibold tabular-nums tracking-wide text-gray-900">{WHATSAPP_SHOWN}</div>
        </div>
        <a
          href={WHATSAPP_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className="btn w-full justify-center bg-[#1a8d4a] text-white hover:bg-[#157a3f]"
        >
          <ChatIcon className="h-4 w-4" />
          Open WhatsApp
        </a>
        <button type="button" onClick={copyNumber} className="btn btn-secondary w-full justify-center">
          {copied ? <CheckIcon className="h-4 w-4 text-green-700" /> : <CopyIcon className="h-4 w-4" />}
          {copied ? "Number copied" : "Copy number"}
        </button>
        <p aria-live="polite" className="sr-only">
          {copied ? "The WhatsApp number is copied." : ""}
        </p>
        <p className="text-xs leading-5 text-gray-500">
          <strong className="font-medium text-gray-700">Open WhatsApp</strong> starts a chat, in the app or on WhatsApp Web.{" "}
          <strong className="font-medium text-gray-700">Copy number</strong> copies it to paste or save.
        </p>
      </div>
    </aside>
  );
}
