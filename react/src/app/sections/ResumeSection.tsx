import { ExperienceTimeline } from '../components/ExperienceTimeline';
import { Icon } from '../components/Icon';
import { useSite } from '../providers/SiteProvider';

/** Resume: the download link, then the API-backed timeline, then education. */
export function ResumeSection() {
  const { options } = useSite();
  return (
    <section className="section" id="resume" aria-labelledby="resume-title">
      <div className="container">
        <div className="section-head">
          <div>
            <p className="eyebrow">05 / Resume</p>
            <h2 id="resume-title">Experience</h2>
          </div>
          <a className="button button-secondary" href={options.resumeUrl} rel="noopener">
            <Icon name="download" />
            Download resume (PDF)
          </a>
        </div>

        <ExperienceTimeline />

        <h3 className="subsection-title">Education</h3>
        <ol className="timeline timeline-compact" role="list">
          <li className="timeline-item">
            <h4>Massachusetts Institute of Technology (MIT)</h4>
            <p className="timeline-org">Physics - OpenCourseWare</p>
          </li>
          <li className="timeline-item">
            <h4>High School Diploma</h4>
            <p className="timeline-org">Graduated at age 16</p>
          </li>
        </ol>
      </div>
    </section>
  );
}
