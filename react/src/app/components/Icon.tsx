/** Props of Icon. */
export interface IconProps {
  /** Symbol id without the "icon-" prefix, e.g. "github". */
  readonly name: string;
}

/** One icon from the sprite in IconSprite. Decorative: labelled by the surrounding link or button. */
export function Icon({ name }: IconProps) {
  return (
    <svg className="icon" aria-hidden="true" focusable="false">
      <use href={`#icon-${name}`} />
    </svg>
  );
}
