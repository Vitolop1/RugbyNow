import { Suspense } from "react";
import HomeClient from "./HomeClient";
import LoadingScreen from "@/app/components/LoadingScreen";

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ date?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  return (
    <Suspense fallback={<LoadingScreen />}>
      <HomeClient initialDate={resolvedSearchParams?.date} />
    </Suspense>
  );
}
