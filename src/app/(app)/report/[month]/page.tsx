import { Temporal } from "@js-temporal/polyfill";
import { subtract, toDecimal } from "dinero.js";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { DashboardShell } from "~/app/_components/dashboard-shell";
import { currentUser } from "~/auth";
import { getMonthMetadata } from "~/lib/get-month-metadata";
import { isSameMonth, parseMonthParam } from "~/lib/temporal";
import { tson } from "~/lib/tson";
import { formatDiff, formatMoney } from "~/monetary/math";
import type { Timeslot, Period } from "~/trpc/datalayer";
import * as trpc from "~/trpc/datalayer";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/card";
import { CalendarAndSidePanel } from "./_components/calendar";
import { ClosePeriodSheet } from "./_components/close-periods";
import { ComparisonChart } from "./_components/comparison-chart";

export default async function IndexPage(props: { params: { month: string } }) {
  const user = await currentUser();
  if (!user) redirect("/login");

  if (props.params.month.length !== 5) {
    redirect(
      `/report/${Temporal.Now.plainDateISO()
        .toLocaleString("en-US", {
          month: "short",
          year: "2-digit",
        })
        .replace(" ", "")}`,
    );
  }

  const date = parseMonthParam(props.params.month);

  // const openPeriodsPromise = withUnstableCache({
  //   fn: trpc.getOpenPeriods,
  //   args: [],
  //   tags: [CACHE_TAGS.PERIODS],
  // });
  // Start fetching clients and periods now but don't await it.
  // We await it within a Suspense boundary below.
  const openPeriodsPromise = trpc.getOpenPeriods();
  const clientsPromise = trpc.getClients();

  // const clients = await withUnstableCache({
  //   fn: trpc.getClients,
  //   args: [],
  //   tags: [CACHE_TAGS.CLIENTS],
  // });
  // const timeslots = await withUnstableCache({
  //   fn: trpc.getTimeslots,
  //   args: [{ date, mode: "month" }],
  //   tags: [CACHE_TAGS.TIMESLOTS],
  // });

  const lastMonthDate = date.subtract({ months: 1 });

  const [timeslots, lastMonthTimeslots] = await Promise.all([
    trpc.getTimeslots({ date, mode: "month" }),
    trpc.getTimeslots({ date: lastMonthDate, mode: "month" }),
  ]);

  const monthSlots = timeslots.filter((slot) => isSameMonth(slot.date, date));
  const lastMonthSlots = lastMonthTimeslots.filter((slot) =>
    isSameMonth(slot.date, lastMonthDate),
  );
  const [
    { billedClients, totalHours, totalRevenue },
    { totalHours: lastMonthTotalHours, totalRevenue: lastMonthTotalRevenue },
  ] = await Promise.all([
    getMonthMetadata(monthSlots, user.defaultCurrency),
    getMonthMetadata(lastMonthSlots, user.defaultCurrency),
  ]);

  const diff = subtract(totalRevenue, lastMonthTotalRevenue);

  const slotsByDate = timeslots.reduce<Record<string, Timeslot[]>>(
    (acc, slot) => {
      const key = slot.date.toString();
      if (!acc[key]) acc[key] = [];
      acc[key].push(slot);
      return acc;
    },
    {},
  );

  const clients = await clientsPromise;

  return (
    <DashboardShell
      title="Report Time"
      description="Browse how your business is doing this month and report time."
      className="gap-4"
      headerActions={[
        <Suspense>
          <ClosePeriod openPeriods={openPeriodsPromise} />
        </Suspense>,
      ]}
    >
      <section className="flex gap-4 overflow-x-scroll md:grid lg:grid-cols-3 md:grid-cols-2">
        <Card className="flex gap-2">
          <div className="flex-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="font-medium text-sm">
                Total Revenue
              </CardTitle>
            </CardHeader>
            <CardContent className="w-max md:w-auto">
              <div className="font-bold text-2xl">
                {toDecimal(totalRevenue, formatMoney)}
              </div>
              <p className="line-clamp-1 text-muted-foreground text-xs">
                {formatDiff(toDecimal(diff, formatMoney))} since last month
              </p>
            </CardContent>
          </div>
          <div className="p-6 pl-0">
            <ComparisonChart
              a={tson.serialize(monthSlots)}
              b={tson.serialize(lastMonthSlots)}
            />
          </div>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Billed time</CardTitle>
          </CardHeader>
          <CardContent className="w-max md:w-auto">
            <div className="font-bold text-2xl">
              {totalHours}
              <span className="ml-1 text-lg">hours</span>
            </div>
            <p className="text-muted-foreground text-xs">
              {formatDiff(totalHours - lastMonthTotalHours)} hours from last
              month
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">
              Active Clients
            </CardTitle>
          </CardHeader>
          <CardContent className="w-max md:w-auto">
            <div className="font-bold text-2xl">
              {billedClients}
              <span className="ml-1 text-lg">billed this month</span>
            </div>
            <p className="text-muted-foreground text-xs">
              out of {clients.length} total clients
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-4 md:grid lg:grid-cols-4 md:grid-cols-2">
        <CalendarAndSidePanel
          referenceDate={tson.serialize(date)}
          clients={tson.serialize(clients)}
          timeslots={tson.serialize(slotsByDate)}
        />
      </section>
    </DashboardShell>
  );
}

async function ClosePeriod(props: { openPeriods: Promise<Period[]> }) {
  const openPeriods = await props.openPeriods;

  return <ClosePeriodSheet openPeriods={tson.serialize(openPeriods)} />;
}
