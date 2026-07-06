/**
 * The ADR-0020 system-page invariants, as throwing guards: system pages
 * (privacy, terms) are undeletable and always published, because the booking
 * form's privacy notice and the footer's legal links hardcode their slugs.
 * The admin UI hides the controls; these guards are the server-side
 * enforcement the actions run against a fresh DB read of `system`.
 */
type SystemFlagged = { system: boolean };

export function assertPageDeletable(row: SystemFlagged): void {
  if (row.system) {
    throw new Error("Systeempagina's kunnen niet worden verwijderd");
  }
}

export function assertPagePublishToggleable(row: SystemFlagged): void {
  if (row.system) {
    throw new Error("Systeempagina's zijn altijd gepubliceerd");
  }
}
