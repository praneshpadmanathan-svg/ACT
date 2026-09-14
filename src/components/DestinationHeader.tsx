import { RealmScene } from './RealmScene';

export function DestinationHeader({
  title,
  eyebrow,
  detail,
  art,
}: {
  title: string;
  eyebrow: string;
  detail: string;
  art: 'scene-ridge' | 'scene-pass' | 'scene-river';
}) {
  return (
    <RealmScene art={art} className="destination-header">
      <div className="destination-header-copy">
        <span className="realm-kicker">
          <span />
          {eyebrow}
        </span>
        <h1>{title}</h1>
        <p>{detail}</p>
      </div>
      <span className="destination-compass" aria-hidden="true">
        ✧
      </span>
    </RealmScene>
  );
}
