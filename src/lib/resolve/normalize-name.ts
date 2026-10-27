import { foldAccents } from "@/lib/text";

/**
 * Legal forms and filler words removed before comparing names, so
 * "Prime BPO (Pvt.) Ltd" and "Prime BPO" match. Legal forms are adapted from
 * the `cleanco` lists (MIT) plus local forms seen in the target countries.
 */
const LEGAL_FORMS = [
  "pvt ltd",
  "private limited",
  "smc private limited",
  "smc-private limited",
  "pvt",
  "ltd",
  "limited",
  "llc",
  "l l c",
  "inc",
  "corp",
  "corporation",
  "co",
  "company",
  "opc",
  "s a s",
  "sas",
  "s a",
  "sa",
  "ltda",
  "s de r l",
  "s de r l de c v",
  "s a de c v",
  "srl",
  "gmbh",
  "plc",
];

const FILLER = ["bpo", "solutions", "solution", "services", "service", "technologies", "technology", "tech", "international", "group", "global", "communications", "the", "and", "&"];

export function normalizeCompanyName(name: string): string {
  let n = ` ${foldAccents(name).replace(/[().,'’]/g, " ").replace(/[-_/|]/g, " ").replace(/\s+/g, " ")} `;
  for (const form of [...LEGAL_FORMS].sort((a, b) => b.length - a.length)) n = n.replaceAll(` ${form} `, " ");
  for (const word of FILLER) n = n.replaceAll(` ${word} `, " ");
  return n.replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}
