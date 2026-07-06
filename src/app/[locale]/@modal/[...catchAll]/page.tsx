// On soft navigation away from an intercepted modal route (e.g. the privacy
// link inside the book dialog), a parallel slot with no matching route keeps
// rendering its previously matched content — `default.tsx` only applies on
// hard loads. This catch-all matches every non-modal URL so the slot renders
// null and the open dialog unmounts. See "Closing the modal" in the Next
// parallel-routes docs.
export default function CatchAll() {
  return null;
}
