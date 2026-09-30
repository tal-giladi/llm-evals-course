// Eval Lab — source corpus for the demo datasets.
//
// Everything a simulation needs is authored here as structured data with the
// ground truth attached: for each item we know which fact it tests, what a
// correct answer says, and which realistic failure modes we can inject. That
// is what lets the human label be correct by construction instead of guessed,
// and it is why the same corpus can be replayed to generate judge runs.
//
// The company, its policies and its people are fictional.

/* ================================================================== *
 * 1. The support-bot corpus
 *
 * A fictional company handbook. Each fact carries:
 *   good    — what a correct answer says
 *   bad     — realistic wrong answers (a corrupted rule, a wrong number,
 *             a plausible-sounding non-answer)
 *   refuse  — an over-refusal, which is a failure mode of its own
 *   out     — a question the handbook does not answer, and the correct
 *             handling of it
 * ================================================================== */

export const HANDBOOK = [
  {
    id: "pto", section: "Leave and time off", intent: "policy_fact", difficulty: "easy",
    q: "How many days of paid time off do I get each year?",
    good: "You get 25 days of paid time off per year, accrued monthly.",
    bad: [
      "You get 20 days of paid time off per year, granted at the start of the year.",
      "You get 25 days per year, but you must use them before the end of March.",
    ],
    refuse: "Leave policy is handled by our People team, so I cannot answer that here.",
  },
  {
    id: "pto-carryover", section: "Leave and time off", intent: "boundary", difficulty: "hard",
    q: "What happens if I do not use all my paid time off before December 31?",
    good: "You can carry over at most 5 unused days into the next year. Anything above that is lost.",
    bad: [
      "All unused days roll over automatically, with no limit.",
      "Unused days are lost — the handbook sets no carryover at all.",
    ],
    refuse: "I would rather you check with your manager about carryover.",
  },
  {
    id: "remote", section: "Where you work", intent: "policy_fact", difficulty: "easy",
    q: "How many days a week can I work remotely?",
    good: "You can work remotely up to 3 days a week, and only from a country on the approved list.",
    bad: [
      "You can work remotely full time — the handbook has no location requirement.",
      "Remote work is 1 day a week, and only with written manager approval.",
    ],
    refuse: "Remote arrangements are agreed case by case, so there is no standard answer.",
  },
  {
    id: "remote-country", section: "Where you work", intent: "exception", difficulty: "hard",
    q: "I am moving to Portugal for four months. Can I keep working remotely?",
    good: "Only if Portugal is on the approved-country list and you stay within the 3-day-a-week limit. Check the approved list in the handbook before booking anything.",
    bad: [
      "Yes, you can work remotely from anywhere in the EU for up to six months.",
      "No. The handbook allows remote work from the office country only.",
    ],
    refuse: "Cross-border working is too sensitive for me to advise on.",
  },
  {
    id: "expense-meals", section: "Expenses", intent: "boundary", difficulty: "medium",
    q: "Do I need a receipt for a client dinner?",
    good: "Yes. Receipts are required for any single expense over 50. Meals up to 25 a day do not need one.",
    bad: [
      "No, meals never need a receipt regardless of the amount.",
      "Yes, every expense needs a receipt, including a 5 euro coffee.",
    ],
    refuse: "Ask your manager to confirm before you expense anything.",
  },
  {
    id: "expense-approval", section: "Expenses", intent: "how_to", difficulty: "medium",
    q: "What is the approval process for submitting an expense claim?",
    good: "Submit the claim in the expense tool within 30 days, with a receipt for anything over 50. Your manager approves claims under 500; above 500 it also goes to Finance.",
    bad: [
      "Email the receipt to your manager, who forwards it to Finance manually.",
      "Claims are approved automatically if they are under 500.",
    ],
    refuse: "The expense tool is not something I can walk you through.",
  },
  {
    id: "security-password", section: "Security", intent: "policy_fact", difficulty: "easy",
    q: "How often must I change my password?",
    good: "Every 90 days, with a minimum length of 14 characters. Your manager can grant an exception for a hardware key setup.",
    bad: [
      "Every 30 days, with a minimum length of 8 characters.",
      "Only when you suspect a compromise — the handbook sets no schedule.",
    ],
    refuse: "Security policy questions go to the security team.",
  },
  {
    id: "security-vpn", section: "Security", intent: "how_to", difficulty: "easy",
    q: "When do I need the VPN?",
    good: "On any network that is not the office network, including home and public Wi-Fi.",
    bad: [
      "Only on public Wi-Fi. Home networks are considered trusted.",
      "Only when you are handling customer data.",
    ],
    refuse: "You would need to ask the IT helpdesk about that.",
  },
  {
    id: "incident", section: "Security", intent: "policy_fact", difficulty: "medium",
    q: "How quickly must I report a security incident?",
    good: "Within 1 hour of noticing it, to the security channel. Late reports are a disciplinary matter.",
    bad: [
      "Within 24 hours, at the next daily standup.",
      "There is no deadline, but you should report it eventually.",
    ],
    refuse: "I am not able to advise on incident reporting.",
  },
  {
    id: "budget-learning", section: "Learning and development", intent: "policy_fact", difficulty: "easy",
    q: "What is my learning and development budget?",
    good: "1500 per year, approved by your manager before you buy anything.",
    bad: [
      "2000 per year, approved by your manager.",
      "There is no fixed budget — you request what you need.",
    ],
    refuse: "Your manager owns the development budget conversation.",
  },
  {
    id: "budget-training-days", section: "Learning and development", intent: "policy_fact", difficulty: "easy",
    q: "How many mandatory training days do I get?",
    good: "5 days per year, on top of your learning budget.",
    bad: [
      "2 days per year, counted inside your learning budget.",
      "10 days per year, on top of your learning budget.",
    ],
    refuse: "Training is coordinated by your manager.",
  },
  {
    id: "parental", section: "Leave and time off", intent: "policy_fact", difficulty: "medium",
    q: "How much parental leave do I get?",
    good: "18 weeks, for any parent, at full pay. It can be split into at most three blocks.",
    bad: [
      "12 weeks, for the birth mother only.",
      "18 weeks unpaid, available through the government scheme instead.",
    ],
    refuse: "Parental leave is confidential and handled by People directly.",
  },
  {
    id: "sick", section: "Leave and time off", intent: "boundary", difficulty: "medium",
    q: "Do I need a doctor’s note when I am sick?",
    good: "You self-certify up to 3 days. From the 4th day you need a medical certificate.",
    bad: [
      "You need a certificate from the first day.",
      "No certificate is ever needed, for any length of absence.",
    ],
    refuse: "Sick leave certification is a HR matter.",
  },
  {
    id: "notice", section: "Working here", intent: "boundary", difficulty: "hard",
    q: "What is the notice period if I want to leave?",
    good: "1 month for everyone; 3 months for senior staff. Notice is waived in probation.",
    bad: [
      "3 months for everyone, with no exceptions.",
      "There is no notice period — you resign immediately.",
    ],
    refuse: "Resignation is a personal matter, not a policy question.",
  },
  {
    id: "probation", section: "Working here", intent: "how_to", difficulty: "medium",
    q: "How long is the probation period?",
    good: "3 months, with a written review at the end. During probation the notice period is waived.",
    bad: [
      "6 months, with a review at 3 and 6 months.",
      "There is no probation period.",
    ],
    refuse: "Your contract is the authoritative source for that.",
  },
  {
    id: "equipment", section: "Equipment", intent: "policy_fact", difficulty: "easy",
    q: "How often is my laptop replaced?",
    good: "Every 3 years, or sooner if it cannot run the required tooling.",
    bad: [
      "Every 2 years, on a fixed company schedule.",
      "Laptops are replaced only when they break.",
    ],
    refuse: "Equipment is handled by the IT helpdesk.",
  },
  {
    id: "software-purchase", section: "Purchasing", intent: "boundary", difficulty: "medium",
    q: "Do I need procurement approval to buy a new SaaS tool?",
    good: "Yes, any purchase over 1000 needs procurement review, and the tool must go on the approved list before you invite anyone to it.",
    bad: [
      "No, any tool under 1000 a month can be bought directly.",
      "Every purchase needs procurement review, whatever the amount.",
    ],
    refuse: "Procurement is not covered in the handbook.",
  },
  {
    id: "travel-booking", section: "Travel", intent: "how_to", difficulty: "easy",
    q: "How do I book a work flight?",
    good: "Through the company booking tool only. Booked flights outside it are not reimbursed.",
    bad: [
      "Any way you like, as long as you submit the receipt.",
      "Through the company booking tool, but only for trips under 3 days.",
    ],
    refuse: "Travel booking is arranged by your manager.",
  },
  {
    id: "conference", section: "Learning and development", intent: "boundary", difficulty: "medium",
    q: "How many conferences can I attend per year?",
    good: "2 per year, each with pre-approval before you book. Travel and the ticket come out of your learning budget.",
    bad: [
      "1 per year, approved after you attend.",
      "As many as you like, from the learning budget.",
    ],
    refuse: "Conference attendance needs a conversation with your manager.",
  },
  {
    id: "review", section: "Working here", intent: "policy_fact", difficulty: "easy",
    q: "When are performance reviews held?",
    good: "Twice a year, in January and July, covering the previous six months.",
    bad: [
      "Once a year, each December.",
      "Continuously, with no scheduled review points.",
    ],
    refuse: "Review scheduling is set by your manager.",
  },
  {
    id: "promotion", section: "Working here", intent: "policy_fact", difficulty: "medium",
    q: "When does the promotion cycle run?",
    good: "Once a year. Applications open in February and decisions are out by the end of April.",
    bad: [
      "Twice a year, in February and August.",
      "There is no promotion cycle; promotions happen ad hoc.",
    ],
    refuse: "Promotions are decided case by case.",
  },
  {
    id: "contractor-max", section: "Working here", intent: "boundary", difficulty: "hard",
    q: "How long can a contractor work here before needing a review?",
    good: "6 months. Beyond that, the contract needs a documented review and a new approval.",
    bad: [
      "12 months, after which the contract automatically renews.",
      "There is no limit on contractor duration.",
    ],
    refuse: "Contractor rules are not in the handbook.",
  },
  {
    id: "retention", section: "Data handling", intent: "policy_fact", difficulty: "medium",
    q: "How long are customer support logs kept?",
    good: "90 days, then they are deleted automatically. Shorter retention needs a documented reason.",
    bad: [
      "2 years, as required by regulation.",
      "Logs are kept forever for audit purposes.",
    ],
    refuse: "Data retention is a legal question, not an operations one.",
  },
  {
    id: "export", section: "Data handling", intent: "how_to", difficulty: "hard",
    q: "What do I need to export customer data outside the company?",
    good: "Manager approval and DPO approval, both recorded, before any export. Exports are logged for 90 days.",
    bad: [
      "Manager approval only.",
      "No approval is needed for exports under 100 records.",
    ],
    refuse: "Data exports are outside what I can help with.",
  },
  {
    id: "gifts", section: "Ethics", intent: "boundary", difficulty: "medium",
    q: "Can I accept a gift from a vendor?",
    good: "Yes, up to 50 in value. Anything above that is refused and declared in the ethics register.",
    bad: [
      "Yes, up to 200 in value, declared afterwards.",
      "No. All gifts from vendors are refused, whatever the value.",
    ],
    refuse: "Gifts are an ethics question, not a policy one.",
  },
  {
    id: "office-access", section: "Working here", intent: "policy_fact", difficulty: "easy",
    q: "Can I get into the office at the weekend?",
    good: "Yes. HQ is badge-access 24/7. Other sites follow local hours.",
    bad: [
      "No. The office is open on business days only.",
      "Only with a visitor pass arranged by your manager.",
    ],
    refuse: "Building access is controlled by the facilities team.",
  },
  {
    id: "onboarding-buddy", section: "Working here", intent: "how_to", difficulty: "easy",
    q: "What happens in my first week?",
    good: "A buddy is assigned, accounts are provisioned, and you work through the onboarding checklist. No production changes in week one.",
    bad: [
      "You shadow a manager for a month before touching anything.",
      "There is no onboarding process; you start on your team immediately.",
    ],
    refuse: "Onboarding is arranged by your manager privately.",
  },

  /* ---- Wider slice of the same handbook, so the eval set has enough
         failing items for a true-negative rate to mean anything. ---- */

  {
    id: "meeting-free", section: "Working here", intent: "policy_fact", difficulty: "easy",
    q: "Are Wednesdays meeting-free?",
    good: "Yes. Wednesdays are meeting-free company-wide, except for team ceremonies that are already booked.",
    bad: [
      "No, Wednesdays are the main standup day across all teams.",
      "Yes, all days except Wednesday are meeting-free instead.",
    ],
    refuse: "Meeting conventions differ by team.",
  },
  {
    id: "dress-code", section: "Working here", intent: "policy_fact", difficulty: "easy",
    q: "Is there a dress code?",
    good: "No dress code. Some customer-facing sites ask for business casual when you host visitors.",
    bad: [
      "Business casual, with no exceptions.",
      "Formal business attire is required in all offices.",
    ],
    refuse: "Appearance is a personal matter rather than policy.",
  },
  {
    id: "desk-booking", section: "Working here", intent: "how_to", difficulty: "easy",
    q: "How do I get a desk at the office?",
    good: "Book a desk in the office app up to 14 days ahead. Unbooked desks are first come, first served.",
    bad: [
      "Desks are assigned permanently to each team.",
      "You cannot book a desk; you turn up and find a free one.",
    ],
    refuse: "Workplace booking is managed by facilities.",
  },
  {
    id: "remote-setup", section: "Where you work", intent: "policy_fact", difficulty: "medium",
    q: "Is there a budget for home office equipment?",
    good: "400 once, for the first remote setup, claimed through the expenses tool. Replacements need manager approval.",
    bad: [
      "There is no home office budget; you provide your own equipment.",
      "1000 per year, renewable, with no approval needed.",
    ],
    refuse: "Equipment budgets sit with your manager.",
  },
  {
    id: "phone", section: "Equipment", intent: "policy_fact", difficulty: "easy",
    q: "Do I get a work phone?",
    good: "Yes, for anyone who is on call or whose role is field based. Otherwise use your own with a 20 GB company plan.",
    bad: [
      "No, everyone uses their own phone.",
      "Yes, a new phone is issued to every employee every year.",
    ],
    refuse: "Device allocation is an IT decision.",
  },
  {
    id: "commute", section: "Expenses", intent: "boundary", difficulty: "medium",
    q: "Is my commute paid for?",
    good: "Up to 400 a month for approved remote days, claimed in the expenses tool. Travel to a permanent office is not covered.",
    bad: [
      "The full commute cost is reimbursed every month.",
      "Commuting is not covered in any form.",
    ],
    refuse: "Commuting arrangements are between you and the tax office.",
  },
  {
    id: "cycle-scheme", section: "Benefits", intent: "policy_fact", difficulty: "medium",
    q: "Is there a cycle-to-work scheme?",
    good: "Yes, up to 2000 through salary sacrifice, with safety lights and a helmet provided on request.",
    bad: [
      "No, the company has no cycle scheme.",
      "Up to 5000 through salary sacrifice, with a bike provided.",
    ],
    refuse: "Salary sacrifice schemes are handled by payroll.",
  },
  {
    id: "gym", section: "Benefits", intent: "boundary", difficulty: "medium",
    q: "Does the company pay for my gym?",
    good: "Up to 40 a month, on any gym, claimed in the expenses tool. Not available while fully remote in a country with no office.",
    bad: [
      "The full cost of any gym membership is paid.",
      "No, the company does not cover fitness costs.",
    ],
    refuse: "Wellbeing benefits are not covered in the handbook.",
  },
  {
    id: "sick-pay", section: "Leave and time off", intent: "policy_fact", difficulty: "medium",
    q: "Am I paid during sick leave?",
    good: "Fully paid for the first 10 days, then half pay for up to 20 more.",
    bad: [
      "Unpaid from day one.",
      "Fully paid indefinitely, however long the absence.",
    ],
    refuse: "Sick pay is a payroll question.",
  },
  {
    id: "parental-bereavement", section: "Leave and time off", intent: "policy_fact", difficulty: "medium",
    q: "How much bereavement leave do I get?",
    good: "10 days paid, for immediate family, at any point in the year.",
    bad: [
      "3 days, and only if the death is immediate family.",
      "There is no separate bereavement leave; use your PTO.",
    ],
    refuse: "Bereavement is a personal matter.",
  },
  {
    id: "adoption-leave", section: "Leave and time off", intent: "boundary", difficulty: "hard",
    q: "Is adoption leave the same as parental leave?",
    good: "Yes, the same 18 weeks at full pay, and it can be split into at most three blocks.",
    bad: [
      "No, adoption leave is 8 weeks and cannot be split.",
      "Adoption leave is unpaid, separate from parental leave.",
    ],
    refuse: "Adoption leave is handled confidentially by People.",
  },
  {
    id: "fertility-leave", section: "Leave and time off", intent: "boundary", difficulty: "hard",
    q: "What leave do I get for fertility treatment?",
    good: "6 weeks per cycle, up to 3 cycles, at full pay, arranged the same way as parental leave.",
    bad: [
      "Fertility treatment is unpaid and needs no arrangement.",
      "You get 12 weeks once per year for any medical treatment.",
    ],
    refuse: "Medical leave arrangements are confidential.",
  },
  {
    id: "sabbatical", section: "Leave and time off", intent: "boundary", difficulty: "hard",
    q: "Can I take a sabbatical?",
    good: "4 weeks unpaid after 5 years of service, approved by your manager and People. It does not accrue PTO.",
    bad: [
      "There is no sabbatical scheme.",
      "6 weeks fully paid after 3 years of service.",
    ],
    refuse: "Sabbaticals are a career conversation, not a policy one.",
  },
  {
    id: "pension", section: "Benefits", intent: "policy_fact", difficulty: "medium",
    q: "Does the company contribute to my pension?",
    good: "Yes, 5% of salary above the legal minimum, paid monthly, with 4% more available at your own election.",
    bad: [
      "No, the company makes no pension contributions.",
      "15% of salary, matched up to 10% of your own.",
    ],
    refuse: "Pension arrangements are set by the provider.",
  },
  {
    id: "salary-review", section: "Compensation", intent: "policy_fact", difficulty: "medium",
    q: "When are salaries reviewed?",
    good: "Once a year, in April, effective the first of May. Out-of-cycle changes happen only for a role change or a retention risk.",
    bad: [
      "Twice a year, in April and October.",
      "Salaries are reviewed whenever performance reviews happen.",
    ],
    refuse: "Compensation is confidential between you and your manager.",
  },
  {
    id: "bonus", section: "Compensation", intent: "boundary", difficulty: "hard",
    q: "Is there a performance bonus?",
    good: "A discretionary bonus is possible, tied to company performance and decided in February. It is not contractual and is not paid every year.",
    bad: [
      "Yes, a guaranteed 10% bonus paid every January.",
      "No, the company does not pay bonuses.",
    ],
    refuse: "Bonus questions are confidential.",
  },
  {
    id: "equity-refresh", section: "Compensation", intent: "boundary", difficulty: "hard",
    q: "Do my share options refresh?",
    good: "They vest over 4 years with a 1-year cliff, and refresh grants are decided in the same cycle as the promotion cycle.",
    bad: [
      "They vest immediately with no cliff.",
      "They refresh automatically every 12 months.",
    ],
    refuse: "Equity is confidential and not covered here.",
  },
  {
    id: "relocation", section: "Expenses", intent: "boundary", difficulty: "hard",
    q: "Will the company help me relocate?",
    good: "Up to 5000 for an approved relocation, claimed in the expenses tool, and it is repayable if you leave within 12 months.",
    bad: [
      "The company covers relocation up to 20,000 with no repayment.",
      "Relocation is not supported in any form.",
    ],
    refuse: "Relocation support is agreed case by case.",
  },
  {
    id: "parking", section: "Working here", intent: "policy_fact", difficulty: "easy",
    q: "Is parking free at the office?",
    good: "Yes, at every office, in the space marked for staff. Visitor parking is limited to two hours.",
    bad: [
      "No, parking costs 15 a day.",
      "Only electric cars park free.",
    ],
    refuse: "Parking is a site matter.",
  },
  {
    id: "onboarding-dev", section: "Working here", intent: "how_to", difficulty: "medium",
    q: "How is a new developer laptop set up?",
    good: "You request it in the IT portal on day one; it arrives imaged with the standard toolchain, and repo access is granted by your manager.",
    bad: [
      "You order your own laptop and claim it back over two years.",
      "IT sets up the laptop only after probation ends.",
    ],
    refuse: "IT provisioning is outside the handbook.",
  },
  {
    id: "dev-environment", section: "Working here", intent: "how_to", difficulty: "medium",
    q: "What do I need to start working on a service?",
    good: "Repo access from your manager, a dev environment from the platform team, and a staging deploy key. All three are requested in the IT portal.",
    bad: [
      "A production key, granted by the service owner.",
      "Nothing — the build system creates the environment automatically.",
    ],
    refuse: "Developer setup is handled by the platform team.",
  },
  {
    id: "access-review", section: "Security", intent: "policy_fact", difficulty: "medium",
    q: "How often is system access reviewed?",
    good: "Every quarter. Access that is no longer needed is removed without notice, and asking to keep it is a manager decision.",
    bad: [
      "Once a year, at the performance review.",
      "Access is never reviewed; it is removed only when someone leaves.",
    ],
    refuse: "Access reviews are run by the security team.",
  },
  {
    id: "data-download", section: "Data handling", intent: "boundary", difficulty: "hard",
    q: "Can I download customer data to my laptop to work from home?",
    good: "No. Use the access you have in the product. Anything genuinely needed locally needs manager and DPO approval, and the data is deleted afterwards.",
    bad: [
      "Yes, as long as the file is deleted afterwards.",
      "Yes, for files under 1000 rows.",
    ],
    refuse: "Data handling questions go to the DPO.",
  },
  {
    id: "logging-pii", section: "Data handling", intent: "policy_fact", difficulty: "medium",
    q: "What must not go into application logs?",
    good: "No personal data, credentials or full card numbers. Log the request id and the outcome instead.",
    bad: [
      "Only passwords must be excluded; personal data is fine.",
      "Logs must contain the full request body for debugging.",
    ],
    refuse: "Logging standards are an engineering decision.",
  },
  {
    id: "open-source", section: "Engineering", intent: "boundary", difficulty: "hard",
    q: "Can I add an open-source dependency?",
    good: "Yes, if the licence is permissive and the security review flags nothing. Copyleft licences need a written exception from Legal.",
    bad: [
      "No, every dependency needs a full legal contract.",
      "Yes, any licence, without review.",
    ],
    refuse: "Licence questions are a legal matter.",
  },
  {
    id: "incident-postmortem", section: "Engineering", intent: "how_to", difficulty: "medium",
    q: "Do we write postmortems after incidents?",
    good: "Yes, blameless, within 5 working days of a production incident, and the actions are tracked to completion.",
    bad: [
      "Only for incidents over 4 hours of downtime.",
      "No, we fix the issue and move on.",
    ],
    refuse: "Engineering process is not in the handbook.",
  },
  {
    id: "oncall", section: "Engineering", intent: "policy_fact", difficulty: "medium",
    q: "How does the on-call rota work?",
    good: "A weekly rota with a named primary and secondary, one week in six, and a day off in lieu the following week.",
    bad: [
      "On call is opt-in and unpaid, with no rotation.",
      "Every engineer is on call permanently.",
    ],
    refuse: "Rotas are set by your team.",
  },
  {
    id: "decommission", section: "Engineering", intent: "how_to", difficulty: "hard",
    q: "How do I decommission a service?",
    good: "Confirm the owning team and all callers, write a deprecation note 30 days ahead, then remove it. Data is deleted per the retention rules.",
    bad: [
      "Delete the repository and turn the machine off.",
      "Ask the platform team to do it when you have time.",
    ],
    refuse: "Service ownership is a team question.",
  },
  {
    id: "customer-data-views", section: "Data handling", intent: "boundary", difficulty: "hard",
    q: "Who can look at a customer's full support history?",
    good: "Only the assigned support engineers and their team lead, for as long as the case is open, and every view is logged.",
    bad: [
      "Any engineer, for debugging purposes.",
      "Only the account manager named on the contract.",
    ],
    refuse: "Access to customer data is restricted.",
  },
  {
    id: "procurement-cycle", section: "Purchasing", intent: "how_to", difficulty: "medium",
    q: "How long does procurement approval take?",
    good: "5 working days for a tool under 10000, and 15 for anything larger. Start before you need it.",
    bad: [
      "It is instant; the form is self-service.",
      "There is no fixed timeline; it can take months.",
    ],
    refuse: "Procurement timing is not documented here.",
  },
  {
    id: "vendor-review", section: "Purchasing", intent: "boundary", difficulty: "hard",
    q: "When is a vendor re-reviewed?",
    good: "Every 12 months, or immediately if the vendor changes ownership or starts processing customer data in a new region.",
    bad: [
      "Vendors are reviewed once at contract signature.",
      "There is no re-review requirement.",
    ],
    refuse: "Vendor management is handled by procurement.",
  },
  {
    id: "travel-class", section: "Travel", intent: "policy_fact", difficulty: "medium",
    q: "What flights can I book?",
    good: "Economy under 6 hours, premium economy above 6 hours, business only with director approval. Book early: fares over 30 days out are cheapest.",
    bad: [
      "Business class for all flights.",
      "Economy only, regardless of flight length.",
    ],
    refuse: "Travel class is approved individually.",
  },
  {
    id: "travel-expense-day", section: "Travel", intent: "boundary", difficulty: "medium",
    q: "What is the daily rate for meals while travelling?",
    good: "25 a day with no receipt. Above that, a receipt is required and the meal is reimbursed in full.",
    bad: [
      "50 a day with no receipt.",
      "There is no daily rate; meals are reimbursed at actual cost always.",
    ],
    refuse: "Meal rates are agreed with your manager.",
  },
  {
    id: "timezone-overlap", section: "Working here", intent: "policy_fact", difficulty: "easy",
    q: "What are the core collaboration hours?",
    good: "11:00 to 16:00 in your local office timezone, with the rest of the day flexible and notifications off.",
    bad: [
      "09:00 to 17:00, with no flexibility.",
      "There are no core hours; the team picks.",
    ],
    refuse: "Working hours are agreed with your team.",
  },
  {
    id: "async-default", section: "Working here", intent: "policy_fact", difficulty: "medium",
    q: "When should I schedule a meeting?",
    good: "Only when a live discussion is genuinely needed. Otherwise write it down; a meeting needs an agenda 24 hours ahead.",
    bad: [
      "Whenever a decision is needed.",
      "Never; the company is fully async by policy.",
    ],
    refuse: "Meeting culture is a team preference.",
  },
  {
    id: "onboarding-checklist", section: "Working here", intent: "how_to", difficulty: "medium",
    q: "What is in the onboarding checklist?",
    good: "Accounts, payroll, the handbook read, security training, a buddy session in week one, and a 30-day check-in with your manager.",
    bad: [
      "Only payroll and accounts.",
      "A full month of shadowing every team.",
    ],
    refuse: "The checklist is owned by People.",
  },
  {
    id: "internal-transfer", section: "Working here", intent: "exception", difficulty: "hard",
    q: "Can I move to another team internally?",
    good: "Yes, after 6 months in a role, through the internal listing. Your current manager is told, and you keep your level and tenure.",
    bad: [
      "No, internal moves end the employment relationship.",
      "Yes, immediately, with no notice to your current manager.",
    ],
    refuse: "Internal mobility is discussed individually.",
  },
  {
    id: "notice-during-probation", section: "Working here", intent: "boundary", difficulty: "hard",
    q: "Do I have to give notice during probation?",
    good: "No. Notice is waived during the 3-month probation, and so is pay in lieu of notice.",
    bad: [
      "Yes, the standard 1 month applies during probation.",
      "Probation requires 3 months notice.",
    ],
    refuse: "Probation terms are in your contract.",
  },
  {
    id: "part-time", section: "Working here", intent: "exception", difficulty: "hard",
    q: "Can I move to part time?",
    good: "Yes, at 4 or 5 days a week, with manager and People approval. Pro-rated, and learning budget and PTO stay unchanged.",
    bad: [
      "No, all roles are full time.",
      "Yes, for anyone, at any proportion, with no approval needed.",
    ],
    refuse: "Part-time arrangements are case by case.",
  },
  {
    id: "expense-late", section: "Expenses", intent: "boundary", difficulty: "medium",
    q: "What if I miss the 30-day expense deadline?",
    good: "It is not reimbursed unless the manager and Finance approve the exception in writing, which is rare.",
    bad: [
      "It is reimbursed on the next payroll run automatically.",
      "It is never reimbursed, with no exception process.",
    ],
    refuse: "Expense exceptions are not something I can confirm.",
  },
  {
    id: "corporate-card", section: "Expenses", intent: "how_to", difficulty: "medium",
    q: "When do I need to use the corporate card?",
    good: "For any supplier payment above 500, and for any travel booked through the booking tool. Personal spend on the card is not reimbursed.",
    bad: [
      "Only for travel; everything else is claimed on reimbursement.",
      "Any supplier payment at all must use the card.",
    ],
    refuse: "Card policy is issued by Finance.",
  },
  {
    id: "confidentiality", section: "Ethics", intent: "policy_fact", difficulty: "medium",
    q: "What counts as confidential information?",
    good: "Customer data, unreleased plans, source code, and anything marked internal. It stays confidential after you leave.",
    bad: [
      "Only customer data. Everything else is fair game internally.",
      "Nothing is confidential once a project has shipped.",
    ],
    refuse: "Confidentiality is a legal matter.",
  },
  {
    id: "conflict-interest", section: "Ethics", intent: "boundary", difficulty: "hard",
    q: "What if a supplier is run by my sibling?",
    good: "Declare it in the conflict register and step out of any decision about that supplier. Procurement continues as normal.",
    bad: [
      "It is fine as long as you do not tell your manager.",
      "You must leave the company within 30 days.",
    ],
    refuse: "Conflicts of interest are handled by Legal.",
  },
  {
    id: "speak-up", section: "Ethics", intent: "how_to", difficulty: "medium",
    q: "How do I report a concern I think is misconduct?",
    good: "To any manager, the ethics line, or anonymously through the form. Reports are investigated separately from the team involved.",
    bad: [
      "Only to your own manager, in person.",
      "There is no reporting route for concerns.",
    ],
    refuse: "Misconduct reporting is confidential.",
  },
  {
    id: "press-commentary", section: "Ethics", intent: "boundary", difficulty: "medium",
    q: "Can I speak to a journalist about the company?",
    good: "No. Only the communications team may comment publicly, and they will route the request rather than answer it.",
    bad: [
      "Yes, as long as you are not sharing customer data.",
      "Yes, with written manager approval.",
    ],
    refuse: "Media matters are not a policy question.",
  },
  {
    id: "ai-use", section: "Ethics", intent: "boundary", difficulty: "hard",
    q: "Can I paste customer data into an external AI tool?",
    good: "No. Customer data never leaves our own tools. Non-sensitive internal content is fine in an approved tool.",
    bad: [
      "Yes, as long as you remove names.",
      "Yes, with manager approval per use.",
    ],
    refuse: "AI usage is not covered in the handbook.",
  },
  {
    id: "recording-meetings", section: "Working here", intent: "boundary", difficulty: "medium",
    q: "Can I record a meeting with customers in it?",
    good: "Only with the consent of everyone present, announced at the start. Recordings are not kept.",
    bad: [
      "Yes, for internal training, without announcing it.",
      "No, recording is never allowed with anyone external.",
    ],
    refuse: "Recording consent is a legal question.",
  },
  {
    id: "badge-sharing", section: "Security", intent: "policy_fact", difficulty: "easy",
    q: "Can I let a colleague use my badge?",
    good: "No. Badges are personal. A visitor needs a visitor pass from reception.",
    bad: [
      "Yes, for a one-off visit to a meeting.",
      "Yes, if the colleague signs in at reception.",
    ],
    refuse: "Access rules are enforced by security.",
  },
  {
    id: "device-lock", section: "Security", intent: "policy_fact", difficulty: "medium",
    q: "What happens if I lose my laptop?",
    good: "Report it within 1 hour. It is wiped remotely, and the replacement is a same-day courier on production sites.",
    bad: [
      "Nothing, it is replaced at the next equipment cycle.",
      "You buy a replacement and claim it back.",
    ],
    refuse: "Lost devices are an IT matter.",
  },
  {
    id: "secret-rotation", section: "Security", intent: "how_to", difficulty: "hard",
    q: "How often are service credentials rotated?",
    good: "Every 90 days, through the secrets manager. Rotating by hand in a deployment is a policy breach.",
    bad: [
      "Once a year, or whenever a developer remembers.",
      "Never, because services are internal.",
    ],
    refuse: "Secrets management is a platform concern.",
  },
  {
    id: "test-data", section: "Data handling", intent: "boundary", difficulty: "hard",
    q: "Can I use real customer data in tests?",
    good: "No. Tests use generated or anonymised data. Real data in a test environment is a reportable incident.",
    bad: [
      "Yes, in staging only, with the data deleted after the run.",
      "Yes, for any non-production environment.",
    ],
    refuse: "Test data is governed by the DPO.",
  },
  {
    id: "support-hours", section: "Working here", intent: "policy_fact", difficulty: "medium",
    q: "What are the support hours?",
    good: "24/7 for tier 1. Tier 2 follows the sun rota; tier 1 covers nights and weekends.",
    bad: [
      "Business hours only, Monday to Friday.",
      "24/7 for all tiers, with no rota.",
    ],
    refuse: "Support hours are set by the service owner.",
  },
  {
    id: "maintenance-window", section: "Working here", intent: "boundary", difficulty: "medium",
    q: "When can I take a production system down?",
    good: "Never during business hours. Changes go through the Friday window, and any emergency change is retro-approved within 2 working days.",
    bad: [
      "Anytime, as long as you tell the team afterwards.",
      "Only at the end of the quarter.",
    ],
    refuse: "Change windows are agreed with the service owner.",
  },
  {
    id: "customer-escalation", section: "Working here", intent: "how_to", difficulty: "medium",
    q: "How do I escalate a customer complaint?",
    good: "Move it to the duty manager, who owns it within 4 hours. Log the escalation so it is visible to everyone on the account.",
    bad: [
      "Handle it yourself and reply within 2 business days.",
      "Escalate by emailing the founders.",
    ],
    refuse: "Escalation paths are not in the handbook.",
  },
  {
    id: "nps", section: "Working here", intent: "boundary", difficulty: "medium",
    q: "Does the company track customer satisfaction?",
    good: "Yes, a monthly NPS survey, plus a support CSAT after every closed ticket. Both go to the service owner, not the individual agent.",
    bad: [
      "No, satisfaction is judged anecdotally.",
      "Yes, and each agent gets a personal score used in review.",
    ],
    refuse: "Survey programmes are a product question.",
  },
  {
    id: "deprecation-notice", section: "Engineering", intent: "policy_fact", difficulty: "medium",
    q: "How much notice do customers get before a feature is removed?",
    good: "60 days in writing, with a migration path. Internal-only features need 14 days in the changelog.",
    bad: [
      "14 days, in the changelog only.",
      "There is no notice requirement for internal features.",
    ],
    refuse: "Customer notice periods are a product decision.",
  },
  {
    id: "feature-flag", section: "Engineering", intent: "how_to", difficulty: "medium",
    q: "What do I do with a feature flag after launch?",
    good: "Set a removal date when you create it, and delete it after full rollout. Flags older than 6 months are a build failure.",
    bad: [
      "Leave it on; removing it risks a rollback.",
      "Flags are removed at the end of the quarter, automatically.",
    ],
    refuse: "Engineering standards are not in the handbook.",
  },
  {
    id: "capacity-alert", section: "Engineering", intent: "boundary", difficulty: "hard",
    q: "Who do I tell if a service is at 90% capacity?",
    good: "Page the service owner, who has the budget to scale. Capacity at 80% is a dashboard, not a page.",
    bad: [
      "Nobody; capacity planning happens quarterly.",
      "Page the whole engineering channel at 70%.",
    ],
    refuse: "Capacity is tracked by the infra team.",
  },
  {
    id: "model-change", section: "Engineering", intent: "how_to", difficulty: "hard",
    q: "What do I do before switching a production feature to a different model?",
    good: "Run the feature's eval suite on both models, compare on the same items, and get a reviewer who did not write the eval to sign off on the diff.",
    bad: [
      "Switch it and watch the dashboards for a week.",
      "Switch it if the new model is newer.",
    ],
    refuse: "Model choices are engineering decisions.",
  },
  {
    id: "eval-ownership", section: "Engineering", intent: "policy_fact", difficulty: "medium",
    q: "Who owns the eval suite for a feature?",
    good: "The team that owns the feature. Eval sets live next to the code and are updated in the same pull request as the change they cover.",
    bad: [
      "The QA team owns all eval sets centrally.",
      "Nobody owns them; they are run occasionally by whoever is free.",
    ],
    refuse: "Ownership is a team convention.",
  },
];

/** Questions the handbook genuinely does not answer. */
export const OUT_OF_SCOPE = [
  {
    id: "oos-salary", section: "Compensation", intent: "out_of_scope", difficulty: "medium",
    q: "What salary band is the Data Engineer role in?",
    good: "The handbook does not cover compensation bands. Ask your manager or the People team for the current band.",
    bad: [
      "The Data Engineer band starts at 85,000 and tops out at 110,000.",
      "Bands are published every January and Data Engineer is currently band 4.",
    ],
    refuse: "I cannot help with salary questions.",
  },
  {
    id: "oos-childcare", section: "Benefits", intent: "out_of_scope", difficulty: "hard",
    q: "Does the company run a crèche or subsidise child care?",
    good: "The handbook does not mention child care or a crèche. Your local benefits portal lists what applies in your country.",
    bad: [
      "Yes, there is an on-site crèche from 8 to 18, subsidised to 200 a month.",
      "Child care is covered in full for the first child.",
    ],
    refuse: "Family benefits are outside the handbook.",
  },
  {
    id: "oos-equity", section: "Investing", intent: "out_of_scope", difficulty: "hard",
    q: "Is there an employee share scheme I can buy into?",
    good: "The handbook does not describe an employee share scheme. Ask the People team whether one is running.",
    bad: [
      "Yes, you can buy up to 20,000 of shares each year at a 25% discount.",
      "There is an employee share option pool that vests over 4 years.",
    ],
    refuse: "Share schemes are confidential.",
  },
  {
    id: "oos-internship", section: "Hiring", intent: "out_of_scope", difficulty: "medium",
    q: "Do you run a summer internship programme?",
    good: "The handbook does not cover internships. The careers page lists any open programme.",
    bad: [
      "Yes, a 12-week paid internship runs every summer, applications open in January.",
      "We take on two interns a year, in engineering only.",
    ],
    refuse: "Hiring programmes are managed by the talent team.",
  },
  {
    id: "oos-headcount", section: "Planning", intent: "out_of_scope", difficulty: "hard",
    q: "How many people will be hired in engineering next quarter?",
    good: "The handbook does not include hiring plans. Ask your manager for the current team plan.",
    bad: [
      "Engineering will hire 12 people next quarter, mostly in platform.",
      "There is a freeze on engineering hiring until the end of the year.",
    ],
    refuse: "Headcount plans are not public.",
  },
  {
    id: "oos-valuation", section: "Compensation", intent: "out_of_scope", difficulty: "hard",
    q: "What is the company valued at after the last round?",
    good: "The handbook does not discuss company valuation. That information is shared with employees in the all-hands when there is news.",
    bad: [
      "The last round valued the company at 1.2 billion.",
      "The valuation is capped at 800 million until the next round.",
    ],
    refuse: "Valuation is confidential.",
  },
  {
    id: "oos-layoffs", section: "Planning", intent: "out_of_scope", difficulty: "hard",
    q: "Are there going to be layoffs this year?",
    good: "The handbook does not cover staffing plans. Your manager is the right person to ask.",
    bad: [
      "Yes, a 10% reduction is planned for the second half of the year.",
      "No, the company has committed to no layoffs for three years.",
    ],
    refuse: "Workforce decisions are not something I can discuss.",
  },
];

/* ================================================================== *
 * 2. The recipe extraction corpus (module 3)
 *
 * A recipe is turned into JSON. The correct output is known exactly, which
 * is the point: when a check can be written down precisely, write it down
 * and do not pay a model to look at it.
 * ================================================================== */

export const RECIPES = [
  { id: "r01", name: "Sourdough loaf", yields: "1 loaf", prep: 30, bake: 45, temp_c: 230, tags: ["bread"], ingredients: [["strong white flour", 500, "g"], ["water", 350, "ml"], ["active starter", 100, "g"], ["salt", 10, "g"]], steps: ["Mix flour, water and starter, rest 1 hour.", "Add salt, fold every 30 minutes for 3 hours.", "Shape, prove overnight in the fridge.", "Bake 45 minutes at 230 C with steam."] },
  { id: "r02", name: "Tomato soup", yields: "4 servings", prep: 10, bake: 35, temp_c: 190, tags: ["soup", "vegan"], ingredients: [["tinned tomatoes", 800, "g"], ["onion", 1, "whole"], ["olive oil", 2, "tbsp"], ["basil", 1, "handful"]], steps: ["Soften the onion in oil.", "Add tomatoes, simmer 25 minutes.", "Blend with basil, season."] },
  { id: "r03", name: "Banana bread", yields: "1 tin", prep: 15, bake: 50, temp_c: 170, tags: ["baking"], ingredients: [["bananas", 3, "whole"], ["plain flour", 250, "g"], ["sugar", 150, "g"], ["butter", 100, "g"]], steps: ["Mash the bananas.", "Cream butter and sugar, fold in flour and bananas.", "Bake 50 minutes at 170 C."] },
  { id: "r04", name: "Chicken curry", yields: "4 servings", prep: 20, bake: 40, temp_c: 180, tags: ["main", "gluten-free"], ingredients: [["chicken thighs", 700, "g"], ["coconut milk", 400, "ml"], ["curry powder", 2, "tbsp"], ["onion", 1, "whole"]], steps: ["Brown the chicken, set aside.", "Fry onion and curry powder.", "Return chicken, add coconut milk, simmer 25 minutes."] },
  { id: "r05", name: "Pesto", yields: "1 jar", prep: 10, bake: 0, temp_c: 0, tags: ["sauce", "vegetarian"], ingredients: [["basil", 100, "g"], ["pine nuts", 50, "g"], ["parmesan", 80, "g"], ["olive oil", 150, "ml"]], steps: ["Toast the pine nuts.", "Blend everything until smooth."] },
  { id: "r06", name: "Banana pancakes", yields: "8 pancakes", prep: 10, bake: 15, temp_c: 200, tags: ["breakfast"], ingredients: [["bananas", 2, "whole"], ["eggs", 2, "whole"], ["oats", 100, "g"], ["milk", 50, "ml"]], steps: ["Blend everything smooth.", "Cook 2 minutes a side in a hot pan."] },
  { id: "r07", name: "Roast chicken", yields: "4 servings", prep: 20, bake: 80, temp_c: 200, tags: ["main"], ingredients: [["whole chicken", 1.6, "kg"], ["butter", 50, "g"], ["lemon", 1, "whole"], ["thyme", 4, "sprigs"]], steps: ["Rub with butter, lemon and thyme.", "Roast 80 minutes at 200 C, basting twice."] },
  { id: "r08", name: "Mushroom risotto", yields: "4 servings", prep: 15, bake: 30, temp_c: 180, tags: ["main", "vegetarian"], ingredients: [["arborio rice", 320, "g"], ["mushrooms", 400, "g"], ["stock", 1.2, "l"], ["parmesan", 60, "g"]], steps: ["Fry the mushrooms, set aside.", "Toast the rice, add stock ladle by ladle for 25 minutes.", "Beat in parmesan off the heat."] },
  { id: "r09", name: "Garlic bread", yields: "4 slices", prep: 5, bake: 10, temp_c: 200, tags: ["side"], ingredients: [["baguette", 1, "whole"], ["garlic", 3, "cloves"], ["butter", 50, "g"], ["parsley", 1, "handful"]], steps: ["Slice and butter the baguette.", "Wrap in foil, bake 10 minutes at 200 C."] },
  { id: "r10", name: "Beef stew", yields: "6 servings", prep: 25, bake: 120, temp_c: 160, tags: ["main"], ingredients: [["beef chuck", 1, "kg"], ["carrots", 3, "whole"], ["onion", 2, "whole"], ["red wine", 300, "ml"]], steps: ["Brown the beef in batches.", "Add vegetables and wine, braise 2 hours at 160 C."] },
  { id: "r11", name: "Lemon cake", yields: "1 cake", prep: 20, bake: 40, temp_c: 180, tags: ["baking"], ingredients: [["flour", 300, "g"], ["sugar", 250, "g"], ["butter", 200, "g"], ["eggs", 4, "whole"], ["lemon", 2, "whole"]], steps: ["Cream butter and sugar, add eggs one at a time.", "Fold in flour and zest.", "Bake 40 minutes at 180 C."] },
  { id: "r12", name: "Lentil soup", yields: "6 servings", prep: 10, bake: 35, temp_c: 190, tags: ["soup", "vegan"], ingredients: [["red lentils", 400, "g"], ["carrot", 2, "whole"], ["onion", 1, "whole"], ["cumin", 2, "tsp"]], steps: ["Fry onion and cumin.", "Add lentils and stock, simmer 25 minutes, blend."] },
  { id: "r13", name: "Chocolate brownies", yields: "16 pieces", prep: 15, bake: 25, temp_c: 180, tags: ["baking"], ingredients: [["dark chocolate", 200, "g"], ["butter", 150, "g"], ["sugar", 200, "g"], ["eggs", 3, "whole"], ["flour", 100, "g"]], steps: ["Melt chocolate and butter together.", "Beat in sugar and eggs, fold in flour.", "Bake 25 minutes at 180 C."] },
  { id: "r14", name: "Greek salad", yields: "4 servings", prep: 15, bake: 0, temp_c: 0, tags: ["side", "vegetarian"], ingredients: [["cucumber", 1, "whole"], ["tomatoes", 4, "whole"], ["feta", 200, "g"], ["olive oil", 3, "tbsp"]], steps: ["Chop everything roughly.", "Dress with oil and oregano."] },
  { id: "r15", name: "Mashed potato", yields: "4 servings", prep: 15, bake: 0, temp_c: 0, tags: ["side", "vegetarian"], ingredients: [["potatoes", 1, "kg"], ["butter", 100, "g"], ["milk", 200, "ml"]], steps: ["Boil 20 minutes, drain.", "Beat with butter and milk until smooth."] },
  { id: "r16", name: "Pad thai", yields: "2 servings", prep: 20, bake: 15, temp_c: 200, tags: ["main"], ingredients: [["rice noodles", 200, "g"], ["prawns", 250, "g"], ["tamarind", 2, "tbsp"], ["eggs", 2, "whole"]], steps: ["Soak the noodles.", "Stir fry prawns, add noodles, egg and tamarind."] },
  { id: "r17", name: "Apple crumble", yields: "6 servings", prep: 20, bake: 40, temp_c: 180, tags: ["dessert", "vegetarian"], ingredients: [["apples", 6, "whole"], ["oats", 100, "g"], ["butter", 100, "g"], ["brown sugar", 120, "g"]], steps: ["Simmer apples with sugar.", "Rub butter into oats and sugar for the topping.", "Bake 40 minutes at 180 C."] },
  { id: "r18", name: "French onion soup", yields: "4 servings", prep: 20, bake: 60, temp_c: 180, tags: ["soup", "vegetarian"], ingredients: [["onions", 6, "whole"], ["beef stock", 1.5, "l"], ["butter", 60, "g"], ["gruyere", 150, "g"]], steps: ["Cook onions in butter 40 minutes until dark.", "Add stock, simmer, then bake with gruyere on top."] },
  { id: "r19", name: "Fish tacos", yields: "4 servings", prep: 20, bake: 10, temp_c: 220, tags: ["main"], ingredients: [["white fish", 500, "g"], ["tortillas", 8, "whole"], ["cabbage", 200, "g"], ["lime", 2, "whole"]], steps: ["Season and bake the fish 10 minutes at 220 C.", "Warm the tortillas, assemble with cabbage and lime."] },
  { id: "r20", name: "Vegetable curry", yields: "4 servings", prep: 15, bake: 30, temp_c: 180, tags: ["main", "vegan", "gluten-free"], ingredients: [["mixed vegetables", 600, "g"], ["coconut milk", 400, "ml"], ["curry powder", 2, "tbsp"]], steps: ["Fry curry powder, add vegetables and coconut milk.", "Simmer 25 minutes."] },
];

/* ================================================================== *
 * 3. The agent corpus (module 9)
 *
 * Multi-step runs with a known end state and a known first bad step. The
 * second one is the interesting half: a run can reach the right answer and
 * still be wrong in a way only a trajectory check catches.
 * ================================================================== */

export const AGENT_RUNS = [
  { id: "a01", task: "Scale a banana bread recipe from 1 tin to 3 tins and set a timer for the bake.", steps: ["search_recipe(bread)", "scale_quantities(1→3)", "set_timer(50 min)"], end_state: "ok", first_bad_step: -1, tools: ["search_recipe", "scale_quantities", "set_timer"] },
  { id: "a02", task: "Convert 350 g flour to cups for the pancake recipe.", steps: ["search_recipe(pancakes)", "convert_units(350 g→cup)"], end_state: "ok", first_bad_step: -1, tools: ["search_recipe", "convert_units"] },
  { id: "a03", task: "Find a gluten-free main and tell me the cook time.", steps: ["search_recipe(tags=gluten-free)", "read_recipe(id)"], end_state: "ok", first_bad_step: -1, tools: ["search_recipe", "read_recipe"] },
  { id: "a04", task: "Scale the beef stew from 6 to 2 servings.", steps: ["search_recipe(stew)", "scale_quantities(6→2)"], end_state: "ok", first_bad_step: -1, tools: ["search_recipe", "scale_quantities"] },
  { id: "a05", task: "Find a vegan soup and convert 400 ml coconut milk to cups.", steps: ["search_recipe(tags=vegan,soup)", "convert_units(400 ml→cup)"], end_state: "ok", first_bad_step: -1, tools: ["search_recipe", "convert_units"] },
  { id: "a06", task: "Double the brownies and remind me to take them out.", steps: ["search_recipe(brownies)", "scale_quantities(1→2)", "set_timer(25 min)"], end_state: "ok", first_bad_step: -1, tools: ["search_recipe", "scale_quantities", "set_timer"] },
  { id: "a07", task: "What temperature do I roast the chicken at, and how long?", steps: ["search_recipe(roast chicken)", "read_recipe(id)"], end_state: "ok", first_bad_step: -1, tools: ["search_recipe", "read_recipe"] },
  { id: "a08", task: "Find a dessert that uses apples and halve the quantities.", steps: ["search_recipe(apple)", "scale_quantities(6→3)"], end_state: "ok", first_bad_step: -1, tools: ["search_recipe", "scale_quantities"] },
  { id: "a09", task: "Convert 1.6 kg chicken to pounds and set a timer for 80 minutes.", steps: ["convert_units(1.6 kg→lb)", "set_timer(80 min)"], end_state: "ok", first_bad_step: -1, tools: ["convert_units", "set_timer"] },
  { id: "a10", task: "Find a side that takes under 15 minutes and list the ingredients.", steps: ["search_recipe(tags=side)", "read_recipe(id)"], end_state: "ok", first_bad_step: -1, tools: ["search_recipe", "read_recipe"] },
  { id: "a11", task: "Scale the risotto to 8 and tell me when it is ready.", steps: ["search_recipe(risotto)", "scale_quantities(4→8)", "set_timer(25 min)"], end_state: "ok", first_bad_step: -1, tools: ["search_recipe", "scale_quantities", "set_timer"] },
  { id: "a12", task: "Find a main with no gluten and convert 700 g to pounds.", steps: ["search_recipe(tags=main,gluten-free)", "convert_units(700 g→lb)"], end_state: "ok", first_bad_step: -1, tools: ["search_recipe", "convert_units"] },
  { id: "a13", task: "Halve the lemon cake and set a timer for the bake.", steps: ["search_recipe(lemon cake)", "scale_quantities(1→0.5)", "set_timer(40 min)"], end_state: "ok", first_bad_step: -1, tools: ["search_recipe", "scale_quantities", "set_timer"] },
  { id: "a14", task: "Find a vegan main and list its cook time.", steps: ["search_recipe(tags=main,vegan)", "read_recipe(id)"], end_state: "ok", first_bad_step: -1, tools: ["search_recipe", "read_recipe"] },
  { id: "a15", task: "Convert 300 ml red wine to cups for the stew.", steps: ["search_recipe(stew)", "convert_units(300 ml→cup)"], end_state: "ok", first_bad_step: -1, tools: ["search_recipe", "convert_units"] },
  { id: "a16", task: "Double the garlic bread and set a timer.", steps: ["search_recipe(garlic bread)", "scale_quantities(4→8)", "set_timer(10 min)"], end_state: "ok", first_bad_step: -1, tools: ["search_recipe", "scale_quantities", "set_timer"] },
  { id: "a17", task: "Find a vegetarian soup and halve the portions.", steps: ["search_recipe(tags=vegetarian,soup)", "scale_quantities(6→3)"], end_state: "ok", first_bad_step: -1, tools: ["search_recipe", "scale_quantities"] },
  { id: "a18", task: "How long do the tacos take and at what temperature?", steps: ["search_recipe(tacos)", "read_recipe(id)"], end_state: "ok", first_bad_step: -1, tools: ["search_recipe", "read_recipe"] },
  { id: "a19", task: "Scale the French onion soup to 4 and set a timer for the bake.", steps: ["search_recipe(onion soup)", "scale_quantities(4→4)", "set_timer(60 min)"], end_state: "ok", first_bad_step: -1, tools: ["search_recipe", "scale_quantities", "set_timer"] },
  { id: "a20", task: "Convert 120 g of oats to tablespoons.", steps: ["search_recipe(pancakes)", "convert_units(120 g→tbsp)"], end_state: "ok", first_bad_step: -1, tools: ["search_recipe", "convert_units"] },
  // --- Runs that reach the wrong end state ---
  { id: "a21", task: "Scale the banana bread from 1 tin to 3 tins.", steps: ["search_recipe(bread)", "scale_quantities(1→4)"], end_state: "wrong", first_bad_step: 1, tools: ["search_recipe", "scale_quantities"] },
  { id: "a22", task: "Convert 350 g of flour to cups.", steps: ["convert_units(350 g→oz)"], end_state: "wrong", first_bad_step: 0, tools: ["convert_units"] },
  { id: "a23", task: "Find a gluten-free main.", steps: ["search_recipe(tags=vegetarian)"], end_state: "wrong", first_bad_step: 0, tools: ["search_recipe"] },
  { id: "a24", task: "Scale the beef stew from 6 to 2 servings.", steps: ["search_recipe(stew)", "scale_quantities(6→6)"], end_state: "wrong", first_bad_step: 1, tools: ["search_recipe", "scale_quantities"] },
  { id: "a25", task: "Find a vegan soup.", steps: ["search_recipe(tags=vegan)"], end_state: "wrong", first_bad_step: 0, tools: ["search_recipe"] },
  { id: "a26", task: "Set a timer for the brownie bake.", steps: ["search_recipe(brownies)", "set_timer(45 min)"], end_state: "wrong", first_bad_step: 1, tools: ["search_recipe", "set_timer"] },
  { id: "a27", task: "What temperature do I roast the chicken at?", steps: ["search_recipe(roast chicken)", "read_recipe(id=brownies)"], end_state: "wrong", first_bad_step: 1, tools: ["search_recipe", "read_recipe"] },
  { id: "a28", task: "Halve the apple crumble.", steps: ["search_recipe(apple)", "scale_quantities(6→1)"], end_state: "wrong", first_bad_step: 1, tools: ["search_recipe", "scale_quantities"] },
  { id: "a29", task: "Scale the risotto to 8 servings.", steps: ["search_recipe(risotto)", "scale_quantities(4→4)"], end_state: "wrong", first_bad_step: 1, tools: ["search_recipe", "scale_quantities"] },
  { id: "a30", task: "Convert 700 g of chicken to pounds.", steps: ["convert_units(700 g→kg)"], end_state: "wrong", first_bad_step: 0, tools: ["convert_units"] },
  // --- Runs that reach the RIGHT answer by a wrong route ---
  { id: "a31", task: "Find a vegan main and list its cook time.", steps: ["search_recipe(tags=main)", "read_recipe(id=garlic bread)", "read_recipe(id=vegetable curry)"], end_state: "ok_but_wrong_path", first_bad_step: 1, tools: ["search_recipe", "read_recipe"] },
  { id: "a32", task: "Scale the lemon cake to 2 and set a timer.", steps: ["search_recipe(lemon cake)", "set_timer(40 min)", "scale_quantities(1→2)"], end_state: "ok_but_wrong_path", first_bad_step: 1, tools: ["search_recipe", "set_timer", "scale_quantities"] },
  { id: "a33", task: "Convert 1.6 kg of chicken to pounds.", steps: ["search_recipe(roast chicken)", "convert_units(1600 g→lb)", "convert_units(1.6 kg→oz)"], end_state: "ok_but_wrong_path", first_bad_step: 2, tools: ["search_recipe", "convert_units"] },
  { id: "a34", task: "Find a side that takes under 15 minutes.", steps: ["search_recipe(tags=main)", "read_recipe(id=garlic bread)", "read_recipe(id=mashed potato)"], end_state: "ok_but_wrong_path", first_bad_step: 0, tools: ["search_recipe", "read_recipe"] },
  { id: "a35", task: "Find a vegetarian soup and halve it.", steps: ["search_recipe(tags=vegetarian)", "read_recipe(id=french onion soup)", "scale_quantities(4→2)"], end_state: "ok_but_wrong_path", first_bad_step: 0, tools: ["search_recipe", "read_recipe", "scale_quantities"] },
  { id: "a36", task: "Double the garlic bread and set a timer.", steps: ["search_recipe(garlic bread)", "scale_quantities(4→8)", "set_timer(90 min)"], end_state: "ok_but_wrong_path", first_bad_step: 2, tools: ["search_recipe", "scale_quantities", "set_timer"] },
  { id: "a37", task: "Convert 300 ml of red wine to cups.", steps: ["search_recipe(stew)", "convert_units(300 ml→cup)", "convert_units(300 ml→tbsp)"], end_state: "ok_but_wrong_path", first_bad_step: 2, tools: ["search_recipe", "convert_units"] },
  { id: "a38", task: "How long do the tacos take?", steps: ["search_recipe(tags=main)", "read_recipe(id=fish tacos)"], end_state: "ok_but_wrong_path", first_bad_step: 0, tools: ["search_recipe", "read_recipe"] },
  { id: "a39", task: "Scale the French onion soup to 4.", steps: ["search_recipe(onion soup)", "scale_quantities(4→8)", "scale_quantities(8→4)"], end_state: "ok_but_wrong_path", first_bad_step: 1, tools: ["search_recipe", "scale_quantities"] },
  { id: "a40", task: "Convert 120 g of oats to tablespoons.", steps: ["search_recipe(pancakes)", "convert_units(120 g→oz)", "convert_units(120 g→tbsp)"], end_state: "ok_but_wrong_path", first_bad_step: 1, tools: ["search_recipe", "convert_units"] },
];

/* ================================================================== *
 * 4. The pairwise corpus (module 7, position bias)
 *
 * Two answers to the same question with a known preference, recorded in a
 * fixed order. Judging in the other order exposes position bias directly.
 * ================================================================== */

export const PAIRWISE = [
  { id: "p01", question: "Explain what a Wilson score interval is for.", a: "It gives a range for a proportion that stays sensible when the sample is small or the proportion is near 1, which the normal approximation does not.", b: "It is a way of checking whether two models produce the same answers." },
  { id: "p02", question: "My agent used the wrong tool but got the right answer. Is that a failure?", a: "It depends on your risk appetite: if the route matters for cost, safety or audit, yes; if only the answer matters and the wrong tool is harmless, record it but do not fail the run.", b: "No, the user only cares about the answer, so any route that works is fine." },
  { id: "p03", question: "Why bootstrap the confidence interval instead of using a formula?", a: "Because the distribution of most eval statistics is not known in closed form, so resampling estimates it directly for whatever estimator you use.", b: "Because bootstrap is more accurate for large samples." },
  { id: "p04", question: "Should I use ROUGE-L to score a recipe extraction?", a: "Only for prose fields. For quantities and temperatures it rewards the wrong answer, because overlapping tokens say nothing about whether 230 is the right number.", b: "Yes, ROUGE-L is the standard metric for extraction tasks." },
  { id: "p05", question: "What is position bias in an LLM judge?", a: "A tendency to prefer whichever answer it read first, so the same pair judged as A-B and B-A can give opposite verdicts.", b: "A tendency to prefer longer answers regardless of their order." },
  { id: "p06", question: "How many eval items do I need?", a: "Enough that the interval is narrower than the difference you need to detect; start at 50 and widen until the interval stops changing your decision.", b: "Exactly 100, which is the standard minimum for LLM evaluation." },
  { id: "p07", question: "My judge scores 0.92 and humans agree 60% of the time. What now?", a: "Check whether the set is mostly passes; at 90% prevalence a judge that always says pass scores 0.9, so look at TNR and kappa before trusting it.", b: "The score is high, so the judge is working — ship it." },
  { id: "p08", question: "When is a code check better than a judge?", a: "Whenever correctness is decidable: exact values, valid JSON, required fields, a regex. Code is free, instant and explains its own failures.", b: "Whenever the project already has a test framework." },
  { id: "p09", question: "What does a kappa of 0.2 mean?", a: "Barely better than what you would get by guessing the majority class, so the judge is not usable as a gate.", b: "20% of judgements are wrong, which is acceptable for a first version." },
  { id: "p10", question: "Should the same items be in the eval set every release?", a: "Keep a fixed suite so results are comparable, and add new cases when a real failure appears; changing the set every release makes every number incomparable.", b: "Rebuild the set each quarter from recent traffic so it stays relevant." },
  { id: "p11", question: "What is the cheapest way to cut judge cost?", a: "Ask for a verdict and a short reason in one call, and cache by prompt hash, model and item so repeats are free.", b: "Use a smaller model; the cost difference is the whole story." },
  { id: "p12", question: "A prompt change raised the pass rate from 0.80 to 0.86 on 20 items. Ship it?", a: "Not yet — on 20 items that move sits inside the interval. Widen the sample until the interval separates the two.", b: "Yes, six points is a clear improvement." },
];

/* ================================================================== *
 * 5. The RAG corpus (module 8)
 *
 * A question, the retrieved passages that were actually supplied to the
 * model, and the answer. Grounding is decidable against the passages,
 * which is what makes a claim-level grounding judge checkable.
 * ================================================================== */

export const RAG = [
  {
    id: "g01", question: "What is the carryover limit for unused PTO?",
    passages: ["Leave and time off — You can carry over at most 5 unused days into the next year. Anything above that is lost."],
    answer: "At most 5 unused days carry over into the next year; anything above that is lost.",
    grounded: true, should_abstain: false, ungrounded_claim: null,
  },
  {
    id: "g02", question: "What is the carryover limit for unused PTO?",
    passages: ["Leave and time off — You can carry over at most 5 unused days into the next year. Anything above that is lost."],
    answer: "You can carry over at most 10 unused days, and there is no expiry on them.",
    grounded: false, should_abstain: false, ungrounded_claim: "You can carry over at most 10 unused days, and there is no expiry on them.",
  },
  {
    id: "g03", question: "How much parental leave do I get?",
    passages: ["Leave and time off — 18 weeks, for any parent, at full pay. It can be split into at most three blocks."],
    answer: "18 weeks at full pay, for any parent, split into at most three blocks.",
    grounded: true, should_abstain: false, ungrounded_claim: null,
  },
  {
    id: "g04", question: "What is the Data Engineer salary band?",
    passages: ["Expense policy — Receipts are required for any single expense over 50. Meals up to 25 a day do not need one."],
    answer: "The Data Engineer band starts at 85,000 and tops out at 110,000.",
    grounded: false, should_abstain: false, ungrounded_claim: "The Data Engineer band starts at 85,000 and tops out at 110,000.",
  },
  {
    id: "g05", question: "Do I need a receipt for a client dinner?",
    passages: ["Expenses — Receipts are required for any single expense over 50. Meals up to 25 a day do not need one."],
    answer: "Yes, a receipt is required above 50; meals up to 25 a day do not need one.",
    grounded: true, should_abstain: false, ungrounded_claim: null,
  },
  {
    id: "g06", question: "What is the notice period?",
    passages: ["Working here — 1 month for everyone; 3 months for senior staff. Notice is waived in probation."],
    answer: "One month, or three for senior staff. It is waived during probation.",
    grounded: true, should_abstain: false, ungrounded_claim: null,
  },
  {
    id: "g07", question: "Is there an employee share scheme?",
    passages: [],
    answer: "Yes — you can buy up to 20,000 of shares each year at a 25% discount.",
    grounded: false, should_abstain: false, ungrounded_claim: "Yes — you can buy up to 20,000 of shares each year at a 25% discount.",
  },
  {
    id: "g08", question: "Is there an employee share scheme?",
    passages: [],
    answer: "The handbook does not describe an employee share scheme. Ask the People team whether one is running.",
    grounded: true, should_abstain: true, ungrounded_claim: null,
  },
  {
    id: "g09", question: "When do performance reviews happen?",
    passages: ["Working here — Twice a year, in January and July, covering the previous six months."],
    answer: "Twice a year, in January and July.",
    grounded: true, should_abstain: false, ungrounded_claim: null,
  },
  {
    id: "g10", question: "When do performance reviews happen?",
    passages: ["Working here — Twice a year, in January and July, covering the previous six months."],
    answer: "Once a year, each December.",
    grounded: false, should_abstain: false, ungrounded_claim: "Once a year, each December.",
  },
  {
    id: "g11", question: "What is the learning budget?",
    passages: ["Learning and development — 1500 per year, approved by your manager before you buy anything. Plus 5 mandatory training days per year."],
    answer: "1500 a year with manager approval, plus 5 mandatory training days.",
    grounded: true, should_abstain: false, ungrounded_claim: null,
  },
  {
    id: "g12", question: "How long are customer logs kept?",
    passages: ["Data handling — 90 days, then they are deleted automatically. Shorter retention needs a documented reason."],
    answer: "90 days, then automatic deletion.",
    grounded: true, should_abstain: false, ungrounded_claim: null,
  },
  {
    id: "g13", question: "How long are customer logs kept?",
    passages: ["Data handling — 90 days, then they are deleted automatically. Shorter retention needs a documented reason."],
    answer: "Two years, because of a regulatory retention requirement.",
    grounded: false, should_abstain: false, ungrounded_claim: "Two years, because of a regulatory retention requirement.",
  },
  {
    id: "g14", question: "Can I accept a gift from a vendor?",
    passages: ["Ethics — Yes, up to 50 in value. Anything above that is refused and declared in the ethics register."],
    answer: "Up to 50 in value; above that it is refused and declared.",
    grounded: true, should_abstain: false, ungrounded_claim: null,
  },
  {
    id: "g15", question: "Do you run a summer internship?",
    passages: [],
    answer: "Yes, a 12-week paid internship runs every summer and applications open in January.",
    grounded: false, should_abstain: false, ungrounded_claim: "Yes, a 12-week paid internship runs every summer and applications open in January.",
  },
  {
    id: "g16", question: "Do you have a crèche?",
    passages: ["Leave and time off — 18 weeks, for any parent, at full pay."],
    answer: "The handbook does not mention child care. The passage you have covers parental leave only.",
    grounded: true, should_abstain: true, ungrounded_claim: null,
  },
  {
    id: "g17", question: "What is the security incident reporting deadline?",
    passages: ["Security — Within 1 hour of noticing it, to the security channel. Late reports are a disciplinary matter."],
    answer: "Within 1 hour, to the security channel.",
    grounded: true, should_abstain: false, ungrounded_claim: null,
  },
  {
    id: "g18", question: "What is the security incident reporting deadline?",
    passages: ["Security — Passwords rotate every 90 days, minimum 14 characters."],
    answer: "You must report an incident within 24 hours.",
    grounded: false, should_abstain: false, ungrounded_claim: "You must report an incident within 24 hours.",
  },
  {
    id: "g19", question: "When can I work remotely?",
    passages: ["Where you work — You can work remotely up to 3 days a week, and only from a country on the approved list."],
    answer: "Up to 3 days a week, from an approved country.",
    grounded: true, should_abstain: false, ungrounded_claim: null,
  },
  {
    id: "g20", question: "When can I work remotely?",
    passages: ["Where you work — You can work remotely up to 3 days a week, and only from a country on the approved list."],
    answer: "I cannot help with that.",
    grounded: false, should_abstain: false, ungrounded_claim: null, over_refusal: true,
  },
];
