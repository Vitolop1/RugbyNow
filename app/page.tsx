import { Suspense } from "react";
import HomeClient from "./HomeClient";

function HomeFallback() {
  return (
    <div className="min-h-screen bg-[#0E4F33] text-white flex items-center justify-center">
      <div className="text-sm text-white/80">Loading RugbyNow...</div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<HomeFallback />}>
      <HomeClient />
    </Suspense>
  );
}