import Link from "next/link";

export function SceneFallback() {
  return (
    <div className="scene-fallback" role="status">
      <p>The spatial view is unavailable in this browser.</p>
      <Link href="/work">Open the project index</Link>
    </div>
  );
}
