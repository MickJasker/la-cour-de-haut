import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Instant Suspense fallback for the POI modal. Rendered by the router the moment
 * the intercepted route is entered — before page.tsx's POI read resolves — so
 * the Dialog (owned by layout.tsx) shows a skeleton immediately instead of a
 * blank ~1s wait on an un-prefetched/cold open. Shape mirrors <PoiDetail>: hero,
 * heading, two body lines. `loading.tsx` receives no params, so the sr-only
 * title is a neutral placeholder; page.tsx swaps in the real POI title on load.
 */
export default function PoiModalLoading() {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="sr-only">Loading</DialogTitle>
        <DialogDescription className="sr-only">Loading</DialogDescription>
      </DialogHeader>
      <div className="flex animate-pulse flex-col gap-5" aria-hidden>
        <div className="aspect-3/2 w-full rounded-lg bg-cream-200" />
        <div className="flex flex-col gap-3">
          <div className="h-7 w-2/3 rounded bg-cream-200" />
          <div className="h-4 w-full rounded bg-cream-200" />
          <div className="h-4 w-5/6 rounded bg-cream-200" />
          <div className="h-7 w-2/3 rounded bg-cream-200" />
          <div className="h-4 w-full rounded bg-cream-200" />
          <div className="h-4 w-5/6 rounded bg-cream-200" />
          <div className="h-7 w-2/3 rounded bg-cream-200" />
          <div className="h-4 w-full rounded bg-cream-200" />
          <div className="h-4 w-5/6 rounded bg-cream-200" />
          <div className="h-7 w-2/3 rounded bg-cream-200" />
          <div className="h-4 w-full rounded bg-cream-200" />
          <div className="h-4 w-5/6 rounded bg-cream-200" />
          <div className="h-4 w-full rounded bg-cream-200" />
          <div className="h-4 w-5/6 rounded bg-cream-200" />
          <div className="h-7 w-2/3 rounded bg-cream-200" />
          <div className="h-4 w-full rounded bg-cream-200" />
          <div className="h-4 w-5/6 rounded bg-cream-200" />
          <div className="h-7 w-2/3 rounded bg-cream-200" />
          <div className="h-4 w-full rounded bg-cream-200" />
          <div className="h-4 w-5/6 rounded bg-cream-200" />
          <div className="h-7 w-2/3 rounded bg-cream-200" />
          <div className="h-4 w-full rounded bg-cream-200" />
          <div className="h-4 w-5/6 rounded bg-cream-200" />
          <div className="h-7 w-2/3 rounded bg-cream-200" />
          <div className="h-4 w-full rounded bg-cream-200" />
          <div className="h-4 w-5/6 rounded bg-cream-200" />
          <div className="h-7 w-2/3 rounded bg-cream-200" />
          <div className="h-4 w-full rounded bg-cream-200" />
          <div className="h-4 w-5/6 rounded bg-cream-200" />
          <div className="h-4 w-full rounded bg-cream-200" />
          <div className="h-4 w-5/6 rounded bg-cream-200" />
          <div className="h-7 w-2/3 rounded bg-cream-200" />
          <div className="h-4 w-full rounded bg-cream-200" />
          <div className="h-4 w-5/6 rounded bg-cream-200" />
        </div>
      </div>
    </>
  );
}
