"use client";

import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { GlobeIcon, MailIcon, PhoneIcon, TriangleAlertIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, type MouseEvent } from "react";
import { ConfidenceBadge } from "@/components/confidence-badge";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { CampaignId } from "@/config/campaigns";
import type { ResultsQueryInput } from "@/features/searches/schemas";
import type { ResultRow } from "@/features/searches/types";
import { campaignLabel, formatLocation, labelFor, relativeTime, SOURCE_LABELS } from "@/lib/format";
import { ENTITY_LABELS, type EntityType } from "@/lib/ai/schema";
import { cn } from "@/lib/utils";

const features = tableFeatures({});
const helper = createColumnHelper<typeof features, ResultRow>();

function centerHref(row: ResultRow, searchId: string, query: ResultsQueryInput) {
  const params = new URLSearchParams({ searchId });
  if (query.maxAge) params.set("maxAge", query.maxAge);
  return `/centers/${row.centerId}?${params}`;
}

function Location({ row }: { row: ResultRow }) {
  if (!row.city && !row.country) return <span className="text-muted-foreground">Location unknown</span>;
  return (
    <span>
      {formatLocation(row.city, row.country)}
      {row.country && !row.countryConfirmed && <span className="text-muted-foreground"> (likely)</span>}
    </span>
  );
}

function Campaigns({ campaigns, requested }: { campaigns: CampaignId[]; requested: CampaignId }) {
  const sorted = [...campaigns].sort((a, b) => (a === requested ? -1 : b === requested ? 1 : 0));
  return (
    <div className="flex flex-wrap gap-1">
      {sorted.map((c) => (
        <Badge key={c} variant={c === requested ? "default" : "outline"} className="font-normal">
          {campaignLabel(c)}
        </Badge>
      ))}
    </div>
  );
}

function Contacts({ row }: { row: ResultRow }) {
  const items = [
    row.phones[0] && { icon: PhoneIcon, label: row.phones[0], href: `tel:${row.phones[0]}`, extra: row.phones.length - 1 },
    row.emails[0] && { icon: MailIcon, label: row.emails[0], href: `mailto:${row.emails[0]}`, extra: row.emails.length - 1 },
    row.websiteUrl && { icon: GlobeIcon, label: new URL(row.websiteUrl).hostname.replace(/^www\./, ""), href: row.websiteUrl, extra: 0 },
    !row.websiteUrl && row.socialLinks[0] && { icon: GlobeIcon, label: `${row.socialLinks[0].platform} page`, href: row.socialLinks[0].url, extra: 0 },
  ].filter(Boolean) as { icon: typeof PhoneIcon; label: string; href: string; extra: number }[];
  if (items.length === 0) {
    const viaJobAds = row.sourceTypes.includes("job_board");
    return <span className="text-sm text-muted-foreground">{viaJobAds ? "No published contact; reach out via their job ads" : "No published contact yet"}</span>;
  }
  return (
    <ul className="space-y-0.5 text-sm">
      {items.map(({ icon: Icon, label, href, extra }) => (
        <li key={href} className="flex items-center gap-1.5">
          <Icon className="size-3.5 shrink-0 text-muted-foreground" />
          <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="relative z-10 truncate hover:underline tabular-nums">
            {label}
          </a>
          {extra > 0 && <span className="text-muted-foreground">+{extra}</span>}
        </li>
      ))}
    </ul>
  );
}

function makeColumns(searchId: string, campaign: CampaignId, query: ResultsQueryInput) {
  return helper.columns([
    helper.display({
      id: "center",
      header: "Center",
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div className="min-w-48 space-y-0.5">
            <Link href={centerHref(r, searchId, query)} className="font-medium hover:underline">
              {r.name}
            </Link>
            <div className="text-sm text-muted-foreground">
              <Location row={r} />
            </div>
            {(r.fromEarlierSearch || r.entityType !== "call_center") && (
              <div className="text-xs text-muted-foreground">
                {r.entityType !== "call_center" && ENTITY_LABELS[r.entityType as EntityType]}
                {r.entityType !== "call_center" && r.fromEarlierSearch && ", "}
                {r.fromEarlierSearch && "from an earlier search"}
              </div>
            )}
          </div>
        );
      },
    }),
    helper.display({
      id: "confidence",
      header: "Confidence",
      cell: ({ row }) => {
        const r = row.original;
        return (
          <Tooltip>
            <TooltipTrigger className="text-left">
              <ConfidenceBadge label={r.label} score={r.score} />
              {r.redFlags.length > 0 && (
                <span className="mt-1 flex items-center gap-1 text-xs text-destructive">
                  <TriangleAlertIcon className="size-3" /> {r.redFlags.length} red flag{r.redFlags.length > 1 ? "s" : ""}
                </span>
              )}
            </TooltipTrigger>
            <TooltipContent className="max-w-64 flex-col items-start gap-1">
              {r.labelReason && <p className="font-medium">{r.labelReason}</p>}
              <ul className="list-disc space-y-0.5 pl-3">
                {r.penalties.map((penalty) => (
                  <li key={penalty} className="text-destructive">
                    {penalty}
                  </li>
                ))}
                {r.topReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </TooltipContent>
          </Tooltip>
        );
      },
    }),
    helper.display({ id: "campaigns", header: "Works on", cell: ({ row }) => <Campaigns campaigns={row.original.campaigns} requested={campaign} /> }),
    helper.display({ id: "contacts", header: "Business contact", cell: ({ row }) => <Contacts row={row.original} /> }),
    helper.display({
      id: "sources",
      header: "Found in",
      cell: ({ row }) => (
        <div className="space-y-0.5 text-sm">
          <div>{row.original.sourceTypes.map((s) => labelFor(SOURCE_LABELS, s)).join(", ")}</div>
          <div className="text-muted-foreground">
            {/* Relative to the reader's clock, which differs from the server's render by design. */}
            Seen{" "}
            <time dateTime={row.original.lastSeenAt} suppressHydrationWarning>
              {relativeTime(row.original.lastSeenAt)}
            </time>
          </div>
        </div>
      ),
    }),
  ]);
}

interface Props {
  rows: ResultRow[];
  searchId: string;
  campaign: CampaignId;
  running: boolean;
  totalResults: number;
  query: ResultsQueryInput;
}

export function ResultsTable({ rows, searchId, campaign, running, totalResults, query }: Props) {
  // Columns must be stable between renders (TanStack Table v9 rebuilds its models when they change).
  const columns = useMemo(() => makeColumns(searchId, campaign, query), [searchId, campaign, query]);
  const table = useTable({ features, columns, data: rows });
  const router = useRouter();

  /** The whole row opens the center; links and buttons inside it (phone, email, website, score) keep their own action. */
  function openCenter(event: MouseEvent, row: ResultRow) {
    if ((event.target as HTMLElement).closest("a, button") || window.getSelection()?.toString()) return;
    const href = centerHref(row, searchId, query);
    if (event.metaKey || event.ctrlKey) window.open(href, "_blank");
    else router.push(href as Route);
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed px-6 py-12 text-center">
        <p className="font-medium">
          {running ? "Looking for centers…" : totalResults > 0 ? "No centers match these filters" : "No matching centers found"}
        </p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          {running
            ? "Results appear here as soon as each one is checked."
            : totalResults > 0
              ? "Loosen the evidence age or confidence filters to see more."
              : "Public data is thin for some countries and campaigns. The ruled-out list below shows what was found and why it didn’t count."}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="hidden overflow-hidden rounded-lg border bg-card md:block">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => (
                  <TableHead key={header.id} className="text-muted-foreground">
                    {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} onClick={(e) => openCenter(e, row.original)} className={cn("cursor-pointer", row.original.label === "low" && "opacity-80")}>
                {row.getAllCells().map((cell) => (
                  <TableCell key={cell.id} className="py-3 align-top whitespace-normal">
                    <table.FlexRender cell={cell} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Small screens: one stacked card per center. */}
      <ul className="space-y-3 md:hidden">
        {rows.map((r) => (
          // The name link stretches over the whole card; the contact links sit above it.
          <li key={r.centerId} className="relative space-y-2 rounded-lg border bg-card p-4 hover:bg-muted/50">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Link href={centerHref(r, searchId, query)} className="font-medium after:absolute after:inset-0 hover:underline">
                  {r.name}
                </Link>
                <div className="text-sm text-muted-foreground">
                  <Location row={r} />
                </div>
              </div>
              <ConfidenceBadge label={r.label} score={r.score} />
            </div>
            <Campaigns campaigns={r.campaigns} requested={campaign} />
            <Contacts row={r} />
          </li>
        ))}
      </ul>
    </>
  );
}
