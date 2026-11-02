import { LEGACY_EDITION_IDS, type DayFile, type VisitRecord } from './types';

/** The visit with any legacy edition name replaced by its id, without duplicates; the same object when nothing changed. */
export function normalizeVisit(visit: VisitRecord): VisitRecord {
  if (!visit.editions.some((edition) => edition in LEGACY_EDITION_IDS)) {
    return visit;
  }
  const editions = visit.editions.map((edition) => LEGACY_EDITION_IDS[edition] ?? edition).filter((edition, position, list) => list.indexOf(edition) === position);
  return { ...visit, editions };
}

/**
 * A day file as this build reads it. The exporter named the patient explorer by its host before it
 * had an id, so older files say `fhir.mvcprogrammer.com` where newer ones say `fhir`; both count
 * under the id. A file with nothing to change is returned as is.
 */
export function normalizeDayFile(file: DayFile): DayFile {
  const visits = file.visits.map(normalizeVisit);
  return visits.every((visit, position) => visit === file.visits[position]) ? file : { ...file, visits };
}
