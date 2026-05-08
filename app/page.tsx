import dynamic from "next/dynamic";

const TakaFinTrackApp = dynamic(
  () => import("@/components/taka-fintrack-app").then((mod) => mod.TakaFinTrackApp),
  { ssr: false },
);

export default function Home() {
  return <TakaFinTrackApp />;
}
