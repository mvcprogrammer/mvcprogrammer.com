import { useEffect, useState } from 'react';
import { monthLabel } from '../formatters/month-label';
import { placeLabel } from '../formatters/place-label';
import type { Position } from '../models/position';
import type { Skill } from '../models/skill';
import { useSite } from '../providers/SiteProvider';

/** Chips shown before the "+N more" button. */
export const VISIBLE_CHIPS = 12;

/** Chips named here lead the row in this order, regardless of position count. */
export const PINNED_SKILLS: readonly string[] = [
  'ASP.NET Web API',
  'C#',
  'Claude Pair Programming',
  'Angular',
  'React',
];

/** Chips named here go to the end of the row. */
export const DEMOTED_SKILLS: readonly string[] = ['CloudWatch'];

/**
 * Pinned chips first in their order, then the rest as the API ranks them, then the demoted ones.
 * @param skills The skills as the API returns them.
 */
export function orderChips(skills: readonly Skill[]): readonly Skill[] {
  const byName = (name: string): readonly Skill[] => skills.filter((skill) => skill.name === name);
  const pinned = PINNED_SKILLS.flatMap(byName);
  const demoted = DEMOTED_SKILLS.flatMap(byName);
  const rest = skills.filter(
    (skill) => !PINNED_SKILLS.includes(skill.name) && !DEMOTED_SKILLS.includes(skill.name),
  );
  return [...pinned, ...rest, ...demoted];
}

/**
 * "1 position" or "N positions".
 * @param count The number of positions.
 */
export function positionsLabel(count: number): string {
  return count === 1 ? '1 position' : `${count} positions`;
}

/**
 * Work history from the Experience API with a skill filter. If the API is unreachable the
 * timeline renders from the positions seed bundled with the site and the filter stays hidden.
 */
export function ExperienceTimeline() {
  const { options, experience } = useSite();
  const [allPositions, setAllPositions] = useState<readonly Position[]>([]);
  const [positions, setPositions] = useState<readonly Position[]>([]);
  const [skills, setSkills] = useState<readonly Skill[] | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [allChipsShown, setAllChipsShown] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // A response that arrives after the component is gone is dropped rather than applied to a dead view.
    let active = true;

    const loadSeed = async (): Promise<void> => {
      try {
        const seed = await experience.getSeed();
        if (!active) {
          return;
        }

        setAllPositions(seed);
        setPositions(seed);
        setFailed(seed.length === 0);
      } catch {
        if (active) {
          setFailed(true);
        }
      }
    };

    const load = async (): Promise<void> => {
      let loaded = false;
      try {
        const list = await experience.getExperience(null);
        if (list.items.length === 0) {
          throw new Error('The API returned no positions.');
        }

        if (!active) {
          return;
        }

        setAllPositions(list.items);
        setPositions(list.items);
        loaded = true;

        const skillList = await experience.getSkills();
        if (!active) {
          return;
        }

        if (skillList.items.length > 0) {
          setSkills(orderChips(skillList.items));
        }
      } catch {
        // Any failure (network, status, HTML instead of JSON, timeout) leaves the API behind.
        if (active && !loaded) {
          await loadSeed();
        }
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [experience]);

  /** Filters the timeline to one skill, or restores every position for null without another request. */
  const select = async (skill: string | null): Promise<void> => {
    setLoading(true);
    try {
      const filtered =
        skill === null ? allPositions : (await experience.getExperience(skill)).items;
      setPositions(filtered);
      setSelectedSkill(skill);
    } catch {
      setPositions(allPositions);
      setSelectedSkill(null);
    } finally {
      setLoading(false);
    }
  };

  const countLabel =
    positionsLabel(positions.length) + (selectedSkill === null ? '' : ` with ${selectedSkill}`);
  const jsonPath =
    `/${options.experienceApiBase}/experience` +
    (selectedSkill === null ? '' : `?skill=${encodeURIComponent(selectedSkill)}`);
  const hiddenChipCount =
    skills === null || allChipsShown ? 0 : Math.max(0, skills.length - VISIBLE_CHIPS);

  return (
    <>
      <div className="skill-filter" id="skill-filter" hidden={skills === null}>
        <p className="skill-filter-label" id="skill-filter-label">
          Filter by skill
        </p>
        <div className="skill-filter-list" role="group" aria-labelledby="skill-filter-label">
          <button
            type="button"
            className="skill-chip"
            aria-pressed={selectedSkill === null}
            onClick={() => void select(null)}
          >
            All
          </button>
          {(skills ?? []).map((skill, index) => (
            <button
              type="button"
              className="skill-chip"
              key={skill.name}
              title={positionsLabel(skill.positionCount)}
              aria-pressed={selectedSkill === skill.name}
              hidden={!allChipsShown && index >= VISIBLE_CHIPS}
              onClick={() => void select(skill.name)}
            >
              {skill.name}
            </button>
          ))}
          {hiddenChipCount > 0 && (
            <button
              type="button"
              className="skill-chip skill-chip-more"
              aria-expanded="false"
              onClick={() => setAllChipsShown(true)}
            >
              +{hiddenChipCount} more
            </button>
          )}
        </div>
        <p className="skill-filter-status" aria-live="polite">
          <span className="skill-filter-count">{countLabel}</span> &middot; live from{' '}
          <a className="skill-filter-link" href={jsonPath} target="_blank" rel="noopener">
            {jsonPath}
          </a>
        </p>
      </div>

      <ol
        className={loading ? 'timeline is-loading' : 'timeline'}
        id="experience-timeline"
        role="list"
      >
        {positions.map((position) => (
          <li className="timeline-item" key={position.id}>
            <p className="timeline-date">
              <time dateTime={position.startDate}>{monthLabel(position.startDate)}</time> &ndash;{' '}
              {position.endDate ? (
                <time dateTime={position.endDate}>{monthLabel(position.endDate)}</time>
              ) : (
                'Present'
              )}{' '}
              &middot; {placeLabel(position)}
            </p>
            <h3>{position.title}</h3>
            <p className="timeline-org">{position.organization}</p>
            <ul className="timeline-points">
              {position.highlights.map((highlight, index) => (
                <li key={index}>{highlight}</li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      {failed && (
        <p className="form-status is-error" role="status">
          The work history could not be loaded right now. The{' '}
          <a href={options.resumeUrl} rel="noopener">
            resume PDF
          </a>{' '}
          has it all.
        </p>
      )}
    </>
  );
}
