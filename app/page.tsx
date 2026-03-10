import { Suspense } from "react";
import HomeClient from "./HomeClient";
import LoadingScreen from "@/app/components/LoadingScreen";

export default function Page() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <HomeClient />
    </Suspense>
  );
}
