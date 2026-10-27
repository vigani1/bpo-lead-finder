/**
 * Checks the keyword-rules classifier against real titles and snippets seen in
 * live Tavily results (2026-10-26). Free to run: no API calls. `pnpm check:rules`
 */
import { rulesClassifier } from "../src/lib/ai/rules/index";
import type { Doc } from "../src/lib/pipeline/types";

const cases: [Doc["kind"], string, string, string, string][] = [
  ["job_ad", "https://pk.indeed.com/q-final-expense-jobs.html", "17 Final Expense Licensed Agent Jobs - 20 October, 2026 - Indeed", "Final Expense Verifier / Closer – Rawalpindi. Royal bpo. Rawalpindi Satellite Town · Were Hiring", "Royal bpo"],
  ["job_ad", "https://pk.indeed.com/x", "16 Final Expense Closer Rs 840000 Jobs in Rawalpindi", "Reliant BPO is hiring an experienced Final Expense (FE) Closer for its US-based insurance sales campaign.", "Reliant BPO"],
  ["job_ad", "https://pk.indeed.com/y", "Final Expense Call Center jobs in Rawalpindi - Indeed", "We are looking for experienced Final Expense Closers who know how to handle objections", "null"],
  ["social", "https://www.instagram.com/p/abc", "🚨 WE'RE HIRING CLOSERS! Join Prime BPO 5 as a ...", "Join Prime BPO 5 as a Business Development Specialist and earn up to PKR 150,000 Campaigns: Final Expense", "Prime BPO 5"],
  ["social", "https://www.instagram.com/p/def", "Assalamualaikum i have 2 years exp", "Assalamualaikum i have 2 years experience in final expense closing", "null"],
  ["job_ad", "https://www.mustakbil.com/jobs/job/1433829", "Customer Service Representative - Voxinity Solutions - Karachi", "Voxinity Solutions is a USA based call center we are running multiple campaigns like Medicare, ACA & Final Expense.", "Voxinity Solutions"],
  ["job_ad", "https://co.computrabajo.com/a", "Asesor telefónico - ventas de seguros clientes EE. UU. - CM INSURANCE ADVISORS - Barranquilla", "CM INSURANCE ADVISORS busca asesor telefónico. Experiencia en ventas de seguros (Salud Obamacare, Vida o Suplementarios).", "CM INSURANCE ADVISORS"],
  ["job_ad", "https://co.computrabajo.com/b", "Empleos de Salud en La Playa, Atlántico - Computrabajo", "Ofertas de empleo de salud. Obamacare clientes Estados Unidos.", "null"],
  ["job_ad", "https://www.rozee.pk/c", "Medicare Supervisor - Lahore", "Medicare Supervisor needed for US campaign night shift", "null"],
  ["job_ad", "https://www.jobleads.com/d", "Call Center - JobLeads.com Private Limited - Lahore", "Medicare campaign, call center agents needed", "null"],
  ["job_ad", "https://pk.indeed.com/e", "Night-Shift Leader - Rawalpindi Call Center", "Medicare campaign night shift", "null"],
  ["job_ad", "https://pk.indeed.com/f", "Medicare Closer - Private Limited - Lahore", "Medicare campaign closers needed, night shift", "null"],
  ["job_ad", "https://co.computrabajo.com/g", "Asesor comercial - OLMFORCE S.A.S - Barranquilla", "OLMFORCE S.A.S busca asesores bilingües para campaña Obamacare clientes Estados Unidos", "OLMFORCE S.A.S"],
  ["website", "https://orbixbpo.com/", "Orbix Bpo| Scalable BPO Solutions That Grow With You", "Orbix BPO provides Medicare, ACA and final expense campaigns from Lahore.", "Orbix Bpo"],
  ["job_ad", "https://www.rozee.pk/job/jsearch/q/x", "Sales Agent (Night Shift) jobs - Rozee", "Night shift International Call Center Job 1; Sales Representative", "null"],
  ["job_ad", "https://www.rozee.pk/job/jsearch/q/Online%20Bpo", "Online Bpo jobs in Pakistan - ROZEE.PK", "Online Bpo jobs in Pakistan, final expense closers", "null"],
  ["job_ad", "https://www.jobleads.com/pk/job/x", "Sales Closer (Final Expense) - Saddar", "WORK is hiring Sales Closer (Final Expense) in Saddar.", "null"],
  ["job_ad", "https://ph.jobstreet.com/medicare-jobs/in-Philippines", "Medicare Jobs, Hiring in Philippines - Aug 2026 | Jobstreet", "Medicare Appointment Setter at Virtual Champs Global ・ ₱10,000 – ₱15,000 per month Medicare experience as Cold Caller", "Virtual Champs Global"],
  ["job_ad", "https://ph.jobstreet.com/home-based-call-center-jobs/part-time", "Home Based Call Center Part Time Jobs in Philippines - Aug 2026", "Medicare experience ・ ₱250 – ₱300 per hour, part time", "null"],
  ["social", "https://www.facebook.com/amigosbpo/posts/urgently-hiring", "Urgently Hiring ! For Medicare Campaign Salary upto 100K ...", "MARS BPO is hiring for Medicare campaign, salary up to 100K", "null"],
  ["social", "https://www.facebook.com/Futuresbpooffical/posts/medicare-closer", "Futures BPO hiring Medicare closers in Rawalpindi, Pakistan", "Futures BPO is hiring Medicare closers in Rawalpindi", "Futures BPO"],
];
let pass = 0;
for (const [kind, url, title, snippet, expected] of cases) {
  const doc: Doc = { url, registeredDomain: new URL(url).hostname.split(".").slice(-2).join("."), kind, evidenceSource: kind === "social" ? "social" : "job_board", title, text: `${title}\n${snippet}`, contentHash: "x", publishedAt: null };
  const { classification } = await rulesClassifier.classify(doc);
  const got = String(classification.companyName);
  const ok = got === expected;
  pass += Number(ok);
  console.log(ok ? "PASS" : "FAIL", JSON.stringify(got), "expected", JSON.stringify(expected), "|", title.slice(0, 50));
}
{
  const doc: Doc = {
    url: "https://saleszonebpo.com/", registeredDomain: "saleszonebpo.com", kind: "website", evidenceSource: "website",
    title: "Sales Zone BPO | Professional Telemarketing & BPO Services",
    text: "Sales Zone BPO | Professional Telemarketing & BPO Services\nSales Zone BPO is a professional telemarketing and BPO company specializing in Final Expense campaigns.",
    contentHash: "x", publishedAt: null,
    facts: { siteName: "Professional Telemarketing & BPO Services", phones: [], emails: [], socialLinks: [] },
  };
  const { classification } = await rulesClassifier.classify(doc);
  const ok = classification.companyName === "Sales Zone BPO";
  pass += Number(ok);
  cases.push(["website", doc.url, doc.title, "", "Sales Zone BPO"]);
  console.log(ok ? "PASS" : "FAIL", JSON.stringify(classification.companyName), "expected", '"Sales Zone BPO"', "| website with tagline as site name");
}
// Campaign detection: bare "ACA" counts only next to other insurance campaigns.
{
  const { matchCampaign } = await import("../src/lib/campaign-match");
  const checks: [string, boolean][] = [
    ["High-intent Medicare, ACA, Solar, and Real Estate leads", true],
    ["Member of ACA International, the association of credit and collection professionals", false],
    ["We provide ACA certified accountants", false],
  ];
  for (const [text, expected] of checks) {
    const ok = !!matchCampaign("aca", text) === expected;
    pass += Number(ok);
    cases.push(["website", "https://x", text, "", String(expected)]);
    console.log(ok ? "PASS" : "FAIL", `ACA in "${text.slice(0, 50)}" → ${expected}`);
  }
}
console.log(`${pass}/${cases.length}`);
