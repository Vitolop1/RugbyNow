import WeeklyClient from "@/app/weekly/WeeklyClient";
import { readWeeklyDigest } from "@/lib/weeklyDigest";

export default function WeeklyPage() {
  const digest = readWeeklyDigest();
  return <WeeklyClient digest={digest} />;
}
